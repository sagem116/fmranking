import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Target, Trophy, TrendingUp, Bell, Trash2, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { useRankings } from "@/lib/useRankings";
import { type Subject, type DesafioResult } from "@/lib/fm-desafios";
import { fmtPts } from "@/lib/fmt";
import {
  loadHighlightBatches,
  clearHighlights,
  saveHighlightBatches,
  type Highlight,
} from "@/lib/fm-notifications";

export const Route = createFileRoute("/desafios-dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard de Desafios — FM World Rankings" },
      { name: "description", content: "KPIs, evolução temporal e top entidades por bónus de desafios." },
    ],
  }),
  component: DesafiosDashboardPage,
});

const SUBJECT_LABEL: Record<Subject, string> = {
  clubs: "Clubes",
  coaches: "Treinadores",
  countries: "Países",
};

const KIND_TONE: Record<Highlight["kind"], string> = {
  "bonus-achievement": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "challenge": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "points-record": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "unbeaten": "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const KIND_LABEL: Record<Highlight["kind"], string> = {
  "bonus-achievement": "Conquista",
  "challenge": "Desafio",
  "points-record": "Recorde pts",
  "unbeaten": "Invencível",
};

function DesafiosDashboardPage() {
  const { data, isLoading } = useRankings();
  const [batches, setBatches] = useState(() => loadHighlightBatches());
  const [subject, setSubject] = useState<Subject>("clubs");

  // Filters
  const [search, setSearch] = useState("");
  const [yearFrom, setYearFrom] = useState<string>("");
  const [yearTo, setYearTo] = useState<string>("");
  const [country, setCountry] = useState<string>("__all__");
  const [desafioId, setDesafioId] = useState<string>("__all__");

  const desafios = data?.desafios ?? [];
  const results: DesafioResult[] = data?.desafioResults ?? [];
  const clubCountry = (data?.data.clubCountry ?? {}) as Record<string, string | null>;
  const allYears = data?.ranks.years ?? [];

  // Build coach -> set of countries (via their clubs across data.coaches)
  const coachCountries = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of data?.data.coaches ?? []) {
      if (!c.club_name) continue;
      const ctr = clubCountry[c.club_name];
      if (!ctr) continue;
      const set = map.get(c.name) ?? new Set<string>();
      set.add(ctr);
      map.set(c.name, set);
    }
    return map;
  }, [data, clubCountry]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const v of Object.values(clubCountry)) if (v) set.add(v);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [clubCountry]);

  const yMin = yearFrom ? Number(yearFrom) : -Infinity;
  const yMax = yearTo ? Number(yearTo) : Infinity;
  const q = search.trim().toLowerCase();

  const entityMatchesCountry = (subj: Subject, entity: string): boolean => {
    if (country === "__all__") return true;
    if (subj === "clubs") return clubCountry[entity] === country;
    if (subj === "countries") return entity === country;
    return coachCountries.get(entity)?.has(country) ?? false;
  };

  // Filtered results — keep matches whose at least one year is in range
  const filtered = useMemo(() => {
    const out: { desafio: DesafioResult["desafio"]; match: DesafioResult["matches"][number]; yearsInRange: number[] }[] = [];
    for (const r of results) {
      if (desafioId !== "__all__" && r.desafio.id !== desafioId) continue;
      for (const m of r.matches) {
        if (q && !m.entity.toLowerCase().includes(q)) continue;
        if (!entityMatchesCountry(m.subject, m.entity)) continue;
        const yearsInRange = m.years.filter((y) => y >= yMin && y <= yMax);
        if (yearsInRange.length === 0) continue;
        out.push({ desafio: r.desafio, match: m, yearsInRange });
      }
    }
    return out;
  }, [results, q, country, yMin, yMax, desafioId, clubCountry, coachCountries]);

  // KPIs
  const kpis = useMemo(() => {
    const distinctDesafios = new Set<string>();
    let totalCompletions = 0;
    let totalBonus = 0;
    for (const f of filtered) {
      totalCompletions++;
      totalBonus += f.desafio.bonus;
      distinctDesafios.add(f.desafio.id);
    }
    return {
      totalCompletions,
      totalBonus,
      defined: desafios.length,
      activated: distinctDesafios.size,
    };
  }, [filtered, desafios]);

  // Completions by year (using last year of yearsInRange as "earned")
  const byYear = useMemo(() => {
    const map = new Map<number, { year: number; count: number; bonus: number }>();
    for (const f of filtered) {
      const y = f.yearsInRange[f.yearsInRange.length - 1];
      const cur = map.get(y) ?? { year: y, count: 0, bonus: 0 };
      cur.count++;
      cur.bonus += f.desafio.bonus;
      map.set(y, cur);
    }
    return [...map.values()].sort((a, b) => a.year - b.year);
  }, [filtered]);

  // Top entities — current subject only
  const top = useMemo(() => {
    const byEntity = new Map<string, { total: number; items: { name: string; bonus: number; years: number[] }[] }>();
    for (const f of filtered) {
      if (f.match.subject !== subject) continue;
      const cur = byEntity.get(f.match.entity) ?? { total: 0, items: [] };
      cur.total += f.desafio.bonus;
      cur.items.push({ name: f.desafio.name, bonus: f.desafio.bonus, years: f.match.years });
      byEntity.set(f.match.entity, cur);
    }
    return [...byEntity.entries()]
      .map(([name, info]) => ({ name, total: info.total, items: info.items }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [filtered, subject]);

  // Top desafios by # completions (post-filter)
  const topDesafios = useMemo(() => {
    const map = new Map<string, { name: string; bonus: number; count: number }>();
    for (const f of filtered) {
      const cur = map.get(f.desafio.id) ?? { name: f.desafio.name, bonus: f.desafio.bonus, count: 0 };
      cur.count++;
      map.set(f.desafio.id, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count || b.bonus - a.bonus).slice(0, 10);
  }, [filtered]);

  const recentHighlights = useMemo(
    () => batches.flatMap((b) => b.highlights.map((h) => ({ ...h, importedAt: b.importedAt }))).slice(0, 30),
    [batches],
  );

  const dismissBatch = (importedAt: string) => {
    const next = batches.filter((b) => b.importedAt !== importedAt);
    saveHighlightBatches(next);
    setBatches(next);
  };

  const resetFilters = () => {
    setSearch(""); setYearFrom(""); setYearTo(""); setCountry("__all__"); setDesafioId("__all__");
  };

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
          <Target className="size-6 text-gold" /> Dashboard de Desafios
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          KPIs, evolução temporal e top entidades por bónus dos desafios. Use os filtros para focar uma época, país, competição ou entidade.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="size-4 text-primary" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar clube, treinador ou país…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={yearFrom || "__any__"} onValueChange={(v) => setYearFrom(v === "__any__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Época desde" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Desde (qualquer)</SelectItem>
                {allYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={yearTo || "__any__"} onValueChange={(v) => setYearTo(v === "__any__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Época até" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Até (qualquer)</SelectItem>
                {allYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="País" /></SelectTrigger>
              <SelectContent className="max-h-[280px]">
                <SelectItem value="__all__">Todos os países</SelectItem>
                {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={desafioId} onValueChange={setDesafioId}>
              <SelectTrigger className="lg:col-span-2"><SelectValue placeholder="Desafio / Competição" /></SelectTrigger>
              <SelectContent className="max-h-[280px]">
                <SelectItem value="__all__">Todos os desafios</SelectItem>
                {desafios.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={resetFilters} className="lg:col-span-1">
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Desafios definidos" value={kpis.defined} />
        <Kpi label="Desafios cumpridos" value={kpis.activated} hint={`${kpis.defined} definidos`} />
        <Kpi label="Conquistas totais" value={kpis.totalCompletions} hint="(entidade × desafio)" />
        <Kpi label="Bónus distribuído" value={fmtPts(kpis.totalBonus)} />
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="size-4 text-primary" /> Novos destaques após importação
          </CardTitle>
          {batches.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => { clearHighlights(); setBatches([]); }}>
              <Trash2 className="size-3.5 mr-1" /> Limpar tudo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há destaques registados. Importe uma nova época para detetar automaticamente desafios cumpridos, recordes de pontos e invencibilidades.
            </p>
          ) : (
            <div className="space-y-4">
              {batches.slice(0, 5).map((b) => (
                <div key={b.importedAt} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm">
                      <span className="font-semibold">Época {b.importedYears.join(", ")}</span>
                      <span className="text-muted-foreground ml-2">
                        · {new Date(b.importedAt).toLocaleString("pt-PT")}
                      </span>
                      <Badge variant="secondary" className="ml-2">{b.highlights.length}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => dismissBatch(b.importedAt)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <ul className="space-y-1">
                    {b.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Badge variant="outline" className={`${KIND_TONE[h.kind]} shrink-0`}>
                          {KIND_LABEL[h.kind]}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{h.title}</div>
                          <div className="text-xs text-muted-foreground">{h.year} · {h.detail}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {recentHighlights.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum destaque guardado.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Conquistas por época
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byYear.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados para os filtros atuais.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byYear}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="count" name="Conquistas" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Bónus distribuído por época
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byYear.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados para os filtros atuais.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={byYear}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Legend />
                  <Line type="monotone" dataKey="bonus" name="Bónus" stroke="hsl(var(--gold))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4 text-primary" /> Top entidades por bónus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={subject} onValueChange={(v) => setSubject(v as Subject)}>
            <TabsList>
              <TabsTrigger value="clubs">Clubes</TabsTrigger>
              <TabsTrigger value="coaches">Treinadores</TabsTrigger>
              <TabsTrigger value="countries">Países</TabsTrigger>
            </TabsList>
            <TabsContent value={subject} className="mt-3">
              {top.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum {SUBJECT_LABEL[subject].toLowerCase()} com bónus de desafios para os filtros atuais.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Desafios cumpridos</TableHead>
                      <TableHead className="text-right">Bónus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {top.map((t, i) => {
                      const linkTo =
                        subject === "clubs" ? "/clubes/$name"
                        : subject === "coaches" ? "/treinadores/$name"
                        : "/paises/$name";
                      return (
                        <TableRow key={t.name}>
                          <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                          <TableCell className="font-medium">
                            <Link to={linkTo} params={{ name: t.name }} className="hover:underline">
                              {t.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.items.map((it) => it.name).join(", ")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {fmtPts(t.total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desafios mais cumpridos</CardTitle>
        </CardHeader>
        <CardContent>
          {topDesafios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum desafio cumprido para os filtros atuais.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Desafio</TableHead>
                  <TableHead className="text-right">Conquistas</TableHead>
                  <TableHead className="text-right">Bónus unit.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topDesafios.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.count}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPts(d.bonus)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}
