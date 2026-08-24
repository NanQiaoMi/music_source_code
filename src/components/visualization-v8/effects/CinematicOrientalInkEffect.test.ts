import { describe, it, expect, beforeEach, vi } from "vitest";
import { CinematicOrientalInkEffect, CinematicInkState } from "./CinematicOrientalInkEffect";
import { RenderContext, AudioData } from "@/lib/visualization/types";

describe("CinematicOrientalInkEffect (千里江山·流光墨韵)", () => {
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
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
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
      ellipse: vi.fn(),
      rect: vi.fn(),
      quadraticCurveTo: vi.fn(),
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
      frequencyData: new Uint8Array(256).fill(120),
      waveformData: new Uint8Array(256).fill(128),
      bass: 0.7,
      mid: 0.8,
      treble: 0.6,
      full: 0.75,
      isBeat: true,
      bpm: 96,
      beatImpact: 0.8,
    };

    CinematicOrientalInkEffect.init(renderContext);
  });

  it("should have correct metadata and Oriental aesthetic configuration", () => {
    expect(CinematicOrientalInkEffect.id).toBe("cinematic_oriental_ink");
    expect(CinematicOrientalInkEffect.name).toBe("千里江山 · 流光墨韵");
    expect(CinematicOrientalInkEffect.category).toBe("space");
    expect(CinematicOrientalInkEffect.preferredEngine).toBe("canvas");
    expect(CinematicOrientalInkEffect.parameters.length).toBeGreaterThanOrEqual(5);

    const paramIds = CinematicOrientalInkEffect.parameters.map((p) => p.id);
    expect(paramIds).toContain("colorScheme");
    expect(paramIds).toContain("particleCount");
    expect(paramIds).toContain("inkFlowSpeed");
    expect(paramIds).toContain("showPoetry");
    expect(paramIds).toContain("filmVignette");
  });

  it("should initialize physical gold flake particles and volumetric shafts", () => {
    const state: CinematicInkState = renderContext.private?.state;
    expect(state).toBeDefined();
    expect(state.fireflies.length).toBe(450);
    expect(state.clouds.length).toBe(3);
    expect(state.smoothedBass).toBe(0);
    expect(state.smoothedMid).toBe(0);

    const firstParticle = state.fireflies[0];
    expect(firstParticle.z).toBeGreaterThan(0.1);
    expect(firstParticle.z).toBeLessThanOrEqual(1.0);
    expect(["gold", "moonlight", "cinnabar"]).toContain(firstParticle.colorType);
  });

  it("should render frame with volumetric shafts, ink layers and gold flakes without errors", () => {
    CinematicOrientalInkEffect.render(renderContext, audioData, {
      colorScheme: "qianli_green",
      godraysIntensity: 1.5,
      particleCount: 500,
      inkFlowSpeed: 1.2,
      showPoetry: true,
      filmVignette: 0.7,
    });

    const state: CinematicInkState = renderContext.private?.state;
    // Verify background fill
    expect(mockCtx.fillRect).toHaveBeenCalled();
    // Verify save and restore calls
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
    // Verify audio smoothing update
    expect(state.smoothedMid).toBeGreaterThan(0);
    expect(state.smoothedBass).toBeGreaterThan(0);
  });

  it("should support switching to different oriental aesthetic schemes", () => {
    // 烟雨水墨
    CinematicOrientalInkEffect.render(renderContext, audioData, {
      colorScheme: "jiangnan_ink",
      godraysIntensity: 1.0,
    });
    expect(mockCtx.fillRect).toHaveBeenCalled();

    // 盛唐暮霞
    CinematicOrientalInkEffect.render(renderContext, audioData, {
      colorScheme: "tang_sunset",
      godraysIntensity: 1.2,
    });
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it("should cleanup state properly on unmount", () => {
    CinematicOrientalInkEffect.destroy(renderContext);
    expect(renderContext.private?.state).toBeNull();
  });
});
