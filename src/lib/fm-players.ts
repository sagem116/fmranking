import type { PlayerRow } from "./fm-db";
import type { StandingRow } from "./fm-rankings";

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ClubAgg {
  club: string;
  league: string;
  division: number | null;
  n: number;
  ra: number;
  rm: number;
  ca: number;
  cp: number;
  age: number;
  salary: number;
  vp: number;
}

export interface DivisionAgg {
  division: number;
  n: number;
  ra: number;
  rm: number;
  ca: number;
  cp: number;
  age: number;
  salary: number;
  vp: number;
}

export interface NationalLeagueAgg {
  league: string;
  n: number;
  ra: number;
  rm: number;
  ca: number;
  cp: number;
  age: number;
  salary: number;
  vp: number;
}

export interface PlayerStatRow {
  name: string;
  perSeason: Record<number, number>;
  perSeasonClub: Record<number, string>;
  total: number;
}

export interface PerformanceRow {
  name: string;
  club: string;
  league: string;
  age: number | null;
  gls: number;
  ast: number;
  total: number;
  salary: number;
  vp: number;
}

function latestYear(players: PlayerRow[]): number {
  let max = 0;
  for (const p of players) if (p.season_year > max) max = p.season_year;
  return max;
}

function clubDivisionMap(standings: StandingRow[], year: number): Map<string, number | null> {
  const m = new Map<string, number | null>();
  for (const s of standings) {
    if (s.module !== "superleague" || s.season_year !== year) continue;
    m.set(s.club_name, s.division_num);
  }
  return m;
}

function top28(arr: PlayerRow[]): PlayerRow[] {
  return [...arr].sort((a, b) => b.ca - a.ca).slice(0, 28);
}

export type YearFilter = number | "total" | "latest";

function resolveYear(players: PlayerRow[], year: YearFilter): number | "total" {
  if (year === "latest") return latestYear(players);
  return year;
}

export function listPlayerYears(players: PlayerRow[]): number[] {
  return [...new Set(players.map((p) => p.season_year))].filter((y) => y > 0).sort((a, b) => b - a);
}

export function computeClubAggregates(
  players: PlayerRow[],
  standings: StandingRow[],
  year: YearFilter = "latest",
): ClubAgg[] {
  const sel = resolveYear(players, year);
  const refYear = sel === "total" ? latestYear(players) : sel;
  const divMap = clubDivisionMap(standings, refYear);
  const byClub = new Map<string, PlayerRow[]>();
  for (const p of players) {
    if (!p.club_name) continue;
    if (sel !== "total" && p.season_year !== sel) continue;
    if (!byClub.has(p.club_name)) byClub.set(p.club_name, []);
    byClub.get(p.club_name)!.push(p);
  }
  const rows: ClubAgg[] = [];
  for (const [club, arr] of byClub) {
    const t = top28(arr);
    rows.push({
      club,
      league: arr[arr.length - 1]?.league ?? "",
      division: divMap.get(club) ?? null,
      n: arr.length,
      ra: r2(avg(t.map((p) => p.ra))),
      rm: r2(avg(t.map((p) => p.rm))),
      ca: r2(avg(t.map((p) => p.ca))),
      cp: r2(avg(t.map((p) => p.cp))),
      age: r2(avg(arr.map((p) => p.age ?? 0).filter((x) => x > 0))),
      salary: Math.round(sum(arr.map((p) => p.salary))),
      vp: Math.round(sum(arr.map((p) => p.vp))),
    });
  }
  return rows.sort((a, b) => b.ca - a.ca);
}

export function computeDivisionAggregates(
  players: PlayerRow[],
  standings: StandingRow[],
  year: YearFilter = "latest",
): DivisionAgg[] {
  const sel = resolveYear(players, year);
  const refYear = sel === "total" ? latestYear(players) : sel;
  const divMap = clubDivisionMap(standings, refYear);
  const byClub = new Map<string, PlayerRow[]>();
  for (const p of players) {
    if (!p.club_name) continue;
    if (sel !== "total" && p.season_year !== sel) continue;
    if (!byClub.has(p.club_name)) byClub.set(p.club_name, []);
    byClub.get(p.club_name)!.push(p);
  }
  const rows: DivisionAgg[] = [];
  for (let d = 1; d <= 11; d++) {
    const clubs = [...byClub.keys()].filter((c) => divMap.get(c) === d);
    const all: PlayerRow[] = [];
    const t28: PlayerRow[] = [];
    for (const c of clubs) {
      const arr = byClub.get(c) ?? [];
      all.push(...arr);
      t28.push(...top28(arr));
    }
    if (!all.length) continue;
    rows.push({
      division: d,
      n: all.length,
      ra: r2(avg(t28.map((p) => p.ra))),
      rm: r2(avg(t28.map((p) => p.rm))),
      ca: r2(avg(t28.map((p) => p.ca))),
      cp: r2(avg(t28.map((p) => p.cp))),
      age: r2(avg(all.map((p) => p.age ?? 0).filter((x) => x > 0))),
      salary: Math.round(sum(all.map((p) => p.salary))),
      vp: Math.round(sum(all.map((p) => p.vp))),
    });
  }
  return rows.sort((a, b) => a.division - b.division);
}

function clubNationalLeagueMap(
  standings: StandingRow[],
  year: number,
): Map<string, string | null> {
  const m = new Map<string, string | null>();
  for (const s of standings) {
    if (s.module !== "national" || s.season_year !== year) continue;
    if (!s.division_label) continue;
    m.set(s.club_name, s.division_label);
  }
  return m;
}

export function computeNationalLeagueAggregates(
  players: PlayerRow[],
  standings: StandingRow[],
  year: YearFilter = "latest",
): NationalLeagueAgg[] {
  const sel = resolveYear(players, year);
  const refYear = sel === "total" ? latestYear(players) : sel;
  const leagueMap = clubNationalLeagueMap(standings, refYear);
  const byClub = new Map<string, PlayerRow[]>();
  for (const p of players) {
    if (!p.club_name) continue;
    if (sel !== "total" && p.season_year !== sel) continue;
    if (!byClub.has(p.club_name)) byClub.set(p.club_name, []);
    byClub.get(p.club_name)!.push(p);
  }
  const byLeague = new Map<string, { all: PlayerRow[]; t28: PlayerRow[] }>();
  for (const [club, arr] of byClub) {
    const league = leagueMap.get(club);
    if (!league) continue;
    const bucket = byLeague.get(league) ?? { all: [], t28: [] };
    bucket.all.push(...arr);
    bucket.t28.push(...top28(arr));
    byLeague.set(league, bucket);
  }
  const rows: NationalLeagueAgg[] = [];
  for (const [league, { all, t28 }] of byLeague) {
    if (!all.length) continue;
    rows.push({
      league,
      n: all.length,
      ra: r2(avg(t28.map((p) => p.ra))),
      rm: r2(avg(t28.map((p) => p.rm))),
      ca: r2(avg(t28.map((p) => p.ca))),
      cp: r2(avg(t28.map((p) => p.cp))),
      age: r2(avg(all.map((p) => p.age ?? 0).filter((x) => x > 0))),
      salary: Math.round(sum(all.map((p) => p.salary))),
      vp: Math.round(sum(all.map((p) => p.vp))),
    });
  }
  return rows.sort((a, b) => b.ca - a.ca);
}

export interface PlayerKeyWarning {
  reason: "no-uid" | "duplicate-uid";
  idu: string | null;
  names: string[];
  clubs: string[];
}

export interface PlayerKeyResult {
  keyOf: (p: PlayerRow) => string;
  warnings: PlayerKeyWarning[];
}

/**
 * Build a unification key for players across seasons.
 * - Prefer IDU/UID.
 * - If a single IDU is used by multiple distinct (name) records OR a player has no IDU,
 *   fall back to "name|club" and emit a warning.
 */
export function buildPlayerKey(players: PlayerRow[]): PlayerKeyResult {
  // Group by idu to detect duplicates
  const byIdu = new Map<string, Set<string>>(); // idu -> set of normalized names
  const iduMeta = new Map<string, { names: Set<string>; clubs: Set<string> }>();
  for (const p of players) {
    if (!p.idu) continue;
    const k = p.idu;
    if (!byIdu.has(k)) byIdu.set(k, new Set());
    byIdu.get(k)!.add(p.name.trim().toLowerCase());
    if (!iduMeta.has(k)) iduMeta.set(k, { names: new Set(), clubs: new Set() });
    iduMeta.get(k)!.names.add(p.name);
    if (p.club_name) iduMeta.get(k)!.clubs.add(p.club_name);
  }
  const ambiguousIdus = new Set<string>();
  const warnings: PlayerKeyWarning[] = [];
  for (const [idu, names] of byIdu) {
    if (names.size > 1) {
      ambiguousIdus.add(idu);
      const meta = iduMeta.get(idu)!;
      warnings.push({ reason: "duplicate-uid", idu, names: [...meta.names], clubs: [...meta.clubs] });
    }
  }
  // Players without IDU — collect unique name+club warnings (only once)
  const noUidSeen = new Set<string>();
  for (const p of players) {
    if (p.idu) continue;
    const key = `${p.name}|${p.club_name ?? ""}`;
    if (noUidSeen.has(key)) continue;
    noUidSeen.add(key);
    warnings.push({ reason: "no-uid", idu: null, names: [p.name], clubs: p.club_name ? [p.club_name] : [] });
  }
  const keyOf = (p: PlayerRow): string => {
    if (p.idu && !ambiguousIdus.has(p.idu)) return `idu:${p.idu}`;
    return `nc:${p.name.trim().toLowerCase()}|${(p.club_name ?? "").trim().toLowerCase()}`;
  };
  return { keyOf, warnings };
}

/**
 * Players can appear both in SuperLeague and Ligas Nacionais imports for the same season.
 * The numbers are duplicated — keep only one record per (player, season), preferring
 * the SuperLeague row when available.
 */
function dedupePreferSuperLeague(
  players: PlayerRow[],
  keyOf: (p: PlayerRow) => string,
): PlayerRow[] {
  const map = new Map<string, PlayerRow>();
  for (const p of players) {
    const k = `${keyOf(p)}|${p.season_year}`;
    const existing = map.get(k);
    if (!existing) {
      map.set(k, p);
      continue;
    }
    if (existing.module !== "superleague" && p.module === "superleague") {
      map.set(k, p);
    }
  }
  return [...map.values()];
}

function buildStat(
  players: PlayerRow[],
  field: "gls" | "ast",
  year: number | "all" = "all",
): { rows: PlayerStatRow[]; years: number[] } {
  const { keyOf } = buildPlayerKey(players);
  const deduped = dedupePreferSuperLeague(players, keyOf);
  const filtered = year === "all" ? deduped : deduped.filter((p) => p.season_year === year);
  const years = year === "all"
    ? [...new Set(filtered.map((p) => p.season_year))].sort((a, b) => a - b)
    : [year];
  const map = new Map<string, PlayerStatRow>();
  for (const p of filtered) {
    const key = keyOf(p);
    const row = map.get(key) ?? { name: p.name, perSeason: {}, perSeasonClub: {}, total: 0 };
    row.perSeason[p.season_year] = (row.perSeason[p.season_year] ?? 0) + p[field];
    if (p.club_name) row.perSeasonClub[p.season_year] = p.club_name;
    map.set(key, row);
  }
  const rows = [...map.values()].map((r) => {
    r.total = years.reduce((t, y) => t + (r.perSeason[y] ?? 0), 0);
    return r;
  }).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  return { rows, years };
}

export const computeGoals = (players: PlayerRow[], year: number | "all" = "all") =>
  buildStat(players, "gls", year);
export const computeAssists = (players: PlayerRow[], year: number | "all" = "all") =>
  buildStat(players, "ast", year);

export interface PlayerHistoryEntry {
  year: number;
  club: string | null;
  league: string | null;
  division: number | null;
  divisionLabel: string | null;
  module: "superleague" | "national" | null;
  age: number | null;
  gls: number;
  ast: number;
  ca: number;
  cp: number;
  ra: number;
  rm: number;
  salary: number;
  vp: number;
}

export interface PlayerProfile {
  name: string;
  idu: string | null;
  history: PlayerHistoryEntry[];
  totals: { gls: number; ast: number; seasons: number };
}

export function buildPlayerProfile(
  players: PlayerRow[],
  standings: StandingRow[],
  name: string,
): PlayerProfile | null {
  const { keyOf } = buildPlayerKey(players);
  const seed = players.find((p) => p.name === name);
  if (!seed) return null;
  const key = keyOf(seed);
  const mine = players.filter((p) => keyOf(p) === key);
  if (mine.length === 0) return null;

  const stMap = new Map<string, StandingRow>();
  for (const s of standings) {
    if (s.module !== "superleague" && s.module !== "national") continue;
    const k = `${s.season_year}|${s.club_name}`;
    const cur = stMap.get(k);
    if (!cur || (cur.module === "national" && s.module === "superleague")) stMap.set(k, s);
  }

  const byYear = new Map<number, PlayerRow>();
  for (const p of [...mine].sort((a, b) => a.season_year - b.season_year)) {
    byYear.set(p.season_year, p);
  }

  const history: PlayerHistoryEntry[] = [];
  for (const [year, p] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const st = p.club_name ? stMap.get(`${year}|${p.club_name}`) : null;
    history.push({
      year,
      club: p.club_name,
      league: p.league,
      division: st?.module === "superleague" ? st.division_num ?? null : null,
      divisionLabel: st?.module === "national" ? st.division_label ?? null : null,
      module: st?.module === "superleague" || st?.module === "national" ? st.module : null,
      age: p.age,
      gls: p.gls,
      ast: p.ast,
      ca: p.ca,
      cp: p.cp,
      ra: p.ra,
      rm: p.rm,
      salary: p.salary,
      vp: p.vp,
    });
  }
  const totals = history.reduce(
    (acc, h) => ({ gls: acc.gls + h.gls, ast: acc.ast + h.ast, seasons: acc.seasons + 1 }),
    { gls: 0, ast: 0, seasons: 0 },
  );
  return { name: seed.name, idu: seed.idu, history, totals };
}

export function computePerformance(players: PlayerRow[]): PerformanceRow[] {
  const { keyOf } = buildPlayerKey(players);
  const deduped = dedupePreferSuperLeague(players, keyOf);
  const map = new Map<string, PerformanceRow>();
  const sorted = [...deduped].sort((a, b) => a.season_year - b.season_year);
  for (const p of sorted) {
    const key = keyOf(p);
    const row = map.get(key) ?? { name: p.name, club: "", league: "", age: null, gls: 0, ast: 0, total: 0, salary: 0, vp: 0 };
    row.gls += p.gls;
    row.ast += p.ast;
    row.total = row.gls + row.ast;
    if (p.club_name) row.club = p.club_name;
    if (p.league) row.league = p.league;
    if (p.age) row.age = p.age;
    if (p.salary) row.salary = p.salary;
    if (p.vp) row.vp = p.vp;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
