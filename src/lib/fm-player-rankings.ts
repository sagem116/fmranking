import type { FmConfig } from "./fm-config";
import { cfgDecay, cfgDivisionWeight, cfgNationalLeagueWeight } from "./fm-config";
import type { PlayerStatRow, CompetitionStatRow, CompType } from "./fm-player-stats-db";
import type { ClubMap } from "./fm-club-map";
import { isClubMapped } from "./fm-club-map";

export type StatField = "gls" | "ast" | "games" | "hdj" | "ca" | "cp" | "vp" | "salary";

export interface PlayerRankRow {
  key: string;
  player_name: string;
  idu: string | null;
  club: string | null;
  competition: string;
  comp_type: CompType;
  country: string | null;
  continent: string | null;
  nationality: string | null;
  season_year: number;
  value: number;
  raw: number;
}

export interface RankingsContext {
  config: FmConfig;
  withDecay: boolean;
  latestYear: number;
}

function divisionFromCompetition(label: string): number | null {
  const m = label.match(/D(\d+)/i);
  return m ? Number(m[1]) : null;
}

function normText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function matchesFilter(value: string | null | undefined, filter: string): boolean {
  const q = normText(filter);
  if (!q) return true;
  return normText(value).includes(q);
}

export function compWeight(cfg: FmConfig, r: PlayerStatRow | CompetitionStatRow): number {
  const cw = cfg.competitionWeights;
  switch (r.comp_type) {
    case "superleague": {
      const div = divisionFromCompetition(r.competition);
      return (cw.superleague ?? 1) * cfgDivisionWeight(cfg, div);
    }
    case "national":
      return (cw.national ?? 1) * cfgNationalLeagueWeight(cfg, r.competition);
    case "continental":
      return cw.continental ?? 1;
    case "international":
      return cw.international ?? 1;
  }
}

export function decayFactor(cfg: FmConfig, year: number, latestYear: number, withDecay: boolean): number {
  if (!withDecay) return 1;
  return cfgDecay(cfg, year, latestYear);
}

export interface PlayerFilters {
  comp_type: CompType | "all";
  yearFrom: number | null;
  yearTo: number | null;
  country: string;
  continent: string;
  club: string;
  competition: string;
  nationality: string;
  search: string;
  ageMin: number | null;
  ageMax: number | null;
}

export function emptyFilters(): PlayerFilters {
  return {
    comp_type: "all",
    yearFrom: null,
    yearTo: null,
    country: "",
    continent: "",
    club: "",
    competition: "",
    nationality: "",
    search: "",
    ageMin: null,
    ageMax: null,
  };
}

export function filterPlayerRows(
  rows: PlayerStatRow[],
  f: PlayerFilters,
  continentOf: (c: string | null | undefined) => string | null,
  /** Optional SSOT club map — when passed, rows whose (season, club) is NOT
   *  mapped by Importar Época are excluded from rankings/records. */
  clubMap?: ClubMap,
): PlayerStatRow[] {
  const q = normText(f.search);
  return rows.filter((r) => {
    // SSOT: drop unmapped clubs from all rankings/records.
    if (clubMap && r.club && !isClubMapped(clubMap, r.club, r.season_year)) return false;
    if (f.comp_type !== "all" && r.comp_type !== f.comp_type) return false;
    if (f.yearFrom != null && r.season_year < f.yearFrom) return false;
    if (f.yearTo != null && r.season_year > f.yearTo) return false;
    // País / Continente do JOGADOR — usa NAC (nationality), não o país do clube
    if (!matchesFilter(r.nationality, f.country)) return false;
    if (f.continent) {
      const cont = continentOf(r.nationality);
      if (cont !== f.continent) return false;
    }
    if (!matchesFilter(r.club, f.club)) return false;
    if (!matchesFilter(r.competition, f.competition)) return false;
    if (!matchesFilter(r.nationality, f.nationality)) return false;
    if (f.ageMin != null && (!r.age || r.age < f.ageMin)) return false;
    if (f.ageMax != null && (!r.age || r.age > f.ageMax)) return false;
    if (q) {
      const hay = normText(`${r.player_name} ${r.club ?? ""} ${r.competition} ${r.country ?? ""} ${r.nationality ?? ""}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Compute a per-player ranking for a given stat field.
 * - Unified mode: groups by IDU across competitions (rows without IDU fall back to name|club key).
 * - In Unified, totals are SUMS across all comp_types/seasons (raw == value when mode=raw).
 * - Weighted mode multiplies each row's contribution by competitionWeight * decayFactor.
 */
export function rankPlayers(
  rows: PlayerStatRow[],
  field: StatField,
  unified: boolean,
  mode: "weighted" | "raw",
  ctx: RankingsContext,
): PlayerRankRow[] {
  if (!unified) {
    // Non-unified: per (player+club+competition+season) row
    return rows
      .map((r) => {
        const raw = Number(r[field]) || 0;
        const w = mode === "weighted" ? raw * compWeight(ctx.config, r) * decayFactor(ctx.config, r.season_year, ctx.latestYear, ctx.withDecay) : raw;
        return {
          key: `${r.season_year}|${r.comp_type}|${r.idu ?? r.player_name + "|" + (r.club ?? "")}`,
          player_name: r.player_name,
          idu: r.idu,
          club: r.club,
          competition: r.competition,
          comp_type: r.comp_type,
          country: r.country,
          continent: r.continent,
          nationality: r.nationality,
          season_year: r.season_year,
          value: w,
          raw,
        };
      })
      .filter((r) => r.raw !== 0)
      .sort((a, b) => b.value - a.value);
  }
  // Unified mode — group by IDU across competitions/seasons
  const map = new Map<string, PlayerRankRow>();
  for (const r of rows) {
    if (!r.idu) continue; // unified requires IDU
    const raw = Number(r[field]) || 0;
    if (!raw) continue;
    const w = mode === "weighted" ? raw * compWeight(ctx.config, r) * decayFactor(ctx.config, r.season_year, ctx.latestYear, ctx.withDecay) : raw;
    const cur = map.get(r.idu);
    if (cur) {
      cur.value += w;
      cur.raw += raw;
      // keep latest season's club/competition for display
      if (r.season_year >= cur.season_year) {
        cur.club = r.club ?? cur.club;
        cur.competition = r.competition;
        cur.season_year = r.season_year;
        cur.country = r.country ?? cur.country;
        cur.nationality = r.nationality ?? cur.nationality;
      }
    } else {
      map.set(r.idu, {
        key: `idu:${r.idu}`,
        player_name: r.player_name,
        idu: r.idu,
        club: r.club,
        competition: r.competition,
        comp_type: r.comp_type,
        country: r.country,
        continent: r.continent,
        nationality: r.nationality,
        season_year: r.season_year,
        value: w,
        raw,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

export interface CompetitionRankRow {
  key: string;
  competition: string;
  comp_type: CompType;
  country: string | null;
  continent: string | null;
  n_players: number;
  ca: number;
  cp: number;
  vp: number;
  salary: number;
  ra: number;
  rm: number;
  rc: number;
  age: number;
}

export interface CompFilters {
  comp_type: CompType | "all";
  yearFrom: number | null;
  yearTo: number | null;
  country: string;
  continent: string;
  search: string;
}

export function emptyCompFilters(): CompFilters {
  return { comp_type: "all", yearFrom: null, yearTo: null, country: "", continent: "", search: "" };
}

/**
 * Compute competition averages across seasons (aggregated weighted across selected season range).
 */
export function rankCompetitions(
  rows: CompetitionStatRow[],
  f: CompFilters,
  mode: "weighted" | "raw",
  ctx: RankingsContext,
): CompetitionRankRow[] {
  const q = normText(f.search);
  const filtered = rows.filter((r) => {
    if (f.comp_type !== "all" && r.comp_type !== f.comp_type) return false;
    if (f.yearFrom != null && r.season_year < f.yearFrom) return false;
    if (f.yearTo != null && r.season_year > f.yearTo) return false;
    if (!matchesFilter(r.country, f.country)) return false;
    if (f.continent) {
      const cont = r.continent ?? null;
      if (cont !== f.continent) return false;
    }
    if (q) {
      const hay = normText(`${r.competition} ${r.country ?? ""} ${r.continent ?? ""}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Aggregate across seasons by competition (weighted by n_players × season factor)
  const map = new Map<string, { row: CompetitionRankRow; totals: Record<string, number>; weightSum: number }>();
  for (const r of filtered) {
    const factor = mode === "weighted"
      ? compWeight(ctx.config, r) * decayFactor(ctx.config, r.season_year, ctx.latestYear, ctx.withDecay)
      : 1;
    const w = (r.n_players || 1) * factor;
    const key = `${r.comp_type}|${r.competition}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        row: {
          key,
          competition: r.competition,
          comp_type: r.comp_type,
          country: r.country,
          continent: r.continent,
          n_players: 0,
          ca: 0, cp: 0, vp: 0, salary: 0, ra: 0, rm: 0, rc: 0, age: 0,
        },
        totals: { ca: 0, cp: 0, vp: 0, salary: 0, ra: 0, rm: 0, rc: 0, age: 0 },
        weightSum: 0,
      };
      map.set(key, entry);
    }
    entry.row.n_players += r.n_players;
    entry.weightSum += w;
    entry.totals.ca += r.ca_avg * w;
    entry.totals.cp += r.cp_avg * w;
    entry.totals.vp += r.vp_avg * w;
    entry.totals.salary += r.salary_avg * w;
    entry.totals.ra += r.ra_avg * w;
    entry.totals.rm += r.rm_avg * w;
    entry.totals.rc += r.rc_avg * w;
    entry.totals.age += r.age_avg * w;
  }
  return [...map.values()].map(({ row, totals, weightSum }) => {
    const k = weightSum || 1;
    return {
      ...row,
      ca: totals.ca / k,
      cp: totals.cp / k,
      vp: totals.vp / k,
      salary: totals.salary / k,
      ra: totals.ra / k,
      rm: totals.rm / k,
      rc: totals.rc / k,
      age: totals.age / k,
    };
  }).sort((a, b) => b.ca - a.ca);
}
