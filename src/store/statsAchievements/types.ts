// S6-12r: stats/achievements store 的类型层（仅 import type，无运行时依赖）。
// store 本体仍 re-export 公共类型，导入方无需改动。
import type { Song } from "@/types/song";

export type TimeRange = "day" | "week" | "month" | "year" | "all";

export interface ListeningStats {
  totalPlayCount: number;
  totalListenTime: number;
  uniqueArtists: number;
  uniqueAlbums: number;
  uniqueSongs: number;
  favoriteArtist: string | null;
  favoriteAlbum: string | null;
  favoriteSong: string | null;
  topArtists: { artist: string; playCount: number }[];
  topAlbums: { album: string; playCount: number }[];
  topSongs: { song: Song; playCount: number }[];
  genreDistribution: { genre: string; count: number }[];
  dailyPlayData: { date: string; playCount: number; listenTime: number }[];

  // New detailed stats
  hourlyDistribution: Record<number, number>; // 0-23
  dayOfWeekDistribution: Record<number, number>; // 0-6
  audioQualityDistribution: Record<string, number>; // "standard", "hi-res", "dsd", "lossless"
  moodDistribution: Record<string, number>; // "energetic", "calm", "happy", "melancholy", etc.
  completedSongsCount: number;
  skippedSongsCount: number;
  proToolsUsage: Record<string, number>; // "eq", "dsd_conv", "visualizer_config", "ab_loop"
}

export interface Achievement {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  category: "listening" | "exploration" | "collection" | "milestone" | "technical" | "temporal";
  difficulty: "bronze" | "silver" | "gold" | "platinum" | "legendary";
  unlocked: boolean;
  unlockedAt?: number;
  progress: number;
  total: number;
  conditionType?:
    | "plays"
    | "songs"
    | "artists"
    | "albums"
    | "time"
    | "streak"
    | "special"
    | "quality"
    | "pro-tools"
    | "completion";
}

export interface StatsPeriod {
  startDate: number;
  endDate: number;
  timeRange: TimeRange;
}

export interface StatsAchievementsState {
  listeningStats: ListeningStats;
  achievements: Achievement[];
  currentPeriod: StatsPeriod;
  isCalculating: boolean;
  lastCalculated: number;

  recordPlay: (
    song: Song,
    duration: number,
    completed: boolean,
    skipped: boolean,
    quality?: string
  ) => void;
  reportProToolsUsage: (toolId: string) => void;
  calculateStats: (songs: Song[], timeRange?: TimeRange) => Promise<void>;
  getStatsForPeriod: (period: StatsPeriod) => ListeningStats;

  unlockAchievement: (achievementId: string) => void;
  checkAchievements: (stats: ListeningStats) => void;
  getAchievementsByCategory: (category: Achievement["category"]) => Achievement[];
  getAchievementsByDifficulty: (difficulty: Achievement["difficulty"]) => Achievement[];
  getProgress: (achievementId: string) => { current: number; total: number };

  setCurrentPeriod: (period: StatsPeriod) => void;
  setIsCalculating: (calculating: boolean) => void;
  resetStats: () => void;
  resetAchievements: () => void;

  // Query methods for stats dashboard
  getPlayTimeStats(): {
    today: number;
    thisWeek: number;
    thisMonth: number;
    allTime: number;
  };
  getTopPlayedSongs(
    limit: number
  ): { songId: string; title: string; artist: string; playCount: number }[];
  getTopArtists(limit: number): { artist: string; playCount: number }[];
  getHourlyDistribution(): { hour: number; count: number }[];
}
