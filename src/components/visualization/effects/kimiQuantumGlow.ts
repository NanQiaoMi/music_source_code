/**
 * 「极核流光 · Kimi 科技感」（Kimi Quantum Glow）—— 次世代量子粒子点阵可视化特效。
 *
 * 核心技术亮点：
 * 1. 离屏 Canvas 像素点阵动态采样（Offscreen Text Sampling）：
 *    在离屏 Canvas 上使用无衬线字体（Geist / SF Pro / PingFang SC）排版当前歌词行；
 *    采样提取不透明像素点阵坐标作为目标锚点（Target Point Cloud），支持全球任意字符与生僻汉字；
 * 2. 量子粒子动力学（Quantum Particle Dynamics）：
 *    支持 3,000 ~ 10,000 颗粒子（默认 4,500 颗）；
 *    四阶状态机调度（Dispersed 深空漂移 -> Attracting 聚拢成字 -> Formed 凝结扫光 -> Dissolving 震散消退）；
 *    深度融合音频低频能量（Bass Shockwave）与中频瞬态（Quantum Jitter & Shimmer）；
 * 3. 双色调冷峻科技感色彩体系与光影：
 *    深空墨灰背景（#08090C）、钛银冷蓝（#67E8F9）、极光幽青（#34D399），副歌/高频高涨时过渡至极光紫（#A78BFA）与流金（#FBBF24）；
 *    实现轻量微秒级镜头色散（Chromatic Aberration 0.5%）与 Bloom 泛光（globalCompositeOperation 叠加）；
 * 4. 无歌词间奏（Solo / 待机）调度：
 *    粒子在中央汇聚为缓慢自旋的双层引力透镜吸积盘（Accretion Disk），中心呈现高保真科技感音源铭牌（曲名、艺术家、采样率 96kHz/24bit）。
 */

import type { EffectContext } from "./types";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { parseTimedLyrics, type ParsedLyricLine } from "./lyricTimeline";

// ==========================================
// 1. 类型定义
// ==========================================

export interface Point {
  x: number;
  y: number;
}

export type QuantumParticleState = "dispersed" | "attracting" | "formed" | "dissolving";

export interface QuantumParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  homeX: number;
  homeY: number;
  baseSize: number;
  renderSize: number;
  baseAlpha: number;
  alpha: number;
  color: string;
  glow: number;
  mass: number;
  jitter: number;
  pulsePhase: number;
  ringLayer: number; // 0: 内层高速环, 1: 外层引力弯曲透镜环
}

export interface SamplingOptions {
  step?: number;
  fontSize?: number;
  fontFamily?: string;
  threshold?: number;
  maxPoints?: number;
  lineHeight?: number;
  customImageData?: ImageData | { data: Uint8ClampedArray; width: number; height: number };
}

export interface QuantumUpdateOptions {
  state: QuantumParticleState;
  dt: number;
  width: number;
  height: number;
  bassEnergy: number; // 0..1
  midTransient: number; // 0..1
  trebleEnergy?: number; // 0..1
  shockwaveForce?: number; // 0..1
  sweepProgress?: number; // 0..1, 凝结扫光光波进度
  attractStrength?: number;
  damping?: number;
  time?: number;
}

export interface KimiPalette {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  particleColors: string[];
  glowColor: string;
  sweepColor: string;
  isHighEnergy: boolean;
  energyRatio: number;
}

export interface AccretionDiskOptions {
  innerRadius?: number;
  outerRadius?: number;
  tiltAngle?: number;
  rotationSpeed?: number;
  aspectRatio?: number;
}

export interface AudioEnergyFeatures {
  bassEnergy: number;
  midTransient: number;
  trebleEnergy: number;
  overallEnergy: number;
  newBassAverage: number;
  newMidAverage: number;
}

interface KimiRuntimeState {
  particles: QuantumParticle[];
  state: QuantumParticleState;
  prevLineIndex: number;
  stateTimer: number;
  cachedLyricsText: string;
  parsedLines: ParsedLyricLine[];
  currentTargetPoints: Point[];
  lastMusicTime: number;
  lastFrameTimeMs: number;
  bassAverage: number;
  midAverage: number;
  shockwaveForce: number;
  sweepProgress: number;
}

// ==========================================
// 2. 调色板系统与常量
// ==========================================

export const KIMI_DEEP_BACKGROUND = "#08090C";
export const KIMI_TITANIUM_BLUE = "#67E8F9";
export const KIMI_AURORA_CYAN = "#34D399";
export const KIMI_AURORA_VIOLET = "#A78BFA";
export const KIMI_LIQUID_GOLD = "#FBBF24";

/**
 * 辅助：线性插值十六进制颜色
 */
function interpolateHexColor(colorA: string, colorB: string, ratio: number): string {
  const r = Math.min(Math.max(ratio, 0), 1);
  const cleanA = colorA.replace("#", "");
  const cleanB = colorB.replace("#", "");
  const rA = Number.parseInt(cleanA.slice(0, 2), 16) || 0;
  const gA = Number.parseInt(cleanA.slice(2, 4), 16) || 0;
  const bA = Number.parseInt(cleanA.slice(4, 6), 16) || 0;

  const rB = Number.parseInt(cleanB.slice(0, 2), 16) || 0;
  const gB = Number.parseInt(cleanB.slice(2, 4), 16) || 0;
  const bB = Number.parseInt(cleanB.slice(4, 6), 16) || 0;

  const outR = Math.round(rA + (rB - rA) * r);
  const outG = Math.round(gA + (gB - gA) * r);
  const outB = Math.round(bA + (bB - bA) * r);

  return `#${outR.toString(16).padStart(2, "0")}${outG.toString(16).padStart(2, "0")}${outB.toString(16).padStart(2, "0")}`;
}

/**
 * 解析「极核流光」动态调色板
 * 双色调冷峻科技感体系：
 * - 平静/常规：钛银冷蓝（#67E8F9）与极光幽青（#34D399）
 * - 高能量/副歌：过渡向极光紫（#A78BFA）与流金（#FBBF24）
 */
export function resolveKimiPalette(
  energy: number,
  options?: {
    themeHue?: number;
    coverColor?: string | null;
    highEnergyThreshold?: number;
  }
): KimiPalette {
  const threshold = options?.highEnergyThreshold ?? 0.58;
  const normalizedEnergy = Math.min(Math.max(energy, 0), 1);
  const energyRatio =
    normalizedEnergy > threshold ? (normalizedEnergy - threshold) / (1 - threshold) : 0;
  const isHighEnergy = energyRatio > 0.05;

  const primary = interpolateHexColor(KIMI_TITANIUM_BLUE, KIMI_AURORA_VIOLET, energyRatio);
  const secondary = interpolateHexColor(KIMI_AURORA_CYAN, KIMI_LIQUID_GOLD, energyRatio);
  const accent = energyRatio > 0.4 ? KIMI_LIQUID_GOLD : KIMI_AURORA_VIOLET;

  const particleColors = isHighEnergy
    ? [KIMI_TITANIUM_BLUE, KIMI_AURORA_VIOLET, KIMI_LIQUID_GOLD, "#C084FC", "#38BDF8"]
    : [KIMI_TITANIUM_BLUE, KIMI_AURORA_CYAN, "#A5F3FC", "#6EE7B7", "#E0F2FE"];

  const glowColor = isHighEnergy ? "rgba(167, 139, 250, 0.42)" : "rgba(103, 232, 249, 0.38)";

  const sweepColor = isHighEnergy ? "rgba(251, 191, 36, 0.95)" : "rgba(224, 242, 254, 0.95)";

  return {
    background: KIMI_DEEP_BACKGROUND,
    primary,
    secondary,
    accent,
    particleColors,
    glowColor,
    sweepColor,
    isHighEnergy,
    energyRatio,
  };
}

// ==========================================
// 3. 离屏 Canvas 像素点阵动态采样（Offscreen Text Sampling）
// ==========================================

/**
 * 在离屏 Canvas 上将文本排版并采样为点阵坐标云（Target Point Cloud）
 * 支持中文、生僻汉字、全球任意 Unicode 字符及英文无衬线排版。
 *
 * @param text 要排版的歌词文本
 * @param width 目标画布宽度
 * @param height 目标画布高度
 * @param options 采样选项（步长、字体大小、字体族、阈值、最大点数等）
 */
export function sampleTextToPoints(
  text: string,
  width: number,
  height: number,
  options?: SamplingOptions
): Point[] {
  const cleanText = text ? text.trim() : "";
  if (cleanText === "" || width <= 0 || height <= 0) {
    return [];
  }

  const step = Math.max(1, Math.round(options?.step ?? 4));
  const threshold = options?.threshold ?? 120;
  const maxPoints = options?.maxPoints ?? 4500;
  const fontFamily =
    options?.fontFamily ??
    "Geist, -apple-system, 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif";

  // 1. 如果直接传入了 customImageData（常用于自动化测试或预烘焙数据），直接采样提取
  if (options?.customImageData) {
    const imgData = options.customImageData;
    const points: Point[] = [];
    const imgW = imgData.width;
    const imgH = imgData.height;
    const scaleX = width / imgW;
    const scaleY = height / imgH;

    for (let y = 0; y < imgH; y += step) {
      for (let x = 0; x < imgW; x += step) {
        const index = (y * imgW + x) * 4;
        const alpha = imgData.data[index + 3];
        if (alpha >= threshold) {
          points.push({
            x: Math.min(Math.max(x * scaleX, 0), width),
            y: Math.min(Math.max(y * scaleY, 0), height),
          });
          if (points.length >= maxPoints) break;
        }
      }
      if (points.length >= maxPoints) break;
    }
    return points;
  }

  // 2. 动态计算字号以自适应画布宽度与高度
  const maxFitWidth = width * 0.82;
  const baseFontSize =
    options?.fontSize ?? Math.min(Math.max(width / Math.max(cleanText.length * 0.85, 12), 26), 68);

  const points: Point[] = [];
  let sampledViaRaster = false;

  // 3. 尝试使用 OffscreenCanvas 或 DOM Canvas 真实光栅化采样
  try {
    let canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
    } else if (typeof document !== "undefined" && typeof document.createElement === "function") {
      canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(width));
      canvas.height = Math.max(1, Math.floor(height));
    }

    if (canvas) {
      const offCtx = canvas.getContext("2d") as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null;
      if (offCtx && typeof offCtx.getImageData === "function") {
        offCtx.clearRect(0, 0, width, height);
        offCtx.font = `700 ${baseFontSize}px ${fontFamily}`;
        offCtx.textAlign = "center";
        offCtx.textBaseline = "middle";
        offCtx.fillStyle = "#FFFFFF";

        // 排版居中绘制
        const centerX = width / 2;
        const centerY = height / 2;
        offCtx.fillText(cleanText, centerX, centerY);

        const imgData = offCtx.getImageData(0, 0, Math.floor(width), Math.floor(height));
        const data = imgData.data;
        const w = imgData.width;
        const h = imgData.height;

        for (let y = 0; y < h; y += step) {
          for (let x = 0; x < w; x += step) {
            const index = (y * w + x) * 4;
            const alpha = data[index + 3];
            if (alpha >= threshold) {
              points.push({ x, y });
              if (points.length >= maxPoints) break;
            }
          }
          if (points.length >= maxPoints) break;
        }

        if (points.length > 0) {
          sampledViaRaster = true;
        }
      }
    }
  } catch {
    // 环境不支持真实离屏光栅化，降级走备用算法
  }

  // 4. 环境回退保护（如在非浏览器测试或无图形光栅化支持的 Node/Vitest 环境中）
  if (!sampledViaRaster) {
    const chars = Array.from(cleanText);
    const charCount = chars.length;
    const estCharWidth = Math.min(baseFontSize * 1.1, maxFitWidth / charCount);
    const totalW = charCount * estCharWidth;
    const startX = (width - totalW) / 2 + estCharWidth / 2;
    const centerY = height / 2;
    const pointsPerChar = Math.min(Math.floor(maxPoints / charCount), 40);

    for (let c = 0; c < charCount; c++) {
      const cx = startX + c * estCharWidth;
      const charCode = chars[c].codePointAt(0) ?? 65;

      for (let p = 0; p < pointsPerChar; p++) {
        // 基于字符哈希与几何特征分布点阵
        const angle = (p / pointsPerChar) * Math.PI * 2;
        const radius = baseFontSize * 0.38 * (0.3 + 0.7 * Math.abs(Math.sin(angle * 2 + charCode)));
        const px = cx + Math.cos(angle) * radius;
        const py = centerY + Math.sin(angle) * (radius * 1.25);

        // 边界保护
        points.push({
          x: Math.min(Math.max(px, 4), width - 4),
          y: Math.min(Math.max(py, 4), height - 4),
        });
        if (points.length >= maxPoints) break;
      }
      if (points.length >= maxPoints) break;
    }
  }

  return points;
}

// ==========================================
// 4. 无歌词间奏（Solo / 待机）引力透镜吸积盘几何生成
// ==========================================

/**
 * 生成双层引力透镜吸积盘（Accretion Disk）目标点阵
 * - 内层：高密度相对论超高速自旋量子环
 * - 外层：倾斜且受爱因斯坦引力透镜弯曲的星际吸积盘轮廓
 */
export function generateAccretionDiskPoints(
  count: number,
  width: number,
  height: number,
  time: number,
  options?: AccretionDiskOptions
): Point[] {
  if (count <= 0 || width <= 0 || height <= 0) {
    return [];
  }

  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const innerRadius = options?.innerRadius ?? Math.max(minDim * 0.15, 60);
  const outerRadius = options?.outerRadius ?? Math.max(minDim * 0.34, 130);
  const tiltAngle = options?.tiltAngle ?? 0.38; // ~22度倾角
  const rotSpeed = options?.rotationSpeed ?? 0.5;

  const points: Point[] = new Array(count);
  const innerCount = Math.floor(count * 0.45);
  const outerCount = count - innerCount;

  // 1. 内层高速自旋环（45% 粒子）
  for (let i = 0; i < innerCount; i++) {
    const fraction = i / innerCount;
    const angle = fraction * Math.PI * 2 + time * (rotSpeed * 1.6);
    const radiusJitter = ((i % 40) / 40) * (innerRadius * 0.3);
    const r = innerRadius + radiusJitter;

    const x = cx + r * Math.cos(angle);
    // 倾角垂直压缩
    const y = cy + r * Math.sin(angle) * 0.38;

    points[i] = {
      x: Math.min(Math.max(x, 4), width - 4),
      y: Math.min(Math.max(y, 4), height - 4),
    };
  }

  // 2. 外层引力透镜弯曲吸积弧（55% 粒子）
  for (let j = 0; j < outerCount; j++) {
    const idx = innerCount + j;
    const fraction = j / outerCount;
    const angle = fraction * Math.PI * 2 - time * (rotSpeed * 0.65);
    const radialT = (j % 100) / 100;
    const r = innerRadius * 1.35 + radialT * (outerRadius - innerRadius * 1.35);

    // 引力透镜爱因斯坦环垂直光弧畸变（上下两弯）
    const lensWarp = Math.sin(angle) * (outerRadius * 0.22);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle) * Math.cos(tiltAngle) + lensWarp;

    points[idx] = {
      x: Math.min(Math.max(x, 4), width - 4),
      y: Math.min(Math.max(y, 4), height - 4),
    };
  }

  return points;
}

// ==========================================
// 5. 量子粒子动力学（Quantum Particle Dynamics）
// ==========================================

/**
 * 创建量子粒子池
 */
export function createQuantumParticlePool(
  count: number,
  width: number,
  height: number
): QuantumParticle[] {
  const safeCount = Math.min(Math.max(count, 1), 12000);
  const particles: QuantumParticle[] = new Array(safeCount);

  for (let i = 0; i < safeCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const baseSize = 0.8 + Math.random() * 1.6;
    const baseAlpha = 0.35 + Math.random() * 0.55;

    particles[i] = {
      id: i,
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      targetX: x,
      targetY: y,
      homeX: x,
      homeY: y,
      baseSize,
      renderSize: baseSize,
      baseAlpha,
      alpha: baseAlpha,
      color: i % 2 === 0 ? KIMI_TITANIUM_BLUE : KIMI_AURORA_CYAN,
      glow: 1.0,
      mass: 0.8 + Math.random() * 0.6,
      jitter: 0.3 + Math.random() * 0.7,
      pulsePhase: Math.random() * Math.PI * 2,
      ringLayer: i % 2,
    };
  }

  return particles;
}

/**
 * 更新量子粒子状态与物理动力学
 *
 * 核心动力学规则：
 * 1. Dispersed（深空漂移）：微弱中心引力 + 宇宙湍流微漂移；
 * 2. Attracting（聚拢成字）：目标点弹簧加速引导 + 速度阻尼抑制震荡；
 * 3. Formed（凝结扫光）：目标锚定 + 量子测不准微抖动（Jitter） + 激光扫光波激活高亮；
 * 4. Dissolving（震散消退）：低频重拍冲击波从中心向外爆裂扩散 + 逐渐淡出；
 *
 * @param particles 粒子数组
 * @param targets 目标点阵数组
 * @param options 更新选项
 */
export function updateQuantumParticleState(
  particles: QuantumParticle[],
  targets: Point[],
  options: QuantumUpdateOptions
): QuantumParticle[] {
  const dt = Math.min(Math.max(options.dt, 0.001), 0.05);
  const targetCount = targets.length;
  const cx = options.width / 2;
  const cy = options.height / 2;
  const state = options.state;
  const bass = Math.min(Math.max(options.bassEnergy, 0), 1);
  const mid = Math.min(Math.max(options.midTransient, 0), 1);
  const shockwave = options.shockwaveForce ?? 0;
  const sweepProgress = options.sweepProgress ?? 0;
  const time = options.time ?? 0;

  // 扫光波水平坐标（横穿文字区）
  const sweepX = options.width * 0.15 + options.width * 0.7 * sweepProgress;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // 1. 确定目标点锚点
    if (targetCount > 0) {
      const target = targets[i % targetCount];
      p.targetX = target.x;
      p.targetY = target.y;
    } else {
      p.targetX = cx;
      p.targetY = cy;
    }

    // 2. 根据状态机应用受力加速度
    if (state === "attracting") {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const spring = options.attractStrength ?? 22.0;
      const damping = options.damping ?? 5.5;

      // 弹性收敛
      p.vx += (dx * spring - p.vx * damping) * dt;
      p.vy += (dy * spring - p.vy * damping) * dt;

      // 透明度快速平滑升至饱满
      p.alpha += (0.9 - p.alpha) * dt * 4.0;
      p.glow = 1.2 + mid * 0.8;
    } else if (state === "formed") {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;

      // 强锚定收敛
      p.vx += (dx * 36.0 - p.vx * 10.0) * dt;
      p.vy += (dy * 36.0 - p.vy * 10.0) * dt;

      // 中频瞬态驱动的量子不确定微震（Quantum Jitter）
      const jitterAmount = (0.35 + mid * 2.2) * p.jitter;
      p.x += (Math.random() - 0.5) * jitterAmount;
      p.y += (Math.random() - 0.5) * jitterAmount;

      // 凝结扫光波（Photonic Sweep Wave）
      const distToSweep = Math.abs(p.x - sweepX);
      if (distToSweep < 48) {
        const sweepFactor = 1.0 - distToSweep / 48;
        p.alpha = Math.min(1.0, p.baseAlpha + sweepFactor * 0.65);
        p.glow = 1.0 + sweepFactor * 2.8;
      } else {
        p.alpha += (p.baseAlpha * 1.1 - p.alpha) * dt * 3.0;
        p.glow += (1.0 - p.glow) * dt * 3.0;
      }
    } else if (state === "dissolving") {
      // 重拍震散消退：中心向外径向推力 + 上浮消散
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.max(Math.hypot(dx, dy), 1);

      const burstStrength = 160 + bass * 340 + shockwave * 260;
      const radialNx = dx / dist;
      const radialNy = dy / dist;

      p.vx += (radialNx * burstStrength - p.vx * 2.0) * dt;
      p.vy += (radialNy * burstStrength - 40 - p.vy * 2.0) * dt;

      // 快速淡出
      p.alpha *= Math.max(0, 1 - dt * 3.6);
      p.glow = 1.0 + bass * 1.5;
    } else {
      // dispersed: 深空漂移模式
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;

      // 弱引力约束向吸积盘或微弱中心汇聚
      p.vx += (dx * 1.5 - p.vx * 1.2) * dt;
      p.vy += (dy * 1.5 - p.vy * 1.2) * dt;

      // 叠加低速宇宙星流
      const flow = Math.sin(time * 0.4 + p.id * 0.05);
      p.vx += Math.cos(flow) * 4 * dt;
      p.vy += Math.sin(flow) * 4 * dt;

      p.alpha += (p.baseAlpha * 0.7 - p.alpha) * dt * 2.0;
      p.glow = 0.8 + mid * 0.5;
    }

    // 3. 低频能量脉冲波膨胀（Bass Breathing）
    const sizePulse = 1.0 + bass * 0.75;
    p.renderSize = p.baseSize * sizePulse;

    // 4. 独立冲击波推力（Shockwave Force）
    if (shockwave > 0.08) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const push = shockwave * 180 * dt;
      p.vx += (dx / dist) * push;
      p.vy += (dy / dist) * push;
    }

    // 5. 欧拉位移更新
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // 软边界环绕保护（防止粒子飞出视野后丢失）
    if (p.x < -80) p.x = options.width + 80;
    else if (p.x > options.width + 80) p.x = -80;
    if (p.y < -80) p.y = options.height + 80;
    else if (p.y > options.height + 80) p.y = -80;
  }

  return particles;
}

// ==========================================
// 6. 音频特征提取与分析
// ==========================================

/**
 * 提取低频能量、中频瞬态与高频能量
 */
export function detectAudioEnergy(
  data: Uint8Array,
  prevBassAvg: number,
  prevMidAvg: number
): AudioEnergyFeatures {
  const len = data.length;
  if (len === 0) {
    return {
      bassEnergy: 0,
      midTransient: 0,
      trebleEnergy: 0,
      overallEnergy: 0,
      newBassAverage: prevBassAvg * 0.9,
      newMidAverage: prevMidAvg * 0.9,
    };
  }

  // 1. 低频 (bins 0..12)
  const bassEnd = Math.min(12, len);
  let bassSum = 0;
  for (let i = 0; i < bassEnd; i++) {
    bassSum += data[i];
  }
  const rawBass = bassSum / Math.max(bassEnd, 1);
  const bassEnergy = Math.min(rawBass / 220, 1.0);

  // 2. 中频 (bins 16..64)
  const midStart = Math.min(16, len - 1);
  const midEnd = Math.min(64, len);
  let midSum = 0;
  for (let i = midStart; i < midEnd; i++) {
    midSum += data[i];
  }
  const rawMid = midSum / Math.max(midEnd - midStart, 1);

  // 中频瞬态差分
  const midDelta = Math.max(rawMid - prevMidAvg, 0);
  const midTransient = Math.min(midDelta / 35, 1.0);

  // 3. 高频 (bins 64..128)
  const trebleStart = Math.min(64, len - 1);
  const trebleEnd = Math.min(128, len);
  let trebleSum = 0;
  for (let i = trebleStart; i < trebleEnd; i++) {
    trebleSum += data[i];
  }
  const rawTreble = trebleSum / Math.max(trebleEnd - trebleStart, 1);
  const trebleEnergy = Math.min(rawTreble / 180, 1.0);

  // 平滑均值更新
  const newBassAverage = prevBassAvg * 0.88 + rawBass * 0.12;
  const newMidAverage = prevMidAvg * 0.85 + rawMid * 0.15;

  const overallEnergy = bassEnergy * 0.5 + midTransient * 0.3 + trebleEnergy * 0.2;

  return {
    bassEnergy,
    midTransient,
    trebleEnergy,
    overallEnergy,
    newBassAverage,
    newMidAverage,
  };
}

// ==========================================
// 7. 间奏音源铭牌（Tech Nameplate HUD）渲染
// ==========================================

/**
 * 绘制高保真科技感音源铭牌（曲名、艺术家、96kHz/24bit HI-RES 标识）
 */
export function drawInterludeNameplate(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  artist: string,
  palette: KimiPalette,
  time: number
): void {
  const cx = width / 2;
  const cy = height / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 1. 中心微弱全息圆环与十字准心
  ctx.strokeStyle = "rgba(103, 232, 249, 0.15)";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.arc(cx, cy, 70, 0, Math.PI * 2);
  ctx.stroke();

  // 缓慢旋转的刻度环
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * 0.15);
  ctx.setLineDash([4, 12]);
  ctx.strokeStyle = "rgba(52, 211, 153, 0.25)";
  ctx.beginPath();
  ctx.arc(0, 0, 78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 2. 科技感外边框角标 [ HUD ]
  const boxW = Math.min(width * 0.52, 360);
  const boxH = 92;
  const halfW = boxW / 2;
  const halfH = boxH / 2;
  const cornerLen = 14;

  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1.5;

  // 四个角标
  ctx.beginPath();
  // 左上角
  ctx.moveTo(cx - halfW, cy - halfH + cornerLen);
  ctx.lineTo(cx - halfW, cy - halfH);
  ctx.lineTo(cx - halfW + cornerLen, cy - halfH);
  // 右上角
  ctx.moveTo(cx + halfW - cornerLen, cy - halfH);
  ctx.lineTo(cx + halfW, cy - halfH);
  ctx.lineTo(cx + halfW, cy - halfH + cornerLen);
  // 右下角
  ctx.moveTo(cx + halfW, cy + halfH - cornerLen);
  ctx.lineTo(cx + halfW, cy + halfH);
  ctx.lineTo(cx + halfW - cornerLen, cy + halfH);
  // 左下角
  ctx.moveTo(cx - halfW + cornerLen, cy + halfH);
  ctx.lineTo(cx - halfW, cy + halfH);
  ctx.lineTo(cx - halfW, cy + halfH - cornerLen);
  ctx.stroke();

  // 3. 顶部微型状态行
  ctx.font = "600 10px Geist, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(103, 232, 249, 0.75)";
  ctx.fillText("● KIMI QUANTUM FIELD // ACCRETION DISK ACTIVE", cx, cy - halfH - 12);

  // 4. 曲名排版
  const displayTitle = title || "MIMI Lossless Audio";
  ctx.font = "700 20px Geist, 'PingFang SC', sans-serif";
  ctx.fillStyle = "#F8FAFC";
  ctx.fillText(displayTitle, cx, cy - 14);

  // 5. 艺术家信息
  const displayArtist = artist || "High-Fidelity Audio Core";
  ctx.font = "500 13px Geist, 'PingFang SC', sans-serif";
  ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
  ctx.fillText(displayArtist, cx, cy + 12);

  // 6. Hi-Res 96kHz / 24bit 铭牌徽标
  const badgeY = cy + halfH + 14;
  const badgeText = "HI-RES AUDIO  |  96kHz / 24bit FLAC";
  ctx.font = "600 11px Geist, -apple-system, sans-serif";
  const badgeW = ctx.measureText(badgeText).width + 20;

  ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
  ctx.fillRect(cx - badgeW / 2, badgeY - 10, badgeW, 20);
  ctx.strokeStyle = "rgba(103, 232, 249, 0.45)";
  ctx.strokeRect(cx - badgeW / 2, badgeY - 10, badgeW, 20);

  ctx.fillStyle = KIMI_TITANIUM_BLUE;
  ctx.fillText(badgeText, cx, badgeY);

  ctx.restore();
}

// ==========================================
// 8. 运行时状态管理与主渲染管线
// ==========================================

const runtimeCache = new WeakMap<CanvasRenderingContext2D, KimiRuntimeState>();

function getOrCreateRuntimeState(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particleCount = 4500
): KimiRuntimeState {
  let state = runtimeCache.get(ctx);
  if (!state) {
    state = {
      particles: createQuantumParticlePool(particleCount, width, height),
      state: "dispersed",
      prevLineIndex: -1,
      stateTimer: 0,
      cachedLyricsText: "",
      parsedLines: [],
      currentTargetPoints: [],
      lastMusicTime: 0,
      lastFrameTimeMs: typeof performance !== "undefined" ? performance.now() : 0,
      bassAverage: 25,
      midAverage: 25,
      shockwaveForce: 0,
      sweepProgress: 0,
    };
    runtimeCache.set(ctx, state);
  }
  return state;
}

/**
 * 查找当前播放时间下的活动歌词行索引
 */
export function findKimiActiveLyricLineIndex(lines: ParsedLyricLine[], time: number): number {
  if (lines.length === 0) return -1;
  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].start <= time) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}

/**
 * 检测是否处于无歌词间奏（Solo / 待机）模式
 */
export function checkIsKimiInterlude(
  lines: ParsedLyricLine[],
  lineIndex: number,
  time: number
): boolean {
  if (lines.length === 0 || lineIndex === -1) {
    return true;
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
    // 尾奏
    return time - currentLine.start > 6.0;
  }

  const gap = nextLine.start - currentLine.start;
  if (gap >= 6.5 && time - currentLine.start >= 4.2) {
    return true;
  }

  return false;
}

/**
 * 绘制「极核流光 · Kimi 科技感」主特效
 */
export function drawKimiQuantumGlow(ctx: EffectContext): void {
  const { ctx: c, width, height, data, time, musicTime, params } = ctx;

  const nowMs = typeof performance !== "undefined" ? performance.now() : time * 1000;
  const particleCount =
    typeof params?.particleCount === "number" ? Math.round(params.particleCount) : 4500;
  const state = getOrCreateRuntimeState(c, width, height, particleCount);

  const dt = Math.min(Math.max((nowMs - state.lastFrameTimeMs) / 1000, 0.001), 0.05);
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

  // 2. 音频特征提取
  const audioFeatures = detectAudioEnergy(data, state.bassAverage, state.midAverage);
  state.bassAverage = audioFeatures.newBassAverage;
  state.midAverage = audioFeatures.newMidAverage;

  // 3. 调色板映射
  const palette = resolveKimiPalette(audioFeatures.overallEnergy, {
    coverColor: currentSong?.cover ?? null,
  });

  // 4. 歌词状态机与调度
  const effectiveMusicTime = musicTime > 0 ? musicTime : (audioState?.currentTime ?? 0);
  const activeLineIndex = findKimiActiveLyricLineIndex(state.parsedLines, effectiveMusicTime);
  const isInterlude = checkIsKimiInterlude(state.parsedLines, activeLineIndex, effectiveMusicTime);

  // 5. 状态转换逻辑
  if (isInterlude) {
    // 间奏模式：吸积盘几何
    state.state = "dispersed";
    state.currentTargetPoints = generateAccretionDiskPoints(
      state.particles.length,
      width,
      height,
      time
    );
  } else {
    // 歌词行切换触发
    if (activeLineIndex !== state.prevLineIndex && activeLineIndex !== -1) {
      state.prevLineIndex = activeLineIndex;
      const currentLineText = state.parsedLines[activeLineIndex]?.text ?? "";

      // 提取点阵
      state.currentTargetPoints = sampleTextToPoints(currentLineText, width, height, {
        step: 4,
        maxPoints: state.particles.length,
      });

      // 状态机触发聚拢
      state.state = "attracting";
      state.stateTimer = 0;
      state.sweepProgress = 0;
    }

    state.stateTimer += dt;

    // 状态流转：attracting (0.75s) -> formed -> dissolving
    if (state.state === "attracting" && state.stateTimer > 0.75) {
      state.state = "formed";
      state.stateTimer = 0;
    } else if (state.state === "formed") {
      // 推进凝结扫光波
      const currentLine = state.parsedLines[activeLineIndex];
      const nextLine = state.parsedLines[activeLineIndex + 1];
      const lineDuration = nextLine ? Math.max(nextLine.start - currentLine.start, 2.0) : 4.0;
      state.sweepProgress = Math.min(state.stateTimer / (lineDuration * 0.8), 1.0);

      // 行尾消散
      if (state.stateTimer > lineDuration - 0.5) {
        state.state = "dissolving";
      }
    }
  }

  // 6. 重拍冲击波与衰减
  if (audioFeatures.bassEnergy > 0.72) {
    state.shockwaveForce = Math.min(state.shockwaveForce + 0.45, 1.0);
  }
  state.shockwaveForce *= Math.exp(-dt * 6);

  // 7. 更新量子粒子动力学
  state.particles = updateQuantumParticleState(state.particles, state.currentTargetPoints, {
    state: state.state,
    dt,
    width,
    height,
    bassEnergy: audioFeatures.bassEnergy,
    midTransient: audioFeatures.midTransient,
    trebleEnergy: audioFeatures.trebleEnergy,
    shockwaveForce: state.shockwaveForce,
    sweepProgress: state.sweepProgress,
    time,
  });

  // 8. 绘制深空背景与暗角
  c.save();
  c.fillStyle = palette.background;
  c.fillRect(0, 0, width, height);

  // 深空径向冷蓝微弱光晕
  const bgGrad = c.createRadialGradient(
    width / 2,
    height / 2,
    10,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.65
  );
  bgGrad.addColorStop(0, "rgba(103, 232, 249, 0.06)");
  bgGrad.addColorStop(0.5, "rgba(8, 9, 12, 0.4)");
  bgGrad.addColorStop(1, "rgba(5, 6, 8, 0.95)");
  c.fillStyle = bgGrad;
  c.fillRect(0, 0, width, height);

  // 9. 间奏音源铭牌 HUD
  if (isInterlude) {
    drawInterludeNameplate(
      c,
      width,
      height,
      currentSong?.title ?? "MIMI Lossless Audio",
      currentSong?.artist ?? "Master Quality Source",
      palette,
      time
    );
  }

  // 10. 渲染量子粒子（微秒级镜头色散 Chromatic Aberration 0.5% + Bloom）
  const aberrationOffset = Math.max(width * 0.005 * (params?.chromaticAberration ?? 0.5), 1.5);
  const bloomIntensity = params?.bloomIntensity ?? 0.8;

  // 使用 lighter 物理叠加呈现纯正量子光晕
  c.globalCompositeOperation = "lighter";

  // 色散通道 1：红色/极光紫偏移 (-aberrationOffset)
  c.fillStyle = palette.isHighEnergy ? "rgba(167, 139, 250, 0.28)" : "rgba(103, 232, 249, 0.22)";
  for (let i = 0; i < state.particles.length; i += 2) {
    const p = state.particles[i];
    if (p.alpha <= 0.05) continue;
    c.beginPath();
    c.arc(p.x - aberrationOffset, p.y, p.renderSize * 0.8, 0, Math.PI * 2);
    c.fill();
  }

  // 色散通道 2：主光核心与 Bloom 泛光（0 offset）
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    if (p.alpha <= 0.05) continue;

    c.fillStyle = p.color;
    c.globalAlpha = Math.min(Math.max(p.alpha, 0), 1);
    c.beginPath();
    c.arc(p.x, p.y, p.renderSize, 0, Math.PI * 2);
    c.fill();

    // 强发光粒子叠加 Bloom 光晕
    if (p.glow > 1.4 && bloomIntensity > 0.1) {
      c.fillStyle = palette.glowColor;
      c.beginPath();
      c.arc(p.x, p.y, p.renderSize * (1.8 + p.glow * 0.4), 0, Math.PI * 2);
      c.fill();
    }
  }

  // 色散通道 3：幽青/极光蓝偏移 (+aberrationOffset)
  c.fillStyle = palette.isHighEnergy ? "rgba(251, 191, 36, 0.26)" : "rgba(52, 211, 153, 0.22)";
  for (let i = 1; i < state.particles.length; i += 2) {
    const p = state.particles[i];
    if (p.alpha <= 0.05) continue;
    c.beginPath();
    c.arc(p.x + aberrationOffset, p.y, p.renderSize * 0.8, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
}
