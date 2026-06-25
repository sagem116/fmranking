import { createFileRoute } from "@tanstack/react-router";
import { LeagueStatsPage } from "@/components/LeagueStatsPage";

export const Route = createFileRoute("/super-league/estatisticas-divisoes")({
  head: () => ({
    meta: [
      { title: "Estatísticas Super League — FM World Rankings" },
      { name: "description", content: "Compara as divisões da Super League através de 15 rankings estatísticos: qualidade, finanças, ataque, defesa, paridade e mais." },
    ],
  }),
  component: () => (
    <LeagueStatsPage
      scope="superleague"
      title="Estatísticas Super League"
      intro="Cada divisão da Super League é tratada como uma liga independente. Alterna entre rankings, aplica filtros avançados e exporta os resultados."
    />
  ),
});
