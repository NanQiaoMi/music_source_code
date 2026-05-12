import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateHealthReport, useLibraryHealthStore } from "./libraryHealthStore";
import type { Song } from "@/types/song";

function createSong(overrides: Partial<Song>): Song {
  return {
    id: "song",
    title: "Song",
    artist: "Artist",
    duration: 180,
    source: "local",
    audioUrl: "stored://song",
    cover: "/cover.png",
    lyrics: "[00:01.00]Line",
    ...overrides,
  };
}

describe("libraryHealthStore", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-05-13T00:00:00.000Z"));
    useLibraryHealthStore.setState({
      lastScan: null,
      isScanning: false,
      scanProgress: 0,
      healthReport: null,
      autoScan: true,
      scanInterval: 7,
      ignoredIssueIds: [],
    });
  });

  it("groups actionable health issues by missing url, duplicate metadata, invalid duration, and oversized covers", () => {
    const songs = [
      createSong({ id: "missing-url", audioUrl: "" }),
      createSong({ id: "duplicate-a", title: "Same", artist: "Artist" }),
      createSong({ id: "duplicate-b", title: "same", artist: "artist" }),
      createSong({ id: "invalid-duration", title: "Invalid", artist: "Duration", duration: 0 }),
      createSong({
        id: "big-cover",
        title: "Big",
        artist: "Cover",
        cover: `data:image/png;base64,${"a".repeat(1_100_000)}`,
      }),
    ];

    const report = generateHealthReport(songs);

    expect(report.issueGroups.missing_file.affectedSongIds).toEqual(["missing-url"]);
    expect(report.issueGroups.duplicate.affectedSongIds).toEqual(["duplicate-b"]);
    expect(report.issueGroups.low_quality.affectedSongIds).toEqual(["invalid-duration"]);
    expect(report.issueGroups.oversized_cover.affectedSongIds).toEqual(["big-cover"]);
    expect(report.issues.find((issue) => issue.type === "missing_file")?.actions).toContain(
      "rescan"
    );
  });
});
