// S6-12c: the library-manager helpers are pure, so cover them directly after the extraction.
import { describe, expect, it } from "vitest";
import type { Song } from "@/types/song";
import {
  DEFAULT_LIBRARY_STATS,
  DEFAULT_RENAME_RULES,
  DEFAULT_SCAN_FILTERS,
  calculateQualityScore,
  generateDuplicateKey,
  type DuplicateSong,
} from "./helpers";

const duplicateSong = (overrides: Partial<DuplicateSong> = {}): DuplicateSong => ({
  id: "song-1",
  title: "晴天",
  artist: "周杰伦",
  duration: 269,
  fileSize: 1024 * 1024,
  qualityScore: 0,
  isRecommended: false,
  ...overrides,
});

const song = (overrides: Partial<Song> & { id: string }): Song => ({
  title: "晴天",
  artist: "周杰伦",
  duration: 269,
  source: "local",
  ...overrides,
});

describe("libraryManager helpers", () => {
  it("scores lossless high-bitrate files above lossy ones", () => {
    const lossless = calculateQualityScore(
      duplicateSong({ format: ".FLAC", bitrate: 1000, fileSize: 10 * 1024 * 1024 })
    );
    const lossy = calculateQualityScore(duplicateSong({ format: ".mp3", bitrate: 128 }));

    expect(lossless).toBe(140);
    expect(lossy).toBe(60);
    expect(lossless).toBeGreaterThan(lossy);
  });

  it("falls back to the generic format score and ignores unknown bitrates", () => {
    expect(calculateQualityScore(duplicateSong({ format: ".ape" }))).toBe(30);
    expect(calculateQualityScore(duplicateSong())).toBe(0);
    expect(calculateQualityScore(duplicateSong({ format: ".mp3", bitrate: 96 }))).toBe(50);
  });

  it("normalizes case and whitespace into a stable duplicate key", () => {
    const a = generateDuplicateKey(
      song({ id: "a", title: "  Hello  World ", artist: " The Artist " })
    );
    const b = generateDuplicateKey(song({ id: "b", title: "hello world", artist: "theartist" }));

    expect(a).toBe("theartist|helloworld");
    expect(a).toBe(b);
  });

  it("keeps the documented defaults", () => {
    expect(DEFAULT_RENAME_RULES.map((rule) => rule.id)).toEqual([
      "artist-title",
      "album-track-title",
      "title-artist",
    ]);
    expect(DEFAULT_SCAN_FILTERS.minDuration).toBe(10);
    expect(DEFAULT_SCAN_FILTERS.excludeDamaged).toBe(true);
    expect(DEFAULT_LIBRARY_STATS.duplicatesCount).toBe(0);
  });
});
