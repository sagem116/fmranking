import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useRankings } from "@/lib/useRankings";
import { computeDivisionAggregates, listPlayerYears, type DivisionAgg } from "@/lib/fm-players";
import { SuperLeagueHeader } from "@/components/SuperLeagueHeader";
import { SeasonFilter } from "@/components/SeasonFilter";

export const Route = createFileRoute("/super-league/jogadores-divisoes")({
  head: () => ({
    meta: [
      { title: "Jogadores por Divisão (Super League) — FM World Rankings" },
      { name: "description", content: "Médias de reputação, capacidade, idade, salários e valor por divisão da Super League." },
    ],
  }),
  component: Page,
});

type Key = keyof Pick<DivisionAgg, "ra" | "rm" | "ca" | "cp" | "age" | "salary" | "vp" | "n">;
const COLS: { key: Key; label: string; money?: boolean }[] = [
  { key: "ra", label: "R.A." },
  { key: "rm", label: "R.M." },
  { key: "ca", label: "C.A." },
  { key: "cp", label: "C.P." },
  { key: "age", label: "Idade" },
  { key: "salary", label: "Salário", money: true },
  { key: "vp", label: "Valor", money: true },
  { key: "n", label: "Nº jog." },
];
const fmt = (n: number) => n.toLocaleString("pt-PT");

function Page() {
  const { data, isLoading } = useRankings();
  const years = useMemo(() => (data ? listPlayerYears(data.data.players) : []), [data]);
  const [year, setYear] = useState<"total" | number>("total");
  const rows = useMemo(
    () => (data ? computeDivisionAggregates(data.data.players, data.data.standings, year) : []),
    [data, year],
  );
  const [sort, setSort] = useState<Key | "division">("division");
  const sorted = useMemo(() => [...rows].sort((a, b) => (sort === "division" ? a.division - b.division : b[sort] - a[sort])), [rows, sort]);

  if (isLoading) return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> A calcular…</div>;
  if (!rows.length) return <p className="text-muted-foreground">Sem dados de jogadores. Importa um ficheiro da Super League com a folha "Jogadores".</p>;

  return (
    <div className="space-y-6">
      <SuperLeagueHeader
        icon={Layers}
        title="Jogadores por Divisão"
        description="Indicadores de jogadores agregados por divisão da Super League: médias de R.A., R.M., C.A. e C.P. (28 melhores por clube), idade média e somas de salários e valor. Filtra por época ou vê o agregado total."
      />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <SeasonFilter value={year} onChange={setYear} years={years} />
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3">
                  <button onClick={() => setSort("division")} className={`hover:text-foreground ${sort === "division" ? "text-foreground" : ""}`}>Divisão</button>
                </th>
                {COLS.map((c) => (
                  <th key={c.key} className="text-right p-3">
                    <button onClick={() => setSort(c.key)} className={`hover:text-foreground ${sort === c.key ? "text-foreground" : ""}`}>{c.label}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.division} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="p-3 font-medium">Divisão {r.division}</td>
                  {COLS.map((c) => (
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
