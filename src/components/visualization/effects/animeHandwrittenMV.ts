/**
 * 「动漫手书 MV」（Anime Handwritten MV）—— 次世代电影级手绘动漫画风独立可视化特效。
 *
 * 核心升级（v2.0-Cinematic · 电影级 AE 3D 景深拉镜全案重构）：
 * 1. 真正的四层电影多平面 3D 摄像机视差系统（Multiplane 3D Camera System）：
 *    - Layer 1 (远景背景): 暮色青蓝与琥珀金新海诚调色底色，2~3 道 45° 晨曦丁达尔体积光柱（God Rays），随低音频谱柔和呼吸。
 *    - Layer 2 (中远景金尘): 200+ 颗微米级悬浮金色微粒（Z 轴分布在 200~1200），具有慢速布朗运动与焦外散景。
 *    - Layer 3 (黄金手书主体层):
 *      - 35mm 虚拟广角镜头透视公式：scale = f / (f + relZ)，其中 f = 480。
 *      - 镜头推拉运动动力学：入场时以极大初速度从 Z=800px 冲刺进入，通过 Quartic Ease Out (1 - (1-p)^4) 平稳阻尼减速刹车至焦点 Z=0；
 *        唱完时通过 Cubic Ease In (p^3) 加速穿过近裁剪面 (Z -> -400px) 飞掠出镜头。
 *      - 黄金焦点驻留时保持微小的空气呼吸浮动（±1.8px 正弦轻浮）。
 *      - 排版与视觉质感：日系电影原画排版（大字手书主歌词「」+ 顶部微注毫秒级时间戳如 01:42.80 + 歌曲原名小注）；
 *        字符笔触带有温润金色外发光（Gold Ink Diffusion）与墨水微渗。
 *    - Layer 4 (前景掠镜与光学后期层):
 *      - 前景高速贴镜掠过的大散景光斑（Z = -100 ~ -350）。
 *      - 鼓点重低音（Kick/Bass）触发的 1.5% 镜头呼吸微缩放（Lens Breathing）与 1~2px 红蓝色散微脉冲（Chromatic Aberration）。
 *      - 2.39:1 院线宽银幕遮幅（Cinemascope Letterbox）与电影暗角（Film Vignette），支持自适应安全区。
 */

import type { EffectContext } from "./types";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { parseTimedLyrics, type ParsedLyricLine } from "./lyricTimeline";

// ==========================================
// 1. 类型定义
// ==========================================

export interface AnimePalette {
  id: number;
  name: string;
  paper: string;
  paperDeep: string;
  ink: string;
  inkSoft: string;
  accent: string;
  splatterColors: string[];
  vignette: string;
  glow: string;
  warmLightInner: string;
  warmLightOuter: string;
  dark: boolean;
}

export interface AudioTransientOptions {
  thresholdMultiplier?: number;
  minEnergy?: number;
  decayAlpha?: number;
  bassBinsCount?: number;
  energyDeltaThreshold?: number;
}

export interface AudioTransientResult {
  isBeat: boolean;
  energy: number;
  intensity: number;
  newAverage: number;
}

export interface InkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  decayRate: number;
  stainSize: number;
}

export interface GoldDustParticle {
  x: number;
  y: number;
  z: number; // 200..1200
  vx: number;
  vy: number;
  vz: number;
  size: number;
  baseAlpha: number;
  seed: number;
  color: string;
}

export interface ForegroundBokehDisc {
  x: number;
  y: number;
  z: number; // -100..-350
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
}

export interface VirtualCameraState {
  zoom: number;
  targetZoom: number;
  x: number;
  y: number;
  rotation: number;
  shakeX: number;
  shakeY: number;
  shakeIntensity: number;
}

export interface AECameraState {
  cameraZ: number;
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
  shakeX: number;
  shakeY: number;
  shakeIntensity: number;
  transitionProgress: number;
  isInterlude: boolean;
}

export interface WarmLightSweepState {
  active: boolean;
  progress: number;
  intensity: number;
  sweepX: number;
  sweepAngle: number;
  beamWidth: number;
  colorInner: string;
  colorOuter: string;
  textGlowBoost: number;
}

export interface LyricDepthItem {
  index: number;
  text: string;
  worldZ: number;
  relZ: number;
  scale: number;
  opacity: number;
  yOffset: number;
  blur: number;
  isCurrent: boolean;
  isPrevious: boolean;
  isNext: boolean;
  inkGrowth: number;
}

export interface CinemascopeBars {
  barHeight: number;
  safeTop: number;
  safeBottom: number;
  safeHeight: number;
  active: boolean;
  aspectRatio: number;
}

interface AnimeMVRuntimeState {
  prevLineIndex: number;
  targetLineIndex: number;
  lineTransitionProgress: number; // 0..1
  lineTransitionStartTime: number;
  lastMusicTime: number;
  lastFrameTimeMs: number;
  bassAverage: number;
  camera: VirtualCameraState;
  continuousCameraZ: number;
  particles: InkParticle[];
  goldDust: GoldDustParticle[];
  foregroundBokeh: ForegroundBokehDisc[];
  cachedLyricsText: string;
  parsedLines: ParsedLyricLine[];
}

// ==========================================
// 2. 调色板系统（新海诚黄昏与温光金辉基准）
// ==========================================

export const ANIME_PALETTES: readonly AnimePalette[] = [
  {
    id: 0,
    name: "日光暖纸",
    paper: "#FAF5EC",
    paperDeep: "#EAE0CF",
    ink: "#1E1A18",
    inkSoft: "rgba(42, 35, 30, 0.68)",
    accent: "#E08A3C",
    splatterColors: ["#1E1A18", "#D9653B", "#F3A252", "#C94B32"],
    vignette: "rgba(85, 60, 42, 0.22)",
    glow: "rgba(255, 215, 130, 0.35)",
    warmLightInner: "rgba(255, 235, 170, 0.48)",
    warmLightOuter: "rgba(255, 185, 75, 0)",
    dark: false,
  },
  {
    id: 1,
    name: "暮色群青",
    paper: "#0E1424",
    paperDeep: "#080B14",
    ink: "#F2F6FF",
    inkSoft: "rgba(210, 226, 255, 0.70)",
    accent: "#4B96FF",
    splatterColors: ["#4B96FF", "#78D8A0", "#AF57F5", "#E4EEFF"],
    vignette: "rgba(3, 5, 12, 0.68)",
    glow: "rgba(75, 150, 255, 0.36)",
    warmLightInner: "rgba(215, 235, 255, 0.42)",
    warmLightOuter: "rgba(75, 150, 255, 0)",
    dark: true,
  },
  {
    id: 2,
    name: "秋叶山吹",
    paper: "#F4ECE1",
    paperDeep: "#DFCBB4",
    ink: "#2B211C",
    inkSoft: "rgba(65, 48, 42, 0.68)",
    accent: "#E59500",
    splatterColors: ["#2B211C", "#C84B31", "#E59500", "#A83232"],
    vignette: "rgba(75, 42, 28, 0.26)",
    glow: "rgba(245, 170, 45, 0.34)",
    warmLightInner: "rgba(255, 225, 145, 0.46)",
    warmLightOuter: "rgba(230, 140, 30, 0)",
    dark: false,
  },
  {
    id: 3,
    name: "封面自适应",
    paper: "#181A20",
    paperDeep: "#0F1116",
    ink: "#F5F6FA",
    inkSoft: "rgba(235, 240, 248, 0.68)",
    accent: "#FF5E7E",
    splatterColors: ["#FF5E7E", "#00F0FF", "#F5F6FA", "#FFA07A"],
    vignette: "rgba(8, 10, 15, 0.62)",
    glow: "rgba(255, 94, 126, 0.32)",
    warmLightInner: "rgba(255, 210, 225, 0.42)",
    warmLightOuter: "rgba(255, 94, 126, 0)",
    dark: true,
  },
];

/**
 * 解析动漫手书 MV 调色板
 * 支持 0: 日光暖纸、1: 暮色群青、2: 秋叶山吹、3: 封面自适应
 */
export function resolveAnimePalette(schemeIndex: number, coverColor?: string | null): AnimePalette {
  const normalizedIndex = Math.abs(Math.floor(schemeIndex)) % 4;

  if (normalizedIndex !== 3 || !coverColor) {
    return ANIME_PALETTES[normalizedIndex] ?? ANIME_PALETTES[0];
  }

  // 封面自适应处理
  const hex = coverColor.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    if (brightness > 140) {
      // 亮色封面：温暖象牙宣纸 + 封面主题墨滴
      return {
        id: 3,
        name: "封面自适应",
        paper: "#FDFBF7",
        paperDeep: "#EFE8DC",
        ink: "#1E1C1A",
        inkSoft: "rgba(35, 30, 25, 0.68)",
        accent: `#${hex}`,
        splatterColors: [`#${hex}`, "#1E1C1A", "rgba(230, 100, 60, 0.8)"],
        vignette: "rgba(70, 50, 40, 0.20)",
        glow: `rgba(${r}, ${g}, ${b}, 0.28)`,
        warmLightInner: `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.45)`,
        warmLightOuter: `rgba(${r}, ${g}, ${b}, 0)`,
        dark: false,
      };
    }

    // 暗色封面：深色水墨纸底 + 荧亮墨线
    return {
      id: 3,
      name: "封面自适应",
      paper: "#13161C",
      paperDeep: "#0B0D11",
      ink: "#F4F6FB",
      inkSoft: "rgba(220, 225, 235, 0.68)",
      accent: `#${hex}`,
      splatterColors: [`#${hex}`, "#F4F6FB", "rgba(100, 200, 255, 0.8)"],
      vignette: "rgba(4, 6, 9, 0.68)",
      glow: `rgba(${r}, ${g}, ${b}, 0.32)`,
      warmLightInner: `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, 0.42)`,
      warmLightOuter: `rgba(${r}, ${g}, ${b}, 0)`,
      dark: true,
    };
  }

  return ANIME_PALETTES[3];
}

// ==========================================
// 3. 35mm 虚拟广角透视投影与 3D 摄像机动力学
// ==========================================

/**
 * 35mm 虚拟广角镜头透视比例公式：
 * S = f / (f + relZ)，其中 f 默认为 480。
 * 设定有效深度下界保护以防止除零或奇异透视反向。
 */
export function calculatePerspectiveScale(relZ: number, focalLength = 480): number {
  const safeFocal = Math.max(10, focalLength);
  const effectiveDepth = Math.max(safeFocal * 0.15, safeFocal + relZ);
  return safeFocal / effectiveDepth;
}

/**
 * 镜头推拉运动动力学 (Dolly Physics)：
 * 设一句话在时间轴上的归一化时间为 u in [0, 1]：
 * 1. 入场推镜阶段 (u in [0, 0.35]):
 *    以极大初速度冲刺进入，通过 Quartic Ease Out (1 - (1-p)^4) 平稳阻尼减速刹车至焦点 Z = 0。
 * 2. 黄金焦点呼吸驻留阶段 (u in [0.35, 0.85]):
 *    Z(u) 在 0 附近保持微小正弦空气呼吸浮动 (±1.5px)。
 * 3. 穿透飞掠离场阶段 (u in [0.85, 1.0]):
 *    通过 Cubic Ease In (p^3) 加速穿透近裁剪面 (Z -> -400px) 掠出镜头。
 */
export function calculateDollyZ(u: number, zStart = 800, zFlyout = 400): number {
  const clampedU = Math.max(0, Math.min(1, u));

  if (clampedU <= 0.35) {
    const pIn = Math.min(1, clampedU / 0.35);
    const easeOut = 1 - Math.pow(1 - pIn, 4);
    return zStart * (1 - easeOut);
  }

  if (clampedU <= 0.85) {
    const pDwell = (clampedU - 0.35) / 0.5;
    return Math.sin(pDwell * Math.PI * 2) * 1.5;
  }

  if (clampedU >= 1.0) {
    return -zFlyout;
  }

  const pOut = Math.min(1, (clampedU - 0.85) / 0.15);
  const easeIn = Math.pow(pOut, 3);
  return -zFlyout * easeIn;
}

/**
 * 光学焦外虚化量模型 (DoF Blur Radius)：
 * Blur(Z) =
 *   min(14, Z / 50), if Z > 0 (远景失焦)
 *   0, if Z = 0 (焦点锐利)
 *   min(24, -Z / 15), if Z < 0 (近景大散景爆开)
 */
export function calculateDoFBlur(z: number): number {
  if (z > 0) {
    return Math.min(14, z / 50);
  }
  if (z < 0) {
    return Math.min(24, -z / 15);
  }
  return 0;
}

/**
 * 2.39:1 院线宽银幕遮幅 (Cinemascope Letterbox) 与自适应安全区计算：
 * 当视口比例低于 2.39:1 时，计算上下遮幅黑条高度及内容安全区域。
 */
export function calculateCinemascopeBars(
  width: number,
  height: number,
  targetAspect = 2.39
): CinemascopeBars {
  if (height <= 0 || width <= 0) {
    return {
      barHeight: 0,
      safeTop: 0,
      safeBottom: Math.max(0, height),
      safeHeight: Math.max(0, height),
      active: false,
      aspectRatio: 1,
    };
  }

  const currentAspect = width / height;
  if (currentAspect < targetAspect) {
    const targetHeight = width / targetAspect;
    const barHeight = Math.max(0, (height - targetHeight) / 2);
    return {
      barHeight,
      safeTop: barHeight,
      safeBottom: height - barHeight,
      safeHeight: height - barHeight * 2,
      active: barHeight > 1,
      aspectRatio: targetAspect,
    };
  }

  return {
    barHeight: 0,
    safeTop: 0,
    safeBottom: height,
    safeHeight: height,
    active: false,
    aspectRatio: currentAspect,
  };
}

/**
 * 毫秒级时间戳格式化：如 01:42.80 (分:秒.毫秒百分位)
 */
export function formatLyricTimestamp(seconds: number): string {
  if (typeof seconds !== "number" || Number.isNaN(seconds) || seconds < 0) {
    return "00:00.00";
  }
  const totalCentiSeconds = Math.round(seconds * 100);
  const mins = Math.floor(totalCentiSeconds / 6000);
  const remCenti = totalCentiSeconds % 6000;
  const wholeSecs = Math.floor(remCenti / 100);
  const millis = remCenti % 100;

  const mStr = String(mins).padStart(2, "0");
  const sStr = String(wholeSecs).padStart(2, "0");
  const msStr = String(millis).padStart(2, "0");
  return `${mStr}:${sStr}.${msStr}`;
}

/**
 * 日系原画排版主歌词包装：大字手书「」
 */
export function formatJapaneseAnimeLyric(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("「") ||
    trimmed.startsWith("『") ||
    trimmed.startsWith("【") ||
    trimmed.startsWith("（") ||
    trimmed.startsWith("(") ||
    trimmed.startsWith("[")
  ) {
    return trimmed;
  }
  return `「${trimmed}」`;
}

// ==========================================
// 4. AE 连续摄像机与贝塞尔数学计算（兼容保留与增强）
// ==========================================

/**
 * AE 连续摄像机三次/五次贝塞尔缓动方程 (SmootherStep Easing)
 * 一阶导与二阶导在端点均为 0，无任何突跳感，保证推进轨迹极致丝滑
 */
export function calculateCameraTransitionEasing(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

/**
 * 计算虚拟摄像机缩放插值（兼容保留供独立调用与测试）
 */
export function calculateCameraZoom(progress: number, isInterlude = false): number {
  if (isInterlude) {
    const t = Math.min(Math.max(progress, 0), 1);
    return 1.1 - 0.1 * (t * (2 - t));
  }

  if (progress <= 0) return 1.0;

  const attackDuration = 0.15;
  if (progress < attackDuration) {
    const u = progress / attackDuration;
    return 1.0 + 0.8 * (1 - Math.pow(1 - u, 3));
  }

  if (progress <= 1.0) {
    const v = (progress - attackDuration) / (1.0 - attackDuration);
    return 1.1 + 0.7 * Math.pow(1 - v, 2);
  }

  return 1.1;
}

/**
 * 计算 AE 连续 3D 摄像机推镜状态 (Continuous 3D AE Dolly Camera)
 */
export function calculateContinuousAECamera(
  lineIndex: number,
  transitionProgress: number,
  isInterlude: boolean,
  options?: {
    zoomScale?: number;
    depthStep?: number;
    shakeIntensity?: number;
    shakeX?: number;
    shakeY?: number;
  }
): AECameraState {
  const zoomScale = options?.zoomScale ?? 1.8;
  const depthStep = options?.depthStep ?? 600;
  const shakeIntensity = options?.shakeIntensity ?? 0;
  const shakeX = options?.shakeX ?? 0;
  const shakeY = options?.shakeY ?? 0;

  const effectiveProgress = Math.max(0, Math.min(1, transitionProgress));
  const eased = calculateCameraTransitionEasing(effectiveProgress);

  const baseIndex = Math.max(0, lineIndex);
  const cameraZ = (baseIndex - (1 - eased)) * depthStep;

  let zoom = 1.0;
  if (isInterlude) {
    zoom = 1.0;
  } else {
    const punch = Math.sin(effectiveProgress * Math.PI) * 0.12;
    zoom = 1.0 + (zoomScale - 1.0) * 0.45 + punch;
  }

  return {
    cameraZ,
    zoom,
    panX: 0,
    panY: 0,
    rotation: 0,
    shakeX,
    shakeY,
    shakeIntensity,
    transitionProgress: effectiveProgress,
    isInterlude,
  };
}

// ==========================================
// 5. 温光扫过（Warm Light Sweep）计算
// ==========================================

export function resolveWarmLightSweep(
  transitionProgress: number,
  isInterlude: boolean,
  colorScheme = 0
): WarmLightSweepState {
  if (isInterlude || transitionProgress < 0 || transitionProgress > 1.0) {
    return {
      active: false,
      progress: 0,
      intensity: 0,
      sweepX: -0.2,
      sweepAngle: 0.42,
      beamWidth: 260,
      colorInner: "rgba(255, 230, 160, 0)",
      colorOuter: "rgba(255, 170, 70, 0)",
      textGlowBoost: 0,
    };
  }

  const p = Math.max(0, Math.min(1, transitionProgress));
  const intensity = Math.sin(p * Math.PI);
  const sweepX = -0.2 + 1.4 * p;
  const textGlowBoost = intensity * 0.85;

  const palette = resolveAnimePalette(colorScheme);

  return {
    active: true,
    progress: p,
    intensity,
    sweepX,
    sweepAngle: 0.42,
    beamWidth: 280,
    colorInner: palette.warmLightInner,
    colorOuter: palette.warmLightOuter,
    textGlowBoost,
  };
}

// ==========================================
// 6. 多行歌词空间纵深连续排布 (Zero-Clipping Depth Layout)
// ==========================================

export function calculateLyricZPositions(
  lines: ParsedLyricLine[],
  currentLineIndex: number,
  cameraZ: number,
  transitionProgress: number,
  options?: {
    depthStep?: number;
    zoomScale?: number;
    focalDistance?: number;
  }
): LyricDepthItem[] {
  if (!lines || lines.length === 0 || currentLineIndex < 0) {
    return [];
  }

  const depthStep = options?.depthStep ?? 600;
  const focalDistance = options?.focalDistance ?? 900;

  const items: LyricDepthItem[] = [];
  const p = Math.max(0, Math.min(1, transitionProgress));

  const minIndex = Math.max(0, currentLineIndex - 1);
  const maxIndex = Math.min(lines.length - 1, currentLineIndex + 2);

  for (let i = minIndex; i <= maxIndex; i++) {
    const line = lines[i];
    if (!line || !line.text.trim()) continue;

    const worldZ = i * depthStep;
    const relZ = worldZ - cameraZ;

    const effectiveDepth = Math.max(focalDistance * 0.25, focalDistance + relZ);
    const perspectiveScale = focalDistance / effectiveDepth;

    let opacity = 0;
    let yOffset = 0;
    let blur = calculateDoFBlur(relZ);
    let inkGrowth = 1.0;

    const isCurrent = i === currentLineIndex;
    const isPrevious = i === currentLineIndex - 1;
    const isNext = i === currentLineIndex + 1;

    if (isCurrent) {
      opacity = 0.35 + 0.65 * calculateCameraTransitionEasing(p);
      yOffset = (1 - calculateCameraTransitionEasing(p)) * 24;
      blur = Math.max(0, (1 - p) * 2.5);
      inkGrowth = Math.min(1.0, 0.3 + 0.7 * p);
    } else if (isPrevious) {
      const fadeProgress = calculateCameraTransitionEasing(p);
      opacity = Math.max(0, 1.0 - fadeProgress * 1.25);
      yOffset = -fadeProgress * 80;
      blur = Math.max(blur, fadeProgress * 3.5);
      inkGrowth = 1.0;
    } else if (isNext) {
      const appearProgress = calculateCameraTransitionEasing(p);
      opacity = 0.22 + 0.16 * appearProgress;
      yOffset = 64 - appearProgress * 14;
      blur = Math.max(1.8, blur);
      inkGrowth = 0.4;
    } else {
      opacity = 0.1;
      yOffset = 110;
      blur = Math.max(3.0, blur);
      inkGrowth = 0.2;
    }

    items.push({
      index: i,
      text: line.text,
      worldZ,
      relZ,
      scale: perspectiveScale,
      opacity: Math.min(Math.max(opacity, 0), 1),
      yOffset,
      blur,
      isCurrent,
      isPrevious,
      isNext,
      inkGrowth,
    });
  }

  return items;
}

// ==========================================
// 7. 音频瞬态重拍检测（Kick / Bass Transients）
// ==========================================

export function detectAudioTransient(
  audioData: Uint8Array | readonly number[] | number[],
  prevAverage: number,
  options?: AudioTransientOptions
): AudioTransientResult {
  if (!audioData || audioData.length < 2) {
    return { isBeat: false, energy: 0, intensity: 0, newAverage: prevAverage };
  }

  const thresholdMultiplier = options?.thresholdMultiplier ?? 1.25;
  const minEnergy = options?.minEnergy ?? 35;
  const energyDeltaThreshold = options?.energyDeltaThreshold ?? 20;
  const decayAlpha = options?.decayAlpha ?? 0.85;
  const bassBins = Math.min(audioData.length - 1, options?.bassBinsCount ?? 8);

  let sum = 0;
  let count = 0;
  for (let i = 1; i <= bassBins; i++) {
    sum += audioData[i] ?? 0;
    count++;
  }
  const energy = count > 0 ? sum / count : 0;

  const isAboveMin = energy >= minEnergy;
  const isAboveRatio =
    prevAverage > 0 ? energy >= prevAverage * thresholdMultiplier : energy >= minEnergy;
  const isAboveDelta = energy - prevAverage >= energyDeltaThreshold;

  const isBeat = isAboveMin && (isAboveRatio || isAboveDelta);
  const intensity = isBeat ? Math.min(Math.max((energy - prevAverage) / 100, 0.2), 1.0) : 0;

  const newAverage = prevAverage * decayAlpha + energy * (1 - decayAlpha);

  return {
    isBeat,
    energy,
    intensity,
    newAverage,
  };
}

// ==========================================
// 8. 抽帧定格与线稿抖动
// ==========================================

export function calculateSteppedTime(time: number, fps = 12): number {
  if (fps <= 0) return time;
  return Math.floor(time * fps) / fps;
}

export function calculateSteppedFrame(time: number, fps = 12): number {
  if (fps <= 0) return Math.floor(time * 12);
  return Math.floor(time * fps);
}

export function calculatePenJitter(
  seed: number,
  frameIndex: number,
  amplitude = 1.5
): { x: number; y: number; angle: number } {
  const h1 = Math.sin(seed * 12.9898 + frameIndex * 78.233) * 43758.5453;
  const h2 = Math.cos(seed * 39.346 + frameIndex * 11.135) * 23421.631;
  const r1 = (h1 - Math.floor(h1)) * 2 - 1;
  const r2 = (h2 - Math.floor(h2)) * 2 - 1;

  return {
    x: r1 * amplitude,
    y: r2 * amplitude,
    angle: r1 * amplitude * 0.008,
  };
}

// ==========================================
// 9. 物理水彩墨滴粒子系统
// ==========================================

export function spawnInkSplatter(
  x: number,
  y: number,
  count: number,
  colors: string[],
  intensity = 1.0
): InkParticle[] {
  const particles: InkParticle[] = [];
  const safeCount = Math.max(1, count);
  const colorList = colors.length > 0 ? colors : ["#1E1A18"];

  for (let i = 0; i < safeCount; i++) {
    const angle = (Math.PI * 2 * i) / safeCount + (Math.random() - 0.5) * 0.5;
    const speed = (2.0 + Math.random() * 5.0) * intensity;
    const color = colorList[i % colorList.length] ?? colorList[0];
    const initialSize = 1.5 + Math.random() * 3.5;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: initialSize,
      color,
      alpha: 0.8 + Math.random() * 0.2,
      life: 1.0,
      decayRate: 0.8 + Math.random() * 0.8,
      stainSize: initialSize * (1.2 + Math.random() * 0.6),
    });
  }

  return particles;
}

export function updateInkParticles(particles: InkParticle[], dt: number): InkParticle[] {
  const next: InkParticle[] = [];
  const stepRatio = Math.min(Math.max(dt, 0.001), 0.1) * 60;

  for (const p of particles) {
    p.life -= dt * p.decayRate;
    if (p.life <= 0) continue;

    p.x += p.vx * stepRatio;
    p.y += p.vy * stepRatio;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.vy += 0.08 * stepRatio;
    p.size += (p.stainSize - p.size) * 0.08 * stepRatio;

    next.push(p);
  }

  return next;
}

// ==========================================
// 10. 中远景金尘与前景大散景物理系统（Layer 2 & Layer 4）
// ==========================================

export function spawnGoldDust(
  count = 240,
  viewportWidth = 1920,
  viewportHeight = 1080
): GoldDustParticle[] {
  const particles: GoldDustParticle[] = [];
  const colors = ["#ffe8a3", "#ffd280", "#ffaa40", "#ffffff", "#fff3cc"];
  const halfW = viewportWidth * 0.85;
  const halfH = viewportHeight * 0.85;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: (Math.random() - 0.5) * halfW * 2,
      y: (Math.random() - 0.5) * halfH * 2,
      z: 200 + Math.random() * 1000,
      vx: (Math.random() - 0.5) * 14,
      vy: -12 - Math.random() * 16, // 缓速向上漂浮微风
      vz: (Math.random() - 0.5) * 8,
      size: 1.2 + Math.random() * 2.8,
      baseAlpha: 0.35 + Math.random() * 0.5,
      seed: Math.random() * 1000,
      color: colors[i % colors.length] ?? colors[0],
    });
  }
  return particles;
}

export function updateGoldDust(
  particles: GoldDustParticle[],
  dt: number,
  viewportWidth = 1920,
  viewportHeight = 1080,
  audioEnergy = 0
): GoldDustParticle[] {
  const safeDt = Math.min(Math.max(dt, 0.001), 0.1);
  const halfW = viewportWidth * 0.9;
  const halfH = viewportHeight * 0.9;
  const energyBoost = 1.0 + (audioEnergy / 255) * 0.5;

  for (const p of particles) {
    p.x += (p.vx + Math.sin(p.seed + p.y * 0.02) * 8) * safeDt * energyBoost;
    p.y += (p.vy + Math.cos(p.seed + p.x * 0.02) * 6) * safeDt * energyBoost;
    p.z += p.vz * safeDt;

    // 空间无缝回环
    if (p.y < -halfH) {
      p.y = halfH;
      p.x = (Math.random() - 0.5) * halfW * 2;
    } else if (p.y > halfH) {
      p.y = -halfH;
    }

    if (p.x < -halfW) {
      p.x = halfW;
    } else if (p.x > halfW) {
      p.x = -halfW;
    }

    if (p.z < 200) {
      p.z = 1200;
    } else if (p.z > 1200) {
      p.z = 200;
    }
  }

  return particles;
}

export function spawnForegroundBokeh(
  count = 7,
  viewportWidth = 1920,
  viewportHeight = 1080
): ForegroundBokehDisc[] {
  const discs: ForegroundBokehDisc[] = [];
  const colors = [
    "rgba(255, 215, 130, 0.18)",
    "rgba(255, 185, 80, 0.15)",
    "rgba(255, 235, 180, 0.20)",
    "rgba(255, 170, 60, 0.14)",
  ];
  const halfW = viewportWidth * 0.75;
  const halfH = viewportHeight * 0.65;

  for (let i = 0; i < count; i++) {
    discs.push({
      x: (Math.random() - 0.5) * halfW * 2,
      y: (Math.random() - 0.5) * halfH * 2,
      z: -100 - Math.random() * 250, // -100 ~ -350
      vx: (Math.random() > 0.5 ? 1 : -1) * (24 + Math.random() * 38), // 高速贴镜掠过
      vy: (Math.random() - 0.5) * 18,
      radius: 36 + Math.random() * 46,
      color: colors[i % colors.length] ?? colors[0],
      alpha: 0.14 + Math.random() * 0.14,
    });
  }
  return discs;
}

export function updateForegroundBokeh(
  discs: ForegroundBokehDisc[],
  dt: number,
  viewportWidth = 1920,
  viewportHeight = 1080
): ForegroundBokehDisc[] {
  const safeDt = Math.min(Math.max(dt, 0.001), 0.1);
  const halfW = viewportWidth * 0.85;
  const halfH = viewportHeight * 0.75;

  for (const d of discs) {
    d.x += d.vx * safeDt;
    d.y += d.vy * safeDt;

    if (d.vx > 0 && d.x > halfW) {
      d.x = -halfW;
      d.y = (Math.random() - 0.5) * halfH * 2;
    } else if (d.vx < 0 && d.x < -halfW) {
      d.x = halfW;
      d.y = (Math.random() - 0.5) * halfH * 2;
    }

    if (d.y > halfH) {
      d.y = -halfH;
    } else if (d.y < -halfH) {
      d.y = halfH;
    }
  }

  return discs;
}

// ==========================================
// 11. 4 层多平面特效渲染绘制管线
// ==========================================

/**
 * Layer 1: 45° 晨曦丁达尔体积光柱 (God Rays)
 */
export function drawTyndallGodRays(
  c: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  bassEnergy: number,
  palette: AnimePalette
): void {
  c.save();
  c.globalCompositeOperation = "screen";

  const rayCount = 3;
  const bassNorm = Math.min(1.0, bassEnergy / 255);
  const breath = 1.0 + Math.sin(time * 0.85) * 0.18 + bassNorm * 0.35;

  const originX = -width * 0.05;
  const originY = -height * 0.1;

  for (let i = 0; i < rayCount; i++) {
    const angleOffset = (i - 1) * 0.16 + Math.sin(time * 0.4 + i * 1.8) * 0.04;
    const angle = Math.PI / 4 + angleOffset;
    const rayLength = Math.hypot(width, height) * 1.4;

    const endX1 = originX + Math.cos(angle - 0.08) * rayLength;
    const endY1 = originY + Math.sin(angle - 0.08) * rayLength;
    const endX2 = originX + Math.cos(angle + 0.08) * rayLength;
    const endY2 = originY + Math.sin(angle + 0.08) * rayLength;

    const grad = c.createLinearGradient(
      originX,
      originY,
      originX + Math.cos(angle) * rayLength,
      originY + Math.sin(angle) * rayLength
    );

    const baseColor = palette.dark
      ? `rgba(255, 195, 110, ${0.08 * breath})`
      : `rgba(255, 220, 150, ${0.1 * breath})`;
    const midColor = palette.dark
      ? `rgba(255, 170, 70, ${0.04 * breath})`
      : `rgba(255, 200, 110, ${0.05 * breath})`;

    grad.addColorStop(0, baseColor);
    grad.addColorStop(0.35, midColor);
    grad.addColorStop(0.8, "rgba(255, 180, 80, 0)");
    grad.addColorStop(1, "rgba(255, 180, 80, 0)");

    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(originX, originY);
    c.lineTo(endX1, endY1);
    c.lineTo(endX2, endY2);
    c.closePath();
    c.fill();
  }

  c.restore();
}

/**
 * Layer 2: 中远景浮动金尘 (Gold Dust)
 */
export function drawGoldDustLayer(
  c: CanvasRenderingContext2D,
  particles: GoldDustParticle[],
  centerX: number,
  centerY: number,
  focalLength = 480
): void {
  c.save();
  c.globalCompositeOperation = "screen";

  for (const p of particles) {
    const scale = calculatePerspectiveScale(p.z, focalLength);
    const screenX = centerX + p.x * scale;
    const screenY = centerY + p.y * scale;

    const blur = calculateDoFBlur(p.z);
    const radius = Math.max(0.6, p.size * scale * (1.0 + blur * 0.28));
    const alpha = Math.min(1.0, Math.max(0.04, p.baseAlpha * scale * 1.5));

    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = p.color;

    if (blur > 3.0) {
      c.shadowColor = p.color;
      c.shadowBlur = blur * 1.5;
    }

    c.beginPath();
    c.arc(screenX, screenY, radius, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  c.restore();
}

/**
 * Layer 4: 前景掠镜超大散景 (Foreground Bokeh Discs)
 */
export function drawForegroundBokehLayer(
  c: CanvasRenderingContext2D,
  discs: ForegroundBokehDisc[],
  centerX: number,
  centerY: number,
  focalLength = 480
): void {
  c.save();
  c.globalCompositeOperation = "screen";

  for (const d of discs) {
    const scale = calculatePerspectiveScale(d.z, focalLength);
    const screenX = centerX + d.x * scale;
    const screenY = centerY + d.y * scale;

    const blur = calculateDoFBlur(d.z);
    const radius = Math.max(14, d.radius * (1 + blur * 0.12));

    const grad = c.createRadialGradient(screenX, screenY, radius * 0.15, screenX, screenY, radius);
    grad.addColorStop(0, "rgba(255, 235, 170, 0)");
    grad.addColorStop(0.65, "rgba(255, 210, 120, 0.12)");
    grad.addColorStop(0.9, "rgba(255, 190, 80, 0.22)");
    grad.addColorStop(1, "rgba(255, 180, 60, 0)");

    c.fillStyle = grad;
    c.beginPath();
    c.arc(screenX, screenY, radius, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
}

// ==========================================
// 12. 歌词时间线与间奏检测
// ==========================================

export function findActiveLyricLineIndex(lines: ParsedLyricLine[], time: number): number {
  if (lines.length === 0 || time < lines[0].start) return -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (time >= lines[i].start) {
      return i;
    }
  }
  return -1;
}

export function checkIsInterlude(
  lines: ParsedLyricLine[],
  lineIndex: number,
  time: number
): boolean {
  if (lines.length === 0) return true;
  if (lineIndex === -1) {
    return lines[0].start - time > 1.8;
  }

  const currentLine = lines[lineIndex];
  const text = currentLine.text.trim();
  if (
    text === "" ||
    /^(?:\[|\(|（|【)?(?:间奏|演奏|solo|instrumental|music|intro|outro)(?:\]|\)|）|】)?$/i.test(
      text
    )
  ) {
    return true;
  }

  const nextLine = lines[lineIndex + 1];
  if (!nextLine) {
    return time - currentLine.start > 6.0;
  }

  const gap = nextLine.start - currentLine.start;
  if (gap >= 7.0 && time - currentLine.start >= 4.5) {
    return true;
  }

  return false;
}

// ==========================================
// 13. 运行时状态管理
// ==========================================

const runtimeCache = new WeakMap<CanvasRenderingContext2D, AnimeMVRuntimeState>();

function getOrCreateRuntimeState(
  ctx: CanvasRenderingContext2D,
  initialMusicTime: number,
  initialTimeMs: number
): AnimeMVRuntimeState {
  let state = runtimeCache.get(ctx);
  if (!state) {
    state = {
      prevLineIndex: -1,
      targetLineIndex: -1,
      lineTransitionProgress: 1.0,
      lineTransitionStartTime: 0,
      lastMusicTime: initialMusicTime,
      lastFrameTimeMs: initialTimeMs,
      bassAverage: 30,
      camera: {
        zoom: 1.0,
        targetZoom: 1.0,
        x: 0,
        y: 0,
        rotation: 0,
        shakeX: 0,
        shakeY: 0,
        shakeIntensity: 0,
      },
      continuousCameraZ: 0,
      particles: [],
      goldDust: spawnGoldDust(240, 1920, 1080),
      foregroundBokeh: spawnForegroundBokeh(7, 1920, 1080),
      cachedLyricsText: "",
      parsedLines: [],
    };
    runtimeCache.set(ctx, state);
  }
  return state;
}

// ==========================================
// 14. 主绘制入口：drawAnimeHandwrittenMV
// ==========================================

/**
 * 绘制「动漫手书 MV」主特效（四层电影多平面 3D 摄像机视差系统）
 */
export function drawAnimeHandwrittenMV(ctx: EffectContext): void {
  const { ctx: c, width, height, data, time, musicTime, params } = ctx;

  const nowMs = typeof performance !== "undefined" ? performance.now() : time * 1000;
  const state = getOrCreateRuntimeState(c, musicTime, nowMs);

  const dtSeconds = Math.min(Math.max((nowMs - state.lastFrameTimeMs) / 1000, 0.001), 0.1);
  state.lastFrameTimeMs = nowMs;

  // 1. 获取歌曲与歌词数据
  const audioState = useAudioStore?.getState?.() ?? null;
  const playerState = usePlayerStore?.getState?.() ?? null;
  const currentSong = audioState?.currentSong ?? playerState?.currentSong ?? null;

  const rawLyrics = currentSong?.lyrics ?? "";
  if (state.cachedLyricsText !== rawLyrics) {
    state.cachedLyricsText = rawLyrics;
    state.parsedLines = parseTimedLyrics(rawLyrics);
  }

  // 2. 参数解析
  const schemeIndex = typeof params?.colorScheme === "number" ? params.colorScheme : 0;
  const zoomScale =
    typeof params?.zoomScale === "number" ? Math.max(1.2, Math.min(2.5, params.zoomScale)) : 1.8;
  const fps =
    typeof params?.frameRate === "number"
      ? params.frameRate
      : typeof params?.fps === "number"
        ? params.fps
        : 12;
  const inkSplatterMult = typeof params?.inkSplatter === "number" ? params.inkSplatter : 1.0;
  const ambientGlowMult = typeof params?.ambientGlow === "number" ? params.ambientGlow : 0.8;
  const cinemascopeEnabled = params?.cinemascope !== false;

  // 3. 调色板映射
  const coverColor = currentSong?.cover ?? null;
  const palette = resolveAnimePalette(schemeIndex, coverColor);

  // 4. 抽帧定格时间步进
  const steppedTime = calculateSteppedTime(time, fps);
  const steppedFrame = calculateSteppedFrame(time, fps);

  // 5. 音频瞬态重拍检测
  const transientResult = detectAudioTransient(data, state.bassAverage, {
    thresholdMultiplier: 1.28,
    minEnergy: 38,
    decayAlpha: 0.88,
  });
  state.bassAverage = transientResult.newAverage;

  // 6. 歌词分镜索引与间奏检测
  const effectiveMusicTime = musicTime > 0 ? musicTime : (audioState?.currentTime ?? 0);
  const activeLineIndex = findActiveLyricLineIndex(state.parsedLines, effectiveMusicTime);
  const isInterlude = checkIsInterlude(state.parsedLines, activeLineIndex, effectiveMusicTime);

  // 7. 检测歌词行切换
  const TRANSITION_DURATION_SEC = 1.0;
  if (activeLineIndex !== state.targetLineIndex && activeLineIndex !== -1) {
    state.prevLineIndex = state.targetLineIndex;
    state.targetLineIndex = activeLineIndex;
    state.lineTransitionProgress = 0;
    state.lineTransitionStartTime = nowMs;

    if (inkSplatterMult > 0.1) {
      const burst = spawnInkSplatter(
        width / 2 + (Math.random() - 0.5) * 80,
        height / 2 + (Math.random() - 0.5) * 40,
        Math.round(10 * inkSplatterMult),
        palette.splatterColors,
        1.2 * inkSplatterMult
      );
      state.particles.push(...burst);
    }
  }

  // 推进过渡进度 (0..1)
  if (state.lineTransitionProgress < 1.0) {
    const elapsed = (nowMs - state.lineTransitionStartTime) / 1000;
    state.lineTransitionProgress = Math.min(elapsed / TRANSITION_DURATION_SEC, 1.0);
  }

  // 8. 重拍微震与墨滴响应
  if (transientResult.isBeat) {
    const shakeImpulse = 2.0 + 2.0 * transientResult.intensity;
    state.camera.shakeIntensity = Math.min(state.camera.shakeIntensity + shakeImpulse, 4.0);

    if (inkSplatterMult > 0.1) {
      const beatSplatter = spawnInkSplatter(
        width / 2 + (Math.random() - 0.5) * 120,
        height / 2 + (Math.random() - 0.5) * 60,
        Math.round(7 * inkSplatterMult),
        palette.splatterColors,
        1.0 * transientResult.intensity * inkSplatterMult
      );
      state.particles.push(...beatSplatter);
    }
  }

  // 微震衰减与高频微抖
  state.camera.shakeIntensity *= Math.exp(-dtSeconds * 16);
  if (state.camera.shakeIntensity > 0.05) {
    const jitterShake = calculatePenJitter(99, steppedFrame, state.camera.shakeIntensity);
    state.camera.shakeX = jitterShake.x;
    state.camera.shakeY = jitterShake.y;
  } else {
    state.camera.shakeX = 0;
    state.camera.shakeY = 0;
  }

  // 9. 计算 3D 摄像机状态与 1.5% 鼓点镜头呼吸微缩放 (Lens Breathing)
  const cameraState = calculateContinuousAECamera(
    state.targetLineIndex,
    state.lineTransitionProgress,
    isInterlude,
    {
      zoomScale,
      depthStep: 600,
      shakeIntensity: state.camera.shakeIntensity,
      shakeX: state.camera.shakeX,
      shakeY: state.camera.shakeY,
    }
  );
  state.continuousCameraZ = cameraState.cameraZ;

  const lensBreathing = 1.0 + (transientResult.isBeat ? transientResult.intensity * 0.015 : 0);
  state.camera.zoom = cameraState.zoom * lensBreathing;

  // 10. 温光浮字扫光 (Warm Light Sweep)
  const warmLightSweep = resolveWarmLightSweep(
    state.lineTransitionProgress,
    isInterlude,
    schemeIndex
  );

  // 11. 更新粒子物理系统 (水彩墨滴、浮动金尘、前景掠镜散景)
  state.particles = updateInkParticles(state.particles, dtSeconds);
  if (state.particles.length > 80) {
    state.particles = state.particles.slice(-80);
  }

  state.goldDust = updateGoldDust(state.goldDust, dtSeconds, width, height, transientResult.energy);
  state.foregroundBokeh = updateForegroundBokeh(state.foregroundBokeh, dtSeconds, width, height);

  // 12. 院线 2.39:1 宽银幕遮幅安全区
  const bars = calculateCinemascopeBars(width, height, 2.39);
  const centerX = width / 2;
  const safeCenterY = bars.active ? bars.safeTop + bars.safeHeight / 2 : height / 2;

  // ==========================================
  // 开始电影级四层多平面渲染管线
  // ==========================================

  c.save();

  // ------------------------------------------
  // LAYER 1: 远景宇宙与 45° 晨曦丁达尔体积光 (Z = 1200 ~ 1600)
  // ------------------------------------------
  if (palette.dark) {
    // 新海诚暮色群青深空渐变
    const skyGrad = c.createRadialGradient(
      centerX,
      safeCenterY - height * 0.15,
      Math.min(width, height) * 0.1,
      centerX,
      safeCenterY,
      Math.max(width, height) * 0.95
    );
    skyGrad.addColorStop(0, "#101c2e");
    skyGrad.addColorStop(0.5, "#0b1118");
    skyGrad.addColorStop(1, "#05080f");
    c.fillStyle = skyGrad;
    c.fillRect(0, 0, width, height);
  } else {
    // 温暖日光和纸底色
    const paperGrad = c.createRadialGradient(
      centerX,
      safeCenterY,
      Math.min(width, height) * 0.15,
      centerX,
      safeCenterY,
      Math.max(width, height) * 0.85
    );
    paperGrad.addColorStop(0, palette.paper);
    paperGrad.addColorStop(1, palette.paperDeep);
    c.fillStyle = paperGrad;
    c.fillRect(0, 0, width, height);
  }

  // 12fps 手绘纸质微纤维质感
  const fiberAlpha = palette.dark ? 0.04 : 0.035;
  c.fillStyle = palette.ink;
  c.globalAlpha = fiberAlpha;
  for (let f = 0; f < 12; f++) {
    const fx = (f * 137.5 + steppedFrame * 17) % width;
    const fy = (f * 269.3 + steppedFrame * 31) % height;
    c.fillRect(fx, fy, 1.5, 1.0);
  }
  c.globalAlpha = 1.0;

  // 45° 晨曦丁达尔体积光柱 (God Rays)，随低音频谱柔和呼吸
  drawTyndallGodRays(c, width, height, time, transientResult.energy, palette);

  // 换行温光扫光 (Warm Light Sweep，柔和金色/琥珀色光弧，screen 模式)
  if (warmLightSweep.active && warmLightSweep.intensity > 0.02) {
    c.save();
    c.globalCompositeOperation = "screen";

    const sweepScreenX = warmLightSweep.sweepX * width;
    const beamW = warmLightSweep.beamWidth * (width / 1280);

    const lightGrad = c.createLinearGradient(
      sweepScreenX - beamW,
      safeCenterY - height * 0.6,
      sweepScreenX + beamW,
      safeCenterY + height * 0.6
    );
    lightGrad.addColorStop(0, "transparent");
    lightGrad.addColorStop(0.35, warmLightSweep.colorOuter);
    lightGrad.addColorStop(0.5, warmLightSweep.colorInner);
    lightGrad.addColorStop(0.65, warmLightSweep.colorOuter);
    lightGrad.addColorStop(1, "transparent");

    c.fillStyle = lightGrad;
    c.globalAlpha = Math.min(1.0, warmLightSweep.intensity * 1.25);
    c.fillRect(0, 0, width, height);
    c.restore();
  }

  // ------------------------------------------
  // LAYER 2: 中远景浮动金尘 (Z = 200 ~ 1200)
  // ------------------------------------------
  drawGoldDustLayer(c, state.goldDust, centerX, safeCenterY, 480);

  // 物理水彩墨滴微粒
  for (const p of state.particles) {
    c.save();
    c.globalAlpha = Math.min(Math.max(p.alpha * p.life, 0), 1);
    c.fillStyle = p.color;
    c.beginPath();
    c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // ------------------------------------------
  // LAYER 3: 黄金手书主体层 (Z: 800 -> 0 -> -400)
  // ------------------------------------------
  c.save();
  c.translate(centerX + cameraState.shakeX, safeCenterY + cameraState.shakeY);
  c.scale(state.camera.zoom, state.camera.zoom);

  const penJitter = calculatePenJitter(
    state.targetLineIndex >= 0 ? state.targetLineIndex : 7,
    steppedFrame,
    1.5
  );

  if (!isInterlude && state.parsedLines.length > 0 && state.targetLineIndex >= 0) {
    const currentLine = state.parsedLines[state.targetLineIndex];
    const nextLine = state.parsedLines[state.targetLineIndex + 1];

    // 计算当前行在时间轴上的持续时长与归一化推进度 u in [0, 1]
    const lineDuration = nextLine
      ? Math.max(1.8, Math.min(8.0, nextLine.start - currentLine.start))
      : 5.0;
    const rawU = (effectiveMusicTime - currentLine.start) / lineDuration;
    const lineU = Math.max(0, Math.min(1.0, rawU));

    // 镜头推拉运动动力学 Z 轴位置
    const dollyZ = calculateDollyZ(lineU, 800, 400);

    // 35mm 虚拟广角透视投影比例 (f = 480)
    const perspectiveScale = calculatePerspectiveScale(dollyZ, 480);
    const dofBlur = calculateDoFBlur(dollyZ);

    // 黄金焦点驻留阶段空气呼吸微起伏 (±1.8px)
    const airBreathY = lineU > 0.35 && lineU <= 0.85 ? Math.sin(steppedTime * 1.2) * 1.8 : 0;

    // 当前句透明度淡入淡出（飞出阶段平滑消散）
    let lineOpacity = 1.0;
    if (lineU < 0.2) {
      lineOpacity = Math.min(1.0, 0.35 + 0.65 * (lineU / 0.2));
    } else if (lineU > 0.85) {
      lineOpacity = Math.max(0, 1.0 - (lineU - 0.85) / 0.15);
    }

    // 基础字号与日系字体
    const baseFontSize = Math.max(30, Math.min(width * 0.048, 56));
    const fontHeadline = `600 ${baseFontSize * perspectiveScale}px "Yuji Boku", "Klee One", "Noto Serif SC", "Songti SC", "STSong", serif`;
    const fontMeta = `500 ${Math.max(12, baseFontSize * 0.32 * perspectiveScale)}px "SF Mono", "Consolas", "Courier New", monospace`;
    const fontSub = `400 ${Math.max(13, baseFontSize * 0.36 * perspectiveScale)}px "Yuji Boku", "Klee One", "Noto Serif SC", serif`;

    c.textAlign = "center";
    c.textBaseline = "middle";

    // A. 远景下句微弱预告 (Z ≈ 750, 景深模糊)
    if (nextLine && nextLine.text.trim()) {
      const nextZ = 750;
      const nextScale = calculatePerspectiveScale(nextZ, 480);
      const nextBlur = calculateDoFBlur(nextZ);

      c.save();
      c.globalAlpha = Math.min(0.28, 0.12 + 0.16 * lineU);
      c.font = `400 ${baseFontSize * nextScale}px "Yuji Boku", "Klee One", "Noto Serif SC", serif`;
      c.fillStyle = palette.inkSoft;
      c.shadowColor = palette.glow;
      c.shadowBlur = nextBlur * 1.2;
      c.fillText(nextLine.text.trim(), penJitter.x, 85 * nextScale + penJitter.y);
      c.restore();
    }

    // B. 当前句主体渲染（日系电影原画排版 + 毫秒级时间戳 + 歌曲小注 + 金色外发光）
    if (lineOpacity > 0.01) {
      c.save();
      c.globalAlpha = lineOpacity;

      const posX = penJitter.x;
      const posY = airBreathY + penJitter.y;

      const mainLyricText = formatJapaneseAnimeLyric(currentLine.text);
      const timestampText = formatLyricTimestamp(effectiveMusicTime);
      const songInfoText = `${currentSong?.title ?? "MIMI PLAYER"} · ${currentSong?.artist ?? "Anime MV"}`;

      // 1. 顶部毫秒级时间戳微注 (如 01:42.80)
      c.save();
      c.font = fontMeta;
      c.fillStyle = palette.dark ? "rgba(255, 215, 140, 0.72)" : "rgba(80, 60, 45, 0.65)";
      c.letterSpacing = "2px";
      c.fillText(timestampText, posX, posY - (baseFontSize * 0.85 + 16) * perspectiveScale);
      c.restore();

      // 2. 鼓点微脉冲红蓝色散 (1~2px Chromatic Aberration)
      if (transientResult.isBeat && transientResult.intensity > 0.25) {
        const caOffset = (1.0 + transientResult.intensity * 1.5) * perspectiveScale;
        c.save();
        c.font = fontHeadline;

        // 青色分量偏移
        c.fillStyle = "rgba(75, 200, 255, 0.45)";
        c.fillText(mainLyricText, posX - caOffset, posY);

        // 暖红金分量偏移
        c.fillStyle = "rgba(255, 110, 80, 0.45)";
        c.fillText(mainLyricText, posX + caOffset, posY);
        c.restore();
      }

      // 3. 黄金手书外发光漫溢 (Gold Ink Diffusion)
      c.save();
      c.font = fontHeadline;
      c.fillStyle = palette.accent;
      c.shadowColor = palette.glow;
      const glowBlur = (8 + 12 * (transientResult.energy / 255) + dofBlur) * perspectiveScale;
      c.shadowBlur = Math.min(32, glowBlur);
      c.fillText(mainLyricText, posX, posY);
      c.restore();

      // 4. 漫画蘸水笔打稿微影 (Pencil Under-Sketch)
      c.save();
      c.font = fontHeadline;
      c.fillStyle = palette.inkSoft;
      c.globalAlpha = lineOpacity * 0.28;
      c.fillText(mainLyricText, posX + 1.4 * perspectiveScale, posY + 1.6 * perspectiveScale);
      c.restore();

      // 5. 正文字符笔触墨迹核心
      c.save();
      c.font = fontHeadline;
      c.fillStyle = palette.dark ? "#FFFFFF" : palette.ink;
      c.fillText(mainLyricText, posX, posY);
      c.restore();

      // 6. 底部歌曲原名与演唱者电影小注
      c.save();
      c.font = fontSub;
      c.fillStyle = palette.inkSoft;
      c.globalAlpha = lineOpacity * 0.65;
      c.fillText(songInfoText, posX, posY + (baseFontSize * 0.85 + 18) * perspectiveScale);
      c.restore();

      c.restore();
    }
  } else {
    // 待机或纯间奏：展示手书水彩唱片铭牌与全景呼吸光晕
    const title = currentSong?.title || "MIMI PLAYER";
    const artist = currentSong?.artist || "Anime Handwritten MV";

    const titleSize = Math.max(30, Math.min(width * 0.05, 56));
    c.font = `600 ${titleSize}px "Yuji Boku", "Klee One", "Noto Serif SC", serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";

    const titleX = penJitter.x;
    const titleY = penJitter.y;

    // 唯美全景呼吸光晕
    const breath = 0.5 + 0.5 * Math.sin(steppedTime * 2.2);
    const glowRadius = Math.min(width, height) * (0.36 + 0.1 * breath) * ambientGlowMult;
    const glowGrad = c.createRadialGradient(0, 0, 8, 0, 0, glowRadius);
    glowGrad.addColorStop(0, palette.glow);
    glowGrad.addColorStop(1, "transparent");
    c.fillStyle = glowGrad;
    c.beginPath();
    c.arc(0, 0, glowRadius, 0, Math.PI * 2);
    c.fill();

    // 手书水彩唱片外圈光环
    const ringRadius = titleSize * 2.2;
    c.save();
    c.strokeStyle = palette.inkSoft;
    c.globalAlpha = 0.26;
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(0, 0, ringRadius, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // 标题墨迹与外发光
    c.save();
    c.shadowColor = palette.glow;
    c.shadowBlur = 14;
    c.fillStyle = palette.dark ? "#FFFFFF" : palette.ink;
    c.fillText(title, titleX, titleY - 16);
    c.restore();

    // 艺术家标注与时间码
    c.save();
    c.font = `400 ${titleSize * 0.44}px "Yuji Boku", "Klee One", "Noto Serif SC", serif`;
    c.fillStyle = palette.inkSoft;
    c.fillText(artist, 0, titleY + titleSize * 0.65);

    c.font = `500 ${titleSize * 0.3}px "SF Mono", "Consolas", monospace`;
    c.fillStyle = palette.dark ? "rgba(255, 215, 140, 0.65)" : "rgba(80, 60, 45, 0.55)";
    c.fillText(formatLyricTimestamp(effectiveMusicTime), 0, titleY + titleSize * 1.15);
    c.restore();
  }

  c.restore(); // 恢复 Layer 3 空间变换

  // ------------------------------------------
  // LAYER 4: 前景大散景掠镜与光学后期层 (Z = -100 ~ -350)
  // ------------------------------------------
  drawForegroundBokehLayer(c, state.foregroundBokeh, centerX, safeCenterY, 480);

  // 2.39:1 院线宽银幕遮幅 (Cinemascope Letterbox)
  if (cinemascopeEnabled && bars.active) {
    c.save();
    c.fillStyle = "#040609";

    // 顶部黑边
    c.fillRect(0, 0, width, bars.safeTop);

    // 顶部黑边羽化渐变
    const topFeather = c.createLinearGradient(0, bars.safeTop, 0, bars.safeTop + 4);
    topFeather.addColorStop(0, "#040609");
    topFeather.addColorStop(1, "rgba(4, 6, 9, 0)");
    c.fillStyle = topFeather;
    c.fillRect(0, bars.safeTop, width, 4);

    // 底部黑边
    c.fillStyle = "#040609";
    c.fillRect(0, bars.safeBottom, width, bars.barHeight);

    // 底部黑边羽化渐变
    const bottomFeather = c.createLinearGradient(0, bars.safeBottom - 4, 0, bars.safeBottom);
    bottomFeather.addColorStop(0, "rgba(4, 6, 9, 0)");
    bottomFeather.addColorStop(1, "#040609");
    c.fillStyle = bottomFeather;
    c.fillRect(0, bars.safeBottom - 4, width, 4);

    c.restore();
  }

  // 电影级柔和暗角 (Film Vignette)
  const vignetteGrad = c.createRadialGradient(
    centerX,
    safeCenterY,
    Math.min(width, height) * 0.42,
    centerX,
    safeCenterY,
    Math.max(width, height) * 0.82
  );
  vignetteGrad.addColorStop(0, "transparent");
  vignetteGrad.addColorStop(1, palette.vignette);
  c.fillStyle = vignetteGrad;
  c.fillRect(0, 0, width, height);

  c.restore();
}
