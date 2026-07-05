// Manual reputation per competition, persisted in Supabase
// (table public.competition_reputation) with a localStorage cache so the
// rest of the app can read synchronously without firing extra queries.
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "fm-competition-reputation-cache-v1";
const EVT = "fm:competition-reputation-changed";

export type CompReputationMap = Record<string, number>;

function readCache(): CompReputationMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CompReputationMap) : {};
  } catch {
    return {};
  }
}

function writeCache(map: CompReputationMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* noop */
  }
}

export function loadCompetitionReputationsSync(): CompReputationMap {
  return readCache();
}

export async function loadCompetitionReputations(): Promise<CompReputationMap> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("competition_reputation")
    .select("competition, reputation");
  if (error) {
    // fall back to cache (offline or first run)
    return readCache();
  }
  const map: CompReputationMap = {};
  for (const r of (data ?? []) as Array<{ competition: string; reputation: number }>) {
    map[r.competition] = Number(r.reputation);
  }
  writeCache(map);
  return map;
}

export async function setCompetitionReputation(competition: string, reputation: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("competition_reputation")
    .upsert({ competition, reputation });
  if (error) throw new Error(error.message);
  const next = { ...readCache(), [competition]: reputation };
  writeCache(next);
}

export async function deleteCompetitionReputation(competition: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("competition_reputation")
    .delete()
    .eq("competition", competition);
  if (error) throw new Error(error.message);
  const cur = readCache();
  delete cur[competition];
  writeCache(cur);
}

export function onCompetitionReputationChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}

// ---- Full per-season rows (with country/continent) ----------------------
export interface CompReputationSeasonRow {
  competition: string;
  season_year: number | null;
  reputation: number;
  country: string | null;
  continent: string | null;
}

export async function loadCompetitionReputationRows(): Promise<CompReputationSeasonRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("competition_reputation")
    .select("competition, season_year, reputation, country, continent");
  if (error) return [];
  return (data ?? []) as CompReputationSeasonRow[];
}