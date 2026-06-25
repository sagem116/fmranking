import { useMemo, useState } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import { aggregatePlayerAttrs, ATTR_LABEL, ATTR_SHORT, ALL_ATTRS, type AttrKey, type AttrPoint } from "@/lib/fm-player-attrs";
import type { PlayerRow } from "@/lib/fm-db";

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

interface Props {
  players: PlayerRow[];
  filter: { club?: string; league?: string };
  defaultAttrs?: AttrKey[];
}

export function PlayerAttrsChart({ players, filter, defaultAttrs }: Props) {
  const [selected, setSelected] = useState<AttrKey[]>(defaultAttrs ?? ["ra", "ca"]);
  const data: AttrPoint[] = useMemo(() => aggregatePlayerAttrs(players, filter), [players, filter]);

  if (data.length < 1) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de jogadores para esta seleção.</p>;
  }

  const toggle = (k: AttrKey) => {
    setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">Evolução de atributos do plantel ao longo das épocas.</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Colunas ({selected.length}) <ChevronDown className="size-3 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2">
            <div className="space-y-1">
              {ALL_ATTRS.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-muted">
                  <Checkbox checked={selected.includes(k)} onCheckedChange={() => toggle(k)} />
                  {ATTR_LABEL[k]}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(y) => `Época ${y}`}
            formatter={(v, name) => {
              if (v == null) return ["—", String(name)];
              const num = Number(v);
              return [num >= 1000 ? num.toLocaleString("pt-PT") : num.toFixed(2), String(name)];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {selected.map((k, i) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              name={ATTR_SHORT[k]}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
