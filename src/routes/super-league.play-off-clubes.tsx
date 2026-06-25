import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { useRankings } from "@/lib/useRankings";
import { computeClubPlayoffs } from "@/lib/fm-superleague";
import { PlayoffTable } from "@/components/SuperLeagueTables";
import { SuperLeagueHeader } from "@/components/SuperLeagueHeader";

export const Route = createFileRoute("/super-league/play-off-clubes")({
  head: () => ({
    meta: [
      { title: "Play-Off de Clubes (Super League) — FM World Rankings" },
      { name: "description", content: "Clubes da Super League em situações de quase-subida e quase-título." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading } = useRankings();
  const rows = useMemo(() => (data ? computeClubPlayoffs(data.data.standings) : []), [data]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> A calcular…</div>;
  }
  if (!rows.length) return <p className="text-muted-foreground">Sem dados da Super League. Importe uma época primeiro.</p>;

  return (
    <div className="space-y-6">
      <SuperLeagueHeader
        icon={TrendingUp}
        title="Play-Off de Clubes"
        description="Mede o 'azar' dos clubes da Super League: Quase-Subida = terminou entre 2º e 5º numa divisão inferior sem ser promovido; Quase-Título = terminou em 1º ou 2º na 1ª divisão sem ser campeão. Passa o rato sobre os valores para ver as épocas."
      />
      <PlayoffTable rows={rows} entityLabel="Clube" />
    </div>
  );
}
