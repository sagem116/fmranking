// Fetches the Single Source of Truth for the club map from Supabase.
// Sources are STRICTLY the `standings` rows produced by `Importar Época`
// (Super Leagues + Ligas Nacionais). Player-stat uploads never contribute.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCountry } from "./fm-continents";
import type { ClubMapSourceRow } from "./fm-club-map";

async function fetchAllRows<T>(table: string, select: string): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => { select: (s: string) => { range: (a: number, b: number) => Promise<{ data: T[] | null; error: unknown }> } };
    }).from(table).select(select).range(from, to);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export async function fetchClubMapSources(): Promise<ClubMapSourceRow[]> {
  const [seasons, clubs, countries, standings] = await Promise.all([
    fetchAllRows<{ id: string; year: number }>("seasons", "id,year"),
    fetchAllRows<{ name: string; country_id: string | null }>("clubs", "name,country_id"),
    fetchAllRows<{ id: string; name: string }>("countries", "id,name"),
    fetchAllRows<{
      season_id: string; module: string; division_num: number | null;
      division_label: string | null; competition: string | null; club_name: string;
    }>("standings", "season_id,module,division_num,division_label,competition,club_name"),
  ]);

  const seasonMap = new Map(seasons.map((s) => [s.id, s.year]));
  const countryById = new Map(countries.map((c) => [c.id, c.name]));
  const clubCountry: Record<string, string | null> = {};
  for (const c of clubs) {
    clubCountry[c.name] = c.country_id ? normalizeCountry(countryById.get(c.country_id) ?? null) : null;
  }

  // National-league country inference from dominant country per league label
  // (used only as a fallback for clubs missing from the Clube Pais SSOT).
  const leagueCountryCount = new Map<string, Map<string, number>>();
  for (const s of standings) {
    if (s.module !== "national" || !s.division_label) continue;
    const c = clubCountry[s.club_name];
    if (!c) continue;
    let inner = leagueCountryCount.get(s.division_label);
    if (!inner) { inner = new Map(); leagueCountryCount.set(s.division_label, inner); }
    inner.set(c, (inner.get(c) ?? 0) + 1);
  }
  const leagueCountry = new Map<string, string>();
  for (const [label, counts] of leagueCountryCount) {
    let best: string | null = null; let bestN = 0;
    for (const [c, n] of counts) if (n > bestN) { best = c; bestN = n; }
    if (best) leagueCountry.set(label, best);
  }

  const rows: ClubMapSourceRow[] = [];
  for (const s of standings) {
    if (s.module !== "superleague" && s.module !== "national") continue;
    const season_year = seasonMap.get(s.season_id) ?? 0;
    if (!season_year) continue;
    // Prefer the new "Competição" column from Excel; fall back to division_label / D<n>.
    const competition = s.competition
      ?? s.division_label
      ?? (s.module === "superleague" && s.division_num != null ? `D${s.division_num}` : "");
    if (!competition) continue;
    const country =
      clubCountry[s.club_name] ??
      (s.module === "national" && s.division_label ? leagueCountry.get(s.division_label) ?? null : null);
    rows.push({
      season_year,
      club: s.club_name,
      competition,
      division: s.module === "superleague" ? competition : null,
      country,
      comp_type: s.module,
    });
  }
  return rows;
}

export function useClubMapSources() {
  return useQuery({
    queryKey: ["club-map-sources"],
    queryFn: fetchClubMapSources,
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}