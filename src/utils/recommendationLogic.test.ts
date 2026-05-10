import { describe, it, expect, vi, afterEach } from "vitest";
import type { Song } from "@/types/song";
import {
  calculateDiversityScore,
  calculateFamiliarityScore,
  calculateFreshnessScore,
  calculateSimilarity,
  generateRecommendations,
  getMaxPlayCount,
  getNormalizedPlay,
  type SongWithPlayCount,
} from "./recommendationLogic";

const DAY_MS = 24 * 60 * 60 * 1000;

const createSong = (
  overrides: Partial<SongWithPlayCount> = {}
): SongWithPlayCount => ({
  id: overrides.id ?? "song-1",
  title: overrides.title ?? "Test Song",
  artist: overrides.artist ?? "Test Artist",
  album: overrides.album ?? "Test Album",
  duration: overrides.duration ?? 180,
  cover: overrides.cover ?? "https://example.com/cover.jpg",
  source: overrides.source ?? "local",
  playCount: overrides.playCount ?? 0,
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recommendationLogic", () => {
  describe("getMaxPlayCount", () => {
    it("should return 1 for an empty list", () => {
      expect(getMaxPlayCount([])).toBe(1);
    });

    it("should return the highest play count with a floor of 1", () => {
      expect(
        getMaxPlayCount([
          createSong({ playCount: 0 }),
          createSong({ id: "song-2", playCount: 8 }),
          createSong({ id: "song-3", playCount: 3 }),
        ])
      ).toBe(8);

      expect(getMaxPlayCount([createSong({ playCount: 0 })])).toBe(1);
    });
  });

  describe("getNormalizedPlay", () => {
    it("should normalize play counts and cap them at 1", () => {
      expect(getNormalizedPlay(createSong({ playCount: 4 }), 8)).toBe(0.5);
      expect(getNormalizedPlay(createSong({ playCount: 12 }), 8)).toBe(1);
    });

    it("should return 0 when maxPlayCount is 0", () => {
      expect(getNormalizedPlay(createSong({ playCount: 4 }), 0)).toBe(0);
    });
  });

  describe("freshness and familiarity", () => {
    it("should keep freshness scores in the 0-1 range", () => {
      expect(calculateFreshnessScore(createSong({ playCount: 0 }), 10)).toBe(1);
      expect(calculateFreshnessScore(createSong({ playCount: 10 }), 10)).toBe(0);
    });

    it("should keep familiarity scores in the 0-1 range and boost recent songs", () => {
      vi.spyOn(Date, "now").mockReturnValue(10 * DAY_MS);

      const recentSong = createSong({ playCount: 8, lastPlayedAt: 10 * DAY_MS - 12 * 60 * 60 * 1000 });
      const olderSong = createSong({ id: "song-2", playCount: 8, lastPlayedAt: 10 * DAY_MS - 10 * DAY_MS });

      expect(calculateFamiliarityScore(recentSong, 10)).toBe(1);
      expect(calculateFamiliarityScore(olderSong, 10)).toBe(0.8);
      expect(calculateFamiliarityScore(createSong({ playCount: 0 }), 10)).toBe(0);
    });
  });

  describe("calculateSimilarity", () => {
    it("should weight exact artist matches strongly", () => {
      const baseSong: Song = createSong({ title: "Base", artist: "Daft Punk", album: undefined });
      const sameArtist: Song = createSong({ id: "song-2", title: "Other", artist: "Daft Punk", album: undefined });

      expect(calculateSimilarity(baseSong, sameArtist)).toBeCloseTo(2 / 3);
    });

    it("should weight exact album matches when artists differ", () => {
      const songA: Song = createSong({ title: "Alpha", artist: "Artist A", album: "Discovery" });
      const songB: Song = createSong({ id: "song-2", title: "Beta", artist: "Artist B", album: "Discovery" });

      expect(calculateSimilarity(songA, songB)).toBeCloseTo(0.6);
    });

    it("should detect remix-style title similarity", () => {
      const songA: Song = createSong({ title: "Midnight City (Live)", artist: "Artist A", album: undefined });
      const songB: Song = createSong({
        id: "song-2",
        title: "Midnight City Acoustic",
        artist: "Artist B",
        album: undefined,
      });

      expect(calculateSimilarity(songA, songB)).toBeCloseTo(23 / 30);
    });
  });

  describe("calculateDiversityScore", () => {
    it("should floor the diversity score at 0.1", () => {
      const repeatedSong = createSong({ artist: "Repeat Artist", album: "Repeat Album" });
      const selectedSongs = Array.from({ length: 8 }, (_, index) =>
        createSong({
          id: `selected-${index}`,
          artist: "Repeat Artist",
          album: "Repeat Album",
        })
      );

      expect(calculateDiversityScore(repeatedSong, selectedSongs)).toBe(0.1);
    });
  });

  describe("generateRecommendations", () => {
    it("should return bounded unique results and exclude the current song", () => {
      const songs = [
        createSong({ id: "current", title: "Current", artist: "Anchor Artist", playCount: 10 }),
        createSong({ id: "a", title: "A", artist: "Artist A", album: "Album 1", playCount: 1 }),
        createSong({ id: "b", title: "B", artist: "Artist B", album: "Album 2", playCount: 3 }),
        createSong({ id: "c", title: "C", artist: "Artist C", album: "Album 3", playCount: 5 }),
        createSong({ id: "d", title: "D", artist: "Artist D", album: "Album 4", playCount: 7 }),
      ];

      const recommendations = generateRecommendations(
        songs,
        {
          currentSong: songs[0],
          x: 0.75,
          y: -0.75,
        },
        3
      );

      expect(recommendations).toHaveLength(3);
      expect(recommendations.every((song) => song.id !== "current")).toBe(true);
      expect(new Set(recommendations.map((song) => song.id)).size).toBe(recommendations.length);
    });

    it("should never return more songs than are available", () => {
      const songs = [
        createSong({ id: "one", playCount: 2 }),
        createSong({ id: "two", playCount: 4 }),
      ];

      expect(generateRecommendations(songs, { x: 0, y: 0 }, 10)).toHaveLength(2);
    });
  });
});
