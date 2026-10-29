import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeNext, computePrev } from "./queueNavigator";
import { advanceQueue } from "@/store/queueNavigation";
import { usePlayerStore } from "@/store/playerStore";
import { useQueueStore } from "@/store/queueStore";
import type { Song } from "@/types/song";

function song(id: string, title = `Song ${id}`): Song {
  return { id, title, artist: "Artist", duration: 180, source: "local" };
}

function seedQueue(
  queue: Song[],
  currentIndex = 0,
  playThroughMode: "normal" | "play-through" = "normal"
): void {
  useQueueStore.setState({ queue, currentIndex, history: [], playThroughMode });
}

describe("queueNavigator", () => {
  beforeEach(() => {
    localStorage.clear();
    usePlayerStore.setState({ loopMode: "none" });
    seedQueue([]);
  });

  describe("computeNext / computePrev", () => {
    it("advances within queue", () => {
      const queue = [song("a"), song("b"), song("c")];

      const result = computeNext(queue, 0, "none", "normal");

      expect(result.song?.id).toBe("b");
      expect(result.index).toBe(1);
      expect(result.reason).toBe("advanced");
    });

    it("wraps at end in list-loop", () => {
      const queue = [song("a"), song("b"), song("c")];

      const result = computeNext(queue, 2, "all", "normal");

      expect(result.song?.id).toBe("a");
      expect(result.index).toBe(0);
      expect(result.reason).toBe("wrapped");
    });

    it("stops at end in normal mode", () => {
      const queue = [song("a"), song("b"), song("c")];

      const result = computeNext(queue, 2, "none", "normal");

      expect(result.song).toBeNull();
      expect(result.index).toBe(2);
      expect(result.reason).toBe("stopped-at-end");
    });

    it("stops at end in play-through mode even with list-loop", () => {
      const queue = [song("a"), song("b")];

      const result = computeNext(queue, 1, "all", "play-through");

      expect(result.song).toBeNull();
      expect(result.reason).toBe("stopped-at-end");
    });

    it("returns null for empty queue", () => {
      expect(computeNext([], 0, "all", "normal")).toEqual({
        index: 0,
        song: null,
        reason: "empty",
      });
      expect(computePrev([], 3, "all", "normal")).toEqual({
        index: 0,
        song: null,
        reason: "empty",
      });
    });

    it("single loop stays on same song", () => {
      const queue = [song("a"), song("b")];

      expect(computeNext(queue, 0, "single", "normal")).toMatchObject({
        index: 0,
        song: { id: "a" },
        reason: "single-loop",
      });
      expect(computePrev(queue, 1, "single", "normal")).toMatchObject({
        index: 1,
        song: { id: "b" },
        reason: "single-loop",
      });
    });

    it("prev from index 0 stops in normal mode", () => {
      const queue = [song("a"), song("b")];

      const result = computePrev(queue, 0, "none", "normal");

      expect(result.song).toBeNull();
      expect(result.reason).toBe("stopped-at-end");
    });

    it("prev from index 0 wraps in list-loop", () => {
      const queue = [song("a"), song("b")];

      const result = computePrev(queue, 0, "all", "normal");

      expect(result.song?.id).toBe("b");
      expect(result.index).toBe(1);
      expect(result.reason).toBe("wrapped");
    });

    it("duplicate songs are navigated by position", () => {
      const first = song("same", "first occurrence");
      const second = song("same", "second occurrence");
      const queue = [first, song("middle"), second];

      expect(computeNext(queue, 1, "none", "normal")).toMatchObject({
        index: 2,
        song: { title: "second occurrence" },
      });
      expect(computePrev(queue, 2, "none", "normal")).toMatchObject({
        index: 1,
        song: { title: "Song middle" },
      });
    });

    it("shuffle selects a random position", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.75);
      const queue = [song("a"), song("b"), song("c")];

      const result = computeNext(queue, 0, "shuffle", "normal");

      expect(result.index).toBe(2);
      expect(result.song?.id).toBe("c");
      vi.restoreAllMocks();
    });
  });

  describe("advanceQueue", () => {
    it("writes currentIndex to queueStore and returns the latest snapshot item", () => {
      seedQueue([song("a"), song("b"), song("c")], 0);

      const result = advanceQueue("next");

      expect(result.song?.id).toBe("b");
      expect(useQueueStore.getState().currentIndex).toBe(1);
    });

    it("returns the queue item now at currentIndex after the playing song is removed", () => {
      const currentSong = song("b");
      seedQueue([song("a"), currentSong, song("c")], 1);

      useQueueStore.getState().removeFromQueue(1);
      expect(useQueueStore.getState().currentIndex).toBe(1);

      const result = advanceQueue("next", { currentSong });

      expect(result.song?.id).toBe("c");
      expect(result.index).toBe(1);
      expect(useQueueStore.getState().currentIndex).toBe(1);
    });

    it("re-anchors to the playing song position when the stored index is stale", () => {
      const queue = [song("a"), song("b"), song("c"), song("d")];
      seedQueue(queue, 0);
      usePlayerStore.setState({ loopMode: "all" });

      const result = advanceQueue("next", { currentSong: queue[2] });

      expect(result.song?.id).toBe("d");
      expect(useQueueStore.getState().currentIndex).toBe(3);
    });

    it("manual skip in single-loop mode still advances (ended owns single-loop replay)", () => {
      seedQueue([song("a"), song("b")], 0);
      usePlayerStore.setState({ loopMode: "single" });

      const result = advanceQueue("next");

      expect(result.song?.id).toBe("b");
      expect(useQueueStore.getState().currentIndex).toBe(1);
    });

    it("empty queue never writes an index", () => {
      seedQueue([], 0);

      const result = advanceQueue("next");

      expect(result).toEqual({ index: 0, song: null, reason: "empty" });
      expect(useQueueStore.getState().currentIndex).toBe(0);
    });
  });
});
