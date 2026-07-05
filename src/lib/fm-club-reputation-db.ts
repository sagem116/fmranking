// Loader for the per-season club reputation table (populated by the v2
// importer through the "Reputação Clubes" sheet).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClubReputationSeasonRow {
  club_name: string;
  season_year: number;
  reputation: number | null;
  avg_attendance: number | null;
  season_ticket_holders: number | null;
}

export async function fetchClubReputationHistory(clubName: string): Promise<ClubReputationSeasonRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("club_reputation_season")
    .select("club_name, season_year, reputation, avg_attendance, season_ticket_holders")
    .eq("club_name", clubName)
    .order("season_year", { ascending: true });
  if (error) return [];
  return (data ?? []) as ClubReputationSeasonRow[];
}

export function useClubReputationHistory(clubName: string) {
  return useQuery({
    queryKey: ["club-reputation-history", clubName],
    queryFn: () => fetchClubReputationHistory(clubName),
    staleTime: 60 * 60 * 1000,
    enabled: !!clubName,
  });
}
