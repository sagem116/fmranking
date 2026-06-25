import {
  DEFAULT_POSITION_POINTS,
  DEFAULT_DIVISION_WEIGHTS,
  DEFAULT_COMPETITION_WEIGHTS,
  DEFAULT_TITLE_WEIGHTS,
  DEFAULT_NATIONAL_LEAGUE_WEIGHTS,
  DEFAULT_INTERNATIONAL_WEIGHTS,
  NATIONAL_CHAMPION_BONUS,
  SUPERLEAGUE_CHAMPION_BONUS,
  SUPERLEAGUE_PROMOTION_BONUS,
  DOBRADINHA_BONUS,
  DOBRADINHA_INT_BONUS,
  TRIPLETE_BONUS,
  QUADRUPLE_BONUS,
} from "./fm-defaults";

export interface DecayMultipliers {
  last: number;   // última época (age 0)
  age1: number;   // há 1 época
  age2: number;   // há 2 épocas
  age3: number;   // há 3 épocas
  older: number;  // épocas mais antigas (4+)
}

export interface StageMultipliers {
  finalist: number; // finalista vencido
  semi: number;     // meia-final
  quarter: number;  // quartos de final
}

export interface FmConfig {
  positionPoints: Record<number, number>;
  divisionWeights: Record<number, number>;
  competitionWeights: { national: number; continental: number; superleague: number; international: number };
  titleWeights: { match: string; label: string; weight: number }[];
  nationalLeagueWeights: { match: string; label: string; weight: number; positionBonuses?: Record<number, number> }[];
  internationalWeights: { match: string; label: string; weight: number }[];
  nationalChampionBonus: number;
  superleagueChampionBonus: number;
  superleaguePromotionBonus: number;
  dobradinhaBonus: number;
  dobradinhaInternacionalBonus: number;
  tripleteBonus: number;
  quadrupleBonus: number;
  tripleteContinentalCompetitions: string[]; // lista de nomes/keywords. Vazio = qualquer competição continental conta.
  dobradinhaIntContinentalCompetitions: string[]; // lista para Dobradinha Internacional (SL+Cont). Vazio = qualquer.
  quadrupleContinentalCompetitions: string[]; // continental europeia para Quadruple. Vazio = qualquer.
  quadrupleClubWorldCupCompetitions: string[]; // competições "Club World Cup". Vazio = match por nome ("club world cup").
  decayMultipliers: DecayMultipliers;
  stageMultipliers: StageMultipliers;
  normalizePointsByGames: boolean;
}

export const DEFAULT_DECAY: DecayMultipliers = {
  last: 1,
  age1: 0.85,
  age2: 0.7,
  age3: 0.55,
  older: 0.4,
};

export const DEFAULT_STAGE: StageMultipliers = {
  finalist: 0.3,
  semi: 0.15,
  quarter: 0.075,
};

export const DEFAULT_CONFIG: FmConfig = {
  positionPoints: { ...DEFAULT_POSITION_POINTS },
  divisionWeights: { ...DEFAULT_DIVISION_WEIGHTS },
  competitionWeights: { ...DEFAULT_COMPETITION_WEIGHTS },
  titleWeights: DEFAULT_TITLE_WEIGHTS.map((t) => ({ ...t })),
  nationalLeagueWeights: DEFAULT_NATIONAL_LEAGUE_WEIGHTS.map((t) => ({ ...t })),
  internationalWeights: DEFAULT_INTERNATIONAL_WEIGHTS.map((t) => ({ ...t })),
  nationalChampionBonus: NATIONAL_CHAMPION_BONUS,
  superleagueChampionBonus: SUPERLEAGUE_CHAMPION_BONUS,
  superleaguePromotionBonus: SUPERLEAGUE_PROMOTION_BONUS,
  dobradinhaBonus: DOBRADINHA_BONUS,
  dobradinhaInternacionalBonus: DOBRADINHA_INT_BONUS,
  tripleteBonus: TRIPLETE_BONUS,
  quadrupleBonus: QUADRUPLE_BONUS,
  tripleteContinentalCompetitions: ["Champions"],
  dobradinhaIntContinentalCompetitions: ["Champions"],
  quadrupleContinentalCompetitions: ["Champions"],
  quadrupleClubWorldCupCompetitions: ["Club World Cup"],
  decayMultipliers: { ...DEFAULT_DECAY },
  stageMultipliers: { ...DEFAULT_STAGE },
  normalizePointsByGames: false,
};


export function cloneConfig(c: FmConfig): FmConfig {
  return {
    positionPoints: { ...c.positionPoints },
    divisionWeights: { ...c.divisionWeights },
    competitionWeights: { ...c.competitionWeights },
    titleWeights: c.titleWeights.map((t) => ({ ...t })),
    nationalLeagueWeights: c.nationalLeagueWeights.map((t) => ({ ...t, positionBonuses: t.positionBonuses ? { ...t.positionBonuses } : undefined })),
    internationalWeights: c.internationalWeights.map((t) => ({ ...t })),
    nationalChampionBonus: c.nationalChampionBonus,
    superleagueChampionBonus: c.superleagueChampionBonus,
    superleaguePromotionBonus: c.superleaguePromotionBonus,
    dobradinhaBonus: c.dobradinhaBonus,
    dobradinhaInternacionalBonus: c.dobradinhaInternacionalBonus,
    tripleteBonus: c.tripleteBonus,
    quadrupleBonus: c.quadrupleBonus,
    tripleteContinentalCompetitions: [...(c.tripleteContinentalCompetitions ?? [])],
    dobradinhaIntContinentalCompetitions: [...(c.dobradinhaIntContinentalCompetitions ?? [])],
    quadrupleContinentalCompetitions: [...(c.quadrupleContinentalCompetitions ?? [])],
    quadrupleClubWorldCupCompetitions: [...(c.quadrupleClubWorldCupCompetitions ?? [])],
    decayMultipliers: { ...c.decayMultipliers },
    stageMultipliers: { ...c.stageMultipliers },
    normalizePointsByGames: c.normalizePointsByGames,
  };
}

// ---- scoring helpers driven by a config ----
export function cfgPositionPoints(cfg: FmConfig, pos: number | null | undefined): number {
  if (!pos || pos < 1) return 0;
  if (cfg.positionPoints[pos] != null) return cfg.positionPoints[pos];
  return Math.max(2, Math.round(16 - (pos - 20) * 1.2));
}

export function cfgDivisionWeight(cfg: FmConfig, div: number | null | undefined): number {
  if (!div) return 1;
  return cfg.divisionWeights[div] ?? 1;
}

export function cfgTitleWeight(cfg: FmConfig, competition: string): { label: string; weight: number } {
  const n = competition
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const t of cfg.titleWeights) {
    if (n.includes(t.match)) return { label: t.label, weight: t.weight };
  }
  return { label: competition, weight: 150 };
}

export function cfgNationalLeagueWeight(cfg: FmConfig, leagueLabel: string | null | undefined): number {
  if (!leagueLabel) return 1;
  const n = leagueLabel.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!n) return 1;
  for (const t of cfg.nationalLeagueWeights) {
    if (t.match && n.includes(t.match)) return t.weight;
  }
  return 1;
}

export function cfgNationalLeagueEntry(
  cfg: FmConfig,
  leagueLabel: string | null | undefined,
): { match: string; label: string; weight: number; positionBonuses?: Record<number, number> } | null {
  if (!leagueLabel) return null;
  const n = leagueLabel.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!n) return null;
  for (const t of cfg.nationalLeagueWeights) {
    if (t.match && n.includes(t.match)) return t;
  }
  return null;
}

export function cfgNationalLeaguePositionBonus(
  cfg: FmConfig,
  leagueLabel: string | null | undefined,
  position: number | null | undefined,
): number {
  if (!position || position < 1) return 0;
  const entry = cfgNationalLeagueEntry(cfg, leagueLabel);
  if (!entry?.positionBonuses) return 0;
  return Number(entry.positionBonuses[position]) || 0;
}

export function cfgInternationalWeight(
  cfg: FmConfig,
  competition: string,
): { label: string; weight: number } {
  const n = competition
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  for (const t of cfg.internationalWeights) {
    if (t.match && n.includes(t.match)) return { label: t.label, weight: t.weight };
  }
  return { label: competition, weight: 150 };
}

export function cfgDecay(cfg: FmConfig, seasonYear: number, latestYear: number): number {
  const age = Math.max(0, latestYear - seasonYear);
  const d = cfg.decayMultipliers;
  if (age === 0) return d.last;
  if (age === 1) return d.age1;
  if (age === 2) return d.age2;
  if (age === 3) return d.age3;
  return d.older;
}

// ---- serialization to/from config_weights rows ----
export interface ConfigRow {
  profile_id: string;
  category: string;
  key: string;
  value: number;
}

export function configToRows(profileId: string, cfg: FmConfig): ConfigRow[] {
  const rows: ConfigRow[] = [];
  for (const [k, v] of Object.entries(cfg.positionPoints)) rows.push({ profile_id: profileId, category: "position", key: k, value: v });
  for (const [k, v] of Object.entries(cfg.divisionWeights)) rows.push({ profile_id: profileId, category: "division", key: k, value: v });
  for (const [k, v] of Object.entries(cfg.competitionWeights)) rows.push({ profile_id: profileId, category: "competition", key: k, value: v });
  for (const t of cfg.titleWeights) rows.push({ profile_id: profileId, category: "title", key: `${t.match}\u0001${t.label}`, value: t.weight });
  for (const t of cfg.nationalLeagueWeights) {
    rows.push({ profile_id: profileId, category: "national-league", key: `${t.match}\u0001${t.label}`, value: t.weight });
    if (t.positionBonuses) {
      for (const [pos, val] of Object.entries(t.positionBonuses)) {
        const n = Number(val);
        if (!Number.isFinite(n) || n === 0) continue;
        rows.push({ profile_id: profileId, category: "national-league-pos-bonus", key: `${t.match}\u0001${pos}`, value: n });
      }
    }
  }
  for (const t of cfg.internationalWeights) rows.push({ profile_id: profileId, category: "international", key: `${t.match}\u0001${t.label}`, value: t.weight });
  rows.push({ profile_id: profileId, category: "bonus", key: "national", value: cfg.nationalChampionBonus });
  rows.push({ profile_id: profileId, category: "bonus", key: "superleague", value: cfg.superleagueChampionBonus });
  rows.push({ profile_id: profileId, category: "bonus", key: "superleague-promotion", value: cfg.superleaguePromotionBonus });
  rows.push({ profile_id: profileId, category: "bonus", key: "dobradinha", value: cfg.dobradinhaBonus });
  rows.push({ profile_id: profileId, category: "bonus", key: "dobradinha-int", value: cfg.dobradinhaInternacionalBonus });
  rows.push({ profile_id: profileId, category: "bonus", key: "triplete", value: cfg.tripleteBonus });
  rows.push({ profile_id: profileId, category: "bonus", key: "quadruple", value: cfg.quadrupleBonus });
  for (const name of cfg.tripleteContinentalCompetitions ?? []) {
    rows.push({ profile_id: profileId, category: "triplete-comp", key: name, value: 1 });
  }
  for (const name of cfg.dobradinhaIntContinentalCompetitions ?? []) {
    rows.push({ profile_id: profileId, category: "dobradinha-int-comp", key: name, value: 1 });
  }
  for (const name of cfg.quadrupleContinentalCompetitions ?? []) {
    rows.push({ profile_id: profileId, category: "quadruple-cont-comp", key: name, value: 1 });
  }
  for (const name of cfg.quadrupleClubWorldCupCompetitions ?? []) {
    rows.push({ profile_id: profileId, category: "quadruple-cwc-comp", key: name, value: 1 });
  }
  rows.push({ profile_id: profileId, category: "decay", key: "last", value: cfg.decayMultipliers.last });
  rows.push({ profile_id: profileId, category: "decay", key: "age1", value: cfg.decayMultipliers.age1 });
  rows.push({ profile_id: profileId, category: "decay", key: "age2", value: cfg.decayMultipliers.age2 });
  rows.push({ profile_id: profileId, category: "decay", key: "age3", value: cfg.decayMultipliers.age3 });
  rows.push({ profile_id: profileId, category: "decay", key: "older", value: cfg.decayMultipliers.older });
  rows.push({ profile_id: profileId, category: "stage", key: "finalist", value: cfg.stageMultipliers.finalist });
  rows.push({ profile_id: profileId, category: "stage", key: "semi", value: cfg.stageMultipliers.semi });
  rows.push({ profile_id: profileId, category: "stage", key: "quarter", value: cfg.stageMultipliers.quarter });
  rows.push({ profile_id: profileId, category: "meta", key: "normalizePointsByGames", value: cfg.normalizePointsByGames ? 1 : 0 });
  return rows;
}

export function rowsToConfig(rows: { category: string; key: string; value: number }[]): FmConfig {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  if (!rows.length) return cfg;
  // titles, national-league and international are list-typed: reset before applying rows
  const hasTitleRows = rows.some((r) => r.category === "title");
  const hasNLRows = rows.some((r) => r.category === "national-league");
  const hasIntRows = rows.some((r) => r.category === "international");
  if (hasTitleRows) cfg.titleWeights = [];
  if (hasNLRows) cfg.nationalLeagueWeights = [];
  if (hasIntRows) cfg.internationalWeights = [];
  const hasTripleteCompRows = rows.some((r) => r.category === "triplete-comp");
  if (hasTripleteCompRows) cfg.tripleteContinentalCompetitions = [];
  const hasDobIntCompRows = rows.some((r) => r.category === "dobradinha-int-comp");
  if (hasDobIntCompRows) cfg.dobradinhaIntContinentalCompetitions = [];
  const hasQuadContRows = rows.some((r) => r.category === "quadruple-cont-comp");
  if (hasQuadContRows) cfg.quadrupleContinentalCompetitions = [];
  const hasQuadCwcRows = rows.some((r) => r.category === "quadruple-cwc-comp");
  if (hasQuadCwcRows) cfg.quadrupleClubWorldCupCompetitions = [];
  for (const r of rows) {
    const v = Number(r.value);
    switch (r.category) {
      case "position":
        cfg.positionPoints[Number(r.key)] = v;
        break;
      case "division":
        cfg.divisionWeights[Number(r.key)] = v;
        break;
      case "competition":
        if (r.key in cfg.competitionWeights) (cfg.competitionWeights as Record<string, number>)[r.key] = v;
        break;
      case "title": {
        const [match, label] = r.key.split("\u0001");
        const m = match ?? "";
        const def = DEFAULT_TITLE_WEIGHTS.find((d) => d.match === m);
        cfg.titleWeights.push({ match: m, label: label || def?.label || m, weight: v });
        break;
      }
      case "national-league": {
        const [match, label] = r.key.split("\u0001");
        cfg.nationalLeagueWeights.push({ match: match ?? "", label: label ?? match ?? "", weight: v });
        break;
      }
      case "international": {
        const [match, label] = r.key.split("\u0001");
        cfg.internationalWeights.push({ match: match ?? "", label: label ?? match ?? "", weight: v });
        break;
      }
      case "bonus":
        if (r.key === "national") cfg.nationalChampionBonus = v;
        if (r.key === "superleague") cfg.superleagueChampionBonus = v;
        if (r.key === "superleague-promotion") cfg.superleaguePromotionBonus = v;
        if (r.key === "dobradinha") cfg.dobradinhaBonus = v;
        if (r.key === "dobradinha-int") cfg.dobradinhaInternacionalBonus = v;
        if (r.key === "triplete") cfg.tripleteBonus = v;
        if (r.key === "quadruple") cfg.quadrupleBonus = v;
        break;
      case "triplete-comp":
        cfg.tripleteContinentalCompetitions.push(r.key);
        break;
      case "dobradinha-int-comp":
        cfg.dobradinhaIntContinentalCompetitions.push(r.key);
        break;
      case "quadruple-cont-comp":
        cfg.quadrupleContinentalCompetitions.push(r.key);
        break;
      case "quadruple-cwc-comp":
        cfg.quadrupleClubWorldCupCompetitions.push(r.key);
        break;
      case "meta":
        // legacy single-value decay → spread across age buckets approximately
        if (r.key === "decayPerYear" && v < 1) {
          cfg.decayMultipliers = {
            last: 1,
            age1: Math.pow(v, 1),
            age2: Math.pow(v, 2),
            age3: Math.pow(v, 3),
            older: Math.pow(v, 4),
          };
        }
        if (r.key === "normalizePointsByGames") {
          cfg.normalizePointsByGames = v > 0;
        }
        break;
      case "decay":
        if (r.key in cfg.decayMultipliers) (cfg.decayMultipliers as unknown as Record<string, number>)[r.key] = v;
        break;
      case "stage":
        if (r.key in cfg.stageMultipliers) (cfg.stageMultipliers as unknown as Record<string, number>)[r.key] = v;
        break;
    }
  }
  // second pass: position bonuses depend on national-league entries already pushed
  for (const r of rows) {
    if (r.category !== "national-league-pos-bonus") continue;
    const [match, posStr] = r.key.split("\u0001");
    const pos = Number(posStr);
    const v = Number(r.value);
    if (!match || !Number.isFinite(pos) || !Number.isFinite(v)) continue;
    const entry = cfg.nationalLeagueWeights.find((t) => t.match === match);
    if (!entry) continue;
    (entry.positionBonuses ??= {})[pos] = v;
  }
  return cfg;
}