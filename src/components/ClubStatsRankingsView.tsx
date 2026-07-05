import { useMemo, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Filter, Loader2, GitCompare, X, Rows3, Rows2 } from "lucide-react";
import { DrillCell } from "@/components/DrillCell";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { useActiveConfig } from "@/lib/useRankings";
import type { CompType, PlayerStatRow } from "@/lib/fm-player-stats-db";
import { compWeight, decayFactor } from "@/lib/fm-player-rankings";
import { continentOf, CONTINENTS } from "@/lib/fm-continents";
import { resolveClub } from "@/lib/fm-club-map";
import { fmtNum, fmtMoney } from "@/lib/fmt";
import { loadReputations, loadClubAliases, reputationFor, onReputationChanged } from "@/lib/fm-club-reputation";

type ColKey = "gls" | "ast" | "ca" | "cp" | "ra" | "rm" | "rc" | "vp" | "salary" | "age" | "reputation" | "n_players" | "games";
interface PlayerDrillRow { id: string; name: string; games: number; gls: number; ast: number; }
interface Row {
  club: string;
  country: string | null;
  continent: string | null;
  competitions: string[];
  n_players: number;
  games: number;
  gls: number;
  ast: number;
  ca: number;
  cp: number;
  ra: number;
  rm: number;
  rc: number;
  vp: number;
  salary: number;
  age: number;
  reputation: number | null;
  players: PlayerDrillRow[];
}

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
  return [...new Set(values.filter((v): v is string => Boolean(v?.trim())))].sort((a, b) => a.localeCompare(b, "pt-PT"));
}

function useReputationStore() {
  return useSyncExternalStore(
    (cb) => onReputationChanged(cb),
    () => {
      try { return (typeof window !== "undefined" ? window.localStorage.getItem("fm-club-reputation-v1") : "") + "|" + (typeof window !== "undefined" ? window.localStorage.getItem("fm-club-name-aliases-v1") : ""); } catch { return ""; }
    },
    () => "",
  );
}

export function ClubStatsRankingsView({ mode, withDecay }: { mode: "weighted" | "raw"; withDecay: boolean }) {
  const data = usePlayerStatsData();
  const cfg = useActiveConfig();
  useReputationStore();

  const [compFilter, setCompFilter] = useState<CompType | "unified">("unified");
  const [search, setSearch] = useState("");
  const [yearFrom, setYearFrom] = useState<string>("all");
  const [yearTo, setYearTo] = useState<string>("all");
  const [country, setCountry] = useState<string>("");
  const [continent, setContinent] = useState<string>("");
  const [competition, setCompetition] = useState<string>("");
  const [sortKey, setSortKey] = useState<ColKey>("reputation");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  // Comparison selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const toggleSelected = (club: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(club)) next.delete(club); else next.add(club);
      return next;
    });
  };
  const clearSelected = () => setSelected(new Set());

  const players = data.data?.players ?? [];
  const clubMap = data.data?.clubMap;

  const years = useMemo(() => [...new Set(players.map((p) => p.season_year))].sort((a, b) => b - a), [players]);
  const latestYear = years[0] ?? new Date().getFullYear();
  const competitions = useMemo(
    () => uniqueSorted(
      players.filter((p) => compFilter === "unified" || p.comp_type === compFilter).map((p) => p.competition),
    ),
    [players, compFilter],
  );

  const clubCountry = useMemo(() => {
    const out: Record<string, string> = {};
    if (!clubMap) return out;
    for (const [club, m] of clubMap.latest) {
      if (m.country) out[club] = m.country;
    }
    return out;
  }, [clubMap]);

  const countries = useMemo(() => uniqueSorted(Object.values(clubCountry)), [clubCountry]);

  const rows = useMemo<Row[]>(() => {
    if (!cfg.data) return [];
    const yMin = yearFrom === "all" ? -Infinity : Number(yearFrom);
    const yMax = yearTo === "all" ? Infinity : Number(yearTo);
    const q = normText(search);
    const aliases = loadClubAliases();
    const reps = loadReputations();

    type Agg = {
      club: string; country: string | null; competitions: Set<string>;
      playerIds: Set<string>; games: number;
      gls: number; ast: number;
      sumCA: number; sumCP: number; sumRA: number; sumRM: number; sumRC: number;
      sumVP: number; sumSalary: number; sumAge: number; wSum: number;
      sumVPRaw: number; sumSalaryRaw: number;
      playerAgg: Map<string, { name: string; games: number; gls: number; ast: number }>;
    };
    const map = new Map<string, Agg>();
    const filtered: PlayerStatRow[] = [];
    for (const p of players) {
      if (!p.club) continue;
      if (clubMap && !resolveClub(p.club, p.season_year, clubMap, { strict: true })) continue;
      if (p.season_year < yMin || p.season_year > yMax) continue;
      if (compFilter !== "unified" && p.comp_type !== compFilter) continue;
      const cc = clubCountry[p.club] ?? null;
      if (country && cc !== country) continue;
      if (continent && continentOf(cc) !== continent) continue;
      if (competition && p.competition !== competition) continue;
      filtered.push(p);
    }
    for (const p of filtered) {
      const club = p.club!;
      const w = mode === "weighted" ? compWeight(cfg.data.config, p) * decayFactor(cfg.data.config, p.season_year, latestYear, withDecay) : 1;
      let a = map.get(club);
      if (!a) {
        a = { club, country: clubCountry[club] ?? null, competitions: new Set<string>(),
          playerIds: new Set<string>(), games: 0,
          gls: 0, ast: 0,
          sumCA: 0, sumCP: 0, sumRA: 0, sumRM: 0, sumRC: 0, sumVP: 0, sumSalary: 0, sumAge: 0, wSum: 0,
          sumVPRaw: 0, sumSalaryRaw: 0,
          playerAgg: new Map() };
        map.set(club, a);
      }
      // Distinct player key: prefer IDU, fall back to normalized name.
      const pid = (p.idu && p.idu.trim()) ? `idu:${p.idu.trim()}` : `nm:${normText(p.player_name)}`;
      a.playerIds.add(pid);
      a.games += p.games || 0;
      if (p.competition && (p.comp_type === "continental" || p.comp_type === "international")) {
        a.competitions.add(p.competition);
      }
      a.gls += (p.gls || 0) * (mode === "weighted" ? w : 1);
      a.ast += (p.ast || 0) * (mode === "weighted" ? w : 1);
      a.sumCA += (p.ca || 0) * w;
      a.sumCP += (p.cp || 0) * w;
      a.sumRA += (p.ra || 0) * w;
      a.sumRM += (p.rm || 0) * w;
      a.sumRC += (p.rc || 0) * w;
      a.sumVP += (p.vp || 0) * w;
      a.sumSalary += (p.salary || 0) * w;
      a.sumAge += (p.age || 0) * w;
      a.wSum += w;
      a.sumVPRaw += p.vp || 0;
      a.sumSalaryRaw += p.salary || 0;
      const pa = a.playerAgg.get(pid);
      if (pa) {
        pa.games += p.games || 0;
        pa.gls += p.gls || 0;
        pa.ast += p.ast || 0;
      } else {
        a.playerAgg.set(pid, { name: p.player_name || pid, games: p.games || 0, gls: p.gls || 0, ast: p.ast || 0 });
      }
    }
    if (clubMap) {
      for (const [season, sm] of clubMap.bySeason) {
        if (season < yMin || season > yMax) continue;
        for (const [club, m] of sm) {
          const a = map.get(club);
          if (!a) continue;
          if (compFilter !== "unified" && compFilter !== m.comp_type) continue;
          if (m.competition) a.competitions.add(m.competition);
        }
      }
    }
    let out: Row[] = [...map.values()].map((a) => {
      const k = a.wSum || 1;
      const comps = [...a.competitions].sort((x, y) => x.localeCompare(y, "pt-PT"));
      const players: PlayerDrillRow[] = [...a.playerAgg.entries()]
        .map(([id, v]) => ({ id, name: v.name, games: v.games, gls: v.gls, ast: v.ast }))
        .sort((x, y) => y.games - x.games || y.gls - x.gls);
      return {
        club: a.club, country: a.country,
        continent: continentOf(a.country),
        competitions: comps,
        n_players: a.playerIds.size,
        games: a.games,
        gls: a.gls, ast: a.ast,
        ca: a.sumCA / k, cp: a.sumCP / k, ra: a.sumRA / k, rm: a.sumRM / k, rc: a.sumRC / k,
        vp: compFilter === "unified" ? a.sumVPRaw : a.sumVP / k,
        salary: compFilter === "unified" ? a.sumSalaryRaw : a.sumSalary / k,
        age: a.sumAge / k,
        reputation: reputationFor(a.club, aliases, reps),
        players,
      };
    });
    if (q) out = out.filter((r) => normText(`${r.club} ${r.country ?? ""}`).includes(q));
    return out;
  }, [players, cfg.data, mode, withDecay, latestYear, compFilter, yearFrom, yearTo, country, continent, competition, search, clubCountry, clubMap]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const an = av == null ? -Infinity : av;
      const bn = bv == null ? -Infinity : bv;
      if (typeof an === "number" && typeof bn === "number") return (an - bn) * dir;
      return String(an).localeCompare(String(bn)) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectedRows = useMemo(() => sorted.filter((r) => selected.has(r.club)), [sorted, selected]);

  const Th = ({ k, label, align = "right" as "left" | "right" }: { k: ColKey; label: string; align?: "left" | "right" }) => (
    <th
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} cursor-pointer hover:text-primary select-none`}
      onClick={() => {
        if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortKey(k); setSortDir("desc"); }
      }}
    >
      {label} {sortKey === k && (sortDir === "asc" ? "▲" : "▼")}
    </th>
  );

  if (data.isLoading || cfg.isLoading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> A carregar…</div>;
  }
  if (!players.length) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Sem dados importados.</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {COMP_TABS.map((t) => (
          <Button key={t.value} size="sm" variant={compFilter === t.value ? "secondary" : "outline"} onClick={() => { setCompFilter(t.value); setCompetition(""); setPage(0); }}>
            {t.label}
          </Button>
        ))}
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selected.size} selecionado{selected.size === 1 ? "" : "s"}</span>
            <Button size="sm" variant="ghost" onClick={clearSelected}><X className="size-3.5" /> Limpar</Button>
            <Button size="sm" variant="default" disabled={selected.size < 2} onClick={() => setCompareOpen(true)}>
              <GitCompare className="size-3.5" /> Comparar
            </Button>
          </div>
        )}
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Filter className="size-4 text-primary" /> Filtros</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <Label className="text-xs">Pesquisa</Label>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="clube ou país" />
          </div>
          <div>
            <Label className="text-xs">Época (de)</Label>
            <Select value={yearFrom} onValueChange={(v) => { setYearFrom(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Época (até)</Label>
            <Select value={yearTo} onValueChange={(v) => { setYearTo(v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Continente</Label>
            <Select value={continent || "all"} onValueChange={(v) => { setContinent(v === "all" ? "" : v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{CONTINENTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">País</Label>
            <Select value={country || "all"} onValueChange={(v) => { setCountry(v === "all" ? "" : v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Competição</Label>
            <Select value={competition || "all"} onValueChange={(v) => { setCompetition(v === "all" ? "" : v); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem>{competitions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setYearFrom("all"); setYearTo("all"); setContinent(""); setCountry(""); setCompetition(""); setPage(0); }}>Limpar</Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase">
              <tr>
                <th className="px-2 py-2 w-8"></th>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Clube</th>
                <th className="px-3 py-2 text-left">{compFilter === "continental" || compFilter === "international" ? "Continente" : "País"}</th>
                <th className="px-3 py-2 text-left">Competição</th>
                <Th k="n_players" label="Nº jog." />
                <Th k="games" label="Jogos" />
                <Th k="gls" label="Golos" />
                <Th k="ast" label="Assist." />
                <Th k="ca" label="C.A." />
                <Th k="cp" label="C.P." />
                <Th k="ra" label="R.A." />
                <Th k="rm" label="R.M." />
                <Th k="rc" label="R.C." />
                <Th k="vp" label="V.P." />
                <Th k="salary" label="Salário" />
                <Th k="age" label="Idade" />
                <Th k="reputation" label="Reputação" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={r.club} className={`border-t border-border/50 hover:bg-muted/30 ${selected.has(r.club) ? "bg-primary/5" : ""}`}>
                  <td className="px-2 py-2">
                    <Checkbox checked={selected.has(r.club)} onCheckedChange={() => toggleSelected(r.club)} aria-label={`Selecionar ${r.club}`} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{page * PAGE_SIZE + i + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    <Link to="/clubes/$name" params={{ name: r.club }} className="hover:text-primary hover:underline">{r.club}</Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {(compFilter === "continental" || compFilter === "international") ? (r.continent ?? "—") : (r.country ?? "—")}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.competitions.length === 0 ? (
                      "—"
                    ) : r.competitions.length === 1 ? (
                      <Link to="/competicoes/$name" params={{ name: r.competitions[0] }} className="hover:text-primary hover:underline">{r.competitions[0]}</Link>
                    ) : (
                      <span title={r.competitions.join(", ")}>{r.competitions.length} competições</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.n_players}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.games}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.gls, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.ast, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.ca, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.cp, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.ra, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.rm, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.rc, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.vp)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.salary)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.age, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.reputation == null ? "—" : fmtNum(r.reputation, 2)}</td>
                </tr>
              ))}
              {pageRows.length === 0 && (<tr><td colSpan={18} className="px-3 py-8 text-center text-muted-foreground">Sem resultados.</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-3 text-xs text-muted-foreground border-t border-border">
          <span>{sorted.length} clubes · página {page + 1}/{totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Seguinte</Button>
          </div>
        </div>
      </Card>

      <CompareDialog open={compareOpen} onOpenChange={setCompareOpen} rows={selectedRows} />
    </div>
  );
}

const COMPARE_METRICS: { key: ColKey; label: string; fmt: (v: number | null) => string; higherBetter: boolean }[] = [
  { key: "reputation", label: "Reputação", fmt: (v) => v == null ? "—" : fmtNum(v, 2), higherBetter: true },
  { key: "n_players", label: "Nº jogadores", fmt: (v) => v == null ? "—" : String(v), higherBetter: true },
  { key: "games", label: "Jogos", fmt: (v) => v == null ? "—" : String(v), higherBetter: true },
  { key: "gls", label: "Golos", fmt: (v) => fmtNum(v ?? 0, 2), higherBetter: true },
  { key: "ast", label: "Assistências", fmt: (v) => fmtNum(v ?? 0, 2), higherBetter: true },
  { key: "ca", label: "C.A.", fmt: (v) => fmtNum(v ?? 0, 2), higherBetter: true },
  { key: "cp", label: "C.P.", fmt: (v) => fmtNum(v ?? 0, 2), higherBetter: true },
  { key: "ra", label: "R.A.", fmt: (v) => fmtNum(v ?? 0, 2), higherBetter: true },
  { key: "rm", label: "R.M.", fmt: (v) => fmtNum(v ?? 0, 2), higherBetter: true },
  { key: "rc", label: "R.C.", fmt: (v) => fmtNum(v ?? 0, 2), higherBetter: true },
  { key: "vp", label: "V.P.", fmt: (v) => fmtMoney(v ?? 0), higherBetter: true },
  { key: "salary", label: "Salário", fmt: (v) => fmtMoney(v ?? 0), higherBetter: true },
  { key: "age", label: "Idade média", fmt: (v) => fmtNum(v ?? 0, 2), higherBetter: false },
];

function CompareDialog({ open, onOpenChange, rows }: { open: boolean; onOpenChange: (v: boolean) => void; rows: Row[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Comparação de clubes ({rows.length})</DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Métrica</th>
                {rows.map((r) => (
                  <th key={r.club} className="px-3 py-2 text-right whitespace-nowrap">
                    <Link to="/clubes/$name" params={{ name: r.club }} className="hover:text-primary hover:underline">{r.club}</Link>
                    <div className="text-[10px] font-normal text-muted-foreground normal-case">{r.country ?? "—"}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_METRICS.map((m) => {
                const vals = rows.map((r) => r[m.key] as number | null);
                const nums = vals.filter((v): v is number => typeof v === "number");
                const best = nums.length ? (m.higherBetter ? Math.max(...nums) : Math.min(...nums)) : null;
                return (
                  <tr key={m.key} className="border-t border-border/50">
                    <td className="px-3 py-2 font-medium">{m.label}</td>
                    {rows.map((r, i) => {
                      const v = vals[i];
                      const isBest = best != null && typeof v === "number" && v === best && rows.length > 1;
                      return (
                        <td key={r.club} className={`px-3 py-2 text-right tabular-nums ${isBest ? "text-primary font-semibold" : ""}`}>
                          {m.fmt(v)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
