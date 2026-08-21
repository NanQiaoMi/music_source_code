import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { usePerformanceV8Store } from "./performanceV8Store";

describe("performanceV8Store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T00:00:00.000Z"));
    usePerformanceV8Store.setState({
      config: {
        level: "medium",
        targetFPS: 30,
        maxParticles: 3000,
        postProcessing: true,
        webglQuality: "medium",
      },
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
  });

  it("caps dpr quality for low and medium performance levels", () => {
    usePerformanceV8Store.getState().setPerformanceLevel("low");
    expect(usePerformanceV8Store.getState().config.webglQuality).toBe("low");

    usePerformanceV8Store.getState().setPerformanceLevel("medium");
    expect(usePerformanceV8Store.getState().config.targetFPS).toBe(30);

    usePerformanceV8Store.getState().setPerformanceLevel("ultra");
    expect(usePerformanceV8Store.getState().activePreset).toBe("custom");
  });

  it("applies user-facing visual performance presets", () => {
    usePerformanceV8Store.getState().setPerformancePreset("cinematic");
    expect(usePerformanceV8Store.getState().activePreset).toBe("cinematic");
    expect(usePerformanceV8Store.getState().config).toMatchObject({
      level: "high",
      targetFPS: 60,
      maxParticles: 8000,
      postProcessing: true,
      webglQuality: "high",
    });

    usePerformanceV8Store.getState().setPerformancePreset("battery");
    expect(usePerformanceV8Store.getState().activePreset).toBe("battery");
    expect(usePerformanceV8Store.getState().config).toMatchObject({
      level: "low",
      targetFPS: 30,
      maxParticles: 1000,
      postProcessing: false,
      webglQuality: "low",
    });
  });

  it("flags sustained low fps as a recovery condition", () => {
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
