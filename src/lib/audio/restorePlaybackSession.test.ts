import { describe, expect, it } from "vitest";
import { resolveRestoredPlaybackSession } from "./restorePlaybackSession";
import { Song } from "@/types/song";

function createSong(overrides: Partial<Song>): Song {
  return {
    id: "song-1",
    title: "Song",
    artist: "Artist",
    duration: 180,
    source: "local",
    ...overrides,
  };
}

describe("resolveRestoredPlaybackSession", () => {
  it("restores the current song from the persisted queue", () => {
    const queue = [
      createSong({ id: "song-1", title: "One", audioUrl: "stored://song-1" }),
      createSong({ id: "song-2", title: "Two", audioUrl: "stored://song-2" }),
    ];

    const session = resolveRestoredPlaybackSession(queue, 1, []);

    expect(session?.currentIndex).toBe(1);
    expect(session?.currentSong.id).toBe("song-2");
    expect(session?.currentSong.audioUrl).toBe("stored://song-2");
  });

  it("fills missing persisted audio URLs from the refreshed library", () => {
    const queue = [createSong({ id: "local-1", title: "Persisted", audioUrl: undefined })];
    const library = [
      createSong({
        id: "local-1",
        title: "Library Copy",
        cover: "data:image/png;base64,a",
        audioUrl: "stored://local-1",
      }),
    ];

    const session = resolveRestoredPlaybackSession(queue, 0, library);

    expect(session?.currentSong.audioUrl).toBe("stored://local-1");
    expect(session?.currentSong.cover).toBe("data:image/png;base64,a");
  });

  it("falls back to the first playable song when the saved index is unavailable", () => {
    const queue = [
      createSong({ id: "stale", audioUrl: undefined }),
      createSong({ id: "playable", audioUrl: "stored://playable" }),
    ];

    const session = resolveRestoredPlaybackSession(queue, 0, []);

    expect(session?.currentIndex).toBe(1);
    expect(session?.currentSong.id).toBe("playable");
  });

  it("does not restore queues that have no playable audio source", () => {
    const queue = [createSong({ id: "stale", audioUrl: undefined })];

    expect(resolveRestoredPlaybackSession(queue, 0, [])).toBeNull();
  });
});
