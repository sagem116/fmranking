import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchImports, deleteImport, type ImportLogRow } from "@/lib/fm-db";
import { SeasonImporterV2 } from "@/components/SeasonImporterV2";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar Época — FM World Rankings" },
      { name: "description", content: "Importe os dois ficheiros Excel de uma nova época: Competições + Jogadores." },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Época</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cada época é composta por <strong>2 ficheiros Excel</strong>: um de Competições e outro de Jogadores.
          O nome dos ficheiros é irrelevante — o importador identifica folhas e colunas pelo respetivo nome.
          Reimportar a mesma época substitui os dados anteriores desse ficheiro sem tocar nos restantes.
        </p>
      </div>

      <SeasonImporterV2 />

      <ImportsHistory />
    </div>
  );
}

function ImportsHistory() {
  const qc = useQueryClient();
  const { data: imports, isLoading } = useQuery({ queryKey: ["fm-imports"], queryFn: fetchImports });
  const [busy, setBusy] = useState<string | null>(null);

  async function handleDelete(row: ImportLogRow) {
    const moduleLabel = MODULE_LABEL[row.module] ?? row.module;
    const label = `${moduleLabel} · ${row.season_year}`;
    if (!confirm(`Eliminar importação "${label}"?\n\nIsto remove TODOS os dados desta época para este ficheiro.`)) return;
    setBusy(row.id);
    try {
      await deleteImport(row);
      qc.removeQueries();
      await qc.invalidateQueries();
      toast.success("Importação eliminada");
    } catch (err) {
      toast.error(`Erro ao eliminar: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><History className="size-4 text-primary" /> Importações realizadas</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> A carregar…</p>
        ) : !imports || imports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem importações registadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Época</th>
                  <th className="py-2 pr-3">Ficheiro</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/40">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-PT")}</td>
                    <td className="py-2 pr-3 font-medium">{r.season_year}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary">{MODULE_LABEL[r.module] ?? r.module}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {r.status === "ok" ? (
                        <Badge className="bg-success text-success-foreground">OK</Badge>
                      ) : (
                        <Badge variant="destructive">{r.status}</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={busy === r.id}
                        onClick={() => handleDelete(r)}
                      >
                        {busy === r.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const MODULE_LABEL: Record<string, string> = {
  competitions: "Competições",
  player_stats: "Jogadores",
  superleague: "SuperLeague (legado)",
  national: "Ligas Nacionais (legado)",
};
