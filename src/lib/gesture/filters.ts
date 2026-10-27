/**
 * One Euro 滤波器（自适应低通）。
 *
 * 手势关键点抖动大、采样间隔不稳定，固定平滑系数无法同时兼顾「静止稳定」与「快速跟手」：
 * - 静止时期望截止频率低，抑制抖动；
 * - 快速移动时期望截止频率高，降低延迟。
 *
 * One Euro 用速度修正截止频率：cutoff = minCutoff + beta * |dx|。
 * 本实现不依赖 DOM / React / Zustand，时间戳单位为毫秒，方便测试注入任意时间序列。
 */

export interface OneEuroFilterOptions {
  /** 静止截止频率（Hz），越低越平滑、延迟越高。 */
  minCutoff?: number;
  /** 速度系数，越大跟随快速移动越紧。 */
  beta?: number;
  /** 导数低通截止频率（Hz）。 */
  derivativeCutoff?: number;
  /** 未提供可用时间戳时使用的默认采样率（Hz）。 */
  frequency?: number;
}

const DEFAULT_MIN_CUTOFF_HZ = 1.4;
const DEFAULT_BETA = 0.02;
const DEFAULT_DERIVATIVE_CUTOFF_HZ = 1;
const DEFAULT_FREQUENCY_HZ = 60;
const MIN_CUTOFF_HZ = 0.001;
const MIN_DELTA_SECONDS = 1 / 1000;
const MAX_DELTA_SECONDS = 1 / 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 正数兜底：非法值 / 非正数回退到默认值。 */
function positiveOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** 非负数兜底（beta 允许为 0，表示退化为普通低通）。 */
function nonNegativeOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** 一阶低通系数：alpha = dt / (dt + tau)，tau = 1 / (2π * cutoff)。 */
function smoothingFactor(cutoffHz: number, deltaSeconds: number): number {
  const cutoff = Math.max(MIN_CUTOFF_HZ, cutoffHz);
  const tau = 1 / (2 * Math.PI * cutoff);
  return deltaSeconds / (deltaSeconds + tau);
}

function lowPass(value: number, previous: number, cutoffHz: number, deltaSeconds: number): number {
  const alpha = smoothingFactor(cutoffHz, deltaSeconds);
  return previous + alpha * (value - previous);
}

/**
 * 单通道 One Euro 滤波器。
 *
 * 用法：const filter = new OneEuroFilter({ minCutoff: 1.4, beta: 0.02 });
 * const smooth = filter.filter(landmark.x, timestampMs); filter.reset();
 * 手丢失 / 切换跟踪目标时 reset 清空历史，下一次采样直接透传。
 */
export class OneEuroFilter {
  private readonly minCutoffHz: number;
  private readonly beta: number;
  private readonly derivativeCutoffHz: number;
  private readonly fallbackDeltaSeconds: number;

  private lastTimestamp: number | null = null;
  private lastRawValue = 0;
  private lastFilteredValue = 0;
  private lastFilteredDerivative = 0;
  private initialized = false;

  constructor(options: OneEuroFilterOptions = {}) {
    this.minCutoffHz = positiveOr(options.minCutoff, DEFAULT_MIN_CUTOFF_HZ);
    this.beta = nonNegativeOr(options.beta, DEFAULT_BETA);
    this.derivativeCutoffHz = positiveOr(options.derivativeCutoff, DEFAULT_DERIVATIVE_CUTOFF_HZ);
    this.fallbackDeltaSeconds = clamp(
      1 / positiveOr(options.frequency, DEFAULT_FREQUENCY_HZ),
      MIN_DELTA_SECONDS,
      MAX_DELTA_SECONDS
    );
  }

  /** 最近一次滤波输出，便于调试 / HUD 展示。 */
  get value(): number {
    return this.lastFilteredValue;
  }

  /**
   * 输入一个采样值，返回滤波结果。
   * @param value 原始值；NaN / Infinity 会被忽略，沿用上一次的原始值。
   * @param timestamp 毫秒时间戳；乱序 / 重复 / 非法时回退到默认采样间隔。
   */
  filter(value: number, timestamp?: number): number {
    const deltaSeconds = this.resolveDeltaSeconds(timestamp);
    const rawValue = Number.isFinite(value) ? value : this.lastRawValue;

    if (!this.initialized) {
      this.initialized = true;
      this.lastRawValue = rawValue;
      this.lastFilteredValue = rawValue;
      this.lastFilteredDerivative = 0;
      return rawValue;
    }

    const derivative = (rawValue - this.lastRawValue) / deltaSeconds;
    this.lastFilteredDerivative = lowPass(
      derivative,
      this.lastFilteredDerivative,
      this.derivativeCutoffHz,
      deltaSeconds
    );

    const cutoff = this.minCutoffHz + this.beta * Math.abs(this.lastFilteredDerivative);
    const filtered = lowPass(rawValue, this.lastFilteredValue, cutoff, deltaSeconds);

    this.lastRawValue = rawValue;
    this.lastFilteredValue = filtered;
    return filtered;
  }

  /** 清空历史，下一次 filter 直接透传（跟踪目标切换 / 手丢失时使用）。 */
  reset(): void {
    this.lastTimestamp = null;
    this.lastRawValue = 0;
    this.lastFilteredValue = 0;
    this.lastFilteredDerivative = 0;
    this.initialized = false;
  }

  private resolveDeltaSeconds(timestamp?: number): number {
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
      return this.fallbackDeltaSeconds;
    }
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      return this.fallbackDeltaSeconds;
    }
    if (timestamp <= this.lastTimestamp) {
      // 重复或乱序时间戳不推进历史，避免负的采样间隔。
      return this.fallbackDeltaSeconds;
    }
    const deltaSeconds = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    return clamp(deltaSeconds, MIN_DELTA_SECONDS, MAX_DELTA_SECONDS);
  }
}

/** 可复用工厂：识别循环里通常每个坐标轴 / 每个关键点各持一个实例。 */
export function createOneEuroFilter(options: OneEuroFilterOptions = {}): OneEuroFilter {
  return new OneEuroFilter(options);
}
