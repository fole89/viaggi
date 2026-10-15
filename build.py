"""Cifra i viaggi in src/ e scrive i file pubblici in data/.

Uso:
    python build.py            # chiede la password
    VIAGGI_PASSWORD=... python build.py

src/ contiene i sorgenti in chiaro ed e' escluso da git: su GitHub finisce solo data/.
"""
import base64
import getpass
import hashlib
import hmac
import json
import os
import secrets
import sys
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
DATA = ROOT / "data"
CONFIG = DATA / "crypto.json"
INDEX = DATA / "trips.bin"
ITERATIONS = 600_000
PUBLIC_FIELDS = ("title", "start", "end", "route", "tagline", "cover", "image")


def load_config():
    if CONFIG.exists():
        return json.loads(CONFIG.read_text(encoding="utf-8"))
    return {"v": 1, "kdf": "PBKDF2-SHA256", "iterations": ITERATIONS,
            "salt": base64.b64encode(secrets.token_bytes(16)).decode()}


def derive_key(password, config):
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32,
                     salt=base64.b64decode(config["salt"]), iterations=config["iterations"])
    return kdf.derive(password.encode("utf-8"))


def decrypt(path, key):
    blob = path.read_bytes()
    return AESGCM(key).decrypt(blob[:12], blob[12:], None)


def write_encrypted(path, plaintext, key):
    """Riscrive il file solo se il contenuto e' cambiato, per non sporcare i diff."""
    if path.exists():
        try:
            if decrypt(path, key) == plaintext:
                return False
        except InvalidTag:
            pass
    iv = secrets.token_bytes(12)
    path.write_bytes(iv + AESGCM(key).encrypt(iv, plaintext, None))
    return True


def ask_password(config):
    password = os.environ.get("VIAGGI_PASSWORD") or getpass.getpass("Password: ")
    if not password:
        sys.exit("Password vuota.")
    # I file cifrati sono pubblici: una password corta si può indovinare offline, senza limiti di tentativi
    if len(password) < 16:
        print("Attenzione: password corta. Meglio una frase di 4-5 parole (almeno 16 caratteri).")
    key = derive_key(password, config)
    if os.environ.get("VIAGGI_PASSWORD"):
        # Senza prompt non si puo' confermare un cambio password: meglio fermarsi
        if INDEX.exists():
            try:
                decrypt(INDEX, key)
            except InvalidTag:
                sys.exit("VIAGGI_PASSWORD non corrisponde alla password attuale del sito.")
        return key
    if INDEX.exists():
        try:
            decrypt(INDEX, key)
            return key
        except InvalidTag:
            print("Questa password e' diversa da quella attuale del sito: verra' cambiata.")
    if getpass.getpass("Ripeti la password: ") != password:
        sys.exit("Le password non coincidono.")
    return key


def trip_name(key, trip_id):
    return hmac.new(key, b"trip:" + trip_id.encode(), hashlib.sha256).hexdigest()[:20]


def main():
    trips = json.loads((SRC / "trips.json").read_text(encoding="utf-8"))
    DATA.mkdir(exist_ok=True)
    config = load_config()
    key = ask_password(config)
    CONFIG.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")

    index, keep = [], {INDEX.name}
    for trip in trips:
        source = SRC / trip["file"]
        if not source.exists():
            sys.exit(f"Manca il file {source}")
        name = trip_name(key, trip["id"])
        target = DATA / f"{name}.bin"
        changed = write_encrypted(target, source.read_bytes(), key)
        keep.add(target.name)
        index.append({"data": name, **{k: trip[k] for k in PUBLIC_FIELDS if k in trip}})
        print(f"{'aggiornato' if changed else 'invariato '}  {trip['id']}")

    payload = json.dumps(index, ensure_ascii=False).encode("utf-8")
    print(f"{'aggiornato' if write_encrypted(INDEX, payload, key) else 'invariato '}  elenco viaggi")

    for stale in DATA.glob("*.bin"):
        if stale.name not in keep:
            stale.unlink()
            print(f"rimosso     {stale.name}")


if __name__ == "__main__":
    main()
