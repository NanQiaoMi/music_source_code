import { describe, it, expect, beforeEach, vi } from "vitest";
import { CinematicLyricDriftV8Effect, CinematicLyricDriftState } from "./CinematicLyricDriftV8";
import { RenderContext, AudioData } from "@/lib/visualization/types";

describe("CinematicLyricDriftV8Effect (温光浮字 · 电影感)", () => {
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
    expect(CinematicLyricDriftV8Effect.name).toBe("温光浮字 · 电影感");
    expect(CinematicLyricDriftV8Effect.category).toBe("particles");
    expect(CinematicLyricDriftV8Effect.preferredEngine).toBe("canvas");
    expect(CinematicLyricDriftV8Effect.parameters.length).toBeGreaterThan(5);
  });

  it("should initialize bokeh orbs and dust motes", () => {
    CinematicLyricDriftV8Effect.init(renderContext);
    const state = renderContext.private as CinematicLyricDriftState;

    expect(state).toBeDefined();
    expect(state.bokehOrbs.length).toBeGreaterThan(10);
    expect(state.dustMotes.length).toBeGreaterThan(50);
  });

  it("should render without errors and render pure background when no lyrics", () => {
    CinematicLyricDriftV8Effect.init(renderContext);
    expect(() => {
      CinematicLyricDriftV8Effect.render(renderContext, audioData, {
        colorScheme: 0,
        bokehIntensity: 1.0,
        ambientLightIntensity: 1.0,
        floatingSpeed: 1.0,
        filmGrain: 0.35,
        chromaticAberration: 0.8,
        breathingDepth: 1.0,
        heroFontSize: 28,
        vignetteStrength: 0.65,
      });
    }).not.toThrow();

    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it("should clean up resources on destroy", () => {
    CinematicLyricDriftV8Effect.init(renderContext);
    CinematicLyricDriftV8Effect.destroy(renderContext);
    const state = renderContext.private as CinematicLyricDriftState;

    expect(state.floatingWords.length).toBe(0);
    expect(state.bokehOrbs.length).toBe(0);
    expect(state.dustMotes.length).toBe(0);
  });
});
