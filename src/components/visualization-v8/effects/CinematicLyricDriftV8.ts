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
// 1. Data Structures & Types
// =========================================================================

export interface FloatingLyricWord {
  text: string;
  x: number;
  y: number;
  z: number; // 0.3 (close) ~ 2.0 (far)
  vx: number;
  vy: number;
  baseSize: number;
  alpha: number;
  targetAlpha: number;
  rotation: number;
  rotationSpeed: number;
  phase: number;
  freq: number;
  hueOffset: number;
  colorType: "primary" | "secondary" | "accent" | "white";
}

export interface CinematicBokehOrb {
  x: number;
  y: number;
  radius: number;
  baseRadius: number;
  vx: number;
  vy: number;
  alpha: number;
  phase: number;
  pulseSpeed: number;
  colorType: "warm" | "cool" | "glow";
  rimIntensity: number;
}

export interface SunlitDustMote {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  phase: number;
  twinkleSpeed: number;
}

export interface ParsedLrcLine {
  time: number;
  text: string;
  words?: string[];
}

export interface CinematicLyricDriftState {
  floatingWords: FloatingLyricWord[];
  bokehOrbs: CinematicBokehOrb[];
  dustMotes: SunlitDustMote[];
  parsedLyrics: ParsedLrcLine[];
  lastRawLyrics: string;
  activeLineText: string;
  activeLineIndex: number;
  activeLineProgress: number;
  activeSubLineText: string;
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  breathPhase: number;
  timeAccumulator: number;
  grainCanvas: HTMLCanvasElement | null;
  fallbackPoemTimer: number;
  fallbackPoemIndex: number;
}

// =========================================================================
// 2. Poetic Fallback & Color Themes
// =========================================================================

const POETIC_FALLBACK_LINES = [
  { line: "总在最想念的时候，假装很聪明", sub: "Cheer Chen · 太聪明" },
  { line: "猜着你的心，像隔着一层薄雾", sub: "Ethereal Whispers · 微光" },
  { line: "在呼吸之间，时间慢慢变轻", sub: "Gentle Breeze · 晚风" },
  { line: "如果声音有颜色，那大概是落日的金黄", sub: "Cinematic Poem · 浮光" },
  { line: "心事漂浮在微风里，变成温柔的微光", sub: "Quiet Resonance · 浅唱" },
  { line: "太聪明的人，往往学不会勇敢", sub: "Memories & Echoes · 心语" },
  { line: "你是我藏在旋律深处，不肯说出的秘密", sub: "Sweet Melancholy · 私语" },
  { line: "风吹过树梢的声响，像一句未说完的情话", sub: "Afternoon Sun · 窗边" },
  { line: "我把你的名字写在风里，风吹过整个夏天", sub: "Summer Breeze · 蝉鸣" },
  { line: "在每一个安静的夜晚，音符替我走向你", sub: "Nocturne Dream · 星语" },
];

const DEFAULT_VOCABULARY = [
  "太聪明",
  "想念",
  "秘密",
  "捉迷藏",
  "微风",
  "呼吸",
  "落日",
  "心跳",
  "温柔",
  "微光",
  "星辰",
  "清晨",
  "夏天",
  "窗边",
  "等待",
  "回音",
  "琴弦",
  "安静",
  "旋律",
  "阳光",
  "薄雾",
  "思绪",
  "拥抱",
  "勇敢",
  "漫游",
];

export interface ColorPalette {
  name: string;
  bgGradStart: string;
  bgGradEnd: string;
  primary: string;
  secondary: string;
  accent: string;
  bokehWarm: string;
  bokehCool: string;
  dustColor: string;
  heroText: string;
  heroGlow: string;
  lightRay: string;
}

const COLOR_PALETTES: ColorPalette[] = [
  // 0: 暮色琥珀 (Sunset Amber - Warm 35mm Cinema)
  {
    name: "暮色琥珀",
    bgGradStart: "#140c08",
    bgGradEnd: "#080504",
    primary: "rgba(255, 195, 120, 0.95)",
    secondary: "rgba(240, 140, 80, 0.85)",
    accent: "rgba(255, 230, 180, 0.9)",
    bokehWarm: "rgba(255, 160, 70, 0.28)",
    bokehCool: "rgba(230, 120, 90, 0.22)",
    dustColor: "rgba(255, 220, 160, 0.75)",
    heroText: "#fff8f0",
    heroGlow: "rgba(255, 180, 90, 0.55)",
    lightRay: "rgba(255, 210, 140, 0.08)",
  },
  // 1: 月白柔雾 (Moonlight Mist - Cool Ethereal)
  {
    name: "月白柔雾",
    bgGradStart: "#070e17",
    bgGradEnd: "#03060a",
    primary: "rgba(180, 220, 255, 0.95)",
    secondary: "rgba(120, 175, 235, 0.85)",
    accent: "rgba(220, 240, 255, 0.9)",
    bokehWarm: "rgba(140, 200, 255, 0.25)",
    bokehCool: "rgba(90, 140, 220, 0.2)",
    dustColor: "rgba(200, 235, 255, 0.75)",
    heroText: "#f0f8ff",
    heroGlow: "rgba(130, 200, 255, 0.55)",
    lightRay: "rgba(160, 215, 255, 0.08)",
  },
  // 2: 暮樱温霞 (Sakura Dusk - Romantic Dream)
  {
    name: "暮樱温霞",
    bgGradStart: "#160a14",
    bgGradEnd: "#080307",
    primary: "rgba(255, 180, 215, 0.95)",
    secondary: "rgba(225, 120, 180, 0.85)",
    accent: "rgba(255, 215, 235, 0.9)",
    bokehWarm: "rgba(255, 140, 190, 0.28)",
    bokehCool: "rgba(180, 110, 220, 0.22)",
    dustColor: "rgba(255, 205, 230, 0.75)",
    heroText: "#fff0f6",
    heroGlow: "rgba(255, 150, 200, 0.55)",
    lightRay: "rgba(255, 190, 225, 0.08)",
  },
  // 3: 薄荷晨曦 (Morning Mint - Fresh Lo-Fi)
  {
    name: "薄荷晨曦",
    bgGradStart: "#071410",
    bgGradEnd: "#030806",
    primary: "rgba(160, 240, 210, 0.95)",
    secondary: "rgba(90, 200, 160, 0.85)",
    accent: "rgba(215, 255, 235, 0.9)",
    bokehWarm: "rgba(120, 230, 190, 0.25)",
    bokehCool: "rgba(80, 180, 210, 0.2)",
    dustColor: "rgba(180, 250, 225, 0.75)",
    heroText: "#f0fff9",
    heroGlow: "rgba(110, 230, 180, 0.55)",
    lightRay: "rgba(150, 245, 210, 0.08)",
  },
  // 4: 胶片纯粹 (Cinematic Film Mono)
  {
    name: "胶片纯粹",
    bgGradStart: "#0f0f10",
    bgGradEnd: "#050506",
    primary: "rgba(240, 240, 240, 0.95)",
    secondary: "rgba(180, 180, 185, 0.85)",
    accent: "rgba(255, 255, 255, 0.9)",
    bokehWarm: "rgba(220, 220, 225, 0.22)",
    bokehCool: "rgba(150, 150, 160, 0.18)",
    dustColor: "rgba(245, 245, 250, 0.7)",
    heroText: "#fcfcfc",
    heroGlow: "rgba(210, 210, 220, 0.45)",
    lightRay: "rgba(230, 230, 235, 0.06)",
  },
];

// =========================================================================
// 3. Helper Functions & LRC Parser
// =========================================================================

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
    if (!pureText || pureText.startsWith("[ti:") || pureText.startsWith("[ar:")) continue;

    for (const match of matches) {
      const min = parseInt(match[1], 10) || 0;
      const sec = parseInt(match[2], 10) || 0;
      const ms = match[3] ? parseInt(match[3].padEnd(3, "0").slice(0, 3), 10) : 0;
      const timeInSec = min * 60 + sec + ms / 1000;

      // 分词（中文按2~4字词或标点切分，英文按单词切分）
      const words = pureText
        .split(/([，。！？、,\s]+)/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0 && !/[，。！？、,]/.test(w));

      result.push({
        time: timeInSec,
        text: pureText,
        words: words.length > 0 ? words : [pureText],
      });
    }
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}

function extractVocabularyFromLyrics(lyrics: ParsedLrcLine[]): string[] {
  const wordSet = new Set<string>();
  for (const line of lyrics) {
    if (line.words) {
      for (const w of line.words) {
        if (w.length >= 1 && w.length <= 6) {
          wordSet.add(w);
        }
      }
    }
  }
  const extracted = Array.from(wordSet);
  return extracted.length >= 10 ? extracted : DEFAULT_VOCABULARY;
}

function createFilmGrainCanvas(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 384;
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
      data[i + 3] = Math.floor(Math.random() * 45); // subtle grain alpha
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

// =========================================================================
// 4. Parameter Definitions
// =========================================================================

const PARAMETERS: EffectParameterDefinition[] = [
  // Basic Mode
  {
    id: "colorScheme",
    name: "电影影调配色",
    type: "select",
    mode: "basic",
    default: 0,
    options: [
      { label: "暮色琥珀 (Sunset Amber)", value: 0 },
      { label: "月白柔雾 (Moonlight Mist)", value: 1 },
      { label: "暮樱温霞 (Sakura Dusk)", value: 2 },
      { label: "薄荷晨曦 (Morning Mint)", value: 3 },
      { label: "胶片纯粹 (Film Mono)", value: 4 },
    ],
  },
  {
    id: "bokehIntensity",
    name: "散景光斑强度",
    type: "number",
    mode: "basic",
    min: 0,
    max: 2.5,
    step: 0.1,
    default: 1.2,
  },
  {
    id: "floatingSpeed",
    name: "文字漂浮速度",
    type: "number",
    mode: "basic",
    min: 0.2,
    max: 3.0,
    step: 0.1,
    default: 1.0,
  },
  {
    id: "godraysIntensity",
    name: "丁达尔光线强度",
    type: "number",
    mode: "basic",
    min: 0,
    max: 2.0,
    step: 0.05,
    default: 1.1,
  },
  // Professional Mode
  {
    id: "filmGrain",
    name: "35mm胶片颗粒",
    type: "number",
    mode: "professional",
    min: 0,
    max: 1.0,
    step: 0.05,
    default: 0.45,
  },
  {
    id: "chromaticAberration",
    name: "电影镜头色散",
    type: "number",
    mode: "professional",
    min: 0,
    max: 3.0,
    step: 0.1,
    default: 1.2,
  },
  {
    id: "breathingDepth",
    name: "呼吸感起伏幅度",
    type: "number",
    mode: "professional",
    min: 0,
    max: 2.0,
    step: 0.1,
    default: 1.0,
  },
  {
    id: "dustDensity",
    name: "悬浮光尘密度",
    type: "number",
    mode: "professional",
    min: 50,
    max: 400,
    step: 10,
    default: 200,
  },
  // Expert Mode
  {
    id: "heroFontSize",
    name: "焦点歌词基准字号",
    type: "number",
    mode: "expert",
    min: 18,
    max: 48,
    step: 1,
    default: 30,
  },
  {
    id: "anamorphicStreak",
    name: "宽银幕拉丝光晕",
    type: "number",
    mode: "expert",
    min: 0,
    max: 2.0,
    step: 0.1,
    default: 1.0,
  },
  {
    id: "vignetteStrength",
    name: "暗角沉浸感",
    type: "number",
    mode: "expert",
    min: 0,
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
  description:
    "专为温柔抒情慢歌设计的电影级光影歌词可视化，具备大光圈散景、丁达尔光柱、悬浮词句与胶片呼吸感",
  preferredEngine: "canvas",
  parameters: PARAMETERS,

  init(ctx: RenderContext) {
    const width = ctx.width || 1280;
    const height = ctx.height || 720;

    // 1. 生成大光圈焦外散景
    const bokehOrbs: CinematicBokehOrb[] = [];
    const orbCount = 42;
    for (let i = 0; i < orbCount; i++) {
      const baseR = 25 + Math.random() * 85;
      bokehOrbs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: baseR,
        baseRadius: baseR,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.1 - Math.random() * 0.35,
        alpha: 0.15 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.4 + Math.random() * 0.8,
        colorType: Math.random() > 0.4 ? "warm" : Math.random() > 0.5 ? "glow" : "cool",
        rimIntensity: 0.3 + Math.random() * 0.6,
      });
    }

    // 2. 生成悬浮微尘
    const dustMotes: SunlitDustMote[] = [];
    const dustCount = 220;
    for (let i = 0; i < dustCount; i++) {
      dustMotes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 0.8 + Math.random() * 2.6,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.15 - Math.random() * 0.4,
        alpha: 0.2 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.8 + Math.random() * 2.2,
      });
    }

    // 3. 生成浮动歌词文字粒子
    const floatingWords: FloatingLyricWord[] = [];
    const wordList = DEFAULT_VOCABULARY;
    const wordCount = 32;
    for (let i = 0; i < wordCount; i++) {
      const word = wordList[i % wordList.length];
      const z = 0.4 + Math.random() * 1.6; // 深度
      const baseSize = 14 + (1.8 - z) * 10;
      floatingWords.push({
        text: word,
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.25 * (2.2 - z) - Math.random() * 0.2,
        baseSize: Math.max(12, baseSize),
        alpha: 0.2 + (2.0 - z) * 0.35,
        targetAlpha: 0.2 + (2.0 - z) * 0.35,
        rotation: (Math.random() - 0.5) * 0.08,
        rotationSpeed: (Math.random() - 0.5) * 0.005,
        phase: Math.random() * Math.PI * 2,
        freq: 0.3 + Math.random() * 0.6,
        hueOffset: Math.random() * 20 - 10,
        colorType: Math.random() > 0.6 ? "primary" : Math.random() > 0.4 ? "accent" : "white",
      });
    }

    const state: CinematicLyricDriftState = {
      floatingWords,
      bokehOrbs,
      dustMotes,
      parsedLyrics: [],
      lastRawLyrics: "",
      activeLineText: "",
      activeLineIndex: -1,
      activeLineProgress: 0,
      activeSubLineText: "",
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedEnergy: 0,
      breathPhase: 0,
      timeAccumulator: 0,
      grainCanvas: createFilmGrainCanvas(),
      fallbackPoemTimer: 0,
      fallbackPoemIndex: 0,
    };

    ctx.private = state;
  },

  render(ctx: RenderContext, audioData: AudioData, params: EffectParameterMap) {
    const c2d = ctx.ctx;
    if (!c2d) return;

    const width = ctx.width;
    const height = ctx.height;
    const deltaTime = Math.min(ctx.deltaTime || 0.016, 0.1);

    if (!ctx.private || !ctx.private.floatingWords) {
      CinematicLyricDriftV8Effect.init(ctx);
    }
    const state = ctx.private as CinematicLyricDriftState;

    // -------------------------------------------------------------
    // 1. 参数提取与调色板选择
    // -------------------------------------------------------------
    const schemeIndex = Math.max(
      0,
      Math.min(COLOR_PALETTES.length - 1, Math.round(params.colorScheme ?? 0))
    );
    const palette = COLOR_PALETTES[schemeIndex];

    const bokehIntensity = params.bokehIntensity ?? 1.2;
    const floatingSpeed = params.floatingSpeed ?? 1.0;
    const godraysIntensity = params.godraysIntensity ?? 1.1;
    const filmGrain = params.filmGrain ?? 0.45;
    const chromaticAberration = params.chromaticAberration ?? 1.2;
    const breathingDepth = params.breathingDepth ?? 1.0;
    const heroFontSize = params.heroFontSize ?? 30;
    const anamorphicStreak = params.anamorphicStreak ?? 1.0;
    const vignetteStrength = params.vignetteStrength ?? 0.65;

    // -------------------------------------------------------------
    // 2. 音频数据指数平滑 & 呼吸律动计算
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

    const smoothFactor = 0.08;
    state.smoothedBass += (rawBass - state.smoothedBass) * smoothFactor;
    state.smoothedMid += (rawMid - state.smoothedMid) * smoothFactor;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * smoothFactor;
    const totalEnergy =
      state.smoothedBass * 0.5 + state.smoothedMid * 0.3 + state.smoothedTreble * 0.2;
    state.smoothedEnergy += (totalEnergy - state.smoothedEnergy) * smoothFactor;

    state.timeAccumulator += deltaTime;
    // 呼吸周期：约 4.8 秒一个完整舒张周期
    state.breathPhase =
      (state.breathPhase + deltaTime * (0.65 + state.smoothedEnergy * 0.8) * breathingDepth) %
      (Math.PI * 2);
    const breathSin = Math.sin(state.breathPhase);
    const breathFactor = 1.0 + breathSin * 0.12 * breathingDepth + state.smoothedBass * 0.2;

    // -------------------------------------------------------------
    // 3. 歌词状态同步与提取
    // -------------------------------------------------------------
    const audioState = useAudioStore.getState();
    const playerState = usePlayerStore.getState();
    const currentSong = audioState.currentSong || playerState.currentSong;
    const currentTime = audioState.currentTime || playerState.currentTime || 0;
    const rawLyrics = currentSong?.lyrics || "";

    // 若歌词变更，重新解析
    if (rawLyrics !== state.lastRawLyrics) {
      state.lastRawLyrics = rawLyrics;
      state.parsedLyrics = parseLrc(rawLyrics);

      if (state.parsedLyrics.length > 0) {
        // 更新浮字池词汇
        const newVocab = extractVocabularyFromLyrics(state.parsedLyrics);
        state.floatingWords.forEach((wordObj, i) => {
          wordObj.text = newVocab[i % newVocab.length];
        });
      }
    }

    // 寻找当前主焦点歌词
    let activeLine = "";
    let activeSub = "";
    let activeProgress = 0;

    if (state.parsedLyrics.length > 0) {
      let idx = -1;
      for (let i = 0; i < state.parsedLyrics.length; i++) {
        if (currentTime >= state.parsedLyrics[i].time) {
          idx = i;
        } else {
          break;
        }
      }
      if (idx >= 0) {
        const curr = state.parsedLyrics[idx];
        const next = state.parsedLyrics[idx + 1];
        activeLine = curr.text;
        state.activeLineIndex = idx;

        const duration = next ? Math.max(0.5, next.time - curr.time) : 5.0;
        const elapsed = currentTime - curr.time;
        activeProgress = Math.min(1.0, Math.max(0.0, elapsed / duration));

        if (currentSong?.artist) {
          activeSub = `${currentSong.title || ""} · ${currentSong.artist}`;
        }
      }
    }

    // 若无歌词或伴奏，启用诗意文库轮播
    if (!activeLine) {
      state.fallbackPoemTimer += deltaTime;
      if (state.fallbackPoemTimer > 7.0) {
        state.fallbackPoemTimer = 0;
        state.fallbackPoemIndex = (state.fallbackPoemIndex + 1) % POETIC_FALLBACK_LINES.length;
      }
      const poem = POETIC_FALLBACK_LINES[state.fallbackPoemIndex];
      activeLine = poem.line;
      activeSub = poem.sub;
      activeProgress = (Math.sin(state.fallbackPoemTimer * 0.4) + 1) / 2;
    }

    state.activeLineText = activeLine;
    state.activeSubLineText = activeSub;
    state.activeLineProgress = activeProgress;

    // -------------------------------------------------------------
    // 4. 绘制渲染流水线
    // -------------------------------------------------------------

    // A. 电影级背景深邃渐变
    const bgGrad = c2d.createLinearGradient(0, 0, width * 0.8, height);
    bgGrad.addColorStop(0, palette.bgGradStart);
    bgGrad.addColorStop(1, palette.bgGradEnd);
    c2d.fillStyle = bgGrad;
    c2d.fillRect(0, 0, width, height);

    // B. 丁达尔斜向体积光柱 (God Rays / Light Beams)
    if (godraysIntensity > 0.05) {
      c2d.save();
      c2d.globalCompositeOperation = "screen";
      const rayAngle = 0.65; // 约 37度倾角
      const rayOriginX = width * 0.15 + Math.sin(state.timeAccumulator * 0.2) * 60;
      const rayOriginY = -50;

      const rayCount = 5;
      for (let r = 0; r < rayCount; r++) {
        const rPhase = state.timeAccumulator * 0.4 + r * 1.3;
        const rAlpha =
          (0.04 + Math.sin(rPhase) * 0.03 + state.smoothedTreble * 0.06) * godraysIntensity;
        const rayWidth = (120 + r * 45) * breathFactor;

        const rayGrad = c2d.createLinearGradient(
          rayOriginX + r * 90,
          rayOriginY,
          rayOriginX + r * 90 + Math.cos(rayAngle) * height * 1.4,
          rayOriginY + Math.sin(rayAngle) * height * 1.4
        );
        rayGrad.addColorStop(0, palette.lightRay.replace(/[\d.]+\)$/, `${rAlpha * 1.5})`));
        rayGrad.addColorStop(0.5, palette.lightRay.replace(/[\d.]+\)$/, `${rAlpha})`));
        rayGrad.addColorStop(1, "rgba(0,0,0,0)");

        c2d.fillStyle = rayGrad;
        c2d.beginPath();
        c2d.moveTo(rayOriginX + r * 90 - rayWidth * 0.5, rayOriginY);
        c2d.lineTo(rayOriginX + r * 90 + rayWidth * 0.5, rayOriginY);
        c2d.lineTo(
          rayOriginX + r * 90 + Math.cos(rayAngle) * height * 1.4 + rayWidth * 1.8,
          height * 1.2
        );
        c2d.lineTo(
          rayOriginX + r * 90 + Math.cos(rayAngle) * height * 1.4 - rayWidth * 1.8,
          height * 1.2
        );
        c2d.closePath();
        c2d.fill();
      }
      c2d.restore();
    }

    // C. 大光圈焦外散景光斑 (Optical Bokeh Orbs)
    if (bokehIntensity > 0.05) {
      c2d.save();
      c2d.globalCompositeOperation = "screen";

      for (const orb of state.bokehOrbs) {
        orb.y += orb.vy * floatingSpeed;
        orb.x += orb.vx * floatingSpeed + Math.sin(state.timeAccumulator * 0.5 + orb.phase) * 0.2;

        // 边界环回
        if (orb.y < -orb.radius * 2) {
          orb.y = height + orb.radius * 2;
          orb.x = Math.random() * width;
        }

        const pulse = 1.0 + Math.sin(state.timeAccumulator * orb.pulseSpeed + orb.phase) * 0.18;
        const currentR = orb.baseRadius * pulse * breathFactor * bokehIntensity;
        const alpha = orb.alpha * (0.7 + state.smoothedBass * 0.6);

        const orbGrad = c2d.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, currentR);
        const colorBase =
          orb.colorType === "warm"
            ? palette.bokehWarm
            : orb.colorType === "glow"
              ? palette.heroGlow
              : palette.bokehCool;

        orbGrad.addColorStop(0, colorBase.replace(/[\d.]+\)$/, `${alpha * 0.8})`));
        orbGrad.addColorStop(0.7, colorBase.replace(/[\d.]+\)$/, `${alpha * 0.3})`));
        // 菲涅尔亮边环
        orbGrad.addColorStop(0.92, colorBase.replace(/[\d.]+\)$/, `${alpha * orb.rimIntensity})`));
        orbGrad.addColorStop(1, "rgba(0,0,0,0)");

        c2d.fillStyle = orbGrad;
        c2d.beginPath();
        c2d.arc(orb.x, orb.y, currentR, 0, Math.PI * 2);
        c2d.fill();
      }
      c2d.restore();
    }

    // D. 宽银幕变形镜头拉丝微光 (Anamorphic Cinema Flare)
    if (anamorphicStreak > 0.05) {
      c2d.save();
      c2d.globalCompositeOperation = "screen";
      const streakY = height * 0.62 + Math.sin(state.timeAccumulator * 0.3) * 15;
      const streakAlpha = (0.08 + state.smoothedBass * 0.15) * anamorphicStreak;

      const streakGrad = c2d.createRadialGradient(
        width * 0.5,
        streakY,
        0,
        width * 0.5,
        streakY,
        width * 0.55
      );
      streakGrad.addColorStop(0, palette.accent.replace(/[\d.]+\)$/, `${streakAlpha})`));
      streakGrad.addColorStop(0.6, palette.secondary.replace(/[\d.]+\)$/, `${streakAlpha * 0.4})`));
      streakGrad.addColorStop(1, "rgba(0,0,0,0)");

      c2d.fillStyle = streakGrad;
      c2d.save();
      c2d.scale(1, 0.06); // 水平拉伸极度压扁
      c2d.beginPath();
      c2d.arc(width * 0.5, streakY / 0.06, width * 0.55, 0, Math.PI * 2);
      c2d.fill();
      c2d.restore();

      c2d.restore();
    }

    // E. 漂浮歌词文字粒子流 (Floating Typography Words)
    c2d.save();
    c2d.textAlign = "center";
    c2d.textBaseline = "middle";

    for (const wordObj of state.floatingWords) {
      wordObj.y += wordObj.vy * floatingSpeed;
      wordObj.x +=
        wordObj.vx * floatingSpeed +
        Math.sin(state.timeAccumulator * wordObj.freq + wordObj.phase) * (0.6 * (2.2 - wordObj.z));
      wordObj.rotation += wordObj.rotationSpeed;

      // 顶部环回
      if (wordObj.y < -50) {
        wordObj.y = height + 40;
        wordObj.x = Math.random() * width;
      }

      const zFactor = 2.2 - wordObj.z; // 近景权重
      const fontSize = wordObj.baseSize * breathFactor;
      const alpha = Math.min(1.0, wordObj.alpha * (0.6 + state.smoothedEnergy * 0.5));

      c2d.save();
      c2d.translate(wordObj.x, wordObj.y);
      c2d.rotate(wordObj.rotation);

      // 字形光晕与字体渲染
      c2d.font = `300 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", "STSong", serif`;

      // 光晕阴影
      c2d.shadowColor = palette.heroGlow;
      c2d.shadowBlur = (8 + zFactor * 6) * breathFactor;

      const fillAlpha = wordObj.colorType === "primary" ? alpha : alpha * 0.75;
      const colorStr =
        wordObj.colorType === "primary"
          ? palette.primary
          : wordObj.colorType === "accent"
            ? palette.accent
            : palette.heroText;

      c2d.fillStyle = colorStr.replace(/[\d.]+\)$/, `${fillAlpha})`);
      c2d.fillText(wordObj.text, 0, 0);

      // 近景大字额外叠加一层微光核心
      if (wordObj.z < 0.9) {
        c2d.shadowBlur = 0;
        c2d.fillStyle = palette.heroText;
        c2d.globalAlpha = fillAlpha * 0.9;
        c2d.fillText(wordObj.text, 0, 0);
      }

      c2d.restore();
    }
    c2d.restore();

    // F. 空气悬浮微尘与星芒 (Sunlit Dust Motes)
    c2d.save();
    c2d.globalCompositeOperation = "screen";
    for (const dust of state.dustMotes) {
      dust.y += dust.vy * floatingSpeed;
      dust.x += dust.vx * floatingSpeed + Math.sin(state.timeAccumulator + dust.phase) * 0.3;

      if (dust.y < -10) {
        dust.y = height + 10;
        dust.x = Math.random() * width;
      }

      const twinkle = (Math.sin(state.timeAccumulator * dust.twinkleSpeed + dust.phase) + 1) * 0.5;
      const dustAlpha = dust.alpha * (0.3 + twinkle * 0.7 + state.smoothedTreble * 0.6);
      const dustR = dust.size * (1.0 + state.smoothedTreble * 0.4);

      c2d.fillStyle = palette.dustColor.replace(/[\d.]+\)$/, `${dustAlpha})`);
      c2d.beginPath();
      c2d.arc(dust.x, dust.y, dustR, 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.restore();

    // G. 焦点歌词排版与电影色散 (In-Focus Hero Lyric Line)
    if (state.activeLineText) {
      c2d.save();
      const heroY = height * 0.65;
      const heroX = width * 0.5;
      const fSize = heroFontSize * breathFactor;

      c2d.textAlign = "center";
      c2d.textBaseline = "middle";

      // 电影感字体（人文衬线/优雅屏显）
      c2d.font = `400 ${fSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", "STSong", serif`;

      // 1. 背后柔和漫射光晕
      const bloomGrad = c2d.createRadialGradient(heroX, heroY, 0, heroX, heroY, width * 0.4);
      const bloomAlpha = (0.12 + state.smoothedEnergy * 0.15) * breathFactor;
      bloomGrad.addColorStop(0, palette.heroGlow.replace(/[\d.]+\)$/, `${bloomAlpha})`));
      bloomGrad.addColorStop(1, "rgba(0,0,0,0)");
      c2d.fillStyle = bloomGrad;
      c2d.fillRect(0, heroY - 80, width, 160);

      // 2. 电影镜头色散 (Chromatic Aberration - RGB Shift on Hero Text)
      if (chromaticAberration > 0.1) {
        const caOffset = (1.2 * chromaticAberration + state.smoothedBass * 1.5) * breathFactor;

        c2d.save();
        c2d.globalCompositeOperation = "screen";

        // 红/暖通道微偏移
        c2d.fillStyle = "rgba(255, 120, 100, 0.25)";
        c2d.fillText(state.activeLineText, heroX - caOffset, heroY);

        // 青/冷通道微偏移
        c2d.fillStyle = "rgba(100, 200, 255, 0.25)";
        c2d.fillText(state.activeLineText, heroX + caOffset, heroY);

        c2d.restore();
      }

      // 3. 主文字渲染（带深层阴影与发光）
      c2d.shadowColor = palette.heroGlow;
      c2d.shadowBlur = 18 * breathFactor;
      c2d.fillStyle = palette.heroText;
      c2d.fillText(state.activeLineText, heroX, heroY);

      // 4. 逐字流光唤醒高光扫描 (Luminescent Sweep)
      c2d.shadowBlur = 0;
      const textMetrics = c2d.measureText(state.activeLineText);
      const textW = textMetrics.width;
      if (textW > 0) {
        const sweepX = heroX - textW / 2 + textW * state.activeLineProgress;
        const sweepGrad = c2d.createRadialGradient(sweepX, heroY, 0, sweepX, heroY, 60);
        sweepGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
        sweepGrad.addColorStop(0.5, palette.accent.replace(/[\d.]+\)$/, "0.4)"));
        sweepGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

        c2d.save();
        c2d.globalCompositeOperation = "source-atop";
        c2d.fillStyle = sweepGrad;
        c2d.fillRect(heroX - textW / 2 - 10, heroY - 40, textW + 20, 80);
        c2d.restore();
      }

      // 5. 优雅副歌词/曲目信息（小字副标题）
      if (state.activeSubLineText) {
        const subFontSize = Math.max(12, Math.round(fSize * 0.42));
        c2d.font = `300 ${subFontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif`;
        c2d.shadowColor = "rgba(0,0,0,0.5)";
        c2d.shadowBlur = 6;
        c2d.fillStyle = palette.secondary.replace(/[\d.]+\)$/, "0.85)");
        c2d.fillText(state.activeSubLineText, heroX, heroY + fSize * 0.95);
      }

      c2d.restore();
    }

    // H. 35mm 胶片微粒质感 (35mm Film Grain)
    if (filmGrain > 0.05 && state.grainCanvas) {
      c2d.save();
      c2d.globalCompositeOperation = "overlay";
      c2d.globalAlpha = Math.min(0.2, filmGrain * 0.16);
      const pattern = c2d.createPattern(state.grainCanvas, "repeat");
      if (pattern) {
        // 轻微噪点抖动
        const grainOffsetX = (Math.random() - 0.5) * 40;
        const grainOffsetY = (Math.random() - 0.5) * 40;
        c2d.translate(grainOffsetX, grainOffsetY);
        c2d.fillStyle = pattern;
        c2d.fillRect(-40, -40, width + 80, height + 80);
      }
      c2d.restore();
    }

    // I. 电影暗角 (Vignette)
    if (vignetteStrength > 0.05) {
      c2d.save();
      const maxDim = Math.max(width, height) * 0.75;
      const vigGrad = c2d.createRadialGradient(
        width * 0.5,
        height * 0.5,
        maxDim * 0.45,
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
    // 自动适配尺寸
  },

  destroy(ctx?: RenderContext) {
    if (ctx && ctx.private) {
      ctx.private.floatingWords = [];
      ctx.private.bokehOrbs = [];
      ctx.private.dustMotes = [];
      ctx.private.parsedLyrics = [];
      ctx.private.grainCanvas = null;
    }
  },
};
