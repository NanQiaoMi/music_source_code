import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CinematicLyricDriftV8Effect,
  CinematicLyricDriftState,
  parseLrc,
} from "./CinematicLyricDriftV8";
import { RenderContext, AudioData } from "@/lib/visualization/types";

describe("CinematicLyricDriftV8Effect (弧光伴字 · Apple Music 4K 液态流光)", () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;
  let renderContext: RenderContext;
  let audioData: AudioData;

  beforeEach(() => {
    mockCanvas = {
      width: 1920,
      height: 1080,
    } as unknown as HTMLCanvasElement;

    mockCtx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      clip: vi.fn(),
      rect: vi.fn(),
      drawImage: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createPattern: vi.fn(() => ({})),
      measureText: vi.fn(() => ({ width: 120 })),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1.0,
      globalCompositeOperation: "source-over",
      shadowColor: "",
      shadowBlur: 0,
      font: "",
      textAlign: "start",
      textBaseline: "alphabetic",
      letterSpacing: "",
    } as unknown as CanvasRenderingContext2D;

    renderContext = {
      canvas: mockCanvas,
      ctx: mockCtx,
      width: 1920,
      height: 1080,
      deltaTime: 0.016,
      time: 1.0,
      private: {},
    };

    audioData = {
      frequencyData: new Uint8Array(256).fill(60),
      waveformData: new Uint8Array(256).fill(128),
      bass: 0.4,
      mid: 0.3,
      treble: 0.2,
      full: 0.3,
      isBeat: false,
      bpm: 120,
    };
  });

  it("should have correct metadata and plugin properties", () => {
    expect(CinematicLyricDriftV8Effect.id).toBe("cinematic-lyric-drift-v8");
    expect(CinematicLyricDriftV8Effect.name).toBe("弧光伴字");
    expect(CinematicLyricDriftV8Effect.category).toBe("space");
    expect(CinematicLyricDriftV8Effect.preferredEngine).toBe("canvas");
    expect(CinematicLyricDriftV8Effect.parameters.length).toBeGreaterThan(5);

    const paramIds = CinematicLyricDriftV8Effect.parameters.map((p) => p.id);
    expect(paramIds).toContain("colorScheme");
    expect(paramIds).toContain("bassPulse");
    expect(paramIds).toContain("fluidSpeed");
    expect(paramIds).toContain("ambientBrightness");
    expect(paramIds).toContain("shimmerFeather");
    expect(paramIds).toContain("filmGrain");
    expect(paramIds).toContain("heroFontSize");
  });

  it("should initialize 5 fluid blobs and dynamic palettes", () => {
    CinematicLyricDriftV8Effect.init(renderContext);
    const state = renderContext.private as CinematicLyricDriftState;

    expect(state).toBeDefined();
    expect(state.fluidBlobs.length).toBe(5);
    expect(state.currentPalette).toBeDefined();
    expect(state.targetPalette).toBeDefined();
  });

  it("should render without errors with audio and parameters", () => {
    CinematicLyricDriftV8Effect.init(renderContext);
    expect(() => {
      CinematicLyricDriftV8Effect.render(renderContext, audioData, {
        colorScheme: 0,
        bassPulse: 1.0,
        fluidSpeed: 0.8,
        ambientBrightness: 1.1,
        shimmerFeather: 45,
        filmGrain: 0.08,
        heroFontSize: 56,
      });
    }).not.toThrow();

    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it("should parse standard LRC lyrics cleanly and filter metadata", () => {
    const rawLrc = `
[00:00.00] 作词 : 方文山
[00:01.00] 作曲 : 周杰伦
[00:04.20] 故事的小黄花
[00:08.50] 从出生那年就飘着
`;
    const parsed = parseLrc(rawLrc);
    expect(parsed.length).toBe(2);
    expect(parsed[0].text).toBe("故事的小黄花");
    expect(parsed[0].time).toBeCloseTo(4.2, 1);
    expect(parsed[1].text).toBe("从出生那年就飘着");
    expect(parsed[1].time).toBeCloseTo(8.5, 1);
  });

  it("should clean up state on destroy", () => {
    CinematicLyricDriftV8Effect.init(renderContext);
    expect(renderContext.private).toBeDefined();
    CinematicLyricDriftV8Effect.destroy(renderContext);
    expect(renderContext.private).toBeUndefined();
  });
});
