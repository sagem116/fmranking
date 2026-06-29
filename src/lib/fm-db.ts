import { supabase } from "@/integrations/supabase/client";
import type { ParseResult } from "./fm-parser";
import type { StandingRow, ContinentalRow, CoachRow, InternationalRow } from "./fm-rankings";
import { normalizeCountry } from "./fm-continents";

// Supabase PostgREST caps each request (default 1000 rows). Paginate with .range()
// and advance by the actual returned length so we work regardless of the server cap.
async function fetchAllRows<T = Record<string, unknown>>(
  table: string,
  columns: string,
): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length === 0 || rows.length < pageSize) break;
    from += rows.length;
  }
  return out;
}

async function chunkInsert(table: string, rows: Record<string, unknown>[]) {
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(table).insert(slice);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export interface ImportSummary {
  seasonYear: number;
  module: string;
  standings: number;
  coaches: number;
  continental: number;
}

export async function importSeason(parse: ParseResult, year: number, filename: string): Promise<ImportSummary> {
  const module = parse.kind; // 'superleague' | 'national'

  // 1. Ensure season (never overwrite other seasons)
  let { data: season } = await supabase.from("seasons").select("id").eq("year", year).maybeSingle();
  if (!season) {
    const ins = await supabase.from("seasons").insert({ year, label: String(year) }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    season = ins.data;
  }
  const seasonId = season!.id;

  // 2. Re-import of same module+season: clear that slice only
  await supabase.from("standings").delete().eq("season_id", seasonId).eq("module", module);
  await supabase.from("coach_assignments").delete().eq("season_id", seasonId).eq("module", module);
  if (module === "national") {
    await supabase.from("continental_results").delete().eq("season_id", seasonId);
    await supabase.from("international_results").delete().eq("season_id", seasonId);
  }
  await supabase.from("players").delete().eq("season_id", seasonId).eq("module", module);

  // 3. Upsert countries
  const countryNames = [...new Set(parse.data.teamCountry.map((t) => t.country).filter(Boolean) as string[])];
  if (countryNames.length) {
    await supabase.from("countries").upsert(countryNames.map((name) => ({ name })), { onConflict: "name" });
  }
  const { data: countryRows } = await supabase.from("countries").select("id,name");
  const countryMap = new Map((countryRows ?? []).map((c) => [c.name, c.id]));

  // 4. Upsert clubs (from teamCountry + standings + continental)
  const clubNames = new Set<string>();
  parse.data.teamCountry.forEach((t) => clubNames.add(t.club));
  parse.data.standings.forEach((s) => clubNames.add(s.club_name));
  parse.data.continental.forEach((c) => {
    if (c.team1) clubNames.add(c.team1);
    if (c.team2) clubNames.add(c.team2);
    [c.sf1, c.sf2, c.qf1, c.qf2, c.qf3, c.qf4].forEach((n) => { if (n) clubNames.add(n); });
  });
  parse.data.players.forEach((p) => { if (p.club_name) clubNames.add(p.club_name); });
  const clubCountryLookup = new Map(parse.data.teamCountry.map((t) => [t.club, t.country]));
  const clubPayload = [...clubNames].map((name) => {
    const country = clubCountryLookup.get(name);
    const cid = country ? countryMap.get(country) : undefined;
    return cid ? { name, country_id: cid } : { name };
  });
  if (clubPayload.length) {
    await supabase.from("clubs").upsert(clubPayload, { onConflict: "name", ignoreDuplicates: false });
  }
  const { data: clubRows } = await supabase.from("clubs").select("id,name");
  const clubMap = new Map((clubRows ?? []).map((c) => [c.name, c.id]));

  // 5. Standings
  const standingsPayload = parse.data.standings.map((s) => ({
    season_id: seasonId,
    module,
    division_label: s.division_label,
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
  await chunkInsert("standings", standingsPayload);

  // 6. Continental
  if (module === "national" && parse.data.continental.length) {
    const contPayload = parse.data.continental.map((c) => ({
      season_id: seasonId,
      competition: c.competition,
      team1: c.team1,
      team2: c.team2,
      result: c.result,
      club1_id: c.team1 ? clubMap.get(c.team1) ?? null : null,
      club2_id: c.team2 ? clubMap.get(c.team2) ?? null : null,
      winner_club_id: c.winner ? clubMap.get(c.winner) ?? null : null,
      sf1: c.sf1,
      sf2: c.sf2,
      qf1: c.qf1,
      qf2: c.qf2,
      qf3: c.qf3,
      qf4: c.qf4,
    }));
    await chunkInsert("continental_results", contPayload);
  }

  // 6b. International (national-team competitions)
  if (module === "national" && parse.data.international.length) {
    const intPayload = parse.data.international.map((c) => ({
      season_id: seasonId,
      competition: c.competition,
      team1: c.team1,
      team2: c.team2,
      coach1: c.coach1,
      coach2: c.coach2,
      result: c.result,
      winner: c.winner,
      sf1: c.sf1,
      sf1_coach: c.sf1_coach,
      sf2: c.sf2,
      sf2_coach: c.sf2_coach,
      qf1: c.qf1,
      qf1_coach: c.qf1_coach,
      qf2: c.qf2,
      qf2_coach: c.qf2_coach,
      qf3: c.qf3,
      qf3_coach: c.qf3_coach,
      qf4: c.qf4,
      qf4_coach: c.qf4_coach,
    }));
    await chunkInsert("international_results", intPayload);
  }


  // 7. Coaches + assignments
  const uniqueCoaches = new Map<string, { name: string; nationality: string | null }>();
  parse.data.coaches.forEach((c) => {
    uniqueCoaches.set(`${c.name}|${c.nationality ?? ""}`, { name: c.name, nationality: c.nationality });
  });
  if (uniqueCoaches.size) {
    await supabase.from("coaches").upsert([...uniqueCoaches.values()], { onConflict: "name,nationality" });
  }
  const { data: coachRows } = await supabase.from("coaches").select("id,name,nationality");
  const coachMap = new Map((coachRows ?? []).map((c) => [`${c.name}|${c.nationality ?? ""}`, c.id]));
  const assignPayload = parse.data.coaches
    .map((c) => {
      const coachId = coachMap.get(`${c.name}|${c.nationality ?? ""}`);
      if (!coachId) return null;
      return {
        season_id: seasonId,
        module,
        coach_id: coachId,
        coach_name: c.name,
        club_id: c.club_name ? clubMap.get(c.club_name) ?? null : null,
        club_name: c.club_name,
        info: c.info,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
  if (assignPayload.length) await chunkInsert("coach_assignments", assignPayload);

  // 7b. Players (snapshot — superleague & national)
  if (parse.data.players.length) {
    const playersPayload = parse.data.players.map((p) => ({
      season_id: seasonId,
      module,
      idu: p.idu,
      name: p.name,
      league: p.league,
      club_name: p.club_name,
      club_id: p.club_name ? clubMap.get(p.club_name) ?? null : null,
      age: p.age,
      gls: p.gls,
      ast: p.ast,
      salary: p.salary,
      ra: p.ra,
      rm: p.rm,
      ca: p.ca,
      cp: p.cp,
      vp: p.vp,
      info: p.info,
      rec: p.rec,
    }));
    await chunkInsert("players", playersPayload);
  }

  // 8. Import log
  await supabase.from("imports").insert({
    season_id: seasonId,
    module,
    filename,
    status: parse.blocked ? "blocked" : "ok",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warnings: parse.messages as any,
  });

  return {
    seasonYear: year,
    module,
    standings: standingsPayload.length,
    coaches: assignPayload.length,
    continental: module === "national" ? parse.data.continental.length : 0,
  };
}

export interface ImportLogRow {
  id: string;
  filename: string | null;
  module: "superleague" | "national" | "player_stats";
  status: string;
  created_at: string;
  season_id: string;
  season_year: number;
}

export async function fetchImports(): Promise<ImportLogRow[]> {
  const [{ data: imports }, { data: seasons }] = await Promise.all([
    supabase.from("imports").select("id,filename,module,status,created_at,season_id").order("created_at", { ascending: false }),
    supabase.from("seasons").select("id,year"),
  ]);
  const yearMap = new Map((seasons ?? []).map((s) => [s.id, s.year]));
  return (imports ?? []).map((i) => ({
    id: i.id,
    filename: i.filename,
    module: i.module as ImportLogRow["module"],
    status: i.status,
    created_at: i.created_at,
    season_id: i.season_id,
    season_year: yearMap.get(i.season_id) ?? 0,
  }));
}

export async function deleteImport(row: ImportLogRow): Promise<void> {
  // Remove the data slice for this season+module, then the import log entry.
  if (row.module === "player_stats") {
    await supabase.from("player_stats").delete().eq("season_year", row.season_year);
    await supabase.from("competition_stats").delete().eq("season_year", row.season_year);
  } else {
    await supabase.from("standings").delete().eq("season_id", row.season_id).eq("module", row.module);
    await supabase.from("coach_assignments").delete().eq("season_id", row.season_id).eq("module", row.module);
    if (row.module === "national") {
      await supabase.from("continental_results").delete().eq("season_id", row.season_id);
      await supabase.from("international_results").delete().eq("season_id", row.season_id);
    }
    if (row.module === "superleague") {
      await supabase.from("players").delete().eq("season_id", row.season_id);
    }
  }
  await supabase.from("imports").delete().eq("id", row.id);
}

export interface AllData {
  seasons: { id: string; year: number }[];
  standings: StandingRow[];
  continental: ContinentalRow[];
  international: InternationalRow[];
  coaches: CoachRow[];
  clubCountry: Record<string, string | null>;
  rawClubCountry: Record<string, string | null>;
  players: PlayerRow[];
}


export interface PlayerRow {
  season_year: number;
  module: "superleague" | "national";
  idu: string | null;
  name: string;
  league: string | null;
  club_name: string | null;
  age: number | null;
  gls: number;
  ast: number;
  salary: number;
  ra: number;
  rm: number;
  ca: number;
  cp: number;
  vp: number;
}

export async function fetchAllData(): Promise<AllData> {
  const [seasonsAll, clubsAll, countriesAll] = await Promise.all([
    fetchAllRows<{ id: string; year: number }>("seasons", "id,year"),
    fetchAllRows<{ name: string; country_id: string | null }>("clubs", "name,country_id"),
    fetchAllRows<{ id: string; name: string }>("countries", "id,name"),
  ]);
  const seasonMap = new Map(seasonsAll.map((s) => [s.id, s.year]));
  const countryById = new Map(countriesAll.map((c) => [c.id, c.name]));
  const clubCountry: Record<string, string | null> = {};
  clubsAll.forEach((c) => {
    clubCountry[c.name] = c.country_id ? normalizeCountry(countryById.get(c.country_id) ?? null) : null;
  });
  const rawClubCountry: Record<string, string | null> = { ...clubCountry };
  // Defer national-league country inference until after standings are loaded below.


  const [standings, continental, internationalRaw, coachAssign, playersRaw, clubIds, coachNat] = await Promise.all([
    fetchAllRows<Record<string, unknown>>(
      "standings",
      "season_id,module,division_num,division_label,position,club_name,is_champion,info,points,played,wins,draws,losses,gf,ga",
    ),

    fetchAllRows<Record<string, unknown>>(
      "continental_results",
      "season_id,competition,team1,team2,winner_club_id,sf1,sf2,qf1,qf2,qf3,qf4",
    ),
    fetchAllRows<Record<string, unknown>>(
      "international_results",
      "season_id,competition,team1,team2,coach1,coach2,winner,sf1,sf1_coach,sf2,sf2_coach,qf1,qf1_coach,qf2,qf2_coach,qf3,qf3_coach,qf4,qf4_coach",
    ),
    fetchAllRows<Record<string, unknown>>(
      "coach_assignments",
      "season_id,module,coach_name,club_name",
    ),
    fetchAllRows<Record<string, unknown>>(
      "players",
      "season_id,module,idu,name,league,club_name,age,gls,ast,salary,ra,rm,ca,cp,vp",
    ),
    fetchAllRows<{ id: string; name: string }>("clubs", "id,name"),
    fetchAllRows<{ name: string; nationality: string | null }>("coaches", "name,nationality"),
  ]);

  const clubIdName = new Map<string, string>();
  clubIds.forEach((c) => clubIdName.set(c.id, c.name));

  const coachNatMap = new Map<string, string | null>();
  coachNat.forEach((c) => { if (c.nationality) coachNatMap.set(c.name, normalizeCountry(c.nationality)); });

  const standingRows: StandingRow[] = standings.map((row) => {
    const s = row as Record<string, unknown> as {
      season_id: string; module: StandingRow["module"]; division_num: number;
      division_label?: string | null; position: number; club_name: string;
      is_champion: boolean; info: string | null; points?: number | null; played?: number | null;
      wins?: number | null; draws?: number | null; losses?: number | null;
      gf?: number | null; ga?: number | null;
    };
    return {
      season_year: seasonMap.get(s.season_id) ?? 0,
      module: s.module,
      division_num: s.division_num,
      division_label: s.division_label ?? null,
      position: s.position,
      club_name: s.club_name,
      is_champion: s.is_champion,
      info: s.info,
      points: s.points ?? null,
      played: s.played ?? null,
      wins: s.wins ?? null,
      draws: s.draws ?? null,
      losses: s.losses ?? null,
      gf: s.gf ?? null,
      ga: s.ga ?? null,
    };
  });

  const continentalRows: ContinentalRow[] = continental.map((row) => {
    const c = row as {
      season_id: string; competition: string;
      team1: string | null; team2: string | null; winner_club_id: string | null;
      sf1: string | null; sf2: string | null;
      qf1: string | null; qf2: string | null; qf3: string | null; qf4: string | null;
    };
    return {
      season_year: seasonMap.get(c.season_id) ?? 0,
      competition: c.competition,
      team1: c.team1,
      team2: c.team2,
      winner: c.winner_club_id ? clubIdName.get(c.winner_club_id) ?? null : null,
      sf1: c.sf1, sf2: c.sf2,
      qf1: c.qf1, qf2: c.qf2, qf3: c.qf3, qf4: c.qf4,
    };
  });
  const internationalRows: InternationalRow[] = internationalRaw.map((row) => {
    const c = row as {
      season_id: string;
      competition: string;
      team1: string | null;
      team2: string | null;
      coach1: string | null;
      coach2: string | null;
      winner: string | null;
      sf1: string | null; sf1_coach: string | null;
      sf2: string | null; sf2_coach: string | null;
      qf1: string | null; qf1_coach: string | null;
      qf2: string | null; qf2_coach: string | null;
      qf3: string | null; qf3_coach: string | null;
      qf4: string | null; qf4_coach: string | null;
    };
    return {
      season_year: seasonMap.get(c.season_id) ?? 0,
      competition: c.competition,
      team1: normalizeCountry(c.team1),
      team2: normalizeCountry(c.team2),
      coach1: c.coach1,
      coach2: c.coach2,
      winner: normalizeCountry(c.winner),
      sf1: normalizeCountry(c.sf1), sf1_coach: c.sf1_coach,
      sf2: normalizeCountry(c.sf2), sf2_coach: c.sf2_coach,
      qf1: normalizeCountry(c.qf1), qf1_coach: c.qf1_coach,
      qf2: normalizeCountry(c.qf2), qf2_coach: c.qf2_coach,
      qf3: normalizeCountry(c.qf3), qf3_coach: c.qf3_coach,
      qf4: normalizeCountry(c.qf4), qf4_coach: c.qf4_coach,
    };
  });
  const coachRows: CoachRow[] = coachAssign.map((row) => {
    const c = row as { season_id: string; module: CoachRow["module"]; coach_name: string; club_name: string | null };
    return {
      season_year: seasonMap.get(c.season_id) ?? 0,
      module: c.module,
      name: c.coach_name,
      nationality: coachNatMap.get(c.coach_name) ?? null,
      club_name: c.club_name,
    };
  });
  const playerRows: PlayerRow[] = playersRaw.map((row) => {
    const p = row as Record<string, unknown> as {
      season_id: string; module: PlayerRow["module"]; idu: string | null; name: string; league: string | null;
      club_name: string | null; age: number | null;
      gls: number; ast: number; salary: number; ra: number; rm: number; ca: number; cp: number; vp: number;
    };
    return {
      season_year: seasonMap.get(p.season_id) ?? 0,
      module: p.module,
      idu: p.idu,
      name: p.name,
      league: p.league,
      club_name: p.club_name,
      age: p.age,
      gls: Number(p.gls) || 0,
      ast: Number(p.ast) || 0,
      salary: Number(p.salary) || 0,
      ra: Number(p.ra) || 0,
      rm: Number(p.rm) || 0,
      ca: Number(p.ca) || 0,
      cp: Number(p.cp) || 0,
      vp: Number(p.vp) || 0,
    };
  });

  // Infer country for clubs in national leagues based on the dominant country
  // of clubs already mapped within the same division_label. This makes national
  // league results contribute to country rankings even when the imported file
  // did not include explicit country mappings for those clubs.
  const leagueCountryCount = new Map<string, Map<string, number>>();
  for (const s of standingRows) {
    if (s.module !== "national" || !s.division_label) continue;
    const country = clubCountry[s.club_name];
    if (!country) continue;
    let inner = leagueCountryCount.get(s.division_label);
    if (!inner) { inner = new Map(); leagueCountryCount.set(s.division_label, inner); }
    inner.set(country, (inner.get(country) ?? 0) + 1);
  }
  const leagueCountry = new Map<string, string>();
  for (const [label, counts] of leagueCountryCount) {
    let best: string | null = null; let bestN = 0;
    for (const [c, n] of counts) if (n > bestN) { best = c; bestN = n; }
    if (best) leagueCountry.set(label, best);
  }
  for (const s of standingRows) {
    if (s.module !== "national" || !s.division_label) continue;
    if (clubCountry[s.club_name]) continue;
    const inferred = leagueCountry.get(s.division_label);
    if (inferred) clubCountry[s.club_name] = inferred;
  }

  return {


    seasons: seasonsAll.map((s) => ({ id: s.id, year: s.year })),
    standings: standingRows,
    continental: continentalRows,
    international: internationalRows,
    coaches: coachRows,
    clubCountry,
    rawClubCountry,
    players: playerRows,

  };
}