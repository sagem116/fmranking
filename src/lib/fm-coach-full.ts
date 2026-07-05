// Loader for the full v2 coach payload — the `coaches` table (personality,
// tactical style, formations, RM/RC/CA/CP, ...) and per-season records in
// `coach_assignments` (salary, intl_salary, club, country, roles).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CoachAttributesRow {
  id: string;
  name: string;
  nationality: string | null;
  idu: string | null;
  age: number | null;
  tactical_style: string | null;
  play_style: string | null;
  attacking_formation: string | null;
  defensive_formation: string | null;
  preferred_formation: string | null;
  secondary_formation: string | null;
  mentality: string | null;
  marking_type: string | null;
  pressing_type: string | null;
  training_type: string | null;
  personality: string | null;
  press_relationship: string | null;
  rm: number | null;
  rc: number | null;
  ca: number | null;
  cp: number | null;
  is_national_team: boolean | null;
  national_team: string | null;
}

export interface CoachAssignmentRow {
  season_id: string;
  season_year?: number | null;
  module: string;
  coach_name: string;
  club_name: string | null;
  country_name: string | null;
  club_role: string | null;
  intl_role: string | null;
  salary: number | null;
  intl_salary: number | null;
  rm: number | null;
  rc: number | null;
  ca: number | null;
  cp: number | null;
}

export interface CoachFullData {
  coach: CoachAttributesRow | null;
  assignments: CoachAssignmentRow[];
}

export async function fetchCoachFullData(name: string): Promise<CoachFullData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ data: coachData }, { data: seasons }, { data: assignments }] = await Promise.all([
    sb.from("coaches").select("*").eq("name", name).maybeSingle(),
    sb.from("seasons").select("id, year"),
    sb
      .from("coach_assignments")
      .select("season_id, module, coach_name, club_name, country_name, club_role, intl_role, salary, intl_salary, rm, rc, ca, cp")
      .eq("coach_name", name),
  ]);
  const yearById = new Map<string, number>();
  for (const s of (seasons ?? []) as Array<{ id: string; year: number }>) yearById.set(s.id, s.year);
  const enriched: CoachAssignmentRow[] = ((assignments ?? []) as CoachAssignmentRow[])
    .map((a) => ({ ...a, season_year: yearById.get(a.season_id) ?? null }))
    .sort((a, b) => (b.season_year ?? 0) - (a.season_year ?? 0));
  return { coach: (coachData as CoachAttributesRow | null) ?? null, assignments: enriched };
}

export function useCoachFullData(name: string) {
  return useQuery({
    queryKey: ["coach-full", name],
    queryFn: () => fetchCoachFullData(name),
    staleTime: 60 * 60 * 1000,
    enabled: !!name,
  });
}
