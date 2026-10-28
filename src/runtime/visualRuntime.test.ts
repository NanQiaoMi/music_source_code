import { describe, expect, it, vi } from "vitest";
import { createRafScheduler, type RafSchedulerEnv } from "@/lib/perf/rafScheduler";
import { FPS_DOWNGRADE_THRESHOLD, createVisualRuntime, type VisualRuntime } from "./visualRuntime";

function createHarness(initialHidden = false) {
  const frames = new Map<number, FrameRequestCallback>();
  const listeners = new Set<() => void>();
  let nextHandle = 1;
  let hidden = initialHidden;

  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    const handle = nextHandle;
    nextHandle += 1;
    frames.set(handle, callback);
    return handle;
  });
  const cancelFrame = vi.fn((handle: number) => {
    frames.delete(handle);
  });
  const onVisibilityChange = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const env: RafSchedulerEnv = {
    requestFrame,
    cancelFrame,
    isHidden: () => hidden,
    onVisibilityChange,
  };
  const runtime: VisualRuntime = createVisualRuntime({
    scheduler: createRafScheduler(env),
    isHidden: () => hidden,
    onVisibilityChange,
  });

  const setHidden = (value: boolean) => {
    hidden = value;
    for (const listener of Array.from(listeners)) listener();
  };
  const pump = (timestamps: number[]) => {
    for (const timestamp of timestamps) {
      const batch = Array.from(frames.values());
      frames.clear();
      for (const callback of batch) callback(timestamp);
    }
  };

  return { runtime, requestFrame, cancelFrame, frames, setHidden, pump };
}

const frameSeries = (start: number, count: number, step: number) =>
  Array.from({ length: count }, (_, index) => start + index * step);

describe("VisualRuntime", () => {
  it("shares one rAF across multiple subscribers and dispatches in order", () => {
    const h = createHarness();
    const seen: string[] = [];

    h.runtime.subscribe("a", () => seen.push("a"));
    h.runtime.subscribe("b", () => seen.push("b"));
    h.runtime.subscribe("c", () => seen.push("c"));

    expect(h.requestFrame).toHaveBeenCalledTimes(1);
    expect(h.runtime.getStats().subscribers).toBe(3);

    h.pump([16]);
    expect(seen).toEqual(["a", "b", "c"]);
    expect(h.requestFrame).toHaveBeenCalledTimes(2);
  });

  it("passes time and delta, clamping long gaps to 50ms", () => {
    const h = createHarness();
    const samples: Array<[number, number]> = [];
    h.runtime.subscribe("a", (time, delta) => samples.push([time, delta]));

    h.pump([100, 116, 132, 2000]);

    expect(samples.map(([time]) => time)).toEqual([100, 116, 132, 2000]);
    expect(samples[0][1]).toBeCloseTo(1000 / 60);
    expect(samples[1][1]).toBe(16);
    expect(samples[2][1]).toBe(16);
    expect(samples[3][1]).toBe(50);
  });

  it("samples FPS on a one-second window", () => {
    const h = createHarness();
    h.runtime.subscribe("a", () => {});
    h.pump(frameSeries(0, 61, 16.67));

    const { fps } = h.runtime.getStats();
    expect(fps).toBeGreaterThan(58);
    expect(fps).toBeLessThan(62);
  });

  it("downgrades DPR and effect quality when average FPS stays below threshold", () => {
    const h = createHarness();
    h.runtime.subscribe("a", () => {});
    h.pump(frameSeries(0, 64, 33.34));

    const stats = h.runtime.getStats();
    expect(stats.fps).toBeLessThan(FPS_DOWNGRADE_THRESHOLD);
    expect(stats.quality).toBe("low");
    expect(stats.dprCap).toBe(1);
    expect(stats.effectScale).toBe(0.5);
  });

  it("upgrades one tier after three stable high-FPS windows", () => {
    const h = createHarness();
    h.runtime.subscribe("a", () => {});
    h.pump(frameSeries(0, 64, 33.34));
    expect(h.runtime.getStats().quality).toBe("low");

    // 隐藏/恢复只重置计时与采样窗口，保留当前画质档位
    h.setHidden(true);
    h.setHidden(false);
    h.pump(frameSeries(0, 181, 16.67));
    expect(h.runtime.getStats().quality).toBe("medium");

    h.setHidden(true);
    h.setHidden(false);
    h.pump(frameSeries(0, 181, 16.67));
    expect(h.runtime.getStats().quality).toBe("high");
  });

  it("pauses on hidden, keeps no pending frame, and resets delta on visibility", () => {
    const h = createHarness();
    const samples: Array<[number, number]> = [];
    h.runtime.subscribe("a", (time, delta) => samples.push([time, delta]));

    h.pump([100]);
    expect(h.requestFrame).toHaveBeenCalledTimes(2);

    h.setHidden(true);
    expect(h.frames.size).toBe(0);
    expect(h.runtime.getStats().fps).toBe(0);
    h.pump([200]);
    expect(samples).toHaveLength(1);

    h.setHidden(false);
    expect(h.requestFrame).toHaveBeenCalledTimes(3);
    h.pump([5000]);
    expect(samples).toHaveLength(2);
    expect(samples[1][1]).toBeCloseTo(1000 / 60);
  });

  it("stops delivering after unsubscribe and cancels the last frame", () => {
    const h = createHarness();
    const callback = vi.fn();
    const handle = h.runtime.subscribe("a", callback);

    h.pump([16]);
    expect(callback).toHaveBeenCalledTimes(1);

    handle.stop();
    expect(handle.active).toBe(false);
    expect(h.runtime.getStats().subscribers).toBe(0);
    expect(h.cancelFrame).toHaveBeenCalled();
    expect(h.frames.size).toBe(0);

    h.pump([32]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("pause stops the loop and resume restarts it once", () => {
    const h = createHarness();
    const callback = vi.fn();
    h.runtime.subscribe("a", callback);

    h.runtime.pause();
    expect(h.frames.size).toBe(0);
    h.pump([16]);
    expect(callback).not.toHaveBeenCalled();

    h.runtime.resume();
    expect(h.requestFrame).toHaveBeenCalledTimes(2);
    h.pump([32]);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("isolates subscriber errors and removes the failing subscriber", () => {
    const h = createHarness();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const healthy = vi.fn();

    h.runtime.subscribe("broken", () => {
      throw new Error("boom");
    });
    h.runtime.subscribe("healthy", healthy);

    h.pump([16]);
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(h.runtime.getStats().subscribers).toBe(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
