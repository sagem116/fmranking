import { fetchAllData } from "./fm-db";
import { fetchActiveConfig } from "./fm-config-db";
import { computeRankings, computeInternationalRankings } from "./fm-rankings";
import { buildDesafioIndex, evaluateDesafios, loadDesafios, type DesafioResult } from "./fm-desafios";

export type HighlightKind = "challenge" | "points-record" | "unbeaten" | "bonus-achievement";

export interface Highlight {
  kind: HighlightKind;
  title: string;
  detail: string;
  year: number;
  entity?: string;
  subject?: "clubs" | "coaches" | "countries";
  competition?: string;
  bonus?: number;
}

export interface HighlightBatch {
  importedAt: string; // ISO
  importedYears: number[];
  highlights: Highlight[];
}

export const HIGHLIGHTS_STORAGE_KEY = "fm-highlights-v1";
const MAX_BATCHES = 20;

export function loadHighlightBatches(): HighlightBatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HIGHLIGHTS_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHighlightBatches(batches: HighlightBatch[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      HIGHLIGHTS_STORAGE_KEY,
      JSON.stringify(batches.slice(0, MAX_BATCHES)),
    );
  } catch {}
}

export function pushHighlightBatch(batch: HighlightBatch) {
  const list = loadHighlightBatches();
  list.unshift(batch);
  saveHighlightBatches(list);
}

export function clearHighlights() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(HIGHLIGHTS_STORAGE_KEY); } catch {}
}

/**
 * Compute highlights for the freshly imported seasons by recomputing rankings
 * from scratch and surfacing items where the year matches one of `years`.
 *
 * - Challenges newly fulfilled in that year (entity has a match whose years
 *   include the imported year — best-effort "new" detection since we don't
 *   keep prior snapshots, but every reported entry references the new year).
 * - Points records broken in that year.
 * - Unbeaten seasons in that year.
 * - Bonus achievements (Dobradinha/Triplete/Quadruple) in that year.
 */
export async function computeHighlightsForYears(years: number[]): Promise<Highlight[]> {
  if (!years.length) return [];
  const [data, cfg] = await Promise.all([fetchAllData(), fetchActiveConfig()]);
  const baseRanks = computeRankings(
    {
      standings: data.standings,
      continental: data.continental,
      coaches: data.coaches,
      clubCountry: data.clubCountry,
    },
    cfg.config,
  );
  const intl = computeInternationalRankings(data.international ?? [], cfg.config);
  const ranks = {
    ...baseRanks,
    countries: [...baseRanks.countries, ...intl.countries],
    coaches: [...baseRanks.coaches, ...intl.coaches],
    evolution: baseRanks.evolution,
    breakdown: baseRanks.breakdown,
    years: [...new Set([...baseRanks.years, ...intl.years])].sort((a, b) => a - b),
    bonusAchievements: baseRanks.bonusAchievements,
  };
  const desafios = loadDesafios();
  const results: DesafioResult[] = evaluateDesafios(data, ranks, desafios);
  const idx = buildDesafioIndex(data, ranks);
  const yearSet = new Set(years);
  const out: Highlight[] = [];

  // Unbeaten in this year
  for (const r of idx.unbeaten) {
    if (!yearSet.has(r.year)) continue;
    out.push({
      kind: "unbeaten",
      title: `Invencibilidade — ${r.club}`,
      detail: `${r.league} · ${r.points} pts · 0D / ${r.played}J`,
      year: r.year,
      entity: r.club,
      subject: "clubs",
      competition: r.league,
    });
  }
  // Points records in this year
  for (const r of idx.pointsRecords) {
    if (!yearSet.has(r.year)) continue;
    out.push({
      kind: "points-record",
      title: `Recorde de pontos — ${r.club}`,
      detail: `${r.league} · ${r.points} pts (novo recorde)`,
      year: r.year,
      entity: r.club,
      subject: "clubs",
      competition: r.league,
    });
  }
  // Bonus achievements in this year
  for (const a of ranks.bonusAchievements ?? []) {
    if (!yearSet.has(a.season)) continue;
    const typeLabel =
      a.type === "dobradinha" ? "Dobradinha"
      : a.type === "dobradinha-int" ? "Dobradinha Internacional"
      : a.type === "triplete" ? "Triplete"
      : "Quadruple";
    out.push({
      kind: "bonus-achievement",
      title: `${typeLabel} — ${a.club}`,
      detail: `${a.competitions.join(" + ")} · +${a.bonus} pts`,
      year: a.season,
      entity: a.club,
      subject: "clubs",
      bonus: a.bonus,
    });
  }
  // Challenges fulfilled with a match year in the imported years
  for (const { desafio, matches } of results) {
    for (const m of matches) {
      const hit = m.years.find((y) => yearSet.has(y));
      if (hit == null) continue;
      out.push({
        kind: "challenge",
        title: `Desafio cumprido — ${desafio.name}`,
        detail: `${m.entity} (${m.subject === "clubs" ? "Clube" : m.subject === "coaches" ? "Treinador" : "País"}) · +${desafio.bonus} pts`,
        year: hit,
        entity: m.entity,
        subject: m.subject,
        bonus: desafio.bonus,
      });
    }
  }
  // Sort: bonus achievements, challenges, then records/unbeaten — newest year first
  const order: Record<HighlightKind, number> = {
    "bonus-achievement": 0,
    "challenge": 1,
    "points-record": 2,
    "unbeaten": 3,
  };
  out.sort((a, b) => b.year - a.year || order[a.kind] - order[b.kind]);
  return out;
}
