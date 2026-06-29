import type { AllData } from "./fm-db";
import {
  DEFAULT_CONFIG,
  cfgPositionPoints,
  cfgDivisionWeight,
  cfgTitleWeight,
  cfgNationalLeagueWeight,
  cfgNationalLeaguePositionBonus,
  cfgInternationalWeight,
  cfgDecay,
  type FmConfig,
} from "./fm-config";

export type Module = "superleague" | "national" | "continental";

export interface ClubSeasonRow {
  year: number;
  module: Module;
  division_num: number | null;
  division_label: string | null;
  position: number | null;
  is_champion: boolean;
  weighted: number;
  raw: number;
}

export interface ContinentalAppearance {
  year: number;
  competition: string;
  opponent: string | null;
  won: boolean;
}

export interface KnockoutAppearance {
  year: number;
  competition: string;
  stage: "SF" | "QF";
  club: string;
}

export interface ChartPoint {
  year: number;
  weighted: number;
  raw: number;
  positionWeighted: number | null;
  positionRaw: number | null;
}

export interface ClubProfile {
  name: string;
  country: string | null;
  seasons: ClubSeasonRow[];
  continental: ContinentalAppearance[];
  knockouts: KnockoutAppearance[];
  coaches: { name: string; year: number; module: Module }[];
  totalWeighted: number;
  totalRaw: number;
  titles: number;
  superleagueTitles: number;
  nationalTitles: number;
  continentalTitles: number;
  bestPosition: number | null;
  seasonsCount: number;
  chart: ChartPoint[];
}

export interface CoachSeasonRow {
  year: number;
  module: Module;
  club_name: string | null;
  position: number | null;
  champion: boolean;
  weighted: number;
  raw: number;
}

export interface CoachContinentalTitle {
  year: number;
  competition: string;
  club: string;
  opponent: string | null;
  role: "winner" | "runner-up";
}

export interface CoachProfile {
  name: string;
  seasons: CoachSeasonRow[];
  clubs: string[];
  totalWeighted: number;
  totalRaw: number;
  titles: number;
  seasonsCount: number;
  chart: ChartPoint[];
  continentalTitles: CoachContinentalTitle[];
  knockouts: KnockoutAppearance[];
}

export interface CountryProfile {
  name: string;
  clubs: { name: string; weighted: number; raw: number; titles: number }[];
  totalWeighted: number;
  totalRaw: number;
  titles: number;
  seasonsActive: number;
  chart: ChartPoint[];
  internationalTitles: number;
  finalsReached: number;
  semifinalsReached: number;
  quarterfinalsReached: number;
  internationalAppearances: Array<{
    year: number;
    competition: string;
    stage: "Final" | "Meia-final" | "Quarto-final";
    role: "winner" | "runner-up" | "semifinalist" | "quarterfinalist";
    opponent: string | null;
    others: string[];
  }>;
}

function hasPromotionToken(info?: string | null): boolean {
  if (!info) return false;
  const tokens = String(info).toUpperCase().split(/[\s,;/|+]+/).map((t) => t.trim());
  return tokens.includes("P");
}

function standingWeighted(
  cfg: FmConfig,
  latestYear: number,
  s: {
    season_year: number;
    module: Module;
    division_num: number | null;
    division_label?: string | null;
    position: number | null;
    is_champion: boolean;
    points?: number | null;
    played?: number | null;
    info?: string | null;
  },
): number {
  const base = cfgPositionPoints(cfg, s.position);
  const compW = cfg.competitionWeights[s.module as keyof typeof cfg.competitionWeights] ?? 1;
  const divW =
    s.module === "superleague"
      ? cfgDivisionWeight(cfg, s.division_num)
      : s.module === "national"
        ? cfgNationalLeagueWeight(cfg, s.division_label)
        : 1;
  const decay = cfgDecay(cfg, s.season_year, latestYear);
  let weighted = base * compW * divW * decay;
  const rawLP = Number(s.points ?? 0) || 0;
  const gp = Number(s.played ?? 0) || 0;
  const leaguePts = cfg.normalizePointsByGames && gp > 0 ? rawLP / gp : rawLP;
  if (leaguePts > 0 && (s.module === "superleague" || s.module === "national")) {
    weighted += leaguePts * compW * divW * decay;
  }
  if (s.is_champion) {
    const bonus = s.module === "superleague" ? cfg.superleagueChampionBonus : cfg.nationalChampionBonus;
    weighted += bonus * compW * divW * decay;
  }
  if (s.module === "superleague" && cfg.superleaguePromotionBonus > 0 && hasPromotionToken(s.info)) {
    weighted += cfg.superleaguePromotionBonus * compW * divW * decay;
  }
  if (s.module === "national" && s.position) {
    const posBonus = cfgNationalLeaguePositionBonus(cfg, s.division_label, s.position);
    if (posBonus > 0) weighted += posBonus * compW * divW * decay;
  }
  return weighted;
}

function standingRaw(
  cfg: FmConfig,
  s: { module: Module; division_label?: string | null; position: number | null; is_champion: boolean; points?: number | null; played?: number | null; info?: string | null },
): number {
  let raw = cfgPositionPoints(cfg, s.position);
  const rawLP = Number(s.points ?? 0) || 0;
  const gp = Number(s.played ?? 0) || 0;
  const leaguePts = cfg.normalizePointsByGames && gp > 0 ? rawLP / gp : rawLP;
  if (leaguePts > 0 && (s.module === "superleague" || s.module === "national")) {
    raw += leaguePts;
  }
  if (s.is_champion) {
    const bonus = s.module === "superleague" ? cfg.superleagueChampionBonus : cfg.nationalChampionBonus;
    raw += bonus * 0.5;
  }
  if (s.module === "superleague" && cfg.superleaguePromotionBonus > 0 && hasPromotionToken(s.info)) {
    raw += cfg.superleaguePromotionBonus * 0.5;
  }
  if (s.module === "national" && s.position) {
    const posBonus = cfgNationalLeaguePositionBonus(cfg, s.division_label, s.position);
    if (posBonus > 0) raw += posBonus * 0.5;
  }
  return raw;
}

function latestYearOf(data: AllData): number {
  const ys = [
    ...data.standings.map((s) => s.season_year),
    ...data.continental.map((c) => c.season_year),
  ];
  return ys.length ? Math.max(...ys) : 0;
}

type YearMap = Map<number, Map<string, number>>;
const addYM = (m: YearMap, year: number, name: string, w: number) => {
  let inner = m.get(year);
  if (!inner) { inner = new Map(); m.set(year, inner); }
  inner.set(name, (inner.get(name) ?? 0) + w);
};

export interface YearMaps {
  clubYearW: YearMap;
  clubYearR: YearMap;
  countryYearW: YearMap;
  countryYearR: YearMap;
  coachYearW: YearMap;
  coachYearR: YearMap;
}

export type RankingSource = "all" | "superleague" | "national" | "continental" | "international";

const _yearMapsCacheMap = new Map<string, { key: unknown; cfg: unknown; maps: YearMaps }>();
export function buildYearMaps(data: AllData, cfg: FmConfig = DEFAULT_CONFIG, source: RankingSource = "all"): YearMaps {
  const cached = _yearMapsCacheMap.get(source);
  if (cached && cached.key === data && cached.cfg === cfg) {
    return cached.maps;
  }
  const latestYear = latestYearOf(data);
  const clubYearW: YearMap = new Map();
  const clubYearR: YearMap = new Map();
  const countryYearW: YearMap = new Map();
  const countryYearR: YearMap = new Map();
  const coachYearW: YearMap = new Map();
  const coachYearR: YearMap = new Map();

  if (source === "international") {
    // Internacional fonte: usa selecções (paises) e treinadores; sem clubes.
    // Lazy import-free: replicar lógica leve à custa do computeInternationalRankings.
    // Para evitar dependência circular, fazemos a soma directa aqui.
    for (const r of data.international ?? []) {
      const { weight } = (function () {
        // mesma fórmula simplificada: peso fixo do match no config
        const w = cfg.internationalWeights.find((t) => new RegExp(t.match, "i").test(r.competition))?.weight ?? 100;
        return { weight: w };
      })();
      const compW = cfg.competitionWeights.international ?? 1;
      const decay = cfgDecay(cfg, r.season_year, latestYear);
      const credit = (team: string | null, coach: string | null, raw: number, stageMul: number) => {
        if (!team) return;
        const w = raw * compW * decay * stageMul;
        addYM(countryYearW, r.season_year, team, w);
        addYM(countryYearR, r.season_year, team, raw);
        if (coach) {
          addYM(coachYearW, r.season_year, coach, w);
          addYM(coachYearR, r.season_year, coach, raw);
        }
      };
      const winner = r.winner;
      const winnerCoach = winner === r.team1 ? r.coach1 : r.coach2;
      credit(winner, winnerCoach, weight * 1, 1);
      const loser = winner === r.team1 ? r.team2 : r.team1;
      const loserCoach = winner === r.team1 ? r.coach2 : r.coach1;
      credit(loser, loserCoach, weight * 0.25, cfg.stageMultipliers.finalist);
      credit(r.sf1 ?? null, r.sf1_coach ?? null, weight * 0.125, cfg.stageMultipliers.semi);
      credit(r.sf2 ?? null, r.sf2_coach ?? null, weight * 0.125, cfg.stageMultipliers.semi);
      credit(r.qf1 ?? null, r.qf1_coach ?? null, weight * 0.06, cfg.stageMultipliers.quarter);
      credit(r.qf2 ?? null, r.qf2_coach ?? null, weight * 0.06, cfg.stageMultipliers.quarter);
      credit(r.qf3 ?? null, r.qf3_coach ?? null, weight * 0.06, cfg.stageMultipliers.quarter);
      credit(r.qf4 ?? null, r.qf4_coach ?? null, weight * 0.06, cfg.stageMultipliers.quarter);
    }
    const maps = { clubYearW, clubYearR, countryYearW, countryYearR, coachYearW, coachYearR };
    _yearMapsCacheMap.set(source, { key: data, cfg, maps });
    return maps;
  }

  const includeStandings = source === "all" || source === "superleague" || source === "national";
  const includeContinental = source === "all" || source === "continental";
  if (includeStandings) {
    for (const s of data.standings) {
      if (source !== "all" && s.module !== source) continue;
      addYM(clubYearW, s.season_year, s.club_name, standingWeighted(cfg, latestYear, s));
      addYM(clubYearR, s.season_year, s.club_name, standingRaw(cfg, s));
    }
  }
  if (includeContinental) {
    for (const c of data.continental) {
      const { weight } = cfgTitleWeight(cfg, c.competition);
      const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.season_year, latestYear);
      for (const team of [c.team1, c.team2]) {
        if (!team) continue;
        const won = c.winner === team;
        addYM(clubYearW, c.season_year, team, weight * compW * (won ? 1 : 0.3));
        addYM(clubYearR, c.season_year, team, won ? 200 : 50);
      }
    }
  }
  for (const [year, inner] of clubYearW) {
    for (const [club, w] of inner) {
      const country = data.clubCountry[club];
      if (!country) continue;
      addYM(countryYearW, year, country, w);
    }
  }
  for (const [year, inner] of clubYearR) {
    for (const [club, w] of inner) {
      const country = data.clubCountry[club];
      if (!country) continue;
      addYM(countryYearR, year, country, w);
    }
  }
  const sKeyW = new Map<string, number>();
  const sKeyR = new Map<string, number>();
  if (includeStandings) {
    for (const s of data.standings) {
      if (source !== "all" && s.module !== source) continue;
      const k = `${s.season_year}|${s.module}|${s.club_name}`;
      sKeyW.set(k, (sKeyW.get(k) ?? 0) + standingWeighted(cfg, latestYear, s));
      sKeyR.set(k, (sKeyR.get(k) ?? 0) + standingRaw(cfg, s));
    }
  }
  // Continental club season points keyed per (year|continental|club), used for coach inheritance
  const contKeyW = new Map<string, number>();
  const contKeyR = new Map<string, number>();
  if (includeContinental) {
    for (const c of data.continental) {
      const { weight } = cfgTitleWeight(cfg, c.competition);
      const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.season_year, latestYear);
      for (const team of [c.team1, c.team2]) {
        if (!team) continue;
        const won = c.winner === team;
        const k = `${c.season_year}|continental|${team}`;
        contKeyW.set(k, (contKeyW.get(k) ?? 0) + weight * compW * (won ? 1 : 0.3));
        contKeyR.set(k, (contKeyR.get(k) ?? 0) + (won ? 200 : 50));
      }
    }
  }
  for (const a of data.coaches) {
    if (!a.club_name) continue;
    if (source === "continental") {
      // For the Continental source, credit coaches with their club's continental points
      // for that season, regardless of which assignment module they held.
      const k = `${a.season_year}|continental|${a.club_name}`;
      const w = contKeyW.get(k);
      if (w == null) continue;
      addYM(coachYearW, a.season_year, a.name, w);
      addYM(coachYearR, a.season_year, a.name, contKeyR.get(k) ?? 0);
      continue;
    }
    if (source !== "all" && a.module !== source) continue;
    const k = `${a.season_year}|${a.module}|${a.club_name}`;
    addYM(coachYearW, a.season_year, a.name, sKeyW.get(k) ?? 0);
    addYM(coachYearR, a.season_year, a.name, sKeyR.get(k) ?? 0);
  }
  const maps = { clubYearW, clubYearR, countryYearW, countryYearR, coachYearW, coachYearR };
  _yearMapsCacheMap.set(source, { key: data, cfg, maps });
  return maps;
}


export function rankIn(inner: Map<string, number> | undefined, name: string): number | null {
  if (!inner) return null;
  const w = inner.get(name);
  if (w == null) return null;
  let rank = 1;
  for (const [n, v] of inner) {
    if (n === name) continue;
    if (v > w) rank++;
  }
  return rank;
}


function chartWithRanks(
  yearW: Map<number, number>,
  yearR: Map<number, number>,
  yearMapW: YearMap,
  yearMapR: YearMap,
  name: string,
): ChartPoint[] {
  const years = new Set<number>([...yearW.keys(), ...yearR.keys()]);
  return [...years]
    .map((year) => ({
      year,
      weighted: yearW.get(year) ?? 0,
      raw: yearR.get(year) ?? 0,
      positionWeighted: rankIn(yearMapW.get(year), name),
      positionRaw: rankIn(yearMapR.get(year), name),
    }))
    .sort((a, b) => a.year - b.year);
}

export function buildClubProfile(data: AllData, name: string, cfg: FmConfig = DEFAULT_CONFIG): ClubProfile | null {
  const latestYear = latestYearOf(data);
  const own = data.standings.filter((s) => s.club_name === name);
  const cont = data.continental.filter((c) => c.team1 === name || c.team2 === name);
  if (own.length === 0 && cont.length === 0) return null;

  const seasons: ClubSeasonRow[] = own.map((s) => ({
    year: s.season_year,
    module: s.module,
    division_num: s.division_num,
    division_label: s.division_label ?? null,
    position: s.position,
    is_champion: s.is_champion,
    weighted: standingWeighted(cfg, latestYear, s),
    raw: standingRaw(cfg, s),
  }));

  const continental: ContinentalAppearance[] = cont.map((c) => {
    const opponent = c.team1 === name ? c.team2 : c.team1;
    return { year: c.season_year, competition: c.competition, opponent, won: c.winner === name };
  });

  // Quarter/Semi-finals (continental knockout stages where this club appeared but didn't reach the final).
  const knockouts: KnockoutAppearance[] = [];
  for (const c of data.continental) {
    const sfs = [c.sf1, c.sf2];
    const qfs = [c.qf1, c.qf2, c.qf3, c.qf4];
    if (sfs.includes(name)) knockouts.push({ year: c.season_year, competition: c.competition, stage: "SF", club: name });
    if (qfs.includes(name)) knockouts.push({ year: c.season_year, competition: c.competition, stage: "QF", club: name });
  }
  knockouts.sort((a, b) => b.year - a.year || a.competition.localeCompare(b.competition));

  const coaches = data.coaches
    .filter((c) => c.club_name === name)
    .map((c) => ({ name: c.name, year: c.season_year, module: c.module }));

  let totalWeighted = 0;
  let totalRaw = 0;
  let superleagueTitles = 0;
  let nationalTitles = 0;
  let bestPosition: number | null = null;
  for (const s of seasons) {
    totalWeighted += s.weighted;
    totalRaw += s.raw;
    if (s.is_champion) {
      if (s.module === "superleague") superleagueTitles++;
      else nationalTitles++;
    }
    if (s.position != null && (bestPosition == null || s.position < bestPosition)) bestPosition = s.position;
  }
  let continentalTitles = 0;
  for (const c of continental) {
    const { weight } = cfgTitleWeight(cfg, c.competition);
    const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.year, latestYear);
    if (c.won) {
      continentalTitles++;
      totalWeighted += weight * compW;
      totalRaw += 200;
    } else {
      totalWeighted += weight * compW * 0.3;
      totalRaw += 50;
    }
  }

  const byYearW = new Map<number, number>();
  const byYearR = new Map<number, number>();
  for (const s of seasons) {
    byYearW.set(s.year, (byYearW.get(s.year) ?? 0) + s.weighted);
    byYearR.set(s.year, (byYearR.get(s.year) ?? 0) + s.raw);
  }
  for (const c of continental) {
    const { weight } = cfgTitleWeight(cfg, c.competition);
    const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.year, latestYear);
    byYearW.set(c.year, (byYearW.get(c.year) ?? 0) + weight * compW * (c.won ? 1 : 0.3));
    byYearR.set(c.year, (byYearR.get(c.year) ?? 0) + (c.won ? 200 : 50));
  }
  const { clubYearW, clubYearR } = buildYearMaps(data, cfg);

  return {
    name,
    country: data.clubCountry[name] ?? null,
    seasons: seasons.sort((a, b) => b.year - a.year),
    continental: continental.sort((a, b) => b.year - a.year),
    knockouts,
    coaches: coaches.sort((a, b) => b.year - a.year),
    totalWeighted,
    totalRaw,
    titles: superleagueTitles + nationalTitles + continentalTitles,
    superleagueTitles,
    nationalTitles,
    continentalTitles,
    bestPosition,
    seasonsCount: new Set([...seasons.map((s) => s.year), ...continental.map((c) => c.year)]).size,
    chart: chartWithRanks(byYearW, byYearR, clubYearW, clubYearR, name),
  };
}

export function buildCoachProfile(data: AllData, name: string, cfg: FmConfig = DEFAULT_CONFIG): CoachProfile | null {
  const latestYear = latestYearOf(data);
  const assigns = data.coaches.filter((c) => c.name === name);
  const intlRows = data.international.filter((r) => r.coach1 === name || r.coach2 === name);
  if (assigns.length === 0 && intlRows.length === 0) return null;

  const championKey = new Set<string>();
  for (const s of data.standings) {
    if (s.is_champion) championKey.add(`${s.season_year}|${s.module}|${s.club_name}`);
  }

  const ptKeyW = new Map<string, number>();
  const ptKeyR = new Map<string, number>();
  const posKey = new Map<string, number | null>();
  for (const s of data.standings) {
    const k = `${s.season_year}|${s.module}|${s.club_name}`;
    ptKeyW.set(k, (ptKeyW.get(k) ?? 0) + standingWeighted(cfg, latestYear, s));
    ptKeyR.set(k, (ptKeyR.get(k) ?? 0) + standingRaw(cfg, s));
    if (!posKey.has(k) && s.position != null) posKey.set(k, s.position);
  }

  const seasons: CoachSeasonRow[] = assigns.map((a) => {
    const k = `${a.season_year}|${a.module}|${a.club_name ?? ""}`;
    return {
      year: a.season_year,
      module: a.module,
      club_name: a.club_name,
      position: a.club_name ? posKey.get(k) ?? null : null,
      champion: a.club_name ? championKey.has(k) : false,
      weighted: a.club_name ? ptKeyW.get(k) ?? 0 : 0,
      raw: a.club_name ? ptKeyR.get(k) ?? 0 : 0,
    };
  });

  const clubYears = new Set<string>();
  for (const a of assigns) {
    if (a.club_name) clubYears.add(`${a.season_year}|${a.club_name}`);
  }
  const continentalTitles: CoachContinentalTitle[] = [];
  for (const c of data.continental) {
    for (const club of [c.team1, c.team2]) {
      if (!club) continue;
      if (!clubYears.has(`${c.season_year}|${club}`)) continue;
      const won = c.winner === club;
      const opponent = c.team1 === club ? c.team2 : c.team1;
      continentalTitles.push({
        year: c.season_year,
        competition: c.competition,
        club,
        opponent,
        role: won ? "winner" : "runner-up",
      });
    }
  }

  // International (national-team) titles for this coach
  let intlW = 0;
  let intlR = 0;
  for (const r of intlRows) {
    const isCoach1 = r.coach1 === name;
    const team = isCoach1 ? r.team1 : r.team2;
    const opponent = isCoach1 ? r.team2 : r.team1;
    if (!team) continue;
    const won = r.winner === team;
    const { weight } = cfgInternationalWeight(cfg, r.competition);
    const decay = cfgDecay(cfg, r.season_year, latestYear);
    const w = weight * decay * (won ? 1 : 0.3);
    const raw = won ? 200 : 50;
    intlW += w;
    intlR += raw;
    continentalTitles.push({
      year: r.season_year,
      competition: r.competition,
      club: team,
      opponent,
      role: won ? "winner" : "runner-up",
    });
    seasons.push({
      year: r.season_year,
      module: "continental",
      club_name: team,
      position: null,
      champion: won,
      weighted: w,
      raw,
    });
  }
  continentalTitles.sort((a, b) => b.year - a.year || a.competition.localeCompare(b.competition));

  // Knockout (SF/QF) appearances — continental clubs the coach actually managed that season, plus international.
  const knockouts: KnockoutAppearance[] = [];
  for (const c of data.continental) {
    const sfs = [c.sf1, c.sf2].filter((x): x is string => !!x);
    const qfs = [c.qf1, c.qf2, c.qf3, c.qf4].filter((x): x is string => !!x);
    for (const club of sfs) {
      if (clubYears.has(`${c.season_year}|${club}`)) {
        knockouts.push({ year: c.season_year, competition: c.competition, stage: "SF", club });
      }
    }
    for (const club of qfs) {
      if (clubYears.has(`${c.season_year}|${club}`)) {
        knockouts.push({ year: c.season_year, competition: c.competition, stage: "QF", club });
      }
    }
  }
  for (const r of data.international) {
    if (r.sf1_coach === name && r.sf1) knockouts.push({ year: r.season_year, competition: r.competition, stage: "SF", club: r.sf1 });
    if (r.sf2_coach === name && r.sf2) knockouts.push({ year: r.season_year, competition: r.competition, stage: "SF", club: r.sf2 });
    if (r.qf1_coach === name && r.qf1) knockouts.push({ year: r.season_year, competition: r.competition, stage: "QF", club: r.qf1 });
    if (r.qf2_coach === name && r.qf2) knockouts.push({ year: r.season_year, competition: r.competition, stage: "QF", club: r.qf2 });
    if (r.qf3_coach === name && r.qf3) knockouts.push({ year: r.season_year, competition: r.competition, stage: "QF", club: r.qf3 });
    if (r.qf4_coach === name && r.qf4) knockouts.push({ year: r.season_year, competition: r.competition, stage: "QF", club: r.qf4 });
  }
  knockouts.sort((a, b) => b.year - a.year || a.competition.localeCompare(b.competition));

  let totalWeighted = 0;
  let totalRaw = 0;
  let titles = 0;
  for (const s of seasons) {
    totalWeighted += s.weighted;
    totalRaw += s.raw;
    if (s.champion) titles++;
  }
  // continentalTitles already include intl wins above as champion seasons, avoid double count
  for (const t of continentalTitles) {
    // Only continental-club wins (not already counted as seasons.champion)
    if (t.role === "winner" && !seasons.some((s) => s.year === t.year && s.club_name === t.club && s.module === "continental")) {
      titles++;
    }
  }

  const clubs = [...new Set([...assigns.map((a) => a.club_name).filter(Boolean) as string[], ...intlRows.map((r) => (r.coach1 === name ? r.team1 : r.team2)).filter(Boolean) as string[]])];
  const byYearW = new Map<number, number>();
  const byYearR = new Map<number, number>();
  for (const s of seasons) {
    byYearW.set(s.year, (byYearW.get(s.year) ?? 0) + s.weighted);
    byYearR.set(s.year, (byYearR.get(s.year) ?? 0) + s.raw);
  }

  const { coachYearW, coachYearR } = buildYearMaps(data, cfg);

  return {
    name,
    seasons: seasons.sort((a, b) => b.year - a.year),
    clubs,
    totalWeighted,
    totalRaw,
    titles,
    seasonsCount: new Set(seasons.map((s) => s.year)).size,
    chart: chartWithRanks(byYearW, byYearR, coachYearW, coachYearR, name),
    continentalTitles,
    knockouts,
  };
}

export function buildCountryProfile(data: AllData, name: string, cfg: FmConfig = DEFAULT_CONFIG): CountryProfile | null {
  const latestYear = latestYearOf(data);
  const clubNames = Object.entries(data.clubCountry)
    .filter(([, c]) => c === name)
    .map(([club]) => club);
  const intlRows = data.international.filter((r) => r.team1 === name || r.team2 === name);
  if (clubNames.length === 0 && intlRows.length === 0) return null;
  const clubSet = new Set(clubNames);

  const clubAgg = new Map<string, { weighted: number; raw: number; titles: number }>();
  const byYearW = new Map<number, number>();
  const byYearR = new Map<number, number>();
  const years = new Set<number>();

  for (const s of data.standings) {
    if (!clubSet.has(s.club_name)) continue;
    const w = standingWeighted(cfg, latestYear, s);
    const r = standingRaw(cfg, s);
    const cur = clubAgg.get(s.club_name) ?? { weighted: 0, raw: 0, titles: 0 };
    cur.weighted += w;
    cur.raw += r;
    if (s.is_champion) cur.titles++;
    clubAgg.set(s.club_name, cur);
    byYearW.set(s.season_year, (byYearW.get(s.season_year) ?? 0) + w);
    byYearR.set(s.season_year, (byYearR.get(s.season_year) ?? 0) + r);
    years.add(s.season_year);
  }
  for (const c of data.continental) {
    const club = clubSet.has(c.team1 ?? "") ? c.team1 : clubSet.has(c.team2 ?? "") ? c.team2 : null;
    if (!club) continue;
    const { weight } = cfgTitleWeight(cfg, c.competition);
    const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.season_year, latestYear);
    const won = c.winner === club;
    const w = weight * compW * (won ? 1 : 0.3);
    const r = won ? 200 : 50;
    const cur = clubAgg.get(club) ?? { weighted: 0, raw: 0, titles: 0 };
    cur.weighted += w;
    cur.raw += r;
    if (won) cur.titles++;
    clubAgg.set(club, cur);
    byYearW.set(c.season_year, (byYearW.get(c.season_year) ?? 0) + w);
    byYearR.set(c.season_year, (byYearR.get(c.season_year) ?? 0) + r);
    years.add(c.season_year);
  }

  // International (national-team) results for this country
  let intlW = 0;
  let intlR = 0;
  let intlTitles = 0;
  for (const r of intlRows) {
    const isTeam1 = r.team1 === name;
    const team = isTeam1 ? r.team1 : r.team2;
    if (!team) continue;
    const won = r.winner === team;
    const { weight } = cfgInternationalWeight(cfg, r.competition);
    const decay = cfgDecay(cfg, r.season_year, latestYear);
    const w = weight * decay * (won ? 1 : 0.3);
    const raw = won ? 200 : 50;
    intlW += w;
    intlR += raw;
    if (won) intlTitles++;
    byYearW.set(r.season_year, (byYearW.get(r.season_year) ?? 0) + w);
    byYearR.set(r.season_year, (byYearR.get(r.season_year) ?? 0) + raw);
    years.add(r.season_year);
  }

  const clubs = [...clubAgg.entries()]
    .map(([n, v]) => ({ name: n, weighted: v.weighted, raw: v.raw, titles: v.titles }))
    .sort((a, b) => b.weighted - a.weighted);

  const { countryYearW, countryYearR } = buildYearMaps(data, cfg);

  return {
    name,
    clubs,
    totalWeighted: clubs.reduce((a, c) => a + c.weighted, 0) + intlW,
    totalRaw: clubs.reduce((a, c) => a + c.raw, 0) + intlR,
    titles: clubs.reduce((a, c) => a + c.titles, 0) + intlTitles,
    seasonsActive: years.size,
    chart: chartWithRanks(byYearW, byYearR, countryYearW, countryYearR, name),
  };
}
