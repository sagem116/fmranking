import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Trophy, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CoachProfile } from "@/lib/fm-profiles";

interface TitleRow {
  year: number;
  competition: string;
  club: string;
  kind: "national" | "continental" | "international";
}

export function CoachTitlesSection({
  profile,
  competitionByKey,
}: {
  profile: CoachProfile;
  competitionByKey: Map<string, string>;
}) {
  const titles = useMemo<TitleRow[]>(() => {
    const rows: TitleRow[] = [];

    // League / cup titles from `seasons` (champion=true for club assignments)
    for (const s of profile.seasons) {
      if (!s.champion || !s.club_name) continue;
      const key = `${s.year}|${s.module}|${s.club_name}`;
      // Continental "champion" rows in seasons come from international-team wins;
      // treat them below via continentalTitles to avoid duplicates.
      if (s.module === "continental") continue;
      const label = competitionByKey.get(key) ?? (s.module === "superleague" ? "Super League" : "Liga Nacional");
      rows.push({ year: s.year, competition: label, club: s.club_name, kind: "national" });
    }

    // Continental + international titles from continentalTitles
    for (const t of profile.continentalTitles) {
      if (t.role !== "winner") continue;
      // Distinguish international by presence of matching international competition entries
      // Fallback: any winner in continentalTitles that lacks club-year match is international.
      rows.push({
        year: t.year,
        competition: t.competition,
        club: t.club,
        kind: "international",
      });
    }

    return rows.sort((a, b) => b.year - a.year || a.competition.localeCompare(b.competition, "pt-PT"));
  }, [profile, competitionByKey]);

  if (!titles.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="size-4 text-gold" /> Títulos conquistados
          <Badge variant="outline" className="ml-2">{titles.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3 w-20">Época</th>
              <th className="text-left p-3">Competição</th>
              <th className="text-left p-3">Clube / Seleção</th>
            </tr>
          </thead>
          <tbody>
            {titles.map((t, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                <td className="p-3 tabular-nums">{t.year}</td>
                <td className="p-3">
                  <Crown className="size-3 inline mr-1 text-gold" />
                  <Link to="/competicoes/$name" params={{ name: t.competition }} className="hover:text-primary hover:underline">
                    {t.competition}
                  </Link>
                </td>
                <td className="p-3 font-medium">
                  <Link to="/clubes/$name" params={{ name: t.club }} className="hover:text-primary hover:underline">
                    {t.club}
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
