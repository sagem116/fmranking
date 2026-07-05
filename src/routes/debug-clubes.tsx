import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Bug, AlertTriangle, Trophy, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { rankBy } from "@/lib/fm-rankings";
import { continentOf } from "@/lib/fm-continents";
import { loadReputations, loadClubAliases, reputationFor } from "@/lib/fm-club-reputation";

export const Route = createFileRoute("/debug-clubes")({
  head: () => ({ meta: [{ title: "Debug · Clubes — FM World Rankings" }] }),
  component: DebugClubes,
});

// Normalization to detect similar names (Levenshtein-ish via cheap token set).
function normName(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(fc|cf|sc|ac|afc|cd|sd|as|ss|us|ud|ss|club|fk|bk|de|do|of|the)\b/g, "").replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
}

function DebugClubes() {
  const { data, isLoading } = useRankings();
  const { data: psData } = usePlayerStatsData();

  const derived = useMemo(() => {
    if (!data) return null;
    const { clubCountry, rawClubCountry, players, standings, coaches } = data.data;
    const aliases = loadClubAliases();
    const reps = loadReputations();

    const allClubs = Object.keys(clubCountry);

    // Latest year of player-stats
    const latestYear = (psData?.players?.length ? Math.max(...psData.players.map((p) => p.season_year)) : (players.length ? Math.max(...players.map((p) => p.season_year)) : 0));
    const playersPerClubLatest = new Map<string, number>();
    for (const p of psData?.players ?? []) {
      if (p.season_year !== latestYear || !p.club) continue;
      playersPerClubLatest.set(p.club, (playersPerClubLatest.get(p.club) ?? 0) + 1);
    }
    for (const p of players) {
      if (p.season_year !== latestYear || !p.club_name) continue;
      playersPerClubLatest.set(p.club_name, (playersPerClubLatest.get(p.club_name) ?? 0) + 1);
    }
    // Clubs with historical data (any player_stats or standings, any year)
    const clubsWithAnyPlayers = new Set<string>();
    for (const p of psData?.players ?? []) if (p.club) clubsWithAnyPlayers.add(p.club);
    for (const p of players) if (p.club_name) clubsWithAnyPlayers.add(p.club_name);
    const clubsInStandings = new Set(standings.map((s) => s.club_name).filter(Boolean) as string[]);

    // Clubs in competitions (latest year mapping via psData)
    const clubCompLatest = new Map<string, string>();
    for (const p of psData?.players ?? []) {
      if (p.club && p.competition) clubCompLatest.set(p.club, p.competition);
    }
    for (const s of standings) {
      if (s.club_name && s.competition && !clubCompLatest.has(s.club_name)) clubCompLatest.set(s.club_name, s.competition);
    }

    // Sections
    const clubsWithoutPlayers = allClubs.filter((c) => (playersPerClubLatest.get(c) ?? 0) === 0).sort();
    const clubsWithoutCountry = allClubs.filter((c) => !clubCountry[c]).sort();
    const clubsWithoutContinent = allClubs.filter((c) => !continentOf(clubCountry[c] ?? "")).sort();
    const clubsWithoutReputation = allClubs.filter((c) => reputationFor(c, aliases, reps) == null).sort();
    const clubsWithoutCompetition = allClubs.filter((c) => !clubCompLatest.has(c)).sort();
    const clubsWithoutHistory = allClubs.filter((c) => !clubsWithAnyPlayers.has(c) && !clubsInStandings.has(c)).sort();

    // Duplicates: same normalized name across the clubs table
    const byNorm = new Map<string, string[]>();
    for (const c of allClubs) {
      const k = normName(c);
      if (!k) continue;
      let arr = byNorm.get(k); if (!arr) { arr = []; byNorm.set(k, arr); }
      arr.push(c);
    }
    const duplicates: string[][] = [];
    const similar: string[][] = [];
    for (const [, arr] of byNorm) {
      if (arr.length > 1) duplicates.push(arr.sort());
    }
    // Similar-but-not-equal: pairs where one normalized string contains another
    const normArr = [...byNorm.keys()];
    for (let i = 0; i < normArr.length; i++) {
      for (let j = i + 1; j < normArr.length; j++) {
        const a = normArr[i]; const b = normArr[j];
        if (a.length < 4 || b.length < 4) continue;
        if (a === b) continue;
        if ((a.length > b.length ? a.includes(b) : b.includes(a))) {
          similar.push([...(byNorm.get(a) ?? []), ...(byNorm.get(b) ?? [])]);
        }
      }
    }

    // No country per (year, club) — retained from previous version
    const noCountryRows: { year: number; club: string }[] = [];
    {
      const seen = new Set<string>();
      for (const s of standings) {
        if (!s.club_name || !s.season_year) continue;
        if (rawClubCountry[s.club_name]) continue;
        const k = `${s.season_year}|${s.club_name}`;
        if (seen.has(k)) continue;
        seen.add(k);
        noCountryRows.push({ year: s.season_year, club: s.club_name });
      }
      noCountryRows.sort((a, b) => b.year - a.year || a.club.localeCompare(b.club));
    }

    // Multi-coach same season (retained)
    const seasonClubCoaches = new Map<string, Set<string>>();
    for (const c of coaches ?? []) {
      if (!c.club_name || !c.name) continue;
      const k = `${c.season_year}|${c.club_name}`;
      let s = seasonClubCoaches.get(k);
      if (!s) { s = new Set(); seasonClubCoaches.set(k, s); }
      s.add(c.name);
    }
    const multiCoachRows: { year: number; club: string; coaches: string[] }[] = [];
    for (const [k, set] of seasonClubCoaches) {
      if (set.size <= 1) continue;
      const [y, club] = k.split("|");
      multiCoachRows.push({ year: Number(y), club, coaches: [...set].sort() });
    }
    multiCoachRows.sort((a, b) => b.year - a.year || a.club.localeCompare(b.club));

    const playersPerClubRows = [...playersPerClubLatest.entries()].sort((a, b) => b[1] - a[1]);
    const ghostClubs = [...clubsInStandings].filter((c) => !(c in clubCountry)).sort();

    return {
      allClubs, latestYear,
      clubsWithoutPlayers, clubsWithoutCountry, clubsWithoutContinent, clubsWithoutReputation,
      clubsWithoutCompetition, clubsWithoutHistory,
      duplicates, similar,
      noCountryRows, multiCoachRows, ghostClubs, playersPerClubRows,
    };
  }, [data, psData]);

  if (isLoading || !data || !derived) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> A carregar…</div>;
  }

  const { clubCountry } = data.data;
  const ranked = rankBy(data.ranks.clubs, "weighted");
  const rankedRaw = rankBy(data.ranks.clubs, "raw");
  const rankedTitles = [...data.ranks.clubs].sort((a, b) => b.titles - a.titles);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bug className="size-6 text-primary" /> Debug · Clubes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Diagnóstico completo dos clubes: dados em falta, duplicados e histórico.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/debug-reputacao-clubes"><ExternalLink className="size-3.5" /> Reputação de Clubes</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/debug-mapeamento-clubes"><ExternalLink className="size-3.5" /> Mapeamento de Clubes</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
        <Stat label="Total" value={derived.allClubs.length} />
        <Stat label="Sem jogadores" value={derived.clubsWithoutPlayers.length} tone={derived.clubsWithoutPlayers.length ? "warn" : "ok"} />
        <Stat label="Sem país" value={derived.clubsWithoutCountry.length} tone={derived.clubsWithoutCountry.length ? "warn" : "ok"} />
        <Stat label="Sem continente" value={derived.clubsWithoutContinent.length} tone={derived.clubsWithoutContinent.length ? "warn" : "ok"} />
        <Stat label="Sem reputação" value={derived.clubsWithoutReputation.length} tone={derived.clubsWithoutReputation.length ? "warn" : "ok"} />
        <Stat label="Sem competição" value={derived.clubsWithoutCompetition.length} tone={derived.clubsWithoutCompetition.length ? "warn" : "ok"} />
        <Stat label="Duplicados" value={derived.duplicates.length} tone={derived.duplicates.length ? "warn" : "ok"} />
        <Stat label="Sem histórico" value={derived.clubsWithoutHistory.length} tone={derived.clubsWithoutHistory.length ? "warn" : "ok"} />
      </div>

      <ClubListCard title="Clubes sem jogadores (última época)" clubs={derived.clubsWithoutPlayers} />
      <ClubListCard title="Clubes sem país associado" clubs={derived.clubsWithoutCountry} />
      <ClubListCard title="Clubes sem continente" clubs={derived.clubsWithoutContinent} />
      <ClubListCard title="Clubes sem reputação" clubs={derived.clubsWithoutReputation} />
      <ClubListCard title="Clubes sem competição associada" clubs={derived.clubsWithoutCompetition} />
      <ClubListCard title="Clubes sem histórico (nem em standings nem em player_stats)" clubs={derived.clubsWithoutHistory} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" /> Clubes duplicados (nome normalizado igual) ({derived.duplicates.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {derived.duplicates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem duplicados.</p>
          ) : (
            <div className="space-y-2">
              {derived.duplicates.map((group, i) => (
                <div key={i} className="flex flex-wrap gap-2 rounded-lg border border-border/60 p-2">
                  {group.map((c) => (
                    <Link key={c} to="/clubes/$name" params={{ name: c }}>
                      <Badge variant="outline" className="hover:bg-muted">{c}</Badge>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" /> Clubes com nomes semelhantes ({derived.similar.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {derived.similar.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem semelhanças evidentes.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {derived.similar.slice(0, 100).map((group, i) => (
                <div key={i} className="flex flex-wrap gap-2 rounded-lg border border-border/60 p-2">
                  {[...new Set(group)].map((c) => (
                    <Link key={c} to="/clubes/$name" params={{ name: c }}>
                      <Badge variant="outline" className="hover:bg-muted">{c}</Badge>
                    </Link>
                  ))}
                </div>
              ))}
              {derived.similar.length > 100 && <p className="text-xs text-muted-foreground">… e mais {derived.similar.length - 100}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" /> (Época, Clube) sem país nos standings ({derived.noCountryRows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {derived.noCountryRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os (época, clube) têm país associado nos standings.</p>
          ) : (
            <div className="overflow-x-auto max-h-[360px]">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border sticky top-0 bg-background">
                  <tr>
                    <th className="text-left py-2 pr-3 w-20">Época</th>
                    <th className="text-left py-2 pr-3">Clube</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.noCountryRows.slice(0, 400).map((r) => (
                    <tr key={`${r.year}-${r.club}`} className="border-b border-border/40 hover:bg-muted/40">
                      <td className="py-1.5 pr-3 tabular-nums">{r.year}</td>
                      <td className="py-1.5 pr-3 font-medium">
                        <Link to="/clubes/$name" params={{ name: r.club }} className="hover:text-primary">{r.club}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" /> Mais que um treinador na mesma época ({derived.multiCoachRows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {derived.multiCoachRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum clube tem mais que um treinador na mesma época.</p>
          ) : (
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border sticky top-0 bg-background">
                  <tr>
                    <th className="text-left py-2 pr-3 w-20">Época</th>
                    <th className="text-left py-2 pr-3">Clube</th>
                    <th className="text-left py-2 pr-3">Treinadores</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.multiCoachRows.map((r) => (
                    <tr key={`${r.year}-${r.club}`} className="border-b border-border/40 hover:bg-muted/40">
                      <td className="py-1.5 pr-3 tabular-nums">{r.year}</td>
                      <td className="py-1.5 pr-3 font-medium">
                        <Link to="/clubes/$name" params={{ name: r.club }} className="hover:text-primary">{r.club}</Link>
                      </td>
                      <td className="py-1.5 pr-3">
                        <div className="flex flex-wrap gap-1.5">
                          {r.coaches.map((c) => (
                            <Link key={c} to="/treinadores/$name" params={{ name: c }}>
                              <Badge variant="outline" className="hover:bg-muted">{c}</Badge>
                            </Link>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {derived.ghostClubs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clubes em standings mas ausentes na tabela clubs ({derived.ghostClubs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {derived.ghostClubs.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jogadores por clube (última época: {derived.latestYear || "—"})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border sticky top-0 bg-background">
                <tr>
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Clube</th>
                  <th className="text-left py-2 pr-3">País</th>
                  <th className="text-right py-2 pr-3">Jogadores</th>
                </tr>
              </thead>
              <tbody>
                {derived.playersPerClubRows.map(([c, n], i) => (
                  <tr key={c} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="py-1.5 pr-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-1.5 pr-3 font-medium">
                      <Link to="/clubes/$name" params={{ name: c }} className="hover:text-primary">{c}</Link>
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{clubCountry[c] ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <RankCard title="Por pontuação ponderada" rows={ranked.slice(0, 100).map((e) => ({ name: e.name, value: Math.round(e.weighted) }))} />
        <RankCard title="Por pontuação bruta" rows={rankedRaw.slice(0, 100).map((e) => ({ name: e.name, value: Math.round(e.raw) }))} />
        <RankCard title="Por títulos" rows={rankedTitles.slice(0, 100).map((e) => ({ name: e.name, value: e.titles }))} />
      </div>
    </div>
  );
}

function ClubListCard({ title, clubs }: { title: string; clubs: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" /> {title} ({clubs.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {clubs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem problemas nesta secção.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-[220px] overflow-y-auto">
            {clubs.slice(0, 400).map((c) => (
              <Link key={c} to="/clubes/$name" params={{ name: c }}>
                <Badge variant="outline" className="hover:bg-muted text-xs">{c}</Badge>
              </Link>
            ))}
            {clubs.length > 400 && <span className="text-xs text-muted-foreground">… e mais {clubs.length - 400}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "ok" | "warn" }) {
  const color = tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <p className={`text-3xl font-bold tabular-nums ${color}`}>{value.toLocaleString("pt-PT")}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function RankCard({ title, rows }: { title: string; rows: { name: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name + i} className="border-b border-border/30">
                  <td className="py-1 pr-2 text-muted-foreground w-8">{i + 1}</td>
                  <td className="py-1 pr-2 truncate">
                    <Link to="/clubes/$name" params={{ name: r.name }} className="hover:text-primary">{r.name}</Link>
                  </td>
                  <td className="py-1 text-right tabular-nums font-semibold">{r.value.toLocaleString("pt-PT")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
