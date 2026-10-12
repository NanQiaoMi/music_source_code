import { describe, expect, it } from "vitest";
import {
  compileLyricFilmProgram,
  type LyricFilmProgram,
  type LyricFilmShot,
} from "./lyricFilmProgram";
import { resolveLyricFilmLyricRows, resolveLyricFilmTranslation } from "./lyricFilmLyrics";
import { groupLyricsByStart, parseTimedLyrics } from "./lyricTimeline";

describe("resolveLyricFilmLyricRows", () => {
  it("keeps simultaneous source lines independent in the lyric window", () => {
    const program = compileLyricFilmProgram(
      [
        { start: 2, text: "原句", ordinal: 0 },
        { start: 2, text: "Parallel line", ordinal: 1 },
      ],
      "parallel-lines",
      12
    );
    const shot = program.shots.find((candidate) => candidate.kind === "lyrics")!;

    const rows = resolveLyricFilmLyricRows(program, shot, 2.4);

    expect(rows.map((row) => row.text)).toEqual(["原句", "Parallel line"]);
    expect(rows.map((row) => row.role)).toEqual(["active", "active"]);
    expect(rows.slice(0, 2).every((row) => row.groupIndex === rows[0]?.groupIndex)).toBe(true);
    expect(rows.some((row) => row.text.includes(" / "))).toBe(false);
  });

  it("caps each line reveal at the next timestamp group and resolves by absolute time", () => {
    const program = compileLyricFilmProgram(
      [
        { start: 0, text: "这句话在下一句前还没有显完", ordinal: 0 },
        { start: 2, text: "短句", ordinal: 1 },
      ],
      "line-boundaries",
      8
    );
    const shot = program.shots.find((candidate) => candidate.kind === "lyrics")!;
    const rows = resolveLyricFilmLyricRows(program, shot, 1.5);
    const firstLine = rows.find((row) => row.groupIndex === 0)!;
    const secondLine = rows.find((row) => row.groupIndex === 1)!;

    expect(firstLine.revealEndTime).toBeLessThanOrEqual(2);
    expect(firstLine.role).toBe("active");
    expect(secondLine.role).toBe("future");
    expect(
      resolveLyricFilmLyricRows(program, shot, 2.2).find((row) => row.groupIndex === 1)?.role
    ).toBe("active");
  });

  it("returns no text for stage-only shots and ignores invalid group references", () => {
    const program: LyricFilmProgram = {
      version: 1,
      seed: "empty",
      duration: 4,
      instrumental: true,
      lyricEndTime: null,
      lineGroups: [],
      shots: [],
    };
    const interlude: LyricFilmShot = {
      id: "interlude",
      seed: "empty:shot:0",
      kind: "interlude",
      profile: "motes",
      startTime: 0,
      endTime: 4,
      lyricEndTime: 4,
      lineGroupIndices: [99],
      transitionOut: null,
    };

    expect(resolveLyricFilmLyricRows(program, interlude, 1)).toEqual([]);
  });

  it("keeps one nearby line on either side of the active lyric window", () => {
    const program = compileLyricFilmProgram(
      [
        { start: 1, text: "第一句", ordinal: 0 },
        { start: 4, text: "第二句", ordinal: 1 },
        { start: 7, text: "第三句", ordinal: 2 },
        { start: 10, text: "第四句", ordinal: 3 },
      ],
      "lyric-window-neighbors",
      14
    );
    const laterShot = program.shots.find((candidate) => candidate.lineGroupIndices.includes(2))!;

    const rows = resolveLyricFilmLyricRows(program, laterShot, 7.2);

    expect(rows.map((row) => row.text)).toEqual(["第二句", "第三句", "第四句"]);
    expect(rows.map((row) => row.role)).toEqual(["past", "active", "future"]);
  });

  it("shows only the timed translation currently in its line window", () => {
    const sourceGroups = groupLyricsByStart(
      parseTimedLyrics("[00:02.00]First source line\n[00:05.00]Second source line")
    );
    const translationGroups = groupLyricsByStart(
      parseTimedLyrics("[00:02.25]第一句译文\n[00:05.20]第二句译文")
    );

    expect(resolveLyricFilmTranslation(translationGroups, sourceGroups, 1.9)).toBeNull();
    expect(resolveLyricFilmTranslation(translationGroups, sourceGroups, 3)).toEqual(["第一句译文"]);
    expect(resolveLyricFilmTranslation(translationGroups, sourceGroups, 5)).toEqual(["第二句译文"]);
    expect(resolveLyricFilmTranslation(translationGroups, sourceGroups, 8)).toBeNull();
  });

  it("hides translations that are missing or timestamped against another source line", () => {
    const sourceGroups = groupLyricsByStart(
      parseTimedLyrics("[00:10]Source line one\n[00:12]Source line two")
    );
    const translationGroups = groupLyricsByStart(
      parseTimedLyrics("[00:10]第一句译文\n[00:20]旧译文")
    );

    expect(resolveLyricFilmTranslation(translationGroups, sourceGroups, 10.5)).toEqual([
      "第一句译文",
    ]);
    expect(resolveLyricFilmTranslation(translationGroups, sourceGroups, 12.5)).toBeNull();
  });
});
