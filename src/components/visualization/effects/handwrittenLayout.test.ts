import { describe, expect, it } from "vitest";
import { compileLyricFilmProgram, findLyricFilmShotAtTime } from "./lyricFilmProgram";
import { parseTimedLyrics } from "./lyricTimeline";
import {
  layoutHandwrittenPlainText,
  prepareHandwrittenUnits,
  wrapHandwrittenPhrase,
} from "./handwrittenLayout";

describe("handwritten lyric layout", () => {
  const measure = (text: string) => Array.from(text).length * 10;

  it("wraps an overlong English unit at grapheme boundaries without losing lyric time", () => {
    const lyric = "Supercalifragilistic，🙂‍↔️继续。";
    const units = prepareHandwrittenUnits(
      [
        { text: "Supercalifragilistic", start: 4, end: 6, lineIndex: 0 },
        { text: "，", start: 6, end: 6.2, lineIndex: 0 },
        { text: "🙂‍↔️", start: 6.2, end: 6.6, lineIndex: 0 },
        { text: "继续。", start: 6.6, end: 8, lineIndex: 0 },
      ],
      50,
      measure
    );
    const lines = wrapHandwrittenPhrase(units, 50, null);

    expect(lines.flatMap((line) => line.items.map((item) => item.text)).join("")).toBe(lyric);
    expect(lines.every((line) => line.width <= 50)).toBe(true);
    expect(units.some((unit) => unit.text === "🙂‍↔️")).toBe(true);
    expect(units[0]?.start).toBe(4);
    expect(units.at(-1)?.end).toBe(8);
    expect(units.every((unit) => unit.start <= unit.end)).toBe(true);
  });

  it("reserves the scaled emphasis advance before placing following words", () => {
    const units = [
      { text: "主", width: 40, start: 0, end: 1 },
      { text: "词", width: 40, start: 1, end: 2 },
      { text: "后", width: 20, start: 2, end: 3 },
    ];
    const lines = wrapHandwrittenPhrase(units, 100, {
      unitIndex: 0,
      unitCount: 2,
      scaleBoost: 1.2,
    });

    expect(lines).toHaveLength(2);
    expect(lines[0]?.width).toBe(96);
    expect(lines[0]?.items.map((item) => item.scaleBoost)).toEqual([1.2, 1.2]);
    expect(lines[1]?.items.map((item) => item.text)).toEqual(["后"]);
  });

  it("keeps punctuation repair pairs and every emitted line within the safe measure", () => {
    const closingUnits = [
      { text: "余", width: 4, start: 0, end: 0.2 },
      { text: "longword", width: 45, start: 0.2, end: 1.8 },
      { text: "，", width: 10, start: 1.8, end: 2 },
    ];
    const openingUnits = [
      { text: "前", width: 10, start: 0, end: 0.3 },
      { text: "“", width: 4, start: 0.3, end: 0.4 },
      { text: "longword", width: 48, start: 0.4, end: 1.8 },
      { text: "后", width: 12, start: 1.8, end: 2 },
    ];

    for (const units of [closingUnits, openingUnits]) {
      const lines = wrapHandwrittenPhrase(units, 50, null);
      expect(lines.every((line) => line.width <= 50)).toBe(true);
      expect(lines.flatMap((line) => line.items.map((item) => item.text)).join("")).toBe(
        units.map((unit) => unit.text).join("")
      );
    }
  });

  it("caps a single emphasized unit when its enlargement alone would overflow", () => {
    const lines = wrapHandwrittenPhrase([{ text: "焦", width: 45, start: 0, end: 1 }], 50, {
      unitIndex: 0,
      unitCount: 1,
      scaleBoost: 1.2,
    });

    expect(lines[0]?.width).toBeLessThanOrEqual(50);
    expect(lines[0]?.items[0]?.scaleBoost).toBeCloseTo(50 / 45);
  });

  it("balances a long lyric around phrase pauses without splitting Chinese word units", () => {
    const units = ["微", "微", "笑 ", "小", "时", "候", "的", "梦 ", "我", "知", "道"].map(
      (text, index) => ({ text, width: Array.from(text).length * 10, start: index, end: index + 1 })
    );
    const lines = wrapHandwrittenPhrase(units, 80, null);
    const lineTexts = lines.map((line) => line.items.map((item) => item.text).join(""));
    const widths = lines.map((line) => line.width);

    expect(lineTexts.join("")).toBe("微微笑 小时候的梦 我知道");
    expect(lineTexts).toHaveLength(3);
    expect(lineTexts[0]).toContain("微微笑");
    expect(lineTexts.some((text) => text.includes("小时候"))).toBe(true);
    expect(lineTexts.some((text) => text.includes("我知道"))).toBe(true);
    expect(lines.every((line) => line.width <= 80)).toBe(true);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(30);
    expect(lines.at(-1)?.items.length).toBeGreaterThan(1);
  });

  it("keeps CJK closing punctuation with the preceding phrase when wrapping", () => {
    const units = [
      { text: "潮", width: 30, start: 0, end: 1 },
      { text: "声", width: 30, start: 1, end: 2 },
      { text: "，", width: 10, start: 2, end: 2.2 },
      { text: "远", width: 30, start: 2.2, end: 3 },
    ];
    const lines = wrapHandwrittenPhrase(units, 70, null);

    expect(lines[0]?.items.map((item) => item.text)).toEqual(["潮", "声", "，"]);
    expect(lines[1]?.items.map((item) => item.text)).toEqual(["远"]);
    expect(lines.map((line) => line.items.map((item) => item.text).join("")).join("")).toBe(
      "潮声，远"
    );
  });

  it("wraps long static copy without losing mixed-script graphemes", () => {
    const text = "A deliberately long English line，月光慢慢落在旧窗边🙂‍↔️再写一行。";
    const lines = layoutHandwrittenPlainText(text, 90, measure);

    expect(lines.flatMap((line) => line.items.map((item) => item.text)).join("")).toBe(text);
    expect(lines.every((line) => line.width <= 90)).toBe(true);
    expect(lines.flatMap((line) => line.items).some((item) => item.text === "🙂‍↔️")).toBe(true);
  });

  it("keeps a long lyric visible during a generated sparse-LRC interlude", () => {
    const lyric = "风从旧书页间穿过，带走窗台上最后一束微光与沉默。";
    const program = compileLyricFilmProgram(
      parseTimedLyrics(`[00:01.00]${lyric}\n[00:14.00]月光慢慢落下`),
      "sparse-interlude-layout",
      24
    );
    const shot = findLyricFilmShotAtTime(program, 8);
    const previousGroup = [...program.lineGroups]
      .reverse()
      .find((group) => group.start <= (shot?.startTime ?? 0) + 0.05);
    const echo = previousGroup?.lines.at(-1)?.text ?? "";
    const lines = layoutHandwrittenPlainText(echo, 120, measure);

    expect(shot?.kind).toBe("interlude");
    expect(echo).toBe(lyric);
    expect(lines.flatMap((line) => line.items.map((item) => item.text)).join("")).toBe(lyric);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.width <= 120)).toBe(true);
  });

  it("falls back safely for thousands of graphemes while preserving bounded rows", () => {
    const text = "秋".repeat(2400);
    const lines = layoutHandwrittenPlainText(text, 80, measure);

    expect(lines.flatMap((line) => line.items.map((item) => item.text)).join("")).toBe(text);
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.every((line) => line.width <= 80)).toBe(true);
  });
});
