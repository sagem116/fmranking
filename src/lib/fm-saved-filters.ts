import { getLocal, setLocal, useLocal } from "./fm-local-store";
import type { EntityKind } from "./fm-entity-vars";
import type { CustomFilter } from "./fm-custom-rankings";

export const SAVED_FILTERS_KEY = "fm-saved-filters-v1";

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  entity: EntityKind;
  filters: CustomFilter[];
  createdAt: number;
  updatedAt: number;
}

export function listSavedFilters(): SavedFilter[] {
  return getLocal<SavedFilter[]>(SAVED_FILTERS_KEY, []);
}
export function saveSavedFilters(items: SavedFilter[]) {
  setLocal(SAVED_FILTERS_KEY, items);
}
export function upsertSavedFilter(f: SavedFilter) {
  const all = listSavedFilters();
  const idx = all.findIndex((x) => x.id === f.id);
  if (idx >= 0) all[idx] = f; else all.push(f);
  saveSavedFilters(all);
}
export function deleteSavedFilter(id: string) {
  saveSavedFilters(listSavedFilters().filter((f) => f.id !== id));
}
export function duplicateSavedFilter(id: string) {
  const f = listSavedFilters().find((x) => x.id === id);
  if (!f) return;
  upsertSavedFilter({
    ...f,
    id: newSavedFilterId(),
    name: `${f.name} (cópia)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}
export function newSavedFilterId() {
  return `sf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
export function useSavedFilters() {
  return useLocal<SavedFilter[]>(SAVED_FILTERS_KEY, []);
}