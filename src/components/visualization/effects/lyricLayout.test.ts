import { describe, expect, it } from "vitest";

import { layoutLyricUnits } from "./lyricLayout";

const graphemes = (text: string): string[] =>
  Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    (part) => part.segment
  );

const measureText = (text: string, fontSize: number): number =>
  graphemes(text).length * fontSize * 0.5;

const makeOptions = (maxWidth: number, seed = "test-seed") => ({
  maxWidth,
  fontSize: 20,
  fontFamily: "Test Sans",
  seed,
  measureText,
});

describe("layoutLyricUnits", () => {
  it("keeps reading order and produces stable, lightly staggered coordinates for a seed", () => {
    const units = [
      { text: "Night", start: 0, end: 1, lineIndex: 4 },
      { text: "Moon", start: 1, end: 2, lineIndex: 5 },
    ];

    const first = layoutLyricUnits(units, makeOptions(200, "stable-seed"));
    const second = layoutLyricUnits(units, makeOptions(200, "stable-seed"));

    expect(first).toEqual(second);
    expect(first.map(({ text, lineIndex, rowIndex }) => ({ text, lineIndex, rowIndex }))).toEqual([
      { text: "Night", lineIndex: 4, rowIndex: 0 },
      { text: "Moon", lineIndex: 5, rowIndex: 1 },
    ]);
    expect(first[0].x).not.toBe(first[1].x);
    expect(first[0].y).toBeLessThan(first[1].y);
    expect(first.map(({ start, end }) => [start, end])).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });

  it("wraps Latin text at spaces and only breaks an overlong word at grapheme boundaries", () => {
    const layout = layoutLyricUnits(
      [{ text: "go now extraordinarily", start: 2, end: 4, lineIndex: 7 }],
      makeOptions(100)
    );

    expect(layout.map((line) => line.text)).toEqual(["go now ", "extraord", "inarily"]);
    expect(layout.map((line) => line.text).join("")).toBe("go now extraordinarily");
    expect(layout.every((line) => line.width <= 84)).toBe(true);
    expect(layout.every((line) => line.start === 2 && line.end === 4 && line.lineIndex === 7)).toBe(
      true
    );
  });

  it("keeps CJK punctuation attached to the preceding character when wrapping", () => {
    const layout = layoutLyricUnits(
      [{ text: "春风又绿江南岸，明月", start: 0, end: 3, lineIndex: 2 }],
      makeOptions(80)
    );

    expect(layout.map((line) => line.text)).toEqual(["春风又绿江南", "岸，明月"]);
    expect(layout.map((line) => line.text).join("")).toBe("春风又绿江南岸，明月");
    expect(layout.every((line) => !/^[，。！？；：、]/u.test(line.text))).toBe(true);
  });

  it("keeps every line inside the safe margins of a narrow width", () => {
    const layout = layoutLyricUnits(
      [{ text: "春风又绿江南岸，明月何时照我还", start: 0, end: 4, lineIndex: 3 }],
      makeOptions(80)
    );

    expect(layout.length).toBeGreaterThanOrEqual(2);
    expect(layout.length).toBeLessThanOrEqual(5);
    expect(layout.every((line) => line.x >= 6.4)).toBe(true);
    expect(layout.every((line) => line.x + line.width <= 73.6)).toBe(true);
    expect(layout.map((line) => line.rowIndex)).toEqual(layout.map((_, index) => index));
  });

  it("uses fewer rows and a larger font for a short sentence than for a long sentence", () => {
    const layout = layoutLyricUnits(
      [
        { text: "Go!", start: 0, end: 1, lineIndex: 0 },
        { text: "abcdefghijklmnopqrstuvwxyz", start: 1, end: 3, lineIndex: 1 },
      ],
      makeOptions(60)
    );
    const shortLines = layout.filter((line) => line.lineIndex === 0);
    const longLines = layout.filter((line) => line.lineIndex === 1);

    expect(shortLines).toHaveLength(1);
    expect(longLines.length).toBeGreaterThan(shortLines.length);
    expect(longLines.length).toBeLessThanOrEqual(5);
    expect(shortLines[0].fontSize).toBeGreaterThan(longLines[0].fontSize);
    expect(longLines.map((line) => line.text).join("")).toBe("abcdefghijklmnopqrstuvwxyz");
  });

  it("treats combining marks as part of one grapheme and preserves the original text", () => {
    const text = "cafe\u0301";
    const layout = layoutLyricUnits([{ text, start: 4, end: 5, lineIndex: 8 }], makeOptions(50));

    expect(layout).toHaveLength(1);
    expect(layout[0].text).toBe(text);
    expect(layout[0].width).toBe(40);
  });

  it("returns an empty layout for an empty input", () => {
    expect(layoutLyricUnits([], makeOptions(160))).toEqual([]);
  });
});
