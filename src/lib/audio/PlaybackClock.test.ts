import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackClock, type PlaybackClockScheduler } from "@/lib/audio/PlaybackClock";
import {
  createInitialPlaybackState,
  type PlaybackMachineState,
} from "@/lib/audio/playbackStateMachine";

class FakeMediaElement extends EventTarget {
  currentTime = 0;
  duration = 120;
  playbackRate = 1;
  paused = true;
  readyState = 0;
  currentSrc = "https://example.test/a.mp3";
  src = "https://example.test/a.mp3";
}

class FakeScheduler implements PlaybackClockScheduler {
  private nextId = 1;
  private callbacks = new Map<number, () => void>();
  visible = true;

  requestFrame = (callback: () => void): number => {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  };

  cancelFrame = (id: number): void => {
    this.callbacks.delete(id);
  };

  isVisible = (): boolean => this.visible;

  tick(): void {
    const callbacks = Array.from(this.callbacks.values());
    this.callbacks.clear();
    callbacks.forEach((callback) => callback());
  }

  get pendingFrames(): number {
    return this.callbacks.size;
  }
}

function createActiveRuntime(phase: PlaybackMachineState["phase"]): PlaybackMachineState {
  return {
    ...createInitialPlaybackState(),
    phase,
    requestId: 4,
    targetSongId: "song-a",
    targetSource: "source-a",
    shouldPlay: phase === "playing" || phase === "buffering" || phase === "loading",
    activeDeckId: "deck-a",
    activeSource: "https://example.test/a.mp3",
  };
}

describe("PlaybackClock", () => {
  let scheduler: FakeScheduler;
  let clock: PlaybackClock;
  let media: FakeMediaElement;

  beforeEach(() => {
    scheduler = new FakeScheduler();
    clock = new PlaybackClock(scheduler);
    media = new FakeMediaElement();
    clock.syncRuntime(createActiveRuntime("loading"));
    clock.attach(
      media as unknown as HTMLAudioElement,
      4,
      "song-a",
      "deck-a",
      "https://example.test/a.mp3"
    );
  });

  afterEach(() => {
    clock.dispose();
  });

  it("samples the media element on one shared frame loop while confirmed playing", () => {
    const subscriber = vi.fn();
    const unsubscribe = clock.subscribe(subscriber);
    clock.syncRuntime(createActiveRuntime("playing"));
    expect(scheduler.pendingFrames).toBe(1);

    media.currentTime = 18.25;
    scheduler.tick();

    expect(clock.getSnapshot()).toMatchObject({
      currentTime: 18.25,
      duration: 120,
      playbackRate: 1,
      phase: "playing",
      requestId: 4,
    });
    expect(scheduler.pendingFrames).toBe(1);
    expect(subscriber).toHaveBeenCalled();

    unsubscribe();
    expect(scheduler.pendingFrames).toBe(0);
  });

  it("resynchronizes immediately on seek and rate changes without accumulating time", () => {
    const subscriber = vi.fn();
    clock.subscribe(subscriber);
    clock.syncRuntime(createActiveRuntime("playing"));
    const notificationsBeforeSeek = subscriber.mock.calls.length;

    media.currentTime = 44;
    media.playbackRate = 1.5;
    media.dispatchEvent(new Event("seeked"));

    expect(clock.getSnapshot()).toMatchObject({ currentTime: 44, playbackRate: 1.5 });
    expect(subscriber).toHaveBeenCalledTimes(notificationsBeforeSeek + 1);
  });

  it("keeps the shared clock attached when currentSrc is an HTTP redirect target", () => {
    media.src = "https://example.test/a.mp3";
    media.currentSrc = "https://cdn.example.test/redirected-a.mp3";
    media.currentTime = 37.5;

    clock.refreshFromMedia();

    expect(clock.getSnapshot()).toMatchObject({ currentTime: 37.5, duration: 120 });
  });

  it("stops frame sampling while paused, hidden, or without subscribers and resyncs on return", () => {
    const unsubscribe = clock.subscribe(vi.fn());
    clock.syncRuntime(createActiveRuntime("playing"));
    expect(scheduler.pendingFrames).toBe(1);

    scheduler.visible = false;
    clock.handleVisibilityChange();
    expect(scheduler.pendingFrames).toBe(0);

    media.currentTime = 71;
    scheduler.visible = true;
    clock.handleVisibilityChange();
    expect(clock.getSnapshot().currentTime).toBe(71);
    expect(scheduler.pendingFrames).toBe(1);

    clock.syncRuntime({ ...createActiveRuntime("paused"), shouldPlay: false });
    expect(scheduler.pendingFrames).toBe(0);
    unsubscribe();
  });

  it("detaches stale deck events and resets time when the target track changes", () => {
    const subscriber = vi.fn();
    clock.subscribe(subscriber);
    clock.syncRuntime({
      ...createActiveRuntime("loading"),
      requestId: 5,
      targetSongId: "song-b",
      targetSource: "source-b",
      activeDeckId: null,
      activeSource: null,
    });
    media.currentTime = 92;
    media.dispatchEvent(new Event("timeupdate"));

    expect(clock.getSnapshot()).toMatchObject({
      currentTime: 0,
      duration: 0,
      requestId: 5,
      targetSongId: "song-b",
      activeDeckId: null,
      phase: "loading",
    });
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1])(
    "normalizes invalid duration %s to zero",
    (duration) => {
      media.duration = duration;
      clock.refreshFromMedia();
      expect(clock.getSnapshot().duration).toBe(0);
    }
  );
});
