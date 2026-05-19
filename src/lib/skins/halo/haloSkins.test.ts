import { describe, expect, it, vi } from "vitest";
import {
  HALO_SKINS,
  getHaloRenderMode,
  getHaloSkin,
  paintHaloPreview,
  type HaloPaintContext,
} from "./haloSkins";

function createContext(): HaloPaintContext {
  return {
    canvas: { width: 80, height: 80 },
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    set fillStyle(_value: string | CanvasGradient) {},
    set strokeStyle(_value: string | CanvasGradient) {},
    set globalAlpha(_value: number) {},
    set lineWidth(_value: number) {},
  };
}

describe("haloSkins", () => {
  it("registers the three built-in halo skins", () => {
    expect(HALO_SKINS.map((skin) => skin.id)).toEqual(["aurora", "vinyl", "pulse"]);
  });

  it("falls back to aurora for unknown halo ids", () => {
    expect(getHaloSkin("missing").id).toBe("aurora");
    expect(getHaloSkin("vinyl").id).toBe("vinyl");
  });

  it("downgrades to static rendering for low frame budgets or reduced motion", () => {
    expect(getHaloRenderMode({ targetFps: 60, reducedMotion: false })).toBe("animated");
    expect(getHaloRenderMode({ targetFps: 24, reducedMotion: false })).toBe("static");
    expect(getHaloRenderMode({ targetFps: 60, reducedMotion: true })).toBe("static");
  });

  it("paints a canvas preview through the selected halo painter", () => {
    const context = createContext();

    paintHaloPreview(context, getHaloSkin("pulse"), {
      level: 0.8,
      currentTime: 12,
      renderMode: "animated",
    });

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 80, 80);
    expect(context.arc).toHaveBeenCalled();
    expect(context.stroke).toHaveBeenCalled();
  });
});
