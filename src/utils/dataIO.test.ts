import { describe, it, expect } from "vitest";
import type { Song } from "@/types/song";
import {
  exportSongsToCSV,
  exportSongsToJSON,
  importSongsFromCSV,
  importSongsFromJSON,
} from "./dataIO";

const createSong = (overrides: Partial<Song> = {}): Song => ({
  id: overrides.id ?? "song-1",
  title: overrides.title ?? "Test Song",
  artist: overrides.artist ?? "Test Artist",
  album: overrides.album ?? "Test Album",
  duration: overrides.duration ?? 185,
  cover: overrides.cover ?? "https://example.com/cover.jpg",
  source: overrides.source ?? "local",
  audioUrl: overrides.audioUrl ?? "https://example.com/audio.mp3",
  lyrics: overrides.lyrics,
  ...overrides,
});

describe("dataIO", () => {
  describe("exportSongsToJSON", () => {
    it("should export songs with metadata and formatted durations", () => {
      const json = exportSongsToJSON([createSong({ duration: 185 })]);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe("1.0");
      expect(parsed.songCount).toBe(1);
      expect(parsed.songs[0].durationFormatted).toBe("3:05");
      expect(parsed.songs[0].title).toBe("Test Song");
      expect(typeof parsed.exportDate).toBe("string");
    });
  });

  describe("importSongsFromJSON", () => {
    it("should import valid songs from exported JSON", () => {
      const song = createSong({ source: "upload" });
      const result = importSongsFromJSON(exportSongsToJSON([song]));

      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.songs[0]).toMatchObject({
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        cover: song.cover,
        source: song.source,
        audioUrl: song.audioUrl,
      });
    });

    it("should report invalid JSON", () => {
      const result = importSongsFromJSON("{ invalid json }");

      expect(result.success).toBe(false);
      expect(result.successCount).toBe(0);
      expect(result.errors[0]).toContain("JSON解析错误");
    });
  });

  describe("exportSongsToCSV", () => {
    it("should escape commas, quotes, and newlines", () => {
      const csv = exportSongsToCSV([
        createSong({
          title: 'Hello, "World"',
          artist: "Line\nBreak",
        }),
      ]);

      expect(csv).toContain('"Hello, ""World"""');
      expect(csv).toContain('"Line\nBreak"');
    });
  });

  describe("importSongsFromCSV", () => {
    it("should import valid CSV rows", () => {
      const csv = [
        "ID,标题,艺术家,专辑,时长(秒),时长(格式化),封面URL,音频URL,歌词,来源",
        "song-1,Test Song,Test Artist,Test Album,185,3:05,https://example.com/cover.jpg,https://example.com/audio.mp3,,local",
      ].join("\n");

      const result = importSongsFromCSV(csv);

      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.songs[0]).toMatchObject({
        id: "song-1",
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        duration: 185,
        source: "local",
      });
    });

    it("should fail fast on minimal invalid CSV input", () => {
      const result = importSongsFromCSV("ID,标题,艺术家");

      expect(result.success).toBe(false);
      expect(result.totalCount).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.errors).toEqual(["CSV数据格式错误：至少需要包含表头和一行数据"]);
    });
  });
});
