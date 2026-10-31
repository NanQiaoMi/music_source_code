/**
 * 「动漫手书 MV」（Anime Handwritten MV）—— 次世代手绘动漫画风独立可视化特效。
 *
 * 核心设计升级：
 * 1. 温光浮字过渡（Warm Light Sweep & Cross-Dissolve Transition）：
 *    换行与换段落时绝不硬切，在 0.8s-1.2s 的过渡窗口期内，新旧两行平滑共存双向融合；
 *    柔和金色/琥珀色温光光弧以 screen 滤色模式扫过全屏，下句笔尖墨迹生长浮现，上句字形自然淡化掠出。
 * 2. 连续空间 AE 摄像机推镜（Zero-Clipping Continuous 3D AE Dolly Camera）：
 *    彻底摒弃任何有边界的纸张卡片矩形裁剪，背景为全屏无缝铺展的透气宣纸光晕；
 *    每一句歌词拥有连续纵深坐标（Z 轴）；镜头沿 Z 轴做 SmootherStep 三次/五次贝塞尔连续推进；
 *    上句歌词随镜头推近自然放大并向前飘出视野（透明度淡出，掠过镜头两侧，绝不硬切）；
 *    当前句推进至黄金聚焦位并点亮高光；下句歌词以 ~0.6x 比例在景深远处微弱可见；
 *    间奏时镜头优雅缓慢拉远至全景广角，屏幕中央展示手书水彩唱片铭牌与唯美呼吸光晕。
 * 3. 音频瞬态重拍检测与 12fps/24fps 抽帧定格：
 *    重拍（Kick Drum）时触发微秒级镜头微震与水彩墨渍扩散，视锥全覆盖，边缘无缝柔和。
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
  cachedLyricsText: string;
  parsedLines: ParsedLyricLine[];
}

// ==========================================
// 2. 调色板系统
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
// 3. AE 连续摄像机与贝塞尔数学计算
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
 * - 镜头沿 Z 轴和空间轨迹平滑连续推进；
 * - 换行期间根据 transitionProgress 步进摄像机深度；
 * - 间奏时镜头优雅缓退至全景广角。
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

  // 摄像机连续世界 Z 深度
  const baseIndex = Math.max(0, lineIndex);
  // 当处于换行过渡期 (effectiveProgress < 1.0) 时，摄像机从前一行深度向目标行深度推近
  const cameraZ = (baseIndex - (1 - eased)) * depthStep;

  // 基础缩放与镜头脉冲
  let zoom = 1.0;
  if (isInterlude) {
    // 间奏模式：优雅缓退至全景广角
    zoom = 1.0;
  } else {
    // 正常播放：应用推镜倍率，并在换行脉冲期叠加微妙的推镜透视呼吸感
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
// 4. 温光扫过（Warm Light Sweep）计算
// ==========================================

/**
 * 计算换行温光扫光状态
 * 在 0.8s - 1.2s 的过渡窗口期内，温润金黄/琥珀色光弧平滑掠过全屏
 */
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
  // 钟形强度曲线：在过渡中段 (p ~ 0.5) 达到峰值
  const intensity = Math.sin(p * Math.PI);
  // 光弧掠过屏幕坐标：从左侧 -0.2 扫向右侧 1.2
  const sweepX = -0.2 + 1.4 * p;
  // 文字高光提升：伴随光弧掠过点亮新句墨迹
  const textGlowBoost = intensity * 0.85;

  const palette = resolveAnimePalette(colorScheme);

  return {
    active: true,
    progress: p,
    intensity,
    sweepX,
    sweepAngle: 0.42, // 约 24 度倾角光弧
    beamWidth: 280,
    colorInner: palette.warmLightInner,
    colorOuter: palette.warmLightOuter,
    textGlowBoost,
  };
}

// ==========================================
// 5. 多行歌词空间纵深连续排布 (Zero-Clipping Depth Layout)
// ==========================================

/**
 * 计算多行歌词在 3D 摄像机视锥中的纵深坐标与投影参数
 * - 彻底摒弃任何硬卡片裁剪；
 * - 上一句随镜头推近自然放大并向前掠出（淡出）；
 * - 当前句在黄金聚焦位；
 * - 下一句在景深远处（~0.6x 比例微弱可见）。
 */
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
  const _zoomScale = options?.zoomScale ?? 1.8;
  const focalDistance = options?.focalDistance ?? 900;

  const items: LyricDepthItem[] = [];
  const p = Math.max(0, Math.min(1, transitionProgress));

  // 选取关注的行范围：上一行 (k-1)、当前行 (k)、下一行 (k+1)、下下一行 (k+2)
  const minIndex = Math.max(0, currentLineIndex - 1);
  const maxIndex = Math.min(lines.length - 1, currentLineIndex + 2);

  for (let i = minIndex; i <= maxIndex; i++) {
    const line = lines[i];
    if (!line || !line.text.trim()) continue;

    const worldZ = i * depthStep;
    const relZ = worldZ - cameraZ; // 相对摄像机距离

    // 透视比例 projection: F / (F + relZ)
    const effectiveDepth = Math.max(focalDistance * 0.25, focalDistance + relZ);
    const perspectiveScale = focalDistance / effectiveDepth;

    let opacity = 0;
    let yOffset = 0;
    let blur = 0;
    let inkGrowth = 1.0;

    const isCurrent = i === currentLineIndex;
    const isPrevious = i === currentLineIndex - 1;
    const isNext = i === currentLineIndex + 1;

    if (isCurrent) {
      // 当前句：随着推进进入聚焦位
      opacity = 0.35 + 0.65 * calculateCameraTransitionEasing(p);
      yOffset = (1 - calculateCameraTransitionEasing(p)) * 24;
      blur = Math.max(0, (1 - p) * 2.5);
      inkGrowth = Math.min(1.0, 0.3 + 0.7 * p);
    } else if (isPrevious) {
      // 上一句：镜头推近向前掠出视野，自然淡化
      const fadeProgress = calculateCameraTransitionEasing(p);
      opacity = Math.max(0, 1.0 - fadeProgress * 1.25);
      // 随着镜头推过，上一句向上漂移并扩大
      yOffset = -fadeProgress * 80;
      blur = fadeProgress * 3.5;
      inkGrowth = 1.0;
    } else if (isNext) {
      // 下一句：在景深远处（约 0.6x 比例微弱可见）
      const appearProgress = calculateCameraTransitionEasing(p);
      opacity = 0.22 + 0.16 * appearProgress;
      yOffset = 64 - appearProgress * 14;
      blur = 1.8;
      inkGrowth = 0.4;
    } else {
      // 远景预告行 (k+2)
      opacity = 0.1;
      yOffset = 110;
      blur = 3.0;
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
// 6. 音频瞬态重拍检测（Kick / Bass Transients）
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
// 7. 抽帧定格（Stepped Frames）与线稿抖动
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
// 8. 物理水彩墨滴粒子系统（Ink Splatter）
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
// 9. 歌词时间线与间奏检测
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
// 10. 运行时状态管理
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
      cachedLyricsText: "",
      parsedLines: [],
    };
    runtimeCache.set(ctx, state);
  }
  return state;
}

// ==========================================
// 11. 主绘制入口：drawAnimeHandwrittenMV
// ==========================================

/**
 * 绘制「动漫手书 MV」主特效
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

  // 7. 检测歌词行切换，启动温光扫光与 AE 摄像机推镜过渡 (持续约 1.0s)
  const TRANSITION_DURATION_SEC = 1.0;
  if (activeLineIndex !== state.targetLineIndex && activeLineIndex !== -1) {
    state.prevLineIndex = state.targetLineIndex;
    state.targetLineIndex = activeLineIndex;
    state.lineTransitionProgress = 0;
    state.lineTransitionStartTime = nowMs;

    // 换行特征水彩墨滴爆裂
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

  // 8. 重拍微震响应与墨滴爆裂
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

  // 9. 计算 AE 连续 3D 摄像机状态
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
  state.camera.zoom = cameraState.zoom;

  // 10. 计算温光浮字扫光 (Warm Light Sweep)
  const warmLightSweep = resolveWarmLightSweep(
    state.lineTransitionProgress,
    isInterlude,
    schemeIndex
  );

  // 11. 更新水彩墨滴微粒
  state.particles = updateInkParticles(state.particles, dtSeconds);
  if (state.particles.length > 80) {
    state.particles = state.particles.slice(-80);
  }

  // ==========================================
  // 开始渲染管线（完全零裁剪，全屏无缝铺展）
  // ==========================================

  c.save();

  const centerX = width / 2;
  const centerY = height / 2;

  // ------------------------------------------
  // A. 全屏无缝透气纸张光晕底色（绝无硬边矩形裁剪）
  // ------------------------------------------
  const paperGrad = c.createRadialGradient(
    centerX,
    centerY,
    Math.min(width, height) * 0.15,
    centerX,
    centerY,
    Math.max(width, height) * 0.85
  );
  paperGrad.addColorStop(0, palette.paper);
  paperGrad.addColorStop(1, palette.paperDeep);
  c.fillStyle = paperGrad;
  c.fillRect(0, 0, width, height);

  // 模拟透气和纸质微纤维（12fps 阶梯手绘质感）
  const fiberAlpha = palette.dark ? 0.04 : 0.035;
  c.fillStyle = palette.ink;
  c.globalAlpha = fiberAlpha;
  for (let f = 0; f < 12; f++) {
    const fx = (f * 137.5 + steppedFrame * 17) % width;
    const fy = (f * 269.3 + steppedFrame * 31) % height;
    c.fillRect(fx, fy, 1.5, 1.0);
  }
  c.globalAlpha = 1.0;

  // ------------------------------------------
  // B. 温光扫过（Warm Light Sweep / 柔和金色或琥珀色光弧，screen 模式）
  // ------------------------------------------
  if (warmLightSweep.active && warmLightSweep.intensity > 0.02) {
    c.save();
    c.globalCompositeOperation = "screen";

    const sweepScreenX = warmLightSweep.sweepX * width;
    const beamW = warmLightSweep.beamWidth * (width / 1280);

    const lightGrad = c.createLinearGradient(
      sweepScreenX - beamW,
      centerY - height * 0.6,
      sweepScreenX + beamW,
      centerY + height * 0.6
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
  // C. 连续 AE 摄像机空间变换（中心对齐 + 镜头推拉 + 重拍微震）
  // ------------------------------------------
  c.save();
  c.translate(centerX + cameraState.shakeX, centerY + cameraState.shakeY);
  c.scale(cameraState.zoom, cameraState.zoom);
  c.translate(-centerX, -centerY);

  // ------------------------------------------
  // D. 唯美全景呼吸光晕（间奏模式）
  // ------------------------------------------
  if (isInterlude) {
    const breath = 0.5 + 0.5 * Math.sin(steppedTime * 2.2);
    const glowRadius = Math.min(width, height) * (0.36 + 0.1 * breath) * ambientGlowMult;
    const glowGrad = c.createRadialGradient(centerX, centerY, 8, centerX, centerY, glowRadius);
    glowGrad.addColorStop(0, palette.glow);
    glowGrad.addColorStop(1, "transparent");
    c.fillStyle = glowGrad;
    c.beginPath();
    c.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    c.fill();
  }

  // ------------------------------------------
  // E. 物理水彩墨滴微粒
  // ------------------------------------------
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
  // F. 漫画蘸水笔手绘线稿与歌词文字（多行连续纵深排布，双向融合交叉过渡）
  // ------------------------------------------
  const penJitter = calculatePenJitter(
    state.targetLineIndex >= 0 ? state.targetLineIndex : 7,
    steppedFrame,
    1.5
  );

  if (!isInterlude && state.parsedLines.length > 0 && state.targetLineIndex >= 0) {
    const depthItems = calculateLyricZPositions(
      state.parsedLines,
      state.targetLineIndex,
      state.continuousCameraZ,
      state.lineTransitionProgress,
      {
        zoomScale,
        depthStep: 600,
        focalDistance: 900,
      }
    );

    // 基础字号与字体配置
    const baseFontSize = Math.max(26, Math.min(width * 0.046, 52));
    const fontPrimary = `600 ${baseFontSize}px "Yuji Boku", "Klee One", "Noto Serif SC", "Songti SC", "STSong", serif`;
    const fontSub = `400 ${baseFontSize}px "Yuji Boku", "Klee One", "Noto Serif SC", serif`;

    c.textAlign = "center";
    c.textBaseline = "middle";

    for (const item of depthItems) {
      if (item.opacity <= 0.005) continue;

      c.save();
      c.globalAlpha = item.opacity;

      const posX = centerX + penJitter.x;
      const posY = centerY + item.yOffset + penJitter.y;

      c.translate(posX, posY);
      c.scale(item.scale, item.scale);

      if (item.isCurrent) {
        c.font = fontPrimary;

        // 1. 漫画蘸水笔打稿微影（Pencil Under-Sketch）
        c.save();
        c.fillStyle = palette.inkSoft;
        c.globalAlpha = item.opacity * 0.24;
        c.fillText(item.text, 1.2, 1.4);
        c.restore();

        // 2. 温光扫光增强（文字局部金辉）
        if (warmLightSweep.active && warmLightSweep.textGlowBoost > 0.05) {
          c.save();
          c.fillStyle = palette.accent;
          c.globalAlpha = item.opacity * warmLightSweep.textGlowBoost * 0.6;
          c.shadowColor = palette.accent;
          c.shadowBlur = 12 * warmLightSweep.textGlowBoost;
          c.fillText(item.text, 0, 0);
          c.restore();
        }

        // 3. 蘸水笔正文墨迹
        c.fillStyle = palette.ink;
        c.fillText(item.text, 0, 0);
      } else {
        // 前后景深伴随行（自然弱化景深）
        c.font = fontSub;
        c.fillStyle = palette.inkSoft;
        c.fillText(item.text, 0, 0);
      }

      c.restore();
    }
  } else {
    // 待机或纯间奏：展示手书水彩唱片铭牌与唯美呼吸铭文
    const title = currentSong?.title || "MIMI PLAYER";
    const artist = currentSong?.artist || "Anime Handwritten MV";

    const titleSize = Math.max(28, Math.min(width * 0.048, 54));
    c.font = `600 ${titleSize}px "Yuji Boku", "Klee One", "Noto Serif SC", serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";

    const titleX = centerX + penJitter.x;
    const titleY = centerY + penJitter.y;

    // 手书水彩唱片外圈光环
    const ringRadius = titleSize * 2.2;
    c.save();
    c.strokeStyle = palette.inkSoft;
    c.globalAlpha = 0.22;
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    // 标题墨迹
    c.save();
    c.fillStyle = palette.ink;
    c.fillText(title, titleX, titleY - 14);
    c.restore();

    // 艺术家标注
    c.save();
    c.font = `400 ${titleSize * 0.44}px "Yuji Boku", "Klee One", "Noto Serif SC", serif`;
    c.fillStyle = palette.inkSoft;
    c.fillText(artist, centerX, titleY + titleSize * 0.68);
    c.restore();
  }

  c.restore(); // 恢复摄像机空间变换

  // ------------------------------------------
  // G. 透气画面暗角（Vignette Overlay，无硬切边界）
  // ------------------------------------------
  const vignetteGrad = c.createRadialGradient(
    centerX,
    centerY,
    Math.min(width, height) * 0.42,
    centerX,
    centerY,
    Math.max(width, height) * 0.78
  );
  vignetteGrad.addColorStop(0, "transparent");
  vignetteGrad.addColorStop(1, palette.vignette);
  c.fillStyle = vignetteGrad;
  c.fillRect(0, 0, width, height);

  c.restore();
}
