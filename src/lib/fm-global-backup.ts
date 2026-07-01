// Global JSON backup of everything the user can edit client-side.
// Includes: weight-suggestion formulas, sidebar prefs, desafios overrides,
// highlights notifications, country/continent debug overrides, and theme.

// Buckets of editable configuration. Buckets exist for future-proofing
// (a future version can rename/migrate by bucket without losing data).
const BUCKETS: Record<string, readonly string[]> = {
  weights: [
    "fm-sugestao-pesos-formulas",
    "fm-sugestao-pesos-active",
  ],
  ui: [
    "fm-sidebar-prefs-v1",
    "fm-theme",
    "fm:rankings-ui-version",
  ],
  desafios: [
    "fm-desafios-v2",
    "fm-highlights-v1",
  ],
  geo: [
    "fm.country.continentOverrides.v1",
    "fm.country.aliasOverrides.v1",
  ],
  reputation: [
    "fm-club-reputation-v1",
    "fm-club-name-aliases-v1",
    "fm-club-reputation-imports-v1",
  ],
  clubMap: [
    "fm-club-name-aliases-v2",
    "fm-club-manual-map-v1",
  ],
  custom: [
    "fm-custom-formulas-v1",
    "fm-custom-rankings-v1",
    "fm-saved-filters-v1",
  ],
  insights: [
    "fm-insights-snapshots-v1",
  ],
};
const KEYS: readonly string[] = Object.values(BUCKETS).flat();

export interface GlobalBackup {
  version: 2;
  exportedAt: string;
  app: "fm-world-rankings";
  /** Flat data map (compatibility with v1 importers). */
  data: Record<string, unknown>;
  /** Bucketed view for future migrations. */
  buckets: Record<string, Record<string, unknown>>;
}

export function buildBackup(): GlobalBackup {
  const data: Record<string, unknown> = {};
  const buckets: Record<string, Record<string, unknown>> = {};
  if (typeof window === "undefined") {
    return { version: 2, exportedAt: new Date().toISOString(), app: "fm-world-rankings", data, buckets };
  }
  for (const [bucket, keys] of Object.entries(BUCKETS)) {
    const bucketData: Record<string, unknown> = {};
    for (const k of keys) {
      const raw = window.localStorage.getItem(k);
      if (raw == null) continue;
      let value: unknown;
      try { value = JSON.parse(raw); } catch { value = raw; }
      data[k] = value;
      bucketData[k] = value;
    }
    if (Object.keys(bucketData).length) buckets[bucket] = bucketData;
  }
  return { version: 2, exportedAt: new Date().toISOString(), app: "fm-world-rankings", data, buckets };
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
  const obj = payload as {
    data?: Record<string, unknown>;
    buckets?: Record<string, Record<string, unknown>>;
  } & Record<string, unknown>;
  // Prefer bucketed payload (v2), fall back to flat data (v1), or a bare map.
  let data: Record<string, unknown> = {};
  if (obj.buckets && typeof obj.buckets === "object") {
    for (const bucket of Object.values(obj.buckets)) {
      if (bucket && typeof bucket === "object") Object.assign(data, bucket);
    }
  } else if (obj.data && typeof obj.data === "object") {
    data = obj.data;
  } else {
    data = obj as Record<string, unknown>;
  }
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