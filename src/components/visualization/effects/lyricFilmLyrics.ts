import type { LyricFilmProgram, LyricFilmShot } from "./lyricFilmProgram";

export type LyricFilmLyricRole = "past" | "active" | "future";

export interface LyricFilmLyricRow {
  id: string;
  groupIndex: number;
  lineIndex: number;
  text: string;
  startTime: number;
  endTime: number;
  revealEndTime: number;
  role: LyricFilmLyricRole;
}

/** Resolve independently timed source lines for the current lyric shot. */
export function resolveLyricFilmLyricRows(
  program: LyricFilmProgram,
  shot: LyricFilmShot,
  musicTime: number
): LyricFilmLyricRow[] {
  if (shot.kind !== "lyrics" || !Number.isFinite(musicTime)) return [];

  const groupIndices = [...new Set(shot.lineGroupIndices)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < program.lineGroups.length)
    .sort((left, right) => left - right);
  const rows: LyricFilmLyricRow[] = [];

  for (const groupIndex of groupIndices) {
    const group = program.lineGroups[groupIndex];
    if (!group || !Number.isFinite(group.start)) continue;

    const nextGroupStart = program.lineGroups[groupIndex + 1]?.start;
    const naturalEnd = Number.isFinite(nextGroupStart)
      ? nextGroupStart!
      : Number.isFinite(shot.lyricEndTime)
        ? shot.lyricEndTime
        : Number.isFinite(program.lyricEndTime)
          ? program.lyricEndTime!
          : shot.endTime;
    const endTime = Math.max(group.start, Math.min(shot.endTime, program.duration, naturalEnd));

    group.lines.forEach((line, lineIndex) => {
      const text = line.text.trim();
      if (!text) return;

      const revealDuration = estimateLineDuration(text);
      const revealEndTime = Math.min(endTime, group.start + revealDuration);
      const role: LyricFilmLyricRole =
        musicTime < group.start ? "future" : musicTime < revealEndTime ? "active" : "past";

      rows.push({
        id: `${groupIndex}:${lineIndex}`,
        groupIndex,
        lineIndex,
        text,
        startTime: group.start,
        endTime,
        revealEndTime,
        role,
      });
    });
  }

  return rows;
}

function estimateLineDuration(text: string): number {
  const visibleCharacters = Array.from(text).filter((character) => !/\s/u.test(character)).length;
  return Math.min(5.8, Math.max(1.2, visibleCharacters * 0.24));
}
