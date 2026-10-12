import { describe, expect, it } from "vitest";
import {
  compileLyricFilmProgram,
  findLyricFilmShotAtTime,
  findLyricFilmShotIndexAtTime,
  type LyricFilmProfile,
  type LyricFilmProgram,
  type LyricFilmShotKind,
  type LyricFilmTransitionKind,
} from "./lyricFilmProgram";
import type { ParsedLyricLine } from "./lyricTimeline";

const lyric = (start: number, text: string, ordinal = 0): ParsedLyricLine => ({
  start,
  text,
  ordinal,
});

const shotKinds = (program: LyricFilmProgram): LyricFilmShotKind[] =>
  program.shots.map((shot) => shot.kind);

describe("compileLyricFilmProgram", () => {
  it("creates contiguous short instrumental shots for a lyric-free song", () => {
    const program = compileLyricFilmProgram([], "instrumental-track", 18);

    expect(program.instrumental).toBe(true);
    expect(program.lineGroups).toEqual([]);
    expect(program.shots.length).toBeGreaterThan(1);
    expect(program.shots.every((shot) => shot.kind === "instrumental")).toBe(true);
    expect(program.shots.every((shot) => shot.lineGroupIndices.length === 0)).toBe(true);
    expect(program.shots.every((shot) => shot.endTime - shot.startTime <= 7)).toBe(true);
    expect(program.shots[0]?.startTime).toBe(0);
    expect(program.shots.at(-1)?.endTime).toBe(18);
    expect(
      program.shots.every(
        (shot, index) => index === 0 || program.shots[index - 1]?.endTime === shot.startTime
      )
    ).toBe(true);
  });

  it("returns an empty program for invalid duration instead of negative or non-finite shots", () => {
    const program = compileLyricFilmProgram([lyric(0, "不应出现")], "invalid-duration", -5);

    expect(program.duration).toBe(0);
    expect(program.shots).toEqual([]);
    expect(findLyricFilmShotAtTime(program, 0)).toBeNull();
  });

  it("filters invalid lyric rows and falls back to instrumental shots", () => {
    const program = compileLyricFilmProgram(
      [lyric(Number.NaN, "坏时间"), lyric(1, "   "), lyric(-2, "负时间"), lyric(20, "超出歌曲")],
      "invalid-rows",
      12
    );

    expect(program.instrumental).toBe(true);
    expect(program.lineGroups).toEqual([]);
    expect(program.shots.every((shot) => shot.kind === "instrumental")).toBe(true);
  });

  it("starts with an unlabelled intro shot when the opening lyric starts after four seconds", () => {
    const program = compileLyricFilmProgram(
      [lyric(5, "第一句", 0), lyric(7, "第二句", 1)],
      "intro",
      12
    );
    const firstShot = program.shots[0];

    expect(firstShot?.kind).toBe("intro");
    expect(firstShot?.startTime).toBe(0);
    expect(firstShot?.endTime).toBe(5);
    expect(firstShot?.lineGroupIndices).toEqual([]);
    expect(program.shots.some((shot) => shot.kind === "lyrics")).toBe(true);
  });

  it("keeps simultaneous lyric rows independent inside one timestamp group", () => {
    const program = compileLyricFilmProgram(
      [lyric(2, "第一条", 0), lyric(2, "第二条", 1), lyric(5, "下一句", 2)],
      "simultaneous",
      10
    );
    const simultaneousGroup = program.lineGroups.find((group) => group.start === 2);

    expect(simultaneousGroup?.lines.map((line) => line.text)).toEqual(["第一条", "第二条"]);
    const timestampGroupIndex = program.lineGroups.findIndex((group) => group.start === 2);
    const simultaneousShot = program.shots.find((shot) =>
      shot.lineGroupIndices.includes(timestampGroupIndex)
    );
    expect(simultaneousShot?.lineGroupIndices).toEqual([timestampGroupIndex]);
  });

  it("uses one or two short timestamp groups per lyric shot", () => {
    const lines = Array.from({ length: 8 }, (_, index) =>
      lyric(index * 1.4, `短句${index}`, index)
    );
    const program = compileLyricFilmProgram(lines, "short-groups", 15);
    const lyricShots = program.shots.filter((shot) => shot.kind === "lyrics");

    expect(lyricShots.length).toBeGreaterThan(1);
    expect(
      lyricShots.every(
        (shot) => shot.lineGroupIndices.length >= 1 && shot.lineGroupIndices.length <= 2
      )
    ).toBe(true);
  });

  it("puts an estimated long lyric row in a shot by itself", () => {
    const program = compileLyricFilmProgram(
      [
        lyric(0, "短句", 0),
        lyric(1.5, "這是一段足夠長而且不能和其他句子擠在同一個鏡頭裡的歌詞", 1),
        lyric(5, "后一句", 2),
      ],
      "long-line",
      12
    );
    const longGroupIndex = program.lineGroups.findIndex((group) => group.start === 1.5);
    const longShot = program.shots.find((shot) => shot.lineGroupIndices.includes(longGroupIndex));

    expect(longShot?.kind).toBe("lyrics");
    expect(longShot?.lineGroupIndices).toEqual([longGroupIndex]);
  });

  it("inserts a lyric-free interlude when the estimated post-line gap is at least four seconds", () => {
    const program = compileLyricFilmProgram(
      [lyric(0, "一句短歌", 0), lyric(10.8, "重新开唱", 1)],
      "bridge",
      14
    );
    const interlude = program.shots.find((shot) => shot.kind === "interlude");

    expect(interlude).toBeDefined();
    expect(interlude?.lineGroupIndices).toEqual([]);
    expect(interlude && interlude.endTime - interlude.startTime).toBeGreaterThanOrEqual(4);
    expect(program.shots.every((shot) => shot.endTime - shot.startTime <= 7)).toBe(true);
  });

  it("keeps every interlude shot within seven seconds when the total gap is just over seven", () => {
    const program = compileLyricFilmProgram(
      [lyric(0, "短句", 0), lyric(9.5, "重新开唱", 1)],
      "seven-second-interlude",
      13
    );
    const interludeShots = program.shots.filter((shot) => shot.kind === "interlude");

    expect(interludeShots.length).toBeGreaterThan(1);
    expect(interludeShots.every((shot) => shot.endTime - shot.startTime <= 7)).toBe(true);
    expect(interludeShots.at(-1)!.endTime - interludeShots[0]!.startTime).toBeGreaterThan(7);
    expect(
      interludeShots.every(
        (shot, index) => index === 0 || interludeShots[index - 1]?.endTime === shot.startTime
      )
    ).toBe(true);
  });

  it("does not create an interlude shorter than four seconds after the lyric hold", () => {
    const program = compileLyricFilmProgram(
      [lyric(0, "一句短歌", 0), lyric(5.2, "重新开唱", 1)],
      "short-bridge",
      10
    );

    expect(program.shots.some((shot) => shot.kind === "interlude")).toBe(false);
  });

  it("starts an outro after the estimated final lyric end and exposes that absolute boundary", () => {
    const program = compileLyricFilmProgram([lyric(2, "最后一句", 0)], "outro", 12);
    const finalLyricShot = program.shots.find((shot) => shot.kind === "lyrics");
    const outro = program.shots.find((shot) => shot.kind === "outro");

    expect(program.lyricEndTime).toBeGreaterThan(2);
    expect(outro).toBeDefined();
    expect(outro?.lineGroupIndices).toEqual([]);
    expect(outro?.startTime).toBeGreaterThan(program.lyricEndTime!);
    expect(finalLyricShot?.endTime).toBe(outro?.startTime);
    expect(findLyricFilmShotAtTime(program, outro!.startTime)?.kind).toBe("outro");
  });

  it("splits a long outro tail into continuous shots no longer than seven seconds", () => {
    const program = compileLyricFilmProgram([lyric(4, "最后一句", 0)], "long-outro", 28);
    const outroShots = program.shots.filter((shot) => shot.kind === "outro");

    expect(outroShots.length).toBeGreaterThan(1);
    expect(outroShots.every((shot) => shot.endTime - shot.startTime <= 7)).toBe(true);
    expect(outroShots.every((shot) => shot.lineGroupIndices.length === 0)).toBe(true);
    expect(outroShots[0]?.startTime).toBeGreaterThan(program.lyricEndTime!);
    expect(outroShots.at(-1)?.endTime).toBe(program.duration);
    expect(
      outroShots.every(
        (shot, index) => index === 0 || outroShots[index - 1]?.endTime === shot.startTime
      )
    ).toBe(true);
  });

  it("keeps lyric shots free of empty line references and within the preferred duration", () => {
    const program = compileLyricFilmProgram(
      [lyric(0, "一", 0), lyric(1, "二", 1), lyric(2, "三", 2), lyric(3, "四", 3)],
      "short-song",
      8
    );
    const lyricsShots = program.shots.filter((shot) => shot.kind === "lyrics");

    expect(lyricsShots.every((shot) => shot.lineGroupIndices.length > 0)).toBe(true);
    expect(lyricsShots.every((shot) => shot.endTime > shot.startTime)).toBe(true);
    expect(lyricsShots.every((shot) => shot.endTime - shot.startTime <= 7)).toBe(true);
  });

  it("uses a stable seed and profile for the same song and shot order", () => {
    const lines = [lyric(0, "第一句", 0), lyric(3, "第二句", 1), lyric(8, "第三句", 2)];
    const first = compileLyricFilmProgram(lines, "stable-song", 14);
    const second = compileLyricFilmProgram(lines, "stable-song", 14);

    expect(second).toEqual(first);
    expect(first.shots.every((shot) => shot.seed.length > 0)).toBe(true);
    expect(first.shots.every((shot) => shot.profile.length > 0)).toBe(true);
  });

  it("avoids repeating adjacent profiles and transition kinds", () => {
    const lines = Array.from({ length: 12 }, (_, index) => lyric(index * 5, `歌词${index}`, index));
    const program = compileLyricFilmProgram(lines, "variety", 64);
    const profiles: LyricFilmProfile[] = program.shots.map((shot) => shot.profile);
    const transitions: LyricFilmTransitionKind[] = program.shots
      .map((shot) => shot.transitionOut?.kind)
      .filter((kind): kind is LyricFilmTransitionKind => kind !== undefined && kind !== null);

    expect(profiles.every((profile, index) => index === 0 || profile !== profiles[index - 1])).toBe(
      true
    );
    expect(transitions.every((kind, index) => index === 0 || kind !== transitions[index - 1])).toBe(
      true
    );
  });

  it("assigns a transition only to shots with a following scene", () => {
    const program = compileLyricFilmProgram(
      [lyric(0, "第一句", 0), lyric(12, "下一句", 1)],
      "transitions",
      18
    );
    const finalShot = program.shots.at(-1);

    expect(program.shots.slice(0, -1).every((shot) => shot.transitionOut !== null)).toBe(true);
    expect(finalShot?.transitionOut).toBeNull();
    expect(
      program.shots
        .filter((shot) => shot.transitionOut)
        .every(
          (shot) =>
            shot.transitionOut!.startTime >= shot.startTime &&
            shot.transitionOut!.endTime === shot.endTime &&
            shot.transitionOut!.endTime > shot.transitionOut!.startTime
        )
    ).toBe(true);
  });

  it("uses absolute time for stable first, interior, and last shot lookup", () => {
    const program = compileLyricFilmProgram(
      [lyric(0, "第一句", 0), lyric(10, "第二句", 1), lyric(19, "第三句", 2)],
      "seek",
      24
    );
    const firstShot = program.shots[0];
    const lastIndex = program.shots.length - 1;

    expect(findLyricFilmShotIndexAtTime(program, 0)).toBe(0);
    expect(findLyricFilmShotAtTime(program, 0)).toEqual(firstShot);
    expect(findLyricFilmShotIndexAtTime(program, program.duration)).toBe(lastIndex);
    expect(findLyricFilmShotAtTime(program, program.duration)).toEqual(program.shots.at(-1));
    expect(findLyricFilmShotIndexAtTime(program, -1)).toBe(0);
    expect(findLyricFilmShotIndexAtTime(program, Number.NaN)).toBe(-1);
    expect(findLyricFilmShotAtTime(program, Number.NaN)).toBeNull();
  });

  it("covers the full song timeline without zero-length or overlapping shots", () => {
    const program = compileLyricFilmProgram(
      [lyric(0, "前句", 0), lyric(12, "后句", 1), lyric(12, "并行副句", 2), lyric(20, "尾句", 3)],
      "timeline",
      28
    );

    expect(program.shots[0]?.startTime).toBe(0);
    expect(program.shots.at(-1)?.endTime).toBe(program.duration);
    expect(program.shots.every((shot) => shot.endTime > shot.startTime)).toBe(true);
    expect(
      program.shots.every(
        (shot, index) => index === 0 || program.shots[index - 1]?.endTime === shot.startTime
      )
    ).toBe(true);
    expect(
      program.shots.every((shot) => shot.startTime >= 0 && shot.endTime <= program.duration)
    ).toBe(true);
    expect(shotKinds(program)).toContain("lyrics");
  });
});
