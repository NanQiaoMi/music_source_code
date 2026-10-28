import type { LyricFilmStageProfile } from "./lyricFilmStage";

export type LyricFilmTextOrientation = "horizontal" | "vertical";
export type LyricFilmEntryDirection = "left" | "right" | "top" | "bottom";

export interface LyricFilmComposition {
  centerX: number;
  centerY: number;
  maxWidth: number;
  orientation: LyricFilmTextOrientation;
  entryDirection: LyricFilmEntryDirection;
}

export interface LyricFilmGlyphInput {
  seed: string | number;
  startTime: number;
  endTime: number;
  musicTime: number;
  x: number;
  y: number;
  fontSize: number;
}

export interface LyricFilmGlyphFrame {
  x: number;
  y: number;
  progress: number;
  trailAlpha: number;
  sparkleAlpha: number;
}

export interface LyricFilmCreditsFrame {
  cardOpacity: number;
  titleVisibleGraphemes: number;
  artistOpacity: number;
  albumOpacity: number;
}

export interface LyricFilmVerticalSlotInput {
  itemIndex: number;
  itemCount: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  maxWidth: number;
  fontSize: number;
  groupRowIndex: number;
  groupRowCount: number;
}

export interface LyricFilmVerticalSlot {
  x: number;
  y: number;
  fontSize: number;
}

const PROFILE_ANCHORS: Record<LyricFilmStageProfile, readonly [number, number][]> = {
  spotlight: [
    [0.49, 0.52],
    [0.53, 0.48],
  ],
  prism: [
    [0.43, 0.47],
    [0.57, 0.54],
  ],
  window: [
    [0.39, 0.52],
    [0.61, 0.48],
  ],
  caustic: [
    [0.48, 0.45],
    [0.54, 0.53],
  ],
  botanical: [
    [0.41, 0.54],
    [0.59, 0.48],
  ],
  astral: [
    [0.46, 0.44],
    [0.55, 0.54],
  ],
  motes: [
    [0.47, 0.51],
    [0.54, 0.48],
  ],
};

const ENTRY_DIRECTIONS: readonly LyricFilmEntryDirection[] = ["left", "right", "top", "bottom"];
const graphemeSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter !== "undefined"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : undefined;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function stableUnit(seed: string | number, salt: string): number {
  return hashString(`${String(seed)}:${salt}`) / 0xffffffff;
}

const MAX_GRAPHEME_CACHE = 512;
const graphemeCache = new Map<string, readonly string[]>();

/**
 * Split a title into user-visible units so the ending card can reveal it steadily.
 * S5-7：结果按文本记忆化——歌词绘制每帧会重复切分同样的词/行，切分本身要建
 * 迭代器 + 新数组，是手书效果里最大的每帧数组分配源。调用方只读返回数组。
 */
export function segmentLyricFilmGraphemes(text: string): string[] {
  const cached = graphemeCache.get(text);
  if (cached) {
    return cached as string[];
  }
  const graphemes = graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(text), (part) => part.segment)
    : Array.from(text);
  if (graphemeCache.size >= MAX_GRAPHEME_CACHE) graphemeCache.clear();
  graphemeCache.set(text, graphemes);
  return graphemes;
}

/** Expand grouped LRC timing units into individual glyphs for vertical composition. */
export function expandLyricFilmVerticalUnits<T extends { text: string }>(units: readonly T[]): T[] {
  return units.flatMap((unit) =>
    segmentLyricFilmGraphemes(unit.text).map((text) => ({ ...unit, text }))
  );
}

/** Resolve a stable, profile-aware lyric slot without pushing text outside the viewport. */
export function resolveLyricFilmComposition(
  seed: string | number,
  profile: LyricFilmStageProfile,
  width: number,
  height: number,
  text: string
): LyricFilmComposition {
  const safeWidth = Math.max(1, finiteOr(width, 1));
  const safeHeight = Math.max(1, finiteOr(height, 1));
  const maxWidth = Math.max(
    1,
    Math.min(safeWidth * 0.82, safeWidth - Math.min(24, safeWidth * 0.12))
  );
  const anchors = PROFILE_ANCHORS[profile] ?? PROFILE_ANCHORS.spotlight;
  const variant = hashString(`${String(seed)}:${profile}:slot`) % anchors.length;
  const [anchorX, anchorY] = anchors[variant]!;
  const horizontalVariation = (stableUnit(seed, "x") - 0.5) * 0.035;
  const verticalVariation = (stableUnit(seed, "y") - 0.5) * 0.035;
  const minCenterX = maxWidth / 2;
  const maxCenterX = Math.max(minCenterX, safeWidth - maxWidth / 2);
  const centerX = clamp((anchorX + horizontalVariation) * safeWidth, minCenterX, maxCenterX);
  const centerY = clamp(
    (anchorY + verticalVariation) * safeHeight,
    safeHeight * 0.24,
    safeHeight * 0.76
  );
  const graphemes = segmentLyricFilmGraphemes(text);
  const cjkCount = graphemes.filter((item) =>
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(item)
  ).length;
  const cjkRatio = graphemes.length > 0 ? cjkCount / graphemes.length : 0;
  const verticalRoll = hashString(`${String(seed)}:vertical`) % 5;
  const canUseVertical = cjkRatio >= 0.72 && graphemes.length <= 20;
  const orientation: LyricFilmTextOrientation =
    canUseVertical && verticalRoll === 0 ? "vertical" : "horizontal";
  const entryRoll = hashString(`${String(seed)}:entry`) % ENTRY_DIRECTIONS.length;

  return {
    centerX,
    centerY,
    maxWidth,
    orientation,
    entryDirection: ENTRY_DIRECTIONS[entryRoll]!,
  };
}

/** Resolve one top-to-bottom CJK glyph slot, shrinking only when columns need more room. */
export function resolveLyricFilmVerticalSlot(
  input: LyricFilmVerticalSlotInput
): LyricFilmVerticalSlot {
  const width = Math.max(1, finiteOr(input.width, 1));
  const height = Math.max(1, finiteOr(input.height, 1));
  const maxWidth = Math.max(1, Math.min(finiteOr(input.maxWidth, width), width));
  const itemCount = Math.max(1, Math.trunc(finiteOr(input.itemCount, 1)));
  const itemIndex = clamp(Math.trunc(finiteOr(input.itemIndex, 0)), 0, itemCount - 1);
  let fontSize = clamp(finiteOr(input.fontSize, 16), 8, 120);
  let charactersPerColumn = 1;
  let columnCount = 1;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    charactersPerColumn = Math.max(4, Math.floor((height * 0.54) / (fontSize * 1.18)));
    columnCount = Math.ceil(itemCount / charactersPerColumn);
    const requiredWidth = columnCount * fontSize * 1.28;
    if (requiredWidth <= maxWidth || fontSize <= 8) break;
    fontSize = Math.max(8, fontSize * (maxWidth / requiredWidth));
  }

  const columnGap = fontSize * 1.28;
  const columnIndex = Math.floor(itemIndex / charactersPerColumn);
  const rowIndex = itemIndex % charactersPerColumn;
  const charactersInColumn = Math.min(
    charactersPerColumn,
    itemCount - columnIndex * charactersPerColumn
  );
  const lineCount = Math.max(1, Math.trunc(finiteOr(input.groupRowCount, 1)));
  const lineIndex = clamp(Math.trunc(finiteOr(input.groupRowIndex, 0)), 0, lineCount - 1);
  const lineOffset = ((lineCount - 1) / 2 - lineIndex) * columnGap * 0.72;
  const top =
    finiteOr(input.centerY, height / 2) - ((charactersInColumn - 1) * fontSize * 1.18) / 2;
  const minX = Math.max(0, finiteOr(input.centerX, width / 2) - maxWidth / 2 + fontSize * 0.5);
  const maxX = Math.min(width, finiteOr(input.centerX, width / 2) + maxWidth / 2 - fontSize * 0.5);
  const x =
    finiteOr(input.centerX, width / 2) +
    ((columnCount - 1) * columnGap) / 2 -
    columnIndex * columnGap +
    lineOffset;

  return {
    x: clamp(x, minX, Math.max(minX, maxX)),
    y: clamp(top + rowIndex * fontSize * 1.18, height * 0.18, height * 0.82),
    fontSize,
  };
}

/** Resolve one word/grapheme trajectory from absolute song time, so seeking is repeatable. */
export function resolveLyricFilmGlyphFrame(input: LyricFilmGlyphInput): LyricFilmGlyphFrame {
  const startTime = finiteOr(input.startTime, 0);
  const endTime = Math.max(startTime, finiteOr(input.endTime, startTime));
  const musicTime = finiteOr(input.musicTime, startTime);
  const duration = endTime - startTime;
  const progress =
    duration <= 0.00001
      ? musicTime >= endTime
        ? 1
        : 0
      : clamp((musicTime - startTime) / duration, 0, 1);
  const moving = progress > 0 && progress < 1;
  const remaining = moving ? 1 - smoothstep(progress) : 0;
  const direction = hashString(`${String(input.seed)}:trajectory`) % 4;
  const distance = clamp(finiteOr(input.fontSize, 16), 8, 120) * 0.38 * remaining;
  const directionX = direction === 0 ? -1 : direction === 1 ? 1 : 0;
  const directionY = direction === 2 ? -0.62 : direction === 3 ? 0.62 : 0;
  const age = musicTime - endTime;
  const trailAlpha = age >= 0 && age < 0.42 ? (1 - age / 0.42) * 0.22 : 0;
  const sparkleAlpha = moving ? Math.sin(Math.PI * progress) * 0.46 : 0;

  return {
    x: finiteOr(input.x, 0) + directionX * distance,
    y: finiteOr(input.y, 0) + directionY * distance,
    progress,
    trailAlpha,
    sparkleAlpha,
  };
}

/** Resolve title and metadata timing for the final credit shot. */
export function resolveLyricFilmCreditsFrame(
  startTime: number,
  endTime: number,
  musicTime: number,
  title: string,
  hasArtist: boolean,
  hasAlbum: boolean,
  reducedMotion = false
): LyricFilmCreditsFrame {
  const start = finiteOr(startTime, 0);
  const duration = Math.max(0, finiteOr(endTime, start) - start);
  const elapsed = clamp(finiteOr(musicTime, start) - start, 0, duration);
  const titleLength = segmentLyricFilmGraphemes(title).length;
  const cardFadeDuration = Math.max(0.12, Math.min(0.82, duration * 0.13));

  if (reducedMotion) {
    const titleVisible = elapsed >= Math.min(0.62, duration * 0.1) ? titleLength : 0;
    const artistOpacity = hasArtist && elapsed >= Math.min(1.35, duration * 0.23) ? 1 : 0;
    const albumOpacity = hasAlbum && elapsed >= Math.min(1.7, duration * 0.3) ? 1 : 0;
    return {
      cardOpacity: elapsed >= cardFadeDuration ? 1 : smoothstep(elapsed / cardFadeDuration),
      titleVisibleGraphemes: titleVisible,
      artistOpacity,
      albumOpacity,
    };
  }

  const titleStart = Math.min(0.48, duration * 0.08);
  const revealDuration = Math.min(
    clamp(titleLength * 0.085, 0.7, 2.3),
    Math.max(0.28, duration * 0.48)
  );
  const titleProgress = titleLength === 0 ? 0 : smoothstep((elapsed - titleStart) / revealDuration);
  const artistStart = titleStart + revealDuration + Math.min(0.22, duration * 0.04);
  const artistFadeDuration = Math.min(0.72, Math.max(0.26, duration * 0.2));
  const albumStart = artistStart + Math.min(0.3, duration * 0.05);
  const albumFadeDuration = Math.min(0.68, Math.max(0.25, duration * 0.18));

  return {
    cardOpacity: smoothstep(elapsed / cardFadeDuration),
    titleVisibleGraphemes: Math.min(titleLength, Math.ceil(titleLength * titleProgress)),
    artistOpacity: hasArtist ? smoothstep((elapsed - artistStart) / artistFadeDuration) : 0,
    albumOpacity: hasAlbum ? smoothstep((elapsed - albumStart) / albumFadeDuration) : 0,
  };
}
