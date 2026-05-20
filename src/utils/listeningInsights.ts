import type { Achievement, ListeningStats } from "@/store/statsAchievementsStore";

export interface InsightMetric {
  label: string;
  value: string;
  hint: string;
}

export interface ListeningInsightSummary {
  completionRate: number;
  skipRate: number;
  dominantPeriod: string;
  explorationScore: number;
  replayScore: number;
  trend: "rising" | "steady" | "cooling";
  trendDelta: number;
  dominantGenres: string[];
  qualityFocus: string;
  metrics: InsightMetric[];
}

export interface AchievementSpotlight {
  unlockedRecently: Achievement[];
  nearlyUnlocked: Achievement[];
  recommended: Achievement[];
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getPeriodLabel(hour: number): string {
  if (hour >= 5 && hour < 10) return "清晨型";
  if (hour >= 10 && hour < 14) return "白昼型";
  if (hour >= 14 && hour < 18) return "午后型";
  if (hour >= 18 && hour < 23) return "夜晚型";
  return "深夜型";
}

export function getTopTimeWindow(hourlyDistribution: Record<number, number>): {
  label: string;
  startHour: number;
  count: number;
} {
  const [hour, count] = Object.entries(hourlyDistribution).sort(
    (a, b) => Number(b[1]) - Number(a[1])
  )[0] || ["0", 0];
  const startHour = Number(hour);
  const endHour = (startHour + 1) % 24;

  return {
    label: `${String(startHour).padStart(2, "0")}:00-${String(endHour).padStart(2, "0")}:00`,
    startHour,
    count: Number(count) || 0,
  };
}

export function getListeningNextAction(summary: ListeningInsightSummary): string {
  if (summary.skipRate >= 35) return "整理高跳过率歌曲";
  if (summary.explorationScore < 25) return "试试新歌手发现";
  if (summary.replayScore >= 40) return "继续复听核心曲目";
  if (summary.completionRate < 65) return "开启完整专注收听";
  return summary.trend === "cooling" ? "开启完整专注收听" : "继续复听核心曲目";
}

export function summarizeListeningStats(stats: ListeningStats): ListeningInsightSummary {
  const total = Math.max(1, stats.totalPlayCount || 0);
  const completionRate = clampPercent(((stats.completedSongsCount || 0) / total) * 100);
  const skipRate = clampPercent(((stats.skippedSongsCount || 0) / total) * 100);

  const dominantHourEntry = Object.entries(stats.hourlyDistribution || {}).sort(
    (a, b) => Number(b[1]) - Number(a[1])
  )[0];
  const dominantHour = dominantHourEntry ? Number(dominantHourEntry[0]) : 21;
  const dominantPeriod = getPeriodLabel(dominantHour);

  const dominantGenres = (stats.genreDistribution || [])
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((item) => item.genre);

  const qualityEntry = Object.entries(stats.audioQualityDistribution || {}).sort(
    (a, b) => Number(b[1]) - Number(a[1])
  )[0];
  const qualityFocus = qualityEntry ? qualityEntry[0] : "standard";

  const explorationScore = clampPercent(((stats.uniqueArtists || 0) / total) * 100);
  const replayScore = clampPercent((1 - (stats.uniqueSongs || 0) / total) * 100);

  const recentDays = (stats.dailyPlayData || []).slice(-14);
  const previousWindow = recentDays.slice(0, Math.max(0, recentDays.length - 7));
  const currentWindow = recentDays.slice(-7);
  const previousAvg =
    previousWindow.length > 0
      ? previousWindow.reduce((sum, day) => sum + day.playCount, 0) / previousWindow.length
      : 0;
  const currentAvg =
    currentWindow.length > 0
      ? currentWindow.reduce((sum, day) => sum + day.playCount, 0) / currentWindow.length
      : 0;
  const trendDelta = Number((currentAvg - previousAvg).toFixed(1));
  const trend: "rising" | "steady" | "cooling" =
    trendDelta > 0.5 ? "rising" : trendDelta < -0.5 ? "cooling" : "steady";

  return {
    completionRate,
    skipRate,
    dominantPeriod,
    explorationScore,
    replayScore,
    trend,
    trendDelta,
    dominantGenres,
    qualityFocus,
    metrics: [
      {
        label: "完整听完率",
        value: `${completionRate}%`,
        hint: skipRate > 35 ? "最近切歌偏多" : "耐心收听表现稳定",
      },
      {
        label: "探索倾向",
        value: `${explorationScore}%`,
        hint: explorationScore > 45 ? "偏向持续找新歌手" : "更偏爱熟悉内容",
      },
      {
        label: "复听倾向",
        value: `${replayScore}%`,
        hint: replayScore > 40 ? "常回到固定爱歌" : "近期曲库流动较高",
      },
      {
        label: "活跃时段",
        value: dominantPeriod,
        hint: `${String(dominantHour).padStart(2, "0")}:00 左右最常听歌`,
      },
    ],
  };
}

function sortNearlyUnlocked(a: Achievement, b: Achievement): number {
  const ratioA = a.total > 0 ? a.progress / a.total : 0;
  const ratioB = b.total > 0 ? b.progress / b.total : 0;
  if (ratioB !== ratioA) return ratioB - ratioA;
  return a.total - a.progress - (b.total - b.progress);
}

export function getAchievementSpotlights(achievements: Achievement[]): AchievementSpotlight {
  const unlockedRecently = achievements
    .filter((achievement) => achievement.unlocked)
    .slice()
    .sort((a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0))
    .slice(0, 3);

  const candidates = achievements
    .filter((achievement) => !achievement.unlocked && achievement.progress > 0)
    .slice()
    .sort(sortNearlyUnlocked);

  const nearlyUnlocked = candidates.slice(0, 3);
  const recommended = achievements
    .filter((achievement) => !achievement.unlocked)
    .slice()
    .sort((a, b) => {
      const ratioA = a.total > 0 ? a.progress / a.total : 0;
      const ratioB = b.total > 0 ? b.progress / b.total : 0;
      if (ratioB !== ratioA) return ratioB - ratioA;
      return a.total - b.total;
    })
    .slice(0, 4);

  return {
    unlockedRecently,
    nearlyUnlocked,
    recommended,
  };
}
