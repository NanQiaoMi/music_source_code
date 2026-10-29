// S6-5: queueStore is the only queue/currentIndex owner. These tests fail if the audioStore
// mirror (or its compatibility setters/persistence) ever comes back, or if queue payloads drift.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "./audioStore";
import { useQueueStore } from "./queueStore";
import type { Song } from "@/types/song";

function song(id: string): Song {
  return {
    id,
    title: `Song ${id}`,
    artist: "Owner Test",
    duration: 180,
    source: "local",
    audioUrl: `stored://${id}`,
  };
}

function persistedState(key: string): Record<string, unknown> | null {
  const raw = localStorage.getItem(key);
  return raw ? ((JSON.parse(raw) as { state?: Record<string, unknown> }).state ?? null) : null;
}

const MIRROR_KEYS = ["queue", "currentIndex", "setQueue", "setCurrentIndex"] as const;

describe("queue ownership (S6-5)", () => {
  beforeEach(() => {
    localStorage.clear();
    useQueueStore.setState({ queue: [], currentIndex: 0, history: [], playThroughMode: "normal" });
    useAudioStore.setState({
      currentSong: null,
      currentTime: 0,
      isPlaying: false,
      isLoading: false,
      error: null,
    });
  });

  it("audioStore exposes no queue/currentIndex state or compatibility setters", () => {
    const state = useAudioStore.getState() as unknown as Record<string, unknown>;
    for (const key of MIRROR_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(state, key)).toBe(false);
    }
  });

  it("audioStore no longer imports queueStore (runtime graph edge removed)", () => {
    const source = readFileSync(resolve(process.cwd(), "src/store/audioStore.ts"), "utf8");
    expect(source).not.toMatch(/from "\.\/queueStore"/);
    expect(source).not.toMatch(/useQueueStore/);
  });

  it("queue edits land in queueStore and audioStore writes never reach the queue", () => {
    const queueStore = useQueueStore.getState();
    queueStore.setQueue([song("a"), song("b")]);
    queueStore.setCurrentIndex(1);
    queueStore.addToQueue(song("c"));
    queueStore.removeFromQueue(0);
    queueStore.reorderQueue(1, 0);

    const snapshot = useQueueStore.getState();
    expect(snapshot.queue.map((item) => item.id)).toEqual(["c", "b"]);

    useAudioStore.setState({ currentTime: 9 });
    expect(useQueueStore.getState().queue).toBe(snapshot.queue);
    expect(useQueueStore.getState().currentIndex).toBe(snapshot.currentIndex);
    const audioState = useAudioStore.getState() as unknown as Record<string, unknown>;
    expect(audioState.queue).toBeUndefined();
    expect(audioState.currentIndex).toBeUndefined();
  });

  it("keeps the queue-store-v5 persistence payload shape unchanged", () => {
    useQueueStore.getState().setQueue([song("a"), song("b")]);
    useQueueStore.getState().setCurrentIndex(1);

    const state = persistedState("queue-store-v5");
    expect(state).not.toBeNull();
    expect(Object.keys(state ?? {}).sort()).toEqual([
      "currentIndex",
      "history",
      "playThroughMode",
      "queue",
    ]);
    expect(state?.currentIndex).toBe(1);
    expect((state?.queue as Song[]).map((item) => item.id)).toEqual(["a", "b"]);
    expect(state?.playThroughMode).toBe("normal");
  });

  it("audio-store-v4 persists playback/settings but no queue mirror or EQ duplicates", () => {
    useAudioStore.getState().setCurrentTime(12.5);

    const state = persistedState("audio-store-v4");
    expect(state).not.toBeNull();
    expect(state?.currentTime).toBe(12.5);
    for (const key of [
      "queue",
      "currentIndex",
      "eqBands",
      "currentEQPreset",
      "isEQEnabled",
      "customEQPresets",
    ]) {
      expect(state).not.toHaveProperty(key);
    }
  });
});
