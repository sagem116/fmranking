import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Target, Plus, Trash2, Save, ChevronDown, ChevronRight,
  Download, Upload, Search, Sparkles, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRankings } from "@/lib/useRankings";
import { fmtPts } from "@/lib/fmt";
import {
  type Desafio, type Subject, type ReqType, type LeagueScope, type Requirement,
  REQ_LABEL, SUBJECT_LABEL, ALL_SUBJECTS,
  loadDesafios, saveDesafios, normalizeDesafio,
  DESAFIO_PRESETS, clonePresetForInsertion,
} from "@/lib/fm-desafios";

export const Route = createFileRoute("/desafios")({
  head: () => ({
    meta: [
      { title: "Desafios — FM World Rankings" },
      { name: "description", content: "Cria desafios personalizados com pontos extra para clubes/treinadores/seleções." },
    ],
  }),
  component: DesafiosPage,
});

function DesafiosPage() {
  const { data, isLoading } = useRankings();
  const qc = useQueryClient();
  const [list, setList] = useState<Desafio[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState<Subject | "any">("any");
  const [filterReqType, setFilterReqType] = useState<ReqType | "any">("any");
  const [filterConsecutive, setFilterConsecutive] = useState(false);

  useEffect(() => { setList(loadDesafios()); }, []);

  const update = (next: Desafio[]) => {
    setList(next);
    saveDesafios(next);
    qc.invalidateQueries({ queryKey: ["fm-all-data"] });
  };
  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const newDesafio = () => {
    const d: Desafio = {
      id: crypto.randomUUID(),
      name: "Novo desafio",
      description: "",
      subjects: ["clubs"],
      sameYear: false,
      bonus: 500,
      requirements: [{ type: "superleague-champion", match: "", count: 1, consecutive: false }],
    };
    update([...list, d]);
    setExpanded((e) => ({ ...e, [d.id]: true }));
  };

  const addDesafios = (toAdd: Desafio[]) => {
    update([...list, ...toAdd]);
    toast.success(`${toAdd.length} desafio(s) adicionado(s).`);
  };

  const removeDesafio = (id: string) => {
    if (!confirm("Eliminar este desafio?")) return;
    update(list.filter((d) => d.id !== id));
  };

  const updateDesafio = (id: string, fn: (d: Desafio) => void) => {
    update(list.map((d) => {
      if (d.id !== id) return d;
      const copy: Desafio = {
        ...d,
        subjects: [...d.subjects],
        requirements: d.requirements.map((r) => ({ ...r })),
      };
      fn(copy);
      return copy;
    }));
  };

  const handleExport = () => {
    const payload = { version: 3, exportedAt: new Date().toISOString(), desafios: list };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `desafios-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Desafios exportados.");
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const arr: any[] = Array.isArray(parsed) ? parsed : parsed.desafios ?? [];
      const incoming = arr.map(normalizeDesafio);
      const replace = confirm("Carregar OK. Substituir os desafios atuais?\nOK = substituir, Cancelar = juntar aos existentes.");
      const next = replace ? incoming : [...list, ...incoming.map((d) => ({ ...d, id: crypto.randomUUID() }))];
      update(next);
      toast.success(`${incoming.length} desafio(s) importado(s).`);
    } catch (err) {
      console.error(err);
      toast.error("JSON inválido.");
    }
  };

  // Results come from the centralized hook (so bonuses are also applied to rankings)
  const results = data?.desafioResults ?? [];

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    return results.filter(({ desafio }) => {
      if (filterSubject !== "any" && !desafio.subjects.includes(filterSubject)) return false;
      if (filterReqType !== "any" && !desafio.requirements.some((r) => r.type === filterReqType)) return false;
      if (filterConsecutive && !desafio.requirements.some((r) => r.consecutive)) return false;
      if (q) {
        const hay = `${desafio.name} ${desafio.description ?? ""} ${desafio.requirements.map((r) => r.type + " " + r.match).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [results, search, filterSubject, filterReqType, filterConsecutive]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }

  const linkFor = (subject: Subject) =>
    subject === "clubs" ? ("/clubes/$name" as const)
    : subject === "coaches" ? ("/treinadores/$name" as const)
    : ("/paises/$name" as const);

  const toggleSubject = (desafio: Desafio, s: Subject) => {
    updateDesafio(desafio.id, (d) => {
      if (d.subjects.includes(s)) {
        if (d.subjects.length > 1) d.subjects = d.subjects.filter((x) => x !== s);
      } else {
        d.subjects = [...d.subjects, s];
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="size-6 text-primary" /> Desafios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cria desafios personalizados. Os pontos extra são <strong>somados aos rankings mundiais</strong> de cada entidade que cumpre os requisitos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" onClick={handleImportClick}><Upload className="size-4" /> Importar</Button>
          <Button variant="outline" onClick={handleExport} disabled={list.length === 0}><Download className="size-4" /> Exportar</Button>
          <Button variant="outline" onClick={() => setWizardOpen(true)}><Wand2 className="size-4" /> Assistente</Button>
          <Button onClick={newDesafio}><Plus className="size-4" /> Novo</Button>
        </div>
      </div>

      <WizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreate={addDesafios}
      />

      {/* Filtros */}
      {list.length > 0 && (
        <Card>
          <CardContent className="py-3 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-xs text-muted-foreground">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, descrição, competição…" className="h-9 pl-8" />
              </div>
            </div>
            <div className="w-48 space-y-1">
              <Label className="text-xs text-muted-foreground">Sujeito</Label>
              <Select value={filterSubject} onValueChange={(v) => setFilterSubject(v as Subject | "any")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  {ALL_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{SUBJECT_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-56 space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de requisito</Label>
              <Select value={filterReqType} onValueChange={(v) => setFilterReqType(v as ReqType | "any")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer</SelectItem>
                  {(Object.keys(REQ_LABEL) as ReqType[]).map((t) => <SelectItem key={t} value={t}>{REQ_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer pb-1.5">
              <Checkbox checked={filterConsecutive} onCheckedChange={(v) => setFilterConsecutive(!!v)} />
              Só com requisitos "Seguidas"
            </label>
            {(search || filterSubject !== "any" || filterReqType !== "any" || filterConsecutive) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterSubject("any"); setFilterReqType("any"); setFilterConsecutive(false); }}>
                Limpar
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{filteredResults.length} / {results.length}</span>
          </CardContent>
        </Card>
      )}

      {list.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-3">
            <p>Sem desafios criados.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setWizardOpen(true)}><Wand2 className="size-4" /> Abrir Assistente</Button>
              <Button variant="outline" onClick={newDesafio}><Plus className="size-4" /> Novo manual</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredResults.map(({ desafio, matches }) => {
        const isOpen = !!expanded[desafio.id];
        const reqSummary = desafio.requirements
          .map((r) => {
            const base = REQ_LABEL[r.type].replace(/\s*\(.*\)$/, "");
            const cnt = r.count > 1 ? ` ×${r.count}${r.consecutive ? " seguidas" : ""}` : (r.consecutive ? " seguidas" : "");
            const m = r.match ? ` "${r.match}"` : "";
            const top = r.type === "hall-of-fame" ? ` Top ${r.hofTopN ?? 10}` : "";
            return base + top + m + cnt;
          })
          .join(desafio.sameYear ? " ⊕ " : " + ");

        return (
          <Card key={desafio.id}>
            <CardHeader className="space-y-3">
              <div className="flex items-start gap-2">
                <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => toggle(desafio.id)}>
                  {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </Button>
                <button type="button" onClick={() => toggle(desafio.id)} className="flex-1 text-left space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{desafio.name}</CardTitle>
                    {desafio.subjects.map((s) => (
                      <Badge key={s} variant="secondary">{SUBJECT_LABEL[s]}</Badge>
                    ))}
                    {desafio.sameYear && <Badge variant="outline" className="border-primary text-primary">Mesmo ano</Badge>}
                    <Badge variant="outline">{matches.length} resultados</Badge>
                    <span className="ml-auto text-xs text-muted-foreground">Bónus: <span className="font-semibold text-foreground">{fmtPts(desafio.bonus)}</span></span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{reqSummary || "Sem requisitos"}</p>
                  {desafio.description && !isOpen && (
                    <p className="text-xs text-muted-foreground truncate">{desafio.description}</p>
                  )}
                </button>
                <Button size="icon" variant="ghost" onClick={() => removeDesafio(desafio.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>

              {isOpen && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome</Label>
                      <Input value={desafio.name} onChange={(e) => updateDesafio(desafio.id, (d) => { d.name = e.target.value; })} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Pontos extra</Label>
                      <Input type="number" step="any" value={desafio.bonus} onChange={(e) => updateDesafio(desafio.id, (d) => { d.bonus = Number(e.target.value) || 0; })} className="h-9 tabular-nums" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
                    <Input value={desafio.description ?? ""} onChange={(e) => updateDesafio(desafio.id, (d) => { d.description = e.target.value; })} className="h-9" placeholder="Notas/contexto…" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Sujeitos (1 ou mais)</Label>
                    <div className="flex flex-wrap gap-3">
                      {ALL_SUBJECTS.map((s) => (
                        <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={desafio.subjects.includes(s)} onCheckedChange={() => toggleSubject(desafio, s)} />
                          {SUBJECT_LABEL[s]}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={desafio.sameYear} onCheckedChange={(v) => updateDesafio(desafio.id, (d) => { d.sameYear = !!v; })} />
                    Todos os requisitos têm de ocorrer no mesmo ano
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Requisitos</Label>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                        onClick={() => updateDesafio(desafio.id, (d) => { d.requirements.push({ type: "continental-winner", match: "", count: 1, consecutive: false }); })}>
                        <Plus className="size-3" /> Adicionar
                      </Button>
                    </div>
                    {desafio.requirements.map((req, idx) => (
                      <div key={idx} className="flex flex-wrap items-end gap-2 rounded border p-2">
                        <div className="w-60 space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                          <Select value={req.type} onValueChange={(v) => updateDesafio(desafio.id, (d) => { d.requirements[idx].type = v as ReqType; })}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(REQ_LABEL) as ReqType[]).map((t) => (
                                <SelectItem key={t} value={t}>{REQ_LABEL[t]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1 min-w-[160px] space-y-1">
                          <Label className="text-[10px] text-muted-foreground">
                            {req.type === "hall-of-fame" ? "(N/A — usa Top N)"
                              : req.type === "superleague-champion" || req.type === "superleague-promotion" ? "(qualquer SuperLeague)"
                              : req.type === "unbeaten-season" || req.type === "points-record" ? "Liga/divisão (substring; vazio = qualquer)"
                              : "Nome (substring; vazio = qualquer)"}
                          </Label>
                          <Input value={req.match}
                            disabled={req.type === "hall-of-fame" || req.type === "superleague-champion" || req.type === "superleague-promotion"}
                            onChange={(e) => updateDesafio(desafio.id, (d) => { d.requirements[idx].match = e.target.value; })}
                            className="h-8" placeholder="ex.: Champions / Premier / Div 1" />
                        </div>
                        {(req.type === "unbeaten-season" || req.type === "points-record") && (
                          <div className="w-32 space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Origem</Label>
                            <Select value={req.leagueScope ?? "any"} onValueChange={(v) => updateDesafio(desafio.id, (d) => { d.requirements[idx].leagueScope = v as LeagueScope; })}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">Qualquer</SelectItem>
                                <SelectItem value="superleague">SuperLeague</SelectItem>
                                <SelectItem value="national">Liga Nacional</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {req.type === "hall-of-fame" && (
                          <div className="w-20 space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Top N</Label>
                            <Input type="number" min={1} value={req.hofTopN ?? 10}
                              onChange={(e) => updateDesafio(desafio.id, (d) => { d.requirements[idx].hofTopN = Math.max(1, Number(e.target.value) || 1); })}
                              className="h-8 tabular-nums" />
                          </div>
                        )}
                        <div className="w-20 space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Vezes</Label>
                          <Input type="number" min={1} value={req.count}
                            onChange={(e) => updateDesafio(desafio.id, (d) => { d.requirements[idx].count = Math.max(1, Number(e.target.value) || 1); })}
                            className="h-8 tabular-nums" />
                        </div>
                        <label className="flex items-center gap-1 text-xs cursor-pointer pb-1.5">
                          <Checkbox checked={req.consecutive} onCheckedChange={(v) => updateDesafio(desafio.id, (d) => { d.requirements[idx].consecutive = !!v; })} />
                          Seguidas
                        </label>
                        <Button size="icon" variant="ghost" className="size-8 shrink-0"
                          onClick={() => updateDesafio(desafio.id, (d) => { d.requirements.splice(idx, 1); })}>
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {desafio.requirements.length === 0 && (
                      <p className="text-xs text-muted-foreground">Sem requisitos — adiciona pelo menos um.</p>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>

            {isOpen && (
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">Quem completou</CardTitle>
                  <Badge variant="outline">{matches.length}</Badge>
                  {matches.length > 0 && desafio.bonus > 0 && (
                    <Badge variant="outline" className="border-primary text-primary">
                      +{fmtPts(desafio.bonus)} por entidade → somado aos rankings
                    </Badge>
                  )}
                </div>
                {matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ninguém ainda.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Anos</TableHead>
                        <TableHead>Detalhe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matches.slice(0, 200).map((m) => (
                        <TableRow key={`${m.subject}|${m.entity}`}>
                          <TableCell><Badge variant="secondary">{SUBJECT_LABEL[m.subject]}</Badge></TableCell>
                          <TableCell className="font-medium">
                            <Link to={linkFor(m.subject)} params={{ name: m.entity }} className="hover:underline">{m.entity}</Link>
                          </TableCell>
                          <TableCell className="tabular-nums text-xs">{m.years.join(", ") || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div>{m.details.join(" + ")}</div>
                            {m.extras.length > 0 && (
                              <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground/80 list-disc pl-4">
                                {m.extras.slice(0, 8).map((x, i) => <li key={i}>{x}</li>)}
                                {m.extras.length > 8 && <li>… +{m.extras.length - 8}</li>}
                              </ul>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {matches.length > 200 && (
                  <p className="text-xs text-muted-foreground">A mostrar 200 de {matches.length}.</p>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {list.length > 0 && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Save className="size-3" /> Os desafios são guardados automaticamente no browser e o bónus é aplicado aos rankings mundiais.
        </div>
      )}
    </div>
  );
}

// ===== Wizard / Assistant Dialog =====

function WizardDialog({
  open, onOpenChange, onCreate,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreate: (ds: Desafio[]) => void }) {
  const [tab, setTab] = useState<"presets" | "quick">("presets");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Quick form
  const [qName, setQName] = useState("");
  const [qDesc, setQDesc] = useState("");
  const [qBonus, setQBonus] = useState(500);
  const [qSubjects, setQSubjects] = useState<Subject[]>(["clubs"]);
  const [qSameYear, setQSameYear] = useState(false);
  const [qReqType, setQReqType] = useState<ReqType>("superleague-champion");
  const [qMatch, setQMatch] = useState("");
  const [qCount, setQCount] = useState(1);
  const [qConsec, setQConsec] = useState(false);
  const [qHofTop, setQHofTop] = useState(10);
  const [qScope, setQScope] = useState<LeagueScope>("any");
  const [qReqs, setQReqs] = useState<Requirement[]>([]);

  const resetQuick = () => {
    setQName(""); setQDesc(""); setQBonus(500); setQSubjects(["clubs"]); setQSameYear(false);
    setQReqType("superleague-champion"); setQMatch(""); setQCount(1); setQConsec(false); setQHofTop(10); setQScope("any");
    setQReqs([]);
  };

  const addReqToQuick = () => {
    setQReqs((r) => [...r, {
      type: qReqType, match: qMatch, count: qCount, consecutive: qConsec,
      hofTopN: qReqType === "hall-of-fame" ? qHofTop : undefined,
      leagueScope: qReqType === "unbeaten-season" || qReqType === "points-record" ? qScope : "any",
    }]);
    setQMatch(""); setQCount(1); setQConsec(false);
  };

  const submitPresets = () => {
    const toAdd = DESAFIO_PRESETS.filter((p) => selected[p.id]).map(clonePresetForInsertion);
    if (!toAdd.length) { toast.error("Seleciona pelo menos um."); return; }
    onCreate(toAdd);
    setSelected({});
    onOpenChange(false);
  };

  const submitQuick = () => {
    if (!qName.trim()) { toast.error("Dá um nome ao desafio."); return; }
    const reqs = qReqs.length ? qReqs : [{
      type: qReqType, match: qMatch, count: qCount, consecutive: qConsec,
      hofTopN: qReqType === "hall-of-fame" ? qHofTop : undefined,
      leagueScope: qReqType === "unbeaten-season" || qReqType === "points-record" ? qScope : "any",
    }];
    if (!reqs.length) { toast.error("Adiciona pelo menos um requisito."); return; }
    if (!qSubjects.length) { toast.error("Escolhe pelo menos um sujeito."); return; }
    const d: Desafio = {
      id: crypto.randomUUID(),
      name: qName.trim(), description: qDesc.trim(),
      subjects: qSubjects, sameYear: qSameYear,
      bonus: Number(qBonus) || 0,
      requirements: reqs,
    };
    onCreate([d]);
    resetQuick();
    onOpenChange(false);
  };

  const toggleQuickSubject = (s: Subject) => {
    setQSubjects((arr) => arr.includes(s) ? (arr.length > 1 ? arr.filter((x) => x !== s) : arr) : [...arr, s]);
  };

  const toggleAll = (val: boolean) => {
    const next: Record<string, boolean> = {};
    if (val) for (const p of DESAFIO_PRESETS) next[p.id] = true;
    setSelected(next);
  };
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-5" /> Assistente de Desafios
          </DialogTitle>
          <DialogDescription>
            Adiciona desafios populares com um clique, ou cria um novo passo-a-passo.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "presets" | "quick")}>
          <TabsList>
            <TabsTrigger value="presets"><Sparkles className="size-4 mr-1" /> Sugestões</TabsTrigger>
            <TabsTrigger value="quick"><Plus className="size-4 mr-1" /> Criar rápido</TabsTrigger>
          </TabsList>

          <TabsContent value="presets" className="space-y-3 pt-2">
            <div className="flex items-center gap-2 justify-between">
              <p className="text-xs text-muted-foreground">{DESAFIO_PRESETS.length} sugestões disponíveis. Os IDs são regenerados ao adicionar.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleAll(true)}>Selecionar todos</Button>
                <Button size="sm" variant="ghost" onClick={() => toggleAll(false)}>Limpar</Button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {DESAFIO_PRESETS.map((p) => (
                <label key={p.id} className={`flex items-start gap-2 rounded border p-3 cursor-pointer hover:border-primary/50 ${selected[p.id] ? "border-primary bg-primary/5" : ""}`}>
                  <Checkbox checked={!!selected[p.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [p.id]: !!v }))} />
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{p.name}</span>
                      <Badge variant="outline">+{fmtPts(p.bonus)}</Badge>
                      {p.subjects.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{SUBJECT_LABEL[s]}</Badge>)}
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                  </div>
                </label>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="quick" className="space-y-3 pt-2">
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={qName} onChange={(e) => setQName(e.target.value)} className="h-9" placeholder="ex.: Tri-campeão Continental" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pontos extra</Label>
                <Input type="number" step="any" value={qBonus} onChange={(e) => setQBonus(Number(e.target.value) || 0)} className="h-9 tabular-nums" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={qDesc} onChange={(e) => setQDesc(e.target.value)} rows={2} placeholder="Opcional" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sujeitos</Label>
              <div className="flex flex-wrap gap-3">
                {ALL_SUBJECTS.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={qSubjects.includes(s)} onCheckedChange={() => toggleQuickSubject(s)} />
                    {SUBJECT_LABEL[s]}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={qSameYear} onCheckedChange={(v) => setQSameYear(!!v)} />
              Todos os requisitos no mesmo ano
            </label>

            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Construtor de requisitos</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-60 space-y-1">
                    <Label className="text-[10px]">Tipo</Label>
                    <Select value={qReqType} onValueChange={(v) => setQReqType(v as ReqType)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(REQ_LABEL) as ReqType[]).map((t) => <SelectItem key={t} value={t}>{REQ_LABEL[t]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[140px] space-y-1">
                    <Label className="text-[10px]">Match (substring)</Label>
                    <Input value={qMatch} onChange={(e) => setQMatch(e.target.value)} className="h-8"
                      disabled={qReqType === "hall-of-fame" || qReqType === "superleague-champion" || qReqType === "superleague-promotion"} />
                  </div>
                  {(qReqType === "unbeaten-season" || qReqType === "points-record") && (
                    <div className="w-32 space-y-1">
                      <Label className="text-[10px]">Origem</Label>
                      <Select value={qScope} onValueChange={(v) => setQScope(v as LeagueScope)}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Qualquer</SelectItem>
                          <SelectItem value="superleague">SuperLeague</SelectItem>
                          <SelectItem value="national">Liga Nacional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {qReqType === "hall-of-fame" && (
                    <div className="w-20 space-y-1">
                      <Label className="text-[10px]">Top N</Label>
                      <Input type="number" min={1} value={qHofTop} onChange={(e) => setQHofTop(Math.max(1, Number(e.target.value) || 1))} className="h-8 tabular-nums" />
                    </div>
                  )}
                  <div className="w-20 space-y-1">
                    <Label className="text-[10px]">Vezes</Label>
                    <Input type="number" min={1} value={qCount} onChange={(e) => setQCount(Math.max(1, Number(e.target.value) || 1))} className="h-8 tabular-nums" />
                  </div>
                  <label className="flex items-center gap-1 text-xs cursor-pointer pb-1.5">
                    <Checkbox checked={qConsec} onCheckedChange={(v) => setQConsec(!!v)} />
                    Seguidas
                  </label>
                  <Button size="sm" variant="outline" onClick={addReqToQuick}><Plus className="size-3" /> Adicionar</Button>
                </div>
                {qReqs.length > 0 && (
                  <ul className="text-xs space-y-1">
                    {qReqs.map((r, i) => (
                      <li key={i} className="flex items-center gap-2 rounded bg-muted/40 px-2 py-1">
                        <span className="flex-1">
                          {REQ_LABEL[r.type]}{r.match ? ` "${r.match}"` : ""} ×{r.count}{r.consecutive ? " seguidas" : ""}
                          {r.type === "hall-of-fame" ? ` (Top ${r.hofTopN})` : ""}
                        </span>
                        <Button size="icon" variant="ghost" className="size-6" onClick={() => setQReqs((arr) => arr.filter((_, x) => x !== i))}>
                          <Trash2 className="size-3 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {qReqs.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">Se não adicionares, o requisito acima é usado diretamente.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {tab === "presets" ? (
            <Button onClick={submitPresets} disabled={selectedCount === 0}>
              <Plus className="size-4" /> Adicionar {selectedCount > 0 ? `(${selectedCount})` : ""}
            </Button>
          ) : (
            <Button onClick={submitQuick}><Plus className="size-4" /> Criar desafio</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
