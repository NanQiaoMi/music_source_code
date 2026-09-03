import { describe, it, expect, vi, afterEach } from "vitest";
import type { Song } from "@/types/song";
import {
  calculateDiversityScore,
  calculateFamiliarityScore,
  calculateFreshnessScore,
  calculateSimilarity,
  generateRecommendations,
  generateDailyRecommendationGroups,
  scoreSongForRecommendation,
  getMaxPlayCount,
  getNormalizedPlay,
  type SongWithPlayCount,
} from "./recommendationLogic";

const DAY_MS = 24 * 60 * 60 * 1000;

const createSong = (overrides: Partial<SongWithPlayCount> = {}): SongWithPlayCount => ({
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

      const recentSong = createSong({
        playCount: 8,
        lastPlayedAt: 10 * DAY_MS - 12 * 60 * 60 * 1000,
      });
      const olderSong = createSong({
        id: "song-2",
        playCount: 8,
        lastPlayedAt: 10 * DAY_MS - 10 * DAY_MS,
      });

      expect(calculateFamiliarityScore(recentSong, 10)).toBe(1);
      expect(calculateFamiliarityScore(olderSong, 10)).toBe(0.8);
      expect(calculateFamiliarityScore(createSong({ playCount: 0 }), 10)).toBe(0);
    });
  });

  describe("calculateSimilarity", () => {
    it("should weight exact artist matches strongly", () => {
      const baseSong: Song = createSong({ title: "Base", artist: "Daft Punk", album: undefined });
      const sameArtist: Song = createSong({
        id: "song-2",
        title: "Other",
        artist: "Daft Punk",
        album: undefined,
      });

      expect(calculateSimilarity(baseSong, sameArtist)).toBeCloseTo(2 / 3);
    });

    it("should weight exact album matches when artists differ", () => {
      const songA: Song = createSong({ title: "Alpha", artist: "Artist A", album: "Discovery" });
      const songB: Song = createSong({
        id: "song-2",
        title: "Beta",
        artist: "Artist B",
        album: "Discovery",
      });

      expect(calculateSimilarity(songA, songB)).toBeCloseTo(0.6);
    });

    it("should detect remix-style title similarity", () => {
      const songA: Song = createSong({
        title: "Midnight City (Live)",
        artist: "Artist A",
        album: undefined,
      });
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

  describe("scoreSongForRecommendation", () => {
    it("adds reason codes for matching artist, genre, and replay pattern", () => {
      const candidateSong = createSong({
        id: "candidate",
        artist: "Candidate Artist",
        genre: "Electronic",
        playCount: 4,
      });
      const recentSong = createSong({ id: "recent", artist: "Other Artist", genre: "Pop" });

      const result = scoreSongForRecommendation(candidateSong, {
        recentSongs: [recentSong],
        topArtists: ["Candidate Artist"],
        topGenres: ["Electronic"],
        skippedSongIds: new Set(),
      });

      expect(result.reasons.map((reason) => reason.code)).toEqual(
        expect.arrayContaining(["artist-match", "genre-match", "replay-friendly"])
      );
      expect(result.score).toBeGreaterThan(50);
    });

    it("penalizes noise tracks, type beats, and pure symbol titles", () => {
      const typeBeat = createSong({
        id: "beat-1",
        title: '"Dream Lover" Gunna Type Beat',
        artist: "BoxerEven",
        playCount: 0,
      });
      const emojiSong = createSong({
        id: "emoji-1",
        title: "^.^",
        artist: "Lv9",
        playCount: 0,
      });
      const shortAudio = createSong({
        id: "short-1",
        title: "Short Clip",
        duration: 20,
        playCount: 0,
      });

      const normalSong = createSong({
        id: "normal-1",
        title: "Normal Melodic Track",
        artist: "Artist X",
        duration: 210,
        playCount: 0,
      });

      const context = {
        recentSongs: [],
        topArtists: [],
        topGenres: [],
        skippedSongIds: new Set<string>(),
      };

      const scoreTypeBeat = scoreSongForRecommendation(typeBeat, context).score;
      const scoreEmoji = scoreSongForRecommendation(emojiSong, context).score;
      const scoreShort = scoreSongForRecommendation(shortAudio, context).score;
      const scoreNormal = scoreSongForRecommendation(normalSong, context).score;

      expect(scoreTypeBeat).toBeLessThan(scoreNormal);
      expect(scoreEmoji).toBeLessThan(scoreNormal);
      expect(scoreShort).toBeLessThan(scoreNormal);
    });
  });

  describe("generateDailyRecommendationGroups artist diversity", () => {
    it("prevents duplicate artist monopoly across recommendations", () => {
      const songs = [
        createSong({ id: "anhe-1", title: "红豆", artist: "安河桥南", playCount: 10 }),
        createSong({ id: "anhe-2", title: "晚安", artist: "安河桥南", playCount: 9 }),
        createSong({ id: "anhe-3", title: "拥抱", artist: "安河桥南", playCount: 8 }),
        createSong({ id: "anhe-4", title: "旅行的意义", artist: "安河桥南", playCount: 7 }),
        createSong({ id: "other-1", title: "晴天", artist: "周杰伦", playCount: 6 }),
        createSong({ id: "other-2", title: "七里香", artist: "周杰伦", playCount: 5 }),
        createSong({ id: "other-3", title: "后来", artist: "刘若英", playCount: 4 }),
        createSong({ id: "other-4", title: "温柔", artist: "五月天", playCount: 4 }),
        createSong({ id: "other-5", title: "追光者", artist: "岑宁儿", playCount: 3 }),
        createSong({ id: "other-6", title: "起风了", artist: "买辣椒也用券", playCount: 3 }),
      ];

      const result = generateDailyRecommendationGroups(
        songs,
        {
          recentSongs: [],
          topArtists: ["安河桥南", "周杰伦"],
          topGenres: [],
          skippedSongIds: new Set(),
        },
        undefined,
        4
      );

      // Verify that 'familiar' group only picks 1 song from 安河桥南 instead of all 4!
      const familiarGroup = result.groups.find((g: any) => g.category === "familiar");
      expect(familiarGroup).toBeDefined();
      const anheCount = familiarGroup!.songs.filter((s: any) => s.artist === "安河桥南").length;
      expect(anheCount).toBeLessThanOrEqual(1);

      // Verify overall orderedSongs doesn't stack the same artist consecutively
      for (let i = 0; i < result.orderedSongs.length - 1; i++) {
        expect(result.orderedSongs[i].artist).not.toBe(result.orderedSongs[i + 1].artist);
      }
    });
  });
});
