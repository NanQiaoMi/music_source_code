import type { EffectContext } from "@/components/visualization/effects/types";
import type { VisualizationEffect } from "@/store/visualizationStore";
import type { VisualQualityProfile } from "./visualRuntime";

/**
 * S5-4：V7 效果插件契约（与 S4-7a 同源；D1=C 的 V8 生命周期语义移植）。
 * 生命周期：init(size) → resize(w,h,dpr)* → draw(frame)* → dispose()。registry 缓存实例，
 * 所以 dispose() 之后必须还能 init() 重新初始化（自持状态在 init 里重置）。
 * 资源归属：离屏画布/大数组/平滑值由插件自持，不再读写 VisualizationView 的共享 refs；
 * 效果实现不得缓存 frame 引用做跨帧比较（frame 每帧构造，S5-5 再收敛稳定引用）。
 */
export interface EffectInitContext {
  /** CSS 像素宽；画布后备存储为 width * dpr。 */
  width: number;
  height: number;
  dpr: number;
}

export interface EffectBudget {
  maxParticles?: number;
  maxTextLayers?: number;
}

/** 一帧绘制输入：V7 既有 EffectContext + 渲染循环元数据，效果实现可直接当 EffectContext 用。 */
export interface EffectFrame extends EffectContext {
  /** 承载绘制的画布；后备存储已按 dpr 放大。 */
  canvas: HTMLCanvasElement;
  /** 设备像素比；ctx 已 setTransform(dpr)，效果按 CSS 像素坐标绘制。 */
  dpr: number;
  /** 当前画质档位（S5-6 是唯一权威）。 */
  quality: VisualQualityProfile;
  /** 距上一帧的毫秒数（首帧按 16.67 兜底，钳制 ≤50）。 */
  dt: number;
}

export interface EffectPlugin {
  readonly id: VisualizationEffect;
  readonly budget?: EffectBudget;
  init(size: EffectInitContext): void;
  resize(width: number, height: number, dpr: number): void;
  draw(frame: EffectFrame): void;
  dispose(): void;
}

const EMPTY_SPECTRUM = new Uint8Array(0);

/** 插件自有 refs 的空白骨架：插件只替换自己用到的槽位，其余保持空实现（不读共享 refs）。 */
export function createEmptyEffectRefs(): EffectContext["refs"] {
  return {
    particles: { current: [] },
    nebulaStars: { current: [] },
    spectrumStars: { current: [] },
    matrixDrops: { current: [] },
    smoothBass: { current: 0 },
    smoothMid: { current: 0 },
    smoothTreble: { current: 0 },
    bokeh: { current: [] },
    shockwaves: { current: [] },
  };
}

/** 插件侧可复用的 EffectContext 外壳：每帧只改字段，旧效果解构后立即使用，可安全复用。 */
export function createPluginEffectContext(refs: EffectContext["refs"]): EffectContext {
  return {
    ctx: null as unknown as CanvasRenderingContext2D,
    width: 0,
    height: 0,
    data: EMPTY_SPECTRUM,
    params: {},
    time: 0,
    musicTime: 0,
    refs,
    theme: { primary: 0, secondary: 0, accent: 0 },
    utils: { getThemeBaseHue: () => 0 },
  };
}

/** 把当前帧输入拷进插件外壳；refs 保持插件自持对象不变。 */
export function applyEffectFrame(target: EffectContext, frame: EffectFrame): void {
  target.ctx = frame.ctx;
  target.width = frame.width;
  target.height = frame.height;
  target.data = frame.data;
  target.params = frame.params;
  target.time = frame.time;
  target.musicTime = frame.musicTime;
  target.theme = frame.theme;
  target.utils = frame.utils;
}
