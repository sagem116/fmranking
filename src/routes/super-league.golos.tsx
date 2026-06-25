import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Goal, Search } from "lucide-react";
import { useRankings } from "@/lib/useRankings";
import { computeGoals } from "@/lib/fm-players";
import { PlayerStatTable } from "@/components/PlayerStatTable";
import { SuperLeagueHeader } from "@/components/SuperLeagueHeader";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/super-league/golos")({
  head: () => ({
    meta: [
      { title: "Golos de Jogadores (Super League) — FM World Rankings" },
      { name: "description", content: "Histórico de golos marcados por jogador na Super League, época a época." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data, isLoading } = useRankings();
  const [q, setQ] = useState("");
  const { rows, years } = useMemo(() => (data ? computeGoals(data.data.players) : { rows: [], years: [] }), [data]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(s));
  }, [rows, q]);

  if (isLoading) return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> A calcular…</div>;
  if (!rows.length) return <p className="text-muted-foreground">Sem dados de jogadores. Importa um ficheiro da Super League com a folha "Jogadores".</p>;

  return (
    <div className="space-y-6">
      <SuperLeagueHeader
        icon={Goal}
        title="Golos (Jogadores)"
        description="Histórico de golos marcados por cada jogador da Super League, distribuído por época e somado no Total. Passa o rato sobre cada valor para ver o clube nessa época."
      />
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar jogador…"
          className="pl-9"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem jogadores que correspondam a "{q}".</p>
      ) : (
        <PlayerStatTable rows={filtered} years={years} />
      )}
    </div>
  );
}
