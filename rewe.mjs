// Holt die Rewe-Angebote eines Markts aus dem Marktprospekt (diese und nächste Woche) und speichert sie als rewe.json.
// Rewe legt den Prospekt jedes Markts beim Prospekt-Dienst Publitas ab: rewe_<Jahr>_wk<Woche>_<Marktnummer>.
// Liest nur öffentliche Daten – keine Anmeldung. rewe.de selbst wird nicht abgefragt.
//
// Besonderheit: Der Prospekt-Text folgt der Gestaltung, Preise stehen nicht immer neben dem Produkt.
// Ein Preis wird nur übernommen, wenn er zum Grundpreis passt (500 g, 1 kg = 2.22 → 1.11).
// Sonst gibt es nur den Namen, ohne Preis (wie bei Lidl) – lieber kein Preis als ein falscher.
import { BROWSER, kalenderwoche, sauber, speichern } from "./gemeinsam.mjs";

const MARKT = process.env.REWE_MARKT || "1350078"; // Rewe Berlin, Bruno-Taut-Str. 1 (anderer Markt nur zum Testen)
const DATEN = (name) => `https://view.publitas.com/rewe-markt/${name}/spreads.json`;

// Zeilen, die zum Produkt gehören, aber nicht zum Namen
const DETAIL = /^(je |Kl\.|Sorte|Ursprung|versch\.|\(1 |zzgl\.|siehe |Herkunft|gegart|tiefgefroren|ohne |mit |aus |in )/i;
const PREIS = /^\d{1,3}\.\d{2}$/;
// Werbewörter, die im Text vor dem Produktnamen landen
const WERBUNG = /^(knaller|aktion|tiefpreis|neu|knaller aktion)$/i;
const WERBUNG_VORN = /^((knaller|aktion|tiefpreis)\s+)+/i;

// Kalenderwoche nach ISO (Montag als Wochenstart)
function isoWoche(datum) {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const jahr = d.getUTCFullYear();
  const woche = Math.ceil(((d - Date.UTC(jahr, 0, 1)) / 86400000 + 1) / 7);
  return { jahr, woche };
}

async function prospekt(jahr, woche) {
  for (const kw of new Set([String(woche), String(woche).padStart(2, "0")])) {
    const name = `rewe_${jahr}_wk${kw}_${MARKT}`;
    const r = await fetch(DATEN(name), { headers: { ...BROWSER, Accept: "application/json" }, signal: AbortSignal.timeout(60000) });
    if (r.ok) return r.json();
    if (r.status !== 404) throw new Error(`Publitas antwortet mit ${r.status}: ${name}`);
  }
  return null; // diese Woche (noch) kein Prospekt
}

// "je 20 x 0,5-l-Fl.-Kasten (1 l = 1.00)" → etwa 10.00; "je 16-WL-Btl. (1 WL = 0.31)" → etwa 4.96
// Bei Gurken & Co. gilt der Grundpreis fürs Abtropfgewicht ("360-g-Abtropfgew.").
function erwarteterPreis(titel, info) {
  const grund = info.match(/\(1 (kg|l|WL|Tab|St\.?|m) = (\d+\.\d{2})\)/i);
  if (!grund) return null;
  const einheit = grund[1].toLowerCase().replace(".", "");
  const abtropf = titel.match(/(\d+)-g-Abtropfgew/);
  const je = abtropf ? [, "", abtropf[1], "g"] : info.match(/je (?:(\d+) x )?(\d+(?:,\d+)?)[ -]?(kg|g|ml|l|WL|Tab|St)\b/i);
  if (!je) return null;
  let menge = Number(je[2].replace(",", ".")) * Number(je[1] || 1);
  const e = je[3].toLowerCase();
  if (e === "g" || e === "ml") menge /= 1000;
  const passt = (einheit === "kg" && (e === "g" || e === "kg")) || (einheit === "l" && (e === "ml" || e === "l"))
    || (einheit === e && ["wl", "tab", "st"].includes(e));
  // Der Grundpreis ist auf den Cent gerundet → bei großen Mengen (Kasten, Waschmittel) darf es etwas mehr abweichen
  return passt ? { preis: menge * Number(grund[2]), spiel: 0.02 + menge * 0.005 } : null;
}

// Ein Textblock kann mehrere Produkte enthalten ("… oder Direktsaft Orange, je 900-ml-Fl. …")
function produkteAus(block) {
  const zeilen = block.split("\n").map((z) => z.replace(/�/g, "").trim()).filter(Boolean);
  // Ursprungsland über zwei Zeilen ("Deutschland/" + "Niederlande:") zusammenziehen
  for (let i = zeilen.length - 2; i >= 0; i--) if (zeilen[i].endsWith("/")) zeilen.splice(i, 2, zeilen[i] + zeilen[i + 1]);

  const teile = [];
  let jetzt = [];
  for (const z of zeilen) {
    if (/^oder\b/i.test(z) && jetzt.length) { teile.push(jetzt); jetzt = []; }
    const rest = z.replace(/^oder\b\s*/i, "");
    if (rest) jetzt.push(rest);
  }
  teile.push(jetzt);

  const produkte = [];
  for (const teil of teile) {
    const name = [];
    const info = [];
    for (const z of teil) {
      if (info.length || DETAIL.test(z)) info.push(z);
      else if (/:$/.test(z) || PREIS.test(z) || WERBUNG.test(z)) continue; // "Spanien:", "0.44", "Knaller"
      else name.push(z);
    }
    if (!info.some((z) => /^je /i.test(z))) continue; // ohne "je …" ist es kein Produkt
    const titel = sauber(name.join(" ").replace(WERBUNG_VORN, "").replace(/^\d,\d von 5 /, "").replace(/,$/, ""), 100);
    if (titel.length < 3 || /bonus|rezept|prospekt/i.test(titel)) continue;
    if (!/[A-ZÄÖÜ]|ja!/.test(titel)) continue; // nur ein Wortrest wie "mariniert", kein Produktname
    if (/³|Größen:|T-Shirt|Strumpfhose/i.test(titel + info.join(" "))) continue; // Kleidung
    produkte.push({ titel, info: sauber(info.join(" "), 160) });
  }
  return produkte;
}

const heute = new Date();
const wochen = [isoWoche(heute), isoWoche(new Date(heute.getTime() + 7 * 86400000))];
const angebote = new Map();

for (const { jahr, woche } of wochen) {
  const daten = await prospekt(jahr, woche);
  if (!daten) { console.log(`Rewe: kein Prospekt für Woche ${woche}`); continue; }
  const { von, bis } = kalenderwoche(`${jahr}/${woche}`);

  for (const doppelseite of daten) {
    for (const seite of doppelseite.pages || []) {
      const text = String(seite.text || "");
      const preise = text.split("\n").map((z) => z.trim()).filter((z) => PREIS.test(z)).map(Number);
      for (const block of text.split(/\n\s*\n/)) {
        for (const { titel, info } of produkteAus(block)) {
          const soll = erwarteterPreis(titel, info);
          const treffer = soll === null ? undefined
            : preise.find((p) => Math.abs(p - soll.preis) <= soll.spiel);
          const id = `${woche}|${titel}|${info}`;
          if (angebote.has(id)) continue;
          angebote.set(id, {
            id, marke: "", titel, info, preis: treffer === undefined ? "" : treffer.toFixed(2), alt: "", rabatt: 0,
            einheit: "", von, bis, kategorie: "",
          });
        }
      }
    }
  }
}

// Schutz vor Gestaltungsänderungen: Normal sind gut 200 Angebote, gut 70 % mit Preis (getestet KW 42/2026 mit 8 Märkten).
// Fällt das Ergebnis stark ab, lieber die alte rewe.json behalten und im Ablauf als Fehler melden.
const mitPreis = [...angebote.values()].filter((a) => a.preis).length;
if (angebote.size < 80 || mitPreis < angebote.size * 0.3) {
  console.error(`Rewe-Ergebnis ungewöhnlich (${angebote.size} Angebote, ${mitPreis} mit Preis) – Prospekt-Gestaltung geändert? rewe.json bleibt unverändert.`);
  process.exit(1);
}
speichern(process.env.REWE_DATEI || "rewe.json", "rewe", MARKT, [...angebote.values()]);
