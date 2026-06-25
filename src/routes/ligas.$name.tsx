import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, ArrowLeft, Crown, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import { PlayerAttrsChart } from "@/components/PlayerAttrsChart";

export const Route = createFileRoute("/ligas/$name")({
  component: LeagueProfilePage,
});

function leagueKey(s: { module: string; division_label?: string | null; division_num: number | null }) {
  if (s.division_label) return s.division_label;
  if (s.module === "superleague" && s.division_num != null) return `Div. ${s.division_num}`;
  return "";
}

function LeagueProfilePage() {
  const { name } = Route.useParams();
  const decoded = decodeURIComponent(name);
  const { data, isLoading } = useRankings();
  const [view, setView] = useState<"club" | "coach">("club");

  const champions = useMemo(() => {
    if (!data) return [] as { year: number; club: string; coach: string | null; module: string }[];
    const coachIdx = new Map<string, string>(); // season|module|club -> coach
    for (const c of data.data.coaches) {
      if (!c.club_name) continue;
      coachIdx.set(`${c.season_year}|${c.module}|${c.club_name}`, c.name);
    }
    const out: { year: number; club: string; coach: string | null; module: string }[] = [];
    for (const s of data.data.standings) {
      if (!s.is_champion) continue;
      if (leagueKey(s) !== decoded) continue;
      const coach = coachIdx.get(`${s.season_year}|${s.module}|${s.club_name}`) ?? null;
      out.push({ year: s.season_year, club: s.club_name, coach, module: s.module });
    }
    return out.sort((a, b) => b.year - a.year);
  }, [data, decoded]);

  const summary = useMemo(() => {
    const clubCount: Record<string, number> = {};
    const coachCount: Record<string, number> = {};
    for (const c of champions) {
      clubCount[c.club] = (clubCount[c.club] ?? 0) + 1;
      if (c.coach) coachCount[c.coach] = (coachCount[c.coach] ?? 0) + 1;
    }
    const sort = (m: Record<string, number>) =>
      Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { clubs: sort(clubCount), coaches: sort(coachCount) };
  }, [champions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }
  if (!data) return <p className="text-muted-foreground">Sem dados.</p>;

  const moduleLabel = champions[0]?.module === "superleague" ? "Super League" : champions.length ? "Liga Nacional" : "Liga";
  const list = view === "club" ? summary.clubs : summary.coaches;

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
          <p className="text-xs uppercase tracking-wider text-primary">{moduleLabel}</p>
          <h1 className="text-2xl font-bold tracking-tight">{decoded}</h1>
        </div>
      </div>

      {!champions.length ? (
        <p className="text-muted-foreground">Sem campeões registados para esta liga/divisão.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Mostrar:</span>
            <div className="flex rounded-lg border border-border p-1">
              <Button size="sm" variant={view === "club" ? "default" : "ghost"} onClick={() => setView("club")}>
                Clubes
              </Button>
              <Button size="sm" variant={view === "coach" ? "default" : "ghost"} onClick={() => setView("coach")}>
                Treinadores
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                    <th className="text-left p-3 w-12">#</th>
                    <th className="text-left p-3">{view === "club" ? "Clube" : "Treinador"}</th>
                    <th className="text-right p-3 w-24">Títulos</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(([name, n], i) => (
                    <tr key={name} className="border-b border-border/50 hover:bg-muted/50">
                      <td className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</td>
                      <td className="p-3 font-medium">
                        {view === "club" ? (
                          <Link to="/clubes/$name" params={{ name }} className="hover:text-primary">{name}</Link>
                        ) : (
                          <Link to="/treinadores/$name" params={{ name }} className="hover:text-primary">{name}</Link>
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">{n}</td>
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
                  </tr>
                </thead>
                <tbody>
                  {champions.map((c) => (
                    <tr key={`${c.year}-${c.club}`} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="p-3 tabular-nums">{c.year}</td>
                      <td className="p-3 font-medium">
                        <Link to="/clubes/$name" params={{ name: c.club }} className="hover:text-primary">{c.club}</Link>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {c.coach ? (
                          <Link to="/treinadores/$name" params={{ name: c.coach }} className="hover:text-primary">{c.coach}</Link>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Evolução do plantel da liga</CardTitle></CardHeader>
            <CardContent><PlayerAttrsChart players={data.data.players} filter={{ league: decoded }} /></CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
