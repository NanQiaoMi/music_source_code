import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PerformanceLevel, PerformanceConfig } from "@/lib/visualization/types";

export type { PerformanceLevel };

interface PerformanceState {
  config: PerformanceConfig;
  fps: number;
  cpuUsage: number;
  memoryUsage: number;
  drawCalls: number;
  gpuMemory: number; // 单位: MB
  isWebGLAvailable: boolean;
  lowFpsStartedAt: number | null;
  needsRecovery: boolean;

  setPerformanceLevel: (level: PerformanceLevel) => void;
  updateStats: (stats: {
    fps: number;
    cpuUsage: number;
    memoryUsage: number;
    drawCalls: number;
    gpuMemory: number;
  }) => void;
  setWebGLAvailable: (available: boolean) => void;
  resetRecoveryState: () => void;
}

const LOW_FPS_THRESHOLD = 20;
const LOW_FPS_RECOVERY_MS = 5000;

const PERFORMANCE_CONFIGS: Record<PerformanceLevel, PerformanceConfig> = {
  low: {
    level: "low",
    targetFPS: 30,
    maxParticles: 1000,
    postProcessing: false,
    webglQuality: "low",
  },
  medium: {
    level: "medium",
    targetFPS: 30,
    maxParticles: 3000,
    postProcessing: true,
    webglQuality: "medium",
  },
  high: {
    level: "high",
    targetFPS: 60,
    maxParticles: 8000,
    postProcessing: true,
    webglQuality: "high",
  },
  ultra: {
    level: "ultra",
    targetFPS: 60,
    maxParticles: 20000,
    postProcessing: true,
    webglQuality: "ultra",
  },
};

export const usePerformanceV8Store = create<PerformanceState>()(
  persist(
    (set) => ({
      config: PERFORMANCE_CONFIGS.medium,
      fps: 60,
      cpuUsage: 0,
      memoryUsage: 0,
      drawCalls: 0,
      gpuMemory: 0,
      isWebGLAvailable: typeof WebGLRenderingContext !== "undefined",
      lowFpsStartedAt: null,
      needsRecovery: false,

      setPerformanceLevel: (level) =>
        set({ config: PERFORMANCE_CONFIGS[level], lowFpsStartedAt: null, needsRecovery: false }),

      updateStats: (stats) =>
        set((state) => {
          const now = Date.now();
          const isLowFps = stats.fps > 0 && stats.fps < LOW_FPS_THRESHOLD;
          const lowFpsStartedAt = isLowFps ? (state.lowFpsStartedAt ?? now) : null;
          const lowFpsDuration = lowFpsStartedAt === null ? 0 : now - lowFpsStartedAt;

          return {
            fps: stats.fps,
            cpuUsage: stats.cpuUsage,
            memoryUsage: stats.memoryUsage,
            drawCalls: stats.drawCalls,
            gpuMemory: stats.gpuMemory,
            lowFpsStartedAt,
            needsRecovery: isLowFps && lowFpsDuration >= LOW_FPS_RECOVERY_MS,
          };
        }),

      setWebGLAvailable: (available) => set({ isWebGLAvailable: available }),

      resetRecoveryState: () => set({ lowFpsStartedAt: null, needsRecovery: false }),
    }),
    {
      name: "performance-v8-store",
      partialize: (state) => ({
        config: state.config,
      }),
    }
  )
);
