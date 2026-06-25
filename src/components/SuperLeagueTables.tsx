import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Crown } from "lucide-react";
import type { ChampRow, PlayoffRow } from "@/lib/fm-superleague";

type ChampSort = "total" | "c" | "p" | "d";

function Num({ value, tip }: { value: number; tip?: string }) {
  if (!tip || value === 0) return <span className="tabular-nums">{value}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="tabular-nums underline decoration-dotted cursor-help">{value}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm text-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}

export function ChampionsTable({ rows, entityLabel, showNac }: { rows: ChampRow[]; entityLabel: string; showNac?: boolean }) {
  const [sort, setSort] = useState<ChampSort>("total");
  const sorted = [...rows].sort((a, b) => (b[sort] as number) - (a[sort] as number));
  const Th = ({ k, label }: { k: ChampSort; label: string }) => (
    <th className="text-right p-3">
      <button onClick={() => setSort(k)} className={`hover:text-foreground ${sort === k ? "text-foreground" : ""}`}>{label}</button>
    </th>
  );
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3 w-12">#</th>
              <th className="text-left p-3">{entityLabel}</th>
              {showNac && <th className="text-left p-3">Nac</th>}
              <Th k="c" label="Campeão" />
              <Th k="p" label="Promovido" />
              <Th k="d" label="Despromovido" />
              <Th k="total" label="Score" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.name} className="border-b border-border/50 hover:bg-muted/50">
                <td className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</td>
                <td className="p-3 font-medium flex items-center gap-1">
                  {r.c > 0 && <Crown className="size-3 text-gold" />}{r.name}
                </td>
                {showNac && <td className="p-3 text-muted-foreground">{r.nac ?? "—"}</td>}
                <td className="p-3 text-right"><Num value={r.c} tip={r.tipC} /></td>
                <td className="p-3 text-right"><Num value={r.p} tip={r.tipP} /></td>
                <td className="p-3 text-right"><Num value={r.d} tip={r.tipD} /></td>
                <td className="p-3 text-right font-semibold tabular-nums">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

type PoSort = "total" | "quaseSubida" | "quaseTitulo";

export function PlayoffTable({ rows, entityLabel, showNac }: { rows: PlayoffRow[]; entityLabel: string; showNac?: boolean }) {
  const [sort, setSort] = useState<PoSort>("total");
  const sorted = [...rows].sort((a, b) => (b[sort] as number) - (a[sort] as number));
  const Th = ({ k, label }: { k: PoSort; label: string }) => (
    <th className="text-right p-3">
      <button onClick={() => setSort(k)} className={`hover:text-foreground ${sort === k ? "text-foreground" : ""}`}>{label}</button>
    </th>
  );
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3 w-12">#</th>
              <th className="text-left p-3">{entityLabel}</th>
              {showNac && <th className="text-left p-3">Nac</th>}
              <Th k="quaseSubida" label="Quase Subida" />
              <Th k="quaseTitulo" label="Quase Título" />
              <Th k="total" label="Total" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.name} className="border-b border-border/50 hover:bg-muted/50">
                <td className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</td>
                <td className="p-3 font-medium">{r.name}</td>
                {showNac && <td className="p-3 text-muted-foreground">{r.nac ?? "—"}</td>}
                <td className="p-3 text-right"><Num value={r.quaseSubida} tip={r.tipQS} /></td>
                <td className="p-3 text-right"><Num value={r.quaseTitulo} tip={r.tipQT} /></td>
                <td className="p-3 text-right font-semibold tabular-nums">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
