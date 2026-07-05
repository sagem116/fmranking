import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Shield, ArrowLeft, Trophy, Crown, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRankings } from "@/lib/useRankings";
import { buildClubProfile } from "@/lib/fm-profiles";
import { MODULE_LABEL } from "@/components/EvolutionChart";
import { DynamicMetricChart } from "@/components/DynamicMetricChart";
import { DesafiosProfileCard } from "@/components/DesafiosProfileCard";
import { fmtPts } from "@/lib/fmt";
import { ClubNewStatsSection } from "@/components/NewStatsSections";
import { ClubRecordsSection } from "@/components/RecordsSection";
import { RankingEvolutionSection } from "@/components/RankingEvolutionSection";
import { ClubReputationSection } from "@/components/ClubReputationSection";
import { ClubPlantelSection, ClubSeasonFilter } from "@/components/ClubPlantelSection";
import { ClubCoachesHistorySection } from "@/components/ClubCoachesHistorySection";

export const Route = createFileRoute("/clubes/$name")({
  component: ClubProfilePage,
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function competitionLabelForStanding(s: {
  competition?: string | null;
  module: string;
  division_num: number | null;
  division_label: string | null;
}): string {
  if (s.competition && s.competition.trim()) return s.competition;
  if (s.module === "superleague") return s.division_num ? `Div. ${s.division_num}` : "Super League";
  return s.division_label ?? "Liga Nacional";
}

function TitleBadgeWithTooltip({
  icon,
  label,
  count,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  items: { competition: string; year: number }[];
}) {
  if (count === 0) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="gap-1 cursor-help">
          {icon} {count} {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm">
        <ul className="space-y-0.5 text-xs">
          {items
            .sort((a, b) => b.year - a.year)
            .map((it, i) => (
              <li key={i} className="flex justify-between gap-3 tabular-nums">
                <span>{it.competition}</span>
                <span className="opacity-70">{it.year}</span>
              </li>
            ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function ClubProfilePage() {
  const { name } = Route.useParams();
  const { data, isLoading } = useRankings();
  const profile = useMemo(() => (data ? buildClubProfile(data.data, name, data.config) : null), [data, name]);

  const availableYears = useMemo(() => {
    if (!profile) return [] as number[];
    const ys = new Set<number>();
    for (const s of profile.seasons) ys.add(s.year);
    for (const c of profile.continental) ys.add(c.year);
    return [...ys].sort((a, b) => b - a);
  }, [profile]);

  // Default season = latest global available across the app data
  const globalLatest = useMemo(() => {
    if (!data) return null;
    let m = 0;
    for (const s of data.data.standings) if (s.season_year > m) m = s.season_year;
    for (const c of data.data.continental) if (c.season_year > m) m = c.season_year;
    return m || null;
  }, [data]);
  const [season, setSeason] = useState<number | null>(null);
  const currentSeason = season ?? globalLatest;

  const titleItems = useMemo(() => {
    const sl: { competition: string; year: number }[] = [];
    const nat: { competition: string; year: number }[] = [];
    const cont: { competition: string; year: number }[] = [];
    if (!profile || !data) return { sl, nat, cont };
    // superleague/nacional titles come from standings
    for (const s of data.data.standings) {
      if (s.club_name !== profile.name || !s.is_champion) continue;
      const label = competitionLabelForStanding(s);
      const item = { competition: label, year: s.season_year };
      if (s.module === "superleague") sl.push(item); else if (s.module === "national") nat.push(item);
    }
    for (const c of profile.continental) if (c.won) cont.push({ competition: c.competition, year: c.year });
    return { sl, nat, cont };
  }, [profile, data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="space-y-4">
        <Link to="/clubes" className="text-sm text-primary inline-flex items-center gap-1"><ArrowLeft className="size-4" /> Clubes</Link>
        <p className="text-muted-foreground">Clube não encontrado: {name}</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
      <Link to="/clubes" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Todos os clubes
      </Link>
      <div className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
          <Shield className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
          {profile.country && (
            <Link to="/paises/$name" params={{ name: profile.country }} className="text-sm text-muted-foreground hover:text-primary">
              {profile.country}
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pontos brutos" value={fmtPts(profile.totalRaw)} />
        <Stat label="Títulos" value={profile.titles} />
        <Stat label="Épocas" value={profile.seasonsCount} />
        <Stat label="Melhor Posição" value={profile.bestPosition ?? "—"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <TitleBadgeWithTooltip icon={<Star className="size-3" />} label="SuperLeague" count={profile.superleagueTitles} items={titleItems.sl} />
        <TitleBadgeWithTooltip icon={<Trophy className="size-3" />} label="Nacionais" count={profile.nationalTitles} items={titleItems.nat} />
        <TitleBadgeWithTooltip icon={<Crown className="size-3" />} label="Continentais" count={profile.continentalTitles} items={titleItems.cont} />
      </div>

      <ClubReputationSection clubName={profile.name} />

      <DynamicMetricChart kind="club" name={profile.name} title="Evolução por época" />

      <RankingEvolutionSection kind="club" name={profile.name} />

      <DesafiosProfileCard results={data?.desafioResults} subject="clubs" entity={profile.name} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Estatísticas por época</h2>
        <ClubSeasonFilter years={availableYears} value={currentSeason} onChange={setSeason} />
      </div>
      <ClubNewStatsSection clubName={profile.name} season={currentSeason} />
      <ClubPlantelSection clubName={profile.name} season={currentSeason} />

      <ClubRecordsSection clubName={profile.name} />

      <ClubCoachesHistorySection clubName={profile.name} />

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de classificações</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3">Época</th>
                <th className="text-left p-3">Competição</th>
                <th className="text-left p-3">Divisão / Liga</th>
                <th className="text-right p-3">Pos.</th>
                <th className="text-right p-3">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {profile.seasons.map((s, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="p-3">{s.year}</td>
                  <td className="p-3">
                    <Link to="/competicoes/$name" params={{ name: MODULE_LABEL[s.module] }} className="hover:text-primary hover:underline">
                      {MODULE_LABEL[s.module]}
                    </Link>
                  </td>
                  <td className="p-3">
                    {(() => {
                      const label = s.module === "superleague" ? (s.division_num ? `Div. ${s.division_num}` : null) : s.division_label || null;
                      return label ? <Link to="/competicoes/$name" params={{ name: label }} className="hover:text-primary hover:underline">{label}</Link> : "—";
                    })()}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {s.position ?? "—"} {s.is_champion && <Crown className="size-3 inline text-gold" />}
                  </td>
                  <td className="p-3 text-right tabular-nums">{fmtPts(s.raw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {profile.continental.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Competições continentais</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                  <th className="text-left p-3">Época</th>
                  <th className="text-left p-3">Competição</th>
                  <th className="text-left p-3">Adversário</th>
                  <th className="text-right p-3">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {profile.continental.map((c, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="p-3">{c.year}</td>
                    <td className="p-3">
                      <Link to="/competicoes/$name" params={{ name: c.competition }} className="hover:text-primary hover:underline">
                        {c.competition}
                      </Link>
                    </td>
                    <td className="p-3">
                      {c.opponent ? <Link to="/clubes/$name" params={{ name: c.opponent }} className="hover:text-primary hover:underline">{c.opponent}</Link> : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {c.won ? <Badge className="bg-gold text-background">Vencedor</Badge> : <Badge variant="outline">Finalista</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {profile.knockouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Meias e Quartos de Final
              <Badge variant="outline" className="ml-2">
                {profile.knockouts.filter((k) => k.stage === "SF").length} SF ·{" "}
                {profile.knockouts.filter((k) => k.stage === "QF").length} QF
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                  <th className="text-left p-3">Época</th>
                  <th className="text-left p-3">Competição</th>
                  <th className="text-right p-3">Fase</th>
                </tr>
              </thead>
              <tbody>
                {profile.knockouts.map((k, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="p-3 tabular-nums">{k.year}</td>
                    <td className="p-3">
                      <Link to="/competicoes/$name" params={{ name: k.competition }} className="hover:text-primary hover:underline">
                        {k.competition}
                      </Link>
                    </td>
                    <td className="p-3 text-right">
                      <Badge variant="outline">{k.stage === "SF" ? "Meia-Final" : "Quartos"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      </div>
    </TooltipProvider>
  );
}
