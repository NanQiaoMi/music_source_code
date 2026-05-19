import { describe, expect, it } from "vitest";
import {
  buildDailyHistory,
  buildListeningStreak,
  buildOverviewMetrics,
  buildWeeklyMomentum,
} from "./viewModels";
import type { ListeningStats } from "@/store/statsAchievementsStore";

function createStats(overrides: Partial<ListeningStats> = {}): ListeningStats {
  return {
    totalPlayCount: 0,
    totalListenTime: 0,
    uniqueArtists: 0,
    uniqueAlbums: 0,
    uniqueSongs: 0,
    favoriteArtist: null,
    favoriteAlbum: null,
    favoriteSong: null,
    topArtists: [],
    topAlbums: [],
    topSongs: [],
    genreDistribution: [],
    dailyPlayData: [],
    hourlyDistribution: {},
    dayOfWeekDistribution: {},
    audioQualityDistribution: {},
    moodDistribution: {},
    completedSongsCount: 0,
    skippedSongsCount: 0,
    proToolsUsage: {},
    ...overrides,
  };
}

describe("stats view models", () => {
  it("buildOverviewMetrics returns six stable metric cards", () => {
    const metrics = buildOverviewMetrics(
      createStats({
        totalPlayCount: 42,
        totalListenTime: 7200,
        uniqueArtists: 8,
        uniqueAlbums: 6,
        uniqueSongs: 30,
        completedSongsCount: 9,
        skippedSongsCount: 1,
      })
    );

    expect(metrics.map((metric) => metric.id)).toEqual([
      "plays",
      "time",
      "artists",
      "albums",
      "songs",
      "completion",
    ]);
    expect(metrics.map((metric) => metric.value)).toEqual(["42", "2h", "8", "6", "30", "90%"]);
  });

  it("buildOverviewMetrics defaults missing stats fields to zero strings", () => {
    const metrics = buildOverviewMetrics({});

    expect(metrics).toHaveLength(6);
    expect(metrics.every((metric) => metric.value !== undefined)).toBe(true);
    expect(metrics.map((metric) => metric.value)).toEqual(["0", "0h", "0", "0", "0", "0%"]);
  });

  it("buildDailyHistory sorts days descending and caps to 30 rows", () => {
    const rows = Array.from({ length: 35 }, (_, index) => ({
      date: `2026-05-${String(index + 1).padStart(2, "0")}`,
      playCount: index,
      listenTime: index * 60,
    }));

    const history = buildDailyHistory(createStats({ dailyPlayData: rows }));

    expect(history).toHaveLength(30);
    expect(history[0]).toEqual({ date: "2026-05-35", playCount: 34, listenMinutes: 34 });
    expect(history.at(-1)?.date).toBe("2026-05-06");
  });

  it("buildDailyHistory normalizes missing counters to zero", () => {
    const history = buildDailyHistory({
      dailyPlayData: [{ date: "2026-05-20", playCount: 0, listenTime: 0 }],
    });

    expect(history).toEqual([{ date: "2026-05-20", playCount: 0, listenMinutes: 0 }]);
  });

  it("buildWeeklyMomentum returns the latest seven days in chronological order", () => {
    const momentum = buildWeeklyMomentum(
      createStats({
        dailyPlayData: [
          { date: "2026-05-16", playCount: 2, listenTime: 600 },
          { date: "2026-05-14", playCount: 1, listenTime: 120 },
          { date: "2026-05-20", playCount: 5, listenTime: 1500 },
          { date: "2026-05-18", playCount: 0, listenTime: 0 },
          { date: "2026-05-19", playCount: 4, listenTime: 900 },
          { date: "2026-05-15", playCount: 3, listenTime: 300 },
          { date: "2026-05-17", playCount: 6, listenTime: 1800 },
          { date: "2026-05-13", playCount: 9, listenTime: 2400 },
        ],
      })
    );

    expect(momentum.days.map((day) => day.date)).toEqual([
      "2026-05-14",
      "2026-05-15",
      "2026-05-16",
      "2026-05-17",
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
    ]);
    expect(momentum.totalPlays).toBe(21);
    expect(momentum.totalMinutes).toBe(87);
    expect(momentum.peakPlays).toBe(6);
    expect(momentum.days.find((day) => day.date === "2026-05-17")?.heightPercent).toBe(100);
  });

  it("buildListeningStreak reports current and best consecutive active days", () => {
    const streak = buildListeningStreak(
      createStats({
        dailyPlayData: [
          { date: "2026-05-14", playCount: 2, listenTime: 600 },
          { date: "2026-05-15", playCount: 1, listenTime: 300 },
          { date: "2026-05-16", playCount: 3, listenTime: 900 },
          { date: "2026-05-17", playCount: 0, listenTime: 0 },
          { date: "2026-05-18", playCount: 4, listenTime: 1200 },
          { date: "2026-05-19", playCount: 5, listenTime: 1500 },
        ],
      })
    );

    expect(streak.currentDays).toBe(2);
    expect(streak.bestDays).toBe(3);
    expect(streak.lastActiveDate).toBe("2026-05-19");
    expect(streak.label).toBe("2-day streak");
  });
});
