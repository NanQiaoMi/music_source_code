/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectContext } from "./types";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";

// =========================================================================
// 1. Types & Data Structures (Apple Music Liquid Shimmer System)
// =========================================================================

interface FluidBlobItem {
  x: number;
  y: number;
  baseRadius: number;
  currentRadius: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  phase: number;
  speed: number;
}

interface ParsedLrcLine {
  time: number;
  text: string;
}

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

const COLOR_PALETTES: ColorPalette[] = [
  // 0: 深海极光 (Deep Aurora)
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
  // 1: 丝绒暮霭 (Sunset Velvet)
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
  // 2: 苍翠玉石 (Emerald Pine)
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
  // 3: 极简黑曜 (Minimalist Noir)
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
  // 4: 银河星云 (Nebula Violet)
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
  // 0: 现代极简 (Apple SF Pro / 苹方 / 兰亭黑)
  `-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`,
  // 1: 经典雅致 (New York / 思源宋体 / Georgia)
  `"New York", "Source Han Serif SC", "Songti SC", "STSong", "Georgia", serif`,
  // 2: 清雅文楷 (LXGW WenKai / 楷体)
  `"LXGW WenKai", "STKaiti", "Kaiti SC", "楷体", "Baskerville", serif`,
  // 3: 极简几何 (Futura / Montserrat)
  `"Montserrat", "Futura", "PingFang SC", "Noto Sans SC", sans-serif`,
];

let parsedLyricsCache: ParsedLrcLine[] = [];
let lastRawLyricsCache = "";
let currentLineTextCache = "";
let previousLineTextCache = "";
let totalLineWidthCache = 0;
let prevLineWidthCache = 0;
let measuredFontKeyCache = "";
let lineTransitionAlpha = 0;
let prevLineFadeAlpha = 0;
let smoothedProgressCache = 0;
let lastReportedTimeCache = 0;
let lastTimeUpdateMsCache = 0;
let lastFrameMsCache = -1;

// 胶片颗粒预渲染成一组可循环的贴图，避免逐帧重建像素数据
const GRAIN_TILE_SIZE = 256;
const GRAIN_TILE_FRAMES = 8;
let grainTiles: HTMLCanvasElement[] | null = null;
let grainPatterns: CanvasPattern[] | null = null;
let grainPatternContext: CanvasRenderingContext2D | null = null;
let grainFrameIndex = 0;

// 指数平滑的每帧系数按 60fps 标定，绘制时用实际帧时长换算，
// 使 120Hz 与 30Hz 上的过渡手感与 60Hz 一致
const BASS_SMOOTH_PER_FRAME = 0.04;
const PROGRESS_SMOOTH_PER_FRAME = 0.28;
const LINE_FADE_IN_PER_FRAME = 0.09;
const LINE_FADE_OUT_PER_FRAME = 0.1;
// 逐帧累积的位移与插值都按此上限截断，避免长时间掉帧或切回标签页后一次跳变到位
const MAX_FRAME_DT_SECONDS = 0.1;

function isMetadataLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return (
    /^(作词|作曲|编曲|制作|混音|录音|母带|吉他|贝斯|鼓手|和声|监制|企划|文案|出品|发行|提供|翻唱|原唱|统筹|OP|SP|Written|Composed|Arranged|Produced|Mixed|Mastered|Vocals|Guitar|Bass|Drums|Engineer|Publisher|Record)[\s:：]/i.test(
      t
    ) ||
    /^(作词|作曲|编曲|词曲|制作人|录音室|混音室)[\s:：]/i.test(t) ||
    /^\s*(QQ音乐|网易云音乐|酷狗|酷我|咪咕|Kugou|Netease|TME)\s*$/i.test(t)
  );
}

function parseLrc(lrcText: string): ParsedLrcLine[] {
  if (!lrcText || typeof lrcText !== "string") return [];
  const lines = lrcText.split(/\r?\n/);
  const result: ParsedLrcLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    timeRegex.lastIndex = 0;
    const matches = Array.from(trimmed.matchAll(timeRegex));
    if (matches.length === 0) continue;

    const pureText = trimmed.replace(timeRegex, "").trim();
    if (!pureText || isMetadataLine(pureText)) {
      continue;
    }

    for (const match of matches) {
      const min = parseInt(match[1], 10) || 0;
      const sec = parseInt(match[2], 10) || 0;
      const ms = match[3] ? parseInt(match[3].padEnd(3, "0").slice(0, 3), 10) : 0;
      const timeInSec = min * 60 + sec + ms / 1000;

      result.push({
        time: timeInSec,
        text: pureText,
      });
    }
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}

function findActiveLyricIndex(lyrics: ParsedLrcLine[], time: number): number {
  let low = 0;
  let high = lyrics.length - 1;
  let ans = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lyrics[mid].time <= time) {
      ans = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return ans;
}

function buildGrainTile(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE_SIZE;
    canvas.height = GRAIN_TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (
      !ctx ||
      typeof ctx.createImageData !== "function" ||
      typeof ctx.putImageData !== "function"
    ) {
      return null;
    }

    const imgData = ctx.createImageData(canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const val = Math.floor(Math.random() * 255);
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = Math.floor(Math.random() * 16);
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

function getGrainTiles(): HTMLCanvasElement[] | null {
  if (grainTiles) return grainTiles;

  const tiles: HTMLCanvasElement[] = [];
  for (let i = 0; i < GRAIN_TILE_FRAMES; i++) {
    const tile = buildGrainTile();
    if (!tile) return null;
    tiles.push(tile);
  }

  grainTiles = tiles;
  return grainTiles;
}

function getGrainPatterns(ctx: CanvasRenderingContext2D): CanvasPattern[] | null {
  if (grainPatterns && grainPatternContext === ctx) return grainPatterns;

  const tiles = getGrainTiles();
  if (!tiles) return null;

  const patterns: CanvasPattern[] = [];
  for (const tile of tiles) {
    const pattern = ctx.createPattern(tile, "repeat");
    if (!pattern) return null;
    patterns.push(pattern);
  }

  grainPatterns = patterns;
  grainPatternContext = ctx;
  return grainPatterns;
}

function measureLineWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  baseFontSize: number
): number {
  if (!text) return 0;
  ctx.save();
  ctx.font = `600 ${baseFontSize}px ${fontFamily}`;
  const width = ctx.measureText(text).width;
  ctx.restore();
  return width;
}

// 把按 60fps 标定的每帧系数换算成本帧实际的插值系数
function frameRateIndependentFactor(perFrameFactor: number, dtSeconds: number): number {
  if (dtSeconds <= 0) return 0;
  return 1 - Math.pow(1 - perFrameFactor, dtSeconds * 60);
}

function renderLiquidShimmerLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  totalWidth: number,
  centerX: number,
  centerY: number,
  progress: number,
  lineAlpha: number,
  palette: ColorPalette,
  featherWidth: number,
  fitScale: number,
  fontFamily: string,
  baseFontSize: number
) {
  if (!text || totalWidth <= 0 || lineAlpha <= 0.001) return;

  const actualWidth = totalWidth * fitScale;
  const startX = centerX - actualWidth / 2;
  const endX = centerX + actualWidth / 2;

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = lineAlpha;
  // 按本行自身的缩放比例设置字号，保证字形宽度与流光扫描带的几何一致
  ctx.font = `600 ${baseFontSize * fitScale}px ${fontFamily}`;

  // 1. 底层：完整绘制整句优雅未唱文字
  ctx.save();
  ctx.fillStyle = palette.textUnsung;
  ctx.fillText(text, centerX, centerY);
  ctx.restore();

  // 2. 顶层：月光液态流光扫描层
  if (progress > 0.001) {
    const sweepX = startX + actualWidth * Math.min(1.0, Math.max(0.0, progress));
    const feather = Math.max(20, featherWidth * fitScale);

    const gradStartX = Math.max(startX - 10, sweepX - feather * 1.6);
    const gradEndX = Math.min(endX + 10, sweepX + feather * 0.8);

    if (gradEndX > gradStartX) {
      const grad = ctx.createLinearGradient(gradStartX, 0, gradEndX, 0);

      grad.addColorStop(0.0, palette.textPast);
      const peakStop = Math.max(
        0.05,
        Math.min(0.95, (sweepX - gradStartX) / (gradEndX - gradStartX))
      );
      grad.addColorStop(peakStop, palette.textFocus);
      grad.addColorStop(1.0, "rgba(255, 255, 255, 0)");

      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillText(text, centerX, centerY);
      ctx.restore();
    }
  }

  ctx.restore();
}

// =========================================================================
// 2. Main Draw Function
// =========================================================================

export function drawCinematicLyricDrift(effectCtx: EffectContext) {
  const { ctx, width, height, data, time, refs, params } = effectCtx;

  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const dtSeconds =
    lastFrameMsCache < 0
      ? 0
      : Math.min(MAX_FRAME_DT_SECONDS, Math.max(0, (nowMs - lastFrameMsCache) / 1000));
  lastFrameMsCache = nowMs;

  // 逐帧累积量按 1 个 60fps 帧为基准缩放，使漂移速度不随刷新率变化
  const driftScale = dtSeconds * 60;

  const bassSmooth = frameRateIndependentFactor(BASS_SMOOTH_PER_FRAME, dtSeconds);
  const progressSmooth = frameRateIndependentFactor(PROGRESS_SMOOTH_PER_FRAME, dtSeconds);
  const lineFadeIn = frameRateIndependentFactor(LINE_FADE_IN_PER_FRAME, dtSeconds);
  const lineFadeOut = frameRateIndependentFactor(LINE_FADE_OUT_PER_FRAME, dtSeconds);

  const schemeIndex = Math.max(
    0,
    Math.min(COLOR_PALETTES.length - 1, Math.round(params?.colorScheme ?? 0))
  );
  const palette = COLOR_PALETTES[schemeIndex];

  const fontStyleIndex = Math.max(
    0,
    Math.min(FONT_STYLES.length - 1, Math.round(params?.fontStyle ?? 0))
  );
  const selectedFontFamily = FONT_STYLES[fontStyleIndex];

  const heroFontSize = Math.round(params?.heroFontSize ?? 54);
  const shimmerFeather = params?.shimmerFeather ?? 50;
  const fluidSpeed = params?.fluidSpeed ?? 0.8;
  const ambientGlowIntensity = params?.ambientGlowIntensity ?? 0.9;
  const filmGrain = params?.filmGrain ?? 0.15;
  const vignetteStrength = params?.vignetteStrength ?? 0.65;

  let rawBass = 0;
  let rawMid = 0;
  let rawTreble = 0;

  if (data && data.length >= 64) {
    let bSum = 0;
    let mSum = 0;
    let tSum = 0;
    for (let i = 0; i < 8; i++) bSum += data[i];
    for (let i = 8; i < 32; i++) mSum += data[i];
    for (let i = 32; i < 64; i++) tSum += data[i];
    rawBass = bSum / (8 * 255);
    rawMid = mSum / (24 * 255);
    rawTreble = tSum / (32 * 255);
  }

  refs.smoothBass.current += (rawBass - refs.smoothBass.current) * bassSmooth;
  refs.smoothMid.current += (rawMid - refs.smoothMid.current) * bassSmooth;
  refs.smoothTreble.current += (rawTreble - refs.smoothTreble.current) * bassSmooth;

  // 初始化 4 个流体球
  if (!refs.bokeh.current || refs.bokeh.current.length < 4) {
    const blobs: FluidBlobItem[] = [
      {
        x: width * 0.3,
        y: height * 0.35,
        baseRadius: Math.min(width, height) * 0.45,
        currentRadius: Math.min(width, height) * 0.45,
        vx: 0.12,
        vy: 0.08,
        color: "rgba(35, 75, 160, 0.28)",
        alpha: 0.28,
        phase: 0,
        speed: 0.5,
      },
      {
        x: width * 0.7,
        y: height * 0.4,
        baseRadius: Math.min(width, height) * 0.48,
        currentRadius: Math.min(width, height) * 0.48,
        vx: -0.09,
        vy: 0.11,
        color: "rgba(100, 45, 150, 0.22)",
        alpha: 0.22,
        phase: Math.PI * 0.5,
        speed: 0.45,
      },
      {
        x: width * 0.45,
        y: height * 0.65,
        baseRadius: Math.min(width, height) * 0.42,
        currentRadius: Math.min(width, height) * 0.42,
        vx: 0.08,
        vy: -0.1,
        color: "rgba(20, 140, 180, 0.24)",
        alpha: 0.24,
        phase: Math.PI,
        speed: 0.55,
      },
      {
        x: width * 0.6,
        y: height * 0.25,
        baseRadius: Math.min(width, height) * 0.38,
        currentRadius: Math.min(width, height) * 0.38,
        vx: -0.11,
        vy: -0.07,
        color: "rgba(60, 20, 110, 0.20)",
        alpha: 0.2,
        phase: Math.PI * 1.5,
        speed: 0.4,
      },
    ];
    refs.bokeh.current = blobs;
  }

  const audioState = useAudioStore.getState();
  const playerState = usePlayerStore.getState();
  const currentSong = audioState.currentSong || playerState.currentSong;
  const reportedTime = audioState.currentTime || playerState.currentTime || 0;
  const isPlaying = audioState.isPlaying || playerState.isPlaying;
  const rawLyrics = currentSong?.lyrics || "";

  if (Math.abs(reportedTime - lastReportedTimeCache) > 0.02) {
    lastReportedTimeCache = reportedTime;
    lastTimeUpdateMsCache = nowMs;
  }

  const elapsedSinceUpdate = isPlaying ? (nowMs - lastTimeUpdateMsCache) / 1000 : 0;
  const preciseTime = lastReportedTimeCache + Math.min(0.8, Math.max(0, elapsedSinceUpdate));

  if (rawLyrics !== lastRawLyricsCache) {
    lastRawLyricsCache = rawLyrics;
    parsedLyricsCache = parseLrc(rawLyrics);
    currentLineTextCache = "";
    previousLineTextCache = "";
    totalLineWidthCache = 0;
    prevLineWidthCache = 0;
    measuredFontKeyCache = "";
    smoothedProgressCache = 0;
  }

  let activeLine = "";
  let targetProgress = 0;
  let isSinging = false;

  if (isPlaying && parsedLyricsCache.length > 0) {
    const activeIdx = findActiveLyricIndex(parsedLyricsCache, preciseTime);

    if (activeIdx >= 0) {
      const curr = parsedLyricsCache[activeIdx];
      const next = parsedLyricsCache[activeIdx + 1];
      const lineDuration = next ? Math.max(1.2, next.time - curr.time) : 5.0;
      const elapsed = preciseTime - curr.time;
      const estimatedDuration = Math.min(lineDuration, Math.max(2.0, curr.text.length * 0.34));

      if (elapsed >= 0 && elapsed <= estimatedDuration + 0.8) {
        isSinging = true;
        activeLine = curr.text;
        targetProgress = Math.min(1.0, Math.max(0.0, elapsed / Math.max(1.0, estimatedDuration)));
      }
    }
  }

  const fontKey = `${selectedFontFamily}|${heroFontSize}`;

  if (activeLine !== currentLineTextCache) {
    if (currentLineTextCache) {
      previousLineTextCache = currentLineTextCache;
      prevLineWidthCache = totalLineWidthCache;
      prevLineFadeAlpha = lineTransitionAlpha;
    }
    currentLineTextCache = activeLine;
    lineTransitionAlpha = 0;
    smoothedProgressCache = targetProgress;
    measuredFontKeyCache = fontKey;
    totalLineWidthCache = measureLineWidth(ctx, activeLine, selectedFontFamily, heroFontSize);
  } else if (fontKey !== measuredFontKeyCache) {
    // 字体风格或字号变化后必须按新参数重新测量，否则流光扫描带会与字形宽度错位
    measuredFontKeyCache = fontKey;
    totalLineWidthCache = measureLineWidth(ctx, activeLine, selectedFontFamily, heroFontSize);
    prevLineWidthCache = measureLineWidth(
      ctx,
      previousLineTextCache,
      selectedFontFamily,
      heroFontSize
    );
  }

  smoothedProgressCache += (targetProgress - smoothedProgressCache) * progressSmooth;

  const targetCurrentAlpha = isSinging ? 1.0 : 0.0;
  lineTransitionAlpha += (targetCurrentAlpha - lineTransitionAlpha) * lineFadeIn;
  prevLineFadeAlpha += (0.0 - prevLineFadeAlpha) * lineFadeOut;

  // 1. 深邃底色
  const bgGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    30,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.85
  );
  bgGrad.addColorStop(0, palette.bgGradStart);
  bgGrad.addColorStop(0.6, palette.bgGradMid);
  bgGrad.addColorStop(1, palette.bgGradEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Apple 风格流体弥散色斑
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const blobs = refs.bokeh.current as FluidBlobItem[];
  for (let i = 0; i < blobs.length; i++) {
    const blob = blobs[i];
    const blobColorPattern = palette.blobColors[i % palette.blobColors.length];

    blob.x +=
      (blob.vx * fluidSpeed + Math.sin(time * 0.00015 * blob.speed + blob.phase) * 0.4) *
      driftScale;
    blob.y +=
      (blob.vy * fluidSpeed + Math.cos(time * 0.00012 * blob.speed + blob.phase) * 0.4) *
      driftScale;

    const margin = blob.baseRadius * 0.6;
    if (blob.x < -margin) blob.vx = Math.abs(blob.vx);
    if (blob.x > width + margin) blob.vx = -Math.abs(blob.vx);
    if (blob.y < -margin) blob.vy = Math.abs(blob.vy);
    if (blob.y > height + margin) blob.vy = -Math.abs(blob.vy);

    const pulse = 1.0 + Math.sin(time * 0.0005 + blob.phase) * 0.08;
    const curR = blob.baseRadius * pulse;
    const alpha = blob.alpha * ambientGlowIntensity * (0.85 + refs.smoothBass.current * 0.3);

    const blobGrad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, curR);
    blobGrad.addColorStop(0, blobColorPattern.replace(/[\d.]+\)$/, `${alpha})`));
    blobGrad.addColorStop(
      0.5,
      blobColorPattern.replace(/[\d.]+\)$/, `${(alpha * 0.4).toFixed(3)})`)
    );
    blobGrad.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = blobGrad;
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, curR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. 歌词渲染：Apple 风格纯净液态流光 (横向完整排版 + 丝绸微滑)
  const heroY = height * 0.51;
  const heroX = width * 0.5;

  const maxAllowedWidth = width * 0.86;
  const currFitScale =
    totalLineWidthCache > 0 ? Math.min(1.0, maxAllowedWidth / totalLineWidthCache) : 1.0;
  const prevFitScale =
    prevLineWidthCache > 0 ? Math.min(1.0, maxAllowedWidth / prevLineWidthCache) : 1.0;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (prevLineFadeAlpha > 0.005 && previousLineTextCache) {
    const prevY = heroY - 10 * (1 - prevLineFadeAlpha);
    renderLiquidShimmerLine(
      ctx,
      previousLineTextCache,
      prevLineWidthCache,
      heroX,
      prevY,
      1.0,
      prevLineFadeAlpha * 0.65,
      palette,
      shimmerFeather,
      prevFitScale,
      selectedFontFamily,
      heroFontSize
    );
  }

  if (lineTransitionAlpha > 0.005 && currentLineTextCache) {
    const currY = heroY + 10 * (1 - lineTransitionAlpha);
    renderLiquidShimmerLine(
      ctx,
      currentLineTextCache,
      totalLineWidthCache,
      heroX,
      currY,
      smoothedProgressCache,
      lineTransitionAlpha,
      palette,
      shimmerFeather,
      currFitScale,
      selectedFontFamily,
      heroFontSize
    );
  }

  ctx.restore();

  // 4. 胶片微粒
  if (filmGrain > 0.02) {
    const patterns = getGrainPatterns(ctx);
    if (patterns && patterns.length > 0) {
      grainFrameIndex = (grainFrameIndex + 1) % patterns.length;
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = filmGrain;
      const grainOffsetX = (Math.random() - 0.5) * 20;
      const grainOffsetY = (Math.random() - 0.5) * 20;
      ctx.translate(grainOffsetX, grainOffsetY);
      ctx.fillStyle = patterns[grainFrameIndex];
      ctx.fillRect(-20, -20, width + 40, height + 40);
      ctx.restore();
    }
  }

  // 5. 暗角
  if (vignetteStrength > 0.05) {
    const maxDim = Math.max(width, height) * 0.75;
    const vigGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      maxDim * 0.42,
      width * 0.5,
      height * 0.5,
      maxDim
    );
    vigGrad.addColorStop(0, "rgba(0,0,0,0)");
    vigGrad.addColorStop(1, `rgba(0,0,0,${vignetteStrength * 0.85})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);
  }
}
