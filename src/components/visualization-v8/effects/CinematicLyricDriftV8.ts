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
// 1. Types & Data Structures
// =========================================================================

export interface AmbientFloatingDust {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  phase: number;
  freq: number;
}

export interface SoftAtmosphereOrb {
  x: number;
  y: number;
  baseRadius: number;
  currentRadius: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  phase: number;
  speed: number;
}

export interface WordSegment {
  text: string;
  width: number;
  startRatio: number;
  endRatio: number;
  // 3D 景深与弹簧物理状态
  popTriggerTime: number; // 唱到的触发时刻（未唱时为 -1）
  currentScale: number;
  currentAlpha: number;
  currentY: number;
  depthZ: number; // 空间深度（越大越靠前）
  blurPx: number; // 光学景深模糊度 (px)
  phaseOffset: number;
}

export interface ParsedLrcLine {
  time: number;
  text: string;
}

export interface CinematicLyricDriftState {
  atmosphereOrbs: SoftAtmosphereOrb[];
  ambientDust: AmbientFloatingDust[];
  parsedLyrics: ParsedLrcLine[];
  lastRawLyrics: string;

  // 高精度音频时钟插值
  lastReportedTime: number;
  lastTimeUpdateMs: number;

  // 词组级 3D 景深动力学状态
  currentLineText: string;
  previousLineText: string;
  currentSegments: WordSegment[];
  previousSegments: WordSegment[];
  totalLineWidth: number;
  prevLineWidth: number;

  // 进度与过渡
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
// 2. High-End Ink Wash Palettes & Typographic Themes
// =========================================================================

export interface ColorPalette {
  name: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  ambientAura: string;
  textUnsung: string;
  textPast: string;
  textFocus: string;
  dustColor: string;
  orbColor: string;
}

const COLOR_PALETTES: ColorPalette[] = [
  // 0: 洒金玄墨 (Classic Gold Leaf Noir - 纯净白金与黑曜)
  {
    name: "洒金玄墨",
    bgGradStart: "#140c06",
    bgGradMid: "#090502",
    bgGradEnd: "#020101",
    ambientAura: "rgba(255, 175, 95, 0.1)",
    textUnsung: "rgba(255, 245, 230, 0.18)",
    textPast: "rgba(235, 220, 195, 0.38)",
    textFocus: "#ffffff",
    dustColor: "rgba(255, 220, 160, 0.4)",
    orbColor: "rgba(245, 160, 80, 0.05)",
  },
  // 1: 青黛冷月 (Indigo Moonlit Mist - 冷月霜华)
  {
    name: "青黛冷月",
    bgGradStart: "#09101c",
    bgGradMid: "#040810",
    bgGradEnd: "#010204",
    ambientAura: "rgba(140, 195, 255, 0.09)",
    textUnsung: "rgba(215, 235, 255, 0.18)",
    textPast: "rgba(190, 220, 250, 0.38)",
    textFocus: "#ffffff",
    dustColor: "rgba(200, 230, 255, 0.4)",
    orbColor: "rgba(120, 185, 250, 0.05)",
  },
  // 2: 暮染丹青 (Cinnabar Twilight - 晚霞温玉)
  {
    name: "暮染丹青",
    bgGradStart: "#160812",
    bgGradMid: "#0a0308",
    bgGradEnd: "#020102",
    ambientAura: "rgba(240, 140, 185, 0.1)",
    textUnsung: "rgba(255, 225, 235, 0.18)",
    textPast: "rgba(245, 205, 220, 0.38)",
    textFocus: "#ffffff",
    dustColor: "rgba(255, 205, 225, 0.4)",
    orbColor: "rgba(230, 120, 175, 0.05)",
  },
  // 3: 苍山松烟 (Pine Smoke Jade - 空山新雨)
  {
    name: "苍山松烟",
    bgGradStart: "#07150e",
    bgGradMid: "#030a07",
    bgGradEnd: "#010302",
    ambientAura: "rgba(120, 215, 165, 0.09)",
    textUnsung: "rgba(220, 255, 235, 0.18)",
    textPast: "rgba(195, 240, 215, 0.38)",
    textFocus: "#ffffff",
    dustColor: "rgba(185, 245, 215, 0.4)",
    orbColor: "rgba(100, 200, 150, 0.05)",
  },
  // 4: 极简焦墨 (Timeless Monochrome - 纯粹黑白)
  {
    name: "极简焦墨",
    bgGradStart: "#111113",
    bgGradMid: "#060607",
    bgGradEnd: "#010101",
    ambientAura: "rgba(220, 220, 230, 0.07)",
    textUnsung: "rgba(255, 255, 255, 0.15)",
    textPast: "rgba(215, 215, 220, 0.35)",
    textFocus: "#ffffff",
    dustColor: "rgba(235, 235, 245, 0.35)",
    orbColor: "rgba(190, 190, 205, 0.04)",
  },
];

const FONT_STYLES = [
  // 0: 洒脱行楷
  `"STXingkai", "华文行楷", "Xingkai SC", "Ma Shan Zheng", "STKaiti", "楷体", "Snell Roundhand", "Brush Script MT", "Georgia", serif`,
  // 1: 清雅文楷
  `"STKaiti", "Kaiti SC", "楷体", "楷体_GB2312", "LXGW WenKai", "Baskerville", "Georgia", serif`,
  // 2: 金石古韵
  `"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "Palatino", "Georgia", serif`,
  // 3: 苍劲狂草
  `"Long Cang", "Liu Jian Mao Cao", "STXingkai", "华文行楷", "STKaiti", "Brush Script MT", serif`,
];

// =========================================================================
// 3. Helpers: Word Segmenter & Spring Math
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

function segmentText(text: string): string[] {
  const t = text.trim();
  if (!t) return [];

  const hasSpaces = /\s+/.test(t);
  const isPureLatin = /^[A-Za-z0-9\s'’.,!?-]+$/.test(t);

  if (hasSpaces || isPureLatin) {
    const rawTokens = t.split(/(\s+)/);
    const result: string[] = [];
    for (const r of rawTokens) {
      if (r) result.push(r);
    }
    return result;
  }

  const result: string[] = [];
  const chars = Array.from(t);
  let buffer = "";

  for (let i = 0; i < chars.length; i++) {
    buffer += chars[i];
    if (/[，。！？、…；：]/.test(chars[i])) {
      result.push(buffer);
      buffer = "";
    } else if (buffer.length >= 2 && i < chars.length - 1) {
      if (chars.length - i - 1 === 1) {
        // 合并
      } else {
        result.push(buffer);
        buffer = "";
      }
    }
  }
  if (buffer) {
    result.push(buffer);
  }

  return result.length > 0 ? result : [t];
}

function buildSegmentedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  fontSize: number
): { segments: WordSegment[]; totalWidth: number } {
  ctx.save();
  ctx.font = `500 ${fontSize}px ${fontFamily}`;

  const tokenTexts = segmentText(text);
  const segments: WordSegment[] = [];
  let currentOffset = 0;

  for (let i = 0; i < tokenTexts.length; i++) {
    const rawToken = tokenTexts[i];
    const w = ctx.measureText(rawToken).width;
    segments.push({
      text: rawToken,
      width: w,
      startRatio: 0,
      endRatio: 0,
      popTriggerTime: -1,
      currentScale: 0.65,
      currentAlpha: 0,
      currentY: 30,
      depthZ: 0,
      blurPx: 4,
      phaseOffset: i * 0.45,
    });
    currentOffset += w;
  }

  const totalWidth = Math.max(10, currentOffset);

  let accumulatedW = 0;
  for (const seg of segments) {
    seg.startRatio = accumulatedW / totalWidth;
    accumulatedW += seg.width;
    seg.endRatio = accumulatedW / totalWidth;
  }

  ctx.restore();
  return { segments, totalWidth };
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

function springEaseOut(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
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

/**
 * 真实光学景深虚化与大字号动力学绘制器 (True Optical Depth Blur & Large Typography)
 */
function render3DDepthSegments(
  ctx: CanvasRenderingContext2D,
  segments: WordSegment[],
  totalWidth: number,
  centerX: number,
  centerY: number,
  currentLineProgress: number,
  lineAlpha: number,
  palette: ColorPalette,
  time: number,
  isExiting: boolean,
  fitScale: number
) {
  if (!segments || segments.length === 0 || lineAlpha <= 0.001) return;

  const startX = centerX - (totalWidth * fitScale) / 2;

  // 1. 构建渲染项 (Back-to-Front 排序)
  const renderItems: Array<{
    seg: WordSegment;
    drawX: number;
    drawY: number;
    scale: number;
    alpha: number;
    blurPx: number;
    rot: number;
    depthZ: number;
    isActive: boolean;
    isPast: boolean;
  }> = [];

  let runningX = startX;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    const isPast = currentLineProgress >= seg.endRatio;
    const isActive = currentLineProgress >= seg.startRatio && currentLineProgress < seg.endRatio;

    const organicFloatY = Math.sin(time * 1.6 + seg.phaseOffset) * 2.5;
    const organicRot = Math.sin(time * 1.0 + seg.phaseOffset * 0.8) * 0.012;

    const currentScale = (isExiting ? seg.currentScale * lineAlpha : seg.currentScale) * fitScale;
    const currentAlpha = seg.currentAlpha * lineAlpha;
    const drawX = runningX + seg.width * fitScale * 0.5;
    const drawY =
      centerY + (isExiting ? -24 * (1 - lineAlpha) : seg.currentY * fitScale) + organicFloatY;

    if (currentAlpha > 0.001) {
      renderItems.push({
        seg,
        drawX,
        drawY,
        scale: currentScale,
        alpha: currentAlpha,
        blurPx: isExiting ? seg.blurPx + 2 : seg.blurPx,
        rot: organicRot,
        depthZ: seg.depthZ,
        isActive,
        isPast,
      });
    }

    runningX += seg.width * fitScale;
  }

  // 2. 从深到浅排序 (Back-to-Front: 虚化后景先画，锐利前景大字最后画)
  renderItems.sort((a, b) => a.depthZ - b.depthZ);

  // 3. 真实光学景深虚化与纯净大字绘制
  ctx.save();
  ctx.shadowBlur = 0; // 彻底去除发光

  const hasFilterSupport = typeof ctx.filter === "string";

  for (const item of renderItems) {
    ctx.save();
    ctx.translate(item.drawX, item.drawY);
    ctx.scale(item.scale, item.scale);
    ctx.rotate(item.rot);
    ctx.globalAlpha = item.alpha;

    // 应用真实 Canvas 光学景深模糊滤镜
    if (hasFilterSupport) {
      if (item.isActive || item.blurPx < 0.3) {
        ctx.filter = "none";
      } else {
        ctx.filter = `blur(${item.blurPx.toFixed(1)}px)`;
      }
    }

    if (item.isActive) {
      // A. 当前焦点词：100% 锐利无虚化、纯白金大字特写
      ctx.fillStyle = palette.textFocus;
      ctx.fillText(item.seg.text, 0, 0);
    } else if (item.isPast) {
      // B. 先弹出的已唱词：退入后景深处、大光圈虚化散景
      ctx.fillStyle = palette.textPast;
      ctx.fillText(item.seg.text, 0, 0);
    } else {
      // C. 未唱词：远景微虚化轮廓
      ctx.fillStyle = palette.textUnsung;
      ctx.fillText(item.seg.text, 0, 0);
    }

    ctx.restore();
  }

  ctx.restore();
}

// =========================================================================
// 4. Parameter Definitions
// =========================================================================

const PARAMETERS: EffectParameterDefinition[] = [
  {
    id: "fontStyle",
    name: "书法字体风格",
    type: "select",
    mode: "basic",
    default: 0,
    options: [
      { label: "洒脱行楷 (Spirited Xingkai)", value: 0 },
      { label: "清雅文楷 (Refined Kaiti)", value: 1 },
      { label: "金石古韵 (Ancient Songti)", value: 2 },
      { label: "苍劲狂草 (Wild Brush)", value: 3 },
    ],
  },
  {
    id: "colorScheme",
    name: "水墨调色板",
    type: "select",
    mode: "basic",
    default: 0,
    options: [
      { label: "洒金玄墨 (Gold Splatter Noir)", value: 0 },
      { label: "青黛冷月 (Indigo Moonlit Mist)", value: 1 },
      { label: "暮染丹青 (Cinnabar Twilight)", value: 2 },
      { label: "苍山松烟 (Pine Smoke Jade)", value: 3 },
      { label: "极简焦墨 (Timeless Monochrome)", value: 4 },
    ],
  },
  {
    id: "heroFontSize",
    name: "电影大字号",
    type: "number",
    mode: "basic",
    min: 36,
    max: 84,
    step: 2,
    default: 60,
  },
  {
    id: "focusScale",
    name: "焦点放大倍率",
    type: "number",
    mode: "professional",
    min: 1.2,
    max: 1.8,
    step: 0.05,
    default: 1.5,
  },
  {
    id: "depthBlurStrength",
    name: "光学景深虚化",
    type: "number",
    mode: "professional",
    min: 0.0,
    max: 2.0,
    step: 0.1,
    default: 1.0,
  },
  {
    id: "filmGrain",
    name: "宣纸肌理微粒",
    type: "number",
    mode: "professional",
    min: 0,
    max: 1.0,
    step: 0.05,
    default: 0.2,
  },
  {
    id: "breathingDepth",
    name: "墨韵呼吸起伏",
    type: "number",
    mode: "professional",
    min: 0,
    max: 2.0,
    step: 0.1,
    default: 1.0,
  },
  {
    id: "vignetteStrength",
    name: "幽深画境暗角",
    type: "number",
    mode: "expert",
    min: 0,
    max: 1.0,
    step: 0.05,
    default: 0.72,
  },
];

// =========================================================================
// 5. Plugin Implementation
// =========================================================================

export const CinematicLyricDriftV8Effect: EffectPlugin = {
  id: "cinematic-lyric-drift-v8",
  name: "温光浮字 · 电影感",
  category: "particles",
  description: "电影级大字号排版、真实Canvas光学景深虚化、播放触发即时破空弹出、前锐后虚时空层叠",
  preferredEngine: "canvas",
  parameters: PARAMETERS,

  init(ctx: RenderContext) {
    const width = ctx.width || 1280;
    const height = ctx.height || 720;

    const atmosphereOrbs: SoftAtmosphereOrb[] = [];
    const orbCount = 10;
    for (let i = 0; i < orbCount; i++) {
      const baseRadius = 45 + Math.random() * 75;
      atmosphereOrbs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseRadius,
        currentRadius: baseRadius,
        vx: (Math.random() - 0.5) * 0.07,
        vy: -0.03 - Math.random() * 0.07,
        baseAlpha: 0.03 + Math.random() * 0.06,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.35,
      });
    }

    const ambientDust: AmbientFloatingDust[] = [];
    const dustCount = 70;
    for (let i = 0; i < dustCount; i++) {
      ambientDust.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 0.6 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.04 - Math.random() * 0.1,
        baseAlpha: 0.12 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        freq: 0.4 + Math.random() * 1.0,
      });
    }

    const state: CinematicLyricDriftState = {
      atmosphereOrbs,
      ambientDust,
      parsedLyrics: [],
      lastRawLyrics: "",
      lastReportedTime: 0,
      lastTimeUpdateMs: typeof performance !== "undefined" ? performance.now() : Date.now(),
      currentLineText: "",
      previousLineText: "",
      currentSegments: [],
      previousSegments: [],
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

    if (!ctx.private || !ctx.private.atmosphereOrbs) {
      CinematicLyricDriftV8Effect.init(ctx);
    }
    const state = ctx.private as CinematicLyricDriftState;

    // -------------------------------------------------------------
    // 1. 参数与书法字体选择
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

    const heroFontSize = Math.round(params.heroFontSize ?? 60);
    const focusScaleMultiplier = params.focusScale ?? 1.5;
    const depthBlurStrength = params.depthBlurStrength ?? 1.0;
    const filmGrain = params.filmGrain ?? 0.2;
    const breathingDepth = params.breathingDepth ?? 1.0;
    const vignetteStrength = params.vignetteStrength ?? 0.72;

    // -------------------------------------------------------------
    // 2. 音频平滑 & 背景柔和呼吸
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

    const smoothFactor = 0.05;
    state.smoothedBass += (rawBass - state.smoothedBass) * smoothFactor;
    state.smoothedMid += (rawMid - state.smoothedMid) * smoothFactor;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * smoothFactor;
    const totalEnergy =
      state.smoothedBass * 0.5 + state.smoothedMid * 0.3 + state.smoothedTreble * 0.2;
    state.smoothedEnergy += (totalEnergy - state.smoothedEnergy) * smoothFactor;

    state.timeAccumulator += deltaTime;
    state.breathPhase =
      (state.breathPhase + deltaTime * (0.35 + state.smoothedEnergy * 0.3) * breathingDepth) %
      (Math.PI * 2);
    const breathSin = Math.sin(state.breathPhase);
    const auraBreathFactor = 1.0 + breathSin * 0.05 * breathingDepth + state.smoothedBass * 0.08;

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
      state.currentSegments = [];
      state.previousSegments = [];
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
        const estimatedDuration = Math.min(lineDuration, Math.max(2.2, curr.text.length * 0.36));

        if (elapsed >= 0 && elapsed <= estimatedDuration + 0.8) {
          isSinging = true;
          activeLine = curr.text;
          targetProgress = Math.min(1.0, Math.max(0.0, elapsed / Math.max(1.0, estimatedDuration)));
        }
      }
    }

    // 歌词换行构建词组
    if (activeLine !== state.currentLineText) {
      if (state.currentLineText) {
        state.previousLineText = state.currentLineText;
        state.previousSegments = state.currentSegments;
        state.prevLineWidth = state.totalLineWidth;
        state.prevLineFadeAlpha = state.lineTransitionAlpha;
      }
      state.currentLineText = activeLine;
      state.lineTransitionAlpha = 0;
      state.smoothedLineProgress = targetProgress;

      if (activeLine) {
        const { segments, totalWidth } = buildSegmentedLine(
          c2d,
          activeLine,
          selectedFontFamily,
          heroFontSize
        );
        state.currentSegments = segments;
        state.totalLineWidth = totalWidth;
      } else {
        state.currentSegments = [];
        state.totalLineWidth = 0;
      }
    }

    state.isSinging = isSinging;
    state.smoothedLineProgress += (targetProgress - state.smoothedLineProgress) * 0.28;

    const targetCurrentAlpha = isSinging ? 1.0 : 0.0;
    state.lineTransitionAlpha += (targetCurrentAlpha - state.lineTransitionAlpha) * 0.09;
    state.prevLineFadeAlpha += (0.0 - state.prevLineFadeAlpha) * 0.1;

    // -------------------------------------------------------------
    // 4. 播放触发逐词破空弹出 & 3D 真实光学景深推移物理模拟
    // -------------------------------------------------------------
    if (state.currentSegments.length > 0) {
      const lineProg = state.smoothedLineProgress;

      for (let i = 0; i < state.currentSegments.length; i++) {
        const seg = state.currentSegments[i];

        // 1. 判断是否触发弹出 (Play-Triggered on Arrival)
        if (lineProg >= seg.startRatio && seg.popTriggerTime < 0) {
          seg.popTriggerTime = state.timeAccumulator;
        }

        if (seg.popTriggerTime < 0) {
          // A. 尚未唱到：隐匿在深景中，轻度虚化
          seg.currentScale = 0.65;
          seg.currentAlpha = 0.0;
          seg.currentY = 28;
          seg.depthZ = 0;
          seg.blurPx = 4.0 * depthBlurStrength;
        } else {
          // B. 已经触发弹出：计算入场弹簧动力学与向后景深推移
          const timeSincePop = Math.max(0, state.timeAccumulator - seg.popTriggerTime);
          const popDuration = 0.35;
          const popRatio = Math.min(1.0, timeSincePop / popDuration);
          const springFactor = springEaseOut(popRatio);

          if (lineProg < seg.endRatio) {
            // 正在唱 (Active Focus)：从前方最大特写弹性弹出，100% 锐利无虚化，Z 轴最高
            seg.currentScale = 0.65 + (focusScaleMultiplier - 0.65) * springFactor;
            seg.currentAlpha = Math.min(1.0, popRatio * 2.5);
            seg.currentY = 28 * (1 - popRatio);
            seg.depthZ = 100 + i; // 最前景
            seg.blurPx = 0.0; // 最佳焦平面，无虚化！
          } else {
            // 已唱过 (Past Depth Pushback)：随时间向深景退移、缩小、真实光学景深模糊散景
            const pastProg = Math.min(
              1.0,
              (lineProg - seg.endRatio) / Math.max(0.1, 1.0 - seg.endRatio)
            );

            const targetPastScale = 0.72;
            const targetPastAlpha = 0.35;
            const targetPastY = 12;

            seg.currentScale =
              focusScaleMultiplier - (focusScaleMultiplier - targetPastScale) * pastProg;
            seg.currentAlpha = 1.0 - (1.0 - targetPastAlpha) * pastProg;
            seg.currentY = targetPastY * pastProg;
            seg.depthZ = 10 + i; // 退回后景
            // 光学景深模糊度随深度加深
            seg.blurPx = (1.5 + pastProg * 4.5) * depthBlurStrength;
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 5. 绘制流水线 (Back-to-Front 3D 景深层次)
    // -------------------------------------------------------------

    // A. 宣纸水墨深邃底色
    const bgGrad = c2d.createRadialGradient(
      width * 0.5,
      height * 0.48,
      20,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.82
    );
    bgGrad.addColorStop(0, palette.bgGradStart);
    bgGrad.addColorStop(0.55, palette.bgGradMid);
    bgGrad.addColorStop(1, palette.bgGradEnd);
    c2d.fillStyle = bgGrad;
    c2d.fillRect(0, 0, width, height);

    // B. 中心极简温润水墨光场
    c2d.save();
    c2d.globalCompositeOperation = "screen";
    const auraRadius = width * 0.42 * auraBreathFactor;
    const auraAlpha = 0.05 + state.smoothedEnergy * 0.06;
    const auraGrad = c2d.createRadialGradient(
      width * 0.5,
      height * 0.52,
      0,
      width * 0.5,
      height * 0.52,
      auraRadius
    );
    auraGrad.addColorStop(0, palette.ambientAura.replace(/[\d.]+\)$/, `${auraAlpha})`));
    auraGrad.addColorStop(0.5, palette.ambientAura.replace(/[\d.]+\)$/, `${auraAlpha * 0.3})`));
    auraGrad.addColorStop(1, "rgba(0,0,0,0)");
    c2d.fillStyle = auraGrad;
    c2d.beginPath();
    c2d.arc(width * 0.5, height * 0.52, auraRadius, 0, Math.PI * 2);
    c2d.fill();
    c2d.restore();

    // C. 柔焦光团
    c2d.save();
    c2d.globalCompositeOperation = "screen";
    for (const orb of state.atmosphereOrbs) {
      orb.y += orb.vy;
      orb.x += orb.vx + Math.sin(state.timeAccumulator * 0.2 + orb.phase) * 0.08;

      if (orb.y < -orb.baseRadius * 2) {
        orb.y = height + orb.baseRadius * 2;
        orb.x = Math.random() * width;
      }

      const pulse = 1.0 + Math.sin(state.timeAccumulator * orb.speed + orb.phase) * 0.1;
      const curR = orb.baseRadius * pulse * auraBreathFactor;
      const alpha = orb.baseAlpha * (0.8 + state.smoothedBass * 0.4);

      const orbGrad = c2d.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, curR);
      orbGrad.addColorStop(0, palette.orbColor.replace(/[\d.]+\)$/, `${alpha * 0.9})`));
      orbGrad.addColorStop(0.4, palette.orbColor.replace(/[\d.]+\)$/, `${alpha * 0.35})`));
      orbGrad.addColorStop(1, "rgba(0,0,0,0)");

      c2d.fillStyle = orbGrad;
      c2d.beginPath();
      c2d.arc(orb.x, orb.y, curR, 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.restore();

    // D. 悬浮金粉微尘
    c2d.save();
    c2d.globalCompositeOperation = "screen";
    for (const dust of state.ambientDust) {
      dust.y += dust.vy;
      dust.x += dust.vx + Math.sin(state.timeAccumulator * dust.freq + dust.phase) * 0.12;

      if (dust.y < -10) {
        dust.y = height + 10;
        dust.x = Math.random() * width;
      }

      const twinkle = (Math.sin(state.timeAccumulator * dust.freq * 1.6 + dust.phase) + 1) * 0.5;
      const dustAlpha = dust.baseAlpha * (0.35 + twinkle * 0.65 + state.smoothedTreble * 0.25);

      c2d.fillStyle = palette.dustColor.replace(/[\d.]+\)$/, `${dustAlpha})`);
      c2d.beginPath();
      c2d.arc(dust.x, dust.y, dust.size * (1.0 + state.smoothedTreble * 0.15), 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.restore();

    // E. 电影级大字号 3D 景深层次排版与光学虚化绘制
    const heroY = height * 0.52;
    const heroX = width * 0.5;

    // 屏幕宽度安全自适应系数（保证大字气派且不溢出边缘）
    const maxAllowedWidth = width * 0.88;
    const currFitScale =
      state.totalLineWidth > 0 ? Math.min(1.0, maxAllowedWidth / state.totalLineWidth) : 1.0;
    const prevFitScale =
      state.prevLineWidth > 0 ? Math.min(1.0, maxAllowedWidth / state.prevLineWidth) : 1.0;

    c2d.save();
    c2d.textAlign = "center";
    c2d.textBaseline = "middle";
    c2d.font = `500 ${heroFontSize}px ${selectedFontFamily}`;

    // 1. 旧句词组退场
    if (state.prevLineFadeAlpha > 0.005 && state.previousSegments.length > 0) {
      render3DDepthSegments(
        c2d,
        state.previousSegments,
        state.prevLineWidth,
        heroX,
        heroY,
        1.0,
        state.prevLineFadeAlpha * 0.6,
        palette,
        state.timeAccumulator,
        true,
        prevFitScale
      );
    }

    // 2. 当前句词组 3D 景深顺序弹出与光学虚化推移
    if (state.lineTransitionAlpha > 0.005 && state.currentSegments.length > 0) {
      render3DDepthSegments(
        c2d,
        state.currentSegments,
        state.totalLineWidth,
        heroX,
        heroY,
        state.smoothedLineProgress,
        state.lineTransitionAlpha,
        palette,
        state.timeAccumulator,
        false,
        currFitScale
      );
    }

    c2d.restore();

    // F. 宣纸肌理
    if (filmGrain > 0.05 && state.grainCanvas) {
      c2d.save();
      c2d.globalCompositeOperation = "overlay";
      c2d.globalAlpha = Math.min(0.14, filmGrain * 0.12);
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

    // G. 暗角
    if (vignetteStrength > 0.05) {
      c2d.save();
      const maxDim = Math.max(width, height) * 0.75;
      const vigGrad = c2d.createRadialGradient(
        width * 0.5,
        height * 0.5,
        maxDim * 0.44,
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
    // 自动响应尺寸
  },

  destroy(ctx?: RenderContext) {
    if (ctx && ctx.private) {
      ctx.private.atmosphereOrbs = [];
      ctx.private.ambientDust = [];
      ctx.private.parsedLyrics = [];
      ctx.private.currentSegments = [];
      ctx.private.previousSegments = [];
      ctx.private.grainCanvas = null;
    }
  },
};
