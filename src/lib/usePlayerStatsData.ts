import { useQuery } from "@tanstack/react-query";
import { fetchAllPlayerStats, fetchAllCompetitionStats } from "./fm-player-stats-db";
import { buildClubMap } from "./fm-club-map";

export function usePlayerStatsData() {
  return useQuery({
    queryKey: ["player-stats-all"],
    queryFn: async () => {
      const [players, competitions] = await Promise.all([
        fetchAllPlayerStats(),
        fetchAllCompetitionStats(),
      ]);
      const clubMap = buildClubMap(players);
      return { players, competitions, clubMap };
    },
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
}
