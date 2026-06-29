// Number formatting helpers (pt-PT) with decimal support.
export function fmtPts(v: number | null | undefined, maxFractionDigits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(v).toLocaleString("pt-PT", { maximumFractionDigits: maxFractionDigits });
}

export function fmtNum(v: number | null | undefined, maxFractionDigits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(v).toLocaleString("pt-PT", { maximumFractionDigits: maxFractionDigits });
}

// Currency formatter (euros, pt-PT thousands separator)
export function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(Math.round(v)).toLocaleString("pt-PT", { maximumFractionDigits: 0 }) + " €";
}
