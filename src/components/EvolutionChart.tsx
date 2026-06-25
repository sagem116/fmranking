import { Area, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { fmtPts } from "@/lib/fmt";

export type ChartMode = "weighted" | "raw";

export interface EvoPoint {
  year: number;
  weighted: number;
  raw: number;
  positionWeighted: number | null;
  positionRaw: number | null;
}

export interface EvoSeries {
  name: string;
  color?: string;
  data: EvoPoint[];
}

const SERIES_COLORS = ["var(--primary)", "var(--gold, #d4af37)"];
const POS_COLORS = ["#d4af37", "#60a5fa"];

interface Props {
  /** Single-entity (profile) usage */
  data?: EvoPoint[];
  /** Multi-entity (comparison) usage */
  series?: EvoSeries[];
  /** Show toggle inside the chart card. Defaults true. */
  showModeToggle?: boolean;
  /** Force mode externally (comparison page). */
  mode?: ChartMode;
  onModeChange?: (m: ChartMode) => void;
}

export function EvolutionChart({ data, series, showModeToggle = true, mode: extMode, onModeChange }: Props) {
  const [localMode, setLocalMode] = useState<ChartMode>("weighted");
  const mode = extMode ?? localMode;
  const setMode = (m: ChartMode) => { onModeChange ? onModeChange(m) : setLocalMode(m); };

  const seriesList: EvoSeries[] = series ?? (data ? [{ name: "Pontos", data }] : []);
  const allYears = new Set<number>();
  seriesList.forEach((s) => s.data.forEach((d) => allYears.add(d.year)));
  const years = [...allYears].sort((a, b) => a - b);

  if (years.length < 2) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Dados insuficientes para gráfico de evolução.</p>;
  }

  const ptsKey = mode === "weighted" ? "weighted" : "raw";
  const posKey = mode === "weighted" ? "positionWeighted" : "positionRaw";

  const chartData = years.map((year) => {
    const row: Record<string, number | null> = { year };
    seriesList.forEach((s, i) => {
      const p = s.data.find((d) => d.year === year);
      row[`pts_${i}`] = p ? (p[ptsKey] as number) : null;
      row[`pos_${i}`] = p ? (p[posKey] as number | null) : null;
    });
    return row;
  });

  const hasPos = seriesList.some((s) => s.data.some((d) => d[posKey] != null));
  const isComparison = seriesList.length > 1;

  

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UITooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex items-center gap-1 hover:text-foreground">
                <Info className="size-3.5" /> Como ler este gráfico
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs leading-relaxed">
              <p className="font-semibold mb-1">Eixos</p>
              <p>
                <span className="text-primary font-medium">Eixo esquerdo (área):</span> pontos {mode === "weighted" ? "ponderados (com pesos de competição/divisão e desvalorização por época)" : "brutos (sem pesos nem desvalorização)"} acumulados nesse ano.
              </p>
              <p className="mt-1">
                <span className="text-[color:var(--gold,#d4af37)] font-medium">Eixo direito (linha):</span> posição ocupada no ranking mundial {mode} desse ano — quanto mais alto o ponto, melhor (eixo invertido).
              </p>
            </TooltipContent>
          </UITooltip>
        </div>
        {showModeToggle && (
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <Button
              type="button"
              size="sm"
              variant={mode === "weighted" ? "default" : "ghost"}
              className="rounded-none h-7 px-3 text-xs"
              onClick={() => setMode("weighted")}
            >
              Ponderado
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "raw" ? "default" : "ghost"}
              className="rounded-none h-7 px-3 text-xs"
              onClick={() => setMode("raw")}
            >
              Bruto
            </Button>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            {seriesList.map((s, i) => (
              <linearGradient key={i} id={`evoFill_${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={isComparison ? 0.18 : 0.35} />
                <stop offset="100%" stopColor={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <YAxis
            yAxisId="pts"
            tick={{ fontSize: 11 }}
            stroke="var(--muted-foreground)"
            width={50}
            label={{ value: "Pontos", angle: -90, position: "insideLeft", offset: 18, style: { fontSize: 10, fill: "var(--muted-foreground)" } }}
          />
          {hasPos && (
            <YAxis
              yAxisId="pos"
              orientation="right"
              reversed
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              stroke="var(--muted-foreground)"
              width={40}
              domain={[1, "dataMax"]}
              label={{ value: "Posição", angle: 90, position: "insideRight", offset: 10, style: { fontSize: 10, fill: "var(--muted-foreground)" } }}
            />
          )}
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--foreground)" }}
            labelFormatter={(y) => `Época ${y}`}
            formatter={(v, name) => {
              const n = String(name);
              if (v == null) return ["—", n];
              const num = Number(v);
              if (n.includes("Posição")) return [`#${num}`, n];
              return [fmtPts(num), n];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {seriesList.map((s, i) => {
            const color = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
            return (
              <Area
                key={`a_${i}`}
                yAxisId="pts"
                type="monotone"
                dataKey={`pts_${i}`}
                name={isComparison ? `${s.name} · Pontos` : "Pontos"}
                stroke={color}
                strokeWidth={2}
                fill={`url(#evoFill_${i})`}
                connectNulls
              />
            );
          })}
          {hasPos && seriesList.map((s, i) => {
            const color = POS_COLORS[i % POS_COLORS.length];
            return (
              <Line
                key={`l_${i}`}
                yAxisId="pos"
                type="monotone"
                dataKey={`pos_${i}`}
                name={isComparison ? `${s.name} · Posição` : "Posição"}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={isComparison && i > 0 ? "4 3" : undefined}
                dot={{ r: 3, fill: color }}
                connectNulls
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export const MODULE_LABEL: Record<string, string> = {
  superleague: "SuperLeague",
  national: "Liga Nacional",
  continental: "Continental",
};

export function ChartLegend({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-3 text-xs text-muted-foreground">{children}</div>;
}
