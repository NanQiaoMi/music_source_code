/** S1-10 matrix — playback authority (S1-6/S6-4) + panel remount/marks (S0-6b). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playbackMediaBridge } from "@/lib/playback/mediaBridge";
import { getPlaybackClockSnapshot, subscribePlaybackClock } from "@/lib/playback/playbackClock";
import {
  getFirstSoundMs,
  getPlaybackMarks,
  markPlayback,
  resetPlaybackMarks,
} from "@/lib/perf/playbackMarks";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";

function mediaElement(currentTime: number, duration: number): HTMLAudioElement {
  const audio = document.createElement("audio");
  Object.defineProperty(audio, "currentTime", {
    configurable: true,
    writable: true,
    value: currentTime,
  });
  Object.defineProperty(audio, "duration", { configurable: true, writable: true, value: duration });
  return audio;
}

let now = 1000;

beforeEach(() => {
  now = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  vi.spyOn(performance, "now").mockImplementation(() => now);
  playbackMediaBridge.disposeForTests();
  resetPlaybackMarks();
  performance.clearMarks();
  useAudioStore.setState({
    currentTime: 0,
    persistedCurrentTime: 0,
    duration: 0,
    isPlaying: false,
  });
  usePlayerStore.setState({ currentTime: 0, duration: 0, isPlaying: false });
});

afterEach(() => {
  playbackMediaBridge.disposeForTests();
  resetPlaybackMarks();
  vi.restoreAllMocks();
});

describe("S1-10 progress authority", () => {
  it("timeupdate writes audioStore once per throttle window and PlaybackClock projects it", () => {
    const audio = mediaElement(12.5, 210);
    const onTimeUpdate = vi.fn();
    playbackMediaBridge.attach(audio, { onTimeUpdate });
    const audioWrites = vi.spyOn(useAudioStore, "setState");
    const clockListener = vi.fn();
    const unsubscribe = subscribePlaybackClock(clockListener);
    audio.dispatchEvent(new Event("timeupdate"));
    expect(audioWrites).toHaveBeenCalledTimes(1);
    expect(onTimeUpdate).toHaveBeenCalledTimes(1);
    expect(useAudioStore.getState().currentTime).toBe(12.5);
    expect(usePlayerStore.getState().currentTime).toBe(12.5);
    expect(getPlaybackClockSnapshot().currentTime).toBe(12.5);
    expect(playbackMediaBridge.getSnapshot()).toMatchObject({ currentTime: 12.5, duration: 210 });
    expect(clockListener).toHaveBeenCalledTimes(1);
    now = 1100;
    audio.dispatchEvent(new Event("timeupdate"));
    expect(audioWrites).toHaveBeenCalledTimes(1);
    expect(onTimeUpdate).toHaveBeenCalledTimes(2); // native frequency still reaches the hook
    now = 1300;
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 13 });
    audio.dispatchEvent(new Event("timeupdate"));
    expect(audioWrites).toHaveBeenCalledTimes(2);
    expect(getPlaybackClockSnapshot().currentTime).toBe(13);
    unsubscribe();
  });

  it("two live instances share one listener set and dispatch only to the active bundle", () => {
    const audio = mediaElement(5, 100);
    const addSpy = vi.spyOn(audio, "addEventListener");
    const staleEnded = vi.fn();
    const activeEnded = vi.fn();
    const releaseStale = playbackMediaBridge.attach(audio, {
      isActive: () => false,
      onEnded: staleEnded,
    });
    const releaseActive = playbackMediaBridge.attach(audio, {
      isActive: () => true,
      onEnded: activeEnded,
    });
    expect(addSpy).toHaveBeenCalledTimes(12);
    expect(playbackMediaBridge.attachCount()).toBe(2);
    const audioWrites = vi.spyOn(useAudioStore, "setState");
    audio.dispatchEvent(new Event("timeupdate"));
    expect(audioWrites).toHaveBeenCalledTimes(1);
    audio.dispatchEvent(new Event("ended"));
    expect(activeEnded).toHaveBeenCalledTimes(1);
    expect(staleEnded).not.toHaveBeenCalled();
    const removeSpy = vi.spyOn(audio, "removeEventListener");
    releaseActive();
    expect(removeSpy).not.toHaveBeenCalled(); // the stale instance keeps the shared listeners
    audio.dispatchEvent(new Event("ended"));
    expect(staleEnded).toHaveBeenCalledTimes(1);
    releaseStale();
    expect(removeSpy).toHaveBeenCalledTimes(12);
    expect(playbackMediaBridge.attachCount()).toBe(0);
    audio.dispatchEvent(new Event("ended"));
    expect(staleEnded).toHaveBeenCalledTimes(1);
  });
});

describe("S1-10 panel remount and playback marks", () => {
  it("remounting panel instances never duplicates native media listeners", () => {
    const audio = document.createElement("audio");
    const addSpy = vi.spyOn(audio, "addEventListener");
    const removeSpy = vi.spyOn(audio, "removeEventListener");
    const onEnded = vi.fn();
    const releaseFirst = playbackMediaBridge.attach(audio, { onEnded });
    releaseFirst();
    const releaseSecond = playbackMediaBridge.attach(audio, { onEnded });
    expect(addSpy).toHaveBeenCalledTimes(24); // 12 per mount, exactly one live set
    expect(playbackMediaBridge.attachCount()).toBe(1);
    const otherEnded = vi.fn();
    const releaseOther = playbackMediaBridge.attach(audio, { onEnded: otherEnded });
    expect(addSpy).toHaveBeenCalledTimes(24);
    audio.dispatchEvent(new Event("ended"));
    expect(otherEnded).toHaveBeenCalledTimes(1);
    expect(onEnded).not.toHaveBeenCalled(); // top of stack owns dispatch
    const removalsBefore = removeSpy.mock.calls.length;
    releaseOther();
    expect(removeSpy).toHaveBeenCalledTimes(removalsBefore);
    audio.dispatchEvent(new Event("ended"));
    expect(onEnded).toHaveBeenCalledTimes(1);
    releaseSecond();
    expect(removeSpy).toHaveBeenCalledTimes(removalsBefore + 12);
    const releaseReopened = playbackMediaBridge.attach(audio, { onEnded });
    audio.dispatchEvent(new Event("ended"));
    expect(onEnded).toHaveBeenCalledTimes(2);
    releaseReopened();
    expect(playbackMediaBridge.attachCount()).toBe(0);
  });

  it("marks playing/first-sound once per intent through bridge dispatch, including after remount", () => {
    const audio = document.createElement("audio");
    const onPlaying = (): void => {
      markPlayback("playing", { songId: "s1" });
      markPlayback("first-sound", { songId: "s1" });
    };
    markPlayback("intent", { songId: "s1" });
    let release = playbackMediaBridge.attach(audio, { onPlaying });
    now = 1200;
    audio.dispatchEvent(new Event("playing"));
    now = 1300;
    audio.dispatchEvent(new Event("playing"));
    expect(getPlaybackMarks().map((entry) => entry.kind)).toEqual([
      "intent",
      "playing",
      "first-sound",
      "playing",
    ]);
    expect(getFirstSoundMs()).toBe(200);
    // Remount must not duplicate per-dispatch marks; first-sound stays deduped.
    release();
    release = playbackMediaBridge.attach(audio, { onPlaying });
    now = 1400;
    audio.dispatchEvent(new Event("playing"));
    expect(getPlaybackMarks().filter((entry) => entry.kind === "playing")).toHaveLength(3);
    expect(getPlaybackMarks().filter((entry) => entry.kind === "first-sound")).toHaveLength(1);
    now = 2000;
    markPlayback("intent", { songId: "s2" });
    now = 2025;
    audio.dispatchEvent(new Event("playing"));
    expect(getPlaybackMarks().filter((entry) => entry.kind === "first-sound")).toHaveLength(2);
    expect(getFirstSoundMs()).toBe(25);
    release();
  });
});
