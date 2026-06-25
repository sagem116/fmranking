import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, History as HistoryIcon, Shield, Users, Globe2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import { buildYearMaps, type RankingSource } from "@/lib/fm-profiles";
import { rankBy } from "@/lib/fm-rankings";

export const Route = createFileRoute("/ranking-historico")({
  head: () => ({
    meta: [
      { title: "Histórico de Rankings — FM World Rankings" },
      { name: "description", content: "Posição que cada clube, treinador e país ocupou no ranking mundial em cada época." },
    ],
  }),
  component: HistoricoRankings,
});

type Kind = "clubes" | "treinadores" | "paises";
type Mode = "weighted" | "raw";

const SOURCES: { value: RankingSource; label: string }[] = [
  { value: "all", label: "Unificado" },
  { value: "superleague", label: "Super League" },
  { value: "national", label: "Ligas Nacionais" },
  { value: "continental", label: "Continentais" },
  { value: "international", label: "Internacional" },
];

function HistoricoRankings() {
  const { data, isLoading } = useRankings();
  const [mode, setMode] = useState<Mode>("weighted");
  const [source, setSource] = useState<RankingSource>("all");
  const [search, setSearch] = useState("");
  const [topN, setTopN] = useState<number>(30);
  const [yearFrom, setYearFrom] = useState<number | "min">("min");
  const [yearTo, setYearTo] = useState<number | "max">("max");

  const yearMaps = useMemo(() => {
    if (!data) return null;
    return buildYearMaps(data.data, data.config, source);
  }, [data, source]);

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> A carregar…</div>;
  }
  if (!data || !yearMaps) {
    return <p className="text-sm text-muted-foreground">Sem dados. Importa primeiro uma época.</p>;
  }

  const allYears = data.ranks.years;
  const yFromN = yearFrom === "min" ? (allYears[0] ?? 0) : yearFrom;
  const yToN = yearTo === "max" ? (allYears[allYears.length - 1] ?? 0) : yearTo;
  const lo = Math.min(yFromN, yToN);
  const hi = Math.max(yFromN, yToN);
  const years = allYears.filter((y) => y >= lo && y <= hi);

  // For "all" source we use precomputed unified rankings; for filtered sources derive overall by summing yearMap values.
  const deriveOverall = (ym: Map<number, Map<string, number>>) => {
    const totals = new Map<string, number>();
    for (const inner of ym.values()) {
      for (const [name, pts] of inner) totals.set(name, (totals.get(name) ?? 0) + pts);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  };

  const clubYM = mode === "weighted" ? yearMaps.clubYearW : yearMaps.clubYearR;
  const coachYM = mode === "weighted" ? yearMaps.coachYearW : yearMaps.coachYearR;
  const countryYM = mode === "weighted" ? yearMaps.countryYearW : yearMaps.countryYearR;

  const overallClubs = source === "all" ? rankBy(data.ranks.clubs, mode).map((e) => e.name) : deriveOverall(clubYM);
  const overallCoaches = source === "all" ? rankBy(data.ranks.coaches, mode).map((e) => e.name) : deriveOverall(coachYM);
  const overallCountries = source === "all" ? rankBy(data.ranks.countries, mode).map((e) => e.name) : deriveOverall(countryYM);

  const sourceLabel = SOURCES.find((s) => s.value === source)?.label ?? "Unificado";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><HistoryIcon className="size-6 text-primary" /> Histórico de Rankings</h1>
        <p className="text-sm text-muted-foreground">Posição que cada entidade ocupou no Ranking ({sourceLabel}) em cada época, com pontos {mode === "weighted" ? "ponderados" : "brutos"}.</p>
      </header>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {SOURCES.map((s) => (
              <Button key={s.value} size="sm" variant={source === s.value ? "default" : "ghost"} className="rounded-none h-8 px-3 text-xs" onClick={() => setSource(s.value)}>{s.label}</Button>
            ))}
          </div>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <Button size="sm" variant={mode === "weighted" ? "default" : "ghost"} className="rounded-none h-8 px-3 text-xs" onClick={() => setMode("weighted")}>Ponderado</Button>
            <Button size="sm" variant={mode === "raw" ? "default" : "ghost"} className="rounded-none h-8 px-3 text-xs" onClick={() => setMode("raw")}>Bruto</Button>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome…" className="h-8 text-sm" />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Top:</span>
            {[20, 30, 50, 100, 999].map((n) => (
              <Button key={n} size="sm" variant={topN === n ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setTopN(n)}>
                {n === 999 ? "Todos" : n}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Épocas:</span>
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
        </CardContent>
      </Card>

      <Tabs defaultValue={source === "international" ? "treinadores" : "clubes"} key={source}>
        <TabsList>
          {source !== "international" && (
            <TabsTrigger value="clubes"><Shield className="size-4 mr-1" /> Clubes</TabsTrigger>
          )}
          <TabsTrigger value="treinadores"><Users className="size-4 mr-1" /> Treinadores</TabsTrigger>
          <TabsTrigger value="paises"><Globe2 className="size-4 mr-1" /> {source === "international" ? "Seleções" : "Países"}</TabsTrigger>
        </TabsList>
        {source !== "international" && (
          <TabsContent value="clubes">
            <HistoryTable kind="clubes" years={years} yearMap={clubYM} overall={overallClubs} search={search} topN={topN} />
          </TabsContent>
        )}
        <TabsContent value="treinadores">
          <HistoryTable kind="treinadores" years={years} yearMap={coachYM} overall={overallCoaches} search={search} topN={topN} />
        </TabsContent>
        <TabsContent value="paises">
          <HistoryTable kind="paises" years={years} yearMap={countryYM} overall={overallCountries} search={search} topN={topN} />
        </TabsContent>
      </Tabs>
    </div>
  );
}



interface HistoryTableProps {
  kind: Kind;
  years: number[];
  yearMap: Map<number, Map<string, number>>;
  overall: string[];
  search: string;
  topN: number;
}

type SortKey = { type: "total" } | { type: "name" } | { type: "year"; year: number };
type SortDir = "asc" | "desc";

function HistoryTable({ kind, years, yearMap, overall, search, topN }: HistoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>({ type: "total" });
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const yearRanks = useMemo(() => {
    const m = new Map<number, Map<string, number>>();
    for (const y of years) {
      const inner = yearMap.get(y);
      const ranks = new Map<string, number>();
      if (inner) {
        const sorted = [...inner.entries()].sort((a, b) => b[1] - a[1]);
        sorted.forEach(([name], i) => ranks.set(name, i + 1));
      }
      m.set(y, ranks);
    }
    return m;
  }, [years, yearMap]);

  const overallRanks = useMemo(() => {
    const m = new Map<string, number>();
    overall.forEach((n, i) => m.set(n, i + 1));
    return m;
  }, [overall]);

  const q = search.trim().toLowerCase();
  const rows = useMemo(() => {
    let list = overall.slice();
    if (q) list = list.filter((n) => n.toLowerCase().includes(q));

    const dirMul = sortDir === "asc" ? 1 : -1;
    const BIG = Number.POSITIVE_INFINITY;
    if (sortKey.type === "name") {
      list.sort((a, b) => a.localeCompare(b) * dirMul);
    } else if (sortKey.type === "total") {
      list.sort((a, b) => ((overallRanks.get(a) ?? BIG) - (overallRanks.get(b) ?? BIG)) * dirMul);
    } else {
      const ymap = yearRanks.get(sortKey.year);
      list.sort((a, b) => ((ymap?.get(a) ?? BIG) - (ymap?.get(b) ?? BIG)) * dirMul);
    }
    return list.slice(0, topN);
  }, [overall, q, topN, sortKey, sortDir, overallRanks, yearRanks]);

  const linkTo =
    kind === "clubes" ? "/clubes/$name" : kind === "treinadores" ? "/treinadores/$name" : "/paises/$name";

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Sem resultados.</p>;
  }

  const toggle = (key: SortKey) => {
    const same =
      (sortKey.type === key.type) &&
      (key.type !== "year" || (sortKey.type === "year" && sortKey.year === key.year));
    if (same) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const arrow = (key: SortKey) => {
    const same =
      (sortKey.type === key.type) &&
      (key.type !== "year" || (sortKey.type === "year" && sortKey.year === key.year));
    if (!same) return <span className="opacity-30 ml-0.5">↕</span>;
    return <span className="ml-0.5">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  return (
    <Card className="mt-4">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {rows.length} entidades · {years.length} épocas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-background z-10 border-b">
            <tr>
              <th className="text-left py-2 px-3 sticky left-0 bg-background z-20 min-w-[180px]">
                <button onClick={() => toggle({ type: "name" })} className="hover:text-primary inline-flex items-center">Nome{arrow({ type: "name" })}</button>
              </th>
              <th className="px-2 py-2 text-center bg-background">
                <button onClick={() => toggle({ type: "total" })} className="hover:text-primary inline-flex items-center">Total{arrow({ type: "total" })}</button>
              </th>
              {years.map((y) => (
                <th key={y} className="px-2 py-2 text-center font-medium text-muted-foreground">
                  <button onClick={() => toggle({ type: "year", year: y })} className="hover:text-primary inline-flex items-center">{y}{arrow({ type: "year", year: y })}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((name) => {
              const overallRk = overallRanks.get(name);
              return (
                <tr key={name} className="border-b hover:bg-muted/40">
                  <td className="px-3 py-1.5 sticky left-0 bg-background z-10">
                    <Link to={linkTo} params={{ name }} className="text-primary hover:underline">{name}</Link>
                  </td>
                  <td className="px-2 py-1.5 text-center font-semibold">
                    {overallRk != null ? `#${overallRk}` : "—"}
                  </td>
                  {years.map((y) => {
                    const r = yearRanks.get(y)?.get(name);
                    return (
                      <td key={y} className={`px-2 py-1.5 text-center tabular-nums ${rankClass(r)}`}>
                        {r != null ? r : "·"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function rankClass(r: number | undefined): string {
  if (r == null) return "text-muted-foreground/40";
  if (r === 1) return "text-gold font-bold";
  if (r <= 3) return "text-amber-500 font-semibold";
  if (r <= 10) return "text-foreground font-medium";
  return "text-muted-foreground";
}
