import { describe, expect, it } from "vitest";
import {
  resolveLyricFilmComposition,
  resolveLyricFilmCreditsFrame,
  resolveLyricFilmGlyphFrame,
  resolveLyricFilmVerticalSlot,
  expandLyricFilmVerticalUnits,
  segmentLyricFilmGraphemes,
} from "./lyricFilmComposition";

describe("resolveLyricFilmComposition", () => {
  it("produces a stable, varied placement that stays inside responsive lyric bounds", () => {
    const first = resolveLyricFilmComposition("seed-a", "prism", 1280, 720, "月光落在河面");
    const repeated = resolveLyricFilmComposition("seed-a", "prism", 1280, 720, "月光落在河面");
    const alternate = resolveLyricFilmComposition("seed-b", "prism", 1280, 720, "月光落在河面");

    expect(repeated).toEqual(first);
    expect(alternate).not.toEqual(first);
    expect(first.centerX).toBeGreaterThanOrEqual(first.maxWidth / 2);
    expect(first.centerX).toBeLessThanOrEqual(1280 - first.maxWidth / 2);
    expect(first.centerY).toBeGreaterThan(0);
    expect(first.centerY).toBeLessThan(720);
  });

  it("occasionally chooses vertical columns for CJK while keeping Latin lines horizontal", () => {
    const cjkModes = Array.from(
      { length: 32 },
      (_, index) =>
        resolveLyricFilmComposition(`cjk-${index}`, "astral", 900, 600, "月光照亮夜海").orientation
    );
    const latinModes = Array.from(
      { length: 32 },
      (_, index) =>
        resolveLyricFilmComposition(`latin-${index}`, "astral", 900, 600, "Light over the sea")
          .orientation
    );

    expect(cjkModes).toContain("vertical");
    expect(cjkModes).toContain("horizontal");
    expect(latinModes.every((mode) => mode === "horizontal")).toBe(true);
  });

  it("keeps long CJK lines horizontal so their columns cannot run outside a short stage", () => {
    const longText = "春风又绿江南岸明月何时照我还".repeat(4);
    const modes = Array.from(
      { length: 32 },
      (_, index) =>
        resolveLyricFilmComposition(`long-${index}`, "window", 320, 420, longText).orientation
    );

    expect(modes.every((mode) => mode === "horizontal")).toBe(true);
  });
});

describe("resolveLyricFilmVerticalSlot", () => {
  it("centers vertical glyph columns inside the lyric safety area", () => {
    const first = resolveLyricFilmVerticalSlot({
      itemIndex: 0,
      itemCount: 18,
      centerX: 450,
      centerY: 350,
      width: 900,
      height: 700,
      maxWidth: 660,
      fontSize: 52,
      groupRowIndex: 0,
      groupRowCount: 1,
    });
    const last = resolveLyricFilmVerticalSlot({
      itemIndex: 17,
      itemCount: 18,
      centerX: 450,
      centerY: 350,
      width: 900,
      height: 700,
      maxWidth: 660,
      fontSize: 52,
      groupRowIndex: 0,
      groupRowCount: 1,
    });

    expect(first.x).toBeGreaterThan(450 - 330);
    expect(last.x).toBeLessThan(450 + 330);
    expect(first.y).toBeLessThan(last.y);
    expect(first.fontSize).toBe(52);
  });
});

describe("expandLyricFilmVerticalUnits", () => {
  it("splits fast multi-grapheme timing units into individual vertical glyphs", () => {
    const expanded = expandLyricFilmVerticalUnits([
      { text: "月光", start: 1, end: 1.3, fontSize: 42 },
      { text: "へ", start: 1.3, end: 1.5, fontSize: 42 },
    ]);

    expect(expanded.map(({ text }) => text)).toEqual(["月", "光", "へ"]);
    expect(expanded[0]).toMatchObject({ start: 1, end: 1.3, fontSize: 42 });
    expect(expanded[1]).toMatchObject({ start: 1, end: 1.3, fontSize: 42 });
  });
});

describe("resolveLyricFilmGlyphFrame", () => {
  it("uses absolute time for a deterministic incoming glyph trajectory and short afterglow", () => {
    const input = {
      seed: "glyph-a",
      startTime: 4,
      endTime: 4.8,
      musicTime: 4.4,
      x: 180,
      y: 260,
      fontSize: 54,
    };
    const frame = resolveLyricFilmGlyphFrame(input);

    expect(resolveLyricFilmGlyphFrame(input)).toEqual(frame);
    expect(frame.progress).toBeCloseTo(0.5);
    expect(frame.x !== 180 || frame.y !== 260).toBe(true);
    expect(frame.sparkleAlpha).toBeGreaterThan(0);
    expect(resolveLyricFilmGlyphFrame({ ...input, musicTime: 4.8 }).x).toBe(180);
    expect(resolveLyricFilmGlyphFrame({ ...input, musicTime: 5 }).trailAlpha).toBeGreaterThan(0);
    expect(resolveLyricFilmGlyphFrame({ ...input, musicTime: 6 }).trailAlpha).toBe(0);
  });

  it("clamps invalid, zero-length, and out-of-range timing without non-finite coordinates", () => {
    const frame = resolveLyricFilmGlyphFrame({
      seed: "bad-time",
      startTime: 2,
      endTime: 2,
      musicTime: 1,
      x: 20,
      y: 30,
      fontSize: 0,
    });

    expect(frame.progress).toBe(0);
    expect(Number.isFinite(frame.x)).toBe(true);
    expect(Number.isFinite(frame.y)).toBe(true);
    expect(frame.trailAlpha).toBe(0);
  });
});

describe("resolveLyricFilmCreditsFrame", () => {
  it("reveals the title by grapheme before the artist and album credits", () => {
    const start = resolveLyricFilmCreditsFrame(10, 18, 10.1, "月光之下", true, true);
    const middle = resolveLyricFilmCreditsFrame(10, 18, 12, "月光之下", true, true);
    const end = resolveLyricFilmCreditsFrame(10, 18, 18, "月光之下", true, true);

    expect(segmentLyricFilmGraphemes("月光之下")).toHaveLength(4);
    expect(start.titleVisibleGraphemes).toBe(0);
    expect(middle.titleVisibleGraphemes).toBeGreaterThan(0);
    expect(end.titleVisibleGraphemes).toBe(4);
    expect(middle.artistOpacity).toBeGreaterThan(0);
    expect(end.artistOpacity).toBe(1);
    expect(end.albumOpacity).toBe(1);
    expect(resolveLyricFilmCreditsFrame(10, 18, 12, "月光之下", true, true)).toEqual(middle);
  });

  it("reduces credit motion to discrete readable states", () => {
    const frame = resolveLyricFilmCreditsFrame(0, 6, 0.8, "Still", true, false, true);

    expect(frame.titleVisibleGraphemes).toBe(5);
    expect(frame.artistOpacity).toBe(0);
  });
});
