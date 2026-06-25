import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Medal } from "lucide-react";
import { useRankings } from "@/lib/useRankings";
import { computeClubChampions } from "@/lib/fm-superleague";
import { ChampionsTable } from "@/components/SuperLeagueTables";
import { SuperLeagueHeader } from "@/components/SuperLeagueHeader";

export const Route = createFileRoute("/super-league/campeoes")({
  head: () => ({
    meta: [
      { title: "Histórico de Campeões (Super League) — FM World Rankings" },
      { name: "description", content: "Histórico de títulos, promoções e despromoções por clube na Super League." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading } = useRankings();
  const rows = useMemo(() => (data ? computeClubChampions(data.data.standings) : []), [data]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> A calcular…</div>;
  }
  if (!rows.length) return <p className="text-muted-foreground">Sem dados da Super League. Importe uma época primeiro.</p>;

  return (
    <div className="space-y-6">
      <SuperLeagueHeader
        icon={Medal}
        title="Histórico de Campeões"
        description="Conta, por clube da Super League, quantas vezes foi Campeão (C), Promovido (P) e Despromovido (D) ao longo de todas as épocas. O Score = Campeão×3 + Promovido − Despromovido. Passa o rato sobre os valores para ver as épocas e divisões."
      />
      <ChampionsTable rows={rows} entityLabel="Clube" />
    </div>
  );
}
