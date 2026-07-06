import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Filter, Loader2, BarChart3, ChevronDown, X } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, LineChart, Line } from "recharts";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import type { CompType, PlayerStatRow } from "@/lib/fm-player-stats-db";
import { continentOf, CONTINENTS } from "@/lib/fm-continents";
import { fmtNum, fmtMoney } from "@/lib/fmt";

const COMP_TABS: { value: CompType | "unified"; label: string }[] = [
  { value: "unified", label: "Unificado" },
  { value: "superleague", label: "Super Leagues" },
  { value: "national", label: "Ligas Nacionais" },
  { value: "continental", label: "Continentais" },
  { value: "international", label: "Internacional" },
];

function normText(s: string | null | undefined) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((v): v is string => Boolean(v?.trim())))]
    .sort((a, b) => a.localeCompare(b, "pt-PT"));
}
const avg = (n: number, d: number) => (d > 0 ? n / d : 0);

type SortDir = "asc" | "desc";
function useSort<K extends string>(initial: K, dir: SortDir = "desc") {
  const [sortKey, setSortKey] = useState<K>(initial);
  const [sortDir, setSortDir] = useState<SortDir>(dir);
  const toggle = (k: K) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };
  return { sortKey, sortDir, toggle, setSortKey };
}
function Th({ k, label, current, dir, onClick, align = "right" }: { k: string; label: string; current: string; dir: SortDir; onClick: (k: string) => void; align?: "left" | "right" }) {
  return (
    <th
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} cursor-pointer hover:text-primary select-none uppercase text-xs`}
      onClick={() => onClick(k)}
    >
      {label} {current === k && (dir === "asc" ? "▲" : "▼")}
    </th>
  );
}

function sortRows<T extends Record<string, unknown>>(rows: T[], key: string, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key]; const bv = b[key];
    const an = av == null ? -Infinity : av;
    const bn = bv == null ? -Infinity : bv;
    if (typeof an === "number" && typeof bn === "number") return (an - bn) * sign;
    return String(an).localeCompare(String(bn), "pt-PT") * sign;
  });
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-1">{value}</p>
    </Card>
  );
}

interface DrillState { title: string; rows: PlayerStatRow[] }
function DrillDialog({ state, onClose }: { state: DrillState | null; onClose: () => void }) {
  return (
    <Dialog open={!!state} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>{state?.title}</DialogTitle></DialogHeader>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Jogador</th>
                <th className="px-3 py-2 text-left">NAC</th>
                <th className="px-3 py-2 text-left">Clube</th>
                <th className="px-3 py-2 text-left">Competição</th>
                <th className="px-3 py-2 text-right">Época</th>
                <th className="px-3 py-2 text-right">Idade</th>
                <th className="px-3 py-2 text-right">C.A.</th>
                <th className="px-3 py-2 text-right">VP</th>
              </tr>
            </thead>
            <tbody>
              {state?.rows.slice(0, 1000).map((r, i) => (
                <tr key={i} className="border-t border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-1.5"><Link to="/jogadores/$name" params={{ name: r.player_name }} className="hover:text-primary hover:underline">{r.player_name}</Link></td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.nationality ?? "—"}</td>
                  <td className="px-3 py-1.5">{r.club ? <Link to="/clubes/$name" params={{ name: r.club }} className="hover:text-primary hover:underline">{r.club}</Link> : "—"}</td>
                  <td className="px-3 py-1.5"><Link to="/competicoes/$name" params={{ name: r.competition }} className="hover:text-primary hover:underline">{r.competition}</Link></td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.season_year}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.age ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.ca ?? 0, 1)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.vp ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {state && state.rows.length > 1000 && <p className="p-3 text-xs text-muted-foreground">A mostrar primeiros 1000 de {state.rows.length}.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EstatisticasPage() {
  const { data, isLoading } = usePlayerStatsData();

  const [compFilter, setCompFilter] = useState<CompType | "unified">("unified");
  const [search, setSearch] = useState("");
  const [yearFrom, setYearFrom] = useState<string>("all");
  const [yearTo, setYearTo] = useState<string>("all");
  const [country, setCountry] = useState<string>("");
  const [continent, setContinent] = useState<string>("");
  const [competition, setCompetition] = useState<string>("");
  const [drill, setDrill] = useState<DrillState | null>(null);

  const allPlayers = data?.players ?? [];
  const years = useMemo(() => [...new Set(allPlayers.map((p) => p.season_year))].sort((a, b) => b - a), [allPlayers]);

  const competitions = useMemo(() => uniqueSorted(allPlayers.filter((p) => compFilter === "unified" || p.comp_type === compFilter).map((p) => p.competition)), [allPlayers, compFilter]);
  const countries = useMemo(() => uniqueSorted(allPlayers.map((p) => p.country)), [allPlayers]);

  const filtered = useMemo(() => {
    const yMin = yearFrom === "all" ? -Infinity : Number(yearFrom);
    const yMax = yearTo === "all" ? Infinity : Number(yearTo);
    const q = normText(search);
    return allPlayers.filter((p) => {
      if (compFilter !== "unified" && p.comp_type !== compFilter) return false;
      if (p.season_year < yMin || p.season_year > yMax) return false;
      if (country && p.country !== country) return false;
      if (continent && continentOf(p.country) !== continent) return false;
      if (competition && p.competition !== competition) return false;
      if (q) {
        const hay = normText(`${p.player_name} ${p.club ?? ""} ${p.competition} ${p.country ?? ""} ${p.nationality ?? ""}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allPlayers, compFilter, yearFrom, yearTo, country, continent, competition, search]);

  // --- Dashboard KPIs
  const kpis = useMemo(() => {
    const players = new Set<string>();
    const clubs = new Set<string>();
    const comps = new Set<string>();
    const countriesSet = new Set<string>();
    let totalVP = 0, totalSal = 0, sumAge = 0, sumCA = 0, sumCP = 0;
    for (const r of filtered) {
      players.add(r.idu ?? r.player_name);
      if (r.club) clubs.add(r.club);
      if (r.competition) comps.add(r.competition);
      if (r.country) countriesSet.add(r.country);
      totalVP += r.vp || 0; totalSal += r.salary || 0;
      sumAge += r.age || 0; sumCA += r.ca || 0; sumCP += r.cp || 0;
    }
    const n = filtered.length || 1;
    return {
      players: players.size,
      clubs: clubs.size,
      competitions: comps.size,
      countries: countriesSet.size,
      totalVP, totalSal,
      avgAge: sumAge / n, avgCA: sumCA / n, avgCP: sumCP / n,
    };
  }, [filtered]);

  // --- Competitions table
  const compsTable = useMemo(() => {
    type Row = { competition: string; comp_type: CompType; clubs: number; n_players: number; vp_total: number; vp_avg: number; sal_total: number; sal_avg: number; age: number; ca: number; cp: number; ra: number; rm: number; rc: number };
    const byKey = new Map<string, { row: Row; sCA: number; sCP: number; sRA: number; sRM: number; sRC: number; sAge: number; nCA: number; clubs: Set<string> }>();
    for (const r of filtered) {
      const key = `${r.comp_type}|${r.competition}`;
      let e = byKey.get(key);
      if (!e) {
        e = {
          row: { competition: r.competition, comp_type: r.comp_type, clubs: 0, n_players: 0, vp_total: 0, vp_avg: 0, sal_total: 0, sal_avg: 0, age: 0, ca: 0, cp: 0, ra: 0, rm: 0, rc: 0 },
          sCA: 0, sCP: 0, sRA: 0, sRM: 0, sRC: 0, sAge: 0, nCA: 0, clubs: new Set(),
        };
        byKey.set(key, e);
      }
      e.row.n_players++; if (r.club) e.clubs.add(r.club);
      e.row.vp_total += r.vp || 0; e.row.sal_total += r.salary || 0;
      e.sAge += r.age || 0; e.sCA += r.ca || 0; e.sCP += r.cp || 0; e.sRA += r.ra || 0; e.sRM += r.rm || 0; e.sRC += r.rc || 0; e.nCA++;
    }
    const rows: Row[] = [];
    for (const e of byKey.values()) {
      const n = e.nCA || 1;
      e.row.clubs = e.clubs.size;
      e.row.vp_avg = e.row.n_players ? e.row.vp_total / e.row.n_players : 0;
      e.row.sal_avg = e.row.n_players ? e.row.sal_total / e.row.n_players : 0;
      e.row.age = e.sAge / n; e.row.ca = e.sCA / n; e.row.cp = e.sCP / n;
      e.row.ra = e.sRA / n; e.row.rm = e.sRM / n; e.row.rc = e.sRC / n;
      rows.push(e.row);
    }
    return rows;
  }, [filtered]);

  // --- Nationalities per competition
  const natPerCompetition = useMemo(() => {
    const map = new Map<string, Map<string, number>>(); // competition -> nat -> n
    for (const r of filtered) {
      if (!r.competition) continue;
      const inner = map.get(r.competition) ?? new Map<string, number>();
      const n = r.nationality ?? "—";
      inner.set(n, (inner.get(n) ?? 0) + 1);
      map.set(r.competition, inner);
    }
    const rows: { competition: string; nationality: string; n: number; pct: number }[] = [];
    for (const [comp, inner] of map) {
      const total = [...inner.values()].reduce((a, b) => a + b, 0) || 1;
      for (const [nat, n] of inner) rows.push({ competition: comp, nationality: nat, n, pct: (n / total) * 100 });
    }
    return rows;
  }, [filtered]);

  // --- Players per nationality
  const byNationality = useMemo(() => {
    const map = new Map<string, { nationality: string; players: Set<string>; vp_total: number; sal_total: number; sAge: number; sCA: number; sCP: number; n: number }>();
    for (const r of filtered) {
      const key = r.nationality ?? "—";
      let e = map.get(key);
      if (!e) { e = { nationality: key, players: new Set(), vp_total: 0, sal_total: 0, sAge: 0, sCA: 0, sCP: 0, n: 0 }; map.set(key, e); }
      e.players.add(r.idu ?? r.player_name);
      e.vp_total += r.vp || 0; e.sal_total += r.salary || 0;
      e.sAge += r.age || 0; e.sCA += r.ca || 0; e.sCP += r.cp || 0; e.n++;
    }
    return [...map.values()].map((e) => ({
      nationality: e.nationality, n_players: e.players.size,
      vp_total: e.vp_total, vp_avg: avg(e.vp_total, e.n),
      sal_total: e.sal_total, sal_avg: avg(e.sal_total, e.n),
      age: avg(e.sAge, e.n), ca: avg(e.sCA, e.n), cp: avg(e.sCP, e.n),
    }));
  }, [filtered]);

  // --- Players per age
  const byAge = useMemo(() => {
    const map = new Map<number, { age: number; n: number; sVP: number; sCA: number; sCP: number }>();
    for (const r of filtered) {
      if (!r.age) continue;
      const a = Math.floor(r.age);
      const e = map.get(a) ?? { age: a, n: 0, sVP: 0, sCA: 0, sCP: 0 };
      e.n++; e.sVP += r.vp || 0; e.sCA += r.ca || 0; e.sCP += r.cp || 0;
      map.set(a, e);
    }
    return [...map.values()].sort((a, b) => a.age - b.age).map((e) => ({ age: e.age, n: e.n, vp_avg: avg(e.sVP, e.n), ca: avg(e.sCA, e.n), cp: avg(e.sCP, e.n) }));
  }, [filtered]);

  const ageBuckets = useMemo(() => {
    const defs: [string, (a: number) => boolean][] = [
      ["15–17", (a) => a >= 15 && a <= 17],
      ["18–20", (a) => a >= 18 && a <= 20],
      ["21–23", (a) => a >= 21 && a <= 23],
      ["24–26", (a) => a >= 24 && a <= 26],
      ["27–30", (a) => a >= 27 && a <= 30],
      ["31–35", (a) => a >= 31 && a <= 35],
      ["36+",   (a) => a >= 36],
    ];
    return defs.map(([label, fn]) => ({ bucket: label, n: filtered.filter((r) => r.age && fn(Math.floor(r.age))).length }));
  }, [filtered]);

  // --- Clubes/Jogadores per País / Competição / Continente
  const clubsByCountry = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of filtered) { if (!r.club || !r.country) continue; const s = m.get(r.country) ?? new Set<string>(); s.add(r.club); m.set(r.country, s); }
    return [...m.entries()].map(([k, s]) => ({ country: k, clubs: s.size }));
  }, [filtered]);
  const clubsByCompetition = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of filtered) { if (!r.club || !r.competition) continue; const s = m.get(r.competition) ?? new Set<string>(); s.add(r.club); m.set(r.competition, s); }
    return [...m.entries()].map(([k, s]) => ({ competition: k, clubs: s.size }));
  }, [filtered]);
  const playersByCompetition = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of filtered) { if (!r.competition) continue; const s = m.get(r.competition) ?? new Set<string>(); s.add(r.idu ?? r.player_name); m.set(r.competition, s); }
    return [...m.entries()].map(([k, s]) => ({ competition: k, players: s.size }));
  }, [filtered]);
  const clubsByContinent = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of filtered) { if (!r.club) continue; const c = continentOf(r.country) ?? "—"; const s = m.get(c) ?? new Set<string>(); s.add(r.club); m.set(c, s); }
    return [...m.entries()].map(([k, s]) => ({ continent: k, clubs: s.size }));
  }, [filtered]);
  const playersByContinent = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of filtered) { const c = continentOf(r.country) ?? "—"; const s = m.get(c) ?? new Set<string>(); s.add(r.idu ?? r.player_name); m.set(c, s); }
    return [...m.entries()].map(([k, s]) => ({ continent: k, players: s.size }));
  }, [filtered]);

  // --- Continents
  const byContinent = useMemo(() => {
    const m = new Map<string, { continent: string; comps: Set<string>; clubs: Set<string>; players: Set<string>; vp: number; sal: number; sCA: number; sCP: number; sAge: number; n: number }>();
    for (const r of filtered) {
      const c = continentOf(r.country) ?? "—";
      let e = m.get(c);
      if (!e) { e = { continent: c, comps: new Set(), clubs: new Set(), players: new Set(), vp: 0, sal: 0, sCA: 0, sCP: 0, sAge: 0, n: 0 }; m.set(c, e); }
      if (r.competition) e.comps.add(r.competition);
      if (r.club) e.clubs.add(r.club);
      e.players.add(r.idu ?? r.player_name);
      e.vp += r.vp || 0; e.sal += r.salary || 0; e.sCA += r.ca || 0; e.sCP += r.cp || 0; e.sAge += r.age || 0; e.n++;
    }
    return [...m.values()].map((e) => ({ continent: e.continent, comps: e.comps.size, clubs: e.clubs.size, players: e.players.size, vp: e.vp, sal: e.sal, ca: avg(e.sCA, e.n), cp: avg(e.sCP, e.n), age: avg(e.sAge, e.n) }));
  }, [filtered]);

  // --- Distributions
  const distCA = useMemo(() => {
    const buckets = [
      { label: "190+", n: 0, test: (v: number) => v >= 190 },
      { label: "180–189", n: 0, test: (v: number) => v >= 180 && v < 190 },
      { label: "170–179", n: 0, test: (v: number) => v >= 170 && v < 180 },
      { label: "160–169", n: 0, test: (v: number) => v >= 160 && v < 170 },
      { label: "150–159", n: 0, test: (v: number) => v >= 150 && v < 160 },
      { label: "140–149", n: 0, test: (v: number) => v >= 140 && v < 150 },
      { label: "<140", n: 0, test: (v: number) => v < 140 },
    ];
    for (const r of filtered) { const v = r.ca || 0; for (const b of buckets) if (b.test(v)) { b.n++; break; } }
    return buckets.map(({ label, n }) => ({ label, n }));
  }, [filtered]);
  const distVP = useMemo(() => {
    const buckets = [
      { label: "100M+", n: 0, test: (v: number) => v >= 100_000_000 },
      { label: "75–100M", n: 0, test: (v: number) => v >= 75_000_000 && v < 100_000_000 },
      { label: "50–75M", n: 0, test: (v: number) => v >= 50_000_000 && v < 75_000_000 },
      { label: "25–50M", n: 0, test: (v: number) => v >= 25_000_000 && v < 50_000_000 },
      { label: "10–25M", n: 0, test: (v: number) => v >= 10_000_000 && v < 25_000_000 },
      { label: "<10M", n: 0, test: (v: number) => v < 10_000_000 },
    ];
    for (const r of filtered) { const v = r.vp || 0; for (const b of buckets) if (b.test(v)) { b.n++; break; } }
    return buckets.map(({ label, n }) => ({ label, n }));
  }, [filtered]);
  const distSal = useMemo(() => {
    const buckets = [
      { label: "1M+/mês", n: 0, test: (v: number) => v >= 1_000_000 },
      { label: "500K–1M", n: 0, test: (v: number) => v >= 500_000 && v < 1_000_000 },
      { label: "100–500K", n: 0, test: (v: number) => v >= 100_000 && v < 500_000 },
      { label: "50–100K", n: 0, test: (v: number) => v >= 50_000 && v < 100_000 },
      { label: "10–50K", n: 0, test: (v: number) => v >= 10_000 && v < 50_000 },
      { label: "<10K", n: 0, test: (v: number) => v < 10_000 },
    ];
    for (const r of filtered) { const v = r.salary || 0; for (const b of buckets) if (b.test(v)) { b.n++; break; } }
    return buckets.map(({ label, n }) => ({ label, n }));
  }, [filtered]);

  // --- Evolução por época
  const [evoMetric, setEvoMetric] = useState<string>("players");
  const evoSeries = useMemo(() => {
    const m = new Map<number, { players: Set<string>; clubs: Set<string>; comps: Set<string>; vp: number; sal: number; sAge: number; sCA: number; sCP: number; n: number }>();
    for (const r of filtered) {
      let e = m.get(r.season_year);
      if (!e) { e = { players: new Set(), clubs: new Set(), comps: new Set(), vp: 0, sal: 0, sAge: 0, sCA: 0, sCP: 0, n: 0 }; m.set(r.season_year, e); }
      e.players.add(r.idu ?? r.player_name);
      if (r.club) e.clubs.add(r.club);
      if (r.competition) e.comps.add(r.competition);
      e.vp += r.vp || 0; e.sal += r.salary || 0; e.sAge += r.age || 0; e.sCA += r.ca || 0; e.sCP += r.cp || 0; e.n++;
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([season, e]) => ({
      season,
      players: e.players.size, clubs: e.clubs.size, competitions: e.comps.size,
      vp: e.vp, sal: e.sal, age: avg(e.sAge, e.n), ca: avg(e.sCA, e.n), cp: avg(e.sCP, e.n),
    }));
  }, [filtered]);

  const sortComps = useSort<string>("vp_total");
  const sortNat = useSort<string>("n_players");
  const sortAge = useSort<string>("age", "asc");
  const sortCont = useSort<string>("players");

  // --- Drill helpers
  const drillBy = (filterFn: (r: PlayerStatRow) => boolean, title: string) =>
    setDrill({ title, rows: filtered.filter(filterFn) });

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> A carregar…</div>;
  }
  if (!allPlayers.length) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Sem dados importados.</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BarChart3 className="size-6 text-gold" />
        <div>
          <h1 className="text-2xl font-display font-bold">Estatísticas</h1>
          <p className="text-sm text-muted-foreground">Vista agregada e exploratória de toda a base de dados.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {COMP_TABS.map((t) => (
          <Button key={t.value} size="sm" variant={compFilter === t.value ? "secondary" : "outline"} onClick={() => { setCompFilter(t.value); setCompetition(""); }}>
            {t.label}
          </Button>
        ))}
      </div>

      {(() => {
        const activeCount =
          (search ? 1 : 0) +
          (yearFrom !== "all" ? 1 : 0) +
          (yearTo !== "all" ? 1 : 0) +
          (continent ? 1 : 0) +
          (country ? 1 : 0) +
          (competition ? 1 : 0);
        return (
          <Collapsible defaultOpen={false}>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CollapsibleTrigger asChild>
                  <button type="button" className="flex items-center gap-2 hover:text-primary flex-1 text-left group">
                    <Filter className="size-4 text-primary" />
                    <span>Filtros</span>
                    {activeCount > 0 && (
                      <span className="text-xs text-primary font-semibold">({activeCount} ativo{activeCount === 1 ? "" : "s"})</span>
                    )}
                    <ChevronDown className="size-4 ml-auto opacity-60 transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                {activeCount > 0 && (
                  <Button size="sm" variant="ghost" className="h-auto py-1" onClick={() => { setSearch(""); setYearFrom("all"); setYearTo("all"); setContinent(""); setCountry(""); setCompetition(""); }}>
                    <X className="size-3.5" /> Limpar
                  </Button>
                )}
              </div>
              <CollapsibleContent className="pt-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <Label className="text-xs">Pesquisa</Label>
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="jogador/clube/competição" />
                  </div>
                  <div><Label className="text-xs">Época (de)</Label>
                    <Select value={yearFrom} onValueChange={setYearFrom}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todas</SelectItem>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Época (até)</Label>
                    <Select value={yearTo} onValueChange={setYearTo}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todas</SelectItem>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Continente</Label>
                    <Select value={continent || "all"} onValueChange={(v) => setContinent(v === "all" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todos</SelectItem>{CONTINENTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">País</Label>
                    <Select value={country || "all"} onValueChange={(v) => setCountry(v === "all" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todos</SelectItem>{countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Competição</Label>
                    <Select value={competition || "all"} onValueChange={(v) => setCompetition(v === "all" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todas</SelectItem>{competitions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })()}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3">
        <KPI label="Jogadores" value={kpis.players.toLocaleString("pt-PT")} />
        <KPI label="Clubes" value={kpis.clubs.toLocaleString("pt-PT")} />
        <KPI label="Competições" value={kpis.competitions.toLocaleString("pt-PT")} />
        <KPI label="Países" value={kpis.countries.toLocaleString("pt-PT")} />
        <KPI label="V.M. total" value={fmtMoney(kpis.totalVP)} />
        <KPI label="Salários total" value={fmtMoney(kpis.totalSal)} />
        <KPI label="Idade média" value={fmtNum(kpis.avgAge, 2)} />
        <KPI label="C.A. médio" value={fmtNum(kpis.avgCA, 2)} />
        <KPI label="C.P. médio" value={fmtNum(kpis.avgCP, 2)} />
      </div>


      {/* Tabs re-ordered by theme (Panorama → Competições → Perfil → Distribuição). */}
      <Tabs defaultValue="evo">
        <TabsList className="flex-wrap h-auto gap-1">
          <span className="hidden md:inline text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1 self-center">Panorama</span>
          <TabsTrigger value="evo">Evolução</TabsTrigger>
          <TabsTrigger value="dist">Distribuições</TabsTrigger>
          <span className="hidden md:inline text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1 self-center ml-2">Competições</span>
          <TabsTrigger value="competicoes">Ranking</TabsTrigger>
          <TabsTrigger value="jog-comp">Jog./Comp.</TabsTrigger>
          <TabsTrigger value="clubes-comp">Clubes/Comp.</TabsTrigger>
          <span className="hidden md:inline text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1 self-center ml-2">Perfil</span>
          <TabsTrigger value="jog-nac">Jog./Nac.</TabsTrigger>
          <TabsTrigger value="nat-comp">Nac./Comp.</TabsTrigger>
          <TabsTrigger value="jog-idade">Idade</TabsTrigger>
          <span className="hidden md:inline text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1 self-center ml-2">Geografia</span>
          <TabsTrigger value="cont">Continentes</TabsTrigger>
          <TabsTrigger value="clubes-pais">Clubes/País</TabsTrigger>
        </TabsList>



        <TabsContent value="competicoes">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <Th k="competition" label="Competição" align="left" current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="clubs" label="Clubes" current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="n_players" label="Jogadores" current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="vp_total" label="V.M. total" current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="vp_avg" label="V.M. médio" current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="sal_total" label="Salários total" current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="sal_avg" label="Salário médio" current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="age" label="Idade" current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="ca" label="C.A." current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="cp" label="C.P." current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="ra" label="R.A." current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="rm" label="R.M." current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                    <Th k="rc" label="R.C." current={sortComps.sortKey} dir={sortComps.sortDir} onClick={(k) => sortComps.toggle(k as string)} />
                  </tr>
                </thead>
                <tbody>
                  {sortRows(compsTable, sortComps.sortKey, sortComps.sortDir).map((r) => (
                    <tr key={`${r.comp_type}|${r.competition}`} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => drillBy((x) => x.competition === r.competition && x.comp_type === r.comp_type, `Jogadores · ${r.competition}`)}>
                      <td className="px-3 py-1.5"><Link to="/competicoes/$name" params={{ name: r.competition }} className="hover:text-primary hover:underline">{r.competition}</Link></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.clubs}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.n_players}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.vp_total)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.vp_avg)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.sal_total)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.sal_avg)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.age, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.ca, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.cp, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.ra, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.rm, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.rc, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="nat-comp">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0"><tr>
                  <th className="px-3 py-2 text-left uppercase text-xs">Competição</th>
                  <th className="px-3 py-2 text-left uppercase text-xs">Nacionalidade</th>
                  <th className="px-3 py-2 text-right uppercase text-xs">Jogadores</th>
                  <th className="px-3 py-2 text-right uppercase text-xs">%</th>
                </tr></thead>
                <tbody>
                  {natPerCompetition.sort((a, b) => a.competition.localeCompare(b.competition, "pt-PT") || b.n - a.n).map((r, i) => (
                    <tr key={i} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => drillBy((x) => x.competition === r.competition && (x.nationality ?? "—") === r.nationality, `${r.nationality} · ${r.competition}`)}>
                      <td className="px-3 py-1.5"><Link to="/competicoes/$name" params={{ name: r.competition }} className="hover:text-primary hover:underline">{r.competition}</Link></td>
                      <td className="px-3 py-1.5">{r.nationality}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.n}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmtNum(r.pct, 1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="jog-nac">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr>
                  <Th k="nationality" label="Nacionalidade" align="left" current={sortNat.sortKey} dir={sortNat.sortDir} onClick={(k) => sortNat.toggle(k as string)} />
                  <Th k="n_players" label="Jogadores" current={sortNat.sortKey} dir={sortNat.sortDir} onClick={(k) => sortNat.toggle(k as string)} />
                  <Th k="vp_total" label="V.M. total" current={sortNat.sortKey} dir={sortNat.sortDir} onClick={(k) => sortNat.toggle(k as string)} />
                  <Th k="vp_avg" label="V.M. médio" current={sortNat.sortKey} dir={sortNat.sortDir} onClick={(k) => sortNat.toggle(k as string)} />
                  <Th k="sal_total" label="Salário total" current={sortNat.sortKey} dir={sortNat.sortDir} onClick={(k) => sortNat.toggle(k as string)} />
                  <Th k="sal_avg" label="Salário médio" current={sortNat.sortKey} dir={sortNat.sortDir} onClick={(k) => sortNat.toggle(k as string)} />
                  <Th k="age" label="Idade" current={sortNat.sortKey} dir={sortNat.sortDir} onClick={(k) => sortNat.toggle(k as string)} />
                  <Th k="ca" label="C.A." current={sortNat.sortKey} dir={sortNat.sortDir} onClick={(k) => sortNat.toggle(k as string)} />
                  <Th k="cp" label="C.P." current={sortNat.sortKey} dir={sortNat.sortDir} onClick={(k) => sortNat.toggle(k as string)} />
                </tr></thead>
                <tbody>
                  {sortRows(byNationality, sortNat.sortKey, sortNat.sortDir).map((r) => (
                    <tr key={r.nationality} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => drillBy((x) => (x.nationality ?? "—") === r.nationality, `Jogadores · ${r.nationality}`)}>
                      <td className="px-3 py-1.5 font-medium">{r.nationality}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.n_players}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.vp_total)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.vp_avg)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.sal_total)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.sal_avg)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.age, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.ca, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.cp, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="jog-idade">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="overflow-hidden">
              <h3 className="px-4 pt-4 font-semibold">Por idade exata</h3>
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 sticky top-0"><tr>
                    <Th k="age" label="Idade" align="left" current={sortAge.sortKey} dir={sortAge.sortDir} onClick={(k) => sortAge.toggle(k as string)} />
                    <Th k="n" label="Jogadores" current={sortAge.sortKey} dir={sortAge.sortDir} onClick={(k) => sortAge.toggle(k as string)} />
                    <Th k="vp_avg" label="V.M. médio" current={sortAge.sortKey} dir={sortAge.sortDir} onClick={(k) => sortAge.toggle(k as string)} />
                    <Th k="ca" label="C.A." current={sortAge.sortKey} dir={sortAge.sortDir} onClick={(k) => sortAge.toggle(k as string)} />
                    <Th k="cp" label="C.P." current={sortAge.sortKey} dir={sortAge.sortDir} onClick={(k) => sortAge.toggle(k as string)} />
                  </tr></thead>
                  <tbody>
                    {sortRows(byAge, sortAge.sortKey, sortAge.sortDir).map((r) => (
                      <tr key={r.age} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => drillBy((x) => x.age != null && Math.floor(x.age) === r.age, `Jogadores com ${r.age} anos`)}>
                        <td className="px-3 py-1.5 tabular-nums">{r.age}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{r.n}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.vp_avg)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.ca, 2)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.cp, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Por intervalo</h3>
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                  <BarChart data={ageBuckets}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <RTooltip />
                    <Bar dataKey="n" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clubes-pais">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0"><tr>
                  <th className="px-3 py-2 text-left uppercase text-xs">País</th>
                  <th className="px-3 py-2 text-right uppercase text-xs">Clubes</th>
                </tr></thead>
                <tbody>
                  {[...clubsByCountry].sort((a, b) => b.clubs - a.clubs).map((r) => (
                    <tr key={r.country} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => drillBy((x) => x.country === r.country, `Jogadores · ${r.country}`)}>
                      <td className="px-3 py-1.5"><Link to="/paises/$name" params={{ name: r.country }} className="hover:text-primary hover:underline">{r.country}</Link></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.clubs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="clubes-comp">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0"><tr>
                  <th className="px-3 py-2 text-left uppercase text-xs">Competição</th>
                  <th className="px-3 py-2 text-right uppercase text-xs">Clubes</th>
                </tr></thead>
                <tbody>
                  {[...clubsByCompetition].sort((a, b) => b.clubs - a.clubs).map((r) => (
                    <tr key={r.competition} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => drillBy((x) => x.competition === r.competition, `Jogadores · ${r.competition}`)}>
                      <td className="px-3 py-1.5"><Link to="/competicoes/$name" params={{ name: r.competition }} className="hover:text-primary hover:underline">{r.competition}</Link></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.clubs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="jog-comp">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0"><tr>
                  <th className="px-3 py-2 text-left uppercase text-xs">Competição</th>
                  <th className="px-3 py-2 text-right uppercase text-xs">Jogadores</th>
                </tr></thead>
                <tbody>
                  {[...playersByCompetition].sort((a, b) => b.players - a.players).map((r) => (
                    <tr key={r.competition} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => drillBy((x) => x.competition === r.competition, `Jogadores · ${r.competition}`)}>
                      <td className="px-3 py-1.5"><Link to="/competicoes/$name" params={{ name: r.competition }} className="hover:text-primary hover:underline">{r.competition}</Link></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.players}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="cont">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="overflow-hidden">
              <h3 className="px-4 pt-4 font-semibold">Clubes por Continente</h3>
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr><th className="px-3 py-2 text-left uppercase text-xs">Continente</th><th className="px-3 py-2 text-right uppercase text-xs">Clubes</th></tr></thead>
                <tbody>{[...clubsByContinent].sort((a, b) => b.clubs - a.clubs).map((r) => (
                  <tr key={r.continent} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => drillBy((x) => (continentOf(x.country) ?? "—") === r.continent, `Clubes · ${r.continent}`)}>
                    <td className="px-3 py-1.5">{r.continent}</td><td className="px-3 py-1.5 text-right tabular-nums">{r.clubs}</td>
                  </tr>))}</tbody>
              </table>
            </Card>
            <Card className="overflow-hidden">
              <h3 className="px-4 pt-4 font-semibold">Jogadores por Continente</h3>
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr><th className="px-3 py-2 text-left uppercase text-xs">Continente</th><th className="px-3 py-2 text-right uppercase text-xs">Jogadores</th></tr></thead>
                <tbody>{[...playersByContinent].sort((a, b) => b.players - a.players).map((r) => (
                  <tr key={r.continent} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => drillBy((x) => (continentOf(x.country) ?? "—") === r.continent, `Jogadores · ${r.continent}`)}>
                    <td className="px-3 py-1.5">{r.continent}</td><td className="px-3 py-1.5 text-right tabular-nums">{r.players}</td>
                  </tr>))}</tbody>
              </table>
            </Card>
            <Card className="overflow-hidden lg:col-span-2">
              <h3 className="px-4 pt-4 font-semibold">Estatísticas por Continente</h3>
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr>
                  <Th k="continent" label="Continente" align="left" current={sortCont.sortKey} dir={sortCont.sortDir} onClick={(k) => sortCont.toggle(k as string)} />
                  <Th k="comps" label="Competições" current={sortCont.sortKey} dir={sortCont.sortDir} onClick={(k) => sortCont.toggle(k as string)} />
                  <Th k="clubs" label="Clubes" current={sortCont.sortKey} dir={sortCont.sortDir} onClick={(k) => sortCont.toggle(k as string)} />
                  <Th k="players" label="Jogadores" current={sortCont.sortKey} dir={sortCont.sortDir} onClick={(k) => sortCont.toggle(k as string)} />
                  <Th k="vp" label="V.M. total" current={sortCont.sortKey} dir={sortCont.sortDir} onClick={(k) => sortCont.toggle(k as string)} />
                  <Th k="sal" label="Salários total" current={sortCont.sortKey} dir={sortCont.sortDir} onClick={(k) => sortCont.toggle(k as string)} />
                  <Th k="ca" label="C.A." current={sortCont.sortKey} dir={sortCont.sortDir} onClick={(k) => sortCont.toggle(k as string)} />
                  <Th k="cp" label="C.P." current={sortCont.sortKey} dir={sortCont.sortDir} onClick={(k) => sortCont.toggle(k as string)} />
                  <Th k="age" label="Idade" current={sortCont.sortKey} dir={sortCont.sortDir} onClick={(k) => sortCont.toggle(k as string)} />
                </tr></thead>
                <tbody>
                  {sortRows(byContinent, sortCont.sortKey, sortCont.sortDir).map((r) => (
                    <tr key={r.continent} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => drillBy((x) => (continentOf(x.country) ?? "—") === r.continent, `Jogadores · ${r.continent}`)}>
                      <td className="px-3 py-1.5">{r.continent}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.comps}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.clubs}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.players}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.vp)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(r.sal)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.ca, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.cp, 2)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r.age, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dist">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4"><h3 className="font-semibold mb-3">Distribuição C.A.</h3>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer><BarChart data={distCA}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis /><RTooltip />
                  <Bar dataKey="n" fill="hsl(var(--primary))" />
                </BarChart></ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4"><h3 className="font-semibold mb-3">Distribuição Valor de Mercado</h3>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer><BarChart data={distVP}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis /><RTooltip />
                  <Bar dataKey="n" fill="hsl(var(--primary))" />
                </BarChart></ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4 lg:col-span-2"><h3 className="font-semibold mb-3">Distribuição Salarial</h3>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer><BarChart data={distSal}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis /><RTooltip />
                  <Bar dataKey="n" fill="hsl(var(--primary))" />
                </BarChart></ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="evo">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Evolução por época</h3>
              <Select value={evoMetric} onValueChange={setEvoMetric}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="players">Nº jogadores</SelectItem>
                  <SelectItem value="clubs">Nº clubes</SelectItem>
                  <SelectItem value="competitions">Nº competições</SelectItem>
                  <SelectItem value="vp">Valor de Mercado mundial</SelectItem>
                  <SelectItem value="sal">Massa salarial mundial</SelectItem>
                  <SelectItem value="age">Idade média</SelectItem>
                  <SelectItem value="ca">C.A. médio</SelectItem>
                  <SelectItem value="cp">C.P. médio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={evoSeries}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="season" />
                  <YAxis tickFormatter={(v) => (["vp", "sal"].includes(evoMetric) ? fmtMoney(Number(v)) : fmtNum(Number(v), 1))} width={80} />
                  <RTooltip formatter={(v: number) => (["vp", "sal"].includes(evoMetric) ? fmtMoney(Number(v)) : fmtNum(Number(v), 2))} labelFormatter={(l) => `Época ${l}`} />
                  <Line type="monotone" dataKey={evoMetric} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <DrillDialog state={drill} onClose={() => setDrill(null)} />
    </div>
  );
}