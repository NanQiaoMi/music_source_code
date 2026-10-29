import { afterEach, describe, expect, it, vi } from "vitest";
import { multiSourceResolver } from "@/services/MultiSourceResolver";

describe("MultiSourceResolver abort support (S1-8b)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null without fetching when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await multiSourceResolver.resolvePlayableAudio(
      { id: "song-1", title: "Song", artist: "Artist", source: "netease" },
      { bypassCache: true, signal: controller.signal }
    );

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still accepts the legacy boolean bypassCache argument", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await multiSourceResolver.resolvePlayableAudio(
      { id: "song-2", title: "Song 2", artist: "Artist", source: "netease" },
      true
    );
    expect(result).toBeNull();
  });
});
