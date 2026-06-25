import { createFileRoute, Link } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { Loader2, Layers, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import {
  computeNationalLeagueAggregates,
  listPlayerYears,
  type NationalLeagueAgg,
} from "@/lib/fm-players";
import { SeasonFilter } from "@/components/SeasonFilter";

export const Route = createFileRoute("/national/jogadores-ligas")({
  head: () => ({
    meta: [
      { title: "Jogadores por Liga Nacional — FM World Rankings" },
      {
        name: "description",
        content:
          "Médias de reputação, capacidade, idade, salários e valor agregados por liga nacional.",
      },
    ],
  }),
  component: Page,
});

type Key = keyof Pick<
  NationalLeagueAgg,
  "ra" | "rm" | "ca" | "cp" | "age" | "salary" | "vp" | "n"
>;
const COLS: { key: Key; label: string; money?: boolean }[] = [
  { key: "ra", label: "R.A." },
  { key: "rm", label: "R.M." },
  { key: "ca", label: "C.A." },
  { key: "cp", label: "C.P." },
  { key: "age", label: "Idade" },
  { key: "salary", label: "Salário", money: true },
  { key: "vp", label: "Valor", money: true },
  { key: "n", label: "Nº jog." },
];
const fmt = (n: number) => n.toLocaleString("pt-PT");

const PAGE_SIZE = 25;
const PLAYERS_INITIAL = 50;
const PLAYERS_STEP = 50;

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function Page() {
  const { data, isLoading } = useRankings();
  const years = useMemo(() => (data ? listPlayerYears(data.data.players) : []), [data]);
  const [year, setYear] = useState<"total" | number>("total");
  const rows = useMemo(
    () =>
      data
        ? computeNationalLeagueAggregates(data.data.players, data.data.standings, year)
        : [],
    [data, year],
  );
  const [sort, setSort] = useState<Key | "league">("ca");
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        sort === "league" ? a.league.localeCompare(b.league) : b[sort] - a[sort],
      ),
    [rows, sort],
  );

  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [sorted, page],
  );
  // Reset page if filter/sort shrinks list below current page
  if (page > 0 && page >= pageCount) setPage(0);

  // ----- Player quick search -----
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [isPending, startTransition] = useTransition();
  const [shown, setShown] = useState(PLAYERS_INITIAL);

  // National clubs index (built once)
  const nationalClubs = useMemo(() => {
    const s = new Set<string>();
    for (const st of data?.data.standings ?? []) {
      if (st.module === "national" && st.club_name) s.add(st.club_name);
    }
    return s;
  }, [data]);

  const playerMatches = useMemo(() => {
    const q = normalize(deferredSearch);
    if (!data || q.length < 2) return [] as {
      key: string; name: string; club: string | null; league: string | null; year: number; ca: number;
    }[];
    const out: { key: string; name: string; club: string | null; league: string | null; year: number; ca: number }[] = [];
    for (const p of data.data.players) {
      if (!p.club_name || !nationalClubs.has(p.club_name)) continue;
      if (!normalize(p.name).includes(q)) continue;
      out.push({
        key: `${p.idu ?? p.name}|${p.club_name}|${p.season_year}`,
        name: p.name,
        club: p.club_name,
        league: p.league,
        year: p.season_year,
        ca: p.ca,
      });
    }
    // Most recent + best first
    out.sort((a, b) => b.year - a.year || b.ca - a.ca || a.name.localeCompare(b.name));
    return out;
  }, [data, deferredSearch, nationalClubs]);

  const visiblePlayers = playerMatches.slice(0, shown);
  const stale = deferredSearch !== search;

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular…
      </div>
    );
  if (!rows.length)
    return (
      <p className="text-muted-foreground">
        Sem dados de jogadores em ligas nacionais. Importa um ficheiro de Liga Nacional
        com a folha "Jogadores".
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Liga Nacional
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="size-6 text-primary" /> Jogadores por Liga Nacional
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl rounded-lg border border-border bg-muted/40 p-3 leading-relaxed">
          Indicadores de jogadores agregados por liga nacional: médias de R.A., R.M., C.A.
          e C.P. (28 melhores por clube), idade média e somas de salários e valor. Filtra
          por época, pesquisa um jogador, ou navega pelas ligas com paginação.
        </p>
      </div>

      {/* Player quick search */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  const v = e.target.value;
                  startTransition(() => setShown(PLAYERS_INITIAL));
                  setSearch(v);
                }}
                placeholder="Pesquisar jogador (nome ou apelido)…"
                className="h-9 pl-7"
              />
            </div>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="h-9">
                <X className="size-3.5" /> Limpar
              </Button>
            )}
            {search && (
              <span className="text-xs text-muted-foreground">
                {(stale || isPending) ? "A procurar…" : `${playerMatches.length} resultado(s)`}
              </span>
            )}
          </div>

          {search && normalize(search).length < 2 && (
            <p className="text-xs text-muted-foreground">Escreve pelo menos 2 caracteres.</p>
          )}

          {search && normalize(search).length >= 2 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                    <th className="text-left p-2">Jogador</th>
                    <th className="text-left p-2">Clube</th>
                    <th className="text-left p-2">Liga</th>
                    <th className="text-right p-2 w-16">Época</th>
                    <th className="text-right p-2 w-12">C.A.</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePlayers.map((p) => (
                    <tr key={p.key} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="p-2 font-medium">
                        <Link to="/jogadores/$name" params={{ name: p.name }} className="hover:text-primary">
                          {p.name}
                        </Link>
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {p.club ? (
                          <Link to="/clubes/$name" params={{ name: p.club }} className="hover:text-primary">{p.club}</Link>
                        ) : "—"}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {p.league ? (
                          <Link to="/ligas/$name" params={{ name: p.league }} className="hover:text-primary">{p.league}</Link>
                        ) : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">{p.year}</td>
                      <td className="p-2 text-right tabular-nums">{p.ca}</td>
                    </tr>
                  ))}
                  {!visiblePlayers.length && !stale && (
                    <tr><td colSpan={5} className="p-3 text-center text-muted-foreground text-xs">Sem resultados.</td></tr>
                  )}
                </tbody>
              </table>
              {shown < playerMatches.length && (
                <div className="pt-3 flex justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startTransition(() => setShown((n) => n + PLAYERS_STEP))}
                  >
                    Mostrar mais {Math.min(PLAYERS_STEP, playerMatches.length - shown)}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters for league aggregate */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <SeasonFilter value={year} onChange={(v) => { setPage(0); setYear(v); }} years={years} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3">
                  <button
                    onClick={() => { setPage(0); setSort("league"); }}
                    className={`hover:text-foreground ${sort === "league" ? "text-foreground" : ""}`}
                  >
                    Liga
                  </button>
                </th>
                {COLS.map((c) => (
                  <th key={c.key} className="text-right p-3">
                    <button
                      onClick={() => { setPage(0); setSort(c.key); }}
                      className={`hover:text-foreground ${sort === c.key ? "text-foreground" : ""}`}
                    >
                      {c.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.league} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="p-3 font-medium">
                    <Link to="/ligas/$name" params={{ name: r.league }} className="hover:text-primary">{r.league}</Link>
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} className="p-3 text-right tabular-nums">
                      {c.money ? fmt(r[c.key]) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground text-xs">
          {sorted.length} ligas · página {page + 1} de {pageCount}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="size-3.5" /> Anterior
          </Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
            Seguinte <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
