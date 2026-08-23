import { describe, it, expect, beforeEach } from "vitest";
import { useStorageAnalyticsStore, formatStorageBytes } from "./useStorageAnalyticsStore";
import { Song } from "@/types/song";

describe("useStorageAnalyticsStore", () => {
  it("should format bytes correctly", () => {
    expect(formatStorageBytes(0)).toBe("0 B");
    expect(formatStorageBytes(1024)).toBe("1 KB");
    expect(formatStorageBytes(1024 * 1024 * 5)).toBe("5.00 MB");
    expect(formatStorageBytes(1024 * 1024 * 1024 * 2.5)).toBe("2.50 GB");
  });

  it("should calculate quality, platform and health statistics from song library", async () => {
    const testSongs: Song[] = [
      { id: "1", title: "Song 1", artist: "Artist 1", source: "netease", duration: 200, cover: "https://cover.jpg", lyrics: "[00:00.00]Lyrics" },
      { id: "2", title: "Song 2 (Hi-Res)", artist: "Artist 2", source: "qq", duration: 210, cover: "https://cover.jpg", lyrics: "[00:00.00]Lyrics" },
      { id: "3", title: "Song 3 (FLAC)", artist: "Artist 3", source: "kugou", duration: 190 },
      { id: "4", title: "Song 4", artist: "Artist 4", source: "local", duration: 220, audioUrl: "stored://local-4" },
    ];

    const { refreshAnalytics } = useStorageAnalyticsStore.getState();
    await refreshAnalytics(testSongs);

    const state = useStorageAnalyticsStore.getState();
    expect(state.platformStats.total).toBe(4);
    expect(state.platformStats.netease).toBe(1);
    expect(state.platformStats.qq).toBe(1);
    expect(state.platformStats.kugou).toBe(1);
    expect(state.platformStats.local).toBe(1);

    expect(state.qualityStats.hiresCount).toBe(1);
    expect(state.qualityStats.flacCount).toBe(2); // Song 3 FLAC + Song 4 local

    expect(state.healthRadar.overallScore).toBeGreaterThanOrEqual(0);
    expect(state.healthRadar.overallScore).toBeLessThanOrEqual(100);
  });
});
