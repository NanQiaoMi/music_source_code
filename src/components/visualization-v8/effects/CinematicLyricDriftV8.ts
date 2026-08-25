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

export interface GoldInkParticle {
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

export interface ParsedLrcLine {
  time: number;
  text: string;
}

export interface CinematicLyricDriftState {
  atmosphereOrbs: SoftAtmosphereOrb[];
  ambientDust: AmbientFloatingDust[];
  goldInkParticles: GoldInkParticle[];
  parsedLyrics: ParsedLrcLine[];
  lastRawLyrics: string;
  // 平滑歌词状态
  currentLineText: string;
  previousLineText: string;
  rawProgress: number;
  smoothedProgress: number; // 60fps 极度丝滑插值进度
  lineTransitionAlpha: number;
  prevLineFadeAlpha: number;
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
    activeGlow: "rgba(255, 195, 100, 0.5)",
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
    activeGlow: "rgba(150, 215, 255, 0.5)",
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
    activeGlow: "rgba(255, 160, 205, 0.5)",
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
    activeGlow: "rgba(130, 230, 180, 0.5)",
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
    activeGlow: "rgba(235, 235, 245, 0.45)",
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
// 3. Metadata Filtering & Helpers
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
      data[i + 3] = Math.floor(Math.random() * 20);
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

/**
 * 60FPS 液体连续流光书法渲染器 (Liquid Continuous Gradient Flow)
 * - 彻底告别按字符离散跳跃，实现亚像素级平滑流动
 * - 中文字符与英文单词完美自适应
 * - 字号绝对恒定稳定，杜绝任何呼吸抽搐与忽大忽小
 */
function renderSilkySmoothLyrics(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  progress: number,
  palette: ColorPalette,
  alpha: number
) {
  if (!text || alpha <= 0.001) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const textMetrics = ctx.measureText(text);
  const textWidth = Math.max(10, textMetrics.width);
  const startX = centerX - textWidth / 2;

  // 1. 底层：若处于演唱中且进度 > 0，渲染当前唱到的金色漫射背光 (Soft Golden Back-Glow)
  if (progress > 0.001) {
    const activeX = startX + textWidth * progress;
    ctx.save();
    const glowGrad = ctx.createRadialGradient(activeX, centerY, 0, activeX, centerY, 45);
    glowGrad.addColorStop(0, palette.activeGlow);
    glowGrad.addColorStop(0.6, palette.activeGlow.replace(/[\d.]+\)$/, "0.1)"));
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(activeX, centerY, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. 主层：连续流光线性渐变 (Continuous Linear Gradient Sweep)
  if (progress <= 0.001) {
    // 尚未开唱：纯净半透明宣纸白墨
    ctx.fillStyle = palette.textUnsung;
    ctx.fillText(text, centerX, centerY);
  } else if (progress >= 0.999) {
    // 全句唱毕：纯净温润白金水墨
    ctx.fillStyle = palette.textSung;
    ctx.fillText(text, centerX, centerY);
  } else {
    // 演唱中：60fps 丝滑连续渐变流光
    const sweepX = startX + textWidth * progress;
    const bandWidth = Math.max(25, textWidth * 0.08); // 柔和过渡光带宽

    const p0 = Math.max(0, Math.min(1, (sweepX - bandWidth * 1.5 - startX) / textWidth));
    const p1 = Math.max(0, Math.min(1, (sweepX - startX) / textWidth));
    const p2 = Math.max(0, Math.min(1, (sweepX + bandWidth * 1.5 - startX) / textWidth));

    const lineGrad = ctx.createLinearGradient(startX, 0, startX + textWidth, 0);
    lineGrad.addColorStop(0, palette.textSung);
    lineGrad.addColorStop(p0, palette.textSung);
    lineGrad.addColorStop(p1, palette.goldGradientEnd);
    lineGrad.addColorStop(p2, palette.textUnsung);
    lineGrad.addColorStop(1, palette.textUnsung);

    ctx.fillStyle = lineGrad;
    ctx.fillText(text, centerX, centerY);

    // 3. 顶层：当前唱到位置的微飞白高光 (Luminescent Sheen Pulse)
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    const sweepPointGrad = ctx.createRadialGradient(
      sweepX,
      centerY,
      0,
      sweepX,
      centerY,
      bandWidth * 1.8
    );
    sweepPointGrad.addColorStop(0, "rgba(255, 255, 255, 0.7)");
    sweepPointGrad.addColorStop(0.5, palette.goldGradientStart);
    sweepPointGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = sweepPointGrad;
    ctx.fillText(text, centerX, centerY);
    ctx.restore();
  }

  ctx.restore();
}

// =========================================================================
// 4. Parameter Definitions
// =========================================================================

const PARAMETERS: EffectParameterDefinition[] = [
  // Basic Mode
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
    default: 40,
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
  description:
    "专为温柔国风与慢歌打造的水墨毛笔书法歌词可视化，60FPS丝滑流光、稳定排版、纯粹留白，无歌词时呈现极净禅意山水微光",
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
      goldInkParticles: [],
      parsedLyrics: [],
      lastRawLyrics: "",
      currentLineText: "",
      previousLineText: "",
      rawProgress: 0,
      smoothedProgress: 0,
      lineTransitionAlpha: 0,
      prevLineFadeAlpha: 0,
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

    // 字号保持绝对恒定稳定，绝不因低音鼓点一抽一抽地突变！
    const heroFontSize = Math.round(params.heroFontSize ?? 40);
    const filmGrain = params.filmGrain ?? 0.2;
    const breathingDepth = params.breathingDepth ?? 1.0;
    const vignetteStrength = params.vignetteStrength ?? 0.72;

    // -------------------------------------------------------------
    // 2. 音频平滑 & 柔和光晕呼吸
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
    // 仅用于背景光场扩散，绝不缩放文字字号
    const auraBreathFactor = 1.0 + breathSin * 0.05 * breathingDepth + state.smoothedBass * 0.08;

    // -------------------------------------------------------------
    // 3. 歌词状态检测与 60FPS 极度丝滑进度插值
    // -------------------------------------------------------------
    const audioState = useAudioStore.getState();
    const playerState = usePlayerStore.getState();
    const currentSong = audioState.currentSong || playerState.currentSong;
    const currentTime = audioState.currentTime || playerState.currentTime || 0;
    const isPlaying = audioState.isPlaying || playerState.isPlaying;
    const rawLyrics = currentSong?.lyrics || "";

    if (rawLyrics !== state.lastRawLyrics) {
      state.lastRawLyrics = rawLyrics;
      state.parsedLyrics = parseLrc(rawLyrics);
      state.currentLineText = "";
      state.previousLineText = "";
      state.smoothedProgress = 0;
    }

    let activeLine = "";
    let rawProgress = 0;
    let isSinging = false;

    if (isPlaying && state.parsedLyrics.length > 0) {
      let activeIdx = -1;
      for (let i = 0; i < state.parsedLyrics.length; i++) {
        if (currentTime >= state.parsedLyrics[i].time) {
          activeIdx = i;
        } else {
          break;
        }
      }

      if (activeIdx >= 0) {
        const curr = state.parsedLyrics[activeIdx];
        const next = state.parsedLyrics[activeIdx + 1];
        const lineDuration = next ? Math.max(1.2, next.time - curr.time) : 5.0;
        const elapsed = currentTime - curr.time;
        const estimatedDuration = Math.min(lineDuration, Math.max(2.2, curr.text.length * 0.36));

        if (elapsed >= 0 && elapsed <= estimatedDuration + 0.8) {
          isSinging = true;
          activeLine = curr.text;
          rawProgress = Math.min(1.0, Math.max(0.0, elapsed / Math.max(1.0, estimatedDuration)));

          // 演唱时偶尔析出细腻金粉星尘
          if (state.goldInkParticles.length < 16 && Math.random() < 0.1) {
            state.goldInkParticles.push({
              x: width * 0.5 + (Math.random() - 0.5) * (curr.text.length * heroFontSize * 0.6),
              y: height * 0.52 + (Math.random() - 0.5) * 10,
              vx: (Math.random() - 0.5) * 0.15,
              vy: -0.15 - Math.random() * 0.2,
              size: 0.8 + Math.random() * 1.3,
              alpha: 0.8,
              life: 0,
              maxLife: 1.5 + Math.random() * 1.0,
              color: palette.goldGradientEnd,
            });
          }
        }
      }
    }

    // 歌词平滑换行
    if (activeLine !== state.currentLineText) {
      if (state.currentLineText) {
        state.previousLineText = state.currentLineText;
        state.prevLineFadeAlpha = state.lineTransitionAlpha;
      }
      state.currentLineText = activeLine;
      state.lineTransitionAlpha = 0;
      state.smoothedProgress = 0;
    }

    state.rawProgress = rawProgress;
    state.isSinging = isSinging;

    // 进度平滑插值（保证流光如水流般连续推进）
    state.smoothedProgress += (rawProgress - state.smoothedProgress) * 0.15;

    const targetCurrentAlpha = isSinging ? 1.0 : 0.0;
    state.lineTransitionAlpha += (targetCurrentAlpha - state.lineTransitionAlpha) * 0.08;
    state.prevLineFadeAlpha += (0.0 - state.prevLineFadeAlpha) * 0.1;

    // -------------------------------------------------------------
    // 4. 绘制渲染流水线
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

    // B. 中心温润水墨光场（仅光晕做柔和呼吸，文字不动）
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

    // C. 柔焦墨光团
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

    // E. 金墨微粒流
    if (state.goldInkParticles.length > 0) {
      c2d.save();
      c2d.globalCompositeOperation = "screen";
      for (let i = state.goldInkParticles.length - 1; i >= 0; i--) {
        const drop = state.goldInkParticles[i];
        drop.life += deltaTime;
        drop.x += drop.vx;
        drop.y += drop.vy;

        const progress = drop.life / drop.maxLife;
        if (progress >= 1.0) {
          state.goldInkParticles.splice(i, 1);
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

    // F. 60FPS 丝滑连续流光书法排版（固定基准线，永不卡顿抖动）
    const heroY = height * 0.52;
    const heroX = width * 0.5;

    c2d.save();
    c2d.textAlign = "center";
    c2d.textBaseline = "middle";
    c2d.font = `500 ${heroFontSize}px ${selectedFontFamily}`;

    // 1. 旧句原地平滑淡出（不突兀跳动）
    if (state.prevLineFadeAlpha > 0.005 && state.previousLineText) {
      renderSilkySmoothLyrics(
        c2d,
        state.previousLineText,
        heroX,
        heroY,
        1.0,
        palette,
        state.prevLineFadeAlpha * 0.6
      );
    }

    // 2. 当前句原地平滑淡入并连续流光
    if (state.lineTransitionAlpha > 0.005 && state.currentLineText) {
      renderSilkySmoothLyrics(
        c2d,
        state.currentLineText,
        heroX,
        heroY,
        state.smoothedProgress,
        palette,
        state.lineTransitionAlpha
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
      ctx.private.goldInkParticles = [];
      ctx.private.parsedLyrics = [];
      ctx.private.grainCanvas = null;
    }
  },
};
