import { describe, expect, it } from "vitest";
import { BUILT_IN_EFFECT_PRESETS, EffectPreset, morph } from "./effectsPresets";

const from: EffectPreset = {
  id: "from",
  name: "From",
  eq: [0, 2, 4, 6, 8, 10, 12, -2, -4, -6],
  reverb: 0.2,
  compressor: { threshold: -30, ratio: 2, attack: 0.01, release: 0.2 },
  stereoWidth: 0.8,
};

const to: EffectPreset = {
  id: "to",
  name: "To",
  eq: [10, 8, 6, 4, 2, 0, -2, -4, -6, -8],
  reverb: 0.8,
  compressor: { threshold: -10, ratio: 6, attack: 0.05, release: 0.6 },
  stereoWidth: 1.6,
};

describe("effectsPresets", () => {
  it("ships six built-in presets with normalized 10-band eq", () => {
    expect(BUILT_IN_EFFECT_PRESETS).toHaveLength(6);
    expect(BUILT_IN_EFFECT_PRESETS.map((preset) => preset.id)).toEqual([
      "flat",
      "vocal-focus",
      "live-room",
      "late-night",
      "bass-room",
      "clarity-boost",
    ]);
    expect(BUILT_IN_EFFECT_PRESETS.every((preset) => preset.eq.length === 10)).toBe(true);
  });

  it("returns the first preset at t=0", () => {
    expect(morph(from, to, 0)).toMatchObject({
      eq: from.eq,
      reverb: from.reverb,
      compressor: from.compressor,
      stereoWidth: from.stereoWidth,
    });
  });

  it("returns the target preset at t=1", () => {
    expect(morph(from, to, 1)).toMatchObject({
      id: to.id,
      name: to.name,
      eq: to.eq,
      reverb: to.reverb,
      compressor: to.compressor,
      stereoWidth: to.stereoWidth,
    });
  });

  it("interpolates all numeric fields", () => {
    const mid = morph(from, to, 0.5);

    expect(mid.eq[0]).toBe(5);
    expect(mid.eq[4]).toBe(5);
    expect(mid.reverb).toBe(0.5);
    expect(mid.compressor.threshold).toBe(-20);
    expect(mid.compressor.ratio).toBe(4);
    expect(mid.compressor.attack).toBe(0.03);
    expect(mid.compressor.release).toBe(0.4);
    expect(mid.stereoWidth).toBeCloseTo(1.2);
  });

  it("clamps interpolation boundaries and output ranges", () => {
    const beyond = morph(
      { ...from, reverb: -1, stereoWidth: -2, compressor: { ...from.compressor, ratio: 0 } },
      { ...to, reverb: 2, stereoWidth: 3, compressor: { ...to.compressor, threshold: 20 } },
      5
    );

    expect(beyond.reverb).toBe(1);
    expect(beyond.stereoWidth).toBe(2);
    expect(beyond.compressor.threshold).toBe(0);
    expect(beyond.compressor.ratio).toBe(6);
  });
});
