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
  currentAlpha: number;
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
  depth: number;
  colorType: "warm" | "cool" | "glow";
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

interface LightWaveRibbon {
  baseY: number;
  amplitude: number;
  speed: number;
  freq: number;
  phase: number;
  thickness: number;
  alpha: number;
}

interface ParsedLine {
  time: number;
  text: string;
  words?: string[];
}

interface PaletteConfig {
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

const COLOR_PALETTES: PaletteConfig[] = [
  // 0: 暮色琥珀 (Sunset Amber - Warm 35mm Film)
  {
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

let parsedLyricsCache: ParsedLine[] = [];
let lastRawLyricsCache = "";
let grainCanvasCache: HTMLCanvasElement | null = null;
let heroAlpha = 0;
let breathAngle = 0;
let ribbonsCache: LightWaveRibbon[] = [];

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
      data[i + 3] = Math.floor(Math.random() * 38);
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
  // 1. 参数与调色板
  // -------------------------------------------------------------
  const schemeIndex = Math.max(
    0,
    Math.min(COLOR_PALETTES.length - 1, Math.round(params?.colorScheme ?? 0))
  );
  const palette = COLOR_PALETTES[schemeIndex];

  const bokehIntensity = params?.bokehIntensity ?? 1.0;
  const ambientLightIntensity = params?.ambientLightIntensity ?? 1.0;
  const floatingSpeed = params?.floatingSpeed ?? 1.0;
  const filmGrain = params?.filmGrain ?? 0.35;
  const chromaticAberration = params?.chromaticAberration ?? 0.8;
  const breathingDepth = params?.breathingDepth ?? 1.0;
  const heroFontSize = params?.heroFontSize ?? 28;
  const vignetteStrength = params?.vignetteStrength ?? 0.65;

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

  const smoothFactor = 0.08;
  refs.smoothBass.current += (rawBass - refs.smoothBass.current) * smoothFactor;
  refs.smoothMid.current += (rawMid - refs.smoothMid.current) * smoothFactor;
  refs.smoothTreble.current += (rawTreble - refs.smoothTreble.current) * smoothFactor;

  const totalEnergy =
    refs.smoothBass.current * 0.5 + refs.smoothMid.current * 0.3 + refs.smoothTreble.current * 0.2;

  breathAngle = (breathAngle + 0.016 * (0.55 + totalEnergy * 0.6) * breathingDepth) % (Math.PI * 2);
  const breathSin = Math.sin(breathAngle);
  const breathFactor = 1.0 + breathSin * 0.08 * breathingDepth + refs.smoothBass.current * 0.15;

  // -------------------------------------------------------------
  // 3. 粒子池与光浪初始化
  // -------------------------------------------------------------

  // A. 散焦光斑池 (refs.bokeh) - 柔和高斯光斑
  if (!refs.bokeh.current || refs.bokeh.current.length === 0) {
    const orbs: BokehOrbItem[] = [];
    const orbCount = 32;
    for (let i = 0; i < orbCount; i++) {
      const depth = 0.3 + Math.random() * 1.7;
      const baseR = (14 + Math.random() * 32) * (1.8 - depth * 0.4);
      orbs.push({
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
    refs.bokeh.current = orbs;
  }

  // B. 悬浮微尘池 (refs.nebulaStars)
  if (!refs.nebulaStars.current || refs.nebulaStars.current.length === 0) {
    const dust: DustMoteItem[] = [];
    const dustCount = 180;
    for (let i = 0; i < dustCount; i++) {
      dust.push({
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
    refs.nebulaStars.current = dust;
  }

  // C. 流动光浪缓存
  if (ribbonsCache.length === 0) {
    ribbonsCache = [
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
  }

  // -------------------------------------------------------------
  // 4. 歌词状态检测（有歌词时显示，无歌词时纯背景）
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
    refs.particles.current = []; // 清空浮字
  }

  let activeLine = "";
  let activeProgress = 0;
  let isSingingNow = false;

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
      const currLine = parsedLyricsCache[activeIdx];
      const nextLine = parsedLyricsCache[activeIdx + 1];
      const lineDuration = nextLine ? Math.max(1.0, nextLine.time - currLine.time) : 5.5;
      const elapsed = currentTime - currLine.time;
      const estimatedDuration = Math.min(lineDuration, Math.max(2.2, currLine.text.length * 0.38));

      if (elapsed >= 0 && elapsed <= estimatedDuration + 1.2) {
        isSingingNow = true;
        activeLine = currLine.text;
        activeProgress = Math.min(1.0, Math.max(0.0, elapsed / Math.max(1.0, estimatedDuration)));

        if (!refs.particles.current) refs.particles.current = [];
        if (refs.particles.current.length < 16 && currLine.words && currLine.words.length > 0) {
          const word = currLine.words[Math.floor(Math.random() * currLine.words.length)];
          const z = 0.4 + Math.random() * 1.5;
          const baseSize = 13 + (1.6 - z) * 8;
          refs.particles.current.push({
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

  const targetHeroAlpha = isSingingNow ? 1.0 : 0.0;
  heroAlpha += (targetHeroAlpha - heroAlpha) * 0.08;

  // -------------------------------------------------------------
  // 5. 绘制渲染流程
  // -------------------------------------------------------------

  // A. 电影级深邃背景
  const bgGrad = ctx.createRadialGradient(
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
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // B. 流动光浪 (Ambient Light Waves)
  if (ambientLightIntensity > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const ribbon of ribbonsCache) {
      ribbon.phase += 0.016 * ribbon.speed * (1.0 + totalEnergy * 0.5);

      const currentY = ribbon.baseY + Math.sin(ribbon.phase) * ribbon.amplitude * breathFactor;
      const currentThickness = ribbon.thickness * breathFactor;
      const ribbonAlpha =
        ribbon.alpha * ambientLightIntensity * (0.8 + refs.smoothMid.current * 0.8);

      const waveGrad = ctx.createLinearGradient(
        0,
        currentY - currentThickness * 0.5,
        0,
        currentY + currentThickness * 0.5
      );
      waveGrad.addColorStop(0, "rgba(0,0,0,0)");
      waveGrad.addColorStop(0.5, palette.ambientLight.replace(/[\d.]+\)$/, `${ribbonAlpha})`));
      waveGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = waveGrad;
      ctx.beginPath();
      ctx.moveTo(0, currentY);

      const segs = 6;
      const stepX = width / segs;
      for (let s = 0; s <= segs; s++) {
        const sx = s * stepX;
        const sy = currentY + Math.sin(sx * ribbon.freq + ribbon.phase) * (ribbon.amplitude * 0.5);
        if (s === 0) {
          ctx.moveTo(sx, sy - currentThickness * 0.5);
        } else {
          const prevX = (s - 1) * stepX;
          const prevY =
            currentY + Math.sin(prevX * ribbon.freq + ribbon.phase) * (ribbon.amplitude * 0.5);
          const cx = (prevX + sx) / 2;
          const cy = (prevY + sy) / 2;
          ctx.quadraticCurveTo(
            prevX,
            prevY - currentThickness * 0.5,
            cx,
            cy - currentThickness * 0.5
          );
        }
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // C. 真实大光圈高斯衰减焦外散景 (Bokeh Orbs)
  if (bokehIntensity > 0.05 && refs.bokeh.current) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const orb of refs.bokeh.current as BokehOrbItem[]) {
      orb.y += orb.vy * floatingSpeed;
      orb.x += orb.vx * floatingSpeed + Math.sin(time * 0.0006 + orb.phase) * 0.15;

      if (orb.y < -orb.radius * 2) {
        orb.y = height + orb.radius * 2;
        orb.x = Math.random() * width;
      }

      const pulse = 1.0 + Math.sin(time * 0.001 * orb.pulseSpeed + orb.phase) * 0.12;
      const currentR = orb.baseRadius * pulse * breathFactor * bokehIntensity;
      const alpha = orb.alpha * bokehIntensity * (0.6 + refs.smoothBass.current * 0.7);

      const orbGrad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, currentR);
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

      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, currentR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // D. 悬浮光尘 (Sunlit Dust Motes)
  if (refs.nebulaStars.current) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const dust of refs.nebulaStars.current as DustMoteItem[]) {
      dust.y += dust.vy * floatingSpeed;
      dust.x += dust.vx * floatingSpeed + Math.sin(time * 0.0008 + dust.phase) * 0.25;

      if (dust.y < -10) {
        dust.y = height + 10;
        dust.x = Math.random() * width;
      }

      const twinkle = (Math.sin(time * 0.002 * dust.twinkleSpeed + dust.phase) + 1) * 0.5;
      const dustAlpha = dust.alpha * (0.25 + twinkle * 0.75 + refs.smoothTreble.current * 0.5);
      const dustR = dust.size * (1.0 + refs.smoothTreble.current * 0.35);

      ctx.fillStyle = palette.dustColor.replace(/[\d.]+\)$/, `${dustAlpha})`);
      ctx.beginPath();
      ctx.arc(dust.x, dust.y, dustR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // E. 漂浮歌词文字粒子（仅在有歌词且正在演唱时显示，无歌词时平滑消散）
  if (refs.particles.current && refs.particles.current.length > 0) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = refs.particles.current.length - 1; i >= 0; i--) {
      const wordObj = refs.particles.current[i] as FloatingWordItem;
      wordObj.y += wordObj.vy * floatingSpeed;
      wordObj.x +=
        wordObj.vx * floatingSpeed +
        Math.sin(time * 0.001 * wordObj.freq + wordObj.phase) * (0.5 * (2.0 - wordObj.z));
      wordObj.rotation += wordObj.rotationSpeed;

      const targetWordAlpha = isSingingNow ? wordObj.alpha : 0;
      wordObj.currentAlpha += (targetWordAlpha - wordObj.currentAlpha) * 0.05;

      if (wordObj.y < -40 || (!isSingingNow && wordObj.currentAlpha < 0.01)) {
        refs.particles.current.splice(i, 1);
        continue;
      }

      if (wordObj.currentAlpha > 0.01) {
        const zFactor = 2.0 - wordObj.z;
        const fontSize = wordObj.baseSize * breathFactor;
        const alpha = wordObj.currentAlpha * (0.6 + totalEnergy * 0.4);

        ctx.save();
        ctx.translate(wordObj.x, wordObj.y);
        ctx.rotate(wordObj.rotation);

        ctx.font = `300 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", "STSong", serif`;
        ctx.shadowColor = palette.heroGlow;
        ctx.shadowBlur = (6 + zFactor * 5) * breathFactor;

        const colorStr =
          wordObj.colorType === "primary"
            ? palette.primary
            : wordObj.colorType === "accent"
              ? palette.accent
              : palette.heroText;

        ctx.fillStyle = colorStr.replace(/[\d.]+\)$/, `${alpha})`);
        ctx.fillText(wordObj.text, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // F. 焦点歌词排版（仅在有歌词且正在演唱时显示）
  if (heroAlpha > 0.01 && activeLine) {
    ctx.save();
    const heroY = height * 0.62;
    const heroX = width * 0.5;
    const fSize = heroFontSize * breathFactor;

    ctx.globalAlpha = heroAlpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = `400 ${fSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif SC", "STSong", serif`;

    // 1. 柔和背光漫射
    const bloomGrad = ctx.createRadialGradient(heroX, heroY, 0, heroX, heroY, width * 0.35);
    const bloomAlpha = (0.08 + totalEnergy * 0.12) * breathFactor * heroAlpha;
    bloomGrad.addColorStop(0, palette.heroGlow.replace(/[\d.]+\)$/, `${bloomAlpha})`));
    bloomGrad.addColorStop(0.5, palette.heroGlow.replace(/[\d.]+\)$/, `${bloomAlpha * 0.3})`));
    bloomGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bloomGrad;
    ctx.beginPath();
    ctx.arc(heroX, heroY, width * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 2. 镜头微色散 (RGB Shift)
    if (chromaticAberration > 0.1) {
      const caOffset = (0.9 * chromaticAberration + refs.smoothBass.current * 1.2) * breathFactor;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      ctx.fillStyle = `rgba(255, 130, 110, ${0.2 * heroAlpha})`;
      ctx.fillText(activeLine, heroX - caOffset, heroY);

      ctx.fillStyle = `rgba(110, 210, 255, ${0.2 * heroAlpha})`;
      ctx.fillText(activeLine, heroX + caOffset, heroY);

      ctx.restore();
    }

    // 3. 主文字渲染（纯文字发光，无方块）
    ctx.shadowColor = palette.heroGlow;
    ctx.shadowBlur = 14 * breathFactor;
    ctx.fillStyle = palette.heroText;
    ctx.fillText(activeLine, heroX, heroY);

    // 4. 逐字流光唤醒
    ctx.shadowBlur = 0;
    const textMetrics = ctx.measureText(activeLine);
    const textW = textMetrics.width;
    if (textW > 0 && activeProgress > 0) {
      const sweepX = heroX - textW / 2 + textW * activeProgress;
      const sweepGrad = ctx.createRadialGradient(sweepX, heroY, 0, sweepX, heroY, 45);
      sweepGrad.addColorStop(0, `rgba(255, 255, 255, ${0.8 * heroAlpha})`);
      sweepGrad.addColorStop(0.5, palette.accent.replace(/[\d.]+\)$/, `${0.35 * heroAlpha})`));
      sweepGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = sweepGrad;
      ctx.fillText(activeLine, heroX, heroY);
      ctx.restore();
    }

    ctx.restore();
  }

  // G. 35mm 胶片微粒 (Film Grain)
  const grainCanvas = getFilmGrainCanvas();
  if (filmGrain > 0.05 && grainCanvas) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = Math.min(0.18, filmGrain * 0.14);
    const pattern = ctx.createPattern(grainCanvas, "repeat");
    if (pattern) {
      const grainOffsetX = (Math.random() - 0.5) * 30;
      const grainOffsetY = (Math.random() - 0.5) * 30;
      ctx.translate(grainOffsetX, grainOffsetY);
      ctx.fillStyle = pattern;
      ctx.fillRect(-30, -30, width + 60, height + 60);
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
      maxDim * 0.42,
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
