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

export interface GoldSparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
}

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
  // 动力学弹簧状态
  popScale: number;
  popY: number;
  popAlpha: number;
  popProgress: number; // 0 -> 1
  phaseOffset: number;
}

export interface ParsedLrcLine {
  time: number;
  text: string;
  segments?: WordSegment[];
}

export interface CinematicLyricDriftState {
  atmosphereOrbs: SoftAtmosphereOrb[];
  ambientDust: AmbientFloatingDust[];
  goldSparkles: GoldSparkle[];
  parsedLyrics: ParsedLrcLine[];
  lastRawLyrics: string;

  // 高精度音频时钟插值
  lastReportedTime: number;
  lastTimeUpdateMs: number;

  // 词组级动力学状态
  currentLineText: string;
  previousLineText: string;
  currentSegments: WordSegment[];
  previousSegments: WordSegment[];
  totalLineWidth: number;
  prevLineWidth: number;

  // 进度与过渡
  lineEntranceTime: number;
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
// 2. High-End Ink Wash Calligraphy Palettes & Fonts
// =========================================================================

export interface ColorPalette {
  name: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  ambientAura: string;
  textUnsung: string;
  textSung: string;
  goldGradientStart: string;
  goldGradientEnd: string;
  activeGlow: string;
  dustColor: string;
  orbColor: string;
}

const COLOR_PALETTES: ColorPalette[] = [
  // 0: 洒金玄墨 (Classic Gold Leaf Noir)
  {
    name: "洒金玄墨",
    bgGradStart: "#140c06",
    bgGradMid: "#090502",
    bgGradEnd: "#020101",
    ambientAura: "rgba(255, 175, 95, 0.12)",
    textUnsung: "rgba(255, 245, 230, 0.35)",
    textSung: "#fffef9",
    goldGradientStart: "#ffffff",
    goldGradientEnd: "#ffd276",
    activeGlow: "rgba(255, 195, 100, 0.55)",
    dustColor: "rgba(255, 220, 160, 0.45)",
    orbColor: "rgba(245, 160, 80, 0.06)",
  },
  // 1: 青黛冷月 (Indigo Moonlit Mist)
  {
    name: "青黛冷月",
    bgGradStart: "#09101c",
    bgGradMid: "#040810",
    bgGradEnd: "#010204",
    ambientAura: "rgba(140, 195, 255, 0.11)",
    textUnsung: "rgba(225, 240, 255, 0.35)",
    textSung: "#faffff",
    goldGradientStart: "#ffffff",
    goldGradientEnd: "#a8dcff",
    activeGlow: "rgba(150, 215, 255, 0.55)",
    dustColor: "rgba(200, 230, 255, 0.45)",
    orbColor: "rgba(120, 185, 250, 0.06)",
  },
  // 2: 暮染丹青 (Cinnabar Twilight)
  {
    name: "暮染丹青",
    bgGradStart: "#160812",
    bgGradMid: "#0a0308",
    bgGradEnd: "#020102",
    ambientAura: "rgba(240, 140, 185, 0.12)",
    textUnsung: "rgba(255, 230, 240, 0.35)",
    textSung: "#fff6fa",
    goldGradientStart: "#ffffff",
    goldGradientEnd: "#ffb8d9",
    activeGlow: "rgba(255, 160, 205, 0.55)",
    dustColor: "rgba(255, 205, 225, 0.45)",
    orbColor: "rgba(230, 120, 175, 0.06)",
  },
  // 3: 苍山松烟 (Pine Smoke Jade)
  {
    name: "苍山松烟",
    bgGradStart: "#07150e",
    bgGradMid: "#030a07",
    bgGradEnd: "#010302",
    ambientAura: "rgba(120, 215, 165, 0.11)",
    textUnsung: "rgba(225, 255, 240, 0.35)",
    textSung: "#f4fff9",
    goldGradientStart: "#ffffff",
    goldGradientEnd: "#b5ffd8",
    activeGlow: "rgba(130, 230, 180, 0.55)",
    dustColor: "rgba(185, 245, 215, 0.45)",
    orbColor: "rgba(100, 200, 150, 0.06)",
  },
  // 4: 极简焦墨 (Timeless Monochrome)
  {
    name: "极简焦墨",
    bgGradStart: "#111113",
    bgGradMid: "#060607",
    bgGradEnd: "#010101",
    ambientAura: "rgba(220, 220, 230, 0.08)",
    textUnsung: "rgba(255, 255, 255, 0.32)",
    textSung: "#ffffff",
    goldGradientStart: "#ffffff",
    goldGradientEnd: "#d4d4dc",
    activeGlow: "rgba(235, 235, 245, 0.5)",
    dustColor: "rgba(235, 235, 245, 0.38)",
    orbColor: "rgba(190, 190, 205, 0.05)",
  },
];

const FONT_STYLES = [
  // 0: 洒脱行楷 (中英文兼顾：华文行楷/楷体 + 优雅西文手写)
  `"STXingkai", "华文行楷", "Xingkai SC", "Ma Shan Zheng", "STKaiti", "楷体", "Snell Roundhand", "Brush Script MT", "Georgia", serif`,
  // 1: 清雅文楷 (清秀文雅楷体)
  `"STKaiti", "Kaiti SC", "楷体", "楷体_GB2312", "LXGW WenKai", "Baskerville", "Georgia", serif`,
  // 2: 金石古韵 (经典古典刻本文韵)
  `"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "Palatino", "Georgia", serif`,
  // 3: 苍劲狂草 (写意洒脱狂草)
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

/**
 * 智能分词器：
 * - 英文/拉丁文本：按单词与空格分词（如 "Look what it costed" -> ["Look", "what", "it", "costed"]）
 * - 中文/CJK文本：按语义节奏将 1~3 个字划分为一个灵动的词组单元
 */
function segmentText(text: string): string[] {
  const t = text.trim();
  if (!t) return [];

  // 判断是否为纯拉丁/英文歌词（含空格）
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

  // 中文分词节奏：将长句拆成 2~3 个字的优美词组
  const result: string[] = [];
  const chars = Array.from(t);
  let buffer = "";

  for (let i = 0; i < chars.length; i++) {
    buffer += chars[i];
    // 遇到标点立即切分，或每 2 个字切一次
    if (/[，。！？、…；：]/.test(chars[i])) {
      result.push(buffer);
      buffer = "";
    } else if (buffer.length >= 2 && i < chars.length - 1) {
      // 若剩余字数仅剩 1 个，则合并为 3 字词组，避免单字落单
      if (chars.length - i - 1 === 1) {
        // 继续积累
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

/**
 * 解析并生成带分词测量的歌词行
 */
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
      popScale: 0.4,
      popY: 30,
      popAlpha: 0,
      popProgress: 0,
      phaseOffset: i * 0.45,
    });
    currentOffset += w;
  }

  const totalWidth = Math.max(10, currentOffset);

  // 计算每个词组的时间比例区间
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

/**
 * 经典 Spring Overshoot 弹簧缓动 (Apple/Framer Motion 风格)
 * 产生灵动自然的微超调弹出效果
 */
function springEaseOut(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
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
 * 词组级动力学排版绘制器 (Kinetic Segment Spring Renderer)
 */
function renderKineticSegments(
  ctx: CanvasRenderingContext2D,
  segments: WordSegment[],
  totalWidth: number,
  centerX: number,
  centerY: number,
  currentLineProgress: number,
  lineAlpha: number,
  palette: ColorPalette,
  time: number,
  isExiting: boolean
) {
  if (!segments || segments.length === 0 || lineAlpha <= 0.001) return;

  const startX = centerX - totalWidth / 2;
  let runningX = startX;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // 1. 判断词组的演唱状态（已唱 / 唱中 / 未唱）
    const isPast = currentLineProgress >= seg.endRatio;
    const isActive = currentLineProgress >= seg.startRatio && currentLineProgress < seg.endRatio;

    // 2. 有机微漂浮（微风拂墨）
    const organicFloatY = Math.sin(time * 1.8 + seg.phaseOffset) * 2.2;
    const organicRot = Math.sin(time * 1.2 + seg.phaseOffset * 0.8) * 0.015;

    // 3. 词组弹簧位置与缩放
    const currentScale = isExiting ? seg.popScale * lineAlpha : seg.popScale;
    const currentAlpha = seg.popAlpha * lineAlpha;
    const drawX = runningX + seg.width * 0.5;
    const drawY = centerY + (isExiting ? -15 * (1 - lineAlpha) : seg.popY) + organicFloatY;

    if (currentAlpha > 0.001) {
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.scale(currentScale, currentScale);
      ctx.rotate(organicRot);

      // A. 若处于唱到的瞬间，渲染金色漫射水晕 (Bloom Aura)
      if (isActive) {
        const segProgress =
          (currentLineProgress - seg.startRatio) / Math.max(0.01, seg.endRatio - seg.startRatio);
        const pulse = 1.0 + Math.sin(segProgress * Math.PI) * 0.35;

        ctx.save();
        const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 48 * pulse);
        glowGrad.addColorStop(0, palette.activeGlow);
        glowGrad.addColorStop(0.5, palette.activeGlow.replace(/[\d.]+\)$/, "0.15)"));
        glowGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 48 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // B. 词组墨色渲染
      ctx.globalAlpha = currentAlpha;

      if (isPast) {
        // 已唱完：纯净温润白金水墨
        ctx.fillStyle = palette.textSung;
        ctx.fillText(seg.text, 0, 0);
      } else if (isActive) {
        // 正在唱：洒金高光笔触 (Gold Gradient)
        const segGrad = ctx.createLinearGradient(-seg.width * 0.5, -20, seg.width * 0.5, 20);
        segGrad.addColorStop(0, palette.goldGradientStart);
        segGrad.addColorStop(1, palette.goldGradientEnd);
        ctx.fillStyle = segGrad;
        ctx.fillText(seg.text, 0, 0);

        // 顶层飞白微光
        ctx.save();
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
        ctx.fillText(seg.text, 0, 0);
        ctx.restore();
      } else {
        // 未唱到：清透半透明宣纸淡墨
        ctx.fillStyle = palette.textUnsung;
        ctx.fillText(seg.text, 0, 0);
      }

      ctx.restore();
    }

    runningX += seg.width;
  }
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
    name: "书法字号",
    type: "number",
    mode: "basic",
    min: 28,
    max: 56,
    step: 1,
    default: 42,
  },
  {
    id: "popSpeed",
    name: "词组弹出节奏",
    type: "number",
    mode: "professional",
    min: 0.5,
    max: 2.5,
    step: 0.1,
    default: 1.2,
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
  description: "分词级非线性弹簧动力学排版、60FPS洒金微流光、无歌词时呈现极净禅意水墨微光",
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
      goldSparkles: [],
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
      lineEntranceTime: 0,
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

    const heroFontSize = Math.round(params.heroFontSize ?? 42);
    const popSpeed = params.popSpeed ?? 1.2;
    const filmGrain = params.filmGrain ?? 0.2;
    const breathingDepth = params.breathingDepth ?? 1.0;
    const vignetteStrength = params.vignetteStrength ?? 0.72;

    // -------------------------------------------------------------
    // 2. 音频平滑 & 柔和呼吸
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
    // 3. 高精度时钟与歌词分词动力学状态
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

          // 唱到当前词时析出金色星芒
          if (state.goldSparkles.length < 18 && Math.random() < 0.12) {
            state.goldSparkles.push({
              x: width * 0.5 + (Math.random() - 0.5) * (state.totalLineWidth * 0.7 || 200),
              y: height * 0.52 + (Math.random() - 0.5) * 12,
              vx: (Math.random() - 0.5) * 0.2,
              vy: -0.2 - Math.random() * 0.25,
              size: 0.8 + Math.random() * 1.4,
              alpha: 0.85,
              life: 0,
              maxLife: 1.4 + Math.random() * 0.8,
              color: palette.goldGradientEnd,
            });
          }
        }
      }
    }

    // 歌词换行并构建词组分词
    if (activeLine !== state.currentLineText) {
      if (state.currentLineText) {
        state.previousLineText = state.currentLineText;
        state.previousSegments = state.currentSegments;
        state.prevLineWidth = state.totalLineWidth;
        state.prevLineFadeAlpha = state.lineTransitionAlpha;
      }
      state.currentLineText = activeLine;
      state.lineEntranceTime = state.timeAccumulator;
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
    state.smoothedLineProgress += (targetProgress - state.smoothedLineProgress) * 0.25;

    const targetCurrentAlpha = isSinging ? 1.0 : 0.0;
    state.lineTransitionAlpha += (targetCurrentAlpha - state.lineTransitionAlpha) * 0.09;
    state.prevLineFadeAlpha += (0.0 - state.prevLineFadeAlpha) * 0.1;

    // -------------------------------------------------------------
    // 4. 词组非线性顺序弹簧弹出计算 (Word Segment Kinetic Step)
    // -------------------------------------------------------------
    if (state.currentSegments.length > 0) {
      const entranceElapsed = Math.max(0, state.timeAccumulator - state.lineEntranceTime);
      const segCount = state.currentSegments.length;
      // 每个词组之间的入场交错延迟
      const staggerDelay = 0.08 / popSpeed;
      const singlePopDuration = 0.42 / popSpeed;

      for (let i = 0; i < segCount; i++) {
        const seg = state.currentSegments[i];
        const segStartTime = i * staggerDelay;
        const segLocalT = Math.max(
          0,
          Math.min(1.0, (entranceElapsed - segStartTime) / singlePopDuration)
        );

        seg.popProgress = segLocalT;
        if (segLocalT <= 0) {
          seg.popAlpha = 0;
          seg.popScale = 0.5;
          seg.popY = 24;
        } else if (segLocalT >= 1.0) {
          seg.popAlpha = 1.0;
          seg.popScale = 1.0;
          seg.popY = 0;
        } else {
          // 经典弹簧超调 (Spring Elastic Pop)
          const springVal = springEaseOut(segLocalT);
          seg.popScale = 0.5 + 0.5 * springVal;
          seg.popY = 24 * (1 - easeOutCubic(segLocalT));
          seg.popAlpha = Math.min(1.0, segLocalT * 2.2);
        }
      }
    }

    // -------------------------------------------------------------
    // 5. 绘制流水线
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

    // B. 中心水墨温光
    c2d.save();
    c2d.globalCompositeOperation = "screen";
    const auraRadius = width * 0.42 * auraBreathFactor;
    const auraAlpha = 0.06 + state.smoothedEnergy * 0.07;
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

    // E. 金墨星火微粒
    if (state.goldSparkles.length > 0) {
      c2d.save();
      c2d.globalCompositeOperation = "screen";
      for (let i = state.goldSparkles.length - 1; i >= 0; i--) {
        const drop = state.goldSparkles[i];
        drop.life += deltaTime;
        drop.x += drop.vx;
        drop.y += drop.vy;

        const progress = drop.life / drop.maxLife;
        if (progress >= 1.0) {
          state.goldSparkles.splice(i, 1);
          continue;
        }

        const dropAlpha = drop.alpha * (1.0 - progress);
        c2d.fillStyle = drop.color;
        c2d.globalAlpha = dropAlpha;
        c2d.beginPath();
        c2d.arc(drop.x, drop.y, drop.size * (1.0 - progress * 0.3), 0, Math.PI * 2);
        c2d.fill();
      }
      c2d.restore();
    }

    // F. 词组级动力学排版绘制 (Kinetic Word Segment Display)
    const heroY = height * 0.52;
    const heroX = width * 0.5;

    c2d.save();
    c2d.textAlign = "center";
    c2d.textBaseline = "middle";
    c2d.font = `500 ${heroFontSize}px ${selectedFontFamily}`;

    // 1. 旧句词组优雅退场
    if (state.prevLineFadeAlpha > 0.005 && state.previousSegments.length > 0) {
      renderKineticSegments(
        c2d,
        state.previousSegments,
        state.prevLineWidth,
        heroX,
        heroY,
        1.0,
        state.prevLineFadeAlpha * 0.6,
        palette,
        state.timeAccumulator,
        true
      );
    }

    // 2. 当前句词组非线性弹簧顺序弹出进场 & 灵动流光
    if (state.lineTransitionAlpha > 0.005 && state.currentSegments.length > 0) {
      renderKineticSegments(
        c2d,
        state.currentSegments,
        state.totalLineWidth,
        heroX,
        heroY,
        state.smoothedLineProgress,
        state.lineTransitionAlpha,
        palette,
        state.timeAccumulator,
        false
      );
    }

    c2d.restore();

    // G. 宣纸肌理
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

    // H. 暗角
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
      ctx.private.goldSparkles = [];
      ctx.private.parsedLyrics = [];
      ctx.private.currentSegments = [];
      ctx.private.previousSegments = [];
      ctx.private.grainCanvas = null;
    }
  },
};
