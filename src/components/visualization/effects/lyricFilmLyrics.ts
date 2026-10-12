import type { LyricFilmProgram, LyricFilmShot } from "./lyricFilmProgram";
import { findActiveGroupIndex, type LyricLineGroup } from "./lyricTimeline";

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
  const focusIndex = findActiveGroupIndex(program.lineGroups, musicTime);
  const visibleGroupIndices = new Set(groupIndices);
  if (focusIndex >= 0) {
    if (focusIndex > 0) visibleGroupIndices.add(focusIndex - 1);
    if (focusIndex + 1 < program.lineGroups.length) visibleGroupIndices.add(focusIndex + 1);
  }
  const rows: LyricFilmLyricRow[] = [];

  for (const groupIndex of [...visibleGroupIndices].sort((left, right) => left - right)) {
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

/** Resolve the translation group aligned to the current LRC time, if one exists. */
export function resolveLyricFilmTranslation(
  translationGroups: readonly LyricLineGroup[],
  sourceGroups: readonly LyricLineGroup[],
  musicTime: number
): string[] | null {
  if (!Number.isFinite(musicTime) || translationGroups.length === 0 || sourceGroups.length === 0) {
    return null;
  }

  const sourceIndex = findActiveGroupIndex(sourceGroups, musicTime);
  const sourceGroup = sourceGroups[sourceIndex];
  if (!sourceGroup) return null;

  const precedingTranslationIndex = findActiveGroupIndex(translationGroups, sourceGroup.start);
  const candidates = [precedingTranslationIndex, precedingTranslationIndex + 1]
    .filter((index) => index >= 0 && index < translationGroups.length)
    .map((index) => translationGroups[index]!)
    .sort(
      (left, right) =>
        Math.abs(left.start - sourceGroup.start) - Math.abs(right.start - sourceGroup.start)
    );
  const group = candidates[0];
  if (!group) return null;

  const previousSourceStart = sourceGroups[sourceIndex - 1]?.start;
  const nextSourceStart = sourceGroups[sourceIndex + 1]?.start;
  const neighborGaps = [
    Number.isFinite(previousSourceStart) ? sourceGroup.start - previousSourceStart! : Infinity,
    Number.isFinite(nextSourceStart) ? nextSourceStart! - sourceGroup.start : Infinity,
  ].filter((gap) => gap > 0);
  const nearestNeighborGap = Math.min(...neighborGaps);
  const alignmentTolerance = Number.isFinite(nearestNeighborGap)
    ? Math.min(1.25, nearestNeighborGap * 0.42)
    : 1.25;
  if (Math.abs(group.start - sourceGroup.start) > alignmentTolerance) return null;

  const estimatedEnd =
    sourceGroup.start + estimateLineDuration(group.lines.map((line) => line.text).join(""));
  const lineEnd = Number.isFinite(nextSourceStart) ? nextSourceStart! : estimatedEnd;
  if (musicTime >= lineEnd) return null;

  const translations = group.lines.map((line) => line.text.trim()).filter(Boolean);
  return translations.length > 0 ? translations : null;
}

function estimateLineDuration(text: string): number {
  const visibleCharacters = Array.from(text).filter((character) => !/\s/u.test(character)).length;
  return Math.min(5.8, Math.max(1.2, visibleCharacters * 0.24));
}
