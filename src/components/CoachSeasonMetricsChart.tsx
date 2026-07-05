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
import type { CoachProfile } from "@/lib/fm-profiles";
import type { StandingRow } from "@/lib/fm-rankings";
import { fmtNum } from "@/lib/fmt";

type MetricKey = "played" | "wins" | "draws" | "losses" | "winPct" | "points";
const METRICS: { key: MetricKey; label: string }[] = [
  { key: "played", label: "Jogos" },
  { key: "wins", label: "Vitórias" },
  { key: "draws", label: "Empates" },
  { key: "losses", label: "Derrotas" },
  { key: "winPct", label: "% Vitórias" },
  { key: "points", label: "Pontos" },
];

export function CoachSeasonMetricsChart({
  profile,
  standings,
}: {
  profile: CoachProfile;
  standings: StandingRow[];
}) {
  const [metric, setMetric] = useState<MetricKey>("points");

  const series = useMemo(() => {
    // Map each coach's assigned club-season to standings totals
    const byYear = new Map<number, { played: number; wins: number; draws: number; losses: number; points: number }>();
    const stKey = new Map<string, StandingRow>();
    for (const s of standings) {
      stKey.set(`${s.season_year}|${s.module}|${s.club_name}`, s);
    }
    for (const s of profile.seasons) {
      if (!s.club_name) continue;
      const st = stKey.get(`${s.year}|${s.module}|${s.club_name}`);
      if (!st) continue;
      const slot = byYear.get(s.year) ?? { played: 0, wins: 0, draws: 0, losses: 0, points: 0 };
      slot.played += Number(st.played ?? 0) || 0;
      slot.wins += Number(st.wins ?? 0) || 0;
      slot.draws += Number(st.draws ?? 0) || 0;
      slot.losses += Number(st.losses ?? 0) || 0;
      slot.points += Number(st.points ?? 0) || 0;
      byYear.set(s.year, slot);
    }
    return [...byYear.entries()]
      .map(([season, v]) => ({
        season,
        played: v.played,
        wins: v.wins,
        draws: v.draws,
        losses: v.losses,
        points: v.points,
        winPct: v.played > 0 ? (v.wins / v.played) * 100 : 0,
      }))
      .sort((a, b) => a.season - b.season);
  }, [profile, standings]);

  if (series.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-base">Desempenho do treinador por época</CardTitle>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Métrica</Label>
          <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => (<SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={series} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="season" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={60}
                tickFormatter={(v) => metric === "winPct" ? `${fmtNum(Number(v), 0)}%` : fmtNum(Number(v), 0)} />
              <RTooltip
                formatter={(v: number) => metric === "winPct" ? `${fmtNum(Number(v), 1)}%` : fmtNum(Number(v), 0)}
                labelFormatter={(l) => `Época ${l}`}
              />
              <Line type="monotone" dataKey={metric} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
