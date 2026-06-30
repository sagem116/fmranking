import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSnapshots, buildInsights, saveSnapshots } from "@/lib/fm-insights-snapshots";
import { usePlayerStatsData } from "@/lib/usePlayerStatsData";
import { buildSnapshotFromRows } from "@/lib/fm-insights-snapshots";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Insights — FM World" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  const [snaps, setSnaps] = useSnapshots();
  const { data } = usePlayerStatsData();
  const insights = buildInsights(snaps);

  const captureNow = () => {
    if (!data) { toast.error("Sem dados carregados"); return; }
    const s = buildSnapshotFromRows(data.players, null, "manual");
    setSnaps([...snaps, s]);
    toast.success("Snapshot capturado");
  };
  const clearAll = () => { if (confirm("Eliminar todos os snapshots?")) { saveSnapshots([]); setSnaps([]); } };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Sparkles className="size-6 text-primary" /> Insights</h1>
          <p className="text-sm text-muted-foreground">
            Resumo automático das mudanças entre a importação atual e a anterior. Cada importação adiciona um snapshot.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={captureNow}>Capturar snapshot agora</Button>
          {snaps.length > 0 && <Button variant="ghost" onClick={clearAll}><Trash2 className="size-4" /> Limpar</Button>}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de snapshots</CardTitle>
        </CardHeader>
        <CardContent>
          {snaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não existem snapshots. Importa um ficheiro de jogadores para criar o primeiro.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {snaps.map((s, i) => (
                <Badge key={s.id} variant={i === snaps.length - 1 ? "default" : "outline"}>
                  #{i + 1} · {new Date(s.takenAt).toLocaleString("pt-PT")} · {s.totals.players} jog · {s.source}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Insights ({insights.length})</CardTitle></CardHeader>
        <CardContent>
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">São necessários pelo menos 2 snapshots para gerar insights.</p>
          ) : (
            <ul className="divide-y divide-border">
              {insights.map((it) => (
                <li key={it.id} className="py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {it.delta >= 0 ? <TrendingUp className="size-4 text-emerald-500" /> : <TrendingDown className="size-4 text-red-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{it.title}</p>
                    <p className="text-xs text-muted-foreground">{it.detail}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">{it.category}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}