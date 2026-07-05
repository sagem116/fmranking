import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown } from "lucide-react";
import { useRankings } from "@/lib/useRankings";

interface Achievement {
  year: number;
  competition: string;
  club: string;
  kind: "national" | "continental";
}

export function PlayerAchievementsSection({ playerName }: { playerName: string }) {
  const { data } = useRankings();

  const achievements = useMemo<Achievement[]>(() => {
    if (!data) return [];
    // Collect (year, club) pairs the player was at, from legacy players table
    const key = new Set<string>();
    for (const p of data.data.players) {
      if (p.name !== playerName || !p.club_name) continue;
      key.add(`${p.season_year}|${p.club_name}`);
    }
    if (key.size === 0) return [];

    const out: Achievement[] = [];
    // National / SuperLeague titles: standings where champion=true and (year,club) matches
    for (const s of data.data.standings) {
      if (!s.is_champion) continue;
      if (!key.has(`${s.season_year}|${s.club_name}`)) continue;
      const label = s.competition
        ?? (s.module === "superleague" ? (s.division_num ? `Div. ${s.division_num}` : "Super League") : s.division_label ?? "Liga Nacional");
      out.push({ year: s.season_year, competition: label, club: s.club_name, kind: "national" });
    }
    // Continental winners
    for (const c of data.data.continental) {
      if (!c.winner) continue;
      if (!key.has(`${c.season_year}|${c.winner}`)) continue;
      out.push({ year: c.season_year, competition: c.competition, club: c.winner, kind: "continental" });
    }
    return out.sort((a, b) => b.year - a.year || a.competition.localeCompare(b.competition, "pt-PT"));
  }, [data, playerName]);

  if (!achievements.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="size-4 text-gold" /> Conquistas
          <Badge variant="outline" className="ml-2">{achievements.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3 w-20">Época</th>
              <th className="text-left p-3">Competição</th>
              <th className="text-left p-3">Clube</th>
            </tr>
          </thead>
          <tbody>
            {achievements.map((a, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                <td className="p-3 tabular-nums">{a.year}</td>
                <td className="p-3">
                  <Crown className="size-3 inline mr-1 text-gold" />
                  <Link to="/competicoes/$name" params={{ name: a.competition }} className="hover:text-primary hover:underline">
                    {a.competition}
                  </Link>
                </td>
                <td className="p-3 font-medium">
                  <Link to="/clubes/$name" params={{ name: a.club }} className="hover:text-primary hover:underline">
                    {a.club}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
