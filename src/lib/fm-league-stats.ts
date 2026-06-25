import type { AllData, PlayerRow } from "./fm-db";
import type { StandingRow } from "./fm-rankings";
import { continentOf } from "./fm-continents";

export type Scope = "national" | "superleague";

export interface LeagueAgg {
  league: string;          // unique key shown to user
  country: string | null;
  continent: string | null;
  // -- players
  nPlayers: number;
  caAvg: number;
  cpAvg: number;
  vpAvg: number;
  salaryAvg: number;
  ageAvg: number;
  // -- standings
  nTeams: number;
  gmTotal: number;
  gsTotal: number;
  gamesTotal: number;     // sum of played (counts both halves of a match)
  pointsTotal: number;
  pointsStd: number;
  valueStd: number;       // std dev of mean club value
  caStd: number;          // std dev of mean club CA
  leaderPts: number;
  secondPts: number;
  // -- derived
  gmPerGame: number;
  gsPerGame: number;
  spectaclePerGame: number;
  offEfficiency: number;  // pontos / golos
  leaderGap: number;
  // for super-league scope, the underlying division_num
  divisionNum?: number | null;
  // year covered (when single-season) or null
  season?: number | null;
}

export interface LeagueFilters {
  yearFrom?: number | null;
  yearTo?: number | null;
  continent?: string | null;
  country?: string | null;
  divisionMin?: number | null;
  divisionMax?: number | null;
  teamsMin?: number | null;
  teamsMax?: number | null;
  caMin?: number | null;
  caMax?: number | null;
  vpMin?: number | null;
  vpMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  ageMin?: number | null;
  ageMax?: number | null;
  search?: string;
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((acc, v) => acc + (v - m) ** 2, 0) / a.length);
};

function inRange(v: number | null | undefined, lo?: number | null, hi?: number | null) {
  if (v == null) return lo == null && hi == null;
  if (lo != null && v < lo) return false;
  if (hi != null && v > hi) return false;
  return true;
}

function leagueKeyForStanding(s: StandingRow, scope: Scope): string | null {
  if (scope === "superleague") {
    if (s.module !== "superleague" || s.division_num == null) return null;
    return `Super League D${s.division_num}`;
  }
  if (s.module !== "national") return null;
  return s.division_label ?? null;
}

function leagueKeyForPlayer(p: PlayerRow, standDivByClubSeason: Map<string, number>, scope: Scope): string | null {
  if (scope === "superleague") {
    if (p.module !== "superleague" || !p.club_name) return null;
    const div = standDivByClubSeason.get(`${p.season_year}|${p.club_name}`);
    if (div == null) return null;
    return `Super League D${div}`;
  }
  if (p.module !== "national") return null;
  return p.league ?? null;
}

export function computeLeagueStats(
  data: AllData,
  scope: Scope,
  filters: LeagueFilters,
): LeagueAgg[] {
  const { standings, players, clubCountry } = data;
  const yFrom = filters.yearFrom ?? -Infinity;
  const yTo = filters.yearTo ?? Infinity;

  // index: superleague club→division per season (for routing players to a SL division)
  const standDivByClubSeason = new Map<string, number>();
  for (const s of standings) {
    if (s.module === "superleague" && s.division_num != null && s.club_name) {
      standDivByClubSeason.set(`${s.season_year}|${s.club_name}`, s.division_num);
    }
  }

  // bucket by league
  type Bucket = {
    league: string;
    divisionNum?: number | null;
    standings: StandingRow[];
    players: PlayerRow[];
    countries: Map<string, number>;
  };
  const buckets = new Map<string, Bucket>();
  const ensure = (key: string, divNum?: number | null): Bucket => {
    let b = buckets.get(key);
    if (!b) {
      b = { league: key, divisionNum: divNum ?? null, standings: [], players: [], countries: new Map() };
      buckets.set(key, b);
    }
    return b;
  };

  for (const s of standings) {
    const key = leagueKeyForStanding(s, scope);
    if (!key) continue;
    if (s.season_year < yFrom || s.season_year > yTo) continue;
    const b = ensure(key, s.division_num);
    b.standings.push(s);
    const c = clubCountry[s.club_name] ?? null;
    if (c) b.countries.set(c, (b.countries.get(c) ?? 0) + 1);
  }
  for (const p of players) {
    const key = leagueKeyForPlayer(p, standDivByClubSeason, scope);
    if (!key) continue;
    if (p.season_year < yFrom || p.season_year > yTo) continue;
    const b = ensure(key);
    b.players.push(p);
  }

  const out: LeagueAgg[] = [];
  for (const b of buckets.values()) {
    // dominant country
    let country: string | null = null;
    let best = 0;
    for (const [c, n] of b.countries) if (n > best) { best = n; country = c; }

    // club aggregates within bucket
    const playersByClub = new Map<string, PlayerRow[]>();
    for (const p of b.players) {
      if (!p.club_name) continue;
      const arr = playersByClub.get(p.club_name) ?? [];
      arr.push(p);
      playersByClub.set(p.club_name, arr);
    }
    const clubCa: number[] = [];
    const clubVp: number[] = [];
    for (const arr of playersByClub.values()) {
      const top = [...arr].sort((a, b) => b.ca - a.ca).slice(0, 28);
      clubCa.push(mean(top.map((p) => p.ca).filter((v) => v > 0)));
      clubVp.push(top.reduce((s, p) => s + (p.vp || 0), 0));
    }

    // teams count: unique clubs in standings
    const clubsSet = new Set(b.standings.map((s) => s.club_name));
    // standings per (year, division) — for leader/second/dominance pick latest year
    let leaderPts = 0, secondPts = 0;
    {
      const latest = b.standings.reduce((a, s) => Math.max(a, s.season_year), -Infinity);
      const rows = b.standings
        .filter((s) => s.season_year === latest && s.points != null)
        .sort((a, b2) => (Number(b2.points) || 0) - (Number(a.points) || 0));
      leaderPts = Number(rows[0]?.points) || 0;
      secondPts = Number(rows[1]?.points) || 0;
    }
    const ptsArr = b.standings.map((s) => Number(s.points) || 0).filter((v) => v > 0);

    const gm = b.standings.reduce((s, r) => s + (Number(r.gf) || 0), 0);
    const gs = b.standings.reduce((s, r) => s + (Number(r.ga) || 0), 0);
    const games = b.standings.reduce((s, r) => s + (Number(r.played) || 0), 0);
    const pointsTotal = b.standings.reduce((s, r) => s + (Number(r.points) || 0), 0);

    const ageVals = b.players.map((p) => p.age ?? 0).filter((v) => v > 0);
    const caVals = b.players.map((p) => p.ca).filter((v) => v > 0);
    const cpVals = b.players.map((p) => p.cp).filter((v) => v > 0);
    const vpVals = b.players.map((p) => p.vp).filter((v) => v > 0);
    const salVals = b.players.map((p) => p.salary).filter((v) => v > 0);

    out.push({
      league: b.league,
      country,
      continent: continentOf(country),
      nPlayers: b.players.length,
      caAvg: mean(caVals),
      cpAvg: mean(cpVals),
      vpAvg: mean(vpVals),
      salaryAvg: mean(salVals),
      ageAvg: mean(ageVals),
      nTeams: clubsSet.size,
      gmTotal: gm,
      gsTotal: gs,
      gamesTotal: games,
      pointsTotal,
      pointsStd: std(ptsArr),
      valueStd: std(clubVp),
      caStd: std(clubCa),
      leaderPts,
      secondPts,
      gmPerGame: games ? gm / games : 0,
      gsPerGame: games ? gs / games : 0,
      spectaclePerGame: games ? (gm + gs) / games : 0,
      offEfficiency: gm ? pointsTotal / gm : 0,
      leaderGap: leaderPts - secondPts,
      divisionNum: b.divisionNum,
    });
  }

  // apply filters
  const search = (filters.search ?? "").trim().toLowerCase();
  return out.filter((r) => {
    if (filters.continent && r.continent !== filters.continent) return false;
    if (filters.country && r.country !== filters.country) return false;
    if (scope === "superleague") {
      if (filters.divisionMin != null && (r.divisionNum ?? 0) < filters.divisionMin) return false;
      if (filters.divisionMax != null && (r.divisionNum ?? 99) > filters.divisionMax) return false;
    }
    if (!inRange(r.nTeams, filters.teamsMin, filters.teamsMax)) return false;
    if (!inRange(r.caAvg, filters.caMin, filters.caMax)) return false;
    if (!inRange(r.vpAvg, filters.vpMin, filters.vpMax)) return false;
    if (!inRange(r.salaryAvg, filters.salaryMin, filters.salaryMax)) return false;
    if (!inRange(r.ageAvg, filters.ageMin, filters.ageMax)) return false;
    if (search && !r.league.toLowerCase().includes(search)) return false;
    return true;
  });
}

// ----- Rankings catalog ---------------------------------------------------

export type RankingKey =
  | "global" | "tech" | "potential" | "financial"
  | "youngest" | "oldest" | "offensive" | "defensive" | "spectacle"
  | "competitiveness" | "parityFin" | "parityTech" | "dominance"
  | "offEff" | "defSolidity";

export interface RankingColumn {
  key: string;
  label: string;
  // accessor over agg + extras
  value: (r: LeagueAgg, extras: Record<string, Record<string, number>>) => number;
  // formatting
  fmt?: "int" | "dec1" | "dec2" | "money";
}

export interface RankingDef {
  key: RankingKey;
  label: string;
  description: string;      // explanation shown to user
  sortKey: string;          // column key default
  sortDir: "asc" | "desc";
  columns: RankingColumn[];
  // computes extras (score etc.) given filtered list
  extras?: (rows: LeagueAgg[]) => Record<string, Record<string, number>>;
}

// normalize 0-100 by min-max on a numeric attribute (use 0 if all equal)
function normalize(rows: LeagueAgg[], pick: (r: LeagueAgg) => number, invert = false): Map<string, number> {
  const vals = rows.map(pick);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min;
  const out = new Map<string, number>();
  rows.forEach((r, i) => {
    if (span <= 0) { out.set(r.league, 50); return; }
    const t = (vals[i] - min) / span;
    out.set(r.league, (invert ? 1 - t : t) * 100);
  });
  return out;
}

function toMap(rows: LeagueAgg[], pick: (r: LeagueAgg) => number): Record<string, number> {
  const o: Record<string, number> = {};
  for (const r of rows) o[r.league] = pick(r);
  return o;
}

const ca = (r: LeagueAgg) => r.caAvg;
const cp = (r: LeagueAgg) => r.cpAvg;
const vp = (r: LeagueAgg) => r.vpAvg;
const sal = (r: LeagueAgg) => r.salaryAvg;
const np = (r: LeagueAgg) => r.nPlayers;

export const RANKINGS: RankingDef[] = [
  {
    key: "global", label: "Qualidade Global", description: "Composto que combina CA, valor de mercado, salário, CP e nº de jogadores (35/25/20/10/10).", sortKey: "score", sortDir: "desc",
    columns: [
      { key: "score", label: "Score Global", value: (r, x) => x.score?.[r.league] ?? 0, fmt: "dec1" },
      { key: "caAvg", label: "CA Médio", value: (r) => r.caAvg, fmt: "dec1" },
      { key: "cpAvg", label: "CP Médio", value: (r) => r.cpAvg, fmt: "dec1" },
      { key: "vpAvg", label: "Valor Médio", value: (r) => r.vpAvg, fmt: "money" },
      { key: "salaryAvg", label: "Salário Médio", value: (r) => r.salaryAvg, fmt: "money" },
      { key: "nPlayers", label: "Nº Jog.", value: (r) => r.nPlayers, fmt: "int" },
    ],
    extras: (rows) => {
      const nCa = normalize(rows, ca);
      const nVp = normalize(rows, vp);
      const nSal = normalize(rows, sal);
      const nCp = normalize(rows, cp);
      const nN = normalize(rows, np);
      const score: Record<string, number> = {};
      for (const r of rows) {
        score[r.league] = 0.35*(nCa.get(r.league)??0) + 0.25*(nVp.get(r.league)??0)
          + 0.20*(nSal.get(r.league)??0) + 0.10*(nCp.get(r.league)??0) + 0.10*(nN.get(r.league)??0);
      }
      return { score };
    },
  },
  {
    key: "tech", label: "Qualidade Técnica", description: "Ordenado pelo CA médio dos jogadores da liga — talento atual no terreno.", sortKey: "caAvg", sortDir: "desc",
    columns: [
      { key: "caAvg", label: "CA Médio", value: (r) => r.caAvg, fmt: "dec1" },
      { key: "nPlayers", label: "Nº Jog.", value: (r) => r.nPlayers, fmt: "int" },
    ],
  },
  {
    key: "potential", label: "Potencial Futuro", description: "Ordenado pelo CP médio — potencial futuro dos jogadores em desenvolvimento.", sortKey: "cpAvg", sortDir: "desc",
    columns: [
      { key: "cpAvg", label: "CP Médio", value: (r) => r.cpAvg, fmt: "dec1" },
      { key: "ageAvg", label: "Idade Média", value: (r) => r.ageAvg, fmt: "dec1" },
    ],
  },
  {
    key: "financial", label: "Poder Financeiro", description: "Composto pelo valor de mercado (60%) e salário médio (40%) — poderio económico.", sortKey: "score", sortDir: "desc",
    columns: [
      { key: "score", label: "Score Financeiro", value: (r, x) => x.score?.[r.league] ?? 0, fmt: "dec1" },
      { key: "vpAvg", label: "Valor Médio", value: (r) => r.vpAvg, fmt: "money" },
      { key: "salaryAvg", label: "Salário Médio", value: (r) => r.salaryAvg, fmt: "money" },
    ],
    extras: (rows) => {
      const nV = normalize(rows, vp);
      const nS = normalize(rows, sal);
      const score: Record<string, number> = {};
      for (const r of rows) score[r.league] = 0.6*(nV.get(r.league)??0) + 0.4*(nS.get(r.league)??0);
      return { score };
    },
  },
  {
    key: "youngest", label: "Mais Jovem", description: "Ligas com a idade média mais baixa — apostas no futuro.", sortKey: "ageAvg", sortDir: "asc",
    columns: [{ key: "ageAvg", label: "Idade Média", value: (r) => r.ageAvg, fmt: "dec1" }],
  },
  {
    key: "oldest", label: "Mais Experiente", description: "Ligas com a idade média mais alta — experiência acumulada.", sortKey: "ageAvg", sortDir: "desc",
    columns: [{ key: "ageAvg", label: "Idade Média", value: (r) => r.ageAvg, fmt: "dec1" }],
  },
  {
    key: "offensive", label: "Mais Ofensiva", description: "Mais golos marcados por jogo — ataque produtivo.", sortKey: "gmPerGame", sortDir: "desc",
    columns: [
      { key: "gmTotal", label: "GM", value: (r) => r.gmTotal, fmt: "int" },
      { key: "gamesTotal", label: "Jogos", value: (r) => r.gamesTotal, fmt: "int" },
      { key: "gmPerGame", label: "Golos/Jogo", value: (r) => r.gmPerGame, fmt: "dec2" },
    ],
  },
  {
    key: "defensive", label: "Mais Defensiva", description: "Menos golos marcados por jogo (do ponto de vista coletivo da liga) — fraco poder ofensivo.", sortKey: "gmPerGame", sortDir: "asc",
    columns: [
      { key: "gmTotal", label: "GM", value: (r) => r.gmTotal, fmt: "int" },
      { key: "gamesTotal", label: "Jogos", value: (r) => r.gamesTotal, fmt: "int" },
      { key: "gmPerGame", label: "Golos/Jogo", value: (r) => r.gmPerGame, fmt: "dec2" },
    ],
  },
  {
    key: "spectacle", label: "Mais Espetacular", description: "Soma de golos marcados+sofridos por jogo — jogos mais espetaculares e abertos.", sortKey: "spectaclePerGame", sortDir: "desc",
    columns: [
      { key: "gmTotal", label: "GM", value: (r) => r.gmTotal, fmt: "int" },
      { key: "gsTotal", label: "GS", value: (r) => r.gsTotal, fmt: "int" },
      { key: "spectaclePerGame", label: "Golos Totais/Jogo", value: (r) => r.spectaclePerGame, fmt: "dec2" },
    ],
  },
  {
    key: "competitiveness", label: "Competitividade", description: "Quanto menor o desvio padrão dos pontos, mais equilibrada a liga (score 100 = máxima paridade).", sortKey: "score", sortDir: "desc",
    columns: [
      { key: "score", label: "Score Compet.", value: (r, x) => x.score?.[r.league] ?? 0, fmt: "dec1" },
      { key: "pointsStd", label: "Desvio Pontos", value: (r) => r.pointsStd, fmt: "dec2" },
    ],
    extras: (rows) => ({ score: toMap(rows, (r) => 100 - (normalize(rows, (x) => x.pointsStd).get(r.league) ?? 0)) }),
  },
  {
    key: "parityFin", label: "Paridade Financeira", description: "Quanto menor o desvio do valor médio entre clubes, mais financeiramente paritária.", sortKey: "score", sortDir: "desc",
    columns: [
      { key: "score", label: "Score Paridade", value: (r, x) => x.score?.[r.league] ?? 0, fmt: "dec1" },
      { key: "valueStd", label: "Desvio Valor", value: (r) => r.valueStd, fmt: "dec2" },
    ],
    extras: (rows) => ({ score: toMap(rows, (r) => 100 - (normalize(rows, (x) => x.valueStd).get(r.league) ?? 0)) }),
  },
  {
    key: "parityTech", label: "Paridade Técnica", description: "Quanto menor o desvio do CA médio entre clubes, mais paritária tecnicamente.", sortKey: "score", sortDir: "desc",
    columns: [
      { key: "score", label: "Score Paridade Téc.", value: (r, x) => x.score?.[r.league] ?? 0, fmt: "dec1" },
      { key: "caStd", label: "Desvio CA", value: (r) => r.caStd, fmt: "dec2" },
    ],
    extras: (rows) => ({ score: toMap(rows, (r) => 100 - (normalize(rows, (x) => x.caStd).get(r.league) ?? 0)) }),
  },
  {
    key: "dominance", label: "Dominância", description: "Diferença em pontos do líder para o 2º na última época — quanto maior, mais dominante.", sortKey: "leaderGap", sortDir: "desc",
    columns: [
      { key: "leaderGap", label: "Diferença Líder", value: (r) => r.leaderGap, fmt: "int" },
      { key: "leaderPts", label: "Pontos Líder", value: (r) => r.leaderPts, fmt: "int" },
      { key: "secondPts", label: "Pontos 2º", value: (r) => r.secondPts, fmt: "int" },
    ],
  },
  {
    key: "offEff", label: "Eficiência Ofensiva", description: "Pontos conquistados por golo marcado — eficiência ao converter ataque em resultados.", sortKey: "offEfficiency", sortDir: "desc",
    columns: [
      { key: "pointsTotal", label: "Pontos", value: (r) => r.pointsTotal, fmt: "int" },
      { key: "gmTotal", label: "Golos", value: (r) => r.gmTotal, fmt: "int" },
      { key: "offEfficiency", label: "Eficiência", value: (r) => r.offEfficiency, fmt: "dec2" },
    ],
  },
  {
    key: "defSolidity", label: "Solidez Defensiva", description: "Menos golos sofridos por jogo — ligas defensivamente sólidas.", sortKey: "gsPerGame", sortDir: "asc",
    columns: [
      { key: "gsTotal", label: "GS", value: (r) => r.gsTotal, fmt: "int" },
      { key: "gamesTotal", label: "Jogos", value: (r) => r.gamesTotal, fmt: "int" },
      { key: "gsPerGame", label: "GS/Jogo", value: (r) => r.gsPerGame, fmt: "dec2" },
    ],
  },
];

export function formatVal(v: number, fmt?: RankingColumn["fmt"]) {
  if (!isFinite(v)) return "—";
  switch (fmt) {
    case "int": return Math.round(v).toLocaleString("pt-PT");
    case "dec1": return v.toFixed(1);
    case "dec2": return v.toFixed(2);
    case "money": return Math.round(v).toLocaleString("pt-PT");
    default: return String(v);
  }
}
