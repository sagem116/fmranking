import { useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import { fmtNum, fmtMoney } from "@/lib/fmt";
import { loadReputations, loadClubAliases, reputationFor, onReputationChanged } from "@/lib/fm-club-reputation";
import { loadCompetitionReputationRows } from "@/lib/fm-competition-reputation";
import { CountryLink } from "@/components/CountryLink";
import { resolveClub } from "@/lib/fm-club-map";

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((v): v is string => Boolean(v?.trim())))]
    .sort((a, b) => a.localeCompare(b, "pt-PT"));
}

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
  { key: "vp", label: "Valor de Mercado" },
  { key: "salary", label: "Salário" },
];

const MONEY_STATS: StatField[] = ["vp", "salary"];

export function PlayerRankingsView({ mode, withDecay }: { mode: "weighted" | "raw"; withDecay: boolean }) {
  const data = usePlayerStatsData();
  const clubMap = data.data?.clubMap;
  const cfg = useActiveConfig();
  const [compFilter, setCompFilter] = useState<CompType | "all" | "unified">("unified");
  const [stat, setStat] = useState<StatField>("gls");
  const [filters, setFilters] = useState<PlayerFilters>(emptyFilters());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const players = data.data?.players ?? [];

  const years = useMemo(() => [...new Set(players.map((p) => p.season_year))].sort((a, b) => b - a), [players]);
  const latestYear = years[0] ?? new Date().getFullYear();
  const nationalities = useMemo(() => uniqueSorted(players.map((p) => p.nationality)), [players]);
  const clubs = useMemo(() => uniqueSorted(players.map((p) => p.club)), [players]);
  const competitions = useMemo(() => uniqueSorted(players.map((p) => p.competition)), [players]);

  const filtered = useMemo(() => {
    const f: PlayerFilters = { ...filters, comp_type: compFilter === "unified" ? "all" : compFilter };
    return filterPlayerRows(players, f, continentOf, data.data?.clubMap);
  }, [players, filters, compFilter, data.data?.clubMap]);

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
            <Label className="text-xs">País (NAC)</Label>
            <Select value={filters.country || "all"} onValueChange={(v) => { setFilters({ ...filters, country: v === "all" ? "" : v }); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {nationalities.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Clube</Label>
            <Select value={filters.club || "all"} onValueChange={(v) => { setFilters({ ...filters, club: v === "all" ? "" : v }); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clubs.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Competição</Label>
            <Select value={filters.competition || "all"} onValueChange={(v) => { setFilters({ ...filters, competition: v === "all" ? "" : v }); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {competitions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Idade min/max</Label>
            <div className="flex gap-1">
              <Input type="number" value={filters.ageMin ?? ""} onChange={(e) => { setFilters({ ...filters, ageMin: e.target.value ? Number(e.target.value) : null }); setPage(0); }} placeholder="min" />
              <Input type="number" value={filters.ageMax ?? ""} onChange={(e) => { setFilters({ ...filters, ageMax: e.target.value ? Number(e.target.value) : null }); setPage(0); }} placeholder="max" />
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
                      <th className="px-3 py-2 text-left">NAC</th>
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
                        <td className="px-3 py-2 font-medium">
                          <Link to="/jogadores/$name" params={{ name: r.player_name }} className="hover:text-primary hover:underline">
                            {r.player_name}
                          </Link>
                          {r.idu && <Badge variant="outline" className="ml-1 text-[10px]">{r.idu}</Badge>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground"><CountryLink name={r.nationality} /></td>
                        <td className="px-3 py-2">
                          {r.club ? <Link to="/clubes/$name" params={{ name: r.club }} className="hover:text-primary hover:underline">{r.club}</Link> : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {(() => {
                            const off = clubMap ? resolveClub(r.club, r.season_year, clubMap) : null;
                            const comp = off?.competition ?? r.competition;
                            return (
                              <Link to="/competicoes/$name" params={{ name: comp }} className="hover:text-primary hover:underline">
                                {comp}
                              </Link>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{compFilter === "unified" ? "—" : r.season_year}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">
                          {MONEY_STATS.includes(stat) ? fmtMoney(r.raw) : fmtNum(r.raw, 2)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {mode === "weighted" ? (MONEY_STATS.includes(stat) ? fmtMoney(r.value) : fmtNum(r.value, 2)) : ""}
                        </td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Sem resultados.</td></tr>
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
  useSyncExternalStore(
    (cb) => onReputationChanged(cb),
    () => {
      try { return (window.localStorage.getItem("fm-club-reputation-v1") ?? "") + "|" + (window.localStorage.getItem("fm-club-name-aliases-v1") ?? ""); } catch { return ""; }
    },
    () => "",
  );
  const [compFilter, setCompFilter] = useState<CompType | "all">("all");
  const [filters, setFilters] = useState<CompFilters>(emptyCompFilters());
  const [sortKey, setSortKey] = useState<string>("reputation");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const comps = data.data?.competitions ?? [];
  const playersAll = data.data?.players ?? [];
  const years = useMemo(() => [...new Set(comps.map((c) => c.season_year))].sort((a, b) => b - a), [comps]);
  const latestYear = years[0] ?? new Date().getFullYear();
  const countries = useMemo(() => uniqueSorted(comps.map((c) => c.country)), [comps]);

  // Average reputation per competition: avg of (most-frequent-club reputation) across the competition's clubs.
  const repByCompetition = useMemo(() => {
    const aliases = loadClubAliases();
    const reps = loadReputations();
    const map = new Map<string, { sum: number; n: number }>();
    const seen = new Set<string>();
    for (const p of playersAll) {
      if (!p.club) continue;
      const k = `${p.comp_type}|${p.competition}|${p.club}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const r = reputationFor(p.club, aliases, reps);
      if (r == null) continue;
      const ck = `${p.comp_type}|${p.competition}`;
      const cur = map.get(ck) ?? { sum: 0, n: 0 };
      cur.sum += r; cur.n += 1;
      map.set(ck, cur);
    }
    const out: Record<string, number> = {};
    for (const [k, v] of map) out[k] = v.n ? v.sum / v.n : 0;
    return out;
  }, [playersAll]);

  // For the "Todas" tab the user wants V.P. and Salário as TOTALS (sum across
  // every player in the competition), not weighted averages. Per other tabs
  // we keep the existing averaged behaviour.
  const totalsByCompetition = useMemo(() => {
    const map = new Map<string, { vp: number; salary: number }>();
    for (const p of playersAll) {
      const ck = `${p.comp_type}|${p.competition}`;
      const cur = map.get(ck) ?? { vp: 0, salary: 0 };
      cur.vp += p.vp || 0;
      cur.salary += p.salary || 0;
      map.set(ck, cur);
    }
    return map;
  }, [playersAll]);

  // Per-season official competition reputation (from Reputação Competições sheet).
  const compRepQuery = useQuery({
    queryKey: ["competition-reputation-rows"],
    queryFn: loadCompetitionReputationRows,
    staleTime: 60 * 60 * 1000,
  });
  const compRepBySeason = useMemo(() => {
    // competition -> Map<year, {rep, country, continent}>
    const map = new Map<string, Map<number, { rep: number; country: string | null; continent: string | null }>>();
    for (const r of compRepQuery.data ?? []) {
      const y = r.season_year ?? -1;
      const inner = map.get(r.competition) ?? new Map();
      inner.set(y, { rep: Number(r.reputation), country: r.country ?? null, continent: r.continent ?? null });
      map.set(r.competition, inner);
    }
    return map;
  }, [compRepQuery.data]);

  // "Selected season" for the new Reputação column: uses filters.yearTo, else latest.
  const selectedYear = filters.yearTo ?? latestYear;

  const officialRepFor = (competition: string): number | null => {
    const inner = compRepBySeason.get(competition);
    if (!inner) return null;
    // Pick the row for selectedYear when present, otherwise the most recent
    // available year <= selectedYear, otherwise the most recent overall.
    if (inner.has(selectedYear)) return inner.get(selectedYear)!.rep;
    const years = [...inner.keys()].sort((a, b) => b - a);
    const leq = years.find((y) => y <= selectedYear);
    if (leq != null) return inner.get(leq)!.rep;
    return years.length ? inner.get(years[0])!.rep : null;
  };

  const ranked = useMemo(() => {
    if (!cfg.data) return [];
    const f: CompFilters = { ...filters, comp_type: compFilter };
    const rows = rankCompetitions(comps, f, mode, {
      config: cfg.data.config,
      withDecay,
      latestYear,
    });
    const enriched = rows.map((r) => {
      const ck = `${r.comp_type}|${r.competition}`;
      const out = {
        ...r,
        reputation_clubs_avg: repByCompetition[ck] ?? null,
        reputation: officialRepFor(r.competition),
      };
      if (compFilter === "all") {
        const tot = totalsByCompetition.get(ck);
        if (tot) { out.vp = tot.vp; out.salary = tot.salary; }
      }
      return out;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...enriched].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey as string]; const bv = (b as Record<string, unknown>)[sortKey as string];
      const an = av == null ? -Infinity : av;
      const bn = bv == null ? -Infinity : bv;
      if (typeof an === "number" && typeof bn === "number") return (an - bn) * dir;
      return String(an ?? "").localeCompare(String(bn ?? "")) * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comps, filters, compFilter, mode, withDecay, cfg.data, latestYear, sortKey, sortDir, repByCompetition, totalsByCompetition, compRepBySeason, selectedYear]);

  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const pageRows = ranked.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const Th = ({ k, label, align = "right" as "left" | "right" }: { k: string; label: string; align?: "left" | "right" }) => (
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
          <div>
            <Label className="text-xs">País</Label>
            <Select value={filters.country || "all"} onValueChange={(v) => { setFilters({ ...filters, country: v === "all" ? "" : v }); setPage(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
                <Th k="reputation" label="Reputação" />
                <Th k="reputation_clubs_avg" label="Reputação Média dos Clubes" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={r.key} className="border-t border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{page * PAGE_SIZE + i + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    <Link to="/competicoes/$name" params={{ name: r.competition }} className="hover:text-primary hover:underline">
                      {r.competition}
                    </Link>
                  </td>
                  {showCountry && <td className="px-3 py-2">{r.country ?? "—"}</td>}
                  {showContinent && <td className="px-3 py-2">{r.continent ?? "—"}</td>}
                  <td className="px-3 py-2 text-right tabular-nums">{r.n_players}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.ca, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.cp, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.vp)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.salary)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.ra, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.rm, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.rc, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.age, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.reputation == null ? "—" : fmtNum(r.reputation, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.reputation_clubs_avg == null ? "—" : fmtNum(r.reputation_clubs_avg, 2)}</td>
                </tr>
              ))}
              {pageRows.length === 0 && (<tr><td colSpan={16} className="px-3 py-8 text-center text-muted-foreground">Sem resultados.</td></tr>)}
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
