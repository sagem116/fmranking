import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Copy, Save, FunctionSquare } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ENTITY_LABEL, type EntityKind } from "@/lib/fm-entity-vars";
import { useCustomFormulas, upsertFormula, deleteFormula, duplicateFormula, newFormulaId, type CustomFormula } from "@/lib/fm-custom-formulas";
import { validateFormula } from "@/lib/fm-formula-parser";
import { varsForEntity } from "@/lib/fm-entity-vars";
import { FormulaEditor } from "@/components/FormulaEditor";

export const Route = createFileRoute("/formulas-personalizadas")({
  head: () => ({ meta: [{ title: "Fórmulas Personalizadas — FM World" }] }),
  component: FormulasPage,
});

const ENTITIES: EntityKind[] = ["jogador", "clube", "competicao", "pais"];

function emptyFormula(): CustomFormula {
  return {
    id: newFormulaId(),
    name: "Nova métrica",
    entity: "jogador",
    expression: "",
    decimals: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function FormulasPage() {
  const [list] = useCustomFormulas();
  const [draft, setDraft] = useState<CustomFormula | null>(null);

  const startNew = () => setDraft(emptyFormula());
  const startEdit = (f: CustomFormula) => setDraft({ ...f });

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) { toast.error("Indica um nome"); return; }
    const v = validateFormula(draft.expression, varsForEntity(draft.entity).map((x) => x.key));
    if (!v.ok) { toast.error(`Fórmula inválida: ${v.error}`); return; }
    upsertFormula({ ...draft, updatedAt: Date.now() });
    toast.success(`Fórmula "${draft.name}" guardada`);
    setDraft(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><FunctionSquare className="size-6 text-primary" /> Fórmulas Personalizadas</h1>
          <p className="text-sm text-muted-foreground">Cria métricas próprias usando as variáveis disponíveis para cada entidade.</p>
        </div>
        <Button onClick={startNew}><Plus className="size-4" /> Nova fórmula</Button>
      </header>

      {draft && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{list.find((x) => x.id === draft.id) ? "Editar" : "Criar"} fórmula</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <Label>Entidade</Label>
                <Select value={draft.entity} onValueChange={(v) => setDraft({ ...draft, entity: v as EntityKind, expression: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITIES.map((e) => <SelectItem key={e} value={e}>{ENTITY_LABEL[e]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Casas decimais</Label>
                <Input type="number" min={0} max={6} value={draft.decimals} onChange={(e) => setDraft({ ...draft, decimals: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })} />
              </div>
            </div>
            <div>
              <Label>Fórmula</Label>
              <FormulaEditor entity={draft.entity} value={draft.expression} onChange={(v) => setDraft({ ...draft, expression: v })} />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={save}><Save className="size-4" /> Guardar</Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Fórmulas guardadas</CardTitle></CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não criaste nenhuma fórmula.</p>
          ) : (
            <div className="divide-y divide-border">
              {list.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{f.name}</span>
                      <Badge variant="outline">{ENTITY_LABEL[f.entity]}</Badge>
                      <Badge variant="secondary">{f.decimals}d</Badge>
                    </div>
                    <code className="text-xs text-muted-foreground break-all">{f.expression}</code>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => startEdit(f)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { duplicateFormula(f.id); toast.success("Duplicada"); }}><Copy className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Eliminar "${f.name}"?`)) { deleteFormula(f.id); toast.success("Eliminada"); } }}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}