import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compactExistingStorage } from "./safeStorage";

function createSong(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: String(index),
    title: "Song " + index,
    artist: "Artist",
    album: "Album",
    cover: "/cover.jpg",
    duration: 200,
    source: "local",
    audioUrl: "https://example.com/" + index + ".mp3",
    ...overrides,
  };
}

function queueEnvelope(queue: unknown[], currentIndex: number, history: unknown[] = []) {
  return JSON.stringify({
    state: { queue, currentIndex, history, playThroughMode: "normal" },
    version: 0,
  });
}

describe("safeStorage.compactExistingStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("preserves a 200-item queue with currentIndex 199 and 30 history entries", () => {
    const queue = Array.from({ length: 200 }, (_, i) => createSong(i));
    const history = Array.from({ length: 30 }, (_, i) => ({ ...createSong(i), playedAt: i }));
    localStorage.setItem("queue-store-v5", queueEnvelope(queue, 199, history));

    compactExistingStorage();

    const parsed = JSON.parse(localStorage.getItem("queue-store-v5") || "{}");
    expect(parsed.state.queue).toHaveLength(200);
    expect(parsed.state.currentIndex).toBe(199);
    expect(parsed.state.history).toHaveLength(30);
  });

  it("preserves a 51-item queue and index 50", () => {
    const queue = Array.from({ length: 51 }, (_, i) => createSong(i));
    localStorage.setItem("queue-store-v5", queueEnvelope(queue, 50));

    compactExistingStorage();

    const parsed = JSON.parse(localStorage.getItem("queue-store-v5") || "{}");
    expect(parsed.state.queue).toHaveLength(51);
    expect(parsed.state.currentIndex).toBe(50);
  });

  it("strips heavy cover fields without dropping songs", () => {
    const bigCover = "data:image/png;base64," + "A".repeat(20000);
    const queue = [createSong(1, { cover: bigCover }), createSong(2)];
    localStorage.setItem("queue-store-v5", queueEnvelope(queue, 1));

    compactExistingStorage();

    const parsed = JSON.parse(localStorage.getItem("queue-store-v5") || "{}");
    expect(parsed.state.queue).toHaveLength(2);
    expect(parsed.state.queue[0].cover).toBe("/default-cover.svg");
  });

  it("skips the write when the payload does not shrink meaningfully", () => {
    const queue = [createSong(1), createSong(2)];
    localStorage.setItem("queue-store-v5", queueEnvelope(queue, 1));
    const spy = vi.spyOn(Storage.prototype, "setItem");

    compactExistingStorage();

    expect(spy).not.toHaveBeenCalled();
  });

  it("removes obsolete legacy keys", () => {
    localStorage.setItem("queue-store-v3", "legacy");
    localStorage.setItem("audio-store-v2", "legacy");

    compactExistingStorage();

    expect(localStorage.getItem("queue-store-v3")).toBeNull();
    expect(localStorage.getItem("audio-store-v2")).toBeNull();
  });
});
