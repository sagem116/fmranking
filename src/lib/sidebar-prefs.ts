import { useEffect, useState, useCallback } from "react";

export interface SidebarPrefs {
  // group title -> { hidden, collapsed, order(item.to[]), hiddenItems(item.to[]) }
  groups: Record<
    string,
    {
      hidden?: boolean;
      collapsed?: boolean;
      order?: string[];
      hiddenItems?: string[];
    }
  >;
  groupOrder?: string[];
  debugHidden?: boolean;
  debugItemsHidden?: string[];
  debugItemsOrder?: string[];
}

const STORAGE_KEY = "fm-sidebar-prefs-v1";

export const DEFAULT_PREFS: SidebarPrefs = { groups: {} };

export function loadPrefs(): SidebarPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: SidebarPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    window.dispatchEvent(new CustomEvent("fm-sidebar-prefs"));
  } catch {}
}

export function useSidebarPrefs(): [SidebarPrefs, (p: SidebarPrefs) => void] {
  const [prefs, setPrefs] = useState<SidebarPrefs>(() => loadPrefs());
  useEffect(() => {
    const h = () => setPrefs(loadPrefs());
    window.addEventListener("fm-sidebar-prefs", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("fm-sidebar-prefs", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  const update = useCallback((p: SidebarPrefs) => {
    setPrefs(p);
    savePrefs(p);
  }, []);
  return [prefs, update];
}

export function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}
