/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectContext } from "./types";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";

// =========================================================================
// 1. Data Structures & Types
// =========================================================================

interface FloatingWordItem {
  text: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  baseSize: number;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
  phase: number;
  freq: number;
  colorType: "primary" | "secondary" | "accent" | "white";
}

interface BokehOrbItem {
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

interface DustMoteItem {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
  phase: number;
  twinkleSpeed: number;
}

interface ParsedLine {
  time: number;
  text: string;
  words?: string[];
}

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

interface PaletteConfig {
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

const COLOR_PALETTES: PaletteConfig[] = [
  // 0: 暮色琥珀 (Sunset Amber - Warm 35mm Cinema)
  {
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

// 内部模块单例状态缓存
let parsedLyricsCache: ParsedLine[] = [];
let lastRawLyricsCache = "";
let grainCanvasCache: HTMLCanvasElement | null = null;
let poemTimer = 0;
let poemIndex = 0;
let breathAngle = 0;

function parseLrc(lrcText: string): ParsedLine[] {
  if (!lrcText || typeof lrcText !== "string") return [];
  const lines = lrcText.split(/\r?\n/);
  const result: ParsedLine[] = [];
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

function extractVocabulary(lyrics: ParsedLine[]): string[] {
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

function getFilmGrainCanvas(): HTMLCanvasElement | null {
  if (grainCanvasCache) return grainCanvasCache;
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
      data[i + 3] = Math.floor(Math.random() * 45);
    }
    ctx.putImageData(imgData, 0, 0);
    grainCanvasCache = canvas;
    return grainCanvasCache;
  } catch {
    return null;
  }
}

// =========================================================================
// 2. Main Draw Function
// =========================================================================

export function drawCinematicLyricDrift(effectCtx: EffectContext) {
  const { ctx, width, height, data, time, refs, params } = effectCtx;

  // -------------------------------------------------------------
  // 1. 参数提取与调色板选择
  // -------------------------------------------------------------
  const schemeIndex = Math.max(
    0,
    Math.min(COLOR_PALETTES.length - 1, Math.round(params?.colorScheme ?? 0))
  );
  const palette = COLOR_PALETTES[schemeIndex];

  const bokehIntensity = params?.bokehIntensity ?? 1.2;
  const floatingSpeed = params?.floatingSpeed ?? 1.0;
  const godraysIntensity = params?.godraysIntensity ?? 1.1;
  const filmGrain = params?.filmGrain ?? 0.45;
  const chromaticAberration = params?.chromaticAberration ?? 1.2;
  const breathingDepth = params?.breathingDepth ?? 1.0;
  const heroFontSize = params?.heroFontSize ?? 30;
  const anamorphicStreak = params?.anamorphicStreak ?? 1.0;
  const vignetteStrength = params?.vignetteStrength ?? 0.65;

  // -------------------------------------------------------------
  // 2. 音频数据指数平滑 & 呼吸律动计算
  // -------------------------------------------------------------
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

  const smoothFactor = 0.08;
  refs.smoothBass.current += (rawBass - refs.smoothBass.current) * smoothFactor;
  refs.smoothMid.current += (rawMid - refs.smoothMid.current) * smoothFactor;
  refs.smoothTreble.current += (rawTreble - refs.smoothTreble.current) * smoothFactor;

  const totalEnergy =
    refs.smoothBass.current * 0.5 + refs.smoothMid.current * 0.3 + refs.smoothTreble.current * 0.2;

  // 呼吸周期：约 4.8 秒一个完整舒张周期
  breathAngle = (breathAngle + 0.016 * (0.65 + totalEnergy * 0.8) * breathingDepth) % (Math.PI * 2);
  const breathSin = Math.sin(breathAngle);
  const breathFactor = 1.0 + breathSin * 0.12 * breathingDepth + refs.smoothBass.current * 0.2;

  // -------------------------------------------------------------
  // 3. 粒子池初始化与同步 (利用 refs.particles, refs.bokeh, refs.nebulaStars)
  // -------------------------------------------------------------

  // A. 漂浮词粒子池 (refs.particles)
  if (!refs.particles.current || refs.particles.current.length === 0) {
    const words: FloatingWordItem[] = [];
    const wordList = DEFAULT_VOCABULARY;
    const wordCount = 32;
    for (let i = 0; i < wordCount; i++) {
      const z = 0.4 + Math.random() * 1.6;
      const baseSize = 14 + (1.8 - z) * 10;
      words.push({
        text: wordList[i % wordList.length],
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.25 * (2.2 - z) - Math.random() * 0.2,
        baseSize: Math.max(12, baseSize),
        alpha: 0.2 + (2.0 - z) * 0.35,
        rotation: (Math.random() - 0.5) * 0.08,
        rotationSpeed: (Math.random() - 0.5) * 0.005,
        phase: Math.random() * Math.PI * 2,
        freq: 0.3 + Math.random() * 0.6,
        colorType: Math.random() > 0.6 ? "primary" : Math.random() > 0.4 ? "accent" : "white",
      });
    }
    refs.particles.current = words;
  }

  // B. 散焦光斑池 (refs.bokeh)
  if (!refs.bokeh.current || refs.bokeh.current.length === 0) {
    const orbs: BokehOrbItem[] = [];
    const orbCount = 42;
    for (let i = 0; i < orbCount; i++) {
      const baseR = 25 + Math.random() * 85;
      orbs.push({
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
    refs.bokeh.current = orbs;
  }

  // C. 悬浮微尘池 (refs.nebulaStars)
  if (!refs.nebulaStars.current || refs.nebulaStars.current.length === 0) {
    const dust: DustMoteItem[] = [];
    const dustCount = 220;
    for (let i = 0; i < dustCount; i++) {
      dust.push({
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
    refs.nebulaStars.current = dust;
  }

  // -------------------------------------------------------------
  // 4. 歌词状态同步与提取
  // -------------------------------------------------------------
  const audioState = useAudioStore.getState();
  const playerState = usePlayerStore.getState();
  const currentSong = audioState.currentSong || playerState.currentSong;
  const currentTime = audioState.currentTime || playerState.currentTime || 0;
  const rawLyrics = currentSong?.lyrics || "";

  if (rawLyrics !== lastRawLyricsCache) {
    lastRawLyricsCache = rawLyrics;
    parsedLyricsCache = parseLrc(rawLyrics);

    if (parsedLyricsCache.length > 0) {
      const vocab = extractVocabulary(parsedLyricsCache);
      refs.particles.current.forEach((w: FloatingWordItem, idx: number) => {
        w.text = vocab[idx % vocab.length];
      });
    }
  }

  let activeLine = "";
  let activeSub = "";
  let activeProgress = 0;

  if (parsedLyricsCache.length > 0) {
    let idx = -1;
    for (let i = 0; i < parsedLyricsCache.length; i++) {
      if (currentTime >= parsedLyricsCache[i].time) {
        idx = i;
      } else {
        break;
      }
    }
    if (idx >= 0) {
      const curr = parsedLyricsCache[idx];
      const next = parsedLyricsCache[idx + 1];
      activeLine = curr.text;

      const duration = next ? Math.max(0.5, next.time - curr.time) : 5.0;
      const elapsed = currentTime - curr.time;
      activeProgress = Math.min(1.0, Math.max(0.0, elapsed / duration));

      if (currentSong?.artist) {
        activeSub = `${currentSong.title || ""} · ${currentSong.artist}`;
      }
    }
  }

  if (!activeLine) {
    poemTimer += 0.016;
    if (poemTimer > 7.0) {
      poemTimer = 0;
      poemIndex = (poemIndex + 1) % POETIC_FALLBACK_LINES.length;
    }
    const poem = POETIC_FALLBACK_LINES[poemIndex];
    activeLine = poem.line;
    activeSub = poem.sub;
    activeProgress = (Math.sin(poemTimer * 0.4) + 1) / 2;
  }

  // -------------------------------------------------------------
  // 5. 绘制渲染流程
  // -------------------------------------------------------------

  // A. 深邃背景
  const bgGrad = ctx.createLinearGradient(0, 0, width * 0.8, height);
  bgGrad.addColorStop(0, palette.bgGradStart);
  bgGrad.addColorStop(1, palette.bgGradEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // B. 丁达尔斜向体积光柱 (God Rays)
  if (godraysIntensity > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const rayAngle = 0.65;
    const rayOriginX = width * 0.15 + Math.sin(time * 0.0003) * 60;
    const rayOriginY = -50;

    const rayCount = 5;
    for (let r = 0; r < rayCount; r++) {
      const rPhase = time * 0.0006 + r * 1.3;
      const rAlpha =
        (0.04 + Math.sin(rPhase) * 0.03 + refs.smoothTreble.current * 0.06) * godraysIntensity;
      const rayWidth = (120 + r * 45) * breathFactor;

      const rayGrad = ctx.createLinearGradient(
        rayOriginX + r * 90,
        rayOriginY,
        rayOriginX + r * 90 + Math.cos(rayAngle) * height * 1.4,
        rayOriginY + Math.sin(rayAngle) * height * 1.4
      );
      rayGrad.addColorStop(0, palette.lightRay.replace(/[\d.]+\)$/, `${rAlpha * 1.5})`));
      rayGrad.addColorStop(0.5, palette.lightRay.replace(/[\d.]+\)$/, `${rAlpha})`));
      rayGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(rayOriginX + r * 90 - rayWidth * 0.5, rayOriginY);
      ctx.lineTo(rayOriginX + r * 90 + rayWidth * 0.5, rayOriginY);
      ctx.lineTo(
        rayOriginX + r * 90 + Math.cos(rayAngle) * height * 1.4 + rayWidth * 1.8,
        height * 1.2
      );
      ctx.lineTo(
        rayOriginX + r * 90 + Math.cos(rayAngle) * height * 1.4 - rayWidth * 1.8,
        height * 1.2
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // C. 大光圈焦外散景光斑 (Bokeh Orbs)
  if (bokehIntensity > 0.05 && refs.bokeh.current) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const orb of refs.bokeh.current as BokehOrbItem[]) {
      orb.y += orb.vy * floatingSpeed;
      orb.x += orb.vx * floatingSpeed + Math.sin(time * 0.0008 + orb.phase) * 0.2;

      if (orb.y < -orb.radius * 2) {
        orb.y = height + orb.radius * 2;
        orb.x = Math.random() * width;
      }

      const pulse = 1.0 + Math.sin(time * 0.001 * orb.pulseSpeed + orb.phase) * 0.18;
      const currentR = orb.baseRadius * pulse * breathFactor * bokehIntensity;
      const alpha = orb.alpha * (0.7 + refs.smoothBass.current * 0.6);

      const orbGrad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, currentR);
      const colorBase =
        orb.colorType === "warm"
          ? palette.bokehWarm
          : orb.colorType === "glow"
            ? palette.heroGlow
            : palette.bokehCool;

      orbGrad.addColorStop(0, colorBase.replace(/[\d.]+\)$/, `${alpha * 0.8})`));
      orbGrad.addColorStop(0.7, colorBase.replace(/[\d.]+\)$/, `${alpha * 0.3})`));
      orbGrad.addColorStop(0.92, colorBase.replace(/[\d.]+\)$/, `${alpha * orb.rimIntensity})`));
      orbGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, currentR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // D. 宽银幕横向拉丝光晕 (Anamorphic Cinema Flare)
  if (anamorphicStreak > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const streakY = height * 0.62 + Math.sin(time * 0.0005) * 15;
    const streakAlpha = (0.08 + refs.smoothBass.current * 0.15) * anamorphicStreak;

    const streakGrad = ctx.createRadialGradient(
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

    ctx.fillStyle = streakGrad;
    ctx.save();
    ctx.scale(1, 0.06);
    ctx.beginPath();
    ctx.arc(width * 0.5, streakY / 0.06, width * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // E. 漂浮歌词文字粒子 (Floating Typography Words)
  if (refs.particles.current) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const wordObj of refs.particles.current as FloatingWordItem[]) {
      wordObj.y += wordObj.vy * floatingSpeed;
      wordObj.x +=
        wordObj.vx * floatingSpeed +
        Math.sin(time * 0.001 * wordObj.freq + wordObj.phase) * (0.6 * (2.2 - wordObj.z));
      wordObj.rotation += wordObj.rotationSpeed;

      if (wordObj.y < -50) {
        wordObj.y = height + 40;
        wordObj.x = Math.random() * width;
      }

      const zFactor = 2.2 - wordObj.z;
      const fontSize = wordObj.baseSize * breathFactor;
      const alpha = Math.min(1.0, wordObj.alpha * (0.6 + totalEnergy * 0.5));

      ctx.save();
      ctx.translate(wordObj.x, wordObj.y);
      ctx.rotate(wordObj.rotation);

      ctx.font = `300 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", "STSong", serif`;
      ctx.shadowColor = palette.heroGlow;
      ctx.shadowBlur = (8 + zFactor * 6) * breathFactor;

      const fillAlpha = wordObj.colorType === "primary" ? alpha : alpha * 0.75;
      const colorStr =
        wordObj.colorType === "primary"
          ? palette.primary
          : wordObj.colorType === "accent"
            ? palette.accent
            : palette.heroText;

      ctx.fillStyle = colorStr.replace(/[\d.]+\)$/, `${fillAlpha})`);
      ctx.fillText(wordObj.text, 0, 0);

      if (wordObj.z < 0.9) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = palette.heroText;
        ctx.globalAlpha = fillAlpha * 0.9;
        ctx.fillText(wordObj.text, 0, 0);
      }

      ctx.restore();
    }
    ctx.restore();
  }

  // F. 悬浮光尘 (Sunlit Dust Motes)
  if (refs.nebulaStars.current) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const dust of refs.nebulaStars.current as DustMoteItem[]) {
      dust.y += dust.vy * floatingSpeed;
      dust.x += dust.vx * floatingSpeed + Math.sin(time * 0.001 + dust.phase) * 0.3;

      if (dust.y < -10) {
        dust.y = height + 10;
        dust.x = Math.random() * width;
      }

      const twinkle = (Math.sin(time * 0.002 * dust.twinkleSpeed + dust.phase) + 1) * 0.5;
      const dustAlpha = dust.alpha * (0.3 + twinkle * 0.7 + refs.smoothTreble.current * 0.6);
      const dustR = dust.size * (1.0 + refs.smoothTreble.current * 0.4);

      ctx.fillStyle = palette.dustColor.replace(/[\d.]+\)$/, `${dustAlpha})`);
      ctx.beginPath();
      ctx.arc(dust.x, dust.y, dustR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // G. 焦点歌词排版与电影色散 (In-Focus Hero Lyric Line)
  if (activeLine) {
    ctx.save();
    const heroY = height * 0.65;
    const heroX = width * 0.5;
    const fSize = heroFontSize * breathFactor;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = `400 ${fSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", "STSong", serif`;

    // 1. 漫射光晕
    const bloomGrad = ctx.createRadialGradient(heroX, heroY, 0, heroX, heroY, width * 0.4);
    const bloomAlpha = (0.12 + totalEnergy * 0.15) * breathFactor;
    bloomGrad.addColorStop(0, palette.heroGlow.replace(/[\d.]+\)$/, `${bloomAlpha})`));
    bloomGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bloomGrad;
    ctx.fillRect(0, heroY - 80, width, 160);

    // 2. 镜头色散 (Chromatic Aberration)
    if (chromaticAberration > 0.1) {
      const caOffset = (1.2 * chromaticAberration + refs.smoothBass.current * 1.5) * breathFactor;
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      ctx.fillStyle = "rgba(255, 120, 100, 0.25)";
      ctx.fillText(activeLine, heroX - caOffset, heroY);

      ctx.fillStyle = "rgba(100, 200, 255, 0.25)";
      ctx.fillText(activeLine, heroX + caOffset, heroY);

      ctx.restore();
    }

    // 3. 主文字
    ctx.shadowColor = palette.heroGlow;
    ctx.shadowBlur = 18 * breathFactor;
    ctx.fillStyle = palette.heroText;
    ctx.fillText(activeLine, heroX, heroY);

    // 4. 逐字流光扫描
    ctx.shadowBlur = 0;
    const textMetrics = ctx.measureText(activeLine);
    const textW = textMetrics.width;
    if (textW > 0) {
      const sweepX = heroX - textW / 2 + textW * activeProgress;
      const sweepGrad = ctx.createRadialGradient(sweepX, heroY, 0, sweepX, heroY, 60);
      sweepGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
      sweepGrad.addColorStop(0.5, palette.accent.replace(/[\d.]+\)$/, "0.4)"));
      sweepGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(heroX - textW / 2 - 10, heroY - 40, textW + 20, 80);
      ctx.restore();
    }

    // 5. 优雅副歌词
    if (activeSub) {
      const subFontSize = Math.max(12, Math.round(fSize * 0.42));
      ctx.font = `300 ${subFontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 6;
      ctx.fillStyle = palette.secondary.replace(/[\d.]+\)$/, "0.85)");
      ctx.fillText(activeSub, heroX, heroY + fSize * 0.95);
    }

    ctx.restore();
  }

  // H. 35mm 胶片微粒 (Film Grain)
  const grainCanvas = getFilmGrainCanvas();
  if (filmGrain > 0.05 && grainCanvas) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = Math.min(0.2, filmGrain * 0.16);
    const pattern = ctx.createPattern(grainCanvas, "repeat");
    if (pattern) {
      const grainOffsetX = (Math.random() - 0.5) * 40;
      const grainOffsetY = (Math.random() - 0.5) * 40;
      ctx.translate(grainOffsetX, grainOffsetY);
      ctx.fillStyle = pattern;
      ctx.fillRect(-40, -40, width + 80, height + 80);
    }
    ctx.restore();
  }

  // I. 电影暗角 (Vignette)
  if (vignetteStrength > 0.05) {
    ctx.save();
    const maxDim = Math.max(width, height) * 0.75;
    const vigGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      maxDim * 0.45,
      width * 0.5,
      height * 0.5,
      maxDim
    );
    vigGrad.addColorStop(0, "rgba(0,0,0,0)");
    vigGrad.addColorStop(1, `rgba(0,0,0,${vignetteStrength * 0.85})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
