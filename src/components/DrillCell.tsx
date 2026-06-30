import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DrillColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
  value?: (row: T) => string | number | null | undefined;
}

interface Props<T> {
  label: ReactNode;
  title: string;
  rows: T[];
  columns: DrillColumn<T>[];
  emptyMessage?: string;
  className?: string;
}

/** A cell value that, when clicked, opens a dialog listing the underlying rows. */
export function DrillCell<T>({ label, title, rows, columns, emptyMessage, className }: Props<T>) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return <span className={className}>{label}</span>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 underline-offset-4 hover:underline hover:text-primary cursor-pointer",
          className,
        )}
        title="Ver detalhes"
      >
        {label}
        <Search className="size-3 opacity-50" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{title} <span className="text-xs text-muted-foreground">({rows.length})</span></DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">{emptyMessage ?? "Sem dados."}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b border-border">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.key} className={cn("px-3 py-2 text-xs uppercase text-muted-foreground", c.align === "right" ? "text-right" : "text-left")}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/40 hover:bg-muted/40">
                      {columns.map((c) => (
                        <td key={c.key} className={cn("px-3 py-1.5 tabular-nums", c.align === "right" ? "text-right" : "text-left")}>
                          {c.render ? c.render(row) : String(c.value?.(row) ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}