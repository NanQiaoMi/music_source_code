/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectContext } from "./types";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";

// =========================================================================
// 1. Types & Data Structures
// =========================================================================

interface InkSplatterDrop {
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

interface AmbientDustItem {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  phase: number;
  freq: number;
}

interface SoftAtmosphereOrbItem {
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

interface ParsedLrcLine {
  time: number;
  text: string;
}

interface ColorPalette {
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

let parsedLyricsCache: ParsedLrcLine[] = [];
let lastRawLyricsCache = "";
let grainCanvasCache: HTMLCanvasElement | null = null;
let currentLineTextCache = "";
let previousLineTextCache = "";
let lineTransitionAlpha = 0;
let prevLineFadeAlpha = 0;
let breathAngle = 0;
const inkSplatters: InkSplatterDrop[] = [];

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

function getFilmGrainCanvas(): HTMLCanvasElement | null {
  if (grainCanvasCache) return grainCanvasCache;
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
    grainCanvasCache = canvas;
    return grainCanvasCache;
  } catch {
    return null;
  }
}

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
      if (inkBleedIntensity > 0.05) {
        ctx.shadowColor = palette.ambientAura;
        ctx.shadowBlur = 10 * inkBleedIntensity;
      }
      ctx.fillStyle = palette.inkSung;
      ctx.fillText(char, charCenterX, centerY);
    } else if (i === activeCharIndex && progress > 0) {
      if (inkBleedIntensity > 0.05) {
        ctx.save();
        ctx.shadowColor = palette.inkBleedGlow;
        ctx.shadowBlur = 24 * inkBleedIntensity;
        ctx.fillStyle = palette.inkActiveGold;
        ctx.fillText(char, charCenterX, centerY);
        ctx.restore();
      }

      ctx.fillStyle = palette.inkActiveGold;
      ctx.shadowColor = palette.inkBleedGlow;
      ctx.shadowBlur = 12 * inkBleedIntensity;
      ctx.fillText(char, charCenterX, centerY);

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillText(char, charCenterX, centerY);
      ctx.restore();
    } else {
      ctx.fillStyle = palette.inkUnsung;
      ctx.shadowBlur = 0;
      ctx.fillText(char, charCenterX, centerY);
    }
    ctx.restore();

    startX += w + letterSpacing;
  }
}

// =========================================================================
// 2. Main Draw Function
// =========================================================================

export function drawCinematicLyricDrift(effectCtx: EffectContext) {
  const { ctx, width, height, data, time, refs, params } = effectCtx;

  // -------------------------------------------------------------
  // 1. 参数与调色板 / 书法字体选择
  // -------------------------------------------------------------
  const schemeIndex = Math.max(
    0,
    Math.min(COLOR_PALETTES.length - 1, Math.round(params?.colorScheme ?? 0))
  );
  const palette = COLOR_PALETTES[schemeIndex];

  const fontStyleIndex = Math.max(
    0,
    Math.min(FONT_STYLES.length - 1, Math.round(params?.fontStyle ?? 0))
  );
  const selectedFontFamily = FONT_STYLES[fontStyleIndex];

  const heroFontSize = params?.heroFontSize ?? 38;
  const letterSpacing = params?.letterSpacing ?? 7.0;
  const inkBleedIntensity = params?.inkBleedIntensity ?? 1.1;
  const filmGrain = params?.filmGrain ?? 0.25;
  const breathingDepth = params?.breathingDepth ?? 1.0;
  const vignetteStrength = params?.vignetteStrength ?? 0.72;

  // -------------------------------------------------------------
  // 2. 音频平滑 & 呼吸律动
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

  const smoothFactor = 0.06;
  refs.smoothBass.current += (rawBass - refs.smoothBass.current) * smoothFactor;
  refs.smoothMid.current += (rawMid - refs.smoothMid.current) * smoothFactor;
  refs.smoothTreble.current += (rawTreble - refs.smoothTreble.current) * smoothFactor;

  const totalEnergy =
    refs.smoothBass.current * 0.5 + refs.smoothMid.current * 0.3 + refs.smoothTreble.current * 0.2;

  breathAngle = (breathAngle + 0.016 * (0.45 + totalEnergy * 0.4) * breathingDepth) % (Math.PI * 2);
  const breathSin = Math.sin(breathAngle);
  const breathFactor = 1.0 + breathSin * 0.05 * breathingDepth + refs.smoothBass.current * 0.08;

  // -------------------------------------------------------------
  // 3. 粒子池初始化
  // -------------------------------------------------------------

  if (!refs.bokeh.current || refs.bokeh.current.length === 0) {
    const orbs: SoftAtmosphereOrbItem[] = [];
    const orbCount = 12;
    for (let i = 0; i < orbCount; i++) {
      const baseRadius = 40 + Math.random() * 80;
      orbs.push({
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
    refs.bokeh.current = orbs;
  }

  if (!refs.nebulaStars.current || refs.nebulaStars.current.length === 0) {
    const dust: AmbientDustItem[] = [];
    const dustCount = 80;
    for (let i = 0; i < dustCount; i++) {
      dust.push({
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
    refs.nebulaStars.current = dust;
  }

  // -------------------------------------------------------------
  // 4. 歌词状态检测（严格过滤元数据，单行纯净呈现）
  // -------------------------------------------------------------
  const audioState = useAudioStore.getState();
  const playerState = usePlayerStore.getState();
  const currentSong = audioState.currentSong || playerState.currentSong;
  const currentTime = audioState.currentTime || playerState.currentTime || 0;
  const isPlaying = audioState.isPlaying || playerState.isPlaying;
  const rawLyrics = currentSong?.lyrics || "";

  if (rawLyrics !== lastRawLyricsCache) {
    lastRawLyricsCache = rawLyrics;
    parsedLyricsCache = parseLrc(rawLyrics);
    currentLineTextCache = "";
    previousLineTextCache = "";
  }

  let activeLine = "";
  let lineProgress = 0;
  let isSinging = false;

  if (isPlaying && parsedLyricsCache.length > 0) {
    let activeIdx = -1;
    for (let i = 0; i < parsedLyricsCache.length; i++) {
      if (currentTime >= parsedLyricsCache[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx >= 0) {
      const curr = parsedLyricsCache[activeIdx];
      const next = parsedLyricsCache[activeIdx + 1];
      const lineDuration = next ? Math.max(1.2, next.time - curr.time) : 5.0;
      const elapsed = currentTime - curr.time;
      const estimatedDuration = Math.min(lineDuration, Math.max(2.2, curr.text.length * 0.36));

      if (elapsed >= 0 && elapsed <= estimatedDuration + 0.8) {
        isSinging = true;
        activeLine = curr.text;
        lineProgress = Math.min(1.0, Math.max(0.0, elapsed / Math.max(1.0, estimatedDuration)));

        if (inkSplatters.length < 20 && Math.random() < 0.15) {
          inkSplatters.push({
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

  if (activeLine !== currentLineTextCache) {
    if (currentLineTextCache) {
      previousLineTextCache = currentLineTextCache;
      prevLineFadeAlpha = lineTransitionAlpha;
    }
    currentLineTextCache = activeLine;
    lineTransitionAlpha = 0;
  }

  const targetCurrentAlpha = isSinging ? 1.0 : 0.0;
  lineTransitionAlpha += (targetCurrentAlpha - lineTransitionAlpha) * 0.08;
  prevLineFadeAlpha += (0.0 - prevLineFadeAlpha) * 0.12;

  // -------------------------------------------------------------
  // 5. 绘制渲染流程
  // -------------------------------------------------------------

  // A. 宣纸水墨深邃底色
  const bgGrad = ctx.createRadialGradient(
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
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // B. 中心禅意温光水晕
  if (inkBleedIntensity > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const auraRadius = width * 0.42 * breathFactor;
    const auraAlpha = (0.07 + totalEnergy * 0.08) * inkBleedIntensity;
    const auraGrad = ctx.createRadialGradient(
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

    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.52, auraRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // C. 柔焦墨光团
  if (refs.bokeh.current) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const orb of refs.bokeh.current as SoftAtmosphereOrbItem[]) {
      orb.y += orb.vy;
      orb.x += orb.vx + Math.sin(time * 0.00025 + orb.phase) * 0.1;

      if (orb.y < -orb.baseRadius * 2) {
        orb.y = height + orb.baseRadius * 2;
        orb.x = Math.random() * width;
      }

      const pulse = 1.0 + Math.sin(time * 0.0006 * orb.speed + orb.phase) * 0.12;
      const curR = orb.baseRadius * pulse * breathFactor;
      const alpha = orb.baseAlpha * inkBleedIntensity * (0.8 + refs.smoothBass.current * 0.4);

      const orbGrad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, curR);
      orbGrad.addColorStop(0, palette.orbColor.replace(/[\d.]+\)$/, `${alpha * 0.9})`));
      orbGrad.addColorStop(0.4, palette.orbColor.replace(/[\d.]+\)$/, `${alpha * 0.35})`));
      orbGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, curR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // D. 悬浮金粉微尘
  if (refs.nebulaStars.current) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const dust of refs.nebulaStars.current as AmbientDustItem[]) {
      dust.y += dust.vy;
      dust.x += dust.vx + Math.sin(time * 0.0004 * dust.freq + dust.phase) * 0.15;

      if (dust.y < -10) {
        dust.y = height + 10;
        dust.x = Math.random() * width;
      }

      const twinkle = (Math.sin(time * 0.0018 * dust.freq + dust.phase) + 1) * 0.5;
      const dustAlpha = dust.baseAlpha * (0.3 + twinkle * 0.7 + refs.smoothTreble.current * 0.3);

      ctx.fillStyle = palette.dustColor.replace(/[\d.]+\)$/, `${dustAlpha})`);
      ctx.beginPath();
      ctx.arc(dust.x, dust.y, dust.size * (1.0 + refs.smoothTreble.current * 0.2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // E. 金墨微滴
  if (inkSplatters.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = inkSplatters.length - 1; i >= 0; i--) {
      const drop = inkSplatters[i];
      drop.life += 0.016;
      drop.x += drop.vx;
      drop.y += drop.vy;

      const progress = drop.life / drop.maxLife;
      if (progress >= 1.0) {
        inkSplatters.splice(i, 1);
        continue;
      }

      const dropAlpha = drop.alpha * (1.0 - progress);
      ctx.fillStyle = drop.color;
      ctx.globalAlpha = dropAlpha;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.size * (1.0 - progress * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // F. 水墨画毛笔书法排版
  const heroY = height * 0.52;
  const heroX = width * 0.5;
  const fSize = Math.round(heroFontSize * breathFactor);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `400 ${fSize}px ${selectedFontFamily}`;

  // 1. 旧句如水墨散开淡出
  if (prevLineFadeAlpha > 0.01 && previousLineTextCache) {
    ctx.save();
    const prevDriftY = heroY - (1.0 - prevLineFadeAlpha) * 16;
    ctx.globalAlpha = prevLineFadeAlpha * 0.55;
    drawInkBrushSpacedText(
      ctx,
      previousLineTextCache,
      heroX,
      prevDriftY,
      letterSpacing,
      1.0,
      palette,
      prevLineFadeAlpha,
      inkBleedIntensity * 0.5
    );
    ctx.restore();
  }

  // 2. 当前焦点歌词浮现
  if (lineTransitionAlpha > 0.005 && currentLineTextCache) {
    ctx.save();
    const currDriftY = heroY + (1.0 - lineTransitionAlpha) * 14;
    ctx.globalAlpha = lineTransitionAlpha;

    const textGlowGrad = ctx.createRadialGradient(
      heroX,
      currDriftY,
      0,
      heroX,
      currDriftY,
      width * 0.28
    );
    const glowAlpha = (0.08 + totalEnergy * 0.1) * lineTransitionAlpha;
    textGlowGrad.addColorStop(0, palette.ambientAura.replace(/[\d.]+\)$/, `${glowAlpha})`));
    textGlowGrad.addColorStop(0.6, palette.ambientAura.replace(/[\d.]+\)$/, `${glowAlpha * 0.2})`));
    textGlowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = textGlowGrad;
    ctx.beginPath();
    ctx.arc(heroX, currDriftY, width * 0.28, 0, Math.PI * 2);
    ctx.fill();

    drawInkBrushSpacedText(
      ctx,
      currentLineTextCache,
      heroX,
      currDriftY,
      letterSpacing,
      lineProgress,
      palette,
      lineTransitionAlpha,
      inkBleedIntensity
    );

    ctx.restore();
  }

  ctx.restore();

  // G. 宣纸肌理
  const grainCanvas = getFilmGrainCanvas();
  if (filmGrain > 0.05 && grainCanvas) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = Math.min(0.15, filmGrain * 0.12);
    const pattern = ctx.createPattern(grainCanvas, "repeat");
    if (pattern) {
      const grainOffsetX = (Math.random() - 0.5) * 20;
      const grainOffsetY = (Math.random() - 0.5) * 20;
      ctx.translate(grainOffsetX, grainOffsetY);
      ctx.fillStyle = pattern;
      ctx.fillRect(-20, -20, width + 40, height + 40);
    }
    ctx.restore();
  }

  // H. 暗角
  if (vignetteStrength > 0.05) {
    ctx.save();
    const maxDim = Math.max(width, height) * 0.75;
    const vigGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      maxDim * 0.44,
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
