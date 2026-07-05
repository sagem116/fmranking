import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { fmtNum, fmtMoney } from "@/lib/fmt";

function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

export function ClubPlantelSection({ clubName, season }: { clubName: string; season: number | null }) {
  const { data, isLoading } = usePlayerStatsData();
  const [open, setOpen] = useState(true);

  const rows = useMemo(() => {
    if (!data || season == null) return [];
    const t = norm(clubName);
    const filtered = data.players.filter(
      (r) => norm(r.club) === t && r.season_year === season,
    );
    // Dedup by player (keep the row with most games; then highest ca)
    const map = new Map<string, typeof filtered[number]>();
    for (const r of filtered) {
      const key = (r.idu && r.idu.trim()) || `${norm(r.player_name)}`;
      const cur = map.get(key);
      if (!cur || (r.games ?? 0) > (cur.games ?? 0) || ((r.games ?? 0) === (cur.games ?? 0) && (r.ca ?? 0) > (cur.ca ?? 0))) {
        map.set(key, r);
      }
    }
    return [...map.values()].sort((a, b) => (b.ca ?? 0) - (a.ca ?? 0));
  }, [data, clubName, season]);

  if (isLoading || season == null) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="size-4 text-primary" />
          Plantel — {season}
          <span className="text-xs font-normal text-muted-foreground ml-2">{rows.length} jogadores</span>
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 pb-4">Sem jogadores registados para esta época.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                  <th className="text-left p-3">Jogador</th>
                  <th className="text-left p-3">Nacionalidade</th>
                  <th className="text-right p-3">Idade</th>
                  <th className="text-right p-3">Jogos</th>
                  <th className="text-right p-3">Gls</th>
                  <th className="text-right p-3">Ast</th>
                  <th className="text-right p-3">xG</th>
                  <th className="text-right p-3">% Passe</th>
                  <th className="text-right p-3">Des/90</th>
                  <th className="text-right p-3">Fnt/90</th>
                  <th className="text-right p-3">% Rem.</th>
                  <th className="text-right p-3">Amr</th>
                  <th className="text-right p-3">Ver</th>
                  <th className="text-right p-3">Cl Med</th>
                  <th className="text-right p-3">CA</th>
                  <th className="text-right p-3">CP</th>
                  <th className="text-right p-3">VP</th>
                  <th className="text-right p-3">Salário</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="p-3 font-medium">
                      <Link to="/jogadores/$name" params={{ name: r.player_name }} className="hover:text-primary hover:underline">
                        {r.player_name}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {r.nationality ? (
                        <Link to="/paises/$name" params={{ name: r.nationality }} className="hover:text-primary hover:underline">
                          {r.nationality}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-right tabular-nums">{r.age ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{fmtNum(r.games, 0)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtNum(r.gls, 0)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtNum(r.ast, 0)}</td>
                    <td className="p-3 text-right tabular-nums">{r.xg == null ? "—" : fmtNum(r.xg, 2)}</td>
                    <td className="p-3 text-right tabular-nums">{r.pass_pct == null ? "—" : fmtNum(r.pass_pct, 1)}</td>
                    <td className="p-3 text-right tabular-nums">{r.tackles_per90 == null ? "—" : fmtNum(r.tackles_per90, 2)}</td>
                    <td className="p-3 text-right tabular-nums">{r.fouls_per90 == null ? "—" : fmtNum(r.fouls_per90, 2)}</td>
                    <td className="p-3 text-right tabular-nums">{r.shot_pct == null ? "—" : fmtNum(r.shot_pct, 1)}</td>
                    <td className="p-3 text-right tabular-nums">{r.yellows == null ? "—" : fmtNum(r.yellows, 0)}</td>
                    <td className="p-3 text-right tabular-nums">{r.reds == null ? "—" : fmtNum(r.reds, 0)}</td>
                    <td className="p-3 text-right tabular-nums">{r.avg_rating == null ? "—" : fmtNum(r.avg_rating, 2)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtNum(r.ca, 0)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtNum(r.cp, 0)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtMoney(r.vp)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtMoney(r.salary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function ClubSeasonFilter({
  years,
  value,
  onChange,
  label = "Época",
}: {
  years: number[];
  value: number | null;
  onChange: (v: number) => void;
  label?: string;
}) {
  if (!years.length) return null;
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value == null ? "" : String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
}
