// Lightweight snapshots used by the Insights page. We persist a small summary
// after each player-stats import (computed client-side) and diff the last two.
import { getLocal, setLocal, useLocal } from "./fm-local-store";

export const SNAPSHOTS_KEY = "fm-insights-snapshots-v1";

export interface SnapshotMetric {
  // generic key -> value for arbitrary aggregates (avg age, top country, etc.)
  [k: string]: number | string;
}

export interface InsightsSnapshot {
  id: string;
  takenAt: number;
  seasonYear: number | null;
  source: string; // e.g. "player-stats-import"
  totals: {
    players: number;
    clubs: number;
    competitions: number;
    countries: number;
  };
  // Aggregations:
  byCountryPlayers: Record<string, number>;
  byCompetitionVp: Record<string, number>;
  byCompetitionSalary: Record<string, number>;
  topGoalScorer: { name: string; gls: number } | null;
  topClubByVp: { name: string; vp: number } | null;
  avgAge: number;
  notes?: string;
}

export function listSnapshots(): InsightsSnapshot[] {
  return getLocal<InsightsSnapshot[]>(SNAPSHOTS_KEY, []);
}

export function saveSnapshots(items: InsightsSnapshot[]) {
  // Keep at most 30 entries to avoid storage bloat.
  const trimmed = items.slice(-30);
  setLocal(SNAPSHOTS_KEY, trimmed);
}

export function appendSnapshot(s: InsightsSnapshot) {
  saveSnapshots([...listSnapshots(), s]);
}

export function useSnapshots() {
  return useLocal<InsightsSnapshot[]>(SNAPSHOTS_KEY, []);
}

export interface InsightItem {
  id: string;
  title: string;
  detail: string;
  delta: number;       // absolute change
  pct: number;         // % change relative to previous
  previous: number | string | null;
  current: number | string | null;
  relevance: number;   // sort key
  category: "competicao" | "pais" | "jogador" | "clube" | "geral";
}

function fmtPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

/** Build an insights list from the two most recent snapshots. */
export function buildInsights(snaps: InsightsSnapshot[]): InsightItem[] {
  if (snaps.length < 2) return [];
  const prev = snaps[snaps.length - 2];
  const curr = snaps[snaps.length - 1];
  const items: InsightItem[] = [];
  const push = (it: InsightItem) => items.push(it);

  // Global age
  if (prev.avgAge && curr.avgAge) {
    const d = curr.avgAge - prev.avgAge;
    push({
      id: `age`,
      title: `Idade média mundial ${d >= 0 ? "subiu" : "desceu"} ${Math.abs(d).toFixed(2)} anos`,
      detail: `${prev.avgAge.toFixed(2)} → ${curr.avgAge.toFixed(2)}`,
      delta: d, pct: prev.avgAge ? (d / prev.avgAge) * 100 : 0,
      previous: prev.avgAge, current: curr.avgAge,
      relevance: Math.abs(d) * 50, category: "geral",
    });
  }

  // Totals
  for (const k of ["players", "clubs", "competitions", "countries"] as const) {
    const a = prev.totals[k] ?? 0;
    const b = curr.totals[k] ?? 0;
    if (a === b) continue;
    const d = b - a;
    push({
      id: `total-${k}`,
      title: `${d > 0 ? "+" : ""}${d} ${k === "players" ? "jogadores" : k === "clubs" ? "clubes" : k === "competitions" ? "competições" : "países"} no total`,
      detail: `${a} → ${b} (${fmtPct(a ? (d / a) * 100 : 0)})`,
      delta: d, pct: a ? (d / a) * 100 : 0,
      previous: a, current: b,
      relevance: Math.abs(d), category: "geral",
    });
  }

  // Competitions VP changes
  const compKeys = new Set([...Object.keys(prev.byCompetitionVp), ...Object.keys(curr.byCompetitionVp)]);
  for (const c of compKeys) {
    const a = prev.byCompetitionVp[c] ?? 0;
    const b = curr.byCompetitionVp[c] ?? 0;
    if (!a && !b) continue;
    const d = b - a;
    const pct = a ? (d / a) * 100 : 100;
    if (Math.abs(pct) < 5) continue;
    push({
      id: `vp-${c}`,
      title: `${c}: V.P. ${pct >= 0 ? "subiu" : "caiu"} ${Math.abs(pct).toFixed(1)}%`,
      detail: `${a.toLocaleString("pt-PT")} → ${b.toLocaleString("pt-PT")}`,
      delta: d, pct, previous: a, current: b,
      relevance: Math.abs(pct) * Math.log10(Math.max(b, 1) + 1),
      category: "competicao",
    });
  }

  // Countries population
  const ctyKeys = new Set([...Object.keys(prev.byCountryPlayers), ...Object.keys(curr.byCountryPlayers)]);
  for (const c of ctyKeys) {
    const a = prev.byCountryPlayers[c] ?? 0;
    const b = curr.byCountryPlayers[c] ?? 0;
    if (a === b) continue;
    const d = b - a;
    const pct = a ? (d / a) * 100 : 100;
    if (Math.abs(d) < 10) continue;
    push({
      id: `cty-${c}`,
      title: `${c}: ${d > 0 ? "+" : ""}${d} jogadores`,
      detail: `${a} → ${b} (${fmtPct(pct)})`,
      delta: d, pct, previous: a, current: b,
      relevance: Math.abs(d) * 2, category: "pais",
    });
  }

  // Top goal scorer
  if (curr.topGoalScorer && (!prev.topGoalScorer || prev.topGoalScorer.name !== curr.topGoalScorer.name)) {
    push({
      id: "top-gls",
      title: `Novo líder em golos: ${curr.topGoalScorer.name}`,
      detail: `${curr.topGoalScorer.gls} golos (anterior: ${prev.topGoalScorer?.name ?? "—"})`,
      delta: curr.topGoalScorer.gls - (prev.topGoalScorer?.gls ?? 0),
      pct: 0, previous: prev.topGoalScorer?.name ?? null, current: curr.topGoalScorer.name,
      relevance: 1000, category: "jogador",
    });
  }

  if (curr.topClubByVp && (!prev.topClubByVp || prev.topClubByVp.name !== curr.topClubByVp.name)) {
    push({
      id: "top-club-vp",
      title: `Novo clube mais valioso: ${curr.topClubByVp.name}`,
      detail: `${curr.topClubByVp.vp.toLocaleString("pt-PT")} (anterior: ${prev.topClubByVp?.name ?? "—"})`,
      delta: curr.topClubByVp.vp - (prev.topClubByVp?.vp ?? 0),
      pct: 0, previous: prev.topClubByVp?.name ?? null, current: curr.topClubByVp.name,
      relevance: 900, category: "clube",
    });
  }

  return items.sort((a, b) => b.relevance - a.relevance);
}

/** Compute and persist a snapshot from a list of player rows (post-import). */
export interface SnapshotInputRow {
  player_name: string;
  nationality: string | null;
  competition: string;
  club: string | null;
  gls: number; vp: number; salary: number; age: number;
}
export function buildSnapshotFromRows(rows: SnapshotInputRow[], seasonYear: number | null, source = "player-stats-import"): InsightsSnapshot {
  const byCountry: Record<string, number> = {};
  const byCompVp: Record<string, number> = {};
  const byCompSal: Record<string, number> = {};
  const clubs = new Set<string>();
  const comps = new Set<string>();
  const countries = new Set<string>();
  const clubVp: Record<string, number> = {};
  let ageSum = 0;
  let top: { name: string; gls: number } | null = null;
  for (const r of rows) {
    if (r.nationality) { byCountry[r.nationality] = (byCountry[r.nationality] ?? 0) + 1; countries.add(r.nationality); }
    if (r.competition) { byCompVp[r.competition] = (byCompVp[r.competition] ?? 0) + (r.vp || 0); byCompSal[r.competition] = (byCompSal[r.competition] ?? 0) + (r.salary || 0); comps.add(r.competition); }
    if (r.club) { clubs.add(r.club); clubVp[r.club] = (clubVp[r.club] ?? 0) + (r.vp || 0); }
    ageSum += r.age || 0;
    if (!top || r.gls > top.gls) top = { name: r.player_name, gls: r.gls || 0 };
  }
  let topClub: { name: string; vp: number } | null = null;
  for (const [n, v] of Object.entries(clubVp)) {
    if (!topClub || v > topClub.vp) topClub = { name: n, vp: v };
  }
  return {
    id: `snap_${Date.now().toString(36)}`,
    takenAt: Date.now(),
    seasonYear,
    source,
    totals: { players: rows.length, clubs: clubs.size, competitions: comps.size, countries: countries.size },
    byCountryPlayers: byCountry,
    byCompetitionVp: byCompVp,
    byCompetitionSalary: byCompSal,
    topGoalScorer: top,
    topClubByVp: topClub,
    avgAge: rows.length ? ageSum / rows.length : 0,
  };
}