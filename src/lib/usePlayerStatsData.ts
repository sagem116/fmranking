import { useQuery } from "@tanstack/react-query";
import { fetchAllPlayerStats, fetchAllCompetitionStats } from "./fm-player-stats-db";
import { buildClubMap } from "./fm-club-map";
import { fetchClubMapSources } from "./fm-club-map-db";

export function usePlayerStatsData() {
  return useQuery({
    queryKey: ["player-stats-all"],
    queryFn: async () => {
      const [players, competitions, mapSources] = await Promise.all([
        fetchAllPlayerStats(),
        fetchAllCompetitionStats(),
        fetchClubMapSources(),
      ]);
      // SSOT: clubMap is built EXCLUSIVELY from Importar Época standings.
      // Player rows are passed only so the map can report unmapped clubs.
      const clubMap = buildClubMap(mapSources, players);
      return { players, competitions, clubMap };
    },
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
}
