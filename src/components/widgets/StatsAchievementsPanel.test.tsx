import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Achievement, ListeningStats } from "@/store/statsAchievementsStore";

const stats: ListeningStats = {
  totalPlayCount: 21,
  totalListenTime: 5220,
  uniqueArtists: 5,
  uniqueAlbums: 4,
  uniqueSongs: 12,
  favoriteArtist: "M83",
  favoriteAlbum: "Hurry Up",
  favoriteSong: "Midnight City",
  topArtists: [],
  topAlbums: [],
  topSongs: [],
  genreDistribution: [],
  dailyPlayData: [
    { date: "2026-05-14", playCount: 1, listenTime: 120 },
    { date: "2026-05-15", playCount: 3, listenTime: 300 },
    { date: "2026-05-16", playCount: 2, listenTime: 600 },
    { date: "2026-05-17", playCount: 0, listenTime: 0 },
    { date: "2026-05-18", playCount: 4, listenTime: 1200 },
    { date: "2026-05-19", playCount: 5, listenTime: 1500 },
    { date: "2026-05-20", playCount: 6, listenTime: 1500 },
  ],
  hourlyDistribution: {},
  dayOfWeekDistribution: {},
  audioQualityDistribution: {},
  moodDistribution: {},
  completedSongsCount: 18,
  skippedSongsCount: 3,
  proToolsUsage: {},
};

vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
  },
}));

vi.mock("@/components/stats/StatsVisuals", () => ({
  ActivityTrend: () => <div />,
  AudioQualityGauge: () => <div />,
  ListeningClock: () => <div />,
  ListeningHeatmap: () => <div />,
  MoodFlow: () => <div />,
  MusicalDNARadar: () => <div />,
  ProToolMasteryRadar: () => <div />,
}));

vi.mock("@/store/statsAchievementsStore", () => ({
  useStatsAchievementsStore: () => ({
    listeningStats: stats,
    achievements: [] as Achievement[],
    unlockAchievement: vi.fn(),
  }),
}));

describe("StatsAchievementsPanel", () => {
  it("renders weekly momentum and streak summary on the overview tab", async () => {
    const { StatsAchievementsPanel } = await import("./StatsAchievementsPanel");

    const html = renderToStaticMarkup(
      <StatsAchievementsPanel isOpen={true} onClose={() => undefined} />
    );

    expect(html).toContain("每周势头");
    expect(html).toContain("21 次播放");
    expect(html).toContain("87 分钟 本周");
    expect(html).toContain("连续听歌");
    expect(html).toContain("3-day streak");
    expect(html).toContain("最佳连续：3 天");
  });
});
