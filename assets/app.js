// Decifratura lato browser: stessi parametri di build.py (PBKDF2-SHA256 + AES-256-GCM).
const Vault = (() => {
  const STORE = 'viaggi.key';
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64e = u => btoa(String.fromCharCode(...u));

  async function config() {
    const r = await fetch('data/crypto.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('config');
    return r.json();
  }

  async function derive(password) {
    const cfg = await config();
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: b64d(cfg.salt), iterations: cfg.iterations }, base, 256);
    return new Uint8Array(bits);
  }

  async function decrypt(path, raw) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error('fetch');
    const buf = new Uint8Array(await r.arrayBuffer());
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
    return new TextDecoder().decode(pt);
  }

  function load() {
    try {
      const s = sessionStorage.getItem(STORE) || localStorage.getItem(STORE);
      return s ? b64d(s) : null;
    } catch (e) { return null; }
  }

  function save(raw, remember) {
    try { (remember ? localStorage : sessionStorage).setItem(STORE, b64e(raw)); } catch (e) {}
  }

  function clear() {
    try { sessionStorage.removeItem(STORE); localStorage.removeItem(STORE); } catch (e) {}
  }

  return { derive, decrypt, load, save, clear };
})();
