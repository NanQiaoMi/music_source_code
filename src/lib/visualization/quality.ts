/**
 * S6-8c：渲染性能档位（quality tier）的纯映射与用户选择入口。
 *
 * 唯一 owner 是 visualRuntime（S5-6 自适应）；本模块不保存状态，只把
 * tier <-> 预算配置 / 用户预设 之间的映射集中到一处，避免 store、UI、runtime
 * 各存一份"档位 -> 参数"表。performanceV8Store 的 config 是这些映射的只读投影。
 */
import type { PerformanceConfig } from "@/lib/visualization/types";
import { visualRuntime, type VisualQuality } from "@/runtime/visualRuntime";

export type VisualPerformancePreset = "cinematic" | "balanced" | "battery";
export type ActiveVisualPerformancePreset = VisualPerformancePreset | "custom";

export const VISUAL_PERFORMANCE_PRESETS: Array<{
  id: VisualPerformancePreset;
  name: string;
  description: string;
}> = [
  {
    id: "cinematic",
    name: "Cinematic",
    description: "60 FPS, richer particles, post-processing on.",
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Stable 30 FPS with a moderate particle budget.",
  },
  {
    id: "battery",
    name: "Battery",
    description: "Lower particle count and no post-processing.",
  },
];

/** runtime tier -> 渲染预算（旧 PERFORMANCE_CONFIGS 的 high/medium/low 三档；ultra 不可达）。 */
export const QUALITY_CONFIGS: Record<VisualQuality, PerformanceConfig> = {
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
};

export const TIER_BY_PRESET: Record<VisualPerformancePreset, VisualQuality> = {
  cinematic: "high",
  balanced: "medium",
  battery: "low",
};

export function configForTier(tier: VisualQuality): PerformanceConfig {
  return QUALITY_CONFIGS[tier];
}

export function presetForTier(tier: VisualQuality): VisualPerformancePreset {
  if (tier === "high") return "cinematic";
  if (tier === "medium") return "balanced";
  return "battery";
}

/** 兼容旧 activePreset 派生：ultra 只能来自历史持久化数据，归为 custom。 */
export function presetForLevel(level: PerformanceConfig["level"]): ActiveVisualPerformancePreset {
  if (level === "ultra") return "custom";
  return presetForTier(level);
}

/** 用户选择预设：唯一写入口是 runtime（owner），投影 store 只接收订阅回流。 */
export function applyVisualQualityPreset(preset: VisualPerformancePreset): void {
  visualRuntime.setQuality(TIER_BY_PRESET[preset]);
}
