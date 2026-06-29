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
  const { data: psData } = usePlayerStatsData();
  const years = useMemo(() => (data ? listPlayerYears(data.data.players) : []), [data]);
  const entityYears = useMemo(() => data?.ranks.years ?? [], [data]);
  const [year, setYear] = useState<"total" | number>("total");
  const [entityYear, setEntityYear] = useState<"total" | number>("total");
  const [newYear, setNewYear] = useState<"total" | number>("total");

  const newStatYears = useMemo(() => {
    if (!psData) return [] as number[];
    return [...new Set(psData.players.map((p) => p.season_year))].sort((a, b) => b - a);
  }, [psData]);

  const newStatsPodiums = useMemo(() => {
    type PRow = { name: string; value: number };
    type StatKey = "gls" | "ast" | "games" | "hdj" | "ca" | "cp" | "rm" | "vp" | "salary";
    const sumStats: StatKey[] = ["gls", "ast", "games", "hdj"];
    const maxStats: StatKey[] = ["ca", "cp", "rm", "vp", "salary"];
    const empty = Object.fromEntries(
      [...sumStats, ...maxStats].map((k) => [k, [] as PRow[]]),
    ) as Record<StatKey, PRow[]>;
    if (!psData) return empty;
    const rows = newYear === "total"
      ? psData.players
      : psData.players.filter((p) => p.season_year === newYear);
    const out = {} as Record<StatKey, PRow[]>;
    for (const stat of [...sumStats, ...maxStats]) {
      const isSum = sumStats.includes(stat);
      const map = new Map<string, number>();
      for (const r of rows) {
        const v = Number((r as any)[stat] ?? 0);
        if (!v) continue;
        const cur = map.get(r.player_name) ?? (isSum ? 0 : -Infinity);
        map.set(r.player_name, isSum ? cur + v : Math.max(cur, v));
      }
      out[stat] = [...map.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    }
    return out;
  }, [psData, newYear]);

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

      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Star className="size-5 text-gold" /> Estatísticas (Jogadores & Competições)
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtrar:</span>
            <SeasonFilter value={newYear} onChange={setNewYear} years={newStatYears} />
          </div>
        </div>
        {newStatYears.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados. Importe um ficheiro multi-folha em /importar.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <NewStatPodium title="Golos" icon={Goal} rows={newStatsPodiums.gls} fmt={(n) => fmtNum(n, 2)} />
            <NewStatPodium title="Assistências" icon={Handshake} rows={newStatsPodiums.ast} fmt={(n) => fmtNum(n, 2)} />
            <NewStatPodium title="Jogos" icon={Trophy} rows={newStatsPodiums.games} fmt={(n) => fmtNum(n, 2)} />
            <NewStatPodium title="Homem do Jogo" icon={Star} rows={newStatsPodiums.hdj} fmt={(n) => fmtNum(n, 2)} />
            <NewStatPodium title="CA (melhor)" icon={Star} rows={newStatsPodiums.ca} fmt={(n) => fmtNum(n, 2)} />
            <NewStatPodium title="CP (melhor)" icon={Star} rows={newStatsPodiums.cp} fmt={(n) => fmtNum(n, 2)} />
            <NewStatPodium title="RM (melhor)" icon={Star} rows={newStatsPodiums.rm} fmt={(n) => fmtNum(n, 2)} />
            <NewStatPodium title="Valor (VP)" icon={Star} rows={newStatsPodiums.vp} fmt={fmtMoney} />
            <NewStatPodium title="Salário" icon={Star} rows={newStatsPodiums.salary} fmt={fmtMoney} />
          </div>
        )}
      </div>
    </div>
  );
}

function NewStatPodium({ title, icon: Icon, rows, fmt }: {
  title: string;
  icon: typeof Goal;
  rows: { name: string; value: number }[];
  fmt: (n: number) => string;
}) {
  const medals = ["text-gold", "text-muted-foreground", "text-amber-700"];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Icon className="size-5 text-primary" /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
        {rows.map((r, i) => (
          <Link
            to="/jogadores/$name"
            params={{ name: r.name }}
            key={r.name + i}
            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/60 transition-colors"
          >
            <span className={`w-6 text-center font-bold ${i < 3 ? medals[i] : "text-muted-foreground"}`}>{i + 1}</span>
            <span className="flex-1 font-medium truncate">{r.name}</span>
            <span className="text-sm font-semibold tabular-nums">{fmt(r.value)}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
