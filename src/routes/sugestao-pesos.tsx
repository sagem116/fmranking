import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, Download, RotateCcw, Copy, Save, Upload as UploadIcon, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  Cell,
  Legend,
} from "recharts";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { useRankings } from "@/lib/useRankings";
import { fmtNum } from "@/lib/fmt";
import type { CompType } from "@/lib/fm-player-stats-db";

export const Route = createFileRoute("/sugestao-pesos")({
  head: () => ({
    meta: [
      { title: "Sugestão de Pesos — FM World Rankings" },
      { name: "description", content: "Sugestão automática de pesos para competições com base numa fórmula configurável." },
    ],
  }),
  component: SugestaoPesosPage,
});

type MetricKey = "gls" | "ast" | "games" | "hdj" | "ca" | "cp" | "vp" | "salary" | "ra" | "rm" | "rc" | "age";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "gls", label: "Gls" },
  { key: "ast", label: "Ast" },
  { key: "games", label: "Jogos" },
  { key: "hdj", label: "HdJ" },
  { key: "ca", label: "C.A." },
  { key: "cp", label: "C.P." },
  { key: "vp", label: "VP" },
  { key: "salary", label: "Salário" },
  { key: "ra", label: "R.A." },
  { key: "rm", label: "R.M." },
  { key: "rc", label: "R.C." },
  { key: "age", label: "Idade" },
];

type Scale = 1 | 2 | 5 | 10 | 20 | 50 | 100;
const SCALES: Scale[] = [1, 2, 5, 10, 20, 50, 100];

interface Formula {
  name: string;
  enabled: Record<MetricKey, boolean>;
  weights: Record<MetricKey, number>;
  normalize: boolean;
  scale: Scale;
  /** Maximum number of metrics that can be enabled at once. 0 = no limit. */
  maxActive?: number;
}

const DEFAULT_FORMULA: Formula = {
  name: "Padrão",
  enabled: {
    gls: false, ast: false, games: false, hdj: false,
    ca: true, cp: true, vp: false, salary: false,
    ra: true, rm: true, rc: false, age: false,
  },
  weights: {
    gls: 0, ast: 0, games: 0, hdj: 0,
    ca: 0.5, cp: 0.2, vp: 0, salary: 0,
    ra: 0.2, rm: 0.1, rc: 0, age: 0,
  },
  normalize: true,
  scale: 10,
  maxActive: 0,
};

const STORAGE_KEY = "fm-sugestao-pesos-formulas";
const ACTIVE_KEY = "fm-sugestao-pesos-active";

function loadSaved(): Record<string, Formula> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSaved(map: Record<string, Formula>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

interface CompAgg {
  competition: string;
  comp_type: CompType;
  country: string | null;
  metrics: Record<MetricKey, number>;
  n: number;
}

function SugestaoPesosPage() {
  const ps = usePlayerStatsData();
  const rk = useRankings();

  const [formula, setFormula] = useState<Formula>(DEFAULT_FORMULA);
  const [search, setSearch] = useState("");
  const [compTypeFilter, setCompTypeFilter] = useState<CompType | "all">("all");
  const [sortKey, setSortKey] = useState<"competition" | "index" | "weight" | "current" | "diff">("weight");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [savedMap, setSavedMap] = useState<Record<string, Formula>>({});

  useEffect(() => {
    setSavedMap(loadSaved());
    try {
      const active = localStorage.getItem(ACTIVE_KEY);
      if (active) {
        const map = loadSaved();
        if (map[active]) setFormula(map[active]);
      }
    } catch { /* noop */ }
  }, []);

  // Aggregate per-competition averages across all loaded seasons.
  const aggregates = useMemo<CompAgg[]>(() => {
    const players = ps.data?.players ?? [];
    const map = new Map<string, { row: CompAgg; sums: Record<MetricKey, number> }>();
    for (const r of players) {
      const key = `${r.comp_type}|${r.competition}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          row: {
            competition: r.competition,
            comp_type: r.comp_type,
            country: r.country,
            metrics: { gls:0,ast:0,games:0,hdj:0,ca:0,cp:0,vp:0,salary:0,ra:0,rm:0,rc:0,age:0 },
            n: 0,
          },
          sums: { gls:0,ast:0,games:0,hdj:0,ca:0,cp:0,vp:0,salary:0,ra:0,rm:0,rc:0,age:0 },
        };
        map.set(key, entry);
      }
      entry.row.n++;
      entry.sums.gls += r.gls || 0;
      entry.sums.ast += r.ast || 0;
      entry.sums.games += r.games || 0;
      entry.sums.hdj += r.hdj || 0;
      entry.sums.ca += r.ca || 0;
      entry.sums.cp += r.cp || 0;
      entry.sums.vp += r.vp || 0;
      entry.sums.salary += r.salary || 0;
      entry.sums.ra += r.ra || 0;
      entry.sums.rm += r.rm || 0;
      entry.sums.rc += r.rc || 0;
      entry.sums.age += r.age || 0;
    }
    const out: CompAgg[] = [];
    for (const { row, sums } of map.values()) {
      const n = row.n || 1;
      const metrics = {} as Record<MetricKey, number>;
      for (const m of METRICS) metrics[m.key] = sums[m.key] / n;
      out.push({ ...row, metrics });
    }
    return out;
  }, [ps.data]);

  // Min/Max per metric for normalization
  const minMax = useMemo(() => {
    const mm: Record<MetricKey, { min: number; max: number }> = {} as Record<MetricKey, { min: number; max: number }>;
    for (const m of METRICS) {
      let min = Infinity, max = -Infinity;
      for (const a of aggregates) {
        const v = a.metrics[m.key];
        if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
      }
      mm[m.key] = { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
    }
    return mm;
  }, [aggregates]);

  const currentWeightFor = (ct: CompType): number => {
    const cw = rk.data?.config.competitionWeights;
    if (!cw) return 0;
    return cw[ct] ?? 0;
  };

  // Build per-competition rows with index + suggested weight
  const rows = useMemo(() => {
    const sumW = METRICS.reduce((s, m) => s + (formula.enabled[m.key] ? Math.abs(formula.weights[m.key]) : 0), 0);
    const result = aggregates.map((a) => {
      let index = 0;
      const contribs: Record<MetricKey, number> = {} as Record<MetricKey, number>;
      for (const m of METRICS) {
        if (!formula.enabled[m.key]) { contribs[m.key] = 0; continue; }
        const raw = a.metrics[m.key] ?? 0;
        let val = raw;
        if (formula.normalize) {
          const { min, max } = minMax[m.key];
          val = max > min ? (raw - min) / (max - min) : 0;
        }
        const c = val * formula.weights[m.key];
        contribs[m.key] = c;
        index += c;
      }
      return { agg: a, index, contribs, sumW };
    });
    // Determine scaling: if normalize, divide by sum of weights to keep 0..1; else min-max on index
    let suggested: { row: typeof result[number]; suggested: number }[] = [];
    if (formula.normalize && sumW > 0) {
      suggested = result.map((r) => ({ row: r, suggested: (r.index / sumW) * formula.scale }));
    } else {
      let imin = Infinity, imax = -Infinity;
      for (const r of result) { if (r.index < imin) imin = r.index; if (r.index > imax) imax = r.index; }
      const rng = imax - imin;
      suggested = result.map((r) => ({ row: r, suggested: rng > 0 ? ((r.index - imin) / rng) * formula.scale : 0 }));
    }
    return suggested.map(({ row, suggested }) => {
      const current = currentWeightFor(row.agg.comp_type);
      return {
        competition: row.agg.competition,
        comp_type: row.agg.comp_type,
        country: row.agg.country,
        n: row.agg.n,
        index: row.index,
        suggested,
        current,
        diff: suggested - current,
        contribs: row.contribs,
      };
    });
  }, [aggregates, formula, minMax, rk.data]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const f = rows.filter((r) => {
      if (compTypeFilter !== "all" && r.comp_type !== compTypeFilter) return false;
      if (q && !r.competition.toLowerCase().includes(q)) return false;
      return true;
    });
    f.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = sortKey === "competition" ? a.competition : sortKey === "index" ? a.index : sortKey === "current" ? a.current : sortKey === "diff" ? a.diff : a.suggested;
      const bv = sortKey === "competition" ? b.competition : sortKey === "index" ? b.index : sortKey === "current" ? b.current : sortKey === "diff" ? b.diff : b.suggested;
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
    return f;
  }, [rows, search, compTypeFilter, sortKey, sortDir]);

  const setMetric = (k: MetricKey, patch: Partial<{ enabled: boolean; weight: number }>) => {
    setFormula((f) => {
      let nextEnabled = patch.enabled !== undefined ? { ...f.enabled, [k]: patch.enabled } : f.enabled;
      let nextWeights = patch.weight !== undefined ? { ...f.weights, [k]: patch.weight } : f.weights;
      // Auto-assign a sensible weight when activating a metric that is at 0,
      // so the user can use a single variable without getting a flat 0 result.
      if (patch.enabled === true && (!f.weights[k] || f.weights[k] === 0)) {
        nextWeights = { ...nextWeights, [k]: 1 };
      }
      // Enforce maxActive: when enabling would exceed the limit, drop the
      // oldest enabled metric (by METRICS order) so the new one fits.
      const limit = f.maxActive ?? 0;
      if (patch.enabled === true && limit > 0) {
        const active = METRICS.map((m) => m.key).filter((mk) => nextEnabled[mk]);
        if (active.length > limit) {
          const drop = active.filter((mk) => mk !== k).slice(0, active.length - limit);
          const e = { ...nextEnabled };
          for (const mk of drop) e[mk] = false;
          nextEnabled = e;
        }
      }
      return { ...f, enabled: nextEnabled, weights: nextWeights };
    });
  };

  const setMaxActive = (limit: number) => {
    setFormula((f) => {
      let nextEnabled = { ...f.enabled };
      if (limit > 0) {
        const active = METRICS.map((m) => m.key).filter((mk) => nextEnabled[mk]);
        if (active.length > limit) {
          // Keep the first N (by METRICS order); disable the rest.
          const keep = new Set(active.slice(0, limit));
          for (const mk of active) if (!keep.has(mk)) nextEnabled[mk] = false;
        }
      }
      return { ...f, maxActive: limit, enabled: nextEnabled };
    });
  };

  const handleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "competition" ? "asc" : "desc"); }
  };

  // --- Save/Load formulas
  const saveFormula = () => {
    const name = window.prompt("Nome da fórmula:", formula.name);
    if (!name) return;
    const next = { ...savedMap, [name]: { ...formula, name } };
    setSavedMap(next); saveSaved(next);
    localStorage.setItem(ACTIVE_KEY, name);
    toast.success(`Fórmula "${name}" guardada`);
  };
  const loadFormula = (name: string) => {
    const f = savedMap[name];
    if (!f) return;
    setFormula(f);
    localStorage.setItem(ACTIVE_KEY, name);
    toast.success(`Fórmula "${name}" carregada`);
  };
  const duplicateFormula = () => {
    const name = window.prompt("Nome da cópia:", `${formula.name} (cópia)`);
    if (!name) return;
    const next = { ...savedMap, [name]: { ...formula, name } };
    setSavedMap(next); saveSaved(next);
    toast.success(`Duplicada como "${name}"`);
  };
  const resetFormula = () => { setFormula(DEFAULT_FORMULA); toast.success("Fórmula restaurada"); };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(formula, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `formula-${formula.name}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Formula;
        setFormula({ ...DEFAULT_FORMULA, ...parsed });
        toast.success("Fórmula importada");
      } catch { toast.error("Ficheiro inválido"); }
    };
    reader.readAsText(file);
  };

  // --- Exports
  const exportTable = (kind: "xlsx" | "csv") => {
    const data = filteredRows.map((r) => ({
      Competicao: r.competition,
      Tipo: r.comp_type,
      Pais: r.country ?? "",
      Jogadores: r.n,
      Indice: Number(r.index.toFixed(4)),
      PesoSugerido: Number(r.suggested.toFixed(4)),
      PesoAtual: Number(r.current.toFixed(4)),
      Diferenca: Number(r.diff.toFixed(4)),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sugestao");
    if (kind === "xlsx") XLSX.writeFile(wb, "sugestao-pesos.xlsx");
    else {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "sugestao-pesos.csv"; a.click();
      URL.revokeObjectURL(url);
    }
  };

  // --- Chart data
  const top15 = filteredRows.slice(0, 15);
  const compareData = top15.map((r) => ({ name: r.competition, atual: Number(r.current.toFixed(2)), sugerido: Number(r.suggested.toFixed(2)) }));
  const distribution = useMemo(() => {
    // bucket indices into 10 bins
    if (!filteredRows.length) return [];
    const vals = filteredRows.map((r) => r.suggested);
    const min = Math.min(...vals), max = Math.max(...vals);
    const bins = 10;
    const w = (max - min) / bins || 1;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      bin: `${(min + i * w).toFixed(1)}–${(min + (i + 1) * w).toFixed(1)}`, n: 0,
    }));
    for (const v of vals) {
      const idx = Math.min(bins - 1, Math.floor((v - min) / w));
      buckets[idx].n++;
    }
    return buckets;
  }, [filteredRows]);

  const metricImpact = useMemo(() => {
    const data: { metric: string; impacto: number }[] = [];
    for (const m of METRICS) {
      if (!formula.enabled[m.key]) continue;
      let sum = 0;
      for (const r of filteredRows) sum += Math.abs(r.contribs[m.key] ?? 0);
      data.push({ metric: m.label, impacto: Number(sum.toFixed(2)) });
    }
    return data.sort((a, b) => b.impacto - a.impacto);
  }, [filteredRows, formula.enabled]);

  if (ps.isLoading || rk.isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> A carregar…</div>;
  }
  if (!aggregates.length) {
    return <p className="text-muted-foreground">Sem dados de competições. Importa primeiro um XLSX multi-folha em <strong>Importar Época</strong>.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SlidersHorizontal className="size-6 text-gold" />
        <div>
          <h1 className="text-2xl font-display font-bold">Sugestão de Pesos</h1>
          <p className="text-sm text-muted-foreground">Calcula automaticamente um peso para cada competição com base na qualidade média dos jogadores.</p>
        </div>
      </div>

      {/* Formula configurator */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs">Normalização</Label>
            <div className="flex items-center gap-2 mt-1 h-9">
              <Switch checked={formula.normalize} onCheckedChange={(v) => setFormula((f) => ({ ...f, normalize: v }))} />
              <span className="text-sm">{formula.normalize ? "Ativada" : "Desativada"}</span>
            </div>
          </div>
          <div>
            <Label className="text-xs">Escala</Label>
            <Select value={String(formula.scale)} onValueChange={(v) => setFormula((f) => ({ ...f, scale: Number(v) as Scale }))}>
              <SelectTrigger className="w-[120px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCALES.map((s) => <SelectItem key={s} value={String(s)}>{`0–${s}`}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Limite de métricas ativas</Label>
            <Select value={String(formula.maxActive ?? 0)} onValueChange={(v) => setMaxActive(Number(v))}>
              <SelectTrigger className="w-[160px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sem limite</SelectItem>
                <SelectItem value="1">Apenas 1 métrica</SelectItem>
                <SelectItem value="2">Apenas 2 métricas</SelectItem>
                <SelectItem value="3">Apenas 3 métricas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Fórmulas guardadas</Label>
            <Select value={formula.name} onValueChange={loadFormula}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Carregar…" /></SelectTrigger>
              <SelectContent>
                {Object.keys(savedMap).length === 0 && <SelectItem value="__none" disabled>Nenhuma guardada</SelectItem>}
                {Object.keys(savedMap).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={saveFormula}><Save className="size-4 mr-1" /> Guardar</Button>
            <Button size="sm" variant="outline" onClick={duplicateFormula}><Copy className="size-4 mr-1" /> Duplicar</Button>
            <Button size="sm" variant="outline" onClick={resetFormula}><RotateCcw className="size-4 mr-1" /> Padrão</Button>
            <Button size="sm" variant="outline" onClick={exportJson}><Download className="size-4 mr-1" /> JSON</Button>
            <label>
              <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }} />
              <Button size="sm" variant="outline" asChild><span><UploadIcon className="size-4 mr-1" /> Importar</span></Button>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {METRICS.map((m) => (
            <div key={m.key} className={`rounded-md border p-3 ${formula.enabled[m.key] ? "border-gold/40 bg-gold/5" : "border-border"}`}>
              <div className="flex items-center justify-between">
                <Label className="font-semibold">{m.label}</Label>
                <Switch checked={formula.enabled[m.key]} onCheckedChange={(v) => setMetric(m.key, { enabled: v })} />
              </div>
              <Input
                type="number"
                step="0.01"
                value={formula.weights[m.key]}
                onChange={(e) => setMetric(m.key, { weight: Number(e.target.value) || 0 })}
                disabled={!formula.enabled[m.key]}
                className="mt-2 h-8"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Pesquisar competição</Label>
            <div className="relative mt-1">
              <Search className="size-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" placeholder="Nome…" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={compTypeFilter} onValueChange={(v) => setCompTypeFilter(v as CompType | "all")}>
              <SelectTrigger className="w-[180px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="superleague">SuperLeague</SelectItem>
                <SelectItem value="national">Nacional</SelectItem>
                <SelectItem value="continental">Continental</SelectItem>
                <SelectItem value="international">Internacional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportTable("xlsx")}><Download className="size-4 mr-1" /> Excel</Button>
            <Button size="sm" variant="outline" onClick={() => exportTable("csv")}><Download className="size-4 mr-1" /> CSV</Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort("competition")} className="cursor-pointer">Competição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Jogadores</TableHead>
                <TableHead onClick={() => handleSort("index")} className="cursor-pointer text-right">Índice</TableHead>
                <TableHead onClick={() => handleSort("weight")} className="cursor-pointer text-right">Peso Sugerido</TableHead>
                <TableHead onClick={() => handleSort("current")} className="cursor-pointer text-right">Peso Atual</TableHead>
                <TableHead onClick={() => handleSort("diff")} className="cursor-pointer text-right">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => (
                <TableRow key={`${r.comp_type}|${r.competition}`}>
                  <TableCell className="font-medium">{r.competition}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.comp_type}</TableCell>
                  <TableCell className="text-right">{r.n}</TableCell>
                  <TableCell className="text-right">{fmtNum(r.index, 3)}</TableCell>
                  <TableCell className="text-right font-bold text-gold">{fmtNum(r.suggested, 2)}</TableCell>
                  <TableCell className="text-right">{fmtNum(r.current, 2)}</TableCell>
                  <TableCell className={`text-right ${r.diff > 0 ? "text-emerald-500" : r.diff < 0 ? "text-rose-500" : ""}`}>
                    {r.diff > 0 ? "+" : ""}{fmtNum(r.diff, 2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Top 15 — Peso Sugerido</h3>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={top15.map((r) => ({ name: r.competition, peso: Number(r.suggested.toFixed(2)) }))} margin={{ left: 4, right: 12, top: 8, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" angle={-40} textAnchor="end" height={70} interval={0} tick={{ fontSize: 11 }} />
                <YAxis />
                <RTooltip />
                <Bar dataKey="peso" fill="hsl(var(--primary))">
                  {top15.map((_, i) => <Cell key={i} fill={`hsl(${42 - i * 2} 80% ${55 - i}%)`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Distribuição dos Pesos</h3>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={distribution} margin={{ left: 4, right: 12, top: 8, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="bin" angle={-30} textAnchor="end" height={50} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <RTooltip />
                <Bar dataKey="n" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Atual vs Sugerido (Top 15)</h3>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={compareData} margin={{ left: 4, right: 12, top: 8, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" angle={-40} textAnchor="end" height={70} interval={0} tick={{ fontSize: 11 }} />
                <YAxis />
                <RTooltip />
                <Legend />
                <Bar dataKey="atual" fill="#94a3b8" />
                <Bar dataKey="sugerido" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Impacto de cada Métrica</h3>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={metricImpact} layout="vertical" margin={{ left: 24, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" />
                <YAxis dataKey="metric" type="category" width={80} />
                <RTooltip />
                <Bar dataKey="impacto" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
