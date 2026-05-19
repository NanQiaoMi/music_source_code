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

function completionRate(stats: Partial<ListeningStats>): number {
  const completed = stats.completedSongsCount || 0;
  const skipped = stats.skippedSongsCount || 0;
  const total = completed + skipped;
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}
