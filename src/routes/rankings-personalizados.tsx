import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Copy, Save, Trophy, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ENTITY_LABEL, varsForEntity, type EntityKind } from "@/lib/fm-entity-vars";
import { useCustomRankings, upsertCustomRanking, deleteCustomRanking, duplicateCustomRanking, newCustomRankingId, applyFilter, type CustomRanking, type CustomFilter, type FilterOp } from "@/lib/fm-custom-rankings";
import { useCustomFormulas } from "@/lib/fm-custom-formulas";
import { evalFormula } from "@/lib/fm-custom-formulas";
import { buildRows, buildCoachRowsFrom, metaFieldsFor } from "@/lib/fm-entity-rows";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { useRankings } from "@/lib/useRankings";
import { fmtNum } from "@/lib/fmt";

export const Route = createFileRoute("/rankings-personalizados")({
  head: () => ({ meta: [{ title: "Rankings Personalizados — FM World" }] }),
  component: RankingsPersonalizadosPage,
});

const ENTITIES: EntityKind[] = ["jogador", "clube", "competicao", "pais", "treinador"];
const OPS: { value: FilterOp; label: string }[] = [
  { value: ">=", label: "≥" }, { value: "<=", label: "≤" },
  { value: "=", label: "=" }, { value: "!=", label: "≠" },
  { value: "contains", label: "contém" }, { value: "in", label: "em (lista)" },
];

function emptyRanking(): CustomRanking {
  return {
    id: newCustomRankingId(),
    name: "Novo ranking",
    entity: "jogador",
    filters: [],
    orderBy: "GLS",
    orderDir: "desc",
    limit: 100,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function RankingsPersonalizadosPage() {
  const [list] = useCustomRankings();
  const [formulas] = useCustomFormulas();
  const [draft, setDraft] = useState<CustomRanking | null>(null);
  const [running, setRunning] = useState<CustomRanking | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Trophy className="size-6 text-primary" /> Rankings Personalizados</h1>
          <p className="text-sm text-muted-foreground">Cria os teus próprios rankings com filtros e ordenação personalizada.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/formulas-personalizadas"><Button variant="outline">Fórmulas</Button></Link>
          <Link to="/filtros-guardados"><Button variant="outline">Filtros Guardados</Button></Link>
          <Button onClick={() => setDraft(emptyRanking())}><Plus className="size-4" /> Novo</Button>
        </div>
      </header>

      {draft && (
        <RankingEditor
          draft={draft}
          formulasForEntity={formulas.filter((f) => f.entity === draft.entity)}
          onCancel={() => setDraft(null)}
          onSave={(r) => { upsertCustomRanking(r); toast.success(`"${r.name}" guardado`); setDraft(null); }}
        />
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Rankings guardados</CardTitle></CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não criaste nenhum ranking.</p>
          ) : (
            <div className="divide-y divide-border">
              {list.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.name}</span>
                      <Badge variant="outline">{ENTITY_LABEL[r.entity]}</Badge>
                      <Badge variant="secondary">Ord: {r.orderBy} {r.orderDir === "desc" ? "↓" : "↑"}</Badge>
                      {r.filters.length > 0 && <Badge variant="secondary">{r.filters.length} filtro(s)</Badge>}
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" onClick={() => setRunning(r)}>Ver</Button>
                    <Button size="sm" variant="outline" onClick={() => setDraft({ ...r })}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { duplicateCustomRanking(r.id); toast.success("Duplicado"); }}><Copy className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Eliminar "${r.name}"?`)) { deleteCustomRanking(r.id); toast.success("Eliminado"); } }}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {running && <RankingResults ranking={running} onClose={() => setRunning(null)} />}
    </div>
  );
}

function RankingEditor({
  draft, formulasForEntity, onCancel, onSave,
}: {
  draft: CustomRanking;
  formulasForEntity: { id: string; name: string }[];
  onCancel: () => void;
  onSave: (r: CustomRanking) => void;
}) {
  const [r, setR] = useState<CustomRanking>(draft);
  const vars = varsForEntity(r.entity);
  const metaFields = metaFieldsFor(r.entity);
  const filterFields = [
    ...metaFields.map((m) => ({ key: m.key, label: m.label })),
    ...vars.map((v) => ({ key: v.key, label: v.label })),
  ];
  const orderOptions: { value: string; label: string }[] = [
    ...vars.map((v) => ({ value: v.key, label: v.label })),
    ...formulasForEntity.map((f) => ({ value: `FORMULA:${f.id}`, label: `ƒ ${f.name}` })),
  ];

  const addFilter = () =>
    setR({ ...r, filters: [...r.filters, { field: filterFields[0]?.key ?? "", op: ">=", value: "" }] });
  const updFilter = (i: number, patch: Partial<CustomFilter>) =>
    setR({ ...r, filters: r.filters.map((f, idx) => idx === i ? { ...f, ...patch } : f) });
  const removeFilter = (i: number) =>
    setR({ ...r, filters: r.filters.filter((_, idx) => idx !== i) });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Configurar ranking</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
          </div>
          <div>
            <Label>Entidade</Label>
            <Select value={r.entity} onValueChange={(v) => setR({ ...r, entity: v as EntityKind, filters: [], orderBy: varsForEntity(v as EntityKind)[0]?.key ?? "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ENTITIES.map((e) => <SelectItem key={e} value={e}>{ENTITY_LABEL[e]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Limite (0 = todos)</Label>
            <Input type="number" min={0} value={r.limit ?? 0} onChange={(e) => setR({ ...r, limit: Math.max(0, Number(e.target.value) || 0) })} />
          </div>
        </div>
        <div>
          <Label>Descrição (opcional)</Label>
          <Input value={r.description ?? ""} onChange={(e) => setR({ ...r, description: e.target.value })} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Filtros</Label>
            <Button size="sm" variant="outline" onClick={addFilter}><Plus className="size-4" /> Adicionar</Button>
          </div>
          {r.filters.length === 0 && <p className="text-xs text-muted-foreground">Nenhum filtro — todas as entidades incluídas.</p>}
          {r.filters.map((f, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <Select value={f.field} onValueChange={(v) => updFilter(i, { field: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {filterFields.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}
                  </SelectContent>
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

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Ordenar por</Label>
            <Select value={r.orderBy} onValueChange={(v) => setR({ ...r, orderBy: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{orderOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Direção</Label>
            <Select value={r.orderDir} onValueChange={(v) => setR({ ...r, orderDir: v as "asc" | "desc" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Decrescente</SelectItem>
                <SelectItem value="asc">Crescente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => onSave({ ...r, updatedAt: Date.now() })}><Save className="size-4" /> Guardar</Button>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RankingResults({ ranking, onClose }: { ranking: CustomRanking; onClose: () => void }) {
  const { data, isLoading } = usePlayerStatsData();
  const { data: rankData } = useRankings();
  const [formulas] = useCustomFormulas();

  const rows = useMemo(() => {
    if (!data) return [];
    const all = ranking.entity === "treinador"
      ? buildCoachRowsFrom(rankData?.data.coaches ?? [], rankData?.ranks.coaches)
      : buildRows(ranking.entity, data.players);
    const filtered = all.filter((row) => {
      for (const f of ranking.filters) {
        const merged = { ...row.ctx, ...row.meta } as Record<string, number | string | null | undefined>;
        if (!applyFilter(merged, f)) return false;
      }
      return true;
    });
    const orderBy = ranking.orderBy;
    let getVal: (r: { ctx: Record<string, number> }) => number;
    if (orderBy.startsWith("FORMULA:")) {
      const fid = orderBy.slice("FORMULA:".length);
      const f = formulas.find((x) => x.id === fid);
      const expr = f?.expression ?? "0";
      const dec = f?.decimals ?? 2;
      getVal = (r) => evalFormula(expr, r.ctx, dec);
    } else {
      getVal = (r) => Number(r.ctx[orderBy] ?? 0);
    }
    const sign = ranking.orderDir === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => (getVal(a) - getVal(b)) * sign);
    const limited = ranking.limit && ranking.limit > 0 ? sorted.slice(0, ranking.limit) : sorted;
    return limited.map((r) => ({ ...r, _value: getVal(r) }));
  }, [data, ranking, formulas, rankData]);

  const orderLabel =
    ranking.orderBy.startsWith("FORMULA:")
      ? `ƒ ${formulas.find((x) => x.id === ranking.orderBy.slice(8))?.name ?? "—"}`
      : ranking.orderBy;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Resultado: {ranking.name}</CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose}><X className="size-4" /></Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> A carregar dados…</div>
        ) : (
          <div className="overflow-auto max-h-[60vh] border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left uppercase text-xs">#</th>
                  <th className="px-3 py-2 text-left uppercase text-xs">Nome</th>
                  <th className="px-3 py-2 text-right uppercase text-xs">{orderLabel}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      {r.link ? <Link to={r.link} className="hover:text-primary">{r.name}</Link> : r.name}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(r._value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}