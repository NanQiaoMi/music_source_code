import { describe, expect, it } from "vitest";
import { createEmptyEffectRefs, type EffectFrame } from "@/runtime/effectPlugin";
import type { VisualQualityProfile } from "@/runtime/visualRuntime";
import { createRecordingCanvasContext } from "@/test/canvasRecorder";
import { drawNebulaField } from "./nebulaField";
import { NebulaFieldPlugin } from "./nebulaFieldPlugin";

const QUALITY: VisualQualityProfile = { tier: "high", dprCap: 2, effectScale: 1 };
const FRAME_TIMES = [0, 16, 32, 48, 64];

function spectrum(seed: number): Uint8Array {
  return Uint8Array.from({ length: 128 }, (_, i) => (i * 29 + seed * 41) % 256);
}

function makeFrame(context: CanvasRenderingContext2D, time: number, data: Uint8Array): EffectFrame {
  return {
    ctx: context,
    width: 800,
    height: 600,
    data,
    params: {},
    time,
    musicTime: 0,
    refs: createEmptyEffectRefs(),
    theme: { primary: 200, secondary: 260, accent: 120 },
    utils: { getThemeBaseHue: () => 200 },
    canvas: { width: 1600, height: 1200 } as HTMLCanvasElement,
    dpr: 2,
    quality: QUALITY,
    dt: 16,
  };
}

describe("NebulaFieldPlugin (S5-4c)", () => {
  it("draws exactly the same Canvas2D call sequence as legacy drawNebulaField", () => {
    const legacy = createRecordingCanvasContext();
    const legacyRefs = createEmptyEffectRefs();
    FRAME_TIMES.forEach((time, index) => {
      drawNebulaField({
        ...makeFrame(legacy.context, time, spectrum(index + 1)),
        refs: legacyRefs,
      });
    });

    const plugin = new NebulaFieldPlugin();
    plugin.init({ width: 800, height: 600, dpr: 2 });
    const recorded = createRecordingCanvasContext();
    FRAME_TIMES.forEach((time, index) => {
      plugin.draw(makeFrame(recorded.context, time, spectrum(index + 1)));
    });

    expect(recorded.calls).toEqual(legacy.calls);
    expect(recorded.calls.length).toBeGreaterThan(0);
  });

  it("keeps smoothed bands and stars across draws and resets them on dispose", () => {
    const silent = Uint8Array.from({ length: 128 }, () => 0);
    const loud = Uint8Array.from({ length: 128 }, () => 255);

    const fresh = createRecordingCanvasContext();
    const freshPlugin = new NebulaFieldPlugin();
    freshPlugin.init({ width: 800, height: 600, dpr: 2 });
    freshPlugin.draw(makeFrame(fresh.context, 16, silent));

    const plugin = new NebulaFieldPlugin();
    plugin.init({ width: 800, height: 600, dpr: 2 });
    const recorded = createRecordingCanvasContext();
    plugin.draw(makeFrame(recorded.context, 0, loud));
    const beforeSilent = recorded.calls.length;
    plugin.draw(makeFrame(recorded.context, 16, silent));
    expect(recorded.calls.slice(beforeSilent)).not.toEqual(fresh.calls);

    plugin.dispose();
    plugin.init({ width: 800, height: 600, dpr: 2 });
    const afterDispose = recorded.calls.length;
    plugin.draw(makeFrame(recorded.context, 16, silent));
    expect(recorded.calls.slice(afterDispose)).toEqual(fresh.calls);
  });

  it("does not write back into the shared refs it is given", () => {
    const recorded = createRecordingCanvasContext();
    const frame = makeFrame(recorded.context, 16, spectrum(1));
    const plugin = new NebulaFieldPlugin();
    plugin.init({ width: 800, height: 600, dpr: 2 });
    plugin.draw(frame);
    expect(frame.refs.smoothBass.current).toBe(0);
    expect(frame.refs.smoothMid.current).toBe(0);
    expect(frame.refs.smoothTreble.current).toBe(0);
    expect(frame.refs.nebulaStars.current).toHaveLength(0);
  });
});
