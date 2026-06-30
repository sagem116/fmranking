import { useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { varsForEntity, type EntityKind } from "@/lib/fm-entity-vars";
import { validateFormula, FUNCTION_NAMES } from "@/lib/fm-formula-parser";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  entity: EntityKind;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
}

export function FormulaEditor({ entity, value, onChange, rows = 3 }: Props) {
  const vars = varsForEntity(entity);
  const validation = useMemo(
    () => validateFormula(value, vars.map((v) => v.key)),
    [value, vars],
  );
  return (
    <div className="space-y-2">
      <Textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ex.: (CA * 0.4) + (VP * 0.3) + ((100 - IDADE) * 0.1)"
        className="font-mono text-sm"
      />
      <div className={cn(
        "flex items-center gap-2 text-xs",
        validation.ok ? "text-emerald-500" : "text-amber-500",
      )}>
        {validation.ok ? <CheckCircle2 className="size-3" /> : <AlertCircle className="size-3" />}
        <span>{validation.ok ? "Fórmula válida" : validation.error}</span>
        {validation.ok && validation.variables.length > 0 && (
          <span className="text-muted-foreground">· usa {validation.variables.join(", ")}</span>
        )}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Variáveis e funções disponíveis</summary>
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {vars.map((v) => (
              <button
                type="button"
                key={v.key}
                onClick={() => onChange(`${value}${value && !value.endsWith(" ") ? " " : ""}${v.key}`)}
                title={v.label}
              >
                <Badge variant="outline" className="hover:bg-primary/10 cursor-pointer">{v.key}</Badge>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
            <span className="text-muted-foreground mr-1">Funções:</span>
            {FUNCTION_NAMES.map((f) => (
              <Badge key={f} variant="secondary" className="font-mono">{f}()</Badge>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}