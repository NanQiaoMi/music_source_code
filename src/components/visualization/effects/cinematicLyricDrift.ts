import type { EffectContext } from "./types";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import {
  estimateLineUnits,
  findActiveGroupIndex,
  groupLyricsByStart,
  parseTimedLyrics,
  type LyricLineGroup,
  type TimedLyricUnit,
} from "./lyricTimeline";
import { layoutLyricUnits, type LyricLayoutItem } from "./lyricLayout";
import {
  advanceLyricPlaybackClock,
  createLyricPlaybackClock,
  type LyricPlaybackClockState,
} from "./lyricPlaybackClock";

interface ColorPalette {
  name: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  blobColors: string[];
  textUnsung: string;
  textPast: string;
  textFocus: string;
  shimmerAura: string;
}

interface LyricDisplayGroup {
  source: LyricLineGroup;
  text: string;
  revealEnd: number;
  units: TimedLyricUnit[];
}

interface DustSeed {
  phase: number;
  orbit: number;
  speed: number;
  size: number;
  opacity: number;
}

interface LyricEffectRuntimeState extends LyricPlaybackClockState {
  songId: string | null;
  lyricsText: string;
  songDuration: number;
  timelineGroups: LyricLineGroup[];
  lyricGroups: LyricDisplayGroup[];
  currentGroupIndex: number;
  transitionStartFrameTime: number;
  transitionDurationMs: number;
  transitionAlpha: number;
  layoutKey: string;
  visibleLayout: LyricLayoutItem[];
  smoothBass: number;
  smoothMid: number;
  smoothTreble: number;
  focusX: number;
  focusY: number;
  focusInitialized: boolean;
  dust: DustSeed[];
}

const COLOR_PALETTES: ColorPalette[] = [
  {
    name: "深海极光",
    bgGradStart: "#090d16",
    bgGradMid: "#04070c",
    bgGradEnd: "#010204",
    blobColors: [
      "rgba(35, 75, 160, 0.28)",
      "rgba(100, 45, 150, 0.22)",
      "rgba(20, 140, 180, 0.24)",
      "rgba(60, 20, 110, 0.20)",
    ],
    textUnsung: "rgba(255, 255, 255, 0.24)",
    textPast: "rgba(255, 255, 255, 0.65)",
    textFocus: "#ffffff",
    shimmerAura: "rgba(180, 220, 255, 0.15)",
  },
  {
    name: "丝绒暮霭",
    bgGradStart: "#140a0e",
    bgGradMid: "#0a0407",
    bgGradEnd: "#020102",
    blobColors: [
      "rgba(190, 80, 60, 0.26)",
      "rgba(160, 40, 95, 0.22)",
      "rgba(215, 130, 60, 0.24)",
      "rgba(110, 25, 65, 0.20)",
    ],
    textUnsung: "rgba(255, 240, 235, 0.24)",
    textPast: "rgba(255, 245, 240, 0.68)",
    textFocus: "#ffffff",
    shimmerAura: "rgba(255, 210, 175, 0.15)",
  },
  {
    name: "苍翠玉石",
    bgGradStart: "#06120d",
    bgGradMid: "#030a07",
    bgGradEnd: "#010302",
    blobColors: [
      "rgba(25, 120, 80, 0.26)",
      "rgba(15, 85, 110, 0.22)",
      "rgba(40, 160, 110, 0.22)",
      "rgba(10, 60, 45, 0.20)",
    ],
    textUnsung: "rgba(230, 255, 245, 0.24)",
    textPast: "rgba(240, 255, 250, 0.68)",
    textFocus: "#ffffff",
    shimmerAura: "rgba(180, 255, 220, 0.15)",
  },
  {
    name: "极简黑曜",
    bgGradStart: "#0e0e11",
    bgGradMid: "#060608",
    bgGradEnd: "#010101",
    blobColors: [
      "rgba(120, 120, 140, 0.18)",
      "rgba(70, 70, 90, 0.15)",
      "rgba(140, 140, 160, 0.16)",
      "rgba(50, 50, 70, 0.14)",
    ],
    textUnsung: "rgba(255, 255, 255, 0.22)",
    textPast: "rgba(255, 255, 255, 0.62)",
    textFocus: "#ffffff",
    shimmerAura: "rgba(255, 255, 255, 0.12)",
  },
  {
    name: "银河星云",
    bgGradStart: "#120818",
    bgGradMid: "#08030d",
    bgGradEnd: "#020103",
    blobColors: [
      "rgba(140, 45, 180, 0.26)",
      "rgba(70, 40, 160, 0.24)",
      "rgba(190, 70, 150, 0.22)",
      "rgba(45, 20, 100, 0.20)",
    ],
    textUnsung: "rgba(250, 235, 255, 0.24)",
    textPast: "rgba(252, 245, 255, 0.68)",
    textFocus: "#ffffff",
    shimmerAura: "rgba(235, 195, 255, 0.15)",
  },
];

const FONT_STYLES = [
  `-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`,
  `"New York", "Source Han Serif SC", "Songti SC", "STSong", "Georgia", serif`,
  `"LXGW WenKai", "STKaiti", "Kaiti SC", "楷体", "Baskerville", serif`,
  `"Montserrat", "Futura", "PingFang SC", "Noto Sans SC", sans-serif`,
];

const BLOB_SEEDS = [
  { x: 0.27, y: 0.34, radius: 0.43, speed: 0.042, phase: 0.2 },
  { x: 0.72, y: 0.38, radius: 0.47, speed: 0.036, phase: 1.8 },
  { x: 0.44, y: 0.7, radius: 0.41, speed: 0.048, phase: 3.4 },
  { x: 0.62, y: 0.22, radius: 0.37, speed: 0.032, phase: 5.1 },
];
const SONG_INFO_STARS = [
  { x: -40, y: 50, radius: 1.1, phase: 0.2 },
  { x: -19, y: 62, radius: 1.5, phase: 1.5 },
  { x: 3, y: 55, radius: 1.2, phase: 2.7 },
  { x: 26, y: 64, radius: 1.7, phase: 3.9 },
  { x: 44, y: 48, radius: 1.0, phase: 5.1 },
];

const GRAIN_TILE_SIZE = 256;
const GRAIN_TILE_FRAMES = 8;
const MAX_DUST_PARTICLES = 18;
const MAX_FRAME_DT_SECONDS = 0.1;
const LYRIC_ENTRY_MS = 320;
const FOCUS_REPOSITION_MS = 130;
const LINE_POSITION_MS = 1500;
const LYRIC_PREVIEW_SECONDS = 1.2;
const TRAIL_LIFETIME_SECONDS = 5.8;
const grainPatternCache = new WeakMap<CanvasRenderingContext2D, CanvasPattern[]>();
const runtimeCache = new WeakMap<CanvasRenderingContext2D, LyricEffectRuntimeState>();
let grainTiles: HTMLCanvasElement[] | null = null;
let reducedMotionQuery: MediaQueryList | null | undefined;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function frameRateIndependentFactor(perFrameFactor: number, dtSeconds: number): number {
  if (dtSeconds <= 0) return 0;
  return 1 - Math.pow(1 - perFrameFactor, dtSeconds * 60);
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

function seededUnit(seed: string, index: number): number {
  let hash = 2166136261;
  const value = `${seed}:${index}`;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function createDustSeeds(songId: string | null): DustSeed[] {
  const seed = songId ?? "no-song";
  return Array.from({ length: MAX_DUST_PARTICLES }, (_, index) => ({
    phase: seededUnit(`${seed}:warm-lyrics-dust`, index) * Math.PI * 2,
    orbit: 0.3 + seededUnit(`${seed}:warm-lyrics-orbit`, index) * 1.4,
    speed: 0.025 + seededUnit(`${seed}:warm-lyrics-speed`, index) * 0.075,
    size: 0.7 + seededUnit(`${seed}:warm-lyrics-size`, index) * 1.5,
    opacity: 0.12 + seededUnit(`${seed}:warm-lyrics-opacity`, index) * 0.3,
  }));
}

function createRuntimeState(): LyricEffectRuntimeState {
  return {
    ...createLyricPlaybackClock(),
    songId: null,
    lyricsText: "",
    songDuration: 0,
    timelineGroups: [],
    lyricGroups: [],
    currentGroupIndex: -2,
    transitionStartFrameTime: 0,
    transitionDurationMs: LYRIC_ENTRY_MS,
    transitionAlpha: 1,
    layoutKey: "",
    visibleLayout: [],
    smoothBass: 0,
    smoothMid: 0,
    smoothTreble: 0,
    focusX: 0,
    focusY: 0,
    focusInitialized: false,
    dust: createDustSeeds(null),
  };
}

function getRuntimeState(ctx: CanvasRenderingContext2D): LyricEffectRuntimeState {
  const existing = runtimeCache.get(ctx);
  if (existing) return existing;

  const created = createRuntimeState();
  runtimeCache.set(ctx, created);
  return created;
}

function buildLyricDisplayGroups(
  lyricsText: string,
  duration: number
): { timelineGroups: LyricLineGroup[]; lyricGroups: LyricDisplayGroup[] } {
  const parsedLines = parseTimedLyrics(lyricsText);
  const timelineGroups = groupLyricsByStart(parsedLines);

  const lyricGroups = timelineGroups.map((source, index) => {
    const text = source.lines.map((line) => line.text).join(" / ");
    const nextStart = timelineGroups[index + 1]?.start;
    const lyricEnd =
      nextStart !== undefined
        ? nextStart
        : duration > source.start
          ? duration
          : source.start + clamp(text.length * 0.24, 2, 5);
    const estimatedLineDuration = clamp(text.length * 0.24, 1.2, 5.8);
    const revealEnd = Math.min(lyricEnd, source.start + estimatedLineDuration);

    return {
      source,
      text,
      revealEnd,
      units: estimateLineUnits(text, source.start, revealEnd, index),
    };
  });

  return { timelineGroups, lyricGroups };
}

function resetRuntimeForSong(
  state: LyricEffectRuntimeState,
  songId: string | null,
  lyricsText: string,
  duration: number
): void {
  Object.assign(state, createLyricPlaybackClock());
  state.songId = songId;
  state.lyricsText = lyricsText;
  state.songDuration = duration;
  state.dust = createDustSeeds(songId);
  const groups = buildLyricDisplayGroups(lyricsText, duration);
  state.timelineGroups = groups.timelineGroups;
  state.lyricGroups = groups.lyricGroups;
  state.currentGroupIndex = -2;
  state.transitionStartFrameTime = 0;
  state.transitionDurationMs = LYRIC_ENTRY_MS;
  state.transitionAlpha = 1;
  state.layoutKey = "";
  state.visibleLayout = [];
  state.smoothBass = 0;
  state.smoothMid = 0;
  state.smoothTreble = 0;
  state.focusX = 0;
  state.focusY = 0;
  state.focusInitialized = false;
}

function buildGrainTile(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE_SIZE;
    canvas.height = GRAIN_TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = Math.floor(Math.random() * 255);
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = Math.floor(Math.random() * 14);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

function getGrainTiles(): HTMLCanvasElement[] | null {
  if (grainTiles) return grainTiles;
  const built: HTMLCanvasElement[] = [];
  for (let i = 0; i < GRAIN_TILE_FRAMES; i += 1) {
    const tile = buildGrainTile();
    if (!tile) return null;
    built.push(tile);
  }
  grainTiles = built;
  return grainTiles;
}

function getGrainPatterns(ctx: CanvasRenderingContext2D): CanvasPattern[] | null {
  const cached = grainPatternCache.get(ctx);
  if (cached) return cached;
  const tiles = getGrainTiles();
  if (!tiles) return null;

  const patterns: CanvasPattern[] = [];
  for (const tile of tiles) {
    const pattern = ctx.createPattern(tile, "repeat");
    if (!pattern) return null;
    patterns.push(pattern);
  }
  grainPatternCache.set(ctx, patterns);
  return patterns;
}

function colorWithScaledAlpha(color: string, scale: number): string {
  const match = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!match) return color;
  const alpha = clamp(Number(match[4] ?? 1) * scale, 0, 1);
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
}

function getPalette(params: EffectContext["params"]): ColorPalette {
  const index = clamp(Math.round(params?.colorScheme ?? 0), 0, COLOR_PALETTES.length - 1);
  return COLOR_PALETTES[index];
}

function getFontFamily(params: EffectContext["params"]): string {
  const index = clamp(Math.round(params?.fontStyle ?? 0), 0, FONT_STYLES.length - 1);
  return FONT_STYLES[index];
}

function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  fontSize: number
): number {
  if (!text) return 0;
  ctx.save();
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  const width = ctx.measureText(text).width;
  ctx.restore();
  return Number.isFinite(width) ? Math.max(0, width) : 0;
}

function ensureLayout(
  state: LyricEffectRuntimeState,
  ctx: CanvasRenderingContext2D,
  group: LyricDisplayGroup,
  width: number,
  height: number,
  dpr: number,
  fontFamily: string,
  requestedFontSize: number
): LyricLayoutItem[] {
  const maxWidth = Math.max(0, width * 0.84);
  const key = [
    state.songId ?? "no-song",
    group.source.start,
    group.revealEnd,
    group.text,
    width,
    height,
    dpr,
    fontFamily,
    requestedFontSize,
  ].join("|");

  if (state.layoutKey !== key) {
    const units = group.units.map(({ text, start, end, lineIndex }) => ({
      text,
      start,
      end,
      lineIndex,
    }));
    state.visibleLayout = layoutLyricUnits(units, {
      maxWidth,
      fontSize: requestedFontSize,
      fontFamily,
      seed: `${state.songId ?? "no-song"}:${group.source.start}:${group.text}:${width}:${fontFamily}`,
      measureText: (text, fontSize) => measureText(ctx, text, fontFamily, fontSize),
    });
    state.layoutKey = key;
  }

  return state.visibleLayout;
}

function getUnitProgress(unit: LyricLayoutItem, musicTime: number): number {
  if (musicTime < unit.start) return 0;
  const duration = unit.end - unit.start;
  if (duration <= 0.00001) return 1;
  return clamp((musicTime - unit.start) / duration, 0, 1);
}

function getFocusItem(
  layout: readonly LyricLayoutItem[],
  musicTime: number
): LyricLayoutItem | null {
  let nextItem: LyricLayoutItem | null = null;
  for (const item of layout) {
    if (musicTime >= item.start && musicTime < item.end) return item;
    if (!nextItem && item.start > musicTime) nextItem = item;
  }
  return nextItem ?? layout[layout.length - 1] ?? null;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSeconds: number,
  palette: ColorPalette,
  fluidSpeed: number,
  glowIntensity: number,
  bass: number,
  reducedMotion: boolean
): void {
  const background = ctx.createRadialGradient(
    width * 0.5,
    height * 0.43,
    12,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.9
  );
  background.addColorStop(0, palette.bgGradStart);
  background.addColorStop(0.58, palette.bgGradMid);
  background.addColorStop(1, palette.bgGradEnd);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < BLOB_SEEDS.length; index += 1) {
    const seed = BLOB_SEEDS[index];
    const phase = reducedMotion ? seed.phase : timeSeconds * seed.speed * fluidSpeed + seed.phase;
    const x = width * (seed.x + Math.sin(phase) * 0.045);
    const y = height * (seed.y + Math.cos(phase * 0.83) * 0.06);
    const pulse = reducedMotion ? 1 : 1 + Math.sin(phase * 0.7) * 0.035;
    const radius = Math.min(width, height) * seed.radius * pulse;
    const alphaScale = glowIntensity * (0.84 + bass * 0.32);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, colorWithScaledAlpha(palette.blobColors[index], alphaScale));
    gradient.addColorStop(0.5, colorWithScaledAlpha(palette.blobColors[index], alphaScale * 0.38));
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  preferredSize: number,
  maxWidth: number
): number {
  if (!text || maxWidth <= 0) return preferredSize;
  const measured = measureText(ctx, text, fontFamily, preferredSize);
  return measured > maxWidth ? Math.max(10, (preferredSize * maxWidth) / measured) : preferredSize;
}

function drawTraceLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  fontFamily: string,
  fontSize: number,
  color: string,
  alpha: number
): void {
  if (!text || alpha <= 0.005) return;
  const fittedSize = fitFontSize(ctx, text, fontFamily, fontSize, width * 0.8);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${fittedSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y, width * 0.86);
  ctx.restore();
}

function drawLyricTrails(
  ctx: CanvasRenderingContext2D,
  groups: readonly LyricDisplayGroup[],
  timelineIndex: number,
  musicTime: number,
  centerX: number,
  centerY: number,
  width: number,
  fontFamily: string,
  fontSize: number,
  palette: ColorPalette
): void {
  if (groups.length === 0) return;
  const anchorIndex = timelineIndex >= 0 ? timelineIndex : -1;
  const rowGap = fontSize * 3.05;
  const current = groups[anchorIndex];
  const currentAge = current ? musicTime - current.revealEnd : -1;
  const showCurrentTrace =
    current !== undefined && currentAge >= 0 && currentAge <= TRAIL_LIFETIME_SECONDS;

  if (showCurrentTrace && current) {
    const recency = 1 - currentAge / TRAIL_LIFETIME_SECONDS;
    drawTraceLine(
      ctx,
      current.text,
      centerX,
      centerY - rowGap,
      width,
      fontFamily,
      fontSize * 0.56,
      palette.textPast,
      0.2 * recency
    );
  }

  const previousTraceLimit = showCurrentTrace ? 1 : 2;
  for (let distance = 1; distance <= previousTraceLimit; distance += 1) {
    const previous = groups[anchorIndex - distance];
    if (previous) {
      const age = musicTime - previous.revealEnd;
      if (age >= 0 && age <= TRAIL_LIFETIME_SECONDS) {
        const recency = 1 - age / TRAIL_LIFETIME_SECONDS;
        const visibleDistance = showCurrentTrace ? 2 : distance;
        drawTraceLine(
          ctx,
          previous.text,
          centerX,
          centerY - rowGap * visibleDistance,
          width,
          fontFamily,
          fontSize * (visibleDistance === 1 ? 0.56 : 0.46),
          palette.textPast,
          (visibleDistance === 1 ? 0.2 : 0.11) * recency
        );
      }
    }

    const next = groups[anchorIndex + distance];
    if (next) {
      const lead = next.source.start - musicTime;
      if (lead > 0 && lead <= 4.2) {
        const previewStrength = lead <= LYRIC_PREVIEW_SECONDS ? 0.17 : 0.07;
        drawTraceLine(
          ctx,
          next.text,
          centerX,
          centerY + rowGap * distance,
          width,
          fontFamily,
          fontSize * (distance === 1 ? 0.56 : 0.46),
          palette.textUnsung,
          previewStrength * (1 - clamp((lead - LYRIC_PREVIEW_SECONDS) / 3, 0, 1) * 0.5)
        );
      }
    }
  }
}

function drawFocusBeams(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  timeSeconds: number,
  palette: ColorPalette,
  glowIntensity: number,
  treble: number,
  reducedMotion: boolean
): void {
  const sway = reducedMotion ? 0 : Math.sin(timeSeconds * 0.34) * 9;
  const reach = width * 0.22;
  const startX = x - reach + sway;
  const endX = x + reach + sway;
  const gradient = ctx.createLinearGradient(startX, y, endX, y);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.5, colorWithScaledAlpha(palette.shimmerAura, glowIntensity * 0.55));
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.52 + treble * 0.18;
  ctx.strokeStyle = gradient;
  ctx.lineWidth = Math.max(2, Math.min(14, width * 0.009));
  ctx.shadowColor = palette.shimmerAura;
  ctx.shadowBlur = 16 * glowIntensity;
  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(endX, y);
  ctx.stroke();

  ctx.globalAlpha *= 0.4;
  ctx.lineWidth *= 0.55;
  ctx.beginPath();
  ctx.moveTo(x - reach * 0.65, y + 5);
  ctx.lineTo(x + reach * 0.65, y + 5);
  ctx.stroke();
  ctx.restore();
}

function drawTimedLyrics(
  ctx: CanvasRenderingContext2D,
  layout: readonly LyricLayoutItem[],
  centerX: number,
  centerY: number,
  musicTime: number,
  frameTimeMs: number,
  transitionStartFrameTime: number,
  transitionDurationMs: number,
  transitionAlpha: number,
  fontFamily: string,
  palette: ColorPalette,
  feather: number,
  glowIntensity: number,
  reducedMotion: boolean
): void {
  const entry = reducedMotion
    ? 1
    : smoothstep(
        (frameTimeMs - transitionStartFrameTime) /
          Math.max(1, Math.min(LYRIC_ENTRY_MS, transitionDurationMs))
      );
  const entryOffset = reducedMotion ? 0 : (1 - transitionAlpha) * 8;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const item of layout) {
    const x = centerX + item.x;
    const y = centerY + item.y + entryOffset;
    const fontSize = item.fontSize;
    const progress = getUnitProgress(item, musicTime);
    const active = progress > 0 && progress < 1;
    const complete = musicTime >= item.end;
    const lateBy = complete ? Math.max(0, musicTime - item.end) : 0;
    const echo = complete ? 0.36 * Math.exp(-lateBy / 0.48) : 0;

    ctx.save();
    ctx.globalAlpha = entry;
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = palette.textUnsung;
    ctx.fillText(item.text, x, y);

    if (echo > 0.008) {
      ctx.globalAlpha = entry * echo;
      ctx.fillStyle = palette.textPast;
      ctx.fillText(item.text, x, y);
    }

    if (active) {
      const reveal = smoothstep(progress);
      ctx.globalAlpha = entry * (0.35 + reveal * 0.65);
      ctx.fillStyle = palette.textFocus;
      ctx.shadowColor = palette.shimmerAura;
      ctx.shadowBlur = reducedMotion ? 0 : clamp(feather * 0.16, 1, 18) * glowIntensity;
      ctx.fillText(item.text, x, y);
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawDust(
  ctx: CanvasRenderingContext2D,
  dust: readonly DustSeed[],
  focusX: number,
  focusY: number,
  hasLyricFocus: boolean,
  timeSeconds: number,
  palette: ColorPalette,
  reducedMotion: boolean
): void {
  if (reducedMotion) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const particleCount = hasLyricFocus ? dust.length : Math.min(6, dust.length);
  for (let index = 0; index < particleCount; index += 1) {
    const particle = dust[index];
    if (!particle) continue;
    const phase = particle.phase + timeSeconds * particle.speed;
    const x = focusX + Math.cos(phase) * (16 + particle.orbit * 22);
    const y = focusY + Math.sin(phase * 0.73) * (7 + particle.orbit * 13);
    const pulse = Math.max(0, Math.sin(phase * 1.4));
    if (pulse <= 0.02) continue;

    ctx.globalAlpha = particle.opacity * pulse;
    ctx.fillStyle = palette.shimmerAura;
    ctx.shadowColor = palette.shimmerAura;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x, y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSongInfo(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  artist: string,
  fontFamily: string,
  palette: ColorPalette,
  timeSeconds: number,
  reducedMotion: boolean
): void {
  const displayTitle = title.trim();
  const displayArtist = artist.trim();
  if (!displayTitle && !displayArtist) return;

  const centerX = width * 0.5;
  const centerY = height * 0.51;
  const titleSize = Math.min(34, Math.max(21, Math.min(width * 0.075, height * 0.08)));
  const breath = reducedMotion ? 0.5 : 0.5 + Math.sin(timeSeconds * 0.42) * 0.12;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (displayTitle) {
    const fittedTitleSize = fitFontSize(ctx, displayTitle, fontFamily, titleSize, width * 0.76);
    ctx.font = `600 ${fittedTitleSize}px ${fontFamily}`;
    ctx.fillStyle = palette.textPast;
    ctx.globalAlpha = 0.68;
    ctx.fillText(
      displayTitle,
      centerX,
      centerY - (displayArtist ? fittedTitleSize * 0.46 : 0),
      width * 0.82
    );
  }
  if (displayArtist) {
    const artistSize = Math.min(17, Math.max(12, titleSize * 0.48));
    ctx.font = `400 ${artistSize}px ${fontFamily}`;
    ctx.fillStyle = palette.textUnsung;
    ctx.globalAlpha = 0.52;
    ctx.fillText(
      displayArtist,
      centerX,
      centerY + (displayTitle ? titleSize * 0.82 : 0),
      width * 0.8
    );
  }

  ctx.fillStyle = palette.shimmerAura;
  ctx.shadowColor = palette.shimmerAura;
  ctx.shadowBlur = reducedMotion ? 0 : 12;
  const starScale = titleSize / 26;
  for (const star of SONG_INFO_STARS) {
    const pulse = reducedMotion
      ? 0.25
      : 0.1 + (Math.sin(timeSeconds * 0.7 + star.phase) + 1) * 0.11;
    ctx.globalAlpha = breath * pulse;
    ctx.beginPath();
    ctx.arc(
      centerX + star.x * starScale,
      centerY + star.y * starScale,
      star.radius,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawFilmGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeMs: number,
  intensity: number,
  reducedMotion: boolean
): void {
  if (intensity <= 0.02) return;
  const patterns = getGrainPatterns(ctx);
  if (!patterns?.length) return;

  const frame = reducedMotion ? 0 : Math.floor(timeMs / 140) % patterns.length;
  const offsetX = reducedMotion ? 0 : Math.sin(timeMs * 0.0017) * 7;
  const offsetY = reducedMotion ? 0 : Math.cos(timeMs * 0.0013) * 7;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = clamp(intensity, 0, 0.7);
  ctx.translate(offsetX, offsetY);
  ctx.fillStyle = patterns[frame];
  ctx.fillRect(-8, -8, width + 16, height + 16);
  ctx.restore();
}

function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number
): void {
  if (strength <= 0.05) return;
  const radius = Math.max(width, height) * 0.78;
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    radius * 0.4,
    width * 0.5,
    height * 0.5,
    radius
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${clamp(strength * 0.85, 0, 0.9)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function resolveActiveDisplayIndex(
  groups: readonly LyricDisplayGroup[],
  timelineIndex: number,
  musicTime: number
): number {
  if (timelineIndex < 0) return -1;
  const group = groups[timelineIndex];
  return group && musicTime < group.revealEnd ? timelineIndex : -1;
}

export function drawCinematicLyricDrift(effectCtx: EffectContext): void {
  const { ctx, width, height, data, time, params } = effectCtx;
  const frameTimeMs = Number.isFinite(time)
    ? time
    : typeof performance !== "undefined"
      ? performance.now()
      : Date.now();
  const state = getRuntimeState(ctx);
  const reducedMotion = getReducedMotion();

  const audioState = useAudioStore.getState();
  const playerState = usePlayerStore.getState();
  const currentSong = audioState.currentSong ?? playerState.currentSong;
  const songId = currentSong?.id ?? null;
  const lyricsText = currentSong?.lyrics ?? "";
  const mediaLoading = audioState.isLoading || playerState.isLoading;
  const songDuration = !currentSong
    ? 0
    : mediaLoading
      ? isPositiveDuration(currentSong.duration)
        ? currentSong.duration
        : 0
      : isPositiveDuration(audioState.duration)
        ? audioState.duration
        : isPositiveDuration(playerState.duration)
          ? playerState.duration
          : isPositiveDuration(currentSong.duration)
            ? currentSong.duration
            : 0;
  const reportedTimeCandidate =
    audioState.currentTime ?? playerState.currentTime ?? effectCtx.musicTime ?? 0;
  const reportedMusicTime = Number.isFinite(reportedTimeCandidate)
    ? Math.max(0, reportedTimeCandidate)
    : 0;
  const isPlaying = audioState.isPlaying ?? playerState.isPlaying;
  const playbackRate = audioState.playbackRate ?? playerState.playbackRate;

  const songChanged = state.songId !== songId || state.lyricsText !== lyricsText;
  if (songChanged) {
    resetRuntimeForSong(state, songId, lyricsText, songDuration);
  } else if (state.songDuration !== songDuration) {
    state.songDuration = songDuration;
    const groups = buildLyricDisplayGroups(lyricsText, songDuration);
    state.timelineGroups = groups.timelineGroups;
    state.lyricGroups = groups.lyricGroups;
    state.layoutKey = "";
    state.visibleLayout = [];
  }

  const dtSeconds = state.initialized
    ? clamp((frameTimeMs - state.lastDrawFrameTime) / 1000, 0, MAX_FRAME_DT_SECONDS)
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

  if (clockTick.visualReset) {
    state.layoutKey = "";
    state.transitionStartFrameTime = frameTimeMs;
    state.transitionDurationMs = reducedMotion ? 0 : 130;
  }

  const timelineIndex = findActiveGroupIndex(state.timelineGroups, musicTime);
  if (timelineIndex !== state.currentGroupIndex) {
    state.currentGroupIndex = timelineIndex;
    state.transitionStartFrameTime = frameTimeMs;
    if (!clockTick.visualReset) {
      const group = state.lyricGroups[timelineIndex];
      const nextGroup = state.lyricGroups[timelineIndex + 1];
      const availableSeconds = group
        ? (nextGroup?.source.start ?? group.revealEnd) - group.source.start
        : 0;
      state.transitionDurationMs = reducedMotion
        ? 0
        : clamp(availableSeconds * 800, 0, LINE_POSITION_MS);
    }
    state.layoutKey = "";
  }
  state.transitionAlpha =
    reducedMotion || state.transitionDurationMs <= 0
      ? 1
      : smoothstep((frameTimeMs - state.transitionStartFrameTime) / state.transitionDurationMs);

  const bassFactor = frameRateIndependentFactor(0.045, dtSeconds);
  const rawBass = !reducedMotion && isPlaying ? averageSpectrum(data, 0, 8) : 0;
  const rawMid = !reducedMotion && isPlaying ? averageSpectrum(data, 8, 32) : 0;
  const rawTreble = !reducedMotion && isPlaying ? averageSpectrum(data, 32, 64) : 0;
  state.smoothBass += (rawBass - state.smoothBass) * bassFactor;
  state.smoothMid += (rawMid - state.smoothMid) * bassFactor;
  state.smoothTreble += (rawTreble - state.smoothTreble) * bassFactor;

  const palette = getPalette(params);
  const fontFamily = getFontFamily(params);
  const preferredFontSize = Math.round(params?.heroFontSize ?? 54);
  const lyricFontSize = Math.min(
    preferredFontSize,
    Math.max(18, Math.min(width * 0.07, height * 0.13))
  );
  const shimmerFeather = params?.shimmerFeather ?? 50;
  const fluidSpeed = clamp(params?.fluidSpeed ?? 0.8, 0, 2);
  const glowIntensity = clamp(params?.ambientGlowIntensity ?? 0.9, 0, 1.5);
  const filmGrain = clamp(params?.filmGrain ?? 0.15, 0, 0.7);
  const vignetteStrength = clamp(params?.vignetteStrength ?? 0.65, 0, 1);
  const timeSeconds = frameTimeMs / 1000;
  const dpr = ctx.canvas.width / Math.max(1, width);
  const activeDisplayIndex = resolveActiveDisplayIndex(state.lyricGroups, timelineIndex, musicTime);
  const activeGroup = activeDisplayIndex >= 0 ? state.lyricGroups[activeDisplayIndex] : null;
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  let activeLayout: LyricLayoutItem[] = [];
  let targetFocusX = centerX;
  let targetFocusY = centerY;

  if (activeGroup) {
    activeLayout = ensureLayout(
      state,
      ctx,
      activeGroup,
      width,
      height,
      Number.isFinite(dpr) ? dpr : 1,
      fontFamily,
      lyricFontSize
    );
    const focusItem = getFocusItem(activeLayout, musicTime);
    if (focusItem) {
      const layoutOriginX = (width - width * 0.84) * 0.5;
      targetFocusX = layoutOriginX + focusItem.x + focusItem.width * 0.5;
      targetFocusY = centerY + focusItem.y;
    }
  } else {
    state.layoutKey = "";
    state.visibleLayout = [];
  }

  if (!state.focusInitialized || clockTick.discontinuity || reducedMotion) {
    state.focusX = targetFocusX;
    state.focusY = targetFocusY;
    state.focusInitialized = true;
  } else {
    const focusFactor = 1 - Math.exp(-dtSeconds / (FOCUS_REPOSITION_MS / 3000));
    state.focusX += (targetFocusX - state.focusX) * focusFactor;
    state.focusY += (targetFocusY - state.focusY) * focusFactor;
  }
  const focusX = state.focusX;
  const focusY = state.focusY;

  ctx.save();
  try {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowBlur = 0;
    drawBackground(
      ctx,
      width,
      height,
      timeSeconds,
      palette,
      fluidSpeed,
      glowIntensity,
      state.smoothBass,
      reducedMotion
    );

    drawLyricTrails(
      ctx,
      state.lyricGroups,
      timelineIndex,
      musicTime,
      centerX,
      centerY,
      width,
      fontFamily,
      lyricFontSize,
      palette
    );

    drawFocusBeams(
      ctx,
      focusX,
      focusY,
      width,
      timeSeconds,
      palette,
      glowIntensity,
      state.smoothTreble,
      reducedMotion
    );

    if (activeGroup) {
      const layoutOriginX = (width - width * 0.84) * 0.5;
      drawTimedLyrics(
        ctx,
        activeLayout,
        layoutOriginX,
        centerY,
        musicTime,
        frameTimeMs,
        state.transitionStartFrameTime,
        state.transitionDurationMs,
        state.transitionAlpha,
        fontFamily,
        palette,
        shimmerFeather,
        glowIntensity,
        reducedMotion
      );
    } else {
      const nextGroup = state.lyricGroups[timelineIndex + 1] ?? state.lyricGroups[0];
      const hasNearPreview = Boolean(
        nextGroup &&
        nextGroup.source.start > musicTime &&
        nextGroup.source.start - musicTime <= LYRIC_PREVIEW_SECONDS
      );
      const showSongInfo = state.lyricGroups.length === 0 || (timelineIndex < 0 && !hasNearPreview);
      if (showSongInfo) {
        drawSongInfo(
          ctx,
          width,
          height,
          currentSong?.title ?? "",
          currentSong?.artist ?? "",
          fontFamily,
          palette,
          timeSeconds,
          reducedMotion
        );
      }
    }

    drawDust(
      ctx,
      state.dust,
      focusX,
      focusY,
      activeGroup !== null,
      timeSeconds,
      palette,
      reducedMotion
    );
    drawFilmGrain(ctx, width, height, frameTimeMs, filmGrain, reducedMotion);
    drawVignette(ctx, width, height, vignetteStrength);
  } finally {
    ctx.restore();
  }
}

function averageSpectrum(data: Uint8Array, start: number, end: number): number {
  if (!data || data.length < end) return 0;
  let sum = 0;
  for (let index = start; index < end; index += 1) {
    sum += data[index] ?? 0;
  }
  return clamp(sum / ((end - start) * 255), 0, 1);
}
