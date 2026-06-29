// Client-side overrides for country→continent and country aliases (abbr↔name).
// Stored in localStorage so users can manage the mapping from debug pages
// without a database migration.

const CONTINENT_KEY = "fm.country.continentOverrides.v1";
const ALIAS_KEY = "fm.country.aliasOverrides.v1";

type Dict = Record<string, string>;

function readDict(key: string): Dict {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Dict;
  } catch {
    /* ignore */
  }
  return {};
}

function writeDict(key: string, dict: Dict) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(dict));
    window.dispatchEvent(new CustomEvent("fm:country-overrides-changed"));
  } catch {
    /* ignore */
  }
}

export function getContinentOverrides(): Dict {
  return readDict(CONTINENT_KEY);
}

export function setContinentOverride(country: string, continent: string) {
  const d = readDict(CONTINENT_KEY);
  d[country.trim().toLowerCase()] = continent;
  writeDict(CONTINENT_KEY, d);
}

export function removeContinentOverride(country: string) {
  const d = readDict(CONTINENT_KEY);
  delete d[country.trim().toLowerCase()];
  writeDict(CONTINENT_KEY, d);
}

export function getAliasOverrides(): Dict {
  return readDict(ALIAS_KEY);
}

export function setAliasOverride(alias: string, canonical: string) {
  const d = readDict(ALIAS_KEY);
  d[alias.trim().toLowerCase()] = canonical;
  writeDict(ALIAS_KEY, d);
}

export function removeAliasOverride(alias: string) {
  const d = readDict(ALIAS_KEY);
  delete d[alias.trim().toLowerCase()];
  writeDict(ALIAS_KEY, d);
}

export function onOverridesChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const h = () => cb();
  window.addEventListener("fm:country-overrides-changed", h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener("fm:country-overrides-changed", h);
    window.removeEventListener("storage", h);
  };
}