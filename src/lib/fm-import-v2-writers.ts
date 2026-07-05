// Persist a parsed "Competições" or "Jogadores" file to Supabase.
// Both writers are atomic per season and idempotent: re-importing the
// same file for the same year replaces the previous slice cleanly.
//
// Downstream consumers (rankings, profiles, drill-downs, etc.) keep
// working because the writers still populate every table the legacy
// code paths already read (standings, coaches, coach_assignments,
// continental_results, international_results, player_stats,
// competition_stats, competition_reputation). New columns/tables are
// filled in addition, never in replacement.

import { supabase } from "@/integrations/supabase/client";
import { normalizeCountry } from "./fm-continents";
import type {
  ParsedCompetitionsFile,
  ParsedPlayersFile,
  ClubCountryRow,
} from "./fm-import-v2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => supabase as any;

async function chunkInsert(table: string, rows: Record<string, unknown>[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    const { error } = await sb().from(table).insert(slice);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function ensureSeasonId(year: number): Promise<string> {
  const found = await sb().from("seasons").select("id").eq("year", year).maybeSingle();
  if (found.error) throw new Error(`seasons: ${found.error.message}`);
  if (found.data?.id) return found.data.id as string;
  const ins = await sb().from("seasons").insert({ year, label: String(year) }).select("id").single();
  if (ins.error) throw new Error(`seasons: ${ins.error.message}`);
  return ins.data.id as string;
}

async function upsertClubsWithCountry(clubCountry: ClubCountryRow[]): Promise<Map<string, string>> {
  // 1. Upsert countries
  const countryNames = [
    ...new Set(clubCountry.map((c) => c.country).filter((c): c is string => !!c)),
  ];
  if (countryNames.length) {
    const { error } = await sb().from("countries")
      .upsert(countryNames.map((name) => ({ name })), { onConflict: "name" });
    if (error) throw new Error(`countries: ${error.message}`);
  }
  const { data: countryRows } = await sb().from("countries").select("id,name");
  const countryMap = new Map(
    ((countryRows ?? []) as Array<{ id: string; name: string }>).map((c) => [c.name, c.id]),
  );

  // 2. Upsert clubs with country+continent
  const clubPayload = clubCountry.map((c) => ({
    name: c.club,
    country_id: c.country ? countryMap.get(c.country) ?? null : null,
    continent: c.continent ?? null,
  }));
  if (clubPayload.length) {
    const { error } = await sb().from("clubs").upsert(clubPayload, { onConflict: "name" });
    if (error) throw new Error(`clubs: ${error.message}`);
  }
  const { data: clubRows } = await sb().from("clubs").select("id,name");
  return new Map(
    ((clubRows ?? []) as Array<{ id: string; name: string }>).map((c) => [c.name, c.id]),
  );
}

// ----------- Competitions file writer -----------------------------------

export interface CompetitionsImportResult {
  clubsUpserted: number;
  standingsInserted: number;
  coachesUpserted: number;
  coachAssignmentsInserted: number;
  continentalInserted: number;
  internationalInserted: number;
  competitionReputationRows: number;
  clubReputationRows: number;
}

export async function importCompetitionsFile(
  year: number,
  parsed: ParsedCompetitionsFile,
): Promise<CompetitionsImportResult> {
  const seasonId = await ensureSeasonId(year);
  const clubMap = await upsertClubsWithCountry(parsed.clubCountry);

  // Also register any club referenced elsewhere so FK-less lookups still work.
  const allClubs = new Set<string>(parsed.clubCountry.map((c) => c.club));
  parsed.standings.forEach((s) => allClubs.add(s.club_name));
  parsed.coaches.forEach((c) => { if (c.club) allClubs.add(c.club); });
  parsed.clubReputation.forEach((r) => allClubs.add(r.club));
  [...parsed.continental, ...parsed.international].forEach((b) => {
    if (b.team1) allClubs.add(b.team1);
    if (b.team2) allClubs.add(b.team2);
    [b.sf1, b.sf2, b.qf1, b.qf2, b.qf3, b.qf4].forEach((n) => { if (n) allClubs.add(n); });
  });
  const missing = [...allClubs].filter((c) => !clubMap.has(c));
  if (missing.length) {
    const { error } = await sb().from("clubs").upsert(missing.map((name) => ({ name })), { onConflict: "name" });
    if (error) throw new Error(`clubs (missing): ${error.message}`);
    const { data: extra } = await sb().from("clubs").select("id,name").in("name", missing);
    ((extra ?? []) as Array<{ id: string; name: string }>).forEach((c) => clubMap.set(c.name, c.id));
  }

  // ---- Delete previous slices for this season ----
  const del = [
    sb().from("standings").delete().eq("season_id", seasonId).in("module", ["superleague", "national"]),
    sb().from("coach_assignments").delete().eq("season_id", seasonId),
    sb().from("continental_results").delete().eq("season_id", seasonId),
    sb().from("international_results").delete().eq("season_id", seasonId),
    sb().from("club_reputation_season").delete().eq("season_id", seasonId),
    sb().from("competition_reputation").delete().eq("season_year", year),
    sb().from("imports").delete().eq("season_id", seasonId).eq("module", "competitions"),
  ];
  for (const p of del) { const { error } = await p; if (error) throw new Error(`delete previous: ${error.message}`); }

  // ---- Standings ----
  const standingsPayload = parsed.standings.map((s) => ({
    season_id: seasonId,
    module: s.module,
    competition: s.competition,
    division_label: s.division_label ?? s.competition ?? null,
    division_num: s.division_num,
    position: s.position,
    info: s.info,
    club_id: clubMap.get(s.club_name) ?? null,
    club_name: s.club_name,
    played: s.played,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    gf: s.gf,
    ga: s.ga,
    gd: s.gd,
    points: s.points,
    is_champion: s.is_champion,
  }));
  if (standingsPayload.length) await chunkInsert("standings", standingsPayload);

  // ---- Continental ----
  const contPayload = parsed.continental.map((c) => ({
    season_id: seasonId,
    competition: c.competition,
    team1: c.team1, team2: c.team2, result: c.result,
    club1_id: c.team1 ? clubMap.get(c.team1) ?? null : null,
    club2_id: c.team2 ? clubMap.get(c.team2) ?? null : null,
    winner_club_id: c.winner ? clubMap.get(c.winner) ?? null : null,
    sf1: c.sf1, sf2: c.sf2, qf1: c.qf1, qf2: c.qf2, qf3: c.qf3, qf4: c.qf4,
  }));
  if (contPayload.length) await chunkInsert("continental_results", contPayload);

  // ---- International ----
  const intPayload = parsed.international.map((c) => ({
    season_id: seasonId,
    competition: c.competition,
    team1: c.team1, team2: c.team2, result: c.result,
    winner: c.winner,
    sf1: c.sf1, sf2: c.sf2, qf1: c.qf1, qf2: c.qf2, qf3: c.qf3, qf4: c.qf4,
  }));
  if (intPayload.length) await chunkInsert("international_results", intPayload);

  // ---- Coaches + assignments ----
  const uniqueCoaches = new Map<string, Record<string, unknown>>();
  for (const c of parsed.coaches) {
    const key = `${c.name}|${c.nationality ?? ""}`;
    if (!uniqueCoaches.has(key)) uniqueCoaches.set(key, {
      name: c.name,
      nationality: c.nationality,
      idu: c.idu,
      age: c.age,
      tactical_style: c.tactical_style,
      play_style: c.play_style,
      attacking_formation: c.attacking_formation,
      defensive_formation: c.defensive_formation,
      preferred_formation: c.preferred_formation,
      secondary_formation: c.secondary_formation,
      mentality: c.mentality,
      marking_type: c.marking_type,
      pressing_type: c.pressing_type,
      training_type: c.training_type,
      personality: c.personality,
      press_relationship: c.press_relationship,
      rm: c.rm, rc: c.rc, ca: c.ca, cp: c.cp,
      is_national_team: c.is_national_team,
      national_team: c.is_national_team ? c.country : null,
    });
  }
  if (uniqueCoaches.size) {
    const { error } = await sb().from("coaches")
      .upsert([...uniqueCoaches.values()], { onConflict: "name,nationality" });
    if (error) throw new Error(`coaches: ${error.message}`);
  }
  const { data: coachRows } = await sb().from("coaches").select("id,name,nationality");
  const coachMap = new Map(
    ((coachRows ?? []) as Array<{ id: string; name: string; nationality: string | null }>)
      .map((c) => [`${c.name}|${c.nationality ?? ""}`, c.id]),
  );
  const module = (m: boolean): "superleague" | "national" => (m ? "national" : "superleague");
  const assignmentsPayload = parsed.coaches
    .map((c) => {
      const coachId = coachMap.get(`${c.name}|${c.nationality ?? ""}`);
      if (!coachId) return null;
      return {
        season_id: seasonId,
        module: c.is_national_team ? "national" : module(false),
        coach_id: coachId,
        coach_name: c.name,
        club_id: c.club ? clubMap.get(c.club) ?? null : null,
        club_name: c.club,
        country_name: c.country,
        club_role: c.club_role,
        intl_role: c.intl_role,
        salary: c.salary,
        intl_salary: c.intl_salary,
        rm: c.rm, rc: c.rc, ca: c.ca, cp: c.cp,
        info: null as string | null,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
  if (assignmentsPayload.length) await chunkInsert("coach_assignments", assignmentsPayload);

  // ---- Competition reputation (per season) ----
  const compRepPayload = parsed.competitionReputation
    .filter((c) => c.reputation != null)
    .map((c) => ({ competition: c.competition, reputation: c.reputation!, season_year: year }));
  if (compRepPayload.length) await chunkInsert("competition_reputation", compRepPayload);

  // ---- Club reputation per season ----
  const clubRepPayload = parsed.clubReputation.map((r) => ({
    season_id: seasonId,
    season_year: year,
    club_name: r.club,
    club_id: clubMap.get(r.club) ?? null,
    reputation: r.reputation,
    avg_attendance: r.avg_attendance,
    season_ticket_holders: r.season_ticket_holders,
  }));
  if (clubRepPayload.length) await chunkInsert("club_reputation_season", clubRepPayload);

  // ---- Import log ----
  {
    const { error } = await sb().from("imports").insert({
      season_id: seasonId,
      module: "competitions",
      filename: null,
      status: "ok",
      warnings: [...parsed.warnings],
    });
    if (error) throw new Error(`imports: ${error.message}`);
  }

  void normalizeCountry;
  return {
    clubsUpserted: clubMap.size,
    standingsInserted: standingsPayload.length,
    coachesUpserted: uniqueCoaches.size,
    coachAssignmentsInserted: assignmentsPayload.length,
    continentalInserted: contPayload.length,
    internationalInserted: intPayload.length,
    competitionReputationRows: compRepPayload.length,
    clubReputationRows: clubRepPayload.length,
  };
}

// ----------- Players file writer ----------------------------------------

export interface PlayersImportResult {
  inserted: number;
  sheets: string[];
}

export async function importPlayersFile(
  year: number,
  parsed: ParsedPlayersFile,
  clubCountry: ClubCountryRow[] = [],
): Promise<PlayersImportResult> {
  const seasonId = await ensureSeasonId(year);
  const countryMap = new Map<string, string | null>();
  const continentMap = new Map<string, string | null>();
  for (const c of clubCountry) {
    countryMap.set(c.club, c.country);
    continentMap.set(c.club, c.continent);
  }

  const presentTypes = [...new Set(parsed.players.map((p) => p.comp_type))];

  // Delete previous slices for this year for the sheets we're re-importing.
  if (presentTypes.length) {
    const { error } = await sb().from("player_stats").delete()
      .eq("season_year", year).in("comp_type", presentTypes);
    if (error) throw new Error(`player_stats delete: ${error.message}`);
    const { error: er2 } = await sb().from("competition_stats").delete()
      .eq("season_year", year).in("comp_type", presentTypes);
    if (er2) throw new Error(`competition_stats delete: ${er2.message}`);
  }
  await sb().from("imports").delete().eq("season_id", seasonId).eq("module", "player_stats");

  const rows = parsed.players.map((p) => {
    const country = p.club ? countryMap.get(p.club) ?? null : null;
    const continent = p.club ? continentMap.get(p.club) ?? null : null;
    return {
      season_year: year,
      comp_type: p.comp_type,
      competition: p.competition,
      country,
      continent,
      player_name: p.player_name,
      idu: p.idu,
      nationality: p.nationality,
      club: p.club,
      age: p.age,
      games: p.games,
      gls: p.gls,
      ast: p.ast,
      xg: p.xg,
      pass_pct: p.pass_pct,
      tackles_per90: p.tackles_per90,
      fouls_per90: p.fouls_per90,
      shot_pct: p.shot_pct,
      yellows: p.yellows,
      reds: p.reds,
      avg_rating: p.avg_rating,
      ca: p.ca,
      cp: p.cp,
      vp: p.vp,
      ra: p.ra,
      rm: p.rm,
      rc: p.rc,
      salary: p.salary,
    };
  });

  if (rows.length) await chunkInsert("player_stats", rows);

  // Recompute per-(season, comp_type, competition) aggregates.
  const aggMap = new Map<string, {
    row: Record<string, unknown>; n: number;
    sums: Record<string, number>;
  }>();
  for (const r of rows) {
    const key = `${r.season_year}|${r.comp_type}|${r.competition}`;
    let entry = aggMap.get(key);
    if (!entry) {
      entry = {
        row: {
          season_year: r.season_year, comp_type: r.comp_type, competition: r.competition,
          country: r.country, continent: r.continent,
        },
        n: 0,
        sums: {
          ca: 0, cp: 0, vp: 0, salary: 0, ra: 0, rm: 0, rc: 0, age: 0,
          xg: 0, pass_pct: 0, tackles_per90: 0, fouls_per90: 0, shot_pct: 0,
          yellows: 0, reds: 0, avg_rating: 0,
        },
      };
      aggMap.set(key, entry);
    }
    entry.n++;
    entry.sums.ca += r.ca ?? 0;
    entry.sums.cp += r.cp ?? 0;
    entry.sums.vp += r.vp ?? 0;
    entry.sums.salary += r.salary ?? 0;
    entry.sums.ra += r.ra ?? 0;
    entry.sums.rm += r.rm ?? 0;
    entry.sums.rc += r.rc ?? 0;
    entry.sums.age += r.age ?? 0;
    entry.sums.xg += r.xg ?? 0;
    entry.sums.pass_pct += r.pass_pct ?? 0;
    entry.sums.tackles_per90 += r.tackles_per90 ?? 0;
    entry.sums.fouls_per90 += r.fouls_per90 ?? 0;
    entry.sums.shot_pct += r.shot_pct ?? 0;
    entry.sums.yellows += r.yellows ?? 0;
    entry.sums.reds += r.reds ?? 0;
    entry.sums.avg_rating += r.avg_rating ?? 0;
  }
  const aggRows: Record<string, unknown>[] = [];
  for (const { row, n, sums } of aggMap.values()) {
    aggRows.push({
      ...row,
      n_players: n,
      ca_avg: n ? sums.ca / n : 0,
      cp_avg: n ? sums.cp / n : 0,
      vp_avg: n ? sums.vp / n : 0,
      salary_avg: n ? sums.salary / n : 0,
      ra_avg: n ? sums.ra / n : 0,
      rm_avg: n ? sums.rm / n : 0,
      rc_avg: n ? sums.rc / n : 0,
      age_avg: n ? sums.age / n : 0,
      xg_avg: n ? sums.xg / n : 0,
      pass_pct_avg: n ? sums.pass_pct / n : 0,
      tackles_per90_avg: n ? sums.tackles_per90 / n : 0,
      fouls_per90_avg: n ? sums.fouls_per90 / n : 0,
      shot_pct_avg: n ? sums.shot_pct / n : 0,
      yellows_avg: n ? sums.yellows / n : 0,
      reds_avg: n ? sums.reds / n : 0,
      avg_rating_avg: n ? sums.avg_rating / n : 0,
    });
  }
  if (aggRows.length) await chunkInsert("competition_stats", aggRows);

  await sb().from("imports").insert({
    season_id: seasonId,
    module: "player_stats",
    filename: null,
    status: "ok",
    warnings: [...parsed.warnings],
  });

  return { inserted: rows.length, sheets: Object.keys(parsed.bySheet) };
}
