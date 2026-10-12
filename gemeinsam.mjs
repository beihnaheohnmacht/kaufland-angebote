// Gemeinsame Helfer für alle Märkte (Kaufland, Rewe, Netto, Lidl).
// Jede Datei hat dasselbe Format:
// { markt, filiale, abgeholt, angebote: [{ id, marke, titel, info, preis, alt, rabatt, einheit, von, bis, kategorie }] }
import { writeFileSync } from "node:fs";

export const BROWSER = {
  "User-Agent": "Mozilla/5.0 (privater Angebots-Abgleich, 1x taeglich)",
  "Accept-Language": "de-DE,de;q=0.9",
};

export function entschluesseln(text) {
  return String(text || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function sauber(text, max = 160) {
  return entschluesseln(text).replace(/\s+/g, " ").trim().slice(0, max);
}

// "2026/42" -> { von: "2026-10-12" (Montag), bis: "2026-10-17" (Samstag) }
export function kalenderwoche(text) {
  const [jahr, kw] = String(text).split("/").map(Number);
  if (!jahr || !kw) return { von: "", bis: "" };
  const vierterJanuar = new Date(Date.UTC(jahr, 0, 4));
  const montag = new Date(vierterJanuar);
  montag.setUTCDate(vierterJanuar.getUTCDate() - ((vierterJanuar.getUTCDay() + 6) % 7) + (kw - 1) * 7);
  const samstag = new Date(montag);
  samstag.setUTCDate(montag.getUTCDate() + 5);
  return { von: montag.toISOString().slice(0, 10), bis: samstag.toISOString().slice(0, 10) };
}

// "1,29 €" -> "1.29"
export function preisAus(text) {
  const m = String(text || "").match(/(\d+)[,.](\d{2})/);
  return m ? `${m[1]}.${m[2]}` : "";
}

export function speichern(datei, markt, filiale, angebote) {
  const ergebnis = {
    markt,
    filiale,
    abgeholt: new Date().toISOString(),
    angebote: angebote.sort((a, b) => a.titel.localeCompare(b.titel, "de")),
  };
  writeFileSync(datei, JSON.stringify(ergebnis));
  console.log(`${markt}: ${angebote.length} Angebote → ${datei}`);
}
