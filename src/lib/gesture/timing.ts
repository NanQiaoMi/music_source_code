import { GESTURE_IDLE_MAX_FPS } from "./types";

const DEFAULT_MAX_FPS = 30;

/**
 * 手势推理的目标频率。
 * - 有手：使用 tuning.maxFps（默认 30），保证指针/捏合手感；
 * - 无手：降到 GESTURE_IDLE_MAX_FPS（默认 12），空闲时明显降低 CPU/GPU 占用。
 */
export function resolveDetectionFps(maxFps: number, handPresent: boolean): number {
  const safeMax = Number.isFinite(maxFps) && maxFps > 0 ? maxFps : DEFAULT_MAX_FPS;
  if (handPresent) return safeMax;
  return Math.min(safeMax, GESTURE_IDLE_MAX_FPS);
}

/** 两次检测的最小间隔（毫秒）。保留 2ms 容差，避免 rVFC 时间戳取整造成整帧丢失。 */
export function resolveDetectionIntervalMs(maxFps: number, handPresent: boolean): number {
  return Math.max(1, 1000 / resolveDetectionFps(maxFps, handPresent) - 2);
}
