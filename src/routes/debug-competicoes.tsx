import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Bug, AlertTriangle, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRankings } from "@/lib/useRankings";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { continentOf } from "@/lib/fm-continents";
import { loadReputations, loadClubAliases, reputationFor } from "@/lib/fm-club-reputation";
import { loadCompetitionReputationsSync } from "@/lib/fm-competition-reputation";

export const Route = createFileRoute("/debug-competicoes")({
  head: () => ({ meta: [{ title: "Debug · Competições — FM World Rankings" }] }),
  component: DebugCompeticoes,
});

interface CompAgg {
  name: string;
  country: string | null;
  continent: string | null;
  clubs: Set<string>;
  players: number;
  years: Set<number>;
  comp_type: string | null;
  hasReputation: boolean;
}

function DebugCompeticoes() {
  const { data, isLoading } = useRankings();
  const { data: psData, isLoading: psLoading } = usePlayerStatsData();

  const rows = useMemo<CompAgg[]>(() => {
    if (!data || !psData) return [];
    const aliases = loadClubAliases();
    const reps = loadReputations();
    const compReps = loadCompetitionReputationsSync();
    const map = new Map<string, CompAgg>();

    // Player-stats source: continental, international, super-league, national
    for (const p of psData.players) {
      if (!p.competition) continue;
      let a = map.get(p.competition);
      if (!a) {
        a = { name: p.competition, country: p.country, continent: p.continent ?? continentOf(p.country ?? ""), clubs: new Set(), players: 0, years: new Set(), comp_type: p.comp_type, hasReputation: false };
        map.set(p.competition, a);
      }
      if (p.country && !a.country) a.country = p.country;
      if (!a.continent) a.continent = continentOf(a.country ?? "");
      if (p.club) a.clubs.add(p.club);
      a.players++;
      a.years.add(p.season_year);
    }
    // Standings source
    for (const s of data.data.standings) {
      if (!s.competition) continue;
      let a = map.get(s.competition);
      if (!a) {
        a = { name: s.competition, country: null, continent: null, clubs: new Set(), players: 0, years: new Set(), comp_type: s.module, hasReputation: false };
        map.set(s.competition, a);
      }
      if (s.club_name) a.clubs.add(s.club_name);
      a.years.add(s.season_year);
    }
    // Reputation: manual OR any club with reputation
    for (const a of map.values()) {
      const manual = Object.keys(compReps).some((k) => k.trim().toLowerCase() === a.name.trim().toLowerCase());
      if (manual) { a.hasReputation = true; continue; }
      for (const c of a.clubs) {
        if (typeof reputationFor(c, aliases, reps) === "number") { a.hasReputation = true; break; }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
  }, [data, psData]);

  if (isLoading || psLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> A carregar…</div>;
  }

  const noCountry = rows.filter((r) => !r.country);
  const noContinent = rows.filter((r) => !r.continent);
  const noReputation = rows.filter((r) => !r.hasReputation);
  const noClubs = rows.filter((r) => r.clubs.size === 0);
  const noPlayers = rows.filter((r) => r.players === 0);
  const singleYear = rows.filter((r) => r.years.size === 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bug className="size-6 text-primary" /> Debug · Competições
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Verificação de consistência de competições, clubes associados e reputação.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        <Stat label="Total" value={rows.length} />
        <Stat label="Sem país" value={noCountry.length} tone={noCountry.length ? "warn" : "ok"} />
        <Stat label="Sem continente" value={noContinent.length} tone={noContinent.length ? "warn" : "ok"} />
        <Stat label="Sem reputação" value={noReputation.length} tone={noReputation.length ? "warn" : "ok"} />
        <Stat label="Sem clubes" value={noClubs.length} tone={noClubs.length ? "warn" : "ok"} />
        <Stat label="Sem jogadores" value={noPlayers.length} tone={noPlayers.length ? "warn" : "ok"} />
      </div>

      <Section title="Competições sem país" rows={noCountry} extra={(r) => r.continent ?? "—"} extraLabel="Continente" />
      <Section title="Competições sem continente" rows={noContinent} extra={(r) => r.country ?? "—"} extraLabel="País" />
      <Section title="Competições sem reputação" rows={noReputation} extra={(r) => `${r.clubs.size} clubes`} extraLabel="Clubes" />
      <Section title="Competições sem clubes associados" rows={noClubs} extra={(r) => r.country ?? "—"} extraLabel="País" />
      <Section title="Competições sem jogadores importados" rows={noPlayers} extra={(r) => r.country ?? "—"} extraLabel="País" />
      <Section title="Competições com apenas uma época (histórico incompleto)" rows={singleYear} extra={(r) => [...r.years][0]?.toString() ?? "—"} extraLabel="Época" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4 text-primary" /> Todas as competições ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border sticky top-0 bg-background">
                <tr>
                  <th className="text-left py-2 pr-3">Competição</th>
                  <th className="text-left py-2 pr-3">Tipo</th>
                  <th className="text-left py-2 pr-3">País</th>
                  <th className="text-left py-2 pr-3">Continente</th>
                  <th className="text-right py-2 pr-3">Clubes</th>
                  <th className="text-right py-2 pr-3">Jogadores</th>
                  <th className="text-right py-2 pr-3">Épocas</th>
                  <th className="text-center py-2 pr-3">Reputação?</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="py-1.5 pr-3 font-medium">
                      <Link to="/competicoes/$name" params={{ name: r.name }} className="hover:text-primary">{r.name}</Link>
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{r.comp_type ?? "—"}</td>
                    <td className={`py-1.5 pr-3 ${r.country ? "" : "text-amber-500"}`}>{r.country ?? "—"}</td>
                    <td className={`py-1.5 pr-3 ${r.continent ? "" : "text-amber-500"}`}>{r.continent ?? "—"}</td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${r.clubs.size === 0 ? "text-amber-500" : ""}`}>{r.clubs.size}</td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${r.players === 0 ? "text-amber-500" : ""}`}>{r.players}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.years.size}</td>
                    <td className="py-1.5 pr-3 text-center">{r.hasReputation ? "✓" : <span className="text-amber-500">✗</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, rows, extra, extraLabel }: { title: string; rows: CompAgg[]; extra: (r: CompAgg) => string; extraLabel: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" /> {title} ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem problemas nesta secção.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rows.map((r) => (
              <Link key={r.name} to="/competicoes/$name" params={{ name: r.name }}>
                <Badge variant="outline" className="hover:bg-muted" title={`${extraLabel}: ${extra(r)}`}>
                  {r.name} <span className="text-muted-foreground ml-2 text-[10px]">{extra(r)}</span>
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "ok" | "warn" }) {
  const color = tone === "warn" ? "text-amber-500" : tone === "ok" ? "text-success" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <p className={`text-3xl font-bold tabular-nums ${color}`}>{value.toLocaleString("pt-PT")}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
