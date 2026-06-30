// Builds per-entity row datasets (with uppercase variable contexts) from
// the player_stats source. Used by custom rankings, saved filters, etc.
import type { PlayerStatRow } from "./fm-player-stats-db";
import { continentOf } from "./fm-continents";
import { loadReputations, loadClubAliases, reputationFor } from "./fm-club-reputation";
import { loadCompetitionReputationsSync, repForCompetitionSync } from "./fm-competition-reputation";
import type { EntityKind } from "./fm-entity-vars";

export interface EntityRow {
  id: string;          // unique key per row
  name: string;
  link?: string;       // app path
  meta: Record<string, string | null>;   // text fields for filters (PAIS, NAC, CLUBE...)
  ctx: Record<string, number>;           // numeric variables (UPPERCASE)
}

const norm = (s: string | null | undefined) => String(s ?? "").trim();

export function buildPlayerRows(rows: PlayerStatRow[]): EntityRow[] {
  const aliases = loadClubAliases();
  const reps = loadReputations();
  return rows.map((r, i) => {
    const repClub = r.club ? reputationFor(r.club, aliases, reps) ?? 0 : 0;
    return {
      id: `${r.player_name}|${r.club ?? ""}|${r.competition}|${r.season_year}|${i}`,
      name: r.player_name,
      link: `/jogadores/${encodeURIComponent(r.player_name)}`,
      meta: {
        PAIS: r.country,
        NAC: r.nationality,
        CLUBE: r.club,
        COMPETICAO: r.competition,
        CONTINENTE: r.continent ?? continentOf(r.country ?? r.nationality ?? ""),
        COMP_TYPE: r.comp_type,
      },
      ctx: {
        GLS: r.gls, AST: r.ast, JOGOS: r.games, HDJ: r.hdj,
        CA: r.ca, CP: r.cp, RA: r.ra, RM: r.rm, RC: r.rc,
        IDADE: r.age, VP: r.vp, SALARIO: r.salary,
        REPUTACAO_CLUBE: repClub,
        ANO: r.season_year,
      },
    };
  });
}

export function buildClubRows(rows: PlayerStatRow[]): EntityRow[] {
  const aliases = loadClubAliases();
  const reps = loadReputations();
  const map = new Map<string, { name: string; country: string | null; comp: string | null; continent: string | null; n: number; vp: number; sal: number; ca: number; cp: number; age: number; comps: Set<string> }>();
  for (const r of rows) {
    const k = norm(r.club);
    if (!k) continue;
    let e = map.get(k);
    if (!e) { e = { name: r.club!, country: r.country, comp: r.competition, continent: r.continent ?? continentOf(r.country ?? ""), n: 0, vp: 0, sal: 0, ca: 0, cp: 0, age: 0, comps: new Set() }; map.set(k, e); }
    if (r.country) e.country = r.country;
    e.n++; e.vp += r.vp; e.sal += r.salary; e.ca += r.ca; e.cp += r.cp; e.age += r.age;
    e.comps.add(r.competition);
  }
  return [...map.values()].map((e, i) => ({
    id: `club-${i}-${e.name}`,
    name: e.name,
    link: `/clubes/${encodeURIComponent(e.name)}`,
    meta: { PAIS: e.country, COMPETICAO: e.comp, CONTINENTE: e.continent, CLUBE: e.name },
    ctx: {
      N_JOGADORES: e.n,
      VP_TOTAL: e.vp, SALARIO_TOTAL: e.sal,
      CA_MEDIO: e.n ? e.ca / e.n : 0,
      CP_MEDIO: e.n ? e.cp / e.n : 0,
      IDADE_MEDIA: e.n ? e.age / e.n : 0,
      REPUTACAO: reputationFor(e.name, aliases, reps) ?? 0,
      PONTOS: 0, PONTOS_PONDERADOS: 0, TITULOS: 0, EPOCAS: 0,
    },
  }));
}

export function buildCompetitionRows(rows: PlayerStatRow[]): EntityRow[] {
  const compReps = loadCompetitionReputationsSync();
  const aliases = loadClubAliases();
  const reps = loadReputations();
  const map = new Map<string, { name: string; country: string | null; continent: string | null; comp_type: string; n: number; vp: number; sal: number; ca: number; cp: number; ra: number; rm: number; rc: number; age: number; clubReps: number[] }>();
  for (const r of rows) {
    const k = `${r.comp_type}|${r.competition}`;
    let e = map.get(k);
    if (!e) { e = { name: r.competition, country: r.country, continent: r.continent ?? continentOf(r.country ?? ""), comp_type: r.comp_type, n: 0, vp: 0, sal: 0, ca: 0, cp: 0, ra: 0, rm: 0, rc: 0, age: 0, clubReps: [] }; map.set(k, e); }
    e.n++; e.vp += r.vp; e.sal += r.salary; e.ca += r.ca; e.cp += r.cp;
    e.ra += r.ra; e.rm += r.rm; e.rc += r.rc; e.age += r.age;
    if (r.club) {
      const v = reputationFor(r.club, aliases, reps);
      if (typeof v === "number") e.clubReps.push(v);
    }
  }
  return [...map.values()].map((e, i) => {
    const avgRep = e.clubReps.length ? e.clubReps.reduce((a, b) => a + b, 0) / e.clubReps.length : 0;
    return {
      id: `comp-${i}-${e.name}`,
      name: e.name,
      link: `/competicoes/${encodeURIComponent(e.name)}`,
      meta: { PAIS: e.country, CONTINENTE: e.continent, COMPETICAO: e.name, COMP_TYPE: e.comp_type },
      ctx: {
        N_JOGADORES: e.n,
        VP_TOTAL: e.vp, SALARIO_TOTAL: e.sal,
        VP_MEDIO: e.n ? e.vp / e.n : 0,
        SALARIO_MEDIO: e.n ? e.sal / e.n : 0,
        CA_MEDIO: e.n ? e.ca / e.n : 0,
        CP_MEDIO: e.n ? e.cp / e.n : 0,
        RA_MEDIO: e.n ? e.ra / e.n : 0,
        RM_MEDIO: e.n ? e.rm / e.n : 0,
        RC_MEDIO: e.n ? e.rc / e.n : 0,
        IDADE_MEDIA: e.n ? e.age / e.n : 0,
        REPUTACAO_MEDIA: avgRep,
        REPUTACAO_MANUAL: repForCompetitionSync(e.name, compReps),
      },
    };
  });
}

export function buildCountryRows(rows: PlayerStatRow[]): EntityRow[] {
  const map = new Map<string, { name: string; continent: string | null; n: number; vp: number; sal: number; clubs: Set<string> }>();
  for (const r of rows) {
    const k = r.nationality;
    if (!k) continue;
    let e = map.get(k);
    if (!e) { e = { name: k, continent: continentOf(k), n: 0, vp: 0, sal: 0, clubs: new Set() }; map.set(k, e); }
    e.n++; e.vp += r.vp; e.sal += r.salary;
    if (r.club) e.clubs.add(r.club);
  }
  return [...map.values()].map((e, i) => ({
    id: `cty-${i}-${e.name}`,
    name: e.name,
    link: `/paises/${encodeURIComponent(e.name)}`,
    meta: { PAIS: e.name, NAC: e.name, CONTINENTE: e.continent },
    ctx: {
      N_JOGADORES: e.n, N_CLUBES: e.clubs.size,
      VP_TOTAL: e.vp, SALARIO_TOTAL: e.sal,
      PONTOS: 0, PONTOS_PONDERADOS: 0, TITULOS: 0, FINAIS: 0, MEIAS: 0, QUARTOS: 0,
    },
  }));
}

export function buildRows(kind: EntityKind, rows: PlayerStatRow[]): EntityRow[] {
  switch (kind) {
    case "jogador": return buildPlayerRows(rows);
    case "clube": return buildClubRows(rows);
    case "competicao": return buildCompetitionRows(rows);
    case "pais": return buildCountryRows(rows);
  }
}

/** Meta filter fields available per entity (for the filter UI). */
export function metaFieldsFor(kind: EntityKind): { key: string; label: string }[] {
  if (kind === "jogador") return [
    { key: "NAC", label: "Nacionalidade" }, { key: "PAIS", label: "País" },
    { key: "CLUBE", label: "Clube" }, { key: "COMPETICAO", label: "Competição" },
    { key: "CONTINENTE", label: "Continente" }, { key: "COMP_TYPE", label: "Tipo Competição" },
  ];
  if (kind === "clube") return [
    { key: "PAIS", label: "País" }, { key: "COMPETICAO", label: "Competição" },
    { key: "CONTINENTE", label: "Continente" }, { key: "CLUBE", label: "Nome" },
  ];
  if (kind === "competicao") return [
    { key: "PAIS", label: "País" }, { key: "CONTINENTE", label: "Continente" },
    { key: "COMP_TYPE", label: "Tipo" }, { key: "COMPETICAO", label: "Nome" },
  ];
  return [{ key: "CONTINENTE", label: "Continente" }, { key: "PAIS", label: "País" }];
}