import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSmartMixStore, type SmartMixInput } from "./smartMixStore";
import { useQueueStore } from "./queueStore";
import type { Song } from "@/types/song";

function song(id: string, overrides: Partial<Song> = {}): Song {
  return {
    id,
    title: `Song ${id}`,
    artist: "Artist",
    duration: 180,
    source: "local",
    ...overrides,
  };
}

function input(): SmartMixInput {
  return {
    seedSong: song("seed", { genre: "Rock", bpm: 130 }),
    library: [
      song("a", { genre: "Rock", bpm: 128 }),
      song("b", { genre: "Ambient", bpm: 80 }),
      song("c", { genre: "Dance", bpm: 136 }),
      song("d", { genre: "Rock", bpm: 132 }),
    ],
    recentSongIds: [],
    knobs: { energy: 0.8, familiarity: 0.5, length: 5 },
    random: () => 0.42,
  };
}

describe("smartMixStore", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-05-20T00:00:00.000Z"));
    useSmartMixStore.setState({ currentSession: null, lastInput: null });
    useQueueStore.setState({ queue: [], currentIndex: 0, history: [], playThroughMode: "normal" });
    localStorage.clear();
  });

  it("starts a session and stores the last input", () => {
    const session = useSmartMixStore.getState().start(input());

    expect(session.seedSongId).toBe("seed");
    expect(session.songs[0].id).toBe("seed");
    expect(useSmartMixStore.getState().currentSession?.id).toBe(session.id);
    expect(useSmartMixStore.getState().lastInput?.seedSong.id).toBe("seed");
  });

  it("regenerates from the previous input", () => {
    useSmartMixStore.getState().start(input());
    const regenerated = useSmartMixStore.getState().regenerate();

    expect(regenerated?.seedSongId).toBe("seed");
    expect(regenerated?.songs.map((item) => item.id)).toEqual(
      useSmartMixStore.getState().currentSession?.songs.map((item) => item.id)
    );
  });

  it("returns null when regenerate has no previous input", () => {
    expect(useSmartMixStore.getState().regenerate()).toBeNull();
  });

  it("commits the active mix to queue", () => {
    const session = useSmartMixStore.getState().start(input());

    useSmartMixStore.getState().commitToQueue();

    expect(useQueueStore.getState().queue.map((item) => item.id)).toEqual(
      session.songs.map((item) => item.id)
    );
  });

  it("clears the active session", () => {
    useSmartMixStore.getState().start(input());

    useSmartMixStore.getState().clear();

    expect(useSmartMixStore.getState().currentSession).toBeNull();
    expect(useSmartMixStore.getState().lastInput).toBeNull();
  });
});
