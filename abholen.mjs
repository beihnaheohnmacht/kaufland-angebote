// Holt die aktuellen Kaufland-Angebote einer Filiale und speichert sie als angebote.json.
// Läuft automatisch bei GitHub (siehe .github/workflows/abholen.yml), braucht keine Zusatzpakete.
// Liest nur die öffentliche Angebotsseite – keine Anmeldung, keine persönlichen Daten.
import { writeFileSync } from "node:fs";

const FILIALE = "DE6620"; // Kaufland Berlin-Alt-Hohenschönhausen, Hauptstraße 9-10
const SEITE = (woche) =>
  `https://filiale.kaufland.de/angebote/uebersicht.storeName=${FILIALE}.html?kloffer-week=${woche}`;
const TRENNER = " "; // steht im Titel zwischen Marke und Produkt

async function angeboteDerWoche(woche) {
  const antwort = await fetch(SEITE(woche), {
    headers: { "User-Agent": "Mozilla/5.0 (privater Angebots-Abgleich, 1x taeglich)", "Accept": "text/html" },
    signal: AbortSignal.timeout(60000),
  });
  if (!antwort.ok) throw new Error(`Kaufland antwortet mit ${antwort.status} (${woche})`);
  const html = await antwort.text();

  // Die Angebote stecken als Daten in der Seite: window.SSR['…'] = {"component":"OfferTemplate", …}
  const liste = [];
  for (const [, json] of html.matchAll(/window\.SSR\['[^']+'\]\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/g)) {
    let daten;
    try { daten = JSON.parse(json); } catch { continue; }
    if (daten.component !== "OfferTemplate") continue;
    for (const zyklus of daten.props?.offerData?.cycles || []) {
      for (const kategorie of zyklus.categories || []) {
        for (const o of kategorie.offers || []) {
          // Titel ist "MARKE&#x2028;Produkt" -> Marke und Produkt getrennt speichern
          // (sonst: title = Marke, subtitle = Produkt)
          const teile = entschluesseln(o.detailTitle || "").split(TRENNER);
          const marke = sauber(teile.length > 1 ? teile[0] : o.subtitle ? o.title : "");
          const produkt = sauber(teile.length > 1 ? teile.slice(1).join(" ") : o.subtitle || o.detailTitle || o.title);
          // Die Beschreibung beginnt oft mit dem Produktnamen ("Butterkäse – zart…"): den weglassen
          let info = sauber(o.detailDescription);
          if (produkt && info.startsWith(produkt)) info = info.slice(produkt.length).replace(/^\s*[–-]\s*/, "");
          liste.push({
            id: o.offerId,
            marke,
            titel: produkt,
            info,
            preis: o.formattedPrice || (o.price != null ? String(o.price) : ""),
            alt: o.formattedOldPrice || "",
            rabatt: Number(o.discount) || 0,
            card: Number(o.loyaltyDiscount) > 0, // Rabatt nur mit Kaufland Card
            einheit: sauber(o.unit),
            von: o.dateFrom || kategorie.dateFrom || "",
            bis: o.dateTo || kategorie.dateTo || "",
            kategorie: sauber(kategorie.displayName),
          });
        }
      }
    }
  }
  return liste;
}

function entschluesseln(text) {
  return String(text || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
}

function sauber(text) {
  return entschluesseln(text).split(TRENNER).join(" ").replace(/\s+/g, " ").trim().slice(0, 160);
}

const alle = new Map();
for (const woche of ["current", "next"]) {
  try {
    for (const a of await angeboteDerWoche(woche)) if (a.id && a.titel) alle.set(a.id, a);
  } catch (fehler) {
    console.error(fehler.message);
    if (woche === "current") process.exit(1); // ohne aktuelle Woche lieber nichts überschreiben
  }
}

const ergebnis = {
  filiale: FILIALE,
  abgeholt: new Date().toISOString(),
  angebote: [...alle.values()].sort((a, b) => a.titel.localeCompare(b.titel, "de")),
};
writeFileSync("angebote.json", JSON.stringify(ergebnis));
console.log(`${ergebnis.angebote.length} Angebote gespeichert.`);
