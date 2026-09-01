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
// 1. Types & Data Structures (Apple Music 4K Liquid Mesh System)
// =========================================================================

export interface FluidColorBlob {
  x: number;
  y: number;
  baseRadius: number;
  currentRadius: number;
  vx: number;
  vy: number;
  r: number;
  g: number;
  b: number;
  targetR: number;
  targetG: number;
  targetB: number;
  alpha: number;
  phase: number;
  speed: number;
}

export interface ParsedLrcLine {
  time: number;
  text: string;
}

export interface DynamicPalette {
  bgStart: [number, number, number];
  bgMid: [number, number, number];
  bgEnd: [number, number, number];
  blobs: [number, number, number][];
}

export interface CinematicLyricDriftState {
  fluidBlobs: FluidColorBlob[];
  parsedLyrics: ParsedLrcLine[];
  lastRawLyrics: string;
  lastSongId: string;
  lastCoverUrl: string;

  // 封面色谱平滑过渡
  currentPalette: DynamicPalette;
  targetPalette: DynamicPalette;
  paletteMorphT: number;

  // 高精度音频时钟插值
  lastReportedTime: number;
  lastTimeUpdateMs: number;

  // 歌词文本与排版度量
  currentLineText: string;
  previousLineText: string;
  totalLineWidth: number;
  prevLineWidth: number;

  // 8px 物理弹簧过渡与丝绸微滑
  lineTransitionAlpha: number;
  prevLineFadeAlpha: number;
  smoothedLineProgress: number;
  isSinging: boolean;

  // 空闲曲目徽章动画
  idleBadgeAlpha: number;

  // 音频三频平滑（纯重低音呼吸）
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  breathPhase: number;
  timeAccumulator: number;
  grainCanvas: HTMLCanvasElement | null;
}

// =========================================================================
// 2. Apple-Grade Ambient Fallback Color Palettes
// =========================================================================

const DEFAULT_AURORA_PALETTE: DynamicPalette = {
  bgStart: [10, 17, 32],
  bgMid: [6, 10, 20],
  bgEnd: [2, 3, 6],
  blobs: [
    [28, 85, 180],
    [130, 45, 185],
    [20, 170, 200],
    [190, 55, 120],
    [45, 30, 100],
  ],
};

const PRESET_PALETTES: DynamicPalette[] = [
  // 0: 自适应封面色盘 (Dynamic Album Art)
  DEFAULT_AURORA_PALETTE,
  // 1: 深海极光 (Deep Aurora)
  {
    bgStart: [9, 13, 22],
    bgMid: [4, 7, 12],
    bgEnd: [1, 2, 4],
    blobs: [
      [35, 95, 200],
      [140, 55, 195],
      [25, 180, 210],
      [80, 30, 140],
      [30, 60, 130],
    ],
  },
  // 2: 丝绒暮霭 (Sunset Velvet)
  {
    bgStart: [22, 10, 15],
    bgMid: [12, 5, 8],
    bgEnd: [2, 1, 2],
    blobs: [
      [220, 85, 65],
      [180, 45, 110],
      [235, 145, 70],
      [130, 30, 75],
      [190, 60, 90],
    ],
  },
  // 3: 苍翠玉石 (Emerald Pine)
  {
    bgStart: [7, 20, 14],
    bgMid: [4, 11, 8],
    bgEnd: [1, 3, 2],
    blobs: [
      [30, 150, 100],
      [20, 110, 140],
      [50, 190, 130],
      [15, 80, 60],
      [25, 130, 110],
    ],
  },
  // 4: 极简黑曜 (Minimalist Noir)
  {
    bgStart: [16, 16, 20],
    bgMid: [8, 8, 10],
    bgEnd: [2, 2, 3],
    blobs: [
      [140, 140, 170],
      [90, 90, 120],
      [160, 160, 190],
      [70, 70, 100],
      [110, 110, 140],
    ],
  },
];

// =========================================================================
// 3. 封面色盘智能采样与亮度/饱和度钳制提取器
// =========================================================================

const paletteCache = new Map<string, DynamicPalette>();

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * 提取并钳制封面高阶柔光调色盘（饱和度 45%~75%，亮度 25%~45%）
 */
function extractCoverPalette(imgElement: HTMLImageElement): DynamicPalette {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return DEFAULT_AURORA_PALETTE;

    ctx.drawImage(imgElement, 0, 0, 32, 32);
    const imgData = ctx.getImageData(0, 0, 32, 32).data;

    // 采样多点色彩
    const sampleIndices = [
      (8 * 32 + 8) * 4,
      (8 * 32 + 24) * 4,
      (16 * 32 + 16) * 4,
      (24 * 32 + 8) * 4,
      (24 * 32 + 24) * 4,
    ];

    const extractedBlobs: [number, number, number][] = sampleIndices.map((idx, i) => {
      const rawR = imgData[idx] ?? 60;
      const rawG = imgData[idx + 1] ?? 100;
      const rawB = imgData[idx + 2] ?? 180;

      const [h, s, l] = rgbToHsl(rawR, rawG, rawB);
      // 钳制饱和度与亮度
      const clampedS = clamp(s, 0.45, 0.85);
      const clampedL = clamp(l, 0.28, 0.48);
      // 微调色相分布
      const shiftedH = (h + i * 0.08) % 1.0;

      return hslToRgb(shiftedH, clampedS, clampedL);
    });

    const primaryHsl = rgbToHsl(extractedBlobs[0][0], extractedBlobs[0][1], extractedBlobs[0][2]);
    const bgStart = hslToRgb(primaryHsl[0], 0.4, 0.09);
    const bgMid = hslToRgb(primaryHsl[0], 0.35, 0.04);
    const bgEnd = hslToRgb(primaryHsl[0], 0.3, 0.015);

    return {
      bgStart,
      bgMid,
      bgEnd,
      blobs: extractedBlobs,
    };
  } catch {
    return DEFAULT_AURORA_PALETTE;
  }
}

function loadAndCacheCoverPalette(url: string, onDone: (p: DynamicPalette) => void) {
  if (!url) {
    onDone(DEFAULT_AURORA_PALETTE);
    return;
  }
  if (paletteCache.has(url)) {
    onDone(paletteCache.get(url)!);
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const palette = extractCoverPalette(img);
    paletteCache.set(url, palette);
    onDone(palette);
  };
  img.onerror = () => {
    onDone(DEFAULT_AURORA_PALETTE);
  };
  img.src = url;
}

// =========================================================================
// 4. LRC 歌词高精度语义解析与时延插值
// =========================================================================

function isMetadataLine(line: string): boolean {
  const metaRegex =
    /^(作词|作曲|制作人|编曲|混音|母带|录音|吉他|贝斯|鼓|键盘|和声|策划|出品|监制|发行|演唱|原唱|词|曲)\s*[:：]/i;
  return metaRegex.test(line);
}

export function parseLrc(lrcText: string): ParsedLrcLine[] {
  if (!lrcText) return [];
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

/**
 * 智能语义字符插值（标点符号微停顿）
 */
function calculateSmartProgress(
  elapsed: number,
  duration: number,
  text: string
): number {
  if (duration <= 0 || elapsed <= 0) return 0;
  if (elapsed >= duration) return 1.0;

  const linearP = elapsed / duration;
  // 中文标点字符识别，赋予轻微停顿权重
  const hasPunctuation = /[，。！？、,!?]/.test(text);
  if (hasPunctuation) {
    // 缓动平滑
    return linearP < 0.5 ? 2 * linearP * linearP : 1 - Math.pow(-2 * linearP + 2, 2) / 2;
  }
  return linearP;
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
      data[i + 3] = Math.floor(Math.random() * 18);
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

// =========================================================================
// 5. Apple 风格单行巨幕液态水银扫光绘制器
// =========================================================================

function renderLiquidShimmerLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  totalWidth: number,
  centerX: number,
  centerY: number,
  progress: number,
  lineAlpha: number,
  featherWidth: number,
  fitScale: number
) {
  if (!text || totalWidth <= 0 || lineAlpha <= 0.001) return;

  const actualWidth = totalWidth * fitScale;
  const startX = centerX - actualWidth / 2;
  const endX = centerX + actualWidth / 2;

  ctx.save();
  ctx.globalAlpha = lineAlpha;

  // 1. 底层：未唱文字（28% 锐利高对比度银白）
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.shadowBlur = 0;
  ctx.fillText(text, centerX, centerY);
  ctx.restore();

  // 2. 顶层：月光液态流光扫描层（带羽化的水银光带）
  if (progress > 0.001) {
    const sweepX = startX + actualWidth * Math.min(1.0, Math.max(0.0, progress));
    const feather = Math.max(25, featherWidth * fitScale);

    const gradStartX = Math.max(startX - 10, sweepX - feather * 1.8);
    const gradEndX = Math.min(endX + 10, sweepX + feather * 0.8);

    if (gradEndX > gradStartX) {
      const sweepGrad = ctx.createLinearGradient(gradStartX, centerY, gradEndX, centerY);
      sweepGrad.addColorStop(0, "#ffffff");
      sweepGrad.addColorStop(0.65, "rgba(255, 255, 255, 0.95)");
      sweepGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.save();
      // 限制在已唱区域
      ctx.beginPath();
      ctx.rect(startX - 20, centerY - 100, sweepX - startX + 20, 200);
      ctx.clip();

      ctx.fillStyle = sweepGrad;
      ctx.shadowColor = "rgba(255, 255, 255, 0.35)";
      ctx.shadowBlur = 12;
      ctx.fillText(text, centerX, centerY);
      ctx.restore();
    }
  }

  ctx.restore();
}

// =========================================================================
// 6. 核心 EffectPlugin 实现
// =========================================================================

export const CinematicLyricDriftV8Effect: EffectPlugin = {
  id: "cinematic-lyric-drift-v8",
  name: "弧光伴字",
  category: "space",
  description: "Apple Music 4K 液态流光视差引擎：封面自适应色彩网格、纯重低音呼吸、月光水银巨幕扫光与 8px 物理弹簧微滑",
  preferredEngine: "canvas",

  parameters: [
    {
      id: "colorScheme",
      name: "流体色盘模式",
      type: "number",
      mode: "basic",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
    },
    {
      id: "bassPulse",
      name: "重低音呼吸律动",
      type: "number",
      mode: "basic",
      min: 0,
      max: 2,
      step: 0.05,
      default: 1.0,
    },
    {
      id: "fluidSpeed",
      name: "液态流动速度",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 2.0,
      step: 0.05,
      default: 0.8,
    },
    {
      id: "ambientBrightness",
      name: "流体光晕亮度",
      type: "number",
      mode: "basic",
      min: 0.5,
      max: 1.8,
      step: 0.05,
      default: 1.1,
    },
    {
      id: "shimmerFeather",
      name: "水银扫光羽化",
      type: "number",
      mode: "professional",
      min: 20,
      max: 90,
      step: 2,
      default: 45,
    },
    {
      id: "filmGrain",
      name: "4K 胶片微噪点",
      type: "number",
      mode: "professional",
      min: 0,
      max: 0.3,
      step: 0.01,
      default: 0.08,
    },
    {
      id: "heroFontSize",
      name: "巨幕歌词基准字号",
      type: "number",
      mode: "professional",
      min: 36,
      max: 72,
      step: 2,
      default: 56,
    },
  ],

  init(ctx: RenderContext) {
    const width = ctx.width || 1920;
    const height = ctx.height || 1080;
    const maxDim = Math.max(width, height);

    // 5 颗大半径高透流体晶球（Apple Music 4K 弥散流体网格）
    const fluidBlobs: FluidColorBlob[] = [
      {
        x: width * 0.2,
        y: height * 0.3,
        baseRadius: maxDim * 0.65,
        currentRadius: maxDim * 0.65,
        vx: 0.12,
        vy: 0.09,
        r: 28,
        g: 85,
        b: 180,
        targetR: 28,
        targetG: 85,
        targetB: 180,
        alpha: 0.68,
        phase: 0,
        speed: 0.6,
      },
      {
        x: width * 0.8,
        y: height * 0.35,
        baseRadius: maxDim * 0.72,
        currentRadius: maxDim * 0.72,
        vx: -0.1,
        vy: 0.08,
        r: 130,
        g: 45,
        b: 185,
        targetR: 130,
        targetG: 45,
        targetB: 185,
        alpha: 0.62,
        phase: Math.PI * 0.5,
        speed: 0.55,
      },
      {
        x: width * 0.3,
        y: height * 0.75,
        baseRadius: maxDim * 0.68,
        currentRadius: maxDim * 0.68,
        vx: 0.09,
        vy: -0.11,
        r: 20,
        g: 170,
        b: 200,
        targetR: 20,
        targetG: 170,
        targetB: 200,
        alpha: 0.65,
        phase: Math.PI,
        speed: 0.65,
      },
      {
        x: width * 0.75,
        y: height * 0.8,
        baseRadius: maxDim * 0.62,
        currentRadius: maxDim * 0.62,
        vx: -0.11,
        vy: -0.09,
        r: 190,
        g: 55,
        b: 120,
        targetR: 190,
        targetG: 55,
        targetB: 120,
        alpha: 0.58,
        phase: Math.PI * 1.5,
        speed: 0.5,
      },
      {
        x: width * 0.5,
        y: height * 0.5,
        baseRadius: maxDim * 0.8,
        currentRadius: maxDim * 0.8,
        vx: 0.05,
        vy: 0.06,
        r: 45,
        g: 30,
        b: 100,
        targetR: 45,
        targetG: 30,
        targetB: 100,
        alpha: 0.52,
        phase: Math.PI * 0.75,
        speed: 0.45,
      },
    ];

    const state: CinematicLyricDriftState = {
      fluidBlobs,
      parsedLyrics: [],
      lastRawLyrics: "",
      lastSongId: "",
      lastCoverUrl: "",
      currentPalette: DEFAULT_AURORA_PALETTE,
      targetPalette: DEFAULT_AURORA_PALETTE,
      paletteMorphT: 1.0,
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
      idleBadgeAlpha: 1.0,
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
    // 1. 参数解构
    // -------------------------------------------------------------
    const schemeIndex = Math.max(0, Math.min(4, Math.round(params.colorScheme ?? 0)));
    const bassPulse = params.bassPulse ?? 1.0;
    const fluidSpeed = params.fluidSpeed ?? 0.8;
    const ambientBrightness = params.ambientBrightness ?? 1.1;
    const shimmerFeather = params.shimmerFeather ?? 45;
    const filmGrain = params.filmGrain ?? 0.08;
    const heroFontSize = Math.round(params.heroFontSize ?? 56);

    // -------------------------------------------------------------
    // 2. 封面色谱自适应与平滑 600ms 演化
    // -------------------------------------------------------------
    const audioState = useAudioStore.getState();
    const playerState = usePlayerStore.getState();
    const currentSong = audioState.currentSong || playerState.currentSong;
    const songCover = currentSong?.cover || "";

    if (schemeIndex === 0) {
      if (songCover !== state.lastCoverUrl) {
        state.lastCoverUrl = songCover;
        loadAndCacheCoverPalette(songCover, (newPalette) => {
          state.targetPalette = newPalette;
          state.paletteMorphT = 0;
        });
      }
    } else {
      state.targetPalette = PRESET_PALETTES[schemeIndex];
    }

    if (state.paletteMorphT < 1.0) {
      state.paletteMorphT = Math.min(1.0, state.paletteMorphT + deltaTime * 1.6); // 约 600ms 完成平滑过渡
      const t = state.paletteMorphT;
      const lerp = (a: number, b: number) => a + (b - a) * t;

      for (let i = 0; i < state.fluidBlobs.length; i++) {
        const blob = state.fluidBlobs[i];
        const targetColor = state.targetPalette.blobs[i % state.targetPalette.blobs.length];
        blob.r = lerp(blob.r, targetColor[0]);
        blob.g = lerp(blob.g, targetColor[1]);
        blob.b = lerp(blob.b, targetColor[2]);
      }
    }

    // -------------------------------------------------------------
    // 3. 纯重低音呼吸动力学 (Bass-Only Breathing 20-150Hz)
    // -------------------------------------------------------------
    let rawBass = audioData.bass || 0;
    if (audioData.frequencyData && audioData.frequencyData.length >= 16) {
      const fd = audioData.frequencyData;
      let bSum = 0;
      for (let i = 0; i < 8; i++) bSum += fd[i];
      rawBass = Math.max(rawBass, bSum / (8 * 255));
    }

    const smoothFactor = 0.08;
    state.smoothedBass += (rawBass - state.smoothedBass) * smoothFactor;
    state.timeAccumulator += deltaTime;
    state.breathPhase = (state.breathPhase + deltaTime * 0.4) % (Math.PI * 2);

    // -------------------------------------------------------------
    // 4. LRC 歌词精准时间轴与状态定位
    // -------------------------------------------------------------
    const reportedTime = audioState.currentTime || playerState.currentTime || 0;
    const isPlaying = audioState.isPlaying || playerState.isPlaying;
    const rawLyrics = currentSong?.lyrics || "";

    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (Math.abs(reportedTime - state.lastReportedTime) > 0.03) {
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
        const estimatedDuration = Math.min(lineDuration, Math.max(2.0, curr.text.length * 0.32));

        if (elapsed >= 0 && elapsed <= estimatedDuration + 0.6) {
          isSinging = true;
          activeLine = curr.text;
          targetProgress = calculateSmartProgress(elapsed, estimatedDuration, curr.text);
        }
      }
    }

    // 换行与度量
    const fontFamily = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;

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
        c2d.font = `600 ${heroFontSize}px ${fontFamily}`;
        state.totalLineWidth = c2d.measureText(activeLine).width;
        c2d.restore();
      } else {
        state.totalLineWidth = 0;
      }
    }

    state.isSinging = isSinging;
    state.smoothedLineProgress += (targetProgress - state.smoothedLineProgress) * 0.32;

    const targetCurrentAlpha = isSinging ? 1.0 : 0.0;
    state.lineTransitionAlpha += (targetCurrentAlpha - state.lineTransitionAlpha) * 0.12;
    state.prevLineFadeAlpha += (0.0 - state.prevLineFadeAlpha) * 0.15;

    // 空闲徽章透明度
    const targetIdleAlpha = isSinging ? 0.0 : 1.0;
    state.idleBadgeAlpha += (targetIdleAlpha - state.idleBadgeAlpha) * 0.08;

    // -------------------------------------------------------------
    // 5. 渲染底层：Apple Music 4K 液态流光弥散网格
    // -------------------------------------------------------------

    // A. 深度黑夜底色
    const bgStartRgb = state.targetPalette.bgStart;
    const bgMidRgb = state.targetPalette.bgMid;
    const bgEndRgb = state.targetPalette.bgEnd;

    const bgGrad = c2d.createRadialGradient(
      width * 0.5,
      height * 0.45,
      20,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.9
    );
    bgGrad.addColorStop(0, `rgb(${bgStartRgb[0]}, ${bgStartRgb[1]}, ${bgStartRgb[2]})`);
    bgGrad.addColorStop(0.55, `rgb(${bgMidRgb[0]}, ${bgMidRgb[1]}, ${bgMidRgb[2]})`);
    bgGrad.addColorStop(1, `rgb(${bgEndRgb[0]}, ${bgEndRgb[1]}, ${bgEndRgb[2]})`);
    c2d.fillStyle = bgGrad;
    c2d.fillRect(0, 0, width, height);

    // B. Apple 风格液态柔光晶球融合
    c2d.save();
    c2d.globalCompositeOperation = "screen";

    for (let i = 0; i < state.fluidBlobs.length; i++) {
      const blob = state.fluidBlobs[i];

      // 简谐柔和游弋
      blob.x +=
        blob.vx * fluidSpeed * 1.2 +
        Math.sin(state.timeAccumulator * 0.2 * blob.speed + blob.phase) * 0.8;
      blob.y +=
        blob.vy * fluidSpeed * 1.2 +
        Math.cos(state.timeAccumulator * 0.18 * blob.speed + blob.phase) * 0.8;

      // 屏幕边缘弹性回弹
      const margin = blob.baseRadius * 0.5;
      if (blob.x < -margin) blob.vx = Math.abs(blob.vx);
      if (blob.x > width + margin) blob.vx = -Math.abs(blob.vx);
      if (blob.y < -margin) blob.vy = Math.abs(blob.vy);
      if (blob.y > height + margin) blob.vy = -Math.abs(blob.vy);

      // 纯重低音呼吸脉冲
      const bassExpand = 1.0 + state.smoothedBass * 0.22 * bassPulse;
      const curRadius = blob.baseRadius * bassExpand;
      const alpha =
        blob.alpha * ambientBrightness * (0.85 + state.smoothedBass * 0.25 * bassPulse);

      const r = Math.round(blob.r);
      const g = Math.round(blob.g);
      const b = Math.round(blob.b);

      const blobGrad = c2d.createRadialGradient(
        blob.x,
        blob.y,
        0,
        blob.x,
        blob.y,
        curRadius
      );
      blobGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`);
      blobGrad.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.45).toFixed(3)})`);
      blobGrad.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, ${(alpha * 0.1).toFixed(3)})`);
      blobGrad.addColorStop(1, "rgba(0,0,0,0)");

      c2d.fillStyle = blobGrad;
      c2d.beginPath();
      c2d.arc(blob.x, blob.y, curRadius, 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.restore();

    // C. 4K 防色阶胶片微噪点叠加
    if (state.grainCanvas && filmGrain > 0.005) {
      c2d.save();
      c2d.globalAlpha = filmGrain;
      c2d.globalCompositeOperation = "overlay";
      const grainPattern = c2d.createPattern(state.grainCanvas, "repeat");
      if (grainPattern) {
        c2d.fillStyle = grainPattern;
        c2d.fillRect(0, 0, width, height);
      }
      c2d.restore();
    }

    // -------------------------------------------------------------
    // 6. 歌词渲染：单行巨幕 + 8px 物理弹簧微滑 + 水银扫光
    // -------------------------------------------------------------
    const heroX = width * 0.5;
    const heroY = height * 0.51;

    // 自适应字号计算（保证长句不溢出屏幕）
    const maxSafeWidth = width * 0.84;
    let fitScale = 1.0;
    if (state.totalLineWidth > maxSafeWidth && maxSafeWidth > 100) {
      fitScale = maxSafeWidth / state.totalLineWidth;
    }
    const currentActualFontSize = Math.max(34, Math.round(heroFontSize * fitScale));

    c2d.textAlign = "center";
    c2d.textBaseline = "middle";
    c2d.letterSpacing = "-0.02em";

    // 1. 上一句歌词淡出与上浮 8px (Spring Float Out)
    if (state.prevLineFadeAlpha > 0.01 && state.previousLineText) {
      const prevScale = Math.min(1.0, maxSafeWidth / (state.prevLineWidth || 1));
      const prevFontSize = Math.max(34, Math.round(heroFontSize * prevScale));
      const prevY = heroY - (1.0 - state.prevLineFadeAlpha) * 8;

      c2d.save();
      c2d.font = `600 ${prevFontSize}px ${fontFamily}`;
      renderLiquidShimmerLine(
        c2d,
        state.previousLineText,
        state.prevLineWidth,
        heroX,
        prevY,
        1.0,
        state.prevLineFadeAlpha,
        shimmerFeather,
        prevScale
      );
      c2d.restore();
    }

    // 2. 当前正在唱的歌词（从下方 +8px 上浮入场并水银扫光）
    if (state.lineTransitionAlpha > 0.01 && state.currentLineText) {
      const curY = heroY + (1.0 - state.lineTransitionAlpha) * 8;

      c2d.save();
      c2d.font = `600 ${currentActualFontSize}px ${fontFamily}`;
      renderLiquidShimmerLine(
        c2d,
        state.currentLineText,
        state.totalLineWidth,
        heroX,
        curY,
        state.smoothedLineProgress,
        state.lineTransitionAlpha,
        shimmerFeather,
        fitScale
      );
      c2d.restore();
    }

    // 3. 空闲/间奏/纯音乐优雅微标 (Idle Track Badge)
    if (state.idleBadgeAlpha > 0.01) {
      const trackTitle = currentSong?.title || "MIMI Music Player";
      const trackArtist = currentSong?.artist || "享受纯净音律";

      c2d.save();
      c2d.globalAlpha = state.idleBadgeAlpha * 0.85;

      // 标题
      c2d.font = `600 ${Math.min(42, heroFontSize * 0.75)}px ${fontFamily}`;
      c2d.fillStyle = "rgba(255, 255, 255, 0.95)";
      c2d.shadowColor = "rgba(255, 255, 255, 0.3)";
      c2d.shadowBlur = 16;
      c2d.fillText(trackTitle, heroX, heroY - 16);

      // 歌手与脉冲微光点
      c2d.font = `400 16px ${fontFamily}`;
      c2d.fillStyle = "rgba(255, 255, 255, 0.55)";
      c2d.shadowBlur = 0;
      c2d.fillText(trackArtist, heroX, heroY + 24);

      // 律动呼吸点
      const dotPulse = 1.0 + state.smoothedBass * 0.6 * bassPulse;
      c2d.fillStyle = "rgba(255, 255, 255, 0.75)";
      c2d.beginPath();
      c2d.arc(heroX, heroY + 54, 2.5 * dotPulse, 0, Math.PI * 2);
      c2d.fill();

      c2d.restore();
    }
  },

  resize(width: number, height: number) {
    // Canvas dimensions updated automatically
  },

  destroy(ctx?: RenderContext) {
    if (ctx && ctx.private) {
      ctx.private = undefined;
    }
  },
};
