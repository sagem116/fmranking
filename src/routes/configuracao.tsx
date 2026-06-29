import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Settings, Save, Plus, Check, Trash2, RotateCcw, Download, Upload, RefreshCw, Sparkles, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useActiveConfig } from "@/lib/useRankings";
import { cloneConfig, DEFAULT_CONFIG, cfgTitleWeight, cfgInternationalWeight, type FmConfig } from "@/lib/fm-config";
import { saveConfig, createProfile, activateProfile, deleteProfile, type WeightProfile } from "@/lib/fm-config-db";
import { wipeAllData } from "@/lib/fm-wipe";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { downloadBackup, importBackupFromFile } from "@/lib/fm-global-backup";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const Route = createFileRoute("/configuracao")({
  head: () => ({
    meta: [
      { title: "Configuração — FM World Rankings" },
      { name: "description", content: "Pesos de competições, divisões, títulos e fórmula mundial editáveis." },
    ],
  }),
  component: ConfigPage,
});

function NumField({ label, value, onChange, step = "any" }: { label: string; value: number; onChange: (v: number) => void; step?: number | "any" }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 tabular-nums"
      />
    </div>
  );
}

type SortKey = "original" | "name" | "weight";
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir };

function SortBar({ state, onChange }: { state: SortState; onChange: (s: SortState) => void }) {
  const toggle = (key: "name" | "weight") => {
    if (state.key !== key) onChange({ key, dir: "asc" });
    else if (state.dir === "asc") onChange({ key, dir: "desc" });
    else onChange({ key: "original", dir: "asc" });
  };
  const Btn = ({ k, label }: { k: "name" | "weight"; label: string }) => {
    const active = state.key === k;
    return (
      <Button type="button" size="sm" variant={active ? "secondary" : "outline"} className="h-7 px-2 text-xs" onClick={() => toggle(k)}>
        {label}
        {active ? (state.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : null}
      </Button>
    );
  };
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Ordenar:</span>
      <Btn k="name" label="Nome" />
      <Btn k="weight" label="Peso" />
      {state.key !== "original" && (
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onChange({ key: "original", dir: "asc" })}>
          Repor
        </Button>
      )}
    </div>
  );
}

function sortIndices<T extends { label: string; weight: number }>(arr: T[], s: SortState): number[] {
  const idx = arr.map((_, i) => i);
  if (s.key === "original") return idx;
  const mul = s.dir === "asc" ? 1 : -1;
  return idx.sort((a, b) => {
    if (s.key === "name") return arr[a].label.localeCompare(arr[b].label, "pt") * mul;
    return (arr[a].weight - arr[b].weight) * mul;
  });
}

function sortNumKeys(keys: number[], values: Record<number, number>, s: SortState): number[] {
  if (s.key === "original") return keys;
  const mul = s.dir === "asc" ? 1 : -1;
  return [...keys].sort((a, b) => {
    if (s.key === "name") return (a - b) * mul;
    return ((values[a] ?? 0) - (values[b] ?? 0)) * mul;
  });
}

// Mantém-se sincronizado com STAGE_RAW em src/lib/fm-rankings.ts.
const STAGE_RAW = { winner: 1, finalist: 0.25, semi: 0.125, quarter: 0.06 } as const;

interface DebugRow {
  scope: "Continental" | "Seleções";
  competition: string;
  weight: number;
  stage: "Vencedor" | "Finalista" | "Meia-final" | "Quartos";
  rawBase: number;
  raw: number;
  compW: number;
  stageMult: number;
  decay: number;
  weighted: number;
}

function DebugFormulaCard({ cfg }: { cfg: FmConfig }) {
  const [open, setOpen] = useState(false);
  const rows: DebugRow[] = useMemo(() => {
    if (!open) return [];
    const out: DebugRow[] = [];
    const decay = cfg.decayMultipliers.last; // simulação para a última época
    const build = (
      scope: DebugRow["scope"],
      compW: number,
      entries: { label: string; weight: number }[],
    ) => {
      for (const t of entries) {
        const stages: Array<{ name: DebugRow["stage"]; base: number; mult: number }> = [
          { name: "Vencedor", base: STAGE_RAW.winner, mult: 1 },
          { name: "Finalista", base: STAGE_RAW.finalist, mult: cfg.stageMultipliers.finalist },
          { name: "Meia-final", base: STAGE_RAW.semi, mult: cfg.stageMultipliers.semi },
          { name: "Quartos", base: STAGE_RAW.quarter, mult: cfg.stageMultipliers.quarter },
        ];
        for (const s of stages) {
          const raw = t.weight * s.base;
          out.push({
            scope,
            competition: t.label,
            weight: t.weight,
            stage: s.name,
            rawBase: s.base,
            raw,
            compW,
            stageMult: s.mult,
            decay,
            weighted: raw * compW * decay * s.mult,
          });
        }
      }
    };
    const cont = cfg.titleWeights.length
      ? cfg.titleWeights.map((t) => ({ label: t.label, weight: t.weight }))
      : [cfgTitleWeight(cfg, "Champions League (exemplo)")];
    const intl = cfg.internationalWeights.length
      ? cfg.internationalWeights.map((t) => ({ label: t.label, weight: t.weight }))
      : [cfgInternationalWeight(cfg, "Mundial (exemplo)")];
    build("Continental", cfg.competitionWeights.continental, cont);
    build("Seleções", cfg.competitionWeights.international ?? 1.5, intl);
    return out;
  }, [open, cfg]);

  const grouped = useMemo(() => {
    const m = new Map<string, DebugRow[]>();
    for (const r of rows) {
      const k = `${r.scope}::${r.competition}`;
      (m.get(k) ?? m.set(k, []).get(k)!).push(r);
    }
    return [...m.entries()];
  }, [rows]);

  const fmt = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 2 });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Modo Debug — Fórmula Mundial</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Pré-visualiza os valores intermédios (peso, base de fase, multiplicadores e total)
            usando a configuração atual <em>sem</em> guardar nem recalcular os rankings.
            Fórmula: <code>raw = peso × base_fase</code> · <code>ponderado = raw × pesoComp × multFase × decaimento</code>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Esconder" : "Mostrar"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Não há competições continentais nem de seleções configuradas.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs tabular-nums">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="px-2 py-1.5">Âmbito</th>
                    <th className="px-2 py-1.5">Competição</th>
                    <th className="px-2 py-1.5 text-right">Peso</th>
                    <th className="px-2 py-1.5">Fase</th>
                    <th className="px-2 py-1.5 text-right">Base fase</th>
                    <th className="px-2 py-1.5 text-right">Raw</th>
                    <th className="px-2 py-1.5 text-right">× pesoComp</th>
                    <th className="px-2 py-1.5 text-right">× multFase</th>
                    <th className="px-2 py-1.5 text-right">× decay</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Ponderado</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(([key, group]) =>
                    group.map((r, i) => (
                      <tr key={`${key}-${r.stage}`} className="border-t border-border/60 hover:bg-muted/30">
                        {i === 0 ? (
                          <>
                            <td className="px-2 py-1.5" rowSpan={group.length}>{r.scope}</td>
                            <td className="px-2 py-1.5 font-medium" rowSpan={group.length}>{r.competition}</td>
                            <td className="px-2 py-1.5 text-right" rowSpan={group.length}>{fmt(r.weight)}</td>
                          </>
                        ) : null}
                        <td className="px-2 py-1.5">{r.stage}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(r.rawBase)}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(r.raw)}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(r.compW)}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(r.stageMult)}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(r.decay)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{fmt(r.weighted)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Decay simulado = última época ({fmt(cfg.decayMultipliers.last)}). Para épocas mais antigas, multiplica pelo decay correspondente.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function ConfigPage() {
  const { data, isLoading } = useActiveConfig();
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<FmConfig | null>(null);
  const [profiles, setProfiles] = useState<WeightProfile[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [sortDiv, setSortDiv] = useState<SortState>({ key: "original", dir: "asc" });
  const [sortPos, setSortPos] = useState<SortState>({ key: "original", dir: "asc" });
  const [sortTitles, setSortTitles] = useState<SortState>({ key: "original", dir: "asc" });
  const [sortNat, setSortNat] = useState<SortState>({ key: "original", dir: "asc" });
  const [sortIntl, setSortIntl] = useState<SortState>({ key: "original", dir: "asc" });

  useEffect(() => {
    if (data) {
      setCfg(cloneConfig(data.config));
      setProfiles(data.profiles);
      setActiveId(data.activeId);
    }
  }, [data]);

  const upd = (fn: (c: FmConfig) => void) => setCfg((prev) => {
    if (!prev) return prev;
    const next = cloneConfig(prev);
    fn(next);
    return next;
  });

  const positions = useMemo(() => Array.from({ length: 100 }, (_, i) => i + 1), []);
  const divisions = useMemo(() => Array.from({ length: 11 }, (_, i) => i + 1), []);

  if (isLoading || !cfg) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar configuração…
      </div>
    );
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["fm-config"] });
    qc.invalidateQueries({ queryKey: ["fm-all-data"] });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig(activeId, cfg);
      toast.success("Configuração guardada. Rankings recalculados.");
      refresh();
    } catch (e) {
      toast.error("Erro ao guardar: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleNewProfile = async () => {
    const name = window.prompt("Nome do novo perfil de configuração:");
    if (!name) return;
    try {
      const id = await createProfile(name, cfg);
      await activateProfile(id);
      toast.success(`Perfil "${name}" criado e ativado.`);
      refresh();
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateProfile(id);
      toast.success("Perfil ativado.");
      refresh();
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (profiles.length <= 1) {
      toast.error("Não é possível eliminar o único perfil.");
      return;
    }
    if (!window.confirm("Eliminar este perfil de configuração?")) return;
    try {
      await deleteProfile(id);
      if (id === activeId && profiles[0]) await activateProfile(profiles.find((p) => p.id !== id)!.id);
      toast.success("Perfil eliminado.");
      refresh();
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const profileName = profiles.find((p) => p.id === activeId)?.name ?? "config";
    a.href = url;
    a.download = `fm-config-${profileName.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Configuração exportada.");
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<FmConfig>;
        const merged = cloneConfig(DEFAULT_CONFIG);
        const mapList = (arr: unknown, defW: number, withPosBonuses = false) =>
          Array.isArray(arr)
            ? arr.map((t: { match?: string; label?: string; weight?: number; positionBonuses?: Record<string, number> }) => {
                const base = {
                  match: t.match ?? "",
                  label: t.label ?? t.match ?? "",
                  weight: Number(t.weight) || defW,
                };
                if (withPosBonuses && t.positionBonuses && typeof t.positionBonuses === "object") {
                  const pb: Record<number, number> = {};
                  for (const [k, v] of Object.entries(t.positionBonuses)) {
                    const n = Number(v);
                    if (Number.isFinite(n) && n !== 0) pb[Number(k)] = n;
                  }
                  return { ...base, positionBonuses: pb };
                }
                return base;
              })
            : null;

        if (parsed.positionPoints) merged.positionPoints = { ...parsed.positionPoints };
        if (parsed.divisionWeights) merged.divisionWeights = { ...parsed.divisionWeights };
        if (parsed.competitionWeights) merged.competitionWeights = { ...merged.competitionWeights, ...parsed.competitionWeights };
        const tw = mapList(parsed.titleWeights, 0);
        if (tw) merged.titleWeights = tw;
        const nlw = mapList(parsed.nationalLeagueWeights, 1, true);
        if (nlw) merged.nationalLeagueWeights = nlw;
        const iw = mapList(parsed.internationalWeights, 0);
        if (iw) merged.internationalWeights = iw;
        if (typeof parsed.nationalChampionBonus === "number") merged.nationalChampionBonus = parsed.nationalChampionBonus;
        if (typeof parsed.superleagueChampionBonus === "number") merged.superleagueChampionBonus = parsed.superleagueChampionBonus;
        if (typeof parsed.superleaguePromotionBonus === "number") merged.superleaguePromotionBonus = parsed.superleaguePromotionBonus;
        if (typeof parsed.dobradinhaBonus === "number") merged.dobradinhaBonus = parsed.dobradinhaBonus;
        if (typeof parsed.dobradinhaInternacionalBonus === "number") merged.dobradinhaInternacionalBonus = parsed.dobradinhaInternacionalBonus;
        if (typeof parsed.tripleteBonus === "number") merged.tripleteBonus = parsed.tripleteBonus;
        if (typeof parsed.quadrupleBonus === "number") merged.quadrupleBonus = parsed.quadrupleBonus;
        const arrField = (v: unknown): string[] | null =>
          Array.isArray(v) ? v.map((x) => String(x)).filter((s) => s.trim().length > 0) : null;
        const tcc = arrField(parsed.tripleteContinentalCompetitions);
        if (tcc) merged.tripleteContinentalCompetitions = tcc;
        const dic = arrField(parsed.dobradinhaIntContinentalCompetitions);
        if (dic) merged.dobradinhaIntContinentalCompetitions = dic;
        const qcc = arrField(parsed.quadrupleContinentalCompetitions);
        if (qcc) merged.quadrupleContinentalCompetitions = qcc;
        const qcwc = arrField(parsed.quadrupleClubWorldCupCompetitions);
        if (qcwc) merged.quadrupleClubWorldCupCompetitions = qcwc;
        if (parsed.decayMultipliers) merged.decayMultipliers = { ...merged.decayMultipliers, ...parsed.decayMultipliers };
        if (parsed.stageMultipliers) merged.stageMultipliers = { ...merged.stageMultipliers, ...parsed.stageMultipliers };
        if (typeof parsed.normalizePointsByGames === "boolean") merged.normalizePointsByGames = parsed.normalizePointsByGames;
        setCfg(merged);
        toast.success("Configuração importada. Clica em Guardar para aplicar.");
      } catch (e) {
        toast.error("JSON inválido: " + (e as Error).message);
      }
    };
    reader.readAsText(file);
  };


  const handleWipe = async () => {
    const phrase = window.prompt(
      "ATENÇÃO: esta ação apaga TODOS os dados importados (épocas, classificações, treinadores, países, jogadores e continentais). Os perfis de configuração são mantidos.\n\nEscreve APAGAR para confirmar:",
    );
    if (phrase !== "APAGAR") {
      if (phrase !== null) toast.error("Confirmação incorreta. Nada foi apagado.");
      return;
    }
    setWiping(true);
    try {
      await wipeAllData();
      qc.removeQueries();
      await qc.invalidateQueries();
      toast.success("Todos os dados importados foram apagados.");
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    } finally {
      setWiping(false);
    }
  };

  const handleAutoPopulate = async () => {
    try {
      const [{ data: cont }, { data: intl }, { data: nat }] = await Promise.all([
        supabase.from("continental_results").select("competition"),
        supabase.from("international_results").select("competition"),
        supabase.from("standings").select("division_label").eq("module", "national"),
      ]);
      const contNames = [...new Set((cont ?? []).map((r) => r.competition).filter(Boolean) as string[])];
      const intlNames = [...new Set((intl ?? []).map((r) => r.competition).filter(Boolean) as string[])];
      const natNames = [...new Set((nat ?? []).map((r) => r.division_label).filter(Boolean) as string[])];
      if (!contNames.length && !intlNames.length && !natNames.length) {
        toast.error("Sem dados importados para gerar pesos.");
        return;
      }
      let added = 0;
      upd((c) => {
        const existingC = new Set(c.titleWeights.map((t) => norm(t.label)));
        for (const n of contNames) {
          if (!existingC.has(norm(n))) {
            c.titleWeights.push({ match: norm(n), label: n, weight: 150 });
            added++;
          }
        }
        const existingI = new Set(c.internationalWeights.map((t) => norm(t.label)));
        for (const n of intlNames) {
          if (!existingI.has(norm(n))) {
            c.internationalWeights.push({ match: norm(n), label: n, weight: 150 });
            added++;
          }
        }
        const existingN = new Set(c.nationalLeagueWeights.map((t) => norm(t.label)));
        for (const n of natNames) {
          if (!existingN.has(norm(n))) {
            c.nationalLeagueWeights.push({ match: norm(n), label: n, weight: 1 });
            added++;
          }
        }
      });
      toast.success(
        added > 0
          ? `${added} competiç${added === 1 ? "ão adicionada" : "ões adicionadas"} com pesos equilibrados. Clica em Guardar para aplicar.`
          : "Todas as competições carregadas já tinham peso definido.",
      );
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="size-6 text-primary" /> Configuração
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Pesos, bónus, desvalorização e fórmula mundial</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-4" /> Exportar JSON
          </Button>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" /> Importar JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              downloadBackup();
              toast.success("Backup global exportado");
            }}
            title="Exporta tudo o que é editável: pesos, fórmulas, desafios, debugs, sidebar, tema."
          >
            <Download className="size-4" /> Backup global
          </Button>
          <Button variant="outline" asChild title="Importa um backup global previamente exportado.">
            <label className="cursor-pointer">
              <Upload className="size-4" /> Restaurar backup
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    const res = await importBackupFromFile(f);
                    toast.success(`Backup restaurado (${res.applied.length} secções).`);
                    setTimeout(() => window.location.reload(), 600);
                  } catch (err) {
                    toast.error("Backup inválido: " + (err as Error).message);
                  }
                }}
              />
            </label>
          </Button>
          <Button variant="outline" onClick={() => setCfg(cloneConfig(DEFAULT_CONFIG))}>
            <RotateCcw className="size-4" /> Repor padrão
          </Button>
          <Button variant="outline" onClick={handleAutoPopulate}>
            <Sparkles className="size-4" /> Popular competições</Button>
          <Button
            variant="outline"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["fm-all-data"] });
              qc.invalidateQueries({ queryKey: ["fm-config"] });
              toast.success("A recalcular rankings com a configuração atual…");
            }}
          >
            <RefreshCw className="size-4" /> Recalcular rankings
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Perfis de configuração</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <span className="flex-1 font-medium">{p.name}</span>
              {p.id === activeId ? (
                <span className="text-xs text-primary flex items-center gap-1"><Check className="size-3" /> Ativo</span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => handleActivate(p.id)}>Ativar</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={handleNewProfile}>
            <Plus className="size-4" /> Novo perfil (a partir dos valores atuais)
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Pesos por competição (Fórmula Mundial)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumField label="SuperLeague" step={0.1} value={cfg.competitionWeights.superleague} onChange={(v) => upd((c) => { c.competitionWeights.superleague = v; })} />
            <NumField label="Continental" step={0.1} value={cfg.competitionWeights.continental} onChange={(v) => upd((c) => { c.competitionWeights.continental = v; })} />
            <NumField label="Nacional" step={0.1} value={cfg.competitionWeights.national} onChange={(v) => upd((c) => { c.competitionWeights.national = v; })} />
            <NumField label="Seleções" step={0.1} value={cfg.competitionWeights.international ?? 1.5} onChange={(v) => upd((c) => { c.competitionWeights.international = v; })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bónus de campeão, promoção e múltiplas conquistas</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Bónus de promoção: atribuído quando uma época SuperLeague tem indicador "P" (subiu de divisão).
              Dobradinha = SL + Liga Nacional · Dobradinha Internacional = SL + Continental ·
              Triplete = SL + Liga Nacional + Continental · Quadruple = Liga Nacional + SL + Continental + Club World Cup.
              Apenas o bónus de maior prioridade (Quadruple {">"} Triplete {">"} Dobradinha Int. {">"} Dobradinha) é atribuído por clube/época.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NumField label="Campeão SuperLeague" value={cfg.superleagueChampionBonus} onChange={(v) => upd((c) => { c.superleagueChampionBonus = v; })} />
            <NumField label="Campeão Nacional" value={cfg.nationalChampionBonus} onChange={(v) => upd((c) => { c.nationalChampionBonus = v; })} />
            <NumField label="Promoção SuperLeague" value={cfg.superleaguePromotionBonus} onChange={(v) => upd((c) => { c.superleaguePromotionBonus = Math.max(0, v); })} />
            <NumField label="Dobradinha (SL + Nacional)" value={cfg.dobradinhaBonus} onChange={(v) => upd((c) => { c.dobradinhaBonus = Math.max(0, v); })} />
            <NumField label="Dobradinha Internacional (SL + Continental)" value={cfg.dobradinhaInternacionalBonus} onChange={(v) => upd((c) => { c.dobradinhaInternacionalBonus = Math.max(0, v); })} />
            <NumField label="Triplete (SL + Nacional + Continental)" value={cfg.tripleteBonus} onChange={(v) => upd((c) => { c.tripleteBonus = Math.max(0, v); })} />
            <NumField label="Quadruple (NL + SL + Cont + CWC)" value={cfg.quadrupleBonus} onChange={(v) => upd((c) => { c.quadrupleBonus = Math.max(0, v); })} />
          </CardContent>
        </Card>

        {(["triplete", "dob-int", "quad-cont", "quad-cwc"] as const).map((kind) => {
          const meta = {
            "triplete": {
              title: "Competições continentais que contam para o Triplete",
              field: "tripleteContinentalCompetitions" as const,
              fallbackText: "Se vazio, qualquer competição continental conta.",
            },
            "dob-int": {
              title: "Competições continentais que contam para a Dobradinha Internacional",
              field: "dobradinhaIntContinentalCompetitions" as const,
              fallbackText: "Se vazio, qualquer competição continental conta.",
            },
            "quad-cont": {
              title: "Competições continentais que contam para o Quadruple",
              field: "quadrupleContinentalCompetitions" as const,
              fallbackText: "Se vazio, qualquer competição continental conta.",
            },
            "quad-cwc": {
              title: "Competições Club World Cup que contam para o Quadruple",
              field: "quadrupleClubWorldCupCompetitions" as const,
              fallbackText: "Se vazio, é feita correspondência automática por 'club world cup' no nome.",
            },
          }[kind];
          const selectedList = (cfg[meta.field] ?? []) as string[];
          return (
            <Card key={kind}>
              <CardHeader>
                <CardTitle className="text-base">{meta.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Correspondência por substring (sem distinção de maiúsculas) sobre o nome da competição importada. {meta.fallbackText}
                </p>
              </CardHeader>
              <CardContent>
                {cfg.titleWeights.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem competições continentais configuradas. Adiciona pesos em "Pesos de títulos continentais" primeiro.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cfg.titleWeights.map((t) => {
                      const selected = selectedList.includes(t.match);
                      return (
                        <label key={t.match} className="flex items-center gap-2 text-sm cursor-pointer rounded border px-2 py-1.5 hover:bg-muted/40">
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(v) => upd((c) => {
                              const list = new Set((c[meta.field] ?? []) as string[]);
                              if (v) list.add(t.match); else list.delete(t.match);
                              (c[meta.field] as string[]) = Array.from(list);
                            })}
                          />
                          <span className="flex-1">{t.label}</span>
                          <span className="text-xs text-muted-foreground">{t.match}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => upd((c) => { (c[meta.field] as string[]) = cfg.titleWeights.map((t) => t.match); })}>
                    Selecionar todas
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => upd((c) => { (c[meta.field] as string[]) = []; })}>
                    Limpar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}


        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pesos por fase eliminatória</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Multiplicadores aplicados aos pontos base de cada fase em competições continentais e de seleções.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumField label="Finalista vencido (×)" step={0.01} value={cfg.stageMultipliers.finalist} onChange={(v) => upd((c) => { c.stageMultipliers.finalist = Math.max(0, v); })} />
            <NumField label="Meia-final (×)" step={0.01} value={cfg.stageMultipliers.semi} onChange={(v) => upd((c) => { c.stageMultipliers.semi = Math.max(0, v); })} />
            <NumField label="Quartos de final (×)" step={0.01} value={cfg.stageMultipliers.quarter} onChange={(v) => upd((c) => { c.stageMultipliers.quarter = Math.max(0, v); })} />
          </CardContent>
        </Card>

        <DebugFormulaCard cfg={cfg} />




        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decaimento do Ranking Mundial</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Multiplicador aplicado à pontuação consoante a antiguidade da época (1.00 = sem decaimento).</p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <NumField label="Última época (×)" step={0.01} value={cfg.decayMultipliers.last} onChange={(v) => upd((c) => { c.decayMultipliers.last = Math.max(0, v); })} />
            <NumField label="Há 1 época (×)" step={0.01} value={cfg.decayMultipliers.age1} onChange={(v) => upd((c) => { c.decayMultipliers.age1 = Math.max(0, v); })} />
            <NumField label="Há 2 épocas (×)" step={0.01} value={cfg.decayMultipliers.age2} onChange={(v) => upd((c) => { c.decayMultipliers.age2 = Math.max(0, v); })} />
            <NumField label="Há 3 épocas (×)" step={0.01} value={cfg.decayMultipliers.age3} onChange={(v) => upd((c) => { c.decayMultipliers.age3 = Math.max(0, v); })} />
            <NumField label="Épocas mais antigas (×)" step={0.01} value={cfg.decayMultipliers.older} onChange={(v) => upd((c) => { c.decayMultipliers.older = Math.max(0, v); })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Normalização de Pnts por jogos</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Quando ativo, os pontos da liga (coluna <em>Pnts</em>) são divididos pelo número de jogos
              disputados (coluna <em>Jgs</em>) antes de serem somados ao ranking — útil para comparar
              épocas com calendários diferentes. Aplica-se a Super League e Ligas Nacionais.
            </p>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <input
              id="normPts"
              type="checkbox"
              className="size-4 accent-primary"
              checked={cfg.normalizePointsByGames}
              onChange={(e) => upd((c) => { c.normalizePointsByGames = e.target.checked; })}
            />
            <Label htmlFor="normPts" className="text-sm cursor-pointer">
              Dividir Pnts pelo nº de jogos (Jgs) em todos os rankings
            </Label>
          </CardContent>
        </Card>
      </div>

      <Accordion type="multiple" className="space-y-3">
        <AccordionItem value="div" className="border rounded-lg px-4">
          <AccordionTrigger>Pesos por divisão (SuperLeague)</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              <SortBar state={sortDiv} onChange={setSortDiv} />
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {sortNumKeys(divisions, cfg.divisionWeights, sortDiv).map((d) => (
                  <NumField key={d} label={`Div. ${d}`} step={0.01} value={cfg.divisionWeights[d] ?? 1} onChange={(v) => upd((c) => { c.divisionWeights[d] = v; })} />
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pos" className="border rounded-lg px-4">
          <AccordionTrigger>Pontos por posição</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              <SortBar state={sortPos} onChange={setSortPos} />
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {sortNumKeys(positions, cfg.positionPoints, sortPos).map((p) => (
                  <NumField key={p} label={`${p}.º lugar`} value={cfg.positionPoints[p] ?? 0} onChange={(v) => upd((c) => { c.positionPoints[p] = v; })} />
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="titles" className="border rounded-lg px-4">
          <AccordionTrigger>Pesos de títulos continentais</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              <p className="text-xs text-muted-foreground">
                Peso base atribuído a cada competição continental. O nome é comparado (sem acentos/maiúsculas) com a coluna <em>Competição</em> dos dados continentais.
                A pontuação final = peso do título × peso Continental × decaimento por época.
                Competições sem entrada nesta lista usam peso padrão 150.
              </p>
              <SortBar state={sortTitles} onChange={setSortTitles} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortIndices(cfg.titleWeights, sortTitles).map((i) => {
                  const t = cfg.titleWeights[i];
                  return (
                  <div key={i} className="flex items-end gap-2 rounded-lg border border-border p-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome da competição</Label>
                      <Input
                        value={t.label}
                        onChange={(e) => upd((c) => {
                          c.titleWeights[i].label = e.target.value;
                          c.titleWeights[i].match = e.target.value
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                        })}
                        className="h-9"
                      />
                    </div>
                    <div className="w-24">
                      <NumField label="Peso base" value={t.weight} onChange={(v) => upd((c) => { c.titleWeights[i].weight = v; })} />
                    </div>
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => upd((c) => { c.titleWeights.splice(i, 1); })}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" onClick={() => upd((c) => { c.titleWeights.push({ match: "", label: "Nova competição", weight: 150 }); })}>
                <Plus className="size-4" /> Adicionar competição
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="natleagues" className="border rounded-lg px-4">
          <AccordionTrigger>Pesos de Ligas Nacionais</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              <p className="text-xs text-muted-foreground">
                Multiplicador aplicado a pontos de posição, Pnts da liga e bónus de campeão das Ligas Nacionais.
                O nome é comparado (sem acentos/maiúsculas) com a coluna <em>Liga/Divisão</em> das classificações nacionais.
                Ligas sem entrada nesta lista usam multiplicador 1.
              </p>
              <SortBar state={sortNat} onChange={setSortNat} />
              <div className="grid grid-cols-1 gap-3">
                {sortIndices(cfg.nationalLeagueWeights, sortNat).map((i) => {
                  const t = cfg.nationalLeagueWeights[i];
                  const bonusEntries = Object.entries(t.positionBonuses ?? {})
                    .map(([k, v]) => [Number(k), Number(v)] as [number, number])
                    .sort((a, b) => a[0] - b[0]);
                  return (
                  <div key={i} className="rounded-lg border border-border p-2 space-y-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Nome da liga</Label>
                        <Input
                          value={t.label}
                          onChange={(e) => upd((c) => {
                            c.nationalLeagueWeights[i].label = e.target.value;
                            c.nationalLeagueWeights[i].match = e.target.value
                              .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                          })}
                          className="h-9"
                        />
                      </div>
                      <div className="w-24">
                        <NumField label="Peso (×)" step={0.05} value={t.weight} onChange={(v) => upd((c) => { c.nationalLeagueWeights[i].weight = v; })} />
                      </div>
                      <Button size="icon" variant="ghost" className="shrink-0" onClick={() => upd((c) => { c.nationalLeagueWeights.splice(i, 1); })}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="rounded-md bg-muted/30 p-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">Bónus por posição (opcional)</Label>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                          onClick={() => upd((c) => {
                            const e = c.nationalLeagueWeights[i];
                            e.positionBonuses ??= {};
                            const used = new Set(Object.keys(e.positionBonuses).map(Number));
                            let p = 1;
                            while (used.has(p)) p++;
                            e.positionBonuses[p] = 100;
                          })}>
                          <Plus className="size-3" /> Adicionar posição
                        </Button>
                      </div>
                      {bonusEntries.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">Sem bónus extra por posição. Adiciona uma posição para premiar (ex.: 1º +500, 2º +300).</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {bonusEntries.map(([pos, val]) => (
                            <div key={pos} className="flex items-end gap-1 rounded border border-border/60 bg-background p-1.5">
                              <div className="w-16 space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Posição</Label>
                                <Input type="number" min={1} step={1} value={pos} className="h-8 tabular-nums"
                                  onChange={(e) => upd((c) => {
                                    const ent = c.nationalLeagueWeights[i];
                                    const np = Number(e.target.value);
                                    if (!Number.isFinite(np) || np < 1) return;
                                    if (ent.positionBonuses && np !== pos) {
                                      const v = ent.positionBonuses[pos];
                                      delete ent.positionBonuses[pos];
                                      ent.positionBonuses[np] = v;
                                    }
                                  })}
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Bónus</Label>
                                <Input type="number" step="any" value={val} className="h-8 tabular-nums"
                                  onChange={(e) => upd((c) => {
                                    const ent = c.nationalLeagueWeights[i];
                                    (ent.positionBonuses ??= {})[pos] = Number(e.target.value);
                                  })}
                                />
                              </div>
                              <Button size="icon" variant="ghost" className="size-7 shrink-0"
                                onClick={() => upd((c) => {
                                  const ent = c.nationalLeagueWeights[i];
                                  if (ent.positionBonuses) delete ent.positionBonuses[pos];
                                })}>
                                <Trash2 className="size-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" onClick={() => upd((c) => { c.nationalLeagueWeights.push({ match: "", label: "Nova liga", weight: 1 }); })}>
                <Plus className="size-4" /> Adicionar liga nacional
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="intlcomps" className="border rounded-lg px-4">
          <AccordionTrigger>Pesos de competições Internacionais (Seleções)</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              <p className="text-xs text-muted-foreground">
                Peso base atribuído a cada competição de seleções (folha <em>Compts Seleções</em>).
                O nome é comparado (sem acentos/maiúsculas) com a coluna <em>Competição</em>.
                Competições sem entrada nesta lista usam peso padrão 150.
                Os pontos brutos escalam com o peso da competição: vencedor = peso, finalista = peso × 0.25, meia-final = peso × 0.125, quartos = peso × 0.06. O ponderado multiplica ainda por pesoComp × multFase × decaimento.
              </p>
              <SortBar state={sortIntl} onChange={setSortIntl} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortIndices(cfg.internationalWeights, sortIntl).map((i) => {
                  const t = cfg.internationalWeights[i];
                  return (
                  <div key={i} className="flex items-end gap-2 rounded-lg border border-border p-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome da competição</Label>
                      <Input
                        value={t.label}
                        onChange={(e) => upd((c) => {
                          c.internationalWeights[i].label = e.target.value;
                          c.internationalWeights[i].match = e.target.value
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                        })}
                        className="h-9"
                      />
                    </div>
                    <div className="w-24">
                      <NumField label="Peso base" value={t.weight} onChange={(v) => upd((c) => { c.internationalWeights[i].weight = v; })} />
                    </div>
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => upd((c) => { c.internationalWeights.splice(i, 1); })}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" onClick={() => upd((c) => { c.internationalWeights.push({ match: "", label: "Nova competição", weight: 150 }); })}>
                <Plus className="size-4" /> Adicionar competição internacional
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>


      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" /> Zona de perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Apaga permanentemente todas as épocas, classificações, treinadores, países, clubes, jogadores e
            resultados continentais já importados. Os perfis de configuração de pesos são preservados.
          </p>
          <Button variant="destructive" onClick={handleWipe} disabled={wiping}>
            {wiping ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Apagar todos os dados importados
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

