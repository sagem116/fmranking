import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Bug, Search, AlertTriangle, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useRankings } from "@/lib/useRankings";
import { buildCoachDebug } from "@/lib/fm-coach-debug";

export const Route = createFileRoute("/debug-treinadores")({
  head: () => ({
    meta: [
      { title: "Debug · Títulos de Treinadores — FM World Rankings" },
      { name: "description", content: "Validar de onde vêm os títulos atribuídos a cada treinador." },
    ],
  }),
  component: DebugPage,
});

function DebugPage() {
  const { data, isLoading } = useRankings();
  const [q, setQ] = useState("");

  const report = useMemo(() => {
    if (!data) return null;
    return buildCoachDebug(
      {
        standings: data.data.standings,
        continental: data.data.continental,
        coaches: data.data.coaches,
        clubCountry: data.data.clubCountry,
      },
      data.ranks,
    );
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular trace…
      </div>
    );
  }
  if (!report) return <p className="text-muted-foreground">Sem dados.</p>;

  const term = q.trim().toLowerCase();
  const rows = term ? report.rows.filter((r) => r.coach.toLowerCase().includes(term)) : report.rows;
  const withZero = rows.filter((r) => r.totalAttributedTitles === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bug className="size-6 text-primary" /> Debug · Títulos de Treinadores
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Trace de como os títulos são atribuídos a cada treinador, por (época, módulo, clube). Útil para perceber
          porque é que alguns ficam a <code className="text-foreground">0</code>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Treinadores rastreados" value={report.rows.length} />
        <Stat label="Com 0 títulos atribuídos" value={withZero.length} tone="warn" />
        <Stat label="Atribuições sem clube válido" value={report.skippedNoClub.length} tone="warn" />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar treinador…" className="pl-9" />
      </div>

      <Tabs defaultValue="trace">
        <TabsList>
          <TabsTrigger value="trace">Trace ({rows.length})</TabsTrigger>
          <TabsTrigger value="zero">Com 0 títulos ({withZero.length})</TabsTrigger>
          <TabsTrigger value="orphan">Títulos sem treinador ({report.orphanTitleClubSeasons.length})</TabsTrigger>
          <TabsTrigger value="skipped">Sem clube ({report.skippedNoClub.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="trace" className="space-y-3 mt-4">
          {rows.slice(0, 200).map((r) => (
            <CoachTraceCard key={r.coach} row={r} />
          ))}
          {rows.length > 200 && (
            <p className="text-xs text-muted-foreground">A mostrar os primeiros 200 de {rows.length}. Filtre por nome para ver mais.</p>
          )}
        </TabsContent>

        <TabsContent value="zero" className="space-y-3 mt-4">
          {withZero.length === 0 && <p className="text-muted-foreground">Nenhum treinador com 0 títulos.</p>}
          {withZero.slice(0, 200).map((r) => (
            <CoachTraceCard key={r.coach} row={r} />
          ))}
        </TabsContent>

        <TabsContent value="orphan" className="mt-4">
          <Card>
            <CardContent className="p-0 max-h-[600px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card/95 backdrop-blur">
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="text-left p-3">Época</th>
                    <th className="text-left p-3">Módulo</th>
                    <th className="text-left p-3">Clube</th>
                    <th className="text-right p-3">Títulos</th>
                  </tr>
                </thead>
                <tbody>
                  {report.orphanTitleClubSeasons.map((o, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="p-3 tabular-nums">{o.season}</td>
                      <td className="p-3"><Badge variant="outline">{o.module}</Badge></td>
                      <td className="p-3 font-medium">{o.club}</td>
                      <td className="p-3 text-right tabular-nums">{o.titles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-2">
            Estes (época, módulo, clube) tiveram títulos mas <strong>nenhum treinador</strong> foi importado para essa atribuição,
            por isso ninguém herda esses títulos.
          </p>
        </TabsContent>

        <TabsContent value="skipped" className="mt-4">
          <Card>
            <CardContent className="p-0 max-h-[600px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card/95 backdrop-blur">
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="text-left p-3">Treinador</th>
                    <th className="text-left p-3">Época</th>
                    <th className="text-left p-3">Módulo</th>
                  </tr>
                </thead>
                <tbody>
                  {report.skippedNoClub.map((s, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="p-3 font-medium">{s.coach}</td>
                      <td className="p-3 tabular-nums">{s.season}</td>
                      <td className="p-3"><Badge variant="outline">{s.module}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-2">
            Atribuições importadas sem <code>club_name</code> são ignoradas no cálculo (não há a quem herdar pontos/títulos).
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${tone === "warn" && value > 0 ? "text-amber-500" : ""}`}>
          {value.toLocaleString("pt-PT")}
        </p>
      </CardContent>
    </Card>
  );
}

function CoachTraceCard({ row }: { row: ReturnType<typeof buildCoachDebug>["rows"][number] }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="size-4 text-gold" /> {row.coach}
        </CardTitle>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant={row.totalAttributedTitles > 0 ? "default" : "outline"}>
            {row.totalAttributedTitles} título{row.totalAttributedTitles === 1 ? "" : "s"}
          </Badge>
          {row.unmatchedAssignments.length > 0 && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/40">
              <AlertTriangle className="size-3 mr-1" /> {row.unmatchedAssignments.length} sem standings
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {row.sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma fonte válida encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground border-b">
                  <th className="text-left p-2">Época</th>
                  <th className="text-left p-2">Módulo</th>
                  <th className="text-left p-2">Clube</th>
                  <th className="text-right p-2">Pos.</th>
                  <th className="text-center p-2">Campeão?</th>
                  <th className="text-left p-2">Cont.</th>
                  <th className="text-right p-2">Tít.</th>
                </tr>
              </thead>
              <tbody>
                {row.sources.map((s, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="p-2 tabular-nums">{s.season}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{s.module}</Badge></td>
                    <td className="p-2">{s.club}</td>
                    <td className="p-2 text-right tabular-nums">{s.position ?? "—"}</td>
                    <td className="p-2 text-center">{s.isChampion ? "✓" : ""}</td>
                    <td className="p-2 text-xs">{s.continentalWins.join(", ") || "—"}</td>
                    <td className={`p-2 text-right tabular-nums ${s.attributedTitles ? "font-semibold text-gold" : "text-muted-foreground"}`}>
                      {s.attributedTitles}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {row.unmatchedAssignments.length > 0 && (
          <div className="mt-3 p-2 rounded-md bg-amber-500/5 border border-amber-500/20 text-xs">
            <p className="font-medium text-amber-500 mb-1">Atribuições sem standings correspondentes:</p>
            <ul className="text-muted-foreground space-y-0.5">
              {row.unmatchedAssignments.map((u, i) => (
                <li key={i}>• {u.season} · {u.module} · {u.club}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
