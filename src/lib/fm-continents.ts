// Lightweight country → continent mapping used by league-stats filters.
// Covers most commonly-imported football nations; unknown returns null.
import { getAliasOverrides, getContinentOverrides } from "./fm-country-overrides";

const MAP: Record<string, string> = {};
const add = (cont: string, names: string[]) => names.forEach((n) => (MAP[n.toLowerCase()] = cont));

add("Europa", [
  "Portugal","Espanha","Spain","Inglaterra","England","França","France","Itália","Italy","Alemanha","Germany",
  "Holanda","Países Baixos","Netherlands","Bélgica","Belgium","Escócia","Scotland","Gales","Wales","Irlanda","Ireland",
  "Suíça","Switzerland","Áustria","Austria","Dinamarca","Denmark","Suécia","Sweden","Noruega","Norway",
  "Finlândia","Finland","Polónia","Poland","Rússia","Russia","Ucrânia","Ukraine","República Checa","Czechia","Czech Republic",
  "Eslováquia","Slovakia","Hungria","Hungary","Roménia","Romania","Bulgária","Bulgaria","Grécia","Greece",
  "Turquia","Turkey","Sérvia","Serbia","Croácia","Croatia","Eslovénia","Slovenia","Bósnia","Bosnia",
  "Macedónia","Macedonia","Montenegro","Albânia","Albania","Kosovo","Chipre","Cyprus","Malta","Islândia","Iceland",
  "Luxemburgo","Luxembourg","Andorra","San Marino","Liechtenstein","Bielorrússia","Belarus","Moldávia","Moldova",
  "Lituânia","Lithuania","Letónia","Latvia","Estónia","Estonia","Geórgia","Georgia","Arménia","Armenia","Azerbaijão","Azerbaijan",
]);
add("América do Sul", [
  "Brasil","Brazil","Argentina","Uruguai","Uruguay","Chile","Colômbia","Colombia","Peru","Equador","Ecuador",
  "Bolívia","Bolivia","Paraguai","Paraguay","Venezuela",
]);
add("América do Norte", [
  "Estados Unidos","United States","USA","México","Mexico","Canadá","Canada","Costa Rica","Panamá","Panama",
  "Honduras","Jamaica","Trinidad","Guatemala","El Salvador",
]);
add("África", [
  "Marrocos","Morocco","Argélia","Algeria","Tunísia","Tunisia","Egito","Egypt","Nigéria","Nigeria","Gana","Ghana",
  "Senegal","Camarões","Cameroon","Costa do Marfim","Ivory Coast","África do Sul","South Africa","Angola","Moçambique","Mozambique",
  "Cabo Verde","Mali","Burkina Faso","Quénia","Kenya","Etiópia","Ethiopia","Congo","Zâmbia","Zambia","Uganda",
]);
add("Ásia", [
  "Japão","Japan","Coreia do Sul","South Korea","Korea","China","Arábia Saudita","Saudi Arabia","Irão","Iran","Iraque","Iraq",
  "Qatar","Catar","Emirados Árabes Unidos","UAE","United Arab Emirates","Israel","Síria","Syria","Jordânia","Jordan",
  "Líbano","Lebanon","Índia","India","Tailândia","Thailand","Indonésia","Indonesia","Malásia","Malaysia","Vietname","Vietnam",
  "Filipinas","Philippines","Singapura","Singapore","Hong Kong","Uzbequistão","Uzbekistan","Cazaquistão","Kazakhstan",
]);
add("Oceânia", ["Austrália","Australia","Nova Zelândia","New Zealand","Fiji","Tahiti","Papua Nova Guiné","Papua New Guinea"]);

// 3-letter country codes (FIFA/ISO) → continent
add("Europa", [
  "POR","ESP","ENG","GBR","FRA","ITA","GER","DEU","NED","NLD","BEL","SCO","WAL","IRL","NIR",
  "SUI","CHE","AUT","DEN","DNK","SWE","NOR","FIN","POL","RUS","UKR","CZE","SVK","HUN","ROU",
  "BUL","BGR","GRE","GRC","TUR","SRB","CRO","HRV","SVN","BIH","MKD","MNE","ALB","KOS","CYP",
  "MLT","ISL","LUX","AND","SMR","LIE","BLR","MDA","LTU","LVA","EST","GEO","ARM","AZE","FRO","GIB",
]);
add("América do Sul", ["BRA","ARG","URU","URY","CHI","CHL","COL","PER","ECU","BOL","PAR","PRY","VEN","SUR","GUY"]);
add("América do Norte", ["USA","MEX","CAN","CRC","PAN","HON","JAM","TRI","GUA","SLV","HAI","HTI","CUB","DOM","NCA"]);
add("África", [
  "MAR","ALG","DZA","TUN","EGY","NGA","GHA","SEN","CMR","CIV","RSA","ZAF","ANG","MOZ","CPV",
  "MLI","BFA","KEN","ETH","COD","COG","ZAM","UGA","TOG","BEN","GUI","GAB","GAM","ZIM","NAM","SUD","LBY",
]);
add("Ásia", [
  "JPN","KOR","PRK","CHN","KSA","SAU","IRN","IRQ","QAT","UAE","ISR","SYR","JOR","LBN","IND",
  "THA","IDN","MAS","MYS","VIE","VNM","PHI","SGP","HKG","UZB","KAZ","KGZ","TJK","TKM","BHR","KUW","OMN","YEM","PAK","BAN","BGD","NEP","SRI",
]);
add("Oceânia", ["AUS","NZL","FIJ","TAH","PNG","SOL","VAN","NCL"]);

// Aliases that should be merged into a single canonical country name.
// Add new entries here whenever the same country appears under different
// names/codes in imported data.
const COUNTRY_ALIASES: Record<string, string> = {
  "holanda": "Países Baixos",
  "países baixos": "Países Baixos",
  "paises baixos": "Países Baixos",
  "netherlands": "Países Baixos",
  "the netherlands": "Países Baixos",
  "nederland": "Países Baixos",
  "ned": "Países Baixos",
  "nld": "Países Baixos",
  "hol": "Países Baixos",
};

export function normalizeCountry<T extends string | null | undefined>(country: T): T {
  if (!country) return country;
  const key = String(country).trim().toLowerCase();
  const userAlias = getAliasOverrides()[key];
  const canon = userAlias ?? COUNTRY_ALIASES[key];
  return (canon ?? country) as T;
}

export function continentOf(country: string | null | undefined): string | null {
  if (!country) return null;
  const norm = normalizeCountry(country);
  const overrides = getContinentOverrides();
  const ov =
    overrides[String(norm).toLowerCase()] ??
    overrides[String(country).toLowerCase()];
  if (ov) return ov;
  return MAP[String(norm).toLowerCase()] ?? MAP[country.toLowerCase()] ?? null;
}

export const CONTINENTS = ["Europa","América do Sul","América do Norte","África","Ásia","Oceânia"] as const;

// ---- Introspection helpers (used by debug pages) ----

/** Built-in continent for a country key (ignores user overrides). */
export function builtInContinentOf(country: string | null | undefined): string | null {
  if (!country) return null;
  const key = String(country).trim().toLowerCase();
  const canonAlias = COUNTRY_ALIASES[key];
  const lookup = canonAlias ? canonAlias.toLowerCase() : key;
  return MAP[lookup] ?? MAP[key] ?? null;
}

/** All hard-coded country/abbreviation keys with their built-in continent. */
export function listBuiltInContinents(): Array<{ key: string; continent: string }> {
  return Object.entries(MAP).map(([key, continent]) => ({ key, continent }));
}

/** All hard-coded aliases (alias → canonical). */
export function listBuiltInAliases(): Array<{ alias: string; canonical: string }> {
  return Object.entries(COUNTRY_ALIASES).map(([alias, canonical]) => ({ alias, canonical }));
}
