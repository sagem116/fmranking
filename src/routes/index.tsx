import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shield, Users, Globe2, Trophy, UploadCloud, Loader2, Crown, Clock, Database, AlertTriangle, User as UserIcon, Award } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import type { RankingEntry } from "@/lib/fm-rankings";
import { supabase } from "@/integrations/supabase/client";
import { Sparkline } from "@/components/Sparkline";
import { fmtPts } from "@/lib/fmt";
import { loadReputations, loadClubAliases, reputationFor } from "@/lib/fm-club-reputation";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — FM World Rankings" },
      { name: "description", content: "Estado da base de dados, alertas e líderes atuais." },
      { property: "og:title", content: "FM World Rankings — Dashboard" },
      { property: "og:description", content: "Painel de controlo com estado, alertas e líderes atuais." },
    ],
  }),
  component: Index,
});

function useLastImport() {
  return useQuery({
    queryKey: ["last-import"],
    queryFn: async () => {
      const { data } = await supabase
        .from("imports")
        .select("filename, module, created_at, status, warnings")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
}

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { data, isLoading } = useRankings();
  const { data: psData } = usePlayerStatsData();
  const { data: lastImport } = useLastImport();

  const stats = useMemo(() => {
    if (!data) return null;
    const players = data.data.players;
    const standings = data.data.standings;
    const coaches = data.data.coaches;
    const seasons = data.data.seasons;
    const clubCountry = data.data.clubCountry;
    const allClubs = Object.keys(clubCountry);

    // Distinct competitions across all sources
    const compSet = new Set<string>();
    for (const s of standings) if (s.competition) compSet.add(s.competition);
    for (const p of psData?.players ?? []) if (p.competition) compSet.add(p.competition);

    // Distinct coaches
    const coachSet = new Set<string>();
    for (const c of coaches ?? []) if (c.name) coachSet.add(c.name);

    // Distinct players (prefer IDU)
    const playerSet = new Set<string>();
    for (const p of psData?.players ?? []) {
      const pid = (p.idu && p.idu.trim()) ? `idu:${p.idu.trim()}` : `nm:${p.player_name.toLowerCase()}`;
      playerSet.add(pid);
    }
    for (const p of players) {
      const pid = (p.idu && p.idu.trim()) ? `idu:${p.idu.trim()}` : `nm:${p.name.toLowerCase()}`;
      playerSet.add(pid);
    }

    // Alerts
    const latestYear = players.length ? Math.max(...players.map((p) => p.season_year)) : (psData?.players ? Math.max(...psData.players.map((p) => p.season_year)) : 0);
    const playersPerClubLatest = new Map<string, number>();
    for (const p of psData?.players ?? []) {
      if (p.season_year !== latestYear || !p.club) continue;
      playersPerClubLatest.set(p.club, (playersPerClubLatest.get(p.club) ?? 0) + 1);
    }
    const clubsWithoutPlayers = allClubs.filter((c) => (playersPerClubLatest.get(c) ?? 0) === 0);
    const playersWithoutClub = (psData?.players ?? []).filter((p) => !p.club || !p.club.trim()).length;

    // Coaches without club (latest season)
    const latestCoachYear = (coaches ?? []).length ? Math.max(...(coaches ?? []).map((c) => c.season_year)) : 0;
    const coachesWithoutClub = (coaches ?? []).filter((c) => c.season_year === latestCoachYear && !c.club_name).length;

    // Competitions without reputation (via club-reputation heuristic)
    const aliases = loadClubAliases();
    const reps = loadReputations();
    const compsMissingRep: string[] = [];
    const compClubMap = new Map<string, Set<string>>();
    for (const p of psData?.players ?? []) {
      if (!p.competition) continue;
      let s = compClubMap.get(p.competition);
      if (!s) { s = new Set(); compClubMap.set(p.competition, s); }
      if (p.club) s.add(p.club);
    }
    for (const [comp, clubs] of compClubMap) {
      const reputations: number[] = [];
      for (const c of clubs) { const v = reputationFor(c, aliases, reps); if (typeof v === "number") reputations.push(v); }
      if (reputations.length === 0) compsMissingRep.push(comp);
    }

    // Warnings from last import
    const warnCount = Array.isArray(lastImport?.warnings) ? (lastImport!.warnings as unknown[]).length : 0;

    return {
      nSeasons: seasons.length,
      nClubs: allClubs.length,
      nCoaches: coachSet.size,
      nPlayers: playerSet.size,
      nCompetitions: compSet.size,
      clubsWithoutPlayers,
      playersWithoutClub,
      coachesWithoutClub,
      compsMissingRep,
      warnCount,
    };
  }, [data, psData, lastImport]);

  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular rankings…
      </div>
    );
  }

  const seasons = data?.data.seasons ?? [];
  const hasData = seasons.length > 0 && (data?.ranks.clubs.length ?? 0) > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-soft via-gold to-gold-deep text-primary-foreground shadow-[0_0_40px_-6px_oklch(0.82_0.17_88/0.6)] mb-5">
          <Trophy className="size-8" />
        </div>
        <h1 className="text-2xl font-display font-bold">Bem-vindo ao FM World Rankings</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Importe a sua primeira época de Football Manager para começar a gerar rankings mundiais de clubes, treinadores e países.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/importar">
            <UploadCloud className="size-4" /> Importar primeira época
          </Link>
        </Button>
      </div>
    );
  }

  const bestClub = data!.ranks.clubs[0];
  const bestCoach = data!.ranks.coaches[0];
  const bestCountry = data!.ranks.countries[0];
  const years = seasons.map((s) => s.year);

  // Top players (goals) and competitions (by count of clubs) from psData
  const topPlayer = (() => {
    if (!psData) return null;
    const map = new Map<string, number>();
    for (const p of psData.players) map.set(p.player_name, (map.get(p.player_name) ?? 0) + (p.gls || 0));
    let best: { name: string; value: number } | null = null;
    for (const [name, value] of map) if (!best || value > best.value) best = { name, value };
    return best;
  })();
  const topCompetition = (() => {
    if (!psData) return null;
    const map = new Map<string, Set<string>>();
    for (const p of psData.players) {
      if (!p.competition) continue;
      let s = map.get(p.competition); if (!s) { s = new Set(); map.set(p.competition, s); }
      if (p.club) s.add(p.club);
    }
    let best: { name: string; value: number } | null = null;
    for (const [name, s] of map) if (!best || s.size > best.value) best = { name, value: s.size };
    return best;
  })();

  const alerts = [
    { key: "clubs-no-players", label: "Clubes sem jogadores", count: stats?.clubsWithoutPlayers.length ?? 0, to: "/debug-clubes" as const },
    { key: "players-no-club", label: "Jogadores sem clube", count: stats?.playersWithoutClub ?? 0, to: "/debug-jogadores" as const },
    { key: "coaches-no-club", label: "Treinadores sem clube", count: stats?.coachesWithoutClub ?? 0, to: "/debug-treinadores" as const },
    { key: "comps-no-rep", label: "Competições sem reputação", count: stats?.compsMissingRep.length ?? 0, to: "/debug-competicoes" as const },
    { key: "import-warns", label: "Avisos na última importação", count: stats?.warnCount ?? 0, to: "/importar" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold tracking-tight gold-shimmer">Painel de Controlo</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {seasons.length} época{seasons.length > 1 ? "s" : ""} · {Math.min(...years)}–{Math.max(...years)}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link to="/rankings">
            <Trophy className="size-4" /> Rankings
          </Link>
        </Button>
      </div>

      {lastImport && (
        <div className="flex items-center gap-3 rounded-xl border border-gold/20 bg-gold/5 px-4 py-2.5 text-sm">
          <Clock className="size-4 text-gold shrink-0" />
          <div className="min-w-0 flex-1 truncate">
            <span className="text-muted-foreground">Última importação: </span>
            <span className="font-medium">{lastImport.filename}</span>
            <span className="text-muted-foreground"> · {lastImport.module}</span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            {new Date(lastImport.created_at!).toLocaleString("pt-PT")}
          </span>
        </div>
      )}

      {/* Estado da Base de Dados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Database className="size-4 text-primary" /> Estado da Base de Dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <DbStat label="Épocas" value={stats?.nSeasons ?? 0} />
            <DbStat label="Clubes" value={stats?.nClubs ?? 0} />
            <DbStat label="Jogadores" value={stats?.nPlayers ?? 0} />
            <DbStat label="Treinadores" value={stats?.nCoaches ?? 0} />
            <DbStat label="Competições" value={stats?.nCompetitions ?? 0} />
          </div>
        </CardContent>
      </Card>

      {/* Estado dos Dados / Alertas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" /> Estado dos Dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {alerts.map((a) => (
              <Link
                key={a.key}
                to={a.to}
                className={`rounded-xl border p-3 hover:bg-muted/40 transition-colors ${
                  a.count > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border/60"
                }`}
              >
                <p className={`text-2xl font-bold tabular-nums ${a.count > 0 ? "text-amber-500" : "text-success"}`}>
                  {a.count.toLocaleString("pt-PT")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{a.label}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resumo Geral / Líderes atuais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Crown className="size-4 text-gold" /> Líderes Atuais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <LeaderTile icon={Shield} label="Clube" name={bestClub?.name} value={fmtPts(bestClub?.weighted ?? 0)} to="/clubes/$name" params={{ name: bestClub?.name ?? "" }} accent />
            <LeaderTile icon={Users} label="Treinador" name={bestCoach?.name} value={fmtPts(bestCoach?.weighted ?? 0)} to="/treinadores/$name" params={{ name: bestCoach?.name ?? "" }} />
            <LeaderTile icon={Globe2} label="País" name={bestCountry?.name} value={fmtPts(bestCountry?.weighted ?? 0)} to="/paises/$name" params={{ name: bestCountry?.name ?? "" }} />
            <LeaderTile icon={UserIcon} label="Jogador (golos)" name={topPlayer?.name ?? "—"} value={topPlayer ? `${topPlayer.value} gls` : "—"} to={topPlayer ? "/jogadores/$name" : undefined} params={topPlayer ? { name: topPlayer.name } : undefined} />
            <LeaderTile icon={Award} label="Competição" name={topCompetition?.name ?? "—"} value={topCompetition ? `${topCompetition.value} clubes` : "—"} to={topCompetition ? "/competicoes/$name" : undefined} params={topCompetition ? { name: topCompetition.name } : undefined} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <TopList title="Top Clubes" icon={Shield} entries={data!.ranks.clubs} evolution={data!.ranks.evolution.clubs} years={data!.ranks.years} />
        <TopList title="Top Treinadores" icon={Users} entries={data!.ranks.coaches} evolution={data!.ranks.evolution.coaches} years={data!.ranks.years} />
        <TopList title="Top Países" icon={Globe2} entries={data!.ranks.countries} evolution={data!.ranks.evolution.countries} years={data!.ranks.years} />
      </div>
    </div>
  );
}

function DbStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold tabular-nums gold-shimmer">{value.toLocaleString("pt-PT")}</p>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LeaderTile({ icon: Icon, label, name, value, to, params, accent }: { icon: any; label: string; name?: string; value: string; to?: any; params?: any; accent?: boolean }) {
  const content = (
    <div className={`rounded-xl border p-3 transition-colors ${accent ? "border-gold/40 bg-gold/5" : "border-border/60 hover:bg-muted/40"}`}>
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground tracking-wider">
        <Icon className="size-3.5" /> {label}
      </div>
      <p className="mt-2 font-display font-bold truncate">{name ?? "—"}</p>
      <p className="text-xs text-muted-foreground tabular-nums mt-0.5">{value}</p>
    </div>
  );
  if (!to) return content;
  return <Link to={to} params={params}>{content}</Link>;
}

function TopList({
  title,
  icon: Icon,
  entries,
  evolution,
  years,
}: {
  title: string;
  icon: typeof Shield;
  entries: RankingEntry[];
  evolution: Record<string, Record<number, number>>;
  years: number[];
}) {
  return (
    <Card className="card-glow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <Icon className="size-4 text-gold" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {entries.slice(0, 8).map((e, i) => {
          const evo = evolution[e.name] ?? {};
          const series = years.map((y) => evo[y] ?? 0);
          return (
            <div key={e.name} className="flex items-center gap-3 py-1.5 text-sm border-b border-border/40 last:border-0">
              <span className={`w-5 text-center font-bold tabular-nums ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</span>
              <span className="flex-1 truncate">{e.name}</span>
              <Sparkline values={series} />
              <span className="font-semibold tabular-nums w-16 text-right">{fmtPts(e.weighted)}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
