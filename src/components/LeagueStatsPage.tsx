import { useMemo, useState } from "react";
import { Loader2, Layers, X, Download, ChevronLeft, ChevronRight, BarChart3, Filter, ChevronDown, Info } from "lucide-react";
import * as XLSX from "xlsx";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { EntityCombobox } from "@/components/EntityCombobox";
import { useRankings } from "@/lib/useRankings";
import {
  computeLeagueStats,
  formatVal,
  RANKINGS,
  type LeagueFilters,
  type RankingKey,
  type Scope,
} from "@/lib/fm-league-stats";
import { CONTINENTS } from "@/lib/fm-continents";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

const PAGE_SIZE = 25;

interface Props {
  scope: Scope;
  title: string;
  intro?: string;
}

export function LeagueStatsPage({ scope, title, intro }: Props) {
  const { data, isLoading } = useRankings();
  const [ranking, setRanking] = useState<RankingKey>("global");

  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);
  const [continent, setContinent] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [search, setSearch] = useState("");
  const [divMin, setDivMin] = useState<string>("");
  const [divMax, setDivMax] = useState<string>("");
  const [teamsMin, setTeamsMin] = useState<string>("");
  const [teamsMax, setTeamsMax] = useState<string>("");
  const [caMin, setCaMin] = useState<string>("");
  const [caMax, setCaMax] = useState<string>("");
  const [vpMin, setVpMin] = useState<string>("");
  const [vpMax, setVpMax] = useState<string>("");
  const [salMin, setSalMin] = useState<string>("");
  const [salMax, setSalMax] = useState<string>("");
  const [ageMin, setAgeMin] = useState<string>("");
  const [ageMax, setAgeMax] = useState<string>("");

  const [sortKey, setSortKey] = useState<string>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [compare, setCompare] = useState<Set<string>>(new Set());

  const years = useMemo(() => {
    if (!data) return [] as number[];
    const ys = new Set<number>();
    data.data.standings.forEach((s) => ys.add(s.season_year));
    return [...ys].sort((a, b) => a - b);
  }, [data]);

  const countries = useMemo(() => {
    if (!data) return [] as string[];
    return [...new Set(Object.values(data.data.clubCountry).filter(Boolean) as string[])].sort();
  }, [data]);

  const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

  const filters: LeagueFilters = {
    yearFrom, yearTo,
    continent: continent || null,
    country: country || null,
    divisionMin: numOrNull(divMin),
    divisionMax: numOrNull(divMax),
    teamsMin: numOrNull(teamsMin),
    teamsMax: numOrNull(teamsMax),
    caMin: numOrNull(caMin), caMax: numOrNull(caMax),
    vpMin: numOrNull(vpMin), vpMax: numOrNull(vpMax),
    salaryMin: numOrNull(salMin), salaryMax: numOrNull(salMax),
    ageMin: numOrNull(ageMin), ageMax: numOrNull(ageMax),
    search,
  };

  const rows = useMemo(
    () => (data ? computeLeagueStats(data.data, scope, filters) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, scope, yearFrom, yearTo, continent, country, divMin, divMax, teamsMin, teamsMax,
      caMin, caMax, vpMin, vpMax, salMin, salMax, ageMin, ageMax, search],
  );

  const def = RANKINGS.find((r) => r.key === ranking)!;
  const extras = useMemo(() => def.extras?.(rows) ?? {}, [def, rows]);

  // initialize sort to def default when ranking changes
  const effectiveSortKey = def.columns.some((c) => c.key === sortKey) ? sortKey : def.sortKey;
  const effectiveSortDir = def.columns.some((c) => c.key === sortKey) ? sortDir : def.sortDir;

  const sorted = useMemo(() => {
    const col = def.columns.find((c) => c.key === effectiveSortKey) ?? def.columns[0];
    const sign = effectiveSortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => (col.value(a, extras) - col.value(b, extras)) * sign);
  }, [rows, def, extras, effectiveSortKey, effectiveSortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const cur = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);

  const onSort = (key: string) => {
    if (key === effectiveSortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(def.sortDir);
    }
  };

  const clearFilters = () => {
    setYearFrom(null); setYearTo(null); setContinent(""); setCountry(""); setSearch("");
    setDivMin(""); setDivMax(""); setTeamsMin(""); setTeamsMax("");
    setCaMin(""); setCaMax(""); setVpMin(""); setVpMax("");
    setSalMin(""); setSalMax(""); setAgeMin(""); setAgeMax("");
  };

  const tableRows = sorted.map((r, i) => {
    const obj: Record<string, string | number> = { "#": i + 1, Liga: r.league, País: r.country ?? "—" };
    for (const c of def.columns) obj[c.label] = Number(formatVal(c.value(r, extras), c.fmt).replace(/\./g, "").replace(",", "."));
    return obj;
  });

  const exportCsv = () => {
    const head = ["#", "Liga", "País", ...def.columns.map((c) => c.label)];
    const csv = [head.join(";"), ...sorted.map((r, i) => [
      i + 1, r.league, r.country ?? "—",
      ...def.columns.map((c) => formatVal(c.value(r, extras), c.fmt)),
    ].join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${ranking}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(tableRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, def.label.slice(0, 28));
    XLSX.writeFile(wb, `${ranking}.xlsx`);
  };

  // top-10 bar chart for primary metric
  const primaryCol = def.columns.find((c) => c.key === def.sortKey) ?? def.columns[0];
  const barData = sorted.slice(0, 10).map((r) => ({
    league: r.league.length > 18 ? r.league.slice(0, 17) + "…" : r.league,
    value: Number(primaryCol.value(r, extras).toFixed(2)),
  }));

  // evolution: per selected league, compute primary value by season
  const evoData = useMemo(() => {
    if (!data || !compare.size) return [] as Record<string, number | string>[];
    const out: Record<string, Record<number, number>> = {};
    for (const league of compare) out[league] = {};
    for (const y of years) {
      const sub = computeLeagueStats(data.data, scope, { ...filters, yearFrom: y, yearTo: y });
      const subExtras = def.extras?.(sub) ?? {};
      for (const league of compare) {
        const r = sub.find((x) => x.league === league);
        if (r) out[league][y] = Number(primaryCol.value(r, subExtras).toFixed(2));
      }
    }
    return years.map((y) => {
      const row: Record<string, number | string> = { year: y };
      for (const league of compare) row[league] = out[league][y] ?? 0;
      return row;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, compare, ranking, scope, years, yearFrom, yearTo, continent, country, divMin, divMax,
      teamsMin, teamsMax, caMin, caMax, vpMin, vpMax, salMin, salMax, ageMin, ageMax]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular…
      </div>
    );
  if (!data)
    return <p className="text-muted-foreground">Sem dados disponíveis.</p>;

  const compareColors = ["#eab308", "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#06b6d4"];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Estatísticas de Ligas
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="size-6 text-primary" /> {title}
        </h1>
        {intro && (
          <p className="text-sm text-muted-foreground max-w-3xl rounded-lg border border-border bg-muted/40 p-3 leading-relaxed">
            {intro}
          </p>
        )}
      </div>

      {/* Ranking toggle + description */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <ToggleGroup
            type="single"
            value={ranking}
            onValueChange={(v) => v && setRanking(v as RankingKey)}
            className="flex-wrap justify-start gap-2"
          >
            {RANKINGS.map((r) => (
              <ToggleGroupItem key={r.key} value={r.key} className="text-xs h-8 px-3">
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="size-3.5 text-primary mt-0.5 shrink-0" />
            <span><strong className="text-foreground">{def.label}:</strong> {def.description}</span>
          </div>
        </CardContent>
      </Card>

      {/* Filters (collapsible) */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CardContent className="p-4 space-y-3">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center gap-2 text-sm font-medium hover:text-primary">
                <Filter className="size-4 text-primary" /> Filtros avançados
                <ChevronDown className="size-4 ml-auto opacity-60 transition-transform data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Continente</label>
              <select
                value={continent}
                onChange={(e) => setContinent(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Todos</option>
                {CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">País</label>
              <EntityCombobox value={country} onChange={setCountry} options={countries} placeholder="Todos" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Época (de)</label>
              <select
                value={yearFrom ?? ""}
                onChange={(e) => setYearFrom(e.target.value ? Number(e.target.value) : null)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">—</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Época (até)</label>
              <select
                value={yearTo ?? ""}
                onChange={(e) => setYearTo(e.target.value ? Number(e.target.value) : null)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">—</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {scope === "superleague" && (
              <>
                <RangeInput label="Divisão min." value={divMin} onChange={setDivMin} />
                <RangeInput label="Divisão máx." value={divMax} onChange={setDivMax} />
              </>
            )}
            <RangeInput label="Nº equipas min." value={teamsMin} onChange={setTeamsMin} />
            <RangeInput label="Nº equipas máx." value={teamsMax} onChange={setTeamsMax} />
            <RangeInput label="CA min." value={caMin} onChange={setCaMin} />
            <RangeInput label="CA máx." value={caMax} onChange={setCaMax} />
            <RangeInput label="Valor min." value={vpMin} onChange={setVpMin} />
            <RangeInput label="Valor máx." value={vpMax} onChange={setVpMax} />
            <RangeInput label="Salário min." value={salMin} onChange={setSalMin} />
            <RangeInput label="Salário máx." value={salMax} onChange={setSalMax} />
            <RangeInput label="Idade min." value={ageMin} onChange={setAgeMin} />
            <RangeInput label="Idade máx." value={ageMax} onChange={setAgeMax} />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
            <div className="relative flex-1 min-w-[220px]">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar liga…"
                className="h-9"
              />
            </div>
            <Button size="sm" variant="outline" onClick={clearFilters}>
              <X className="size-3.5 mr-1" /> Limpar
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="size-3.5 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportXlsx}>
              <Download className="size-3.5 mr-1" /> Excel
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">{sorted.length} liga(s)</span>
          </div>

          {/* Column visibility */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground self-center">Colunas:</span>
            {def.columns.map((c) => (
              <label key={c.key} className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={!hiddenCols.has(c.key)}
                  onCheckedChange={(v) => {
                    setHiddenCols((s) => {
                      const n = new Set(s);
                      if (v) n.delete(c.key); else n.add(c.key);
                      return n;
                    });
                  }}
                />
                {c.label}
              </label>
            ))}
          </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-center p-3 w-10">#</th>
                <th className="text-left p-3">Liga</th>
                <th className="text-left p-3">País</th>
                {def.columns.filter((c) => !hiddenCols.has(c.key)).map((c) => (
                  <th key={c.key} className="text-right p-3">
                    <button
                      type="button"
                      onClick={() => onSort(c.key)}
                      className={`hover:text-foreground ${effectiveSortKey === c.key ? "text-foreground" : ""}`}
                    >
                      {c.label}{effectiveSortKey === c.key ? (effectiveSortDir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
                <th className="text-center p-3 w-12">Comp.</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={r.league} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="p-3 text-center text-muted-foreground tabular-nums">{cur * PAGE_SIZE + i + 1}</td>
                  <td className="p-3 font-medium">{r.league}</td>
                  <td className="p-3 text-muted-foreground">{r.country ?? "—"}</td>
                  {def.columns.filter((c) => !hiddenCols.has(c.key)).map((c) => (
                    <td key={c.key} className="p-3 text-right tabular-nums">{formatVal(c.value(r, extras), c.fmt)}</td>
                  ))}
                  <td className="p-3 text-center">
                    <Checkbox
                      checked={compare.has(r.league)}
                      onCheckedChange={(v) => {
                        setCompare((s) => {
                          const n = new Set(s);
                          if (v && n.size >= 6) return n;
                          if (v) n.add(r.league); else n.delete(r.league);
                          return n;
                        });
                      }}
                    />
                  </td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr><td colSpan={4 + def.columns.length} className="p-6 text-center text-muted-foreground text-sm">Sem resultados.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground text-xs">página {cur + 1} de {pageCount}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
            <ChevronLeft className="size-3.5" /> Anterior
          </Button>
          <Button size="sm" variant="outline" disabled={cur + 1 >= pageCount} onClick={() => setPage(cur + 1)}>
            Seguinte <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Bar chart top 10 */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" /> Top 10 — {primaryCol.label}
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ left: 10, right: 10, top: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="league" angle={-30} textAnchor="end" interval={0} fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip />
                <Bar dataKey="value" fill="#eab308" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Evolution chart */}
      {compare.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Evolução histórica — {primaryCol.label}</h2>
              <Button size="sm" variant="ghost" onClick={() => setCompare(new Set())}>
                <X className="size-3.5 mr-1" /> Limpar comparação
              </Button>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evoData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="year" fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {[...compare].map((league, i) => (
                    <Line key={league} type="monotone" dataKey={league} stroke={compareColors[i % compareColors.length]} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RangeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} type="number" placeholder="—" className="h-9" />
    </div>
  );
}
