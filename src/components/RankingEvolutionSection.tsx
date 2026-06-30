import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, TrendingUp } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, ReferenceLine } from "recharts";
import { useRankings } from "@/lib/useRankings";
import { buildYearMaps, type RankingSource } from "@/lib/fm-profiles";
import { cn } from "@/lib/utils";

export type EvolutionKind = "club" | "coach" | "country";
type Mode = "weighted" | "raw";

interface Props {
  kind: EvolutionKind;
  name: string;
  className?: string;
}

const SOURCES: { value: RankingSource; label: string }[] = [
  { value: "all", label: "Unificado" },
  { value: "superleague", label: "Super League" },
  { value: "national", label: "Ligas Nacionais" },
  { value: "continental", label: "Continentais" },
  { value: "international", label: "Internacional" },
];

export function RankingEvolutionSection({ kind, name, className }: Props) {
  const { data, isLoading } = useRankings();
  const [mode, setMode] = useState<Mode>("weighted");
  const [source, setSource] = useState<RankingSource>("all");
  const [open, setOpen] = useState(false);

  const yearMaps = useMemo(() => {
    if (!data) return null;
    return buildYearMaps(data.data, data.config, source);
  }, [data, source]);

  const series = useMemo(() => {
    if (!data || !yearMaps) return [];
    const ym = kind === "club"
      ? (mode === "weighted" ? yearMaps.clubYearW : yearMaps.clubYearR)
      : kind === "coach"
      ? (mode === "weighted" ? yearMaps.coachYearW : yearMaps.coachYearR)
      : (mode === "weighted" ? yearMaps.countryYearW : yearMaps.countryYearR);
    const years = data.ranks.years;
    return years.map((y) => {
      const inner = ym.get(y);
      if (!inner) return { year: y, rank: null as number | null };
      const sorted = [...inner.entries()].sort((a, b) => b[1] - a[1]);
      const idx = sorted.findIndex(([n]) => n === name);
      return { year: y, rank: idx >= 0 ? idx + 1 : null };
    });
  }, [data, yearMaps, kind, mode, name]);

  const stats = useMemo(() => {
    const valid = series.filter((s): s is { year: number; rank: number } => typeof s.rank === "number");
    if (!valid.length) return null;
    const ranks = valid.map((v) => v.rank);
    return {
      best: Math.min(...ranks),
      worst: Math.max(...ranks),
      seasons: valid.length,
      last: valid[valid.length - 1].rank,
      prev: valid.length >= 2 ? valid[valid.length - 2].rank : null,
    };
  }, [series]);

  if (isLoading || !data) return null;
  if (!stats) return null;

  const delta = stats.prev != null ? stats.prev - stats.last : null; // positive = improved (rank went down)

  return (
    <Card className={cn("p-4", className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="size-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Evolução do Ranking</p>
              <p className="text-xs text-muted-foreground">
                Atual: <span className="font-medium text-foreground">#{stats.last}</span> ·
                Melhor: #{stats.best} · Pior: #{stats.worst} · {stats.seasons} épocas
                {delta != null && delta !== 0 && (
                  <> · <span className={delta > 0 ? "text-emerald-500" : "text-red-500"}>{delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}</span></>
                )}
              </p>
            </div>
          </div>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="ghost">
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              {SOURCES.map((s) => (
                <Button key={s.value} size="sm" variant={source === s.value ? "default" : "ghost"} className="rounded-none h-7 px-2 text-xs" onClick={() => setSource(s.value)}>
                  {s.label}
                </Button>
              ))}
            </div>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <Button size="sm" variant={mode === "weighted" ? "default" : "ghost"} className="rounded-none h-7 px-2 text-xs" onClick={() => setMode("weighted")}>Ponderado</Button>
              <Button size="sm" variant={mode === "raw" ? "default" : "ghost"} className="rounded-none h-7 px-2 text-xs" onClick={() => setMode("raw")}>Bruto</Button>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis reversed allowDecimals={false} tick={{ fontSize: 11 }} domain={[1, "dataMax"]} />
                <RTooltip
                  formatter={(v: number | null) => (v == null ? "—" : `#${v}`)}
                  labelFormatter={(l) => `Época ${l}`}
                />
                <ReferenceLine y={1} stroke="oklch(0.82 0.17 88)" strokeDasharray="2 2" />
                <Line type="monotone" dataKey="rank" stroke="oklch(0.82 0.17 88)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-muted-foreground">
            Eixo invertido: posições melhores ficam no topo.
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}