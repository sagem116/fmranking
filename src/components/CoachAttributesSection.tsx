import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useCoachFullData } from "@/lib/fm-coach-full";
import { fmtMoney, fmtNum } from "@/lib/fmt";

const ATTR_LABELS: Array<{ key: keyof NonNullable<ReturnType<typeof useCoachFullData>["data"]>["coach"]; label: string }> = [
  { key: "tactical_style", label: "Estilo Tático" },
  { key: "play_style", label: "Estilo de Jogo" },
  { key: "attacking_formation", label: "Formação Atacante Preferida" },
  { key: "defensive_formation", label: "Formação Defensiva Preferida" },
  { key: "preferred_formation", label: "Formação Preferida" },
  { key: "secondary_formation", label: "Segunda Formação Preferida" },
  { key: "mentality", label: "Mentalidade" },
  { key: "marking_type", label: "Tipo de Marcação" },
  { key: "pressing_type", label: "Tipo de Pressão" },
  { key: "training_type", label: "Tipo de Treino" },
  { key: "personality", label: "Personalidade" },
  { key: "press_relationship", label: "Relação com a Imprensa" },
] as unknown as Array<{ key: keyof NonNullable<ReturnType<typeof useCoachFullData>["data"]>["coach"]; label: string }>;

export function CoachAttributesSection({ coachName }: { coachName: string }) {
  const { data, isLoading } = useCoachFullData(coachName);
  if (isLoading) return null;
  if (!data || (!data.coach && !data.assignments.length)) return null;
  const c = data.coach;
  const assignments = data.assignments;

  const totalSalary = assignments.reduce((a, r) => a + (Number(r.salary) || 0), 0);
  const totalIntl = assignments.reduce((a, r) => a + (Number(r.intl_salary) || 0), 0);

  // Per-season history for evolution charts
  const byYear = useMemo(() => {
    const map = new Map<number, { rm: number; rc: number; ca: number; cp: number; salary: number; intl_salary: number; n: number }>();
    for (const a of assignments) {
      const y = a.season_year ?? null;
      if (y == null) continue;
      const slot = map.get(y) ?? { rm: 0, rc: 0, ca: 0, cp: 0, salary: 0, intl_salary: 0, n: 0 };
      slot.rm += Number(a.rm) || 0;
      slot.rc += Number(a.rc) || 0;
      slot.ca += Number(a.ca) || 0;
      slot.cp += Number(a.cp) || 0;
      slot.salary += Number(a.salary) || 0;
      slot.intl_salary += Number(a.intl_salary) || 0;
      slot.n += 1;
      map.set(y, slot);
    }
    return [...map.entries()]
      .map(([season, v]) => ({
        season,
        rm: v.n ? v.rm / v.n : 0,
        rc: v.n ? v.rc / v.n : 0,
        ca: v.n ? v.ca / v.n : 0,
        cp: v.n ? v.cp / v.n : 0,
        salary: v.salary,
        intl_salary: v.intl_salary,
      }))
      .sort((a, b) => a.season - b.season);
  }, [assignments]);

  const nationalTeam = c?.is_national_team ? c.national_team : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            Características do treinador
            {c?.nationality && <Badge variant="outline">{c.nationality}</Badge>}
            {nationalTeam && <Badge variant="outline">Selecionador · {nationalTeam}</Badge>}
            {c?.age != null && <Badge variant="outline">Idade {c.age}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {c ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {ATTR_LABELS.map(({ key, label }) => {
                const v = c[key] as unknown as string | number | null | undefined;
                return (
                  <div key={String(key)} className="p-3 rounded-lg border border-border/50 bg-muted/20">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold mt-1">{v == null || v === "" ? "—" : String(v)}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem características importadas para este treinador.</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <MiniStat label="R.M." value={c?.rm == null ? "—" : fmtNum(c.rm, 2)} />
            <MiniStat label="R.C." value={c?.rc == null ? "—" : fmtNum(c.rc, 2)} />
            <MiniStat label="C.A." value={c?.ca == null ? "—" : fmtNum(c.ca, 2)} />
            <MiniStat label="C.P." value={c?.cp == null ? "—" : fmtNum(c.cp, 2)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <MiniStat label="Salário acumulado" value={fmtMoney(totalSalary)} />
            <MiniStat label="Ordenado internacional acumulado" value={fmtMoney(totalIntl)} />
          </div>
        </CardContent>
      </Card>

      {byYear.length > 0 && (
        <>
          <ChartCard
            title="Evolução — R.M. / R.C. / C.A. / C.P."
            data={byYear}
            series={[
              { key: "rm", label: "R.M.", color: "hsl(var(--primary))" },
              { key: "rc", label: "R.C.", color: "hsl(var(--accent))" },
              { key: "ca", label: "C.A.", color: "hsl(var(--chart-1, 200 90% 50%))" },
              { key: "cp", label: "C.P.", color: "hsl(var(--chart-2, 30 90% 55%))" },
            ]}
          />
          <ChartCard
            title="Evolução salarial"
            data={byYear}
            money
            series={[
              { key: "salary", label: "Salário", color: "hsl(var(--primary))" },
              { key: "intl_salary", label: "Ordenado Internacional", color: "hsl(var(--accent))" },
            ]}
          />
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border border-border/50 bg-muted/10">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  data,
  series,
  money = false,
}: {
  title: string;
  data: Array<Record<string, number>>;
  series: Array<{ key: string; label: string; color: string }>;
  money?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="season" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                width={70}
                tickFormatter={(v) => (money ? fmtMoney(Number(v)) : fmtNum(Number(v), 1))}
              />
              <RTooltip
                formatter={(v: number) => (money ? fmtMoney(Number(v)) : fmtNum(Number(v), 2))}
                labelFormatter={(l) => `Época ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 2.5 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
