// Holt die aktuellen Netto-Angebote (Netto Marken-Discount, netto.de) und speichert sie als netto.json.
// Liest nur die öffentlichen Angebotsseiten – keine Anmeldung, keine persönlichen Daten.
// Die Angebote auf netto.de sind nicht filialgenau, sondern gelten (fast) überall.
import { BROWSER, preisAus, sauber, speichern } from "./gemeinsam.mjs";

// Themenseiten (ohne Nonfood) und zuletzt die Übersicht – so behalten Angebote,
// die auf beiden stehen, die Tage ihres Themas (z. B. erst ab Donnerstag)
const SEITEN = [
  "hammer-donnerstag/", "knaller-wochenende/", "spar-stars/", "regionale-produkte/", "dauerhaft-reduziert/", "",
];

// Manche Themen gelten nur an bestimmten Tagen dieser Woche (Montag = 0)
const TAGE = { "hammer-donnerstag": [3, 5], "knaller-wochenende": [4, 5] };
const heute = new Date();
const montag = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate() - ((heute.getUTCDay() + 6) % 7)));
const tag = (plus) => new Date(montag.getTime() + plus * 86400000).toISOString().slice(0, 10);

const angebote = new Map();
for (const seite of SEITEN) {
  const r = await fetch(`https://netto.de/angebote/${seite}`, {
    headers: { ...BROWSER, Accept: "text/html" },
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) {
    console.error(`Netto ${seite || "Übersicht"}: ${r.status}`);
    if (seite === "") process.exit(1); // ohne Übersicht lieber nichts überschreiben
    continue;
  }
  const html = await r.text();
  // Jede Angebotskarte beginnt mit aria-label="product-N"
  const karten = html.split(/aria-label="product-\d+"/).slice(1);
  for (const karte of karten) {
    const k = karte.slice(0, 6000).replace(/<!--.*?-->/g, "");
    const titel = sauber(k.match(/<h4[^>]*>([^<]*)<\/h4>/)?.[1]);
    if (!titel) continue;
    const info = sauber(k.match(/<\/h4><p[^>]*>([^<]*)<\/p>/)?.[1]);
    // Preis: <h3>2.<span>99</span></h3>
    const preisHtml = k.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] || "";
    const preis = preisAus(preisHtml.replace(/<[^>]+>/g, "").replace(/\s/g, ""));
    const alt = preisAus(k.match(/statt\s*([\d.,]+)/)?.[1]);
    const rabatt = Number(k.match(/>-(\d+)%</)?.[1]) || 0;
    const id = `${titel}|${info}`;
    const kategorie = seite.replace("/", "") || "angebote";
    const [ab, bis] = TAGE[kategorie] || [];
    if (!angebote.has(id)) {
      angebote.set(id, {
        id, marke: "", titel, info, preis, alt, rabatt, einheit: "",
        von: ab != null ? tag(ab) : "", bis: bis != null ? tag(bis) : "",
        kategorie,
      });
    }
  }
}

if (angebote.size === 0) {
  console.error("Keine Netto-Angebote gefunden");
  process.exit(1);
}
speichern("netto.json", "netto", "", [...angebote.values()]);
