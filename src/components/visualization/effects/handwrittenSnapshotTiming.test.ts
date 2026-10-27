import { describe, expect, it } from "vitest";
import { compileLyricFilmProgram } from "./lyricFilmProgram";
import { resolveLyricFilmLyricRows, resolveLyricFilmTranslation } from "./lyricFilmLyrics";
import {
  resolveHandwrittenRowMode,
  resolveHandwrittenSnapshotTime,
  resolveHandwrittenTranslationTime,
} from "./handwrittenMotion";
import { estimateLineUnits, groupLyricsByStart, parseTimedLyrics } from "./lyricTimeline";

describe("canonical outgoing lyric snapshot", () => {
  it.each([
    {
      name: "fast short phrases",
      lrc: "[00:00.00]短句\n[00:00.00]同拍的副句\n[00:00.00]第三行\n[00:01.00]下一句",
      expected: "短句同拍的副句第三行",
    },
    {
      name: "a long phrase clipped by the next LRC group",
      lrc: "[00:00.00]A deliberately long lyric phrase that needs the full final beat\n[00:04.00]the next lyric",
      expected: "A deliberately long lyric phrase that needs the full final beat",
    },
  ])("shows every grapheme at the page turn for $name", ({ lrc, expected }) => {
    const program = compileLyricFilmProgram(parseTimedLyrics(lrc), "snapshot-fixture", 18);
    const outgoing = program.shots.find(
      (shot) => shot.kind === "lyrics" && shot.transitionOut !== null
    );
    expect(outgoing?.transitionOut).toBeDefined();
    expect(outgoing).toBeDefined();

    const shot = outgoing!;
    const transition = shot.transitionOut!;
    const selectedGroups = new Set(shot.lineGroupIndices);
    const rowsAtTransitionStart = resolveLyricFilmLyricRows(
      program,
      shot,
      transition.startTime
    ).filter((row) => selectedGroups.has(row.groupIndex));
    const latestRevealEnd = Math.max(...rowsAtTransitionStart.map((row) => row.revealEndTime));
    expect(latestRevealEnd).toBeGreaterThan(transition.startTime);

    const snapshotTime = resolveHandwrittenSnapshotTime(
      transition.startTime,
      transition.endTime,
      latestRevealEnd
    );
    const snapshotRows = resolveLyricFilmLyricRows(program, shot, snapshotTime).filter((row) =>
      selectedGroups.has(row.groupIndex)
    );
    const units = snapshotRows.flatMap((row) =>
      estimateLineUnits(row.text, row.startTime, row.revealEndTime, row.lineIndex)
    );

    expect(snapshotRows.map((row) => row.text).join("")).toBe(expected);
    expect(units.map((unit) => unit.text).join("")).toBe(expected);
    expect(units.every((unit) => unit.end <= snapshotTime)).toBe(true);
  });

  it("keeps the first simultaneous LRC group hidden before its exact start", () => {
    const program = compileLyricFilmProgram(
      parseTimedLyrics("[00:02.50]天色还未明\n[00:02.50]另一行同时写\n[00:05.20]窗边有微光"),
      "early-simultaneous-lyrics",
      16
    );
    const shot = program.shots.find((candidate) => candidate.kind === "lyrics");
    expect(shot).toBeDefined();

    const beforeRows = resolveLyricFilmLyricRows(program, shot!, 0).filter(
      (row) => row.groupIndex === 0
    );
    expect(beforeRows).toHaveLength(2);
    expect(beforeRows.every((row) => row.role === "future")).toBe(true);
    expect(
      beforeRows.every(
        (row) =>
          resolveHandwrittenRowMode(2.49, row.startTime, program.lineGroups[0]!.start) === "future"
      )
    ).toBe(true);

    const atStartRows = resolveLyricFilmLyricRows(program, shot!, 2.5).filter(
      (row) => row.groupIndex === 0
    );
    expect(atStartRows).toHaveLength(2);
    expect(atStartRows.every((row) => row.role === "active")).toBe(true);
    expect(
      atStartRows.every(
        (row) =>
          resolveHandwrittenRowMode(2.5, row.startTime, program.lineGroups[0]!.start) === "active"
      )
    ).toBe(true);
  });

  it("uses the previous source and translation group at the outgoing shot boundary", () => {
    const sourceGroups = groupLyricsByStart(
      parseTimedLyrics("[00:00.00]A long outgoing line\n[00:12.00]Next incoming line")
    );
    const translationGroups = groupLyricsByStart(
      parseTimedLyrics("[00:00.00]旧句译文\n[00:12.00]新句译文")
    );
    const shotEndTime = 12;
    const outgoingSelectionTime = resolveHandwrittenTranslationTime(shotEndTime, shotEndTime, true);

    expect(resolveLyricFilmTranslation(translationGroups, sourceGroups, shotEndTime)).toEqual([
      "新句译文",
    ]);
    expect(
      resolveLyricFilmTranslation(translationGroups, sourceGroups, outgoingSelectionTime)
    ).toEqual(["旧句译文"]);
  });
});
