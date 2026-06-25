import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Handshake } from "lucide-react";
import { useRankings } from "@/lib/useRankings";
import { computeAssists } from "@/lib/fm-players";
import { PlayerStatTable } from "@/components/PlayerStatTable";
import { SuperLeagueHeader } from "@/components/SuperLeagueHeader";

export const Route = createFileRoute("/super-league/assistencias")({
  head: () => ({
    meta: [
      { title: "Assistências de Jogadores (Super League) — FM World Rankings" },
      { name: "description", content: "Histórico de assistências por jogador na Super League, época a época." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading } = useRankings();
  const { rows, years } = useMemo(() => (data ? computeAssists(data.data.players) : { rows: [], years: [] }), [data]);

  if (isLoading) return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> A calcular…</div>;
  if (!rows.length) return <p className="text-muted-foreground">Sem dados de jogadores. Importa um ficheiro da Super League com a folha "Jogadores".</p>;

  return (
    <div className="space-y-6">
      <SuperLeagueHeader
        icon={Handshake}
        title="Assistências (Jogadores)"
        description="Histórico de assistências de cada jogador da Super League, distribuído por época e somado no Total. Passa o rato sobre cada valor para ver o clube nessa época."
      />
      <PlayerStatTable rows={rows} years={years} />
    </div>
  );
}
