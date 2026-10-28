"use client";

import { rafScheduler, type RafScheduler } from "@/lib/perf/rafScheduler";

/**
 * 视觉帧与画质的唯一权威（S5-1）：所有订阅者共享一条 rafScheduler 循环。
 * 每帧下发 time/delta，按 1 秒窗口采样 FPS 自适应 DPR 与效果密度；隐藏时停表，
 * 恢复后重置计时。显式 pause/resume 不重建订阅。
 *
 * S5-2 起同时记录每次订阅者回调的绘制耗时（最近 120 次），getStats() 给出
 * drawP50Ms/drawP95Ms，作为"迁移前后 draw p95 劣化 ≤10%"的测量口径。
 *
 * S5-6 起 qualityTier 是唯一画质权威：FPS 窗口之外的 >50ms 长任务立即降一档
 * （冷却期内不重复降档），任何档位变化都通过 onQualityChange 通知消费者。
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
/** 长任务阈值：主线程阻塞超过该值时降档。 */
export const LONG_TASK_THRESHOLD_MS = 50;
/** 长任务降档冷却：避免同一次卡顿里连降多档。 */
export const LONG_TASK_COOLDOWN_MS = 1000;

const FALLBACK_DELTA_MS = 1000 / 60;
const MAX_DELTA_MS = 50;
const MIN_SAMPLE_FRAMES = 10;
/** 绘制耗时采样窗口：最近 120 次订阅者回调，约 2s@60fps。 */
const DRAW_SAMPLE_CAPACITY = 120;

export type VisualSubscriber = (time: number, delta: number) => void;

/** 档位变化通知：previous 为变化前的 tier。 */
export type VisualQualityListener = (next: VisualQualityProfile, previous: VisualQuality) => void;

export type LongTaskEntry = { duration: number };

export interface LongTaskObserver {
  observe(options: { entryTypes: string[] }): void;
  disconnect(): void;
}

export type LongTaskObserverFactory = (
  onEntries: (entries: readonly LongTaskEntry[]) => void
) => LongTaskObserver | null;

/** 默认工厂：SSR/不支持 longtask 的环境返回 null，构造与 observe 异常由 attach 兜底。 */
const createBrowserLongTaskObserver: LongTaskObserverFactory = (onEntries) => {
  if (typeof PerformanceObserver === "undefined") return null;
  return new PerformanceObserver((list) => onEntries(list.getEntries()));
};

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
  /** 采样窗口内的绘制回调次数（≤120）。 */
  drawSamples: number;
  /** 绘制耗时分位（毫秒），仅统计订阅者回调本体，不含排帧开销。 */
  drawP50Ms: number;
  drawP95Ms: number;
}

export interface VisualRuntimeEnv {
  scheduler?: RafScheduler;
  isHidden?: () => boolean;
  onVisibilityChange?: (listener: () => void) => () => void;
  /** 绘制耗时采样时钟；测试注入虚拟时钟用。 */
  now?: () => number;
  /** 初始档位变化监听（等价于构造后调用 onQualityChange）。 */
  onQualityChange?: VisualQualityListener;
  /** longtask 观察者工厂；测试注入假 observer，缺省使用浏览器 PerformanceObserver。 */
  createLongTaskObserver?: LongTaskObserverFactory;
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
  private readonly now: () => number;
  private readonly createLongTaskObserver: LongTaskObserverFactory;
  private readonly subs = new Map<string, SubscriberRecord>();
  private readonly qualityListeners = new Set<VisualQualityListener>();
  /** 定长环形缓冲：避免每帧为统计分配数组。 */
  private readonly drawDurations = new Float64Array(DRAW_SAMPLE_CAPACITY);
  private drawCursor = 0;
  private drawCount = 0;
  private lastLongTaskAt: number | null = null;
  private longTaskObserver: LongTaskObserver | null = null;
  private longTaskObserverUnavailable = false;
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
    this.now = env.now ?? (() => performance.now());
    this.createLongTaskObserver = env.createLongTaskObserver ?? createBrowserLongTaskObserver;
    if (env.onQualityChange) this.qualityListeners.add(env.onQualityChange);
  }

  subscribe(id: string, callback: VisualSubscriber): VisualFrameHandle {
    this.attachVisibility();

    const previous = this.subs.get(id);
    if (previous) previous.active = false;

    const record: SubscriberRecord = { id, callback, active: true };
    this.subs.set(id, record);
    this.schedule();
    this.attachLongTaskObserver();

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

  /** 当前档位快捷读取（等价 getQuality().tier）。 */
  get qualityTier(): VisualQuality {
    return VISUAL_QUALITY_PROFILES[this.qualityIndex].tier;
  }

  /** 订阅档位变化；返回解除订阅函数。 */
  onQualityChange(listener: VisualQualityListener): () => void {
    this.qualityListeners.add(listener);
    return () => {
      this.qualityListeners.delete(listener);
    };
  }

  /**
   * 汇报一次长任务（主线程阻塞时长）。
   * >50ms 立即降一档；冷却期内的后续长任务不叠加；已到 low 时保持 low。
   * 浏览器侧由 PerformanceObserver("longtask") 调用（S5-6b 布线）。
   */
  recordLongTask(durationMs: number): void {
    if (durationMs <= LONG_TASK_THRESHOLD_MS) return;
    const now = this.now();
    if (this.lastLongTaskAt !== null && now - this.lastLongTaskAt < LONG_TASK_COOLDOWN_MS) return;
    this.lastLongTaskAt = now;
    this.stableWindows = 0;
    this.setQualityIndex(this.qualityIndex + 1);
  }

  /** 首个订阅者启动时挂接 longtask，全生命周期只保留一个 observer。 */
  private attachLongTaskObserver(): void {
    if (this.longTaskObserver || this.longTaskObserverUnavailable) return;
    try {
      const observer = this.createLongTaskObserver((entries) => {
        for (const entry of entries) this.recordLongTask(entry.duration);
      });
      if (!observer) return;
      this.longTaskObserver = observer;
      observer.observe({ entryTypes: ["longtask"] });
    } catch (error) {
      this.detachLongTaskObserver();
      this.longTaskObserverUnavailable = true;
      console.warn("[visualRuntime] longtask observer unavailable", error);
    }
  }

  private detachLongTaskObserver(): void {
    if (!this.longTaskObserver) return;
    try {
      this.longTaskObserver.disconnect();
    } catch {
      // 卸载路径上的 disconnect 失败不应冒泡
    }
    this.longTaskObserver = null;
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
      drawSamples: this.drawCount,
      drawP50Ms: this.drawPercentile(50),
      drawP95Ms: this.drawPercentile(95),
    };
  }
  /** 仅测试/卸载用；单例 visualRuntime 不应在应用生命周期内 dispose。 */
  dispose(): void {
    for (const record of this.subs.values()) record.active = false;
    this.subs.clear();
    this.stopFrame();
    this.detachLongTaskObserver();
    this.longTaskObserverUnavailable = false;
    this.detachVisibility?.();
    this.detachVisibility = null;
    this.visibilityAttached = false;
    this.paused = false;
    this.drawCursor = 0;
    this.drawCount = 0;
    this.lastLongTaskAt = null;
    this.qualityListeners.clear();
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
      const startedAt = this.now();
      try {
        record.callback(time, delta);
      } catch (error) {
        // 单个订阅者异常不能拖垮同帧其它视觉；坏订阅直接摘除，避免每帧刷错误。
        console.error("[visualRuntime] subscriber failed", error);
        this.remove(record);
      }
      // 绘制耗时只统计回调本体：排帧/统计开销不进 p50/p95，与旧循环口径可比。
      this.sampleDraw(this.now() - startedAt);
    }
    this.schedule();
  };

  private sampleDraw(durationMs: number): void {
    this.drawDurations[this.drawCursor] = Math.max(0, durationMs);
    this.drawCursor = (this.drawCursor + 1) % DRAW_SAMPLE_CAPACITY;
    this.drawCount = Math.min(this.drawCount + 1, DRAW_SAMPLE_CAPACITY);
  }

  /** 最近秩分位（nearest-rank）：只在取统计时排序，热路径零分配。 */
  private drawPercentile(percentile: number): number {
    if (this.drawCount === 0) return 0;
    const sorted = Array.from(this.drawDurations.subarray(0, this.drawCount)).sort((a, b) => a - b);
    const rank = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
  }

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
    if (fps < FPS_DOWNGRADE_THRESHOLD) {
      this.stableWindows = 0;
      this.setQualityIndex(this.qualityIndex + 1);
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
    this.setQualityIndex(this.qualityIndex - 1);
  }

  /** 档位唯一写入口：夹取范围，变化时通知监听者（单个监听者异常不影响其它监听者）。 */
  private setQualityIndex(nextIndex: number): void {
    const clamped = Math.max(0, Math.min(VISUAL_QUALITY_PROFILES.length - 1, nextIndex));
    if (clamped === this.qualityIndex) return;
    const previous = VISUAL_QUALITY_PROFILES[this.qualityIndex].tier;
    const next = VISUAL_QUALITY_PROFILES[clamped];
    this.qualityIndex = clamped;
    for (const listener of Array.from(this.qualityListeners)) {
      try {
        listener(next, previous);
      } catch (error) {
        console.error("[visualRuntime] quality listener failed", error);
        this.qualityListeners.delete(listener);
      }
    }
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
    if (this.subs.size === 0) {
      this.stopFrame();
      this.detachLongTaskObserver();
    }
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
