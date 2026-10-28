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

/**
 * S5-7：镜头自身的线组列表不随时间变化，去重/过滤/排序结果按镜头对象缓存；
 * 每帧只做「相邻组并入」的定量扫描，不再新建 Set + 展开 + sort 的多个副本。
 */
const shotGroupIndexCache = new WeakMap<LyricFilmShot, number[]>();
const visibleGroupScratch: number[] = [];

function resolveShotGroupIndexes(shot: LyricFilmShot, lineGroupCount: number): number[] {
  const cached = shotGroupIndexCache.get(shot);
  if (cached) return cached;
  const indexes: number[] = [];
  for (const index of shot.lineGroupIndices) {
    if (!Number.isInteger(index) || index < 0 || index >= lineGroupCount) continue;
    if (!indexes.includes(index)) indexes.push(index);
  }
  indexes.sort((left, right) => left - right);
  shotGroupIndexCache.set(shot, indexes);
  return indexes;
}

/** Resolve independently timed source lines for the current lyric shot. */
export function resolveLyricFilmLyricRows(
  program: LyricFilmProgram,
  shot: LyricFilmShot,
  musicTime: number
): LyricFilmLyricRow[] {
  if (shot.kind !== "lyrics" || !Number.isFinite(musicTime)) return [];

  const groupIndices = resolveShotGroupIndexes(shot, program.lineGroups.length);
  const focusIndex = findActiveGroupIndex(program.lineGroups, musicTime);
  visibleGroupScratch.length = 0;
  for (const index of groupIndices) visibleGroupScratch.push(index);
  if (focusIndex >= 0) {
    const previousIndex = focusIndex - 1;
    const nextIndex = focusIndex + 1;
    if (previousIndex >= 0 && !visibleGroupScratch.includes(previousIndex)) {
      visibleGroupScratch.push(previousIndex);
    }
    if (nextIndex < program.lineGroups.length && !visibleGroupScratch.includes(nextIndex)) {
      visibleGroupScratch.push(nextIndex);
    }
  }
  visibleGroupScratch.sort((left, right) => left - right);
  const rows: LyricFilmLyricRow[] = [];

  for (const groupIndex of visibleGroupScratch) {
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

  // S5-7：候选比较与相邻间距改用标量运算，去掉每帧的临时数组 / filter / sort。
  const precedingTranslationIndex = findActiveGroupIndex(translationGroups, sourceGroup.start);
  const firstCandidate = translationGroups[precedingTranslationIndex];
  const secondCandidate = translationGroups[precedingTranslationIndex + 1];
  const group =
    firstCandidate && secondCandidate
      ? Math.abs(firstCandidate.start - sourceGroup.start) <=
        Math.abs(secondCandidate.start - sourceGroup.start)
        ? firstCandidate
        : secondCandidate
      : (firstCandidate ?? secondCandidate);
  if (!group) return null;

  const previousSourceStart = sourceGroups[sourceIndex - 1]?.start;
  const nextSourceStart = sourceGroups[sourceIndex + 1]?.start;
  const previousGap = Number.isFinite(previousSourceStart)
    ? sourceGroup.start - previousSourceStart!
    : Infinity;
  const nextGap = Number.isFinite(nextSourceStart)
    ? nextSourceStart! - sourceGroup.start
    : Infinity;
  const nearestNeighborGap = Math.min(
    previousGap > 0 ? previousGap : Infinity,
    nextGap > 0 ? nextGap : Infinity
  );
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

const WHITESPACE = /\s/u;

/** S5-7：逐码点计数代替 Array.from(...).filter(...)，结果完全一致但不再每行分配数组。 */
function estimateLineDuration(text: string): number {
  let visibleCharacters = 0;
  for (const character of text) {
    if (!WHITESPACE.test(character)) visibleCharacters += 1;
  }
  return Math.min(5.8, Math.max(1.2, visibleCharacters * 0.24));
}
