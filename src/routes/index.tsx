import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Users, Globe2, Trophy, UploadCloud, Loader2, Crown, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import type { RankingEntry } from "@/lib/fm-rankings";
import { supabase } from "@/integrations/supabase/client";
import { Sparkline } from "@/components/Sparkline";
import { fmtPts } from "@/lib/fmt";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — FM World Rankings" },
      { name: "description", content: "Melhor Clube, Treinador e País do Mundo no Football Manager." },
      { property: "og:title", content: "FM World Rankings — Dashboard" },
      { property: "og:description", content: "Os melhores do mundo do Football Manager ao longo das épocas." },
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
        .select("filename, module, created_at, status")
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
  const { data: lastImport } = useLastImport();

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold tracking-tight gold-shimmer">Dashboard Mundial</h1>
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

      <div className="grid gap-4 md:grid-cols-3">
        <BestCard title="Melhor Clube do Mundo" icon={Shield} entry={bestClub} accent />
        <BestCard title="Melhor Treinador do Mundo" icon={Users} entry={bestCoach} />
        <BestCard title="Melhor País do Mundo" icon={Globe2} entry={bestCountry} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TopList title="Top Clubes" icon={Shield} entries={data!.ranks.clubs} evolution={data!.ranks.evolution.clubs} years={data!.ranks.years} />
        <TopList title="Top Treinadores" icon={Users} entries={data!.ranks.coaches} evolution={data!.ranks.evolution.coaches} years={data!.ranks.years} />
        <TopList title="Top Países" icon={Globe2} entries={data!.ranks.countries} evolution={data!.ranks.evolution.countries} years={data!.ranks.years} />
      </div>
    </div>
  );
}

function BestCard({
  title,
  icon: Icon,
  entry,
  accent,
}: {
  title: string;
  icon: typeof Shield;
  entry?: RankingEntry;
  accent?: boolean;
}) {
  return (
    <Card className={`relative overflow-hidden card-glow card-glow-hover ${accent ? "border-gold/40" : ""}`}>
      {accent && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/15 via-transparent to-transparent" />
      )}
      <CardHeader className="relative pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Icon className="size-3.5" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="flex items-center gap-2">
          <Crown className={`size-5 ${accent ? "gold-glow" : "text-gold"}`} />
          <span className="text-xl font-display font-bold truncate">{entry?.name ?? "—"}</span>
        </div>
        <div className="mt-3 flex gap-5 text-sm">
          <div>
            <p className="font-bold tabular-nums">{fmtPts(entry?.weighted ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Pontos ponderados</p>
          </div>
          <div>
            <p className="font-bold tabular-nums">{entry?.titles ?? 0}</p>
            <p className="text-xs text-muted-foreground">Títulos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
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
