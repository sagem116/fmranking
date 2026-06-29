import { useQuery } from "@tanstack/react-query";
import { fetchAllPlayerStats, fetchAllCompetitionStats } from "./fm-player-stats-db";

export function usePlayerStatsData() {
  return useQuery({
    queryKey: ["player-stats-all"],
    queryFn: async () => {
      const [players, competitions] = await Promise.all([
        fetchAllPlayerStats(),
        fetchAllCompetitionStats(),
      ]);
      return { players, competitions };
    },
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
}
