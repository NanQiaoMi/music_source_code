/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectContext } from "./types";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";

// =========================================================================
// 1. Types & Data Structures
// =========================================================================

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
  textUnsung: string;
  textSung: string;
  textActiveGlow: string;
  dustColor: string;
  orbColor: string;
}

const COLOR_PALETTES: ColorPalette[] = [
  // 0: 暖金午夜 (Warm Golden Midnight - High-End Acoustic)
  {
    name: "暖金午夜",
    bgGradStart: "#140b05",
    bgGradMid: "#0a0603",
    bgGradEnd: "#040201",
    ambientAura: "rgba(255, 175, 95, 0.12)",
    textUnsung: "rgba(240, 220, 195, 0.38)",
    textSung: "#fffdf9",
    textActiveGlow: "rgba(255, 190, 110, 0.6)",
    dustColor: "rgba(255, 215, 160, 0.45)",
    orbColor: "rgba(245, 160, 80, 0.07)",
  },
  // 1: 冰川月华 (Glacier Moonlight - Pure Nordic Ethereal)
  {
    name: "冰川月华",
    bgGradStart: "#090f1a",
    bgGradMid: "#04070d",
    bgGradEnd: "#010306",
    ambientAura: "rgba(140, 195, 255, 0.11)",
    textUnsung: "rgba(185, 215, 245, 0.36)",
    textSung: "#faffff",
    textActiveGlow: "rgba(150, 215, 255, 0.6)",
    dustColor: "rgba(200, 230, 255, 0.45)",
    orbColor: "rgba(120, 185, 250, 0.06)",
  },
  // 2: 暮色幽粉 (Dusk Rose - Tender & Emotional)
  {
    name: "暮色幽粉",
    bgGradStart: "#150912",
    bgGradMid: "#090308",
    bgGradEnd: "#030103",
    ambientAura: "rgba(240, 140, 185, 0.12)",
    textUnsung: "rgba(245, 200, 220, 0.38)",
    textSung: "#fff6fa",
    textActiveGlow: "rgba(255, 160, 205, 0.6)",
    dustColor: "rgba(255, 205, 225, 0.45)",
    orbColor: "rgba(230, 120, 175, 0.07)",
  },
  // 3: 晨雾苍翠 (Morning Mist Sage - Organic Clean)
  {
    name: "晨雾苍翠",
    bgGradStart: "#07140e",
    bgGradMid: "#030906",
    bgGradEnd: "#010403",
    ambientAura: "rgba(120, 215, 165, 0.11)",
    textUnsung: "rgba(185, 235, 210, 0.36)",
    textSung: "#f4fff9",
    textActiveGlow: "rgba(130, 230, 180, 0.6)",
    dustColor: "rgba(185, 245, 215, 0.45)",
    orbColor: "rgba(100, 200, 150, 0.06)",
  },
  // 4: 经典胶片 (Classic 35mm Monochrome - Timeless Noir)
  {
    name: "经典胶片",
    bgGradStart: "#101012",
    bgGradMid: "#070708",
    bgGradEnd: "#020202",
    ambientAura: "rgba(220, 220, 230, 0.09)",
    textUnsung: "rgba(210, 210, 215, 0.35)",
    textSung: "#ffffff",
    textActiveGlow: "rgba(230, 230, 240, 0.5)",
    dustColor: "rgba(235, 235, 245, 0.4)",
    orbColor: "rgba(190, 190, 205, 0.05)",
  },
];

let parsedLyricsCache: ParsedLrcLine[] = [];
let lastRawLyricsCache = "";
let grainCanvasCache: HTMLCanvasElement | null = null;
let currentLineTextCache = "";
let previousLineTextCache = "";
let lineTransitionAlpha = 0;
let prevLineFadeAlpha = 0;
let breathAngle = 0;

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

function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  letterSpacing: number,
  progress: number,
  palette: ColorPalette,
  alpha: number
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
      ctx.fillStyle = palette.textSung;
      ctx.shadowColor = palette.ambientAura;
      ctx.shadowBlur = 8;
      ctx.fillText(char, charCenterX, centerY);
    } else if (i === activeCharIndex && progress > 0) {
      ctx.fillStyle = palette.textSung;
      ctx.shadowColor = palette.textActiveGlow;
      ctx.shadowBlur = 18;
      ctx.fillText(char, charCenterX, centerY);

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = palette.textActiveGlow;
      ctx.fillText(char, charCenterX, centerY);
      ctx.restore();
    } else {
      ctx.fillStyle = palette.textUnsung;
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
  // 1. 参数与调色板选择
  // -------------------------------------------------------------
  const schemeIndex = Math.max(
    0,
    Math.min(COLOR_PALETTES.length - 1, Math.round(params?.colorScheme ?? 0))
  );
  const palette = COLOR_PALETTES[schemeIndex];

  const glowIntensity = params?.glowIntensity ?? 1.0;
  const heroFontSize = params?.heroFontSize ?? 32;
  const letterSpacing = params?.letterSpacing ?? 5.0;
  const filmGrain = params?.filmGrain ?? 0.25;
  const breathingDepth = params?.breathingDepth ?? 1.0;
  const vignetteStrength = params?.vignetteStrength ?? 0.7;

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

  // A. 大气柔焦光晕池 (refs.bokeh)
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

  // B. 悬浮微尘池 (refs.nebulaStars)
  if (!refs.nebulaStars.current || refs.nebulaStars.current.length === 0) {
    const dust: AmbientDustItem[] = [];
    const dustCount = 80;
    for (let i = 0; i < dustCount; i++) {
      dust.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 0.6 + Math.random() * 1.2,
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
      }
    }
  }

  // 平滑换行处理
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

  // A. 丝绒深邃底色渐变
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

  // B. 中心柔和呼吸光晕 (Central Breathing Aura)
  if (glowIntensity > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const auraRadius = width * 0.42 * breathFactor;
    const auraAlpha = (0.07 + totalEnergy * 0.08) * glowIntensity;
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

  // C. 极度柔焦的大气微光团
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
      const alpha = orb.baseAlpha * glowIntensity * (0.8 + refs.smoothBass.current * 0.4);

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

  // D. 悬浮微尘 (Ambient Fine Dust)
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

  // E. 顶级现代人文无衬线排版（Pure Editorial Single-Hero Typography）
  const heroY = height * 0.52;
  const heroX = width * 0.5;
  const fSize = Math.round(heroFontSize * breathFactor);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `300 ${fSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif`;

  // 1. 旧句漂浮淡出
  if (prevLineFadeAlpha > 0.01 && previousLineTextCache) {
    ctx.save();
    const prevDriftY = heroY - (1.0 - prevLineFadeAlpha) * 16;
    ctx.globalAlpha = prevLineFadeAlpha * 0.6;
    drawSpacedText(
      ctx,
      previousLineTextCache,
      heroX,
      prevDriftY,
      letterSpacing,
      1.0,
      palette,
      prevLineFadeAlpha
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
      width * 0.25
    );
    const glowAlpha = (0.08 + totalEnergy * 0.1) * lineTransitionAlpha;
    textGlowGrad.addColorStop(0, palette.ambientAura.replace(/[\d.]+\)$/, `${glowAlpha})`));
    textGlowGrad.addColorStop(0.6, palette.ambientAura.replace(/[\d.]+\)$/, `${glowAlpha * 0.2})`));
    textGlowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = textGlowGrad;
    ctx.beginPath();
    ctx.arc(heroX, currDriftY, width * 0.25, 0, Math.PI * 2);
    ctx.fill();

    drawSpacedText(
      ctx,
      currentLineTextCache,
      heroX,
      currDriftY,
      letterSpacing,
      lineProgress,
      palette,
      lineTransitionAlpha
    );

    ctx.restore();
  }

  ctx.restore();

  // F. 35mm 胶片微粒质感
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

  // G. 电影暗角 (Vignette)
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
