import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSTER_CONFIG,
  POSTER_ASPECT_RATIO_PRESETS,
  POSTER_RESOLUTION_PRESETS,
  POSTER_TEMPLATE_META,
  applyPosterPreset,
  createPosterFileName,
  getPosterExportMeta,
  getPosterQualityChecks,
  getTemplateMeta,
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

  it("has Chinese labels on all quality checks", () => {
    const checks = getPosterQualityChecks({
      config: DEFAULT_POSTER_CONFIG,
      resolution: 2,
      lyricLineCount: 2,
      hasCover: true,
    });

    for (const check of checks) {
      expect(check.labelZh).toBeTruthy();
      expect(check.detailZh).toBeTruthy();
      expect(typeof check.labelZh).toBe("string");
      expect(typeof check.detailZh).toBe("string");
    }
  });

  it("exports 8 template metadata entries with required fields", () => {
    expect(POSTER_TEMPLATE_META).toHaveLength(8);
    for (const meta of POSTER_TEMPLATE_META) {
      expect(meta.id).toBeTruthy();
      expect(meta.name).toBeTruthy();
      expect(meta.nameZh).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.gradient).toBeTruthy();
      expect(typeof meta.supportsThemeColor).toBe("boolean");
    }
  });

  it("getTemplateMeta returns correct meta for known templates", () => {
    const apple = getTemplateMeta("apple");
    expect(apple.id).toBe("apple");
    expect(apple.nameZh).toBe("苹果玻璃");
    expect(apple.supportsThemeColor).toBe(false);

    const spotify = getTemplateMeta("spotify");
    expect(spotify.id).toBe("spotify");
    expect(spotify.supportsThemeColor).toBe(true);
  });

  it("getTemplateMeta falls back to first template for unknown id", () => {
    // @ts-expect-error testing invalid input
    const meta = getTemplateMeta("nonexistent");
    expect(meta.id).toBe("apple");
  });

  it("aspect ratio presets have Chinese labels", () => {
    for (const preset of POSTER_ASPECT_RATIO_PRESETS) {
      expect(preset.nameZh).toBeTruthy();
      expect(typeof preset.nameZh).toBe("string");
    }
  });

  it("resolution presets have Chinese labels", () => {
    for (const preset of POSTER_RESOLUTION_PRESETS) {
      expect(preset.labelZh).toBeTruthy();
      expect(typeof preset.labelZh).toBe("string");
    }
  });
});
