import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, Loader2 } from "lucide-react";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { useActiveConfig } from "@/lib/useRankings";
import { rankPlayers, filterPlayerRows, emptyFilters, rankCompetitions, emptyCompFilters, type StatField, type PlayerFilters, type CompFilters, type CompetitionRankRow } from "@/lib/fm-player-rankings";
import type { CompType, PlayerStatRow } from "@/lib/fm-player-stats-db";
import { continentOf, CONTINENTS } from "@/lib/fm-continents";
import { fmtNum } from "@/lib/fmt";

const COMP_FILTERS: { value: CompType | "all" | "unified"; label: string }[] = [
  { value: "unified", label: "Unificado" },
  { value: "superleague", label: "Super Leagues" },
  { value: "national", label: "Ligas Nacionais" },
  { value: "continental", label: "Continentais" },
  { value: "international", label: "Internacional" },
];

const STAT_TABS: { key: StatField; label: string }[] = [
  { key: "gls", label: "Golos" },
  { key: "ast", label: "Assistências" },
  { key: "games", label: "Jogos" },
  { key: "hdj", label: "Homem do Jogo" },
  { key: "ca", label: "C.A." },
  { key: "cp", label: "C.P." },
];

export function PlayerRankingsView({ mode, withDecay }: { mode: "weighted" | "raw"; withDecay: boolean }) {
  const data = usePlayerStatsData();
  const cfg = useActiveConfig();
  const [compFilter, setCompFilter] = useState<CompType | "all" | "unified">("unified");
  const [stat, setStat] = useState<StatField>("gls");
  const [filters, setFilters] = useState<PlayerFilters>(emptyFilters());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const players = data.data?.players ?? [];

  const years = useMemo(() => [...new Set(players.map((p) => p.season_year))].sort((a, b) => b - a), [players]);
  const latestYear = years[0] ?? new Date().getFullYear();

  const filtered = useMemo(() => {
    const f: PlayerFilters = { ...filters, comp_type: compFilter === "unified" ? "all" : compFilter };
    return filterPlayerRows(players, f, continentOf);
  }, [players, filters, compFilter]);

  const ranked = useMemo(() => {
    if (!cfg.data) return [];
    return rankPlayers(filtered, stat, compFilter === "unified", mode, {
      config: cfg.data.config,
      withDecay,
      latestYear,
    });
  }, [filtered, stat, compFilter, mode, withDecay, cfg.data, latestYear]);

  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const pageRows = ranked.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (data.isLoading || cfg.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> A carregar…
      </div>
    );
  }
  if (!players.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Sem dados importados. Faça upload de um Excel multi-folha em <strong>Importar</strong>.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {COMP_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={compFilter === f.value ? "secondary" : "outline"}
            onClick={() => { setCompFilter(f.value); setPage(0); }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="size-4 text-primary" /> Filtros inteligentes
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <Label className="text-xs">Pesquisa</Label>
            <Input value={filters.search} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(0); }} placeholder="jogador/clube/competição/país" />
          </div>
          <div>
            <Label className="text-xs">Época (de)</Label>
            <Select value={filters.yearFrom?.toString() ?? "all"} onValueChange={(v) => { setFilters({ ...filters, yearFrom: v === "all" ? null : Number(v) }); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Época (até)</Label>
            <Select value={filters.yearTo?.toString() ?? "all"} onValueChange={(v) => { setFilters({ ...filters, yearTo: v === "all" ? null : Number(v) }); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Continente</Label>
            <Select value={filters.continent || "all"} onValueChange={(v) => { setFilters({ ...filters, continent: v === "all" ? "" : v }); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {CONTINENTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">País</Label>
            <Input value={filters.country} onChange={(e) => { setFilters({ ...filters, country: e.target.value }); setPage(0); }} placeholder="exato" />
          </div>
          <div>
            <Label className="text-xs">Clube</Label>
            <Input value={filters.club} onChange={(e) => { setFilters({ ...filters, club: e.target.value }); setPage(0); }} placeholder="exato" />
          </div>
          <div>
            <Label className="text-xs">Idade min/max</Label>
            <div className="flex gap-1">
              <Input type="number" value={filters.ageMin ?? ""} onChange={(e) => setFilters({ ...filters, ageMin: e.target.value ? Number(e.target.value) : null })} placeholder="min" />
              <Input type="number" value={filters.ageMax ?? ""} onChange={(e) => setFilters({ ...filters, ageMax: e.target.value ? Number(e.target.value) : null })} placeholder="max" />
            </div>
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="ghost" onClick={() => { setFilters(emptyFilters()); setPage(0); }}>Limpar</Button>
          </div>
        </div>
      </Card>

      <Tabs value={stat} onValueChange={(v) => { setStat(v as StatField); setPage(0); }}>
        <TabsList>
          {STAT_TABS.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
        {STAT_TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Jogador</th>
                      <th className="px-3 py-2 text-left">Clube</th>
                      <th className="px-3 py-2 text-left">Competição</th>
                      <th className="px-3 py-2 text-left">Época</th>
                      <th className="px-3 py-2 text-right">{t.label}</th>
                      <th className="px-3 py-2 text-right">{mode === "weighted" ? "Ponderado" : ""}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => (
                      <tr key={r.key} className="border-t border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">{page * PAGE_SIZE + i + 1}</td>
                        <td className="px-3 py-2 font-medium">{r.player_name} {r.idu && <Badge variant="outline" className="ml-1 text-[10px]">{r.idu}</Badge>}</td>
                        <td className="px-3 py-2">{r.club ?? "—"}</td>
                        <td className="px-3 py-2">{r.competition}</td>
                        <td className="px-3 py-2 tabular-nums">{compFilter === "unified" ? "—" : r.season_year}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(r.raw)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{mode === "weighted" ? fmtNum(r.value, 1) : ""}</td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Sem resultados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between p-3 text-xs text-muted-foreground border-t border-border">
                <span>{ranked.length} jogadores · página {page + 1}/{totalPages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Seguinte</Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export function CompetitionRankingsView({ mode, withDecay }: { mode: "weighted" | "raw"; withDecay: boolean }) {
  const data = usePlayerStatsData();
  const cfg = useActiveConfig();
  const [compFilter, setCompFilter] = useState<CompType | "all">("all");
  const [filters, setFilters] = useState<CompFilters>(emptyCompFilters());
  const [sortKey, setSortKey] = useState<keyof CompetitionRankRow>("ca");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const comps = data.data?.competitions ?? [];
  const years = useMemo(() => [...new Set(comps.map((c) => c.season_year))].sort((a, b) => b - a), [comps]);
  const latestYear = years[0] ?? new Date().getFullYear();

  const ranked = useMemo(() => {
    if (!cfg.data) return [];
    const f: CompFilters = { ...filters, comp_type: compFilter };
    const rows = rankCompetitions(comps, f, mode, {
      config: cfg.data.config,
      withDecay,
      latestYear,
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [comps, filters, compFilter, mode, withDecay, cfg.data, latestYear, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const pageRows = ranked.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const Th = ({ k, label, align = "right" as "left" | "right" }: { k: keyof CompetitionRankRow; label: string; align?: "left" | "right" }) => (
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
  if (!comps.length) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Sem dados importados.</Card>;
  }

  const showCountry = compFilter === "national";
  const showContinent = compFilter === "continental";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all","superleague","national","continental","international"] as const).map((v) => (
          <Button key={v} size="sm" variant={compFilter === v ? "secondary" : "outline"} onClick={() => { setCompFilter(v); setPage(0); }}>
            {v === "all" ? "Todas" : v === "superleague" ? "Super Leagues" : v === "national" ? "Ligas Nacionais" : v === "continental" ? "Continentais" : "Internacional"}
          </Button>
        ))}
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Filter className="size-4 text-primary" /> Filtros</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <Label className="text-xs">Pesquisa</Label>
            <Input value={filters.search} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(0); }} placeholder="competição/país/continente" />
          </div>
          <div>
            <Label className="text-xs">Época (de)</Label>
            <Select value={filters.yearFrom?.toString() ?? "all"} onValueChange={(v) => { setFilters({ ...filters, yearFrom: v === "all" ? null : Number(v) }); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Época (até)</Label>
            <Select value={filters.yearTo?.toString() ?? "all"} onValueChange={(v) => { setFilters({ ...filters, yearTo: v === "all" ? null : Number(v) }); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Continente</Label>
            <Select value={filters.continent || "all"} onValueChange={(v) => { setFilters({ ...filters, continent: v === "all" ? "" : v }); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{CONTINENTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <Th k="competition" label="Competição" align="left" />
                {showCountry && <Th k="country" label="País" align="left" />}
                {showContinent && <Th k="continent" label="Continente" align="left" />}
                <Th k="n_players" label="Jogadores" />
                <Th k="ca" label="CA" />
                <Th k="cp" label="CP" />
                <Th k="vp" label="VP" />
                <Th k="salary" label="Salário" />
                <Th k="ra" label="RA" />
                <Th k="rm" label="RM" />
                <Th k="rc" label="RC" />
                <Th k="age" label="Idade" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={r.key} className="border-t border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{page * PAGE_SIZE + i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.competition}</td>
                  {showCountry && <td className="px-3 py-2">{r.country ?? "—"}</td>}
                  {showContinent && <td className="px-3 py-2">{r.continent ?? "—"}</td>}
                  <td className="px-3 py-2 text-right tabular-nums">{r.n_players}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.ca, 1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.cp, 1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.vp, 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.salary, 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.ra, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.rm, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.rc, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.age, 1)}</td>
                </tr>
              ))}
              {pageRows.length === 0 && (<tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">Sem resultados.</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-3 text-xs text-muted-foreground border-t border-border">
          <span>{ranked.length} competições · página {page + 1}/{totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Seguinte</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// dummy reference to satisfy TS unused import
export type _PSR = PlayerStatRow;
