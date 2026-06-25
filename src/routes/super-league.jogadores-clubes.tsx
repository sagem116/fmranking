import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Users, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import { computeClubAggregates, listPlayerYears, type ClubAgg } from "@/lib/fm-players";
import { SuperLeagueHeader } from "@/components/SuperLeagueHeader";
import { SeasonFilter } from "@/components/SeasonFilter";

export const Route = createFileRoute("/super-league/jogadores-clubes")({
  head: () => ({
    meta: [
      { title: "Jogadores por Clube (Super League) — FM World Rankings" },
      { name: "description", content: "Médias de reputação, capacidade, idade, salários e valor de plantel por clube da Super League." },
    ],
  }),
  component: Page,
});

type Key = keyof Pick<ClubAgg, "ra" | "rm" | "ca" | "cp" | "age" | "salary" | "vp" | "n">;
const COLS: { key: Key; label: string; money?: boolean }[] = [
  { key: "ra", label: "R.A." },
  { key: "rm", label: "R.M." },
  { key: "ca", label: "C.A." },
  { key: "cp", label: "C.P." },
  { key: "age", label: "Idade" },
  { key: "salary", label: "Salário", money: true },
  { key: "vp", label: "Valor Plantel", money: true },
  { key: "n", label: "Nº jog." },
];
const fmt = (n: number) => n.toLocaleString("pt-PT");

function Page() {
  const { data, isLoading } = useRankings();
  const years = useMemo(() => (data ? listPlayerYears(data.data.players) : []), [data]);
  const [year, setYear] = useState<"total" | number>("total");
  const rows = useMemo(
    () => (data ? computeClubAggregates(data.data.players, data.data.standings, year) : []),
    [data, year],
  );
  const clubCountry = data?.data.clubCountry ?? {};
  const [sort, setSort] = useState<Key>("ca");
  const [search, setSearch] = useState("");
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [divFilter, setDivFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  const leagueOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.league).filter(Boolean))).sort() as string[],
    [rows],
  );
  const divOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.division).filter((d) => d != null))).sort((a, b) => Number(a) - Number(b)) as number[],
    [rows],
  );
  const countryOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => clubCountry[r.club]).filter(Boolean))).sort() as string[],
    [rows, clubCountry],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.club.toLowerCase().includes(q)) return false;
      if (leagueFilter !== "all" && r.league !== leagueFilter) return false;
      if (divFilter !== "all" && String(r.division) !== divFilter) return false;
      if (countryFilter !== "all" && clubCountry[r.club] !== countryFilter) return false;
      return true;
    });
  }, [rows, search, leagueFilter, divFilter, countryFilter, clubCountry]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => b[sort] - a[sort]), [filtered, sort]);

  if (isLoading) return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> A calcular…</div>;
  if (!rows.length) return <p className="text-muted-foreground">Sem dados de jogadores. Importa um ficheiro da Super League com a folha "Jogadores".</p>;

  const clearFilters = () => { setSearch(""); setLeagueFilter("all"); setDivFilter("all"); setCountryFilter("all"); };
  const hasFilters = search || leagueFilter !== "all" || divFilter !== "all" || countryFilter !== "all";


  return (
    <div className="space-y-6">
      <SuperLeagueHeader
        icon={Users}
        title="Jogadores por Clube"
        description="Para cada clube da Super League, médias de Reputação Atual (R.A.), Reputação Mundial (R.M.), Capacidade Atual (C.A.) e Potencial (C.P.) dos 28 melhores jogadores, idade média do plantel, e soma de salários e valor de plantel. Filtra por época ou vê o agregado total."
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtros:</span>
        <SeasonFilter value={year} onChange={setYear} years={years} />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar clube…"
            className="h-9 w-48 pl-7"
          />
        </div>
        <select
          value={leagueFilter}
          onChange={(e) => setLeagueFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">Todas as ligas</option>
          {leagueOptions.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select
          value={divFilter}
          onChange={(e) => setDivFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">Todas as divisões</option>
          {divOptions.map((d) => <option key={d} value={String(d)}>Div. {d}</option>)}
        </select>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">Todos os países</option>
          {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X className="size-3.5" /> Limpar
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{sorted.length} de {rows.length}</span>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3 w-12">#</th>
                <th className="text-left p-3">Clube</th>
                <th className="text-left p-3">Liga</th>
                <th className="text-right p-3">Div</th>
                {COLS.map((c) => (
                  <th key={c.key} className="text-right p-3">
                    <button onClick={() => setSort(c.key)} className={`hover:text-foreground ${sort === c.key ? "text-foreground" : ""}`}>{c.label}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.club} className="border-b border-border/50 hover:bg-muted/50">
                  <td className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</td>
                  <td className="p-3 font-medium">
                    <Link to="/clubes/$name" params={{ name: r.club }} className="hover:text-primary">{r.club}</Link>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {r.league ? (
                      <Link to="/ligas/$name" params={{ name: r.league }} className="hover:text-primary">{r.league}</Link>
                    ) : "—"}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {r.division != null ? (
                      <Link to="/ligas/$name" params={{ name: `Div. ${r.division}` }} className="hover:text-primary">{r.division}</Link>
                    ) : "—"}
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} className="p-3 text-right tabular-nums">{c.money ? fmt(r[c.key]) : r[c.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

