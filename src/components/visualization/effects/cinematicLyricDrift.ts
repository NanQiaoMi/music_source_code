import type { EffectContext } from "./types";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import {
  estimateLineUnits,
  groupLyricsByStart,
  parseTimedLyrics,
  type LyricLineGroup,
} from "./lyricTimeline";
import { layoutLyricUnits, type LyricLayoutItem } from "./lyricLayout";
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
import { resolveLyricFilmLyricRows, resolveLyricFilmTranslation } from "./lyricFilmLyrics";
import {
  expandLyricFilmVerticalUnits,
  resolveLyricFilmComposition,
  resolveLyricFilmCreditsFrame,
  resolveLyricFilmGlyphFrame,
  resolveLyricFilmVerticalSlot,
  segmentLyricFilmGraphemes,
} from "./lyricFilmComposition";
import {
  drawLyricFilmStage,
  resolveLyricFilmStageFrame,
  sampleLyricFilmIllumination,
  type LyricFilmStageFrame,
  type LyricFilmStagePalette,
} from "./lyricFilmStage";

interface ColorPalette {
  name: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  blobColors: string[];
  textUnsung: string;
  textPast: string;
  textFocus: string;
  textWarm: string;
  shimmerAura: string;
}

interface LyricFilmRuntimeState extends LyricPlaybackClockState {
  songId: string | null;
  lyricsText: string;
  translationLyricsText: string;
  translationGroups: LyricLineGroup[];
  songDuration: number;
  programDuration: number;
  program: LyricFilmProgram | null;
  layoutCache: Map<string, LyricLayoutItem[]>;
  smoothBass: number;
  smoothMid: number;
  smoothTreble: number;
  ambientPhase: number;
}

interface ShotBlend {
  outgoing: LyricFilmShot;
  incoming: LyricFilmShot | null;
  progress: number;
}

const COLOR_PALETTES: ColorPalette[] = [
  {
    name: "深海极光",
    bgGradStart: "#090d16",
    bgGradMid: "#04070c",
    bgGradEnd: "#010204",
    blobColors: ["rgba(35, 75, 160, 0.28)", "rgba(100, 45, 150, 0.22)", "rgba(20, 140, 180, 0.24)"],
    textUnsung: "rgba(255, 255, 255, 0.30)",
    textPast: "rgba(255, 255, 255, 0.67)",
    textFocus: "#ffffff",
    textWarm: "#ffd47e",
    shimmerAura: "rgba(180, 220, 255, 0.48)",
  },
  {
    name: "丝绒暮霭",
    bgGradStart: "#140a0e",
    bgGradMid: "#0a0407",
    bgGradEnd: "#020102",
    blobColors: ["rgba(190, 80, 60, 0.26)", "rgba(160, 40, 95, 0.22)", "rgba(215, 130, 60, 0.24)"],
    textUnsung: "rgba(255, 240, 235, 0.30)",
    textPast: "rgba(255, 245, 240, 0.69)",
    textFocus: "#fffaf5",
    textWarm: "#ffd1a0",
    shimmerAura: "rgba(255, 210, 175, 0.52)",
  },
  {
    name: "苍翠玉石",
    bgGradStart: "#06120d",
    bgGradMid: "#030a07",
    bgGradEnd: "#010302",
    blobColors: ["rgba(25, 120, 80, 0.26)", "rgba(15, 85, 110, 0.22)", "rgba(40, 160, 110, 0.22)"],
    textUnsung: "rgba(230, 255, 245, 0.30)",
    textPast: "rgba(240, 255, 250, 0.70)",
    textFocus: "#f5fff9",
    textWarm: "#ffe1a3",
    shimmerAura: "rgba(180, 255, 220, 0.48)",
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
    ],
    textUnsung: "rgba(255, 255, 255, 0.28)",
    textPast: "rgba(255, 255, 255, 0.65)",
    textFocus: "#ffffff",
    textWarm: "#f6dfad",
    shimmerAura: "rgba(255, 255, 255, 0.42)",
  },
  {
    name: "银河星云",
    bgGradStart: "#120818",
    bgGradMid: "#08030d",
    bgGradEnd: "#020103",
    blobColors: ["rgba(140, 45, 180, 0.26)", "rgba(70, 40, 160, 0.24)", "rgba(190, 70, 150, 0.22)"],
    textUnsung: "rgba(250, 235, 255, 0.30)",
    textPast: "rgba(252, 245, 255, 0.70)",
    textFocus: "#fffaff",
    textWarm: "#ffd2a7",
    shimmerAura: "rgba(235, 195, 255, 0.5)",
  },
];

const FONT_STYLES = [
  `-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`,
  `"New York", "Source Han Serif SC", "Songti SC", "STSong", "Georgia", serif`,
  `"LXGW WenKai", "STKaiti", "Kaiti SC", "楷体", "Baskerville", serif`,
  `"Montserrat", "Futura", "PingFang SC", "Noto Sans SC", sans-serif`,
];

const GRAIN_TILE_SIZE = 256;
const GRAIN_TILE_FRAMES = 8;
const LYRIC_ENTRY_SECONDS = 0.42;
const TRAILING_LINE_FADE_SECONDS = 1.6;
const grainPatternCache = new WeakMap<CanvasRenderingContext2D, CanvasPattern[]>();
const runtimeCache = new WeakMap<CanvasRenderingContext2D, LyricFilmRuntimeState>();
let grainTiles: HTMLCanvasElement[] | null = null;
let reducedMotionQuery: MediaQueryList | null | undefined;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
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

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function createRuntimeState(): LyricFilmRuntimeState {
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
    smoothBass: 0,
    smoothMid: 0,
    smoothTreble: 0,
    ambientPhase: 0,
  };
}

function getRuntimeState(ctx: CanvasRenderingContext2D): LyricFilmRuntimeState {
  const existing = runtimeCache.get(ctx);
  if (existing) return existing;

  const created = createRuntimeState();
  runtimeCache.set(ctx, created);
  return created;
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
  state: LyricFilmRuntimeState,
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
}

function resetRuntimeForSong(
  state: LyricFilmRuntimeState,
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
  state.smoothBass = 0;
  state.smoothMid = 0;
  state.smoothTreble = 0;
  if (songId !== null || lyricsText.length > 0)
    rebuildProgram(state, lyricsText, songId, songDuration);
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
  ctx.save();
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  const width = ctx.measureText(text).width;
  ctx.restore();
  return Number.isFinite(width) ? Math.max(0, width) : 0;
}

function getLineLayout(
  state: LyricFilmRuntimeState,
  ctx: CanvasRenderingContext2D,
  row: ReturnType<typeof resolveLyricFilmLyricRows>[number],
  shot: LyricFilmShot,
  fontFamily: string,
  fontSize: number,
  width: number,
  dpr: number,
  requestedMaxWidth: number
): LyricLayoutItem[] {
  const maxWidth = Math.max(1, Math.min(requestedMaxWidth, width - Math.min(24, width * 0.12)));
  const cacheKey = [shot.id, row.id, width, maxWidth, dpr, fontFamily, fontSize].join("|");
  const cached = state.layoutCache.get(cacheKey);
  if (cached) return cached;

  const timedUnits = estimateLineUnits(row.text, row.startTime, row.revealEndTime, row.lineIndex);
  const layout = layoutLyricUnits(timedUnits, {
    maxWidth,
    fontSize,
    fontFamily,
    seed: `${shot.seed}:${row.id}:${width}:${fontFamily}`,
    measureText: (text, size) => measureText(ctx, text, fontFamily, size),
  });
  if (state.layoutCache.size > 240) state.layoutCache.clear();
  state.layoutCache.set(cacheKey, layout);
  return layout;
}

function drawGlyphSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
  color: string
): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.8, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.stroke();
  ctx.restore();
}

function drawLyricRows(
  ctx: CanvasRenderingContext2D,
  state: LyricFilmRuntimeState,
  program: LyricFilmProgram,
  shot: LyricFilmShot,
  musicTime: number,
  width: number,
  height: number,
  dpr: number,
  fontFamily: string,
  baseFontSize: number,
  feather: number,
  glowIntensity: number,
  reducedMotion: boolean,
  stageFrame: LyricFilmStageFrame,
  palette: ColorPalette,
  translationGroups: readonly LyricLineGroup[],
  opacity: number
): void {
  if (shot.kind !== "lyrics" || opacity <= 0) return;
  const rows = resolveLyricFilmLyricRows(program, shot, musicTime);
  if (rows.length === 0) return;

  const groups = [...new Set(shot.lineGroupIndices)].sort((left, right) => left - right);
  const focusGroupIndex =
    [...groups]
      .reverse()
      .find((index) => (program.lineGroups[index]?.start ?? Infinity) <= musicTime) ?? groups[0];
  if (focusGroupIndex === undefined) return;

  const activeText = rows.find((row) => row.role === "active")?.text ?? rows[0]?.text ?? "";
  const composition = resolveLyricFilmComposition(
    shot.seed,
    shot.profile,
    width,
    height,
    activeText
  );
  const entry = reducedMotion ? 1 : smoothstep((musicTime - shot.startTime) / LYRIC_ENTRY_SECONDS);
  const visibility = clamp(opacity * entry, 0, 1);
  const entryDistance = reducedMotion ? 0 : (1 - entry) * height * 0.045;
  const entryX =
    composition.entryDirection === "left"
      ? -entryDistance
      : composition.entryDirection === "right"
        ? entryDistance
        : 0;
  const entryY =
    composition.entryDirection === "top"
      ? -entryDistance
      : composition.entryDirection === "bottom"
        ? entryDistance
        : 0;
  const groupRowsByIndex = new Map<number, typeof rows>();
  for (const row of rows) {
    const groupRows = groupRowsByIndex.get(row.groupIndex) ?? [];
    groupRows.push(row);
    groupRowsByIndex.set(row.groupIndex, groupRows);
  }
  const rowGap = Math.min(baseFontSize * 1.36, height * 0.092);
  const originX = composition.centerX + entryX - composition.maxWidth / 2;

  ctx.save();
  ctx.translate(width * (0.5 + stageFrame.camera.x), height * (0.5 + stageFrame.camera.y));
  ctx.rotate(stageFrame.camera.rotation);
  ctx.scale(stageFrame.camera.zoom, stageFrame.camera.zoom);
  ctx.translate(-width * 0.5, -height * 0.5);
  ctx.globalAlpha = visibility;
  ctx.textBaseline = "middle";
  ctx.filter = "none";

  for (const row of rows) {
    const groupRows = groupRowsByIndex.get(row.groupIndex) ?? [];
    const rowPosition = groupRows.findIndex((candidate) => candidate.id === row.id);
    const isFocusGroup = row.groupIndex === focusGroupIndex;
    const groupOffset = (rowPosition - (groupRows.length - 1) / 2) * rowGap;
    const relation = row.groupIndex - focusGroupIndex;
    const roleOffset = isFocusGroup ? 0 : relation < 0 ? -height * 0.19 : height * 0.19;
    const fontScale = isFocusGroup ? (rowPosition === 0 ? 1.22 : 0.8) : 0.62;
    const requestedFontSize = Math.max(12, baseFontSize * fontScale);
    const layout = getLineLayout(
      state,
      ctx,
      row,
      shot,
      fontFamily,
      requestedFontSize,
      width,
      dpr,
      composition.maxWidth
    );
    const age = Math.max(0, musicTime - row.revealEndTime);
    const pastFade =
      row.role === "past" ? 1 - 0.58 * clamp(age / TRAILING_LINE_FADE_SECONDS, 0, 1) : 1;
    const roleAlpha =
      row.role === "active" ? (isFocusGroup ? 0.98 : 0.78) : row.role === "future" ? 0.48 : 0.62;
    const rowAlpha = clamp(roleAlpha * pastFade, 0, 1);
    const rowCenterY = composition.centerY + entryY + roleOffset + groupOffset;
    const baseColor = row.role === "past" ? palette.textPast : palette.textUnsung;
    const rowGraphemes = segmentLyricFilmGraphemes(row.text);
    const cjkCount = rowGraphemes.filter((grapheme) =>
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(grapheme)
    ).length;
    const useVertical =
      composition.orientation === "vertical" &&
      rowGraphemes.length > 0 &&
      cjkCount / rowGraphemes.length >= 0.72;
    const renderItems = useVertical ? expandLyricFilmVerticalUnits(layout) : layout;

    ctx.save();
    ctx.globalAlpha = visibility * rowAlpha;
    ctx.textAlign = useVertical ? "center" : "left";

    for (let itemIndex = 0; itemIndex < renderItems.length; itemIndex += 1) {
      const item = renderItems[itemIndex]!;
      const position = useVertical
        ? resolveLyricFilmVerticalSlot({
            itemIndex,
            itemCount: renderItems.length,
            centerX: composition.centerX + entryX,
            centerY: rowCenterY,
            width,
            height,
            maxWidth: composition.maxWidth,
            fontSize: item.fontSize,
            groupRowIndex: rowPosition,
            groupRowCount: groupRows.length,
          })
        : { x: originX + item.x, y: rowCenterY + item.y, fontSize: item.fontSize };
      const illumination = clamp(
        sampleLyricFilmIllumination(
          stageFrame,
          position.x / Math.max(1, width),
          position.y / Math.max(1, height)
        ),
        0,
        1
      );
      const glyphFrame = resolveLyricFilmGlyphFrame({
        seed: `${shot.seed}:${row.id}:${itemIndex}:${item.text}`,
        startTime: item.start,
        endTime: item.end,
        musicTime,
        x: position.x,
        y: position.y,
        fontSize: position.fontSize,
      });
      const isSung = row.role === "active" && musicTime >= item.end;
      const isCurrent = row.role === "active" && musicTime >= item.start && musicTime < item.end;
      ctx.font = `500 ${position.fontSize}px ${fontFamily}`;
      ctx.shadowBlur = 0;
      ctx.fillStyle = isSung ? palette.textFocus : baseColor;
      ctx.globalAlpha = visibility * rowAlpha * (isSung ? 0.82 : 0.46 + illumination * 0.36);
      ctx.fillText(item.text, position.x, position.y);

      if (row.role === "active" && glyphFrame.progress > 0) {
        ctx.fillStyle = isCurrent ? palette.textWarm : palette.textFocus;
        ctx.globalAlpha = visibility * rowAlpha * (isCurrent ? 0.82 + illumination * 0.18 : 0.78);
        ctx.shadowColor = isCurrent ? palette.textWarm : palette.shimmerAura;
        ctx.shadowBlur =
          isCurrent && !reducedMotion
            ? clamp(feather * 0.13, 2, 14) * glowIntensity * (0.58 + illumination * 0.42)
            : 0;
        ctx.fillText(
          item.text,
          reducedMotion ? position.x : glyphFrame.x,
          reducedMotion ? position.y : glyphFrame.y
        );
        ctx.shadowBlur = 0;

        if (isCurrent) {
          const sparkleX = useVertical
            ? position.x + position.fontSize * 0.38
            : position.x + item.width;
          const sparkleY = position.y - position.fontSize * 0.3;
          drawGlyphSparkle(
            ctx,
            sparkleX,
            sparkleY,
            Math.max(2, position.fontSize * 0.11),
            reducedMotion ? 0 : glyphFrame.sparkleAlpha * (0.45 + illumination * 0.55),
            palette.textWarm
          );
        }
      }

      if (!reducedMotion && glyphFrame.trailAlpha > 0 && row.role !== "future") {
        ctx.globalAlpha = visibility * rowAlpha * glyphFrame.trailAlpha;
        ctx.fillStyle = palette.textWarm;
        ctx.fillText(
          item.text,
          position.x - position.fontSize * 0.14,
          position.y + position.fontSize * 0.025
        );
      }
    }
    ctx.restore();
  }
  ctx.restore();

  const subtitles = resolveLyricFilmTranslation(translationGroups, program.lineGroups, musicTime);
  if (subtitles?.length) {
    const subtitleSize = clamp(Math.min(width * 0.026, height * 0.034), 13, 22);
    ctx.save();
    ctx.globalAlpha = visibility * 0.84;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 ${subtitleSize}px ${fontFamily}`;
    ctx.lineWidth = Math.max(2, subtitleSize * 0.22);
    ctx.strokeStyle = "rgba(3, 7, 14, 0.82)";
    ctx.fillStyle = palette.textPast;
    subtitles.slice(0, 2).forEach((subtitle, index) => {
      const y = height * 0.82 + index * subtitleSize * 1.28;
      ctx.strokeText(subtitle, width * 0.5, y, width * 0.78);
      ctx.fillText(subtitle, width * 0.5, y, width * 0.78);
    });
    ctx.restore();
  }
}

function drawEndingCard(
  ctx: CanvasRenderingContext2D,
  musicTime: number,
  outroStartTime: number,
  outroEndTime: number,
  width: number,
  height: number,
  title: string,
  artist: string,
  album: string,
  fontFamily: string,
  palette: ColorPalette,
  reducedMotion: boolean,
  opacity: number
): void {
  const displayTitle = title.trim();
  const displayArtist = artist.trim();
  const displayAlbum = album.trim();
  if ((!displayTitle && !displayArtist && !displayAlbum) || opacity <= 0) return;
  const credits = resolveLyricFilmCreditsFrame(
    outroStartTime,
    outroEndTime,
    musicTime,
    displayTitle,
    Boolean(displayArtist),
    Boolean(displayAlbum),
    reducedMotion
  );
  const centerX = width * 0.5;
  const centerY = height * 0.47;
  const titleSize = clamp(Math.min(width * 0.066, height * 0.09), 22, 48);
  const artistSize = Math.max(13, titleSize * 0.42);
  const albumSize = Math.max(11, artistSize * 0.82);
  const visibleTitle = segmentLyricFilmGraphemes(displayTitle)
    .slice(0, credits.titleVisibleGraphemes)
    .join("");

  ctx.save();
  ctx.globalAlpha = clamp(opacity * credits.cardOpacity, 0, 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  if (visibleTitle) {
    ctx.font = `600 ${titleSize}px ${fontFamily}`;
    ctx.fillStyle = palette.textWarm;
    ctx.shadowColor = palette.shimmerAura;
    ctx.shadowBlur = reducedMotion ? 0 : 13 * clamp(0.4 + credits.cardOpacity * 0.6, 0, 1);
    const totalTitleWidth = Math.min(ctx.measureText(displayTitle).width, width * 0.8);
    ctx.fillText(visibleTitle, centerX - totalTitleWidth / 2, centerY, width * 0.8);
  }
  if (displayArtist) {
    ctx.shadowBlur = 0;
    ctx.font = `400 ${artistSize}px ${fontFamily}`;
    ctx.fillStyle = palette.textPast;
    ctx.globalAlpha = clamp(opacity * credits.artistOpacity, 0, 1);
    ctx.textAlign = "center";
    ctx.fillText(displayArtist, centerX, centerY + titleSize * 0.78, width * 0.76);
  }
  if (displayAlbum) {
    ctx.font = `400 ${albumSize}px ${fontFamily}`;
    ctx.fillStyle = palette.textUnsung;
    ctx.textAlign = "center";
    ctx.globalAlpha = clamp(opacity * credits.albumOpacity, 0, 1);
    ctx.fillText(displayAlbum, centerX, centerY + titleSize * 1.18, width * 0.68);
  }
  ctx.restore();
}

function drawShot(
  ctx: CanvasRenderingContext2D,
  state: LyricFilmRuntimeState,
  program: LyricFilmProgram,
  shot: LyricFilmShot,
  musicTime: number,
  isPlaying: boolean,
  reducedMotion: boolean,
  width: number,
  height: number,
  dpr: number,
  palette: ColorPalette,
  stagePalette: LyricFilmStagePalette,
  fontFamily: string,
  fontSize: number,
  feather: number,
  glowIntensity: number,
  motionSpeed: number,
  title: string,
  artist: string,
  album: string,
  opacity: number
): void {
  const transitionOut = shot.transitionOut
    ? {
        kind: shot.transitionOut.kind,
        duration: shot.transitionOut.endTime - shot.transitionOut.startTime,
      }
    : null;
  const rawFrame = resolveLyricFilmStageFrame({
    startTime: shot.startTime,
    endTime: shot.endTime,
    musicTime,
    seed: hashString(shot.seed),
    profile: shot.profile,
    transitionOut,
    motionSpeed,
    ambientPhase: state.ambientPhase,
    isPlaying,
    reducedMotion,
  });
  const frame = {
    ...rawFrame,
    beamAngle: rawFrame.beamAngle + state.smoothTreble * 0.025,
    beamIntensity: clamp(rawFrame.beamIntensity * (0.92 + state.smoothBass * 0.2), 0.4, 1),
    fogPhase: rawFrame.fogPhase + state.smoothMid * 0.08,
    particlePhase: rawFrame.particlePhase + state.smoothTreble * 0.03,
  };

  drawLyricFilmStage({
    ctx,
    frame,
    width,
    height,
    dpr,
    palette: stagePalette,
    opacity,
    lightIntensity: glowIntensity,
  });

  if (shot.kind === "lyrics") {
    drawLyricRows(
      ctx,
      state,
      program,
      shot,
      musicTime,
      width,
      height,
      dpr,
      fontFamily,
      fontSize,
      feather,
      glowIntensity,
      reducedMotion,
      frame,
      palette,
      state.translationGroups,
      opacity
    );
  } else if (shot.kind === "outro") {
    drawEndingCard(
      ctx,
      musicTime,
      shot.startTime,
      shot.endTime,
      width,
      height,
      title,
      artist,
      album,
      fontFamily,
      palette,
      reducedMotion,
      opacity
    );
  }
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

function drawIdleStage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  stagePalette: LyricFilmStagePalette
): void {
  const frame = resolveLyricFilmStageFrame({
    startTime: 0,
    endTime: 60,
    musicTime: 0,
    seed: 146959810,
    profile: "motes",
    transitionOut: null,
    isPlaying: false,
    reducedMotion: true,
  });
  drawLyricFilmStage({ ctx, frame, width, height, dpr, palette: stagePalette });
}

function hexColor(value: string, fallback: string): string {
  const directHex = /^#(?:[\da-f]{3}|[\da-f]{6})$/i.exec(value.trim());
  if (directHex) {
    if (directHex[0].length === 4) {
      const [red, green, blue] = directHex[0].slice(1);
      return `#${red}${red}${green}${green}${blue}${blue}`;
    }
    return directHex[0];
  }

  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(value);
  if (!rgb) return fallback;
  return `#${rgb
    .slice(1, 4)
    .map((channel) => clamp(Number(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function getStagePalette(palette: ColorPalette): LyricFilmStagePalette {
  return {
    deep: palette.bgGradEnd,
    shadow: palette.bgGradMid,
    warm: hexColor(palette.blobColors[0] ?? "", "#e4b57a"),
    cool: hexColor(palette.blobColors[2] ?? "", "#6ea9c8"),
    pale: palette.textFocus,
  };
}

function drawFilmGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeMs: number,
  intensity: number,
  reducedMotion: boolean
): void {
  if (intensity <= 0.01) return;
  const patterns = getGrainPatterns(ctx);
  if (!patterns?.length) return;

  const frame = reducedMotion ? 0 : Math.floor(timeMs / 160) % patterns.length;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = clamp(intensity, 0, 0.34);
  ctx.fillStyle = patterns[frame]!;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function buildGrainTile(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE_SIZE;
    canvas.height = GRAIN_TILE_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const image = context.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    for (let index = 0; index < image.data.length; index += 4) {
      const value = Math.floor(Math.random() * 255);
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = Math.floor(Math.random() * 10);
    }
    context.putImageData(image, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

function getGrainTiles(): HTMLCanvasElement[] | null {
  if (grainTiles) return grainTiles;
  const built: HTMLCanvasElement[] = [];
  for (let index = 0; index < GRAIN_TILE_FRAMES; index += 1) {
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

  const patterns = tiles.map((tile) => ctx.createPattern(tile, "repeat"));
  if (patterns.some((pattern) => !pattern)) return null;
  const validPatterns = patterns as CanvasPattern[];
  grainPatternCache.set(ctx, validPatterns);
  return validPatterns;
}

function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number
): void {
  if (strength <= 0.02) return;
  const radius = Math.max(width, height) * 0.8;
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    radius * 0.34,
    width * 0.5,
    height * 0.5,
    radius
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${clamp(strength * 0.85, 0, 0.9)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function averageSpectrum(data: Uint8Array, start: number, end: number): number {
  if (!data || data.length < end) return 0;
  let sum = 0;
  for (let index = start; index < end; index += 1) sum += data[index] ?? 0;
  return clamp(sum / ((end - start) * 255), 0, 1);
}

/** Render a seekable Lumiere-inspired lyric film from the current song timeline. */
export function drawCinematicLyricDrift(effectCtx: EffectContext): void {
  const { ctx, width, height, data, time, params } = effectCtx;
  if (width <= 0 || height <= 0) return;

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
  const translationLyricsText = currentSong?.translationLyrics ?? "";
  const mediaLoading = audioState.isLoading || playerState.isLoading;
  const songDuration = resolveSongDuration(
    currentSong,
    audioState.duration,
    playerState.duration,
    mediaLoading
  );
  const reportedCandidate =
    audioState.currentTime ?? playerState.currentTime ?? effectCtx.musicTime ?? 0;
  const reportedMusicTime = Number.isFinite(reportedCandidate) ? Math.max(0, reportedCandidate) : 0;
  const isPlaying = audioState.isPlaying ?? playerState.isPlaying ?? false;
  const playbackRate = audioState.playbackRate ?? playerState.playbackRate ?? 1;

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

  const palette = getPalette(params);
  const stagePalette = getStagePalette(palette);
  const fontFamily = getFontFamily(params);
  const preferredFontSize = clamp(Math.round(params?.heroFontSize ?? 54), 20, 92);
  const fontSize = Math.min(
    preferredFontSize,
    Math.max(16, Math.min(width * 0.075, height * 0.14))
  );
  const feather = clamp(params?.shimmerFeather ?? 50, 0, 100);
  const glowIntensity = clamp(params?.ambientGlowIntensity ?? 0.9, 0, 1.5);
  const motionSpeed = clamp(params?.fluidSpeed ?? 0.8, 0, 2);
  if (reducedMotion || isPlaying) {
    state.ambientPhase = 0;
  } else {
    state.ambientPhase += dtSeconds * motionSpeed * 0.18;
  }
  const filmGrain = clamp(params?.filmGrain ?? 0.15, 0, 0.7);
  const vignetteStrength = clamp(params?.vignetteStrength ?? 0.65, 0, 1);
  const dprValue = ctx.canvas.width / Math.max(1, width);
  const dpr = Number.isFinite(dprValue) ? clamp(dprValue, 1, 4) : 1;

  ctx.save();
  try {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.shadowBlur = 0;

    const program = state.program;
    if (!program || program.shots.length === 0) {
      drawIdleStage(ctx, width, height, dpr, stagePalette);
    } else {
      const blend = resolveShotBlend(program, musicTime);
      if (!blend) {
        drawIdleStage(ctx, width, height, dpr, stagePalette);
      } else {
        drawShot(
          ctx,
          state,
          program,
          blend.outgoing,
          musicTime,
          isPlaying,
          reducedMotion,
          width,
          height,
          dpr,
          palette,
          stagePalette,
          fontFamily,
          fontSize,
          feather,
          glowIntensity,
          motionSpeed,
          currentSong?.title ?? "",
          currentSong?.artist ?? "",
          currentSong?.album ?? "",
          1
        );

        if (blend.incoming) {
          drawShot(
            ctx,
            state,
            program,
            blend.incoming,
            musicTime,
            isPlaying,
            reducedMotion,
            width,
            height,
            dpr,
            palette,
            stagePalette,
            fontFamily,
            fontSize,
            feather,
            glowIntensity,
            motionSpeed,
            currentSong?.title ?? "",
            currentSong?.artist ?? "",
            currentSong?.album ?? "",
            blend.progress
          );
        }
      }
    }

    drawFilmGrain(ctx, width, height, frameTimeMs, filmGrain, reducedMotion);
    drawVignette(ctx, width, height, vignetteStrength);
  } finally {
    ctx.restore();
  }
}
