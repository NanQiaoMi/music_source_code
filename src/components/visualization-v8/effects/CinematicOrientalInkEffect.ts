/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext, AudioData, EffectParameterMap } from "@/lib/visualization/types";

// ==========================================
// 1. Types & Data Structures
// ==========================================

export interface GoldFlakeParticle {
  x: number;
  y: number;
  z: number; // Depth 0.1 (far) to 1.0 (near)
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  alpha: number;
  rotation: number;
  vRot: number;
  twinklePhase: number;
  twinkleSpeed: number;
  aspectRatio: number; // Foil aspect ratio
  colorType: "gold" | "platinum" | "copper";
}

export interface InteractiveRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  width: number;
}

export interface VolumetricShaft {
  angle: number;
  width: number;
  intensity: number;
  speed: number;
  offset: number;
}

export interface InkLayerWave {
  speed: number;
  wavelength: number;
  amplitude: number;
  baseYPercent: number;
  phase: number;
}

export interface CinematicInkState {
  particles: GoldFlakeParticle[];
  ripples: InteractiveRipple[];
  shafts: VolumetricShaft[];
  inkWaves: InkLayerWave[];
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  smoothedBrightness: number;
  timeAccumulator: number;
  mouseX: number;
  mouseY: number;
  isMouseDown: boolean;
  activePoemIndex: number;
  poemAlpha: number;
  poemTimer: number;
  lastPointerTime: number;
  goldGlowSprite: HTMLCanvasElement | null;
  anamorphicFlareSprite: HTMLCanvasElement | null;
  vignetteGradient: CanvasGradient | null;
  lastWidth: number;
  lastHeight: number;
}

// 东方古典意境诗词文库（纯音乐空灵感知）
const ORIENTAL_POEMS = [
  { line: "高山流水遇知音，明月清泉照此心", author: "古调清吟" },
  { line: "林断山明竹隐墙，乱蝉衰草小池塘", author: "苏轼 · 减字木兰花" },
  { line: "清风徐来水波不兴，行到水穷坐看云起", author: "王维 · 终南别业" },
  { line: "落霞与孤鹜齐飞，秋水共长天一色", author: "王勃 · 滕王阁序" },
  { line: "幽兰生前庭，含熏待清风", author: "陶渊明 · 饮酒" },
  { line: "沧海月明珠有泪，蓝田日暖玉生烟", author: "李商隐 · 锦瑟" },
  { line: "松风吹解带，山月照弹琴", author: "王维 · 酬张少府" },
  { line: "山气日夕佳，飞鸟相与还", author: "陶渊明 · 饮酒" },
];

// 东方传统三大调色哲学体系
const COLOR_SCHEMES: Record<
  string,
  {
    bgGradient: [string, string, string];
    inkLayers: [string, string, string];
    godrayColor: string;
    goldColor: string;
    highlightColor: string;
    ambientGlow: string;
  }
> = {
  qianli_green: {
    // 【千里江山 · 青绿千山】
    bgGradient: ["#040d12", "#091e24", "#0f2e34"],
    inkLayers: [
      "rgba(10, 31, 36, 0.95)", // 浓黛山脊
      "rgba(20, 58, 68, 0.85)", // 石青中景
      "rgba(35, 95, 75, 0.70)", // 绿松云海
    ],
    godrayColor: "rgba(255, 238, 195, 0.08)",
    goldColor: "rgba(245, 192, 101, 0.90)",
    highlightColor: "rgba(255, 248, 220, 1.0)",
    ambientGlow: "rgba(16, 185, 129, 0.15)",
  },
  jiangnan_ink: {
    // 【烟雨江南 · 徽派水墨】
    bgGradient: ["#050608", "#12141a", "#1a1d26"],
    inkLayers: [
      "rgba(15, 17, 22, 0.96)", // 玄黑焦墨
      "rgba(32, 36, 46, 0.86)", // 黛灰湿墨
      "rgba(55, 62, 78, 0.65)", // 淡墨清气
    ],
    godrayColor: "rgba(215, 235, 255, 0.07)",
    goldColor: "rgba(186, 215, 245, 0.92)",
    highlightColor: "rgba(255, 255, 255, 0.98)",
    ambientGlow: "rgba(56, 189, 248, 0.12)",
  },
  tang_sunset: {
    // 【盛唐气度 · 暮霞流丹】
    bgGradient: ["#120516", "#260d26", "#38132e"],
    inkLayers: [
      "rgba(31, 11, 36, 0.96)", // 沉香浓紫
      "rgba(78, 22, 54, 0.86)", // 朱砂暗红
      "rgba(136, 44, 76, 0.68)", // 胭脂晚霞
    ],
    godrayColor: "rgba(255, 205, 150, 0.09)",
    goldColor: "rgba(251, 191, 36, 0.95)",
    highlightColor: "rgba(254, 243, 199, 1.0)",
    ambientGlow: "rgba(244, 63, 94, 0.18)",
  },
};

// ==========================================
// 2. Offscreen Sprite Generators (High-DPI)
// ==========================================

function createGoldGlowSprite(size: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const center = size / 2;
    const grd = ctx.createRadialGradient(center, center, 0, center, center, center);
    grd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    grd.addColorStop(0.18, "rgba(255, 225, 140, 0.95)");
    grd.addColorStop(0.45, "rgba(245, 185, 80, 0.45)");
    grd.addColorStop(0.75, "rgba(215, 145, 40, 0.12)");
    grd.addColorStop(1.0, "rgba(180, 110, 20, 0.0)");

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    return canvas;
  } catch {
    return null;
  }
}

function createAnamorphicFlareSprite(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const cx = width / 2;
    const cy = height / 2;

    const hGrd = ctx.createLinearGradient(0, cy, width, cy);
    hGrd.addColorStop(0, "rgba(180, 230, 255, 0)");
    hGrd.addColorStop(0.3, "rgba(245, 200, 120, 0.15)");
    hGrd.addColorStop(0.48, "rgba(255, 245, 220, 0.85)");
    hGrd.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
    hGrd.addColorStop(0.52, "rgba(255, 245, 220, 0.85)");
    hGrd.addColorStop(0.7, "rgba(245, 200, 120, 0.15)");
    hGrd.addColorStop(1, "rgba(180, 230, 255, 0)");

    ctx.fillStyle = hGrd;
    ctx.fillRect(0, 0, width, height);
    return canvas;
  } catch {
    return null;
  }
}

// Simplex-inspired 2D smooth noise approximation
function pseudoNoise2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

// ==========================================
// 3. V8 Effect Plugin Definition
// ==========================================

export const CinematicOrientalInkEffect: EffectPlugin = {
  id: "cinematic_oriental_ink",
  name: "千里江山 · 流光墨韵",
  category: "space",
  description: "专为纯音乐与古风打造：东方青绿水墨流体、电影级丁达尔体积光与悬浮金箔微粒系统",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "colorScheme",
      name: "东方美学调色",
      type: "select",
      mode: "basic",
      default: "qianli_green",
      options: [
        { label: "青绿千山 (千里江山宋风)", value: "qianli_green" },
        { label: "烟雨水墨 (江南徽派水晕)", value: "jiangnan_ink" },
        { label: "暮霞流丹 (盛唐沉香朱砂)", value: "tang_sunset" },
      ],
    },
    {
      id: "godraysIntensity",
      name: "丁达尔体积光强度",
      type: "number",
      mode: "basic",
      min: 0.0,
      max: 2.5,
      step: 0.1,
      default: 1.2,
      audioDriven: {
        enabled: true,
        band: "mid",
        multiplier: 1.2,
      },
    },
    {
      id: "particleCount",
      name: "金箔微粒密度",
      type: "number",
      mode: "basic",
      min: 100,
      max: 900,
      step: 50,
      default: 450,
    },
    {
      id: "inkFlowSpeed",
      name: "水墨流动速率",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.0,
      audioDriven: {
        enabled: true,
        band: "mid",
        multiplier: 0.8,
      },
    },
    {
      id: "rippleSensitivity",
      name: "清潭交互波纹敏感度",
      type: "number",
      mode: "professional",
      min: 0.0,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
    {
      id: "showPoetry",
      name: "纯音乐意境诗词浮现",
      type: "boolean",
      mode: "basic",
      default: true,
    },
    {
      id: "filmVignette",
      name: "电影呼吸暗角与微色散",
      type: "number",
      mode: "professional",
      min: 0.0,
      max: 1.0,
      step: 0.05,
      default: 0.65,
    },
  ],

  // ==========================================
  // 4. Lifecycle: Init
  // ==========================================
  init(context: RenderContext): void {
    const width = Math.max(context.width, 320);
    const height = Math.max(context.height, 240);

    // 1. 初始化悬浮金箔微粒 (3D 景深分层)
    const particles: GoldFlakeParticle[] = [];
    const count = 450;
    for (let i = 0; i < count; i++) {
      const z = 0.15 + Math.random() * 0.85; // 景深
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        vx: (Math.random() - 0.5) * 0.4 * z,
        vy: -0.15 - Math.random() * 0.45 * z, // 缓缓向上飘逸
        size: (1.2 + Math.random() * 3.2) * z,
        baseAlpha: 0.25 + Math.random() * 0.65,
        alpha: 0.5,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.02,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.5 + Math.random() * 2.0,
        aspectRatio: 0.4 + Math.random() * 0.9,
        colorType: Math.random() > 0.3 ? "gold" : Math.random() > 0.5 ? "platinum" : "copper",
      });
    }

    // 2. 初始化体积光束 (God Rays / 丁达尔晨曦光)
    const shafts: VolumetricShaft[] = [
      { angle: 0.58, width: 0.22, intensity: 0.85, speed: 0.08, offset: 0.0 },
      { angle: 0.68, width: 0.16, intensity: 1.10, speed: 0.12, offset: 1.8 },
      { angle: 0.76, width: 0.28, intensity: 0.70, speed: 0.07, offset: 3.5 },
      { angle: 0.88, width: 0.19, intensity: 0.95, speed: 0.10, offset: 5.1 },
      { angle: 0.98, width: 0.25, intensity: 0.60, speed: 0.06, offset: 2.2 },
    ];

    // 3. 初始化水墨山峦三层波动曲线
    const inkWaves: InkLayerWave[] = [
      { speed: 0.18, wavelength: 0.0022, amplitude: 35, baseYPercent: 0.52, phase: 0 },
      { speed: 0.26, wavelength: 0.0035, amplitude: 55, baseYPercent: 0.66, phase: 1.5 },
      { speed: 0.38, wavelength: 0.0048, amplitude: 75, baseYPercent: 0.82, phase: 3.2 },
    ];

    const goldGlowSprite = createGoldGlowSprite(64);
    const anamorphicFlareSprite = createAnamorphicFlareSprite(512, 32);

    const state: CinematicInkState = {
      particles,
      ripples: [],
      shafts,
      inkWaves,
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedEnergy: 0,
      smoothedBrightness: 0,
      timeAccumulator: 0,
      mouseX: width / 2,
      mouseY: height / 2,
      isMouseDown: false,
      activePoemIndex: 0,
      poemAlpha: 0,
      poemTimer: 0,
      lastPointerTime: 0,
      goldGlowSprite,
      anamorphicFlareSprite,
      vignetteGradient: null,
      lastWidth: width,
      lastHeight: height,
    };

    context.private = { state };
  },

  // ==========================================
  // 5. Lifecycle: Render Frame
  // ==========================================
  render(context: RenderContext, audioData: AudioData, rawParameters: EffectParameterMap): void {
    const ctx = context.ctx;
    if (!ctx) return;

    if (!context.private?.state) {
      CinematicOrientalInkEffect.init(context);
    }
    const state: CinematicInkState = context.private?.state;
    if (!state) return;

    const width = context.width;
    const height = context.height;
    const dt = Math.min(context.deltaTime || 0.016, 0.064);

    // 参数解构与默认值兜底
    const schemeKey = String(rawParameters?.colorScheme || "qianli_green");
    const colors = COLOR_SCHEMES[schemeKey] || COLOR_SCHEMES.qianli_green;
    const godraysIntensity = typeof rawParameters?.godraysIntensity === "number" ? rawParameters.godraysIntensity : 1.2;
    const targetParticleCount = typeof rawParameters?.particleCount === "number" ? Math.round(rawParameters.particleCount) : 450;
    const inkSpeedMult = typeof rawParameters?.inkFlowSpeed === "number" ? rawParameters.inkFlowSpeed : 1.0;
    const showPoetry = rawParameters?.showPoetry !== false;
    const filmVignette = typeof rawParameters?.filmVignette === "number" ? rawParameters.filmVignette : 0.65;

    // ----------------------------------------------------
    // 1. 音频特征 EMA 悠扬平滑滤波 (杜绝剧烈抽搐)
    // ----------------------------------------------------
    const rawBass = audioData?.bass || 0;
    const rawMid = audioData?.mid || 0;
    const rawTreble = audioData?.treble || 0;
    const rawFull = audioData?.full || 0;

    const emaAlpha = 0.12;
    state.smoothedBass += (rawBass - state.smoothedBass) * emaAlpha;
    state.smoothedMid += (rawMid - state.smoothedMid) * emaAlpha;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * emaAlpha;
    state.smoothedEnergy += (rawFull - state.smoothedEnergy) * emaAlpha;

    // 音色明亮度 (Spectral Brightness: 高频与中频相对比例)
    const instantBrightness = (state.smoothedTreble * 1.5 + state.smoothedMid) / Math.max(0.1, state.smoothedBass + 0.5);
    state.smoothedBrightness += (instantBrightness - state.smoothedBrightness) * 0.08;

    state.timeAccumulator += dt * (0.8 + state.smoothedMid * 0.6 * inkSpeedMult);

    // 动态调整粒子池大小
    if (state.particles.length < targetParticleCount) {
      const diff = targetParticleCount - state.particles.length;
      for (let i = 0; i < diff; i++) {
        const z = 0.15 + Math.random() * 0.85;
        state.particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          z,
          vx: (Math.random() - 0.5) * 0.4 * z,
          vy: -0.15 - Math.random() * 0.45 * z,
          size: (1.2 + Math.random() * 3.2) * z,
          baseAlpha: 0.25 + Math.random() * 0.65,
          alpha: 0.5,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.02,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.5 + Math.random() * 2.0,
          aspectRatio: 0.4 + Math.random() * 0.9,
          colorType: Math.random() > 0.3 ? "gold" : Math.random() > 0.5 ? "platinum" : "copper",
        });
      }
    } else if (state.particles.length > targetParticleCount) {
      state.particles.length = targetParticleCount;
    }

    // ----------------------------------------------------
    // 2. 绘制深邃东方背景渐变
    // ----------------------------------------------------
    const bgGrd = ctx.createLinearGradient(0, 0, width * 0.3, height);
    bgGrd.addColorStop(0, colors.bgGradient[0]);
    bgGrd.addColorStop(0.55, colors.bgGradient[1]);
    bgGrd.addColorStop(1.0, colors.bgGradient[2]);
    ctx.fillStyle = bgGrd;
    ctx.fillRect(0, 0, width, height);

    // ----------------------------------------------------
    // 3. 绘制体积光柱 (God Rays / 晨曦丁达尔光)
    // ----------------------------------------------------
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const lightSourceX = width * 0.15;
    const lightSourceY = -height * 0.1;
    const maxRayLength = Math.sqrt(width * width + height * height) * 1.3;

    state.shafts.forEach((shaft, idx) => {
      const dynamicAngle =
        shaft.angle +
        Math.sin(state.timeAccumulator * shaft.speed + shaft.offset) * 0.04 +
        (state.smoothedMid - 0.3) * 0.05;

      const dynamicIntensity =
        shaft.intensity *
        godraysIntensity *
        (0.65 + Math.sin(state.timeAccumulator * 0.5 + idx) * 0.15 + state.smoothedMid * 0.5);

      if (dynamicIntensity <= 0.01) return;

      const rayEndAngle1 = dynamicAngle - shaft.width * 0.5;
      const rayEndAngle2 = dynamicAngle + shaft.width * 0.5;

      const x1 = lightSourceX + Math.cos(rayEndAngle1) * maxRayLength;
      const y1 = lightSourceY + Math.sin(rayEndAngle1) * maxRayLength;
      const x2 = lightSourceX + Math.cos(rayEndAngle2) * maxRayLength;
      const y2 = lightSourceY + Math.sin(rayEndAngle2) * maxRayLength;

      const rayGrd = ctx.createRadialGradient(
        lightSourceX,
        lightSourceY,
        0,
        lightSourceX,
        lightSourceY,
        maxRayLength
      );
      rayGrd.addColorStop(0, `rgba(255, 245, 215, ${Math.min(0.4, dynamicIntensity * 0.25)})`);
      rayGrd.addColorStop(0.35, `rgba(240, 220, 180, ${Math.min(0.2, dynamicIntensity * 0.12)})`);
      rayGrd.addColorStop(0.75, `rgba(180, 200, 190, ${Math.min(0.08, dynamicIntensity * 0.04)})`);
      rayGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = rayGrd;
      ctx.beginPath();
      ctx.moveTo(lightSourceX, lightSourceY);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    // ----------------------------------------------------
    // 4. 绘制三层水墨流动山脊 (Fluid Ink Wash Waveforms)
    // ----------------------------------------------------
    ctx.save();
    state.inkWaves.forEach((wave, idx) => {
      const baseY = height * wave.baseYPercent;
      const layerColor = colors.inkLayers[idx] || colors.inkLayers[0];
      const audioPulse = idx === 0 ? state.smoothedMid * 25 : idx === 1 ? state.smoothedBass * 40 : state.smoothedEnergy * 30;

      ctx.fillStyle = layerColor;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, baseY);

      const segmentWidth = 16;
      const numSegments = Math.ceil(width / segmentWidth) + 1;

      for (let s = 0; s <= numSegments; s++) {
        const segX = s * segmentWidth;
        const noiseVal =
          Math.sin(segX * wave.wavelength + state.timeAccumulator * wave.speed + wave.phase) *
            wave.amplitude +
          Math.cos(segX * wave.wavelength * 1.8 - state.timeAccumulator * wave.speed * 0.7) *
            (wave.amplitude * 0.35);

        const curY = baseY + noiseVal - audioPulse;
        ctx.lineTo(segX, curY);
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // 在前两层山脊边缘绘制一层极细的漫射光雾边
      if (idx < 2) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = colors.ambientGlow;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = colors.goldColor;
        ctx.shadowBlur = 12 + state.smoothedMid * 15;
        ctx.stroke();
        ctx.restore();
      }
    });
    ctx.restore();

    // ----------------------------------------------------
    // 5. 绘制与更新清潭波纹 (Interactive Ripples)
    // ----------------------------------------------------
    if (state.ripples.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let r = state.ripples.length - 1; r >= 0; r--) {
        const rip = state.ripples[r];
        rip.radius += rip.speed * dt * 60;
        rip.alpha -= dt * 0.45;

        if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
          state.ripples.splice(r, 1);
          continue;
        }

        ctx.strokeStyle = `rgba(245, 215, 140, ${rip.alpha * 0.75})`;
        ctx.lineWidth = rip.width;
        ctx.shadowColor = colors.highlightColor;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ----------------------------------------------------
    // 6. 物理动力学与金箔微粒渲染 (3D Floating Gold Flakes)
    // ----------------------------------------------------
    ctx.save();
    const trebleBoost = state.smoothedTreble * 1.8;
    const time = state.timeAccumulator;

    state.particles.forEach((p) => {
      // 3D Simplex 湍流风力扰动
      const windAngle = pseudoNoise2D(p.x * 0.0012, p.y * 0.0012 + time * 0.2) * Math.PI * 2;
      const windForce = (0.15 + state.smoothedMid * 0.3) * p.z;

      p.vx += Math.cos(windAngle) * windForce * dt;
      p.vy += (Math.sin(windAngle) * windForce * 0.5 - 0.2 * p.z) * dt;

      // 阻尼
      p.vx *= 0.96;
      p.vy *= 0.96;

      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.rotation += p.vRot * (1.0 + state.smoothedMid);

      // 屏幕边界环绕
      if (p.y < -30) {
        p.y = height + 20;
        p.x = Math.random() * width;
      }
      if (p.x < -30) p.x = width + 20;
      if (p.x > width + 30) p.x = -20;

      // 闪烁与高频泛音共鸣
      p.twinklePhase += dt * p.twinkleSpeed;
      const twinkle = Math.sin(p.twinklePhase) * 0.35 + 0.65;
      p.alpha = Math.min(1.0, p.baseAlpha * twinkle * (0.8 + trebleBoost));

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(1.0, p.aspectRatio);

      // 绘制金箔主体 (不规则薄片)
      const halfSize = p.size;
      ctx.fillStyle =
        p.colorType === "gold"
          ? `rgba(245, 192, 101, ${p.alpha})`
          : p.colorType === "platinum"
          ? `rgba(240, 245, 255, ${p.alpha * 0.9})`
          : `rgba(225, 150, 90, ${p.alpha * 0.85})`;

      ctx.beginPath();
      ctx.moveTo(-halfSize, -halfSize * 0.6);
      ctx.lineTo(halfSize * 0.8, -halfSize);
      ctx.lineTo(halfSize, halfSize * 0.7);
      ctx.lineTo(-halfSize * 0.5, halfSize);
      ctx.closePath();
      ctx.fill();

      // 近景大颗粒绘制星芒与柔和光晕
      if (p.z > 0.65 && state.goldGlowSprite) {
        ctx.globalCompositeOperation = "screen";
        const glowSize = halfSize * 6;
        ctx.drawImage(state.goldGlowSprite, -glowSize / 2, -glowSize / 2, glowSize, glowSize);
      }

      ctx.restore();
    });
    ctx.restore();

    // ----------------------------------------------------
    // 7. 宽银幕变形镜头横向高光 (Anamorphic Streak)
    // ----------------------------------------------------
    if (state.anamorphicFlareSprite && state.smoothedTreble > 0.35) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const flareAlpha = Math.min(0.65, (state.smoothedTreble - 0.35) * 1.5);
      ctx.globalAlpha = flareAlpha;
      const flareW = width * 0.8;
      const flareH = 24;
      ctx.drawImage(
        state.anamorphicFlareSprite,
        (width - flareW) / 2,
        height * 0.62 - flareH / 2,
        flareW,
        flareH
      );
      ctx.restore();
    }

    // ----------------------------------------------------
    // 8. 东方意境诗词浮现层 (Calligraphy Poetry Subtitle)
    // ----------------------------------------------------
    if (showPoetry) {
      state.poemTimer += dt;
      // 每 14 秒轮播一句意境诗词 (淡入 2s -> 保持 10s -> 淡出 2s)
      const cycleTime = 14;
      const progressInCycle = state.poemTimer % cycleTime;

      if (progressInCycle < 2.0) {
        state.poemAlpha = progressInCycle / 2.0;
      } else if (progressInCycle < 12.0) {
        state.poemAlpha = 1.0;
      } else {
        state.poemAlpha = Math.max(0, (cycleTime - progressInCycle) / 2.0);
      }

      // 周期重置时切换至下一句
      if (progressInCycle < dt * 2 && state.poemTimer > 5) {
        state.activePoemIndex = (state.activePoemIndex + 1) % ORIENTAL_POEMS.length;
      }

      const currentPoem = ORIENTAL_POEMS[state.activePoemIndex];
      if (currentPoem && state.poemAlpha > 0.01) {
        ctx.save();
        ctx.font = 'normal 400 16px "Noto Serif SC", "Songti SC", "SimSun", "STSong", serif';
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        const textX = width - 48;
        const textY = height - 44;

        // 柔和光晕背衬
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgba(245, 235, 215, ${state.poemAlpha * 0.85})`;
        ctx.fillText(currentPoem.line, textX, textY);

        // 典雅小字出处与朱红印章
        ctx.font = '300 11px "Noto Serif SC", serif';
        ctx.fillStyle = `rgba(200, 185, 160, ${state.poemAlpha * 0.55})`;
        ctx.fillText(`— ${currentPoem.author}`, textX, textY + 22);

        // 朱红雅致小印
        const stampX = textX + 16;
        const stampY = textY - 2;
        ctx.fillStyle = `rgba(215, 50, 40, ${state.poemAlpha * 0.85})`;
        ctx.fillRect(stampX - 8, stampY - 8, 16, 16);
        ctx.strokeStyle = `rgba(255, 200, 180, ${state.poemAlpha * 0.9})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(stampX - 8, stampY - 8, 16, 16);

        ctx.font = 'bold 8px "Noto Serif SC", serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(255, 255, 255, ${state.poemAlpha * 0.95})`;
        ctx.fillText("墨", stampX, stampY);

        ctx.restore();
      }
    }

    // ----------------------------------------------------
    // 9. 电影级慢呼吸暗角与边缘色散 (Cinematic Vignette)
    // ----------------------------------------------------
    if (filmVignette > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";

      // 仅在尺寸变更时重建渐变
      if (
        !state.vignetteGradient ||
        state.lastWidth !== width ||
        state.lastHeight !== height
      ) {
        const cx = width / 2;
        const cy = height / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy);
        const vigGrd = ctx.createRadialGradient(cx, cy, maxDist * 0.35, cx, cy, maxDist);
        vigGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
        vigGrd.addColorStop(0.7, "rgba(220, 220, 220, 0.95)");
        vigGrd.addColorStop(1.0, "rgba(0, 0, 0, 0.75)");
        state.vignetteGradient = vigGrd;
        state.lastWidth = width;
        state.lastHeight = height;
      }

      ctx.fillStyle = state.vignetteGradient;
      ctx.globalAlpha = filmVignette * (0.85 + Math.sin(state.timeAccumulator * 0.4) * 0.08);
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  },

  // ==========================================
  // 6. Lifecycle: Resize
  // ==========================================
  resize(_width: number, _height: number): void {},

  // ==========================================
  // 7. Lifecycle: Destroy
  // ==========================================
  destroy(ctx?: RenderContext): void {
    if (ctx?.private?.state) {
      const state: CinematicInkState = ctx.private.state;
      state.particles = [];
      state.ripples = [];
      state.shafts = [];
      state.inkWaves = [];
      state.goldGlowSprite = null;
      state.anamorphicFlareSprite = null;
      state.vignetteGradient = null;
      ctx.private.state = null;
    }
  },
};
