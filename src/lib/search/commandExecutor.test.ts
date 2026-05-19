import { describe, expect, it, vi } from "vitest";
import { executeSearchCommand } from "./commandExecutor";
import type { SearchCommand } from "./commandRouter";
import type { Song } from "@/types/song";

function command(overrides: Partial<SearchCommand>): SearchCommand {
  return {
    kind: "text-search",
    query: "",
    raw: "",
    ...overrides,
  };
}

function song(overrides: Partial<Song>): Song {
  return {
    id: "song-1",
    title: "Ocean Eyes",
    artist: "Billie",
    duration: 200,
    ...overrides,
  };
}

function deps() {
  return {
    songs: [song({ id: "song-1", title: "Ocean Eyes" })],
    setQuery: vi.fn(),
    search: vi.fn(),
    addRecentCommand: vi.fn(),
    setCommandFeedback: vi.fn(),
    clearQueue: vi.fn(),
    shuffleQueue: vi.fn(),
    addToQueue: vi.fn(),
    setCurrentSong: vi.fn(),
    setIsPlaying: vi.fn(),
    nextSong: vi.fn(),
    prevSong: vi.fn(),
    setVolume: vi.fn(),
    setSleepTimer: vi.fn(),
    onClose: vi.fn(),
  };
}

describe("executeSearchCommand", () => {
  it("pauses playback without closing the search panel", () => {
    const d = deps();

    executeSearchCommand(command({ kind: "pause", raw: "/pause" }), d);

    expect(d.setIsPlaying).toHaveBeenCalledWith(false);
    expect(d.setCommandFeedback).toHaveBeenCalledWith("Playback paused");
    expect(d.onClose).not.toHaveBeenCalled();
  });

  it("moves to next and previous songs through audio actions", () => {
    const nextDeps = deps();
    const prevDeps = deps();

    executeSearchCommand(command({ kind: "next", raw: "/next" }), nextDeps);
    executeSearchCommand(command({ kind: "prev", raw: "/prev" }), prevDeps);

    expect(nextDeps.nextSong).toHaveBeenCalledOnce();
    expect(nextDeps.setCommandFeedback).toHaveBeenCalledWith("Skipped to next song");
    expect(prevDeps.prevSong).toHaveBeenCalledOnce();
    expect(prevDeps.setCommandFeedback).toHaveBeenCalledWith("Returned to previous song");
  });

  it("sets volume when the parsed command includes a normalized volume", () => {
    const d = deps();

    executeSearchCommand(command({ kind: "volume", raw: "/volume 60", volume: 0.6 }), d);

    expect(d.setVolume).toHaveBeenCalledWith(0.6);
    expect(d.setCommandFeedback).toHaveBeenCalledWith("Volume set to 60%");
  });

  it("rejects invalid volume commands without mutating volume", () => {
    const d = deps();

    executeSearchCommand(command({ kind: "volume", raw: "/volume abc", volume: undefined }), d);

    expect(d.setVolume).not.toHaveBeenCalled();
    expect(d.setCommandFeedback).toHaveBeenCalledWith("Use /volume 60");
  });

  it("keeps existing play and queue command behavior", () => {
    const playDeps = deps();
    const queueDeps = deps();

    executeSearchCommand(command({ kind: "play", query: "ocean", raw: "/play ocean" }), playDeps);
    executeSearchCommand(
      command({ kind: "queue", query: "ocean", raw: "/queue ocean" }),
      queueDeps
    );

    expect(playDeps.setCurrentSong).toHaveBeenCalledWith(playDeps.songs[0]);
    expect(playDeps.setIsPlaying).toHaveBeenCalledWith(true);
    expect(playDeps.onClose).toHaveBeenCalledOnce();
    expect(queueDeps.addToQueue).toHaveBeenCalledWith(queueDeps.songs[0]);
    expect(queueDeps.setCommandFeedback).toHaveBeenCalledWith("Queued 1 song");
  });
});
