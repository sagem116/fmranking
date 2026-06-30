import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Users, ArrowLeft, Crown, Trophy, Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRankings } from "@/lib/useRankings";
import { buildCoachProfile } from "@/lib/fm-profiles";
import { EvolutionChart, MODULE_LABEL } from "@/components/EvolutionChart";
import { DesafiosProfileCard } from "@/components/DesafiosProfileCard";
import { RankingEvolutionSection } from "@/components/RankingEvolutionSection";
import { fmtPts } from "@/lib/fmt";

export const Route = createFileRoute("/treinadores/$name")({
  component: CoachProfilePage,
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

function CoachProfilePage() {
  const { name } = Route.useParams();
  const { data, isLoading } = useRankings();
  const profile = useMemo(() => (data ? buildCoachProfile(data.data, name, data.config) : null), [data, name]);

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
        <Link to="/treinadores" className="text-sm text-primary inline-flex items-center gap-1"><ArrowLeft className="size-4" /> Treinadores</Link>
        <p className="text-muted-foreground">Treinador não encontrado: {name}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/treinadores" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Todos os treinadores
      </Link>
      <div className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
          <Users className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pontos brutos" value={fmtPts(profile.totalRaw)} />
        <Stat label="Títulos" value={profile.titles} />
        <Stat label="Épocas" value={profile.seasonsCount} />
        <Stat label="Clubes" value={profile.clubs.length} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Evolução histórica bruta</CardTitle></CardHeader>
        <CardContent><EvolutionChart data={profile.chart} showModeToggle={false} mode="raw" /></CardContent>
      </Card>

      <DesafiosProfileCard results={data?.desafioResults} subject="coaches" entity={profile.name} />

      <RankingEvolutionSection kind="coach" name={profile.name} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4 text-gold" /> Títulos Continentais
            <Badge variant="outline" className="ml-2">
              {profile.continentalTitles.filter((t) => t.role === "winner").length} vencidos ·{" "}
              {profile.continentalTitles.filter((t) => t.role === "runner-up").length} finais
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {profile.continentalTitles.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              Sem presenças em finais continentais cruzadas com este treinador.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                  <th className="text-left p-3">Época</th>
                  <th className="text-left p-3">Competição</th>
                  <th className="text-left p-3">Clube</th>
                  <th className="text-left p-3">Adversário</th>
                  <th className="text-right p-3">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {profile.continentalTitles.map((t, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="p-3 tabular-nums">{t.year}</td>
                    <td className="p-3">{t.competition}</td>
                    <td className="p-3">
                      <Link to="/clubes/$name" params={{ name: t.club }} className="hover:text-primary hover:underline">
                        {t.club}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {t.opponent ? (
                        <Link to="/clubes/$name" params={{ name: t.opponent }} className="hover:text-primary hover:underline">
                          {t.opponent}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {t.role === "winner" ? (
                        <Badge className="bg-gold/15 text-gold border-gold/40 gap-1">
                          <Crown className="size-3" /> Vencedor
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Medal className="size-3" /> Finalista
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {profile.knockouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Medal className="size-4 text-primary" /> Meias e Quartos de Final
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
                  <th className="text-left p-3">Clube / Seleção</th>
                  <th className="text-right p-3">Fase</th>
                </tr>
              </thead>
              <tbody>
                {profile.knockouts.map((k, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="p-3 tabular-nums">{k.year}</td>
                    <td className="p-3">{k.competition}</td>
                    <td className="p-3">
                      <Link to="/clubes/$name" params={{ name: k.club }} className="hover:text-primary hover:underline">
                        {k.club}
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

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de épocas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3">Época</th>
                <th className="text-left p-3">Competição</th>
                <th className="text-left p-3">Clube</th>
                <th className="text-right p-3">Pos.</th>
                <th className="text-right p-3">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {profile.seasons.map((s, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="p-3">{s.year}</td>
                  <td className="p-3">{MODULE_LABEL[s.module]}</td>
                  <td className="p-3">
                    {s.club_name ? (
                      <Link to="/clubes/$name" params={{ name: s.club_name }} className="hover:text-primary hover:underline">
                        {s.club_name}
                      </Link>
                    ) : "—"}
                    {s.champion && <Crown className="size-3 inline ml-1 text-gold" />}
                  </td>
                  <td className="p-3 text-right tabular-nums">{s.position ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">{fmtPts(s.raw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
