/** S1-10 matrix — queue authority (S1-5/S1-6) + persistence formats (S1-2/S1-3/S6-5). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playbackMediaBridge } from "@/lib/playback/mediaBridge";
import { nextPlayback } from "@/store/actions/playbackEngineActions";
import { flushAllThrottledStorages } from "@/lib/storage/throttledPersist";
import { setAudioPersistenceSuspended, useAudioStore } from "@/store/audioStore";
import { DEFAULT_EQ_PRESETS, useEQStore } from "@/store/eqStore";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQueueStore } from "@/store/queueStore";
import { useUIStore } from "@/store/uiStore";
import type { Song } from "@/types/song";

const QUEUE_KEY = "queue-store-v5";
const PLAYER_KEY = "player-store";
const AUDIO_KEY = "audio-store-v4";
const EQ_KEY = "eq-store";
const DUPLICATED_KEYS = ["queue", "currentIndex", "eqBands", "currentEQPreset", "isEQEnabled"];

const song = (id: string): Song => ({
  id,
  title: `Song ${id}`,
  artist: "S1-10",
  duration: 180,
  source: "local",
  audioUrl: `stored://${id}`,
});

const queueIds = (): string[] => useQueueStore.getState().queue.map((item) => item.id);

function resetStores(): void {
  usePlaybackRuntimeStore.getState().reset();
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  useQueueStore.setState(useQueueStore.getInitialState(), true);
  useAudioStore.setState(useAudioStore.getInitialState(), true);
  useEQStore.setState(useEQStore.getInitialState(), true);
  // S2-2：reset 产生的写盘是节流的，测试读 envelope 前先排空
  flushAllThrottledStorages();
}

/** audioStore stays a read-only projection: no queue/currentIndex owner or setters. */
function expectNoQueueMirror(): void {
  const state = useAudioStore.getState() as unknown as Record<string, unknown>;
  for (const key of ["queue", "currentIndex"]) {
    expect(Object.prototype.hasOwnProperty.call(state, key)).toBe(false);
  }
  expect(state.setQueue).toBeUndefined();
  expect(state.setCurrentIndex).toBeUndefined();
}

function navigationSnapshot() {
  return {
    currentSongId: usePlayerStore.getState().currentSong?.id ?? null,
    index: useQueueStore.getState().currentIndex,
    targetSongId: usePlaybackRuntimeStore.getState().targetSongId,
    queue: queueIds(),
  };
}

/** B is playing when the user deletes it; queueStore.currentIndex now points at C. */
function seedRemovedCurrentSong(): void {
  useAudioStore.getState().playQueue([song("a"), song("b"), song("c")], 1);
  useQueueStore.getState().removeFromQueue(1);
}

function readRaw(key: string): string {
  const raw = localStorage.getItem(key);
  expect(raw).not.toBeNull();
  return raw as string;
}

beforeEach(() => {
  localStorage.clear();
  playbackMediaBridge.disposeForTests();
  resetStores();
});

afterEach(() => {
  playbackMediaBridge.disposeForTests();
  vi.restoreAllMocks();
});

describe("S1-10 queue authority", () => {
  it("ended and manual next share the navigator after the current item was deleted", () => {
    seedRemovedCurrentSong();
    expect(queueIds()).toEqual(["a", "c"]);
    nextPlayback();
    const manual = navigationSnapshot();
    expect(manual).toEqual({ currentSongId: "c", index: 1, targetSongId: "c", queue: ["a", "c"] });
    expectNoQueueMirror();
    resetStores();
    seedRemovedCurrentSong();
    const audio = document.createElement("audio");
    const release = playbackMediaBridge.attach(audio, { onEnded: () => nextPlayback() });
    audio.dispatchEvent(new Event("ended"));
    expect(navigationSnapshot()).toEqual(manual);
    expect(useAudioStore.getState().error).toBeNull();
    release();
  });

  it("reorder, boundary end and clear keep queueStore the only owner", () => {
    useAudioStore.getState().playQueue([song("a"), song("b"), song("c")], 0);
    useQueueStore.getState().reorderQueue(2, 0);
    expect(queueIds()).toEqual(["c", "a", "b"]);
    nextPlayback();
    expect(navigationSnapshot()).toMatchObject({ currentSongId: "b", index: 2 });
    const showToast = vi.spyOn(useUIStore.getState(), "showToast");
    nextPlayback();
    expect(usePlayerStore.getState().currentSong).toBeNull();
    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(false);
    expect(useAudioStore.getState().error).toBeNull();
    useQueueStore.getState().clearQueue();
    nextPlayback();
    expect(queueIds()).toEqual([]);
    expect(useQueueStore.getState().currentIndex).toBe(0);
    expect(useAudioStore.getState().isPlaying).toBe(false);
    expect(showToast).not.toHaveBeenCalled();
    expectNoQueueMirror();
    showToast.mockRestore();
  });
});

describe("S1-10 persistence formats", () => {
  it("queue-store-v5 roundtrip keeps a 200-item queue, 30 history entries and the index", async () => {
    const queueStore = useQueueStore.getState();
    queueStore.setQueue(Array.from({ length: 200 }, (_, index) => song(`q${index}`)));
    queueStore.setCurrentIndex(199);
    for (let index = 0; index < 35; index += 1) queueStore.addToHistory(song(`h${index}`));
    const raw = readRaw(QUEUE_KEY);
    const persisted = JSON.parse(raw) as {
      state: { queue: Song[]; history: { id: string }[]; currentIndex: number };
    };
    expect(persisted.state.queue).toHaveLength(200);
    expect(persisted.state.history).toHaveLength(30);
    expect(persisted.state.currentIndex).toBe(199);
    // Reload: reset writes defaults, then hydration reads the saved snapshot.
    resetStores();
    localStorage.setItem(QUEUE_KEY, raw);
    await useQueueStore.persist.rehydrate();
    expect(useQueueStore.getState().queue).toHaveLength(200);
    expect(useQueueStore.getState().currentIndex).toBe(199);
    expect(useQueueStore.getState().history).toHaveLength(30);
    expect(useQueueStore.getState().history[0].id).toBe("h34");
    const audioState = useAudioStore.getState() as unknown as Record<string, unknown>;
    expect(audioState.queue).toBeUndefined();
    expect(audioState.currentIndex).toBeUndefined();
  });

  it("player-store, audio-store and eq-store v2 roundtrip without duplicated ownership", async () => {
    usePlayerStore.getState().setCurrentSong(song("persisted"));
    usePlayerStore.getState().setVolume(0.42);
    usePlayerStore.getState().setLoopMode("all");
    useAudioStore.getState().seekTo(42.5);
    useAudioStore.getState().setDuration(210);
    useEQStore.getState().loadEQPreset("jazz");
    flushAllThrottledStorages();
    const playerRaw = readRaw(PLAYER_KEY);
    const audioRaw = readRaw(AUDIO_KEY);
    const eqRaw = readRaw(EQ_KEY);
    const player = JSON.parse(playerRaw) as { state: Record<string, unknown> };
    const audio = JSON.parse(audioRaw) as { state: Record<string, unknown> };
    const eq = JSON.parse(eqRaw) as { state: Record<string, unknown>; version: number };
    expect(player.state).toMatchObject({ volume: 0.42, loopMode: "all" });
    expect((player.state.currentSong as Song).id).toBe("persisted");
    // Progress is owned by audioStore only; player-store must not persist a second copy.
    expect(player.state).not.toHaveProperty("currentTime");
    expect(player.state).not.toHaveProperty("duration");
    expect(audio.state).toMatchObject({ currentTime: 42.5, duration: 210 });
    for (const key of DUPLICATED_KEYS) expect(audio.state).not.toHaveProperty(key);
    expect(eq.version).toBe(2);
    expect(eq.state.eqBands).toEqual(DEFAULT_EQ_PRESETS.jazz);
    // Reload from the captured envelopes (bootstrap order: player, audio; audio writes paused).
    resetStores();
    localStorage.setItem(PLAYER_KEY, playerRaw);
    localStorage.setItem(AUDIO_KEY, audioRaw);
    localStorage.setItem(EQ_KEY, eqRaw);
    setAudioPersistenceSuspended(true);
    try {
      await usePlayerStore.persist.rehydrate();
      await useAudioStore.persist.rehydrate();
      await useEQStore.persist.rehydrate();
    } finally {
      setAudioPersistenceSuspended(false);
    }
    expect(usePlayerStore.getState().currentSong?.id).toBe("persisted");
    expect(usePlayerStore.getState().volume).toBe(0.42);
    expect(useAudioStore.getState().currentTime).toBe(42.5);
    expect(useAudioStore.getState().duration).toBe(210);
    expect(usePlayerStore.getState().currentTime).toBe(42.5); // projected from audioStore
    expect(useEQStore.getState().currentEQPreset).toBe("jazz");
  });
});
