import { afterEach, describe, expect, it, vi } from "vitest";
import { audioPrefetcher } from "./audioPrefetcher";

const mocks = vi.hoisted(() => ({
  resolvePlayableAudio: vi.fn(),
}));

vi.mock("@/services/MultiSourceResolver", () => ({
  MultiSourceResolver: {
    getInstance: () => ({ resolvePlayableAudio: mocks.resolvePlayableAudio }),
  },
}));

describe("AudioPrefetcher abort support (S1-8b)", () => {
  afterEach(() => {
    mocks.resolvePlayableAudio.mockReset();
    vi.restoreAllMocks();
  });

  it("passes the signal to resolver and returns null on abort", async () => {
    const controller = new AbortController();
    mocks.resolvePlayableAudio.mockImplementation(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });

    const result = await audioPrefetcher.prefetchSong(
      { id: "p1", title: "Prefetch", artist: "A", duration: 200, source: "netease" },
      { signal: controller.signal }
    );

    expect(result).toBeNull();
    expect(mocks.resolvePlayableAudio).toHaveBeenCalledWith(
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
    expect(mocks.resolvePlayableAudio).not.toHaveBeenCalled();
  });
});
