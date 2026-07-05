import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useMemo, useState } from "react";
import { useClubReputationHistory } from "@/lib/fm-club-reputation-db";
import { fmtNum } from "@/lib/fmt";

type MetricKey = "reputation" | "avg_attendance" | "season_ticket_holders";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "reputation", label: "Reputação" },
  { key: "avg_attendance", label: "Assistência Média" },
  { key: "season_ticket_holders", label: "Detentores de Bilhetes de Época" },
];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

export function ClubReputationSection({ clubName }: { clubName: string }) {
  const { data: rows = [], isLoading } = useClubReputationHistory(clubName);
  const [metric, setMetric] = useState<MetricKey>("reputation");

  const years = useMemo(() => rows.map((r) => r.season_year).sort((a, b) => b - a), [rows]);
  const [year, setYear] = useState<number | null>(null);
  const currentYear = year ?? years[0] ?? null;
  const current = useMemo(
    () => (currentYear == null ? null : rows.find((r) => r.season_year === currentYear) ?? null),
    [rows, currentYear],
  );

  const chartData = useMemo(
    () =>
      rows
        .map((r) => ({ season: r.season_year, value: Number(r[metric] ?? 0) }))
        .filter((p) => Number.isFinite(p.value))
        .sort((a, b) => a.season - b.season),
    [rows, metric],
  );

  if (isLoading || !rows.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Época</Label>
          <Select value={String(currentYear ?? "")} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Reputação" value={current?.reputation == null ? "—" : fmtNum(current.reputation, 2)} />
        <StatCard
          label="Assistência Média"
          value={current?.avg_attendance == null ? "—" : Math.round(current.avg_attendance).toLocaleString("pt-PT")}
        />
        <StatCard
          label="Detentores de Bilhetes de Época"
          value={current?.season_ticket_holders == null ? "—" : Math.round(current.season_ticket_holders).toLocaleString("pt-PT")}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <CardTitle className="text-base">Reputação / Assistência — evolução por época</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Métrica</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
              <SelectTrigger className="w-[240px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => (<SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados para esta métrica.</p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="season" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => Number(v).toLocaleString("pt-PT")} />
                  <RTooltip
                    formatter={(v: number) => Number(v).toLocaleString("pt-PT")}
                    labelFormatter={(l) => `Época ${l}`}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
