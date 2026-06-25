import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Goal } from "lucide-react";
import { useRankings } from "@/lib/useRankings";
import { computeCoachPlayoffs } from "@/lib/fm-superleague";
import { PlayoffTable } from "@/components/SuperLeagueTables";
import { SuperLeagueHeader } from "@/components/SuperLeagueHeader";

export const Route = createFileRoute("/super-league/play-off-treinadores")({
  head: () => ({
    meta: [
      { title: "Play-Off Treinadores (Super League) — FM World Rankings" },
      { name: "description", content: "Treinadores da Super League em quase-subida e quase-título." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading } = useRankings();
  const rows = useMemo(() => (data ? computeCoachPlayoffs(data.data.standings, data.data.coaches) : []), [data]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> A calcular…</div>;
  }
  if (!rows.length) return <p className="text-muted-foreground">Sem dados da Super League. Importe uma época primeiro.</p>;

  return (
    <div className="space-y-6">
      <SuperLeagueHeader
        icon={Goal}
        title="Play-Off Treinadores"
        description="Mede o 'azar' dos treinadores da Super League: Quase-Subida = clube terminou entre 2º e 5º numa divisão inferior sem subir; Quase-Título = clube terminou em 1º ou 2º na 1ª divisão sem ser campeão. Passa o rato sobre os valores para ver clube e época."
      />
      <PlayoffTable rows={rows} entityLabel="Treinador" showNac />
    </div>
  );
}
