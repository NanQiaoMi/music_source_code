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

export interface LyricStardustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxLife: number;
  life: number;
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

export interface SoftBokehOrb {
  x: number;
  y: number;
  baseRadius: number;
  currentRadius: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  phase: number;
  speed: number;
  colorType: "warm" | "cool" | "gold";
}

export interface ParsedLrcLine {
  time: number;
  text: string;
}

export interface CinematicLyricDriftState {
  bokehOrbs: SoftBokehOrb[];
  ambientDust: AmbientFloatingDust[];
  stardustParticles: LyricStardustParticle[];
  parsedLyrics: ParsedLrcLine[];
  lastRawLyrics: string;
  activeLine: string;
  prevLine: string;
  nextLine: string;
  lineProgress: number;
  lineAlpha: number;
  contextAlpha: number;
  isSinging: boolean;
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  breathPhase: number;
  timeAccumulator: number;
  grainCanvas: HTMLCanvasElement | null;
}

// =========================================================================
// 2. Color Palettes (Refined & Luxurious)
// =========================================================================

export interface ColorPalette {
  name: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  primaryGlow: string;
  heroText: string;
  heroTextActive: string;
  contextText: string;
  bokehColorA: string;
  bokehColorB: string;
  dustColor: string;
  stardustColor: string;
  haloColor: string;
}

const COLOR_PALETTES: ColorPalette[] = [
  // 0: 暮色琥珀 (Sunset Amber - Warm 35mm Velvet Cinema)
  {
    name: "暮色琥珀",
    bgGradStart: "#120904",
    bgGradMid: "#090502",
    bgGradEnd: "#030201",
    primaryGlow: "rgba(240, 160, 80, 0.18)",
    heroText: "#fdf8f2",
    heroTextActive: "#fff9f0",
    contextText: "rgba(220, 180, 140, 0.35)",
    bokehColorA: "rgba(230, 140, 60, 0.12)",
    bokehColorB: "rgba(180, 90, 40, 0.08)",
    dustColor: "rgba(255, 210, 150, 0.55)",
    stardustColor: "rgba(255, 225, 170, 0.85)",
    haloColor: "rgba(240, 150, 70, 0.06)",
  },
  // 1: 月白冷雾 (Moonlight Mist - Serene & Poetic)
  {
    name: "月白冷雾",
    bgGradStart: "#080e1a",
    bgGradMid: "#04070d",
    bgGradEnd: "#010204",
    primaryGlow: "rgba(140, 190, 255, 0.16)",
    heroText: "#f5f9ff",
    heroTextActive: "#ffffff",
    contextText: "rgba(160, 195, 235, 0.32)",
    bokehColorA: "rgba(120, 180, 240, 0.12)",
    bokehColorB: "rgba(70, 120, 190, 0.08)",
    dustColor: "rgba(190, 225, 255, 0.55)",
    stardustColor: "rgba(220, 240, 255, 0.85)",
    haloColor: "rgba(100, 170, 255, 0.05)",
  },
  // 2: 暮樱晚霞 (Sakura Twilight - Romantic & Tender)
  {
    name: "暮樱晚霞",
    bgGradStart: "#140813",
    bgGradMid: "#0a0309",
    bgGradEnd: "#030103",
    primaryGlow: "rgba(235, 130, 180, 0.18)",
    heroText: "#fff4f9",
    heroTextActive: "#ffffff",
    contextText: "rgba(230, 160, 195, 0.35)",
    bokehColorA: "rgba(220, 110, 160, 0.12)",
    bokehColorB: "rgba(160, 70, 130, 0.08)",
    dustColor: "rgba(255, 195, 220, 0.55)",
    stardustColor: "rgba(255, 220, 235, 0.85)",
    haloColor: "rgba(220, 100, 170, 0.06)",
  },
  // 3: 薄荷晨曦 (Morning Sage - Calm & Fresh Lo-Fi)
  {
    name: "薄荷晨曦",
    bgGradStart: "#06130d",
    bgGradMid: "#020906",
    bgGradEnd: "#010302",
    primaryGlow: "rgba(110, 210, 160, 0.16)",
    heroText: "#f2fff8",
    heroTextActive: "#ffffff",
    contextText: "rgba(150, 215, 185, 0.32)",
    bokehColorA: "rgba(90, 190, 140, 0.12)",
    bokehColorB: "rgba(50, 130, 100, 0.08)",
    dustColor: "rgba(170, 240, 205, 0.55)",
    stardustColor: "rgba(210, 255, 235, 0.85)",
    haloColor: "rgba(80, 200, 140, 0.05)",
  },
  // 4: 黑白胶片 (Vintage Noir - Pure Film Monochrome)
  {
    name: "黑白胶片",
    bgGradStart: "#0e0e10",
    bgGradMid: "#060607",
    bgGradEnd: "#020202",
    primaryGlow: "rgba(220, 220, 230, 0.12)",
    heroText: "#fbfbfb",
    heroTextActive: "#ffffff",
    contextText: "rgba(180, 180, 190, 0.28)",
    bokehColorA: "rgba(180, 180, 190, 0.09)",
    bokehColorB: "rgba(120, 120, 130, 0.06)",
    dustColor: "rgba(230, 230, 240, 0.45)",
    stardustColor: "rgba(250, 250, 255, 0.8)",
    haloColor: "rgba(200, 200, 210, 0.04)",
  },
];

// =========================================================================
// 3. Metadata Filtering & Helpers
// =========================================================================

function isMetadataLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  // 严格过滤各类制作人/作词/编曲/录音等元数据
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
      data[i + 3] = Math.floor(Math.random() * 28); // 细腻胶片噪点
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
    name: "电影影调",
    type: "select",
    mode: "basic",
    default: 0,
    options: [
      { label: "暮色琥珀 (Sunset Amber)", value: 0 },
      { label: "月白冷雾 (Moonlight Mist)", value: 1 },
      { label: "暮樱晚霞 (Sakura Twilight)", value: 2 },
      { label: "薄荷晨曦 (Morning Sage)", value: 3 },
      { label: "黑白胶片 (Vintage Noir)", value: 4 },
    ],
  },
  {
    id: "glowIntensity",
    name: "环境微光呼吸感",
    type: "number",
    mode: "basic",
    min: 0.2,
    max: 2.0,
    step: 0.05,
    default: 1.0,
  },
  {
    id: "heroFontSize",
    name: "歌词字号大小",
    type: "number",
    mode: "basic",
    min: 22,
    max: 38,
    step: 1,
    default: 28,
  },
  // Professional Mode
  {
    id: "showContextLines",
    name: "显示上下句景深",
    type: "boolean",
    mode: "professional",
    default: true,
  },
  {
    id: "filmGrain",
    name: "35mm胶片质感",
    type: "number",
    mode: "professional",
    min: 0,
    max: 1.0,
    step: 0.05,
    default: 0.3,
  },
  {
    id: "chromaticAberration",
    name: "镜头微色散",
    type: "number",
    mode: "professional",
    min: 0,
    max: 1.5,
    step: 0.05,
    default: 0.6,
  },
  {
    id: "breathingDepth",
    name: "呼吸起伏幅度",
    type: "number",
    mode: "professional",
    min: 0,
    max: 2.0,
    step: 0.1,
    default: 1.0,
  },
  // Expert Mode
  {
    id: "vignetteStrength",
    name: "电影暗角深度",
    type: "number",
    mode: "expert",
    min: 0,
    max: 1.0,
    step: 0.05,
    default: 0.68,
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
    "专为温柔慢歌设计的电影级诗意歌词可视化，主句光影流转、景深呼吸、星尘解构，无歌词时呈现纯粹高级的氛围背景",
  preferredEngine: "canvas",
  parameters: PARAMETERS,

  init(ctx: RenderContext) {
    const width = ctx.width || 1280;
    const height = ctx.height || 720;

    // 1. 生成极柔和的大光圈背景微光晕 (Soft Bokeh Orbs - 极度克制，18~24 个，柔焦无硬边)
    const bokehOrbs: SoftBokehOrb[] = [];
    const orbCount = 20;
    for (let i = 0; i < orbCount; i++) {
      const baseRadius = 25 + Math.random() * 55;
      bokehOrbs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseRadius,
        currentRadius: baseRadius,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.06 - Math.random() * 0.14,
        baseAlpha: 0.04 + Math.random() * 0.12,
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.5,
        colorType: Math.random() > 0.5 ? "warm" : "cool",
      });
    }

    // 2. 生成空气悬浮微尘 (Fine Sunlit Dust Flakes)
    const ambientDust: AmbientFloatingDust[] = [];
    const dustCount = 110;
    for (let i = 0; i < dustCount; i++) {
      ambientDust.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 0.7 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.08 - Math.random() * 0.18,
        baseAlpha: 0.15 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        freq: 0.5 + Math.random() * 1.5,
      });
    }

    const state: CinematicLyricDriftState = {
      bokehOrbs,
      ambientDust,
      stardustParticles: [],
      parsedLyrics: [],
      lastRawLyrics: "",
      activeLine: "",
      prevLine: "",
      nextLine: "",
      lineProgress: 0,
      lineAlpha: 0,
      contextAlpha: 0,
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

    if (!ctx.private || !ctx.private.bokehOrbs) {
      CinematicLyricDriftV8Effect.init(ctx);
    }
    const state = ctx.private as CinematicLyricDriftState;

    // -------------------------------------------------------------
    // 1. 参数与调色板选择
    // -------------------------------------------------------------
    const schemeIndex = Math.max(
      0,
      Math.min(COLOR_PALETTES.length - 1, Math.round(params.colorScheme ?? 0))
    );
    const palette = COLOR_PALETTES[schemeIndex];

    const glowIntensity = params.glowIntensity ?? 1.0;
    const heroFontSize = params.heroFontSize ?? 28;
    const showContextLines = params.showContextLines ?? true;
    const filmGrain = params.filmGrain ?? 0.3;
    const chromaticAberration = params.chromaticAberration ?? 0.6;
    const breathingDepth = params.breathingDepth ?? 1.0;
    const vignetteStrength = params.vignetteStrength ?? 0.68;

    // -------------------------------------------------------------
    // 2. 音频数据平滑 & 有机呼吸节律计算
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

    const smoothFactor = 0.07;
    state.smoothedBass += (rawBass - state.smoothedBass) * smoothFactor;
    state.smoothedMid += (rawMid - state.smoothedMid) * smoothFactor;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * smoothFactor;
    const totalEnergy =
      state.smoothedBass * 0.5 + state.smoothedMid * 0.3 + state.smoothedTreble * 0.2;
    state.smoothedEnergy += (totalEnergy - state.smoothedEnergy) * smoothFactor;

    state.timeAccumulator += deltaTime;
    // 呼吸周期：约 5.2 秒一个深度呼吸周期
    state.breathPhase =
      (state.breathPhase + deltaTime * (0.5 + state.smoothedEnergy * 0.5) * breathingDepth) %
      (Math.PI * 2);
    const breathSin = Math.sin(state.breathPhase);
    const breathFactor = 1.0 + breathSin * 0.06 * breathingDepth + state.smoothedBass * 0.12;

    // -------------------------------------------------------------
    // 3. 歌词状态精准解析（严格排除所有元数据，无词时纯净优美背景）
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
    }

    let activeLine = "";
    let prevLine = "";
    let nextLine = "";
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

        // 根据字数智能估算演唱持续时长（中文每字约 0.35s，最少 2.2s）
        const estimatedDuration = Math.min(lineDuration, Math.max(2.2, curr.text.length * 0.36));

        // 仅在真实演唱区间内（加上 0.8s 尾韵淡出）判定为正在演唱
        if (elapsed >= 0 && elapsed <= estimatedDuration + 0.8) {
          isSinging = true;
          activeLine = curr.text;
          lineProgress = Math.min(1.0, Math.max(0.0, elapsed / Math.max(1.0, estimatedDuration)));

          // 提取上下文供景深排版
          if (activeIdx > 0) {
            prevLine = state.parsedLyrics[activeIdx - 1].text;
          }
          if (next) {
            nextLine = next.text;
          }

          // 在演唱时，偶尔从歌词文字周围析出极细腻的星尘微粒（Stardust Embers）
          if (state.stardustParticles.length < 24 && Math.random() < 0.2) {
            state.stardustParticles.push({
              x: width * 0.5 + (Math.random() - 0.5) * (curr.text.length * heroFontSize * 0.9),
              y: height * 0.54 + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 0.3,
              vy: -0.3 - Math.random() * 0.4,
              size: 0.8 + Math.random() * 1.6,
              alpha: 0.7 + Math.random() * 0.3,
              life: 0,
              maxLife: 1.8 + Math.random() * 1.2,
              color: palette.stardustColor,
            });
          }
        }
      }
    }

    state.activeLine = activeLine;
    state.prevLine = prevLine;
    state.nextLine = nextLine;
    state.lineProgress = lineProgress;
    state.isSinging = isSinging;

    // 优雅的淡入淡出插值（避免闪烁）
    const targetAlpha = isSinging ? 1.0 : 0.0;
    state.lineAlpha += (targetAlpha - state.lineAlpha) * 0.06;
    state.contextAlpha += (targetAlpha * 0.4 - state.contextAlpha) * 0.05;

    // -------------------------------------------------------------
    // 4. 绘制渲染流水线
    // -------------------------------------------------------------

    // A. 电影级丝绒深邃底色渐变 (Deep Velvet Cinema Gradient)
    const bgGrad = c2d.createRadialGradient(
      width * 0.5,
      height * 0.48,
      20,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.8
    );
    bgGrad.addColorStop(0, palette.bgGradStart);
    bgGrad.addColorStop(0.55, palette.bgGradMid);
    bgGrad.addColorStop(1, palette.bgGradEnd);
    c2d.fillStyle = bgGrad;
    c2d.fillRect(0, 0, width, height);

    // B. 中心柔和呼吸光场 (Central Breathing Aura)
    if (glowIntensity > 0.05) {
      c2d.save();
      c2d.globalCompositeOperation = "screen";

      const auraRadius = width * 0.45 * breathFactor;
      const auraAlpha = (0.08 + state.smoothedEnergy * 0.12) * glowIntensity;
      const auraGrad = c2d.createRadialGradient(
        width * 0.5,
        height * 0.52,
        0,
        width * 0.5,
        height * 0.52,
        auraRadius
      );
      auraGrad.addColorStop(0, palette.primaryGlow.replace(/[\d.]+\)$/, `${auraAlpha})`));
      auraGrad.addColorStop(0.5, palette.primaryGlow.replace(/[\d.]+\)$/, `${auraAlpha * 0.3})`));
      auraGrad.addColorStop(1, "rgba(0,0,0,0)");

      c2d.fillStyle = auraGrad;
      c2d.beginPath();
      c2d.arc(width * 0.5, height * 0.52, auraRadius, 0, Math.PI * 2);
      c2d.fill();
      c2d.restore();
    }

    // C. 柔美散焦焦外光斑 (Soft Lens Bokeh Orbs - 极度柔润，无硬边)
    c2d.save();
    c2d.globalCompositeOperation = "screen";

    for (const orb of state.bokehOrbs) {
      orb.y += orb.vy;
      orb.x += orb.vx + Math.sin(state.timeAccumulator * 0.3 + orb.phase) * 0.12;

      if (orb.y < -orb.baseRadius * 2) {
        orb.y = height + orb.baseRadius * 2;
        orb.x = Math.random() * width;
      }

      const pulse = 1.0 + Math.sin(state.timeAccumulator * orb.speed + orb.phase) * 0.15;
      const curR = orb.baseRadius * pulse * breathFactor;
      const alpha = orb.baseAlpha * glowIntensity * (0.7 + state.smoothedBass * 0.6);

      const orbGrad = c2d.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, curR);
      const colorStr = orb.colorType === "warm" ? palette.bokehColorA : palette.bokehColorB;

      orbGrad.addColorStop(0, colorStr.replace(/[\d.]+\)$/, `${alpha * 0.85})`));
      orbGrad.addColorStop(0.4, colorStr.replace(/[\d.]+\)$/, `${alpha * 0.35})`));
      orbGrad.addColorStop(0.8, colorStr.replace(/[\d.]+\)$/, `${alpha * 0.08})`));
      orbGrad.addColorStop(1, "rgba(0,0,0,0)");

      c2d.fillStyle = orbGrad;
      c2d.beginPath();
      c2d.arc(orb.x, orb.y, curR, 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.restore();

    // D. 悬浮日光微尘 (Ambient Fine Dust)
    c2d.save();
    c2d.globalCompositeOperation = "screen";
    for (const dust of state.ambientDust) {
      dust.y += dust.vy;
      dust.x += dust.vx + Math.sin(state.timeAccumulator * dust.freq + dust.phase) * 0.2;

      if (dust.y < -10) {
        dust.y = height + 10;
        dust.x = Math.random() * width;
      }

      const twinkle = (Math.sin(state.timeAccumulator * dust.freq * 2 + dust.phase) + 1) * 0.5;
      const dustAlpha = dust.baseAlpha * (0.3 + twinkle * 0.7 + state.smoothedTreble * 0.4);

      c2d.fillStyle = palette.dustColor.replace(/[\d.]+\)$/, `${dustAlpha})`);
      c2d.beginPath();
      c2d.arc(dust.x, dust.y, dust.size * (1.0 + state.smoothedTreble * 0.3), 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.restore();

    // E. 歌词解构星尘粒子流 (Lyric Stardust Embers)
    if (state.stardustParticles.length > 0) {
      c2d.save();
      c2d.globalCompositeOperation = "screen";
      for (let i = state.stardustParticles.length - 1; i >= 0; i--) {
        const p = state.stardustParticles[i];
        p.life += deltaTime;
        p.x += p.vx;
        p.y += p.vy;

        const progress = p.life / p.maxLife;
        if (progress >= 1.0) {
          state.stardustParticles.splice(i, 1);
          continue;
        }

        const pAlpha = p.alpha * (1.0 - progress) * (Math.sin(progress * Math.PI) || 0);
        c2d.fillStyle = p.color.replace(/[\d.]+\)$/, `${pAlpha})`);
        c2d.beginPath();
        c2d.arc(p.x, p.y, p.size * (1.0 - progress * 0.5), 0, Math.PI * 2);
        c2d.fill();
      }
      c2d.restore();
    }

    // F. 大师级电影感歌词排版（景深排版、大字距、逐字柔和高光流转、纯净无杂质）
    if (state.lineAlpha > 0.005 && state.activeLine) {
      c2d.save();
      c2d.textAlign = "center";
      c2d.textBaseline = "middle";

      const heroY = height * 0.54;
      const heroX = width * 0.5;
      const fSize = heroFontSize * breathFactor;

      // 1. 上下句景深排版 (Rack Focus Context Lines)
      if (showContextLines && state.contextAlpha > 0.005) {
        c2d.save();
        const subFontSize = Math.max(14, Math.round(fSize * 0.65));
        c2d.font = `300 ${subFontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", serif`;

        // 上一句（较淡，稍高）
        if (state.prevLine) {
          c2d.fillStyle = palette.contextText.replace(/[\d.]+\)$/, `${0.22 * state.contextAlpha})`);
          c2d.fillText(state.prevLine, heroX, heroY - fSize * 1.55);
        }

        // 下一句（稍清晰，稍低）
        if (state.nextLine) {
          c2d.fillStyle = palette.contextText.replace(/[\d.]+\)$/, `${0.28 * state.contextAlpha})`);
          c2d.fillText(state.nextLine, heroX, heroY + fSize * 1.55);
        }
        c2d.restore();
      }

      // 2. 主歌词背后柔和光晕 (Subtle Ambient Back-Bloom)
      const textGlowGrad = c2d.createRadialGradient(heroX, heroY, 0, heroX, heroY, width * 0.28);
      const glowAlpha = (0.1 + state.smoothedEnergy * 0.15) * state.lineAlpha;
      textGlowGrad.addColorStop(0, palette.primaryGlow.replace(/[\d.]+\)$/, `${glowAlpha})`));
      textGlowGrad.addColorStop(
        0.6,
        palette.primaryGlow.replace(/[\d.]+\)$/, `${glowAlpha * 0.2})`)
      );
      textGlowGrad.addColorStop(1, "rgba(0,0,0,0)");
      c2d.fillStyle = textGlowGrad;
      c2d.beginPath();
      c2d.arc(heroX, heroY, width * 0.28, 0, Math.PI * 2);
      c2d.fill();

      // 3. 电影大光圈镜头微色散 (Chromatic RGB Separation)
      c2d.font = `400 ${fSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", "STSong", serif`;

      if (chromaticAberration > 0.05) {
        const caOffset = (0.8 * chromaticAberration + state.smoothedBass * 0.8) * breathFactor;

        c2d.save();
        c2d.globalCompositeOperation = "screen";

        // 红暖通道
        c2d.fillStyle = `rgba(255, 140, 110, ${0.18 * state.lineAlpha})`;
        c2d.fillText(state.activeLine, heroX - caOffset, heroY);

        // 青冷通道
        c2d.fillStyle = `rgba(110, 200, 255, ${0.18 * state.lineAlpha})`;
        c2d.fillText(state.activeLine, heroX + caOffset, heroY);

        c2d.restore();
      }

      // 4. 主文字温润发光渲染
      c2d.shadowColor = palette.primaryGlow;
      c2d.shadowBlur = 12 * breathFactor;
      c2d.fillStyle = palette.heroText;
      c2d.globalAlpha = state.lineAlpha;
      c2d.fillText(state.activeLine, heroX, heroY);

      // 5. 逐字流光唤醒 (Luminescent Character Sweep)
      c2d.shadowBlur = 0;
      const textMetrics = c2d.measureText(state.activeLine);
      const textW = textMetrics.width;
      if (textW > 0 && state.lineProgress > 0) {
        const sweepX = heroX - textW / 2 + textW * state.lineProgress;
        const sweepGrad = c2d.createRadialGradient(sweepX, heroY, 0, sweepX, heroY, 42);
        sweepGrad.addColorStop(0, `rgba(255, 255, 255, ${0.85 * state.lineAlpha})`);
        sweepGrad.addColorStop(
          0.5,
          palette.primaryGlow.replace(/[\d.]+\)$/, `${0.3 * state.lineAlpha})`)
        );
        sweepGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

        c2d.save();
        c2d.globalCompositeOperation = "source-atop";
        c2d.fillStyle = sweepGrad;
        c2d.fillText(state.activeLine, heroX, heroY);
        c2d.restore();
      }

      c2d.restore();
    }

    // G. 35mm 胶片微粒质感 (35mm Film Grain)
    if (filmGrain > 0.05 && state.grainCanvas) {
      c2d.save();
      c2d.globalCompositeOperation = "overlay";
      c2d.globalAlpha = Math.min(0.16, filmGrain * 0.12);
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

    // H. 电影暗角 (Vignette)
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
      ctx.private.bokehOrbs = [];
      ctx.private.ambientDust = [];
      ctx.private.stardustParticles = [];
      ctx.private.parsedLyrics = [];
      ctx.private.grainCanvas = null;
    }
  },
};
