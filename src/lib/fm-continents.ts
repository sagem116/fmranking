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
// Each canonical country lists every alias we want collapsed onto it
// (3-letter FIFA/ISO codes, English/Portuguese variants, spelling differences).
const ALIAS_GROUPS: Array<[string, string[]]> = [
  // Europa
  ["Portugal", ["POR", "PRT", "Portugal"]],
  ["Espanha", ["ESP", "Spain", "Espana", "España"]],
  ["Inglaterra", ["ENG", "GBR", "England"]],
  ["Escócia", ["SCO", "Scotland", "Escocia"]],
  ["País de Gales", ["WAL", "Wales", "Gales"]],
  ["Irlanda do Norte", ["NIR", "Northern Ireland"]],
  ["República da Irlanda", ["IRL", "Ireland", "Irlanda", "Republic of Ireland"]],
  ["França", ["FRA", "France", "Franca"]],
  ["Itália", ["ITA", "Italy", "Italia"]],
  ["Alemanha", ["GER", "DEU", "Germany"]],
  ["Países Baixos", ["NED", "NLD", "HOL", "Netherlands", "The Netherlands", "Nederland", "Holanda", "Paises Baixos"]],
  ["Bélgica", ["BEL", "Belgium", "Belgica"]],
  ["Suíça", ["SUI", "CHE", "Switzerland", "Suica"]],
  ["Áustria", ["AUT", "Austria"]],
  ["Dinamarca", ["DEN", "DNK", "Denmark"]],
  ["Suécia", ["SWE", "Sweden", "Suecia"]],
  ["Noruega", ["NOR", "Norway"]],
  ["Finlândia", ["FIN", "Finland", "Finlandia"]],
  ["Polónia", ["POL", "Poland", "Polonia"]],
  ["Rússia", ["RUS", "Russia"]],
  ["Ucrânia", ["UKR", "Ukraine", "Ucrania"]],
  ["República Checa", ["CZE", "Czechia", "Czech Republic", "Republica Checa"]],
  ["Eslováquia", ["SVK", "Slovakia", "Eslovaquia"]],
  ["Hungria", ["HUN", "Hungary"]],
  ["Roménia", ["ROU", "Romania", "Romenia"]],
  ["Bulgária", ["BUL", "BGR", "Bulgaria"]],
  ["Grécia", ["GRE", "GRC", "Greece", "Grecia"]],
  ["Turquia", ["TUR", "Turkey", "Türkiye"]],
  ["Sérvia", ["SRB", "Serbia", "Servia"]],
  ["Croácia", ["CRO", "HRV", "Croatia", "Croacia"]],
  ["Eslovénia", ["SVN", "Slovenia", "Eslovenia"]],
  ["Bósnia e Herzegovina", ["BIH", "Bosnia", "Bosnia and Herzegovina", "Bosnia e Herzegovina"]],
  ["Macedónia do Norte", ["MKD", "Macedonia", "North Macedonia", "Macedonia do Norte"]],
  ["Montenegro", ["MNE", "Montenegro"]],
  ["Albânia", ["ALB", "Albania", "Albania"]],
  ["Kosovo", ["KOS", "XKX"]],
  ["Chipre", ["CYP", "Cyprus"]],
  ["Malta", ["MLT", "Malta"]],
  ["Islândia", ["ISL", "Iceland", "Islandia"]],
  ["Luxemburgo", ["LUX", "Luxembourg"]],
  ["Andorra", ["AND", "Andorra"]],
  ["San Marino", ["SMR", "San Marino"]],
  ["Liechtenstein", ["LIE", "Liechtenstein"]],
  ["Bielorrússia", ["BLR", "Belarus", "Bielorrussia"]],
  ["Moldávia", ["MDA", "Moldova", "Moldavia"]],
  ["Lituânia", ["LTU", "Lithuania", "Lituania"]],
  ["Letónia", ["LVA", "Latvia", "Letonia"]],
  ["Estónia", ["EST", "Estonia"]],
  ["Geórgia", ["GEO", "Georgia"]],
  ["Arménia", ["ARM", "Armenia"]],
  ["Azerbaijão", ["AZE", "Azerbaijan", "Azerbaijao"]],
  ["Ilhas Faroé", ["FRO", "Faroe Islands"]],
  ["Gibraltar", ["GIB", "Gibraltar"]],

  // América do Sul
  ["Brasil", ["BRA", "Brazil"]],
  ["Argentina", ["ARG", "Argentina"]],
  ["Uruguai", ["URU", "URY", "Uruguay"]],
  ["Chile", ["CHI", "CHL", "Chile"]],
  ["Colômbia", ["COL", "Colombia"]],
  ["Peru", ["PER", "Peru"]],
  ["Equador", ["ECU", "Ecuador"]],
  ["Bolívia", ["BOL", "Bolivia"]],
  ["Paraguai", ["PAR", "PRY", "Paraguay"]],
  ["Venezuela", ["VEN", "Venezuela"]],
  ["Suriname", ["SUR", "Suriname"]],
  ["Guiana", ["GUY", "Guyana"]],

  // América do Norte / Central / Caraíbas
  ["Estados Unidos", ["USA", "United States", "Estados Unidos"]],
  ["México", ["MEX", "Mexico"]],
  ["Canadá", ["CAN", "Canada"]],
  ["Costa Rica", ["CRC", "Costa Rica"]],
  ["Panamá", ["PAN", "Panama"]],
  ["Honduras", ["HON", "Honduras"]],
  ["Jamaica", ["JAM", "Jamaica"]],
  ["Trindade e Tobago", ["TRI", "Trinidad", "Trinidad and Tobago"]],
  ["Guatemala", ["GUA", "Guatemala"]],
  ["El Salvador", ["SLV", "El Salvador"]],
  ["Haiti", ["HAI", "HTI", "Haiti"]],
  ["Cuba", ["CUB", "Cuba"]],
  ["República Dominicana", ["DOM", "Dominican Republic", "Republica Dominicana"]],
  ["Nicarágua", ["NCA", "Nicaragua"]],

  // África
  ["Marrocos", ["MAR", "Morocco"]],
  ["Argélia", ["ALG", "DZA", "Algeria", "Argelia"]],
  ["Tunísia", ["TUN", "Tunisia", "Tunisia"]],
  ["Egito", ["EGY", "Egypt"]],
  ["Nigéria", ["NGA", "Nigeria"]],
  ["Gana", ["GHA", "Ghana"]],
  ["Senegal", ["SEN", "Senegal"]],
  ["Camarões", ["CMR", "Cameroon", "Camaroes"]],
  ["Costa do Marfim", ["CIV", "Ivory Coast", "Côte d'Ivoire"]],
  ["África do Sul", ["RSA", "ZAF", "South Africa", "Africa do Sul"]],
  ["Angola", ["ANG", "Angola"]],
  ["Moçambique", ["MOZ", "Mozambique", "Mocambique"]],
  ["Cabo Verde", ["CPV", "Cape Verde"]],
  ["Mali", ["MLI", "Mali"]],
  ["Burkina Faso", ["BFA", "Burkina Faso"]],
  ["Quénia", ["KEN", "Kenya", "Quenia"]],
  ["Etiópia", ["ETH", "Ethiopia", "Etiopia"]],
  ["RD Congo", ["COD", "DR Congo", "RD Congo", "Democratic Republic of the Congo"]],
  ["Congo", ["COG", "Republic of the Congo"]],
  ["Zâmbia", ["ZAM", "Zambia"]],
  ["Uganda", ["UGA", "Uganda"]],
  ["Togo", ["TOG", "Togo"]],
  ["Benim", ["BEN", "Benin"]],
  ["Guiné", ["GUI", "Guinea", "Guine"]],
  ["Gabão", ["GAB", "Gabon", "Gabao"]],
  ["Gâmbia", ["GAM", "Gambia"]],
  ["Zimbabwe", ["ZIM", "Zimbabwe"]],
  ["Namíbia", ["NAM", "Namibia"]],
  ["Sudão", ["SUD", "Sudan", "Sudao"]],
  ["Líbia", ["LBY", "Libya", "Libia"]],

  // Ásia
  ["Japão", ["JPN", "Japan", "Japao"]],
  ["Coreia do Sul", ["KOR", "South Korea", "Korea", "Coreia do Sul"]],
  ["Coreia do Norte", ["PRK", "North Korea", "Coreia do Norte"]],
  ["China", ["CHN", "China"]],
  ["Arábia Saudita", ["KSA", "SAU", "Saudi Arabia", "Arabia Saudita"]],
  ["Irão", ["IRN", "Iran", "Irao"]],
  ["Iraque", ["IRQ", "Iraq"]],
  ["Qatar", ["QAT", "Catar", "Qatar"]],
  ["Emirados Árabes Unidos", ["UAE", "United Arab Emirates", "Emirados Arabes Unidos"]],
  ["Israel", ["ISR", "Israel"]],
  ["Síria", ["SYR", "Syria", "Siria"]],
  ["Jordânia", ["JOR", "Jordan", "Jordania"]],
  ["Líbano", ["LBN", "Lebanon", "Libano"]],
  ["Índia", ["IND", "India"]],
  ["Tailândia", ["THA", "Thailand", "Tailandia"]],
  ["Indonésia", ["IDN", "Indonesia"]],
  ["Malásia", ["MAS", "MYS", "Malaysia", "Malasia"]],
  ["Vietname", ["VIE", "VNM", "Vietnam"]],
  ["Filipinas", ["PHI", "Philippines"]],
  ["Singapura", ["SGP", "Singapore"]],
  ["Hong Kong", ["HKG", "Hong Kong"]],
  ["Uzbequistão", ["UZB", "Uzbekistan", "Uzbequistao"]],
  ["Cazaquistão", ["KAZ", "Kazakhstan", "Cazaquistao"]],
  ["Quirguistão", ["KGZ", "Kyrgyzstan", "Quirguistao"]],
  ["Tajiquistão", ["TJK", "Tajikistan", "Tajiquistao"]],
  ["Turcomenistão", ["TKM", "Turkmenistan", "Turcomenistao"]],
  ["Bahrein", ["BHR", "Bahrain", "Bahrein"]],
  ["Kuwait", ["KUW", "Kuwait"]],
  ["Omã", ["OMN", "Oman", "Oma"]],
  ["Iémen", ["YEM", "Yemen", "Iemen"]],
  ["Paquistão", ["PAK", "Pakistan", "Paquistao"]],
  ["Bangladesh", ["BAN", "BGD", "Bangladesh"]],
  ["Nepal", ["NEP", "Nepal"]],
  ["Sri Lanka", ["SRI", "Sri Lanka"]],

  // Oceânia
  ["Austrália", ["AUS", "Australia"]],
  ["Nova Zelândia", ["NZL", "New Zealand", "Nova Zelandia"]],
  ["Fiji", ["FIJ", "Fiji"]],
  ["Tahiti", ["TAH", "Tahiti"]],
  ["Papua-Nova Guiné", ["PNG", "Papua New Guinea", "Papua Nova Guine"]],
  ["Ilhas Salomão", ["SOL", "Solomon Islands", "Ilhas Salomao"]],
  ["Vanuatu", ["VAN", "Vanuatu"]],
  ["Nova Caledónia", ["NCL", "New Caledonia", "Nova Caledonia"]],
];

const COUNTRY_ALIASES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [canonical, aliases] of ALIAS_GROUPS) {
    out[canonical.toLowerCase()] = canonical;
    for (const a of aliases) out[a.toLowerCase()] = canonical;
  }
  return out;
})();

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
