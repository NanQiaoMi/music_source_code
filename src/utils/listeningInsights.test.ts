import { describe, expect, it } from "vitest";
import type { Achievement, ListeningStats } from "@/store/statsAchievementsStore";
import {
  getAchievementSpotlights,
  getListeningNextAction,
  getTopTimeWindow,
  summarizeListeningStats,
} from "./listeningInsights";

const baseStats: ListeningStats = {
  totalPlayCount: 100,
  totalListenTime: 36_000,
  uniqueArtists: 42,
  uniqueAlbums: 18,
  uniqueSongs: 55,
  favoriteArtist: "Artist A",
  favoriteAlbum: "Album A",
  favoriteSong: "Song A",
  topArtists: [],
  topAlbums: [],
  topSongs: [],
  genreDistribution: [
    { genre: "Electronic", count: 30 },
    { genre: "Pop", count: 20 },
    { genre: "Ambient", count: 10 },
  ],
  dailyPlayData: [
    { date: "2026-05-01", playCount: 4, listenTime: 1200 },
    { date: "2026-05-02", playCount: 4, listenTime: 1200 },
    { date: "2026-05-03", playCount: 5, listenTime: 1500 },
    { date: "2026-05-04", playCount: 5, listenTime: 1500 },
    { date: "2026-05-05", playCount: 6, listenTime: 1800 },
    { date: "2026-05-06", playCount: 6, listenTime: 1800 },
    { date: "2026-05-07", playCount: 6, listenTime: 1800 },
    { date: "2026-05-08", playCount: 8, listenTime: 2400 },
    { date: "2026-05-09", playCount: 8, listenTime: 2400 },
    { date: "2026-05-10", playCount: 9, listenTime: 2700 },
    { date: "2026-05-11", playCount: 9, listenTime: 2700 },
    { date: "2026-05-12", playCount: 10, listenTime: 3000 },
    { date: "2026-05-13", playCount: 10, listenTime: 3000 },
    { date: "2026-05-14", playCount: 11, listenTime: 3300 },
  ],
  hourlyDistribution: { 21: 20, 22: 18, 9: 4 },
  dayOfWeekDistribution: {},
  audioQualityDistribution: { "hi-res": 12, standard: 8 },
  moodDistribution: {},
  completedSongsCount: 72,
  skippedSongsCount: 18,
  proToolsUsage: {},
};

describe("listeningInsights", () => {
  it("summarizes listening stats into practical metrics", () => {
    const summary = summarizeListeningStats(baseStats);

    expect(summary.completionRate).toBe(72);
    expect(summary.skipRate).toBe(18);
    expect(summary.dominantPeriod).toBe("夜晚型");
    expect(summary.qualityFocus).toBe("hi-res");
    expect(summary.dominantGenres).toEqual(["Electronic", "Pop", "Ambient"]);
    expect(summary.trend).toBe("rising");
    expect(summary.metrics).toHaveLength(4);
  });

  it("selects useful achievement spotlight groups", () => {
    const achievements: Achievement[] = [
      {
        id: "a",
        name: "A",
        nameEn: "A",
        description: "A",
        descriptionEn: "A",
        icon: "🎵",
        category: "listening",
        difficulty: "bronze",
        unlocked: true,
        unlockedAt: 300,
        progress: 10,
        total: 10,
        conditionType: "plays",
      },
      {
        id: "b",
        name: "B",
        nameEn: "B",
        description: "B",
        descriptionEn: "B",
        icon: "🎵",
        category: "listening",
        difficulty: "bronze",
        unlocked: false,
        progress: 9,
        total: 10,
        conditionType: "plays",
      },
      {
        id: "c",
        name: "C",
        nameEn: "C",
        description: "C",
        descriptionEn: "C",
        icon: "🎵",
        category: "exploration",
        difficulty: "silver",
        unlocked: false,
        progress: 4,
        total: 5,
        conditionType: "artists",
      },
      {
        id: "d",
        name: "D",
        nameEn: "D",
        description: "D",
        descriptionEn: "D",
        icon: "🎵",
        category: "technical",
        difficulty: "gold",
        unlocked: false,
        progress: 1,
        total: 10,
        conditionType: "pro-tools",
      },
    ];

    const spotlight = getAchievementSpotlights(achievements);

    expect(spotlight.unlockedRecently.map((item) => item.id)).toEqual(["a"]);
    expect(spotlight.nearlyUnlocked.map((item) => item.id)).toEqual(["b", "c", "d"]);
    expect(spotlight.recommended[0].id).toBe("b");
  });

  it("returns the busiest listening time window", () => {
    const window = getTopTimeWindow({ 8: 2, 21: 8, 22: 6 });

    expect(window).toEqual({
      label: "21:00-22:00",
      startHour: 21,
      count: 8,
    });
  });

  it("suggests整理高跳过率歌曲 when skip rate is high", () => {
    const summary = summarizeListeningStats({
      ...baseStats,
      skippedSongsCount: 45,
      completedSongsCount: 40,
    });

    expect(getListeningNextAction(summary)).toBe("整理高跳过率歌曲");
  });

  it("suggests trying new artists when exploration is low", () => {
    const summary = summarizeListeningStats({
      ...baseStats,
      uniqueArtists: 8,
      uniqueSongs: 95,
      skippedSongsCount: 5,
      completedSongsCount: 85,
    });

    expect(getListeningNextAction(summary)).toBe("试试新歌手发现");
  });
});
