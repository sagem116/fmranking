import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Crown, Shield, Users, Globe2, Trophy, Goal, Handshake, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRankings } from "@/lib/useRankings";
import { rankBy, type RankingEntry, type BreakdownItem } from "@/lib/fm-rankings";
import { computeGoals, computeAssists, listPlayerYears, type PlayerStatRow } from "@/lib/fm-players";
import { SeasonFilter } from "@/components/SeasonFilter";
import { fmtPts, fmtNum, fmtMoney } from "@/lib/fmt";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";

function yearRanking(
  evo: Record<string, Record<number, number>>,
  bd: Record<string, BreakdownItem[]>,
  year: number,
): RankingEntry[] {
  const out: RankingEntry[] = [];
  for (const name of Object.keys(evo)) {
    const w = evo[name]?.[year] ?? 0;
    if (w <= 0) continue;
    const titles = (bd[name] ?? []).filter(
      (b) => b.season_year === year && (b.source === "champion-bonus" || b.source === "continental-win"),
    ).length;
    out.push({ name, raw: 0, weighted: w, titles });
  }
  return out.sort((a, b) => b.weighted - a.weighted);
}

export const Route = createFileRoute("/hall-of-fame")({
  head: () => ({
    meta: [
      { title: "Hall of Fame — FM World Rankings" },
      { name: "description", content: "Os maiores clubes, treinadores e países da história." },
    ],
  }),
  component: HallOfFame,
});

function Podium({ title, icon: Icon, entries, to }: {
  title: string;
  icon: typeof Shield;
  entries: RankingEntry[];
  to: "/clubes/$name" | "/treinadores/$name" | "/paises/$name";
}) {
  const medals = ["text-gold", "text-muted-foreground", "text-amber-700"];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Icon className="size-5 text-primary" /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.slice(0, 10).map((e, i) => (
          <Link
            key={e.name}
            to={to}
            params={{ name: e.name }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/60 transition-colors"
          >
            <span className={`w-6 text-center font-bold ${i < 3 ? medals[i] : "text-muted-foreground"}`}>{i + 1}</span>
            <span className="flex-1 font-medium truncate">{e.name}</span>
            {e.titles > 0 && (
              <span className="text-xs text-gold flex items-center gap-1"><Crown className="size-3" /> {e.titles}</span>
            )}
            <span className="text-sm font-semibold tabular-nums">{fmtPts(e.weighted)}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function PlayerPodium({ title, icon: Icon, rows, unit }: {
  title: string;
  icon: typeof Goal;
  rows: PlayerStatRow[];
  unit: string;
}) {
  const medals = ["text-gold", "text-muted-foreground", "text-amber-700"];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Icon className="size-5 text-primary" /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Sem dados de jogadores.</p>
        )}
        {rows.slice(0, 10).map((r, i) => (
          <Link
            to="/jogadores/$name"
            params={{ name: r.name }}
            key={r.name + i}
            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/60 transition-colors"
          >
            <span className={`w-6 text-center font-bold ${i < 3 ? medals[i] : "text-muted-foreground"}`}>{i + 1}</span>
            <span className="flex-1 font-medium truncate">{r.name}</span>
            <span className="text-sm font-semibold tabular-nums">{r.total.toLocaleString("pt-PT")} {unit}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function HallOfFame() {
  const { data, isLoading } = useRankings();
  const years = useMemo(() => (data ? listPlayerYears(data.data.players) : []), [data]);
  const entityYears = useMemo(() => data?.ranks.years ?? [], [data]);
  const [year, setYear] = useState<"total" | number>("total");
  const [entityYear, setEntityYear] = useState<"total" | number>("total");

  const { goals, assists } = useMemo(() => {
    if (!data) return { goals: { rows: [] as PlayerStatRow[], years: [] }, assists: { rows: [] as PlayerStatRow[], years: [] } };
    const y = year === "total" ? "all" : year;
    return {
      goals: computeGoals(data.data.players, y),
      assists: computeAssists(data.data.players, y),
    };
  }, [data, year]);

  const entityRanks = useMemo(() => {
    if (!data) return { clubs: [] as RankingEntry[], coaches: [] as RankingEntry[], countries: [] as RankingEntry[] };
    if (entityYear === "total") {
      return {
        clubs: rankBy(data.ranks.clubs, "weighted"),
        coaches: rankBy(data.ranks.coaches, "weighted"),
        countries: rankBy(data.ranks.countries, "weighted"),
      };
    }
    return {
      clubs: yearRanking(data.ranks.evolution.clubs, data.ranks.breakdown.clubs, entityYear),
      coaches: yearRanking(data.ranks.evolution.coaches, data.ranks.breakdown.coaches, entityYear),
      countries: yearRanking(data.ranks.evolution.countries, data.ranks.breakdown.countries, entityYear),
    };
  }, [data, entityYear]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }
  if (!data || data.ranks.clubs.length === 0) {
    return <p className="text-muted-foreground">Sem dados. Importe uma época primeiro.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="size-6 text-gold" /> Hall of Fame
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Os maiores de sempre, por pontuação ponderada</p>
      </div>
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">Filtrar clubes / treinadores / países:</span>
        <SeasonFilter value={entityYear} onChange={setEntityYear} years={entityYears} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Podium title="Clubes" icon={Shield} entries={entityRanks.clubs} to="/clubes/$name" />
        <Podium title="Treinadores" icon={Users} entries={entityRanks.coaches} to="/treinadores/$name" />
        <Podium title="Países" icon={Globe2} entries={entityRanks.countries} to="/paises/$name" />
      </div>
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="size-5 text-gold" /> Jogadores
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtrar:</span>
            <SeasonFilter value={year} onChange={setYear} years={years} />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <PlayerPodium title="Golos" icon={Goal} rows={goals.rows} unit="gls" />
          <PlayerPodium title="Assistências" icon={Handshake} rows={assists.rows} unit="ast" />
        </div>
      </div>
    </div>
  );
}
