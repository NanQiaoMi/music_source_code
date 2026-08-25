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

export interface FloatingLyricWord {
  text: string;
  x: number;
  y: number;
  z: number; // 0.4 (close) ~ 2.0 (far)
  vx: number;
  vy: number;
  baseSize: number;
  alpha: number;
  currentAlpha: number;
  rotation: number;
  rotationSpeed: number;
  phase: number;
  freq: number;
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
  depth: number;
  colorType: "warm" | "cool" | "glow";
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

export interface LightWaveRibbon {
  baseY: number;
  amplitude: number;
  speed: number;
  freq: number;
  phase: number;
  thickness: number;
  alpha: number;
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
  lightRibbons: LightWaveRibbon[];
  parsedLyrics: ParsedLrcLine[];
  lastRawLyrics: string;
  activeLineText: string;
  activeLineProgress: number;
  heroAlpha: number;
  hasActiveLyrics: boolean;
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  breathPhase: number;
  timeAccumulator: number;
  grainCanvas: HTMLCanvasElement | null;
}

// =========================================================================
// 2. Color Palettes (Cinematic & Atmospheric)
// =========================================================================

export interface ColorPalette {
  name: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  primary: string;
  secondary: string;
  accent: string;
  bokehWarm: string;
  bokehCool: string;
  dustColor: string;
  heroText: string;
  heroGlow: string;
  ambientLight: string;
}

const COLOR_PALETTES: ColorPalette[] = [
  // 0: 暮色琥珀 (Sunset Amber - Warm 35mm Film)
  {
    name: "暮色琥珀",
    bgGradStart: "#120a06",
    bgGradMid: "#0a0604",
    bgGradEnd: "#040202",
    primary: "rgba(255, 195, 120, 0.95)",
    secondary: "rgba(240, 140, 80, 0.85)",
    accent: "rgba(255, 230, 180, 0.9)",
    bokehWarm: "rgba(255, 170, 90, 0.22)",
    bokehCool: "rgba(210, 110, 60, 0.15)",
    dustColor: "rgba(255, 220, 160, 0.65)",
    heroText: "#fffdfa",
    heroGlow: "rgba(255, 185, 110, 0.45)",
    ambientLight: "rgba(255, 160, 80, 0.06)",
  },
  // 1: 月白柔雾 (Moonlight Mist - Cool Ethereal)
  {
    name: "月白柔雾",
    bgGradStart: "#080e18",
    bgGradMid: "#050910",
    bgGradEnd: "#020408",
    primary: "rgba(180, 220, 255, 0.95)",
    secondary: "rgba(120, 175, 235, 0.85)",
    accent: "rgba(220, 240, 255, 0.9)",
    bokehWarm: "rgba(140, 200, 255, 0.2)",
    bokehCool: "rgba(90, 140, 220, 0.15)",
    dustColor: "rgba(200, 235, 255, 0.65)",
    heroText: "#f8fbff",
    heroGlow: "rgba(130, 200, 255, 0.45)",
    ambientLight: "rgba(120, 180, 255, 0.06)",
  },
  // 2: 暮樱温霞 (Sakura Dusk - Romantic Dream)
  {
    name: "暮樱温霞",
    bgGradStart: "#140913",
    bgGradMid: "#0a0409",
    bgGradEnd: "#040104",
    primary: "rgba(255, 180, 215, 0.95)",
    secondary: "rgba(225, 120, 180, 0.85)",
    accent: "rgba(255, 215, 235, 0.9)",
    bokehWarm: "rgba(255, 140, 190, 0.22)",
    bokehCool: "rgba(180, 110, 220, 0.16)",
    dustColor: "rgba(255, 205, 230, 0.65)",
    heroText: "#fff5fa",
    heroGlow: "rgba(255, 150, 200, 0.45)",
    ambientLight: "rgba(235, 130, 190, 0.06)",
  },
  // 3: 薄荷晨曦 (Morning Mint - Fresh Lo-Fi)
  {
    name: "薄荷晨曦",
    bgGradStart: "#06130e",
    bgGradMid: "#030a07",
    bgGradEnd: "#010403",
    primary: "rgba(160, 240, 210, 0.95)",
    secondary: "rgba(90, 200, 160, 0.85)",
    accent: "rgba(215, 255, 235, 0.9)",
    bokehWarm: "rgba(120, 230, 190, 0.2)",
    bokehCool: "rgba(80, 180, 210, 0.15)",
    dustColor: "rgba(180, 250, 225, 0.65)",
    heroText: "#f4fffb",
    heroGlow: "rgba(110, 230, 180, 0.45)",
    ambientLight: "rgba(100, 220, 170, 0.06)",
  },
  // 4: 胶片纯粹 (Cinematic Film Mono)
  {
    name: "胶片纯粹",
    bgGradStart: "#0e0e10",
    bgGradMid: "#070708",
    bgGradEnd: "#020203",
    primary: "rgba(240, 240, 240, 0.95)",
    secondary: "rgba(180, 180, 185, 0.85)",
    accent: "rgba(255, 255, 255, 0.9)",
    bokehWarm: "rgba(220, 220, 225, 0.18)",
    bokehCool: "rgba(150, 150, 160, 0.14)",
    dustColor: "rgba(245, 245, 250, 0.6)",
    heroText: "#fcfcfc",
    heroGlow: "rgba(210, 210, 220, 0.35)",
    ambientLight: "rgba(200, 200, 210, 0.05)",
  },
];

// =========================================================================
// 3. LRC Parser & Film Grain
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
    if (
      !pureText ||
      pureText.startsWith("[ti:") ||
      pureText.startsWith("[ar:") ||
      pureText.startsWith("[al:")
    ) {
      continue;
    }

    for (const match of matches) {
      const min = parseInt(match[1], 10) || 0;
      const sec = parseInt(match[2], 10) || 0;
      const ms = match[3] ? parseInt(match[3].padEnd(3, "0").slice(0, 3), 10) : 0;
      const timeInSec = min * 60 + sec + ms / 1000;

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
      data[i + 3] = Math.floor(Math.random() * 38);
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
    name: "柔焦散景微光",
    type: "number",
    mode: "basic",
    min: 0,
    max: 2.0,
    step: 0.05,
    default: 1.0,
  },
  {
    id: "ambientLightIntensity",
    name: "环境流动光带",
    type: "number",
    mode: "basic",
    min: 0,
    max: 2.0,
    step: 0.05,
    default: 1.0,
  },
  {
    id: "floatingSpeed",
    name: "微尘浮动速度",
    type: "number",
    mode: "basic",
    min: 0.2,
    max: 2.5,
    step: 0.1,
    default: 1.0,
  },
  // Professional Mode
  {
    id: "filmGrain",
    name: "35mm胶片质感",
    type: "number",
    mode: "professional",
    min: 0,
    max: 1.0,
    step: 0.05,
    default: 0.35,
  },
  {
    id: "chromaticAberration",
    name: "镜头微色散",
    type: "number",
    mode: "professional",
    min: 0,
    max: 2.0,
    step: 0.1,
    default: 0.8,
  },
  {
    id: "breathingDepth",
    name: "呼吸律动起伏",
    type: "number",
    mode: "professional",
    min: 0,
    max: 2.0,
    step: 0.1,
    default: 1.0,
  },
  // Expert Mode
  {
    id: "heroFontSize",
    name: "歌词基准字号",
    type: "number",
    mode: "expert",
    min: 20,
    max: 42,
    step: 1,
    default: 28,
  },
  {
    id: "vignetteStrength",
    name: "电影暗角深度",
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
    "专为温柔抒情慢歌设计的电影级光影歌词可视化，有歌词时优雅浮现，无歌词时呈现纯粹呼吸感光影背景",
  preferredEngine: "canvas",
  parameters: PARAMETERS,

  init(ctx: RenderContext) {
    const width = ctx.width || 1280;
    const height = ctx.height || 720;

    // 1. 生成细腻、高斯衰减的焦外光斑（避免生硬大泡泡，采用 12~45px 层次交错）
    const bokehOrbs: CinematicBokehOrb[] = [];
    const orbCount = 32;
    for (let i = 0; i < orbCount; i++) {
      const depth = 0.3 + Math.random() * 1.7; // 深度
      const baseR = (14 + Math.random() * 32) * (1.8 - depth * 0.4);
      bokehOrbs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: baseR,
        baseRadius: baseR,
        vx: (Math.random() - 0.5) * 0.18,
        vy: -0.08 - Math.random() * 0.22,
        alpha: 0.08 + Math.random() * 0.2,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.3 + Math.random() * 0.6,
        depth,
        colorType: Math.random() > 0.45 ? "warm" : Math.random() > 0.5 ? "glow" : "cool",
      });
    }

    // 2. 生成悬浮微尘 (Sunlit Atmospheric Dust Motes)
    const dustMotes: SunlitDustMote[] = [];
    const dustCount = 180;
    for (let i = 0; i < dustCount; i++) {
      dustMotes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -0.12 - Math.random() * 0.28,
        alpha: 0.15 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.6 + Math.random() * 1.8,
      });
    }

    // 3. 生成流动光浪 (Ambient Light Ribbons / Caustics)
    const lightRibbons: LightWaveRibbon[] = [
      {
        baseY: height * 0.35,
        amplitude: 60,
        speed: 0.18,
        freq: 0.0012,
        phase: 0,
        thickness: 160,
        alpha: 0.04,
      },
      {
        baseY: height * 0.62,
        amplitude: 90,
        speed: 0.25,
        freq: 0.0016,
        phase: 2.1,
        thickness: 220,
        alpha: 0.05,
      },
      {
        baseY: height * 0.82,
        amplitude: 70,
        speed: 0.15,
        freq: 0.001,
        phase: 4.3,
        thickness: 180,
        alpha: 0.035,
      },
    ];

    // 4. 浮字池（初始为空，只有在真正唱到歌词时才从歌词中动态填充）
    const floatingWords: FloatingLyricWord[] = [];

    const state: CinematicLyricDriftState = {
      floatingWords,
      bokehOrbs,
      dustMotes,
      lightRibbons,
      parsedLyrics: [],
      lastRawLyrics: "",
      activeLineText: "",
      activeLineProgress: 0,
      heroAlpha: 0,
      hasActiveLyrics: false,
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
    // 1. 参数提取与调色板
    // -------------------------------------------------------------
    const schemeIndex = Math.max(
      0,
      Math.min(COLOR_PALETTES.length - 1, Math.round(params.colorScheme ?? 0))
    );
    const palette = COLOR_PALETTES[schemeIndex];

    const bokehIntensity = params.bokehIntensity ?? 1.0;
    const ambientLightIntensity = params.ambientLightIntensity ?? 1.0;
    const floatingSpeed = params.floatingSpeed ?? 1.0;
    const filmGrain = params.filmGrain ?? 0.35;
    const chromaticAberration = params.chromaticAberration ?? 0.8;
    const breathingDepth = params.breathingDepth ?? 1.0;
    const heroFontSize = params.heroFontSize ?? 28;
    const vignetteStrength = params.vignetteStrength ?? 0.65;

    // -------------------------------------------------------------
    // 2. 音频数据平滑与生命呼吸节律
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
      (state.breathPhase + deltaTime * (0.55 + state.smoothedEnergy * 0.6) * breathingDepth) %
      (Math.PI * 2);
    const breathSin = Math.sin(state.breathPhase);
    const breathFactor = 1.0 + breathSin * 0.08 * breathingDepth + state.smoothedBass * 0.15;

    // -------------------------------------------------------------
    // 3. 严格判定当前是否有正在演唱的歌词（无词时绝对不显示假诗句！）
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
      state.floatingWords = []; // 清空之前的浮字
    }

    let detectedLine = "";
    let detectedProgress = 0;
    let isSingingNow = false;

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
        const currLine = state.parsedLyrics[activeIdx];
        const nextLine = state.parsedLyrics[activeIdx + 1];
        const lineDuration = nextLine ? Math.max(1.0, nextLine.time - currLine.time) : 5.5;
        const elapsed = currentTime - currLine.time;

        // 估算演唱持续时间（每字约 0.35s ~ 0.45s，最少 2.5s）
        const estimatedDuration = Math.min(
          lineDuration,
          Math.max(2.2, currLine.text.length * 0.38)
        );

        // 只有在时间窗口内才认为是正在演唱这句歌词
        if (elapsed >= 0 && elapsed <= estimatedDuration + 1.2) {
          isSingingNow = true;
          detectedLine = currLine.text;
          detectedProgress = Math.min(
            1.0,
            Math.max(0.0, elapsed / Math.max(1.0, estimatedDuration))
          );

          // 当有歌词演唱时，动态生成这句歌词及上下文的漂浮词汇粒子
          if (state.floatingWords.length < 16 && currLine.words && currLine.words.length > 0) {
            const word = currLine.words[Math.floor(Math.random() * currLine.words.length)];
            const z = 0.4 + Math.random() * 1.5;
            const baseSize = 13 + (1.6 - z) * 8;
            state.floatingWords.push({
              text: word,
              x: width * 0.25 + Math.random() * width * 0.5,
              y: height * 0.65 + (Math.random() - 0.5) * 40,
              z,
              vx: (Math.random() - 0.5) * 0.25,
              vy: -0.35 * (2.0 - z) - Math.random() * 0.2,
              baseSize,
              alpha: 0.25 + (1.8 - z) * 0.3,
              currentAlpha: 0,
              rotation: (Math.random() - 0.5) * 0.06,
              rotationSpeed: (Math.random() - 0.5) * 0.003,
              phase: Math.random() * Math.PI * 2,
              freq: 0.4 + Math.random() * 0.5,
              colorType: Math.random() > 0.6 ? "primary" : Math.random() > 0.4 ? "accent" : "white",
            });
          }
        }
      }
    }

    state.activeLineText = detectedLine;
    state.activeLineProgress = detectedProgress;
    state.hasActiveLyrics = isSingingNow;

    // 平滑淡入淡出歌词与浮字透明度
    const targetHeroAlpha = isSingingNow ? 1.0 : 0.0;
    state.heroAlpha += (targetHeroAlpha - state.heroAlpha) * 0.08;

    // -------------------------------------------------------------
    // 4. 绘制渲染流水线
    // -------------------------------------------------------------

    // A. 电影级深邃环境底色
    const bgGrad = c2d.createRadialGradient(
      width * 0.5,
      height * 0.45,
      10,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.85
    );
    bgGrad.addColorStop(0, palette.bgGradStart);
    bgGrad.addColorStop(0.55, palette.bgGradMid);
    bgGrad.addColorStop(1, palette.bgGradEnd);
    c2d.fillStyle = bgGrad;
    c2d.fillRect(0, 0, width, height);

    // B. 柔和有机流光光浪 (Ambient Curved Light Ribbons)
    if (ambientLightIntensity > 0.05) {
      c2d.save();
      c2d.globalCompositeOperation = "screen";

      for (const ribbon of state.lightRibbons) {
        ribbon.phase += deltaTime * ribbon.speed * (1.0 + state.smoothedEnergy * 0.5);

        const currentY = ribbon.baseY + Math.sin(ribbon.phase) * ribbon.amplitude * breathFactor;
        const currentThickness = ribbon.thickness * breathFactor;
        const ribbonAlpha = ribbon.alpha * ambientLightIntensity * (0.8 + state.smoothedMid * 0.8);

        const waveGrad = c2d.createLinearGradient(
          0,
          currentY - currentThickness * 0.5,
          0,
          currentY + currentThickness * 0.5
        );
        waveGrad.addColorStop(0, "rgba(0,0,0,0)");
        waveGrad.addColorStop(0.5, palette.ambientLight.replace(/[\d.]+\)$/, `${ribbonAlpha})`));
        waveGrad.addColorStop(1, "rgba(0,0,0,0)");

        c2d.fillStyle = waveGrad;
        c2d.beginPath();
        c2d.moveTo(0, currentY);

        // 柔和贝塞尔波形
        const segs = 6;
        const stepX = width / segs;
        for (let s = 0; s <= segs; s++) {
          const sx = s * stepX;
          const sy =
            currentY + Math.sin(sx * ribbon.freq + ribbon.phase) * (ribbon.amplitude * 0.5);
          if (s === 0) {
            c2d.moveTo(sx, sy - currentThickness * 0.5);
          } else {
            const prevX = (s - 1) * stepX;
            const prevY =
              currentY + Math.sin(prevX * ribbon.freq + ribbon.phase) * (ribbon.amplitude * 0.5);
            const cx = (prevX + sx) / 2;
            const cy = (prevY + sy) / 2;
            if (typeof c2d.quadraticCurveTo === "function") {
              c2d.quadraticCurveTo(
                prevX,
                prevY - currentThickness * 0.5,
                cx,
                cy - currentThickness * 0.5
              );
            } else {
              c2d.lineTo(cx, cy - currentThickness * 0.5);
            }
          }
        }
        c2d.lineTo(width, height);
        c2d.lineTo(0, height);
        c2d.closePath();
        c2d.fill();
      }

      c2d.restore();
    }

    // C. 真实大光圈高斯衰减散景微光 (Soft Lens Bokeh Orbs)
    if (bokehIntensity > 0.05) {
      c2d.save();
      c2d.globalCompositeOperation = "screen";

      for (const orb of state.bokehOrbs) {
        orb.y += orb.vy * floatingSpeed;
        orb.x += orb.vx * floatingSpeed + Math.sin(state.timeAccumulator * 0.4 + orb.phase) * 0.15;

        // 边界环回
        if (orb.y < -orb.radius * 2) {
          orb.y = height + orb.radius * 2;
          orb.x = Math.random() * width;
        }

        const pulse = 1.0 + Math.sin(state.timeAccumulator * orb.pulseSpeed + orb.phase) * 0.12;
        const currentR = orb.baseRadius * pulse * breathFactor * bokehIntensity;
        const alpha = orb.alpha * bokehIntensity * (0.6 + state.smoothedBass * 0.7);

        // 真实高斯柔和衰减渐变（无硬边！）
        const orbGrad = c2d.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, currentR);
        const colorBase =
          orb.colorType === "warm"
            ? palette.bokehWarm
            : orb.colorType === "glow"
              ? palette.heroGlow
              : palette.bokehCool;

        orbGrad.addColorStop(0, colorBase.replace(/[\d.]+\)$/, `${alpha * 0.9})`));
        orbGrad.addColorStop(0.35, colorBase.replace(/[\d.]+\)$/, `${alpha * 0.45})`));
        orbGrad.addColorStop(0.7, colorBase.replace(/[\d.]+\)$/, `${alpha * 0.12})`));
        orbGrad.addColorStop(1, "rgba(0,0,0,0)");

        c2d.fillStyle = orbGrad;
        c2d.beginPath();
        c2d.arc(orb.x, orb.y, currentR, 0, Math.PI * 2);
        c2d.fill();
      }
      c2d.restore();
    }

    // D. 悬浮光尘微粒 (Sunlit Dust Motes)
    c2d.save();
    c2d.globalCompositeOperation = "screen";
    for (const dust of state.dustMotes) {
      dust.y += dust.vy * floatingSpeed;
      dust.x += dust.vx * floatingSpeed + Math.sin(state.timeAccumulator * 0.8 + dust.phase) * 0.25;

      if (dust.y < -10) {
        dust.y = height + 10;
        dust.x = Math.random() * width;
      }

      const twinkle = (Math.sin(state.timeAccumulator * dust.twinkleSpeed + dust.phase) + 1) * 0.5;
      const dustAlpha = dust.alpha * (0.25 + twinkle * 0.75 + state.smoothedTreble * 0.5);
      const dustR = dust.size * (1.0 + state.smoothedTreble * 0.35);

      c2d.fillStyle = palette.dustColor.replace(/[\d.]+\)$/, `${dustAlpha})`);
      c2d.beginPath();
      c2d.arc(dust.x, dust.y, dustR, 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.restore();

    // E. 漂浮歌词文字粒子流（仅在有歌词且唱起时优雅升腾，无词时平滑消散）
    if (state.floatingWords.length > 0) {
      c2d.save();
      c2d.textAlign = "center";
      c2d.textBaseline = "middle";

      for (let i = state.floatingWords.length - 1; i >= 0; i--) {
        const wordObj = state.floatingWords[i];
        wordObj.y += wordObj.vy * floatingSpeed;
        wordObj.x +=
          wordObj.vx * floatingSpeed +
          Math.sin(state.timeAccumulator * wordObj.freq + wordObj.phase) *
            (0.5 * (2.0 - wordObj.z));
        wordObj.rotation += wordObj.rotationSpeed;

        // 如果当前没有歌词正在演唱，浮字逐渐淡出
        const targetWordAlpha = isSingingNow ? wordObj.alpha : 0;
        wordObj.currentAlpha += (targetWordAlpha - wordObj.currentAlpha) * 0.05;

        // 移出屏幕顶部或透明度极低时清除
        if (wordObj.y < -40 || (!isSingingNow && wordObj.currentAlpha < 0.01)) {
          state.floatingWords.splice(i, 1);
          continue;
        }

        if (wordObj.currentAlpha > 0.01) {
          const zFactor = 2.0 - wordObj.z;
          const fontSize = wordObj.baseSize * breathFactor;
          const alpha = wordObj.currentAlpha * (0.6 + totalEnergy * 0.4);

          c2d.save();
          c2d.translate(wordObj.x, wordObj.y);
          c2d.rotate(wordObj.rotation);

          c2d.font = `300 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", "STSong", serif`;
          c2d.shadowColor = palette.heroGlow;
          c2d.shadowBlur = (6 + zFactor * 5) * breathFactor;

          const colorStr =
            wordObj.colorType === "primary"
              ? palette.primary
              : wordObj.colorType === "accent"
                ? palette.accent
                : palette.heroText;

          c2d.fillStyle = colorStr.replace(/[\d.]+\)$/, `${alpha})`);
          c2d.fillText(wordObj.text, 0, 0);
          c2d.restore();
        }
      }
      c2d.restore();
    }

    // F. 焦点歌词排版（仅在有歌词正在演唱时显示，无方块遮罩，纯净光影）
    if (state.heroAlpha > 0.01 && state.activeLineText) {
      c2d.save();
      const heroY = height * 0.62;
      const heroX = width * 0.5;
      const fSize = heroFontSize * breathFactor;

      c2d.globalAlpha = state.heroAlpha;
      c2d.textAlign = "center";
      c2d.textBaseline = "middle";

      c2d.font = `400 ${fSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", "STSong", serif`;

      // 1. 背后极柔和的微光晕（无边界平滑衰减）
      const bloomGrad = c2d.createRadialGradient(heroX, heroY, 0, heroX, heroY, width * 0.35);
      const bloomAlpha = (0.08 + totalEnergy * 0.12) * breathFactor * state.heroAlpha;
      bloomGrad.addColorStop(0, palette.heroGlow.replace(/[\d.]+\)$/, `${bloomAlpha})`));
      bloomGrad.addColorStop(0.5, palette.heroGlow.replace(/[\d.]+\)$/, `${bloomAlpha * 0.3})`));
      bloomGrad.addColorStop(1, "rgba(0,0,0,0)");
      c2d.fillStyle = bloomGrad;
      c2d.beginPath();
      c2d.arc(heroX, heroY, width * 0.35, 0, Math.PI * 2);
      c2d.fill();

      // 2. 电影大光圈镜头微色散 (Chromatic Aberration - RGB Shift)
      if (chromaticAberration > 0.1) {
        const caOffset = (0.9 * chromaticAberration + state.smoothedBass * 1.2) * breathFactor;

        c2d.save();
        c2d.globalCompositeOperation = "screen";

        // 红暖通道微偏移
        c2d.fillStyle = `rgba(255, 130, 110, ${0.2 * state.heroAlpha})`;
        c2d.fillText(state.activeLineText, heroX - caOffset, heroY);

        // 青冷通道微偏移
        c2d.fillStyle = `rgba(110, 210, 255, ${0.2 * state.heroAlpha})`;
        c2d.fillText(state.activeLineText, heroX + caOffset, heroY);

        c2d.restore();
      }

      // 3. 主文字渲染（带柔和阴影发光，无任何生硬方块）
      c2d.shadowColor = palette.heroGlow;
      c2d.shadowBlur = 14 * breathFactor;
      c2d.fillStyle = palette.heroText;
      c2d.fillText(state.activeLineText, heroX, heroY);

      // 4. 逐字流光高光（纯文字级流光，非方块）
      c2d.shadowBlur = 0;
      const textMetrics = c2d.measureText(state.activeLineText);
      const textW = textMetrics.width;
      if (textW > 0 && state.activeLineProgress > 0) {
        const sweepX = heroX - textW / 2 + textW * state.activeLineProgress;
        const sweepGrad = c2d.createRadialGradient(sweepX, heroY, 0, sweepX, heroY, 45);
        sweepGrad.addColorStop(0, `rgba(255, 255, 255, ${0.8 * state.heroAlpha})`);
        sweepGrad.addColorStop(
          0.5,
          palette.accent.replace(/[\d.]+\)$/, `${0.35 * state.heroAlpha})`)
        );
        sweepGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

        c2d.save();
        c2d.globalCompositeOperation = "source-atop";
        c2d.fillStyle = sweepGrad;
        c2d.fillText(state.activeLineText, heroX, heroY);
        c2d.restore();
      }

      c2d.restore();
    }

    // G. 35mm 胶片微粒质感 (Film Grain)
    if (filmGrain > 0.05 && state.grainCanvas) {
      c2d.save();
      c2d.globalCompositeOperation = "overlay";
      c2d.globalAlpha = Math.min(0.18, filmGrain * 0.14);
      const pattern = c2d.createPattern(state.grainCanvas, "repeat");
      if (pattern) {
        const grainOffsetX = (Math.random() - 0.5) * 30;
        const grainOffsetY = (Math.random() - 0.5) * 30;
        c2d.translate(grainOffsetX, grainOffsetY);
        c2d.fillStyle = pattern;
        c2d.fillRect(-30, -30, width + 60, height + 60);
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
    // 自动响应
  },

  destroy(ctx?: RenderContext) {
    if (ctx && ctx.private) {
      ctx.private.floatingWords = [];
      ctx.private.bokehOrbs = [];
      ctx.private.dustMotes = [];
      ctx.private.lightRibbons = [];
      ctx.private.parsedLyrics = [];
      ctx.private.grainCanvas = null;
    }
  },
};
