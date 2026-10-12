import type { LyricLineGroup, ParsedLyricLine } from "./lyricTimeline";

export type LyricFilmProfile =
  | "spotlight"
  | "prism"
  | "window"
  | "caustic"
  | "botanical"
  | "astral"
  | "motes";

export type LyricFilmTransitionKind = "lights-out" | "flare-cut" | "focus-pull";

export type LyricFilmShotKind = "intro" | "lyrics" | "interlude" | "instrumental" | "outro";

export interface LyricFilmTransition {
  kind: LyricFilmTransitionKind;
  startTime: number;
  endTime: number;
}

export interface LyricFilmShot {
  id: string;
  seed: string;
  kind: LyricFilmShotKind;
  profile: LyricFilmProfile;
  startTime: number;
  endTime: number;
  lyricEndTime: number;
  lineGroupIndices: number[];
  transitionOut: LyricFilmTransition | null;
}

export interface LyricFilmProgram {
  version: 1;
  seed: string;
  duration: number;
  instrumental: boolean;
  lyricEndTime: number | null;
  lineGroups: LyricLineGroup[];
  shots: LyricFilmShot[];
}

interface TimedGroup {
  index: number;
  startTime: number;
  lyricEndTime: number;
  lineCount: number;
  isLong: boolean;
}

interface ShotDraft {
  kind: LyricFilmShotKind;
  startTime: number;
  endTime: number;
  lyricEndTime: number;
  lineGroupIndices: number[];
}

const MAX_SHOT_DURATION = 7;
const MAX_LINES_PER_SHOT = 2;
const LONG_LINE_DURATION = 3.6;
const BRIDGE_GAP = 4;
const BRIDGE_HOLD = 0.6;
const OUTRO_CARD_DURATION = 7;

const PROFILES: readonly LyricFilmProfile[] = [
  "spotlight",
  "prism",
  "window",
  "caustic",
  "botanical",
  "astral",
  "motes",
];
const QUIET_PROFILES: readonly LyricFilmProfile[] = ["window", "caustic", "astral", "motes"];
const TRANSITIONS: readonly LyricFilmTransitionKind[] = ["lights-out", "flare-cut", "focus-pull"];

/** Compile LRC starts into a deterministic, seekable sequence of stage shots. */
export function compileLyricFilmProgram(
  lines: readonly ParsedLyricLine[],
  seed: string | number | undefined,
  duration: number
): LyricFilmProgram {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const resolvedSeed = String(seed ?? "lyric-film");
  const lineGroups = safeDuration > 0 ? groupValidLines(lines, safeDuration) : [];

  if (safeDuration === 0) {
    return {
      version: 1,
      seed: resolvedSeed,
      duration: 0,
      instrumental: lineGroups.length === 0,
      lyricEndTime: null,
      lineGroups,
      shots: [],
    };
  }

  if (lineGroups.length === 0) {
    const shots = assignShotIdentityAndTransitions(
      planInstrumentalShots(safeDuration),
      resolvedSeed
    );
    return createProgram(resolvedSeed, safeDuration, true, null, [], shots);
  }

  const timedGroups = buildTimedGroups(lineGroups, safeDuration);
  const lyricEndTime = timedGroups.reduce(
    (latest, group) => Math.max(latest, group.lyricEndTime),
    0
  );
  const drafts = planLyricShots(timedGroups, safeDuration);
  const shots = assignShotIdentityAndTransitions(drafts, resolvedSeed);

  return createProgram(resolvedSeed, safeDuration, false, lyricEndTime, lineGroups, shots);
}

/** Find the shot at an absolute music time; exact boundaries select the later shot. */
export function findLyricFilmShotIndexAtTime(program: LyricFilmProgram, time: number): number {
  const { shots } = program;
  if (!Number.isFinite(time) || shots.length === 0) return -1;
  if (time <= shots[0]!.startTime) return 0;
  if (time >= program.duration) return shots.length - 1;

  let low = 0;
  let high = shots.length - 1;
  let activeIndex = -1;

  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    if (shots[middle]!.startTime <= time) {
      activeIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return activeIndex;
}

export function findLyricFilmShotAtTime(
  program: LyricFilmProgram,
  time: number
): LyricFilmShot | null {
  const index = findLyricFilmShotIndexAtTime(program, time);
  return index < 0 ? null : (program.shots[index] ?? null);
}

function createProgram(
  seed: string,
  duration: number,
  instrumental: boolean,
  lyricEndTime: number | null,
  lineGroups: LyricLineGroup[],
  shots: LyricFilmShot[]
): LyricFilmProgram {
  return { version: 1, seed, duration, instrumental, lyricEndTime, lineGroups, shots };
}

function groupValidLines(lines: readonly ParsedLyricLine[], duration: number): LyricLineGroup[] {
  const sorted = lines
    .map((line, sourceIndex) => ({ line, sourceIndex }))
    .filter(
      ({ line }) =>
        line !== null &&
        Number.isFinite(line.start) &&
        line.start >= 0 &&
        line.start < duration &&
        typeof line.text === "string" &&
        line.text.trim().length > 0
    )
    .sort((left, right) => {
      const startDifference = left.line.start - right.line.start;
      if (startDifference !== 0) return startDifference;

      const leftOrdinal = Number.isFinite(left.line.ordinal) ? left.line.ordinal : left.sourceIndex;
      const rightOrdinal = Number.isFinite(right.line.ordinal)
        ? right.line.ordinal
        : right.sourceIndex;
      return leftOrdinal - rightOrdinal || left.sourceIndex - right.sourceIndex;
    });

  const groups: LyricLineGroup[] = [];
  for (const { line } of sorted) {
    let group = groups[groups.length - 1];
    if (!group || group.start !== line.start) {
      group = { start: line.start, lines: [] };
      groups.push(group);
    }
    group.lines.push(line);
  }

  return groups;
}

function buildTimedGroups(groups: readonly LyricLineGroup[], duration: number): TimedGroup[] {
  return groups.map((group, index) => {
    const nextStart = groups[index + 1]?.start ?? duration;
    const availableDuration = Math.max(0, Math.min(nextStart, duration) - group.start);
    const estimatedLineDurations = group.lines.map((line) => estimateLineDuration(line.text));
    const lineDurations = estimatedLineDurations.map((lineDuration) =>
      Math.min(lineDuration, availableDuration)
    );
    const estimatedDuration = Math.max(0, ...lineDurations);

    return {
      index,
      startTime: group.start,
      lyricEndTime: Math.min(duration, group.start + estimatedDuration),
      lineCount: group.lines.length,
      isLong: estimatedLineDurations.some((lineDuration) => lineDuration >= LONG_LINE_DURATION),
    };
  });
}

function estimateLineDuration(text: string): number {
  const visibleCharacters = Array.from(text.trim()).filter(
    (character) => !/\s/u.test(character)
  ).length;
  return clamp(visibleCharacters * 0.24, 1.2, 5.8);
}

function planLyricShots(groups: readonly TimedGroup[], duration: number): ShotDraft[] {
  const introStart = groups[0]!.startTime;
  const hasIntro = introStart >= BRIDGE_GAP;
  const drafts: ShotDraft[] = [];

  if (hasIntro) {
    drafts.push(...splitEmptyRange("intro", 0, introStart));
  }

  const lyricGroups = groupShortLines(groups);
  for (let index = 0; index < lyricGroups.length; index += 1) {
    const groupIndices = lyricGroups[index]!;
    const firstGroup = groups[groupIndices[0]!]!;
    const startTime = index === 0 && !hasIntro ? 0 : firstGroup.startTime;
    const lyricEndTime = Math.max(
      ...groupIndices.map((groupIndex) => groups[groupIndex]!.lyricEndTime)
    );
    const nextStart = lyricGroups[index + 1]
      ? groups[lyricGroups[index + 1]![0]!]!.startTime
      : duration;
    const isFinalGroup = index === lyricGroups.length - 1;
    const lyricHoldEnd = Math.min(duration, Math.max(startTime, lyricEndTime + BRIDGE_HOLD));
    const interludeDuration = Math.max(0, nextStart - lyricHoldEnd);
    const hasInterlude = !isFinalGroup && interludeDuration >= BRIDGE_GAP;
    const endTime = hasInterlude || isFinalGroup ? lyricHoldEnd : Math.max(startTime, nextStart);

    if (endTime > startTime) {
      drafts.push({
        kind: "lyrics",
        startTime,
        endTime,
        lyricEndTime,
        lineGroupIndices: groupIndices,
      });
    }

    if (hasInterlude) {
      drafts.push(...splitEmptyRange("interlude", lyricHoldEnd, nextStart));
    } else if (isFinalGroup && endTime < duration) {
      drafts.push(...planOutro(lyricEndTime, duration));
    }
  }

  return ensureTimelineCoverage(drafts, duration);
}

function groupShortLines(groups: readonly TimedGroup[]): number[][] {
  const drafts: number[][] = [];
  let current: number[] = [];
  let currentLineCount = 0;
  let currentHasLongLine = false;

  const flush = () => {
    if (current.length > 0) drafts.push(current);
    current = [];
    currentLineCount = 0;
    currentHasLongLine = false;
  };

  for (const group of groups) {
    const groupStart = current.length > 0 ? groups[current[0]!]!.startTime : group.startTime;
    const currentEnd =
      current.length > 0
        ? Math.max(...current.map((index) => groups[index]!.lyricEndTime))
        : group.lyricEndTime;
    const interludeDuration = group.startTime - currentEnd - BRIDGE_HOLD;
    const candidateDuration = group.lyricEndTime - groupStart;
    const wouldExceedLineCount = currentLineCount + group.lineCount > MAX_LINES_PER_SHOT;
    const wouldExceedDuration = candidateDuration > MAX_SHOT_DURATION;
    const shouldSeparate =
      current.length > 0 &&
      (currentHasLongLine ||
        group.isLong ||
        wouldExceedLineCount ||
        wouldExceedDuration ||
        interludeDuration >= BRIDGE_GAP);

    if (shouldSeparate) flush();

    current.push(group.index);
    currentLineCount += group.lineCount;
    currentHasLongLine = currentHasLongLine || group.isLong;

    if (group.isLong || group.lineCount > MAX_LINES_PER_SHOT) flush();
  }

  flush();
  return drafts;
}

function planInstrumentalShots(duration: number): ShotDraft[] {
  return splitEmptyRange("instrumental", 0, duration);
}

function planOutro(lyricEndTime: number, duration: number): ShotDraft[] {
  const startTime = Math.min(duration, lyricEndTime + BRIDGE_HOLD);
  if (startTime >= duration) return [];

  const cardStartTime = Math.max(startTime, duration - OUTRO_CARD_DURATION);
  return [
    ...splitEmptyRange("interlude", startTime, cardStartTime),
    ...splitEmptyRange("outro", cardStartTime, duration),
  ].map((shot) => ({ ...shot, lyricEndTime }));
}

function splitEmptyRange(
  kind: "intro" | "interlude" | "instrumental" | "outro",
  start: number,
  end: number
): ShotDraft[] {
  const length = end - start;
  if (!Number.isFinite(length) || length <= 0) return [];

  const count = Math.max(1, Math.ceil(length / MAX_SHOT_DURATION));
  return Array.from({ length: count }, (_, index) => {
    const shotStart = start + (length * index) / count;
    const shotEnd = index === count - 1 ? end : start + (length * (index + 1)) / count;
    return {
      kind,
      startTime: shotStart,
      endTime: shotEnd,
      lyricEndTime: shotEnd,
      lineGroupIndices: [],
    };
  });
}

function ensureTimelineCoverage(drafts: ShotDraft[], duration: number): ShotDraft[] {
  if (drafts.length === 0) return planInstrumentalShots(duration);

  const sorted = [...drafts].sort(
    (left, right) => left.startTime - right.startTime || left.endTime - right.endTime
  );
  const covered: ShotDraft[] = [];
  let cursor = 0;

  for (const draft of sorted) {
    const startTime = clamp(draft.startTime, cursor, duration);
    const endTime = clamp(draft.endTime, startTime, duration);
    if (startTime > cursor) {
      covered.push(...splitEmptyRange("interlude", cursor, startTime));
    }
    if (endTime > startTime) {
      covered.push({ ...draft, startTime, endTime });
      cursor = endTime;
    }
  }

  if (cursor < duration) {
    covered.push(...splitEmptyRange("interlude", cursor, duration));
  }

  return covered;
}

function assignShotIdentityAndTransitions(
  drafts: readonly ShotDraft[],
  seed: string
): LyricFilmShot[] {
  const shots: LyricFilmShot[] = [];
  let previousProfile: LyricFilmProfile | null = null;
  let previousTransition: LyricFilmTransitionKind | null = null;

  drafts.forEach((draft, index) => {
    const shotSeed = `${seed}:shot:${index}`;
    const candidateProfiles = draft.kind === "lyrics" ? PROFILES : QUIET_PROFILES;
    const profile = chooseStable(candidateProfiles, `${shotSeed}:profile`, previousProfile);
    previousProfile = profile;

    const nextDraft = drafts[index + 1];
    let transitionOut: LyricFilmTransition | null = null;
    if (nextDraft) {
      const sameSceneKind = draft.kind === nextDraft.kind;
      const kind = sameSceneKind
        ? "focus-pull"
        : chooseStable(TRANSITIONS, `${shotSeed}:transition`, previousTransition);
      if (!sameSceneKind) previousTransition = kind;
      const desiredDuration = sameSceneKind
        ? 0.35
        : transitionDuration(kind, `${shotSeed}:transition-duration`);
      const actualDuration = Math.min(desiredDuration, draft.endTime - draft.startTime);
      transitionOut = {
        kind,
        startTime: draft.endTime - actualDuration,
        endTime: draft.endTime,
      };
    }

    shots.push({
      id: `shot-${index}`,
      seed: shotSeed,
      kind: draft.kind,
      profile,
      startTime: draft.startTime,
      endTime: draft.endTime,
      lyricEndTime: draft.lyricEndTime,
      lineGroupIndices: draft.lineGroupIndices,
      transitionOut,
    });
  });

  return shots;
}

function chooseStable<T extends string>(
  options: readonly T[],
  seed: string,
  previous: T | null
): T {
  const candidates = options.filter((option) => option !== previous);
  const choices = candidates.length > 0 ? candidates : options;
  const index = hashString(seed) % choices.length;
  return choices[index]!;
}

function transitionDuration(kind: LyricFilmTransitionKind, seed: string): number {
  const roll = (hashString(seed) % 1000) / 999;
  return kind === "focus-pull" ? 0.35 + roll * 0.25 : 0.5 + roll * 0.6;
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
