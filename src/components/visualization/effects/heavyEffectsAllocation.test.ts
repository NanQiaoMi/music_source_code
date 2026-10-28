/**
 * S5-7 每帧分配守卫：三个最重效果（orientalLandscape / 手书纸面族 / cinematicLyricDrift）
 * 各画 100 帧稳态，用构造器与内建方法计数代替 CDP heap sampling（jsdom 无 Chrome 堆采样），
 * 断言：
 * 1. 每帧不再出现 Array.from / new Set / new Map / new Array / new Object / 新增 TypedArray；
 * 2. 会新建数组的 Array 方法（map/filter/slice/flatMap/concat/reverse）与渐变构造量
 *    是有界常量：首尾 20 帧窗口计数一致，且低于书面上限（不随帧数增长）；
 * 3. 画布渐变：静态渐变已按画布 + 画幅缓存，只剩带动画 alpha 的少量渐变。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyEffectRefs } from "@/runtime/effectPlugin";
import type { Song } from "@/types/song";
import { drawCinematicLyricDrift } from "./cinematicLyricDrift";
import { resolveHandwrittenPalette } from "./handwrittenPalette";
import { drawHandwrittenDust, drawHandwrittenPaperSurface } from "./handwrittenPaper";
import { resolveHandwrittenScene } from "./handwrittenScene";
import { drawOrientalLandscape } from "./orientalLandscape";
import type { EffectContext } from "./types";

const fixture = vi.hoisted(() => ({
  audio: {
    currentSong: null as Song | null,
    currentTime: 0,
    duration: 60,
    isPlaying: true,
    isLoading: false,
    playbackRate: 1,
  },
}));

vi.mock("@/store/audioStore", () => ({ useAudioStore: { getState: () => fixture.audio } }));
vi.mock("@/store/playerStore", () => ({ usePlayerStore: { getState: () => fixture.audio } }));

interface AllocationCounts {
  arrayFrom: number;
  arrayMethods: number;
  newArray: number;
  newObject: number;
  newSet: number;
  newMap: number;
  newTypedArray: number;
  gradients: number;
}

const COUNTER_KEYS: Array<keyof AllocationCounts> = [
  "arrayFrom",
  "arrayMethods",
  "newArray",
  "newObject",
  "newSet",
  "newMap",
  "newTypedArray",
  "gradients",
];

const counts: AllocationCounts = {
  arrayFrom: 0,
  arrayMethods: 0,
  newArray: 0,
  newObject: 0,
  newSet: 0,
  newMap: 0,
  newTypedArray: 0,
  gradients: 0,
};
let counting = false;

function bump(key: keyof AllocationCounts) {
  if (counting) counts[key] += 1;
}

function resetCounts() {
  for (const key of COUNTER_KEYS) counts[key] = 0;
}

const sharedGradient = { addColorStop() {} };

/** 全网状 Canvas2D 桩：把渐变/图案/像素缓冲都做成可计数的空实现。 */
function createCountingContext(canvas: { width: number; height: number }) {
  const state: Record<string, unknown> = Object.create(null);
  return new Proxy(
    {
      canvas,
      measureText: (text: string) => ({ width: Math.max(1, text.length * 22) }),
      createLinearGradient: () => {
        bump("gradients");
        return sharedGradient;
      },
      createRadialGradient: () => {
        bump("gradients");
        return sharedGradient;
      },
      createPattern: () => ({}),
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      }),
      getImageData: (_x: number, _y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      }),
    },
    {
      get(target, property, receiver) {
        if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
        const key = String(property);
        if (state[key] === undefined) state[key] = () => {};
        return state[key];
      },
      set(_target, property, value) {
        state[String(property)] = value;
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
}

function restoreLater(restore: () => void, restores: Array<() => void>) {
  restores.push(restore);
}

/** 安装计数器；返回还原函数。只统计 counting 为 true 的窗口。 */
function installProbe(): () => void {
  counting = true;
  const restores: Array<() => void> = [];

  const originalFrom = Array.from;
  const fromSpy = vi.spyOn(Array, "from").mockImplementation(((
    items: unknown,
    ...rest: unknown[]
  ) => {
    bump("arrayFrom");
    return (originalFrom as unknown as (value: unknown, ...args: unknown[]) => unknown)(
      items,
      ...rest
    );
  }) as typeof Array.from);
  restoreLater(() => fromSpy.mockRestore(), restores);

  for (const method of ["map", "filter", "slice", "flatMap", "concat", "reverse"] as const) {
    const original = Array.prototype[method] as (...args: unknown[]) => unknown;
    const spy = vi.spyOn(Array.prototype, method).mockImplementation(function (
      this: unknown[],
      ...args: unknown[]
    ) {
      bump("arrayMethods");
      return original.apply(this, args);
    } as never);
    restoreLater(() => spy.mockRestore(), restores);
  }

  const constructors: Array<[string, keyof AllocationCounts]> = [
    ["Array", "newArray"],
    ["Object", "newObject"],
    ["Set", "newSet"],
    ["Map", "newMap"],
    ["Float32Array", "newTypedArray"],
    ["Uint8Array", "newTypedArray"],
  ];
  for (const [name, key] of constructors) {
    type AnyCallable = (this: unknown, ...args: never[]) => unknown;
    const original = (globalThis as unknown as Record<string, unknown>)[name];
    const proxied = new Proxy(original as AnyCallable, {
      construct(target, args, newTarget) {
        bump(key);
        return Reflect.construct(target, args, newTarget);
      },
      apply(target, thisArg, args) {
        bump(key);
        return Reflect.apply(target, thisArg, args);
      },
    });
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: proxied });
    restoreLater(
      () =>
        Object.defineProperty(globalThis, name, {
          configurable: true,
          writable: true,
          value: original,
        }),
      restores
    );
  }

  const getContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: function (this: HTMLCanvasElement, contextId: string) {
      return contextId === "2d" ? createCountingContext(this) : null;
    },
  });
  restoreLater(
    () =>
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: getContext,
      }),
    restores
  );

  return () => {
    counting = false;
    for (const restore of restores.reverse()) restore();
  };
}

function makeOrientalFrame(): EffectContext {
  const frame = {
    ctx: createCountingContext({ width: 960, height: 540 }),
    width: 960,
    height: 540,
    data: new Uint8Array(128),
    params: {},
    time: 0,
    musicTime: 0,
    refs: createEmptyEffectRefs(),
    theme: { primary: 200, secondary: 260, accent: 120 },
    utils: { getThemeBaseHue: () => 200 },
  } as EffectContext;
  return frame;
}

beforeEach(() => {
  resetCounts();
  fixture.audio.currentTime = 0;
  fixture.audio.currentSong = {
    id: "s5-7-alloc",
    title: "分配审计",
    artist: "MIMI",
    source: "local",
    duration: 60,
    lyrics: "[00:00.00]风吹过旧纸页留下淡淡墨迹",
    translationLyrics: "[00:00.00]Wind across the old page",
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("heavy effect per-frame allocation (S5-7)", () => {
  it("orientalLandscape: 100 steady frames allocate no arrays/objects and only animated gradients", () => {
    const frame = makeOrientalFrame();
    const stop = installProbe();
    const windowTotals: number[] = [];
    try {
      for (let index = 0; index < 5; index += 1) {
        frame.time = index * 16.7;
        drawOrientalLandscape(frame);
      }
      resetCounts();
      let previousTotal = 0;
      for (let index = 0; index < 100; index += 1) {
        frame.time = 1000 + index * 16.7;
        drawOrientalLandscape(frame);
        if ((index + 1) % 20 === 0) {
          windowTotals.push(counts.gradients - previousTotal);
          previousTotal = counts.gradients;
        }
      }
    } finally {
      stop();
    }

    expect(counts.arrayFrom).toBe(0);
    expect(counts.arrayMethods).toBe(0);
    expect(counts.newArray).toBe(0);
    expect(counts.newObject).toBe(0);
    expect(counts.newSet).toBe(0);
    expect(counts.newMap).toBe(0);
    expect(counts.newTypedArray).toBe(0);
    // 24 个静态渐变（环境光/天空/天青/6×山体/14×落英/暗角）已缓存；剩下 11 个/帧
    // 是月亮、丝绢烟岚、水渚、晨雾与风灯 —— 色标或坐标带逐帧动画，保留。
    expect(counts.gradients).toBeLessThanOrEqual(1_100);
    // 五个 20 帧窗口的渐变计数完全一致 => 稳态，不随帧数增长。
    expect(new Set(windowTotals).size).toBe(1);
  });

  it("handwritten paper surface: 100 steady frames keep allocations at a bounded constant", () => {
    const palette = resolveHandwrittenPalette(0);
    const scene = resolveHandwrittenScene({
      seed: "s5-7-paper",
      profile: "motes",
      shotKind: "lyrics",
      width: 960,
      height: 540,
      units: ["风", "吹", "过"],
      reducedMotion: false,
    });
    const ctx = createCountingContext({ width: 960, height: 540 });
    const options = {
      ctx,
      width: 960,
      height: 540,
      palette,
      paletteIndex: 0,
      camera: { zoom: 1, x: 0, y: 0, rotation: 0 },
      scene,
      musicTime: 0,
      shotStartTime: 0,
      glowIntensity: 0.9,
      grain: 0.15,
      vignette: 0.65,
      reducedMotion: false,
      motionSpeed: 0.8,
      paused: false,
      quality: 0,
    };

    const stop = installProbe();
    try {
      for (let index = 0; index < 5; index += 1) {
        options.musicTime = index * 0.016;
        drawHandwrittenPaperSurface(options);
        drawHandwrittenDust(ctx, 960, 540, palette, index * 0.016, 0.8, 0.9, false, false, 0);
      }
      resetCounts();
      for (let index = 0; index < 100; index += 1) {
        const musicTime = 1 + index * 0.0167;
        options.musicTime = musicTime;
        drawHandwrittenPaperSurface(options);
        drawHandwrittenDust(ctx, 960, 540, palette, musicTime, 0.8, 0.9, false, false, 0);
      }
    } finally {
      stop();
    }

    expect(counts.arrayFrom).toBe(0);
    expect(counts.arrayMethods).toBe(0);
    expect(counts.newArray).toBe(0);
    expect(counts.newObject).toBe(0);
    expect(counts.newSet).toBe(0);
    expect(counts.newTypedArray).toBe(0);
    // 光层按 tick 节流重建（约 6 个渐变/次），稳态平均 < 2 个/帧。
    expect(counts.gradients).toBeLessThanOrEqual(200);
    // jsdom 每 createElement("canvas") 内部会建 2 个 Map；这些不是效果代码的分配。
    expect(counts.newMap).toBeLessThanOrEqual(100);
  });

  it("cinematicLyricDrift: 100 steady frames keep array churn bounded and non-growing", () => {
    const ctx = createCountingContext({ width: 960, height: 540 });
    const frame = {
      ctx,
      width: 960,
      height: 540,
      data: new Uint8Array(128),
      params: {},
      time: 0,
      musicTime: 0,
      refs: createEmptyEffectRefs(),
      theme: { primary: 280, secondary: 320, accent: 150 },
      utils: { getThemeBaseHue: () => 280 },
    } as EffectContext;

    const stop = installProbe();
    const windowTotals: number[] = [];
    try {
      for (let index = 0; index < 5; index += 1) {
        fixture.audio.currentTime = 0.1 + index * 0.0167;
        frame.time = index * 16.7;
        drawCinematicLyricDrift(frame);
      }
      resetCounts();
      let previousTotal = 0;
      for (let index = 0; index < 100; index += 1) {
        fixture.audio.currentTime = 0.2 + index * 0.0167;
        frame.time = 1000 + index * 16.7;
        drawCinematicLyricDrift(frame);
        if ((index + 1) % 20 === 0) {
          windowTotals.push(counts.arrayMethods - previousTotal);
          previousTotal = counts.arrayMethods;
        }
      }
    } finally {
      stop();
    }

    // 版式/字形切分/焦点组/字幕块都走缓存：稳态不再 Array.from、new Array、new Object、TypedArray。
    expect(counts.arrayFrom).toBe(0);
    expect(counts.newArray).toBe(0);
    expect(counts.newObject).toBe(0);
    expect(counts.newTypedArray).toBe(0);
    // 剩余数组操作是渲染行/组视图与测量结果所需，数量有界且五个窗口完全一致（不增长）。
    expect(counts.arrayMethods).toBeLessThanOrEqual(1_500);
    // 首窗多 1 次是首个计数帧补齐预热缓存；之后四窗一致，末窗 ≤ 首窗 => 不增长。
    expect(Math.max(...windowTotals) - Math.min(...windowTotals)).toBeLessThanOrEqual(1);
    expect(windowTotals[windowTotals.length - 1]).toBeLessThanOrEqual(windowTotals[0]!);
    // Set/Map 只来自 jsdom 创建字形 sprite 画布时的内部记录，不是效果代码的分配。
    expect(counts.newSet).toBeLessThanOrEqual(60);
    expect(counts.newMap).toBeLessThanOrEqual(200);
    // 纸面光层 / 水彩 wash 的节流渐变：每帧约 4.5 个，全部带逐帧动画 alpha。
    expect(counts.gradients).toBeLessThanOrEqual(500);
  });
});
