import { beforeEach, describe, expect, it, vi } from "vitest";
import { hydrateStores } from "@/lib/bootstrapStores";
import { useAudioStore } from "./audioStore";
import { usePlayerStore } from "./playerStore";
import { flushAllThrottledStorages } from "@/lib/storage/throttledPersist";

function readEnvelope(key: string): Record<string, unknown> | null {
  const raw = localStorage.getItem(key);
  return raw ? ((JSON.parse(raw) as { state?: Record<string, unknown> })?.state ?? null) : null;
}

type SetItemSpy = { mock: { calls: Array<[string, string]> } };

function progressBearingWrites(spy: SetItemSpy): Array<{ key: string; currentTime: unknown }> {
  const keys = ["player-store", "audio-store-v4"];
  return spy.mock.calls.flatMap(([key, value]) => {
    if (!keys.includes(key as string)) return [];
    const state = (JSON.parse(value as string) as { state?: Record<string, unknown> }).state ?? {};
    if (!("currentTime" in state) && !("duration" in state)) return [];
    return [{ key: key as string, currentTime: state.currentTime }];
  });
}

describe("playback progress persistence authority", () => {
  beforeEach(() => {
    localStorage.clear();
    usePlayerStore.setState({ currentTime: 0, duration: 0 });
    useAudioStore.setState({ currentTime: 0, persistedCurrentTime: 0, duration: 0 });
  });

  it("writes progress only through the audioStore envelope", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    try {
      usePlayerStore.getState().setCurrentTime(12.5);
      usePlayerStore.getState().setDuration(210);
      useAudioStore.getState().setCurrentTime(12.5);
      // S2-2：写盘被存储层节流，断言前同步落盘
      flushAllThrottledStorages();

      const writes = progressBearingWrites(setItemSpy);
      expect(writes.length).toBeGreaterThan(0);
      expect(new Set(writes.map((write) => write.key))).toEqual(new Set(["audio-store-v4"]));
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it("keeps progress out of the playerStore envelope while runtime reads still work", () => {
    usePlayerStore.getState().setCurrentTime(33);
    usePlayerStore.getState().setDuration(190);
    flushAllThrottledStorages();

    const playerState = readEnvelope("player-store");
    expect(playerState).not.toBeNull();
    expect(playerState).not.toHaveProperty("currentTime");
    expect(playerState).not.toHaveProperty("duration");

    expect(usePlayerStore.getState().currentTime).toBe(33);
    expect(usePlayerStore.getState().duration).toBe(190);
  });

  it("reads consistent progress after hydration with audioStore as the authority", async () => {
    localStorage.setItem(
      "player-store",
      JSON.stringify({
        state: { currentSong: null, currentTime: 999, duration: 999, volume: 0.4 },
        version: 0,
      })
    );
    localStorage.setItem(
      "audio-store-v4",
      JSON.stringify({ state: { currentTime: 42.5, duration: 210 }, version: 0 })
    );

    // 保持真实顺序：player 先水合，此时 audioStore 的写盘被暂停，快照不被覆盖
    await hydrateStores({ owners: ["player-store"] });
    // 旧 playerStore envelope 里的进度不再参与恢复
    expect(usePlayerStore.getState().currentTime).toBe(0);
    await hydrateStores({ owners: ["audio-store-v4"] });

    expect(useAudioStore.getState().currentTime).toBe(42.5);
    expect(usePlayerStore.getState().currentTime).toBe(42.5);
    expect(useAudioStore.getState().duration).toBe(210);
    expect(usePlayerStore.getState().duration).toBe(210);
    expect(usePlayerStore.getState().volume).toBe(0.4);
  });

  it("throttles persisted progress to at most one advance per second under rapid updates", () => {
    const store = useAudioStore.getState();
    store.seekTo(0);
    // 先排空上一窗口的挂起写（含真实定时器），再切假时钟，避免 trailing 定时器落在真实时钟上
    flushAllThrottledStorages();
    vi.useFakeTimers();
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    try {
      for (let i = 1; i <= 4; i += 1) {
        store.setCurrentTime(i * 0.25);
        vi.advanceTimersByTime(250);
      }

      const advancesInFirstSecond = progressBearingWrites(setItemSpy).filter(
        (write) => write.key === "audio-store-v4" && (write.currentTime as number) > 0
      );
      expect(advancesInFirstSecond.length).toBeLessThanOrEqual(1);
      expect(useAudioStore.getState().currentTime).toBe(1);

      vi.advanceTimersByTime(5000);
      expect(readEnvelope("audio-store-v4")?.currentTime).toBe(1);
    } finally {
      setItemSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
