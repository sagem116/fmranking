import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { parsePlayerStatsWorkbook, type PlayerStatsParseResult } from "@/lib/fm-player-stats-parser";
import { importPlayerStats, logPlayerStatsImport } from "@/lib/fm-player-stats-db";
import { appendSnapshot, buildSnapshotFromRows } from "@/lib/fm-insights-snapshots";

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
    try {
      for (const e of entries) {
        // Re-parse with current year (in case the user changed it)
        const buf = await e.file.arrayBuffer();
        const parse = parsePlayerStatsWorkbook(buf, year);
        const result = await importPlayerStats(parse.rows, year);
        await logPlayerStatsImport(year, e.file.name, parse.skippedSheets);
        try {
          appendSnapshot(buildSnapshotFromRows(parse.rows, year, `import:${e.file.name}`));
        } catch { /* snapshot is best-effort */ }
        toast.success(
          `${e.file.name}: ${result.inserted} registos importados (${result.types.map((t) => COMP_LABEL[t]).join(", ")})`,
        );
      }
      qc.removeQueries({ queryKey: ["player-stats-all"] });
      await qc.invalidateQueries({ queryKey: ["player-stats-all"] });
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
    </Card>
  );
}
