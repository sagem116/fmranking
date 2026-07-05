import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { fmtNum, fmtMoney } from "@/lib/fmt";
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
              <th className="text-right p-3">RM</th>
              <th className="text-right p-3">Idade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                <td className="p-3 tabular-nums">{r.season_year}</td>
                <td className="p-3 text-xs text-muted-foreground">{COMP_LABEL[r.comp_type]}</td>
                <td className="p-3">
                  <Link to="/competicoes/$name" params={{ name: r.competition }} className="hover:text-primary hover:underline">
                    {r.competition}
                  </Link>
                </td>
                <td className="p-3">
                  {r.club ? <Link to="/clubes/$name" params={{ name: r.club }} className="hover:text-primary hover:underline">{r.club}</Link> : "—"}
                </td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.gls, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.ast, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.games, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(r.hdj, 2)}</td>
                <td className="p-3 text-right tabular-nums">{r.xg == null ? "—" : fmtNum(r.xg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{r.pass_pct == null ? "—" : fmtNum(r.pass_pct, 2)}</td>
                <td className="p-3 text-right tabular-nums">{r.tackles_per90 == null ? "—" : fmtNum(r.tackles_per90, 2)}</td>
                <td className="p-3 text-right tabular-nums">{r.fouls_per90 == null ? "—" : fmtNum(r.fouls_per90, 2)}</td>
                <td className="p-3 text-right tabular-nums">{r.shot_pct == null ? "—" : fmtNum(r.shot_pct, 2)}</td>
                <td className="p-3 text-right tabular-nums">{r.yellows == null ? "—" : fmtNum(r.yellows, 2)}</td>
                <td className="p-3 text-right tabular-nums">{r.reds == null ? "—" : fmtNum(r.reds, 2)}</td>
                <td className="p-3 text-right tabular-nums">{r.avg_rating == null ? "—" : fmtNum(r.avg_rating, 2)}</td>
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
              <td className="p-3" colSpan={12}></td>
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
    const byCompetition = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = `${r.season_year}|${r.comp_type}|${r.competition}`;
      const arr = byCompetition.get(key) ?? [];
      arr.push(r);
      byCompetition.set(key, arr);
    }
    const buildRow = (year: number | "total", compType: CompType | "total", competition: string, rs: typeof rows) => {
        const n = rs.length;
        const sum = rs.reduce(
          (a, r) => ({
            gls: a.gls + r.gls,
            ast: a.ast + r.ast,
            games: a.games + r.games,
            hdj: a.hdj + r.hdj,
            ca: a.ca + r.ca,
            cp: a.cp + r.cp,
            vp: a.vp + r.vp,
            rm: a.rm + r.rm,
            ra: a.ra + r.ra,
            rc: a.rc + r.rc,
            age: a.age + r.age,
            salary: a.salary + r.salary,
          }),
          { gls: 0, ast: 0, games: 0, hdj: 0, ca: 0, cp: 0, vp: 0, rm: 0, ra: 0, rc: 0, age: 0, salary: 0 },
        );
        return {
          year,
          compType,
          competition,
          players: n,
          gls: sum.gls,
          ast: sum.ast,
          games: sum.games,
          hdj: sum.hdj,
          ca: sum.ca / n,
          cp: sum.cp / n,
          vp: sum.vp / n,
          ra: sum.ra / n,
          rm: sum.rm / n,
          rc: sum.rc / n,
          age: sum.age / n,
          salary: sum.salary,
        };
    };
    const rowsByCompetition = [...byCompetition.values()]
      .map((rs) => buildRow(rs[0].season_year, rs[0].comp_type, rs[0].competition, rs))
      .sort((a, b) => Number(b.year) - Number(a.year) || a.competition.localeCompare(b.competition, "pt-PT"));
    return [...rowsByCompetition, buildRow("total", "total", "Total", rows)];
  }, [data, clubName]);

  if (isLoading || !agg) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estatísticas brutas do plantel por competição</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3">Época</th>
              <th className="text-left p-3">Comp.</th>
              <th className="text-left p-3">Competição</th>
              <th className="text-right p-3">Jogadores</th>
              <th className="text-right p-3">Gls</th>
              <th className="text-right p-3">Ast</th>
              <th className="text-right p-3">Jogos</th>
              <th className="text-right p-3">HDJ</th>
              <th className="text-right p-3">CA méd.</th>
              <th className="text-right p-3">CP méd.</th>
              <th className="text-right p-3">VP méd.</th>
              <th className="text-right p-3">RA méd.</th>
              <th className="text-right p-3">RM méd.</th>
              <th className="text-right p-3">RC méd.</th>
              <th className="text-right p-3">Idade méd.</th>
              <th className="text-right p-3">Salário</th>
            </tr>
          </thead>
          <tbody>
            {agg.map((s) => (
              <tr key={`${s.year}-${s.compType}-${s.competition}`} className={`border-b border-border/50 hover:bg-muted/50 ${s.compType === "total" ? "border-t-2 bg-muted/30 font-semibold" : ""}`}>
                <td className="p-3 tabular-nums">{s.year === "total" ? "—" : s.year}</td>
                <td className="p-3 text-xs text-muted-foreground">{s.compType === "total" ? "—" : COMP_LABEL[s.compType]}</td>
                <td className="p-3">
                  {s.compType === "total" ? "Total" : (
                    <Link to="/competicoes/$name" params={{ name: s.competition }} className="hover:text-primary hover:underline">
                      {s.competition}
                    </Link>
                  )}
                </td>
                <td className="p-3 text-right tabular-nums">{s.players}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.gls, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.ast, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.games, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.hdj, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.ca, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.cp, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtMoney(s.vp)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.ra, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.rm, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.rc, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.age, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtMoney(s.salary)}</td>
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
              <th className="text-right p-3">xG</th>
              <th className="text-right p-3">% Passe</th>
              <th className="text-right p-3">Des/90</th>
              <th className="text-right p-3">Fnt/90</th>
              <th className="text-right p-3">% Rem.</th>
              <th className="text-right p-3">Amr</th>
              <th className="text-right p-3">Ver</th>
              <th className="text-right p-3">Cl Med</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.season_year} className="border-b border-border/50 hover:bg-muted/50">
                <td className="p-3 tabular-nums">{s.season_year}</td>
                <td className="p-3 text-right tabular-nums">{s.n_players}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.ca_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.cp_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtMoney(s.vp_avg)}</td>
                <td className="p-3 text-right tabular-nums">{fmtMoney(s.salary_avg)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.ra_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.rm_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.rc_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{fmtNum(s.age_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{s.xg_avg == null ? "—" : fmtNum(s.xg_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{s.pass_pct_avg == null ? "—" : fmtNum(s.pass_pct_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{s.tackles_per90_avg == null ? "—" : fmtNum(s.tackles_per90_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{s.fouls_per90_avg == null ? "—" : fmtNum(s.fouls_per90_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{s.shot_pct_avg == null ? "—" : fmtNum(s.shot_pct_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{s.yellows_avg == null ? "—" : fmtNum(s.yellows_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{s.reds_avg == null ? "—" : fmtNum(s.reds_avg, 2)}</td>
                <td className="p-3 text-right tabular-nums">{s.avg_rating_avg == null ? "—" : fmtNum(s.avg_rating_avg, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}