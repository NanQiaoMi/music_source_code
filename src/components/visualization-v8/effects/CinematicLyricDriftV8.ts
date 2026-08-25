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

export interface InkSplatterDrop {
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
  inkSplatters: InkSplatterDrop[];
  parsedLyrics: ParsedLrcLine[];
  lastRawLyrics: string;
  // 歌词平滑换行过渡
  currentLineText: string;
  previousLineText: string;
  currentLineProgress: number;
  lineTransitionAlpha: number; // 0 -> 1 for current line
  prevLineFadeAlpha: number; // 1 -> 0 for previous line
  isSinging: boolean;
  // 音频与呼吸
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
  inkUnsung: string;
  inkSung: string;
  inkActiveGold: string;
  inkBleedGlow: string;
  dustColor: string;
  orbColor: string;
}

const COLOR_PALETTES: ColorPalette[] = [
  // 0: 洒金玄墨 (Gold Splatter Noir - Classic Chinese Ink & Gold Leaf)
  {
    name: "洒金玄墨",
    bgGradStart: "#140c06",
    bgGradMid: "#0a0603",
    bgGradEnd: "#030201",
    ambientAura: "rgba(255, 175, 95, 0.14)",
    inkUnsung: "rgba(235, 215, 190, 0.38)",
    inkSung: "#fffef9",
    inkActiveGold: "#ffe39b",
    inkBleedGlow: "rgba(255, 190, 100, 0.65)",
    dustColor: "rgba(255, 215, 160, 0.45)",
    orbColor: "rgba(245, 160, 80, 0.08)",
  },
  // 1: 青黛冷月 (Indigo Ink & Moonlight - Ethereal Mountain Mist)
  {
    name: "青黛冷月",
    bgGradStart: "#09101c",
    bgGradMid: "#040810",
    bgGradEnd: "#010306",
    ambientAura: "rgba(140, 195, 255, 0.12)",
    inkUnsung: "rgba(185, 215, 245, 0.36)",
    inkSung: "#faffff",
    inkActiveGold: "#cce5ff",
    inkBleedGlow: "rgba(150, 215, 255, 0.65)",
    dustColor: "rgba(200, 230, 255, 0.45)",
    orbColor: "rgba(120, 185, 250, 0.07)",
  },
  // 2: 暮染丹青 (Cinnabar Ink - Warm Poetic Romance)
  {
    name: "暮染丹青",
    bgGradStart: "#170912",
    bgGradMid: "#0a0308",
    bgGradEnd: "#030103",
    ambientAura: "rgba(240, 140, 185, 0.14)",
    inkUnsung: "rgba(245, 200, 220, 0.38)",
    inkSung: "#fff6fa",
    inkActiveGold: "#ffd0e5",
    inkBleedGlow: "rgba(255, 160, 205, 0.65)",
    dustColor: "rgba(255, 205, 225, 0.45)",
    orbColor: "rgba(230, 120, 175, 0.08)",
  },
  // 3: 苍山松烟 (Pine Smoke Green - Quiet Zen Bamboo)
  {
    name: "苍山松烟",
    bgGradStart: "#08160f",
    bgGradMid: "#030a07",
    bgGradEnd: "#010403",
    ambientAura: "rgba(120, 215, 165, 0.12)",
    inkUnsung: "rgba(185, 235, 210, 0.36)",
    inkSung: "#f4fff9",
    inkActiveGold: "#c6ffe3",
    inkBleedGlow: "rgba(130, 230, 180, 0.65)",
    dustColor: "rgba(185, 245, 215, 0.45)",
    orbColor: "rgba(100, 200, 150, 0.07)",
  },
  // 4: 极简焦墨 (Charcoal Noir - Monochrome Ink Wash)
  {
    name: "极简焦墨",
    bgGradStart: "#121214",
    bgGradMid: "#070708",
    bgGradEnd: "#020202",
    ambientAura: "rgba(220, 220, 230, 0.1)",
    inkUnsung: "rgba(210, 210, 215, 0.35)",
    inkSung: "#ffffff",
    inkActiveGold: "#ffffff",
    inkBleedGlow: "rgba(240, 240, 250, 0.55)",
    dustColor: "rgba(235, 235, 245, 0.4)",
    orbColor: "rgba(190, 190, 205, 0.06)",
  },
];

const FONT_STYLES = [
  // 0: 洒脱行楷 (Spirited Calligraphy - Ma Shan Zheng / 华文行楷)
  `"Ma Shan Zheng", "STKaiti", "楷体", "Kaiti", "华文行楷", "STXingkai", "Songti SC", serif`,
  // 1: 苍劲狂草 (Expressive Wild Brush - Long Cang / 龙苍草书)
  `"Long Cang", "Liu Jian Mao Cao", "Ma Shan Zheng", "STKaiti", "楷体", serif`,
  // 2: 典雅文楷 (Refined Ink Regular - STKaiti / 楷体)
  `"STKaiti", "楷体", "Kaiti", "Noto Serif SC", "Source Han Serif SC", serif`,
  // 3: 金石宋韵 (Ancient Stone Inscription - Noto Serif SC)
  `"Noto Serif SC", "ZCOOL XiaoWei", "Source Han Serif SC", "Songti SC", serif`,
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
      data[i + 3] = Math.floor(Math.random() * 24);
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

/**
 * 绘制拥有水墨晕染与毛笔质感的高级书法字句
 */
function drawInkBrushSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  letterSpacing: number,
  progress: number,
  palette: ColorPalette,
  alpha: number,
  inkBleedIntensity: number
) {
  if (!text || alpha <= 0.001) return;

  const chars = Array.from(text);
  const charWidths: number[] = [];
  let totalWidth = 0;

  for (let i = 0; i < chars.length; i++) {
    const w = ctx.measureText(chars[i]).width;
    charWidths.push(w);
    totalWidth += w;
    if (i < chars.length - 1) {
      totalWidth += letterSpacing;
    }
  }

  let startX = centerX - totalWidth / 2;
  const activeCharIndex = Math.min(chars.length - 1, Math.floor(progress * chars.length));

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const w = charWidths[i];
    const charCenterX = startX + w / 2;

    ctx.save();
    if (i < activeCharIndex) {
      // 已唱过的字：温润白金水墨骨骼
      if (inkBleedIntensity > 0.05) {
        ctx.shadowColor = palette.ambientAura;
        ctx.shadowBlur = 10 * inkBleedIntensity;
      }
      ctx.fillStyle = palette.inkSung;
      ctx.fillText(char, charCenterX, centerY);
    } else if (i === activeCharIndex && progress > 0) {
      // 当前正唱到的字符：蘸饱金墨的浓郁发光水墨笔触 (Active Gold Ink Brushstroke)
      // 1. 水墨在宣纸上的多段晕染 (Multi-stage Ink Bleed)
      if (inkBleedIntensity > 0.05) {
        ctx.save();
        ctx.shadowColor = palette.inkBleedGlow;
        ctx.shadowBlur = 24 * inkBleedIntensity;
        ctx.fillStyle = palette.inkActiveGold;
        ctx.fillText(char, charCenterX, centerY);
        ctx.restore();
      }

      // 2. 金墨核心笔锋渲染 (Dense Gold Core)
      ctx.fillStyle = palette.inkActiveGold;
      ctx.shadowColor = palette.inkBleedGlow;
      ctx.shadowBlur = 12 * inkBleedIntensity;
      ctx.fillText(char, charCenterX, centerY);

      // 3. 笔锋飞白高光微层 (Brush Sheen Overlay)
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillText(char, charCenterX, centerY);
      ctx.restore();
    } else {
      // 未唱部分：淡墨写意微透明
      ctx.fillStyle = palette.inkUnsung;
      ctx.shadowBlur = 0;
      ctx.fillText(char, charCenterX, centerY);
    }
    ctx.restore();

    startX += w + letterSpacing;
  }
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
      { label: "洒脱行楷 (Spirited Brush)", value: 0 },
      { label: "苍劲行草 (Wild Cursive)", value: 1 },
      { label: "典雅文楷 (Refined Regular)", value: 2 },
      { label: "金石宋韵 (Stone Inscription)", value: 3 },
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
      { label: "青黛冷月 (Indigo Mist)", value: 1 },
      { label: "暮染丹青 (Cinnabar Rose)", value: 2 },
      { label: "苍山松烟 (Pine Smoke Green)", value: 3 },
      { label: "极简焦墨 (Charcoal Noir)", value: 4 },
    ],
  },
  {
    id: "heroFontSize",
    name: "书法字号",
    type: "number",
    mode: "basic",
    min: 28,
    max: 52,
    step: 1,
    default: 38,
  },
  {
    id: "letterSpacing",
    name: "书法行气字距",
    type: "number",
    mode: "professional",
    min: 2,
    max: 16,
    step: 0.5,
    default: 7.0,
  },
  {
    id: "inkBleedIntensity",
    name: "水墨晕染深度",
    type: "number",
    mode: "professional",
    min: 0.2,
    max: 2.0,
    step: 0.05,
    default: 1.1,
  },
  {
    id: "filmGrain",
    name: "宣纸肌理微粒",
    type: "number",
    mode: "professional",
    min: 0,
    max: 1.0,
    step: 0.05,
    default: 0.25,
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
    "专为温柔国风与慢歌打造的水墨毛笔书法歌词可视化，落墨晕染、字间行气、洒金笔触，无歌词时呈现极净禅意山水微光",
  preferredEngine: "canvas",
  parameters: PARAMETERS,

  init(ctx: RenderContext) {
    const width = ctx.width || 1280;
    const height = ctx.height || 720;

    // 1. 水墨环境光晕 (Soft Atmosphere Orbs)
    const atmosphereOrbs: SoftAtmosphereOrb[] = [];
    const orbCount = 12;
    for (let i = 0; i < orbCount; i++) {
      const baseRadius = 40 + Math.random() * 80;
      atmosphereOrbs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseRadius,
        currentRadius: baseRadius,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.04 - Math.random() * 0.08,
        baseAlpha: 0.03 + Math.random() * 0.07,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.4,
      });
    }

    // 2. 空气极细水墨/金粉微尘 (Fine Atmosphere Dust)
    const ambientDust: AmbientFloatingDust[] = [];
    const dustCount = 80;
    for (let i = 0; i < dustCount; i++) {
      ambientDust.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 0.6 + Math.random() * 1.3,
        vx: (Math.random() - 0.5) * 0.1,
        vy: -0.05 - Math.random() * 0.12,
        baseAlpha: 0.12 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        freq: 0.4 + Math.random() * 1.2,
      });
    }

    const state: CinematicLyricDriftState = {
      atmosphereOrbs,
      ambientDust,
      inkSplatters: [],
      parsedLyrics: [],
      lastRawLyrics: "",
      currentLineText: "",
      previousLineText: "",
      currentLineProgress: 0,
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
    // 1. 参数与调色板 / 书法字体选择
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

    const heroFontSize = params.heroFontSize ?? 38;
    const letterSpacing = params.letterSpacing ?? 7.0;
    const inkBleedIntensity = params.inkBleedIntensity ?? 1.1;
    const filmGrain = params.filmGrain ?? 0.25;
    const breathingDepth = params.breathingDepth ?? 1.0;
    const vignetteStrength = params.vignetteStrength ?? 0.72;

    // -------------------------------------------------------------
    // 2. 音频数据平滑 & 慢速有机水墨呼吸
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

    const smoothFactor = 0.06;
    state.smoothedBass += (rawBass - state.smoothedBass) * smoothFactor;
    state.smoothedMid += (rawMid - state.smoothedMid) * smoothFactor;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * smoothFactor;
    const totalEnergy =
      state.smoothedBass * 0.5 + state.smoothedMid * 0.3 + state.smoothedTreble * 0.2;
    state.smoothedEnergy += (totalEnergy - state.smoothedEnergy) * smoothFactor;

    state.timeAccumulator += deltaTime;
    state.breathPhase =
      (state.breathPhase + deltaTime * (0.45 + state.smoothedEnergy * 0.4) * breathingDepth) %
      (Math.PI * 2);
    const breathSin = Math.sin(state.breathPhase);
    const breathFactor = 1.0 + breathSin * 0.05 * breathingDepth + state.smoothedBass * 0.08;

    // -------------------------------------------------------------
    // 3. 歌词状态精准检测（严格过滤元数据，单行纯净极简呈现）
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
    }

    let activeLine = "";
    let lineProgress = 0;
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
          lineProgress = Math.min(1.0, Math.max(0.0, elapsed / Math.max(1.0, estimatedDuration)));

          // 演唱时，偶尔析出细微金墨微滴 (Gold Ink Droplets)
          if (state.inkSplatters.length < 20 && Math.random() < 0.15) {
            state.inkSplatters.push({
              x: width * 0.5 + (Math.random() - 0.5) * (curr.text.length * heroFontSize * 0.8),
              y: height * 0.52 + (Math.random() - 0.5) * 15,
              vx: (Math.random() - 0.5) * 0.2,
              vy: -0.2 - Math.random() * 0.3,
              size: 0.8 + Math.random() * 1.5,
              alpha: 0.8,
              life: 0,
              maxLife: 1.5 + Math.random() * 1.0,
              color: palette.inkActiveGold,
            });
          }
        }
      }
    }

    // 歌词平滑换行过渡处理
    if (activeLine !== state.currentLineText) {
      if (state.currentLineText) {
        state.previousLineText = state.currentLineText;
        state.prevLineFadeAlpha = state.lineTransitionAlpha;
      }
      state.currentLineText = activeLine;
      state.lineTransitionAlpha = 0;
    }

    state.currentLineProgress = lineProgress;
    state.isSinging = isSinging;

    const targetCurrentAlpha = isSinging ? 1.0 : 0.0;
    state.lineTransitionAlpha += (targetCurrentAlpha - state.lineTransitionAlpha) * 0.08;
    state.prevLineFadeAlpha += (0.0 - state.prevLineFadeAlpha) * 0.12;

    // -------------------------------------------------------------
    // 4. 绘制渲染流水线
    // -------------------------------------------------------------

    // A. 宣纸水墨深邃底色 (Rice Paper Ink Wash Background)
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

    // B. 中心禅意温光水晕 (Zen Ambient Aura)
    if (inkBleedIntensity > 0.05) {
      c2d.save();
      c2d.globalCompositeOperation = "screen";

      const auraRadius = width * 0.42 * breathFactor;
      const auraAlpha = (0.07 + state.smoothedEnergy * 0.08) * inkBleedIntensity;
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
    }

    // C. 柔焦墨光团 (Soft Atmosphere Orbs)
    c2d.save();
    c2d.globalCompositeOperation = "screen";

    for (const orb of state.atmosphereOrbs) {
      orb.y += orb.vy;
      orb.x += orb.vx + Math.sin(state.timeAccumulator * 0.25 + orb.phase) * 0.1;

      if (orb.y < -orb.baseRadius * 2) {
        orb.y = height + orb.baseRadius * 2;
        orb.x = Math.random() * width;
      }

      const pulse = 1.0 + Math.sin(state.timeAccumulator * orb.speed + orb.phase) * 0.12;
      const curR = orb.baseRadius * pulse * breathFactor;
      const alpha = orb.baseAlpha * inkBleedIntensity * (0.8 + state.smoothedBass * 0.4);

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

    // D. 悬浮金粉微尘 (Ambient Fine Dust)
    c2d.save();
    c2d.globalCompositeOperation = "screen";
    for (const dust of state.ambientDust) {
      dust.y += dust.vy;
      dust.x += dust.vx + Math.sin(state.timeAccumulator * dust.freq + dust.phase) * 0.15;

      if (dust.y < -10) {
        dust.y = height + 10;
        dust.x = Math.random() * width;
      }

      const twinkle = (Math.sin(state.timeAccumulator * dust.freq * 1.8 + dust.phase) + 1) * 0.5;
      const dustAlpha = dust.baseAlpha * (0.3 + twinkle * 0.7 + state.smoothedTreble * 0.3);

      c2d.fillStyle = palette.dustColor.replace(/[\d.]+\)$/, `${dustAlpha})`);
      c2d.beginPath();
      c2d.arc(dust.x, dust.y, dust.size * (1.0 + state.smoothedTreble * 0.2), 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.restore();

    // E. 金墨微滴流动 (Ink Splatter Drops)
    if (state.inkSplatters.length > 0) {
      c2d.save();
      c2d.globalCompositeOperation = "screen";
      for (let i = state.inkSplatters.length - 1; i >= 0; i--) {
        const drop = state.inkSplatters[i];
        drop.life += deltaTime;
        drop.x += drop.vx;
        drop.y += drop.vy;

        const progress = drop.life / drop.maxLife;
        if (progress >= 1.0) {
          state.inkSplatters.splice(i, 1);
          continue;
        }

        const dropAlpha = drop.alpha * (1.0 - progress);
        c2d.fillStyle = drop.color;
        c2d.globalAlpha = dropAlpha;
        c2d.beginPath();
        c2d.arc(drop.x, drop.y, drop.size * (1.0 - progress * 0.4), 0, Math.PI * 2);
        c2d.fill();
      }
      c2d.restore();
    }

    // F. 水墨画毛笔书法排版（Calligraphic Brush Typography & Ink Bleed）
    const heroY = height * 0.52;
    const heroX = width * 0.5;
    const fSize = Math.round(heroFontSize * breathFactor);

    c2d.save();
    c2d.textAlign = "center";
    c2d.textBaseline = "middle";
    c2d.font = `400 ${fSize}px ${selectedFontFamily}`;

    // 1. 旧句如水墨散开淡出 (Previous line dissolving into water)
    if (state.prevLineFadeAlpha > 0.01 && state.previousLineText) {
      c2d.save();
      const prevDriftY = heroY - (1.0 - state.prevLineFadeAlpha) * 16;
      c2d.globalAlpha = state.prevLineFadeAlpha * 0.55;
      drawInkBrushSpacedText(
        c2d,
        state.previousLineText,
        heroX,
        prevDriftY,
        letterSpacing,
        1.0,
        palette,
        state.prevLineFadeAlpha,
        inkBleedIntensity * 0.5
      );
      c2d.restore();
    }

    // 2. 当前焦点书法歌词落墨浮现 (Current hero calligraphy stroke)
    if (state.lineTransitionAlpha > 0.005 && state.currentLineText) {
      c2d.save();
      const currDriftY = heroY + (1.0 - state.lineTransitionAlpha) * 14;
      c2d.globalAlpha = state.lineTransitionAlpha;

      // 柔和水墨漫射背光
      const textGlowGrad = c2d.createRadialGradient(
        heroX,
        currDriftY,
        0,
        heroX,
        currDriftY,
        width * 0.28
      );
      const glowAlpha = (0.08 + state.smoothedEnergy * 0.1) * state.lineTransitionAlpha;
      textGlowGrad.addColorStop(0, palette.ambientAura.replace(/[\d.]+\)$/, `${glowAlpha})`));
      textGlowGrad.addColorStop(
        0.6,
        palette.ambientAura.replace(/[\d.]+\)$/, `${glowAlpha * 0.2})`)
      );
      textGlowGrad.addColorStop(1, "rgba(0,0,0,0)");
      c2d.fillStyle = textGlowGrad;
      c2d.beginPath();
      c2d.arc(heroX, currDriftY, width * 0.28, 0, Math.PI * 2);
      c2d.fill();

      // 水墨毛笔字排版渲染
      drawInkBrushSpacedText(
        c2d,
        state.currentLineText,
        heroX,
        currDriftY,
        letterSpacing,
        state.currentLineProgress,
        palette,
        state.lineTransitionAlpha,
        inkBleedIntensity
      );

      c2d.restore();
    }

    c2d.restore();

    // G. 宣纸纹理微粒 (Rice Paper Texture)
    if (filmGrain > 0.05 && state.grainCanvas) {
      c2d.save();
      c2d.globalCompositeOperation = "overlay";
      c2d.globalAlpha = Math.min(0.15, filmGrain * 0.12);
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

    // H. 沉浸式水墨画境暗角 (Vignette)
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
      ctx.private.inkSplatters = [];
      ctx.private.parsedLyrics = [];
      ctx.private.grainCanvas = null;
    }
  },
};
