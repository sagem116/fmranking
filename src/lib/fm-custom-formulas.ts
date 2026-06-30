import { getLocal, setLocal, useLocal } from "./fm-local-store";
import type { EntityKind } from "./fm-entity-vars";
import { compileFormula, evalAst, type AstNode } from "./fm-formula-parser";

export const CUSTOM_FORMULAS_KEY = "fm-custom-formulas-v1";

export interface CustomFormula {
  id: string;
  name: string;
  entity: EntityKind;
  expression: string;
  decimals: number;
  createdAt: number;
  updatedAt: number;
}

export function listFormulas(): CustomFormula[] {
  return getLocal<CustomFormula[]>(CUSTOM_FORMULAS_KEY, []);
}

export function saveFormulas(items: CustomFormula[]) {
  setLocal(CUSTOM_FORMULAS_KEY, items);
}

export function upsertFormula(f: CustomFormula) {
  const all = listFormulas();
  const idx = all.findIndex((x) => x.id === f.id);
  if (idx >= 0) all[idx] = f;
  else all.push(f);
  saveFormulas(all);
}

export function deleteFormula(id: string) {
  saveFormulas(listFormulas().filter((f) => f.id !== id));
}

export function duplicateFormula(id: string) {
  const f = listFormulas().find((x) => x.id === id);
  if (!f) return;
  const copy: CustomFormula = {
    ...f,
    id: `cf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: `${f.name} (cópia)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  upsertFormula(copy);
}

export function newFormulaId() {
  return `cf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useCustomFormulas() {
  return useLocal<CustomFormula[]>(CUSTOM_FORMULAS_KEY, []);
}

// Compile cache so we don't reparse on every render/row.
const cache = new Map<string, AstNode>();
export function compileCached(src: string): AstNode {
  let ast = cache.get(src);
  if (!ast) { ast = compileFormula(src); cache.set(src, ast); }
  return ast;
}

export function evalFormula(src: string, ctx: Record<string, number>, decimals = 2): number {
  try {
    const ast = compileCached(src);
    const v = evalAst(ast, ctx);
    if (!Number.isFinite(v)) return 0;
    const f = 10 ** decimals;
    return Math.round(v * f) / f;
  } catch {
    return 0;
  }
}