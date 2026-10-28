import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveHandwrittenPalette } from "./handwrittenPalette";

function installCanvasDocument(grainFrames: string[]) {
  const documentStub = {
    createElement: vi.fn(() => {
      const canvas = { width: 0, height: 0 };
      const state = new Map<PropertyKey, unknown>();
      const context = new Proxy(
        {
          canvas,
          createLinearGradient: () => ({ addColorStop: vi.fn() }),
          createRadialGradient: () => ({ addColorStop: vi.fn() }),
          createImageData: (width: number, height: number) => ({
            data: new Uint8ClampedArray(width * height * 4),
          }),
          putImageData: (image: { data: Uint8ClampedArray }) => {
            if (canvas.width === 192 && canvas.height === 192) {
              let checksum = 2166136261;
              for (const value of image.data) checksum = Math.imul(checksum ^ value, 16777619);
              grainFrames.push(`${checksum >>> 0}:${image.data.length}`);
            }
          },
          createPattern: () => ({}),
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
      Object.assign(canvas, { getContext: vi.fn(() => context) });
      return canvas as unknown as HTMLCanvasElement;
    }),
  };
  vi.stubGlobal("document", documentStub);
  return documentStub;
}

function createRootContext(drawnCanvases: HTMLCanvasElement[] = [], width = 320, height = 180) {
  const state = new Map<PropertyKey, unknown>();
  const canvas = { width, height };
  return new Proxy(
    {
      canvas,
      drawImage: (image: CanvasImageSource) => drawnCanvases.push(image as HTMLCanvasElement),
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
}

async function captureGrainFrames(randomValue: number): Promise<string[]> {
  vi.resetModules();
  const frames: string[] = [];
  installCanvasDocument(frames);
  vi.spyOn(Math, "random").mockReturnValue(randomValue);
  const { drawHandwrittenPaperSurface } = await import("./handwrittenPaper");
  const palette = resolveHandwrittenPalette(0);

  drawHandwrittenPaperSurface({
    ctx: createRootContext(),
    width: 320,
    height: 180,
    palette,
    paletteIndex: 0,
    camera: { x: 0, y: 0, zoom: 1, rotation: 0 },
    scene: { paperRotation: 0, lightX: 0.4, lightY: 0.3 } as never,
    musicTime: 0.5,
    shotStartTime: 0,
    glowIntensity: 0,
    grain: 0.4,
    vignette: 0,
    reducedMotion: true,
    motionSpeed: 1,
    paused: true,
  });

  return frames;
}

async function captureLargePaperPass(paletteIndex: number) {
  const width = 3840;
  const height = 2160;
  const drawnCanvases: HTMLCanvasElement[] = [];
  const { drawHandwrittenPaperSurface } = await import("./handwrittenPaper");

  drawHandwrittenPaperSurface({
    ctx: createRootContext(drawnCanvases, width * 3, height * 3),
    width,
    height,
    palette: resolveHandwrittenPalette(0),
    paletteIndex,
    camera: { x: 0, y: 0, zoom: 1, rotation: 0 },
    scene: { paperRotation: 0, lightX: 0.4, lightY: 0.3 } as never,
    musicTime: 0.5,
    shotStartTime: 0,
    glowIntensity: 0,
    grain: 0,
    vignette: 0.6,
    reducedMotion: true,
    motionSpeed: 1,
    paused: true,
  });

  return drawnCanvases;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function createToothContext() {
  const state = new Map<PropertyKey, unknown>();
  const fills: [number, number, number, number][] = [];
  const draws: [CanvasImageSource, number, number, number, number][] = [];
  const canvas = { width: 320, height: 180 };
  const ctx = new Proxy(
    {
      canvas,
      createPattern: () => ({}),
      fillRect: (x: number, y: number, width: number, height: number) =>
        fills.push([x, y, width, height]),
      drawImage: (image: CanvasImageSource, x: number, y: number, width: number, height: number) =>
        draws.push([image, x, y, width, height]),
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
  return { ctx, fills, draws, state };
}

describe("handwritten paper tooth overlay", () => {
  it("draws exactly one cached full-screen overlay in baked mode", async () => {
    vi.resetModules();
    installCanvasDocument([]);
    const { drawHandwrittenPaperTooth } = await import("./handwrittenPaper");
    const { ctx, fills, draws, state } = createToothContext();

    drawHandwrittenPaperTooth({
      ctx,
      width: 320,
      height: 180,
      palette: resolveHandwrittenPalette(0),
      paletteIndex: 0,
      strength: 0.6,
      quality: 0,
    });

    expect(fills).toHaveLength(0);
    expect(draws).toHaveLength(1);
    expect(draws[0]!.slice(1)).toEqual([0, 0, 320, 180]);
    expect(state.get("globalCompositeOperation")).toBe("overlay");
    expect(state.get("globalAlpha")).toBeCloseTo(0.072, 3);
  });

  it("still supports the pattern mode with a single pattern fillRect", async () => {
    vi.resetModules();
    installCanvasDocument([]);
    const { drawHandwrittenPaperTooth } = await import("./handwrittenPaper");
    const { ctx, fills, draws, state } = createToothContext();

    drawHandwrittenPaperTooth({
      ctx,
      width: 320,
      height: 180,
      palette: resolveHandwrittenPalette(0),
      paletteIndex: 0,
      strength: 0.6,
      quality: 0,
      mode: "pattern",
    });

    expect(draws).toHaveLength(0);
    expect(fills).toEqual([[0, 0, 320, 180]]);
    expect(state.get("globalCompositeOperation")).toBe("overlay");
  });

  it("skips the overlay at quality 2, zero strength, or without a DOM", async () => {
    vi.resetModules();
    installCanvasDocument([]);
    const { drawHandwrittenPaperTooth } = await import("./handwrittenPaper");
    const base = {
      width: 320,
      height: 180,
      palette: resolveHandwrittenPalette(0),
      paletteIndex: 0,
    };
    const skipped = createToothContext();
    drawHandwrittenPaperTooth({ ...base, ctx: skipped.ctx, strength: 0.6, quality: 2 });
    expect(skipped.fills).toHaveLength(0);

    const empty = createToothContext();
    drawHandwrittenPaperTooth({ ...base, ctx: empty.ctx, strength: 0 });
    expect(empty.fills).toHaveLength(0);

    vi.stubGlobal("document", undefined);
    vi.resetModules();
    const noDom = await import("./handwrittenPaper");
    expect(() =>
      noDom.drawHandwrittenPaperTooth({ ...base, ctx: skipped.ctx, strength: 0.6 })
    ).not.toThrow();
    expect(skipped.fills).toHaveLength(0);
  });
});

describe("handwritten paper grain", () => {
  it("produces identical texture frames across module loads and random histories", async () => {
    const first = await captureGrainFrames(0.1);
    const second = await captureGrainFrames(0.9);

    expect(first).toHaveLength(6);
    expect(second).toHaveLength(6);
    expect(second).toEqual(first);
  });

  it("bounds actual paper and screen-overlay canvases for 4K CSS at DPR 3", async () => {
    vi.resetModules();
    installCanvasDocument([]);
    const drawnCanvases = await captureLargePaperPass(0);
    const [paperTexture, screenOverlay] = drawnCanvases;

    expect(paperTexture).toBeDefined();
    expect(screenOverlay).toBeDefined();
    expect(paperTexture!.width * paperTexture!.height).toBeLessThanOrEqual(24_000_000);
    expect(screenOverlay!.width * screenOverlay!.height).toBeLessThanOrEqual(16_000_000);
  });

  it("keeps the aggregate large screen-overlay cache within its pixel budget", async () => {
    vi.resetModules();
    installCanvasDocument([]);
    const firstPass = await captureLargePaperPass(0);
    await captureLargePaperPass(1);
    const thirdPass = await captureLargePaperPass(0);

    expect(firstPass[0]).toBeDefined();
    expect(firstPass[1]).toBeDefined();
    expect(thirdPass[0]).not.toBe(firstPass[0]);
    expect(thirdPass[1]).not.toBe(firstPass[1]);
  });
});
