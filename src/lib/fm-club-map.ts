// Per-season canonical club → competition/division/country mapping.
// SINGLE SOURCE OF TRUTH: the mapping is built EXCLUSIVELY from
// `Importar Época` (standings of Super Leagues + Ligas Nacionais) that
// live in the `standings` Supabase table. It is NEVER inferred from
// player rows (Importar Jogadores & Competições). This preserves loan
// players and prevents a club from being reclassified because one of
// its players appeared on another competition's player sheet.
//
// Includes a lightweight ClubID system so alternate names can later be
// merged onto the same canonical identity.

import type { CompType, PlayerStatRow } from "./fm-player-stats-db";

export type ClubMapSource = "superleague" | "national" | "override";

export interface ClubMapping {
  clubId: string;
  club: string;
  competition: string;
  division: string | null;
  country: string | null;
  comp_type: CompType;
  source: ClubMapSource;
  season_year: number;
  players: number;
}

/**
 * A single row from `Importar Época` used to feed the map.
 * Produced by `fm-club-map-db.ts` from the `standings` table.
 */
export interface ClubMapSourceRow {
  season_year: number;
  club: string;
  /** Competition display name (e.g. "Super League D1" or "Premier League"). */
  competition: string;
  /** Numeric/label division for superleague; null for national. */
  division: string | null;
  country: string | null;
  comp_type: "superleague" | "national";
}

export interface ClubMap {
  /** season_year → (clubName → ClubMapping) */
  bySeason: Map<number, Map<string, ClubMapping>>;
  /** Latest known mapping per club across all seasons (used as fallback UI) */
  latest: Map<string, ClubMapping>;
  /** All conflicts encountered (same club, same season, >1 mapping) */
  conflicts: Array<{ season: number; club: string; candidates: ClubMapping[] }>;
  /** Clubs referenced by player rows without any (season, club) mapping */
  unmapped: Set<string>;
  /** Player-count per club (across all seasons) — from player rows */
  playersByClub: Map<string, number>;
  /** Last season each club appears in player rows — from player rows */
  lastSeenByClub: Map<string, number>;
  /** Distinct club → clubId (canonical) */
  clubIds: Map<string, string>;
}

// ---- ClubID overrides ---------------------------------------------------

const ALIAS_KEY = "fm-club-name-aliases-v2"; // { alias: canonical }
const MANUAL_MAP_KEY = "fm-club-manual-map-v1"; // { "season|club": ClubMapping }

function readJSON<T>(key: string, def: T): T {
  if (typeof window === "undefined") return def;
  try { const s = window.localStorage.getItem(key); return s ? (JSON.parse(s) as T) : def; }
  catch { return def; }
}
function writeJSON(key: string, v: unknown) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

export function getClubAliasMap(): Record<string, string> {
  return readJSON<Record<string, string>>(ALIAS_KEY, {});
}
export function setClubAlias(alias: string, canonical: string) {
  const map = getClubAliasMap();
  map[alias.trim()] = canonical.trim();
  writeJSON(ALIAS_KEY, map);
}
export function removeClubAlias(alias: string) {
  const map = getClubAliasMap();
  delete map[alias];
  writeJSON(ALIAS_KEY, map);
}

export function getManualClubMappings(): Record<string, ClubMapping> {
  return readJSON<Record<string, ClubMapping>>(MANUAL_MAP_KEY, {});
}
export function setManualClubMapping(season: number, club: string, mapping: ClubMapping) {
  const map = getManualClubMappings();
  map[`${season}|${club}`] = { ...mapping, source: "override" };
  writeJSON(MANUAL_MAP_KEY, map);
}
export function removeManualClubMapping(season: number, club: string) {
  const map = getManualClubMappings();
  delete map[`${season}|${club}`];
  writeJSON(MANUAL_MAP_KEY, map);
}

function canonicalClub(name: string, aliases: Record<string, string>): string {
  return aliases[name.trim()] ?? name.trim();
}

function makeClubId(name: string): string {
  // Deterministic slug so the same club always maps to the same ID across
  // sessions and users (no random UUIDs — those would break SSR + storage).
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `club-${slug}`;
}

/**
 * Build the per-season club map from `Importar Época` standings sources.
 * `playerRows` is optional and used ONLY to report which player clubs are
 * missing from the map (never to create or alter mappings).
 *
 * Precedence:
 *   1. Manual overrides (highest)
 *   2. National-league standings
 *   3. Super League standings
 */
export function buildClubMap(
  sources: ClubMapSourceRow[],
  playerRows: PlayerStatRow[] = [],
): ClubMap {
  const aliases = getClubAliasMap();
  const manual = getManualClubMappings();

  const bySeason = new Map<number, Map<string, ClubMapping>>();
  const conflictsMap = new Map<string, ClubMapping[]>();
  const playersByClub = new Map<string, number>();
  const lastSeenByClub = new Map<string, number>();
  const clubIds = new Map<string, string>();

  function idFor(name: string): string {
    let id = clubIds.get(name);
    if (!id) { id = makeClubId(name); clubIds.set(name, id); }
    return id;
  }

  // Count players + last-seen strictly from the PLAYER rows (for the debug page).
  for (const r of playerRows) {
    if (!r.club) continue;
    const club = canonicalClub(r.club, aliases);
    playersByClub.set(club, (playersByClub.get(club) ?? 0) + 1);
    const prev = lastSeenByClub.get(club) ?? 0;
    if (r.season_year > prev) lastSeenByClub.set(club, r.season_year);
    idFor(club);
  }

  // Gather mapping candidates strictly from `Importar Época` sources.
  for (const r of sources) {
    if (!r.club) continue;
    const club = canonicalClub(r.club, aliases);
    const mapping: ClubMapping = {
      clubId: idFor(club),
      club,
      competition: r.competition,
      division: r.division ?? (r.comp_type === "superleague" ? r.competition : null),
      country: r.country,
      comp_type: r.comp_type,
      source: r.comp_type,
      season_year: r.season_year,
      players: 0,
    };
    let seasonMap = bySeason.get(r.season_year);
    if (!seasonMap) { seasonMap = new Map(); bySeason.set(r.season_year, seasonMap); }
    const existing = seasonMap.get(club);
    if (!existing) {
      seasonMap.set(club, mapping);
    } else {
      const same =
        existing.competition === mapping.competition &&
        existing.comp_type === mapping.comp_type &&
        (existing.country ?? "") === (mapping.country ?? "");
      if (!same) {
        const ck = `${r.season_year}|${club}`;
        const list = conflictsMap.get(ck) ?? [existing];
        if (!list.some((c) => c.competition === mapping.competition && c.comp_type === mapping.comp_type)) {
          list.push(mapping);
        }
        conflictsMap.set(ck, list);
        // Prefer national over superleague when both exist
        if (mapping.comp_type === "national" && existing.comp_type !== "national") {
          seasonMap.set(club, mapping);
        }
      }
    }
  }

  // Apply manual overrides (highest priority — no conflict flag)
  for (const [key, m] of Object.entries(manual)) {
    const [ys, club] = key.split("|");
    const y = Number(ys);
    if (!Number.isFinite(y) || !club) continue;
    let seasonMap = bySeason.get(y);
    if (!seasonMap) { seasonMap = new Map(); bySeason.set(y, seasonMap); }
    seasonMap.set(club, { ...m, source: "override" });
    clubIds.set(club, m.clubId || idFor(club));
  }

  // Fill player counts per (season, club) — from player rows only.
  for (const [season, sm] of bySeason) {
    for (const [club, m] of sm) {
      let n = 0;
      for (const r of playerRows) {
        if (!r.club) continue;
        if (r.season_year !== season) continue;
        if (canonicalClub(r.club, aliases) !== club) continue;
        n++;
      }
      m.players = n;
    }
  }

  // Latest mapping per club (for UI fallback)
  const latest = new Map<string, ClubMapping>();
  const seasonsDesc = [...bySeason.keys()].sort((a, b) => b - a);
  for (const y of seasonsDesc) {
    for (const [club, m] of bySeason.get(y)!) {
      if (!latest.has(club)) latest.set(club, m);
    }
  }

  // Unmapped: clubs seen in a player row that have zero mapping for the SAME
  // season (per-season strict). We also collect the seasons in which they miss.
  const unmapped = new Set<string>();
  for (const r of playerRows) {
    if (!r.club) continue;
    const club = canonicalClub(r.club, aliases);
    const sm = bySeason.get(r.season_year);
    if (!sm?.has(club)) unmapped.add(club);
  }

  const conflicts = [...conflictsMap.entries()].map(([k, list]) => {
    const [y, c] = k.split("|");
    return { season: Number(y), club: c, candidates: list };
  });

  return { bySeason, latest, conflicts, unmapped, playersByClub, lastSeenByClub, clubIds };
}

/**
 * Resolve a (season, club) pair against the map.
 * STRICT MODE: returns null if the club is not mapped for the requested season.
 * The `latest` fallback is used ONLY for UI display when strict=false.
 */
export function resolveClub(
  club: string | null | undefined,
  season: number | null | undefined,
  map: ClubMap,
  opts: { strict?: boolean; fallback?: Partial<ClubMapping> } = {},
): ClubMapping | null {
  if (!club) return null;
  const aliases = getClubAliasMap();
  const canon = canonicalClub(club, aliases);
  if (season != null) {
    const sm = map.bySeason.get(season);
    const m = sm?.get(canon);
    if (m) return m;
  }
  if (opts.strict) return null;
  const latest = map.latest.get(canon);
  if (latest) return latest;
  const fallback = opts.fallback;
  if (fallback && (fallback.competition || fallback.country)) {
    return {
      clubId: map.clubIds.get(canon) ?? makeClubId(canon),
      club: canon,
      competition: fallback.competition ?? "",
      division: fallback.division ?? null,
      country: fallback.country ?? null,
      comp_type: (fallback.comp_type ?? "national") as CompType,
      source: "override",
      season_year: season ?? 0,
      players: 0,
    };
  }
  return null;
}

/** True if a season has any club mapping. Used to validate player-stats imports. */
export function hasSeasonMapping(map: ClubMap, season: number): boolean {
  const sm = map.bySeason.get(season);
  return !!sm && sm.size > 0;
}

/** True if a specific (season, club) pair is present. Strict per-season check. */
export function isClubMapped(map: ClubMap, club: string, season: number): boolean {
  const aliases = getClubAliasMap();
  const canon = canonicalClub(club, aliases);
  return !!map.bySeason.get(season)?.has(canon);
}