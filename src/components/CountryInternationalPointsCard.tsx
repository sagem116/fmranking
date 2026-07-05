import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
} from "recharts";
import { buildYearMaps } from "@/lib/fm-profiles";
import type { AllData } from "@/lib/fm-db";
import type { FmConfig } from "@/lib/fm-config";
import { fmtPts } from "@/lib/fmt";

export function CountryInternationalPointsCard({
  data,
  cfg,
  countryName,
}: {
  data: AllData;
  cfg: FmConfig;
  countryName: string;
}) {
  const { total, chart } = useMemo(() => {
    const { countryYearW } = buildYearMaps(data, cfg, "international");
    let total = 0;
    const chart: Array<{ season: number; value: number }> = [];
    for (const [year, inner] of countryYearW) {
      const v = inner.get(countryName) ?? 0;
      if (v > 0) {
        total += v;
        chart.push({ season: year, value: v });
      }
    }
    chart.sort((a, b) => a.season - b.season);
    return { total, chart };
  }, [data, cfg, countryName]);

  if (total <= 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe2 className="size-4 text-primary" /> Pontos internacionais (seleção)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total ponderado</p>
          <p className="text-3xl font-bold tabular-nums">{fmtPts(total)}</p>
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={chart} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="season" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => fmtPts(Number(v))} />
              <RTooltip formatter={(v: number) => fmtPts(Number(v))} labelFormatter={(l) => `Época ${l}`} />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
