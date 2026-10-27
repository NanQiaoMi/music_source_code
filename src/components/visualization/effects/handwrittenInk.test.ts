import { afterEach, describe, expect, it, vi } from "vitest";
import { drawHandwrittenInkLine, resolveWritingProgress } from "./handwrittenInk";
import { resolveHandwrittenPalette } from "./handwrittenPalette";

function createCanvasHarness() {
  const canvases: HTMLCanvasElement[] = [];
  const sources: unknown[] = [];
  const scales: Array<[number, number]> = [];
  const documentStub = {
    createElement: vi.fn(() => {
      const canvas = { width: 0, height: 0 } as unknown as HTMLCanvasElement;
      canvases.push(canvas);
      const state = new Map<PropertyKey, unknown>();
      const context = new Proxy(
        {
          canvas,
          measureText(text: string) {
            const font = String(state.get("font") ?? "500 16px serif");
            const fontSize = Number.parseFloat(font.match(/\s([\d.]+)px/)?.[1] ?? "16");
            return { width: text.length * fontSize * 0.61 };
          },
          createRadialGradient: () => ({ addColorStop: vi.fn() }),
        },
        {
          get(target, property, receiver) {
            if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
            if (!state.has(property)) state.set(property, vi.fn());
            return state.get(property);
          },
          set(_target, property, value) {
            state.set(property, value);
            return true;
          },
        }
      ) as unknown as CanvasRenderingContext2D;
      return {
        ...canvas,
        getContext: vi.fn(() => context),
      } as unknown as HTMLCanvasElement;
    }),
  };
  vi.stubGlobal("document", documentStub);

  const rootState = new Map<PropertyKey, unknown>();
  const rootContext = new Proxy(
    {
      canvas: { width: 1280, height: 720 },
      drawImage: (source: unknown) => sources.push(source),
      scale: (x: number, y: number) => scales.push([x, y]),
    },
    {
      get(target, property, receiver) {
        if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
        if (!rootState.has(property)) rootState.set(property, vi.fn());
        return rootState.get(property);
      },
      set(_target, property, value) {
        rootState.set(property, value);
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;

  const drawGlyph = (text: string, fontSize: number, scaleBoost?: number) => {
    drawHandwrittenInkLine(
      [
        {
          text,
          x: 40,
          y: 60,
          width: 32,
          fontSize,
          start: 0,
          end: 1,
          seed: `${text}-${fontSize}`,
          reveal: 1,
          ...(scaleBoost === undefined ? {} : { scaleBoost }),
        },
      ],
      {
        ctx: rootContext,
        palette: resolveHandwrittenPalette(0),
        fontFamily: "serif",
        musicTime: 1,
        mode: "past",
        alpha: 1,
        tilt: 0,
        centerX: 0,
        centerY: 0,
        glow: 0,
        reducedMotion: true,
        emphasis: null,
      }
    );
  };

  return { canvases, sources, scales, drawGlyph, documentStub };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handwrittenInk.resolveWritingProgress", () => {
  it("开始前是 0，写完后是 1", () => {
    expect(resolveWritingProgress(10, 11, 9.99)).toBe(0);
    expect(resolveWritingProgress(10, 11, 11)).toBe(1);
    expect(resolveWritingProgress(10, 11, 20)).toBe(1);
  });

  it("在书写区间内单调递增", () => {
    const samples = [10, 10.25, 10.5, 10.75, 11].map((time) =>
      resolveWritingProgress(10, 11, time)
    );
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]!).toBeGreaterThanOrEqual(samples[index - 1]!);
    }
    expect(samples[2]!).toBeGreaterThan(0);
    expect(samples[2]!).toBeLessThan(1);
  });

  it("零时长单元只在结束后算写完", () => {
    expect(resolveWritingProgress(10, 10, 9.9)).toBe(0);
    expect(resolveWritingProgress(10, 10, 10)).toBe(1);
  });

  it("非法时间不抛错并退回 0", () => {
    expect(resolveWritingProgress(Number.NaN, 10, 10)).toBe(0);
    expect(resolveWritingProgress(10, Number.NaN, 10)).toBe(0);
    expect(resolveWritingProgress(10, 11, Number.NaN)).toBe(0);
  });
});

describe("handwrittenInk glyph sprite cache", () => {
  it("同一精确输入复用同一字形画布", () => {
    const harness = createCanvasHarness();
    harness.drawGlyph("sprite-cache-repeat", 40);
    harness.drawGlyph("sprite-cache-repeat", 40);

    expect(harness.documentStub.createElement).toHaveBeenCalledTimes(2);
    expect(harness.sources).toHaveLength(2);
    expect(harness.sources[1]).toBe(harness.sources[0]);
  });

  it("相近但不同的实际字号不会共享烘焙字形", () => {
    const harness = createCanvasHarness();
    harness.drawGlyph("sprite-cache-font-size", 40);
    harness.drawGlyph("sprite-cache-font-size", 40.1);

    expect(harness.sources).toHaveLength(2);
    expect(harness.sources[1]).not.toBe(harness.sources[0]);
  });

  it("保留布局传入的小于 1 的 scaleBoost 缩小变换", () => {
    const normal = createCanvasHarness();
    const compact = createCanvasHarness();
    normal.drawGlyph("scale-contract", 40);
    compact.drawGlyph("scale-contract", 40, 0.42);

    expect(normal.scales).toHaveLength(1);
    expect(compact.scales).toHaveLength(1);
    expect(compact.scales[0]![0]).toBeCloseTo(normal.scales[0]![0] * 0.42);
    expect(compact.scales[0]![1]).toBeCloseTo(normal.scales[0]![1] * 0.42);
  });

  it("非法字号不创建离屏字形画布", () => {
    const harness = createCanvasHarness();
    harness.drawGlyph("sprite-cache-invalid-size", Number.NaN);

    expect(harness.documentStub.createElement).not.toHaveBeenCalled();
    expect(harness.sources).toHaveLength(0);
  });
});

describe("handwrittenInk emphasis bounds", () => {
  it("centers the mark over first and last scaleBoost reserved cells", () => {
    createCanvasHarness();
    const translations: Array<[number, number]> = [];
    const rootState = new Map<PropertyKey, unknown>();
    const ctx = new Proxy(
      { canvas: { width: 1280, height: 720 } },
      {
        get(target, property, receiver) {
          if (property === "translate") {
            return (x: number, y: number) => translations.push([x, y]);
          }
          if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
          if (!rootState.has(property)) rootState.set(property, vi.fn());
          return rootState.get(property);
        },
        set(_target, property, value) {
          rootState.set(property, value);
          return true;
        },
      }
    ) as unknown as CanvasRenderingContext2D;

    drawHandwrittenInkLine(
      [
        {
          text: "a",
          x: 105,
          y: 50,
          width: 20,
          fontSize: 30,
          start: 0,
          end: 1,
          seed: "emphasis-first",
          reveal: 1,
          scaleBoost: 1.5,
        },
        {
          text: "b",
          x: 140,
          y: 50,
          width: 20,
          fontSize: 30,
          start: 0,
          end: 1,
          seed: "emphasis-last",
          reveal: 1,
          scaleBoost: 2,
        },
      ],
      {
        ctx,
        palette: resolveHandwrittenPalette(0),
        fontFamily: "serif",
        musicTime: 2,
        mode: "past",
        alpha: 1,
        tilt: 0,
        centerX: 0,
        centerY: 0,
        glow: 0,
        reducedMotion: true,
        emphasis: { unitIndex: 0, unitCount: 2, style: "highlight" },
      }
    );

    expect(translations).toContainEqual([135, 50]);
  });
});
