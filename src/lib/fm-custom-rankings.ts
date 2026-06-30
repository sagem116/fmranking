import { getLocal, setLocal, useLocal } from "./fm-local-store";
import type { EntityKind } from "./fm-entity-vars";

export const CUSTOM_RANKINGS_KEY = "fm-custom-rankings-v1";

export type FilterOp = ">=" | "<=" | "=" | "!=" | "contains" | "in";

export interface CustomFilter {
  field: string;      // variable name OR meta (e.g. "PAIS", "CONTINENTE", "CLUBE", "COMPETICAO", "NAC")
  op: FilterOp;
  value: string;      // raw user-entered value; parsed by consumers
}

export interface CustomRanking {
  id: string;
  name: string;
  description?: string;
  entity: EntityKind;
  filters: CustomFilter[];
  orderBy: string;       // variable key, or "FORMULA:<formulaId>", or builtin meta
  orderDir: "asc" | "desc";
  limit?: number;        // 0/undefined = no limit
  createdAt: number;
  updatedAt: number;
}

export function listCustomRankings(): CustomRanking[] {
  return getLocal<CustomRanking[]>(CUSTOM_RANKINGS_KEY, []);
}

export function saveCustomRankings(items: CustomRanking[]) {
  setLocal(CUSTOM_RANKINGS_KEY, items);
}

export function upsertCustomRanking(r: CustomRanking) {
  const all = listCustomRankings();
  const idx = all.findIndex((x) => x.id === r.id);
  if (idx >= 0) all[idx] = r; else all.push(r);
  saveCustomRankings(all);
}

export function deleteCustomRanking(id: string) {
  saveCustomRankings(listCustomRankings().filter((r) => r.id !== id));
}

export function duplicateCustomRanking(id: string) {
  const r = listCustomRankings().find((x) => x.id === id);
  if (!r) return;
  upsertCustomRanking({
    ...r,
    id: newCustomRankingId(),
    name: `${r.name} (cópia)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export function newCustomRankingId() {
  return `cr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useCustomRankings() {
  return useLocal<CustomRanking[]>(CUSTOM_RANKINGS_KEY, []);
}

/** Evaluate a single filter against a row context (uppercase keys + meta string fields). */
export function applyFilter(
  ctx: Record<string, number | string | null | undefined>,
  f: CustomFilter,
): boolean {
  const raw = ctx[f.field.toUpperCase()] ?? ctx[f.field] ?? null;
  const valueStr = (f.value ?? "").trim();
  if (!valueStr && f.op !== "=" && f.op !== "!=") return true;
  const asNum = Number(valueStr);
  if (f.op === "contains") {
    return String(raw ?? "").toLowerCase().includes(valueStr.toLowerCase());
  }
  if (f.op === "in") {
    const list = valueStr.split(/[,;|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    return list.includes(String(raw ?? "").toLowerCase());
  }
  if (typeof raw === "number" && Number.isFinite(asNum)) {
    switch (f.op) {
      case ">=": return raw >= asNum;
      case "<=": return raw <= asNum;
      case "=":  return raw === asNum;
      case "!=": return raw !== asNum;
    }
  }
  const s = String(raw ?? "").toLowerCase();
  const v = valueStr.toLowerCase();
  switch (f.op) {
    case "=":  return s === v;
    case "!=": return s !== v;
    case ">=": return s >= v;
    case "<=": return s <= v;
  }
  return true;
}