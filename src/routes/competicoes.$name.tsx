import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Trophy, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";

export const Route = createFileRoute("/competicoes/$name")({
  component: CompetitionPage,
});

type Row = { year: number; winner: string | null; club: string | null; coach: string | null; country: string | null };

function CompetitionPage() {
  const { name } = Route.useParams();
  const decoded = decodeURIComponent(name);
  const { data, isLoading } = useRankings();
  const [view, setView] = useState<"club" | "coach" | "country">("club");

  const { rows, kind } = useMemo(() => {
    if (!data) return { rows: [] as Row[], kind: "?" };
    const clubCountry = data.data.clubCountry;
    const coachByKey = new Map<string, string>();
    for (const c of data.data.coaches) {
      if (!c.club_name) continue;
      coachByKey.set(`${c.module}|${c.season_year}|${c.club_name}`, c.name);
    }

    // Try Continental
    const cont = data.data.continental.filter((c) => c.competition === decoded && c.winner);
    if (cont.length) {
      return {
        kind: "Continental",
        rows: cont.map((c) => ({
          year: c.season_year,
          winner: c.winner,
          club: c.winner,
          coach: c.winner ? coachByKey.get(`superleague|${c.season_year}|${c.winner}`) ?? coachByKey.get(`national|${c.season_year}|${c.winner}`) ?? null : null,
          country: c.winner ? clubCountry[c.winner] ?? null : null,
        })) as Row[],
      };
    }

    // Try International
    const intl = (data.data.international ?? []).filter((c) => c.competition === decoded && c.winner);
    if (intl.length) {
      return {
        kind: "Internacional",
        rows: intl.map((c) => ({
          year: c.season_year,
          winner: c.winner,
          club: null,
          coach: c.coach1 && c.team1 === c.winner ? c.coach1 : c.coach2 && c.team2 === c.winner ? c.coach2 : null,
          country: c.winner,
        })) as Row[],
      };
    }

    // Else: a league/division
    const leagueMatch = (s: typeof data.data.standings[number]) => {
      if (!s.is_champion) return false;
      if (s.division_label === decoded) return true;
      if (s.module === "superleague" && s.division_num != null && `Div. ${s.division_num}` === decoded) return true;
      return false;
    };
    const champions = data.data.standings.filter(leagueMatch);
    if (champions.length) {
      const kind = champions[0].module === "superleague" ? "Super League" : "Liga Nacional";
      return {
        kind,
        rows: champions.map((s) => ({
          year: s.season_year,
          winner: s.club_name,
          club: s.club_name,
          coach: coachByKey.get(`${s.module}|${s.season_year}|${s.club_name}`) ?? null,
          country: clubCountry[s.club_name] ?? null,
        })).sort((a, b) => b.year - a.year) as Row[],
      };
    }

    return { rows: [] as Row[], kind: "?" };
  }, [data, decoded]);

  // Aggregate by view
  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    const years = new Map<string, number[]>();
    for (const r of rows) {
      const key = view === "club" ? r.club : view === "coach" ? r.coach : r.country;
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const ys = years.get(key) ?? [];
      ys.push(r.year);
      years.set(key, ys);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, n]) => ({ name, n, years: (years.get(name) ?? []).sort((a, b) => b - a) }));
  }, [rows, view]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> A carregar…</div>;
  }

  const linkFor = view === "club" ? "/clubes/$name" as const : view === "coach" ? "/treinadores/$name" as const : "/paises/$name" as const;

  return (
    <div className="space-y-6">
      <Link to="/rankings" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <div className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
          <Trophy className="size-7" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-primary">{kind}</p>
          <h1 className="text-2xl font-bold tracking-tight">{decoded}</h1>
          <p className="text-xs text-muted-foreground mt-1">{rows.length} edições com campeão registado</p>
        </div>
      </div>

      {!rows.length ? (
        <p className="text-muted-foreground">Sem campeões registados para esta competição.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">Mostrar:</span>
            <div className="flex rounded-lg border border-border p-1">
              <Button size="sm" variant={view === "club" ? "default" : "ghost"} onClick={() => setView("club")} disabled={!rows.some((r) => r.club)}>Clubes</Button>
              <Button size="sm" variant={view === "coach" ? "default" : "ghost"} onClick={() => setView("coach")} disabled={!rows.some((r) => r.coach)}>Treinadores</Button>
              <Button size="sm" variant={view === "country" ? "default" : "ghost"} onClick={() => setView("country")} disabled={!rows.some((r) => r.country)}>Países</Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                    <th className="text-left p-3 w-12">#</th>
                    <th className="text-left p-3">{view === "club" ? "Clube" : view === "coach" ? "Treinador" : "País"}</th>
                    <th className="text-right p-3 w-20">Títulos</th>
                    <th className="text-left p-3">Anos</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((r, i) => (
                    <tr key={r.name} className="border-b border-border/50 hover:bg-muted/50">
                      <td className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</td>
                      <td className="p-3 font-medium">
                        <Link to={linkFor} params={{ name: r.name }} className="hover:text-primary">{r.name}</Link>
                      </td>
                      <td className="p-3 text-right tabular-nums">{r.n}</td>
                      <td className="p-3 text-xs text-muted-foreground tabular-nums">{r.years.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                    <th className="text-left p-3 w-20">Época</th>
                    <th className="text-left p-3"><Crown className="size-3.5 inline mr-1" /> Campeão</th>
                    <th className="text-left p-3">Treinador</th>
                    <th className="text-left p-3">País</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.year}-${i}`} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="p-3 tabular-nums">{r.year}</td>
                      <td className="p-3 font-medium">
                        {r.club ? <Link to="/clubes/$name" params={{ name: r.club }} className="hover:text-primary">{r.club}</Link> : r.winner ?? "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {r.coach ? <Link to="/treinadores/$name" params={{ name: r.coach }} className="hover:text-primary">{r.coach}</Link> : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {r.country ? <Link to="/paises/$name" params={{ name: r.country }} className="hover:text-primary">{r.country}</Link> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
