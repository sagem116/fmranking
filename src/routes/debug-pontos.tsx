import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Bug, Search, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import type { BreakdownItem } from "@/lib/fm-rankings";

export const Route = createFileRoute("/debug-pontos")({
  head: () => ({
    meta: [
      { title: "Debug · Pontos — FM World Rankings" },
      { name: "description", content: "Trace de como os pontos são atribuídos a clubes, treinadores e países." },
    ],
  }),
  component: DebugPointsPage,
});

const SOURCE_LABEL: Record<string, string> = {
  position: "Posição",
  "champion-bonus": "Bónus de Campeão",
  "league-points": "Pnts da Liga",
  "continental-win": "Continental (Vencedor)",
  "continental-loss": "Continental (Finalista)",
  "continental-sf": "Continental (Meia-final)",
  "continental-qf": "Continental (Quartos)",
};

const MODULE_LABEL: Record<string, string> = {
  superleague: "Super League",
  national: "Liga Nacional",
  continental: "Continental",
};

type ModuleFilter = "all" | "superleague" | "national" | "continental";

function fmt(n: number) {
  return n.toLocaleString("pt-PT", { maximumFractionDigits: 2 });
}

function EntityList({
  items,
  selected,
  onSelect,
}: {
  items: { name: string; raw: number; weighted: number }[];
  selected: string | null;
  onSelect: (n: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((i) => i.name.toLowerCase().includes(t)) : items;
  }, [q, items]);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Procurar…"
          className="pl-8"
        />
      </div>
      <div className="max-h-[600px] overflow-y-auto rounded-md border border-border divide-y divide-border">
        {filtered.slice(0, 200).map((it) => (
          <button
            key={it.name}
            onClick={() => onSelect(it.name)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
              selected === it.name ? "bg-muted font-medium" : ""
            }`}
          >
            <div className="flex justify-between gap-2">
              <span className="truncate">{it.name}</span>
              <span className="text-muted-foreground tabular-nums">{fmt(it.weighted)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BreakdownTable({ items }: { items: BreakdownItem[] }) {
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");

  if (!items.length) {
    return <p className="text-muted-foreground text-sm py-8 text-center">Sem pontos atribuídos.</p>;
  }

  const filtered = moduleFilter === "all" ? items : items.filter((i) => i.module === moduleFilter);
  const sorted = [...filtered].sort(
    (a, b) => b.season_year - a.season_year || b.weighted - a.weighted,
  );
  const totalRaw = filtered.reduce((s, i) => s + i.raw, 0);
  const totalW = filtered.reduce((s, i) => s + i.weighted, 0);
  const bySource = filtered.reduce<Record<string, { raw: number; weighted: number }>>((acc, i) => {
    const s = (acc[i.source] ??= { raw: 0, weighted: 0 });
    s.raw += i.raw;
    s.weighted += i.weighted;
    return acc;
  }, {});

  // Module summary across ALL items (independent of filter)
  const byModule = items.reduce<Record<string, { raw: number; weighted: number; count: number }>>(
    (acc, i) => {
      const s = (acc[i.module] ??= { raw: 0, weighted: 0, count: 0 });
      s.raw += i.raw;
      s.weighted += i.weighted;
      s.count++;
      return acc;
    },
    {},
  );

  // Liga Nacional specific: group by league label
  const nationalRows = items.filter((i) => i.module === "national");
  const byLeague = nationalRows.reduce<
    Record<
      string,
      {
        weighted: number;
        raw: number;
        leagueW: number;
        matched: boolean;
        position: number;
        leaguePts: number;
        championBonus: number;
      }
    >
  >((acc, i) => {
    const key = i.division_label ?? "—";
    const s = (acc[key] ??= {
      weighted: 0,
      raw: 0,
      leagueW: i.multipliers.divW,
      matched: !!i.leagueWeightMatched,
      position: 0,
      leaguePts: 0,
      championBonus: 0,
    });
    s.weighted += i.weighted;
    s.raw += i.raw;
    if (i.source === "position") s.position += i.weighted;
    if (i.source === "league-points") s.leaguePts += i.weighted;
    if (i.source === "champion-bonus") s.championBonus += i.weighted;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Bruto</p>
            <p className="text-lg font-bold tabular-nums">{fmt(totalRaw)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Ponderado</p>
            <p className="text-lg font-bold tabular-nums text-primary">{fmt(totalW)}</p>
          </CardContent>
        </Card>
        {Object.entries(bySource).map(([k, v]) => (
          <Card key={k}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{SOURCE_LABEL[k] ?? k}</p>
              <p className="text-sm font-semibold tabular-nums">{fmt(v.weighted)}</p>
              <p className="text-[10px] text-muted-foreground tabular-nums">bruto {fmt(v.raw)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(["superleague", "national", "continental"] as const).map((m) => {
          const v = byModule[m];
          if (!v) return null;
          return (
            <Card key={m} className={moduleFilter === m ? "border-primary" : ""}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{MODULE_LABEL[m]}</p>
                <p className="text-sm font-semibold tabular-nums">{fmt(v.weighted)}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {v.count} entrada(s) · bruto {fmt(v.raw)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {nationalRows.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="size-4 text-amber-600" /> Detalhe Ligas Nacionais por liga
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-2 py-2">Liga</th>
                    <th className="text-right px-2 py-2">Peso liga (×)</th>
                    <th className="text-right px-2 py-2">Posição</th>
                    <th className="text-right px-2 py-2">Pnts da Liga</th>
                    <th className="text-right px-2 py-2">Bónus Campeão</th>
                    <th className="text-right px-2 py-2">Bruto</th>
                    <th className="text-right px-2 py-2">Ponderado</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byLeague)
                    .sort((a, b) => b[1].weighted - a[1].weighted)
                    .map(([league, v]) => (
                      <tr key={league} className="border-t border-border">
                        <td className="px-2 py-2">
                          <span className="font-medium">{league}</span>
                          {!v.matched && (
                            <span className="ml-2 text-[10px] text-muted-foreground">
                              (sem peso configurado · usa 1.00)
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{v.leagueW.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt(v.position)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt(v.leaguePts)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{fmt(v.championBonus)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {fmt(v.raw)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums font-semibold text-primary">
                          {fmt(v.weighted)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Fórmula por linha: <code>bruto × peso competição × peso liga × decaimento</code>.
              Configura os pesos por liga em <em>Configuração → Pesos de Ligas Nacionais</em>.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground">Filtrar módulo:</span>
        {(["all", "superleague", "national", "continental"] as ModuleFilter[]).map((m) => (
          <Button
            key={m}
            size="sm"
            variant={moduleFilter === m ? "default" : "outline"}
            onClick={() => setModuleFilter(m)}
          >
            {m === "all" ? "Todos" : MODULE_LABEL[m]}
          </Button>
        ))}
      </div>

      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Época</th>
              <th className="text-left px-3 py-2">Módulo</th>
              <th className="text-left px-3 py-2">Liga / Divisão</th>
              <th className="text-left px-3 py-2">Fonte</th>
              <th className="text-left px-3 py-2">Detalhe</th>
              <th className="text-right px-3 py-2">Bruto</th>
              <th className="text-right px-3 py-2">× Comp</th>
              <th className="text-right px-3 py-2" title="Peso de divisão (Super League) ou de liga nacional">× Div/Liga</th>
              <th className="text-right px-3 py-2">× Decaim.</th>
              <th className="text-right px-3 py-2">Ponderado</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((it, i) => {
              const leagueCell =
                it.module === "national"
                  ? it.division_label ?? "—"
                  : it.module === "superleague"
                    ? it.division_num != null
                      ? `Div. ${it.division_num}`
                      : "—"
                    : "—";
              const divLabel =
                it.module === "national" && !it.leagueWeightMatched && it.multipliers.divW === 1
                  ? `${it.multipliers.divW.toFixed(2)}*`
                  : it.multipliers.divW.toFixed(2);
              return (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 tabular-nums">{it.season_year}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {MODULE_LABEL[it.module] ?? it.module}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">{leagueCell}</td>
                  <td className="px-3 py-2 text-xs">{SOURCE_LABEL[it.source] ?? it.source}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{it.detail}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(it.raw)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {it.multipliers.compW.toFixed(2)}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                    title={
                      it.module === "national" && !it.leagueWeightMatched
                        ? "Sem peso configurado para esta liga — usa 1.00"
                        : undefined
                    }
                  >
                    {divLabel}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {it.multipliers.decay.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">
                    {fmt(it.weighted)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[11px] text-muted-foreground px-3 py-2 border-t border-border bg-muted/20">
          <code>*</code> indica liga nacional sem peso configurado (multiplicador 1.00).
          Pontuação final = <code>bruto × Comp × Div/Liga × Decaim.</code>
        </p>
      </div>
    </div>
  );
}

function DebugPointsPage() {
  const { data, isLoading } = useRankings();
  const [tab, setTab] = useState<"clubs" | "coaches" | "countries">("clubs");
  const [selClub, setSelClub] = useState<string | null>(null);
  const [selCoach, setSelCoach] = useState<string | null>(null);
  const [selCountry, setSelCountry] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular…
      </div>
    );
  }

  const r = data.ranks;
  const sel =
    tab === "clubs" ? selClub : tab === "coaches" ? selCoach : selCountry;
  const setSel =
    tab === "clubs" ? setSelClub : tab === "coaches" ? setSelCoach : setSelCountry;
  const list =
    tab === "clubs" ? r.clubs : tab === "coaches" ? r.coaches : r.countries;
  const bdMap =
    tab === "clubs"
      ? r.breakdown.clubs
      : tab === "coaches"
        ? r.breakdown.coaches
        : r.breakdown.countries;
  const items = sel ? bdMap[sel] ?? [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bug className="size-6 text-primary" /> Debug · Pontos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vê linha-a-linha de onde vêm os pontos: posição (até ao 100.º lugar), Pnts da liga,
          bónus de campeão, peso por liga nacional e resultados continentais.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setSelClub(null); setSelCoach(null); setSelCountry(null); setTab(v as typeof tab); }}>
        <TabsList>
          <TabsTrigger value="clubs">Clubes ({r.clubs.length})</TabsTrigger>
          <TabsTrigger value="coaches">Treinadores ({r.coaches.length})</TabsTrigger>
          <TabsTrigger value="countries">Países ({r.countries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            <EntityList items={list} selected={sel} onSelect={(n) => setSel(n)} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {sel ?? "Selecciona um item à esquerda"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownTable items={items} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
