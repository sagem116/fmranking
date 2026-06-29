import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { fmtNum } from "@/lib/fmt";
import type { CompType } from "@/lib/fm-player-stats-db";

const COMP_LABEL: Record<CompType, string> = {
  superleague: "Super League",
  national: "Liga Nacional",
  continental: "Continental",
  international: "Internacional",
};

function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

export function PlayerNewStatsSection({ playerName }: { playerName: string }) {
  const { data, isLoading } = usePlayerStatsData();
  const rows = useMemo(() => {
    if (!data) return [];
    const target = norm(playerName);
    return data.players
      .filter((r) => norm(r.player_name) === target)
      .sort((a, b) => b.season_year - a.season_year);
  }, [data, playerName]);

  if (isLoading || !rows.length) return null;
  const first = rows[0];
  const totals = rows.reduce(
    (a, r) => ({
      gls: a.gls + r.gls,
      ast: a.ast + r.ast,
      games: a.games + r.games,
      hdj: a.hdj + r.hdj,
    }),
    { gls: 0, ast: 0, games: 0, hdj: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Estatísticas (novos rankings)
          {first.nationality && <Badge variant="outline">NAC: {first.nationality}</Badge>}
          {first.idu && <Badge variant="outline">IDU: {first.idu}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3">Época</th>
              <th className="text-left p-3">Comp.</th>
              <th className="text-left p-3">Competição</th>
              <th className="text-left p-3">Clube</th>
              <th className="text-right p-3">Gls</th>
              <th className="text-right p-3">Ast</th>
              <th className="text-right p-3">Jogos</th>
              <th className="text-right p-3">HDJ</th>
              <th className="text-right p-3">CA</th>
              <th className="text-right p-3">CP</th>
              <th className="text-right p-3">RM</th>
              <th className="text-right p-3">Idade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                <td className="p-3 tabular-nums">{r.season_year}</td>
                <td className="p-3 text-xs text-muted-foreground">{COMP_LABEL[r.comp_type]}</td>
                <td className="p-3">{r.competition}</td>
                <td className="p-3">{r.club ?? "—"}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.gls, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.ast, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.games, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.hdj, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.ca, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.cp, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.rm, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.age, 2)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/30 font-semibold">
              <td className="p-3" colSpan={4}>Totais</td>
              <td className="p-3 text-right tabular-nums">{fmtNum(totals.gls, 2)}</td>
              <td className="p-3 text-right tabular-nums">{fmtNum(totals.ast, 2)}</td>
              <td className="p-3 text-right tabular-nums">{fmtNum(totals.games, 2)}</td>
              <td className="p-3 text-right tabular-nums">{fmtNum(totals.hdj, 2)}</td>
              <td className="p-3" colSpan={4}></td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function ClubNewStatsSection({ clubName }: { clubName: string }) {
  const { data, isLoading } = usePlayerStatsData();
  const agg = useMemo(() => {
    if (!data) return null;
    const target = norm(clubName);
    const rows = data.players.filter((r) => norm(r.club) === target);
    if (!rows.length) return null;
    const bySeason = new Map<number, typeof rows>();
    for (const r of rows) {
      const arr = bySeason.get(r.season_year) ?? [];
      arr.push(r);
      bySeason.set(r.season_year, arr);
    }
    const seasons = [...bySeason.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, rs]) => {
        const n = rs.length;
        const sum = rs.reduce(
          (a, r) => ({
            gls: a.gls + r.gls,
            ast: a.ast + r.ast,
            games: a.games + r.games,
            ca: a.ca + r.ca,
            cp: a.cp + r.cp,
            rm: a.rm + r.rm,
            age: a.age + r.age,
            salary: a.salary + r.salary,
          }),
          { gls: 0, ast: 0, games: 0, ca: 0, cp: 0, rm: 0, age: 0, salary: 0 },
        );
        return {
          year,
          players: n,
          gls: sum.gls,
          ast: sum.ast,
          games: sum.games,
          ca: sum.ca / n,
          cp: sum.cp / n,
          rm: sum.rm / n,
          age: sum.age / n,
          salary: sum.salary,
        };
      });
    return seasons;
  }, [data, clubName]);

  if (isLoading || !agg) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estatísticas do plantel (novos rankings)</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3">Época</th>
              <th className="text-right p-3">Jogadores</th>
              <th className="text-right p-3">Gls</th>
              <th className="text-right p-3">Ast</th>
              <th className="text-right p-3">Jogos</th>
              <th className="text-right p-3">CA méd.</th>
              <th className="text-right p-3">CP méd.</th>
              <th className="text-right p-3">RM méd.</th>
              <th className="text-right p-3">Idade méd.</th>
              <th className="text-right p-3">Salário</th>
            </tr>
          </thead>
          <tbody>
            {agg.map((s) => (
              <tr key={s.year} className="border-b border-border/50 hover:bg-muted/50">
                <td className="p-3 tabular-nums">{s.year}</td>
                <td className="p-3 text-right tabular-nums">{s.players}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.gls, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.ast, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.games, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.ca, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.cp, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.rm, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.age, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.salary, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function CompetitionNewStatsSection({ competition }: { competition: string }) {
  const { data, isLoading } = usePlayerStatsData();
  const stats = useMemo(() => {
    if (!data) return null;
    const target = norm(competition);
    const rows = data.competitions.filter((c) => norm(c.competition) === target);
    return rows.length ? rows.sort((a, b) => b.season_year - a.season_year) : null;
  }, [data, competition]);

  if (isLoading || !stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Médias da competição (novos rankings)</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3">Época</th>
              <th className="text-right p-3">Jogadores</th>
              <th className="text-right p-3">CA</th>
              <th className="text-right p-3">CP</th>
              <th className="text-right p-3">VP</th>
              <th className="text-right p-3">Salário</th>
              <th className="text-right p-3">RA</th>
              <th className="text-right p-3">RM</th>
              <th className="text-right p-3">RC</th>
              <th className="text-right p-3">Idade</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.season_year} className="border-b border-border/50 hover:bg-muted/50">
                <td className="p-3 tabular-nums">{s.season_year}</td>
                <td className="p-3 text-right tabular-nums">{s.n_players}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.ca_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.cp_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.vp_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.salary_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.ra_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.rm_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.rc_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.age_avg, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}