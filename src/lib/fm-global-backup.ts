// Global JSON backup of everything the user can edit client-side.
// Includes: weight-suggestion formulas, sidebar prefs, desafios overrides,
// highlights notifications, country/continent debug overrides, and theme.

const KEYS = [
  "fm-sugestao-pesos-formulas",
  "fm-sugestao-pesos-active",
  "fm-sidebar-prefs-v1",
  "fm-desafios-v2",
  "fm-highlights-v1",
  "fm.country.continentOverrides.v1",
  "fm.country.aliasOverrides.v1",
  "fm-theme",
  "fm-club-reputation-v1",
  "fm-club-name-aliases-v1",
] as const;

export interface GlobalBackup {
  version: 1;
  exportedAt: string;
  app: "fm-world-rankings";
  data: Record<string, unknown>;
}

export function buildBackup(): GlobalBackup {
  const data: Record<string, unknown> = {};
  if (typeof window === "undefined") {
    return { version: 1, exportedAt: new Date().toISOString(), app: "fm-world-rankings", data };
  }
  for (const k of KEYS) {
    const raw = window.localStorage.getItem(k);
    if (raw == null) continue;
    // Try JSON, fall back to raw string for primitives (e.g. theme).
    try {
      data[k] = JSON.parse(raw);
    } catch {
      data[k] = raw;
    }
  }
  return { version: 1, exportedAt: new Date().toISOString(), app: "fm-world-rankings", data };
}

export function downloadBackup(filename?: string) {
  const backup = buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = filename ?? `fm-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  applied: string[];
  skipped: string[];
}

export function applyBackup(payload: unknown): ImportResult {
  if (typeof window === "undefined") return { applied: [], skipped: [] };
  const result: ImportResult = { applied: [], skipped: [] };
  if (!payload || typeof payload !== "object") throw new Error("Ficheiro inválido");
  const obj = payload as { data?: Record<string, unknown> } & Record<string, unknown>;
  // Accept either { data: {...} } or a flat map of keys.
  const data: Record<string, unknown> =
    obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>) : obj;
  const allowed = new Set<string>(KEYS);
  for (const [k, v] of Object.entries(data)) {
    if (!allowed.has(k)) { result.skipped.push(k); continue; }
    try {
      const str = typeof v === "string" ? v : JSON.stringify(v);
      window.localStorage.setItem(k, str);
      result.applied.push(k);
    } catch {
      result.skipped.push(k);
    }
  }
  // Notify listeners (country overrides hook into this event).
  try {
    window.dispatchEvent(new CustomEvent("fm:country-overrides-changed"));
  } catch {
    /* ignore */
  }
  return result;
}

export async function importBackupFromFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  return applyBackup(parsed);
}

export const BACKUP_KEYS = KEYS;