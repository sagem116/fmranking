import type { ComputeInput, ComputeResult } from "./fm-rankings";

export interface CoachTitleSource {
  season: number;
  module: string;
  club: string;
  position: number | null;
  isChampion: boolean;
  continentalWins: string[];
  attributedTitles: number;
}

export interface CoachDebugRow {
  coach: string;
  totalAttributedTitles: number;
  sources: CoachTitleSource[];
  /** Assignments where the (season|module|club) had no standings row → 0 points/titles inherited. */
  unmatchedAssignments: { season: number; module: string; club: string }[];
}

export interface CoachDebugReport {
  rows: CoachDebugRow[];
  /** Coaches with assignments but `club_name` was null → completely skipped by computeRankings. */
  skippedNoClub: { coach: string; season: number; module: string }[];
  /** (season|module|club) that won titles but no coach was assigned in the imported data. */
  orphanTitleClubSeasons: { season: number; module: string; club: string; titles: number }[];
}

/**
 * Build a step-by-step trace of why each coach got the titles they did,
 * so we can diagnose entries showing 0 titles.
 */
export function buildCoachDebug(input: ComputeInput, ranks: ComputeResult): CoachDebugReport {
  const skippedNoClub: CoachDebugReport["skippedNoClub"] = [];
  const continentalWinsByKey = new Map<string, string[]>();
  for (const c of input.continental) {
    if (!c.winner) continue;
    const k = `${c.season_year}|continental|${c.winner}`;
    const arr = continentalWinsByKey.get(k) ?? [];
    arr.push(c.competition);
    continentalWinsByKey.set(k, arr);
  }
  const standingByKey = new Map<string, { position: number | null; isChampion: boolean }>();
  for (const s of input.standings) {
    standingByKey.set(`${s.season_year}|${s.module}|${s.club_name}`, {
      position: s.position,
      isChampion: s.is_champion,
    });
  }

  // Group assignments per coach
  const byCoach = new Map<string, CoachDebugRow>();
  for (const c of input.coaches) {
    if (!c.club_name) {
      skippedNoClub.push({ coach: c.name, season: c.season_year, module: c.module });
      continue;
    }
    const k = `${c.season_year}|${c.module}|${c.club_name}`;
    const row = byCoach.get(c.name) ?? {
      coach: c.name,
      totalAttributedTitles: 0,
      sources: [],
      unmatchedAssignments: [],
    };
    const inherited = ranks.clubSeasonPoints[k];
    const std = standingByKey.get(k);
    const contWins = c.module === "continental" ? continentalWinsByKey.get(k) ?? [] : [];
    if (!inherited) {
      row.unmatchedAssignments.push({ season: c.season_year, module: c.module, club: c.club_name });
    } else {
      const t = inherited.titles;
      row.totalAttributedTitles += t;
      row.sources.push({
        season: c.season_year,
        module: c.module,
        club: c.club_name,
        position: std?.position ?? null,
        isChampion: std?.isChampion ?? false,
        continentalWins: contWins,
        attributedTitles: t,
      });
    }
    byCoach.set(c.name, row);
  }
  const rows = [...byCoach.values()].sort((a, b) => b.totalAttributedTitles - a.totalAttributedTitles);

  // Orphan title clubs: where a club has titles but nobody is assigned as coach
  const assignedKeys = new Set(
    input.coaches.filter((c) => c.club_name).map((c) => `${c.season_year}|${c.module}|${c.club_name}`),
  );
  const orphanTitleClubSeasons: CoachDebugReport["orphanTitleClubSeasons"] = [];
  for (const [k, v] of Object.entries(ranks.clubSeasonPoints)) {
    if (v.titles <= 0) continue;
    if (assignedKeys.has(k)) continue;
    const [seasonStr, mod, club] = k.split("|");
    orphanTitleClubSeasons.push({ season: Number(seasonStr), module: mod, club, titles: v.titles });
  }
  orphanTitleClubSeasons.sort((a, b) => b.season - a.season || b.titles - a.titles);

  return { rows, skippedNoClub, orphanTitleClubSeasons };
}
