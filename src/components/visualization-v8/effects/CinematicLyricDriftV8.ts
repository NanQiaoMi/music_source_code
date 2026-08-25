/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  EffectPlugin,
  RenderContext,
  AudioData,
  EffectParameterMap,
  EffectParameterDefinition,
} from "@/lib/visualization/types";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";

// =========================================================================
// 1. Types & Data Structures (Apple Music Liquid Shimmer System)
// =========================================================================

export interface FluidColorBlob {
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

export interface ParsedLrcLine {
  time: number;
  text: string;
}

export interface CinematicLyricDriftState {
  fluidBlobs: FluidColorBlob[];
  parsedLyrics: ParsedLrcLine[];
  lastRawLyrics: string;

  // 高精度音频时钟插值
  lastReportedTime: number;
  lastTimeUpdateMs: number;

  // 歌词文本与排版度量
  currentLineText: string;
  previousLineText: string;
  totalLineWidth: number;
  prevLineWidth: number;

  // 进度与丝绸微滑过渡
  lineTransitionAlpha: number;
  prevLineFadeAlpha: number;
  smoothedLineProgress: number;
  isSinging: boolean;

  // 音频平滑
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  breathPhase: number;
  timeAccumulator: number;
  grainCanvas: HTMLCanvasElement | null;
}

// =========================================================================
// 2. Apple-Grade Ambient Color Palettes
// =========================================================================

export interface ColorPalette {
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
  // 0: 深海极光 (Deep Aurora - 极夜深黑 + 极光黛蓝 + 浅紫柔光)
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
  // 1: 丝绒暮霭 (Sunset Velvet - 黑曜 + 暖金琥珀 + 玫瑰暮色)
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
  // 2: 苍翠玉石 (Emerald Pine - 幽深竹墨 + 苍翠薄荷)
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
  // 3: 极简黑曜 (Minimalist Noir - 纯粹深邃黑曜石 + 月华冷白)
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
  // 4: 银河星云 (Nebula Violet - 银河深紫 + 梦幻粉晶)
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

// =========================================================================
// 3. Helpers: LRC Parser & Film Grain Canvas
// =========================================================================

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

function createFilmGrainCanvas(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
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

/**
 * Apple 风格纯净液态流光歌词绘制器 (Apple Music Liquid Shimmer Sweep)
 */
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
  fitScale: number
) {
  if (!text || totalWidth <= 0 || lineAlpha <= 0.001) return;

  const actualWidth = totalWidth * fitScale;
  const startX = centerX - actualWidth / 2;
  const endX = centerX + actualWidth / 2;

  // 1. 严格无发光，绝对锐利清爽
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = lineAlpha;

  // 2. 底层：完整绘制整句优雅未唱文字 (24% 纯净深灰白，字形永不破损)
  ctx.save();
  ctx.fillStyle = palette.textUnsung;
  ctx.fillText(text, centerX, centerY);
  ctx.restore();

  // 3. 顶层：月光液态流光扫描层 (通过带羽化的线性渐变点亮已唱和唱中字段)
  if (progress > 0.001) {
    const sweepX = startX + actualWidth * Math.min(1.0, Math.max(0.0, progress));
    const feather = Math.max(20, featherWidth * fitScale);

    const gradStartX = Math.max(startX - 10, sweepX - feather * 1.6);
    const gradEndX = Math.min(endX + 10, sweepX + feather * 0.8);

    if (gradEndX > gradStartX) {
      const grad = ctx.createLinearGradient(gradStartX, 0, gradEndX, 0);

      // 已唱过的沉淀温润白
      grad.addColorStop(0.0, palette.textPast);
      // 正在唱的流光高光峰值 (100% 纯白月光)
      const peakStop = Math.max(
        0.05,
        Math.min(0.95, (sweepX - gradStartX) / (gradEndX - gradStartX))
      );
      grad.addColorStop(peakStop, palette.textFocus);
      // 未唱区域衰减至透明
      grad.addColorStop(1.0, "rgba(255, 255, 255, 0)");

      ctx.save();
      // 使用渐变填充再次绘制文字，优雅覆盖
      ctx.fillStyle = grad;
      ctx.fillText(text, centerX, centerY);
      ctx.restore();
    }
  }

  ctx.restore();
}

// =========================================================================
// 4. Parameter Definitions
// =========================================================================

const PARAMETERS: EffectParameterDefinition[] = [
  {
    id: "fontStyle",
    name: "字体设计风格",
    type: "select",
    mode: "basic",
    default: 0,
    options: [
      { label: "现代极简 (Apple SF Pro / 苹方)", value: 0 },
      { label: "经典雅致 (New York / 思源宋体)", value: 1 },
      { label: "清雅文楷 (LXGW WenKai / 文楷)", value: 2 },
      { label: "极简几何 (Futura / Montserrat)", value: 3 },
    ],
  },
  {
    id: "colorScheme",
    name: "流体艺术色系",
    type: "select",
    mode: "basic",
    default: 0,
    options: [
      { label: "深海极光 (Deep Aurora)", value: 0 },
      { label: "丝绒暮霭 (Sunset Velvet)", value: 1 },
      { label: "苍翠玉石 (Emerald Pine)", value: 2 },
      { label: "极简黑曜 (Minimalist Noir)", value: 3 },
      { label: "银河星云 (Nebula Violet)", value: 4 },
    ],
  },
  {
    id: "heroFontSize",
    name: "歌词字号",
    type: "number",
    mode: "basic",
    min: 36,
    max: 72,
    step: 2,
    default: 54,
  },
  {
    id: "shimmerFeather",
    name: "流光羽化宽度",
    type: "number",
    mode: "professional",
    min: 20,
    max: 100,
    step: 5,
    default: 50,
  },
  {
    id: "fluidSpeed",
    name: "背景流体速度",
    type: "number",
    mode: "professional",
    min: 0.2,
    max: 2.0,
    step: 0.1,
    default: 0.8,
  },
  {
    id: "ambientGlowIntensity",
    name: "弥散光晕强度",
    type: "number",
    mode: "professional",
    min: 0.2,
    max: 1.5,
    step: 0.1,
    default: 0.9,
  },
  {
    id: "filmGrain",
    name: "胶片颗粒微粒",
    type: "number",
    mode: "expert",
    min: 0.0,
    max: 0.5,
    step: 0.02,
    default: 0.15,
  },
  {
    id: "vignetteStrength",
    name: "幽深暗角",
    type: "number",
    mode: "expert",
    min: 0.0,
    max: 1.0,
    step: 0.05,
    default: 0.65,
  },
];

// =========================================================================
// 5. Plugin Implementation
// =========================================================================

export const CinematicLyricDriftV8Effect: EffectPlugin = {
  id: "cinematic-lyric-drift-v8",
  name: "温光浮字 · 电影感",
  category: "particles",
  description: "Apple风格纯净液态流光歌词、完整优雅横向排版、深邃流体弥散色斑、丝绸微滑换句过渡",
  preferredEngine: "canvas",
  parameters: PARAMETERS,

  init(ctx: RenderContext) {
    const width = ctx.width || 1280;
    const height = ctx.height || 720;

    // 创建 4 个 Apple Music 风格超大流体色块
    const fluidBlobs: FluidColorBlob[] = [
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

    const state: CinematicLyricDriftState = {
      fluidBlobs,
      parsedLyrics: [],
      lastRawLyrics: "",
      lastReportedTime: 0,
      lastTimeUpdateMs: typeof performance !== "undefined" ? performance.now() : Date.now(),
      currentLineText: "",
      previousLineText: "",
      totalLineWidth: 0,
      prevLineWidth: 0,
      lineTransitionAlpha: 0,
      prevLineFadeAlpha: 0,
      smoothedLineProgress: 0,
      isSinging: false,
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedEnergy: 0,
      breathPhase: 0,
      timeAccumulator: 0,
      grainCanvas: createFilmGrainCanvas(),
    };

    ctx.private = state;
  },

  render(ctx: RenderContext, audioData: AudioData, params: EffectParameterMap) {
    const c2d = ctx.ctx;
    if (!c2d) return;

    const width = ctx.width;
    const height = ctx.height;
    const deltaTime = Math.min(ctx.deltaTime || 0.016, 0.1);

    if (!ctx.private || !ctx.private.fluidBlobs) {
      CinematicLyricDriftV8Effect.init(ctx);
    }
    const state = ctx.private as CinematicLyricDriftState;

    // -------------------------------------------------------------
    // 1. 参数与字体
    // -------------------------------------------------------------
    const schemeIndex = Math.max(
      0,
      Math.min(COLOR_PALETTES.length - 1, Math.round(params.colorScheme ?? 0))
    );
    const palette = COLOR_PALETTES[schemeIndex];

    const fontStyleIndex = Math.max(
      0,
      Math.min(FONT_STYLES.length - 1, Math.round(params.fontStyle ?? 0))
    );
    const selectedFontFamily = FONT_STYLES[fontStyleIndex];

    const heroFontSize = Math.round(params.heroFontSize ?? 54);
    const shimmerFeather = params.shimmerFeather ?? 50;
    const fluidSpeed = params.fluidSpeed ?? 0.8;
    const ambientGlowIntensity = params.ambientGlowIntensity ?? 0.9;
    const filmGrain = params.filmGrain ?? 0.15;
    const vignetteStrength = params.vignetteStrength ?? 0.65;

    // -------------------------------------------------------------
    // 2. 音频平滑 (仅用于流体背景极其温柔的微呼吸)
    // -------------------------------------------------------------
    let rawBass = audioData.bass || 0;
    let rawMid = audioData.mid || 0;
    let rawTreble = audioData.treble || 0;

    if (audioData.frequencyData && audioData.frequencyData.length >= 64) {
      const fd = audioData.frequencyData;
      let bSum = 0;
      let mSum = 0;
      let tSum = 0;
      for (let i = 0; i < 8; i++) bSum += fd[i];
      for (let i = 8; i < 32; i++) mSum += fd[i];
      for (let i = 32; i < 64; i++) tSum += fd[i];
      rawBass = Math.max(rawBass, bSum / (8 * 255));
      rawMid = Math.max(rawMid, mSum / (24 * 255));
      rawTreble = Math.max(rawTreble, tSum / (32 * 255));
    }

    const smoothFactor = 0.04;
    state.smoothedBass += (rawBass - state.smoothedBass) * smoothFactor;
    state.smoothedMid += (rawMid - state.smoothedMid) * smoothFactor;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * smoothFactor;
    const totalEnergy =
      state.smoothedBass * 0.5 + state.smoothedMid * 0.3 + state.smoothedTreble * 0.2;
    state.smoothedEnergy += (totalEnergy - state.smoothedEnergy) * smoothFactor;

    state.timeAccumulator += deltaTime;
    state.breathPhase =
      (state.breathPhase + deltaTime * (0.2 + state.smoothedEnergy * 0.2)) % (Math.PI * 2);

    // -------------------------------------------------------------
    // 3. 高精度时钟与实时演唱状态定位
    // -------------------------------------------------------------
    const audioState = useAudioStore.getState();
    const playerState = usePlayerStore.getState();
    const currentSong = audioState.currentSong || playerState.currentSong;
    const reportedTime = audioState.currentTime || playerState.currentTime || 0;
    const isPlaying = audioState.isPlaying || playerState.isPlaying;
    const rawLyrics = currentSong?.lyrics || "";

    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();

    if (Math.abs(reportedTime - state.lastReportedTime) > 0.02) {
      state.lastReportedTime = reportedTime;
      state.lastTimeUpdateMs = nowMs;
    }

    const elapsedSinceUpdate = isPlaying ? (nowMs - state.lastTimeUpdateMs) / 1000 : 0;
    const preciseTime = state.lastReportedTime + Math.min(0.8, Math.max(0, elapsedSinceUpdate));

    if (rawLyrics !== state.lastRawLyrics) {
      state.lastRawLyrics = rawLyrics;
      state.parsedLyrics = parseLrc(rawLyrics);
      state.currentLineText = "";
      state.previousLineText = "";
      state.totalLineWidth = 0;
      state.prevLineWidth = 0;
      state.smoothedLineProgress = 0;
    }

    let activeLine = "";
    let targetProgress = 0;
    let isSinging = false;

    if (isPlaying && state.parsedLyrics.length > 0) {
      const activeIdx = findActiveLyricIndex(state.parsedLyrics, preciseTime);

      if (activeIdx >= 0) {
        const curr = state.parsedLyrics[activeIdx];
        const next = state.parsedLyrics[activeIdx + 1];
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

    // 换行度量
    if (activeLine !== state.currentLineText) {
      if (state.currentLineText) {
        state.previousLineText = state.currentLineText;
        state.prevLineWidth = state.totalLineWidth;
        state.prevLineFadeAlpha = state.lineTransitionAlpha;
      }
      state.currentLineText = activeLine;
      state.lineTransitionAlpha = 0;
      state.smoothedLineProgress = targetProgress;

      if (activeLine) {
        c2d.save();
        c2d.font = `600 ${heroFontSize}px ${selectedFontFamily}`;
        state.totalLineWidth = c2d.measureText(activeLine).width;
        c2d.restore();
      } else {
        state.totalLineWidth = 0;
      }
    }

    state.isSinging = isSinging;
    state.smoothedLineProgress += (targetProgress - state.smoothedLineProgress) * 0.28;

    const targetCurrentAlpha = isSinging ? 1.0 : 0.0;
    state.lineTransitionAlpha += (targetCurrentAlpha - state.lineTransitionAlpha) * 0.09;
    state.prevLineFadeAlpha += (0.0 - state.prevLineFadeAlpha) * 0.1;

    // -------------------------------------------------------------
    // 4. 背景渲染：深邃黑曜石 + Apple Music 风格流体弥散光晕
    // -------------------------------------------------------------

    // A. 深邃底色
    const bgGrad = c2d.createRadialGradient(
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
    c2d.fillStyle = bgGrad;
    c2d.fillRect(0, 0, width, height);

    // B. Apple 风格流体弥散色斑（极慢律动，如丝绒温润流动）
    c2d.save();
    c2d.globalCompositeOperation = "screen";

    for (let i = 0; i < state.fluidBlobs.length; i++) {
      const blob = state.fluidBlobs[i];
      const blobColorPattern = palette.blobColors[i % palette.blobColors.length];

      // 极慢平滑游弋
      blob.x +=
        blob.vx * fluidSpeed +
        Math.sin(state.timeAccumulator * 0.15 * blob.speed + blob.phase) * 0.4;
      blob.y +=
        blob.vy * fluidSpeed +
        Math.cos(state.timeAccumulator * 0.12 * blob.speed + blob.phase) * 0.4;

      // 屏幕边界柔和回弹
      const margin = blob.baseRadius * 0.6;
      if (blob.x < -margin) blob.vx = Math.abs(blob.vx);
      if (blob.x > width + margin) blob.vx = -Math.abs(blob.vx);
      if (blob.y < -margin) blob.vy = Math.abs(blob.vy);
      if (blob.y > height + margin) blob.vy = -Math.abs(blob.vy);

      // 微呼吸形变
      const pulse = 1.0 + Math.sin(state.breathPhase + blob.phase) * 0.08;
      const curR = blob.baseRadius * pulse;
      const alpha = blob.alpha * ambientGlowIntensity * (0.85 + state.smoothedBass * 0.3);

      const blobGrad = c2d.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, curR);
      blobGrad.addColorStop(0, blobColorPattern.replace(/[\d.]+\)$/, `${alpha})`));
      blobGrad.addColorStop(
        0.5,
        blobColorPattern.replace(/[\d.]+\)$/, `${(alpha * 0.4).toFixed(3)})`)
      );
      blobGrad.addColorStop(1, "rgba(0,0,0,0)");

      c2d.fillStyle = blobGrad;
      c2d.beginPath();
      c2d.arc(blob.x, blob.y, curR, 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.restore();

    // -------------------------------------------------------------
    // 5. 歌词渲染：Apple 风格纯净液态流光 (横向完整排版 + 丝绸微滑)
    // -------------------------------------------------------------
    const heroY = height * 0.51;
    const heroX = width * 0.5;

    // 自适应安全排版（保证整句完整大气且绝不溢出边缘）
    const maxAllowedWidth = width * 0.86;
    const currFitScale =
      state.totalLineWidth > 0 ? Math.min(1.0, maxAllowedWidth / state.totalLineWidth) : 1.0;
    const prevFitScale =
      state.prevLineWidth > 0 ? Math.min(1.0, maxAllowedWidth / state.prevLineWidth) : 1.0;

    const actualFontSize = Math.round(heroFontSize * currFitScale);

    c2d.save();
    c2d.textAlign = "center";
    c2d.textBaseline = "middle";
    c2d.font = `600 ${actualFontSize}px ${selectedFontFamily}`;

    // A. 旧句退场：向上微浮 10px 平滑淡出 (丝绸微滑)
    if (state.prevLineFadeAlpha > 0.005 && state.previousLineText) {
      const prevY = heroY - 10 * (1 - state.prevLineFadeAlpha);
      renderLiquidShimmerLine(
        c2d,
        state.previousLineText,
        state.prevLineWidth,
        heroX,
        prevY,
        1.0,
        state.prevLineFadeAlpha * 0.65,
        palette,
        shimmerFeather,
        prevFitScale
      );
    }

    // B. 当前句入场：从下方微升 10px 柔和淡入 + 月光液态流光精准扫描
    if (state.lineTransitionAlpha > 0.005 && state.currentLineText) {
      const currY = heroY + 10 * (1 - state.lineTransitionAlpha);
      renderLiquidShimmerLine(
        c2d,
        state.currentLineText,
        state.totalLineWidth,
        heroX,
        currY,
        state.smoothedLineProgress,
        state.lineTransitionAlpha,
        palette,
        shimmerFeather,
        currFitScale
      );
    }

    c2d.restore();

    // -------------------------------------------------------------
    // 6. 顶级胶片微粒 & 幽深暗角
    // -------------------------------------------------------------
    if (filmGrain > 0.02 && state.grainCanvas) {
      c2d.save();
      c2d.globalCompositeOperation = "overlay";
      c2d.globalAlpha = filmGrain;
      const pattern = c2d.createPattern(state.grainCanvas, "repeat");
      if (pattern) {
        const grainOffsetX = (Math.random() - 0.5) * 20;
        const grainOffsetY = (Math.random() - 0.5) * 20;
        c2d.translate(grainOffsetX, grainOffsetY);
        c2d.fillStyle = pattern;
        c2d.fillRect(-20, -20, width + 40, height + 40);
      }
      c2d.restore();
    }

    if (vignetteStrength > 0.05) {
      c2d.save();
      const maxDim = Math.max(width, height) * 0.75;
      const vigGrad = c2d.createRadialGradient(
        width * 0.5,
        height * 0.5,
        maxDim * 0.42,
        width * 0.5,
        height * 0.5,
        maxDim
      );
      vigGrad.addColorStop(0, "rgba(0,0,0,0)");
      vigGrad.addColorStop(1, `rgba(0,0,0,${vignetteStrength * 0.85})`);
      c2d.fillStyle = vigGrad;
      c2d.fillRect(0, 0, width, height);
      c2d.restore();
    }
  },

  resize(_width: number, _height: number) {
    // 自动响应视口
  },

  destroy(ctx?: RenderContext) {
    if (ctx && ctx.private) {
      ctx.private.fluidBlobs = [];
      ctx.private.parsedLyrics = [];
      ctx.private.grainCanvas = null;
    }
  },
};
