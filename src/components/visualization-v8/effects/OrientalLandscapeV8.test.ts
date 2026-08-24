import { describe, it, expect, beforeEach, vi } from "vitest";
import { OrientalLandscapeV8Effect } from "./OrientalLandscapeV8";
import { RenderContext, AudioData } from "@/lib/visualization/types";

describe("OrientalLandscapeV8Effect", () => {
  let mockCtx: RenderContext;
  let mockAudioData: AudioData;
  let canvas: HTMLCanvasElement;
  let context2d: any;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;

    context2d = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      ellipse: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      clip: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      shadowColor: "",
      shadowBlur: 0,
      shadowOffsetY: 0,
    };

    mockCtx = {
      canvas,
      ctx: context2d,
      width: 1920,
      height: 1080,
      deltaTime: 0.016,
      time: 0,
    };

    mockAudioData = {
      frequencyData: new Uint8Array(256),
      waveformData: new Uint8Array(256),
      bass: 0.5,
      mid: 0.4,
      treble: 0.6,
      full: 0.5,
      isBeat: false,
      bpm: 120,
    };

    OrientalLandscapeV8Effect.init?.(mockCtx);
  });

  it("should have correct metadata and parameters", () => {
    expect(OrientalLandscapeV8Effect.id).toBe("oriental-landscape-v8");
    expect(OrientalLandscapeV8Effect.name).toBe("青绿千里 · 电影画卷");
    expect(OrientalLandscapeV8Effect.preferredEngine).toBe("canvas");
    expect(OrientalLandscapeV8Effect.parameters.length).toBeGreaterThanOrEqual(5);

    const paramIds = OrientalLandscapeV8Effect.parameters.map((p) => p.id);
    expect(paramIds).toContain("lightRays");
    expect(paramIds).toContain("mountainBreath");
    expect(paramIds).toContain("waterRipple");
    expect(paramIds).toContain("colorTheme");
  });

  it("should render frames without throwing errors", () => {
    expect(() => {
      OrientalLandscapeV8Effect.render(mockCtx, mockAudioData, {
        lightRays: 1.0,
        mountainBreath: 1.0,
        waterRipple: 1.0,
        scrollUnroll: 1.0,
        colorTheme: "peacock",
        filmGrain: 0.35,
      });
    }).not.toThrow();

    expect(context2d.save).toHaveBeenCalled();
    expect(context2d.restore).toHaveBeenCalled();
    expect(context2d.fillRect).toHaveBeenCalled();
  });

  it("should support sunset and silver color themes", () => {
    expect(() => {
      OrientalLandscapeV8Effect.render(mockCtx, mockAudioData, {
        colorTheme: "sunset",
      });
      OrientalLandscapeV8Effect.render(mockCtx, mockAudioData, {
        colorTheme: "silver",
      });
    }).not.toThrow();
  });

  it("should clean up cleanly in destroy", () => {
    expect(() => {
      OrientalLandscapeV8Effect.destroy?.(mockCtx);
    }).not.toThrow();
  });
});
