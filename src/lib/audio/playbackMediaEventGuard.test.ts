import { describe, expect, it } from "vitest";
import { shouldAcceptPlaybackMediaEvent } from "./playbackMediaEventGuard";

const playingMedia = {
  paused: false,
  ended: false,
  readyState: 4,
  hasError: false,
  shouldPlay: true,
};

describe("shouldAcceptPlaybackMediaEvent", () => {
  it("rejects queued stale events when the reused same-source deck is in the opposite live state", () => {
    expect(
      shouldAcceptPlaybackMediaEvent("playing", {
        ...playingMedia,
        paused: true,
        readyState: 1,
      })
    ).toBe(false);
    expect(
      shouldAcceptPlaybackMediaEvent("pause", {
        ...playingMedia,
        paused: false,
      })
    ).toBe(false);
    expect(
      shouldAcceptPlaybackMediaEvent("ended", {
        ...playingMedia,
        ended: false,
      })
    ).toBe(false);
  });

  it("accepts events that match the current media element state", () => {
    expect(shouldAcceptPlaybackMediaEvent("playing", playingMedia)).toBe(true);
    expect(
      shouldAcceptPlaybackMediaEvent("waiting", {
        ...playingMedia,
        readyState: 2,
      })
    ).toBe(true);
    expect(
      shouldAcceptPlaybackMediaEvent("pause", {
        ...playingMedia,
        paused: true,
      })
    ).toBe(true);
    expect(
      shouldAcceptPlaybackMediaEvent("ended", {
        ...playingMedia,
        paused: true,
        ended: true,
      })
    ).toBe(true);
  });

  it("does not accept waiting when playback was canceled or the media has failed", () => {
    expect(
      shouldAcceptPlaybackMediaEvent("waiting", {
        ...playingMedia,
        shouldPlay: false,
      })
    ).toBe(false);
    expect(
      shouldAcceptPlaybackMediaEvent("playing", {
        ...playingMedia,
        hasError: true,
      })
    ).toBe(false);
  });
});
