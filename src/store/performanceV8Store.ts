import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PerformanceConfig } from "@/lib/visualization/types";
import { configForTier } from "@/lib/visualization/quality";
import { visualRuntime, type VisualQuality } from "@/runtime/visualRuntime";

/**
 * S6-8c：渲染性能档位的唯一 owner 是 visualRuntime（S5-6：FPS/长任务自适应）。
 * 本 store 从"第二套档位来源"降级为**只读投影**：
 * - config 由 runtime 的 quality tier 派生（projectQuality 是唯一写入口，只被 runtime
 *   档位订阅与持久化水合 seed 调用）；
 * - 删除 activePreset / setPerformancePreset / setPerformanceLevel（旧档位写路径）；
 * - 保留 FPS/CPU/内存 telemetry（S5-6 明确不回退的部分）。
 * 用户点选预设走 @/lib/visualization/quality 的 applyVisualQualityPreset（写 runtime），
 * 再由订阅回流成投影，保证"质量档事实一个写入方"。
 *
 * 持久化：key 仍是 performance-v8-store，partialize 只剩 { config }（旧 activePreset
 * 是 config.level 的重复表示，已删除）；水合后把持久化的 level 作为 runtime 初始档位，
 * 使用户上次选择的档位跨刷新保留。
 */

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

  /** 只读投影写入口：仅 runtime 档位订阅与水合 seed 调用。 */
  projectQuality: (tier: VisualQuality) => void;
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

export const usePerformanceV8Store = create<PerformanceState>()(
  persist(
    (set, get) => ({
      config: configForTier(visualRuntime.getQuality().tier),
      fps: 60,
      cpuUsage: 0,
      memoryUsage: 0,
      drawCalls: 0,
      gpuMemory: 0,
      isWebGLAvailable: typeof WebGLRenderingContext !== "undefined",
      lowFpsStartedAt: null,
      needsRecovery: false,

      projectQuality: (tier) => {
        if (get().config.level === tier) return;
        set({ config: configForTier(tier) });
      },

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
      skipHydration: true,
      name: "performance-v8-store",
      partialize: (state) => ({ config: state.config }),
      // 水合后把持久化档位作为 runtime 初始档位（单一 owner 的 seed，不是第二写入方）。
      onRehydrateStorage: () => (state) => {
        const level = state?.config?.level;
        if (!level) return;
        const tier = level === "ultra" ? "high" : level;
        visualRuntime.setQuality(tier);
        // 历史数据的 ultra 不会触发 runtime 变化；显式对齐一次投影，避免 payload 里留下不可达档位。
        usePerformanceV8Store.getState().projectQuality(tier);
      },
    }
  )
);

// 唯一投影订阅：runtime 档位变化 -> store config（不反向写 runtime）。
visualRuntime.onQualityChange((next) => {
  usePerformanceV8Store.getState().projectQuality(next.tier);
});
// 模块加载时对齐一次，避免初始 config 与 runtime 当前档位不一致。
usePerformanceV8Store.getState().projectQuality(visualRuntime.getQuality().tier);
