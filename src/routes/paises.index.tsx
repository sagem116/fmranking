import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Globe2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRankings } from "@/lib/useRankings";
import { SeasonsRankTable } from "@/components/SeasonsRankTable";
import { buildDesafioExtraCol } from "@/lib/fm-desafios-col";

export const Route = createFileRoute("/paises/")({
  head: () => ({
    meta: [
      { title: "Países — FM World Rankings" },
      { name: "description", content: "Perfis de países com clubes contribuintes e títulos." },
    ],
  }),
  component: PaisesPage,
});

function PaisesPage() {
  const { data, isLoading } = useRankings();
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const countries = data?.ranks.countries ?? [];
    const term = q.trim().toLowerCase();
    return term ? countries.filter((c) => c.name.toLowerCase().includes(term)) : countries;
  }, [data, q]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }
  if (!data || data.ranks.countries.length === 0) {
    return <p className="text-muted-foreground">Sem dados. Importe uma época primeiro.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Globe2 className="size-6 text-primary" /> Países
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{data.ranks.countries.length} países na base de dados</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar país…" className="pl-9" />
      </div>
      <SeasonsRankTable
        entries={list}
        evolution={data.ranks.evolution.countries}
        years={data.ranks.years}
        kind="paises"
        nameLabel="País"
        extraCols={[buildDesafioExtraCol(data.desafioResults, "countries")].filter(Boolean) as any}
      />
    </div>
  );
}
