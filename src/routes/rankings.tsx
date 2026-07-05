import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Trophy, FileSpreadsheet, FileText, Info, ChevronDown, Globe2, Filter, X, LayoutDashboard, Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { EntityCombobox } from "@/components/EntityCombobox";
import { continentOf, CONTINENTS } from "@/lib/fm-continents";
import { useRankings, useRankingsNoDecay } from "@/lib/useRankings";
import { rankBy, computeRankings, computeInternationalRankings } from "@/lib/fm-rankings";
import { exportRankingsExcel, exportRankingsPDF, type ExportSection } from "@/lib/fm-export";
import type { ComputeResult, RankingEntry } from "@/lib/fm-rankings";
import { SeasonsRankTable, type ExtraCol } from "@/components/SeasonsRankTable";
import { buildDesafioExtraCol } from "@/lib/fm-desafios-col";
import { SeasonFilter } from "@/components/SeasonFilter";
import { PlayerRankingsView, CompetitionRankingsView } from "@/components/PlayerRankingsView";
import { ClubStatsRankingsView } from "@/components/ClubStatsRankingsView";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useRankingsUIVersion, useRankingsDensity } from "@/lib/fm-rankings-ui-prefs";
import { RankingsContextBar, type ContextChip } from "@/components/RankingsContextBar";

type SeasonView = "total" | number;

/** Returns view-adjusted entries/evolution/years for the season filter + cumulative/only toggle. */
function applySeasonView(
  entries: RankingEntry[],
  evolution: Record<string, Record<number, number>>,
  years: number[],
  view: SeasonView,
  scope: "cumulative" | "only",
): { entries: RankingEntry[]; evolution: Record<string, Record<number, number>>; years: number[] } {
  if (view === "total") return { entries, evolution, years };
  const allowed = scope === "only" ? [view] : years.filter((y) => y <= view);
  const allowedSet = new Set(allowed);
  const newEvo: Record<string, Record<number, number>> = {};
  const totals: Record<string, number> = {};
  for (const [name, byYear] of Object.entries(evolution)) {
    const sub: Record<number, number> = {};
    let total = 0;
    for (const y of allowed) {
      const v = byYear[y] ?? 0;
      if (v) {
        sub[y] = v;
        total += v;
      }
    }
    newEvo[name] = sub;
    totals[name] = total;
  }
  const newEntries = entries
    .map((e) => ({ ...e, weighted: totals[e.name] ?? 0, raw: totals[e.name] ?? 0 }))
    .filter((e) => e.weighted > 0)
    .sort((a, b) => b.weighted - a.weighted);
  return { entries: newEntries, evolution: newEvo, years: years.filter((y) => allowedSet.has(y)) };
}


import {
  computeClubChampions,
  computeClubPlayoffs,
  computeCoachChampions,
  computeCoachPlayoffs,
} from "@/lib/fm-superleague";

function buildSections(ranks: ComputeResult, mode: "weighted" | "raw"): ExportSection[] {
  return [
    { title: "Clubes", entries: rankBy(ranks.clubs, mode), mode },
    { title: "Treinadores", entries: rankBy(ranks.coaches, mode), mode },
    { title: "Paises", entries: rankBy(ranks.countries, mode), mode },
  ];
}


export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Rankings Mundiais — FM World Rankings" },
      { name: "description", content: "Rankings mundiais brutos e ponderados de clubes, treinadores e países." },
    ],
  }),
  component: RankingsPage,
});

type ModuleFilter = "all" | "superleague" | "national" | "continental" | "international";
const MODULE_FILTERS: { value: ModuleFilter; label: string }[] = [
  { value: "all", label: "Unificado" },
  { value: "superleague", label: "SuperLeague" },
  { value: "national", label: "Ligas Nacionais" },
  { value: "continental", label: "Continentais" },
  { value: "international", label: "Internacional" },
];

function RankingLegend() {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="inline-flex items-center gap-2 h-auto py-1.5">
          <Info className="size-4 text-primary" />
          <span>Como são calculados os pontos</span>
          <ChevronDown className="size-4 opacity-60 group-data-[state=open]:rotate-180 transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="bg-muted/40 border-dashed mt-2">
          <div className="p-4 text-sm space-y-2 text-muted-foreground">
            <p>
              <strong className="text-foreground">Pontos brutos</strong> — soma dos pontos base de cada posição, pontos conquistados nas ligas, bónus de campeão e pontos de títulos continentais.
            </p>
            <p>
              <strong className="text-foreground">Pontos ponderados</strong> — pontos brutos multiplicados por vários fatores:
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li>
                <strong>Peso da competição</strong> — SuperLeague, Ligas Nacionais e Continentais têm pesos diferentes.
              </li>
              <li>
                <strong>Peso da divisão/liga</strong> — divisões mais altas da SuperLeague e ligas nacionais configuradas valem mais.
              </li>
              <li>
                <strong>Desvalorização por época</strong> — épocas mais recentes têm multiplicador maior; resultados antigos perdem peso progressivamente.
              </li>
            </ul>
            <p>
              O total e a ordenação respeitam o modo ativo ({""}
              <span className="text-foreground font-medium">Bruto</span> ou{" "}
              <span className="text-foreground font-medium">Ponderado</span>). Altera estes pesos em{" "}
              <Link to="/configuracao" className="underline hover:text-foreground">
                Configurações
              </Link>
              .
            </p>
          </div>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RankingsPage() {
  const [decayMode, setDecayMode] = useState<"with" | "without">("with");
  const [view, setView] = useState<"standard" | "players" | "competitions" | "clubs_stats">("standard");
  const [uiVersion, setUiVersion] = useRankingsUIVersion();
  const [density, setDensity] = useRankingsDensity();
  const withDecay = useRankings();
  const noDecay = useRankingsNoDecay();
  const data = decayMode === "with" ? withDecay.data : noDecay.data;
  const isLoading = decayMode === "with" ? withDecay.isLoading : noDecay.isLoading;


  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"weighted" | "raw">("weighted");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");

  // Internacional filters
  const [intlComp, setIntlComp] = useState<string>("all");
  const [intlTeam, setIntlTeam] = useState<string>("");
  const [intlCoach, setIntlCoach] = useState<string>("");

  // Continental / National / SuperLeague competition filter
  const [contComp, setContComp] = useState<string>("all");
  const [natComp, setNatComp] = useState<string>("all");
  const [slDiv, setSlDiv] = useState<string>("all");

  // Common smart filters
  const [yearFrom, setYearFrom] = useState<string>("all");
  const [yearTo, setYearTo] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [continentFilter, setContinentFilter] = useState<string>("");
  const [nameSearch, setNameSearch] = useState<string>("");

  // Season view (dropdown + Acumulado/Só essa época toggle)
  const [seasonView, setSeasonView] = useState<SeasonView>("total");
  const [seasonScope, setSeasonScope] = useState<"cumulative" | "only">("cumulative");


  useEffect(() => {
    setMounted(true);
  }, []);

  // Default the "Clubes (estatísticas)" tab to Pontos Brutos.
  useEffect(() => {
    if (view === "clubs_stats") setMode("raw");
  }, [view]);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const s of data?.data.standings ?? []) if (s.season_year) set.add(s.season_year);
    for (const c of data?.data.continental ?? []) if (c.season_year) set.add(c.season_year);
    for (const i of data?.data.international ?? []) if (i.season_year) set.add(i.season_year);
    return [...set].sort((a, b) => b - a);
  }, [data]);

  const passYear = useMemo(() => {
    const yMin = yearFrom === "all" ? -Infinity : Number(yearFrom);
    const yMax = yearTo === "all" ? Infinity : Number(yearTo);
    if (yMin === -Infinity && yMax === Infinity) return () => true;
    return (sy: number) => sy >= yMin && sy <= yMax;
  }, [yearFrom, yearTo]);


  const intlOptions = useMemo(() => {
    const rows = data?.data.international ?? [];
    const comps = new Set<string>();
    const years = new Set<number>();
    for (const r of rows) {
      if (r.competition) comps.add(r.competition);
      if (r.season_year) years.add(r.season_year);
    }
    return {
      competitions: [...comps].sort(),
      years: [...years].sort((a, b) => b - a),
    };
  }, [data]);

  const intlFilteredRows = useMemo(() => {
    const rows = data?.data.international ?? [];
    const team = intlTeam.trim().toLowerCase();
    const coach = intlCoach.trim().toLowerCase();
    return rows.filter((r) => {
      if (!passYear(r.season_year)) return false;
      if (intlComp !== "all" && r.competition !== intlComp) return false;
      // year range handled by passYear above
      if (team) {
        const t1 = (r.team1 ?? "").toLowerCase();
        const t2 = (r.team2 ?? "").toLowerCase();
        if (!t1.includes(team) && !t2.includes(team)) return false;
      }
      if (coach) {
        const c1 = (r.coach1 ?? "").toLowerCase();
        const c2 = (r.coach2 ?? "").toLowerCase();
        if (!c1.includes(coach) && !c2.includes(coach)) return false;
      }
      return true;
    });
  }, [data, intlComp, intlTeam, intlCoach, passYear]);

  const contCompOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of data?.data.continental ?? []) if (r.competition) set.add(r.competition);
    return [...set].sort();
  }, [data]);

  const natCompOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of data?.data.standings ?? []) {
      if (s.module === "national" && s.division_label) set.add(s.division_label);
    }
    return [...set].sort();
  }, [data]);

  const slDivOptions = useMemo(() => {
    const set = new Set<number>();
    for (const s of data?.data.standings ?? []) {
      if (s.module === "superleague" && s.division_num) set.add(s.division_num);
    }
    return [...set].sort((a, b) => a - b);
  }, [data]);

  const ranks = useMemo(() => {
    if (!data) return null;
    if (moduleFilter === "international") return null; // handled separately below
    const d = data.data;
    // For the unified view with no year filter we can use the precomputed rankings.
    if (moduleFilter === "all" && yearFrom === "all" && yearTo === "all") return data.ranks;
    const isContinental = moduleFilter === "continental";
    const baseStandings = moduleFilter === "all"
      ? d.standings
      : isContinental
        ? []
        : moduleFilter === "national"
          ? d.standings.filter((s) => s.module === "national" && (natComp === "all" || s.division_label === natComp))
          : moduleFilter === "superleague"
            ? d.standings.filter((s) => s.module === "superleague" && (slDiv === "all" || String(s.division_num) === slDiv))
            : d.standings.filter((s) => s.module === moduleFilter);
    const standingsRows = baseStandings.filter((s) => passYear(s.season_year));
    const baseContinental = moduleFilter === "all"
      ? d.continental
      : isContinental
        ? (contComp === "all" ? d.continental : d.continental.filter((r) => r.competition === contComp))
        : [];
    const continentalRows = baseContinental.filter((c) => passYear(c.season_year));
    // For coaches: when filtering SuperLeague by division, only keep coaches assigned to clubs that played in that division that season.
    const allowedCoach = (c: typeof d.coaches[number]) => {
      if (!passYear(c.season_year)) return false;
      if (moduleFilter === "all") return true;
      if (c.module !== moduleFilter && !(isContinental)) return false;
      if (moduleFilter === "superleague" && slDiv !== "all") {
        return standingsRows.some(
          (s) => s.season_year === c.season_year && s.club_name === c.club_name,
        );
      }
      return true;
    };
    return computeRankings(
      {
        standings: standingsRows,
        continental: continentalRows,
        coaches: d.coaches.filter(allowedCoach),
        clubCountry: d.clubCountry,
      },
      data.config,
    );
  }, [data, moduleFilter, contComp, natComp, slDiv, passYear, yearFrom, yearTo]);


  const intlRanks = useMemo(() => {
    if (!data || moduleFilter !== "international") return null;
    return computeInternationalRankings(intlFilteredRows, data.config);
  }, [data, moduleFilter, intlFilteredRows]);


  const clubNac = useMemo<Record<string, string | null>>(
    () => data?.data.clubCountry ?? {},
    [data],
  );
  const coachNac = useMemo<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {};
    for (const c of data?.data.coaches ?? []) {
      if (c.nationality && !m[c.name]) m[c.name] = c.nationality;
    }
    return m;
  }, [data]);

  const coachByKey = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    // Prefer continental/superleague coach when same (year, club) appears in multiple modules
    const order: Record<string, number> = { continental: 0, superleague: 1, national: 2 };
    const candidates: { k: string; name: string; rank: number }[] = [];
    for (const c of data?.data.coaches ?? []) {
      if (!c.club_name) continue;
      candidates.push({
        k: `${c.season_year}|${c.club_name}`,
        name: c.name,
        rank: order[c.module] ?? 99,
      });
    }
    candidates.sort((a, b) => a.rank - b.rank);
    for (const c of candidates) if (!m[c.k]) m[c.k] = c.name;
    // Add international team coaches (team is the country)
    for (const r of data?.data.international ?? []) {
      if (r.team1 && r.coach1) m[`${r.season_year}|${r.team1}`] ??= r.coach1;
      if (r.team2 && r.coach2) m[`${r.season_year}|${r.team2}`] ??= r.coach2;
    }
    return m;
  }, [data]);



  const countryOptions = useMemo(() => {
    const s = new Set<string>();
    for (const v of Object.values(clubNac)) if (v) s.add(v);
    for (const v of Object.values(coachNac)) if (v) s.add(v);
    return [...s].sort();
  }, [clubNac, coachNac]);

  const filterEntries = (rows: RankingEntry[], kind: "clubes" | "treinadores" | "paises"): RankingEntry[] => {
    const q = nameSearch.trim().toLowerCase();
    if (!countryFilter && !continentFilter && !q) return rows;
    const countryFor = (e: RankingEntry) =>
      kind === "clubes" ? clubNac[e.name] : kind === "treinadores" ? coachNac[e.name] : e.name;
    return rows.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false;
      const c = countryFor(e) ?? null;
      if (countryFilter && c !== countryFilter) return false;
      if (continentFilter && continentOf(c) !== continentFilter) return false;
      return true;
    });
  };

  const filtersActive =
    countryFilter || continentFilter || nameSearch ||
    yearFrom !== "all" || yearTo !== "all" ||
    contComp !== "all" || natComp !== "all" || slDiv !== "all" ||
    intlComp !== "all" || intlTeam || intlCoach;

  const clearAllFilters = () => {
    setCountryFilter(""); setContinentFilter(""); setNameSearch("");
    setYearFrom("all"); setYearTo("all");
    setContComp("all"); setNatComp("all"); setSlDiv("all");
    setIntlComp("all"); setIntlTeam(""); setIntlCoach("");
  };


  const slExtras = useMemo(() => {
    if (!data || moduleFilter !== "superleague") return null;
    const slSt = data.data.standings.filter(
      (s) => s.module === "superleague" && (slDiv === "all" || String(s.division_num) === slDiv),
    );
    const clubsCh = computeClubChampions(slSt);
    const clubsPo = computeClubPlayoffs(slSt);
    const coachesCh = computeCoachChampions(slSt, data.data.coaches);
    const coachesPo = computeCoachPlayoffs(slSt, data.data.coaches);
    const num = <T extends { name: string }>(rows: T[], pick: (r: T) => number) => {
      const m: Record<string, number> = {};
      for (const r of rows) m[r.name] = pick(r);
      return m;
    };
    const tip = <T extends { name: string }>(rows: T[], pick: (r: T) => string) => {
      const m: Record<string, string> = {};
      for (const r of rows) { const t = pick(r); if (t) m[r.name] = t; }
      return m;
    };
    const clubCols: ExtraCol[] = [
      { key: "promo", label: "Promovido", values: num(clubsCh, (r) => r.p), tips: tip(clubsCh, (r) => r.tipP) },
      { key: "despro", label: "Despromovido", values: num(clubsCh, (r) => r.d), tips: tip(clubsCh, (r) => r.tipD) },
      { key: "qsub", label: "Quase Subida", values: num(clubsPo, (r) => r.quaseSubida), tips: tip(clubsPo, (r) => r.tipQS) },
      { key: "qtit", label: "Quase Título", values: num(clubsPo, (r) => r.quaseTitulo), tips: tip(clubsPo, (r) => r.tipQT) },
    ];
    const coachCols: ExtraCol[] = [
      { key: "promo", label: "Promovido", values: num(coachesCh, (r) => r.p), tips: tip(coachesCh, (r) => r.tipP) },
      { key: "despro", label: "Despromovido", values: num(coachesCh, (r) => r.d), tips: tip(coachesCh, (r) => r.tipD) },
      { key: "qsub", label: "Quase Subida", values: num(coachesPo, (r) => r.quaseSubida), tips: tip(coachesPo, (r) => r.tipQS) },
      { key: "qtit", label: "Quase Título", values: num(coachesPo, (r) => r.quaseTitulo), tips: tip(coachesPo, (r) => r.tipQT) },
    ];

    // Country promotions / relegations aggregated by club nationality.
    const subidas: Record<string, number> = {};
    const descidas: Record<string, number> = {};
    const tipSub: Record<string, string[]> = {};
    const tipDes: Record<string, string[]> = {};
    for (const r of clubsCh) {
      const nac = data.data.clubCountry[r.name];
      if (!nac) continue;
      if (r.p > 0) {
        subidas[nac] = (subidas[nac] ?? 0) + r.p;
        (tipSub[nac] ??= []).push(`${r.name}: ${r.tipP}`);
      }
      if (r.d > 0) {
        descidas[nac] = (descidas[nac] ?? 0) + r.d;
        (tipDes[nac] ??= []).push(`${r.name}: ${r.tipD}`);
      }
    }
    const countryCols: ExtraCol[] = [
      {
        key: "subidas", label: "Subidas", values: subidas,
        tips: Object.fromEntries(Object.entries(tipSub).map(([k, v]) => [k, v.join("\n")])),
      },
      {
        key: "descidas", label: "Descidas", values: descidas,
        tips: Object.fromEntries(Object.entries(tipDes).map(([k, v]) => [k, v.join("\n")])),
      },
    ];
    return { clubCols, coachCols, countryCols };
  }, [data, moduleFilter, slDiv]);

  // Continentais — Meias-Finais & Quartos-Finais (Clubes / Treinadores / Países)
  const continentalExtras = useMemo(() => {
    if (!data || moduleFilter !== "continental" || !ranks) return null;

    // Coach lookup: (season|club) -> coach name (prefer module=continental, fallback any)
    const coachByKey: Record<string, string> = {};
    for (const c of data.data.coaches) {
      if (!c.club_name) continue;
      const k = `${c.season_year}|${c.club_name}`;
      if (c.module === "continental") coachByKey[k] = c.name;
      else if (!coachByKey[k]) coachByKey[k] = c.name;
    }
    const lastSeg = (s: string) => {
      const parts = s.split(" · ");
      return parts.length > 1 ? parts[parts.length - 1] : "";
    };

    const build = (
      bd: Record<string, import("@/lib/fm-rankings").BreakdownItem[]>,
      kind: "clubes" | "treinadores" | "paises",
    ): ExtraCol[] => {
      const fin: Record<string, number> = {};
      const sf: Record<string, number> = {};
      const qf: Record<string, number> = {};
      type Row = { year: number; comp: string; club: string; coach: string; country: string };
      const rowsFin: Record<string, Row[]> = {};
      const rowsSf: Record<string, Row[]> = {};
      const rowsQf: Record<string, Row[]> = {};
      for (const [name, items] of Object.entries(bd)) {
        for (const it of items) {
          if (
            it.source !== "continental-loss" &&
            it.source !== "continental-sf" &&
            it.source !== "continental-qf"
          )
            continue;
          const comp = it.competition ?? "Continental";
          let club = "";
          let coach = "";
          let country = "";
          if (kind === "clubes") {
            club = name;
            coach = coachByKey[`${it.season_year}|${name}`] ?? "";
            country = data.data.clubCountry[name] ?? "";
          } else if (kind === "treinadores") {
            club = lastSeg(it.detail);
            coach = name;
            country = club ? data.data.clubCountry[club] ?? "" : "";
          } else {
            club = lastSeg(it.detail);
            coach = coachByKey[`${it.season_year}|${club}`] ?? "";
            country = name;
          }
          const row: Row = { year: it.season_year, comp, club, coach, country };
          if (it.source === "continental-loss") {
            fin[name] = (fin[name] ?? 0) + 1;
            (rowsFin[name] ??= []).push(row);
          } else if (it.source === "continental-sf") {
            sf[name] = (sf[name] ?? 0) + 1;
            (rowsSf[name] ??= []).push(row);
          } else {
            qf[name] = (qf[name] ?? 0) + 1;
            (rowsQf[name] ??= []).push(row);
          }
        }
      }
      const renderTip = (
        rows: Record<string, Row[]>,
      ): Record<string, React.ReactNode> => {
        const out: Record<string, React.ReactNode> = {};
        for (const [k, arr] of Object.entries(rows)) {
          const sorted = [...arr].sort((a, b) => a.year - b.year || a.comp.localeCompare(b.comp));
          out[k] = (
            <div className="space-y-1">
              {sorted.map((r, i) => (
                <div key={i} className="text-xs">
                  <span className="font-semibold tabular-nums">{r.year}</span>
                  {" · "}
                  <span>{r.comp}</span>
                  {r.club && (
                    <>
                      {" · "}
                      <Link
                        to="/clubes/$name"
                        params={{ name: r.club }}
                        className="underline hover:text-primary"
                      >
                        {r.club}
                      </Link>
                    </>
                  )}
                  {r.coach && (
                    <>
                      {" · "}
                      <Link
                        to="/treinadores/$name"
                        params={{ name: r.coach }}
                        className="underline hover:text-primary"
                      >
                        {r.coach}
                      </Link>
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        }
        return out;
      };

      return [
        { key: "fin", label: "Finais", values: fin, tips: renderTip(rowsFin) },
        { key: "sf", label: "Meias", values: sf, tips: renderTip(rowsSf) },
        { key: "qf", label: "Quartos", values: qf, tips: renderTip(rowsQf) },
      ];
    };


    return {
      clubCols: build(ranks.breakdown.clubs, "clubes"),
      coachCols: build(ranks.breakdown.coaches, "treinadores"),
      countryCols: build(ranks.breakdown.countries, "paises"),
    };
  }, [data, moduleFilter, ranks]);

  // Internacional — Finalista / Meias / Quartos (Seleções & Treinadores)
  const internationalExtras = useMemo(() => {
    if (!data || moduleFilter !== "international" || !intlRanks) return null;
    const teamFromDetail = (s: string) => {
      const parts = s.split(" · ");
      return parts.length >= 2 ? parts[1] : "";
    };
    const build = (
      bd: Record<string, import("@/lib/fm-rankings").BreakdownItem[]>,
      kind: "paises" | "treinadores",
    ): ExtraCol[] => {
      const fin: Record<string, number> = {};
      const sf: Record<string, number> = {};
      const qf: Record<string, number> = {};
      type Row = { year: number; comp: string; team: string; coach: string };
      const rowsFin: Record<string, Row[]> = {};
      const rowsSf: Record<string, Row[]> = {};
      const rowsQf: Record<string, Row[]> = {};
      // Build (year|team) -> coach map from international rows
      const coachByKey: Record<string, string> = {};
      for (const r of data.data.international ?? []) {
        if (r.team1 && r.coach1) coachByKey[`${r.season_year}|${r.team1}`] = r.coach1;
        if (r.team2 && r.coach2) coachByKey[`${r.season_year}|${r.team2}`] = r.coach2;
        if (r.sf1 && r.sf1_coach) coachByKey[`${r.season_year}|${r.sf1}`] = r.sf1_coach;
        if (r.sf2 && r.sf2_coach) coachByKey[`${r.season_year}|${r.sf2}`] = r.sf2_coach;
        if (r.qf1 && r.qf1_coach) coachByKey[`${r.season_year}|${r.qf1}`] = r.qf1_coach;
        if (r.qf2 && r.qf2_coach) coachByKey[`${r.season_year}|${r.qf2}`] = r.qf2_coach;
        if (r.qf3 && r.qf3_coach) coachByKey[`${r.season_year}|${r.qf3}`] = r.qf3_coach;
        if (r.qf4 && r.qf4_coach) coachByKey[`${r.season_year}|${r.qf4}`] = r.qf4_coach;
      }
      for (const [name, items] of Object.entries(bd)) {
        for (const it of items) {
          if (
            it.source !== "continental-loss" &&
            it.source !== "continental-sf" &&
            it.source !== "continental-qf"
          )
            continue;
          const comp = it.competition ?? "Internacional";
          let team = "";
          let coach = "";
          if (kind === "paises") {
            team = name;
            coach = coachByKey[`${it.season_year}|${name}`] ?? "";
          } else {
            team = teamFromDetail(it.detail);
            coach = name;
          }
          const row: Row = { year: it.season_year, comp, team, coach };
          if (it.source === "continental-loss") {
            fin[name] = (fin[name] ?? 0) + 1;
            (rowsFin[name] ??= []).push(row);
          } else if (it.source === "continental-sf") {
            sf[name] = (sf[name] ?? 0) + 1;
            (rowsSf[name] ??= []).push(row);
          } else {
            qf[name] = (qf[name] ?? 0) + 1;
            (rowsQf[name] ??= []).push(row);
          }
        }
      }
      const renderTip = (rows: Record<string, Row[]>): Record<string, React.ReactNode> => {
        const out: Record<string, React.ReactNode> = {};
        for (const [k, arr] of Object.entries(rows)) {
          const sorted = [...arr].sort((a, b) => a.year - b.year || a.comp.localeCompare(b.comp));
          out[k] = (
            <div className="space-y-1">
              {sorted.map((r, i) => (
                <div key={i} className="text-xs">
                  <span className="font-semibold tabular-nums">{r.year}</span>
                  {" · "}
                  <span>{r.comp}</span>
                  {r.team && (
                    <>
                      {" · "}
                      <Link
                        to="/paises/$name"
                        params={{ name: r.team }}
                        className="underline hover:text-primary"
                      >
                        {r.team}
                      </Link>
                    </>
                  )}
                  {r.coach && (
                    <>
                      {" · "}
                      <Link
                        to="/treinadores/$name"
                        params={{ name: r.coach }}
                        className="underline hover:text-primary"
                      >
                        {r.coach}
                      </Link>
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        }
        return out;
      };
      return [
        { key: "fin", label: "Finalista", values: fin, tips: renderTip(rowsFin) },
        { key: "sf", label: "Meias", values: sf, tips: renderTip(rowsSf) },
        { key: "qf", label: "Quartos", values: qf, tips: renderTip(rowsQf) },
      ];
    };
    return {
      countryCols: build(intlRanks.breakdown.countries, "paises"),
      coachCols: build(intlRanks.breakdown.coaches, "treinadores"),
    };
  }, [data, moduleFilter, intlRanks]);

  const activeExtras = moduleFilter === "continental" ? continentalExtras : slExtras;

  const desafioResults = data?.desafioResults;
  const desafioCols = useMemo(() => ({
    clubs: buildDesafioExtraCol(desafioResults, "clubs"),
    coaches: buildDesafioExtraCol(desafioResults, "coaches"),
    countries: buildDesafioExtraCol(desafioResults, "countries"),
  }), [desafioResults]);
  const withDesafios = (cols: ExtraCol[] | undefined, subject: "clubs" | "coaches" | "countries"): ExtraCol[] | undefined => {
    const d = desafioCols[subject];
    if (!d) return cols;
    return cols ? [...cols, d] : [d];
  };




  if (!mounted || isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular…
      </div>
    );
  }
  if (!data) {
    return <p className="text-muted-foreground">Sem dados. Importe uma época primeiro.</p>;
  }
  const hasAnyData =
    data.ranks.clubs.length > 0 ||
    data.data.standings.length > 0 ||
    data.data.continental.length > 0 ||
    (data.data.international?.length ?? 0) > 0;
  if (!hasAnyData) {
    return <p className="text-muted-foreground">Sem dados. Importe uma época primeiro.</p>;
  }
  if (moduleFilter !== "international" && !ranks) {
    return <p className="text-muted-foreground">Sem dados para este filtro.</p>;
  }

  const sv = (
    entries: RankingEntry[],
    evolution: Record<string, Record<number, number>>,
    years: number[],
  ) => applySeasonView(entries, evolution, years, seasonView, seasonScope);

  return (

    <div className="space-y-6">
      {uiVersion === "v1" ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="size-6 text-primary" /> Rankings Mundiais
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Rankings históricos por competição e unificados</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeasonFilter
            value={seasonView}
            onChange={setSeasonView}
            years={availableYears}
            totalLabel="Todas as épocas"
            className="w-[200px]"
          />
          {seasonView !== "total" && (
            <div className="flex rounded-lg border border-border p-1">
              <Button size="sm" variant={seasonScope === "cumulative" ? "default" : "ghost"} onClick={() => setSeasonScope("cumulative")}>
                Acumulado até
              </Button>
              <Button size="sm" variant={seasonScope === "only" ? "default" : "ghost"} onClick={() => setSeasonScope("only")}>
                Só essa época
              </Button>
            </div>
          )}
          <div className="flex rounded-lg border border-border p-1">
            <Button size="sm" variant={mode === "weighted" ? "default" : "ghost"} onClick={() => setMode("weighted")}>
              Ponderado
            </Button>
            <Button size="sm" variant={mode === "raw" ? "default" : "ghost"} onClick={() => setMode("raw")}>
              Bruto
            </Button>
          </div>
          <div className="flex rounded-lg border border-border p-1" title="Aplicar/Remover decaimento temporal nos rankings">
            <Button size="sm" variant={decayMode === "with" ? "default" : "ghost"} onClick={() => setDecayMode("with")}>
              Com decaimento
            </Button>
            <Button size="sm" variant={decayMode === "without" ? "default" : "ghost"} onClick={() => setDecayMode("without")}>
              Sem decaimento
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setUiVersion("v2")} title="Mudar para a UI Moderna">
            <Sparkles className="size-3.5" /> UI Moderna
          </Button>
        </div>
      </div>
      ) : (
        <RankingsV2Header
          seasonView={seasonView}
          setSeasonView={setSeasonView}
          availableYears={availableYears}
          seasonScope={seasonScope}
          setSeasonScope={setSeasonScope}
          mode={mode}
          setMode={setMode}
          decayMode={decayMode}
          setDecayMode={setDecayMode}
          view={view}
          setView={setView}
          moduleFilter={moduleFilter}
          setModuleFilter={setModuleFilter}
          onSwitchToV1={() => setUiVersion("v1")}
          contextChips={buildContextChips({
            mode,
            decayMode,
            seasonView,
            seasonScope,
            moduleFilter,
            view,
            countryFilter,
            continentFilter,
            nameSearch,
            yearFrom,
            yearTo,
            contComp,
            natComp,
            slDiv,
            intlComp,
            intlTeam,
            intlCoach,
            setCountryFilter,
            setContinentFilter,
            setNameSearch,
            setYearFrom,
            setYearTo,
            setContComp,
            setNatComp,
            setSlDiv,
            setIntlComp,
            setIntlTeam,
            setIntlCoach,
          })}
          onClearAll={clearAllFilters}
        />
      )}

      {uiVersion === "v1" && (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={view === "standard" ? "default" : "outline"} onClick={() => setView("standard")}>Clubes · Treinadores · Países</Button>
        <Button size="sm" variant={view === "players" ? "default" : "outline"} onClick={() => setView("players")}>Jogadores</Button>
        <Button size="sm" variant={view === "competitions" ? "default" : "outline"} onClick={() => setView("competitions")}>Competições</Button>
        <Button size="sm" variant={view === "clubs_stats" ? "default" : "outline"} onClick={() => setView("clubs_stats")}>Clubes (estatísticas)</Button>
      </div>
      )}

      {view === "players" && (
        <PlayerRankingsView mode={mode} withDecay={decayMode === "with"} />
      )}
      {view === "competitions" && (
        <CompetitionRankingsView mode={mode} withDecay={decayMode === "with"} />
      )}
      {view === "clubs_stats" && (
        <ClubStatsRankingsView mode={mode} withDecay={decayMode === "with"} />
      )}
      {view === "standard" && <>
      <div className="flex flex-wrap gap-2">
        {uiVersion === "v1" && MODULE_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={moduleFilter === f.value ? "secondary" : "outline"}
            onClick={() => setModuleFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          {ranks && (
            <>
              <Button size="sm" variant="outline" onClick={() => exportRankingsExcel(buildSections(ranks, mode))}>
                <FileSpreadsheet className="size-4" /> Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportRankingsPDF(buildSections(ranks, mode), "FM World Rankings")}>
                <FileText className="size-4" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Smart filters (apply to all rankings) */}
      <Collapsible defaultOpen={false}>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center gap-2 hover:text-primary flex-1 text-left">
                <Filter className="size-4 text-primary" /> Filtros inteligentes
                {filtersActive ? <span className="text-xs text-primary">(ativos)</span> : null}
                <ChevronDown className="size-4 ml-auto opacity-60 transition-transform data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            {filtersActive && (
              <Button size="sm" variant="ghost" className="h-auto py-1" onClick={clearAllFilters}>
                <X className="size-3.5" /> Limpar
              </Button>
            )}
          </div>
          <CollapsibleContent className="pt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Continente</Label>
            <Select value={continentFilter || "all"} onValueChange={(v) => setContinentFilter(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {CONTINENTS.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">País</Label>
            <EntityCombobox value={countryFilter} onChange={setCountryFilter} options={countryOptions} placeholder="Todos" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pesquisar nome</Label>
            <Input value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} placeholder="clube / treinador / país" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Época (de)</Label>
            <Select value={yearFrom} onValueChange={setYearFrom}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mais antiga</SelectItem>
                {[...availableYears].sort((a, b) => a - b).map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Época (até)</Label>
            <Select value={yearTo} onValueChange={setYearTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mais recente</SelectItem>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {moduleFilter === "superleague" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Divisão (SuperLeague)</Label>
              <Select value={slDiv} onValueChange={setSlDiv}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {slDivOptions.map((d) => (<SelectItem key={d} value={String(d)}>Divisão {d}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          {moduleFilter === "national" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Liga Nacional</Label>
              <Select value={natComp} onValueChange={setNatComp}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {natCompOptions.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          {moduleFilter === "continental" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Competição Continental</Label>
              <Select value={contComp} onValueChange={setContComp}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {contCompOptions.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          {moduleFilter === "international" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Competição</Label>
                <Select value={intlComp} onValueChange={setIntlComp}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {intlOptions.competitions.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Seleção (contém)</Label>
                <Input value={intlTeam} onChange={(e) => setIntlTeam(e.target.value)} placeholder="ex: Portugal" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Treinador (contém)</Label>
                <Input value={intlCoach} onChange={(e) => setIntlCoach(e.target.value)} placeholder="ex: Martínez" />
              </div>
            </>
          )}
        </div>
        {moduleFilter === "international" && (
          <p className="text-xs text-muted-foreground mt-3">
            {intlFilteredRows.length} jogo(s) correspondem aos filtros.
          </p>
        )}
          </CollapsibleContent>
        </Card>
      </Collapsible>


      <RankingLegend />

      {moduleFilter === "international" ? (
        <>
          {intlRanks && (intlRanks.countries.length > 0 || intlRanks.coaches.length > 0) ? (
            <Tabs defaultValue="countries">
              <TabsList>
                <TabsTrigger value="countries"><Globe2 className="size-3.5 mr-1" /> Seleções</TabsTrigger>
                <TabsTrigger value="coaches">Treinadores</TabsTrigger>
              </TabsList>
              <TabsContent value="countries">
                {(() => {
                  const v = sv(filterEntries(intlRanks.countries, "paises"), intlRanks.evolution.countries, intlRanks.years);
                  return (
                    <SeasonsRankTable
                      entries={v.entries}
                      evolution={v.evolution}
                      years={v.years}
                      mode={mode}
                      kind="paises"
                      breakdown={intlRanks.breakdown.countries}
                      extraCols={withDesafios(internationalExtras?.countryCols, "countries")}
                      coachByKey={coachByKey}
                    />
                  );
                })()}
              </TabsContent>
              <TabsContent value="coaches">
                {(() => {
                  const v = sv(filterEntries(intlRanks.coaches, "treinadores"), intlRanks.evolution.coaches, intlRanks.years);
                  return (
                    <SeasonsRankTable
                      entries={v.entries}
                      evolution={v.evolution}
                      years={v.years}
                      mode={mode}
                      kind="treinadores"
                      breakdown={intlRanks.breakdown.coaches}
                      nacMap={coachNac}
                      extraCols={withDesafios(internationalExtras?.coachCols, "coaches")}
                      coachByKey={coachByKey}
                    />
                  );
                })()}
              </TabsContent>

            </Tabs>
          ) : (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              {(data?.data.international?.length ?? 0) === 0
                ? <>Sem jogos de competições internacionais importados. Confirma que a folha <em>Compts Seleções</em> tem linhas de jogos abaixo do cabeçalho.</>
                : "Nenhum resultado para os filtros selecionados."}
            </Card>
          )}
        </>
      ) : (
        ranks && (
          <Tabs defaultValue="clubs">
            <TabsList>
              <TabsTrigger value="clubs">Clubes</TabsTrigger>
              <TabsTrigger value="coaches">Treinadores</TabsTrigger>
              <TabsTrigger value="countries">Países</TabsTrigger>
            </TabsList>
            <TabsContent value="clubs">
              {(() => {
                const v = sv(filterEntries(ranks.clubs, "clubes"), ranks.evolution.clubs, ranks.years);
                return (
                  <SeasonsRankTable
                    entries={v.entries}
                    evolution={v.evolution}
                    years={v.years}
                    mode={mode}
                    kind="clubes"
                    breakdown={ranks.breakdown.clubs}
                    nacMap={clubNac}
                    extraCols={withDesafios(activeExtras?.clubCols, "clubs")}
                    coachByKey={coachByKey}
                  />
                );
              })()}
            </TabsContent>
            <TabsContent value="coaches">
              {(() => {
                const v = sv(filterEntries(ranks.coaches, "treinadores"), ranks.evolution.coaches, ranks.years);
                return (
                  <SeasonsRankTable
                    entries={v.entries}
                    evolution={v.evolution}
                    years={v.years}
                    mode={mode}
                    kind="treinadores"
                    breakdown={ranks.breakdown.coaches}
                    nacMap={coachNac}
                    extraCols={withDesafios(activeExtras?.coachCols, "coaches")}
                    coachByKey={coachByKey}
                  />
                );
              })()}
            </TabsContent>
            <TabsContent value="countries">
              {(() => {
                const v = sv(filterEntries(ranks.countries, "paises"), ranks.evolution.countries, ranks.years);
                return (
                  <SeasonsRankTable
                    entries={v.entries}
                    evolution={v.evolution}
                    years={v.years}
                    mode={mode}
                    kind="paises"
                    breakdown={ranks.breakdown.countries}
                    extraCols={withDesafios(activeExtras?.countryCols, "countries")}
                    coachByKey={coachByKey}
                  />
                );
              })()}
            </TabsContent>

          </Tabs>
        )
      )}
      </>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// V2 Modern UI — cleaner header with sticky pills, filters popover, context bar
// ---------------------------------------------------------------------------

type ChipArgs = {
  mode: "weighted" | "raw";
  decayMode: "with" | "without";
  seasonView: SeasonView;
  seasonScope: "cumulative" | "only";
  moduleFilter: ModuleFilter;
  view: "standard" | "players" | "competitions" | "clubs_stats";
  countryFilter: string;
  continentFilter: string;
  nameSearch: string;
  yearFrom: string;
  yearTo: string;
  contComp: string;
  natComp: string;
  slDiv: string;
  intlComp: string;
  intlTeam: string;
  intlCoach: string;
  setCountryFilter: (v: string) => void;
  setContinentFilter: (v: string) => void;
  setNameSearch: (v: string) => void;
  setYearFrom: (v: string) => void;
  setYearTo: (v: string) => void;
  setContComp: (v: string) => void;
  setNatComp: (v: string) => void;
  setSlDiv: (v: string) => void;
  setIntlComp: (v: string) => void;
  setIntlTeam: (v: string) => void;
  setIntlCoach: (v: string) => void;
};

function buildContextChips(a: ChipArgs): ContextChip[] {
  const chips: ContextChip[] = [];
  // Always show the "scope" (entity) and "module" badges as informative anchors
  const viewLabel: Record<ChipArgs["view"], string> = {
    standard: "Clubes · Treinadores · Países",
    players: "Jogadores",
    competitions: "Competições",
    clubs_stats: "Clubes (estatísticas)",
  };
  chips.push({ key: "view", label: viewLabel[a.view], tone: "primary" });
  if (a.view === "standard") {
    const mod = MODULE_FILTERS.find((m) => m.value === a.moduleFilter)?.label ?? a.moduleFilter;
    chips.push({ key: "mod", label: mod, tone: "muted" });
  }
  chips.push({ key: "mode", label: a.mode === "weighted" ? "Ponderado" : "Bruto", tone: "muted" });
  chips.push({
    key: "decay",
    label: a.decayMode === "with" ? "Com decaimento" : "Sem decaimento",
    tone: "muted",
  });
  if (a.seasonView !== "total") {
    chips.push({
      key: "season",
      label: `${a.seasonView} (${a.seasonScope === "cumulative" ? "acum." : "só"})`,
      tone: "muted",
    });
  }
  if (a.continentFilter) chips.push({ key: "cont", label: `Continente: ${a.continentFilter}`, onClear: () => a.setContinentFilter("") });
  if (a.countryFilter) chips.push({ key: "country", label: `País: ${a.countryFilter}`, onClear: () => a.setCountryFilter("") });
  if (a.nameSearch) chips.push({ key: "name", label: `Nome: ${a.nameSearch}`, onClear: () => a.setNameSearch("") });
  if (a.yearFrom !== "all") chips.push({ key: "yf", label: `Desde ${a.yearFrom}`, onClear: () => a.setYearFrom("all") });
  if (a.yearTo !== "all") chips.push({ key: "yt", label: `Até ${a.yearTo}`, onClear: () => a.setYearTo("all") });
  if (a.slDiv !== "all") chips.push({ key: "sl", label: `Divisão ${a.slDiv}`, onClear: () => a.setSlDiv("all") });
  if (a.natComp !== "all") chips.push({ key: "nc", label: a.natComp, onClear: () => a.setNatComp("all") });
  if (a.contComp !== "all") chips.push({ key: "cc", label: a.contComp, onClear: () => a.setContComp("all") });
  if (a.intlComp !== "all") chips.push({ key: "ic", label: a.intlComp, onClear: () => a.setIntlComp("all") });
  if (a.intlTeam) chips.push({ key: "it", label: `Seleção: ${a.intlTeam}`, onClear: () => a.setIntlTeam("") });
  if (a.intlCoach) chips.push({ key: "ico", label: `Treinador: ${a.intlCoach}`, onClear: () => a.setIntlCoach("") });
  return chips;
}

function RankingsV2Header(props: {
  seasonView: SeasonView;
  setSeasonView: (v: SeasonView) => void;
  availableYears: number[];
  seasonScope: "cumulative" | "only";
  setSeasonScope: (v: "cumulative" | "only") => void;
  mode: "weighted" | "raw";
  setMode: (v: "weighted" | "raw") => void;
  decayMode: "with" | "without";
  setDecayMode: (v: "with" | "without") => void;
  view: "standard" | "players" | "competitions" | "clubs_stats";
  setView: (v: "standard" | "players" | "competitions" | "clubs_stats") => void;
  moduleFilter: ModuleFilter;
  setModuleFilter: (v: ModuleFilter) => void;
  onSwitchToV1: () => void;
  contextChips: ContextChip[];
  onClearAll: () => void;
}) {
  const entityTabs: { value: typeof props.view; label: string }[] = [
    { value: "standard", label: "Clubes · Treinadores · Países" },
    { value: "players", label: "Jogadores" },
    { value: "competitions", label: "Competições" },
    { value: "clubs_stats", label: "Clubes (estatísticas)" },
  ];
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 pt-2 pb-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/60 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="size-6 text-primary" /> Rankings Mundiais
          </h1>
          <p className="text-muted-foreground text-xs mt-1">UI Moderna · Filtros, contexto e âmbito num só lugar</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Filter className="size-3.5" /> Opções
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[300px] space-y-3">
              <div>
                <Label className="text-xs">Modo de pontos</Label>
                <div className="flex rounded-lg border border-border p-1 mt-1">
                  <Button size="sm" variant={props.mode === "weighted" ? "default" : "ghost"} className="flex-1" onClick={() => props.setMode("weighted")}>Ponderado</Button>
                  <Button size="sm" variant={props.mode === "raw" ? "default" : "ghost"} className="flex-1" onClick={() => props.setMode("raw")}>Bruto</Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Decaimento temporal</Label>
                <div className="flex rounded-lg border border-border p-1 mt-1">
                  <Button size="sm" variant={props.decayMode === "with" ? "default" : "ghost"} className="flex-1" onClick={() => props.setDecayMode("with")}>Com</Button>
                  <Button size="sm" variant={props.decayMode === "without" ? "default" : "ghost"} className="flex-1" onClick={() => props.setDecayMode("without")}>Sem</Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Época</Label>
                <SeasonFilter
                  value={props.seasonView}
                  onChange={props.setSeasonView}
                  years={props.availableYears}
                  totalLabel="Todas as épocas"
                  className="w-full mt-1"
                />
                {props.seasonView !== "total" && (
                  <div className="flex rounded-lg border border-border p-1 mt-2">
                    <Button size="sm" variant={props.seasonScope === "cumulative" ? "default" : "ghost"} className="flex-1" onClick={() => props.setSeasonScope("cumulative")}>Acumulado</Button>
                    <Button size="sm" variant={props.seasonScope === "only" ? "default" : "ghost"} className="flex-1" onClick={() => props.setSeasonScope("only")}>Só essa</Button>
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-2">
                <Button size="sm" variant="ghost" className="w-full" onClick={props.onSwitchToV1}>
                  <LayoutDashboard className="size-3.5" /> UI Clássica
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Primary entity tabs */}
      <div className="flex flex-wrap gap-1.5">
        {entityTabs.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={props.view === t.value ? "default" : "ghost"}
            className="rounded-full"
            onClick={() => props.setView(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Scope (module) — only for standard view */}
      {props.view === "standard" && (
        <div className="flex flex-wrap gap-1.5">
          {MODULE_FILTERS.map((m) => (
            <Button
              key={m.value}
              size="sm"
              variant={props.moduleFilter === m.value ? "secondary" : "outline"}
              className="rounded-full"
              onClick={() => props.setModuleFilter(m.value)}
            >
              {m.label}
            </Button>
          ))}
        </div>
      )}

      <RankingsContextBar chips={props.contextChips} onClearAll={props.onClearAll} />
    </div>
  );
}


