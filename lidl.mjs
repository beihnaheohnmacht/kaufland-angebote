// Holt die Lidl-Angebote aus den Aktionsprospekten (diese und nächste Woche) und speichert sie als lidl.json.
// Lidl-Angebote sind bundesweit gleich. Liest nur öffentliche Daten – keine Anmeldung.
//
// Besonderheit: Lebensmittel stehen im Prospekt nur als Bild. Ihre Namen stecken aber in den
// Rezept-Links auf den Prospektseiten (…&utm_content=Arla_Kaergarden_Butter) – dafür gibt es keinen Preis.
// Getränke & Co. stehen dagegen als Produkte mit Preis in den Prospektdaten.
import { BROWSER, sauber, speichern } from "./gemeinsam.mjs";

const UEBERSICHT = "https://www.lidl.de/c/online-prospekte/s10005610";
const PROSPEKT = (name) =>
  `https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=${encodeURIComponent(name)}&region_id=0&region_code=0`;
const MIT_PREIS = /wein, bier|lebensmittel|getränke|kaffee|süß/i; // Produkte mit Preis, die man isst/trinkt

async function holen(url, art) {
  const r = await fetch(url, { headers: { ...BROWSER, Accept: art }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`Lidl antwortet mit ${r.status}: ${url}`);
  return art.includes("json") ? r.json() : r.text();
}

// "Haehnchen_Minutenschnitzel" -> "Hähnchen Minutenschnitzel" (ae/oe/ue nicht nach Selbstlaut: "Steuer" bleibt)
function lesbar(text) {
  return decodeURIComponent(text).replace(/[_+]+/g, " ")
    .replace(/(?<![aeiouAEIOU])ae/g, "ä").replace(/(?<![aeiouAEIOU])oe/g, "ö").replace(/(?<![aeiouAEIOU])ue/g, "ü")
    .replace(/(?<![aeiouAEIOU])Ae/g, "Ä").replace(/(?<![aeiouAEIOU])Oe/g, "Ö").replace(/(?<![aeiouAEIOU])Ue/g, "Ü");
}

const seite = await holen(UEBERSICHT, "text/html");
const namen = [...new Set([...seite.matchAll(/\/l\/prospekte\/(aktionsprospekt-[a-z0-9-]+)\//g)].map((m) => m[1]))];
if (namen.length === 0) throw new Error("Kein Lidl-Aktionsprospekt gefunden");

const angebote = new Map();
for (const name of namen.slice(0, 2)) { // diese und nächste Woche
  let prospekt;
  try {
    prospekt = (await holen(PROSPEKT(name), "application/json")).flyer;
  } catch (fehler) {
    console.error(fehler.message);
    continue;
  }
  const von = prospekt.offerStartDate || prospekt.startDate || "";
  const bis = prospekt.offerEndDate || prospekt.endDate || "";

  // 1) Produkte mit Preis (nur Essen & Trinken)
  for (const p of Object.values(prospekt.products || {})) {
    if (!MIT_PREIS.test(p.wonCategoryPrimary || "")) continue;
    const titel = sauber(p.title);
    if (!titel) continue;
    angebote.set(`p${p.productId}`, {
      id: `p${p.productId}`, marke: "", titel, info: "", preis: String(p.price || ""), alt: "", rabatt: 0,
      einheit: "", von, bis, kategorie: sauber(String(p.wonCategoryPrimary || "").split("/")[1] || ""),
    });
  }

  // 2) Lebensmittel aus den Rezept-Links (ohne Preis)
  for (const s of prospekt.pages || []) {
    const links = typeof s.links === "string" ? JSON.parse(s.links || "[]") : s.links || [];
    for (const l of links) {
      const url = String(l.url || "");
      if (!url.includes("rezepte.lidl.de")) continue;
      const roh = url.match(/[?&]utm_content=([^&]+)/)?.[1];
      if (!roh) continue;
      const titel = sauber(lesbar(roh));
      const id = `r${name}|${titel}`;
      if (/signet/i.test(titel)) continue; // Prospekt-Symbole wie "Halloween Signet", kein Produkt
      if (titel && !angebote.has(id)) {
        angebote.set(id, {
          id, marke: "", titel, info: "", preis: "", alt: "", rabatt: 0, einheit: "", von, bis, kategorie: "Lebensmittel",
        });
      }
    }
  }
}

if (angebote.size === 0) {
  console.error("Keine Lidl-Angebote gefunden");
  process.exit(1);
}
speichern("lidl.json", "lidl", "", [...angebote.values()]);
