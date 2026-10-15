# Viaggi

Sito statico su GitHub Pages. Il repository è pubblico ma i contenuti sono cifrati:
su GitHub ci sono solo file `data/*.bin` (AES-256-GCM, chiave derivata dalla password con PBKDF2-SHA256, 600k iterazioni).
La decifratura avviene nel browser.

## Struttura

- `src/` (**escluso da git**): sorgenti in chiaro e strumenti per preparare i viaggi (istruzioni in `src/tools/README.md`)
- `data/`: output cifrato generato da `build.py` (da committare)
- `index.html` + `assets/index.js`: login e elenco dei viaggi
- `viaggio.html` + `assets/viaggio.js`: apre un viaggio decifrato
- `assets/trip.css`, `assets/trip.js`: modello grafico comune dei viaggi, pensato per il telefono
- `assets/vendor/`: copie locali di icone (Phosphor) e mappe (Leaflet), per non eseguire script di terzi

## Pubblicare

1. `python build.py` (chiede la password) per cifrare `src/` in `data/`
2. commit e push

Regola per i commit: messaggi generici, senza nomi di luoghi, date o dettagli dei viaggi.
I messaggi sono pubblici anche se i contenuti sono cifrati.
