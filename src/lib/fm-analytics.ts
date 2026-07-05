// Central computation layer for the "Análise Estatística" page.
// Produces top-N rankings across many indicators from existing data sources.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRankings } from "./useRankings";
import { usePlayerStatsData } from "./usePlayerStatsData";
import type { PlayerStatRow, CompetitionStatRow } from "./fm-player-stats-db";
import type { StandingRow, CoachRow, ContinentalRow } from "./fm-rankings";

// ---------------- Types ----------------

export type Fmt = "num" | "num1" | "num2" | "money" | "pct" | "int";

export interface RankRow {
  name: string;
  value: number;
  subtitle?: string | null;
  linkKind?: "club" | "player" | "coach" | "country" | "competition" | null;
}

export interface Ranking {
  id: string;
  title: string;
  subtitle?: string;
  fmt: Fmt;
  linkKind?: RankRow["linkKind"];
  rows: RankRow[];
  higherIsBetter?: boolean; // default true — for display sort semantics only
}

// ---------------- Data hook ----------------

interface ClubReputationRow {
  club_name: string;
  season_year: number;
  reputation: number | null;
  avg_attendance: number | null;
  season_ticket_holders: number | null;
}

interface CompetitionReputationRow {
  competition: string;
  season_year: number | null;
  reputation: number;
  country: string | null;
  continent: string | null;
}

export interface AnalyticsData {
  seasons: number[];                              // sorted asc
  standings: StandingRow[];
  coaches: CoachRow[];
  continental: ContinentalRow[];
  players: PlayerStatRow[];
  compStats: CompetitionStatRow[];
  clubRep: ClubReputationRow[];
  compRep: CompetitionReputationRow[];
  clubCountry: Record<string, string | null>;
  rankClubs: { name: string; weighted: number; titles: number }[];
  rankCoaches: { name: string; weighted: number; titles: number }[];
  rankCountries: { name: string; weighted: number; titles: number }[];
}

async function fetchAllRows<T>(table: string, columns = "*"): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from(table).select(columns).range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < page) break;
    from += rows.length;
  }
  return out;
}

export function useAnalyticsData() {
  const ranks = useRankings();
  const ps = usePlayerStatsData();
  const extras = useQuery({
    queryKey: ["analytics-extras"],
    queryFn: async () => {
      const [clubRep, compRep] = await Promise.all([
        fetchAllRows<ClubReputationRow>("club_reputation_season", "club_name,season_year,reputation,avg_attendance,season_ticket_holders"),
        fetchAllRows<CompetitionReputationRow>("competition_reputation", "competition,season_year,reputation,country,continent"),
      ]);
      return { clubRep, compRep };
    },
    staleTime: 60 * 60 * 1000,
  });

  const isLoading = ranks.isLoading || ps.isLoading || extras.isLoading;
  const data: AnalyticsData | null =
    ranks.data && ps.data && extras.data
      ? {
          seasons: [...new Set(ranks.data.data.seasons.map((s) => s.year))].sort((a, b) => a - b),
          standings: ranks.data.data.standings,
          coaches: ranks.data.data.coaches,
          continental: ranks.data.data.continental,
          players: ps.data.players,
          compStats: ps.data.competitions,
          clubRep: extras.data.clubRep,
          compRep: extras.data.compRep,
          clubCountry: ranks.data.data.clubCountry,
          rankClubs: ranks.data.ranks.clubs.map((e) => ({ name: e.name, weighted: e.weighted, titles: e.titles })),
          rankCoaches: ranks.data.ranks.coaches.map((e) => ({ name: e.name, weighted: e.weighted, titles: e.titles })),
          rankCountries: ranks.data.ranks.countries.map((e) => ({ name: e.name, weighted: e.weighted, titles: e.titles })),
        }
      : null;

  return { data, isLoading };
}

// ---------------- Helpers ----------------

const N = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function topN<T>(items: T[], value: (t: T) => number, n = 10, direction: "desc" | "asc" = "desc") {
  const filtered = items.filter((it) => Number.isFinite(value(it)));
  filtered.sort((a, b) => (direction === "desc" ? value(b) - value(a) : value(a) - value(b)));
  return filtered.slice(0, n);
}

function toRows<T>(
  items: T[],
  extract: (t: T) => { name: string; value: number; subtitle?: string | null },
): RankRow[] {
  return items.map((it) => {
    const r = extract(it);
    return { name: r.name, value: r.value, subtitle: r.subtitle ?? null };
  });
}

// Filter standings by season set + module
function stdIn(data: AnalyticsData, seasons: Set<number>, modules: StandingRow["module"][] = ["superleague", "national"]) {
  return data.standings.filter((s) => modules.includes(s.module) && seasons.has(s.season_year));
}

function playersIn(data: AnalyticsData, seasons: Set<number>) {
  return data.players.filter((p) => seasons.has(p.season_year));
}

function compStatsIn(data: AnalyticsData, seasons: Set<number>) {
  return data.compStats.filter((c) => seasons.has(c.season_year));
}

// Aggregate: group a list by key, apply sum/avg
function groupAgg<T>(items: T[], keyFn: (t: T) => string | null | undefined) {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    const arr = map.get(k) ?? [];
    arr.push(it);
    map.set(k, arr);
  }
  return map;
}

// ---------------- Club rankings ----------------

export function clubRankings(data: AnalyticsData, seasonSet: Set<number>): { group: string; rankings: Ranking[] }[] {
  const std = stdIn(data, seasonSet);
  const stdByClub = groupAgg(std, (s) => s.club_name);
  const players = playersIn(data, seasonSet);
  const playersByClub = groupAgg(players, (p) => p.club);
  const clubRep = data.clubRep.filter((r) => seasonSet.has(r.season_year));
  const repByClub = groupAgg(clubRep, (r) => r.club_name);

  // Reduce each club to aggregated numbers
  const clubAgg = new Map<string, {
    played: number; wins: number; draws: number; losses: number; gf: number; ga: number; points: number;
    seasons: number;
  }>();
  for (const [club, rows] of stdByClub) {
    const acc = { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0, seasons: rows.length };
    for (const r of rows) {
      acc.played += N(r.played);
      acc.wins += N(r.wins);
      acc.draws += N(r.draws);
      acc.losses += N(r.losses);
      acc.gf += N(r.gf);
      acc.ga += N(r.ga);
      acc.points += N(r.points);
    }
    clubAgg.set(club, acc);
  }

  const clubs = [...clubAgg.entries()].map(([club, a]) => ({ club, ...a }));
  const cl = (club: string) => `${club}`;

  // Player aggregates per club
  const clubPlayers = new Map<string, {
    n: number; gls: number; ast: number; xg: number; passSum: number; passN: number;
    tackles: number; foulsN: number; ratingSum: number; ratingN: number;
    yellows: number; reds: number; nats: Set<string>; ageSum: number; ageN: number; caAvg: number; caN: number;
    vpSum: number; salarySum: number;
  }>();
  for (const [club, rows] of playersByClub) {
    if (!club) continue;
    const a = { n: rows.length, gls: 0, ast: 0, xg: 0, passSum: 0, passN: 0, tackles: 0, foulsN: 0,
      ratingSum: 0, ratingN: 0, yellows: 0, reds: 0, nats: new Set<string>(), ageSum: 0, ageN: 0,
      caAvg: 0, caN: 0, vpSum: 0, salarySum: 0 };
    for (const p of rows) {
      a.gls += N(p.gls); a.ast += N(p.ast); a.xg += N(p.xg);
      if (p.pass_pct != null) { a.passSum += N(p.pass_pct); a.passN++; }
      a.tackles += N(p.tackles_per90);
      if (p.avg_rating != null) { a.ratingSum += N(p.avg_rating); a.ratingN++; }
      a.yellows += N(p.yellows); a.reds += N(p.reds);
      if (p.nationality) a.nats.add(p.nationality);
      if (p.age != null) { a.ageSum += N(p.age); a.ageN++; }
      if (p.ca != null) { a.caAvg += N(p.ca); a.caN++; }
      a.vpSum += N(p.vp); a.salarySum += N(p.salary);
    }
    clubPlayers.set(club, a);
  }

  // Reputation per club (avg across seasons in selection)
  const clubRepAgg = new Map<string, { rep: number; att: number; sth: number; n: number }>();
  for (const [club, rows] of repByClub) {
    const a = { rep: 0, att: 0, sth: 0, n: 0 };
    for (const r of rows) {
      if (r.reputation != null) { a.rep += N(r.reputation); a.n++; }
      if (r.avg_attendance != null) a.att += N(r.avg_attendance);
      if (r.season_ticket_holders != null) a.sth += N(r.season_ticket_holders);
    }
    clubRepAgg.set(club, a);
  }

  const perGame = (num: number, den: number) => (den > 0 ? num / den : 0);

  // ---------- Ataque ----------
  const ataque: Ranking[] = [
    {
      id: "clubs-gf",
      title: "Clubes mais ofensivos (Golos)",
      fmt: "int",
      linkKind: "club",
      rows: toRows(topN(clubs, (c) => c.gf), (c) => ({ name: cl(c.club), value: c.gf, subtitle: `${c.played} jogos` })),
    },
    {
      id: "clubs-gf-per-game",
      title: "Golos por jogo",
      fmt: "num2",
      linkKind: "club",
      rows: toRows(
        topN(clubs.filter((c) => c.played > 0), (c) => c.gf / c.played),
        (c) => ({ name: cl(c.club), value: c.gf / c.played, subtitle: `${c.gf}g / ${c.played}j` }),
      ),
    },
    {
      id: "clubs-xg",
      title: "Maior xG total",
      fmt: "num2",
      linkKind: "club",
      rows: toRows(
        topN([...clubPlayers.entries()].map(([club, a]) => ({ club, xg: a.xg })), (c) => c.xg),
        (c) => ({ name: cl(c.club), value: c.xg }),
      ),
    },
    {
      id: "clubs-goals-per-xg",
      title: "Melhor eficácia ofensiva (Golos/xG)",
      fmt: "num2",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubPlayers.entries()]
            .map(([club, a]) => ({ club, ratio: a.xg > 0 ? a.gls / a.xg : 0, gls: a.gls, xg: a.xg }))
            .filter((r) => r.xg > 0.5),
          (r) => r.ratio,
        ),
        (r) => ({ name: cl(r.club), value: r.ratio, subtitle: `${r.gls.toFixed(0)}g / ${r.xg.toFixed(1)}xG` }),
      ),
    },
    {
      id: "clubs-shot-pct",
      title: "Maior % de remates convertidos",
      fmt: "pct",
      linkKind: "club",
      rows: toRows(
        topN(players.reduce((map, p) => {
          if (!p.club) return map; if (p.shot_pct == null) return map;
          const cur = map.get(p.club) ?? { club: p.club, sum: 0, n: 0 };
          cur.sum += N(p.shot_pct); cur.n++;
          map.set(p.club, cur); return map;
        }, new Map<string, { club: string; sum: number; n: number }>()).values() as unknown as { club: string; sum: number; n: number }[],
        (r) => r.n > 0 ? r.sum / r.n : 0),
        (r) => ({ name: r.club, value: r.n > 0 ? r.sum / r.n : 0 }),
      ),
    },
    {
      id: "clubs-ast",
      title: "Mais assistências (total)",
      fmt: "int",
      linkKind: "club",
      rows: toRows(
        topN([...clubPlayers.entries()].map(([club, a]) => ({ club, ast: a.ast })), (c) => c.ast),
        (c) => ({ name: cl(c.club), value: c.ast }),
      ),
    },
    {
      id: "clubs-ast-per-game",
      title: "Assistências médias (por jogo do clube)",
      fmt: "num2",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubPlayers.entries()]
            .map(([club, a]) => {
              const played = clubAgg.get(club)?.played ?? 0;
              return { club, avg: played > 0 ? a.ast / played : 0 };
            })
            .filter((r) => r.avg > 0),
          (r) => r.avg,
        ),
        (r) => ({ name: cl(r.club), value: r.avg }),
      ),
    },
  ];

  // ---------- Defesa ----------
  const defesa: Ranking[] = [
    {
      id: "clubs-ga",
      title: "Clubes menos batidos (Golos sofridos)",
      fmt: "int",
      linkKind: "club",
      higherIsBetter: false,
      rows: toRows(topN(clubs.filter((c) => c.played > 0), (c) => c.ga, 10, "asc"), (c) => ({ name: cl(c.club), value: c.ga, subtitle: `${c.played} jogos` })),
    },
    {
      id: "clubs-ga-per-game",
      title: "Golos sofridos por jogo",
      fmt: "num2",
      linkKind: "club",
      higherIsBetter: false,
      rows: toRows(
        topN(clubs.filter((c) => c.played > 0), (c) => c.ga / c.played, 10, "asc"),
        (c) => ({ name: cl(c.club), value: c.ga / c.played }),
      ),
    },
    {
      id: "clubs-def-eff",
      title: "Maior eficácia defensiva (Pontos por golo sofrido)",
      fmt: "num2",
      linkKind: "club",
      rows: toRows(
        topN(clubs.filter((c) => c.ga > 0), (c) => c.points / c.ga),
        (c) => ({ name: cl(c.club), value: c.points / c.ga, subtitle: `${c.points}pt / ${c.ga}gs` }),
      ),
    },
    {
      id: "clubs-losses",
      title: "Menos derrotas",
      fmt: "int",
      linkKind: "club",
      higherIsBetter: false,
      rows: toRows(topN(clubs.filter((c) => c.played > 0), (c) => c.losses, 10, "asc"), (c) => ({ name: cl(c.club), value: c.losses, subtitle: `${c.played} jogos` })),
    },
    {
      id: "clubs-gd",
      title: "Melhor diferença de golos",
      fmt: "int",
      linkKind: "club",
      rows: toRows(topN(clubs, (c) => c.gf - c.ga), (c) => ({ name: cl(c.club), value: c.gf - c.ga })),
    },
  ];

  // ---------- Eficiência ----------
  const eficiencia: Ranking[] = [
    {
      id: "clubs-points-per-goal",
      title: "Mais pontos por golo marcado",
      fmt: "num2",
      linkKind: "club",
      rows: toRows(topN(clubs.filter((c) => c.gf > 0), (c) => c.points / c.gf), (c) => ({ name: cl(c.club), value: c.points / c.gf })),
    },
    {
      id: "clubs-goals-per-win",
      title: "Menos golos necessários por vitória",
      fmt: "num2",
      linkKind: "club",
      higherIsBetter: false,
      rows: toRows(topN(clubs.filter((c) => c.wins > 0), (c) => c.gf / c.wins, 10, "asc"), (c) => ({ name: cl(c.club), value: c.gf / c.wins })),
    },
    {
      id: "clubs-points-max",
      title: "Melhor aproveitamento (Pontos / (3×Jogos))",
      fmt: "pct",
      linkKind: "club",
      rows: toRows(
        topN(clubs.filter((c) => c.played > 0), (c) => c.points / (3 * c.played)),
        (c) => ({ name: cl(c.club), value: c.points / (3 * c.played) * 100 }),
      ),
    },
    {
      id: "clubs-ppg",
      title: "Mais pontos por jogo",
      fmt: "num2",
      linkKind: "club",
      rows: toRows(
        topN(clubs.filter((c) => c.played > 0), (c) => c.points / c.played),
        (c) => ({ name: cl(c.club), value: c.points / c.played }),
      ),
    },
    {
      id: "clubs-wins-per-game",
      title: "Melhor relação Vitórias / Jogos",
      fmt: "pct",
      linkKind: "club",
      rows: toRows(
        topN(clubs.filter((c) => c.played > 0), (c) => c.wins / c.played),
        (c) => ({ name: cl(c.club), value: (c.wins / c.played) * 100 }),
      ),
    },
    {
      id: "clubs-goals-per-point",
      title: "Melhor relação Golos / Pontos",
      fmt: "num2",
      linkKind: "club",
      rows: toRows(
        topN(clubs.filter((c) => c.points > 0), (c) => c.gf / c.points),
        (c) => ({ name: cl(c.club), value: c.gf / c.points }),
      ),
    },
  ];

  // ---------- Economia ----------
  const economia: Ranking[] = [
    {
      id: "clubs-vp",
      title: "Clubes mais valiosos (VP total do plantel)",
      fmt: "money",
      linkKind: "club",
      rows: toRows(
        topN([...clubPlayers.entries()].map(([club, a]) => ({ club, vp: a.vpSum })), (r) => r.vp),
        (r) => ({ name: cl(r.club), value: r.vp }),
      ),
    },
    {
      id: "clubs-salary-avg",
      title: "Maior salário médio",
      fmt: "money",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubPlayers.entries()]
            .map(([club, a]) => ({ club, avg: a.n > 0 ? a.salarySum / a.n : 0 }))
            .filter((r) => r.avg > 0),
          (r) => r.avg,
        ),
        (r) => ({ name: cl(r.club), value: r.avg }),
      ),
    },
    {
      id: "clubs-attendance",
      title: "Maior assistência média",
      fmt: "int",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubRepAgg.entries()]
            .map(([club, a]) => ({ club, att: a.n > 0 ? a.att / a.n : 0 }))
            .filter((r) => r.att > 0),
          (r) => r.att,
        ),
        (r) => ({ name: cl(r.club), value: r.att }),
      ),
    },
    {
      id: "clubs-sth",
      title: "Mais detentores de bilhete de época",
      fmt: "int",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubRepAgg.entries()]
            .map(([club, a]) => ({ club, sth: a.n > 0 ? a.sth / a.n : 0 }))
            .filter((r) => r.sth > 0),
          (r) => r.sth,
        ),
        (r) => ({ name: cl(r.club), value: r.sth }),
      ),
    },
    {
      id: "clubs-value-eff",
      title: "Maior rentabilidade (Pontos por milhão de VP)",
      fmt: "num2",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubPlayers.entries()]
            .map(([club, a]) => {
              const pts = clubAgg.get(club)?.points ?? 0;
              const vpM = a.vpSum / 1_000_000;
              return { club, eff: vpM > 0 ? pts / vpM : 0 };
            })
            .filter((r) => r.eff > 0 && Number.isFinite(r.eff)),
          (r) => r.eff,
        ),
        (r) => ({ name: cl(r.club), value: r.eff }),
      ),
    },
    {
      id: "clubs-salary-eff",
      title: "Melhor eficiência salarial (Pontos por milhão em salários)",
      fmt: "num2",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubPlayers.entries()]
            .map(([club, a]) => {
              const pts = clubAgg.get(club)?.points ?? 0;
              const sM = a.salarySum / 1_000_000;
              return { club, eff: sM > 0 ? pts / sM : 0 };
            })
            .filter((r) => r.eff > 0 && Number.isFinite(r.eff)),
          (r) => r.eff,
        ),
        (r) => ({ name: cl(r.club), value: r.eff }),
      ),
    },
    {
      id: "clubs-vp-avg-player",
      title: "Maior valor médio por jogador",
      fmt: "money",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubPlayers.entries()]
            .map(([club, a]) => ({ club, avg: a.n > 0 ? a.vpSum / a.n : 0 }))
            .filter((r) => r.avg > 0),
          (r) => r.avg,
        ),
        (r) => ({ name: cl(r.club), value: r.avg }),
      ),
    },
  ];

  // ---------- Plantel ----------
  const plantel: Ranking[] = [
    {
      id: "clubs-youngest",
      title: "Plantéis mais jovens (idade média)",
      fmt: "num1",
      linkKind: "club",
      higherIsBetter: false,
      rows: toRows(
        topN(
          [...clubPlayers.entries()]
            .map(([club, a]) => ({ club, age: a.ageN > 0 ? a.ageSum / a.ageN : 0, n: a.n }))
            .filter((r) => r.age > 0 && r.n >= 5),
          (r) => r.age,
          10,
          "asc",
        ),
        (r) => ({ name: cl(r.club), value: r.age, subtitle: `${r.n} jogadores` }),
      ),
    },
    {
      id: "clubs-oldest",
      title: "Plantéis mais experientes",
      fmt: "num1",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubPlayers.entries()]
            .map(([club, a]) => ({ club, age: a.ageN > 0 ? a.ageSum / a.ageN : 0, n: a.n }))
            .filter((r) => r.age > 0 && r.n >= 5),
          (r) => r.age,
        ),
        (r) => ({ name: cl(r.club), value: r.age, subtitle: `${r.n} jogadores` }),
      ),
    },
    {
      id: "clubs-nationalities",
      title: "Maior diversidade de nacionalidades",
      fmt: "int",
      linkKind: "club",
      rows: toRows(
        topN([...clubPlayers.entries()].map(([club, a]) => ({ club, n: a.nats.size })), (r) => r.n),
        (r) => ({ name: cl(r.club), value: r.n }),
      ),
    },
    {
      id: "clubs-ca-avg",
      title: "Maior classificação média (CA)",
      fmt: "num1",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubPlayers.entries()]
            .map(([club, a]) => ({ club, ca: a.caN > 0 ? a.caAvg / a.caN : 0 }))
            .filter((r) => r.ca > 0),
          (r) => r.ca,
        ),
        (r) => ({ name: cl(r.club), value: r.ca }),
      ),
    },
    {
      id: "clubs-pass-pct",
      title: "Melhor qualidade de passe (%)",
      fmt: "num1",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubPlayers.entries()]
            .map(([club, a]) => ({ club, pass: a.passN > 0 ? a.passSum / a.passN : 0 }))
            .filter((r) => r.pass > 0),
          (r) => r.pass,
        ),
        (r) => ({ name: cl(r.club), value: r.pass }),
      ),
    },
    {
      id: "clubs-tackles",
      title: "Maior intensidade defensiva (Desarmes/90 total)",
      fmt: "num1",
      linkKind: "club",
      rows: toRows(
        topN([...clubPlayers.entries()].map(([club, a]) => ({ club, t: a.tackles })), (r) => r.t),
        (r) => ({ name: cl(r.club), value: r.t }),
      ),
    },
    {
      id: "clubs-discipline",
      title: "Clubes mais disciplinados (menos cartões)",
      fmt: "int",
      linkKind: "club",
      higherIsBetter: false,
      rows: toRows(
        topN(
          [...clubPlayers.entries()].map(([club, a]) => ({ club, cards: a.yellows + 3 * a.reds })),
          (r) => r.cards,
          10,
          "asc",
        ),
        (r) => ({ name: cl(r.club), value: r.cards }),
      ),
    },
    {
      id: "clubs-indiscipline",
      title: "Clubes mais indisciplinados (mais cartões)",
      fmt: "int",
      linkKind: "club",
      rows: toRows(
        topN(
          [...clubPlayers.entries()].map(([club, a]) => ({ club, cards: a.yellows + 3 * a.reds })),
          (r) => r.cards,
        ),
        (r) => ({ name: cl(r.club), value: r.cards }),
      ),
    },
  ];

  return [
    { group: "Ataque", rankings: ataque },
    { group: "Defesa", rankings: defesa },
    { group: "Eficiência", rankings: eficiencia },
    { group: "Economia", rankings: economia },
    { group: "Plantel", rankings: plantel },
  ];
}

// ---------------- Competition rankings ----------------

export function competitionRankings(data: AnalyticsData, seasonSet: Set<number>) {
  const cs = compStatsIn(data, seasonSet);
  const compRep = data.compRep.filter((r) => !r.season_year || seasonSet.has(r.season_year));

  // Averages per competition across selected seasons
  interface CAgg { comp: string; nSeasons: number; xg: number; pass: number; tackles: number; rating: number;
    yellows: number; reds: number; ca: number; vp: number; salary: number; nPlayers: number; }
  const map = new Map<string, CAgg>();
  for (const c of cs) {
    const cur = map.get(c.competition) ?? { comp: c.competition, nSeasons: 0, xg: 0, pass: 0, tackles: 0,
      rating: 0, yellows: 0, reds: 0, ca: 0, vp: 0, salary: 0, nPlayers: 0 };
    cur.nSeasons++;
    cur.xg += N(c.xg_avg);
    cur.pass += N(c.pass_pct_avg);
    cur.tackles += N(c.tackles_per90_avg);
    cur.rating += N(c.avg_rating_avg);
    cur.yellows += N(c.yellows_avg);
    cur.reds += N(c.reds_avg);
    cur.ca += N(c.ca_avg);
    cur.vp += N(c.vp_avg);
    cur.salary += N(c.salary_avg);
    cur.nPlayers += N(c.n_players);
    map.set(c.competition, cur);
  }
  const comps = [...map.values()].map((c) => ({
    ...c,
    xgAvg: c.nSeasons > 0 ? c.xg / c.nSeasons : 0,
    passAvg: c.nSeasons > 0 ? c.pass / c.nSeasons : 0,
    tacklesAvg: c.nSeasons > 0 ? c.tackles / c.nSeasons : 0,
    ratingAvg: c.nSeasons > 0 ? c.rating / c.nSeasons : 0,
    yellowsAvg: c.nSeasons > 0 ? c.yellows / c.nSeasons : 0,
    redsAvg: c.nSeasons > 0 ? c.reds / c.nSeasons : 0,
    caAvg: c.nSeasons > 0 ? c.ca / c.nSeasons : 0,
    vpAvg: c.nSeasons > 0 ? c.vp / c.nSeasons : 0,
    salaryAvg: c.nSeasons > 0 ? c.salary / c.nSeasons : 0,
  }));

  // Reputation per competition
  const repMap = new Map<string, { sum: number; n: number }>();
  for (const r of compRep) {
    const cur = repMap.get(r.competition) ?? { sum: 0, n: 0 };
    cur.sum += N(r.reputation); cur.n++;
    repMap.set(r.competition, cur);
  }

  // Competitiveness — standings per (season, competition/division_label)
  const std = stdIn(data, seasonSet);
  const compStandings = new Map<string, StandingRow[]>();
  for (const s of std) {
    const compName = s.competition ?? s.division_label ?? null;
    if (!compName) continue;
    const arr = compStandings.get(compName) ?? [];
    arr.push(s);
    compStandings.set(compName, arr);
  }
  // Points gap between 1st and last per season (average across seasons in selection)
  const gapMap = new Map<string, { gaps: number[] }>();
  const champions = new Map<string, Set<string>>();
  for (const [comp, rows] of compStandings) {
    const bySeason = groupAgg(rows, (r) => String(r.season_year));
    const gapEntry = { gaps: [] as number[] };
    const champs = new Set<string>();
    for (const [, sr] of bySeason) {
      const pts = sr.map((r) => N(r.points));
      if (pts.length >= 2) gapEntry.gaps.push(Math.max(...pts) - Math.min(...pts));
      for (const r of sr) if (r.is_champion) champs.add(r.club_name);
    }
    gapMap.set(comp, gapEntry);
    champions.set(comp, champs);
  }

  // Also aggregate club_reputation and player VP within the competition (via player_stats)
  const playersByComp = groupAgg(playersIn(data, seasonSet), (p) => p.competition);
  const compValue = new Map<string, { clubsVpSum: number; clubsSet: Set<string>; playerVpAvg: number; playerN: number }>();
  for (const [comp, ps] of playersByComp) {
    const clubs = new Set<string>();
    let vpSum = 0;
    let playerVpSum = 0;
    let playerN = 0;
    for (const p of ps) {
      if (p.club) clubs.add(p.club);
      vpSum += N(p.vp);
      playerVpSum += N(p.vp);
      playerN++;
    }
    compValue.set(comp, { clubsVpSum: vpSum, clubsSet: clubs, playerVpAvg: playerN > 0 ? playerVpSum / playerN : 0, playerN });
  }

  const qualidade: Ranking[] = [
    {
      id: "comp-rep",
      title: "Competições com maior reputação",
      fmt: "num2",
      linkKind: "competition",
      rows: toRows(
        topN(
          [...repMap.entries()]
            .map(([comp, a]) => ({ comp, rep: a.n > 0 ? a.sum / a.n : 0 }))
            .filter((r) => r.rep > 0),
          (r) => r.rep,
        ),
        (r) => ({ name: r.comp, value: r.rep }),
      ),
    },
    {
      id: "comp-clubs-vp",
      title: "Competições com clubes mais valiosos (VP total)",
      fmt: "money",
      linkKind: "competition",
      rows: toRows(
        topN([...compValue.entries()].map(([comp, a]) => ({ comp, v: a.clubsVpSum })), (r) => r.v),
        (r) => ({ name: r.comp, value: r.v }),
      ),
    },
    {
      id: "comp-vp-avg",
      title: "Maior valor médio dos jogadores",
      fmt: "money",
      linkKind: "competition",
      rows: toRows(
        topN(comps.filter((c) => c.vpAvg > 0), (c) => c.vpAvg),
        (c) => ({ name: c.comp, value: c.vpAvg }),
      ),
    },
    {
      id: "comp-rating",
      title: "Competições com maior classificação média (CA)",
      fmt: "num1",
      linkKind: "competition",
      rows: toRows(
        topN(comps.filter((c) => c.caAvg > 0), (c) => c.caAvg),
        (c) => ({ name: c.comp, value: c.caAvg }),
      ),
    },
  ];

  const competitividade: Ranking[] = [
    {
      id: "comp-balanced",
      title: "Campeonatos mais equilibrados (menor gap 1º–último)",
      fmt: "num1",
      linkKind: "competition",
      higherIsBetter: false,
      rows: toRows(
        topN(
          [...gapMap.entries()]
            .map(([comp, a]) => ({ comp, gap: a.gaps.length > 0 ? a.gaps.reduce((s, x) => s + x, 0) / a.gaps.length : 0 }))
            .filter((r) => r.gap > 0),
          (r) => r.gap,
          10,
          "asc",
        ),
        (r) => ({ name: r.comp, value: r.gap }),
      ),
    },
    {
      id: "comp-unequal",
      title: "Campeonatos com maior diferença entre 1º e último",
      fmt: "num1",
      linkKind: "competition",
      rows: toRows(
        topN(
          [...gapMap.entries()]
            .map(([comp, a]) => ({ comp, gap: a.gaps.length > 0 ? a.gaps.reduce((s, x) => s + x, 0) / a.gaps.length : 0 }))
            .filter((r) => r.gap > 0),
          (r) => r.gap,
        ),
        (r) => ({ name: r.comp, value: r.gap }),
      ),
    },
    {
      id: "comp-champ-changes",
      title: "Mais mudanças de campeão",
      fmt: "int",
      linkKind: "competition",
      rows: toRows(
        topN([...champions.entries()].map(([comp, s]) => ({ comp, n: s.size })), (r) => r.n),
        (r) => ({ name: r.comp, value: r.n }),
      ),
    },
  ];

  const estilo: Ranking[] = [
    {
      id: "comp-xg",
      title: "Competições com maior xG médio",
      fmt: "num2",
      linkKind: "competition",
      rows: toRows(topN(comps.filter((c) => c.xgAvg > 0), (c) => c.xgAvg), (c) => ({ name: c.comp, value: c.xgAvg })),
    },
    {
      id: "comp-pass",
      title: "Melhor qualidade de passe (%)",
      fmt: "num1",
      linkKind: "competition",
      rows: toRows(topN(comps.filter((c) => c.passAvg > 0), (c) => c.passAvg), (c) => ({ name: c.comp, value: c.passAvg })),
    },
    {
      id: "comp-tackles",
      title: "Maior intensidade física (Desarmes/90)",
      fmt: "num2",
      linkKind: "competition",
      rows: toRows(topN(comps.filter((c) => c.tacklesAvg > 0), (c) => c.tacklesAvg), (c) => ({ name: c.comp, value: c.tacklesAvg })),
    },
    {
      id: "comp-rating2",
      title: "Maior rating médio",
      fmt: "num2",
      linkKind: "competition",
      rows: toRows(topN(comps.filter((c) => c.ratingAvg > 0), (c) => c.ratingAvg), (c) => ({ name: c.comp, value: c.ratingAvg })),
    },
    {
      id: "comp-cards",
      title: "Mais cartões (amarelos+3×vermelhos, média)",
      fmt: "num2",
      linkKind: "competition",
      rows: toRows(topN(comps.map((c) => ({ ...c, cards: c.yellowsAvg + 3 * c.redsAvg })).filter((c) => c.cards > 0), (c) => c.cards), (c) => ({ name: c.comp, value: c.cards })),
    },
    {
      id: "comp-goals-per-game",
      title: "Maior média de golos por jogo",
      fmt: "num2",
      linkKind: "competition",
      rows: toRows(
        topN(
          [...compStandings.entries()]
            .map(([comp, rows]) => {
              const gf = rows.reduce((s, r) => s + N(r.gf), 0);
              const played = rows.reduce((s, r) => s + N(r.played), 0);
              return { comp, avg: played > 0 ? gf / played : 0 };
            })
            .filter((r) => r.avg > 0),
          (r) => r.avg,
        ),
        (r) => ({ name: r.comp, value: r.avg }),
      ),
    },
  ];

  const economiaC: Ranking[] = [
    {
      id: "comp-salary-avg",
      title: "Competições com maior salário médio",
      fmt: "money",
      linkKind: "competition",
      rows: toRows(topN(comps.filter((c) => c.salaryAvg > 0), (c) => c.salaryAvg), (c) => ({ name: c.comp, value: c.salaryAvg })),
    },
    {
      id: "comp-vp-total",
      title: "Competições mais ricas (VP total dos jogadores)",
      fmt: "money",
      linkKind: "competition",
      rows: toRows(topN([...compValue.entries()].map(([comp, a]) => ({ comp, v: a.clubsVpSum })), (r) => r.v),
        (r) => ({ name: r.comp, value: r.v })),
    },
  ];

  return [
    { group: "Qualidade", rankings: qualidade },
    { group: "Competitividade", rankings: competitividade },
    { group: "Estilo de jogo", rankings: estilo },
    { group: "Economia", rankings: economiaC },
  ];
}

// ---------------- Player rankings ----------------

export function playerRankings(data: AnalyticsData, seasonSet: Set<number>) {
  const players = playersIn(data, seasonSet);
  // Aggregate per player_name (sum/avg across rows in scope)
  interface PAgg { name: string; club: string | null; gls: number; ast: number; xg: number; hdj: number;
    ratingSum: number; ratingN: number; games: number; passSum: number; passN: number;
    tackles: number; shot: number; shotN: number; vpMax: number; salaryMax: number; comps: Set<string>; seasons: Set<number>; }
  const map = new Map<string, PAgg>();
  for (const p of players) {
    const cur = map.get(p.player_name) ?? { name: p.player_name, club: p.club, gls: 0, ast: 0, xg: 0, hdj: 0,
      ratingSum: 0, ratingN: 0, games: 0, passSum: 0, passN: 0, tackles: 0, shot: 0, shotN: 0, vpMax: 0, salaryMax: 0,
      comps: new Set(), seasons: new Set() };
    cur.gls += N(p.gls); cur.ast += N(p.ast); cur.xg += N(p.xg); cur.hdj += N(p.hdj);
    if (p.avg_rating != null) { cur.ratingSum += N(p.avg_rating); cur.ratingN++; }
    cur.games += N(p.games);
    if (p.pass_pct != null) { cur.passSum += N(p.pass_pct); cur.passN++; }
    cur.tackles += N(p.tackles_per90);
    if (p.shot_pct != null) { cur.shot += N(p.shot_pct); cur.shotN++; }
    cur.vpMax = Math.max(cur.vpMax, N(p.vp));
    cur.salaryMax = Math.max(cur.salaryMax, N(p.salary));
    cur.comps.add(p.competition); cur.seasons.add(p.season_year);
    cur.club = cur.club ?? p.club;
    map.set(p.player_name, cur);
  }
  const arr = [...map.values()];

  const ofensivos: Ranking[] = [
    { id: "p-gls", title: "Mais golos", fmt: "int", linkKind: "player",
      rows: toRows(topN(arr, (p) => p.gls), (p) => ({ name: p.name, value: p.gls, subtitle: p.club ?? undefined })) },
    { id: "p-ast", title: "Mais assistências", fmt: "int", linkKind: "player",
      rows: toRows(topN(arr, (p) => p.ast), (p) => ({ name: p.name, value: p.ast, subtitle: p.club ?? undefined })) },
    { id: "p-gxg", title: "Melhor relação Golos/xG", fmt: "num2", linkKind: "player",
      rows: toRows(topN(arr.filter((p) => p.xg > 0.5), (p) => p.gls / p.xg), (p) => ({ name: p.name, value: p.gls / p.xg, subtitle: `${p.gls}g / ${p.xg.toFixed(1)}xG` })) },
    { id: "p-goal-contrib", title: "Maior contribuição ofensiva (G+A)", fmt: "int", linkKind: "player",
      rows: toRows(topN(arr, (p) => p.gls + p.ast), (p) => ({ name: p.name, value: p.gls + p.ast })) },
    { id: "p-hdj", title: "Mais Homem do Jogo", fmt: "int", linkKind: "player",
      rows: toRows(topN(arr, (p) => p.hdj), (p) => ({ name: p.name, value: p.hdj })) },
    { id: "p-rating", title: "Melhor rating médio", fmt: "num2", linkKind: "player",
      rows: toRows(topN(arr.filter((p) => p.ratingN > 0), (p) => p.ratingSum / p.ratingN),
        (p) => ({ name: p.name, value: p.ratingSum / p.ratingN })) },
  ];

  const tecnicos: Ranking[] = [
    { id: "p-pass", title: "Melhor % de passe", fmt: "num1", linkKind: "player",
      rows: toRows(topN(arr.filter((p) => p.passN > 0 && p.games >= 5), (p) => p.passSum / p.passN),
        (p) => ({ name: p.name, value: p.passSum / p.passN })) },
    { id: "p-shots", title: "Melhor % de remates convertidos", fmt: "pct", linkKind: "player",
      rows: toRows(topN(arr.filter((p) => p.shotN > 0 && p.gls > 2), (p) => p.shot / p.shotN),
        (p) => ({ name: p.name, value: p.shot / p.shotN })) },
    { id: "p-tackles", title: "Melhor desempenho defensivo (Des/90)", fmt: "num2", linkKind: "player",
      rows: toRows(topN(arr.filter((p) => p.games >= 5), (p) => p.tackles / Math.max(1, p.seasons.size)),
        (p) => ({ name: p.name, value: p.tackles / Math.max(1, p.seasons.size) })) },
  ];

  const mercado: Ranking[] = [
    { id: "p-vp", title: "Jogadores mais valiosos", fmt: "money", linkKind: "player",
      rows: toRows(topN(arr, (p) => p.vpMax), (p) => ({ name: p.name, value: p.vpMax, subtitle: p.club ?? undefined })) },
    { id: "p-vp-per-perf", title: "Melhor relação Desempenho / VP (pontos ofensivos por M€)", fmt: "num2", linkKind: "player",
      rows: toRows(
        topN(arr.filter((p) => p.vpMax > 0).map((p) => ({ ...p, eff: (p.gls + 0.5 * p.ast) / (p.vpMax / 1_000_000) })),
          (p) => p.eff),
        (p) => ({ name: p.name, value: p.eff })) },
    { id: "p-sal-per-perf", title: "Melhor relação Desempenho / Salário", fmt: "num2", linkKind: "player",
      rows: toRows(
        topN(arr.filter((p) => p.salaryMax > 0).map((p) => ({ ...p, eff: (p.gls + 0.5 * p.ast) / (p.salaryMax / 1_000_000) })),
          (p) => p.eff),
        (p) => ({ name: p.name, value: p.eff })) },
  ];

  const carreira: Ranking[] = [
    { id: "p-longevity", title: "Maior longevidade (épocas)", fmt: "int", linkKind: "player",
      rows: toRows(topN(arr, (p) => p.seasons.size), (p) => ({ name: p.name, value: p.seasons.size })) },
    { id: "p-comps", title: "Mais competições disputadas", fmt: "int", linkKind: "player",
      rows: toRows(topN(arr, (p) => p.comps.size), (p) => ({ name: p.name, value: p.comps.size })) },
    { id: "p-consistent", title: "Mais consistentes (rating × épocas)", fmt: "num2", linkKind: "player",
      rows: toRows(
        topN(arr.filter((p) => p.ratingN > 0 && p.seasons.size >= 1), (p) => (p.ratingSum / p.ratingN) * p.seasons.size),
        (p) => ({ name: p.name, value: (p.ratingSum / p.ratingN) * p.seasons.size })) },
  ];

  return [
    { group: "Ofensivos", rankings: ofensivos },
    { group: "Técnicos", rankings: tecnicos },
    { group: "Mercado", rankings: mercado },
    { group: "Carreira", rankings: carreira },
  ];
}

// ---------------- Coach rankings ----------------

export function coachRankings(data: AnalyticsData, seasonSet: Set<number>) {
  const std = stdIn(data, seasonSet);
  // Index standings by (season, module, club)
  const stdIdx = new Map<string, StandingRow>();
  for (const s of std) stdIdx.set(`${s.season_year}|${s.module}|${s.club_name}`, s);

  const coaches = data.coaches.filter((c) => seasonSet.has(c.season_year));
  interface CAgg { name: string; nationality: string | null; clubs: Set<string>; countries: Set<string>;
    played: number; wins: number; draws: number; losses: number; gf: number; ga: number; points: number;
    titles: number; seasons: Set<number>; }
  const map = new Map<string, CAgg>();
  for (const c of coaches) {
    const cur = map.get(c.name) ?? { name: c.name, nationality: c.nationality, clubs: new Set(), countries: new Set(),
      played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0, titles: 0, seasons: new Set() };
    if (c.club_name) {
      cur.clubs.add(c.club_name);
      const key = `${c.season_year}|${c.module}|${c.club_name}`;
      const s = stdIdx.get(key);
      if (s) {
        cur.played += N(s.played); cur.wins += N(s.wins); cur.draws += N(s.draws); cur.losses += N(s.losses);
        cur.gf += N(s.gf); cur.ga += N(s.ga); cur.points += N(s.points);
        if (s.is_champion) cur.titles++;
      }
    }
    if (c.country_name) cur.countries.add(c.country_name);
    cur.seasons.add(c.season_year);
    map.set(c.name, cur);
  }
  const arr = [...map.values()];

  const rankings: Ranking[] = [
    { id: "co-titles", title: "Mais títulos", fmt: "int", linkKind: "coach",
      rows: toRows(topN(arr, (c) => c.titles), (c) => ({ name: c.name, value: c.titles })) },
    { id: "co-win-pct", title: "Maior % de vitórias", fmt: "pct", linkKind: "coach",
      rows: toRows(topN(arr.filter((c) => c.played >= 10), (c) => (c.wins / c.played) * 100),
        (c) => ({ name: c.name, value: (c.wins / c.played) * 100, subtitle: `${c.wins}v em ${c.played}j` })) },
    { id: "co-ppg", title: "Mais pontos por jogo", fmt: "num2", linkKind: "coach",
      rows: toRows(topN(arr.filter((c) => c.played >= 10), (c) => c.points / c.played),
        (c) => ({ name: c.name, value: c.points / c.played })) },
    { id: "co-gf-pg", title: "Mais golos marcados por jogo", fmt: "num2", linkKind: "coach",
      rows: toRows(topN(arr.filter((c) => c.played >= 10), (c) => c.gf / c.played),
        (c) => ({ name: c.name, value: c.gf / c.played })) },
    { id: "co-ga-pg", title: "Menos golos sofridos por jogo", fmt: "num2", linkKind: "coach", higherIsBetter: false,
      rows: toRows(topN(arr.filter((c) => c.played >= 10), (c) => c.ga / c.played, 10, "asc"),
        (c) => ({ name: c.name, value: c.ga / c.played })) },
    { id: "co-approv", title: "Melhor aproveitamento (Pontos / 3×Jogos)", fmt: "pct", linkKind: "coach",
      rows: toRows(topN(arr.filter((c) => c.played >= 10), (c) => c.points / (3 * c.played)),
        (c) => ({ name: c.name, value: (c.points / (3 * c.played)) * 100 })) },
    { id: "co-longev", title: "Maior longevidade (épocas)", fmt: "int", linkKind: "coach",
      rows: toRows(topN(arr, (c) => c.seasons.size), (c) => ({ name: c.name, value: c.seasons.size })) },
    { id: "co-clubs", title: "Mais clubes treinados", fmt: "int", linkKind: "coach",
      rows: toRows(topN(arr, (c) => c.clubs.size), (c) => ({ name: c.name, value: c.clubs.size })) },
    { id: "co-nats", title: "Mais seleções treinadas", fmt: "int", linkKind: "coach",
      rows: toRows(topN(arr, (c) => c.countries.size), (c) => ({ name: c.name, value: c.countries.size })) },
    { id: "co-consistent", title: "Treinadores mais consistentes (Pontos × Épocas)", fmt: "num2", linkKind: "coach",
      rows: toRows(topN(arr.filter((c) => c.played > 0), (c) => (c.points / c.played) * c.seasons.size),
        (c) => ({ name: c.name, value: (c.points / c.played) * c.seasons.size })) },
  ];

  return [{ group: "Treinadores", rankings }];
}

// ---------------- Country rankings ----------------

export function countryRankings(data: AnalyticsData, seasonSet: Set<number>) {
  const clubCountry = data.clubCountry;
  const players = playersIn(data, seasonSet);
  const std = stdIn(data, seasonSet);

  // Clubs, players, competitions per country
  interface CAgg { country: string; clubs: Set<string>; players: Set<string>; competitions: Set<string>;
    vpSum: number; playersInClubs: Set<string>; }
  const map = new Map<string, CAgg>();
  const ensure = (c: string): CAgg => {
    let x = map.get(c);
    if (!x) { x = { country: c, clubs: new Set(), players: new Set(), competitions: new Set(), vpSum: 0, playersInClubs: new Set() }; map.set(c, x); }
    return x;
  };
  for (const s of std) {
    const cc = clubCountry[s.club_name];
    if (!cc) continue;
    const a = ensure(cc);
    a.clubs.add(s.club_name);
    if (s.competition) a.competitions.add(s.competition);
  }
  for (const p of players) {
    if (p.nationality) ensure(p.nationality).players.add(p.player_name);
    if (p.club) {
      const cc = clubCountry[p.club];
      if (cc) {
        const a = ensure(cc);
        a.vpSum += N(p.vp);
        a.playersInClubs.add(p.player_name);
      }
    }
  }

  const arr = [...map.values()];
  const bestCountriesByRank = data.rankCountries;

  const rankings: Ranking[] = [
    { id: "ctry-rank", title: "Melhores países (ranking global)", fmt: "num2", linkKind: "country",
      rows: toRows(topN(bestCountriesByRank, (c) => c.weighted), (c) => ({ name: c.name, value: c.weighted })) },
    { id: "ctry-clubs", title: "Países com mais clubes ativos", fmt: "int", linkKind: "country",
      rows: toRows(topN(arr, (a) => a.clubs.size), (a) => ({ name: a.country, value: a.clubs.size })) },
    { id: "ctry-comps", title: "Países com mais competições", fmt: "int", linkKind: "country",
      rows: toRows(topN(arr, (a) => a.competitions.size), (a) => ({ name: a.country, value: a.competitions.size })) },
    { id: "ctry-vp", title: "Países com maior valor de mercado (clubes)", fmt: "money", linkKind: "country",
      rows: toRows(topN(arr, (a) => a.vpSum), (a) => ({ name: a.country, value: a.vpSum })) },
    { id: "ctry-players-nat", title: "Países que exportam mais jogadores", fmt: "int", linkKind: "country",
      rows: toRows(topN(arr, (a) => a.players.size), (a) => ({ name: a.country, value: a.players.size })) },
    { id: "ctry-titles", title: "Países com mais títulos internacionais", fmt: "int", linkKind: "country",
      rows: toRows(topN(bestCountriesByRank, (c) => c.titles), (c) => ({ name: c.name, value: c.titles })) },
  ];

  return [{ group: "Países", rankings }];
}

// ---------------- Evolution (per-season global metrics) ----------------

export interface EvoSeries { label: string; fmt: Fmt; points: { year: number; value: number }[] }

export function evolutionSeries(data: AnalyticsData): EvoSeries[] {
  const seasons = data.seasons;
  const perSeason = (year: number) => {
    const std = data.standings.filter((s) => s.season_year === year && (s.module === "superleague" || s.module === "national"));
    const players = data.players.filter((p) => p.season_year === year);
    const coaches = data.coaches.filter((c) => c.season_year === year);
    const clubs = new Set<string>();
    let gf = 0, points = 0, played = 0;
    for (const s of std) { gf += N(s.gf); points += N(s.points); played += N(s.played); clubs.add(s.club_name); }
    let ast = 0, xg = 0, ratingSum = 0, ratingN = 0, salarySum = 0, vpSum = 0, ageSum = 0, ageN = 0, caSum = 0, caN = 0;
    for (const p of players) {
      ast += N(p.ast); xg += N(p.xg);
      if (p.avg_rating != null) { ratingSum += N(p.avg_rating); ratingN++; }
      salarySum += N(p.salary); vpSum += N(p.vp);
      if (p.age != null) { ageSum += N(p.age); ageN++; }
      if (p.ca != null) { caSum += N(p.ca); caN++; }
    }
    const rep = data.clubRep.filter((r) => r.season_year === year);
    const repAvg = rep.length ? rep.reduce((s, r) => s + N(r.reputation), 0) / rep.length : 0;
    const coachCount = new Set(coaches.map((c) => c.name)).size;
    return { gf, points, ast, xg, salarySum, vpSum, ageAvg: ageN > 0 ? ageSum / ageN : 0,
      caAvg: caN > 0 ? caSum / caN : 0, playersN: players.length, clubsN: clubs.size, coachesN: coachCount,
      ratingAvg: ratingN > 0 ? ratingSum / ratingN : 0, repAvg };
  };
  const byYear = new Map(seasons.map((y) => [y, perSeason(y)]));
  const series = (label: string, fmt: Fmt, key: keyof ReturnType<typeof perSeason>): EvoSeries => ({
    label, fmt,
    points: seasons.map((y) => ({ year: y, value: N(byYear.get(y)?.[key]) })),
  });
  return [
    series("Golos", "int", "gf"),
    series("Pontos", "int", "points"),
    series("Reputação média (clubes)", "num2", "repAvg"),
    series("Valor de mercado total", "money", "vpSum"),
    series("Salários totais", "money", "salarySum"),
    series("Assistências", "int", "ast"),
    series("xG total", "num1", "xg"),
    series("Classificação média (CA)", "num1", "caAvg"),
    series("Idade média", "num1", "ageAvg"),
    series("Nº jogadores", "int", "playersN"),
    series("Nº clubes", "int", "clubsN"),
    series("Nº treinadores", "int", "coachesN"),
    series("Rating médio", "num2", "ratingAvg"),
  ];
}

// ---------------- Records (across all seasons) ----------------

export interface RecordRow { label: string; entity: string; value: number; fmt: Fmt; context?: string; }

export function computeRecords(data: AnalyticsData): RecordRow[] {
  const std = data.standings.filter((s) => s.module === "superleague" || s.module === "national");
  const players = data.players;

  // Best per (club, season)
  const clubSeason = groupAgg(std, (s) => `${s.club_name}|${s.season_year}`);
  const csRows = [...clubSeason.entries()].map(([key, rows]) => {
    const [club, year] = key.split("|");
    let points = 0, gf = 0, ga = 0, played = 0, wins = 0;
    for (const r of rows) {
      points += N(r.points); gf += N(r.gf); ga += N(r.ga); played += N(r.played); wins += N(r.wins);
    }
    return { club, year: Number(year), points, gf, ga, played, wins, gd: gf - ga, avoidedGa: -ga };
  });

  const best = <T,>(items: T[], value: (t: T) => number) => {
    if (!items.length) return null;
    return items.reduce((a, b) => (value(b) > value(a) ? b : a));
  };
  const worst = <T,>(items: T[], value: (t: T) => number) => {
    if (!items.length) return null;
    return items.reduce((a, b) => (value(b) < value(a) ? b : a));
  };
  const bestPts = best(csRows, (r) => r.points);
  const mostGf = best(csRows, (r) => r.gf);
  const lessGa = worst(csRows.filter((r) => r.played > 0), (r) => r.ga);
  const bestGd = best(csRows, (r) => r.gd);
  const mostWins = best(csRows, (r) => r.wins);

  // Player records
  const pByPlayerSeason = groupAgg(players, (p) => `${p.player_name}|${p.season_year}`);
  const pRows = [...pByPlayerSeason.entries()].map(([key, rs]) => {
    const [name, year] = key.split("|");
    let gls = 0, ast = 0, vp = 0;
    for (const r of rs) { gls += N(r.gls); ast += N(r.ast); vp = Math.max(vp, N(r.vp)); }
    return { name, year: Number(year), gls, ast, vp, club: rs[0]?.club ?? null };
  });
  const mostGls = best(pRows, (r) => r.gls);
  const mostAst = best(pRows, (r) => r.ast);
  const mostVp = best(pRows, (r) => r.vp);

  const records: RecordRow[] = [];
  if (bestPts) records.push({ label: "Clube com mais pontos numa época", entity: bestPts.club, value: bestPts.points, fmt: "int", context: `${bestPts.year}` });
  if (mostGf) records.push({ label: "Clube com melhor ataque numa época", entity: mostGf.club, value: mostGf.gf, fmt: "int", context: `${mostGf.year}` });
  if (lessGa) records.push({ label: "Clube com melhor defesa numa época (menos golos sofridos)", entity: lessGa.club, value: lessGa.ga, fmt: "int", context: `${lessGa.year}` });
  if (bestGd) records.push({ label: "Melhor diferença de golos numa época", entity: bestGd.club, value: bestGd.gd, fmt: "int", context: `${bestGd.year}` });
  if (mostWins) records.push({ label: "Mais vitórias numa época", entity: mostWins.club, value: mostWins.wins, fmt: "int", context: `${mostWins.year}` });
  if (mostGls) records.push({ label: "Jogador com mais golos numa época", entity: mostGls.name, value: mostGls.gls, fmt: "int", context: `${mostGls.year}${mostGls.club ? ` (${mostGls.club})` : ""}` });
  if (mostAst) records.push({ label: "Jogador com mais assistências numa época", entity: mostAst.name, value: mostAst.ast, fmt: "int", context: `${mostAst.year}${mostAst.club ? ` (${mostAst.club})` : ""}` });
  if (mostVp) records.push({ label: "Jogador mais valioso alguma vez registado", entity: mostVp.name, value: mostVp.vp, fmt: "money", context: `${mostVp.year}` });

  // Global rank records
  const topCoach = data.rankCoaches[0];
  if (topCoach) records.push({ label: "Treinador com mais pontos ponderados", entity: topCoach.name, value: topCoach.weighted, fmt: "num2" });
  const topTitles = [...data.rankCoaches].sort((a, b) => b.titles - a.titles)[0];
  if (topTitles) records.push({ label: "Treinador com mais títulos", entity: topTitles.name, value: topTitles.titles, fmt: "int" });

  return records;
}

// ---------------- Curiosities (deterministic diffs) ----------------

export interface Curiosity { label: string; text: string; }

export function computeCuriosities(data: AnalyticsData): Curiosity[] {
  const seasons = data.seasons;
  if (seasons.length < 2) return [];
  const last = seasons[seasons.length - 1];
  const prev = seasons[seasons.length - 2];

  const items: Curiosity[] = [];

  // Club that gained most VP season-over-season
  const clubVp = (year: number) => {
    const map = new Map<string, number>();
    for (const p of data.players.filter((r) => r.season_year === year)) {
      if (!p.club) continue;
      map.set(p.club, (map.get(p.club) ?? 0) + N(p.vp));
    }
    return map;
  };
  const vpPrev = clubVp(prev), vpLast = clubVp(last);
  const vpDelta: { club: string; delta: number }[] = [];
  for (const [club, v] of vpLast) {
    if (vpPrev.has(club)) vpDelta.push({ club, delta: v - (vpPrev.get(club) ?? 0) });
  }
  vpDelta.sort((a, b) => b.delta - a.delta);
  if (vpDelta.length) {
    const up = vpDelta[0];
    const down = vpDelta[vpDelta.length - 1];
    items.push({ label: "Clube que mais evoluiu (valor)", text: `${up.club} valorizou-se ${(up.delta / 1_000_000).toFixed(1)} M€ de ${prev} para ${last}.` });
    if (down.delta < 0) {
      items.push({ label: "Clube que mais perdeu valor", text: `${down.club} perdeu ${(Math.abs(down.delta) / 1_000_000).toFixed(1)} M€ de ${prev} para ${last}.` });
    }
  }

  // Player that gained most VP
  const playerVp = (year: number) => {
    const map = new Map<string, number>();
    for (const p of data.players.filter((r) => r.season_year === year)) {
      map.set(p.player_name, Math.max(map.get(p.player_name) ?? 0, N(p.vp)));
    }
    return map;
  };
  const ppPrev = playerVp(prev), ppLast = playerVp(last);
  const ppDelta: { name: string; delta: number }[] = [];
  for (const [name, v] of ppLast) {
    if (ppPrev.has(name)) ppDelta.push({ name, delta: v - (ppPrev.get(name) ?? 0) });
  }
  ppDelta.sort((a, b) => b.delta - a.delta);
  if (ppDelta.length) {
    const up = ppDelta[0];
    items.push({ label: "Jogador que mais valorizou", text: `${up.name} valorizou-se ${(up.delta / 1_000_000).toFixed(1)} M€ de ${prev} para ${last}.` });
  }

  // Country in strongest growth (ranking countries weighted delta N/A — use rank order changes)
  // Fallback: country with biggest player influx (nationality)
  const nats = (year: number) => {
    const map = new Map<string, number>();
    for (const p of data.players.filter((r) => r.season_year === year)) {
      if (!p.nationality) continue;
      map.set(p.nationality, (map.get(p.nationality) ?? 0) + 1);
    }
    return map;
  };
  const nPrev = nats(prev), nLast = nats(last);
  const nDelta: { name: string; delta: number }[] = [];
  for (const [name, v] of nLast) nDelta.push({ name, delta: v - (nPrev.get(name) ?? 0) });
  nDelta.sort((a, b) => b.delta - a.delta);
  if (nDelta.length && nDelta[0].delta > 0) {
    items.push({ label: "País em maior crescimento", text: `${nDelta[0].name} aumentou em ${nDelta[0].delta} o número de jogadores no ativo.` });
  }

  // Most dominant club (overall)
  const topClub = data.rankClubs[0];
  if (topClub) items.push({ label: "Clube mais dominante da história", text: `${topClub.name} lidera o ranking mundial com ${topClub.weighted.toFixed(1)} pontos ponderados.` });
  const topCoach = data.rankCoaches[0];
  if (topCoach) items.push({ label: "Treinador mais vencedor", text: `${topCoach.name} soma ${topCoach.titles} título(s) e ${topCoach.weighted.toFixed(1)} pontos ponderados.` });

  // Biggest surprise / drop (position delta in same competition)
  const posByClubComp = (year: number) => {
    const map = new Map<string, number>();
    for (const s of data.standings.filter((r) => r.season_year === year && r.position != null)) {
      const key = `${s.club_name}|${s.competition ?? s.division_label ?? ""}`;
      const cur = map.get(key);
      if (cur == null || N(s.position) < cur) map.set(key, N(s.position));
    }
    return map;
  };
  const posPrev = posByClubComp(prev), posLast = posByClubComp(last);
  const posDelta: { key: string; delta: number }[] = [];
  for (const [k, p2] of posLast) {
    if (posPrev.has(k)) posDelta.push({ key: k, delta: (posPrev.get(k) ?? 0) - p2 });
  }
  posDelta.sort((a, b) => b.delta - a.delta);
  if (posDelta.length) {
    const s = posDelta[0]; const [club, comp] = s.key.split("|");
    if (s.delta > 0) items.push({ label: "Maior surpresa da época", text: `${club} subiu ${s.delta} posições em ${comp || "campeonato"} de ${prev} para ${last}.` });
    const w = posDelta[posDelta.length - 1];
    if (w.delta < 0) {
      const [wclub, wcomp] = w.key.split("|");
      items.push({ label: "Maior queda da época", text: `${wclub} caiu ${Math.abs(w.delta)} posições em ${wcomp || "campeonato"} de ${prev} para ${last}.` });
    }
  }

  return items;
}
