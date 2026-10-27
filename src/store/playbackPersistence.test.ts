import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore } from "./playerStore";
import { useAudioStore } from "./audioStore";
import { playbackMediaBridge } from "@/lib/playback/mediaBridge";
import { flushAllThrottledStorages, installFlushOnPageHide } from "@/lib/storage/throttledPersist";

const PLAYER_KEY = "player-store";
const AUDIO_KEY = "audio-store-v4";

type SetItemSpy = ReturnType<typeof vi.spyOn<Storage, "setItem">>;

function writesFor(spy: SetItemSpy, key: string): number {
  return spy.mock.calls.filter(([name]) => name === key).length;
}

function persistedCurrentTime(key: string): number | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return typeof parsed?.state?.currentTime === "number" ? parsed.state.currentTime : null;
}

function rapidProgressUpdates(count: number): void {
  for (let index = 1; index <= count; index += 1) {
    usePlayerStore.getState().setCurrentTime(index);
    useAudioStore.getState().setCurrentTime(index);
  }
}

let removeLifecycleListeners: (() => void) | null = null;

describe("playback progress persistence (S2-2)", () => {
  beforeEach(() => {
    flushAllThrottledStorages();
    localStorage.clear();
    vi.useFakeTimers();
    usePlayerStore.setState({ currentTime: 0, duration: 0 });
    useAudioStore.setState({ currentTime: 0, persistedCurrentTime: 0, duration: 0 });
    // 把 "当前值 0" 落到磁盘并把写入窗口重新对齐，后续断言不依赖前一个用例的状态
    flushAllThrottledStorages();
    localStorage.clear();
  });

  afterEach(() => {
    flushAllThrottledStorages();
    removeLifecycleListeners?.();
    removeLifecycleListeners = null;
    playbackMediaBridge.disposeForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("writes at most once per second for 10 rapid setCurrentTime calls per store", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");

    rapidProgressUpdates(10);

    // 10 次高频更新在 1 秒内合计最多 1 次写盘（leading），其它合并到 trailing
    expect(writesFor(spy, PLAYER_KEY)).toBeLessThanOrEqual(1);
    expect(writesFor(spy, AUDIO_KEY)).toBeLessThanOrEqual(1);

    vi.advanceTimersByTime(999);
    expect(writesFor(spy, PLAYER_KEY)).toBeLessThanOrEqual(1);
    expect(writesFor(spy, AUDIO_KEY)).toBeLessThanOrEqual(1);

    vi.advanceTimersByTime(1500);
    expect(writesFor(spy, PLAYER_KEY)).toBeLessThanOrEqual(2);
    expect(writesFor(spy, AUDIO_KEY)).toBeLessThanOrEqual(2);
  });

  it("trailing write persists the final currentTime for both keys", () => {
    rapidProgressUpdates(10);
    expect(persistedCurrentTime(PLAYER_KEY)).not.toBe(10);

    vi.advanceTimersByTime(2000);

    expect(persistedCurrentTime(PLAYER_KEY)).toBe(10);
    expect(persistedCurrentTime(AUDIO_KEY)).toBe(10);
  });

  it("flush writes the final value immediately (no timer needed)", () => {
    rapidProgressUpdates(7);

    flushAllThrottledStorages();

    expect(persistedCurrentTime(PLAYER_KEY)).toBe(7);
    expect(persistedCurrentTime(AUDIO_KEY)).toBe(7);
  });

  it("pause flushes the pending progress immediately", () => {
    const audio = document.createElement("audio");
    playbackMediaBridge.attach(audio, {});

    rapidProgressUpdates(42);
    expect(persistedCurrentTime(PLAYER_KEY)).not.toBe(42);

    audio.dispatchEvent(new Event("pause"));

    expect(persistedCurrentTime(PLAYER_KEY)).toBe(42);
    expect(persistedCurrentTime(AUDIO_KEY)).toBe(42);
  });

  it("ended flushes the pending progress immediately", () => {
    const audio = document.createElement("audio");
    playbackMediaBridge.attach(audio, {});

    rapidProgressUpdates(93);
    expect(persistedCurrentTime(PLAYER_KEY)).not.toBe(93);

    audio.dispatchEvent(new Event("ended"));

    expect(persistedCurrentTime(PLAYER_KEY)).toBe(93);
    expect(persistedCurrentTime(AUDIO_KEY)).toBe(93);
  });

  it("pagehide flushes the pending progress", () => {
    removeLifecycleListeners = installFlushOnPageHide();

    rapidProgressUpdates(11);
    expect(persistedCurrentTime(PLAYER_KEY)).not.toBe(11);

    window.dispatchEvent(new Event("pagehide"));

    expect(persistedCurrentTime(PLAYER_KEY)).toBe(11);
    expect(persistedCurrentTime(AUDIO_KEY)).toBe(11);
  });

  it("keeps the persisted key names and JSON envelope unchanged", () => {
    rapidProgressUpdates(5);
    flushAllThrottledStorages();

    for (const key of [PLAYER_KEY, AUDIO_KEY]) {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      expect(parsed).not.toBeNull();
      expect(Object.keys(parsed).sort()).toEqual(["state", "version"]);
      expect(parsed.state.currentTime).toBe(5);
      expect(parsed.state).toHaveProperty("duration");
      expect(parsed.state).toHaveProperty("currentSong");
    }
  });

  it("still hydrates old envelopes that carry currentTime", async () => {
    localStorage.setItem(
      PLAYER_KEY,
      JSON.stringify({
        state: {
          currentSong: null,
          currentTime: 77,
          duration: 210,
          volume: 0.7,
          isMuted: false,
          playbackRate: 1,
          loopMode: "none",
        },
        version: 0,
      })
    );

    await usePlayerStore.persist.rehydrate();

    expect(usePlayerStore.getState().currentTime).toBe(77);
    expect(usePlayerStore.getState().duration).toBe(210);
  });
});
