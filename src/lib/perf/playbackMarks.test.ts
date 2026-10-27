import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFirstSoundMs,
  getPlaybackMarks,
  markPlayback,
  PLAYBACK_MARK_EVENT,
  resetPlaybackMarks,
} from "./playbackMarks";

describe("playbackMarks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetPlaybackMarks();
    performance.clearMarks();
  });

  it("records namespaced marks with detail and dispatches an event", () => {
    const listener = vi.fn();
    window.addEventListener(PLAYBACK_MARK_EVENT, listener);

    markPlayback("intent", { songId: "s1", source: "netease" });
    markPlayback("source-ready", { songId: "s1" });

    const marks = getPlaybackMarks();
    expect(marks.map((mark) => mark.kind)).toEqual(["intent", "source-ready"]);
    expect(marks[0]).toMatchObject({
      kind: "intent",
      name: "mimi:playback:intent",
      songId: "s1",
      source: "netease",
    });
    expect(performance.getEntriesByName("mimi:playback:intent")).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(2);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toMatchObject({
      kind: "intent",
      name: "mimi:playback:intent",
    });

    window.removeEventListener(PLAYBACK_MARK_EVENT, listener);
  });

  it("dedupes first-sound per intent and measures intent → first sound", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    markPlayback("intent");
    now = 1010;
    markPlayback("source-ready");
    now = 1200;
    markPlayback("playing");
    markPlayback("first-sound");
    now = 1300;
    markPlayback("first-sound");

    expect(getPlaybackMarks().filter((mark) => mark.kind === "first-sound")).toHaveLength(1);
    expect(getFirstSoundMs()).toBe(200);

    // 新的 intent 重置首声去重与测量窗口。
    now = 2000;
    markPlayback("intent");
    expect(getFirstSoundMs()).toBeNull();
    now = 2050;
    markPlayback("first-sound");
    expect(getFirstSoundMs()).toBe(50);
  });

  it("returns null until a request produces sound", () => {
    expect(getFirstSoundMs()).toBeNull();
    markPlayback("intent");
    expect(getFirstSoundMs()).toBeNull();
    expect(getPlaybackMarks()).toHaveLength(1);
  });

  it("resets the in-memory timeline", () => {
    markPlayback("intent");
    markPlayback("playing");
    resetPlaybackMarks();
    expect(getPlaybackMarks()).toHaveLength(0);
    expect(getFirstSoundMs()).toBeNull();
  });

  it("never throws outside the browser", () => {
    vi.stubGlobal("window", undefined);
    expect(() => markPlayback("intent", { songId: "s1" })).not.toThrow();
    expect(getPlaybackMarks()).toHaveLength(0);
    expect(getFirstSoundMs()).toBeNull();
    vi.unstubAllGlobals();
  });
});
