/**
 * 「温光浮字」——手书歌词 MV（Canvas 2D）。
 *
 * 把一首歌当成一叠被阳光照亮的手写歌词纸：每个镜头是一页纸，
 * 歌词按 LRC 时间被逐字写上去（先铅笔打稿、再墨迹落笔），
 * 页边有随手画的涂鸦、实物胶带/邮票/折角、重点词被圈画或荧光笔标注，
 * 换页时用暖光扫过而不是硬切。结尾是一页署名 + 红色印章。
 *
 * 性能与动画：
 * - 光层半分辨率、屏幕覆盖层烘焙、纸面纹理缓存、笔触 Path2D 缓存；
 * - 转场用快照做交叉溶解，避免每帧双绘；
 * - 自适应画质：按绘制耗时 EMA 在 3 档之间带滞回调整；
 * - 镜头用 value noise 手持漂移，字有抬笔间隙与写完沉降。
 *
 * 保留效果 ID（cinematicLyricDrift）、名称「温光浮字」、全部设置字段
 * 与歌词/播放状态来源；镜头编排复用 lyricFilmProgram / lyricTimeline，
 * 保证 seek、暂停、倍速可复现。
 */

import type { EffectContext } from "./types";
import { getPlaybackClockSnapshot } from "@/lib/playback/playbackClock";
import { getPlayerSnapshot } from "@/store/actions/playbackActions";
import {
  estimateLineUnits,
  groupLyricsByStart,
  parseTimedLyrics,
  type LyricLineGroup,
} from "./lyricTimeline";
import {
  advanceLyricPlaybackClock,
  createLyricPlaybackClock,
  type LyricPlaybackClockState,
} from "./lyricPlaybackClock";
import {
  compileLyricFilmProgram,
  findLyricFilmShotIndexAtTime,
  type LyricFilmProgram,
  type LyricFilmShot,
} from "./lyricFilmProgram";
import {
  resolveLyricFilmLyricRows,
  resolveLyricFilmTranslation,
  type LyricFilmLyricRow,
} from "./lyricFilmLyrics";
import { resolveLyricFilmCreditsFrame, segmentLyricFilmGraphemes } from "./lyricFilmComposition";
import {
  layoutHandwrittenPlainText,
  prepareHandwrittenUnits,
  wrapHandwrittenPhrase,
  type HandwrittenLayoutLine as PlainTextLayoutLine,
} from "./handwrittenLayout";
import {
  blendHandwrittenCamera,
  buildHandwrittenSnapshotRenderKey,
  canFitHandwrittenVerticalColumn,
  resolveHandwrittenReducedMotionReveal,
  resolveHandwrittenReducedMotionShot,
  resolveHandwrittenRevealOpacity,
  resolveHandwrittenRowMode,
  resolveHandwrittenSnapshotTime,
  resolveHandwrittenTranslationTime,
  resolveHandwrittenTransitionFrame,
  shouldRenderHandwrittenOutgoingLive,
} from "./handwrittenMotion";
import {
  resolveHandwrittenFont,
  resolveHandwrittenPalette,
  withAlpha,
  type HandwrittenPalette,
} from "./handwrittenPalette";
import {
  resolveDoodleProgress,
  resolveHandwrittenCameraFrame,
  resolveHandwrittenScene,
  stableRandom,
  type HandwrittenCameraFrame,
  type HandwrittenDecorationSpec,
  type HandwrittenSceneConfig,
} from "./handwrittenScene";
import {
  applyHandwrittenCamera,
  drawHandwrittenDust,
  drawHandwrittenLightLeak,
  drawHandwrittenPaperSurface,
} from "./handwrittenPaper";
import { drawHandwrittenDoodle, drawHandwrittenSeal } from "./handwrittenDoodles";
import { drawHandwrittenInkLine, type InkGlyphInput, type InkLineOptions } from "./handwrittenInk";

type QualityTier = 0 | 1 | 2;

interface HandwrittenSettings {
  fontStyle: number;
  colorScheme: number;
  heroFontSize: number;
  shimmerFeather: number;
  fluidSpeed: number;
  ambientGlowIntensity: number;
  filmGrain: number;
  vignetteStrength: number;
}

interface TransitionSnapshot {
  key: string;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** Stable absolute music time used to render the frozen outgoing page. */
  canonicalMusicTime: number;
}

interface HandwrittenRuntimeState extends LyricPlaybackClockState {
  songId: string | null;
  lyricsText: string;
  translationLyricsText: string;
  translationGroups: LyricLineGroup[];
  songDuration: number;
  programDuration: number;
  program: LyricFilmProgram | null;
  layoutCache: Map<string, HandwrittenLineLayout>;
  sceneCache: Map<string, HandwrittenSceneConfig>;
  measureCache: Map<string, MeasuredText>;
  /** S5-7：翻译小字幕版式只由文本 + 字号 + 宽度决定，按 key 缓存，避免每帧重排。 */
  captionCache: Map<string, HandwrittenCaptionLayout>;
  smoothBass: number;
  smoothMid: number;
  smoothTreble: number;
  ambientPhase: number;
  drawCostEma: number;
  qualityTier: QualityTier;
  overloadFrames: number;
  transitionSnapshot: TransitionSnapshot | null;
}

interface ShotBlend {
  outgoing: LyricFilmShot;
  incoming: LyricFilmShot | null;
  progress: number;
}

interface ContentFrame {
  state: HandwrittenRuntimeState;
  program: LyricFilmProgram;
  shot: LyricFilmShot;
  musicTime: number;
  timeMs: number;
  width: number;
  height: number;
  palette: HandwrittenPalette;
  fontFamily: string;
  settings: HandwrittenSettings;
  reducedMotion: boolean;
  quality: QualityTier;
  /** Snapshot frames contain only this outgoing shot's lyrics, even at its final boundary. */
  restrictLyricsToShot?: boolean;
  heroFontSize: number;
  scene: HandwrittenSceneConfig;
  title: string;
  artist: string;
  album: string;
  alpha: number;
  isPlaying: boolean;
  motionSpeed: number;
  /** 画布设备像素比：字形 sprite 用它决定烘焙清晰度 */
  pixelRatio: number;
}

interface HandwrittenLayoutItem {
  text: string;
  width: number;
  start: number;
  end: number;
  scaleBoost?: number;
}

interface HandwrittenLayoutLine {
  items: HandwrittenLayoutItem[];
  width: number;
  y: number;
}

interface HandwrittenLineLayout {
  lines: HandwrittenLayoutLine[];
  fontSize: number;
  lineHeight: number;
  totalHeight: number;
}

type InkMode = "active" | "past" | "future";

interface RowLayout {
  row: LyricFilmLyricRow;
  mode: InkMode;
  layout: HandwrittenLineLayout;
  rowHeight: number;
}

interface GroupLayout {
  groupIndex: number;
  rows: RowLayout[];
  height: number;
  font: number;
  centerY: number;
}

interface MeasuredText {
  graphemes: string[];
  widths: number[];
  totalWidth: number;
}

interface HandwrittenCaptionBlock {
  text: string;
  lines: PlainTextLayoutLine[];
}

interface HandwrittenCaptionLayout {
  blocks: HandwrittenCaptionBlock[];
  fontSize: number;
  lineHeight: number;
  blockGap: number;
  gap: number;
  contentHeight: number;
  reservedHeight: number;
}

/** 装饰绘制只需要这些字段，待机画面不必伪造完整的 ContentFrame。 */
interface DecorationFrame {
  scene: HandwrittenSceneConfig;
  width: number;
  height: number;
  palette: HandwrittenPalette;
  fontFamily: string;
  musicTime: number;
  timeMs: number;
  alpha: number;
  reducedMotion: boolean;
  quality: QualityTier;
  shot: { startTime: number; endTime: number };
}

const MAX_LAYOUT_CACHE = 240;
const MAX_SCENE_CACHE = 160;
const MAX_MEASURE_CACHE = 120;
const MAX_CAPTION_CACHE = 48;
const MIN_FONT_SIZE = 11;
const QUALITY_EMA_DECAY = 0.85;

let reducedMotionQuery: MediaQueryList | null | undefined;
const runtimeCache = new WeakMap<CanvasRenderingContext2D, HandwrittenRuntimeState>();

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function isPositiveDuration(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (reducedMotionQuery === undefined) {
    try {
      reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      reducedMotionQuery = null;
    }
  }
  return reducedMotionQuery?.matches === true;
}

function readNumber(
  source: Partial<Record<string, number>> | undefined,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const value = Number(source?.[key]);
  return clamp(Number.isFinite(value) ? value : fallback, minimum, maximum);
}

function resolveSettings(params: EffectContext["params"]): HandwrittenSettings {
  const source = params as Partial<Record<string, number>> | undefined;
  return {
    fontStyle: readNumber(source, "fontStyle", 0, 0, 3),
    colorScheme: readNumber(source, "colorScheme", 0, 0, 4),
    heroFontSize: readNumber(source, "heroFontSize", 54, 20, 120),
    shimmerFeather: readNumber(source, "shimmerFeather", 50, 0, 100),
    fluidSpeed: readNumber(source, "fluidSpeed", 0.8, 0.1, 2.5),
    ambientGlowIntensity: readNumber(source, "ambientGlowIntensity", 0.9, 0, 1.6),
    filmGrain: readNumber(source, "filmGrain", 0.15, 0, 0.6),
    vignetteStrength: readNumber(source, "vignetteStrength", 0.65, 0, 1),
  };
}

function createRuntimeState(): HandwrittenRuntimeState {
  return {
    ...createLyricPlaybackClock(),
    songId: null,
    lyricsText: "",
    translationLyricsText: "",
    translationGroups: [],
    songDuration: 0,
    programDuration: 0,
    program: null,
    layoutCache: new Map(),
    sceneCache: new Map(),
    measureCache: new Map(),
    captionCache: new Map(),
    smoothBass: 0,
    smoothMid: 0,
    smoothTreble: 0,
    ambientPhase: 0,
    drawCostEma: 0,
    qualityTier: 0,
    overloadFrames: 0,
    transitionSnapshot: null,
  };
}

function getRuntimeState(ctx: CanvasRenderingContext2D): HandwrittenRuntimeState {
  const existing = runtimeCache.get(ctx);
  if (existing) return existing;
  const created = createRuntimeState();
  runtimeCache.set(ctx, created);
  return created;
}

/**
 * 画质档位由「画布像素量」静态决定，而不是绘制耗时：同一音乐时刻在暂停、
 * seek、重绘时必须得到同一帧，耗时 EMA 会让两条时间线画出不同细节。
 */
function resolveStaticQuality(width: number, height: number, dpr: number): QualityTier {
  const pixels = width * height * clamp(dpr, 1, 4) ** 2;
  if (pixels > 12_500_000) return 2;
  if (pixels > 5_500_000) return 1;
  return 0;
}

/**
 * 紧急降级：只有持续多帧都超过 22ms（真实掉帧）时才升一档画质，
 * 且绝不自动降回去，避免同一首歌在不同机器上细节来回跳。
 */
function maybeDegradeQuality(state: HandwrittenRuntimeState, costMs: number): void {
  if (!Number.isFinite(costMs) || costMs <= 0) return;
  state.drawCostEma =
    state.drawCostEma <= 0
      ? costMs
      : state.drawCostEma * QUALITY_EMA_DECAY + costMs * (1 - QUALITY_EMA_DECAY);
  if (state.drawCostEma > 22) {
    state.overloadFrames += 1;
  } else {
    state.overloadFrames = 0;
    return;
  }
  if (state.overloadFrames > 90 && state.qualityTier < 2) {
    state.qualityTier = (state.qualityTier + 1) as QualityTier;
    state.overloadFrames = 0;
  }
}

function resolveSongDuration(
  currentSong: { duration?: number } | null,
  audioDuration: number | undefined,
  playerDuration: number | undefined,
  isLoading: boolean
): number {
  if (isLoading) return isPositiveDuration(currentSong?.duration) ? currentSong.duration : 0;
  if (isPositiveDuration(audioDuration)) return audioDuration;
  if (isPositiveDuration(playerDuration)) return playerDuration;
  return isPositiveDuration(currentSong?.duration) ? currentSong.duration : 0;
}

function resolveProgramDuration(
  lyricsText: string,
  songDuration: number,
  previousDuration: number
): number {
  if (isPositiveDuration(songDuration)) return songDuration;
  if (isPositiveDuration(previousDuration)) return previousDuration;
  const lastLyricStart = parseTimedLyrics(lyricsText).at(-1)?.start ?? 0;
  return Math.max(180, lastLyricStart + 8);
}

function rebuildProgram(
  state: HandwrittenRuntimeState,
  lyricsText: string,
  songId: string | null,
  songDuration: number
): void {
  const nextDuration = resolveProgramDuration(lyricsText, songDuration, state.programDuration);
  const seed = songId ?? `untitled:${lyricsText.slice(0, 48)}`;
  state.program = compileLyricFilmProgram(parseTimedLyrics(lyricsText), seed, nextDuration);
  state.programDuration = nextDuration;
  state.songDuration = songDuration;
  state.layoutCache.clear();
  state.sceneCache.clear();
  state.transitionSnapshot = null;
}

function resetRuntimeForSong(
  state: HandwrittenRuntimeState,
  songId: string | null,
  lyricsText: string,
  translationLyricsText: string,
  songDuration: number
): void {
  Object.assign(state, createLyricPlaybackClock());
  state.songId = songId;
  state.lyricsText = lyricsText;
  state.translationLyricsText = translationLyricsText;
  state.translationGroups = groupLyricsByStart(parseTimedLyrics(translationLyricsText));
  state.ambientPhase = 0;
  state.programDuration = 0;
  state.program = null;
  state.layoutCache.clear();
  state.sceneCache.clear();
  state.measureCache.clear();
  state.captionCache.clear();
  state.transitionSnapshot = null;
  state.smoothBass = 0;
  state.smoothMid = 0;
  state.smoothTreble = 0;
  state.qualityTier = 0;
  state.drawCostEma = 0;
  if (songId !== null || lyricsText.length > 0) {
    rebuildProgram(state, lyricsText, songId, songDuration);
  }
}

/** 视口字号：设置里是 1080p 基准，按画面尺寸缩放，但保留上下限。 */
function resolveHeroFontSize(
  settings: HandwrittenSettings,
  width: number,
  height: number,
  scene: HandwrittenSceneConfig
): number {
  const viewportScale = clamp(Math.min(width / 1600, height / 900), 0.62, 1.8);
  return clamp(settings.heroFontSize * 1.55 * viewportScale * scene.activeScale, 30, 240);
}

function measureGraphemeWidths(
  state: HandwrittenRuntimeState,
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  fontSize: number
): MeasuredText {
  const key = [fontSize, fontFamily, text].join("|");
  const cached = state.measureCache.get(key);
  if (cached) return cached;

  const graphemes = segmentLyricFilmGraphemes(text);
  ctx.save();
  ctx.font = `500 ${fontSize}px ${fontFamily}`;
  const widths = graphemes.map((grapheme) => {
    const value = ctx.measureText(grapheme).width;
    return Number.isFinite(value) ? value : 0;
  });
  ctx.restore();
  const measured: MeasuredText = {
    graphemes,
    widths,
    totalWidth: widths.reduce((sum, width) => sum + width, 0),
  };
  if (state.measureCache.size > MAX_MEASURE_CACHE) state.measureCache.clear();
  state.measureCache.set(key, measured);
  return measured;
}

function measureTextWidth(
  state: HandwrittenRuntimeState,
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  fontSize: number
): number {
  const key = ["w", fontSize, fontFamily, text].join("|");
  const cached = state.measureCache.get(key);
  if (cached) return cached.totalWidth;

  ctx.save();
  ctx.font = `500 ${fontSize}px ${fontFamily}`;
  const value = ctx.measureText(text).width;
  ctx.restore();
  const width = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (state.measureCache.size > MAX_MEASURE_CACHE) state.measureCache.clear();
  state.measureCache.set(key, { graphemes: [text], widths: [width], totalWidth: width });
  return width;
}

/**
 * 手写排版：按实测字宽平衡词组，强调字组的放大宽度预先占位，
 * 超宽英文词才拆到 grapheme，原始 LRC 时间区间随单元一起保留。
 */
function layoutHandwrittenText(
  state: HandwrittenRuntimeState,
  ctx: CanvasRenderingContext2D,
  row: LyricFilmLyricRow,
  shot: LyricFilmShot,
  fontFamily: string,
  fontSize: number,
  maxWidth: number,
  emphasis: { unitIndex: number; unitCount: number; scaleBoost: number } | null = null
): HandwrittenLineLayout {
  const cacheKey = [
    shot.id,
    row.id,
    row.text,
    row.startTime,
    row.revealEndTime,
    row.lineIndex,
    maxWidth,
    fontSize,
    fontFamily,
    emphasis ? [emphasis.unitIndex, emphasis.unitCount, emphasis.scaleBoost].join(":") : "none",
  ].join("|");
  const cached = state.layoutCache.get(cacheKey);
  if (cached) return cached;

  const timedUnits = estimateLineUnits(row.text, row.startTime, row.revealEndTime, row.lineIndex);
  const items = prepareHandwrittenUnits(timedUnits, maxWidth, (text) =>
    measureTextWidth(state, ctx, text, fontFamily, fontSize)
  );
  if (items.length === 0) {
    const empty: HandwrittenLineLayout = {
      lines: [],
      fontSize,
      lineHeight: fontSize * 1.36,
      totalHeight: 0,
    };
    state.layoutCache.set(cacheKey, empty);
    return empty;
  }

  const lines: HandwrittenLayoutLine[] = wrapHandwrittenPhrase(items, maxWidth, emphasis).map(
    (line) => ({ ...line, y: 0 })
  );
  const lineHeight = fontSize * 1.36;
  const totalHeight = lines.length * lineHeight;
  lines.forEach((line, index) => {
    line.y = (index - (lines.length - 1) / 2) * lineHeight;
  });

  const layout: HandwrittenLineLayout = { lines, fontSize, lineHeight, totalHeight };
  if (state.layoutCache.size > MAX_LAYOUT_CACHE) state.layoutCache.clear();
  state.layoutCache.set(cacheKey, layout);
  return layout;
}

/**
 * S5-7：主句版式依赖（seed/profile/尺寸/单位文本/降低动态）只在换句或改字号时变化，
 * 旧实现每帧重建一次 scene（含 arrays + emphasis 的 map/filter），是稳态最大的对象分配：
 * 缓存到 sceneCache，命中后引用跨帧不变。key 覆盖所有输入，未命中只会更保守地重建。
 */
function getSceneWithUnits(
  state: HandwrittenRuntimeState,
  shot: LyricFilmShot,
  width: number,
  height: number,
  reducedMotion: boolean,
  units: readonly { text: string }[],
  unitsKey: string
): HandwrittenSceneConfig {
  const key = `u|${shot.id}|${Math.round(width)}x${Math.round(height)}|${reducedMotion ? 1 : 0}|${unitsKey}`;
  const cached = state.sceneCache.get(key);
  if (cached) return cached;
  const scene = resolveHandwrittenScene({
    seed: shot.seed,
    profile: shot.profile,
    shotKind: shot.kind,
    width,
    height,
    units: units.map((unit) => unit.text),
    reducedMotion,
  });
  if (state.sceneCache.size > MAX_SCENE_CACHE) state.sceneCache.clear();
  state.sceneCache.set(key, scene);
  return scene;
}

/** S5-7：组号列表复用同一块暂存数组，稳态下不再每帧新建 Set / rows.map / sort 副本。 */
const groupIndexScratch: number[] = [];

function collectSortedGroupIndexes(
  rows: readonly LyricFilmLyricRow[],
  program: LyricFilmProgram
): number[] {
  groupIndexScratch.length = 0;
  for (const row of rows) {
    const { groupIndex } = row;
    let seen = false;
    for (const existing of groupIndexScratch) {
      if (existing === groupIndex) {
        seen = true;
        break;
      }
    }
    if (!seen) groupIndexScratch.push(groupIndex);
  }
  groupIndexScratch.sort(
    (a, b) => (program.lineGroups[a]?.start ?? 0) - (program.lineGroups[b]?.start ?? 0) || a - b
  );
  return groupIndexScratch;
}

function getScene(
  state: HandwrittenRuntimeState,
  shot: LyricFilmShot,
  width: number,
  height: number,
  reducedMotion: boolean
): HandwrittenSceneConfig {
  const key = `${shot.id}|${Math.round(width)}x${Math.round(height)}|${reducedMotion ? 1 : 0}`;
  const cached = state.sceneCache.get(key);
  if (cached) return cached;
  const scene = resolveHandwrittenScene({
    seed: shot.seed,
    profile: shot.profile,
    shotKind: shot.kind,
    width,
    height,
    units: [],
    reducedMotion,
  });
  if (state.sceneCache.size > MAX_SCENE_CACHE) state.sceneCache.clear();
  state.sceneCache.set(key, scene);
  return scene;
}

function buildGlyph(
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  start: number,
  end: number,
  seed: string,
  reveal?: number
): InkGlyphInput {
  return { text, x, y, width, fontSize, start, end, seed, reveal };
}

function rowMode(
  groupIndex: number,
  focusGroupIndex: number,
  program: LyricFilmProgram,
  musicTime: number
): InkMode {
  return resolveHandwrittenRowMode(
    musicTime,
    program.lineGroups[groupIndex]?.start ?? Infinity,
    program.lineGroups[focusGroupIndex]?.start ?? Infinity
  );
}

/** 短中文句子是否适合竖排：2–8 个字符且以中日韩文字为主。 */
function shouldUseVerticalColumn(text: string): boolean {
  const graphemes = segmentLyricFilmGraphemes(text.trim());
  if (graphemes.length < 2 || graphemes.length > 8) return false;
  const cjk = graphemes.filter((grapheme) =>
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(grapheme)
  ).length;
  return cjk / graphemes.length >= 0.75;
}

/** 竖排手写：字号按列高反推，重点标注按字组换算成字形索引。 */
function drawVerticalColumn(
  frame: ContentFrame,
  ctx: CanvasRenderingContext2D,
  row: LyricFilmLyricRow,
  scene: HandwrittenSceneConfig,
  heroFontSize: number,
  reservedBottomSpace: number
): number | null {
  const { shot, musicTime, width, height, fontFamily, palette, reducedMotion } = frame;
  const mode = resolveHandwrittenRowMode(musicTime, row.startTime, row.startTime);
  const units = estimateLineUnits(row.text, row.startTime, row.revealEndTime, row.lineIndex);
  if (units.length === 0) return null;

  interface VerticalUnit {
    text: string;
    start: number;
    end: number;
  }
  const verticalUnits: VerticalUnit[] = [];
  for (const unit of units) {
    const graphemes = segmentLyricFilmGraphemes(unit.text).filter((grapheme) => grapheme.trim());
    graphemes.forEach((grapheme, index) => {
      const span = (unit.end - unit.start) / Math.max(1, graphemes.length);
      verticalUnits.push({
        text: grapheme,
        start: unit.start + span * index,
        end: unit.start + span * (index + 1),
      });
    });
  }
  if (verticalUnits.length === 0) return null;

  const safeTop = height * 0.12;
  const safeBottom = height * 0.88 - reservedBottomSpace;
  const maxColumnHeight = Math.max(0, safeBottom - safeTop);
  const fontSize = clamp(
    Math.min(heroFontSize * 0.94, maxColumnHeight / (verticalUnits.length * 1.06)),
    18,
    200
  );
  const lineHeight = fontSize * 1.06;
  const columnHeight = verticalUnits.length * lineHeight;
  const centerX = clamp(
    width * 0.5 + (scene.anchorX - 0.5) * width * 0.35,
    width * 0.34,
    width * 0.66
  );
  const centerY = clamp(
    height * 0.5 + (scene.anchorY - 0.5) * height * 0.24,
    height * 0.3,
    height * 0.7
  );
  const top = clamp(
    centerY - columnHeight / 2,
    safeTop,
    Math.max(safeTop, safeBottom - columnHeight)
  );
  const glyphs = verticalUnits.map((unit, index) =>
    buildGlyph(
      unit.text,
      centerX - fontSize * 0.5,
      top + index * lineHeight + lineHeight * 0.5,
      fontSize,
      fontSize,
      unit.start,
      unit.end,
      `${shot.seed}:${row.id}:v:${index}:${unit.text}`,
      resolveHandwrittenReducedMotionReveal(reducedMotion, mode)
    )
  );

  let emphasis: InkLineOptions["emphasis"] = null;
  if (scene.emphasis) {
    let glyphOffset = 0;
    for (let index = 0; index < scene.emphasis.unitIndex && index < units.length; index += 1) {
      glyphOffset += segmentLyricFilmGraphemes(units[index]!.text).length;
    }
    const coveredUnits = units.slice(
      scene.emphasis.unitIndex,
      scene.emphasis.unitIndex + scene.emphasis.unitCount
    );
    const glyphCount = coveredUnits.reduce(
      (sum, unit) => sum + segmentLyricFilmGraphemes(unit.text).length,
      0
    );
    if (glyphCount > 0 && glyphOffset < glyphs.length) {
      emphasis = {
        unitIndex: Math.min(glyphOffset, glyphs.length - 1),
        unitCount: Math.min(glyphCount, glyphs.length - glyphOffset),
        style: scene.emphasis.style,
      };
    }
  }

  drawHandwrittenInkLine(glyphs, {
    pixelRatio: frame.pixelRatio,

    ctx,
    palette,
    fontFamily,
    musicTime,
    mode,
    alpha: frame.alpha,
    tilt: scene.tilt * 0.5,
    centerX,
    centerY,
    glow: frame.settings.shimmerFeather / 100,
    reducedMotion,
    emphasis,
    inkColor: palette.ink,
    annotationColor: scene.emphasis?.tone === "seal" ? palette.seal : palette.accent,
    inkDensity: scene.inkDensity,
    quality: frame.quality,
    timeMs: frame.timeMs,
  });
  return top + columnHeight;
}

/**
 * 按行摆放歌词：主句在锚点附近、字号最大；前后句缩小并上下错开。
 * 写过的句子褪成浅墨，还没唱到的句子只留铅笔稿。
 */
function drawLyricRows(frame: ContentFrame, ctx: CanvasRenderingContext2D): void {
  const { program, shot, musicTime, width, height, scene, palette, fontFamily, reducedMotion } =
    frame;
  if (shot.kind !== "lyrics") return;

  const resolvedRows = resolveLyricFilmLyricRows(program, shot, musicTime);
  const rows = frame.restrictLyricsToShot
    ? resolvedRows.filter((row) => shot.lineGroupIndices.includes(row.groupIndex))
    : resolvedRows;
  if (rows.length === 0) return;

  // S5-7：焦点组 = 起始时间已到的最大组号；无需 [...new Set(...)].sort().reverse() 的
  // 三个临时数组（线组数量很小，单趟扫描结果与旧实现逐项一致）。
  let firstShotGroup: number | undefined;
  let focusGroupIndex: number | undefined;
  for (const index of shot.lineGroupIndices) {
    if (firstShotGroup === undefined || index < firstShotGroup) firstShotGroup = index;
    if (
      (program.lineGroups[index]?.start ?? Infinity) <= musicTime &&
      (focusGroupIndex === undefined || index > focusGroupIndex)
    ) {
      focusGroupIndex = index;
    }
  }
  focusGroupIndex ??= firstShotGroup;
  if (focusGroupIndex === undefined) return;

  // S5-7：焦点行只用于取第一行 + 判断是否唯一，用计数代替 rows.filter 的新数组。
  let focusRowCount = 0;
  let focusRow: LyricFilmLyricRow | undefined;
  for (const row of rows) {
    if (row.groupIndex !== focusGroupIndex) continue;
    focusRowCount += 1;
    if (focusRow === undefined) focusRow = row;
  }
  const activeText = focusRow?.text ?? rows[0]?.text ?? "";
  let heroFontSize = resolveHeroFontSize(frame.settings, width, height, scene);
  const maxWidth = Math.max(120, Math.min(width * scene.maxWidthRatio, width * 0.9));
  const centerX = clamp(scene.anchorX * width, maxWidth / 2 + 8, width - maxWidth / 2 - 8);
  let translationLayout = resolveTranslationLayout(frame, ctx, heroFontSize, maxWidth);

  // S5-7：estimateLineUnits 结果一次算好复用（旧代码为同一行调用两遍）。
  const focusTimedUnits = focusRow
    ? estimateLineUnits(
        focusRow.text,
        focusRow.startTime,
        focusRow.revealEndTime,
        focusRow.lineIndex
      )
    : [];
  const focusUnits = focusRow
    ? prepareHandwrittenUnits(focusTimedUnits, maxWidth, (text) =>
        measureTextWidth(frame.state, ctx, text, fontFamily, heroFontSize)
      )
    : [];
  const sceneWithUnits = focusRow
    ? getSceneWithUnits(
        frame.state,
        shot,
        width,
        height,
        reducedMotion,
        focusUnits,
        `${focusRow.id}|${focusRow.text}|${heroFontSize}|${maxWidth}|${fontFamily}`
      )
    : scene;
  const emphasis = sceneWithUnits.emphasis;
  // S5-7：字形数用计数循环，不再 flatMap + filter 建两个临时数组。
  let verticalUnitCount = 0;
  for (const unit of focusTimedUnits) {
    for (const grapheme of segmentLyricFilmGraphemes(unit.text)) {
      if (grapheme.trim()) verticalUnitCount += 1;
    }
  }
  const verticalFits = canFitHandwrittenVerticalColumn(
    height,
    verticalUnitCount,
    translationLayout.reservedHeight
  );
  if (
    width / Math.max(1, height) >= 1.25 &&
    focusRowCount === 1 &&
    shouldUseVerticalColumn(activeText) &&
    verticalFits
  ) {
    const columnBottom = drawVerticalColumn(
      frame,
      ctx,
      focusRow!,
      sceneWithUnits,
      heroFontSize,
      translationLayout.reservedHeight
    );
    if (columnBottom !== null) {
      drawTranslation(frame, ctx, centerX, columnBottom, translationLayout);
    }
    return;
  }

  const sortedGroupIndexes = collectSortedGroupIndexes(rows, program);

  const buildGroups = (): GroupLayout[] =>
    sortedGroupIndexes.map((groupIndex) => {
      const mode = rowMode(groupIndex, focusGroupIndex, program, musicTime);
      const font = mode === "active" ? heroFontSize : heroFontSize * 0.34;
      const groupRows = rows.filter((row) => row.groupIndex === groupIndex);
      const rowLayouts: RowLayout[] = [];
      let height = 0;

      groupRows.forEach((row, rowIndex) => {
        const rowEmphasis =
          mode === "active" && groupIndex === focusGroupIndex && rowIndex === 0 && emphasis
            ? { ...emphasis, scaleBoost: 1.12 }
            : null;
        const layout = layoutHandwrittenText(
          frame.state,
          ctx,
          row,
          shot,
          fontFamily,
          font,
          maxWidth,
          rowEmphasis
        );
        if (layout.lines.length === 0) return;
        const rowHeight = layout.totalHeight + (rowIndex > 0 ? font * 0.36 : 0);
        rowLayouts.push({ row, mode, layout, rowHeight });
        height += rowHeight;
      });

      return { groupIndex, rows: rowLayouts, height, font, centerY: 0 };
    });

  // Tall pages reserve their upper half for the sketch. Fit the complete text block,
  // including adjacent lines and translation, before positioning it in the lower half.
  const topLimit = height * (height / Math.max(1, width) > 1.3 ? 0.48 : 0.12);
  let groups = buildGroups();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const requiredHeight =
      groups.reduce((sum, group) => sum + group.height, 0) +
      Math.max(0, groups.length - 1) * heroFontSize * 0.42;
    const availableHeight = Math.max(
      1,
      height * 0.88 - topLimit - translationLayout.reservedHeight
    );
    if (requiredHeight <= availableHeight || heroFontSize <= MIN_FONT_SIZE) break;
    heroFontSize = Math.max(
      MIN_FONT_SIZE,
      heroFontSize * Math.min(0.9, Math.sqrt(availableHeight / requiredHeight) * 0.96)
    );
    translationLayout = resolveTranslationLayout(frame, ctx, heroFontSize, maxWidth);
    groups = buildGroups();
  }

  const focusGroup = groups.find((group) => group.groupIndex === focusGroupIndex);
  if (!focusGroup) return;
  const anchorY = clamp(scene.anchorY * height, height * 0.2, height * 0.8);

  const focusOrder = groups.indexOf(focusGroup);
  focusGroup.centerY = anchorY;
  let stackingTop = anchorY - focusGroup.height / 2;
  for (let order = focusOrder - 1; order >= 0; order -= 1) {
    const group = groups[order]!;
    const gap = heroFontSize * 0.42;
    group.centerY = stackingTop - gap - group.height / 2;
    stackingTop = group.centerY - group.height / 2;
  }
  let stackingBottom = anchorY + focusGroup.height / 2;
  for (let order = focusOrder + 1; order < groups.length; order += 1) {
    const group = groups[order]!;
    const gap = heroFontSize * 0.42;
    group.centerY = stackingBottom + gap + group.height / 2;
    stackingBottom = group.centerY + group.height / 2;
  }

  const extents = groups.map((group) => ({
    top: group.centerY - group.height / 2,
    bottom: group.centerY + group.height / 2,
  }));
  const blockTop = Math.min(...extents.map((extent) => extent.top));
  const blockBottom = Math.max(...extents.map((extent) => extent.bottom));
  const bottomLimit = height * 0.88 - translationLayout.reservedHeight;
  const minimumShift = topLimit - blockTop;
  const maximumShift = bottomLimit - blockBottom;
  let shiftY = 0;
  if (maximumShift >= minimumShift) {
    shiftY = clamp(0, minimumShift, maximumShift);
  } else {
    // Preserve readable top bounds when an unusually dense group cannot fit with its caption.
    shiftY = minimumShift;
  }
  if (shiftY !== 0) {
    groups.forEach((group) => {
      group.centerY += shiftY;
    });
  }

  const drawOrder = [...groups].sort((left, right) => {
    const rank = (mode: InkMode) => (mode === "past" ? 0 : mode === "future" ? 1 : 2);
    return (
      rank(rowMode(left.groupIndex, focusGroupIndex, program, musicTime)) -
      rank(rowMode(right.groupIndex, focusGroupIndex, program, musicTime))
    );
  });

  drawOrder.forEach((group) => {
    const top = group.centerY - group.height / 2;
    let rowTop = top;
    group.rows.forEach((rowLayout, rowIndex) => {
      const { row, mode, layout } = rowLayout;
      const isFocusGroupRow = mode === "active" && rowIndex === 0;
      const age = Math.max(0, musicTime - row.revealEndTime);
      const fade = mode === "past" ? 1 - 0.3 * clamp(age / 7, 0, 1) : 1;
      const alpha =
        frame.alpha *
        (mode === "active" ? 1 : mode === "past" ? 0.26 * fade : 0.5) *
        resolveHandwrittenRevealOpacity(reducedMotion, musicTime - shot.startTime);
      const blockCenterY = rowTop + rowLayout.rowHeight / 2;
      rowTop += rowLayout.rowHeight;

      if (alpha <= 0.01) return;

      layout.lines.forEach((line, lineIndex) => {
        const lineCenterY = blockCenterY + line.y;
        const lineShift =
          scene.rowShift * width * (lineIndex - (layout.lines.length - 1) / 2) +
          scene.rowShift * width * 0.5 * (rowIndex - (group.rows.length - 1) / 2);
        const lineCenterX = centerX + lineShift;
        const lineLeft =
          scene.rowAlign === "left"
            ? centerX - maxWidth / 2 + lineShift
            : scene.rowAlign === "right"
              ? centerX + maxWidth / 2 - line.width + lineShift
              : lineCenterX - line.width / 2;

        let cursor = lineLeft;
        const glyphs = line.items.map((item, itemIndex) => {
          const reservedAdvance = item.width * (item.scaleBoost ?? 1);
          const glyph = buildGlyph(
            item.text,
            cursor + (reservedAdvance - item.width) * 0.5,
            lineCenterY,
            item.width,
            layout.fontSize,
            item.start,
            item.end,
            `${shot.seed}:${row.id}:${lineIndex}:${itemIndex}:${item.text}`
          );
          if (item.scaleBoost) glyph.scaleBoost = item.scaleBoost;
          // 逐字 advance 抖动 ±2.5%：真实手写有呼吸，但仍保留明确的字组间距。
          const advanceJitter =
            (stableRandom(glyph.seed, "advance") - 0.5) * layout.fontSize * 0.025;
          cursor += reservedAdvance + advanceJitter;
          return glyph;
        });

        if (reducedMotion) {
          glyphs.forEach((glyph) => {
            glyph.reveal = resolveHandwrittenReducedMotionReveal(reducedMotion, mode);
          });
        }

        const flatIndex = layout.lines
          .slice(0, lineIndex)
          .reduce((sum, previous) => sum + previous.items.length, 0);
        const localStart = emphasis ? emphasis.unitIndex - flatIndex : -1;
        const rowEmphasis =
          mode === "active" &&
          isFocusGroupRow &&
          emphasis &&
          localStart >= 0 &&
          localStart < glyphs.length
            ? {
                unitIndex: localStart,
                unitCount: Math.min(emphasis.unitCount, glyphs.length - localStart),
                style: emphasis.style,
              }
            : null;

        const options: InkLineOptions = {
          pixelRatio: frame.pixelRatio,
          ctx,
          palette,
          fontFamily,
          musicTime,
          mode,
          alpha,
          tilt: scene.tilt + (lineIndex - (layout.lines.length - 1) / 2) * 0.003,
          centerX: lineCenterX,
          centerY: lineCenterY,
          glow: frame.settings.shimmerFeather / 100,
          reducedMotion,
          emphasis: rowEmphasis,
          inkColor: mode === "past" ? palette.inkGhost : palette.ink,
          annotationColor: emphasis?.tone === "seal" ? palette.seal : palette.accent,
          inkDensity: scene.inkDensity,
          quality: frame.quality,
          timeMs: frame.timeMs,
        };
        drawHandwrittenInkLine(glyphs, options);
      });
    });
  });

  drawTranslation(frame, ctx, centerX, blockBottom + shiftY, translationLayout);
}

function resolveTranslationLayout(
  frame: ContentFrame,
  ctx: CanvasRenderingContext2D,
  heroFontSize: number,
  maxWidth: number
): HandwrittenCaptionLayout {
  const subtitles = resolveLyricFilmTranslation(
    frame.state.translationGroups,
    frame.program.lineGroups,
    resolveHandwrittenTranslationTime(
      frame.musicTime,
      frame.shot.endTime,
      frame.restrictLyricsToShot === true
    )
  );
  const fontSize = Math.max(MIN_FONT_SIZE, heroFontSize * 0.23);
  const safeWidth = Math.max(120, Math.min(maxWidth, frame.width * 0.9));
  const texts = subtitles === null ? "" : `${subtitles[0] ?? ""}\u0001${subtitles[1] ?? ""}`;
  const cacheKey = `${texts}|${fontSize}|${safeWidth}|${frame.fontFamily}`;
  const cached = frame.state.captionCache.get(cacheKey);
  if (cached) return cached;

  const blocks: HandwrittenCaptionBlock[] = [];
  if (subtitles !== null) {
    for (let index = 0; index < subtitles.length && index < 2; index += 1) {
      const text = subtitles[index]!;
      blocks.push({
        text,
        lines: layoutHandwrittenPlainText(text, safeWidth, (grapheme) =>
          measureTextWidth(frame.state, ctx, grapheme, frame.fontFamily, fontSize)
        ),
      });
    }
  }
  const lineHeight = fontSize * 1.18;
  const blockGap = fontSize * 0.26;
  const contentHeight =
    blocks.reduce((sum, block) => sum + block.lines.length * lineHeight, 0) +
    Math.max(0, blocks.length - 1) * blockGap;
  const gap = heroFontSize * 0.16;

  const layout: HandwrittenCaptionLayout = {
    blocks,
    fontSize,
    lineHeight,
    blockGap,
    gap,
    contentHeight,
    reservedHeight: blocks.length > 0 ? gap + contentHeight : 0,
  };
  if (frame.state.captionCache.size >= MAX_CAPTION_CACHE) frame.state.captionCache.clear();
  frame.state.captionCache.set(cacheKey, layout);
  return layout;
}

function drawTranslation(
  frame: ContentFrame,
  ctx: CanvasRenderingContext2D,
  centerX: number,
  lyricBlockBottom: number,
  layout: HandwrittenCaptionLayout
): void {
  if (layout.blocks.length === 0) return;

  let top = lyricBlockBottom + layout.gap;
  for (let blockIndex = 0; blockIndex < layout.blocks.length; blockIndex += 1) {
    const block = layout.blocks[blockIndex]!;
    const blockHeight = block.lines.length * layout.lineHeight;
    const centerY = top + blockHeight / 2;
    drawHandwrittenLayoutBlock(
      frame,
      ctx,
      block.lines,
      centerX,
      centerY,
      layout.fontSize,
      frame.alpha * 0.76,
      withAlpha(frame.palette.ink, 0.78),
      `${frame.shot.seed}:translation:${blockIndex}`
    );
    top += blockHeight + layout.blockGap;
  }
}

/** 片头把曲名作为主字组、艺人作为落款，避免回到一行轻淡的小字幕。 */
function drawIntroSignature(frame: ContentFrame, ctx: CanvasRenderingContext2D): void {
  const { shot, musicTime, width, height, palette, scene, reducedMotion } = frame;
  const title = frame.title.trim();
  const artist = frame.artist.trim();
  const heroText = title || artist;
  if (!heroText) return;

  const heroFontSize = resolveHeroFontSize(frame.settings, width, height, scene);
  const maxWidth = Math.max(120, width * Math.min(0.82, Math.max(0.68, scene.maxWidthRatio)));
  const titleSize = clamp(heroFontSize * 0.78, 24, 132);
  const titleLines = layoutHandwrittenPlainText(heroText, maxWidth, (grapheme) =>
    measureTextWidth(frame.state, ctx, grapheme, frame.fontFamily, titleSize)
  );
  const titleHeight = titleLines.length * titleSize * 1.16;
  const signature = title && artist ? artist : "";
  const signatureSize = signature ? clamp(titleSize * 0.34, 14, 34) : 0;
  const signatureLines = signature
    ? layoutHandwrittenPlainText(signature, maxWidth, (grapheme) =>
        measureTextWidth(frame.state, ctx, grapheme, frame.fontFamily, signatureSize)
      )
    : [];
  const signatureHeight = signatureLines.length * signatureSize * 1.16;
  const signatureGap = signature ? titleSize * 0.34 : 0;
  const blockHeight = titleHeight + signatureGap + signatureHeight;
  const preferredCenterY = height * (height / Math.max(1, width) > 1.3 ? 0.66 : scene.anchorY);
  const centerY = clamp(
    preferredCenterY,
    height * 0.12 + blockHeight / 2,
    height * 0.88 - blockHeight / 2
  );
  const titleCenterY = centerY - (signatureHeight + signatureGap) / 2;
  const elapsed = musicTime - shot.startTime;
  const titleAlpha = frame.alpha * (reducedMotion ? 0.98 : smoothstep(elapsed / 0.2));
  drawHandwrittenLayoutBlock(
    frame,
    ctx,
    titleLines,
    width * 0.5,
    titleCenterY,
    titleSize,
    titleAlpha,
    withAlpha(palette.ink, 0.94),
    `${shot.seed}:intro-title`
  );

  if (signatureLines.length > 0) {
    const signatureCenterY = titleCenterY + titleHeight / 2 + signatureGap + signatureHeight / 2;
    const signatureAlpha =
      frame.alpha * (reducedMotion ? 0.76 : smoothstep((elapsed - 0.26) / 0.42) * 0.78);
    drawHandwrittenLayoutBlock(
      frame,
      ctx,
      signatureLines,
      width * 0.5,
      signatureCenterY,
      signatureSize,
      signatureAlpha,
      withAlpha(palette.inkSoft, 0.92),
      `${shot.seed}:intro-artist`
    );
  }
}

/** Instrumental pages carry a centered sketch and a small metadata signature, never fabricated lyrics. */
function drawInstrumentalSubject(frame: ContentFrame, ctx: CanvasRenderingContext2D): void {
  const { shot, musicTime, width, height, palette, scene, reducedMotion } = frame;
  const title = frame.title.trim();
  const artist = frame.artist.trim();
  const heroText = title || artist;
  if (!heroText) return;

  const heroFontSize = resolveHeroFontSize(frame.settings, width, height, scene);
  const maxWidth = Math.max(120, Math.min(width * 0.82, width * scene.maxWidthRatio));
  const titleSize = clamp(heroFontSize * 0.62, 22, 108);
  const titleLines = layoutHandwrittenPlainText(heroText, maxWidth, (grapheme) =>
    measureTextWidth(frame.state, ctx, grapheme, frame.fontFamily, titleSize)
  );
  const titleHeight = titleLines.length * titleSize * 1.16;
  const signature = title && artist ? artist : "";
  const signatureSize = signature ? clamp(titleSize * 0.34, 14, 30) : 0;
  const signatureLines = signature
    ? layoutHandwrittenPlainText(signature, maxWidth, (grapheme) =>
        measureTextWidth(frame.state, ctx, grapheme, frame.fontFamily, signatureSize)
      )
    : [];
  const signatureHeight = signatureLines.length * signatureSize * 1.16;
  const signatureGap = signature ? titleSize * 0.28 : 0;
  const blockHeight = titleHeight + signatureGap + signatureHeight;
  const preferredCenterY = height * (height / Math.max(1, width) > 1.3 ? 0.78 : 0.79);
  const centerY = clamp(
    preferredCenterY,
    height * 0.58 + blockHeight / 2,
    height * 0.9 - blockHeight / 2
  );
  const titleCenterY = centerY - (signatureHeight + signatureGap) / 2;
  const elapsed = musicTime - shot.startTime;
  const entrance = reducedMotion ? 1 : smoothstep(elapsed / 0.48);
  drawHandwrittenLayoutBlock(
    frame,
    ctx,
    titleLines,
    width * 0.5,
    titleCenterY,
    titleSize,
    frame.alpha * entrance * 0.94,
    withAlpha(palette.ink, 0.94),
    `${shot.seed}:instrument-title`
  );

  if (signatureLines.length > 0) {
    drawHandwrittenLayoutBlock(
      frame,
      ctx,
      signatureLines,
      width * 0.5,
      titleCenterY + titleHeight / 2 + signatureGap + signatureHeight / 2,
      signatureSize,
      frame.alpha * entrance * 0.78,
      withAlpha(palette.inkSoft, 0.88),
      `${shot.seed}:instrument-artist`
    );
  }
}

function drawCenteredInkLine(
  ctx: CanvasRenderingContext2D,
  frame: ContentFrame,
  text: string,
  centerX: number,
  centerY: number,
  fontSize: number,
  alpha: number,
  inkColor: string,
  seed: string
): void {
  if (alpha <= 0.01) return;
  const measured = measureGraphemeWidths(frame.state, ctx, text, frame.fontFamily, fontSize);
  let cursor = centerX - measured.totalWidth * 0.5;
  const glyphs = measured.graphemes.map((grapheme, index) => {
    const width = measured.widths[index] ?? 0;
    const glyph = buildGlyph(
      grapheme,
      cursor,
      centerY,
      width,
      fontSize,
      0,
      1,
      `${seed}:${index}`,
      1
    );
    cursor += width;
    return glyph;
  });
  drawHandwrittenInkLine(glyphs, {
    pixelRatio: frame.pixelRatio,

    ctx,
    palette: frame.palette,
    fontFamily: frame.fontFamily,
    musicTime: 0,
    mode: "active",
    alpha,
    tilt: 0,
    centerX,
    centerY,
    glow: 0.4,
    reducedMotion: true,
    emphasis: null,
    inkColor,
    quality: frame.quality,
  });
}

function drawHandwrittenLayoutBlock(
  frame: ContentFrame,
  ctx: CanvasRenderingContext2D,
  lines: readonly PlainTextLayoutLine[],
  centerX: number,
  centerY: number,
  fontSize: number,
  alpha: number,
  inkColor: string,
  seed: string
): number {
  if (alpha <= 0.01 || lines.length === 0) return 0;
  const lineHeight = fontSize * 1.16;
  const blockHeight = lines.length * lineHeight;
  const firstLineCenter = centerY - blockHeight / 2 + lineHeight / 2;

  lines.forEach((line, lineIndex) => {
    let cursor = centerX - line.width / 2;
    const glyphs = line.items.map((item, itemIndex) => {
      const reservedAdvance = item.width * (item.scaleBoost ?? 1);
      const glyph = buildGlyph(
        item.text,
        cursor + (reservedAdvance - item.width) * 0.5,
        firstLineCenter + lineIndex * lineHeight,
        item.width,
        fontSize,
        item.start,
        item.end,
        `${seed}:${lineIndex}:${itemIndex}:${item.text}`,
        1
      );
      if (item.scaleBoost) glyph.scaleBoost = item.scaleBoost;
      cursor += reservedAdvance;
      return glyph;
    });

    drawHandwrittenInkLine(glyphs, {
      pixelRatio: frame.pixelRatio,
      ctx,
      palette: frame.palette,
      fontFamily: frame.fontFamily,
      musicTime: frame.musicTime,
      mode: "active",
      alpha,
      tilt: 0,
      centerX,
      centerY: firstLineCenter + lineIndex * lineHeight,
      glow: 0.25,
      reducedMotion: frame.reducedMotion,
      emphasis: null,
      inkColor,
      inkDensity: frame.scene.inkDensity,
      quality: frame.quality,
      timeMs: frame.timeMs,
    });
  });

  return blockHeight;
}

/** 竖排标题：片尾「落款」变体用。 */
function drawVerticalTitle(
  frame: ContentFrame,
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  topY: number,
  fontSize: number,
  visibleCount: number
): void {
  if (!text.trim()) return;
  const graphemes = segmentLyricFilmGraphemes(text.trim());
  const lineHeight = fontSize * 1.14;
  const glyphs = graphemes.map((grapheme, index) =>
    buildGlyph(
      grapheme,
      x - fontSize * 0.5,
      topY + index * lineHeight + lineHeight * 0.5,
      fontSize,
      fontSize,
      0,
      1,
      `${frame.shot.seed}:vtitle:${index}`,
      index < visibleCount ? 1 : 0
    )
  );
  drawHandwrittenInkLine(glyphs, {
    pixelRatio: frame.pixelRatio,

    ctx,
    palette: frame.palette,
    fontFamily: frame.fontFamily,
    musicTime: frame.musicTime,
    mode: "active",
    alpha: frame.alpha,
    tilt: 0,
    centerX: x,
    centerY: topY + (graphemes.length * lineHeight) / 2,
    glow: 0.8,
    reducedMotion: frame.reducedMotion,
    emphasis: null,
    quality: frame.quality,
    timeMs: frame.timeMs,
  });
}

/** 片尾：三种排版变体 + 手写署名 + 红色印章。 */
function drawEndingCredits(frame: ContentFrame, ctx: CanvasRenderingContext2D): void {
  const { shot, musicTime, width, height, palette, fontFamily, scene, title, artist, album } =
    frame;
  const displayTitle = title.trim();
  const displayArtist = artist.trim();
  const displayAlbum = album.trim();
  if (!displayTitle && !displayArtist && !displayAlbum) return;

  const titleGraphemes = segmentLyricFilmGraphemes(displayTitle);
  const credits = frame.reducedMotion
    ? {
        cardOpacity: 1,
        titleVisibleGraphemes: titleGraphemes.length,
        artistOpacity: displayArtist ? 1 : 0,
        albumOpacity: displayAlbum ? 1 : 0,
      }
    : resolveLyricFilmCreditsFrame(
        shot.startTime,
        shot.endTime,
        musicTime,
        displayTitle,
        Boolean(displayArtist),
        Boolean(displayAlbum),
        false
      );
  if (credits.cardOpacity <= 0.01) return;

  const heroFontSize = resolveHeroFontSize(frame.settings, width, height, scene);
  const alpha = frame.alpha * clamp(credits.cardOpacity, 0, 1);
  const elapsed = musicTime - shot.startTime;
  const duration = Math.max(0.001, shot.endTime - shot.startTime);
  const sealProgress = clamp((elapsed - Math.min(2.4, duration * 0.34)) / 0.55, 0, 1);

  if (scene.creditsVariant === "vertical") {
    const titleSize = clamp(heroFontSize * 0.82, 28, 140);
    const columnHeight = titleGraphemes.length * titleSize * 1.14;
    const columnX = width * 0.68;
    const topY = clamp(height * 0.4 - columnHeight / 2, height * 0.12, height * 0.5);
    drawVerticalTitle(
      frame,
      ctx,
      displayTitle,
      columnX,
      topY,
      titleSize,
      credits.titleVisibleGraphemes
    );

    // 艺人 / 专辑紧贴在竖排标题下方，避免小字飘到画面中间。
    const captionY = topY + columnHeight + titleSize * 0.62;
    if (displayArtist && credits.artistOpacity > 0.02) {
      drawCenteredInkLine(
        ctx,
        frame,
        displayArtist,
        columnX,
        captionY,
        titleSize * 0.36,
        alpha * credits.artistOpacity * 0.92,
        withAlpha(palette.ink, 0.84),
        `${shot.seed}:artist`
      );
    }
    if (displayAlbum && credits.albumOpacity > 0.02) {
      drawCenteredInkLine(
        ctx,
        frame,
        displayAlbum,
        columnX,
        captionY + titleSize * 0.48,
        titleSize * 0.27,
        alpha * credits.albumOpacity * 0.75,
        withAlpha(palette.ink, 0.62),
        `${shot.seed}:album`
      );
    }
    if (sealProgress > 0) {
      drawHandwrittenSeal({
        ctx,
        palette,
        fontFamily,
        x: columnX - titleSize * 1.05,
        y: topY + columnHeight + titleSize * 0.38,
        size: clamp(titleSize * 0.62, 30, 88),
        text: titleGraphemes.slice(0, 2).join(""),
        progress: sealProgress,
        rotation: -0.06,
        quality: frame.quality,
      });
    }
    return;
  }

  const postcard = scene.creditsVariant === "postcard";
  const titleSize = clamp(heroFontSize * (postcard ? 0.95 : 1.15), width * 0.05, width * 0.105);
  const centerX = postcard ? width * 0.34 : width * 0.5;
  const titleY = postcard ? height * 0.4 : height * 0.44;
  const measured = measureGraphemeWidths(frame.state, ctx, displayTitle, fontFamily, titleSize);
  let cursor = centerX - measured.totalWidth * 0.5;
  const titleGlyphs = measured.graphemes.map((grapheme, index) => {
    const glyphWidth = measured.widths[index] ?? 0;
    const glyph = buildGlyph(
      grapheme,
      cursor,
      titleY,
      glyphWidth,
      titleSize,
      0,
      1,
      `${shot.seed}:title:${index}`,
      index < credits.titleVisibleGraphemes ? 1 : 0
    );
    cursor += glyphWidth;
    return glyph;
  });
  drawHandwrittenInkLine(titleGlyphs, {
    pixelRatio: frame.pixelRatio,

    ctx,
    palette,
    fontFamily,
    musicTime,
    mode: "active",
    alpha,
    tilt: scene.tilt * 1.2,
    centerX,
    centerY: titleY,
    glow: 0.9,
    reducedMotion: frame.reducedMotion,
    emphasis: null,
    quality: frame.quality,
    timeMs: frame.timeMs,
  });

  if (displayArtist && credits.artistOpacity > 0.02) {
    drawCenteredInkLine(
      ctx,
      frame,
      displayArtist,
      postcard ? width * 0.58 : centerX,
      titleY + titleSize * 0.92,
      titleSize * 0.36,
      alpha * credits.artistOpacity * 0.9,
      withAlpha(palette.ink, 0.8),
      `${shot.seed}:artist`
    );
  }

  if (displayAlbum && credits.albumOpacity > 0.02) {
    drawCenteredInkLine(
      ctx,
      frame,
      displayAlbum,
      postcard ? width * 0.6 : centerX,
      titleY + titleSize * 1.34,
      titleSize * 0.28,
      alpha * credits.albumOpacity * 0.8,
      withAlpha(palette.ink, 0.62),
      `${shot.seed}:album`
    );
  }

  if (sealProgress > 0 && titleGraphemes.length > 0) {
    const sealSize = clamp(titleSize * (postcard ? 0.66 : 0.58), 30, 92);
    drawHandwrittenSeal({
      ctx,
      palette,
      fontFamily,
      x: postcard
        ? width * 0.82
        : Math.min(width * 0.86, centerX + measured.totalWidth * 0.5 + sealSize * 0.7),
      y: postcard ? height * 0.52 : titleY + titleSize * 0.38,
      size: sealSize,
      text: titleGraphemes.slice(0, 2).join(""),
      progress: sealProgress,
      rotation: -0.07,
      quality: frame.quality,
    });
  }
}

/** 大幅铅笔线稿：给留白的一侧一个主体，像手账里配的小插画。 */
function drawShotIllustrations(frame: ContentFrame, ctx: CanvasRenderingContext2D): void {
  const { scene, width, height, musicTime, shot, palette, alpha, reducedMotion } = frame;
  const baseUnit = clamp(Math.min(width, height) * 0.08, 28, 92);
  for (const illustration of scene.illustrations) {
    const progress = reducedMotion
      ? 1
      : clamp((musicTime - shot.startTime - illustration.delay) / illustration.duration, 0, 1);
    if (progress <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha * (illustration.color === "pencil" ? 0.66 : 0.36);
    drawHandwrittenDoodle(illustration, {
      ctx,
      palette,
      width,
      height,
      unit: baseUnit,
      progress,
      reducedMotion,
      timeMs: frame.timeMs,
      quality: frame.quality,
    });
    ctx.restore();
  }
}

function drawShotDoodles(
  frame: ContentFrame,
  ctx: CanvasRenderingContext2D,
  layer: "back" | "front"
): void {
  const { scene, width, height, musicTime, shot, palette, alpha, reducedMotion } = frame;
  const baseUnit = clamp(Math.min(width, height) * 0.08, 28, 92);
  for (const doodle of scene.doodles) {
    if (doodle.layer !== layer) continue;
    const progress = reducedMotion ? 1 : resolveDoodleProgress(doodle, musicTime, shot.startTime);
    if (progress <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawHandwrittenDoodle(doodle, {
      ctx,
      palette,
      width,
      height,
      unit: baseUnit,
      progress,
      reducedMotion,
      timeMs: frame.timeMs,
      quality: frame.quality,
    });
    ctx.restore();
  }
}

/** 折角：右上角掀起来的一小块纸。 */
function drawPageFold(
  ctx: CanvasRenderingContext2D,
  palette: HandwrittenPalette,
  width: number,
  height: number,
  size: number
): void {
  const marginX = width * 0.03;
  const marginY = height * 0.038;
  const cornerX = width - marginX;
  const cornerY = marginY;
  const fold = Math.max(18, size);
  ctx.save();
  // 折角是纸本身：用纸色而不是桌面灰，只有折缝带一点阴影。
  ctx.beginPath();
  ctx.moveTo(cornerX - fold, cornerY);
  ctx.lineTo(cornerX, cornerY);
  ctx.lineTo(cornerX, cornerY + fold);
  ctx.closePath();
  ctx.fillStyle = withAlpha(palette.paperLight, 0.96);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cornerX - fold, cornerY);
  ctx.lineTo(cornerX - fold * 0.72, cornerY + fold * 0.72);
  ctx.lineTo(cornerX, cornerY + fold);
  ctx.lineTo(cornerX, cornerY);
  ctx.closePath();
  ctx.fillStyle = withAlpha(palette.paperDeep, 0.35);
  ctx.fill();
  ctx.strokeStyle = withAlpha(palette.shadow, 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cornerX - fold, cornerY);
  ctx.lineTo(cornerX - fold * 0.72, cornerY + fold * 0.72);
  ctx.lineTo(cornerX, cornerY + fold);
  ctx.stroke();
  ctx.restore();
}

/** 贴纸/纸片的软投影：真实手账里"贴上去的东西"一定有投影，否则全部浮在纸面上。 */
function drawSoftShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  alpha: number
): void {
  if (alpha <= 0.004) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, Math.max(0.2, radiusY / Math.max(1, radiusX)));
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, radiusX));
  gradient.addColorStop(0, `rgba(24, 18, 12, ${alpha.toFixed(3)})`);
  gradient.addColorStop(0.55, `rgba(24, 18, 12, ${(alpha * 0.6).toFixed(3)})`);
  gradient.addColorStop(1, "rgba(24, 18, 12, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, radiusX), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 撕纸片：一小块贴在页边的纸，上面有一行手写小字。 */
function drawScrapObject(
  ctx: CanvasRenderingContext2D,
  palette: HandwrittenPalette,
  x: number,
  y: number,
  size: number,
  rotation: number,
  caption: string,
  fontFamily: string,
  alpha: number
): void {
  const width = size * 1.55;
  const height = size * 0.82;
  drawSoftShadow(ctx, x + size * 0.06, y + size * 0.1, width * 0.56, height * 0.52, alpha * 0.2);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  const steps = 6;
  const corners: Array<[number, number, number, number]> = [
    [-width / 2, -height / 2, -width / 2, 1],
    [width / 2, -height / 2, 1, 0],
    [width / 2, height / 2, 1, 1],
    [-width / 2, height / 2, 0, 1],
  ];
  let first = true;
  for (let edge = 0; edge < corners.length; edge += 1) {
    const [fromX, fromY] = corners[edge]!;
    const [toX, toY] = corners[(edge + 1) % corners.length]!;
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      const wobble = (stableRandom(caption, `scrap-${edge}-${step}`) - 0.5) * size * 0.07;
      const pointX = fromX + (toX - fromX) * t + wobble;
      const pointY = fromY + (toY - fromY) * t + wobble * 0.6;
      if (first) {
        ctx.moveTo(pointX, pointY);
        first = false;
      } else {
        ctx.lineTo(pointX, pointY);
      }
    }
  }
  ctx.closePath();
  ctx.fillStyle = withAlpha(palette.paperLight, 0.92);
  ctx.fill();
  ctx.strokeStyle = withAlpha(palette.paperDeep, 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();

  // 撕纸上的手写小字：两三条起伏短笔画，远看是字，近看不是任何可读文本。
  ctx.strokeStyle = withAlpha(palette.inkSoft, 0.72);
  ctx.lineWidth = Math.max(1, size * 0.022);
  ctx.lineCap = "round";
  for (let line = 0; line < 2; line += 1) {
    const baseY = -height * 0.12 + line * height * 0.26;
    ctx.beginPath();
    for (let segment = 0; segment < 4; segment += 1) {
      const startX = -width * 0.32 + segment * width * 0.17;
      const wobble = stableRandom(caption, `scrap-line-${line}-${segment}`) * height * 0.1;
      if (segment === 0) ctx.moveTo(startX, baseY + wobble);
      else ctx.lineTo(startX, baseY + wobble);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** 拍立得：一张照片纸，里面是抽象的手绘色块（不画"图片占位符"图标）。 */
function drawPolaroidObject(
  ctx: CanvasRenderingContext2D,
  palette: HandwrittenPalette,
  x: number,
  y: number,
  size: number,
  rotation: number,
  caption: string,
  fontFamily: string,
  alpha: number
): void {
  const width = size * 1.28;
  const height = size * 1.5;
  drawSoftShadow(ctx, x + size * 0.08, y + size * 0.12, width * 0.6, height * 0.55, alpha * 0.22);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = withAlpha(palette.paperLight, 0.96);
  ctx.beginPath();
  ctx.rect(-width / 2, -height / 2, width, height);
  ctx.fill();
  ctx.strokeStyle = withAlpha(palette.paperDeep, 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();

  const inset = width * 0.075;
  const photoHeight = height * 0.7;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-width / 2 + inset, -height / 2 + inset, width - inset * 2, photoHeight);
  ctx.clip();
  const photo = ctx.createLinearGradient(0, -height / 2, 0, -height / 2 + photoHeight);
  photo.addColorStop(0, withAlpha(palette.accent, 0.22));
  photo.addColorStop(0.55, withAlpha(palette.paperDeep, 0.35));
  photo.addColorStop(1, withAlpha(palette.highlight, 0.28));
  ctx.fillStyle = photo;
  ctx.fillRect(-width / 2, -height / 2, width, photoHeight + inset);
  ctx.strokeStyle = withAlpha(palette.paperLight, 0.5);
  ctx.lineWidth = Math.max(1, size * 0.02);
  for (let index = 0; index < 2; index += 1) {
    ctx.beginPath();
    ctx.moveTo(-width * 0.36, height * 0.08 + index * size * 0.1);
    ctx.quadraticCurveTo(
      0,
      -height * 0.02 + index * size * 0.09,
      width * 0.36,
      height * 0.1 + index * size * 0.08
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = withAlpha(palette.inkSoft, 0.6);
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-width * 0.3, height * 0.35);
  ctx.lineTo(-width * 0.3 + caption.length * size * 0.07, height * 0.35);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** 实物装饰：胶带、回形针、邮票、折角、小印章、纸片、拍立得。 */
function drawDecorations(frame: DecorationFrame, ctx: CanvasRenderingContext2D): void {
  const { scene, width, height, shot, musicTime, palette, reducedMotion } = frame;
  if (scene.decorations.length === 0) return;
  const baseUnit = clamp(Math.min(width, height) * 0.08, 28, 92);
  const elapsed = musicTime - shot.startTime;

  for (const decoration of scene.decorations) {
    const entrance = reduceEntrance(decoration, elapsed, shot, reducedMotion);
    if (entrance <= 0) continue;
    const eased = smoothstep(entrance);

    if (decoration.kind === "fold") {
      ctx.save();
      ctx.globalAlpha = frame.alpha * eased;
      drawPageFold(ctx, palette, width, height, Math.min(width, height) * 0.075 * decoration.scale);
      ctx.restore();
      continue;
    }

    if (decoration.kind === "scrap") {
      drawScrapObject(
        ctx,
        palette,
        decoration.x * width,
        decoration.y * height,
        baseUnit * decoration.scale,
        decoration.rotation,
        decoration.caption ?? "10.20",
        frame.fontFamily,
        frame.alpha * eased
      );
      continue;
    }

    if (decoration.kind === "polaroid") {
      drawPolaroidObject(
        ctx,
        palette,
        decoration.x * width,
        decoration.y * height,
        baseUnit * decoration.scale,
        decoration.rotation,
        decoration.caption ?? "夜航",
        frame.fontFamily,
        frame.alpha * eased
      );
      continue;
    }

    if (decoration.kind === "seal") {
      drawSoftShadow(
        ctx,
        decoration.x * width + baseUnit * 0.04,
        decoration.y * height + baseUnit * 0.06,
        baseUnit * 0.42,
        baseUnit * 0.34,
        frame.alpha * eased * 0.16
      );
      drawHandwrittenSeal({
        ctx,
        palette,
        fontFamily: frame.fontFamily,
        x: decoration.x * width,
        y: decoration.y * height,
        size: baseUnit * decoration.scale,
        text: decoration.label ?? "温光",
        progress: entrance,
        rotation: decoration.rotation,
        quality: frame.quality,
      });
      continue;
    }

    const objectSize = baseUnit * decoration.scale * (decoration.kind === "tape" ? 2.1 : 1.15);
    drawSoftShadow(
      ctx,
      decoration.x * width + objectSize * 0.1,
      decoration.y * height + objectSize * 0.12,
      objectSize * 0.55,
      objectSize * 0.42,
      frame.alpha * eased * 0.18
    );

    ctx.save();
    ctx.globalAlpha = frame.alpha * eased;
    drawHandwrittenDoodle(
      {
        kind: decoration.kind,
        x: decoration.x,
        y: decoration.y,
        scale: decoration.scale,
        rotation: decoration.rotation,
        delay: 0,
        duration: 0.5,
        color: decoration.kind === "tape" ? "highlight" : "ink",
        layer: "front",
        flip: decoration.flip,
      },
      {
        ctx,
        palette,
        width,
        height,
        unit: baseUnit,
        progress: entrance,
        reducedMotion,
        timeMs: frame.timeMs,
        quality: frame.quality,
      }
    );
    ctx.restore();
  }
}

function reduceEntrance(
  decoration: HandwrittenDecorationSpec,
  elapsed: number,
  shot: { startTime: number; endTime: number },
  reducedMotion: boolean
): number {
  if (reducedMotion) return 1;
  const base =
    decoration.kind === "seal"
      ? Math.max(0.8, (shot.endTime - shot.startTime) * 0.45)
      : decoration.kind === "paperclip"
        ? 0.55
        : 0.25;
  return clamp((elapsed - base) / 0.5, 0, 1);
}

/** 文字后面的一层淡淡水彩色：把歌词从纸面上「托」起来。 */
function drawTextWash(frame: ContentFrame, ctx: CanvasRenderingContext2D): void {
  const { width, height, palette, scene, alpha } = frame;
  const radius = Math.max(width * 0.32, height * 0.36);
  ctx.save();
  ctx.globalAlpha = alpha * 0.75;
  ctx.translate(scene.anchorX * width, scene.anchorY * height);
  ctx.scale(1, 0.62);
  const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  wash.addColorStop(0, withAlpha(palette.highlight, 0.13));
  wash.addColorStop(0.55, withAlpha(palette.highlight, 0.05));
  wash.addColorStop(1, withAlpha(palette.highlight, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.globalAlpha = alpha * 0.5;
  const coolWash = ctx.createRadialGradient(
    -radius * 0.2,
    radius * 0.15,
    0,
    -radius * 0.2,
    radius * 0.15,
    radius * 0.8
  );
  coolWash.addColorStop(0, withAlpha(palette.accent, 0.05));
  coolWash.addColorStop(1, withAlpha(palette.accent, 0));
  ctx.fillStyle = coolWash;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

/** 间奏/器乐镜头：把上一句已经写下的歌词留作淡淡的「余韵」。 */
function drawInterludeEcho(frame: ContentFrame, ctx: CanvasRenderingContext2D): void {
  const { program, shot, musicTime, width, height, scene, palette, reducedMotion } = frame;
  const previousGroup = [...program.lineGroups]
    .reverse()
    .find((group) => group.start <= shot.startTime + 0.05);
  const text = previousGroup?.lines
    .map((line) => line.text)
    .filter(Boolean)
    .at(-1)
    ?.trim();
  if (!text) return;

  const heroFontSize = resolveHeroFontSize(frame.settings, width, height, scene);
  const fontSize = clamp(heroFontSize * 0.44, 20, 112);
  const maxWidth = Math.max(120, Math.min(width * scene.maxWidthRatio, width * 0.88));
  const lines = layoutHandwrittenPlainText(text, maxWidth, (grapheme) =>
    measureTextWidth(frame.state, ctx, grapheme, frame.fontFamily, fontSize)
  );
  const lineHeight = fontSize * 1.16;
  const blockHeight = lines.length * lineHeight;
  const translationLayout = resolveTranslationLayout(frame, ctx, heroFontSize, maxWidth);
  const safeTop = height * 0.12;
  const safeBottom = height * 0.88 - translationLayout.reservedHeight;
  const centerX = clamp(scene.anchorX * width, maxWidth * 0.5, width - maxWidth * 0.5);
  const minimumCenter = safeTop + blockHeight / 2;
  const maximumCenter = safeBottom - blockHeight / 2;
  const preferredCenter = scene.anchorY * height;
  const centerY =
    maximumCenter >= minimumCenter
      ? clamp(preferredCenter, minimumCenter, maximumCenter)
      : minimumCenter;
  const elapsed = musicTime - shot.startTime;
  const fadeIn = reducedMotion ? 1 : smoothstep(clamp(elapsed / 1, 0, 1));
  drawHandwrittenLayoutBlock(
    frame,
    ctx,
    lines,
    centerX,
    centerY,
    fontSize,
    frame.alpha * fadeIn * 0.46,
    withAlpha(palette.inkSoft, 0.94),
    `${shot.seed}:echo`
  );
  drawTranslation(frame, ctx, centerX, centerY + blockHeight / 2, translationLayout);
}

function drawShotContent(
  contentFrame: ContentFrame,
  ctx: CanvasRenderingContext2D,
  camera: HandwrittenCameraFrame
): void {
  const { width, height, scene, alpha } = contentFrame;
  if (alpha <= 0.005) return;

  ctx.save();
  applyHandwrittenCamera(ctx, camera, scene.paperRotation, width, height);

  drawDecorations(contentFrame, ctx);
  drawShotDoodles(contentFrame, ctx, "back");
  drawShotIllustrations(contentFrame, ctx);
  drawTextWash(contentFrame, ctx);

  if (contentFrame.shot.kind === "lyrics") {
    drawLyricRows(contentFrame, ctx);
  } else if (contentFrame.shot.kind === "intro") {
    drawIntroSignature(contentFrame, ctx);
  } else if (contentFrame.shot.kind === "outro") {
    drawEndingCredits(contentFrame, ctx);
  } else if (contentFrame.shot.kind === "interlude") {
    drawInterludeEcho(contentFrame, ctx);
  } else {
    drawInstrumentalSubject(contentFrame, ctx);
  }

  drawShotDoodles(contentFrame, ctx, "front");
  ctx.restore();
}

function resolveShotBlend(program: LyricFilmProgram, musicTime: number): ShotBlend | null {
  const shotIndex = findLyricFilmShotIndexAtTime(program, musicTime);
  const current = program.shots[shotIndex];
  if (!current) return null;

  const activeTransition = current.transitionOut;
  const next = program.shots[shotIndex + 1];
  if (
    activeTransition &&
    next &&
    musicTime >= activeTransition.startTime &&
    musicTime <= activeTransition.endTime
  ) {
    const duration = Math.max(0.001, activeTransition.endTime - activeTransition.startTime);
    return {
      outgoing: current,
      incoming: next,
      progress: clamp((musicTime - activeTransition.startTime) / duration, 0, 1),
    };
  }

  const previous = program.shots[shotIndex - 1];
  const incomingTransition = previous?.transitionOut;
  if (
    previous &&
    incomingTransition &&
    musicTime >= incomingTransition.startTime &&
    musicTime <= incomingTransition.endTime
  ) {
    const duration = Math.max(0.001, incomingTransition.endTime - incomingTransition.startTime);
    return {
      outgoing: previous,
      incoming: current,
      progress: clamp((musicTime - incomingTransition.startTime) / duration, 0, 1),
    };
  }

  return { outgoing: current, incoming: null, progress: 0 };
}

/** 内容比纸面轻微视差，制造纸与字的层次。 */
function contentCamera(camera: HandwrittenCameraFrame): HandwrittenCameraFrame {
  return {
    zoom: camera.zoom,
    x: camera.x * 1.16,
    y: camera.y * 1.16,
    rotation: camera.rotation * 1.08,
  };
}

/** Move both pages gently while their lettering is still visible during a page turn. */
function applyTransitionPageTransform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: ReturnType<typeof resolveHandwrittenTransitionFrame>,
  outgoing: boolean
): void {
  const progress = outgoing ? frame.outgoingProgress : frame.incomingProgress;
  const scale = outgoing ? 1 + progress * 0.012 : 1.016 - progress * 0.016;
  const verticalOffset = outgoing
    ? -height * (progress * 0.006 + frame.pageLift * 0.008)
    : height * ((1 - progress) * 0.01 + frame.pageLift * 0.006);
  ctx.translate(width * 0.5, height * 0.5 + verticalOffset);
  ctx.scale(scale, scale);
  ctx.translate(-width * 0.5, -height * 0.5);
}

interface SharedFrameInput {
  state: HandwrittenRuntimeState;
  program: LyricFilmProgram;
  shot: LyricFilmShot;
  musicTime: number;
  timeMs: number;
  width: number;
  height: number;
  palette: HandwrittenPalette;
  fontFamily: string;
  settings: HandwrittenSettings;
  reducedMotion: boolean;
  quality: QualityTier;
  title: string;
  artist: string;
  album: string;
  isPlaying: boolean;
  motionSpeed: number;
  pixelRatio: number;
}

function buildContentFrame(base: SharedFrameInput, alpha: number): ContentFrame {
  const scene = getScene(base.state, base.shot, base.width, base.height, base.reducedMotion);
  const heroFontSize = resolveHeroFontSize(base.settings, base.width, base.height, scene);
  // 手抖线（boiling line）的时钟必须由音乐时间派生：暂停 / seek / 重绘时
  // 同一音乐时刻要得到同一帧，不能依赖真实墙钟。
  return { ...base, scene, heroFontSize, alpha, timeMs: base.musicTime * 1000 };
}

/** 转场快照：转场开始时把 outgoing 内容抓成一张画布，之后每帧只淡出这张图。 */
function ensureTransitionSnapshot(
  state: HandwrittenRuntimeState,
  frame: ContentFrame,
  ctx: CanvasRenderingContext2D,
  camera: HandwrittenCameraFrame,
  key: string,
  canonicalMusicTime: number
): TransitionSnapshot | null {
  const cached = state.transitionSnapshot;
  if (
    cached &&
    cached.key === key &&
    cached.width === frame.width &&
    cached.height === frame.height &&
    Math.abs(cached.canonicalMusicTime - canonicalMusicTime) <= 0.001
  ) {
    return cached;
  }
  if (typeof document === "undefined") return null;

  const dpr = clamp(ctx.canvas.width / Math.max(1, frame.width), 1, 4);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(frame.width * dpr));
  canvas.height = Math.max(2, Math.round(frame.height * dpr));
  const snapshotCtx = canvas.getContext("2d");
  if (!snapshotCtx) return null;
  snapshotCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  snapshotCtx.clearRect(0, 0, frame.width, frame.height);
  const snapshotFrame: ContentFrame = {
    ...frame,
    musicTime: canonicalMusicTime,
    timeMs: canonicalMusicTime * 1000,
    alpha: 1,
    restrictLyricsToShot: true,
  };
  drawShotContent(snapshotFrame, snapshotCtx, camera);
  const snapshot: TransitionSnapshot = {
    key,
    canvas,
    width: frame.width,
    height: frame.height,
    canonicalMusicTime,
  };
  state.transitionSnapshot = snapshot;
  return snapshot;
}

function drawIdlePage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: HandwrittenPalette,
  settings: HandwrittenSettings,
  reducedMotion: boolean,
  frameTimeMs: number,
  quality: QualityTier
): void {
  const scene = resolveHandwrittenScene({
    seed: "idle-page",
    profile: "motes",
    shotKind: "instrumental",
    width,
    height,
    units: [],
    reducedMotion,
  });
  const camera: HandwrittenCameraFrame = {
    zoom: 1.006,
    x: 0,
    y: 0,
    rotation: reducedMotion ? 0 : Math.sin(frameTimeMs / 9000) * 0.0008,
  };
  drawHandwrittenPaperSurface({
    ctx,
    width,
    height,
    palette,
    paletteIndex: Math.round(settings.colorScheme),
    camera,
    scene,
    musicTime: frameTimeMs / 1000,
    shotStartTime: 0,
    glowIntensity: settings.ambientGlowIntensity,
    grain: settings.filmGrain,
    vignette: settings.vignetteStrength,
    reducedMotion,
    motionSpeed: settings.fluidSpeed,
    paused: false,
    quality,
  });

  const idleFrame: DecorationFrame = {
    width,
    height,
    palette,
    fontFamily: resolveHandwrittenFont(settings.fontStyle),
    scene,
    quality,
    alpha: 1,
    reducedMotion,
    timeMs: frameTimeMs,
    musicTime: frameTimeMs / 1000,
    shot: { startTime: 0, endTime: 3600 },
  };

  ctx.save();
  applyHandwrittenCamera(ctx, camera, scene.paperRotation, width, height);
  const idleUnit = clamp(Math.min(width, height) * 0.08, 28, 92);
  for (const doodle of scene.doodles) {
    drawHandwrittenDoodle(doodle, {
      ctx,
      palette,
      width,
      height,
      unit: idleUnit,
      progress: 1,
      reducedMotion,
      timeMs: frameTimeMs,
      quality,
    });
  }
  for (const illustration of scene.illustrations) {
    ctx.globalAlpha = illustration.color === "pencil" ? 0.42 : 0.3;
    drawHandwrittenDoodle(illustration, {
      ctx,
      palette,
      width,
      height,
      unit: idleUnit,
      progress: 1,
      reducedMotion,
      timeMs: frameTimeMs,
      quality,
    });
    ctx.globalAlpha = 1;
  }
  drawDecorations(idleFrame, ctx);
  ctx.restore();

  drawHandwrittenDust(
    ctx,
    width,
    height,
    palette,
    frameTimeMs / 1000,
    settings.fluidSpeed,
    settings.ambientGlowIntensity,
    reducedMotion,
    false,
    quality
  );
}

function averageSpectrum(data: Uint8Array, start: number, end: number): number {
  if (!data || data.length < end) return 0;
  let sum = 0;
  for (let index = start; index < end; index += 1) sum += data[index] ?? 0;
  return clamp(sum / ((end - start) * 255), 0, 1);
}

function renderFrame(effectCtx: EffectContext): void {
  const { ctx, width, height, data, time, params } = effectCtx;
  if (width <= 0 || height <= 0) return;

  const state = getRuntimeState(ctx);
  const quality = resolveStaticQuality(width, height, ctx.canvas.width / Math.max(1, width));
  state.qualityTier = quality;
  const frameTimeMs = Number.isFinite(time)
    ? time
    : typeof performance !== "undefined"
      ? performance.now()
      : Date.now();
  const reducedMotion = getReducedMotion();
  const settings = resolveSettings(params);
  const palette = resolveHandwrittenPalette(settings.colorScheme);
  const fontFamily = resolveHandwrittenFont(settings.fontStyle);
  const progress = getPlaybackClockSnapshot();
  const playerState = getPlayerSnapshot();
  // S6-4: 身份字段 currentSong 读 playerStore
  const currentSong = playerState.currentSong;
  const songId = currentSong?.id ?? null;
  const lyricsText = currentSong?.lyrics ?? "";
  const translationLyricsText = currentSong?.translationLyrics ?? "";
  const mediaLoading = progress.isLoading || playerState.isLoading;
  const songDuration = resolveSongDuration(
    currentSong,
    progress.duration,
    playerState.duration,
    mediaLoading
  );
  const reportedCandidate =
    progress.currentTime ?? playerState.currentTime ?? effectCtx.musicTime ?? 0;
  const reportedMusicTime = Number.isFinite(reportedCandidate) ? Math.max(0, reportedCandidate) : 0;
  const isPlaying = progress.isPlaying ?? playerState.isPlaying ?? false;
  const playbackRate = playerState.playbackRate ?? 1;

  if (state.songId !== songId) {
    resetRuntimeForSong(state, songId, lyricsText, translationLyricsText, songDuration);
  } else {
    if (state.lyricsText !== lyricsText || state.songDuration !== songDuration) {
      state.lyricsText = lyricsText;
      rebuildProgram(state, lyricsText, songId, songDuration);
    }
    if (state.translationLyricsText !== translationLyricsText) {
      state.translationLyricsText = translationLyricsText;
      state.translationGroups = groupLyricsByStart(parseTimedLyrics(translationLyricsText));
      state.transitionSnapshot = null;
    }
    if (!state.program && currentSong) {
      rebuildProgram(state, lyricsText, songId, songDuration);
    }
  }

  const dtSeconds = state.initialized
    ? clamp((frameTimeMs - state.lastDrawFrameTime) / 1000, 0, 0.25)
    : 0;
  const clockTick = advanceLyricPlaybackClock(state, {
    reportedMusicTime,
    frameTimeMs,
    isPlaying,
    playbackRate,
    duration: songDuration || undefined,
  });
  Object.assign(state, clockTick.state);
  const musicTime = clockTick.musicTime;

  const smoothing = 1 - Math.exp(-Math.max(0, dtSeconds) * 6);
  const rawBass = !reducedMotion && isPlaying ? averageSpectrum(data, 0, 8) : 0;
  const rawMid = !reducedMotion && isPlaying ? averageSpectrum(data, 8, 32) : 0;
  const rawTreble = !reducedMotion && isPlaying ? averageSpectrum(data, 32, 64) : 0;
  state.smoothBass += (rawBass - state.smoothBass) * smoothing;
  state.smoothMid += (rawMid - state.smoothMid) * smoothing;
  state.smoothTreble += (rawTreble - state.smoothTreble) * smoothing;

  if (reducedMotion || isPlaying) {
    state.ambientPhase = 0;
  } else {
    state.ambientPhase += dtSeconds * settings.fluidSpeed * 0.18;
  }

  ctx.save();
  try {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowBlur = 0;

    const program = state.program;
    if (!program || program.shots.length === 0) {
      drawIdlePage(ctx, width, height, palette, settings, reducedMotion, frameTimeMs, quality);
      return;
    }

    const resolvedBlend = resolveShotBlend(program, musicTime);
    if (!resolvedBlend) {
      drawIdlePage(ctx, width, height, palette, settings, reducedMotion, frameTimeMs, quality);
      return;
    }
    const blend =
      reducedMotion && resolvedBlend.incoming
        ? {
            outgoing: resolveHandwrittenReducedMotionShot(
              resolvedBlend.outgoing,
              resolvedBlend.incoming,
              musicTime
            ),
            incoming: null,
            progress: 0,
          }
        : resolvedBlend;

    const shared: SharedFrameInput = {
      state,
      program,
      width,
      height,
      palette,
      fontFamily,
      settings,
      reducedMotion,
      quality,
      title: currentSong?.title ?? "",
      artist: currentSong?.artist ?? "",
      album: currentSong?.album ?? "",
      isPlaying,
      motionSpeed: settings.fluidSpeed,
      pixelRatio: clamp(ctx.canvas.width / Math.max(1, width), 1, 3),
      musicTime,
      timeMs: frameTimeMs,
      shot: blend.outgoing,
    };

    const outgoingFrame = buildContentFrame({ ...shared, shot: blend.outgoing }, 1);
    const cameraOut = resolveHandwrittenCameraFrame(
      outgoingFrame.scene,
      musicTime,
      blend.outgoing.startTime,
      blend.outgoing.endTime,
      reducedMotion,
      settings.fluidSpeed
    );
    const incomingFrame = blend.incoming
      ? buildContentFrame({ ...shared, shot: blend.incoming }, 1)
      : null;
    const cameraIn = incomingFrame
      ? resolveHandwrittenCameraFrame(
          incomingFrame.scene,
          musicTime,
          blend.incoming!.startTime,
          blend.incoming!.endTime,
          reducedMotion,
          settings.fluidSpeed
        )
      : cameraOut;
    const camera = blend.incoming
      ? blendHandwrittenCamera(cameraOut, cameraIn, blend.progress)
      : cameraOut;
    const contentCam = contentCamera(camera);

    const glow =
      settings.ambientGlowIntensity * (1 + state.smoothBass * 0.06 + state.smoothTreble * 0.04);

    drawHandwrittenPaperSurface({
      ctx,
      width,
      height,
      palette,
      paletteIndex: Math.round(settings.colorScheme),
      camera,
      scene: outgoingFrame.scene,
      musicTime,
      shotStartTime: blend.outgoing.startTime,
      glowIntensity: glow,
      grain: settings.filmGrain,
      vignette: settings.vignetteStrength,
      reducedMotion,
      motionSpeed: settings.fluidSpeed,
      paused: !isPlaying,
      quality,
    });

    if (incomingFrame) {
      const transition = blend.outgoing.transitionOut;
      const transitionStart = transition?.startTime ?? blend.outgoing.endTime;
      const transitionEnd = transition?.endTime ?? blend.outgoing.endTime;
      const outgoingRows =
        blend.outgoing.kind === "lyrics"
          ? resolveLyricFilmLyricRows(program, blend.outgoing, transitionStart).filter((row) =>
              blend.outgoing.lineGroupIndices.includes(row.groupIndex)
            )
          : [];
      const latestRevealEnd = outgoingRows.reduce(
        (latest, row) => Math.max(latest, row.revealEndTime),
        transitionStart
      );
      const snapshotTime = resolveHandwrittenSnapshotTime(
        transitionStart,
        transitionEnd,
        latestRevealEnd
      );
      const transitionFrame = resolveHandwrittenTransitionFrame(
        transitionStart,
        transitionEnd,
        musicTime,
        snapshotTime
      );
      const outAlpha = transitionFrame.outgoingAlpha;
      const inAlpha = transitionFrame.incomingAlpha;
      const kind = blend.outgoing.transitionOut?.kind ?? "focus-pull";
      const snapshotFrame = buildContentFrame(
        { ...shared, shot: blend.outgoing, musicTime: snapshotTime },
        1
      );
      snapshotFrame.restrictLyricsToShot = true;
      const snapshotCamera = resolveHandwrittenCameraFrame(
        snapshotFrame.scene,
        snapshotTime,
        blend.outgoing.startTime,
        blend.outgoing.endTime,
        reducedMotion,
        settings.fluidSpeed
      );
      const snapshotBaseKey = [
        blend.outgoing.id,
        blend.incoming!.id,
        width,
        height,
        snapshotTime,
        fontFamily,
        palette.name,
        settings.fontStyle,
        settings.colorScheme,
        settings.heroFontSize,
        settings.shimmerFeather,
        settings.fluidSpeed,
        settings.ambientGlowIntensity,
        reducedMotion ? 1 : 0,
        snapshotFrame.title,
        snapshotFrame.artist,
        snapshotFrame.album,
        quality,
      ].join("|");
      const snapshotKey = buildHandwrittenSnapshotRenderKey(
        snapshotBaseKey,
        snapshotFrame.pixelRatio,
        snapshotFrame.state.translationLyricsText
      );
      const snapshotContentCamera = contentCamera(snapshotCamera);
      const renderOutgoingLive =
        blend.outgoing.kind === "lyrics" &&
        shouldRenderHandwrittenOutgoingLive(musicTime, snapshotTime);
      const snapshot = renderOutgoingLive
        ? null
        : ensureTransitionSnapshot(
            state,
            snapshotFrame,
            ctx,
            snapshotContentCamera,
            snapshotKey,
            snapshotTime
          );

      if (snapshot) {
        ctx.save();
        ctx.globalAlpha = outAlpha;
        applyTransitionPageTransform(ctx, width, height, transitionFrame, true);
        ctx.drawImage(snapshot.canvas, 0, 0, width, height);
        ctx.restore();
      } else {
        const outgoingContentFrame = renderOutgoingLive ? outgoingFrame : snapshotFrame;
        outgoingContentFrame.alpha = outAlpha;
        outgoingContentFrame.restrictLyricsToShot = true;
        ctx.save();
        applyTransitionPageTransform(ctx, width, height, transitionFrame, true);
        drawShotContent(
          outgoingContentFrame,
          ctx,
          renderOutgoingLive ? contentCamera(cameraOut) : snapshotContentCamera
        );
        ctx.restore();
      }
      incomingFrame.alpha = inAlpha;
      ctx.save();
      applyTransitionPageTransform(ctx, width, height, transitionFrame, false);
      drawShotContent(incomingFrame, ctx, contentCam);
      ctx.restore();

      const leakStrength = kind === "flare-cut" ? 0.065 : kind === "lights-out" ? 0.04 : 0.025;
      if (kind === "lights-out") {
        ctx.save();
        ctx.fillStyle = withAlpha(palette.desk, 0.1 * Math.sin(Math.PI * blend.progress));
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      drawHandwrittenLightLeak(
        ctx,
        width,
        height,
        palette,
        blend.progress,
        leakStrength * clamp(glow, 0, 0.5)
      );
    } else {
      state.transitionSnapshot = null;
      drawShotContent(outgoingFrame, ctx, contentCam);
    }

    drawHandwrittenDust(
      ctx,
      width,
      height,
      palette,
      musicTime,
      settings.fluidSpeed,
      glow + state.smoothTreble * 0.15,
      reducedMotion,
      !isPlaying,
      quality
    );
  } finally {
    ctx.restore();
  }
}

/** 渲染可 seek 的手书歌词 MV；绘制耗时只用于极端情况下的紧急降级。 */
export function drawCinematicLyricDrift(effectCtx: EffectContext): void {
  const started = nowMs();
  try {
    renderFrame(effectCtx);
  } finally {
    if (effectCtx.width > 0 && effectCtx.height > 0) {
      maybeDegradeQuality(getRuntimeState(effectCtx.ctx), nowMs() - started);
    }
  }
}
