# Angebote (Kaufland, Rewe, Netto, Lidl)

Holt täglich öffentliche Supermarkt-Angebote und legt sie als JSON-Dateien ab. Die private
Haushalts-App „Zu Hause“ liest diese Dateien und markiert passende Einträge auf der Einkaufsliste.
Der Abgleich passiert nur auf dem Handy – hierher werden keine Daten geschickt.

| Datei | Markt | Programm |
|---|---|---|
| `angebote.json` | Kaufland, eine Filiale (Berlin-Alt-Hohenschönhausen) | `abholen.mjs` |
| `rewe.json` | Rewe, ein Markt (Berlin, Bruno-Taut-Str. 1) – aus dem öffentlichen Marktprospekt bei Publitas; Preise nur, wenn sie zum Grundpreis passen | `rewe.mjs` |
| `netto.json` | Netto Marken-Discount (bundesweite Angebote von netto.de) | `netto.mjs` |
| `lidl.json` | Lidl (bundesweite Aktionsprospekte; Lebensmittel nur mit Namen, ohne Preis) | `lidl.mjs` |

- `gemeinsam.mjs` – gemeinsame Helfer (gleiches Format für alle Märkte)
- `.github/workflows/abholen.yml` – läuft täglich automatisch, jeder Markt für sich

Ohne Zusatzpakete. Enthält nur öffentliche Angebotsdaten, keine persönlichen Daten.
