import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, BarChart3, Trophy, Sparkles, LineChart as LineIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtNum, fmtMoney, fmtPts } from "@/lib/fmt";
import {
  useAnalyticsData,
  clubRankings,
  competitionRankings,
  playerRankings,
  coachRankings,
  countryRankings,
  evolutionSeries,
  computeRecords,
  computeCuriosities,
  type Ranking,
  type RankRow,
  type Fmt,
} from "@/lib/fm-analytics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/analise")({
  head: () => ({
    meta: [
      { title: "Análise Estatística — FM World Rankings" },
      { name: "description", content: "Descobre tendências, records e curiosidades do universo Football Manager." },
      { property: "og:title", content: "Análise Estatística — FM World Rankings" },
      { property: "og:description", content: "Rankings avançados, evolução histórica, records e curiosidades." },
    ],
  }),
  component: AnalisePage,
});

const ALL = "__all__";

function fmt(v: number, f: Fmt): string {
  switch (f) {
    case "int": return fmtNum(v, 0);
    case "num1": return fmtNum(v, 1);
    case "num2": return fmtNum(v, 2);
    case "money": return fmtMoney(v);
    case "pct": return `${fmtNum(v, 1)}%`;
    case "num":
    default: return fmtPts(v);
  }
}

function RowLink({ row, kind }: { row: RankRow; kind?: Ranking["linkKind"] }) {
  const cls = "hover:text-primary hover:underline truncate";
  if (kind === "club") return <Link to="/clubes/$name" params={{ name: row.name }} className={cls}>{row.name}</Link>;
  if (kind === "coach") return <Link to="/treinadores/$name" params={{ name: row.name }} className={cls}>{row.name}</Link>;
  if (kind === "player") return <Link to="/jogadores/$name" params={{ name: row.name }} className={cls}>{row.name}</Link>;
  if (kind === "country") return <Link to="/paises/$name" params={{ name: row.name }} className={cls}>{row.name}</Link>;
  if (kind === "competition") return <Link to="/competicoes/$name" params={{ name: row.name }} className={cls}>{row.name}</Link>;
  return <span className={cls}>{row.name}</span>;
}

function RankingCard({ r }: { r: Ranking }) {
  if (!r.rows.length) return null;
  return (
    <Card className="card-glow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-display leading-tight">{r.title}</CardTitle>
        {r.subtitle && <p className="text-[11px] text-muted-foreground">{r.subtitle}</p>}
      </CardHeader>
      <CardContent className="space-y-0.5">
        {r.rows.map((row, i) => (
          <div key={`${row.name}-${i}`} className="flex items-center gap-2 py-1 text-sm border-b border-border/40 last:border-0">
            <span className={`w-5 text-center font-bold tabular-nums ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <RowLink row={row} kind={r.linkKind} />
              {row.subtitle && <p className="text-[11px] text-muted-foreground truncate">{row.subtitle}</p>}
            </div>
            <span className="font-semibold tabular-nums text-right">{fmt(row.value, r.fmt)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RankingGroup({ title, rankings }: { title: string; rankings: Ranking[] }) {
  const visible = rankings.filter((r) => r.rows.length > 0);
  if (!visible.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((r) => <RankingCard key={r.id} r={r} />)}
      </div>
    </section>
  );
}

function EvolutionTab({ series }: { series: ReturnType<typeof evolutionSeries> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {series.map((s) => (
        <Card key={s.label} className="card-glow">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">{s.label}</CardTitle></CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.points} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => fmt(v, s.fmt)} />
                <Tooltip formatter={(v: number) => fmt(v, s.fmt)} labelFormatter={(l) => `Época ${l}`} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecordsTab({ rows }: { rows: ReturnType<typeof computeRecords> }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Sem registos suficientes para calcular records.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((r, i) => (
        <Card key={i} className="card-glow">
          <CardContent className="p-4 flex items-start gap-3">
            <Trophy className="size-4 text-gold mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className="font-display text-base font-semibold truncate">{r.entity}</p>
              <p className="text-sm">
                <span className="font-bold tabular-nums">{fmt(r.value, r.fmt)}</span>
                {r.context && <span className="text-muted-foreground"> · {r.context}</span>}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CuriositiesTab({ items }: { items: ReturnType<typeof computeCuriosities> }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">É necessária mais do que uma época para gerar curiosidades.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((it, i) => (
        <Card key={i} className="card-glow">
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="size-4 text-gold mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{it.label}</p>
              <p className="text-sm mt-0.5">{it.text}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AnalisePage() {
  const { data, isLoading } = useAnalyticsData();
  const [seasonSel, setSeasonSel] = useState<string>(ALL);

  const seasonSet = useMemo(() => {
    if (!data) return new Set<number>();
    if (seasonSel === ALL) return new Set(data.seasons);
    return new Set([Number(seasonSel)]);
  }, [data, seasonSel]);

  const clubsData = useMemo(() => (data ? clubRankings(data, seasonSet) : []), [data, seasonSet]);
  const compsData = useMemo(() => (data ? competitionRankings(data, seasonSet) : []), [data, seasonSet]);
  const playersData = useMemo(() => (data ? playerRankings(data, seasonSet) : []), [data, seasonSet]);
  const coachesData = useMemo(() => (data ? coachRankings(data, seasonSet) : []), [data, seasonSet]);
  const countriesData = useMemo(() => (data ? countryRankings(data, seasonSet) : []), [data, seasonSet]);
  const evoData = useMemo(() => (data ? evolutionSeries(data) : []), [data]);
  const recordsData = useMemo(() => (data ? computeRecords(data) : []), [data]);
  const curiosData = useMemo(() => (data ? computeCuriosities(data) : []), [data]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular análises…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight gold-shimmer flex items-center gap-2">
            <BarChart3 className="size-6 text-gold" /> Análise Estatística
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Descobre tendências, compara entidades e explora records do universo Football Manager.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Época</span>
          <Select value={seasonSel} onValueChange={setSeasonSel}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as épocas</SelectItem>
              {[...data.seasons].reverse().map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="clubes" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="clubes">Clubes</TabsTrigger>
          <TabsTrigger value="competicoes">Competições</TabsTrigger>
          <TabsTrigger value="jogadores">Jogadores</TabsTrigger>
          <TabsTrigger value="treinadores">Treinadores</TabsTrigger>
          <TabsTrigger value="paises">Países</TabsTrigger>
          <TabsTrigger value="evolucao"><LineIcon className="size-3.5 mr-1" />Evolução</TabsTrigger>
          <TabsTrigger value="records"><Trophy className="size-3.5 mr-1" />Records</TabsTrigger>
          <TabsTrigger value="curiosidades"><Sparkles className="size-3.5 mr-1" />Curiosidades</TabsTrigger>
        </TabsList>

        <TabsContent value="clubes" className="space-y-6">
          {clubsData.map((g) => <RankingGroup key={g.group} title={g.group} rankings={g.rankings} />)}
        </TabsContent>
        <TabsContent value="competicoes" className="space-y-6">
          {compsData.map((g) => <RankingGroup key={g.group} title={g.group} rankings={g.rankings} />)}
        </TabsContent>
        <TabsContent value="jogadores" className="space-y-6">
          {playersData.map((g) => <RankingGroup key={g.group} title={g.group} rankings={g.rankings} />)}
        </TabsContent>
        <TabsContent value="treinadores" className="space-y-6">
          {coachesData.map((g) => <RankingGroup key={g.group} title={g.group} rankings={g.rankings} />)}
        </TabsContent>
        <TabsContent value="paises" className="space-y-6">
          {countriesData.map((g) => <RankingGroup key={g.group} title={g.group} rankings={g.rankings} />)}
        </TabsContent>
        <TabsContent value="evolucao"><EvolutionTab series={evoData} /></TabsContent>
        <TabsContent value="records"><RecordsTab rows={recordsData} /></TabsContent>
        <TabsContent value="curiosidades"><CuriositiesTab items={curiosData} /></TabsContent>
      </Tabs>
    </div>
  );
}
