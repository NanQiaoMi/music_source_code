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

const rowsIn = (layout: Array<{ rowIndex: number }>): number[] =>
  Array.from(new Set(layout.map((item) => item.rowIndex)));

describe("layoutLyricUnits", () => {
  it("keeps timed units in reading order and produces stable, lightly staggered coordinates", () => {
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

  it("keeps Latin timed words intact and shrinks an overwide word to the safe width", () => {
    const units = [
      { text: "go", start: 0, end: 0.4, lineIndex: 7 },
      { text: "now", start: 0.4, end: 0.8, lineIndex: 7 },
      { text: "extraordinarily", start: 0.8, end: 1.8, lineIndex: 7 },
    ];
    const layout = layoutLyricUnits(units, makeOptions(100));

    expect(layout).toHaveLength(units.length);
    expect(layout.map((item) => item.text)).toEqual(units.map((unit) => unit.text));
    expect(layout.map(({ start, end }) => [start, end])).toEqual(
      units.map(({ start, end }) => [start, end])
    );
    expect(layout[2].fontSize).toBeLessThan(20);
    expect(layout.every((item) => item.width <= 84)).toBe(true);
    expect(rowsIn(layout).length).toBeLessThanOrEqual(5);
  });

  it("keeps CJK punctuation on the preceding character's visual row", () => {
    const text = "春风又绿江南岸，明月";
    const units = Array.from(text, (unitText, index) => ({
      text: unitText,
      start: index * 0.2,
      end: (index + 1) * 0.2,
      lineIndex: 2,
    }));
    const layout = layoutLyricUnits(units, makeOptions(100));
    const commaIndex = layout.findIndex((item) => item.text === "，");

    expect(layout.map((item) => item.text).join("")).toBe(text);
    expect(layout[commaIndex - 1].rowIndex).toBe(layout[commaIndex].rowIndex);
    expect(layout[commaIndex + 1].x).toBe(layout[commaIndex].x + layout[commaIndex].width);
    expect(
      layout.every((item, index) => index === 0 || item.rowIndex >= layout[index - 1].rowIndex)
    ).toBe(true);
    expect(rowsIn(layout).length).toBeLessThanOrEqual(5);
  });

  it("keeps each timed unit inside the safe margins of a narrow width", () => {
    const text = "春风又绿江南岸，明月何时照我还";
    const units = Array.from(text, (unitText, index) => ({
      text: unitText,
      start: index,
      end: index + 1,
      lineIndex: 3,
    }));
    const layout = layoutLyricUnits(units, makeOptions(80));

    expect(rowsIn(layout).length).toBeGreaterThanOrEqual(2);
    expect(rowsIn(layout).length).toBeLessThanOrEqual(5);
    expect(layout.every((item) => item.x >= 6.4)).toBe(true);
    expect(layout.every((item) => item.x + item.width <= 73.6)).toBe(true);
    const rowIndexes = layout.map((item) => item.rowIndex);
    expect(rowIndexes).toEqual([...rowIndexes].sort((left, right) => left - right));
  });
  it("uses more rows and a smaller font for a long sequence than for a short sentence", () => {
    const short = layoutLyricUnits(
      [{ text: "Go!", start: 0, end: 1, lineIndex: 0 }],
      makeOptions(60)
    );
    const longUnits = Array.from("abcdefghijklmnopqrstuvwxyz", (text, index) => ({
      text,
      start: index * 0.1,
      end: (index + 1) * 0.1,
      lineIndex: 1,
    }));
    const long = layoutLyricUnits(longUnits, makeOptions(60));

    expect(rowsIn(short)).toHaveLength(1);
    expect(rowsIn(long).length).toBeGreaterThan(rowsIn(short).length);
    expect(rowsIn(long).length).toBeLessThanOrEqual(5);
    expect(short[0].fontSize).toBeGreaterThan(long[0].fontSize);
    expect(long.map((item) => item.text).join("")).toBe("abcdefghijklmnopqrstuvwxyz");
  });

  it("preserves mixed-script words, spacing, and source order", () => {
    const units = [
      { text: "我 ", start: 0, end: 0.4, lineIndex: 9 },
      { text: "love ", start: 0.4, end: 0.8, lineIndex: 9 },
      { text: "音乐。", start: 0.8, end: 1.2, lineIndex: 9 },
    ];
    const layout = layoutLyricUnits(units, makeOptions(200, "mixed-script"));

    expect(layout.map((item) => item.text).join("")).toBe("我 love 音乐。");
    expect(layout.map((item) => item.rowIndex)).toEqual([0, 0, 1]);
    expect(layout[1].x).toBe(layout[0].x + layout[0].width);
    expect(layout[0].y).not.toBe(layout[1].y);
    expect(layout[2].start).toBe(units[2].start);
  });

  it("treats combining marks as part of one grapheme and preserves the timed unit", () => {
    const text = "cafe\u0301";
    const layout = layoutLyricUnits([{ text, start: 4, end: 5, lineIndex: 8 }], makeOptions(50));

    expect(layout).toHaveLength(1);
    expect(layout[0].text).toBe(text);
    expect(layout[0].width).toBe(40);
  });

  it("packs twenty timed CJK character units into at most five rows without changing text or timing", () => {
    const text = "月光照亮静谧湖面星河倒映天际微风轻拂水波";
    const units = Array.from(text, (unitText, index) => ({
      text: unitText,
      start: index * 0.25,
      end: (index + 1) * 0.25,
      lineIndex: 12,
    }));
    const layout = layoutLyricUnits(units, makeOptions(640, "twenty-char-lyric"));

    expect(layout).toHaveLength(units.length);
    expect(layout.map((item) => item.text).join("")).toBe(text);
    expect(layout.map(({ start, end, lineIndex }) => ({ start, end, lineIndex }))).toEqual(
      units.map(({ start, end, lineIndex }) => ({ start, end, lineIndex }))
    );
    expect(rowsIn(layout).length).toBeGreaterThanOrEqual(2);
    expect(rowsIn(layout).length).toBeLessThanOrEqual(5);
    expect(Math.max(...rowsIn(layout))).toBeLessThan(5);
  });

  it("returns an empty layout for an empty input", () => {
    expect(layoutLyricUnits([], makeOptions(160))).toEqual([]);
  });
});
