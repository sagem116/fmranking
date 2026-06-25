// Number formatting helpers (pt-PT) with decimal support.
export function fmtPts(v: number | null | undefined, maxFractionDigits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(v).toLocaleString("pt-PT", { maximumFractionDigits: maxFractionDigits });
}
