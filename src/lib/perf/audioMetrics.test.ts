import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordNodesCreated,
  recordNodesReleased,
  resetAudioGraphStats,
} from "@/lib/audio/audioGraphStats";
import {
  AUDIO_METRICS_TICK_MS,
  audioMetricsProbe,
  getSnapshot,
  reset,
  start,
  stop,
} from "./audioMetrics";

function stubRaf() {
  const callbacks: FrameRequestCallback[] = [];
  const request = vi.fn((callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  const cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  return {
    request,
    cancel,
    run(timestamp: number) {
      callbacks.shift()?.(timestamp);
    },
  };
}

class FakePerformanceObserver {
  static instances: FakePerformanceObserver[] = [];
  readonly callback: (list: PerformanceObserverEntryList) => void;
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();
  readonly takeRecords = vi.fn(() => []);

  constructor(callback: (list: PerformanceObserverEntryList) => void) {
    this.callback = callback;
    FakePerformanceObserver.instances.push(this);
  }
}

describe("audioMetrics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T00:00:00Z"));
    localStorage.clear();
    reset();
    resetAudioGraphStats();
  });

  afterEach(() => {
    reset();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("exposes a stable snapshot shape and the window probe", () => {
    start();

    expect(getSnapshot()).toEqual({
      running: true,
      durationMs: 0,
      frames: { count: 0, avgMs: 0, p95Ms: 0, maxMs: 0 },
      storeWrites: { total: 0, perSecond: 0, samples: [] },
      longTasks: { count: 0, totalMs: 0, maxMs: 0 },
      audioGraph: { createdNodes: 0, activeNodes: 0 },
    });
    const probe = (window as Window & { __audioMetrics?: typeof audioMetricsProbe }).__audioMetrics;
    expect(probe).toBe(audioMetricsProbe);
  });

  it("computes writes/sec from one-second ticks with fake timers", () => {
    start();
    localStorage.setItem("player-store", "a");
    localStorage.setItem("player-store", "b");
    vi.advanceTimersByTime(AUDIO_METRICS_TICK_MS);
    localStorage.setItem("player-store", "c");
    vi.advanceTimersByTime(AUDIO_METRICS_TICK_MS);

    expect(getSnapshot().durationMs).toBe(2000);
    expect(getSnapshot().storeWrites).toEqual({ total: 3, perSecond: 1.5, samples: [2, 1] });
  });

  it("averages rAF frame deltas and reports p95", () => {
    const raf = stubRaf();
    start();
    raf.run(1000);
    raf.run(1016);
    raf.run(1032);
    raf.run(1064);

    expect(getSnapshot().frames).toEqual({ count: 3, avgMs: 21.33, p95Ms: 32, maxMs: 32 });
  });

  it("records long tasks above 50ms through PerformanceObserver", () => {
    FakePerformanceObserver.instances = [];
    vi.stubGlobal("PerformanceObserver", FakePerformanceObserver);
    start();

    const observer = FakePerformanceObserver.instances[0];
    expect(observer.observe).toHaveBeenCalledWith({ entryTypes: ["longtask"] });
    observer.callback({
      getEntries: () => [{ duration: 75 }, { duration: 20 }, { duration: 51 }],
    } as unknown as PerformanceObserverEntryList);

    expect(getSnapshot().longTasks).toEqual({ count: 2, totalMs: 126, maxMs: 75 });
    stop();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("mirrors audio graph created/active counters", () => {
    recordNodesCreated("media-source", 2);
    start();
    recordNodesCreated("graph", 1);
    recordNodesReleased("media-source", 1);

    expect(getSnapshot().audioGraph).toEqual({ createdNodes: 3, activeNodes: 2 });
  });

  it("keeps start/stop idempotent and resets counters on restart", () => {
    const raf = stubRaf();
    start();
    start();
    expect(raf.request).toHaveBeenCalledTimes(1);

    localStorage.setItem("player-store", "a");
    expect(stop().storeWrites.total).toBe(1);
    stop();
    expect(raf.cancel).toHaveBeenCalledTimes(1);

    start();
    expect(getSnapshot().storeWrites.total).toBe(0);
    expect(raf.request).toHaveBeenCalledTimes(2);
  });

  it("is a no-op outside the browser", () => {
    vi.stubGlobal("window", undefined);

    expect(() => start()).not.toThrow();
    expect(() => stop()).not.toThrow();
    expect(() => reset()).not.toThrow();
    const snapshot = getSnapshot();
    expect(snapshot.running).toBe(false);
    expect(snapshot.frames.count).toBe(0);
    expect(snapshot.storeWrites.total).toBe(0);
  });
});
