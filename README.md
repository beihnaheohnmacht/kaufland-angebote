# Kaufland-Angebote

Holt täglich die öffentlichen Angebote einer Kaufland-Filiale (Berlin-Alt-Hohenschönhausen)
und legt sie als `angebote.json` ab. Die private Haushalts-App „Zu Hause“ liest diese Datei
und markiert passende Einträge auf der Einkaufsliste.

- `abholen.mjs` – das Hilfsprogramm (ohne Zusatzpakete)
- `.github/workflows/abholen.yml` – läuft täglich automatisch
- `angebote.json` – das Ergebnis

Enthält nur öffentliche Angebotsdaten, keine persönlichen Daten.
