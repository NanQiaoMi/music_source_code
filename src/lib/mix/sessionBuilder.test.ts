import { describe, expect, it, vi } from "vitest";
import { buildSession, normalizeKnobs } from "./sessionBuilder";
import type { Song } from "@/types/song";

function song(overrides: Partial<Song> & { id: string }): Song {
  return {
    title: `Song ${overrides.id}`,
    artist: "Artist",
    duration: 180,
    source: "local",
    ...overrides,
  };
}

describe("buildSession", () => {
  it("includes the seed song first and respects requested length", () => {
    vi.setSystemTime(new Date("2026-05-20T00:00:00.000Z"));
    const seedSong = song({ id: "seed", genre: "Rock", bpm: 130 });
    const library = [
      song({ id: "a", genre: "Rock", bpm: 132 }),
      song({ id: "b", genre: "Jazz", bpm: 90 }),
      song({ id: "c", genre: "Rock", bpm: 125 }),
      song({ id: "d", genre: "Ambient", bpm: 70 }),
      song({ id: "e", genre: "Dance", bpm: 138 }),
    ];

    const session = buildSession({
      seedSong,
      library,
      recentSongIds: [],
      knobs: { energy: 0.8, familiarity: 0.5, length: 3 },
      random: () => 0.42,
    });

    expect(session.id).toBe(`mix-seed-${Date.now()}`);
    expect(session.seedSongId).toBe("seed");
    expect(session.songs).toHaveLength(5);
    expect(session.songs[0].id).toBe("seed");
    vi.useRealTimers();
  });

  it("deduplicates song ids before building the mix", () => {
    const seedSong = song({ id: "seed", genre: "Rock" });
    const duplicate = song({ id: "a", title: "Duplicate" });

    const session = buildSession({
      seedSong,
      library: [duplicate, duplicate, song({ id: "b" }), seedSong],
      recentSongIds: [],
      knobs: { energy: 0.5, familiarity: 0.5, length: 10 },
      random: () => 0.42,
    });

    expect(session.songs.map((item) => item.id)).toEqual(["seed", "a", "b"]);
  });

  it("uses deterministic ordering when random is injected", () => {
    const seedSong = song({ id: "seed", genre: "Rock", bpm: 130, playCount: 1 });
    const library = [
      song({ id: "recent", genre: "Rock", bpm: 130, playCount: 20 }),
      song({ id: "same-genre", genre: "Rock", bpm: 128, playCount: 2 }),
      song({ id: "calm", genre: "Ambient", bpm: 80, playCount: 1 }),
    ];

    const first = buildSession({
      seedSong,
      library,
      recentSongIds: ["recent"],
      knobs: { energy: 0.8, familiarity: 0.2, length: 5 },
      random: () => 0.42,
    });
    const second = buildSession({
      seedSong,
      library,
      recentSongIds: ["recent"],
      knobs: { energy: 0.8, familiarity: 0.2, length: 5 },
      random: () => 0.42,
    });

    expect(first.songs.map((item) => item.id)).toEqual(second.songs.map((item) => item.id));
    expect(first.songs.map((item) => item.id)).toEqual(["seed", "same-genre", "recent", "calm"]);
  });

  it("normalizes knobs to supported ranges", () => {
    expect(normalizeKnobs({ energy: 2, familiarity: -1, length: 99 })).toEqual({
      energy: 1,
      familiarity: 0,
      length: 50,
    });
    expect(normalizeKnobs({ energy: Number.NaN, familiarity: 0.4, length: 2 })).toEqual({
      energy: 0,
      familiarity: 0.4,
      length: 5,
    });
  });
});
