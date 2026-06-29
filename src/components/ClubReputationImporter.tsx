import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchAllPlayerStats } from "@/lib/fm-player-stats-db";
import { fetchAllData } from "@/lib/fm-db";
import {
  parseClubReputationWorkbook,
  matchReputations,
  applyReputationImport,
  type ReputationImportResult,
} from "@/lib/fm-club-reputation";

export function ClubReputationImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReputationImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const knownQ = useQuery({
    queryKey: ["known-clubs"],
    queryFn: async () => {
      const [stats, base] = await Promise.all([fetchAllPlayerStats(), fetchAllData()]);
      const set = new Set<string>();
      for (const s of stats) if (s.club) set.add(s.club);
      for (const s of base.standings) if (s.club_name) set.add(s.club_name);
      return [...set];
    },
    staleTime: 5 * 60 * 1000,
  });

  const matchedRate = useMemo(() => {
    if (!preview || !preview.total) return 0;
    return Math.round((preview.matched.length / preview.total) * 100);
  }, [preview]);

  async function handleFile(f: File) {
    setFile(f);
    setPreview(null);
    const buf = await f.arrayBuffer();
    const rows = parseClubReputationWorkbook(buf);
    if (!rows.length) {
      toast.error("Ficheiro sem linhas válidas (espera colunas 'Clube' e 'Reputação')");
      return;
    }
    const known = knownQ.data ?? [];
    const result = matchReputations(rows, known);
    setPreview(result);
  }

  function runImport(saveUnmatched: boolean) {
    if (!preview) return;
    setBusy(true);
    try {
      applyReputationImport(preview, { saveUnmatched });
      toast.success(`Reputação atualizada · ${preview.matched.length} clubes${saveUnmatched ? ` (+${preview.unmatched.length} sem normalização)` : ""}`);
      setFile(null);
      setPreview(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Importar Reputação de Clubes</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Ficheiro Excel com duas colunas: <em>Clube</em> (nome por extenso) e <em>Reputação</em>. Os nomes são normalizados automaticamente; pode editar o mapeamento em <em>Debug · Reputação Clubes</em>.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        >
          <UploadCloud className="size-7 text-primary" />
          <p className="text-sm">Arraste o ficheiro ou clique para selecionar</p>
          <Input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>

        {file && (
          <Card className="bg-muted/30">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm flex items-center gap-2"><FileSpreadsheet className="size-4 text-primary" /> {file.name}</CardTitle>
              {preview && (
                <Badge variant="secondary">{preview.total} linhas · {matchedRate}% normalizadas</Badge>
              )}
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              {knownQ.isLoading && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-3 animate-spin" /> A obter lista de clubes…</p>}
              {preview && (
                <>
                  <div className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-success" /> {preview.matched.length} clubes normalizados</div>
                  {preview.unmatched.length > 0 && (
                    <div className="flex items-center gap-2"><AlertTriangle className="size-3.5 text-warning" /> {preview.unmatched.length} sem correspondência (ex.: {preview.unmatched.slice(0, 5).map((u) => u.raw).join(", ")}{preview.unmatched.length > 5 ? "…" : ""})</div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {preview && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => runImport(false)} disabled={busy || !preview.matched.length}>
              {busy && <Loader2 className="size-4 animate-spin" />} Aplicar ({preview.matched.length})
            </Button>
            {preview.unmatched.length > 0 && (
              <Button variant="outline" onClick={() => runImport(true)} disabled={busy}>
                Guardar tudo (inclui sem normalização)
              </Button>
            )}
            <Button variant="ghost" onClick={() => { setFile(null); setPreview(null); }} disabled={busy}>Limpar</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}