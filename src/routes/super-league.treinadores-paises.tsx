import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Loader2, Globe2, ArrowDown, ChevronsUpDown, LineChart as LineIcon,
  Filter, X, Info,
} from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip as RTooltip, XAxis, YAxis, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EntityCombobox } from "@/components/EntityCombobox";
import { useRankings } from "@/lib/useRankings";
import { SuperLeagueHeader } from "@/components/SuperLeagueHeader";
import { fmtPts } from "@/lib/fmt";
import { cfgInternationalWeight, cfgDecay, cfgTitleWeight } from "@/lib/fm-config";

export const Route = createFileRoute("/super-league/treinadores-paises")({
  head: () => ({
    meta: [
      { title: "Treinadores por País — FM World Rankings" },
      { name: "description", content: "Pontos por nacionalidade do treinador em Super League, Continentais, Internacionais, Ligas Nacionais ou unificado." },
    ],
  }),
  component: Page,
});

type Scope = "superleague" | "continental" | "international" | "national" | "unified";

const SCOPE_LABEL: Record<Scope, string> = {
  superleague: "Super League",
  continental: "Continentais",
  international: "Internacional",
  national: "Ligas Nacionais",
  unified: "Unificado",
};

interface CoachAgg { name: string; pts: number; }
interface CountryAgg {
  pais: string;
  perEpoch: Record<number, number>;
  total: number;
  coaches: Map<string, number>; // coachName -> total pts (filtered scope)
}

const CHART_COLORS = ["var(--primary)", "var(--gold, #d4af37)", "#60a5fa", "#f87171", "#34d399", "#a78bfa", "#fb923c", "#22d3ee"];

const STAGE_RAW = { winner: 1, finalist: 0.25, semi: 0.125, quarter: 0.06 } as const;

function Page() {
  const { data, isLoading } = useRankings();

  const [scope, setScope] = useState<Scope>("superleague");
  const [sort, setSort] = useState<"total" | number>("total");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [norm, setNorm] = useState<"total" | "normalized">("total");

  // Common filters
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [yearFrom, setYearFrom] = useState<string>("all");
  const [yearTo, setYearTo] = useState<string>("all");

  // Scope-specific
  const [slDivision, setSlDivision] = useState<string>("all");
  const [nlDivision, setNlDivision] = useState<string>("all");
  const [contCompetition, setContCompetition] = useState<string>("all");
  const [intlCompetition, setIntlCompetition] = useState<string>("all");

  // For history chart
  const [selectedCountry, setSelectedCountry] = useState<string>("");

  // ---- Pre-built lookups ----
  const lookups = useMemo(() => {
    if (!data) return null;
    // Coach nationality (across all modules; first non-null wins)
    const coachNat = new Map<string, string>();
    for (const c of data.data.coaches) {
      if (c.nationality && !coachNat.has(c.name)) coachNat.set(c.name, c.nationality);
    }
    // Per (year, club) -> primary coach (prefer superleague > national > continental)
    const order: Record<string, number> = { superleague: 3, national: 2, continental: 1 };
    const clubCoachByYear = new Map<string, string>();
    const seenPriority = new Map<string, number>();
    for (const c of data.data.coaches) {
      if (!c.club_name) continue;
      const key = `${c.season_year}|${c.club_name}`;
      const pr = order[c.module] ?? 0;
      const cur = seenPriority.get(key) ?? -1;
      if (pr > cur) {
        seenPriority.set(key, pr);
        clubCoachByYear.set(key, c.name);
      }
    }
    // Year list
    const years = new Set<number>();
    data.data.standings.forEach((s) => years.add(s.season_year));
    data.data.continental.forEach((c) => years.add(c.season_year));
    data.data.international.forEach((c) => years.add(c.season_year));
    return {
      coachNat,
      clubCoachByYear,
      allYears: [...years].filter((y) => y > 0).sort((a, b) => a - b),
    };
  }, [data]);

  // ---- Available filter options (per scope) ----
  const filterOpts = useMemo(() => {
    if (!data) return { divisionsSL: [], divisionsNL: [], compsCont: [], compsIntl: [] };
    const divsSL = new Set<number>();
    const divsNL = new Set<string>();
    const compsC = new Set<string>();
    const compsI = new Set<string>();
    for (const s of data.data.standings) {
      if (s.module === "superleague" && s.division_num) divsSL.add(s.division_num);
      if (s.module === "national" && s.division_label) divsNL.add(s.division_label);
    }
    data.data.continental.forEach((c) => c.competition && compsC.add(c.competition));
    data.data.international.forEach((c) => c.competition && compsI.add(c.competition));
    return {
      divisionsSL: [...divsSL].sort((a, b) => a - b),
      divisionsNL: [...divsNL].sort(),
      compsCont: [...compsC].sort(),
      compsIntl: [...compsI].sort(),
    };
  }, [data]);

  // ---- Compute aggregations for current scope ----
  const { rows, epochs } = useMemo(() => {
    if (!data || !lookups) return { rows: [] as CountryAgg[], epochs: [] as number[] };
    const cfg = data.config;
    const yMin = yearFrom === "all" ? -Infinity : Number(yearFrom);
    const yMax = yearTo === "all" ? Infinity : Number(yearTo);
    const inYear = (y: number) => y >= yMin && y <= yMax;
    const csp = data.ranks.clubSeasonPoints;

    // Builder: add weighted pts attributed to (coachName, year)
    const acc = new Map<string, CountryAgg>();
    const epochsSet = new Set<number>();
    const addPts = (coachName: string | null | undefined, year: number, pts: number) => {
      if (!coachName || !pts || !inYear(year)) return;
      const nat = lookups.coachNat.get(coachName);
      if (!nat) return;
      epochsSet.add(year);
      let row = acc.get(nat);
      if (!row) { row = { pais: nat, perEpoch: {}, total: 0, coaches: new Map() }; acc.set(nat, row); }
      row.perEpoch[year] = (row.perEpoch[year] ?? 0) + pts;
      row.total += pts;
      row.coaches.set(coachName, (row.coaches.get(coachName) ?? 0) + pts);
    };

    const wantSL = scope === "superleague" || scope === "unified";
    const wantNL = scope === "national" || scope === "unified";
    const wantCont = scope === "continental" || scope === "unified";
    const wantIntl = scope === "international" || scope === "unified";

    // SUPER LEAGUE: attribute superleague clubSeasonPoints to that season's SL coach.
    // Honour division filter via standings.
    if (wantSL) {
      // Build (year,club)->division for SL.
      const slClubDiv = new Map<string, number | null>();
      for (const s of data.data.standings) {
        if (s.module !== "superleague") continue;
        slClubDiv.set(`${s.season_year}|${s.club_name}`, s.division_num ?? null);
      }
      const divFilter = slDivision === "all" ? null : Number(slDivision);
      for (const c of data.data.coaches) {
        if (c.module !== "superleague" || !c.club_name) continue;
        const key = `${c.season_year}|${c.club_name}`;
        if (divFilter !== null && slClubDiv.get(key) !== divFilter) continue;
        const pts = csp[`${c.season_year}|superleague|${c.club_name}`];
        if (pts) addPts(c.name, c.season_year, pts.weighted);
      }
    }

    // NATIONAL LEAGUES: attribute national clubSeasonPoints to national coach.
    if (wantNL) {
      const nlClubDiv = new Map<string, string | null>();
      for (const s of data.data.standings) {
        if (s.module !== "national") continue;
        nlClubDiv.set(`${s.season_year}|${s.club_name}`, s.division_label ?? null);
      }
      const divFilter = nlDivision === "all" ? null : nlDivision;
      for (const c of data.data.coaches) {
        if (c.module !== "national" || !c.club_name) continue;
        const key = `${c.season_year}|${c.club_name}`;
        if (divFilter !== null && nlClubDiv.get(key) !== divFilter) continue;
        const pts = csp[`${c.season_year}|national|${c.club_name}`];
        if (pts) addPts(c.name, c.season_year, pts.weighted);
      }
    }

    // CONTINENTAL: attribute clubs' continental points to (year,club) primary coach.
    // Filter by competition: if active, we must recompute from continental rows since
    // clubSeasonPoints aggregates all competitions for the club/season.
    if (wantCont) {
      if (contCompetition === "all") {
        // Use precomputed clubSeasonPoints for continental.
        const seen = new Set<string>();
        for (const key of Object.keys(csp)) {
          const [yStr, mod, ...rest] = key.split("|");
          if (mod !== "continental") continue;
          const club = rest.join("|");
          const year = Number(yStr);
          const ck = `${year}|${club}`;
          if (seen.has(ck)) continue;
          seen.add(ck);
          const coach = lookups.clubCoachByYear.get(ck);
          const pts = csp[key];
          if (coach && pts) addPts(coach, year, pts.weighted);
        }
      } else {
        // Recompute only matching competition rows.
        const latestYear = Math.max(0, ...data.data.continental.map((r) => r.season_year));
        const compW = cfg.competitionWeights.continental ?? 1;
        for (const r of data.data.continental) {
          if (r.competition !== contCompetition) continue;
          const { weight } = cfgTitleWeight(cfg, r.competition);
          const decay = cfgDecay(cfg, r.season_year, latestYear);
          const stage = (club: string | null | undefined, mult: number, stageMul: number) => {
            if (!club) return;
            const pts = weight * mult * compW * decay * stageMul;
            const coach = lookups.clubCoachByYear.get(`${r.season_year}|${club}`);
            if (coach) addPts(coach, r.season_year, pts);
          };
          if (r.winner) stage(r.winner, STAGE_RAW.winner, 1);
          const loser = r.winner === r.team1 ? r.team2 : r.team1;
          stage(loser, STAGE_RAW.finalist, cfg.stageMultipliers.finalist);
          [r.sf1, r.sf2].forEach((t) => stage(t, STAGE_RAW.semi, cfg.stageMultipliers.semi));
          [r.qf1, r.qf2, r.qf3, r.qf4].forEach((t) => stage(t, STAGE_RAW.quarter, cfg.stageMultipliers.quarter));
        }
      }
    }

    // INTERNATIONAL: attribute per-row to international coach by name.
    if (wantIntl) {
      const latestYear = Math.max(0, ...data.data.international.map((r) => r.season_year));
      const compW = cfg.competitionWeights.international ?? 1;
      for (const r of data.data.international) {
        if (intlCompetition !== "all" && r.competition !== intlCompetition) continue;
        const { weight } = cfgInternationalWeight(cfg, r.competition);
        const decay = cfgDecay(cfg, r.season_year, latestYear);
        const stage = (coach: string | null | undefined, mult: number, stageMul: number) => {
          if (!coach) return;
          const pts = weight * mult * compW * decay * stageMul;
          addPts(coach, r.season_year, pts);
        };
        if (r.winner) {
          const wc = r.winner === r.team1 ? r.coach1 : r.coach2;
          stage(wc, STAGE_RAW.winner, 1);
        }
        const loserCoach = r.winner === r.team1 ? r.coach2 : r.coach1;
        stage(loserCoach, STAGE_RAW.finalist, cfg.stageMultipliers.finalist);
        [r.sf1_coach, r.sf2_coach].forEach((c) => stage(c, STAGE_RAW.semi, cfg.stageMultipliers.semi));
        [r.qf1_coach, r.qf2_coach, r.qf3_coach, r.qf4_coach].forEach((c) => stage(c, STAGE_RAW.quarter, cfg.stageMultipliers.quarter));
      }
    }

    let rowsArr = [...acc.values()];
    if (countryFilter) rowsArr = rowsArr.filter((r) => r.pais === countryFilter);

    return { rows: rowsArr, epochs: [...epochsSet].sort((a, b) => a - b) };
  }, [data, lookups, scope, slDivision, nlDivision, contCompetition, intlCompetition, yearFrom, yearTo, countryFilter]);

  const factorOf = (r: CountryAgg) => (norm === "normalized" ? 1 / Math.max(1, r.coaches.size) : 1);

  const sorted = useMemo(() => {
    const list = [...rows];
    const sign = dir === "desc" ? -1 : 1;
    list.sort((a, b) => {
      const fa = norm === "normalized" ? 1 / Math.max(1, a.coaches.size) : 1;
      const fb = norm === "normalized" ? 1 / Math.max(1, b.coaches.size) : 1;
      const va = (sort === "total" ? a.total : a.perEpoch[sort] ?? 0) * fa;
      const vb = (sort === "total" ? b.total : b.perEpoch[sort] ?? 0) * fb;
      return (va - vb) * sign;
    });
    return list;
  }, [rows, sort, dir, norm]);

  // History for chart: respects scope + scope filters but ignores year range.
  const historyChart = useMemo(() => {
    if (!lookups || !sorted.length) return [];
    const focus = selectedCountry || sorted[0].pais;
    const r = sorted.find((x) => x.pais === focus) ?? sorted[0];
    const allYears = lookups.allYears;
    const f = factorOf(r);
    return allYears.map((y) => ({ year: y, value: Math.round(((r.perEpoch[y] ?? 0) * f) * 100) / 100, name: r.pais }));
  }, [sorted, selectedCountry, lookups, norm]);

  const focusName = selectedCountry || sorted[0]?.pais || "";

  const allCountries = useMemo(() => {
    if (!data) return [] as string[];
    const s = new Set<string>();
    for (const c of data.data.coaches) if (c.nationality) s.add(c.nationality);
    return [...s].sort();
  }, [data]);

  const toggleSort = (k: "total" | number) => {
    if (sort === k) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSort(k); setDir("desc"); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular…
      </div>
    );
  }
  if (!data) {
    return <p className="text-muted-foreground">Sem dados. Importe uma época primeiro.</p>;
  }

  const Sortable = ({ k, label }: { k: "total" | number; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${sort === k ? "text-foreground" : ""}`}
    >
      {label}
      {sort === k ? (
        <ArrowDown className={`size-3 transition-transform ${dir === "asc" ? "rotate-180" : ""}`} />
      ) : (
        <ChevronsUpDown className="size-3 opacity-50" />
      )}
    </button>
  );

  const yearsSelectable = lookups?.allYears ?? [];


  const filtersActive =
    countryFilter || yearFrom !== "all" || yearTo !== "all" ||
    slDivision !== "all" || nlDivision !== "all" ||
    contCompetition !== "all" || intlCompetition !== "all";

  const clearFilters = () => {
    setCountryFilter(""); setYearFrom("all"); setYearTo("all");
    setSlDivision("all"); setNlDivision("all");
    setContCompetition("all"); setIntlCompetition("all");
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <SuperLeagueHeader
          icon={Globe2}
          title="Treinadores por País"
          description="Pontos conquistados pelos treinadores, agregados pela sua nacionalidade. Alterna entre Super League, Continentais, Internacionais, Ligas Nacionais ou Unificado."
        />

        {/* Scope toggle */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Âmbito do ranking</Label>
              <ToggleGroup
                type="single"
                value={scope}
                onValueChange={(v) => v && setScope(v as Scope)}
                className="flex flex-wrap gap-1 justify-start"
              >
                {(Object.keys(SCOPE_LABEL) as Scope[]).map((s) => (
                  <ToggleGroupItem key={s} value={s} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    {SCOPE_LABEL[s]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Normalização</Label>
              <ToggleGroup
                type="single"
                value={norm}
                onValueChange={(v) => v && setNorm(v as "total" | "normalized")}
                className="flex flex-wrap gap-1 justify-start"
              >
                <ToggleGroupItem value="total" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  Total
                </ToggleGroupItem>
                <ToggleGroupItem value="normalized" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  Por treinador
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-[11px] text-muted-foreground mt-1">
                {norm === "normalized"
                  ? "Pontos divididos pelo número de treinadores do país no âmbito atual."
                  : "Soma dos pontos de todos os treinadores do país."}
              </p>
            </div>

            {/* Filters */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                <Filter className="size-4 text-primary" /> Filtros
                {filtersActive && (
                  <Button size="sm" variant="ghost" className="ml-auto h-auto py-1" onClick={clearFilters}>
                    <X className="size-3.5" /> Limpar
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">País</Label>
                  <EntityCombobox
                    value={countryFilter}
                    onChange={setCountryFilter}
                    options={allCountries}
                    placeholder="Todos"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Época (de)</Label>
                  <Select value={yearFrom} onValueChange={setYearFrom}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Mais antiga</SelectItem>
                      {yearsSelectable.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Época (até)</Label>
                  <Select value={yearTo} onValueChange={setYearTo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Mais recente</SelectItem>
                      {yearsSelectable.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                {(scope === "superleague" || scope === "unified") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Divisão (Super League)</Label>
                    <Select value={slDivision} onValueChange={setSlDivision}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {filterOpts.divisionsSL.map((d) => (<SelectItem key={d} value={String(d)}>Divisão {d}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(scope === "national" || scope === "unified") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Liga Nacional</Label>
                    <Select value={nlDivision} onValueChange={setNlDivision}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {filterOpts.divisionsNL.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(scope === "continental" || scope === "unified") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Competição (Continental)</Label>
                    <Select value={contCompetition} onValueChange={setContCompetition}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {filterOpts.compsCont.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(scope === "international" || scope === "unified") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Competição (Internacional)</Label>
                    <Select value={intlCompetition} onValueChange={setIntlCompetition}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {filterOpts.compsIntl.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {sorted.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Nenhum resultado para os filtros selecionados.
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                    <th className="text-left p-3 w-12">#</th>
                    <th className="text-left p-3">País</th>
                    {epochs.map((y) => (
                      <th key={y} className="text-right p-3"><Sortable k={y} label={String(y)} /></th>
                    ))}
                    <th className="text-right p-3"><Sortable k="total" label="Total" /></th>
                    <th className="text-right p-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => {
                    const isFocus = r.pais === focusName;
                    const topCoaches: CoachAgg[] = [...r.coaches.entries()]
                      .map(([name, pts]) => ({ name, pts }))
                      .sort((a, b) => b.pts - a.pts);
                    return (
                      <tr
                        key={r.pais}
                        onClick={() => setSelectedCountry(r.pais)}
                        className={`border-b border-border/50 cursor-pointer transition-colors ${isFocus ? "bg-primary/10" : "hover:bg-muted/50"}`}
                      >
                        <td className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</td>
                        <td className="p-3 font-medium">
                          <Link
                            to="/paises/$name"
                            params={{ name: r.pais }}
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {r.pais}
                          </Link>
                        </td>
                        {epochs.map((y) => {
                          const f = factorOf(r);
                          const v = (r.perEpoch[y] ?? 0) * f;
                          return (
                            <td key={y} className={`p-3 text-right tabular-nums ${v ? "" : "text-muted-foreground/30"}`}>
                              {v ? fmtPts(v) : "—"}
                            </td>
                          );
                        })}
                        <td className="p-3 text-right tabular-nums font-semibold">
                          {fmtPts(r.total * factorOf(r))}
                          {norm === "normalized" && (
                            <span className="ml-1 text-[10px] text-muted-foreground">/{r.coaches.size}</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Detalhes por treinador"
                              >
                                <Info className="size-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <div className="font-semibold mb-1">{r.pais} — Treinadores ({SCOPE_LABEL[scope]})</div>
                              {topCoaches.length === 0 ? (
                                <div className="text-muted-foreground">Sem detalhe.</div>
                              ) : (
                                <ul className="space-y-0.5">
                                  {topCoaches.slice(0, 10).map((c) => (
                                    <li key={c.name} className="flex justify-between gap-3 tabular-nums">
                                      <span>{c.name}</span>
                                      <span className="font-medium">{fmtPts(c.pts)}</span>
                                    </li>
                                  ))}
                                  {topCoaches.length > 10 && (
                                    <li className="text-muted-foreground text-[10px] pt-1">+{topCoaches.length - 10} treinadores</li>
                                  )}
                                </ul>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <LineIcon className="size-4 text-primary" /> Histórico por país
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">País</Label>
                <Select value={focusName} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sorted.map((r) => (<SelectItem key={r.pais} value={r.pais}>{r.pais}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Evolução dos pontos por época para o âmbito e filtros selecionados (intervalo de épocas aplica-se).
            </p>
          </CardHeader>
          <CardContent>
            {historyChart.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem evolução para mostrar.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyChart} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="year" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <RTooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => fmtPts(v)}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="value" name={focusName} stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
