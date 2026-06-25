import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PlayerStatRow } from "@/lib/fm-players";

export function PlayerStatTable({ rows, years }: { rows: PlayerStatRow[]; years: number[] }) {
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3 w-12">#</th>
              <th className="text-left p-3">Jogador</th>
              {years.map((y) => <th key={y} className="text-right p-3">{y}</th>)}
              <th className="text-right p-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((r, i) => (
              <tr key={r.name + i} className="border-b border-border/50 hover:bg-muted/50">
                <td className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</td>
                <td className="p-3 font-medium">
                  <Link to="/jogadores/$name" params={{ name: r.name }} className="hover:text-primary hover:underline">
                    {r.name}
                  </Link>
                </td>
                {years.map((y) => {
                  const v = r.perSeason[y];
                  const club = r.perSeasonClub[y];
                  if (v == null) return <td key={y} className="p-3 text-right text-muted-foreground/40">—</td>;
                  return (
                    <td key={y} className="p-3 text-right tabular-nums">
                      {club ? (
                        <Tooltip>
                          <TooltipTrigger asChild><span className="cursor-help">{v}</span></TooltipTrigger>
                          <TooltipContent className="text-xs">{club}</TooltipContent>
                        </Tooltip>
                      ) : v}
                    </td>
                  );
                })}
                <td className="p-3 text-right font-semibold tabular-nums">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
