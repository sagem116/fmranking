// Default scoring configuration (fully editable later in Fase 4 / Configuração).

const BASE_POSITION_POINTS: Record<number, number> = {
  1: 1000, 2: 800, 3: 650, 4: 500, 5: 400,
  6: 320, 7: 260, 8: 210, 9: 170, 10: 140,
  11: 115, 12: 95, 13: 78, 14: 64, 15: 52,
  16: 42, 17: 34, 18: 27, 19: 21, 20: 16,
};

export const DEFAULT_POSITION_POINTS: Record<number, number> = (() => {
  const out: Record<number, number> = { ...BASE_POSITION_POINTS };
  for (let p = 21; p <= 100; p++) {
    out[p] = Math.max(1, Math.round(16 - (p - 20) * 0.18));
  }
  return out;
})();

export function positionPoints(pos: number | null | undefined): number {
  if (!pos || pos < 1) return 0;
  if (DEFAULT_POSITION_POINTS[pos] != null) return DEFAULT_POSITION_POINTS[pos];
  // tail: gentle decay for positions beyond the table
  return Math.max(2, Math.round(16 - (pos - 20) * 1.2));
}

export const DEFAULT_DIVISION_WEIGHTS: Record<number, number> = {
  1: 2.3,
  2: 1.55,
  3: 1.1,
  4: 0.87,
  5: 0.75,
  6: 0.58,
  7: 0.44,
  8: 0.32,
  9: 0.22,
  10: 0.14,
  11: 0.08,
};

export function divisionWeight(div: number | null | undefined): number {
  if (!div) return 1;
  return DEFAULT_DIVISION_WEIGHTS[div] ?? 1;
}

export const DEFAULT_COMPETITION_WEIGHTS = {
  national: 1.0,
  continental: 1.5,
  superleague: 2.0,
  international: 1.5,
} as const;

// Title weights keyed by normalised competition keyword.
export const DEFAULT_NATIONAL_LEAGUE_WEIGHTS: { match: string; label: string; weight: number }[] = [];

// Default weights for international (national-team) competitions.
// Empty by default — povoar via botão "Popular competições" em /configuracao,
// ou adicionando manualmente cada competição.
export const DEFAULT_INTERNATIONAL_WEIGHTS: { match: string; label: string; weight: number }[] = [];

// Default weights for continental club titles.
// Empty by default — povoar via botão "Popular competições" em /configuracao,
// ou adicionando manualmente cada competição.
export const DEFAULT_TITLE_WEIGHTS: { match: string; label: string; weight: number }[] = [];

export function continentalTitleWeight(competition: string): { label: string; weight: number } {
  const n = competition
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const t of DEFAULT_TITLE_WEIGHTS) {
    if (n.includes(t.match)) return { label: t.label, weight: t.weight };
  }
  return { label: competition, weight: 150 };
}

export const NATIONAL_CHAMPION_BONUS = 300;
export const SUPERLEAGUE_CHAMPION_BONUS = 400;
export const SUPERLEAGUE_PROMOTION_BONUS = 200;
export const DOBRADINHA_BONUS = 250;
export const DOBRADINHA_INT_BONUS = 350;
export const TRIPLETE_BONUS = 600;
export const QUADRUPLE_BONUS = 1000;