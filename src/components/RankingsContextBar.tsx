import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface ContextChip {
  key: string;
  label: string;
  onClear?: () => void;
  tone?: "default" | "primary" | "muted";
}

/** Shows active filters / mode / scope as chips with optional clear actions. */
export function RankingsContextBar({
  chips,
  onClearAll,
}: {
  chips: ContextChip[];
  onClearAll?: () => void;
}) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Contexto:</span>
      {chips.map((c) => (
        <Badge
          key={c.key}
          variant={c.tone === "primary" ? "default" : c.tone === "muted" ? "outline" : "secondary"}
          className="gap-1 font-normal"
        >
          <span>{c.label}</span>
          {c.onClear && (
            <button
              type="button"
              onClick={c.onClear}
              className="ml-0.5 opacity-70 hover:opacity-100"
              aria-label={`Remover ${c.label}`}
            >
              <X className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      {onClearAll && chips.some((c) => c.onClear) && (
        <Button size="sm" variant="ghost" className="h-6 px-2 ml-auto text-xs" onClick={onClearAll}>
          Limpar tudo
        </Button>
      )}
    </div>
  );
}