import { describe, expect, it } from "vitest";
import {
  LYRIC_READABILITY_PRESETS,
  normalizeReadabilityPreset,
  serializeReadabilityPreset,
} from "./readabilityPresets";

describe("readabilityPresets", () => {
  it("defines Cinema, Reading, and Karaoke presets", () => {
    expect(LYRIC_READABILITY_PRESETS.map((preset) => preset.id)).toEqual([
      "cinema",
      "reading",
      "karaoke",
    ]);
  });

  it("serializes preset data for persistence or snapshots", () => {
    expect(JSON.parse(serializeReadabilityPreset(LYRIC_READABILITY_PRESETS[0]))).toMatchObject({
      id: "cinema",
      name: "Cinema",
      fontSize: 22,
    });
  });

  it("clamps numeric preset fields", () => {
    const normalized = normalizeReadabilityPreset({
      id: "reading",
      name: "Bad",
      description: "Out of range",
      fontSize: 99,
      lineHeight: -1,
      weight: 1000,
      contrast: 2,
      glow: -10,
      showTranslation: false,
    });

    expect(normalized.fontSize).toBe(24);
    expect(normalized.lineHeight).toBe(1);
    expect(normalized.weight).toBe(900);
    expect(normalized.contrast).toBe(1);
    expect(normalized.glow).toBe(0);
  });
});
