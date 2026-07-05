import { useState, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, XCircle, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  parseCompetitionsFile,
  parsePlayersFile,
  validate,
  type ParsedCompetitionsFile,
  type ParsedPlayersFile,
  type ValidationReport,
} from "@/lib/fm-import-v2";
import {
  importCompetitionsFile,
  importPlayersFile,
} from "@/lib/fm-import-v2-writers";

interface FileSlot<T> {
  file: File;
  parsed: T;
}

export function SeasonImporterV2() {
  const qc = useQueryClient();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [comp, setComp] = useState<FileSlot<ParsedCompetitionsFile> | null>(null);
  const [players, setPlayers] = useState<FileSlot<ParsedPlayersFile> | null>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ValidationReport | null>(null);

  const compFatal = comp?.parsed.fatal ?? [];
  const playersFatal = players?.parsed.fatal ?? [];

  const validation = useMemo<ValidationReport | null>(() => {
    if (!comp && !players) return null;
    const c = comp?.parsed ?? {
      clubCountry: [], clubReputation: [], competitionReputation: [], coaches: [],
      standings: [], continental: [], international: [], presentSheets: [], ignoredSheets: [],
      warnings: [], fatal: [],
    } as ParsedCompetitionsFile;
    const p = players?.parsed ?? {
      players: [], bySheet: {}, ignoredSheets: [], warnings: [], fatal: [],
    } as ParsedPlayersFile;
    return validate(c, p);
  }, [comp, players]);

  async function handleFile(kind: "comp" | "players", file: File) {
    try {
      const buf = await file.arrayBuffer();
      if (kind === "comp") {
        setComp({ file, parsed: parseCompetitionsFile(buf) });
      } else {
        setPlayers({ file, parsed: parsePlayersFile(buf) });
      }
    } catch (err) {
      toast.error(`Erro a ler ${file.name}: ${(err as Error).message}`);
    }
  }

  async function runImport() {
    if (!comp && !players) return;
    setImporting(true);
    try {
      if (comp) {
        const r = await importCompetitionsFile(year, comp.parsed);
        toast.success(`Competições ${year}: ${r.standingsInserted} classificações · ${r.coachAssignmentsInserted} treinadores · ${r.competitionReputationRows} reputações de comp.`);
      }
      if (players) {
        const r = await importPlayersFile(year, players.parsed, comp?.parsed.clubCountry ?? []);
        toast.success(`Jogadores ${year}: ${r.inserted} registos (${r.sheets.join(", ")})`);
      }
      qc.removeQueries();
      await qc.invalidateQueries();
      setReport(validation);
      setComp(null);
      setPlayers(null);
      toast.success(`Época ${year} importada com sucesso.`);
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  const canImport = year > 1900 && (comp || players) &&
    compFatal.length === 0 && playersFatal.length === 0 && !importing;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Época</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label htmlFor="year-v2">Ano</Label>
            <Input id="year-v2" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Dropzone
          title="Ficheiro de Competições"
          subtitle="Clube País · Reputações · Treinador · Super League · Ligas Nacionais · Continentais · Internacional"
          file={comp?.file}
          onFile={(f) => handleFile("comp", f)}
          onClear={() => setComp(null)}
        />
        <Dropzone
          title="Ficheiro de Jogadores"
          subtitle="Super League · Ligas Nacionais · Continentais · Internacionais"
          file={players?.file}
          onFile={(f) => handleFile("players", f)}
          onClear={() => setPlayers(null)}
        />
      </div>

      {comp && <FilePreviewComp parsed={comp.parsed} filename={comp.file.name} />}
      {players && <FilePreviewPlayers parsed={players.parsed} filename={players.file.name} />}

      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <ReportCard report={validation} title="Pré-validação" />
      )}

      <div className="flex items-center gap-3">
        <Button size="lg" onClick={runImport} disabled={!canImport}>
          {importing && <Loader2 className="size-4 animate-spin mr-2" />}
          Importar época {year}
        </Button>
        {(compFatal.length > 0 || playersFatal.length > 0) && (
          <span className="text-sm text-destructive">Corrija os erros vermelhos antes de importar.</span>
        )}
      </div>

      {report && <ReportCard report={report} title={`Relatório da importação — Época ${year}`} />}
    </div>
  );
}

function Dropzone({
  title, subtitle, file, onFile, onClear,
}: {
  title: string;
  subtitle: string;
  file: File | undefined;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && /\.xlsx?$/i.test(f.name)) onFile(f);
      }}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors min-h-[160px] ${
        over ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      }`}
    >
      <UploadCloud className="size-6 text-primary" />
      <p className="font-medium text-sm text-center">{title}</p>
      <p className="text-xs text-muted-foreground text-center">{subtitle}</p>
      {file ? (
        <div className="flex items-center gap-2 mt-1 rounded-md bg-muted px-3 py-1.5">
          <FileSpreadsheet className="size-4 text-primary" />
          <span className="text-xs truncate max-w-[200px]">{file.name}</span>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onClear(); }}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <span className="text-[11px] text-muted-foreground mt-1">Arraste ou clique</span>
      )}
      <Input
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function FilePreviewComp({ parsed, filename }: { parsed: ParsedCompetitionsFile; filename: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-primary" /> {filename}
        </CardTitle>
        <Badge variant="secondary">Competições</Badge>
      </CardHeader>
      <CardContent className="text-xs space-y-1">
        <Grid>
          <Stat label="Clube Pais" v={parsed.clubCountry.length} />
          <Stat label="Reputação Clubes" v={parsed.clubReputation.length} />
          <Stat label="Reputação Competições" v={parsed.competitionReputation.length} />
          <Stat label="Treinadores" v={parsed.coaches.length} />
          <Stat label="Standings" v={parsed.standings.length} />
          <Stat label="Continentais" v={parsed.continental.length} />
          <Stat label="Internacional" v={parsed.international.length} />
          <Stat label="Folhas reconhecidas" v={parsed.presentSheets.length} />
        </Grid>
        {parsed.ignoredSheets.length > 0 && (
          <p className="text-muted-foreground italic pt-1">Ignoradas: {parsed.ignoredSheets.join(", ")}</p>
        )}
        {parsed.fatal.length > 0 && parsed.fatal.map((m, i) => (
          <p key={i} className="text-destructive flex items-center gap-1"><XCircle className="size-3" /> {m}</p>
        ))}
      </CardContent>
    </Card>
  );
}

function FilePreviewPlayers({ parsed, filename }: { parsed: ParsedPlayersFile; filename: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-primary" /> {filename}
        </CardTitle>
        <Badge variant="secondary">Jogadores</Badge>
      </CardHeader>
      <CardContent className="text-xs space-y-1">
        <Grid>
          {Object.values(parsed.bySheet).map((s) => (
            <Stat key={s.sheet} label={s.sheet} v={s.count} />
          ))}
          <Stat label="Total jogadores" v={parsed.players.length} />
        </Grid>
        {parsed.ignoredSheets.length > 0 && (
          <p className="text-muted-foreground italic pt-1">Ignoradas: {parsed.ignoredSheets.join(", ")}</p>
        )}
        {parsed.fatal.length > 0 && parsed.fatal.map((m, i) => (
          <p key={i} className="text-destructive flex items-center gap-1"><XCircle className="size-3" /> {m}</p>
        ))}
      </CardContent>
    </Card>
  );
}

function ReportCard({ report, title }: { report: ValidationReport; title: string }) {
  const { stats } = report;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {report.errors.length > 0 ? <XCircle className="size-4 text-destructive" /> : <CheckCircle2 className="size-4 text-success" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Grid>
          <Stat label="Clubes (Clube Pais)" v={stats.clubsInCountryMap} />
          <Stat label="Clubes com reputação" v={stats.clubsWithReputation} />
          <Stat label="Comp. com reputação" v={stats.competitionsWithReputation} />
          <Stat label="Treinadores" v={stats.coaches} />
          <Stat label="Treinadores seleções" v={stats.nationalTeamCoaches} />
          <Stat label="Standings" v={stats.standings} />
          <Stat label="Continentais" v={stats.continentalRows} />
          <Stat label="Internacional" v={stats.internationalRows} />
          <Stat label="Jogadores" v={stats.players} />
        </Grid>

        {report.errors.length > 0 && (
          <Section title="Erros" items={report.errors} icon={XCircle} tone="destructive" />
        )}

        {stats.clubsWithoutCountry.length > 0 &&
          <IssueList title="Clubes sem país" items={stats.clubsWithoutCountry} />}
        {stats.duplicateClubs.length > 0 &&
          <IssueList title="Clubes duplicados (Clube Pais)" items={stats.duplicateClubs} />}
        {stats.clubsWithoutReputation.length > 0 &&
          <IssueList title="Clubes sem reputação" items={stats.clubsWithoutReputation} />}
        {stats.clubsWithoutPlayers.length > 0 &&
          <IssueList title="Clubes sem jogadores" items={stats.clubsWithoutPlayers} />}
        {stats.competitionsWithoutReputation.length > 0 &&
          <IssueList title="Competições sem reputação" items={stats.competitionsWithoutReputation} />}
        {stats.unmappedClubsInPlayers.length > 0 &&
          <IssueList title="Clubes em jogadores mas não em Clube Pais" items={stats.unmappedClubsInPlayers} />}
        {stats.coachesWithoutAssignment.length > 0 &&
          <IssueList title="Treinadores sem clube nem seleção" items={stats.coachesWithoutAssignment} />}
        {stats.playersWithoutClub > 0 &&
          <p className="text-warning">{stats.playersWithoutClub} jogador(es) sem clube.</p>}

        {report.warnings.length > 0 && (
          <Section title="Avisos" items={report.warnings} icon={AlertTriangle} tone="warning" />
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title, items, icon: Icon, tone,
}: {
  title: string;
  items: string[];
  icon: typeof CheckCircle2;
  tone: "destructive" | "warning";
}) {
  return (
    <details className="text-xs" open={tone === "destructive"}>
      <summary className={`cursor-pointer font-medium ${tone === "destructive" ? "text-destructive" : "text-warning"}`}>
        {title} ({items.length})
      </summary>
      <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
        {items.slice(0, 200).map((m, i) => (
          <li key={i} className="flex items-start gap-1">
            <Icon className={`size-3 shrink-0 mt-0.5 ${tone === "destructive" ? "text-destructive" : "text-warning"}`} />
            <span>{m}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function IssueList({ title, items }: { title: string; items: string[] }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-warning font-medium">
        {title} ({items.length})
      </summary>
      <p className="mt-1 text-muted-foreground">{items.slice(0, 100).join(", ")}{items.length > 100 ? "…" : ""}</p>
    </details>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{children}</div>;
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
      <p className="text-base font-bold tabular-nums leading-none">{v}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

// Re-export for convenience (unused vars keep TS quiet)
void useQuery;
