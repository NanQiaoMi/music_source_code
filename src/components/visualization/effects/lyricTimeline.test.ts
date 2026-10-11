import { afterEach, describe, expect, it, vi } from "vitest";
import {
  estimateLineUnits,
  findActiveGroupIndex,
  groupLyricsByStart,
  parseTimedLyrics,
} from "./lyricTimeline";

describe("parseTimedLyrics", () => {
  it("parses standard LRC timestamps, filters metadata, and ignores offsets", () => {
    const parsed = parseTimedLyrics(
      [
        "[00:00.00] 作词 : 方文山",
        "[00:03.000]较晚",
        "[00:01.00][00:03.000]重复",
        "[00:01.00]别句",
        "[00:01.00]重复",
        "[00:02.50][00:02.50]保留",
        "[00:01.50] 作曲 : 周杰伦",
        "[offset:-100]",
        "[ar:歌手]",
        "未标记的纯文本",
      ].join("\r\n")
    );

    expect(parsed).toEqual([
      { start: 1, text: "重复", ordinal: 1 },
      { start: 1, text: "别句", ordinal: 3 },
      { start: 2.5, text: "保留", ordinal: 5 },
      { start: 3, text: "较晚", ordinal: 0 },
      { start: 3, text: "重复", ordinal: 2 },
    ]);
  });

  it("returns an empty list for empty, malformed, or untimed input", () => {
    expect(parseTimedLyrics("")).toEqual([]);
    expect(parseTimedLyrics("   \n\r\n")).toEqual([]);
    expect(parseTimedLyrics("not an LRC line\n[offset:300]")).toEqual([]);
    expect(parseTimedLyrics("[99:xx]broken timestamp")).toEqual([]);
  });
});

describe("groupLyricsByStart", () => {
  it("sorts start times, preserves source order within ties, and removes duplicate text", () => {
    const groups = groupLyricsByStart([
      { start: 3, text: "第三句", ordinal: 0 },
      { start: 1, text: "后写", ordinal: 2 },
      { start: 1, text: "先写", ordinal: 1 },
      { start: 1, text: "先写", ordinal: 3 },
      { start: 2, text: "第二句", ordinal: 4 },
    ]);

    expect(groups).toEqual([
      {
        start: 1,
        lines: [
          { start: 1, text: "先写", ordinal: 1 },
          { start: 1, text: "后写", ordinal: 2 },
        ],
      },
      { start: 2, lines: [{ start: 2, text: "第二句", ordinal: 4 }] },
      { start: 3, lines: [{ start: 3, text: "第三句", ordinal: 0 }] },
    ]);
  });

  it("keeps identical text when it occurs at different start times", () => {
    expect(
      groupLyricsByStart([
        { start: 2, text: "副歌", ordinal: 1 },
        { start: 1, text: "副歌", ordinal: 0 },
      ])
    ).toHaveLength(2);
  });
});

describe("findActiveGroupIndex", () => {
  const groups = [
    { start: 1, lines: [{ start: 1, text: "一", ordinal: 0 }] },
    { start: 2.5, lines: [{ start: 2.5, text: "二", ordinal: 1 }] },
    { start: 8, lines: [{ start: 8, text: "三", ordinal: 2 }] },
  ];

  it("selects the latest group at or before the music time", () => {
    expect(findActiveGroupIndex(groups, 0.99)).toBe(-1);
    expect(findActiveGroupIndex(groups, 1)).toBe(0);
    expect(findActiveGroupIndex(groups, 7.99)).toBe(1);
    expect(findActiveGroupIndex(groups, 8)).toBe(2);
  });

  it("returns no active group for empty input or a non-finite time", () => {
    expect(findActiveGroupIndex([], 2)).toBe(-1);
    expect(findActiveGroupIndex(groups, Number.NaN)).toBe(-1);
  });
});

describe("estimateLineUnits", () => {
  it("keeps CJK graphemes separate and attaches punctuation and spaces", () => {
    const units = estimateLineUnits("你好, world! 再见。", 2, 8, 4);

    expect(units.map((unit) => unit.text)).toEqual(["你", "好, ", "world! ", "再", "见。"]);
    expect(units.every((unit) => unit.lineIndex === 4)).toBe(true);
  });

  it("keeps emoji and combining sequences intact with Intl.Segmenter unavailable", () => {
    vi.stubGlobal("Intl", { Segmenter: undefined });
    const text = "A👩‍👩‍👧‍👦e\u0301!";

    try {
      expect(estimateLineUnits(text, 0, 3, 0).map((unit) => unit.text)).toEqual([
        "A",
        "👩‍👩‍👧‍👦",
        "e\u0301!",
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses one whole-line unit for spans shorter than 0.18 seconds", () => {
    expect(estimateLineUnits("一句完整歌词", 4, 4.17, 2)).toEqual([
      { text: "一句完整歌词", start: 4, end: 4.17, lineIndex: 2 },
    ]);
  });

  it("groups short spans into a few units while preserving the complete line", () => {
    const text = "春夏秋冬春夏秋冬";
    const units = estimateLineUnits(text, 1, 1.36, 7);
    const lowerBoundaryUnits = estimateLineUnits(text, 1, 1.18, 7);
    const upperBoundaryUnits = estimateLineUnits(text, 2, 2.45, 7);

    expect(units.length).toBeGreaterThan(1);
    expect(units.length).toBeLessThanOrEqual(3);
    expect(units.map((unit) => unit.text).join("")).toBe(text);
    expect(units[0].start).toBe(1);
    expect(units.at(-1)?.end).toBe(1.36);
    expect(lowerBoundaryUnits.length).toBe(2);
    expect(upperBoundaryUnits.length).toBeLessThanOrEqual(3);
  });

  it("weights punctuation pauses and keeps every unit inside the supplied line boundary", () => {
    const units = estimateLineUnits("你，好", 3, 4, 9);

    expect(units.map((unit) => unit.text)).toEqual(["你，", "好"]);
    expect(units[0].end - units[0].start).toBeGreaterThan(0.5);
    expect(units[0].start).toBe(3);
    expect(units.at(-1)?.end).toBe(4);
    expect(units.every((unit) => unit.lineIndex === 9)).toBe(true);
    expect(
      units.every(
        (unit, index) =>
          unit.start >= 3 &&
          unit.end <= 4 &&
          unit.end >= unit.start &&
          (index === 0 || unit.start === units[index - 1].end)
      )
    ).toBe(true);
  });

  it("returns no units for empty text or invalid time boundaries", () => {
    expect(estimateLineUnits("", 0, 1, 0)).toEqual([]);
    expect(estimateLineUnits("歌词", 2, 1, 0)).toEqual([]);
    expect(estimateLineUnits("歌词", Number.NaN, 3, 0)).toEqual([]);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
