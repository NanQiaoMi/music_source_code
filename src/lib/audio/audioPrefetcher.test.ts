import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Song } from "@/types/song";

const h = vi.hoisted(() => ({ resolve: vi.fn(), setQueue: vi.fn(), queue: [] as unknown[] }));
vi.mock("@/services/MultiSourceResolver", () => ({
  MultiSourceResolver: { getInstance: () => ({ resolvePlayableAudio: h.resolve }) },
}));
vi.mock("@/store/queueStore", () => ({
  useQueueStore: { getState: () => ({ queue: h.queue, setQueue: h.setQueue }) },
}));

import { audioPrefetcher } from "./audioPrefetcher";

class FakeAudio {
  preload = "";
  volume = 1;
  muted = false;
  src = "";
  load(): void {}
  removeAttribute(): void {}
}

const song: Song = {
  id: "prefetch-cache-song",
  title: "缓存复用",
  artist: "测试",
  duration: 180,
  source: "kuwo",
  audioUrl: "",
};

beforeEach(() => {
  h.resolve.mockReset();
  h.setQueue.mockReset();
  vi.stubGlobal("Audio", FakeAudio);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("audioPrefetcher 缓存", () => {
  it("TTL 内重复预取同一首歌只解析一次", async () => {
    h.resolve.mockResolvedValue({
      url: "https://cdn.example/prefetch.mp3",
      source: "kuwo",
      quality: "high",
    });
    const first = await audioPrefetcher.prefetchSong(song);
    const second = await audioPrefetcher.prefetchSong(song);
    expect(first).toBe("https://cdn.example/prefetch.mp3");
    expect(second).toBe(first);
    expect(h.resolve).toHaveBeenCalledTimes(1);
  });

  it("统计接口返回预取缓存容量与命中情况", async () => {
    h.resolve.mockResolvedValue({
      url: "https://cdn.example/prefetch-stats.mp3",
      source: "kuwo",
      quality: "high",
    });
    await audioPrefetcher.prefetchSong({ ...song, id: "prefetch-stats-song" });

    const stats = audioPrefetcher.getPrefetchCacheStats();
    expect(stats.size).toBeGreaterThan(0);
    expect(stats.hits + stats.misses).toBeGreaterThan(0);
  });
});

describe("AudioPrefetcher abort support (S1-8b)", () => {
  it("passes the signal to resolver and returns null on abort", async () => {
    const controller = new AbortController();
    h.resolve.mockImplementation(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });

    const result = await audioPrefetcher.prefetchSong(
      { id: "p1", title: "Prefetch", artist: "A", duration: 200, source: "netease" },
      { signal: controller.signal }
    );

    expect(result).toBeNull();
    expect(h.resolve).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("returns null without resolving when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await audioPrefetcher.prefetchSong(
      { id: "p2", title: "Prefetch 2", artist: "A", duration: 200, source: "qq" },
      { signal: controller.signal }
    );

    expect(result).toBeNull();
    expect(h.resolve).not.toHaveBeenCalled();
  });
});
