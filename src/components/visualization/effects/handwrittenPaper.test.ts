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
