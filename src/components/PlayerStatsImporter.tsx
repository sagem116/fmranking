import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, Loader2, Bug, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { parsePlayerStatsWorkbook, type PlayerStatsParseResult } from "@/lib/fm-player-stats-parser";
import { importPlayerStats, logPlayerStatsImport, fetchAllPlayerStats } from "@/lib/fm-player-stats-db";
import { appendSnapshot, buildSnapshotFromRows } from "@/lib/fm-insights-snapshots";
import { buildClubMap, hasSeasonMapping } from "@/lib/fm-club-map";
import { fetchClubMapSources } from "@/lib/fm-club-map-db";
import { normalizeCountry, continentOf } from "@/lib/fm-continents";

interface FileEntry {
  file: File;
  parse: PlayerStatsParseResult;
}

const COMP_LABEL: Record<string, string> = {
  superleague: "Super Leagues",
  national: "Ligas Nacionais",
  continental: "Continentais",
  international: "Internacional",
};

export function PlayerStatsImporter() {
  const qc = useQueryClient();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [report, setReport] = useState<null | {
    files: string[];
    players: number;
    clubs: number;
    competitions: number;
    clubsSemCompeticao: number;
    clubsDuplicados: number;
    paisesNaoReconhecidos: string[];
    competicoesSemDivisao: number;
    warnings: string[];
  }>(null);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => /\.xlsx?$/i.test(f.name));
    if (!arr.length) {
      toast.error("Selecione ficheiros Excel (.xlsx)");
      return;
    }
    const parsed: FileEntry[] = [];
    for (const file of arr) {
      const buf = await file.arrayBuffer();
      parsed.push({ file, parse: parsePlayerStatsWorkbook(buf, year) });
    }
    setEntries((prev) => {
      const byName = new Map(prev.map((e) => [e.file.name, e]));
      parsed.forEach((p) => byName.set(p.file.name, p));
      return [...byName.values()];
    });
  }

  async function runImport() {
    setImporting(true);
    const filesDone: string[] = [];
    const allWarnings: string[] = [];
    try {
      // ⚠ SSOT guard: refuse to import player rows for a season that has no
      // clubMap yet (no Importar Época performed for that season).
      const preSources = await fetchClubMapSources();
      const preMap = buildClubMap(preSources);
      const seasonsNeeded = new Set<number>();
      for (const e of entries) for (const r of e.parse.rows) seasonsNeeded.add(r.season_year);
      const missing = [...seasonsNeeded].filter((y) => !hasSeasonMapping(preMap, y));
      if (missing.length > 0) {
        toast.error(
          `Ainda não existe mapeamento de clubes para ${missing.length === 1 ? "a época" : "as épocas"} ${missing.join(", ")}. ` +
            `Importe primeiro através de 'Importar Época' antes de importar os jogadores.`,
          { duration: 8000 },
        );
        setImporting(false);
        return;
      }
      for (const e of entries) {
        // Re-parse with current year (in case the user changed it)
        const buf = await e.file.arrayBuffer();
        const parse = parsePlayerStatsWorkbook(buf, year);
        const result = await importPlayerStats(parse.rows, year);
        await logPlayerStatsImport(year, e.file.name, parse.skippedSheets);
        try {
          appendSnapshot(buildSnapshotFromRows(parse.rows, year, `import:${e.file.name}`));
        } catch { /* snapshot is best-effort */ }
        filesDone.push(e.file.name);
        allWarnings.push(...parse.skippedSheets);
        toast.success(
          `${e.file.name}: ${result.inserted} registos importados (${result.types.map((t) => COMP_LABEL[t]).join(", ")})`,
        );
      }
      qc.removeQueries({ queryKey: ["player-stats-all"] });
      await qc.invalidateQueries({ queryKey: ["player-stats-all"] });

      // Post-import summary — recompute against the full DB state.
      try {
        const [all, sources] = await Promise.all([
          fetchAllPlayerStats(),
          fetchClubMapSources(),
        ]);
        const map = buildClubMap(sources, all);
        const clubs = new Set<string>();
        const comps = new Set<string>();
        const compsSemDivisao = new Set<string>();
        const unknownCountries = new Set<string>();
        for (const r of all) {
          if (r.club) clubs.add(r.club);
          if (r.competition) comps.add(r.competition);
          if (r.comp_type === "superleague" && !r.competition) compsSemDivisao.add(r.competition || "?");
          const c = r.country ?? r.nationality;
          if (c) {
            const canon = normalizeCountry(c);
            if (!continentOf(canon)) unknownCountries.add(c);
          }
        }
        const duplicated = new Set<string>();
        const byId = new Map<string, Set<string>>();
        for (const [club, id] of map.clubIds) {
          const s = byId.get(id) ?? new Set();
          s.add(club); byId.set(id, s);
        }
        for (const [, s] of byId) if (s.size > 1) s.forEach((c) => duplicated.add(c));

        setReport({
          files: filesDone,
          players: all.length,
          clubs: clubs.size,
          competitions: comps.size,
          clubsSemCompeticao: map.unmapped.size,
          clubsDuplicados: duplicated.size,
          paisesNaoReconhecidos: [...unknownCountries],
          competicoesSemDivisao: compsSemDivisao.size,
          warnings: allWarnings,
        });
      } catch {
        /* report is best-effort */
      }
      setEntries([]);
      toast.success(`Importação concluída — Época ${year}`);
    } catch (err) {
      toast.error(`Erro ao importar: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Importar Jogadores & Competições (multi-folha)</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Aceita um único Excel com as folhas <em>Divisão</em>, <em>Ligas Nacionais</em>, <em>Continental</em> e/ou <em>Internacional</em>. Folhas ausentes são ignoradas. Reimportar a mesma época substitui os dados anteriores das folhas presentes.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3 max-w-xs">
          <div className="flex-1">
            <Label htmlFor="ps-year">Ano da época</Label>
            <Input id="ps-year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="mt-1" />
          </div>
        </div>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          <UploadCloud className="size-8 text-primary" />
          <div className="text-center">
            <p className="font-medium text-sm">Arraste o ficheiro ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground">jogadores_{year}.xlsx</p>
          </div>
          <Input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        </label>

        {entries.map((e) => (
          <Card key={e.file.name} className="bg-muted/30">
            <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-primary" />
                {e.file.name}
              </CardTitle>
              <Badge variant="secondary">{e.parse.rows.length} jogadores</Badge>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              {Object.values(e.parse.bySheet).map((s) => (
                <div key={s.sheet} className="flex items-center gap-2">
                  <Badge variant="outline">{COMP_LABEL[s.comp_type]}</Badge>
                  <span className="text-muted-foreground">folha "{s.sheet}" — {s.count} linhas</span>
                </div>
              ))}
              {e.parse.skippedSheets.length > 0 && (
                <p className="text-muted-foreground italic">Ignoradas: {e.parse.skippedSheets.join(", ")}</p>
              )}
            </CardContent>
          </Card>
        ))}

        {entries.length > 0 && (
          <div className="flex items-center gap-3">
            <Button onClick={runImport} disabled={importing}>
              {importing && <Loader2 className="size-4 animate-spin" />}
              Importar
            </Button>
            <Button variant="ghost" onClick={() => setEntries([])} disabled={importing}>Limpar</Button>
          </div>
        )}
      </CardContent>

      <Dialog open={!!report} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-success" /> Resumo da Importação
            </DialogTitle>
          </DialogHeader>
          {report && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Jogadores" value={report.players} />
                <Stat label="Clubes" value={report.clubs} />
                <Stat label="Competições" value={report.competitions} />
                <Stat label="Ficheiros" value={report.files.length} />
                <Stat label="Sem competição" value={report.clubsSemCompeticao} warn={report.clubsSemCompeticao > 0} />
                <Stat label="Clubes duplicados" value={report.clubsDuplicados} warn={report.clubsDuplicados > 0} />
                <Stat label="Comp. sem divisão" value={report.competicoesSemDivisao} warn={report.competicoesSemDivisao > 0} />
                <Stat label="Países desconhecidos" value={report.paisesNaoReconhecidos.length} warn={report.paisesNaoReconhecidos.length > 0} />
              </div>
              {report.paisesNaoReconhecidos.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2 text-amber-500 text-xs font-medium mb-1">
                    <AlertTriangle className="size-3" /> Países não reconhecidos
                  </div>
                  <p className="text-xs text-muted-foreground">{report.paisesNaoReconhecidos.slice(0, 20).join(", ")}{report.paisesNaoReconhecidos.length > 20 ? "…" : ""}</p>
                </div>
              )}
              {report.warnings.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Avisos do parser ({report.warnings.length})</summary>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
                    {report.warnings.slice(0, 100).map((w, i) => <li key={i} className="text-muted-foreground">• {w}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReport(null)}>Fechar</Button>
            <Button asChild>
              <Link to="/debug-mapeamento-clubes"><Bug className="size-4 mr-2" /> Abrir Debug de Mapeamento</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-amber-500/40 bg-amber-500/5" : "border-border"}`}>
      <p className={`text-2xl font-bold tabular-nums ${warn ? "text-amber-500" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
