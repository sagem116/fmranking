import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Bug, Search, AlertTriangle, Crown, Medal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRankings } from "@/lib/useRankings";

export const Route = createFileRoute("/debug-continentais")({
  head: () => ({
    meta: [
      { title: "Debug · Continentais — FM World Rankings" },
      { name: "description", content: "Validação dos títulos continentais e respetivos treinadores." },
    ],
  }),
  component: DebugContinentaisPage,
});

interface Row {
  year: number;
  competition: string;
  team1: string | null;
  team2: string | null;
  winner: string | null;
  loser: string | null;
  winnerCoach: string | null;
  loserCoach: string | null;
  rule: string;
  warnings: string[];
}

function DebugContinentaisPage() {
  const { data, isLoading } = useRankings();
  const [q, setQ] = useState("");

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    // Coach lookup: (year|club) → coach name (national/superleague modules)
    const coachByYearClub = new Map<string, string>();
    for (const c of data.data.coaches) {
      if (!c.club_name) continue;
      coachByYearClub.set(`${c.season_year}|${c.club_name}`, c.name);
    }
    return data.data.continental
      .map<Row>((c) => {
        const loser = c.winner === c.team1 ? c.team2 : c.winner === c.team2 ? c.team1 : null;
        const warnings: string[] = [];
        let rule = "Vencedor obtido do resultado (Equipa 1 × Equipa 2)";
        if (!c.winner) {
          warnings.push("Sem vencedor — resultado inválido, ausente, ou empate sem desempate");
          rule = "—";
        }
        if (!c.team1 || !c.team2) warnings.push("Falta uma das equipas (team1/team2)");
        const winnerCoach = c.winner ? coachByYearClub.get(`${c.season_year}|${c.winner}`) ?? null : null;
        const loserCoach = loser ? coachByYearClub.get(`${c.season_year}|${loser}`) ?? null : null;
        if (c.winner && !winnerCoach) warnings.push(`Sem treinador associado ao vencedor (${c.winner}) em ${c.season_year}`);
        if (loser && !loserCoach) warnings.push(`Sem treinador associado ao finalista (${loser}) em ${c.season_year}`);
        return {
          year: c.season_year,
          competition: c.competition,
          team1: c.team1,
          team2: c.team2,
          winner: c.winner,
          loser,
          winnerCoach,
          loserCoach,
          rule,
          warnings,
        };
      })
      .sort((a, b) => b.year - a.year || a.competition.localeCompare(b.competition));
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular trace…
      </div>
    );
  }

  const term = q.trim().toLowerCase();
  const filtered = term
    ? rows.filter((r) =>
        [r.competition, r.team1, r.team2, r.winner, r.winnerCoach, r.loserCoach, String(r.year)]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)),
      )
    : rows;

  const totalWarnings = rows.reduce((a, r) => a + r.warnings.length, 0);
  const orphanWinners = rows.filter((r) => r.winner && !r.winnerCoach).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bug className="size-6 text-primary" /> Debug · Títulos Continentais
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Para cada época e competição: clube vencedor e finalista, treinador associado e a regra usada para atribuir o título.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Finais analisadas" value={rows.length} />
        <Stat label="Vencedores sem treinador" value={orphanWinners} tone="warn" />
        <Stat label="Avisos totais" value={totalWarnings} tone="warn" />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por época, competição, clube ou treinador…" className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0 max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur z-10">
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="text-left p-3">Época</th>
                <th className="text-left p-3">Competição</th>
                <th className="text-left p-3">Vencedor</th>
                <th className="text-left p-3">Treinador (vencedor)</th>
                <th className="text-left p-3">Finalista</th>
                <th className="text-left p-3">Treinador (finalista)</th>
                <th className="text-left p-3">Regra / Avisos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className="border-b border-border/40 align-top">
                  <td className="p-3 tabular-nums">{r.year}</td>
                  <td className="p-3 font-medium">{r.competition}</td>
                  <td className="p-3">
                    {r.winner ? (
                      <span className="inline-flex items-center gap-1">
                        <Crown className="size-3 text-gold" />
                        <Link to="/clubes/$name" params={{ name: r.winner }} className="hover:text-primary hover:underline">
                          {r.winner}
                        </Link>
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-amber-500 border-amber-500/40">—</Badge>
                    )}
                  </td>
                  <td className="p-3">
                    {r.winnerCoach ? (
                      <Link to="/treinadores/$name" params={{ name: r.winnerCoach }} className="hover:text-primary hover:underline">
                        {r.winnerCoach}
                      </Link>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3">
                    {r.loser ? (
                      <span className="inline-flex items-center gap-1">
                        <Medal className="size-3 text-muted-foreground" />
                        <Link to="/clubes/$name" params={{ name: r.loser }} className="hover:text-primary hover:underline">
                          {r.loser}
                        </Link>
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3">
                    {r.loserCoach ? (
                      <Link to="/treinadores/$name" params={{ name: r.loserCoach }} className="hover:text-primary hover:underline">
                        {r.loserCoach}
                      </Link>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3 text-xs">
                    <p className="text-muted-foreground">{r.rule}</p>
                    {r.warnings.map((w, j) => (
                      <p key={j} className="text-amber-500 inline-flex items-center gap-1 mt-1">
                        <AlertTriangle className="size-3 shrink-0" /> {w}
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${tone === "warn" && value > 0 ? "text-amber-500" : ""}`}>
          {value.toLocaleString("pt-PT")}
        </p>
      </CardContent>
    </Card>
  );
}
