import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";
import { useStatsAchievementsStore, type Achievement } from "./statsAchievementsStore";
import { useToastStore } from "./toastStore";
import { Song } from "@/types/song";

function createMockSong(id: string, title?: string, artist?: string): Song {
  return {
    id,
    title: title ?? `Song ${id}`,
    artist: artist ?? "Test Artist",
    cover: "cover.jpg",
    duration: 200,
    source: "local",
  };
}

describe("achievement toast ownership (S6-8b)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    useToastStore.getState().clearToasts();
  });

  const achievement: Achievement = {
    id: "first-song",
    name: "初听",
    nameEn: "First Song",
    description: "播放第一首歌",
    descriptionEn: "Play your first song",
    icon: "🎵",
    category: "milestone",
    difficulty: "bronze",
    unlocked: false,
    progress: 0,
    total: 1,
  };

  it("enqueues exactly one achievement-variant toast in toastStore (single owner)", () => {
    vi.useFakeTimers();
    useStatsAchievementsStore.setState({ achievements: [{ ...achievement }] });

    useStatsAchievementsStore.getState().unlockAchievement(achievement.id);

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({
      type: "success",
      duration: 4000,
      variant: "achievement",
      achievement: {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
      },
    });
    expect("activeToasts" in useStatsAchievementsStore.getState()).toBe(false);

    // 已解锁成就不会重复入队。
    useStatsAchievementsStore.getState().unlockAchievement(achievement.id);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    // 自动消失由 toastStore 的 duration 定时器负责（拆前是组件内 4000ms 定时器）。
    vi.advanceTimersByTime(4000);
    expect(useToastStore.getState().toasts).toEqual([]);
  });
});

describe("statsAchievementsStore - query methods", () => {
  beforeEach(() => {
    useStatsAchievementsStore.setState({
      listeningStats: {
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
      },
      lastCalculated: 0,
    });
  });

  it("getPlayTimeStats returns default zeros", () => {
    const stats = useStatsAchievementsStore.getState().getPlayTimeStats();
    expect(stats.today).toBe(0);
    expect(stats.thisWeek).toBe(0);
    expect(stats.thisMonth).toBe(0);
    expect(stats.allTime).toBe(0);
  });

  it("getPlayTimeStats returns totalListenTime as allTime", () => {
    useStatsAchievementsStore.setState({
      listeningStats: {
        ...useStatsAchievementsStore.getState().listeningStats,
        totalListenTime: 36000,
      },
    });
    const stats = useStatsAchievementsStore.getState().getPlayTimeStats();
    expect(stats.allTime).toBe(36000);
  });

  it("getTopPlayedSongs returns empty array when no songs", () => {
    const songs = useStatsAchievementsStore.getState().getTopPlayedSongs(10);
    expect(songs).toEqual([]);
  });

  it("getTopPlayedSongs returns songs sorted by playCount descending", () => {
    const song1 = createMockSong("2", "Song B", "Artist Y");
    const song2 = createMockSong("1", "Song A", "Artist X");
    const song3 = createMockSong("3", "Song C", "Artist Z");

    useStatsAchievementsStore.setState({
      listeningStats: {
        ...useStatsAchievementsStore.getState().listeningStats,
        topSongs: [
          { song: song1, playCount: 10 },
          { song: song2, playCount: 5 },
          { song: song3, playCount: 3 },
        ],
      },
    });

    const songs = useStatsAchievementsStore.getState().getTopPlayedSongs(10);
    expect(songs).toHaveLength(3);
    expect(songs[0].songId).toBe("2");
    expect(songs[0].playCount).toBe(10);
    expect(songs[1].songId).toBe("1");
    expect(songs[2].songId).toBe("3");
  });

  it("getTopPlayedSongs respects limit", () => {
    const songs = Array.from({ length: 5 }, (_, i) => ({
      song: createMockSong(String(i)),
      playCount: i * 10,
    }));

    useStatsAchievementsStore.setState({
      listeningStats: {
        ...useStatsAchievementsStore.getState().listeningStats,
        topSongs: songs,
      },
    });

    const result = useStatsAchievementsStore.getState().getTopPlayedSongs(2);
    expect(result).toHaveLength(2);
  });

  it("getTopArtists returns empty array when no artists", () => {
    const artists = useStatsAchievementsStore.getState().getTopArtists(10);
    expect(artists).toEqual([]);
  });

  it("getTopArtists returns artists sorted by playCount descending", () => {
    useStatsAchievementsStore.setState({
      listeningStats: {
        ...useStatsAchievementsStore.getState().listeningStats,
        topArtists: [
          { artist: "Artist B", playCount: 15 },
          { artist: "Artist C", playCount: 7 },
          { artist: "Artist A", playCount: 3 },
        ],
      },
    });

    const artists = useStatsAchievementsStore.getState().getTopArtists(10);
    expect(artists).toHaveLength(3);
    expect(artists[0].artist).toBe("Artist B");
    expect(artists[0].playCount).toBe(15);
    expect(artists[1].artist).toBe("Artist C");
    expect(artists[2].artist).toBe("Artist A");
  });

  it("getTopArtists respects limit", () => {
    const artists = Array.from({ length: 5 }, (_, i) => ({
      artist: `Artist ${i}`,
      playCount: i,
    }));

    useStatsAchievementsStore.setState({
      listeningStats: {
        ...useStatsAchievementsStore.getState().listeningStats,
        topArtists: artists,
      },
    });

    const result = useStatsAchievementsStore.getState().getTopArtists(2);
    expect(result).toHaveLength(2);
  });

  it("getHourlyDistribution returns 24 entries", () => {
    const dist = useStatsAchievementsStore.getState().getHourlyDistribution();
    expect(dist).toHaveLength(24);
  });

  it("getHourlyDistribution has correct structure", () => {
    useStatsAchievementsStore.setState({
      listeningStats: {
        ...useStatsAchievementsStore.getState().listeningStats,
        hourlyDistribution: { 8: 5, 12: 3, 20: 7 },
      },
    });

    const dist = useStatsAchievementsStore.getState().getHourlyDistribution();
    expect(dist[8].hour).toBe(8);
    expect(dist[8].count).toBe(5);
    expect(dist[12].hour).toBe(12);
    expect(dist[12].count).toBe(3);
    expect(dist[20].hour).toBe(20);
    expect(dist[20].count).toBe(7);
    expect(dist[0].hour).toBe(0);
    expect(dist[0].count).toBe(0);
  });
});
