import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Crown, HelpCircle, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useRankings } from "@/lib/useRankings";
import type { StandingRow, CoachRow } from "@/lib/fm-rankings";

export const Route = createFileRoute("/dominio")({
  head: () => ({
    meta: [
      { title: "Domínio por Década — FM World Rankings" },
      { name: "description", content: "Quem dominou cada janela de N épocas." },
    ],
  }),
  component: DominioPage,
});

function tokens(inf?: string | null) {
  return new Set(
    String(inf || "")
      .toUpperCase()
      .split(/[\s,;/|+]+/)
      .filter(Boolean),
  );
}

type Module = "superleague" | "national" | "all";

interface Entry {
  clube: string;
  pts: number;
  titulos: number;
  promos: number;
}

interface WindowAgg {
  label: string;
  entries: Entry[];
}

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildWindows(
  standings: StandingRow[],
  module: Module,
  windowSize: number,
  allowedClubs: Set<string> | null,
): WindowAgg[] {
  const filtered = standings.filter((s) => {
    if (module !== "all" && s.module !== module) return false;
    if (allowedClubs && !allowedClubs.has(s.club_name)) return false;
    return true;
  });
  const years = [...new Set(filtered.map((s) => s.season_year).filter((y) => y > 0))].sort(
    (a, b) => a - b,
  );
  if (!years.length) return [];

  const byYear = new Map<number, StandingRow[]>();
  for (const s of filtered) {
    if (!s.season_year) continue;
    (byYear.get(s.season_year) ?? byYear.set(s.season_year, []).get(s.season_year)!).push(s);
  }

  const out: WindowAgg[] = [];
  for (let i = 0; i < years.length; i += windowSize) {
    const slice = years.slice(i, i + windowSize);
    const agg = new Map<string, Entry>();
    for (const y of slice) {
      for (const r of byYear.get(y) ?? []) {
        const cur = agg.get(r.club_name) ?? { clube: r.club_name, pts: 0, titulos: 0, promos: 0 };
        cur.pts += Number(r.points ?? 0) || 0;
        const tk = tokens(r.info);
        if (r.is_champion || tk.has("C")) cur.titulos++;
        if (tk.has("P")) cur.promos++;
        agg.set(r.club_name, cur);
      }
    }
    const entries = [...agg.values()]
      .sort((a, b) => b.titulos - a.titulos || b.pts - a.pts)
      .slice(0, 10);
    out.push({ label: `${slice[0]} → ${slice[slice.length - 1]}`, entries });
  }
  return out;
}

function DominioPage() {
  const { data, isLoading } = useRankings();
  const [windowSize, setWindowSize] = useState(10);
  const [module, setModule] = useState<Module>("superleague");
  const [clubQ, setClubQ] = useState("");
  const [countryQ, setCountryQ] = useState("");
  const [coachQ, setCoachQ] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const standings = data?.data.standings ?? [];
  const coaches: CoachRow[] = data?.data.coaches ?? [];
  const clubCountry: Record<string, string | null> = data?.data.clubCountry ?? {};

  const allowedClubs = useMemo(() => {
    const hasFilter = clubQ.trim() || countryQ.trim() || coachQ.trim();
    if (!hasFilter) return null;
    const cq = norm(clubQ.trim());
    const ctq = norm(countryQ.trim());
    const coq = norm(coachQ.trim());

    // clubs with matching coach (across all seasons)
    const coachClubs = coq
      ? new Set(
          coaches
            .filter((c) => c.name && c.club_name && norm(c.name).includes(coq))
            .map((c) => c.club_name as string),
        )
      : null;

    const set = new Set<string>();
    for (const club of new Set(standings.map((s) => s.club_name))) {
      if (cq && !norm(club).includes(cq)) continue;
      if (ctq) {
        const co = clubCountry[club] ?? "";
        if (!norm(co).includes(ctq)) continue;
      }
      if (coachClubs && !coachClubs.has(club)) continue;
      set.add(club);
    }
    return set;
  }, [clubQ, countryQ, coachQ, standings, coaches, clubCountry]);

  const windows = useMemo(
    () => buildWindows(standings, module, windowSize, allowedClubs),
    [standings, module, windowSize, allowedClubs],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!standings.length) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <p className="text-muted-foreground">Importa épocas para ver o domínio por década.</p>
          <Link
            to="/importar"
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Ir para Importar
          </Link>
        </CardContent>
      </Card>
    );
  }

  const hasFilter = !!(clubQ.trim() || countryQ.trim() || coachQ.trim());

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Crown className="size-6 text-gold" /> Domínio por Década
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Quem dominou cada janela de N épocas — ordenado por títulos e depois pontos.
              </p>
            </div>
            <div className="flex items-end gap-4">
              <label className="text-sm">
                <span className="block text-xs text-muted-foreground mb-1">Competição</span>
                <select
                  value={module}
                  onChange={(e) => setModule(e.target.value as Module)}
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                >
                  <option value="superleague">Super League</option>
                  <option value="national">Ligas Nacionais</option>
                  <option value="all">Todas</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-xs text-muted-foreground mb-1">Janela (épocas)</span>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={windowSize}
                  onChange={(e) =>
                    setWindowSize(Math.max(2, Math.min(50, +e.target.value || 10)))
                  }
                  className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={clubQ}
                onChange={(e) => setClubQ(e.target.value)}
                placeholder="Filtrar por clube…"
                className="pl-8"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={countryQ}
                onChange={(e) => setCountryQ(e.target.value)}
                placeholder="Filtrar por país…"
                className="pl-8"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={coachQ}
                onChange={(e) => setCoachQ(e.target.value)}
                placeholder="Filtrar por treinador…"
                className="pl-8"
              />
            </div>
          </div>
          {hasFilter && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">
                {allowedClubs?.size ?? 0} clubes correspondem aos filtros
              </Badge>
              <button
                onClick={() => {
                  setClubQ("");
                  setCountryQ("");
                  setCoachQ("");
                }}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <X className="size-3" /> Limpar filtros
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30">
              <CardTitle className="text-sm flex items-center gap-2">
                <HelpCircle className="size-4 text-primary" /> Como é calculado o Domínio?
                <span className="ml-auto text-xs text-muted-foreground">
                  {helpOpen ? "Ocultar" : "Mostrar"}
                </span>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="text-sm space-y-3 text-muted-foreground">
              <p>
                As épocas são agrupadas em janelas consecutivas do tamanho escolhido
                (ex: 10 épocas). Dentro de cada janela, para cada clube somam-se:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-foreground">Títulos</strong> — número de épocas em
                  que o clube foi campeão (campo <code>is_champion</code> ou marcador{" "}
                  <code>C</code> no info da época).
                </li>
                <li>
                  <strong className="text-foreground">Promoções</strong> — épocas com marcador{" "}
                  <code>P</code> no info (subida de divisão).
                </li>
                <li>
                  <strong className="text-foreground">Pontos</strong> — soma simples dos
                  pontos de liga em cada época da janela.
                </li>
              </ul>
              <p>
                Os clubes são ordenados por <strong>títulos</strong> (desempate por{" "}
                <strong>pontos totais</strong>) e mostra-se o top 10 por janela.
              </p>
              <p className="text-xs">
                <strong>Importante:</strong> esta vista não aplica os pesos por divisão,
                competição ou decaimento por época usados nos rankings principais. É uma
                contagem direta de títulos/pontos da janela, pensada para destacar épocas
                de domínio. Para os pesos completos (divisões, decaimento, bónus de
                campeão, etc.) ver a página{" "}
                <Link to="/configuracao" className="underline hover:text-foreground">
                  Configuração
                </Link>
                .
              </p>
              <p className="text-xs">
                Filtros: clube, país e treinador restringem o conjunto de clubes
                considerados (correspondência parcial, sem acentos). O treinador é
                associado a um clube através das épocas em que o treinou.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {windows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nenhum resultado para os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {windows.map((w) => (
            <Card key={w.label} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">
                  {w.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                      <th className="text-left p-3 w-12">#</th>
                      <th className="text-left p-3">Clube</th>
                      <th className="text-right p-3">Títulos</th>
                      <th className="text-right p-3">Promos</th>
                      <th className="text-right p-3">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.entries.map((e, i) => (
                      <tr key={e.clube} className="border-b border-border/50 hover:bg-muted/50">
                        <td
                          className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}
                        >
                          {i + 1}
                        </td>
                        <td className="p-3 font-medium">
                          <Link
                            to="/clubes/$name"
                            params={{ name: e.clube }}
                            className="hover:text-primary"
                          >
                            {e.clube}
                          </Link>
                        </td>
                        <td className="p-3 text-right text-gold tabular-nums">{e.titulos}</td>
                        <td className="p-3 text-right tabular-nums">{e.promos}</td>
                        <td className="p-3 text-right tabular-nums">{e.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
