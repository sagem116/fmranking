import type { StandingRow, CoachRow } from "./fm-rankings";

function infTokens(inf?: string | null): Set<string> {
  if (!inf) return new Set();
  return new Set(
    String(inf)
      .toUpperCase()
      .split(/[\s,;/|+]+/)
      .map((t) => t.trim())
      .filter(Boolean),
  );
}
const isC = (i?: string | null) => infTokens(i).has("C");
const isP = (i?: string | null) => infTokens(i).has("P");
const isD = (i?: string | null) => infTokens(i).has("D");

export interface ChampRow {
  name: string;
  nac?: string | null;
  c: number;
  p: number;
  d: number;
  total: number;
  tipC: string;
  tipP: string;
  tipD: string;
}

export interface PlayoffRow {
  name: string;
  nac?: string | null;
  quaseSubida: number;
  quaseTitulo: number;
  total: number;
  tipQS: string;
  tipQT: string;
}

function slStandings(standings: StandingRow[]): StandingRow[] {
  return standings.filter((s) => s.module === "superleague");
}

// coach name for a given season+club (superleague)
function coachIndex(coaches: CoachRow[]) {
  const m = new Map<string, { name: string; nac: string | null }>();
  for (const c of coaches) {
    if (c.module !== "superleague" || !c.club_name) continue;
    m.set(`${c.season_year}|${c.club_name}`, { name: c.name, nac: c.nationality });
  }
  return m;
}

export function computeClubChampions(standings: StandingRow[]): ChampRow[] {
  const map = new Map<string, ChampRow & { _C: string[]; _P: string[]; _D: string[] }>();
  for (const s of slStandings(standings)) {
    const posTag = s.position ? `, ${s.position}º` : "";
    const tag = `${s.season_year} (Div ${s.division_num ?? "?"}${posTag})`;
    const r = map.get(s.club_name) ?? {
      name: s.club_name, c: 0, p: 0, d: 0, total: 0, tipC: "", tipP: "", tipD: "",
      _C: [], _P: [], _D: [],
    };
    if (isC(s.info)) { r.c++; r._C.push(tag); }
    if (isP(s.info)) { r.p++; r._P.push(tag); }
    if (isD(s.info)) { r.d++; r._D.push(tag); }
    map.set(s.club_name, r);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      total: r.c * 3 + r.p - r.d,
      tipC: r._C.join(", "),
      tipP: r._P.join(", "),
      tipD: r._D.join(", "),
    }))
    .filter((r) => r.c + r.p + r.d > 0)
    .sort((a, b) => b.total - a.total);
}

export function computeClubPlayoffs(standings: StandingRow[]): PlayoffRow[] {
  const map = new Map<string, PlayoffRow & { _QS: string[]; _QT: string[] }>();
  for (const s of slStandings(standings)) {
    const div = s.division_num ?? 0;
    const pos = s.position ?? 0;
    const r = map.get(s.club_name) ?? {
      name: s.club_name, quaseSubida: 0, quaseTitulo: 0, total: 0, tipQS: "", tipQT: "",
      _QS: [], _QT: [],
    };
    if (div > 1 && pos >= 2 && pos <= 5 && !isP(s.info)) {
      r.quaseSubida++; r._QS.push(`${s.season_year} (Div ${div}, ${pos}º)`);
    }
    if (div === 1 && pos >= 1 && pos <= 2 && !isC(s.info)) {
      r.quaseTitulo++; r._QT.push(`${s.season_year} (${pos}º)`);
    }
    map.set(s.club_name, r);
  }
  return [...map.values()]
    .map((r) => ({ ...r, total: r.quaseSubida + r.quaseTitulo, tipQS: r._QS.join(", "), tipQT: r._QT.join(", ") }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function computeCoachChampions(standings: StandingRow[], coaches: CoachRow[]): ChampRow[] {
  const idx = coachIndex(coaches);
  const map = new Map<string, ChampRow & { _C: string[]; _P: string[]; _D: string[] }>();
  for (const s of slStandings(standings)) {
    const tr = idx.get(`${s.season_year}|${s.club_name}`);
    if (!tr) continue;
    const r = map.get(tr.name) ?? {
      name: tr.name, nac: tr.nac, c: 0, p: 0, d: 0, total: 0, tipC: "", tipP: "", tipD: "",
      _C: [], _P: [], _D: [],
    };
    if (tr.nac) r.nac = tr.nac;
    const posTag = s.position ? `, ${s.position}º` : "";
    if (isC(s.info)) { r.c++; r._C.push(`${s.club_name} — ${s.season_year} (Div ${s.division_num ?? "?"}${posTag})`); }
    if (isP(s.info)) { r.p++; r._P.push(`${s.club_name} — ${s.season_year} (Div ${s.division_num ?? "?"}${posTag})`); }
    if (isD(s.info)) { r.d++; r._D.push(`${s.club_name} — ${s.season_year} (Div ${s.division_num ?? "?"}${posTag})`); }
    map.set(tr.name, r);
  }
  return [...map.values()]
    .map((r) => ({ ...r, total: r.c * 3 + r.p, tipC: r._C.join(", "), tipP: r._P.join(", "), tipD: r._D.join(", ") }))
    .filter((r) => r.c + r.p + r.d > 0)
    .sort((a, b) => b.total - a.total);
}

export function computeCoachPlayoffs(standings: StandingRow[], coaches: CoachRow[]): PlayoffRow[] {
  const idx = coachIndex(coaches);
  const map = new Map<string, PlayoffRow & { _QS: string[]; _QT: string[] }>();
  for (const s of slStandings(standings)) {
    const tr = idx.get(`${s.season_year}|${s.club_name}`);
    if (!tr) continue;
    const div = s.division_num ?? 0;
    const pos = s.position ?? 0;
    const r = map.get(tr.name) ?? {
      name: tr.name, nac: tr.nac, quaseSubida: 0, quaseTitulo: 0, total: 0, tipQS: "", tipQT: "",
      _QS: [], _QT: [],
    };
    if (tr.nac) r.nac = tr.nac;
    if (div > 1 && pos >= 2 && pos <= 5 && !isP(s.info)) {
      r.quaseSubida++; r._QS.push(`${s.club_name} — ${s.season_year} (Div ${div}, ${pos}º)`);
    }
    if (div === 1 && pos >= 1 && pos <= 2 && !isC(s.info)) {
      r.quaseTitulo++; r._QT.push(`${s.club_name} — ${s.season_year} (${pos}º)`);
    }
    map.set(tr.name, r);
  }
  return [...map.values()]
    .map((r) => ({ ...r, total: r.quaseSubida + r.quaseTitulo, tipQS: r._QS.join(", "), tipQT: r._QT.join(", ") }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}
