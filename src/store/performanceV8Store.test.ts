// S6-8c: 性能档唯一 owner = visualRuntime；performanceV8Store 只做只读投影（config）
// 并保留 telemetry。这里锁住投影方向、持久化 payload 与水合 seed。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyVisualQualityPreset,
  presetForLevel,
  VISUAL_PERFORMANCE_PRESETS,
} from "@/lib/visualization/quality";
import { visualRuntime } from "@/runtime/visualRuntime";
import { usePerformanceV8Store } from "./performanceV8Store";

const tier = () => visualRuntime.getQuality().tier;
const config = () => usePerformanceV8Store.getState().config;

describe("performanceV8Store (runtime projection)", () => {
  beforeEach(() => {
    localStorage.clear();
    visualRuntime.setQuality("high");
    usePerformanceV8Store.setState({
      fps: 60,
      cpuUsage: 0,
      memoryUsage: 0,
      drawCalls: 0,
      gpuMemory: 0,
      isWebGLAvailable: true,
      lowFpsStartedAt: null,
      needsRecovery: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    visualRuntime.setQuality("high");
  });

  it("projects runtime tier changes into the persisted config", () => {
    visualRuntime.setQuality("low");
    expect(tier()).toBe("low");
    expect(config()).toMatchObject({ level: "low", targetFPS: 30, webglQuality: "low" });

    visualRuntime.setQuality("medium");
    expect(config()).toMatchObject({
      level: "medium",
      targetFPS: 30,
      maxParticles: 3000,
      postProcessing: true,
    });
  });

  it("routes user preset selection through the runtime owner", () => {
    applyVisualQualityPreset("battery");
    expect(tier()).toBe("low");
    expect(config().level).toBe("low");

    applyVisualQualityPreset("cinematic");
    expect(tier()).toBe("high");
    expect(config()).toMatchObject({
      level: "high",
      targetFPS: 60,
      maxParticles: 8000,
      webglQuality: "high",
    });
    expect(presetForLevel(config().level)).toBe("cinematic");
    expect(VISUAL_PERFORMANCE_PRESETS.map((preset) => preset.id)).toEqual([
      "cinematic",
      "balanced",
      "battery",
    ]);
  });

  it("persists only the projected config (activePreset duplicate removed)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    visualRuntime.setQuality("medium");

    const writes = setItem.mock.calls.filter(([key]) => key === "performance-v8-store");
    expect(writes.length).toBeGreaterThan(0);
    const saved = JSON.parse(String(writes[writes.length - 1][1]));
    expect(Object.keys(saved.state)).toEqual(["config"]);
    expect(saved.state.config.level).toBe("medium");
    expect(saved.state.activePreset).toBeUndefined();
  });

  it("seeds the runtime tier from the persisted config on hydration", async () => {
    localStorage.setItem(
      "performance-v8-store",
      JSON.stringify({
        state: {
          config: {
            level: "low",
            targetFPS: 30,
            maxParticles: 1000,
            postProcessing: false,
            webglQuality: "low",
          },
        },
        version: 0,
      })
    );

    await usePerformanceV8Store.persist.rehydrate();

    expect(tier()).toBe("low");
    expect(config().level).toBe("low");
  });

  it("maps legacy ultra presets back to the reachable high tier", () => {
    expect(presetForLevel("ultra")).toBe("custom");
  });

  it("flags sustained low fps as a recovery condition", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T00:00:00.000Z"));
    const lowStats = {
      fps: 18,
      cpuUsage: 20,
      memoryUsage: 120,
      drawCalls: 15,
      gpuMemory: 64,
    };

    usePerformanceV8Store.getState().updateStats(lowStats);
    expect(usePerformanceV8Store.getState().needsRecovery).toBe(false);

    vi.setSystemTime(new Date("2026-05-13T00:00:05.100Z"));
    usePerformanceV8Store.getState().updateStats(lowStats);

    expect(usePerformanceV8Store.getState().needsRecovery).toBe(true);
  });
});
