import { useMemo, useState } from "react";
import { ArrowDown, ChevronsUpDown } from "lucide-react";
import type { RankingEntry } from "@/lib/fm-rankings";

export type SortKey = "points" | "titles" | `extra:${string}` | `year:${number}`;
export type SortDir = "asc" | "desc";

export function useEntrySort(
  entries: RankingEntry[],
  mode: "weighted" | "raw",
  extras?: Record<string, Record<string, number>>,
  evolution?: Record<string, Record<number, number>>,
) {
  const [sortKey, setSortKeyRaw] = useState<SortKey>("points");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const setSortKey = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKeyRaw(k);
      setSortDir("desc");
    }
  };
  const sorted = useMemo(() => {
    const arr = [...entries];
    const sign = sortDir === "asc" ? -1 : 1;
    const pts = (e: RankingEntry) => (mode === "raw" ? e.raw : e.weighted);
    arr.sort((a, b) => {
      if (sortKey === "titles") {
        if (b.titles !== a.titles) return (b.titles - a.titles) * sign;
        return (pts(b) - pts(a)) * sign;
      }
      if (typeof sortKey === "string" && sortKey.startsWith("extra:") && extras) {
        const k = sortKey.slice(6);
        const map = extras[k] ?? {};
        const va = map[a.name] ?? 0;
        const vb = map[b.name] ?? 0;
        if (vb !== va) return (vb - va) * sign;
        return (pts(b) - pts(a)) * sign;
      }
      if (typeof sortKey === "string" && sortKey.startsWith("year:") && evolution) {
        const y = Number(sortKey.slice(5));
        const va = evolution[a.name]?.[y] ?? 0;
        const vb = evolution[b.name]?.[y] ?? 0;
        if (vb !== va) return (vb - va) * sign;
        return (pts(b) - pts(a)) * sign;
      }
      return (pts(b) - pts(a)) * sign;
    });
    return arr;
  }, [entries, sortKey, sortDir, mode, extras, evolution]);
  return { sorted, sortKey, setSortKey, sortDir };
}

export function SortableTh({
  label,
  active,
  dir = "desc",
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  dir?: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`p-3 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
      >
        {label}
        {active ? (
          <ArrowDown className={`size-3 transition-transform ${dir === "asc" ? "rotate-180" : ""}`} />
        ) : (
          <ChevronsUpDown className="size-3 opacity-50" />
        )}
      </button>
    </th>
  );
}
