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

const MODULE_NAME: Record<string, string> = {
  superleague: "Super League",
  national: "Liga Nacional",
  continental: "Continental",
};

export interface StandingRow {
  season_year: number;
  module: "superleague" | "national" | "continental";
  division_num: number | null;
  division_label?: string | null;
  position: number | null;
  club_name: string;
  is_champion: boolean;
  info?: string | null;
  points?: number | null;
  played?: number | null;
  wins?: number | null;
  draws?: number | null;
  losses?: number | null;
  gf?: number | null;
  ga?: number | null;
}


export interface ContinentalRow {
  season_year: number;
  competition: string;
  team1: string | null;
  team2: string | null;
  winner: string | null;
  sf1?: string | null;
  sf2?: string | null;
  qf1?: string | null;
  qf2?: string | null;
  qf3?: string | null;
  qf4?: string | null;
}

export interface InternationalRow {
  season_year: number;
  competition: string;
  team1: string | null;
  team2: string | null;
  coach1: string | null;
  coach2: string | null;
  winner: string | null;
  sf1?: string | null;
  sf1_coach?: string | null;
  sf2?: string | null;
  sf2_coach?: string | null;
  qf1?: string | null;
  qf1_coach?: string | null;
  qf2?: string | null;
  qf2_coach?: string | null;
  qf3?: string | null;
  qf3_coach?: string | null;
  qf4?: string | null;
  qf4_coach?: string | null;
}

export interface CoachRow {
  season_year: number;
  module: "superleague" | "national" | "continental";
  name: string;
  nationality: string | null;
  club_name: string | null;
}

export interface RankingEntry {
  name: string;
  raw: number;
  weighted: number;
  titles: number;
  meta?: Record<string, unknown>;
}

export interface ComputeInput {
  standings: StandingRow[];
  continental: ContinentalRow[];
  coaches: CoachRow[];
  clubCountry: Record<string, string | null>;
}

export type BreakdownSource =
  | "position"
  | "champion-bonus"
  | "promotion-bonus"
  | "league-position-bonus"
  | "league-points"
  | "continental-win"
  | "continental-loss"
  | "continental-sf"
  | "continental-qf"
  | "dobradinha-bonus"
  | "dobradinha-int-bonus"
  | "triplete-bonus"
  | "quadruple-bonus";

export type BonusAchievementType = "dobradinha" | "dobradinha-int" | "triplete" | "quadruple";

export interface BonusAchievement {
  season: number;
  club: string;
  country: string | null;
  coach: string | null;
  type: BonusAchievementType;
  label: string;
  bonus: number;
  competitions: string[];
}

export interface BreakdownItem {
  season_year: number;
  module: "superleague" | "national" | "continental";
  source: BreakdownSource;
  detail: string;
  raw: number;
  weighted: number;
  multipliers: { compW: number; divW: number; decay: number };
  division_num?: number | null;
  division_label?: string | null;
  position?: number | null;
  leagueWeightMatched?: boolean;
  competition?: string;
}


export interface ComputeResult {
  clubs: RankingEntry[];
  countries: RankingEntry[];
  coaches: RankingEntry[];
  clubSeasonPoints: Record<string, { raw: number; weighted: number; titles: number }>;
  evolution: {
    clubs: Record<string, Record<number, number>>;
    coaches: Record<string, Record<number, number>>;
    countries: Record<string, Record<number, number>>;
  };
  breakdown: {
    clubs: Record<string, BreakdownItem[]>;
    coaches: Record<string, BreakdownItem[]>;
    countries: Record<string, BreakdownItem[]>;
  };
  years: number[];
  bonusAchievements: BonusAchievement[];
}

function add(map: Map<string, RankingEntry>, name: string, raw: number, weighted: number, titles = 0) {
  const e = map.get(name) ?? { name, raw: 0, weighted: 0, titles: 0 };
  e.raw += raw;
  e.weighted += weighted;
  e.titles += titles;
  map.set(name, e);
}

function bumpEvo(evo: Record<string, Record<number, number>>, name: string, year: number, weighted: number) {
  const m = evo[name] ?? {};
  m[year] = (m[year] ?? 0) + weighted;
  evo[name] = m;
}

function pushBD(bd: Record<string, BreakdownItem[]>, name: string, item: BreakdownItem) {
  (bd[name] ??= []).push(item);
}

export function computeRankings(input: ComputeInput, config: FmConfig = DEFAULT_CONFIG): ComputeResult {
  const clubs = new Map<string, RankingEntry>();
  const countries = new Map<string, RankingEntry>();
  const clubSeasonPoints: Record<string, { raw: number; weighted: number; titles: number }> = {};
  const evoClubs: Record<string, Record<number, number>> = {};
  const evoCountries: Record<string, Record<number, number>> = {};
  const evoCoaches: Record<string, Record<number, number>> = {};
  const bdClubs: Record<string, BreakdownItem[]> = {};
  const bdCountries: Record<string, BreakdownItem[]> = {};
  const bdCoaches: Record<string, BreakdownItem[]> = {};
  const clubSeasonItems: Record<string, BreakdownItem[]> = {};

  const yearsAll = [
    ...input.standings.map((s) => s.season_year),
    ...input.continental.map((c) => c.season_year),
  ].filter((y) => y > 0);
  const latestYear = yearsAll.length ? Math.max(...yearsAll) : 0;
  const years = [...new Set(yearsAll)].sort((a, b) => a - b);

  const bump = (season: number, module: string, club: string, raw: number, weighted: number, titles = 0) => {
    const k = `${season}|${module}|${club}`;
    const cur = clubSeasonPoints[k] ?? { raw: 0, weighted: 0, titles: 0 };
    cur.raw += raw;
    cur.weighted += weighted;
    cur.titles += titles;
    clubSeasonPoints[k] = cur;
  };

  const recordItem = (season: number, module: StandingRow["module"], club: string, item: BreakdownItem) => {
    pushBD(bdClubs, club, item);
    // National leagues do NOT contribute to country rankings.
    if (module !== "national") {
      const country = input.clubCountry[club];
      if (country) pushBD(bdCountries, country, { ...item, detail: `${item.detail} · ${club}` });
    }
    const k = `${season}|${module}|${club}`;
    (clubSeasonItems[k] ??= []).push(item);
  };

  for (const s of input.standings) {
    const compW = config.competitionWeights[s.module as keyof typeof config.competitionWeights] ?? 1;
    const nlMatched =
      s.module === "national" && cfgNationalLeagueWeight(config, s.division_label) !== 1;
    const divW =
      s.module === "superleague"
        ? cfgDivisionWeight(config, s.division_num)
        : s.module === "national"
          ? cfgNationalLeagueWeight(config, s.division_label)
          : 1;
    const decay = cfgDecay(config, s.season_year, latestYear);
    const mult = { compW, divW, decay };
    const leagueTag =
      s.module === "national" && s.division_label
        ? ` [${s.division_label}${nlMatched ? ` · peso liga ×${divW}` : " · sem peso definido"}]`
        : s.module === "superleague" && s.division_num
          ? ` [Div. ${s.division_num} · peso ×${divW}]`
          : "";

    // Position points
    const base = cfgPositionPoints(config, s.position);
    if (base > 0) {
      const w = base * compW * divW * decay;
      add(clubs, s.club_name, base, w);
      bump(s.season_year, s.module, s.club_name, base, w);
      bumpEvo(evoClubs, s.club_name, s.season_year, w);
      if (s.module !== "national") {
        const country = input.clubCountry[s.club_name];
        if (country) {
          add(countries, country, base, w);
          bumpEvo(evoCountries, country, s.season_year, w);
        }
      }
      recordItem(s.season_year, s.module, s.club_name, {
        season_year: s.season_year,
        module: s.module,
        source: "position",
        detail: `Posição ${s.position} → ${base} pts base${leagueTag}`,
        raw: base,
        weighted: w,
        multipliers: mult,
        division_num: s.division_num,
        division_label: s.division_label,
        position: s.position,
        leagueWeightMatched: nlMatched,
      });
    }

    // League points (Pnts column from standings) — optionally normalized by games played
    const rawLeaguePts = Number(s.points ?? 0) || 0;
    const gamesPlayed = Number(s.played ?? 0) || 0;
    const normalize = config.normalizePointsByGames && gamesPlayed > 0;
    const leaguePts = normalize ? rawLeaguePts / gamesPlayed : rawLeaguePts;
    if (leaguePts > 0 && (s.module === "superleague" || s.module === "national")) {
      const w = leaguePts * compW * divW * decay;
      add(clubs, s.club_name, leaguePts, w);
      bump(s.season_year, s.module, s.club_name, leaguePts, w);
      bumpEvo(evoClubs, s.club_name, s.season_year, w);
      if (s.module !== "national") {
        const country = input.clubCountry[s.club_name];
        if (country) {
          add(countries, country, leaguePts, w);
          bumpEvo(evoCountries, country, s.season_year, w);
        }
      }
      recordItem(s.season_year, s.module, s.club_name, {
        season_year: s.season_year,
        module: s.module,
        source: "league-points",
        detail: normalize
          ? `Pnts/jogo: ${rawLeaguePts}÷${gamesPlayed} = ${leaguePts.toFixed(3)}${leagueTag}`
          : `Pnts da liga: ${leaguePts}${leagueTag}`,
        raw: leaguePts,
        weighted: w,
        multipliers: mult,
        division_num: s.division_num,
        division_label: s.division_label,
        position: s.position,
        leagueWeightMatched: nlMatched,
      });
    }

    // Champion bonus
    if (s.is_champion) {
      const bonus = s.module === "superleague" ? config.superleagueChampionBonus : config.nationalChampionBonus;
      const rawB = bonus * 0.5;
      const w = bonus * compW * divW * decay;
      add(clubs, s.club_name, rawB, w, 1);
      bump(s.season_year, s.module, s.club_name, rawB, w, 1);
      bumpEvo(evoClubs, s.club_name, s.season_year, w);
      if (s.module !== "national") {
        const country = input.clubCountry[s.club_name];
        if (country) {
          add(countries, country, rawB, w, 1);
          bumpEvo(evoCountries, country, s.season_year, w);
        }
      }
      recordItem(s.season_year, s.module, s.club_name, {
        season_year: s.season_year,
        module: s.module,
        source: "champion-bonus",
        detail: `Campeão (${MODULE_NAME[s.module] ?? s.module}) → bónus ${bonus}${leagueTag}`,
        raw: rawB,
        weighted: w,
        multipliers: mult,
        division_num: s.division_num,
        division_label: s.division_label,
        position: s.position,
        leagueWeightMatched: nlMatched,
      });
    }

    // Per-league position bonus (Ligas Nacionais) — configurable per liga & posição.
    if (s.module === "national" && s.position && s.position > 0) {
      const posBonus = cfgNationalLeaguePositionBonus(config, s.division_label, s.position);
      if (posBonus > 0) {
        const rawB = posBonus * 0.5;
        const w = posBonus * compW * divW * decay;
        add(clubs, s.club_name, rawB, w);
        bump(s.season_year, s.module, s.club_name, rawB, w);
        bumpEvo(evoClubs, s.club_name, s.season_year, w);
        recordItem(s.season_year, s.module, s.club_name, {
          season_year: s.season_year,
          module: s.module,
          source: "league-position-bonus",
          detail: `Bónus posição ${s.position} (${s.division_label}) → ${posBonus}${leagueTag}`,
          raw: rawB,
          weighted: w,
          multipliers: mult,
          division_num: s.division_num,
          division_label: s.division_label,
          position: s.position,
          leagueWeightMatched: nlMatched,
        });
      }
    }

    // Promotion bonus (SuperLeague only) — applied when info contains token "P"
    if (s.module === "superleague" && config.superleaguePromotionBonus > 0 && s.info) {
      const tokens = new Set(
        String(s.info).toUpperCase().split(/[\s,;/|+]+/).map((t) => t.trim()).filter(Boolean),
      );
      if (tokens.has("P")) {
        const bonus = config.superleaguePromotionBonus;
        const rawB = bonus * 0.5;
        const w = bonus * compW * divW * decay;
        add(clubs, s.club_name, rawB, w);
        bump(s.season_year, s.module, s.club_name, rawB, w);
        bumpEvo(evoClubs, s.club_name, s.season_year, w);
        const country = input.clubCountry[s.club_name];
        if (country) {
          add(countries, country, rawB, w);
          bumpEvo(evoCountries, country, s.season_year, w);
        }
        recordItem(s.season_year, s.module, s.club_name, {
          season_year: s.season_year,
          module: s.module,
          source: "promotion-bonus",
          detail: `Promovido (SuperLeague) → bónus ${bonus}${leagueTag}`,
          raw: rawB,
          weighted: w,
          multipliers: mult,
          division_num: s.division_num,
          division_label: s.division_label,
          position: s.position,
          leagueWeightMatched: nlMatched,
        });
      }
    }
  }

  // Stage raw base — proportions of the competition weight assigned to each
  // tournament stage. Winner = 100% of weight; losing finalist = 25%; SF = 12.5%; QF = 6%.
  // This makes the "raw" column scale with each competition's configured weight
  // (e.g. Champions 200 vs. a smaller cup 100), instead of being a fixed 200/50/25/12.
  const STAGE_RAW = { winner: 1, finalist: 0.25, semi: 0.125, quarter: 0.06 } as const;

  for (const c of input.continental) {
    const { weight, label } = cfgTitleWeight(config, c.competition);
    const compW = config.competitionWeights.continental;
    const decay = cfgDecay(config, c.season_year, latestYear);
    const mult = { compW, divW: 1, decay };
    if (c.winner) {
      const raw = weight * STAGE_RAW.winner;
      const w = raw * compW * decay;
      add(clubs, c.winner, raw, w, 1);
      bump(c.season_year, "continental", c.winner, raw, w, 1);
      bumpEvo(evoClubs, c.winner, c.season_year, w);
      const country = input.clubCountry[c.winner];
      if (country) {
        add(countries, country, raw, w, 1);
        bumpEvo(evoCountries, country, c.season_year, w);
      }
      recordItem(c.season_year, "continental", c.winner, {
        season_year: c.season_year,
        module: "continental",
        source: "continental-win",
        detail: `Vencedor ${label} (${c.competition}) · peso ${weight}`,
        raw,
        weighted: w,
        multipliers: mult,
        competition: c.competition,
      });
    }
    const loser = c.winner === c.team1 ? c.team2 : c.team1;
    if (loser) {
      const raw = weight * STAGE_RAW.finalist;
      const w = raw * compW * decay * config.stageMultipliers.finalist;
      add(clubs, loser, raw, w, 0);
      bump(c.season_year, "continental", loser, raw, w, 0);
      bumpEvo(evoClubs, loser, c.season_year, w);
      const country = input.clubCountry[loser];
      if (country) {
        add(countries, country, raw, w, 0);
        bumpEvo(evoCountries, country, c.season_year, w);
      }
      recordItem(c.season_year, "continental", loser, {
        season_year: c.season_year,
        module: "continental",
        source: "continental-loss",
        detail: `Finalista vencido ${label} (${c.competition}) · peso ${weight}`,
        raw,
        weighted: w,
        multipliers: mult,
        competition: c.competition,
      });
    }
    // Semi-finalists eliminados (2 equipas)
    const sfTeams = [c.sf1, c.sf2].filter((n): n is string => !!n);
    for (const team of sfTeams) {
      const raw = weight * STAGE_RAW.semi;
      const w = raw * compW * decay * config.stageMultipliers.semi;
      add(clubs, team, raw, w, 0);
      bump(c.season_year, "continental", team, raw, w, 0);
      bumpEvo(evoClubs, team, c.season_year, w);
      const country = input.clubCountry[team];
      if (country) {
        add(countries, country, raw, w, 0);
        bumpEvo(evoCountries, country, c.season_year, w);
      }
      recordItem(c.season_year, "continental", team, {
        season_year: c.season_year,
        module: "continental",
        source: "continental-sf",
        detail: `Meia-finalista ${label} (${c.competition}) · peso ${weight}`,
        raw,
        weighted: w,
        multipliers: mult,
        competition: c.competition,
      });
    }
    // Quartos-finalistas eliminados (4 equipas)
    const qfTeams = [c.qf1, c.qf2, c.qf3, c.qf4].filter((n): n is string => !!n);
    for (const team of qfTeams) {
      const raw = weight * STAGE_RAW.quarter;
      const w = raw * compW * decay * config.stageMultipliers.quarter;
      add(clubs, team, raw, w, 0);
      bump(c.season_year, "continental", team, raw, w, 0);
      bumpEvo(evoClubs, team, c.season_year, w);
      const country = input.clubCountry[team];
      if (country) {
        add(countries, country, raw, w, 0);
        bumpEvo(evoCountries, country, c.season_year, w);
      }
      recordItem(c.season_year, "continental", team, {
        season_year: c.season_year,
        module: "continental",
        source: "continental-qf",
        detail: `Quartos-finalista ${label} (${c.competition}) · peso ${weight}`,
        raw,
        weighted: w,
        multipliers: mult,
        competition: c.competition,
      });
    }
  }

  // Multi-trophy bonuses — awarded per (season, club). Priority (highest first):
  //   Quadruple  = NL + SL + Continental(filter) + Club World Cup(filter)
  //   Triplete   = NL + SL + Continental(filter)
  //   Dobradinha Internacional = SL + Continental(filter)
  //   Dobradinha = SL + NL
  // Apenas UM bónus é atribuído por clube/época (o de prioridade mais alta).
  const bonusAchievements: BonusAchievement[] = [];
  {
    const slChampBySeason: Map<number, Set<string>> = new Map();
    const nlChampBySeason: Map<number, Set<string>> = new Map();
    for (const s of input.standings) {
      if (!s.is_champion) continue;
      const map = s.module === "superleague" ? slChampBySeason : s.module === "national" ? nlChampBySeason : null;
      if (!map) continue;
      const set = map.get(s.season_year) ?? new Set<string>();
      set.add(s.club_name);
      map.set(s.season_year, set);
    }
    const matchAny = (filter: string[], compName: string): boolean => {
      const f = filter.map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!f.length) return true;
      const lc = compName.toLowerCase();
      return f.some((x) => lc.includes(x));
    };
    const matchAnyStrict = (filter: string[], compName: string): boolean => {
      const f = filter.map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!f.length) {
        // default fallback for Club World Cup detection
        return compName.toLowerCase().includes("club world cup");
      }
      const lc = compName.toLowerCase();
      return f.some((x) => lc.includes(x));
    };
    // Map season -> club -> list of continental competitions won
    const contWinsBySeason: Map<number, Map<string, string[]>> = new Map();
    for (const c of input.continental) {
      if (!c.winner) continue;
      const m = contWinsBySeason.get(c.season_year) ?? new Map<string, string[]>();
      const arr = m.get(c.winner) ?? [];
      arr.push(c.competition);
      m.set(c.winner, arr);
      contWinsBySeason.set(c.season_year, m);
    }
    // Coach lookup: (season, club) -> superleague coach
    const coachLookup = new Map<string, string>();
    for (const cc of input.coaches) {
      if (cc.module !== "superleague" || !cc.club_name) continue;
      coachLookup.set(`${cc.season_year}|${cc.club_name}`, cc.name);
    }

    const allSeasons = new Set<number>([...slChampBySeason.keys(), ...nlChampBySeason.keys()]);
    for (const season of allSeasons) {
      const slSet = slChampBySeason.get(season) ?? new Set<string>();
      const nlSet = nlChampBySeason.get(season) ?? new Set<string>();
      const contMap = contWinsBySeason.get(season) ?? new Map<string, string[]>();
      // candidates = clubs that won SL this season (todos os bónus exigem SL)
      for (const club of slSet) {
        const wonNL = nlSet.has(club);
        const clubContWins = contMap.get(club) ?? [];
        const wonContTriplete = clubContWins.find((c) => matchAny(config.tripleteContinentalCompetitions ?? [], c));
        const wonContDobInt = clubContWins.find((c) => matchAny(config.dobradinhaIntContinentalCompetitions ?? [], c));
        const wonContQuad = clubContWins.find((c) => matchAny(config.quadrupleContinentalCompetitions ?? [], c));
        const wonCWC = clubContWins.find((c) => matchAnyStrict(config.quadrupleClubWorldCupCompetitions ?? [], c));

        let type: BonusAchievementType | null = null;
        let bonus = 0;
        let label = "";
        let competitions: string[] = [];

        if (wonNL && wonContQuad && wonCWC && (config.quadrupleBonus ?? 0) > 0) {
          type = "quadruple";
          bonus = config.quadrupleBonus;
          label = `Quadruple (Liga Nacional + SL + ${wonContQuad} + ${wonCWC})`;
          competitions = ["Liga Nacional", "SuperLeague", wonContQuad, wonCWC];
        } else if (wonNL && wonContTriplete && (config.tripleteBonus ?? 0) > 0) {
          type = "triplete";
          bonus = config.tripleteBonus;
          label = `Triplete (SL + Liga Nacional + ${wonContTriplete})`;
          competitions = ["SuperLeague", "Liga Nacional", wonContTriplete];
        } else if (wonContDobInt && (config.dobradinhaInternacionalBonus ?? 0) > 0) {
          type = "dobradinha-int";
          bonus = config.dobradinhaInternacionalBonus;
          label = `Dobradinha Internacional (SL + ${wonContDobInt})`;
          competitions = ["SuperLeague", wonContDobInt];
        } else if (wonNL && (config.dobradinhaBonus ?? 0) > 0) {
          type = "dobradinha";
          bonus = config.dobradinhaBonus;
          label = `Dobradinha (SL + Liga Nacional)`;
          competitions = ["SuperLeague", "Liga Nacional"];
        }
        if (!type || bonus <= 0) continue;

        const compW = config.competitionWeights.superleague ?? 1;
        const decay = cfgDecay(config, season, latestYear);
        const mult = { compW, divW: 1, decay };
        const rawB = bonus * 0.5;
        const w = bonus * compW * decay;
        add(clubs, club, rawB, w);
        bump(season, "superleague", club, rawB, w);
        bumpEvo(evoClubs, club, season, w);
        const country = input.clubCountry[club] ?? null;
        if (country) {
          add(countries, country, rawB, w);
          bumpEvo(evoCountries, country, season, w);
        }
        const source: BreakdownSource =
          type === "quadruple" ? "quadruple-bonus"
            : type === "triplete" ? "triplete-bonus"
              : type === "dobradinha-int" ? "dobradinha-int-bonus"
                : "dobradinha-bonus";
        recordItem(season, "superleague", club, {
          season_year: season,
          module: "superleague",
          source,
          detail: `${label} → bónus ${bonus}`,
          raw: rawB,
          weighted: w,
          multipliers: mult,
        });
        bonusAchievements.push({
          season,
          club,
          country,
          coach: coachLookup.get(`${season}|${club}`) ?? null,
          type,
          label,
          bonus,
          competitions,
        });
      }
    }
  }



  const coaches = new Map<string, RankingEntry>();
  const seenContinentalFor = new Set<string>();
  for (const c of input.coaches) {
    if (!c.club_name) continue;
    const k = `${c.season_year}|${c.module}|${c.club_name}`;
    const pts = clubSeasonPoints[k];
    let raw = 0,
      weighted = 0,
      titles = 0;
    if (pts) {
      raw += pts.raw;
      weighted += pts.weighted;
      titles += pts.titles;
      for (const item of clubSeasonItems[k] ?? []) {
        pushBD(bdCoaches, c.name, { ...item, detail: `${item.detail} · ${c.club_name}` });
      }
    }
    if (c.module !== "continental") {
      const contKey = `${c.season_year}|continental|${c.club_name}`;
      const dedupe = `${c.name}|${contKey}`;
      const contPts = clubSeasonPoints[contKey];
      if (contPts && !seenContinentalFor.has(dedupe)) {
        seenContinentalFor.add(dedupe);
        raw += contPts.raw;
        weighted += contPts.weighted;
        titles += contPts.titles;
        for (const item of clubSeasonItems[contKey] ?? []) {
          pushBD(bdCoaches, c.name, { ...item, detail: `${item.detail} · ${c.club_name}` });
        }
      }
    }
    if (raw === 0 && weighted === 0 && titles === 0) continue;
    add(coaches, c.name, raw, weighted, titles);
    bumpEvo(evoCoaches, c.name, c.season_year, weighted);
  }

  const sortW = (a: RankingEntry, b: RankingEntry) => b.weighted - a.weighted;
  return {
    clubs: [...clubs.values()].sort(sortW),
    countries: [...countries.values()].sort(sortW),
    coaches: [...coaches.values()].sort(sortW),
    clubSeasonPoints,
    evolution: { clubs: evoClubs, coaches: evoCoaches, countries: evoCountries },
    breakdown: { clubs: bdClubs, coaches: bdCoaches, countries: bdCountries },
    years,
    bonusAchievements,
  };
}

export function rankBy(entries: RankingEntry[], mode: "raw" | "weighted"): RankingEntry[] {
  return [...entries].sort((a, b) => (mode === "raw" ? b.raw - a.raw : b.weighted - a.weighted));
}

// =============================================================
// International (national-team) rankings — for the "Internacional" tab.
// Selections are treated as countries; coaches are credited per game.
// =============================================================
export interface InternationalResult {
  countries: RankingEntry[];
  coaches: RankingEntry[];
  evolution: {
    countries: Record<string, Record<number, number>>;
    coaches: Record<string, Record<number, number>>;
  };
  breakdown: {
    countries: Record<string, BreakdownItem[]>;
    coaches: Record<string, BreakdownItem[]>;
  };
  years: number[];
}

export function computeInternationalRankings(
  rows: InternationalRow[],
  config: FmConfig = DEFAULT_CONFIG,
): InternationalResult {
  const countries = new Map<string, RankingEntry>();
  const coaches = new Map<string, RankingEntry>();
  const evoCountries: Record<string, Record<number, number>> = {};
  const evoCoaches: Record<string, Record<number, number>> = {};
  const bdCountries: Record<string, BreakdownItem[]> = {};
  const bdCoaches: Record<string, BreakdownItem[]> = {};

  const yearsAll = rows.map((r) => r.season_year).filter((y) => y > 0);
  const latestYear = yearsAll.length ? Math.max(...yearsAll) : 0;
  const years = [...new Set(yearsAll)].sort((a, b) => a - b);

  const STAGE_RAW = { winner: 1, finalist: 0.25, semi: 0.125, quarter: 0.06 } as const;

  for (const r of rows) {
    const { weight, label } = cfgInternationalWeight(config, r.competition);
    const compW = config.competitionWeights.international ?? 1;
    const decay = cfgDecay(config, r.season_year, latestYear);
    const mult = { compW, divW: 1, decay };

    if (r.winner) {
      const raw = weight * STAGE_RAW.winner;
      const w = raw * compW * decay;
      add(countries, r.winner, raw, w, 1);
      bumpEvo(evoCountries, r.winner, r.season_year, w);
      const item: BreakdownItem = {
        season_year: r.season_year,
        module: "continental",
        source: "continental-win",
        detail: `Vencedor ${label} (${r.competition}) · ${r.winner} · peso ${weight}`,
        raw,
        weighted: w,
        multipliers: mult,
        competition: r.competition,
      };
      pushBD(bdCountries, r.winner, item);
      const winnerCoach = r.winner === r.team1 ? r.coach1 : r.coach2;
      if (winnerCoach) {
        add(coaches, winnerCoach, raw, w, 1);
        bumpEvo(evoCoaches, winnerCoach, r.season_year, w);
        pushBD(bdCoaches, winnerCoach, item);
      }
    }

    const loser = r.winner === r.team1 ? r.team2 : r.team1;
    const loserCoach = r.winner === r.team1 ? r.coach2 : r.coach1;
    if (loser) {
      const raw = weight * STAGE_RAW.finalist;
      const w = raw * compW * decay * config.stageMultipliers.finalist;
      add(countries, loser, raw, w, 0);
      bumpEvo(evoCountries, loser, r.season_year, w);
      const item: BreakdownItem = {
        season_year: r.season_year,
        module: "continental",
        source: "continental-loss",
        detail: `Finalista vencido ${label} (${r.competition}) · ${loser} · peso ${weight}`,
        raw,
        weighted: w,
        multipliers: mult,
        competition: r.competition,
      };
      pushBD(bdCountries, loser, item);
      if (loserCoach) {
        add(coaches, loserCoach, raw, w, 0);
        bumpEvo(evoCoaches, loserCoach, r.season_year, w);
        pushBD(bdCoaches, loserCoach, item);
      }
    }

    // Semi-finalists eliminados (2 seleções)
    const sfPairs: Array<{ team: string | null; coach: string | null }> = [
      { team: r.sf1 ?? null, coach: r.sf1_coach ?? null },
      { team: r.sf2 ?? null, coach: r.sf2_coach ?? null },
    ];
    for (const { team, coach } of sfPairs) {
      if (!team) continue;
      const raw = weight * STAGE_RAW.semi;
      const w = raw * compW * decay * config.stageMultipliers.semi;
      add(countries, team, raw, w, 0);
      bumpEvo(evoCountries, team, r.season_year, w);
      const item: BreakdownItem = {
        season_year: r.season_year,
        module: "continental",
        source: "continental-sf",
        detail: `Meia-finalista ${label} (${r.competition}) · ${team} · peso ${weight}`,
        raw,
        weighted: w,
        multipliers: mult,
        competition: r.competition,
      };
      pushBD(bdCountries, team, item);
      if (coach) {
        add(coaches, coach, raw, w, 0);
        bumpEvo(evoCoaches, coach, r.season_year, w);
        pushBD(bdCoaches, coach, item);
      }
    }

    // Quartos-finalistas eliminados (4 seleções)
    const qfPairs: Array<{ team: string | null; coach: string | null }> = [
      { team: r.qf1 ?? null, coach: r.qf1_coach ?? null },
      { team: r.qf2 ?? null, coach: r.qf2_coach ?? null },
      { team: r.qf3 ?? null, coach: r.qf3_coach ?? null },
      { team: r.qf4 ?? null, coach: r.qf4_coach ?? null },
    ];
    for (const { team, coach } of qfPairs) {
      if (!team) continue;
      const raw = weight * STAGE_RAW.quarter;
      const w = raw * compW * decay * config.stageMultipliers.quarter;
      add(countries, team, raw, w, 0);
      bumpEvo(evoCountries, team, r.season_year, w);
      const item: BreakdownItem = {
        season_year: r.season_year,
        module: "continental",
        source: "continental-qf",
        detail: `Quartos-finalista ${label} (${r.competition}) · ${team} · peso ${weight}`,
        raw,
        weighted: w,
        multipliers: mult,
        competition: r.competition,
      };
      pushBD(bdCountries, team, item);
      if (coach) {
        add(coaches, coach, raw, w, 0);
        bumpEvo(evoCoaches, coach, r.season_year, w);
        pushBD(bdCoaches, coach, item);
      }
    }
  }


  const sortW = (a: RankingEntry, b: RankingEntry) => b.weighted - a.weighted;
  return {
    countries: [...countries.values()].sort(sortW),
    coaches: [...coaches.values()].sort(sortW),
    evolution: { countries: evoCountries, coaches: evoCoaches },
    breakdown: { countries: bdCountries, coaches: bdCoaches },
    years,
  };
}


