/**
 * 「动漫手书 MV」（Anime Handwritten MV）—— 次世代手绘动漫画风独立可视化特效。
 *
 * 特性亮点：
 * 1. AE 风格 3D / 伪 3D 虚拟摄像机（VirtualCamera2D）：
 *    歌词换行时触发呼吸节奏式急速推近特写（Crash / Punch Zoom：从 1.0x 冲向 1.8x，再缓退至 1.1x）；
 *    无歌词间奏时镜头平滑缓退，展示唯美全景信纸与呼吸光晕。
 * 2. 音频瞬态重拍检测（Kick / Bass Transients）：
 *    重拍时叠加 2–4px 高频微震（Camera Micro-Shake），并在文字边缘爆裂物理水彩墨滴微粒（Ink Splatter）。
 * 3. 抽帧定格（Stepped Frames）：
 *    支持 12fps / 24fps 阶梯手绘质感与漫画蘸水笔微抖线稿（Dip Pen Jitter）。
 * 4. 调色板系统：
 *    0 日光暖纸、1 暮色群青、2 秋叶山吹、3 封面自适应。
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

interface AnimeMVRuntimeState {
  prevLineIndex: number;
  lineTransitionProgress: number; // 0..1
  lineTransitionStartTime: number;
  lastMusicTime: number;
  lastFrameTimeMs: number;
  bassAverage: number;
  camera: VirtualCameraState;
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
    paper: "#FAF6EE",
    paperDeep: "#EAE0CE",
    ink: "#1F1D1B",
    inkSoft: "rgba(40, 35, 30, 0.65)",
    accent: "#FF8C42",
    splatterColors: ["#1F1D1B", "#E76F51", "#F4A261", "#D94F3D"],
    vignette: "rgba(100, 80, 60, 0.25)",
    glow: "rgba(255, 200, 120, 0.25)",
    dark: false,
  },
  {
    id: 1,
    name: "暮色群青",
    paper: "#111625",
    paperDeep: "#0B0E18",
    ink: "#F0F4FF",
    inkSoft: "rgba(200, 220, 255, 0.65)",
    accent: "#4D96FF",
    splatterColors: ["#4D96FF", "#6BCB77", "#9D4EDD", "#E0EAFC"],
    vignette: "rgba(5, 8, 15, 0.7)",
    glow: "rgba(77, 150, 255, 0.3)",
    dark: true,
  },
  {
    id: 2,
    name: "秋叶山吹",
    paper: "#F5EBE1",
    paperDeep: "#DFC8B2",
    ink: "#2D2320",
    inkSoft: "rgba(60, 45, 40, 0.65)",
    accent: "#E59500",
    splatterColors: ["#2D2320", "#C84B31", "#E59500", "#A83232"],
    vignette: "rgba(80, 45, 30, 0.3)",
    glow: "rgba(245, 166, 35, 0.28)",
    dark: false,
  },
  {
    id: 3,
    name: "封面自适应",
    paper: "#181A20",
    paperDeep: "#101216",
    ink: "#F5F6FA",
    inkSoft: "rgba(240, 240, 245, 0.65)",
    accent: "#FF5E7E",
    splatterColors: ["#FF5E7E", "#00F0FF", "#F5F6FA", "#FFA07A"],
    vignette: "rgba(10, 12, 18, 0.65)",
    glow: "rgba(255, 94, 126, 0.25)",
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
      // 亮色封面：温暖画纸 + 封面主题墨滴
      return {
        id: 3,
        name: "封面自适应",
        paper: "#FDFBF7",
        paperDeep: "#EFE8DC",
        ink: "#1E1C1A",
        inkSoft: "rgba(35, 30, 25, 0.65)",
        accent: `#${hex}`,
        splatterColors: [`#${hex}`, "#1E1C1A", "rgba(230, 100, 60, 0.8)"],
        vignette: "rgba(70, 50, 40, 0.2)",
        glow: `rgba(${r}, ${g}, ${b}, 0.22)`,
        dark: false,
      };
    }

    // 暗色封面：深色宣纸 + 亮色墨线
    return {
      id: 3,
      name: "封面自适应",
      paper: "#15171C",
      paperDeep: "#0D0E12",
      ink: "#F4F6FB",
      inkSoft: "rgba(220, 225, 235, 0.65)",
      accent: `#${hex}`,
      splatterColors: [`#${hex}`, "#F4F6FB", "rgba(100, 200, 255, 0.8)"],
      vignette: "rgba(5, 7, 10, 0.7)",
      glow: `rgba(${r}, ${g}, ${b}, 0.28)`,
      dark: true,
    };
  }

  return ANIME_PALETTES[3];
}

// ==========================================
// 3. 摄像机与数学插值计算
// ==========================================

/**
 * 计算虚拟摄像机缩放插值（Punch / Crash Zoom 呼吸曲线）
 * - 歌词行切换时：从 1.0x 急速推近冲向 1.8x，再缓退至 1.1x 持握
 * - 间奏时（isInterlude = true）：镜头平滑缓退至 1.0x 全景
 *
 * @param progress 动画插值进度（0.0 至 1.0）
 * @param isInterlude 是否处于无歌词间奏
 */
export function calculateCameraZoom(progress: number, isInterlude = false): number {
  if (isInterlude) {
    // 间奏模式：平滑回落至 1.0 全景
    const t = Math.min(Math.max(progress, 0), 1);
    // 从 1.1x 平滑回退至 1.0x (quadratic ease-out)
    return 1.1 - 0.1 * (t * (2 - t));
  }

  if (progress <= 0) return 1.0;

  // Punch Zoom 阶段划分：
  // 1. 冲击阶段（0 -> 0.15）：从 1.0x 冲向 1.8x
  const attackDuration = 0.15;
  if (progress < attackDuration) {
    const u = progress / attackDuration;
    // Cubic ease-out
    return 1.0 + 0.8 * (1 - Math.pow(1 - u, 3));
  }

  // 2. 回弹缓退阶段（0.15 -> 1.0）：从 1.8x 缓退至 1.1x
  if (progress <= 1.0) {
    const v = (progress - attackDuration) / (1.0 - attackDuration);
    // Quadratic ease-out recoil
    return 1.1 + 0.7 * Math.pow(1 - v, 2);
  }

  // 超过 1.0 时保持在 1.1x
  return 1.1;
}

// ==========================================
// 4. 音频瞬态重拍检测（Kick / Bass Transients）
// ==========================================

/**
 * 检测低频能量瞬态突变（用于捕获底鼓重拍）
 */
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
  // 略过 DC 偏移 bin 0，取低频 bins
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
// 5. 抽帧定格（Stepped Frames）与漫画蘸水笔线稿抖动
// ==========================================

/**
 * 抽帧时间计算（12fps / 24fps 阶梯手绘定格）
 */
export function calculateSteppedTime(time: number, fps = 12): number {
  if (fps <= 0) return time;
  return Math.floor(time * fps) / fps;
}

/**
 * 抽帧帧索引（用于帧锁定的确定性随机种子）
 */
export function calculateSteppedFrame(time: number, fps = 12): number {
  if (fps <= 0) return Math.floor(time * 12);
  return Math.floor(time * fps);
}

/**
 * 漫画蘸水笔线稿抖动（Dip Pen Jitter）
 * 在指定抽帧率下输出确定性的微小位移和倾角
 */
export function calculatePenJitter(
  seed: number,
  frameIndex: number,
  amplitude = 1.5
): { x: number; y: number; angle: number } {
  const h1 = Math.sin(seed * 12.9898 + frameIndex * 78.233) * 43758.5453;
  const h2 = Math.cos(seed * 39.346 + frameIndex * 11.135) * 23421.631;
  const r1 = (h1 - Math.floor(h1)) * 2 - 1; // -1 .. 1
  const r2 = (h2 - Math.floor(h2)) * 2 - 1; // -1 .. 1

  return {
    x: r1 * amplitude,
    y: r2 * amplitude,
    angle: r1 * amplitude * 0.008, // 弧度微倾
  };
}

// ==========================================
// 6. 物理水彩墨滴粒子系统（Ink Splatter）
// ==========================================

/**
 * 生成爆裂物理水彩墨滴微粒
 */
export function spawnInkSplatter(
  x: number,
  y: number,
  count: number,
  colors: string[],
  intensity = 1.0
): InkParticle[] {
  const particles: InkParticle[] = [];
  const safeCount = Math.max(1, count);
  const colorList = colors.length > 0 ? colors : ["#1F1D1B"];

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
      decayRate: 0.8 + Math.random() * 0.8, // 约 0.6-1.2s 消失
      stainSize: initialSize * (1.2 + Math.random() * 0.6), // 墨滴渗纸扩散
    });
  }

  return particles;
}

/**
 * 物理墨滴步进更新
 */
export function updateInkParticles(particles: InkParticle[], dt: number): InkParticle[] {
  const next: InkParticle[] = [];
  const stepRatio = Math.min(Math.max(dt, 0.001), 0.1) * 60;

  for (const p of particles) {
    p.life -= dt * p.decayRate;
    if (p.life <= 0) continue;

    // 阻尼与微重力
    p.x += p.vx * stepRatio;
    p.y += p.vy * stepRatio;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.vy += 0.08 * stepRatio; // 纸面微下渗

    // 墨水在纸面略微晕染扩散
    p.size += (p.stainSize - p.size) * 0.08 * stepRatio;

    next.push(p);
  }

  return next;
}

// ==========================================
// 7. 歌词时间线与间奏检测辅助
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
    // 歌词未开始：若距首句 > 1.8s 则视为前奏间奏
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
    // 尾奏
    return time - currentLine.start > 6.0;
  }

  // 两句之间间隔长且当前句已唱完
  const gap = nextLine.start - currentLine.start;
  if (gap >= 7.0 && time - currentLine.start >= 4.5) {
    return true;
  }

  return false;
}

// ==========================================
// 8. 运行时状态管理
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
      particles: [],
      cachedLyricsText: "",
      parsedLines: [],
    };
    runtimeCache.set(ctx, state);
  }
  return state;
}

// ==========================================
// 9. 主绘制入口：drawAnimeHandwrittenMV
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

  // 2. 调色板映射
  const schemeIndex = typeof params?.colorScheme === "number" ? params.colorScheme : 0;
  const coverColor = currentSong?.cover ?? null;
  const palette = resolveAnimePalette(schemeIndex, coverColor);

  // 3. 抽帧定格时间步进（默认 12fps 手绘感）
  const fps = typeof params?.fps === "number" ? params.fps : 12;
  const steppedTime = calculateSteppedTime(time, fps);
  const steppedFrame = calculateSteppedFrame(time, fps);

  // 4. 音频瞬态重拍检测（重拍触发微震与墨滴爆裂）
  const transientResult = detectAudioTransient(data, state.bassAverage, {
    thresholdMultiplier: 1.28,
    minEnergy: 38,
    decayAlpha: 0.88,
  });
  state.bassAverage = transientResult.newAverage;

  // 5. 歌词分镜索引与间奏检测
  const effectiveMusicTime = musicTime > 0 ? musicTime : (audioState?.currentTime ?? 0);
  const activeLineIndex = findActiveLyricLineIndex(state.parsedLines, effectiveMusicTime);
  const isInterlude = checkIsInterlude(state.parsedLines, activeLineIndex, effectiveMusicTime);

  // 6. 检测歌词行切换，触发 Punch Zoom 与墨滴爆裂
  if (activeLineIndex !== state.prevLineIndex && activeLineIndex !== -1) {
    state.prevLineIndex = activeLineIndex;
    state.lineTransitionProgress = 0;
    state.lineTransitionStartTime = nowMs;

    // 歌词换行时的特征墨滴爆裂
    const burst = spawnInkSplatter(
      width / 2 + (Math.random() - 0.5) * 80,
      height / 2 + (Math.random() - 0.5) * 40,
      12,
      palette.splatterColors,
      1.4
    );
    state.particles.push(...burst);
  }

  // 推进换行过渡动画进度（持续约 0.75s）
  if (state.lineTransitionProgress < 1.0) {
    const elapsed = (nowMs - state.lineTransitionStartTime) / 1000;
    state.lineTransitionProgress = Math.min(elapsed / 0.75, 1.0);
  }

  // 7. 重拍叠加 2-4px 高频微震
  if (transientResult.isBeat) {
    const shakeImpulse = 2.0 + 2.0 * transientResult.intensity; // 2..4px
    state.camera.shakeIntensity = Math.min(state.camera.shakeIntensity + shakeImpulse, 4.0);

    // 重拍爆裂水彩墨滴微粒
    const beatSplatter = spawnInkSplatter(
      width / 2 + (Math.random() - 0.5) * 120,
      height / 2 + (Math.random() - 0.5) * 60,
      8,
      palette.splatterColors,
      1.1 * transientResult.intensity
    );
    state.particles.push(...beatSplatter);
  }

  // 衰减微震
  state.camera.shakeIntensity *= Math.exp(-dtSeconds * 16);
  if (state.camera.shakeIntensity > 0.05) {
    const jitterShake = calculatePenJitter(99, steppedFrame, state.camera.shakeIntensity);
    state.camera.shakeX = jitterShake.x;
    state.camera.shakeY = jitterShake.y;
  } else {
    state.camera.shakeX = 0;
    state.camera.shakeY = 0;
  }

  // 8. 计算摄像机当前缩放
  const cameraZoom = calculateCameraZoom(state.lineTransitionProgress, isInterlude);
  state.camera.zoom = cameraZoom;

  // 9. 更新墨滴微粒
  state.particles = updateInkParticles(state.particles, dtSeconds);
  if (state.particles.length > 80) {
    state.particles = state.particles.slice(-80);
  }

  // ==========================================
  // 开始绘制渲染管线
  // ==========================================

  c.save();

  // 清空底色
  c.fillStyle = palette.paper;
  c.fillRect(0, 0, width, height);

  // 虚拟摄像机坐标变换（以画面中心为原点）
  const centerX = width / 2;
  const centerY = height / 2;

  c.save();
  c.translate(centerX + state.camera.shakeX, centerY + state.camera.shakeY);
  c.scale(state.camera.zoom, state.camera.zoom);
  c.translate(-centerX, -centerY);

  // A. 纸面纹理底色与边缘暗角
  const paperGrad = c.createRadialGradient(
    centerX,
    centerY,
    Math.min(width, height) * 0.2,
    centerX,
    centerY,
    Math.max(width, height) * 0.75
  );
  paperGrad.addColorStop(0, palette.paper);
  paperGrad.addColorStop(1, palette.paperDeep);
  c.fillStyle = paperGrad;
  c.fillRect(0, 0, width, height);

  // B. 间奏调度唯美全景呼吸光晕
  if (isInterlude) {
    const breath = 0.5 + 0.5 * Math.sin(steppedTime * 2.0);
    const glowRadius = Math.min(width, height) * (0.35 + 0.08 * breath);
    const glowGrad = c.createRadialGradient(centerX, centerY, 10, centerX, centerY, glowRadius);
    glowGrad.addColorStop(0, palette.glow);
    glowGrad.addColorStop(1, "transparent");
    c.fillStyle = glowGrad;
    c.beginPath();
    c.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
    c.fill();
  }

  // C. 绘制爆裂物理水彩墨滴微粒
  for (const p of state.particles) {
    c.save();
    c.globalAlpha = Math.min(Math.max(p.alpha * p.life, 0), 1);
    c.fillStyle = p.color;
    c.beginPath();
    c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // D. 漫画蘸水笔手绘线稿与歌词文字
  const penJitter = calculatePenJitter(
    activeLineIndex >= 0 ? activeLineIndex : 7,
    steppedFrame,
    1.6
  );

  const activeLine = activeLineIndex >= 0 ? state.parsedLines[activeLineIndex] : null;

  if (activeLine && activeLine.text.trim()) {
    // 歌词主文本
    const fontSize = Math.max(26, Math.min(width * 0.045, 52));
    c.font = `600 ${fontSize}px "Yuji Boku", "Klee One", "Noto Serif SC", "Songti SC", "STSong", serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";

    const textX = centerX + penJitter.x;
    const textY = centerY + penJitter.y;

    // 1. 漫画蘸水笔打稿微影（Pencil Under-Sketch）
    c.save();
    c.fillStyle = palette.inkSoft;
    c.globalAlpha = 0.22;
    c.fillText(activeLine.text, textX + 1.2, textY + 1.5);
    c.restore();

    // 2. 蘸水笔正文墨迹
    c.save();
    c.fillStyle = palette.ink;
    c.fillText(activeLine.text, textX, textY);
    c.restore();

    // 3. 上下一行伴影歌词（前后景深）
    const prevLine = activeLineIndex > 0 ? state.parsedLines[activeLineIndex - 1] : null;
    const nextLine =
      activeLineIndex + 1 < state.parsedLines.length
        ? state.parsedLines[activeLineIndex + 1]
        : null;

    const subFontSize = fontSize * 0.52;
    c.font = `400 ${subFontSize}px "Yuji Boku", "Klee One", "Noto Serif SC", serif`;

    if (prevLine && prevLine.text.trim()) {
      c.save();
      c.fillStyle = palette.inkSoft;
      c.globalAlpha = 0.28;
      c.fillText(prevLine.text, centerX, textY - fontSize * 1.5);
      c.restore();
    }

    if (nextLine && nextLine.text.trim()) {
      c.save();
      c.fillStyle = palette.inkSoft;
      c.globalAlpha = 0.28;
      c.fillText(nextLine.text, centerX, textY + fontSize * 1.5);
      c.restore();
    }
  } else {
    // 待机或纯间奏：展示手书风格标题卡
    const title = currentSong?.title || "MIMI PLAYER";
    const artist = currentSong?.artist || "Anime Handwritten MV";

    const titleSize = Math.max(28, Math.min(width * 0.048, 56));
    c.font = `600 ${titleSize}px "Yuji Boku", "Klee One", "Noto Serif SC", serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";

    const titleX = centerX + penJitter.x;
    const titleY = centerY + penJitter.y;

    c.fillStyle = palette.ink;
    c.fillText(title, titleX, titleY - 14);

    c.font = `400 ${titleSize * 0.42}px "Yuji Boku", "Klee One", "Noto Serif SC", serif`;
    c.fillStyle = palette.inkSoft;
    c.fillText(artist, centerX, titleY + titleSize * 0.65);
  }

  c.restore(); // 恢复虚拟摄像机变换

  // E. 画面暗角（Vignette Overlay）
  const vignetteGrad = c.createRadialGradient(
    centerX,
    centerY,
    Math.min(width, height) * 0.4,
    centerX,
    centerY,
    Math.max(width, height) * 0.72
  );
  vignetteGrad.addColorStop(0, "transparent");
  vignetteGrad.addColorStop(1, palette.vignette);
  c.fillStyle = vignetteGrad;
  c.fillRect(0, 0, width, height);

  c.restore();
}
