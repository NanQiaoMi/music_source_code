import type { ListeningStats } from "@/store/statsAchievementsStore";

export type MetricTone = "amber" | "emerald" | "violet" | "blue" | "pink" | "indigo";

export interface MetricCardModel {
  id: string;
  label: string;
  value: string;
  tone: MetricTone;
}

export interface DailyHistoryRow {
  date: string;
  playCount: number;
  listenMinutes: number;
}

export interface WeeklyMomentumDay {
  date: string;
  playCount: number;
  listenMinutes: number;
  heightPercent: number;
}

export interface WeeklyMomentumModel {
  days: WeeklyMomentumDay[];
  totalPlays: number;
  totalMinutes: number;
  peakPlays: number;
}

export interface ListeningStreakModel {
  currentDays: number;
  bestDays: number;
  lastActiveDate: string | null;
  label: string;
}

export function buildOverviewMetrics(stats: Partial<ListeningStats>): MetricCardModel[] {
  return [
    {
      id: "plays",
      label: "Total plays",
      value: String(stats.totalPlayCount || 0),
      tone: "amber",
    },
    {
      id: "time",
      label: "Listening time",
      value: `${Math.floor((stats.totalListenTime || 0) / 3600)}h`,
      tone: "emerald",
    },
    {
      id: "artists",
      label: "Artists",
      value: String(stats.uniqueArtists || 0),
      tone: "violet",
    },
    {
      id: "albums",
      label: "Albums",
      value: String(stats.uniqueAlbums || 0),
      tone: "blue",
    },
    {
      id: "songs",
      label: "Songs",
      value: String(stats.uniqueSongs || 0),
      tone: "pink",
    },
    {
      id: "completion",
      label: "Completion",
      value: `${completionRate(stats)}%`,
      tone: "indigo",
    },
  ];
}

export function buildDailyHistory(stats: Partial<ListeningStats>): DailyHistoryRow[] {
  return [...(stats.dailyPlayData || [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)
    .map((row) => ({
      date: row.date,
      playCount: row.playCount || 0,
      listenMinutes: Math.round((row.listenTime || 0) / 60),
    }));
}

export function buildWeeklyMomentum(stats: Partial<ListeningStats>): WeeklyMomentumModel {
  const days = [...(stats.dailyPlayData || [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)
    .map((row) => ({
      date: row.date,
      playCount: row.playCount || 0,
      listenMinutes: Math.round((row.listenTime || 0) / 60),
      heightPercent: 0,
    }));
  const peakPlays = Math.max(...days.map((day) => day.playCount), 0);
  const hydratedDays = days.map((day) => ({
    ...day,
    heightPercent: peakPlays > 0 ? Math.round((day.playCount / peakPlays) * 100) : 0,
  }));

  return {
    days: hydratedDays,
    totalPlays: hydratedDays.reduce((sum, day) => sum + day.playCount, 0),
    totalMinutes: hydratedDays.reduce((sum, day) => sum + day.listenMinutes, 0),
    peakPlays,
  };
}

export function buildListeningStreak(stats: Partial<ListeningStats>): ListeningStreakModel {
  const activeDays = [...(stats.dailyPlayData || [])]
    .filter((row) => (row.playCount || 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (activeDays.length === 0) {
    return {
      currentDays: 0,
      bestDays: 0,
      lastActiveDate: null,
      label: "No streak",
    };
  }

  let bestDays = 1;
  let runLength = 1;

  for (let index = 1; index < activeDays.length; index += 1) {
    const previous = activeDays[index - 1];
    const current = activeDays[index];
    runLength = daysBetween(previous.date, current.date) === 1 ? runLength + 1 : 1;
    bestDays = Math.max(bestDays, runLength);
  }

  let currentDays = 1;
  for (let index = activeDays.length - 1; index > 0; index -= 1) {
    const current = activeDays[index];
    const previous = activeDays[index - 1];
    if (daysBetween(previous.date, current.date) !== 1) break;
    currentDays += 1;
  }

  const lastActiveDate = activeDays.at(-1)?.date || null;

  return {
    currentDays,
    bestDays,
    lastActiveDate,
    label: currentDays === 1 ? "1-day streak" : `${currentDays}-day streak`,
  };
}

function completionRate(stats: Partial<ListeningStats>): number {
  const completed = stats.completedSongsCount || 0;
  const skipped = stats.skippedSongsCount || 0;
  const total = completed + skipped;
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

function daysBetween(left: string, right: string): number {
  const leftTime = Date.parse(`${left}T00:00:00.000Z`);
  const rightTime = Date.parse(`${right}T00:00:00.000Z`);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return 0;
  return Math.round((rightTime - leftTime) / 86_400_000);
}
