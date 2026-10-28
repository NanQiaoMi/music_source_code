import { describe, expect, it, vi } from "vitest";
import { createRafScheduler, type RafSchedulerEnv } from "@/lib/perf/rafScheduler";
import {
  FPS_DOWNGRADE_THRESHOLD,
  LONG_TASK_COOLDOWN_MS,
  LONG_TASK_THRESHOLD_MS,
  createVisualRuntime,
  type VisualRuntime,
} from "./visualRuntime";

function createHarness(initialHidden = false, options: { now?: () => number } = {}) {
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
  const scheduler = createRafScheduler(env);
  const runtime: VisualRuntime = createVisualRuntime({
    scheduler,
    isHidden: () => hidden,
    onVisibilityChange,
    now: options.now,
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

  return { runtime, scheduler, requestFrame, cancelFrame, frames, setHidden, pump };
}

const frameSeries = (start: number, count: number, step: number) =>
  Array.from({ length: count }, (_, index) => start + index * step);

/** 与 runtime 内同口径的最近秩分位，供测试手算 baseline。 */
const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
};

/** 忙等模拟一段确定的绘制工作量，避免 setTimeout 在 CI 上的抖动。 */
function simulateDrawWork(ms: number): void {
  const deadline = performance.now() + ms;
  while (performance.now() < deadline) {
    // 模拟效果绘制本体的 CPU 工作
  }
}

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

  it("recordLongTask drops one tier immediately and respects the cooldown", () => {
    let clock = 0;
    const h = createHarness(false, { now: () => clock });
    const changes: Array<[string, string]> = [];
    h.runtime.onQualityChange((next, previous) => changes.push([previous, next.tier]));

    // 阈值本身（50ms）不算长任务
    h.runtime.recordLongTask(LONG_TASK_THRESHOLD_MS);
    expect(h.runtime.qualityTier).toBe("high");

    h.runtime.recordLongTask(80);
    expect(h.runtime.qualityTier).toBe("medium");

    clock += LONG_TASK_COOLDOWN_MS / 2;
    h.runtime.recordLongTask(80);
    expect(h.runtime.qualityTier).toBe("medium");

    clock += LONG_TASK_COOLDOWN_MS;
    h.runtime.recordLongTask(80);
    expect(h.runtime.qualityTier).toBe("low");

    // 冷却结束后的重复长任务保持 low，不越界也不重复通知
    clock += LONG_TASK_COOLDOWN_MS;
    h.runtime.recordLongTask(500);
    expect(h.runtime.qualityTier).toBe("low");
    expect(changes).toEqual([
      ["high", "medium"],
      ["medium", "low"],
    ]);
  });

  it("simulates 4x throttle (33ms frames) and reaches low within two windows", () => {
    const h = createHarness();
    h.runtime.subscribe("a", () => {});
    const throttled = frameSeries(0, 93, 33.4);

    h.pump(throttled.slice(0, 31));
    expect(h.runtime.getStats().fps).toBeLessThan(FPS_DOWNGRADE_THRESHOLD);
    expect(h.runtime.qualityTier).toBe("medium");

    h.pump(throttled.slice(31, 62));
    expect(h.runtime.qualityTier).toBe("low");

    // 继续低于 50fps 只保持 low，不重复通知
    const changes = vi.fn();
    h.runtime.onQualityChange(changes);
    h.pump(throttled.slice(62));
    expect(h.runtime.qualityTier).toBe("low");
    expect(changes).not.toHaveBeenCalled();
  });

  it("upgrades one tier after three stable >=58fps windows", () => {
    let clock = 0;
    const h = createHarness(false, { now: () => clock });
    h.runtime.recordLongTask(80);
    clock += LONG_TASK_COOLDOWN_MS;
    h.runtime.recordLongTask(80);
    expect(h.runtime.qualityTier).toBe("low");

    const changes = vi.fn();
    h.runtime.onQualityChange(changes);
    h.runtime.subscribe("a", () => {});
    const stable = frameSeries(0, 183, 16.67);

    // 两个窗口（122 帧）仍不足 3 个稳定窗口，不升档
    h.pump(stable.slice(0, 122));
    expect(h.runtime.qualityTier).toBe("low");
    expect(changes).not.toHaveBeenCalled();

    h.pump(stable.slice(122));
    expect(h.runtime.qualityTier).toBe("medium");
    expect(changes).toHaveBeenCalledTimes(1);
    expect(changes.mock.calls[0][0]).toMatchObject({ tier: "medium" });
    expect(changes.mock.calls[0][1]).toBe("low");
  });

  it("exposes tier via getQuality(), qualityTier, and getStats()", () => {
    const h = createHarness();
    expect(h.runtime.getQuality()).toEqual({ tier: "high", dprCap: 2, effectScale: 1 });
    expect(h.runtime.qualityTier).toBe("high");

    h.runtime.recordLongTask(60);
    expect(h.runtime.getQuality()).toEqual({ tier: "medium", dprCap: 1.5, effectScale: 0.75 });
    expect(h.runtime.qualityTier).toBe(h.runtime.getQuality().tier);
    expect(h.runtime.getStats()).toMatchObject({
      quality: "medium",
      dprCap: 1.5,
      effectScale: 0.75,
    });

    // 构造函数上的 onQualityChange 也被通知
    const envChanges = vi.fn();
    const runtime = createVisualRuntime({ onQualityChange: envChanges, now: () => 0 });
    runtime.recordLongTask(60);
    expect(envChanges).toHaveBeenCalledWith(
      { tier: "medium", dprCap: 1.5, effectScale: 0.75 },
      "high"
    );
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

  it("keeps one scheduler request per frame for multiple visual consumers", () => {
    const h = createHarness();
    const visualization = vi.fn();
    const floatingGlow = vi.fn();

    h.runtime.subscribe("visualization", visualization);
    h.runtime.subscribe("floating-spectrum", floatingGlow);

    // 两个消费者共享同一条 runtime 循环：一个待执行帧、每帧一次排帧请求
    expect(h.requestFrame).toHaveBeenCalledTimes(1);
    expect(h.frames.size).toBe(1);
    const requestLoop = vi.spyOn(h.scheduler, "request");

    h.pump([16, 32, 48]);

    expect(visualization).toHaveBeenCalledTimes(3);
    expect(floatingGlow).toHaveBeenCalledTimes(3);
    expect(h.requestFrame).toHaveBeenCalledTimes(4);
    // 迁移前每个消费者各自维持一条 requestRaf 链（2 次/帧）；runtime 恒为 1 次/帧
    expect(requestLoop).toHaveBeenCalledTimes(3);
  });

  it("samples draw p50/p95 from subscriber callback durations", () => {
    let clock = 0;
    const h = createHarness(false, { now: () => clock });
    const durations = Array.from({ length: 100 }, (_, index) => index + 1);
    let frame = 0;

    h.runtime.subscribe("visualization", () => {
      clock += durations[frame % durations.length];
      frame += 1;
    });

    h.pump(frameSeries(0, 100, 16.67));

    const stats = h.runtime.getStats();
    expect(stats.drawSamples).toBe(100);
    expect(stats.drawP50Ms).toBe(50);
    expect(stats.drawP95Ms).toBe(95);

    // 采样窗口只保留最近 120 次，不随运行时长增长
    h.pump(frameSeries(1000, 60, 16.67));
    expect(h.runtime.getStats().drawSamples).toBe(120);
  });

  it("keeps draw p95 within 10% of the simulated legacy baseline", () => {
    // 1920x1080 dpr2 的绘制耗时序列（约 p50 1.3ms / p95 1.7ms）。
    // baseline 与 runtime 在同一帧上测量：baseline 是旧循环"包住 draw 调用"的口径，
    // runtime 的 drawP95Ms 是同一段绘制外加两次 now()。同帧对比可排除负载漂移。
    const costs = Array.from({ length: 120 }, (_, index) => (index % 4 === 0 ? 1.7 : 1.3));
    const baseline: number[] = [];

    const h = createHarness();
    let frame = 0;
    h.runtime.subscribe("visualization", () => {
      const startedAt = performance.now();
      simulateDrawWork(costs[frame % costs.length]);
      baseline.push(performance.now() - startedAt);
      frame += 1;
    });

    h.pump(frameSeries(0, costs.length, 16.67));

    const { drawSamples, drawP95Ms } = h.runtime.getStats();
    const baselineP95 = percentile(baseline, 95);
    expect(drawSamples).toBe(costs.length);
    expect(drawP95Ms).toBeLessThanOrEqual(baselineP95 * 1.1);
  });
});
