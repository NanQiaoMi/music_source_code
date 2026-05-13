import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSTER_CONFIG,
  applyPosterPreset,
  createPosterFileName,
  getPosterExportMeta,
  getPosterQualityChecks,
} from "./posterWorkshop";

describe("posterWorkshop", () => {
  it("applies quick presets without mutating the current config", () => {
    const current = { ...DEFAULT_POSTER_CONFIG, template: "spotify" as const };
    const next = applyPosterPreset(current, "lyric-focus");

    expect(current.template).toBe("spotify");
    expect(next.template).toBe("minimal");
    expect(next.maxLyricLines).toBe(3);
    expect(next.lyricSize).toBeGreaterThan(current.lyricSize);
  });

  it("derives export pixel size from aspect ratio and resolution", () => {
    const meta = getPosterExportMeta({ ...DEFAULT_POSTER_CONFIG, aspectRatio: 0.5 }, 2);

    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(3200);
    expect(meta.megapixels).toBeCloseTo(5.12);
  });

  it("returns actionable quality checks for risky poster settings", () => {
    const checks = getPosterQualityChecks({
      config: { ...DEFAULT_POSTER_CONFIG, maxLyricLines: 8 },
      resolution: 1,
      lyricLineCount: 0,
      hasCover: false,
    });

    expect(checks.filter((check) => !check.passed).map((check) => check.id)).toEqual(
      expect.arrayContaining(["cover", "lyrics", "resolution", "lyric-density"])
    );
  });

  it("sanitizes poster file names for Windows downloads", () => {
    expect(createPosterFileName("A:B/C*D?", "apple")).toBe("A-B-C-D - apple - poster.png");
  });
});
