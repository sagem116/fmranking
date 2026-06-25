import { createFileRoute } from "@tanstack/react-router";
import { LeagueStatsPage } from "@/components/LeagueStatsPage";

export const Route = createFileRoute("/national/estatisticas-ligas")({
  head: () => ({
    meta: [
      { title: "Estatísticas Ligas Nacionais — FM World Rankings" },
      { name: "description", content: "Compara todas as ligas nacionais através de 15 rankings: qualidade global, técnica, financeira, paridade, dominância e mais." },
    ],
  }),
  component: () => (
    <LeagueStatsPage
      scope="national"
      title="Estatísticas Ligas Nacionais"
      intro="Compara todas as ligas nacionais através de múltiplos rankings estatísticos. Alterna entre rankings, aplica filtros avançados e exporta os resultados."
    />
  ),
});
