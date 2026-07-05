import { useEffect, useState } from "react";

const KEY = "fm:rankings-ui-version";
export type UIVersion = "v1" | "v2";

function read(): UIVersion {
  if (typeof window === "undefined") return "v2";
  const v = window.localStorage.getItem(KEY);
  return v === "v1" ? "v1" : "v2";
}

/** Persisted UI version for the Rankings page (default v2 = Moderno). */
export function useRankingsUIVersion(): [UIVersion, (v: UIVersion) => void] {
  const [v, setV] = useState<UIVersion>("v2");
  useEffect(() => {
    setV(read());
  }, []);
  const set = (nv: UIVersion) => {
    setV(nv);
    try {
      window.localStorage.setItem(KEY, nv);
    } catch {
      /* ignore */
    }
  };
  return [v, set];
}

const DENSITY_KEY = "fm:rankings-density";
export type Density = "comfy" | "compact";

function readDensity(): Density {
  if (typeof window === "undefined") return "comfy";
  const v = window.localStorage.getItem(DENSITY_KEY);
  return v === "compact" ? "compact" : "comfy";
}

/** Persisted density preference shared by all SeasonsRankTable instances. */
export function useRankingsDensity(): [Density, (v: Density) => void] {
  const [v, setV] = useState<Density>("comfy");
  useEffect(() => {
    setV(readDensity());
    const onStorage = (e: StorageEvent) => {
      if (e.key === DENSITY_KEY) setV(readDensity());
    };
    window.addEventListener("storage", onStorage);
    const onCustom = () => setV(readDensity());
    window.addEventListener("fm:rankings-density-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("fm:rankings-density-changed", onCustom);
    };
  }, []);
  const set = (nv: Density) => {
    setV(nv);
    try {
      window.localStorage.setItem(DENSITY_KEY, nv);
      window.dispatchEvent(new Event("fm:rankings-density-changed"));
    } catch {
      /* ignore */
    }
  };
  return [v, set];
}
