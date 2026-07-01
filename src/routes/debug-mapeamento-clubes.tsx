import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Bug, Download, AlertTriangle, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { CountryLink } from "@/components/CountryLink";
import { setManualClubMapping, removeManualClubMapping, getManualClubMappings, type ClubMapping } from "@/lib/fm-club-map";

export const Route = createFileRoute("/debug-mapeamento-clubes")({
  head: () => ({ meta: [{ title: "Debug · Mapeamento de Clubes — FM World Rankings" }] }),
  component: DebugMapeamentoClubes,
});

type Flag = "sem_competicao" | "duplicado" | "multiplas_competicoes" | "pais_inconsistente" | "nao_encontrado";

const FLAG_LABEL: Record<Flag, string> = {
  sem_competicao: "Sem competição",
  duplicado: "Duplicado",
  multiplas_competicoes: "Múltiplas competições",
  pais_inconsistente: "País inconsistente",
  nao_encontrado: "Não encontrado",
};

interface RowDetail {
  season: number | null;
  club: string;
  clubId: string;
  competition: string;
  division: string | null;
  country: string | null;
  comp_type: string;
  source: string;
  players: number;
  lastSeen: number;
  flags: Flag[];
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function DebugMapeamentoClubes() {
  const { data, isLoading } = usePlayerStatsData();
  const [search, setSearch] = useState("");
  const [flagFilter, setFlagFilter] = useState<Flag | "all">("all");
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [, force] = useState(0);

  const details = useMemo<RowDetail[]>(() => {
    if (!data?.clubMap) return [];
    const map = data.clubMap;
    const out: RowDetail[] = [];

    // Per-season entries
    for (const [season, sm] of map.bySeason) {
      for (const [club, m] of sm) {
        const flags: Flag[] = [];
        const conflict = map.conflicts.find((c) => c.season === season && c.club === club);
        if (conflict) flags.push("multiplas_competicoes");
        // Country inconsistency: same club has different country across seasons
        const otherCountries = new Set<string>();
        for (const [oy, osm] of map.bySeason) {
          if (oy === season) continue;
          const other = osm.get(club);
          if (other?.country) otherCountries.add(other.country);
        }
        if (m.country && otherCountries.size && !otherCountries.has(m.country)) {
          flags.push("pais_inconsistente");
        }
        out.push({
          season,
          club,
          clubId: m.clubId,
          competition: m.competition,
          division: m.division,
          country: m.country,
          comp_type: m.comp_type,
          source: m.source,
          players: m.players,
          lastSeen: map.lastSeenByClub.get(club) ?? season,
          flags,
        });
      }
    }

    // Unmapped clubs
    for (const club of map.unmapped) {
      out.push({
        season: null,
        club,
        clubId: map.clubIds.get(club) ?? "",
        competition: "",
        division: null,
        country: null,
        comp_type: "",
        source: "",
        players: map.playersByClub.get(club) ?? 0,
        lastSeen: map.lastSeenByClub.get(club) ?? 0,
        flags: ["nao_encontrado", "sem_competicao"],
      });
    }

    // Duplicated club names (same canonical appears in >1 seasons is normal;
    // flag only when >1 ClubID resolves to visually identical club names — future guard)
    const seenIds = new Map<string, string[]>();
    for (const [club, id] of map.clubIds) {
      const list = seenIds.get(id) ?? [];
      list.push(club);
      seenIds.set(id, list);
    }
    for (const [id, clubs] of seenIds) {
      if (clubs.length > 1) {
        for (const c of clubs) {
          out.filter((r) => r.clubId === id && r.club === c).forEach((r) => {
            if (!r.flags.includes("duplicado")) r.flags.push("duplicado");
          });
        }
      }
    }

    return out.sort((a, b) => (b.season ?? -1) - (a.season ?? -1) || a.club.localeCompare(b.club));
  }, [data]);

  const seasons = useMemo(() => {
    const s = new Set<number>();
    details.forEach((d) => { if (d.season != null) s.add(d.season); });
    return [...s].sort((a, b) => b - a);
  }, [details]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return details.filter((d) => {
      if (flagFilter !== "all" && !d.flags.includes(flagFilter)) return false;
      if (seasonFilter !== "all" && String(d.season ?? "") !== seasonFilter) return false;
      if (q) {
        const hay = `${d.club} ${d.competition} ${d.country ?? ""} ${d.clubId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [details, search, flagFilter, seasonFilter]);

  const counts = useMemo(() => {
    const c: Record<Flag, number> = {
      sem_competicao: 0, duplicado: 0, multiplas_competicoes: 0, pais_inconsistente: 0, nao_encontrado: 0,
    };
    details.forEach((d) => d.flags.forEach((f) => c[f]++));
    return c;
  }, [details]);

  function exportCSV() {
    const headers = ["Época", "Clube", "ClubID", "Competição", "Divisão", "País", "Tipo", "Origem", "Jogadores", "Última época", "Alertas"];
    const lines = [headers.join(";")];
    for (const d of filtered) {
      lines.push([
        d.season ?? "",
        d.club, d.clubId, d.competition, d.division ?? "", d.country ?? "",
        d.comp_type, d.source, d.players, d.lastSeen,
        d.flags.map((f) => FLAG_LABEL[f]).join("|"),
      ].map(csvEscape).join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `mapeamento-clubes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resolveConflict(season: number, club: string, chosen: ClubMapping) {
    setManualClubMapping(season, club, chosen);
    force((x) => x + 1);
  }
  function clearOverride(season: number, club: string) {
    removeManualClubMapping(season, club);
    force((x) => x + 1);
  }
  const manual = getManualClubMappings();

  if (isLoading || !data) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> A carregar…</div>;
  }

  const conflicts = data.clubMap?.conflicts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bug className="size-6 text-primary" /> Debug · Mapeamento de Clubes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Fonte oficial: Super Leagues + Ligas Nacionais. Um jogador emprestado nunca reclassifica o clube destino.
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="size-4 mr-2" /> Exportar CSV</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {(Object.keys(FLAG_LABEL) as Flag[]).map((f) => (
          <Card key={f}>
            <CardContent className="pt-6">
              <p className={`text-2xl font-bold tabular-nums ${counts[f] ? "text-amber-500" : "text-success"}`}>{counts[f]}</p>
              <p className="text-xs text-muted-foreground mt-1">{FLAG_LABEL[f]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" /> Resolução manual de conflitos ({conflicts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {conflicts.map((c) => {
              const key = `${c.season}|${c.club}`;
              const chosen = manual[key];
              return (
                <div key={key} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-sm font-medium">
                      <Link to="/clubes/$name" params={{ name: c.club }} className="hover:text-primary">{c.club}</Link>
                      <span className="text-muted-foreground text-xs ml-2">Época {c.season}</span>
                    </div>
                    {chosen && (
                      <Button size="sm" variant="ghost" onClick={() => clearOverride(c.season, c.club)}>
                        <X className="size-3 mr-1" /> Remover override
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {c.candidates.map((cand, i) => {
                      const isChosen = chosen && chosen.competition === cand.competition && chosen.comp_type === cand.comp_type;
                      return (
                        <button
                          key={i}
                          onClick={() => resolveConflict(c.season, c.club, cand)}
                          className={`text-left rounded-md border p-2 text-xs hover:border-primary transition-colors ${isChosen ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                          <div className="flex items-center gap-1">
                            {isChosen && <Check className="size-3 text-primary" />}
                            <Badge variant="outline">{cand.comp_type}</Badge>
                            <span className="font-medium">{cand.competition}</span>
                          </div>
                          <div className="text-muted-foreground mt-1">
                            <CountryLink name={cand.country} /> · fonte: {cand.source}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapeamento por época</CardTitle>
          <div className="grid gap-2 md:grid-cols-4 mt-3">
            <Input placeholder="Pesquisar clube/competição/país…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={String(seasonFilter)} onValueChange={setSeasonFilter}>
              <SelectTrigger><SelectValue placeholder="Época" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as épocas</SelectItem>
                {seasons.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={flagFilter} onValueChange={(v) => setFlagFilter(v as Flag | "all")}>
              <SelectTrigger><SelectValue placeholder="Alertas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(Object.keys(FLAG_LABEL) as Flag[]).map((f) => (
                  <SelectItem key={f} value={f}>{FLAG_LABEL[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center text-xs text-muted-foreground">
              {filtered.length} de {details.length} entradas
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border sticky top-0 bg-background">
                <tr>
                  <th className="text-left py-2 pr-3 w-16">Época</th>
                  <th className="text-left py-2 pr-3">Clube</th>
                  <th className="text-left py-2 pr-3">Competição</th>
                  <th className="text-left py-2 pr-3">Divisão</th>
                  <th className="text-left py-2 pr-3">País</th>
                  <th className="text-left py-2 pr-3">Tipo</th>
                  <th className="text-left py-2 pr-3">Origem</th>
                  <th className="text-right py-2 pr-3">Jog.</th>
                  <th className="text-right py-2 pr-3">Última</th>
                  <th className="text-left py-2 pr-3">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={`${d.season}-${d.club}-${i}`} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="py-1.5 pr-3 tabular-nums">{d.season ?? "—"}</td>
                    <td className="py-1.5 pr-3 font-medium">
                      <Link to="/clubes/$name" params={{ name: d.club }} className="hover:text-primary">{d.club}</Link>
                      <span className="text-[10px] text-muted-foreground ml-1">{d.clubId}</span>
                    </td>
                    <td className="py-1.5 pr-3">{d.competition || "—"}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{d.division ?? "—"}</td>
                    <td className="py-1.5 pr-3"><CountryLink name={d.country} /></td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{d.comp_type || "—"}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{d.source || "—"}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{d.players}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{d.lastSeen || "—"}</td>
                    <td className="py-1.5 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {d.flags.map((f) => (
                          <Badge key={f} variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">{FLAG_LABEL[f]}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">Sem resultados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}