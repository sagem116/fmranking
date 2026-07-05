import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

interface Row {
  season_year: number;
  coach_name: string;
  nationality: string | null;
  club_role: string | null;
}

async function fetchClubCoachHistory(clubName: string): Promise<Row[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [{ data: assigns }, { data: seasons }, { data: coaches }] = await Promise.all([
    sb.from("coach_assignments").select("season_id, coach_name, club_role").eq("club_name", clubName),
    sb.from("seasons").select("id, year"),
    sb.from("coaches").select("name, nationality"),
  ]);
  const seasonMap = new Map<string, number>();
  for (const s of (seasons ?? []) as Array<{ id: string; year: number }>) seasonMap.set(s.id, s.year);
  const natMap = new Map<string, string | null>();
  for (const c of (coaches ?? []) as Array<{ name: string; nationality: string | null }>) natMap.set(c.name, c.nationality);
  return ((assigns ?? []) as Array<{ season_id: string; coach_name: string; club_role: string | null }>).map((a) => ({
    season_year: seasonMap.get(a.season_id) ?? 0,
    coach_name: a.coach_name,
    nationality: natMap.get(a.coach_name) ?? null,
    club_role: a.club_role,
  }));
}

export function ClubCoachesHistorySection({ clubName }: { clubName: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["club-coach-history", clubName],
    queryFn: () => fetchClubCoachHistory(clubName),
    staleTime: 60 * 60 * 1000,
    enabled: !!clubName,
  });

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.season_year - a.season_year || a.coach_name.localeCompare(b.coach_name, "pt-PT")),
    [rows],
  );

  if (isLoading || !sorted.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="size-4 text-primary" /> Histórico de treinadores
          <span className="text-xs font-normal text-muted-foreground ml-2">{sorted.length} passagens</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3 w-20">Época</th>
              <th className="text-left p-3">Treinador</th>
              <th className="text-left p-3">Nacionalidade</th>
              <th className="text-left p-3">Cargo</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                <td className="p-3 tabular-nums">{r.season_year || "—"}</td>
                <td className="p-3 font-medium">
                  <Link to="/treinadores/$name" params={{ name: r.coach_name }} className="hover:text-primary hover:underline">
                    {r.coach_name}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">
                  {r.nationality ? (
                    <Link to="/paises/$name" params={{ name: r.nationality }} className="hover:text-primary hover:underline">
                      {r.nationality}
                    </Link>
                  ) : "—"}
                </td>
                <td className="p-3 text-muted-foreground">{r.club_role || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
