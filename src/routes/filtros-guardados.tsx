import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Copy, Save, Filter as FilterIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ENTITY_LABEL, varsForEntity, type EntityKind } from "@/lib/fm-entity-vars";
import { useSavedFilters, upsertSavedFilter, deleteSavedFilter, duplicateSavedFilter, newSavedFilterId, type SavedFilter } from "@/lib/fm-saved-filters";
import type { CustomFilter, FilterOp } from "@/lib/fm-custom-rankings";
import { metaFieldsFor } from "@/lib/fm-entity-rows";

export const Route = createFileRoute("/filtros-guardados")({
  head: () => ({ meta: [{ title: "Filtros Guardados — FM World" }] }),
  component: FiltrosGuardadosPage,
});

const OPS: { value: FilterOp; label: string }[] = [
  { value: ">=", label: "≥" }, { value: "<=", label: "≤" },
  { value: "=", label: "=" }, { value: "!=", label: "≠" },
  { value: "contains", label: "contém" }, { value: "in", label: "em (lista)" },
];
const ENTITIES: EntityKind[] = ["jogador", "clube", "competicao", "pais", "treinador"];

function emptyFilter(): SavedFilter {
  return {
    id: newSavedFilterId(),
    name: "Novo filtro",
    entity: "jogador",
    filters: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function FiltrosGuardadosPage() {
  const [list] = useSavedFilters();
  const [draft, setDraft] = useState<SavedFilter | null>(null);

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) { toast.error("Indica um nome"); return; }
    upsertSavedFilter({ ...draft, updatedAt: Date.now() });
    toast.success(`"${draft.name}" guardado`);
    setDraft(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><FilterIcon className="size-6 text-primary" /> Filtros Guardados</h1>
          <p className="text-sm text-muted-foreground">Guarda combinações de filtros para reutilizar nos teus rankings.</p>
        </div>
        <Button onClick={() => setDraft(emptyFilter())}><Plus className="size-4" /> Novo</Button>
      </header>

      {draft && <Editor draft={draft} setDraft={setDraft} onSave={save} />}

      <Card>
        <CardHeader><CardTitle className="text-base">Filtros guardados</CardTitle></CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não criaste nenhum filtro.</p>
          ) : (
            <div className="divide-y divide-border">
              {list.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{f.name}</span>
                      <Badge variant="outline">{ENTITY_LABEL[f.entity]}</Badge>
                      <Badge variant="secondary">{f.filters.length} regra(s)</Badge>
                    </div>
                    {f.description && <p className="text-xs text-muted-foreground mt-1">{f.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {f.filters.map((x) => `${x.field} ${x.op} ${x.value || "∅"}`).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setDraft({ ...f })}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { duplicateSavedFilter(f.id); toast.success("Duplicado"); }}><Copy className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Eliminar "${f.name}"?`)) { deleteSavedFilter(f.id); toast.success("Eliminado"); } }}><Trash2 className="size-4 text-destructive" /></Button>
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

function Editor({ draft, setDraft, onSave }: { draft: SavedFilter; setDraft: (f: SavedFilter | null) => void; onSave: () => void }) {
  const vars = varsForEntity(draft.entity);
  const metaFields = metaFieldsFor(draft.entity);
  const fields = [
    ...metaFields.map((m) => ({ key: m.key, label: m.label })),
    ...vars.map((v) => ({ key: v.key, label: v.label })),
  ];

  const addFilter = () =>
    setDraft({ ...draft, filters: [...draft.filters, { field: fields[0]?.key ?? "", op: ">=", value: "" }] });
  const updFilter = (i: number, patch: Partial<CustomFilter>) =>
    setDraft({ ...draft, filters: draft.filters.map((f, idx) => idx === i ? { ...f, ...patch } : f) });
  const removeFilter = (i: number) =>
    setDraft({ ...draft, filters: draft.filters.filter((_, idx) => idx !== i) });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Configurar filtro</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <Label>Entidade</Label>
            <Select value={draft.entity} onValueChange={(v) => setDraft({ ...draft, entity: v as EntityKind, filters: [] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ENTITIES.map((e) => <SelectItem key={e} value={e}>{ENTITY_LABEL[e]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Regras</Label>
            <Button size="sm" variant="outline" onClick={addFilter}><Plus className="size-4" /> Adicionar</Button>
          </div>
          {draft.filters.map((f, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <Select value={f.field} onValueChange={(v) => updFilter(i, { field: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{fields.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Select value={f.op} onValueChange={(v) => updFilter(i, { op: v as FilterOp })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OPS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-4">
                <Input value={f.value} onChange={(e) => updFilter(i, { value: e.target.value })} placeholder="valor" />
              </div>
              <Button size="icon" variant="ghost" className="col-span-1" onClick={() => removeFilter(i)}><X className="size-4" /></Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onSave}><Save className="size-4" /> Guardar</Button>
          <Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}