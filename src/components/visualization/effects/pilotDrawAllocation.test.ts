import { describe, expect, it, vi } from "vitest";
import { createEmptyEffectRefs, type EffectFrame } from "@/runtime/effectPlugin";
import type { VisualQualityProfile } from "@/runtime/visualRuntime";
import { createRecordingCanvasContext } from "@/test/canvasRecorder";
import { drawNebulaField } from "./nebulaField";
import { drawSpatialMesh } from "./spatialMesh";

const QUALITY: VisualQualityProfile = { tier: "high", dprCap: 2, effectScale: 1 };

function makeFrame(context: CanvasRenderingContext2D): EffectFrame {
  const refs = createEmptyEffectRefs();
  refs.nebulaStars.current.push({ x: 10, y: 20, z: 200, size: 2 });
  return {
    ctx: context,
    width: 800,
    height: 600,
    data: new Uint8Array(128),
    params: {},
    time: 16,
    musicTime: 0,
    refs,
    theme: { primary: 200, secondary: 260, accent: 120 },
    utils: { getThemeBaseHue: () => 200 },
    canvas: { width: 1600, height: 1200 } as HTMLCanvasElement,
    dpr: 2,
    quality: QUALITY,
    dt: 16,
  };
}

describe("pilot effect draw allocation (S5-5)", () => {
  it("spatialMesh / nebulaField draw with no Array.from, typed arrays or per-frame slices", () => {
    const recorded = createRecordingCanvasContext();
    const frame = makeFrame(recorded.context);
    const counts = { arrayFrom: 0, float32: 0, uint8: 0 };
    const originalFloat32 = globalThis.Float32Array;
    const originalUint8 = globalThis.Uint8Array;

    class CountingFloat32Array extends originalFloat32 {
      constructor(length: number) {
        super(length);
        counts.float32 += 1;
      }
    }
    class CountingUint8Array extends originalUint8 {
      constructor(length: number) {
        super(length);
        counts.uint8 += 1;
      }
    }
    const fromSpy = vi.spyOn(Array, "from").mockImplementation(((source: ArrayLike<unknown>) => {
      counts.arrayFrom += 1;
      return Array.prototype.slice.call(source);
    }) as typeof Array.from);
    const sliceSpy = vi.spyOn(Array.prototype, "slice");

    try {
      Object.defineProperty(globalThis, "Float32Array", {
        configurable: true,
        writable: true,
        value: CountingFloat32Array,
      });
      Object.defineProperty(globalThis, "Uint8Array", {
        configurable: true,
        writable: true,
        value: CountingUint8Array,
      });

      for (let i = 0; i < 10; i += 1) {
        drawSpatialMesh(frame);
        drawNebulaField(frame);
      }

      expect(counts).toEqual({ arrayFrom: 0, float32: 0, uint8: 0 });
      expect(sliceSpy).not.toHaveBeenCalled();
    } finally {
      fromSpy.mockRestore();
      sliceSpy.mockRestore();
      Object.defineProperty(globalThis, "Float32Array", {
        configurable: true,
        writable: true,
        value: originalFloat32,
      });
      Object.defineProperty(globalThis, "Uint8Array", {
        configurable: true,
        writable: true,
        value: originalUint8,
      });
    }
  });
});
