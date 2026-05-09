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

  setPerformanceLevel: (level: PerformanceLevel) => void;
  updateStats: (stats: {
    fps: number;
    cpuUsage: number;
    memoryUsage: number;
    drawCalls: number;
    gpuMemory: number;
  }) => void;
  setWebGLAvailable: (available: boolean) => void;
}

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

      setPerformanceLevel: (level) => set({ config: PERFORMANCE_CONFIGS[level] }),

      updateStats: (stats) =>
        set({
          fps: stats.fps,
          cpuUsage: stats.cpuUsage,
          memoryUsage: stats.memoryUsage,
          drawCalls: stats.drawCalls,
          gpuMemory: stats.gpuMemory,
        }),

      setWebGLAvailable: (available) => set({ isWebGLAvailable: available }),
    }),
    {
      name: "performance-v8-store",
      partialize: (state) => ({
        config: state.config,
      }),
    }
  )
);
