import { describe, expect, it } from "vitest";
import {
  compileLyricFilmProgram,
  type LyricFilmProgram,
  type LyricFilmShot,
} from "./lyricFilmProgram";
import { resolveLyricFilmLyricRows } from "./lyricFilmLyrics";

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
});
