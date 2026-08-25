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

interface WordSegment {
  text: string;
  width: number;
  startRatio: number;
  endRatio: number;
  popTriggerTime: number;
  currentScale: number;
  currentAlpha: number;
  currentY: number;
  depthZ: number;
  blurPx: number;
  phaseOffset: number;
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
  textPast: string;
  textFocus: string;
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
    ambientAura: "rgba(255, 175, 95, 0.1)",
    textUnsung: "rgba(255, 245, 230, 0.18)",
    textPast: "rgba(235, 220, 195, 0.38)",
    textFocus: "#ffffff",
    dustColor: "rgba(255, 220, 160, 0.4)",
    orbColor: "rgba(245, 160, 80, 0.05)",
  },
  // 1: 青黛冷月 (Indigo Moonlit Mist)
  {
    name: "青黛冷月",
    bgGradStart: "#09101c",
    bgGradMid: "#040810",
    bgGradEnd: "#010204",
    ambientAura: "rgba(140, 195, 255, 0.09)",
    textUnsung: "rgba(215, 235, 255, 0.18)",
    textPast: "rgba(190, 220, 250, 0.38)",
    textFocus: "#ffffff",
    dustColor: "rgba(200, 230, 255, 0.4)",
    orbColor: "rgba(120, 185, 250, 0.05)",
  },
  // 2: 暮染丹青 (Cinnabar Twilight)
  {
    name: "暮染丹青",
    bgGradStart: "#160812",
    bgGradMid: "#0a0308",
    bgGradEnd: "#020102",
    ambientAura: "rgba(240, 140, 185, 0.1)",
    textUnsung: "rgba(255, 225, 235, 0.18)",
    textPast: "rgba(245, 205, 220, 0.38)",
    textFocus: "#ffffff",
    dustColor: "rgba(255, 205, 225, 0.4)",
    orbColor: "rgba(230, 120, 175, 0.05)",
  },
  // 3: 苍山松烟 (Pine Smoke Jade)
  {
    name: "苍山松烟",
    bgGradStart: "#07150e",
    bgGradMid: "#030a07",
    bgGradEnd: "#010302",
    ambientAura: "rgba(120, 215, 165, 0.09)",
    textUnsung: "rgba(220, 255, 235, 0.18)",
    textPast: "rgba(195, 240, 215, 0.38)",
    textFocus: "#ffffff",
    dustColor: "rgba(185, 245, 215, 0.4)",
    orbColor: "rgba(100, 200, 150, 0.05)",
  },
  // 4: 极简焦墨 (Timeless Monochrome)
  {
    name: "极简焦墨",
    bgGradStart: "#111113",
    bgGradMid: "#060607",
    bgGradEnd: "#010101",
    ambientAura: "rgba(220, 220, 230, 0.07)",
    textUnsung: "rgba(255, 255, 255, 0.15)",
    textPast: "rgba(215, 215, 220, 0.35)",
    textFocus: "#ffffff",
    dustColor: "rgba(235, 235, 245, 0.35)",
    orbColor: "rgba(190, 190, 205, 0.04)",
  },
];

const FONT_STYLES = [
  // 0: 洒脱行楷
  `"STXingkai", "华文行楷", "Xingkai SC", "Ma Shan Zheng", "STKaiti", "楷体", "Snell Roundhand", "Brush Script MT", "Georgia", serif`,
  // 1: 清雅文楷
  `"STKaiti", "Kaiti SC", "楷体", "楷体_GB2312", "LXGW WenKai", "Baskerville", "Georgia", serif`,
  // 2: 金石古韵
  `"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "Palatino", "Georgia", serif`,
  // 3: 苍劲狂草
  `"Long Cang", "Liu Jian Mao Cao", "STXingkai", "华文行楷", "STKaiti", "Brush Script MT", serif`,
];

let parsedLyricsCache: ParsedLrcLine[] = [];
let lastRawLyricsCache = "";
let grainCanvasCache: HTMLCanvasElement | null = null;
let currentLineTextCache = "";
let currentSegmentsCache: WordSegment[] = [];
let previousSegmentsCache: WordSegment[] = [];
let totalLineWidthCache = 0;
let prevLineWidthCache = 0;
let lineTransitionAlpha = 0;
let prevLineFadeAlpha = 0;
let breathAngle = 0;
let smoothedProgressCache = 0;
let lastReportedTimeCache = 0;
let lastTimeUpdateMsCache = 0;

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

function segmentText(text: string): string[] {
  const t = text.trim();
  if (!t) return [];

  const hasSpaces = /\s+/.test(t);
  const isPureLatin = /^[A-Za-z0-9\s'’.,!?-]+$/.test(t);

  if (hasSpaces || isPureLatin) {
    const rawTokens = t.split(/(\s+)/);
    const result: string[] = [];
    for (const r of rawTokens) {
      if (r) result.push(r);
    }
    return result;
  }

  const result: string[] = [];
  const chars = Array.from(t);
  let buffer = "";

  for (let i = 0; i < chars.length; i++) {
    buffer += chars[i];
    if (/[，。！？、…；：]/.test(chars[i])) {
      result.push(buffer);
      buffer = "";
    } else if (buffer.length >= 2 && i < chars.length - 1) {
      if (chars.length - i - 1 === 1) {
        // 合并
      } else {
        result.push(buffer);
        buffer = "";
      }
    }
  }
  if (buffer) {
    result.push(buffer);
  }

  return result.length > 0 ? result : [t];
}

function buildSegmentedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  fontSize: number
): { segments: WordSegment[]; totalWidth: number } {
  ctx.save();
  ctx.font = `500 ${fontSize}px ${fontFamily}`;

  const tokenTexts = segmentText(text);
  const segments: WordSegment[] = [];
  let currentOffset = 0;

  for (let i = 0; i < tokenTexts.length; i++) {
    const rawToken = tokenTexts[i];
    const w = ctx.measureText(rawToken).width;
    segments.push({
      text: rawToken,
      width: w,
      startRatio: 0,
      endRatio: 0,
      popTriggerTime: -1,
      currentScale: 0.65,
      currentAlpha: 0,
      currentY: 30,
      depthZ: 0,
      blurPx: 4,
      phaseOffset: i * 0.45,
    });
    currentOffset += w;
  }

  const totalWidth = Math.max(10, currentOffset);

  let accumulatedW = 0;
  for (const seg of segments) {
    seg.startRatio = accumulatedW / totalWidth;
    accumulatedW += seg.width;
    seg.endRatio = accumulatedW / totalWidth;
  }

  ctx.restore();
  return { segments, totalWidth };
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

function findActiveLyricIndex(lyrics: ParsedLrcLine[], time: number): number {
  let low = 0;
  let high = lyrics.length - 1;
  let ans = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lyrics[mid].time <= time) {
      ans = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return ans;
}

function springEaseOut(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
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
      data[i + 3] = Math.floor(Math.random() * 18);
    }
    ctx.putImageData(imgData, 0, 0);
    grainCanvasCache = canvas;
    return grainCanvasCache;
  } catch {
    return null;
  }
}

function render3DDepthSegments(
  ctx: CanvasRenderingContext2D,
  segments: WordSegment[],
  totalWidth: number,
  centerX: number,
  centerY: number,
  currentLineProgress: number,
  lineAlpha: number,
  palette: ColorPalette,
  time: number,
  isExiting: boolean,
  fitScale: number
) {
  if (!segments || segments.length === 0 || lineAlpha <= 0.001) return;

  const startX = centerX - (totalWidth * fitScale) / 2;

  const renderItems: Array<{
    seg: WordSegment;
    drawX: number;
    drawY: number;
    scale: number;
    alpha: number;
    blurPx: number;
    rot: number;
    depthZ: number;
    isActive: boolean;
    isPast: boolean;
  }> = [];

  let runningX = startX;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    const isPast = currentLineProgress >= seg.endRatio;
    const isActive = currentLineProgress >= seg.startRatio && currentLineProgress < seg.endRatio;

    const organicFloatY = Math.sin(time * 1.6 + seg.phaseOffset) * 2.5;
    const organicRot = Math.sin(time * 1.0 + seg.phaseOffset * 0.8) * 0.012;

    const currentScale = (isExiting ? seg.currentScale * lineAlpha : seg.currentScale) * fitScale;
    const currentAlpha = seg.currentAlpha * lineAlpha;
    const drawX = runningX + seg.width * fitScale * 0.5;
    const drawY =
      centerY + (isExiting ? -24 * (1 - lineAlpha) : seg.currentY * fitScale) + organicFloatY;

    if (currentAlpha > 0.001) {
      renderItems.push({
        seg,
        drawX,
        drawY,
        scale: currentScale,
        alpha: currentAlpha,
        blurPx: isExiting ? seg.blurPx + 2 : seg.blurPx,
        rot: organicRot,
        depthZ: seg.depthZ,
        isActive,
        isPast,
      });
    }

    runningX += seg.width * fitScale;
  }

  // Back-to-Front 排序
  renderItems.sort((a, b) => a.depthZ - b.depthZ);

  ctx.save();
  ctx.shadowBlur = 0; // 彻底去除发光

  const hasFilterSupport = typeof ctx.filter === "string";

  for (const item of renderItems) {
    ctx.save();
    ctx.translate(item.drawX, item.drawY);
    ctx.scale(item.scale, item.scale);
    ctx.rotate(item.rot);
    ctx.globalAlpha = item.alpha;

    if (hasFilterSupport) {
      if (item.isActive || item.blurPx < 0.3) {
        ctx.filter = "none";
      } else {
        ctx.filter = `blur(${item.blurPx.toFixed(1)}px)`;
      }
    }

    if (item.isActive) {
      ctx.fillStyle = palette.textFocus;
      ctx.fillText(item.seg.text, 0, 0);
    } else if (item.isPast) {
      ctx.fillStyle = palette.textPast;
      ctx.fillText(item.seg.text, 0, 0);
    } else {
      ctx.fillStyle = palette.textUnsung;
      ctx.fillText(item.seg.text, 0, 0);
    }

    ctx.restore();
  }

  ctx.restore();
}

// =========================================================================
// 2. Main Draw Function
// =========================================================================

export function drawCinematicLyricDrift(effectCtx: EffectContext) {
  const { ctx, width, height, data, time, refs, params } = effectCtx;

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

  const heroFontSize = Math.round(params?.heroFontSize ?? 60);
  const focusScaleMultiplier = params?.focusScale ?? 1.5;
  const depthBlurStrength = params?.depthBlurStrength ?? 1.0;
  const filmGrain = params?.filmGrain ?? 0.2;
  const breathingDepth = params?.breathingDepth ?? 1.0;
  const vignetteStrength = params?.vignetteStrength ?? 0.72;

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

  const smoothFactor = 0.05;
  refs.smoothBass.current += (rawBass - refs.smoothBass.current) * smoothFactor;
  refs.smoothMid.current += (rawMid - refs.smoothMid.current) * smoothFactor;
  refs.smoothTreble.current += (rawTreble - refs.smoothTreble.current) * smoothFactor;

  const totalEnergy =
    refs.smoothBass.current * 0.5 + refs.smoothMid.current * 0.3 + refs.smoothTreble.current * 0.2;

  breathAngle = (breathAngle + 0.016 * (0.35 + totalEnergy * 0.3) * breathingDepth) % (Math.PI * 2);
  const breathSin = Math.sin(breathAngle);
  const auraBreathFactor = 1.0 + breathSin * 0.05 * breathingDepth + refs.smoothBass.current * 0.08;

  if (!refs.bokeh.current || refs.bokeh.current.length === 0) {
    const orbs: SoftAtmosphereOrbItem[] = [];
    const orbCount = 10;
    for (let i = 0; i < orbCount; i++) {
      const baseRadius = 45 + Math.random() * 75;
      orbs.push({
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
    refs.bokeh.current = orbs;
  }

  if (!refs.nebulaStars.current || refs.nebulaStars.current.length === 0) {
    const dust: AmbientDustItem[] = [];
    const dustCount = 70;
    for (let i = 0; i < dustCount; i++) {
      dust.push({
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
    refs.nebulaStars.current = dust;
  }

  const audioState = useAudioStore.getState();
  const playerState = usePlayerStore.getState();
  const currentSong = audioState.currentSong || playerState.currentSong;
  const reportedTime = audioState.currentTime || playerState.currentTime || 0;
  const isPlaying = audioState.isPlaying || playerState.isPlaying;
  const rawLyrics = currentSong?.lyrics || "";

  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();

  if (Math.abs(reportedTime - lastReportedTimeCache) > 0.02) {
    lastReportedTimeCache = reportedTime;
    lastTimeUpdateMsCache = nowMs;
  }

  const elapsedSinceUpdate = isPlaying ? (nowMs - lastTimeUpdateMsCache) / 1000 : 0;
  const preciseTime = lastReportedTimeCache + Math.min(0.8, Math.max(0, elapsedSinceUpdate));

  if (rawLyrics !== lastRawLyricsCache) {
    lastRawLyricsCache = rawLyrics;
    parsedLyricsCache = parseLrc(rawLyrics);
    currentLineTextCache = "";
    currentSegmentsCache = [];
    previousSegmentsCache = [];
    totalLineWidthCache = 0;
    prevLineWidthCache = 0;
    smoothedProgressCache = 0;
  }

  let activeLine = "";
  let targetProgress = 0;
  let isSinging = false;

  if (isPlaying && parsedLyricsCache.length > 0) {
    const activeIdx = findActiveLyricIndex(parsedLyricsCache, preciseTime);

    if (activeIdx >= 0) {
      const curr = parsedLyricsCache[activeIdx];
      const next = parsedLyricsCache[activeIdx + 1];
      const lineDuration = next ? Math.max(1.2, next.time - curr.time) : 5.0;
      const elapsed = preciseTime - curr.time;
      const estimatedDuration = Math.min(lineDuration, Math.max(2.2, curr.text.length * 0.36));

      if (elapsed >= 0 && elapsed <= estimatedDuration + 0.8) {
        isSinging = true;
        activeLine = curr.text;
        targetProgress = Math.min(1.0, Math.max(0.0, elapsed / Math.max(1.0, estimatedDuration)));
      }
    }
  }

  if (activeLine !== currentLineTextCache) {
    if (currentLineTextCache) {
      previousSegmentsCache = currentSegmentsCache;
      prevLineWidthCache = totalLineWidthCache;
      prevLineFadeAlpha = lineTransitionAlpha;
    }
    currentLineTextCache = activeLine;
    lineTransitionAlpha = 0;
    smoothedProgressCache = targetProgress;

    if (activeLine) {
      const { segments, totalWidth } = buildSegmentedLine(
        ctx,
        activeLine,
        selectedFontFamily,
        heroFontSize
      );
      currentSegmentsCache = segments;
      totalLineWidthCache = totalWidth;
    } else {
      currentSegmentsCache = [];
      totalLineWidthCache = 0;
    }
  }

  smoothedProgressCache += (targetProgress - smoothedProgressCache) * 0.28;

  const targetCurrentAlpha = isSinging ? 1.0 : 0.0;
  lineTransitionAlpha += (targetCurrentAlpha - lineTransitionAlpha) * 0.09;
  prevLineFadeAlpha += (0.0 - prevLineFadeAlpha) * 0.1;

  if (currentSegmentsCache.length > 0) {
    const lineProg = smoothedProgressCache;
    const nowTimeSec = time * 0.001;

    for (let i = 0; i < currentSegmentsCache.length; i++) {
      const seg = currentSegmentsCache[i];

      if (lineProg >= seg.startRatio && seg.popTriggerTime < 0) {
        seg.popTriggerTime = nowTimeSec;
      }

      if (seg.popTriggerTime < 0) {
        seg.currentScale = 0.65;
        seg.currentAlpha = 0.0;
        seg.currentY = 28;
        seg.depthZ = 0;
        seg.blurPx = 4.0 * depthBlurStrength;
      } else {
        const timeSincePop = Math.max(0, nowTimeSec - seg.popTriggerTime);
        const popDuration = 0.35;
        const popRatio = Math.min(1.0, timeSincePop / popDuration);
        const springFactor = springEaseOut(popRatio);

        if (lineProg < seg.endRatio) {
          seg.currentScale = 0.65 + (focusScaleMultiplier - 0.65) * springFactor;
          seg.currentAlpha = Math.min(1.0, popRatio * 2.5);
          seg.currentY = 28 * (1 - popRatio);
          seg.depthZ = 100 + i;
          seg.blurPx = 0.0;
        } else {
          const pastProg = Math.min(
            1.0,
            (lineProg - seg.endRatio) / Math.max(0.1, 1.0 - seg.endRatio)
          );
          const targetPastScale = 0.72;
          const targetPastAlpha = 0.35;
          const targetPastY = 12;

          seg.currentScale =
            focusScaleMultiplier - (focusScaleMultiplier - targetPastScale) * pastProg;
          seg.currentAlpha = 1.0 - (1.0 - targetPastAlpha) * pastProg;
          seg.currentY = targetPastY * pastProg;
          seg.depthZ = 10 + i;
          seg.blurPx = (1.5 + pastProg * 4.5) * depthBlurStrength;
        }
      }
    }
  }

  // 绘制
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

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const auraRadius = width * 0.42 * auraBreathFactor;
  const auraAlpha = 0.05 + totalEnergy * 0.06;
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

  if (refs.bokeh.current) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const orb of refs.bokeh.current as SoftAtmosphereOrbItem[]) {
      orb.y += orb.vy;
      orb.x += orb.vx + Math.sin(time * 0.0002 + orb.phase) * 0.08;

      if (orb.y < -orb.baseRadius * 2) {
        orb.y = height + orb.baseRadius * 2;
        orb.x = Math.random() * width;
      }

      const pulse = 1.0 + Math.sin(time * 0.0005 * orb.speed + orb.phase) * 0.1;
      const curR = orb.baseRadius * pulse * auraBreathFactor;
      const alpha = orb.baseAlpha * (0.8 + refs.smoothBass.current * 0.4);

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

  if (refs.nebulaStars.current) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const dust of refs.nebulaStars.current as AmbientDustItem[]) {
      dust.y += dust.vy;
      dust.x += dust.vx + Math.sin(time * 0.0004 * dust.freq + dust.phase) * 0.12;

      if (dust.y < -10) {
        dust.y = height + 10;
        dust.x = Math.random() * width;
      }

      const twinkle = (Math.sin(time * 0.0016 * dust.freq + dust.phase) + 1) * 0.5;
      const dustAlpha = dust.baseAlpha * (0.35 + twinkle * 0.65 + refs.smoothTreble.current * 0.25);

      ctx.fillStyle = palette.dustColor.replace(/[\d.]+\)$/, `${dustAlpha})`);
      ctx.beginPath();
      ctx.arc(dust.x, dust.y, dust.size * (1.0 + refs.smoothTreble.current * 0.15), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const heroY = height * 0.52;
  const heroX = width * 0.5;

  const maxAllowedWidth = width * 0.88;
  const currFitScale =
    totalLineWidthCache > 0 ? Math.min(1.0, maxAllowedWidth / totalLineWidthCache) : 1.0;
  const prevFitScale =
    prevLineWidthCache > 0 ? Math.min(1.0, maxAllowedWidth / prevLineWidthCache) : 1.0;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${heroFontSize}px ${selectedFontFamily}`;

  if (prevLineFadeAlpha > 0.005 && previousSegmentsCache.length > 0) {
    render3DDepthSegments(
      ctx,
      previousSegmentsCache,
      prevLineWidthCache,
      heroX,
      heroY,
      1.0,
      prevLineFadeAlpha * 0.6,
      palette,
      time * 0.001,
      true,
      prevFitScale
    );
  }

  if (lineTransitionAlpha > 0.005 && currentSegmentsCache.length > 0) {
    render3DDepthSegments(
      ctx,
      currentSegmentsCache,
      totalLineWidthCache,
      heroX,
      heroY,
      smoothedProgressCache,
      lineTransitionAlpha,
      palette,
      time * 0.001,
      false,
      currFitScale
    );
  }

  ctx.restore();

  const grainCanvas = createFilmGrainCanvas();
  if (filmGrain > 0.05 && grainCanvas) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = Math.min(0.14, filmGrain * 0.12);
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

  if (vignetteStrength > 0.05) {
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
  }
}
