import { describe, it, expect, beforeEach, vi } from "vitest";
import { SuperstringSingularityV8Effect } from "./SuperstringSingularityV8";
import { RenderContext, AudioData } from "@/lib/visualization/types";

describe("SuperstringSingularityV8Effect", () => {
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
      ellipse: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalCompositeOperation: "source-over",
      shadowColor: "",
      shadowBlur: 0,
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
      bass: 0.8,
      mid: 0.5,
      treble: 0.6,
      full: 0.7,
      isBeat: true,
      bpm: 128,
      beatImpact: 0.9,
    };
  });

  it("has the correct metadata and parameters", () => {
    expect(SuperstringSingularityV8Effect.id).toBe("superstring-singularity-v8");
    expect(SuperstringSingularityV8Effect.name).toBe("量子超弦奇点");
    expect(SuperstringSingularityV8Effect.category).toBe("space");
    expect(SuperstringSingularityV8Effect.parameters.length).toBeGreaterThan(5);

    const paramIds = SuperstringSingularityV8Effect.parameters.map((p) => p.id);
    expect(paramIds).toContain("singularityMass");
    expect(paramIds).toContain("superstringTension");
    expect(paramIds).toContain("stardustDensity");
    expect(paramIds).toContain("chromaticAberration");
    expect(paramIds).toContain("burstSensitivity");
  });

  it("initializes state and render context properly", () => {
    SuperstringSingularityV8Effect.init(renderContext);
    expect(renderContext.private?.state).toBeDefined();
    expect(renderContext.private?.state.spiralStreams.length).toBeGreaterThan(0);
    expect(renderContext.private?.state.jetHelices.length).toBeGreaterThan(0);
  });

  it("renders correctly with audioData and beat triggers", () => {
    SuperstringSingularityV8Effect.init(renderContext);
    SuperstringSingularityV8Effect.render(renderContext, audioData, {
      singularityMass: 1.2,
      superstringTension: 1.5,
      stardustDensity: 2000,
      chromaticAberration: 0.9,
      burstSensitivity: 1.2,
      coreGlow: 1.8,
      colorTheme: "quantum",
    });

    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.arc).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it("cleans up state on destroy", () => {
    SuperstringSingularityV8Effect.init(renderContext);
    expect(renderContext.private?.state).toBeDefined();

    SuperstringSingularityV8Effect.destroy(renderContext);
    expect(renderContext.private?.state).toBeNull();
  });
});
