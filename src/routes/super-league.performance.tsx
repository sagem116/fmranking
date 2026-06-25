import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useRankings } from "@/lib/useRankings";
import { computePerformance, type PerformanceRow } from "@/lib/fm-players";
import { SuperLeagueHeader } from "@/components/SuperLeagueHeader";

export const Route = createFileRoute("/super-league/performance")({
  head: () => ({
    meta: [
      { title: "Performance de Jogadores (Super League) — FM World Rankings" },
      { name: "description", content: "Resumo de golos, assistências, salário e valor por jogador na Super League." },
    ],
  }),
  component: Page,
});

type Key = keyof Pick<PerformanceRow, "gls" | "ast" | "total" | "salary" | "vp">;
const fmt = (n: number) => n.toLocaleString("pt-PT");

function Page() {
  const { data, isLoading } = useRankings();
  const rows = useMemo(() => (data ? computePerformance(data.data.players) : []), [data]);
  const [sort, setSort] = useState<Key>("total");
  const sorted = useMemo(() => [...rows].sort((a, b) => b[sort] - a[sort]), [rows, sort]);

  if (isLoading) return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> A calcular…</div>;
  if (!rows.length) return <p className="text-muted-foreground">Sem dados de jogadores. Importa um ficheiro da Super League com a folha "Jogadores".</p>;

  const cols: { key: Key; label: string; money?: boolean }[] = [
    { key: "gls", label: "Golos" },
    { key: "ast", label: "Assist." },
    { key: "total", label: "Total" },
    { key: "salary", label: "Salário", money: true },
    { key: "vp", label: "Valor", money: true },
  ];

  return (
    <div className="space-y-6">
      <SuperLeagueHeader
        icon={Activity}
        title="Performance de Jogadores"
        description="Resumo por jogador da Super League: golos e assistências acumulados em todas as épocas (Total = golos + assistências), com clube, liga e idade mais recentes, salário e valor de passe. Clica nos cabeçalhos para ordenar."
      />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3 w-12">#</th>
                <th className="text-left p-3">Jogador</th>
                <th className="text-left p-3">Clube</th>
                <th className="text-right p-3">Idade</th>
                {cols.map((c) => (
                  <th key={c.key} className="text-right p-3">
                    <button onClick={() => setSort(c.key)} className={`hover:text-foreground ${sort === c.key ? "text-foreground" : ""}`}>{c.label}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 300).map((r, i) => (
                <tr key={r.name + i} className="border-b border-border/50 hover:bg-muted/50">
                  <td className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</td>
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-muted-foreground">{r.club || "—"}</td>
                  <td className="p-3 text-right tabular-nums">{r.age ?? "—"}</td>
                  {cols.map((c) => (
                    <td key={c.key} className="p-3 text-right tabular-nums">{c.money ? fmt(r[c.key]) : r[c.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
