/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectContext } from "./types";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";

// =========================================================================
// 1. Types & Data Structures
// =========================================================================

interface LyricStardustParticle {
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

interface SoftBokehOrbItem {
  x: number;
  y: number;
  baseRadius: number;
  currentRadius: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  phase: number;
  speed: number;
  colorType: "warm" | "cool";
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
  primaryGlow: string;
  heroText: string;
  heroTextActive: string;
  contextText: string;
  bokehColorA: string;
  bokehColorB: string;
  dustColor: string;
  stardustColor: string;
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
  },
];

let parsedLyricsCache: ParsedLrcLine[] = [];
let lastRawLyricsCache = "";
let grainCanvasCache: HTMLCanvasElement | null = null;
let heroAlpha = 0;
let contextAlpha = 0;
let breathAngle = 0;
const stardustParticles: LyricStardustParticle[] = [];

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
      data[i + 3] = Math.floor(Math.random() * 28);
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
  // 1. 参数与调色板选择
  // -------------------------------------------------------------
  const schemeIndex = Math.max(
    0,
    Math.min(COLOR_PALETTES.length - 1, Math.round(params?.colorScheme ?? 0))
  );
  const palette = COLOR_PALETTES[schemeIndex];

  const glowIntensity = params?.glowIntensity ?? 1.0;
  const heroFontSize = params?.heroFontSize ?? 28;
  const showContextLines = params?.showContextLines !== 0 && params?.showContextLines !== false;
  const filmGrain = params?.filmGrain ?? 0.3;
  const chromaticAberration = params?.chromaticAberration ?? 0.6;
  const breathingDepth = params?.breathingDepth ?? 1.0;
  const vignetteStrength = params?.vignetteStrength ?? 0.68;

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

  const smoothFactor = 0.07;
  refs.smoothBass.current += (rawBass - refs.smoothBass.current) * smoothFactor;
  refs.smoothMid.current += (rawMid - refs.smoothMid.current) * smoothFactor;
  refs.smoothTreble.current += (rawTreble - refs.smoothTreble.current) * smoothFactor;

  const totalEnergy =
    refs.smoothBass.current * 0.5 + refs.smoothMid.current * 0.3 + refs.smoothTreble.current * 0.2;

  breathAngle = (breathAngle + 0.016 * (0.5 + totalEnergy * 0.5) * breathingDepth) % (Math.PI * 2);
  const breathSin = Math.sin(breathAngle);
  const breathFactor = 1.0 + breathSin * 0.06 * breathingDepth + refs.smoothBass.current * 0.12;

  // -------------------------------------------------------------
  // 3. 粒子池初始化
  // -------------------------------------------------------------

  // A. 柔和散焦光斑池 (refs.bokeh)
  if (!refs.bokeh.current || refs.bokeh.current.length === 0) {
    const orbs: SoftBokehOrbItem[] = [];
    const orbCount = 20;
    for (let i = 0; i < orbCount; i++) {
      const baseRadius = 25 + Math.random() * 55;
      orbs.push({
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
    refs.bokeh.current = orbs;
  }

  // B. 悬浮微尘池 (refs.nebulaStars)
  if (!refs.nebulaStars.current || refs.nebulaStars.current.length === 0) {
    const dust: AmbientDustItem[] = [];
    const dustCount = 110;
    for (let i = 0; i < dustCount; i++) {
      dust.push({
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
    refs.nebulaStars.current = dust;
  }

  // -------------------------------------------------------------
  // 4. 歌词状态检测（严格过滤元数据，无词时纯背景）
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
  }

  let activeLine = "";
  let prevLine = "";
  let nextLine = "";
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

        if (activeIdx > 0) {
          prevLine = parsedLyricsCache[activeIdx - 1].text;
        }
        if (next) {
          nextLine = next.text;
        }

        // 细腻星尘微粒
        if (stardustParticles.length < 24 && Math.random() < 0.2) {
          stardustParticles.push({
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

  const targetAlpha = isSinging ? 1.0 : 0.0;
  heroAlpha += (targetAlpha - heroAlpha) * 0.06;
  contextAlpha += (targetAlpha * 0.4 - contextAlpha) * 0.05;

  // -------------------------------------------------------------
  // 5. 绘制渲染流程
  // -------------------------------------------------------------

  // A. 电影级丝绒深邃底色
  const bgGrad = ctx.createRadialGradient(
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
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // B. 中心柔和呼吸光晕 (Central Breathing Aura)
  if (glowIntensity > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const auraRadius = width * 0.45 * breathFactor;
    const auraAlpha = (0.08 + totalEnergy * 0.12) * glowIntensity;
    const auraGrad = ctx.createRadialGradient(
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

    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.52, auraRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // C. 柔美散焦焦外微光 (Soft Lens Bokeh Orbs)
  if (refs.bokeh.current) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const orb of refs.bokeh.current as SoftBokehOrbItem[]) {
      orb.y += orb.vy;
      orb.x += orb.vx + Math.sin(time * 0.0003 + orb.phase) * 0.12;

      if (orb.y < -orb.baseRadius * 2) {
        orb.y = height + orb.baseRadius * 2;
        orb.x = Math.random() * width;
      }

      const pulse = 1.0 + Math.sin(time * 0.0008 * orb.speed + orb.phase) * 0.15;
      const curR = orb.baseRadius * pulse * breathFactor;
      const alpha = orb.baseAlpha * glowIntensity * (0.7 + refs.smoothBass.current * 0.6);

      const orbGrad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, curR);
      const colorStr = orb.colorType === "warm" ? palette.bokehColorA : palette.bokehColorB;

      orbGrad.addColorStop(0, colorStr.replace(/[\d.]+\)$/, `${alpha * 0.85})`));
      orbGrad.addColorStop(0.4, colorStr.replace(/[\d.]+\)$/, `${alpha * 0.35})`));
      orbGrad.addColorStop(0.8, colorStr.replace(/[\d.]+\)$/, `${alpha * 0.08})`));
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
      dust.x += dust.vx + Math.sin(time * 0.0005 * dust.freq + dust.phase) * 0.2;

      if (dust.y < -10) {
        dust.y = height + 10;
        dust.x = Math.random() * width;
      }

      const twinkle = (Math.sin(time * 0.0015 * dust.freq + dust.phase) + 1) * 0.5;
      const dustAlpha = dust.baseAlpha * (0.3 + twinkle * 0.7 + refs.smoothTreble.current * 0.4);

      ctx.fillStyle = palette.dustColor.replace(/[\d.]+\)$/, `${dustAlpha})`);
      ctx.beginPath();
      ctx.arc(dust.x, dust.y, dust.size * (1.0 + refs.smoothTreble.current * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // E. 歌词解构星尘 (Stardust Embers)
  if (stardustParticles.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = stardustParticles.length - 1; i >= 0; i--) {
      const p = stardustParticles[i];
      p.life += 0.016;
      p.x += p.vx;
      p.y += p.vy;

      const progress = p.life / p.maxLife;
      if (progress >= 1.0) {
        stardustParticles.splice(i, 1);
        continue;
      }

      const pAlpha = p.alpha * (1.0 - progress) * (Math.sin(progress * Math.PI) || 0);
      ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${pAlpha})`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.0 - progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // F. 大师级电影感歌词排版（景深排版、大字距、逐字柔和高光流转）
  if (heroAlpha > 0.005 && activeLine) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const heroY = height * 0.54;
    const heroX = width * 0.5;
    const fSize = heroFontSize * breathFactor;

    // 1. 上下句景深排版 (Rack Focus Context Lines)
    if (showContextLines && contextAlpha > 0.005) {
      ctx.save();
      const subFontSize = Math.max(14, Math.round(fSize * 0.65));
      ctx.font = `300 ${subFontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", serif`;

      if (prevLine) {
        ctx.fillStyle = palette.contextText.replace(/[\d.]+\)$/, `${0.22 * contextAlpha})`);
        ctx.fillText(prevLine, heroX, heroY - fSize * 1.55);
      }
      if (nextLine) {
        ctx.fillStyle = palette.contextText.replace(/[\d.]+\)$/, `${0.28 * contextAlpha})`);
        ctx.fillText(nextLine, heroX, heroY + fSize * 1.55);
      }
      ctx.restore();
    }

    // 2. 主歌词背后柔和光晕
    const textGlowGrad = ctx.createRadialGradient(heroX, heroY, 0, heroX, heroY, width * 0.28);
    const glowAlpha = (0.1 + totalEnergy * 0.15) * heroAlpha;
    textGlowGrad.addColorStop(0, palette.primaryGlow.replace(/[\d.]+\)$/, `${glowAlpha})`));
    textGlowGrad.addColorStop(0.6, palette.primaryGlow.replace(/[\d.]+\)$/, `${glowAlpha * 0.2})`));
    textGlowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = textGlowGrad;
    ctx.beginPath();
    ctx.arc(heroX, heroY, width * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // 3. 电影大光圈镜头微色散 (Chromatic RGB Shift)
    ctx.font = `400 ${fSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", "STSong", serif`;

    if (chromaticAberration > 0.05) {
      const caOffset = (0.8 * chromaticAberration + refs.smoothBass.current * 0.8) * breathFactor;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      ctx.fillStyle = `rgba(255, 140, 110, ${0.18 * heroAlpha})`;
      ctx.fillText(activeLine, heroX - caOffset, heroY);

      ctx.fillStyle = `rgba(110, 200, 255, ${0.18 * heroAlpha})`;
      ctx.fillText(activeLine, heroX + caOffset, heroY);

      ctx.restore();
    }

    // 4. 主文字温润发光
    ctx.shadowColor = palette.primaryGlow;
    ctx.shadowBlur = 12 * breathFactor;
    ctx.fillStyle = palette.heroText;
    ctx.globalAlpha = heroAlpha;
    ctx.fillText(activeLine, heroX, heroY);

    // 5. 逐字流光唤醒
    ctx.shadowBlur = 0;
    const textMetrics = ctx.measureText(activeLine);
    const textW = textMetrics.width;
    if (textW > 0 && lineProgress > 0) {
      const sweepX = heroX - textW / 2 + textW * lineProgress;
      const sweepGrad = ctx.createRadialGradient(sweepX, heroY, 0, sweepX, heroY, 42);
      sweepGrad.addColorStop(0, `rgba(255, 255, 255, ${0.85 * heroAlpha})`);
      sweepGrad.addColorStop(0.5, palette.primaryGlow.replace(/[\d.]+\)$/, `${0.3 * heroAlpha})`));
      sweepGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = sweepGrad;
      ctx.fillText(activeLine, heroX, heroY);
      ctx.restore();
    }

    ctx.restore();
  }

  // G. 35mm 胶片微粒质感
  const grainCanvas = getFilmGrainCanvas();
  if (filmGrain > 0.05 && grainCanvas) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = Math.min(0.16, filmGrain * 0.12);
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

  // H. 电影暗角 (Vignette)
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
