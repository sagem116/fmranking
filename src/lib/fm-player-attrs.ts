import type { PlayerRow } from "./fm-db";

export type AttrKey = "ra" | "rm" | "ca" | "cp" | "age" | "salary" | "vp" | "count";

export const ATTR_LABEL: Record<AttrKey, string> = {
  ra: "R.A. (média)",
  rm: "R.M. (média)",
  ca: "C.A. (média)",
  cp: "C.P. (média)",
  age: "Idade (média)",
  salary: "Salário (média)",
  vp: "Valor Plantel (total)",
  count: "Nº jogadores",
};

export const ATTR_SHORT: Record<AttrKey, string> = {
  ra: "R.A.", rm: "R.M.", ca: "C.A.", cp: "C.P.",
  age: "Idade", salary: "Salário", vp: "VP", count: "Nº",
};

export const ALL_ATTRS: AttrKey[] = ["ra", "rm", "ca", "cp", "age", "salary", "vp", "count"];

export interface AttrPoint {
  year: number;
  ra: number | null;
  rm: number | null;
  ca: number | null;
  cp: number | null;
  age: number | null;
  salary: number | null;
  vp: number;
  count: number;
}

function avg(values: number[]): number | null {
  const nums = values.filter((v) => v != null && !Number.isNaN(v) && v > 0);
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

/**
 * Aggregate player attributes per year. Provide either `clubName` or `leagueName`
 * (case-insensitive substring match on the player's `league` field for leagues,
 * exact match on `club_name` for clubs).
 */
export function aggregatePlayerAttrs(
  players: PlayerRow[],
  opts: { club?: string; league?: string },
): AttrPoint[] {
  const cl = opts.club;
  const lg = opts.league?.toLowerCase().trim();
  const byYear = new Map<number, PlayerRow[]>();
  for (const p of players) {
    if (cl && p.club_name !== cl) continue;
    if (lg && (!p.league || !p.league.toLowerCase().includes(lg))) continue;
    const arr = byYear.get(p.season_year) ?? [];
    arr.push(p);
    byYear.set(p.season_year, arr);
  }
  const out: AttrPoint[] = [];
  for (const [year, list] of byYear) {
    out.push({
      year,
      ra: avg(list.map((p) => p.ra)),
      rm: avg(list.map((p) => p.rm)),
      ca: avg(list.map((p) => p.ca)),
      cp: avg(list.map((p) => p.cp)),
      age: avg(list.map((p) => (p.age ?? 0))),
      salary: avg(list.map((p) => p.salary)),
      vp: list.reduce((s, p) => s + (p.vp || 0), 0),
      count: list.length,
    });
  }
  return out.sort((a, b) => a.year - b.year);
}
