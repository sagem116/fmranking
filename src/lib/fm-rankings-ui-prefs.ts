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