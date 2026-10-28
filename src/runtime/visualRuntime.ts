"use client";

import { rafScheduler, type RafScheduler } from "@/lib/perf/rafScheduler";

/**
 * 视觉帧与画质的唯一权威（S5-1）：所有订阅者共享一条 rafScheduler 循环。
 * 每帧下发 time/delta，按 1 秒窗口采样 FPS 自适应 DPR 与效果密度；隐藏时停表，
 * 恢复后重置计时。显式 pause/resume 不重建订阅。
 */

export type VisualQuality = "high" | "medium" | "low";

export interface VisualQualityProfile {
  tier: VisualQuality;
  /** 画布后备存储的 DPR 上限。 */
  dprCap: number;
  /** 效果密度缩放（粒子数等），与 dprCap 同步降档。 */
  effectScale: number;
}

/** 降档顺序：high → medium → low。 */
export const VISUAL_QUALITY_PROFILES: readonly VisualQualityProfile[] = [
  { tier: "high", dprCap: 2, effectScale: 1 },
  { tier: "medium", dprCap: 1.5, effectScale: 0.75 },
  { tier: "low", dprCap: 1, effectScale: 0.5 },
];

export const FPS_DOWNGRADE_THRESHOLD = 50;
export const FPS_UPGRADE_THRESHOLD = 58;
export const FPS_SAMPLE_WINDOW_MS = 1000;
export const QUALITY_UPGRADE_STABLE_WINDOWS = 3;

const FALLBACK_DELTA_MS = 1000 / 60;
const MAX_DELTA_MS = 50;
const MIN_SAMPLE_FRAMES = 10;

export type VisualSubscriber = (time: number, delta: number) => void;

export interface VisualFrameHandle {
  readonly id: string;
  readonly active: boolean;
  stop(): void;
}

export interface VisualRuntimeStats {
  fps: number;
  frameCount: number;
  subscribers: number;
  quality: VisualQuality;
  dprCap: number;
  effectScale: number;
  paused: boolean;
}

export interface VisualRuntimeEnv {
  scheduler?: RafScheduler;
  isHidden?: () => boolean;
  onVisibilityChange?: (listener: () => void) => () => void;
}

interface SubscriberRecord {
  id: string;
  callback: VisualSubscriber;
  active: boolean;
}

const defaultIsHidden = () =>
  typeof document !== "undefined" && document.visibilityState === "hidden";

const defaultOnVisibilityChange = (listener: () => void): (() => void) => {
  if (typeof document === "undefined") return () => undefined;
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};

export class VisualRuntime {
  private readonly scheduler: RafScheduler;
  private readonly isHidden: () => boolean;
  private readonly onVisibilityChange: (listener: () => void) => () => void;
  private readonly subs = new Map<string, SubscriberRecord>();
  private qualityIndex = 0;
  private stableWindows = 0;
  private frameHandle: number | null = null;
  private lastTime: number | null = null;
  private windowStart: number | null = null;
  private windowFrames = 0;
  private fps = 0;
  private frameCount = 0;
  private paused = false;
  private hidden = false;
  private visibilityAttached = false;
  private detachVisibility: (() => void) | null = null;

  constructor(env: VisualRuntimeEnv = {}) {
    this.scheduler = env.scheduler ?? rafScheduler;
    this.isHidden = env.isHidden ?? defaultIsHidden;
    this.onVisibilityChange = env.onVisibilityChange ?? defaultOnVisibilityChange;
  }

  subscribe(id: string, callback: VisualSubscriber): VisualFrameHandle {
    this.attachVisibility();

    const previous = this.subs.get(id);
    if (previous) previous.active = false;

    const record: SubscriberRecord = { id, callback, active: true };
    this.subs.set(id, record);
    this.schedule();

    return {
      id,
      get active() {
        return record.active;
      },
      stop: () => this.remove(record),
    };
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.stopFrame();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.resetTiming();
    this.schedule();
  }

  getQuality(): VisualQualityProfile {
    return VISUAL_QUALITY_PROFILES[this.qualityIndex];
  }

  getStats(): VisualRuntimeStats {
    const quality = this.getQuality();
    return {
      fps: this.fps,
      frameCount: this.frameCount,
      subscribers: this.subs.size,
      quality: quality.tier,
      dprCap: quality.dprCap,
      effectScale: quality.effectScale,
      paused: this.paused,
    };
  }
  /** 仅测试/卸载用；单例 visualRuntime 不应在应用生命周期内 dispose。 */

  dispose(): void {
    for (const record of this.subs.values()) record.active = false;
    this.subs.clear();
    this.stopFrame();
    this.detachVisibility?.();
    this.detachVisibility = null;
    this.visibilityAttached = false;
    this.paused = false;
  }

  private readonly tick = (time: number): void => {
    this.frameHandle = null;
    if (this.paused || this.hidden || this.subs.size === 0) return;
    const delta =
      this.lastTime === null
        ? FALLBACK_DELTA_MS
        : Math.min(MAX_DELTA_MS, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    this.frameCount += 1;
    this.sampleFrame(time);
    // 先快照：订阅者在回调里 subscribe/stop 不应该影响本帧的迭代。
    for (const record of Array.from(this.subs.values())) {
      if (!record.active) continue;
      try {
        record.callback(time, delta);
      } catch (error) {
        // 单个订阅者异常不能拖垮同帧其它视觉；坏订阅直接摘除，避免每帧刷错误。
        console.error("[visualRuntime] subscriber failed", error);
        this.remove(record);
      }
    }
    this.schedule();
  };

  private sampleFrame(time: number): void {
    if (this.windowStart === null) {
      this.windowStart = time;
      this.windowFrames = 1;
      return;
    }
    this.windowFrames += 1;
    const elapsed = time - this.windowStart;
    if (elapsed < FPS_SAMPLE_WINDOW_MS || this.windowFrames < MIN_SAMPLE_FRAMES) return;
    this.fps = (this.windowFrames * 1000) / elapsed;
    this.windowStart = time;
    this.windowFrames = 0;
    this.adaptQuality(this.fps);
  }

  private adaptQuality(fps: number): void {
    const lastIndex = VISUAL_QUALITY_PROFILES.length - 1;
    if (fps < FPS_DOWNGRADE_THRESHOLD) {
      this.stableWindows = 0;
      this.qualityIndex = Math.min(lastIndex, this.qualityIndex + 1);
      return;
    }
    if (fps < FPS_UPGRADE_THRESHOLD) {
      this.stableWindows = 0;
      return;
    }
    // 只有连续多个采样窗口都稳定高于阈值才升档，避免在临界点来回跳。
    this.stableWindows += 1;
    if (this.stableWindows < QUALITY_UPGRADE_STABLE_WINDOWS) return;
    this.stableWindows = 0;
    this.qualityIndex = Math.max(0, this.qualityIndex - 1);
  }

  private attachVisibility(): void {
    if (this.visibilityAttached) return;
    this.visibilityAttached = true;
    this.hidden = this.isHidden();
    this.detachVisibility = this.onVisibilityChange(this.handleVisibility);
  }

  private readonly handleVisibility = (): void => {
    this.hidden = this.isHidden();
    // 后台停留的时长不能进入 delta / FPS 采样；画质档位保留，避免切回时来回抖。
    this.resetTiming();
    if (this.hidden) {
      this.stopFrame();
    } else {
      this.schedule();
    }
  };

  private schedule(): void {
    if (this.frameHandle !== null || this.paused || this.hidden || this.subs.size === 0) return;
    this.frameHandle = this.scheduler.request(this.tick);
  }

  private stopFrame(): void {
    if (this.frameHandle === null) return;
    this.scheduler.cancel(this.frameHandle);
    this.frameHandle = null;
  }

  private remove(record: SubscriberRecord): void {
    if (!record.active) return;
    record.active = false;
    if (this.subs.get(record.id) === record) this.subs.delete(record.id);
    if (this.subs.size === 0) this.stopFrame();
  }

  private resetTiming(): void {
    this.lastTime = null;
    this.windowStart = null;
    this.windowFrames = 0;
    this.fps = 0;
    this.stableWindows = 0;
  }
}

export function createVisualRuntime(env: VisualRuntimeEnv = {}): VisualRuntime {
  return new VisualRuntime(env);
}

/** 全仓共享实例：VisualizationView 等视觉订阅者只通过它排帧。 */
export const visualRuntime = createVisualRuntime();
