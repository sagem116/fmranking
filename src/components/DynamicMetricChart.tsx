import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
} from "recharts";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { fmtNum, fmtMoney } from "@/lib/fmt";
import type { PlayerStatRow } from "@/lib/fm-player-stats-db";

export type ProfileKind = "player" | "club" | "competition" | "country";

type Metric = {
  key: string;
  label: string;
  agg: "sum" | "avg";
  money?: boolean;
  pick: (r: PlayerStatRow) => number | null;
};

const NUM = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const COMMON_SUM: Metric[] = [
  { key: "gls", label: "Golos", agg: "sum", pick: (r) => NUM(r.gls) },
  { key: "ast", label: "Assistências", agg: "sum", pick: (r) => NUM(r.ast) },
  { key: "games", label: "Jogos", agg: "sum", pick: (r) => NUM(r.games) },
  { key: "hdj", label: "Homem do Jogo", agg: "sum", pick: (r) => NUM(r.hdj) },
  { key: "yellows", label: "Amarelos", agg: "sum", pick: (r) => NUM(r.yellows) },
  { key: "reds", label: "Vermelhos", agg: "sum", pick: (r) => NUM(r.reds) },
];

const COMMON_AVG: Metric[] = [
  { key: "ca", label: "C.A.", agg: "avg", pick: (r) => NUM(r.ca) },
  { key: "cp", label: "C.P.", agg: "avg", pick: (r) => NUM(r.cp) },
  { key: "vp", label: "VP", agg: "avg", money: true, pick: (r) => NUM(r.vp) },
  { key: "salary", label: "Salário", agg: "avg", money: true, pick: (r) => NUM(r.salary) },
  { key: "ra", label: "R.A.", agg: "avg", pick: (r) => NUM(r.ra) },
  { key: "rm", label: "R.M.", agg: "avg", pick: (r) => NUM(r.rm) },
  { key: "rc", label: "R.C.", agg: "avg", pick: (r) => NUM(r.rc) },
  { key: "age", label: "Idade", agg: "avg", pick: (r) => NUM(r.age) },
  { key: "xg", label: "xG", agg: "avg", pick: (r) => NUM(r.xg) },
  { key: "pass_pct", label: "% Passe", agg: "avg", pick: (r) => NUM(r.pass_pct) },
  { key: "tackles_per90", label: "Des/90", agg: "avg", pick: (r) => NUM(r.tackles_per90) },
  { key: "fouls_per90", label: "Fnt/90", agg: "avg", pick: (r) => NUM(r.fouls_per90) },
  { key: "shot_pct", label: "% Remates", agg: "avg", pick: (r) => NUM(r.shot_pct) },
  { key: "avg_rating", label: "Classificação Média", agg: "avg", pick: (r) => NUM(r.avg_rating) },
];

const SUM_AS_COUNT_FOR_NON_PLAYER: Metric[] = [
  { key: "n_players", label: "Nº jogadores", agg: "sum", pick: () => 1 },
];

function metricsFor(kind: ProfileKind): Metric[] {
  // For players we sum per season; everyone else aggregates across rows of the season.
  if (kind === "player") return [...COMMON_SUM, ...COMMON_AVG];
  return [...SUM_AS_COUNT_FOR_NON_PLAYER, ...COMMON_SUM, ...COMMON_AVG];
}

function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function rowsFor(kind: ProfileKind, name: string, all: PlayerStatRow[]): PlayerStatRow[] {
  const t = norm(name);
  switch (kind) {
    case "player":      return all.filter((r) => norm(r.player_name) === t);
    case "club":        return all.filter((r) => norm(r.club) === t);
    case "competition": return all.filter((r) => norm(r.competition) === t);
    case "country":     return all.filter((r) => norm(r.nationality) === t);
  }
}

export function DynamicMetricChart({ kind, name, title }: { kind: ProfileKind; name: string; title?: string }) {
  const { data, isLoading } = usePlayerStatsData();
  const metrics = metricsFor(kind);
  const [metric, setMetric] = useState<string>(metrics[0].key);
  const m = metrics.find((x) => x.key === metric) ?? metrics[0];

  const series = useMemo(() => {
    if (!data) return [] as Array<{ season: number; value: number }>;
    const rows = rowsFor(kind, name, data.players);
    const byYear = new Map<number, { sum: number; n: number }>();
    for (const r of rows) {
      const v = m.pick(r);
      if (v == null) continue;
      const slot = byYear.get(r.season_year) ?? { sum: 0, n: 0 };
      slot.sum += v;
      slot.n += 1;
      byYear.set(r.season_year, slot);
    }
    return [...byYear.entries()]
      .map(([season, s]) => ({ season, value: m.agg === "sum" ? s.sum : s.n ? s.sum / s.n : 0 }))
      .sort((a, b) => a.season - b.season);
  }, [data, kind, name, m]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-base">{title ?? "Evolução por época"}</CardTitle>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Métrica</Label>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {metrics.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-12 text-center">A carregar…</p>
        ) : series.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Sem dados para esta métrica.</p>
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="season" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => m.money ? fmtMoney(Number(v)) : fmtNum(Number(v), 1)} width={70} />
                <RTooltip formatter={(v: number) => m.money ? fmtMoney(Number(v)) : fmtNum(Number(v), 2)} labelFormatter={(l) => `Época ${l}`} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}