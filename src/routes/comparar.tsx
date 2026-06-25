import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GitCompareArrows, Loader2, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import {
  buildClubProfile,
  buildCoachProfile,
  buildCountryProfile,
  type ChartPoint,
} from "@/lib/fm-profiles";
import { EvolutionChart, type ChartMode, type EvoSeries } from "@/components/EvolutionChart";
import { EntityCombobox } from "@/components/EntityCombobox";
import { fmtPts } from "@/lib/fmt";

export const Route = createFileRoute("/comparar")({
  head: () => ({
    meta: [
      { title: "Comparar — FM World Rankings" },
      { name: "description", content: "Compara lado a lado até 5 clubes, treinadores ou países e a sua evolução histórica." },
    ],
  }),
  component: CompararPage,
});

type Kind = "clubes" | "treinadores" | "paises";
const MAX_ENTITIES = 5;
const SERIES_COLORS = [
  "var(--primary)",
  "var(--gold, #d4af37)",
  "#60a5fa",
  "#a78bfa",
  "#34d399",
];

interface Profile {
  chart: ChartPoint[];
  stats: { label: string; value: string | number }[];
}

function CompararPage() {
  const { data, isLoading } = useRankings();
  const [kind, setKind] = useState<Kind>("clubes");
  const [selected, setSelected] = useState<string[]>(["", ""]);
  const [mode, setMode] = useState<ChartMode>("weighted");
  const [yearFrom, setYearFrom] = useState<number | "min">("min");
  const [yearTo, setYearTo] = useState<number | "max">("max");

  const options = useMemo(() => {
    if (!data) return [] as string[];
    if (kind === "clubes") return data.ranks.clubs.map((c) => c.name);
    if (kind === "treinadores") return data.ranks.coaches.map((c) => c.name);
    return data.ranks.countries.map((c) => c.name);
  }, [data, kind]);

  const setOne = (idx: number, value: string) => {
    setSelected((cur) => cur.map((v, i) => (i === idx ? value : v)));
  };
  const addSlot = () => setSelected((cur) => (cur.length >= MAX_ENTITIES ? cur : [...cur, ""]));
  const removeSlot = (idx: number) =>
    setSelected((cur) => (cur.length <= 2 ? cur.map((v, i) => (i === idx ? "" : v)) : cur.filter((_, i) => i !== idx)));

  const build = (name: string): Profile | null => {
    if (!data || !name) return null;
    if (kind === "clubes") {
      const p = buildClubProfile(data.data, name, data.config);
      if (!p) return null;
      return {
        chart: p.chart,
        stats: [
          { label: "Pontos ponderados", value: fmtPts(p.totalWeighted) },
          { label: "Pontos brutos", value: fmtPts(p.totalRaw) },
          { label: "Títulos", value: p.titles },
          { label: "Épocas", value: p.seasonsCount },
          { label: "Melhor posição", value: p.bestPosition ?? "—" },
        ],
      };
    }
    if (kind === "treinadores") {
      const p = buildCoachProfile(data.data, name, data.config);
      if (!p) return null;
      return {
        chart: p.chart,
        stats: [
          { label: "Pontos ponderados", value: fmtPts(p.totalWeighted) },
          { label: "Pontos brutos", value: fmtPts(p.totalRaw) },
          { label: "Títulos", value: p.titles },
          { label: "Épocas", value: p.seasonsCount },
          { label: "Clubes", value: p.clubs.length },
        ],
      };
    }
    const p = buildCountryProfile(data.data, name, data.config);
    if (!p) return null;
    return {
      chart: p.chart,
      stats: [
        { label: "Pontos ponderados", value: fmtPts(p.totalWeighted) },
        { label: "Pontos brutos", value: fmtPts(p.totalRaw) },
        { label: "Títulos", value: p.titles },
        { label: "Épocas ativas", value: p.seasonsActive },
        { label: "Clubes", value: p.clubs.length },
      ],
    };
  };

  const profiles = useMemo(
    () => selected.map((n) => ({ name: n, profile: build(n) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, kind, data],
  );
  const active = profiles.filter((p) => p.profile);

  // Compute year range
  const allYears = useMemo(() => {
    const set = new Set<number>();
    for (const p of active) for (const pt of p.profile!.chart) set.add(pt.year);
    return [...set].sort((a, b) => a - b);
  }, [active]);
  const yFromN = yearFrom === "min" ? allYears[0] ?? 0 : yearFrom;
  const yToN = yearTo === "max" ? allYears[allYears.length - 1] ?? 0 : yearTo;
  const lo = Math.min(yFromN, yToN);
  const hi = Math.max(yFromN, yToN);
  const years = allYears.filter((y) => y >= lo && y <= hi);

  const series: EvoSeries[] = active.map((p, i) => ({
    name: p.name,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    data: p.profile!.chart.filter((pt) => pt.year >= lo && pt.year <= hi),
  }));

  // Delta tables (only when exactly 2 entities so the diff is meaningful).
  const deltaRows = useMemo(() => {
    if (active.length !== 2) return null;
    const [A, B] = active;
    const ptsKey = mode === "weighted" ? "weighted" : "raw";
    const posKey = mode === "weighted" ? "positionWeighted" : "positionRaw";
    return years.map((y) => {
      const a = A.profile!.chart.find((p) => p.year === y);
      const b = B.profile!.chart.find((p) => p.year === y);
      const aPts = (a?.[ptsKey] as number | undefined) ?? 0;
      const bPts = (b?.[ptsKey] as number | undefined) ?? 0;
      const aPos = (a?.[posKey] as number | null | undefined) ?? null;
      const bPos = (b?.[posKey] as number | null | undefined) ?? null;
      const ptsDelta = aPts - bPts;
      const posDelta = aPos != null && bPos != null ? bPos - aPos : null; // positivo = A em melhor posição
      return { y, aPts, bPts, aPos, bPos, ptsDelta, posDelta };
    });
  }, [active, years, mode]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GitCompareArrows className="size-6 text-primary" /> Comparar
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compara até {MAX_ENTITIES} entidades lado a lado, com busca e filtro por intervalo de épocas.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <Tabs value={kind} onValueChange={(v) => { setKind(v as Kind); setSelected(["", ""]); }}>
            <TabsList>
              <TabsTrigger value="clubes">Clubes</TabsTrigger>
              <TabsTrigger value="treinadores">Treinadores</TabsTrigger>
              <TabsTrigger value="paises">Países</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {selected.map((value, idx) => {
              const taken = new Set(selected.filter((_, i) => i !== idx).filter(Boolean));
              const opts = options.filter((n) => !taken.has(n));
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      <span
                        className="inline-block size-2.5 rounded-full mr-1.5 align-middle"
                        style={{ background: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                      />
                      Entidade {idx + 1}
                    </Label>
                    {selected.length > 2 && (
                      <Button size="sm" variant="ghost" className="h-6 px-1 text-xs" onClick={() => removeSlot(idx)}>
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                  <EntityCombobox
                    value={value}
                    onChange={(v) => setOne(idx, v)}
                    options={opts}
                    placeholder="Pesquisar e selecionar…"
                  />
                </div>
              );
            })}
            {selected.length < MAX_ENTITIES && (
              <Button
                variant="outline"
                size="sm"
                onClick={addSlot}
                className="self-end h-9 border-dashed"
              >
                <Plus className="size-4 mr-1" /> Adicionar entidade
              </Button>
            )}
          </div>

          {allYears.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-border/50">
              <Label className="text-xs text-muted-foreground">Intervalo de épocas:</Label>
              <select
                value={String(yearFrom)}
                onChange={(e) => setYearFrom(e.target.value === "min" ? "min" : Number(e.target.value))}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="min">Início</option>
                {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-muted-foreground">→</span>
              <select
                value={String(yearTo)}
                onChange={(e) => setYearTo(e.target.value === "max" ? "max" : Number(e.target.value))}
                className="h-7 rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="max">Fim</option>
                {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              {(yearFrom !== "min" || yearTo !== "max") && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setYearFrom("min"); setYearTo("max"); }}>Limpar</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {active.length >= 2 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução comparada</CardTitle>
            </CardHeader>
            <CardContent>
              <EvolutionChart series={series} mode={mode} onModeChange={setMode} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estatísticas</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="text-left py-2 pr-2"></th>
                    {active.map((p, i) => (
                      <th key={i} className="text-right py-2 px-2 font-medium text-foreground">
                        <span
                          className="inline-block size-2.5 rounded-full mr-1.5 align-middle"
                          style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                        />
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active[0].profile!.stats.map((row, rIdx) => (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-2 pr-2 text-muted-foreground">{row.label}</td>
                      {active.map((p, i) => (
                        <td key={i} className="py-2 px-2 text-right tabular-nums font-medium">
                          {p.profile!.stats[rIdx]?.value ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {deltaRows && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Variação anual ({active[0].name} − {active[1].name})
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Δ Pontos positivos = {active[0].name} ganha terreno. Δ Posição positiva = {active[0].name} fica em melhor posição que {active[1].name}.
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground uppercase border-b border-border">
                      <th className="text-left py-2 pr-2">Época</th>
                      <th className="text-right py-2 px-2">{active[0].name} pts</th>
                      <th className="text-right py-2 px-2">{active[1].name} pts</th>
                      <th className="text-right py-2 px-2">Δ Pontos</th>
                      <th className="text-right py-2 px-2">{active[0].name} pos</th>
                      <th className="text-right py-2 px-2">{active[1].name} pos</th>
                      <th className="text-right py-2 px-2">Δ Posição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deltaRows.map((r) => (
                      <tr key={r.y} className="border-b border-border/40">
                        <td className="py-1.5 pr-2 font-medium">{r.y}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{fmtPts(r.aPts)}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{fmtPts(r.bPts)}</td>
                        <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${r.ptsDelta > 0 ? "text-emerald-500" : r.ptsDelta < 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                          {r.ptsDelta > 0 ? "+" : ""}{fmtPts(r.ptsDelta)}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{r.aPos ?? "—"}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{r.bPos ?? "—"}</td>
                        <td className={`py-1.5 px-2 text-right tabular-nums font-medium ${r.posDelta != null && r.posDelta > 0 ? "text-emerald-500" : r.posDelta != null && r.posDelta < 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                          {r.posDelta == null ? "—" : `${r.posDelta > 0 ? "+" : ""}${r.posDelta}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {active.length < 2 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Seleciona pelo menos duas entidades para iniciar a comparação.
        </p>
      )}
    </div>
  );
}
