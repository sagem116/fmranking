import type { ComputeResult, RankingEntry } from "./fm-rankings";

export type Subject = "clubs" | "coaches" | "countries";

export type ReqType =
  | "superleague-champion"
  | "superleague-promotion"
  | "national-champion"
  | "continental-winner"
  | "international-winner"
  | "hall-of-fame"
  | "unbeaten-season"
  | "points-record";

export type LeagueScope = "any" | "superleague" | "national";

export interface Requirement {
  type: ReqType;
  match: string;
  count: number;
  consecutive: boolean;
  hofTopN?: number;
  leagueScope?: LeagueScope;
}

export interface Desafio {
  id: string;
  name: string;
  description?: string;
  subjects: Subject[];
  sameYear: boolean;
  bonus: number;
  requirements: Requirement[];
}

export interface Match {
  subject: Subject;
  entity: string;
  years: number[];
  details: string[];
  extras: string[];
}

export interface DesafioResult {
  desafio: Desafio;
  matches: Match[];
}

export const STORAGE_KEY = "fm-desafios-v2";
export const STORAGE_KEY_LEGACY = "fm-desafios-v1";

export const REQ_LABEL: Record<ReqType, string> = {
  "superleague-champion": "SuperLeague (campeão)",
  "superleague-promotion": "SuperLeague (campeão ou promovido)",
  "national-champion": "Liga Nacional (campeão)",
  "continental-winner": "Continental (vencedor)",
  "international-winner": "Internacional/Seleção (vencedor)",
  "hall-of-fame": "Hall of Fame (entrar no Top N)",
  "unbeaten-season": "Invencibilidade (época sem derrotas)",
  "points-record": "Recorde de pontos na liga/divisão",
};

export const SUBJECT_LABEL: Record<Subject, string> = {
  clubs: "Clubes",
  coaches: "Treinadores",
  countries: "Países / Seleções",
};

export const ALL_SUBJECTS: Subject[] = ["clubs", "coaches", "countries"];

export function normalizeDesafio(d: any): Desafio {
  const subjects: Subject[] = Array.isArray(d.subjects) && d.subjects.length > 0
    ? d.subjects.filter((s: any) => ALL_SUBJECTS.includes(s))
    : d.subject && ALL_SUBJECTS.includes(d.subject) ? [d.subject as Subject] : ["clubs"];
  return {
    id: d.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())),
    name: d.name ?? "Desafio",
    description: d.description ?? "",
    subjects: subjects.length ? subjects : ["clubs"],
    sameYear: !!d.sameYear,
    bonus: Number(d.bonus) || 0,
    requirements: (d.requirements ?? []).map((r: any) => ({
      type: (Object.keys(REQ_LABEL).includes(r?.type) ? r.type
        : r?.type === "superleague" ? "superleague-champion"
        : r?.type === "national" ? "national-champion"
        : r?.type === "continental" ? "continental-winner"
        : r?.type === "international" ? "international-winner"
        : "superleague-champion") as ReqType,
      match: r?.match ?? "",
      count: Math.max(1, Number(r?.count) || 1),
      consecutive: !!r?.consecutive,
      hofTopN: r?.hofTopN ? Math.max(1, Number(r.hofTopN)) : undefined,
      leagueScope: (r?.leagueScope === "superleague" || r?.leagueScope === "national" ? r.leagueScope : "any") as LeagueScope,
    })),
  };
}

export function loadDesafios(): Desafio[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return (JSON.parse(raw) as any[]).map(normalizeDesafio);
    const legacy = window.localStorage.getItem(STORAGE_KEY_LEGACY);
    if (legacy) {
      const arr = JSON.parse(legacy);
      const migrated = (Array.isArray(arr) ? arr : []).map(normalizeDesafio);
      saveDesafios(migrated);
      return migrated;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveDesafios(list: Desafio[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

function longestRun(yearsSet: Set<number>): { length: number; years: number[] } {
  if (yearsSet.size === 0) return { length: 0, years: [] };
  const sorted = [...yearsSet].sort((a, b) => a - b);
  let best: number[] = [sorted[0]];
  let cur: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) cur.push(sorted[i]);
    else cur = [sorted[i]];
    if (cur.length > best.length) best = [...cur];
  }
  return { length: best.length, years: best };
}

function topNByYear(
  evo: Record<string, Record<number, number>>,
  topN: number,
): Map<number, Set<string>> {
  const yearToNames = new Map<number, { name: string; w: number }[]>();
  for (const name of Object.keys(evo)) {
    for (const [y, w] of Object.entries(evo[name])) {
      if (!w || w <= 0) continue;
      const yn = Number(y);
      const arr = yearToNames.get(yn) ?? [];
      arr.push({ name, w });
      yearToNames.set(yn, arr);
    }
  }
  const out = new Map<number, Set<string>>();
  for (const [y, arr] of yearToNames) {
    arr.sort((a, b) => b.w - a.w);
    out.set(y, new Set(arr.slice(0, topN).map((x) => x.name)));
  }
  return out;
}

export function buildDesafioIndex(data: any, ranks: ComputeResult) {
  const clubCountry = data.clubCountry as Record<string, string | null>;
  const clubSLChampion = new Map<string, Set<number>>();
  const clubSLPromOrChamp = new Map<string, Set<number>>();
  const clubNationalChampion: { league: string; club: string; year: number }[] = [];
  const clubContinentalWin: { comp: string; club: string; year: number }[] = [];

  for (const s of data.standings) {
    if (s.module === "superleague") {
      if (s.is_champion) {
        const set = clubSLChampion.get(s.club_name) ?? new Set();
        set.add(s.season_year); clubSLChampion.set(s.club_name, set);
      }
      const tokens = s.info
        ? new Set(String(s.info).toUpperCase().split(/[\s,;/|+]+/).map((t: string) => t.trim()).filter(Boolean))
        : new Set<string>();
      if (s.is_champion || tokens.has("P")) {
        const set = clubSLPromOrChamp.get(s.club_name) ?? new Set();
        set.add(s.season_year); clubSLPromOrChamp.set(s.club_name, set);
      }
    } else if (s.module === "national" && s.is_champion) {
      clubNationalChampion.push({ league: s.division_label ?? "", club: s.club_name, year: s.season_year });
    }
  }
  for (const c of data.continental) {
    if (c.winner) clubContinentalWin.push({ comp: c.competition, club: c.winner, year: c.season_year });
  }

  const intlWinByCountry: { comp: string; country: string; year: number }[] = [];
  for (const r of data.international ?? []) {
    if (r.winner) intlWinByCountry.push({ comp: r.competition, country: r.winner, year: r.season_year });
  }

  const coachByClubSeason = new Map<string, string>();
  for (const c of data.coaches) {
    if (!c.club_name) continue;
    coachByClubSeason.set(`${c.module}|${c.season_year}|${c.club_name}`, c.name);
  }

  type LeagueSeason = { module: "superleague" | "national"; league: string; club: string; year: number; points: number; losses: number; played: number };
  const unbeaten: LeagueSeason[] = [];
  const allLeagueSeasons: LeagueSeason[] = [];
  for (const s of data.standings) {
    if (s.module !== "superleague" && s.module !== "national") continue;
    const league = s.division_label ?? `Div ${s.division_num ?? "?"}`;
    const played = Number(s.played ?? 0) || 0;
    const losses = s.losses == null ? null : Number(s.losses);
    const points = Number(s.points ?? 0) || 0;
    if (losses === 0 && played > 0) {
      unbeaten.push({ module: s.module, league, club: s.club_name, year: s.season_year, points, losses: 0, played });
    }
    if (s.points != null) {
      allLeagueSeasons.push({ module: s.module, league, club: s.club_name, year: s.season_year, points, losses: losses ?? 0, played });
    }
  }
  const pointsRecords: LeagueSeason[] = [];
  const byLeague = new Map<string, LeagueSeason[]>();
  for (const ls of allLeagueSeasons) {
    const key = `${ls.module}|${ls.league}`;
    const arr = byLeague.get(key) ?? [];
    arr.push(ls); byLeague.set(key, arr);
  }
  for (const arr of byLeague.values()) {
    arr.sort((a, b) => a.year - b.year || b.points - a.points);
    let max = -Infinity;
    const byYear = new Map<number, LeagueSeason[]>();
    for (const ls of arr) {
      const y = byYear.get(ls.year) ?? [];
      y.push(ls); byYear.set(ls.year, y);
    }
    const years = [...byYear.keys()].sort((a, b) => a - b);
    for (const y of years) {
      const seasons = byYear.get(y)!;
      const prevMax = max;
      let yearMax = max;
      for (const ls of seasons) {
        if (ls.points > prevMax) pointsRecords.push(ls);
        if (ls.points > yearMax) yearMax = ls.points;
      }
      max = yearMax;
    }
  }

  const hofClubsCache = new Map<number, Map<number, Set<string>>>();
  const hofCoachesCache = new Map<number, Map<number, Set<string>>>();
  const hofCountriesCache = new Map<number, Map<number, Set<string>>>();
  const hofGet = (cat: Subject, n: number) => {
    const cache = cat === "clubs" ? hofClubsCache : cat === "coaches" ? hofCoachesCache : hofCountriesCache;
    const evo = cat === "clubs" ? ranks.evolution.clubs : cat === "coaches" ? ranks.evolution.coaches : ranks.evolution.countries;
    let m = cache.get(n);
    if (!m) { m = topNByYear(evo, n); cache.set(n, m); }
    return m;
  };

  return {
    clubCountry, clubSLChampion, clubSLPromOrChamp, clubNationalChampion,
    clubContinentalWin, intlWinByCountry, coachByClubSeason, hofGet,
    unbeaten, pointsRecords,
  };
}

type Idx = ReturnType<typeof buildDesafioIndex>;

function evaluateForSubject(desafio: Desafio, subject: Subject, candidates: Set<string>, idx: Idx): Match[] {
  const out: Match[] = [];
  for (const entity of candidates) {
    const perReqYears: Set<number>[] = [];
    const perReqDetails: string[] = [];
    const extras: string[] = [];
    let ok = true;
    for (const req of desafio.requirements) {
      const years = new Set<number>();
      const matchTxt = (req.match || "").toLowerCase().trim();

      if (req.type === "hall-of-fame") {
        const n = Math.max(1, req.hofTopN ?? 10);
        const topMap = idx.hofGet(subject, n);
        for (const [y, set] of topMap) if (set.has(entity)) years.add(y);
        perReqDetails.push(`HoF Top ${n} ${SUBJECT_LABEL[subject]}`);
      } else if (req.type === "unbeaten-season" || req.type === "points-record") {
        const scope = req.leagueScope ?? "any";
        const pool = req.type === "unbeaten-season" ? idx.unbeaten : idx.pointsRecords;
        const matchClub = (club: string, year: number) => {
          if (subject === "clubs") return club === entity;
          if (subject === "coaches") {
            return idx.coachByClubSeason.get(`superleague|${year}|${club}`) === entity
                || idx.coachByClubSeason.get(`national|${year}|${club}`) === entity;
          }
          return idx.clubCountry[club] === entity;
        };
        for (const r of pool) {
          if (scope !== "any" && r.module !== scope) continue;
          if (matchTxt && !r.league.toLowerCase().includes(matchTxt)) continue;
          if (!matchClub(r.club, r.year)) continue;
          years.add(r.year);
          const prefix = req.type === "unbeaten-season" ? "Invencível" : "Recorde";
          const who = subject === "clubs" ? "" : ` · ${r.club}`;
          extras.push(`${r.year} · ${r.league}${who} · ${r.points} pts · ${r.losses}D / ${r.played}J · ${prefix}`);
        }
        const scopeLbl = scope === "any" ? "" : scope === "superleague" ? " SL" : " Nac.";
        perReqDetails.push(`${req.type === "unbeaten-season" ? "Invencível" : "Recorde pts"}${scopeLbl}${matchTxt ? ` (${req.match})` : ""}`);
      } else if (subject === "clubs") {
        const club = entity;
        if (req.type === "superleague-champion") {
          for (const y of idx.clubSLChampion.get(club) ?? []) years.add(y);
          perReqDetails.push("SL campeão");
        } else if (req.type === "superleague-promotion") {
          for (const y of idx.clubSLPromOrChamp.get(club) ?? []) years.add(y);
          perReqDetails.push("SL campeão/promovido");
        } else if (req.type === "national-champion") {
          for (const r of idx.clubNationalChampion) {
            if (r.club !== club) continue;
            if (matchTxt && !r.league.toLowerCase().includes(matchTxt)) continue;
            years.add(r.year);
          }
          perReqDetails.push(`Liga Nacional${matchTxt ? ` (${req.match})` : ""}`);
        } else if (req.type === "continental-winner") {
          for (const r of idx.clubContinentalWin) {
            if (r.club !== club) continue;
            if (matchTxt && !r.comp.toLowerCase().includes(matchTxt)) continue;
            years.add(r.year);
          }
          perReqDetails.push(`Continental${matchTxt ? ` (${req.match})` : ""}`);
        } else if (req.type === "international-winner") {
          const country = idx.clubCountry[club];
          if (country) {
            for (const r of idx.intlWinByCountry) {
              if (r.country !== country) continue;
              if (matchTxt && !r.comp.toLowerCase().includes(matchTxt)) continue;
              years.add(r.year);
            }
          }
          perReqDetails.push(`Internacional via país${matchTxt ? ` (${req.match})` : ""}`);
        }
      } else if (subject === "coaches") {
        const coach = entity;
        const coachWonAt = (module: string, club: string, year: number) =>
          idx.coachByClubSeason.get(`${module}|${year}|${club}`) === coach;
        if (req.type === "superleague-champion") {
          for (const [club, ys] of idx.clubSLChampion) for (const y of ys) if (coachWonAt("superleague", club, y)) years.add(y);
          perReqDetails.push("SL campeão (qualquer clube)");
        } else if (req.type === "superleague-promotion") {
          for (const [club, ys] of idx.clubSLPromOrChamp) for (const y of ys) if (coachWonAt("superleague", club, y)) years.add(y);
          perReqDetails.push("SL campeão/promovido (qualquer clube)");
        } else if (req.type === "national-champion") {
          for (const r of idx.clubNationalChampion) {
            if (matchTxt && !r.league.toLowerCase().includes(matchTxt)) continue;
            if (coachWonAt("national", r.club, r.year)) years.add(r.year);
          }
          perReqDetails.push(`Liga Nacional${matchTxt ? ` (${req.match})` : ""} (qualquer clube)`);
        } else if (req.type === "continental-winner") {
          for (const r of idx.clubContinentalWin) {
            if (matchTxt && !r.comp.toLowerCase().includes(matchTxt)) continue;
            if (idx.coachByClubSeason.get(`superleague|${r.year}|${r.club}`) === coach) years.add(r.year);
          }
          perReqDetails.push(`Continental${matchTxt ? ` (${req.match})` : ""} (qualquer clube)`);
        } else if (req.type === "international-winner") {
          perReqDetails.push("Internacional (não suportado p/ treinadores)");
          ok = false; break;
        }
      } else {
        const country = entity;
        if (req.type === "international-winner") {
          for (const r of idx.intlWinByCountry) {
            if (r.country !== country) continue;
            if (matchTxt && !r.comp.toLowerCase().includes(matchTxt)) continue;
            years.add(r.year);
          }
          perReqDetails.push(`Internacional${matchTxt ? ` (${req.match})` : ""}`);
        } else if (req.type === "continental-winner") {
          for (const r of idx.clubContinentalWin) {
            if (idx.clubCountry[r.club] !== country) continue;
            if (matchTxt && !r.comp.toLowerCase().includes(matchTxt)) continue;
            years.add(r.year);
          }
          perReqDetails.push(`Continental via clube${matchTxt ? ` (${req.match})` : ""}`);
        } else if (req.type === "superleague-champion") {
          for (const [club, ys] of idx.clubSLChampion) if (idx.clubCountry[club] === country) for (const y of ys) years.add(y);
          perReqDetails.push("SL campeão (via clube)");
        } else if (req.type === "superleague-promotion") {
          for (const [club, ys] of idx.clubSLPromOrChamp) if (idx.clubCountry[club] === country) for (const y of ys) years.add(y);
          perReqDetails.push("SL campeão/promovido (via clube)");
        } else if (req.type === "national-champion") {
          for (const r of idx.clubNationalChampion) {
            if (idx.clubCountry[r.club] !== country) continue;
            if (matchTxt && !r.league.toLowerCase().includes(matchTxt)) continue;
            years.add(r.year);
          }
          perReqDetails.push(`Liga Nacional via clube${matchTxt ? ` (${req.match})` : ""}`);
        }
      }

      const need = Math.max(1, req.count || 1);
      if (req.consecutive) {
        const { length } = longestRun(years);
        if (length < need) { ok = false; break; }
      } else {
        if (years.size < need) { ok = false; break; }
      }
      perReqYears.push(years);
    }

    if (!ok || perReqYears.length !== desafio.requirements.length || perReqYears.length === 0) continue;

    if (desafio.sameYear) {
      const [first, ...rest] = perReqYears;
      const intersect = new Set<number>();
      for (const y of first) if (rest.every((s) => s.has(y))) intersect.add(y);
      if (intersect.size === 0) continue;
    }

    const allYears = new Set<number>();
    for (const s of perReqYears) for (const y of s) allYears.add(y);
    out.push({ subject, entity, years: [...allYears].sort((a, b) => a - b), details: perReqDetails, extras });
  }
  return out;
}

export function evaluateDesafios(data: any, ranks: ComputeResult, list: Desafio[]): DesafioResult[] {
  if (!list.length) return [];
  const idx = buildDesafioIndex(data, ranks);
  return list.map((desafio) => {
    const all: Match[] = [];
    for (const subject of desafio.subjects) {
      const candidates = new Set<string>();
      if (subject === "clubs") {
        for (const k of idx.clubSLPromOrChamp.keys()) candidates.add(k);
        for (const r of idx.clubNationalChampion) candidates.add(r.club);
        for (const r of idx.clubContinentalWin) candidates.add(r.club);
        for (const r of idx.unbeaten) candidates.add(r.club);
        for (const r of idx.pointsRecords) candidates.add(r.club);
        for (const k of Object.keys(ranks.evolution.clubs)) candidates.add(k);
      } else if (subject === "coaches") {
        for (const c of data.coaches) candidates.add(c.name);
        for (const k of Object.keys(ranks.evolution.coaches)) candidates.add(k);
      } else {
        for (const r of idx.intlWinByCountry) candidates.add(r.country);
        for (const k of Object.keys(ranks.evolution.countries)) candidates.add(k);
      }
      all.push(...evaluateForSubject(desafio, subject, candidates, idx));
    }
    all.sort((a, b) => a.subject.localeCompare(b.subject) || a.entity.localeCompare(b.entity));
    return { desafio, matches: all };
  });
}

export function applyDesafioBonuses(ranks: ComputeResult, results: DesafioResult[]): ComputeResult {
  if (!results.length) return ranks;
  const cloneArr = (arr: RankingEntry[]) => arr.map((e) => ({ ...e }));
  const out: ComputeResult = {
    ...ranks,
    clubs: cloneArr(ranks.clubs),
    coaches: cloneArr(ranks.coaches),
    countries: cloneArr(ranks.countries),
  };
  const apply = (arr: RankingEntry[], name: string, bonus: number) => {
    let e = arr.find((x) => x.name === name);
    if (!e) {
      e = { name, raw: 0, weighted: 0, titles: 0 };
      arr.push(e);
    }
    e.raw += bonus;
    e.weighted += bonus;
  };
  for (const { desafio, matches } of results) {
    if (!desafio.bonus) continue;
    for (const m of matches) {
      const arr = m.subject === "clubs" ? out.clubs : m.subject === "coaches" ? out.coaches : out.countries;
      apply(arr, m.entity, desafio.bonus);
    }
  }
  out.clubs.sort((a, b) => b.weighted - a.weighted);
  out.coaches.sort((a, b) => b.weighted - a.weighted);
  out.countries.sort((a, b) => b.weighted - a.weighted);
  return out;
}

/**
 * Per-entity breakdown of points coming from challenges, scoped to one subject.
 * Returns: { [entity]: { total, items: [{ name, bonus, years }] } }
 */
export function buildDesafioBreakdownBySubject(
  results: DesafioResult[],
  subject: Subject,
): Record<string, { total: number; items: { name: string; bonus: number; years: number[] }[] }> {
  const out: Record<string, { total: number; items: { name: string; bonus: number; years: number[] }[] }> = {};
  for (const { desafio, matches } of results) {
    if (!desafio.bonus) continue;
    for (const m of matches) {
      if (m.subject !== subject) continue;
      const cur = out[m.entity] ?? { total: 0, items: [] };
      cur.total += desafio.bonus;
      cur.items.push({ name: desafio.name, bonus: desafio.bonus, years: m.years });
      out[m.entity] = cur;
    }
  }
  return out;
}

// ===== Preset library =====
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `p-${Math.random().toString(36).slice(2)}`);

export const DESAFIO_PRESETS: Desafio[] = [
  {
    id: uid(), name: "Tri-campeão da SuperLeague",
    description: "Vencer a SuperLeague em 3 épocas consecutivas (clube ou treinador).",
    subjects: ["clubs", "coaches"], sameYear: false, bonus: 1500,
    requirements: [{ type: "superleague-champion", match: "", count: 3, consecutive: true }],
  },
  {
    id: uid(), name: "Penta-campeão da SuperLeague",
    description: "5 títulos da SuperLeague (não precisam ser seguidos).",
    subjects: ["clubs", "coaches"], sameYear: false, bonus: 3000,
    requirements: [{ type: "superleague-champion", match: "", count: 5, consecutive: false }],
  },
  {
    id: uid(), name: "Dinastia Continental",
    description: "Vencer uma competição continental 3 anos seguidos.",
    subjects: ["clubs", "coaches"], sameYear: false, bonus: 2500,
    requirements: [{ type: "continental-winner", match: "", count: 3, consecutive: true }],
  },
  {
    id: uid(), name: "Dobradinha Continental",
    description: "Campeão SuperLeague + Vencedor Continental no mesmo ano.",
    subjects: ["clubs", "coaches"], sameYear: true, bonus: 1200,
    requirements: [
      { type: "superleague-champion", match: "", count: 1, consecutive: false },
      { type: "continental-winner", match: "", count: 1, consecutive: false },
    ],
  },
  {
    id: uid(), name: "Lenda do Hall of Fame",
    description: "Permanecer no Top 10 do Hall of Fame durante 5 anos consecutivos.",
    subjects: ["clubs", "coaches"], sameYear: false, bonus: 2000,
    requirements: [{ type: "hall-of-fame", match: "", count: 5, consecutive: true, hofTopN: 10 }],
  },
  {
    id: uid(), name: "Elite do Hall of Fame",
    description: "10 presenças no Top 5 do Hall of Fame (não precisam ser seguidas).",
    subjects: ["clubs", "coaches"], sameYear: false, bonus: 2500,
    requirements: [{ type: "hall-of-fame", match: "", count: 10, consecutive: false, hofTopN: 5 }],
  },
  {
    id: uid(), name: "Invencível na SuperLeague",
    description: "Concluir uma época da SuperLeague sem derrotas.",
    subjects: ["clubs", "coaches"], sameYear: false, bonus: 1000,
    requirements: [{ type: "unbeaten-season", match: "", count: 1, consecutive: false, leagueScope: "superleague" }],
  },
  {
    id: uid(), name: "Invencível Nacional",
    description: "Vencer uma liga nacional sem perder.",
    subjects: ["clubs", "coaches"], sameYear: false, bonus: 800,
    requirements: [{ type: "unbeaten-season", match: "", count: 1, consecutive: false, leagueScope: "national" }],
  },
  {
    id: uid(), name: "Recorde de pontos",
    description: "Bater o recorde de pontos numa liga/divisão.",
    subjects: ["clubs", "coaches"], sameYear: false, bonus: 600,
    requirements: [{ type: "points-record", match: "", count: 1, consecutive: false, leagueScope: "any" }],
  },
  {
    id: uid(), name: "Promoção Express",
    description: "Duas promoções (ou títulos) consecutivas na SuperLeague.",
    subjects: ["clubs", "coaches"], sameYear: false, bonus: 700,
    requirements: [{ type: "superleague-promotion", match: "", count: 2, consecutive: true }],
  },
  {
    id: uid(), name: "Glória Internacional",
    description: "Conquistar uma competição internacional de seleções.",
    subjects: ["countries"], sameYear: false, bonus: 1500,
    requirements: [{ type: "international-winner", match: "", count: 1, consecutive: false }],
  },
  {
    id: uid(), name: "Bicampeão Internacional",
    description: "Vencer 2 competições internacionais de seleções.",
    subjects: ["countries"], sameYear: false, bonus: 2500,
    requirements: [{ type: "international-winner", match: "", count: 2, consecutive: false }],
  },
  {
    id: uid(), name: "Império de um país",
    description: "Selecção + Clube do país vencem competições internacional e continental no mesmo ano.",
    subjects: ["countries"], sameYear: true, bonus: 3000,
    requirements: [
      { type: "international-winner", match: "", count: 1, consecutive: false },
      { type: "continental-winner", match: "", count: 1, consecutive: false },
    ],
  },
  {
    id: uid(), name: "Domínio Nacional",
    description: "5 títulos de liga nacional (qualquer país).",
    subjects: ["clubs", "coaches"], sameYear: false, bonus: 1200,
    requirements: [{ type: "national-champion", match: "", count: 5, consecutive: false }],
  },
  {
    id: uid(), name: "Coleção Continental",
    description: "Vencer 5 competições continentais.",
    subjects: ["clubs", "coaches"], sameYear: false, bonus: 4000,
    requirements: [{ type: "continental-winner", match: "", count: 5, consecutive: false }],
  },
];

export function clonePresetForInsertion(p: Desafio): Desafio {
  return { ...p, id: uid(), requirements: p.requirements.map((r) => ({ ...r })) };
}
