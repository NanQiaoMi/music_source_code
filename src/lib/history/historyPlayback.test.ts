import { describe, expect, it } from "vitest";
import type { HistorySong } from "@/store/queueStore";
import type { Song } from "@/types/song";
import { resolveHistoryPlaybackSong, resolvePlayableHistorySongs } from "./historyPlayback";

function historySong(overrides: Partial<HistorySong> = {}): HistorySong {
  return {
    id: "song-1",
    title: "Old Title",
    artist: "Old Artist",
    duration: 180,
    cover: "history-cover.jpg",
    playedAt: 1_000,
    ...overrides,
  };
}

function librarySong(overrides: Partial<Song> = {}): Song {
  return {
    id: "song-1",
    title: "Library Title",
    artist: "Library Artist",
    album: "Library Album",
    duration: 220,
    cover: "library-cover.jpg",
    source: "local",
    audioUrl: "stored://song-1",
    lyrics: "[00:00.00] lyric",
    ...overrides,
  };
}

describe("history playback helpers", () => {
  it("resolves a compact history entry to the playable library song by id", () => {
    const resolved = resolveHistoryPlaybackSong(historySong(), [librarySong()]);

    expect(resolved).toMatchObject({
      id: "song-1",
      title: "Library Title",
      artist: "Library Artist",
      audioUrl: "stored://song-1",
      source: "local",
    });
  });

  it("keeps history metadata as a fallback when the library no longer has the song", () => {
    const resolved = resolveHistoryPlaybackSong(historySong(), []);

    expect(resolved).toMatchObject({
      id: "song-1",
      title: "Old Title",
      artist: "Old Artist",
      cover: "history-cover.jpg",
      source: "local",
    });
    expect(resolved.audioUrl).toBeUndefined();
  });

  it("filters replay groups to entries that can be resolved to playable audio", () => {
    const songs = resolvePlayableHistorySongs(
      [historySong({ id: "song-1" }), historySong({ id: "missing" })],
      [librarySong({ id: "song-1", audioUrl: "stored://song-1" })]
    );

    expect(songs.map((song) => song.id)).toEqual(["song-1"]);
    expect(songs[0].audioUrl).toBe("stored://song-1");
  });
});
