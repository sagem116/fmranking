import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Award } from "lucide-react";
import { useRankings } from "@/lib/useRankings";
import { computeCoachChampions } from "@/lib/fm-superleague";
import { ChampionsTable } from "@/components/SuperLeagueTables";
import { SuperLeagueHeader } from "@/components/SuperLeagueHeader";

export const Route = createFileRoute("/super-league/treinador-campeoes")({
  head: () => ({
    meta: [
      { title: "Treinador Campeões (Super League) — FM World Rankings" },
      { name: "description", content: "Histórico de títulos e promoções por treinador na Super League." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading } = useRankings();
  const rows = useMemo(() => (data ? computeCoachChampions(data.data.standings, data.data.coaches) : []), [data]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> A calcular…</div>;
  }
  if (!rows.length) return <p className="text-muted-foreground">Sem dados da Super League. Importe uma época primeiro.</p>;

  return (
    <div className="space-y-6">
      <SuperLeagueHeader
        icon={Award}
        title="Treinador Campeões"
        description="Atribui ao treinador os títulos (C), promoções (P) e despromoções (D) do clube que orientou em cada época da Super League. O Score = Campeão×3 + Promovido. Passa o rato sobre os valores para ver clube e época."
      />
      <ChampionsTable rows={rows} entityLabel="Treinador" showNac />
    </div>
  );
}
