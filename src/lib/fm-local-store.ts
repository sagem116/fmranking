// Small reactive localStorage store. Sync across tabs and within the same tab.
import { useEffect, useState, useCallback } from "react";

const EVENT = "fm-local-store-changed";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { key } }));
  } catch {
    /* ignore quota */
  }
}

export function getLocal<T>(key: string, fallback: T): T {
  return read(key, fallback);
}

export function setLocal<T>(key: string, value: T) {
  write(key, value);
}

export function useLocal<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => read(key, fallback));
  useEffect(() => {
    const h = (e: Event) => {
      const ce = e as CustomEvent<{ key: string }>;
      if (!ce.detail || ce.detail.key === key) setState(read(key, fallback));
    };
    const sh = (e: StorageEvent) => { if (e.key === key) setState(read(key, fallback)); };
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", sh);
    return () => { window.removeEventListener(EVENT, h); window.removeEventListener("storage", sh); };
  }, [key, fallback]);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        write(key, value);
        return value;
      });
    },
    [key],
  );
  return [state, set];
}