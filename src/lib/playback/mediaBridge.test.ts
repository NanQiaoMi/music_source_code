import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playbackMediaBridge } from "./mediaBridge";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";

describe("playbackMediaBridge (S1-6a core)", () => {
  beforeEach(() => {
    playbackMediaBridge.disposeForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    playbackMediaBridge.disposeForTests();
    vi.restoreAllMocks();
  });

  it("attach is idempotent per element (12 native listeners once)", () => {
    const audio = document.createElement("audio");
    const addSpy = vi.spyOn(audio, "addEventListener");

    playbackMediaBridge.attach(audio, {});
    playbackMediaBridge.attach(audio, {});

    expect(addSpy).toHaveBeenCalledTimes(12);
    expect(playbackMediaBridge.attachCount()).toBe(2);
  });

  it("release one of two keeps listeners attached and dispatches to the remaining bundle", () => {
    const audio = document.createElement("audio");
    const releaseFirst = playbackMediaBridge.attach(audio, {});
    const onEnded = vi.fn();
    playbackMediaBridge.attach(audio, { onEnded });
    const removeSpy = vi.spyOn(audio, "removeEventListener");

    releaseFirst();

    expect(removeSpy).not.toHaveBeenCalled();
    expect(playbackMediaBridge.attachCount()).toBe(1);

    audio.dispatchEvent(new Event("ended"));
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("release last removes all 12 listeners", () => {
    const audio = document.createElement("audio");
    const releaseA = playbackMediaBridge.attach(audio, {});
    const releaseB = playbackMediaBridge.attach(audio, {});
    const removeSpy = vi.spyOn(audio, "removeEventListener");

    releaseA();
    releaseB();

    expect(removeSpy).toHaveBeenCalledTimes(12);
    expect(playbackMediaBridge.attachCount()).toBe(0);
  });

  it("timeupdate writes stores once per throttle window", () => {
    const audio = document.createElement("audio");
    const onTimeUpdate = vi.fn();
    playbackMediaBridge.attach(audio, { onTimeUpdate });
    const audioSetState = vi.spyOn(useAudioStore, "setState");
    const playerSetState = vi.spyOn(usePlayerStore, "setState");

    for (let index = 0; index < 10; index += 1) {
      audio.dispatchEvent(new Event("timeupdate"));
    }

    expect(audioSetState).toHaveBeenCalledTimes(1);
    expect(playerSetState).toHaveBeenCalledTimes(1);
    expect(onTimeUpdate).toHaveBeenCalledTimes(10);
  });

  it("does not write progress when the element is not active", () => {
    const audio = document.createElement("audio");
    playbackMediaBridge.attach(audio, { isActive: () => false });
    const audioSetState = vi.spyOn(useAudioStore, "setState");
    const playerSetState = vi.spyOn(usePlayerStore, "setState");

    audio.dispatchEvent(new Event("timeupdate"));

    expect(audioSetState).not.toHaveBeenCalled();
    expect(playerSetState).not.toHaveBeenCalled();
  });

  it("notifies subscribers when the snapshot changes", () => {
    const audio = document.createElement("audio");
    playbackMediaBridge.attach(audio, {});
    const subscriber = vi.fn();
    const unsubscribe = playbackMediaBridge.subscribe(subscriber);

    audio.dispatchEvent(new Event("playing"));

    expect(subscriber).toHaveBeenCalled();
    unsubscribe();
  });

  it("ended/error handlers receive the current snapshot", () => {
    const audio = document.createElement("audio");
    const onEnded = vi.fn();
    playbackMediaBridge.attach(audio, { onEnded });

    audio.dispatchEvent(new Event("ended"));

    expect(onEnded).toHaveBeenCalledTimes(1);
    const snapshot = onEnded.mock.calls[0][0];
    expect(snapshot).toHaveProperty("currentTime");
    expect(snapshot).toHaveProperty("requestId");
    expect(snapshot).toHaveProperty("deckId");
    expect(snapshot).toHaveProperty("source");
  });
});
