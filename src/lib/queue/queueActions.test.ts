import { describe, expect, it, vi } from "vitest";
import { Song } from "@/types/song";
import {
  bulkRemove,
  clearAfterCurrent,
  countDuplicateSongs,
  dedupe,
  playNext,
  shuffleAfter,
} from "./queueActions";

function song(id: string): Song {
  return {
    id,
    title: `Song ${id}`,
    artist: "Artist",
    duration: 180,
    source: "local",
  };
}

const queue = [song("a"), song("b"), song("c"), song("d")];

describe("queueActions", () => {
  it("inserts a song directly after the current song", () => {
    const result = playNext({ queue, currentIndex: 1 }, song("next"));

    expect(result.queue.map((item) => item.id)).toEqual(["a", "b", "next", "c", "d"]);
    expect(result.currentIndex).toBe(1);
  });

  it("starts a queue when playNext receives an empty queue", () => {
    const result = playNext({ queue: [], currentIndex: 4 }, song("first"));

    expect(result.queue.map((item) => item.id)).toEqual(["first"]);
    expect(result.currentIndex).toBe(0);
  });

  it("clears songs after the current song and clamps a stale currentIndex", () => {
    const result = clearAfterCurrent({ queue, currentIndex: 99 });

    expect(result.queue.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(result.currentIndex).toBe(3);
  });

  it("removes several songs by id while keeping the same current song active", () => {
    const result = bulkRemove({ queue, currentIndex: 2 }, ["a", "d"]);

    expect(result.queue.map((item) => item.id)).toEqual(["b", "c"]);
    expect(result.currentIndex).toBe(1);
  });

  it("clamps currentIndex when the current song is removed", () => {
    const result = bulkRemove({ queue, currentIndex: 2 }, ["c", "d"]);

    expect(result.queue.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.currentIndex).toBe(1);
  });

  it("deduplicates by song id and keeps the current song active", () => {
    const duplicated = [song("a"), song("b"), song("a"), song("c")];
    const result = dedupe({ queue: duplicated, currentIndex: 3 });

    expect(result.queue.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(result.currentIndex).toBe(2);
  });

  it("counts duplicate queue entries by song id", () => {
    const duplicated = [song("a"), song("b"), song("a"), song("c"), song("b"), song("a")];

    expect(countDuplicateSongs(duplicated)).toBe(3);
  });

  it("shuffles only the songs after the current song", () => {
    const random = vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0);

    const result = shuffleAfter({ queue, currentIndex: 1 });

    expect(result.queue.slice(0, 2).map((item) => item.id)).toEqual(["a", "b"]);
    expect(
      result.queue
        .slice(2)
        .map((item) => item.id)
        .sort()
    ).toEqual(["c", "d"]);
    expect(result.currentIndex).toBe(1);

    random.mockRestore();
  });
});
