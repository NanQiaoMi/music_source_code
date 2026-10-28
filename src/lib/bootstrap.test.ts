import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapApp } from "./bootstrap";

const mocks = vi.hoisted(() => ({
  audioState: {} as Record<string, unknown>,
  playerState: {} as Record<string, unknown>,
  queueState: { queue: [] as unknown[], currentIndex: 0 },
  initializePlaylist: vi.fn(),
  initializeEmotions: vi.fn(),
  startWatchdog: vi.fn(),
  setLoopMode: vi.fn(),
}));

vi.mock("@/store/audioStore", () => ({
  useAudioStore: {
    setState: (updates: Record<string, unknown>) => Object.assign(mocks.audioState, updates),
  },
}));

vi.mock("@/store/playerStore", () => ({
  usePlayerStore: {
    getState: () => ({ ...mocks.playerState, setLoopMode: mocks.setLoopMode }),
  },
}));

vi.mock("@/store/queueStore", () => ({
  useQueueStore: { getState: () => mocks.queueState },
}));

vi.mock("@/store/playlistStore", () => ({
  usePlaylistStore: { getState: () => ({ initializePlaylist: mocks.initializePlaylist }) },
}));

vi.mock("@/store/emotionStore", () => ({
  useEmotionStore: { getState: () => ({ initializeEmotions: mocks.initializeEmotions }) },
}));

vi.mock("@/lib/audio/AudioContextWatchdog", () => ({
  AudioContextWatchdog: { getInstance: () => ({ start: mocks.startWatchdog }) },
}));

vi.mock("@/lib/bootstrapStores", () => ({
  hydrateStores: vi.fn(async () => ({
    phases: { playback: 0, queue: 0, audioProjection: 0, ui: 0, business: 0 },
    hydrated: [],
  })),
}));

describe("bootstrapApp playback restoration", () => {
  beforeEach(() => {
    mocks.audioState = { currentSong: null, isPlaying: false, currentTime: 0, duration: 0 };
    mocks.playerState = {
      currentSong: {
        id: "persisted-song",
        title: "Persisted Song",
        artist: "Artist",
        duration: 200,
      },
      currentTime: 25,
      duration: 200,
      loopMode: "all",
    };
    mocks.queueState = { queue: [], currentIndex: 0 };
    mocks.initializePlaylist
      .mockReset()
      .mockRejectedValueOnce(new Error("playlist initialization unavailable"))
      .mockResolvedValueOnce(undefined);
    mocks.initializeEmotions.mockReset();
    mocks.startWatchdog.mockReset();
    mocks.setLoopMode.mockReset();
  });

  it("does not restore a stale playback snapshot on retry or later calls", async () => {
    const firstResult = await bootstrapApp();

    expect(firstResult).toBe(false);
    expect(mocks.audioState).toMatchObject({ isPlaying: false, currentTime: 25 });
    // S6-4: 循环模式恢复改走 playerStore 同名 setter（经投影回填 audioStore 镜像）
    expect(mocks.setLoopMode).toHaveBeenCalledWith("all");

    Object.assign(mocks.audioState, { isPlaying: true, currentTime: 42 });
    const secondResult = await bootstrapApp();
    const thirdResult = await bootstrapApp();

    expect(secondResult).toBe(true);
    expect(thirdResult).toBe(true);
    expect(mocks.audioState).toMatchObject({ isPlaying: true, currentTime: 42 });
    expect(mocks.initializePlaylist).toHaveBeenCalledTimes(2);
    expect(mocks.initializeEmotions).toHaveBeenCalledTimes(1);
    expect(mocks.startWatchdog).toHaveBeenCalledTimes(1);
  });
});
