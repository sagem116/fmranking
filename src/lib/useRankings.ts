import { useQuery } from "@tanstack/react-query";
import { fetchAllData } from "./fm-db";
import { computeRankings, computeInternationalRankings, type RankingEntry, type BreakdownItem, type ComputeResult } from "./fm-rankings";
import { fetchActiveConfig } from "./fm-config-db";
import { applyDesafioBonuses, evaluateDesafios, loadDesafios } from "./fm-desafios";

function mergeEntries(base: RankingEntry[], extra: RankingEntry[]): RankingEntry[] {
  const map = new Map<string, RankingEntry>();
  for (const e of base) map.set(e.name, { ...e });
  for (const e of extra) {
    const cur = map.get(e.name);
    if (cur) {
      cur.raw += e.raw;
      cur.weighted += e.weighted;
      cur.titles += e.titles;
    } else {
      map.set(e.name, { ...e });
    }
  }
  return [...map.values()].sort((a, b) => b.weighted - a.weighted);
}

function mergeEvolution(
  base: Record<string, Record<number, number>>,
  extra: Record<string, Record<number, number>>,
): Record<string, Record<number, number>> {
  const out: Record<string, Record<number, number>> = {};
  for (const [k, v] of Object.entries(base)) out[k] = { ...v };
  for (const [k, v] of Object.entries(extra)) {
    const cur = out[k] ?? {};
    for (const [y, val] of Object.entries(v)) {
      const yn = Number(y);
      cur[yn] = (cur[yn] ?? 0) + val;
    }
    out[k] = cur;
  }
  return out;
}

function mergeBreakdown(
  base: Record<string, BreakdownItem[]>,
  extra: Record<string, BreakdownItem[]>,
): Record<string, BreakdownItem[]> {
  const out: Record<string, BreakdownItem[]> = {};
  for (const [k, v] of Object.entries(base)) out[k] = [...v];
  for (const [k, v] of Object.entries(extra)) {
    out[k] = [...(out[k] ?? []), ...v];
  }
  return out;
}

function mergeInternationalIntoRanks(ranks: ComputeResult, intl: ReturnType<typeof computeInternationalRankings>): ComputeResult {
  return {
    ...ranks,
    countries: mergeEntries(ranks.countries, intl.countries),
    coaches: mergeEntries(ranks.coaches, intl.coaches),
    evolution: {
      clubs: ranks.evolution.clubs,
      coaches: mergeEvolution(ranks.evolution.coaches, intl.evolution.coaches),
      countries: mergeEvolution(ranks.evolution.countries, intl.evolution.countries),
    },
    breakdown: {
      clubs: ranks.breakdown.clubs,
      coaches: mergeBreakdown(ranks.breakdown.coaches, intl.breakdown.coaches),
      countries: mergeBreakdown(ranks.breakdown.countries, intl.breakdown.countries),
    },
    years: [...new Set([...ranks.years, ...intl.years])].sort((a, b) => a - b),
    bonusAchievements: ranks.bonusAchievements,
  };
}

export function useRankings() {
  return useQuery({
    queryKey: ["fm-all-data", "v3-refresh-after-import"],
    queryFn: async () => {
      const [data, cfg] = await Promise.all([fetchAllData(), fetchActiveConfig()]);
      const baseRanks = computeRankings(
        {
          standings: data.standings,
          continental: data.continental,
          coaches: data.coaches,
          clubCountry: data.clubCountry,
        },
        cfg.config,
      );
      const intlRanks = computeInternationalRankings(data.international ?? [], cfg.config);
      let ranks = mergeInternationalIntoRanks(baseRanks, intlRanks);
      const desafios = loadDesafios();
      const desafioResults = evaluateDesafios(data, ranks, desafios);
      ranks = applyDesafioBonuses(ranks, desafioResults);
      return { data, ranks, config: cfg.config, activeProfileId: cfg.activeId, desafios, desafioResults };
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h — invalidated explicitly on import/config save
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    refetchOnReconnect: false,
  });
}

export function useRankingsNoDecay() {
  return useQuery({
    queryKey: ["fm-all-data", "v3-refresh-after-import", "no-decay"],
    queryFn: async () => {
      const [data, cfg] = await Promise.all([fetchAllData(), fetchActiveConfig()]);
      const flatConfig = {
        ...cfg.config,
        decayMultipliers: { last: 1, age1: 1, age2: 1, age3: 1, older: 1 },
      };
      const baseRanks = computeRankings(
        {
          standings: data.standings,
          continental: data.continental,
          coaches: data.coaches,
          clubCountry: data.clubCountry,
        },
        flatConfig,
      );
      const intlRanks = computeInternationalRankings(data.international ?? [], flatConfig);
      let ranks = mergeInternationalIntoRanks(baseRanks, intlRanks);
      const desafios = loadDesafios();
      const desafioResults = evaluateDesafios(data, ranks, desafios);
      ranks = applyDesafioBonuses(ranks, desafioResults);
      return { data, ranks, config: flatConfig, activeProfileId: cfg.activeId, desafios, desafioResults };
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    refetchOnReconnect: false,
  });
}

export function useActiveConfig() {
  return useQuery({
    queryKey: ["fm-config"],
    queryFn: fetchActiveConfig,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

