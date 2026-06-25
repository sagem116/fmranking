import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Bug, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRankings } from "@/lib/useRankings";
import { buildPlayerKey, computeGoals, computeAssists, computePerformance } from "@/lib/fm-players";

export const Route = createFileRoute("/debug-jogadores")({
  head: () => ({ meta: [{ title: "Debug · Jogadores — FM World Rankings" }] }),
  component: DebugJogadores,
});

function DebugJogadores() {
  const { data, isLoading } = useRankings();
  if (isLoading || !data) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> A carregar…</div>;
  }

  const players = data.data.players;
  const { warnings } = buildPlayerKey(players);
  const dupUid = warnings.filter((w) => w.reason === "duplicate-uid");
  const noUid = warnings.filter((w) => w.reason === "no-uid");

  const goals = computeGoals(players);
  const assists = computeAssists(players);
  const perf = computePerformance(players);

  const seasons = [...new Set(players.map((p) => p.season_year))].sort((a, b) => a - b);
  const totalRecords = players.length;
  const uniqueIdus = new Set(players.filter((p) => p.idu).map((p) => p.idu)).size;
  const noIduCount = players.filter((p) => !p.idu).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bug className="size-6 text-primary" /> Debug · Jogadores
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Unificação por IDU/UID e rankings de jogadores</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Registos totais" value={totalRecords} />
        <Stat label="Épocas" value={seasons.length} />
        <Stat label="IDUs únicos" value={uniqueIdus} />
        <Stat label="Sem IDU" value={noIduCount} tone={noIduCount ? "warn" : "ok"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="size-4 text-primary" /> Como são unidos os jogadores
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>1. Cada jogador é unido entre épocas pela coluna <b>IDU/UID</b>.</p>
          <p>2. Se um IDU aparecer associado a vários nomes diferentes, é considerado <b>ambíguo</b> e usa-se o fallback <b>Nome + Clube</b>.</p>
          <p>3. Se o jogador não tiver IDU, usa-se também o fallback <b>Nome + Clube</b>.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> IDUs ambíguos ({dupUid.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dupUid.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum IDU repetido em jogadores diferentes.</p>
          ) : (
            <div className="overflow-x-auto max-h-[360px]">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border sticky top-0 bg-background">
                  <tr>
                    <th className="text-left py-2 pr-3">IDU</th>
                    <th className="text-left py-2 pr-3">Nomes encontrados</th>
                    <th className="text-left py-2 pr-3">Clubes</th>
                  </tr>
                </thead>
                <tbody>
                  {dupUid.map((w, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-1.5 pr-3 font-mono text-xs">{w.idu}</td>
                      <td className="py-1.5 pr-3">{w.names.join(" · ")}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{w.clubs.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> Jogadores sem IDU ({noUid.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {noUid.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os jogadores têm IDU.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-[240px] overflow-y-auto">
              {noUid.slice(0, 500).map((w, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {w.names[0]} {w.clubs[0] ? <span className="text-muted-foreground ml-1">· {w.clubs[0]}</span> : null}
                </Badge>
              ))}
              {noUid.length > 500 && (
                <span className="text-xs text-muted-foreground">… e mais {noUid.length - 500}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <RankCard title="Golos (total)" rows={goals.rows.slice(0, 100).map((r) => ({ name: r.name, value: r.total }))} unit="gls" />
        <RankCard title="Assistências (total)" rows={assists.rows.slice(0, 100).map((r) => ({ name: r.name, value: r.total }))} unit="ast" />
        <RankCard title="Performance (G+A)" rows={perf.slice(0, 100).map((r) => ({ name: r.name, value: r.total }))} unit="pts" />
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "ok" | "warn" }) {
  const color = tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <p className={`text-3xl font-bold tabular-nums ${color}`}>{value.toLocaleString("pt-PT")}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function RankCard({ title, rows, unit }: { title: string; rows: { name: string; value: number }[]; unit: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name + i} className="border-b border-border/30">
                  <td className="py-1 pr-2 text-muted-foreground w-8">{i + 1}</td>
                  <td className="py-1 pr-2 truncate">{r.name}</td>
                  <td className="py-1 text-right tabular-nums font-semibold">
                    {r.value.toLocaleString("pt-PT")} <span className="text-muted-foreground text-xs">{unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
