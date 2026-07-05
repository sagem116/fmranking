import { supabase } from "@/integrations/supabase/client";
import type { PlayerStatRow, CompType } from "./fm-player-stats-parser";

export type { PlayerStatRow, CompType };

async function chunkInsert(table: string, rows: Record<string, unknown>[]) {
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(table).insert(slice);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function ensureSeasonId(seasonYear: number): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const existing = await sb.from("seasons").select("id").eq("year", seasonYear).maybeSingle();
  if (existing.error) throw new Error(`seasons lookup: ${existing.error.message}`);
  if (existing.data?.id) return existing.data.id as string;
  const ins = await sb.from("seasons").insert({ year: seasonYear, label: String(seasonYear) }).select("id").single();
  if (ins.error) throw new Error(`seasons insert: ${ins.error.message}`);
  return ins.data.id as string;
}

export async function logPlayerStatsImport(seasonYear: number, filename: string, warnings: unknown[] = []) {
  const seasonId = await ensureSeasonId(seasonYear);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("imports").insert({
    season_id: seasonId,
    module: "player_stats",
    filename,
    status: "ok",
    warnings,
  });
  if (error) throw new Error(`imports log: ${error.message}`);
}

export async function importPlayerStats(rows: PlayerStatRow[], seasonYear: number): Promise<{ inserted: number; types: CompType[] }> {
  const presentTypes = [...new Set(rows.map((r) => r.comp_type))];
  if (presentTypes.length === 0) return { inserted: 0, types: [] };

  // Replace existing data for the same (season, comp_type) combinations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const del = await (supabase as any)
    .from("player_stats")
    .delete()
    .eq("season_year", seasonYear)
    .in("comp_type", presentTypes);
  if (del.error) throw new Error(`player_stats delete: ${del.error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delAgg = await (supabase as any)
    .from("competition_stats")
    .delete()
    .eq("season_year", seasonYear)
    .in("comp_type", presentTypes);
  if (delAgg.error) throw new Error(`competition_stats delete: ${delAgg.error.message}`);

  await chunkInsert("player_stats", rows as unknown as Record<string, unknown>[]);

  // Recompute aggregates per (season, comp_type, competition)
  const aggMap = new Map<string, { row: Record<string, unknown>; n: number; sums: Record<string, number> }>();
  for (const r of rows) {
    const key = `${r.season_year}|${r.comp_type}|${r.competition}`;
    let entry = aggMap.get(key);
    if (!entry) {
      entry = {
        row: {
          season_year: r.season_year,
          comp_type: r.comp_type,
          competition: r.competition,
          country: r.country,
          continent: r.continent,
        },
        n: 0,
        sums: { ca: 0, cp: 0, vp: 0, salary: 0, ra: 0, rm: 0, rc: 0, age: 0 },
      };
      aggMap.set(key, entry);
    }
    entry.n++;
    entry.sums.ca += r.ca;
    entry.sums.cp += r.cp;
    entry.sums.vp += r.vp;
    entry.sums.salary += r.salary;
    entry.sums.ra += r.ra;
    entry.sums.rm += r.rm;
    entry.sums.rc += r.rc;
    entry.sums.age += r.age;
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
    });
  }
  if (aggRows.length) await chunkInsert("competition_stats", aggRows);

  return { inserted: rows.length, types: presentTypes };
}

export async function fetchAllPlayerStats(): Promise<PlayerStatRow[]> {
  const pageSize = 1000;
  const out: PlayerStatRow[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("player_stats")
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`player_stats: ${error.message}`);
    const rows = (data ?? []) as PlayerStatRow[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += rows.length;
  }
  return out;
}

export interface CompetitionStatRow {
  id?: string;
  season_year: number;
  comp_type: CompType;
  competition: string;
  country: string | null;
  continent: string | null;
  n_players: number;
  ca_avg: number;
  cp_avg: number;
  vp_avg: number;
  salary_avg: number;
  ra_avg: number;
  rm_avg: number;
  rc_avg: number;
  age_avg: number;
  // Averages of the new v2 metrics (may be absent on legacy rows)
  xg_avg?: number | null;
  pass_pct_avg?: number | null;
  tackles_per90_avg?: number | null;
  fouls_per90_avg?: number | null;
  shot_pct_avg?: number | null;
  yellows_avg?: number | null;
  reds_avg?: number | null;
  avg_rating_avg?: number | null;
}

export async function fetchAllCompetitionStats(): Promise<CompetitionStatRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("competition_stats").select("*");
  if (error) throw new Error(`competition_stats: ${error.message}`);
  return (data ?? []) as CompetitionStatRow[];
}
