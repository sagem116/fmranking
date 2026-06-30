import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, Trophy } from "lucide-react";
import { fmtNum, fmtMoney } from "@/lib/fmt";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import type { CompType } from "@/lib/fm-player-stats-db";

const COMP_LABEL: Record<CompType, string> = {
  superleague: "Super League",
  national: "Liga Nacional",
  continental: "Continental",
  international: "Internacional",
};

type StatKey = "gls" | "ast" | "games" | "hdj" | "ca" | "cp" | "ra" | "rm" | "rc" | "vp" | "salary";
type Agg = "sum" | "max";

const STATS: { key: StatKey; label: string; agg: Agg; fmt: (n: number) => string }[] = [
  { key: "gls", label: "Golos", agg: "sum", fmt: (n) => fmtNum(n, 2) },
  { key: "ast", label: "Assistências", agg: "sum", fmt: (n) => fmtNum(n, 2) },
  { key: "games", label: "Jogos", agg: "sum", fmt: (n) => fmtNum(n, 2) },
  { key: "hdj", label: "Homem do Jogo", agg: "sum", fmt: (n) => fmtNum(n, 2) },
  { key: "ca", label: "CA", agg: "max", fmt: (n) => fmtNum(n, 2) },
  { key: "cp", label: "CP", agg: "max", fmt: (n) => fmtNum(n, 2) },
  { key: "ra", label: "RA", agg: "max", fmt: (n) => fmtNum(n, 2) },
  { key: "rm", label: "RM", agg: "max", fmt: (n) => fmtNum(n, 2) },
  { key: "rc", label: "RC", agg: "max", fmt: (n) => fmtNum(n, 2) },
  { key: "vp", label: "Valor (VP)", agg: "max", fmt: fmtMoney },
  { key: "salary", label: "Salário", agg: "max", fmt: fmtMoney },
];

function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

type Row = ReturnType<typeof useMemo<any>> extends never ? never : any;
type PRow = {
  season_year: number;
  comp_type: CompType;
  competition: string;
  player_name: string;
  club: string | null;
  [k: string]: any;
};

function aggregateByPlayer(rows: PRow[], stat: StatKey, agg: Agg) {
  const map = new Map<string, { name: string; value: number; club: string | null; season: number; competition: string }>();
  for (const r of rows) {
    const v = Number(r[stat] ?? 0);
    if (!v) continue;
    const key = norm(r.player_name);
    const cur = map.get(key);
    if (agg === "sum") {
      if (cur) cur.value += v;
      else map.set(key, { name: r.player_name, value: v, club: r.club, season: r.season_year, competition: r.competition });
    } else {
      if (!cur || v > cur.value) {
        map.set(key, { name: r.player_name, value: v, club: r.club, season: r.season_year, competition: r.competition });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value)[0];
}

function bestSingleSeason(rows: PRow[], stat: StatKey) {
  let best: { name: string; value: number; club: string | null; season: number; competition: string } | null = null;
  for (const r of rows) {
    const v = Number(r[stat] ?? 0);
    if (!v) continue;
    if (!best || v > best.value) {
      best = { name: r.player_name, value: v, club: r.club, season: r.season_year, competition: r.competition };
    }
  }
  return best;
}

function RecordsTable({
  title,
  rows,
  showCompetition,
  showSeason,
  showClub,
}: {
  title: string;
  rows: { stat: StatKey; label: string; fmt: (n: number) => string; best: ReturnType<typeof aggregateByPlayer> | null }[];
  showCompetition?: boolean;
  showSeason?: boolean;
  showClub?: boolean;
}) {
  const filled = rows.filter((r) => r.best);
  if (!filled.length) return null;
  // Surface the top headline record (Goals → Assists → Games → first available)
  const headline =
    filled.find((r) => r.stat === "gls") ??
    filled.find((r) => r.stat === "ast") ??
    filled.find((r) => r.stat === "games") ??
    filled[0];
  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left group flex items-start gap-3 p-4 hover:bg-muted/40 transition-colors"
          >
            <Trophy className="size-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">{title}</CardTitle>
              {headline?.best && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Destaque · <span className="text-foreground font-medium">{headline.label}</span>{" "}
                  <span className="tabular-nums">{headline.fmt(headline.best.value)}</span>
                  {" — "}
                  <span>{headline.best.name}</span>
                  {headline.best.club ? <span> ({headline.best.club})</span> : null}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {filled.length} estatística(s) · clica para expandir
              </p>
            </div>
            <ChevronDown className="size-4 opacity-60 transition-transform group-data-[state=open]:rotate-180 mt-1" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0 overflow-x-auto border-t border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3">Estatística</th>
              <th className="text-left p-3">Jogador</th>
              {showClub && <th className="text-left p-3">Clube</th>}
              {showCompetition && <th className="text-left p-3">Competição</th>}
              {showSeason && <th className="text-left p-3">Época</th>}
              <th className="text-right p-3">Valor</th>
            </tr>
          </thead>
          <tbody>
            {filled.map((r) => (
              <tr key={r.stat} className="border-b border-border/50 hover:bg-muted/50">
                <td className="p-3 font-medium">{r.label}</td>
                <td className="p-3">
                  <Link to="/jogadores/$name" params={{ name: r.best!.name }} className="hover:text-primary hover:underline">
                    {r.best!.name}
                  </Link>
                </td>
                {showClub && (
                  <td className="p-3">
                    {r.best!.club ? (
                      <Link to="/clubes/$name" params={{ name: r.best!.club }} className="hover:text-primary hover:underline">
                        {r.best!.club}
                      </Link>
                    ) : "—"}
                  </td>
                )}
                {showCompetition && (
                  <td className="p-3">
                    <Link to="/competicoes/$name" params={{ name: r.best!.competition }} className="hover:text-primary hover:underline">
                      {r.best!.competition}
                    </Link>
                  </td>
                )}
                {showSeason && <td className="p-3 tabular-nums">{r.best!.season}</td>}
                <td className="p-3 text-right tabular-nums font-semibold">{r.fmt(r.best!.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function CompetitionRecordsSection({ competition }: { competition: string }) {
  const { data, isLoading } = usePlayerStatsData();
  const sections = useMemo(() => {
    if (!data) return null;
    const rows = data.players.filter((r) => norm(r.competition) === norm(competition)) as PRow[];
    if (!rows.length) return null;
    const allTime = STATS.map((s) => ({ stat: s.key, label: s.label, fmt: s.fmt, best: aggregateByPlayer(rows, s.key, s.agg) }));
    const bestSeason = STATS.map((s) => ({ stat: s.key, label: s.label, fmt: s.fmt, best: bestSingleSeason(rows, s.key) }));
    return { allTime, bestSeason };
  }, [data, competition]);

  if (isLoading || !sections) return null;
  return (
    <div className="space-y-6">
      <RecordsTable title="Recordes históricos (todas as épocas)" rows={sections.allTime} showClub showSeason />
      <RecordsTable title="Melhor época (registo único)" rows={sections.bestSeason} showClub showSeason />
    </div>
  );
}

export function ClubRecordsSection({ clubName }: { clubName: string }) {
  const { data, isLoading } = usePlayerStatsData();
  const sections = useMemo(() => {
    if (!data) return null;
    const rows = data.players.filter((r) => norm(r.club) === norm(clubName)) as PRow[];
    if (!rows.length) return null;
    const allTime = STATS.map((s) => ({ stat: s.key, label: s.label, fmt: s.fmt, best: aggregateByPlayer(rows, s.key, s.agg) }));
    const bestSeason = STATS.map((s) => ({ stat: s.key, label: s.label, fmt: s.fmt, best: bestSingleSeason(rows, s.key) }));
    const byCompetition = new Map<string, PRow[]>();
    for (const r of rows) {
      const key = r.competition;
      const arr = byCompetition.get(key) ?? [];
      arr.push(r);
      byCompetition.set(key, arr);
    }
    const perCompetition = [...byCompetition.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-PT"))
      .map(([competition, rs]) => ({
        competition,
        rows: STATS.map((s) => ({ stat: s.key, label: s.label, fmt: s.fmt, best: aggregateByPlayer(rs, s.key, s.agg) })),
      }));
    return { allTime, bestSeason, perCompetition };
  }, [data, clubName]);

  if (isLoading || !sections) return null;
  return (
    <div className="space-y-6">
      <RecordsTable title="Recordes do clube (todas as competições)" rows={sections.allTime} showSeason showCompetition />
      <RecordsTable title="Melhor época pelo clube (registo único)" rows={sections.bestSeason} showSeason showCompetition />
      {sections.perCompetition.map((c) => (
        <RecordsTable key={c.competition} title={`Recordes pelo clube — ${c.competition}`} rows={c.rows} showSeason />
      ))}
    </div>
  );
}

export function CountryRecordsSection({
  countryName,
  clubCountry,
}: {
  countryName: string;
  clubCountry: Record<string, string | null>;
}) {
  const { data, isLoading } = usePlayerStatsData();
  const sections = useMemo(() => {
    if (!data) return null;
    const targetCountry = norm(countryName);
    // Derive NAC codes (3-letter abbreviations) used by players in clubs from this country
    const nacCounts = new Map<string, number>();
    for (const r of data.players) {
      const cc = r.club ? clubCountry[r.club] : null;
      if (cc && norm(cc) === targetCountry && r.nationality) {
        const k = norm(r.nationality);
        nacCounts.set(k, (nacCounts.get(k) ?? 0) + 1);
      }
    }
    // Top NAC alias (most common nationality among clubs of this country)
    const aliasNacs = new Set<string>([targetCountry]);
    const sorted = [...nacCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length) aliasNacs.add(sorted[0][0]);

    // Filter ONLY by player nationality
    const rows = data.players.filter((r) => {
      if (!r.nationality) return false;
      return aliasNacs.has(norm(r.nationality));
    }) as PRow[];
    if (!rows.length) return null;
    const allTime = STATS.map((s) => ({ stat: s.key, label: s.label, fmt: s.fmt, best: aggregateByPlayer(rows, s.key, s.agg) }));
    const bestSeason = STATS.map((s) => ({ stat: s.key, label: s.label, fmt: s.fmt, best: bestSingleSeason(rows, s.key) }));
    // Per-competition: SOMENTE competições internacionais cujo nome contém o nome do país
    const byCompetition = new Map<string, PRow[]>();
    for (const r of rows) {
      if (r.comp_type !== "international") continue;
      if (!norm(r.competition).includes(targetCountry)) continue;
      const arr = byCompetition.get(r.competition) ?? [];
      arr.push(r);
      byCompetition.set(r.competition, arr);
    }
    const perCompetition = [...byCompetition.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-PT"))
      .map(([competition, rs]) => ({
        competition,
        rows: STATS.map((s) => ({ stat: s.key, label: s.label, fmt: s.fmt, best: aggregateByPlayer(rs, s.key, s.agg) })),
      }));
    return { allTime, bestSeason, perCompetition };
  }, [data, countryName, clubCountry]);

  if (isLoading || !sections) return null;
  return (
    <div className="space-y-6">
      <RecordsTable title="Recordes do país (todas as competições)" rows={sections.allTime} showClub showSeason showCompetition />
      <RecordsTable title="Melhor época pelo país (registo único)" rows={sections.bestSeason} showClub showSeason showCompetition />
      {sections.perCompetition.map((c) => (
        <RecordsTable key={c.competition} title={`Recordes do país — ${c.competition}`} rows={c.rows} showClub showSeason />
      ))}
    </div>
  );
}