/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext, AudioData, EffectParameterMap } from "@/lib/visualization/types";

export interface GoldFirefly {
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  alpha: number;
  phase: number;
  phaseSpeed: number;
  orbitRadius: number;
  orbitSpeed: number;
  colorType: "gold" | "moonlight" | "cinnabar";
}

export interface LakeRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

export interface CloudLayer {
  x: number;
  y: number;
  rx: number;
  ry: number;
  baseAlpha: number;
  speed: number;
  phase: number;
}

export interface SwimmingKoi {
  x: number;
  y: number;
  angle: number;
  speed: number;
  length: number;
  alpha: number;
  swimPhase: number;
}

export interface CinematicInkState {
  fireflies: GoldFirefly[];
  clouds: CloudLayer[];
  ripples: LakeRipple[];
  kois: SwimmingKoi[];
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  timeAccumulator: number;
  breathTime: number;
  activePoemIndex: number;
  poemAlpha: number;
  poemTimer: number;
  lastTransientPeak: number;
  starSparkleSprite: HTMLCanvasElement | null;
  moonDiscTexture: HTMLCanvasElement | null;
  moonGlowSprite: HTMLCanvasElement | null;
  grainCanvas: HTMLCanvasElement | null;
}

const ORIENTAL_POEMS = [
  { line: "高山流水遇知音，明月清泉照此心", author: "古调清吟 · 琴赋" },
  { line: "行到水穷处，坐看云起时", author: "王维 · 终南别业" },
  { line: "小舟从此逝，江海寄余生", author: "苏轼 · 临江仙" },
  { line: "落霞与孤鹜齐飞，秋水共长天一色", author: "王勃 · 滕王阁序" },
  { line: "幽兰生前庭，含熏待清风", author: "陶渊明 · 饮酒" },
  { line: "沧海月明珠有泪，蓝田日暖玉生烟", author: "李商隐 · 锦瑟" },
  { line: "松风吹解带，山月照弹琴", author: "王维 · 酬张少府" },
  { line: "月出惊山鸟，时鸣春涧中", author: "王维 · 鸟鸣涧" },
];

const COLOR_SCHEMES: Record<
  string,
  {
    skyTop: string;
    skyMid: string;
    skyBottom: string;
    farMountain: [string, string, string];
    midMountain: [string, string, string];
    nearMountain: [string, string, string];
    goldGlint: string;
    goldWire: string;
    cloudColor: string;
    waterColor: string;
    waterWave: string;
    lanternGlow: string;
    koiColor: string;
    moonBase: string;
    moonGlow: string;
    vignetteColor: string;
  }
> = {
  qianli_green: {
    skyTop: "#010608",
    skyMid: "#031115",
    skyBottom: "#071c21",
    farMountain: ["#061317", "#040d10", "#020608"],
    midMountain: ["#092125", "#06171a", "#030a0c"],
    nearMountain: ["#0d2b2d", "#081a1b", "#03090a"],
    goldGlint: "rgba(255, 235, 160, 0.95)",
    goldWire: "rgba(235, 195, 100, 0.70)",
    cloudColor: "rgba(10, 38, 42, 0.28)",
    waterColor: "rgba(2, 9, 12, 0.96)",
    waterWave: "rgba(200, 240, 230, 0.32)",
    lanternGlow: "rgba(255, 205, 110, 0.90)",
    koiColor: "rgba(255, 185, 105, 0.45)",
    moonBase: "rgba(240, 248, 255, 0.96)",
    moonGlow: "rgba(210, 240, 248, 0.12)",
    vignetteColor: "rgba(1, 3, 5, 0.88)",
  },
  jiangnan_ink: {
    skyTop: "#020305",
    skyMid: "#06080e",
    skyBottom: "#0d111a",
    farMountain: ["#0d0f15", "#08090d", "#040507"],
    midMountain: ["#131620", "#0c0e15", "#05060a"],
    nearMountain: ["#191f2c", "#10141d", "#07080d"],
    goldGlint: "rgba(220, 240, 255, 0.95)",
    goldWire: "rgba(175, 205, 245, 0.65)",
    cloudColor: "rgba(20, 26, 38, 0.30)",
    waterColor: "rgba(4, 5, 8, 0.96)",
    waterWave: "rgba(190, 215, 250, 0.28)",
    lanternGlow: "rgba(255, 215, 130, 0.85)",
    koiColor: "rgba(205, 225, 255, 0.40)",
    moonBase: "rgba(245, 248, 255, 0.96)",
    moonGlow: "rgba(195, 220, 255, 0.10)",
    vignetteColor: "rgba(1, 2, 3, 0.88)",
  },
  tang_sunset: {
    skyTop: "#060108",
    skyMid: "#140417",
    skyBottom: "#22071e",
    farMountain: ["#140416", "#0d020e", "#050106"],
    midMountain: ["#200822", "#140315", "#0a010b"],
    nearMountain: ["#320d2e", "#1e041c", "#0e010e"],
    goldGlint: "rgba(255, 225, 140, 0.98)",
    goldWire: "rgba(250, 180, 75, 0.75)",
    cloudColor: "rgba(48, 12, 36, 0.32)",
    waterColor: "rgba(9, 2, 11, 0.96)",
    waterWave: "rgba(255, 185, 135, 0.36)",
    lanternGlow: "rgba(255, 185, 80, 0.90)",
    koiColor: "rgba(255, 155, 85, 0.50)",
    moonBase: "rgba(255, 240, 225, 0.96)",
    moonGlow: "rgba(255, 190, 145, 0.12)",
    vignetteColor: "rgba(4, 1, 6, 0.88)",
  },
};

function createMoonDiscTexture(size: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const c = size / 2;
    const r = size * 0.46;

    const baseGrd = ctx.createRadialGradient(c - r * 0.25, c - r * 0.25, 0, c, c, r);
    baseGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    baseGrd.addColorStop(0.65, "rgba(240, 246, 252, 0.98)");
    baseGrd.addColorStop(0.92, "rgba(220, 235, 245, 0.90)");
    baseGrd.addColorStop(1.0, "rgba(200, 220, 235, 0.0)");

    ctx.fillStyle = baseGrd;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const inkSpots = [
      { x: c - r * 0.2, y: c - r * 0.15, rx: r * 0.35, ry: r * 0.22, rot: 0.3 },
      { x: c + r * 0.25, y: c - r * 0.25, rx: r * 0.25, ry: r * 0.18, rot: -0.4 },
      { x: c - r * 0.1, y: c + r * 0.3, rx: r * 0.40, ry: r * 0.25, rot: 0.8 },
      { x: c + r * 0.2, y: c + r * 0.15, rx: r * 0.30, ry: r * 0.20, rot: -0.2 },
    ];

    inkSpots.forEach((spot) => {
      ctx.save();
      ctx.translate(spot.x, spot.y);
      ctx.rotate(spot.rot);
      ctx.scale(spot.rx, spot.ry);
      const spotGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      spotGrd.addColorStop(0, "rgba(145, 175, 195, 0.45)");
      spotGrd.addColorStop(0.6, "rgba(175, 200, 215, 0.20)");
      spotGrd.addColorStop(1.0, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = spotGrd;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const rimGrd = ctx.createRadialGradient(c - r * 0.35, c - r * 0.35, r * 0.4, c, c, r);
    rimGrd.addColorStop(0, "rgba(255, 255, 255, 0.0)");
    rimGrd.addColorStop(0.8, "rgba(255, 255, 255, 0.3)");
    rimGrd.addColorStop(1.0, "rgba(255, 255, 255, 0.8)");
    ctx.fillStyle = rimGrd;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    return canvas;
  } catch {
    return null;
  }
}

function createMoonGlowSprite(size: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const c = size / 2;
    const grd = ctx.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, "rgba(255, 255, 255, 0.85)");
    grd.addColorStop(0.12, "rgba(235, 248, 255, 0.55)");
    grd.addColorStop(0.32, "rgba(195, 235, 245, 0.22)");
    grd.addColorStop(0.65, "rgba(140, 195, 215, 0.06)");
    grd.addColorStop(1.0, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    return canvas;
  } catch {
    return null;
  }
}

function createStarSparkle(size: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const c = size / 2;
    const radGrd = ctx.createRadialGradient(c, c, 0, c, c, c * 0.45);
    radGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    radGrd.addColorStop(0.3, "rgba(255, 235, 160, 0.85)");
    radGrd.addColorStop(0.7, "rgba(240, 180, 70, 0.2)");
    radGrd.addColorStop(1.0, "rgba(200, 140, 40, 0.0)");
    ctx.fillStyle = radGrd;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(c, 2);
    ctx.lineTo(c, size - 2);
    ctx.moveTo(2, c);
    ctx.lineTo(size - 2, c);
    ctx.stroke();
    return canvas;
  } catch {
    return null;
  }
}

function createGrain(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const img = ctx.createImageData(128, 128);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const noise = (Math.random() - 0.5) * 28;
      d[i] = 128 + noise;
      d[i + 1] = 128 + noise;
      d[i + 2] = 128 + noise;
      d[i + 3] = 10;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

function shanShuiRidgeHeight(normX: number, layerIndex: number, time: number): number {
  if (layerIndex === 1) {
    const p1 = Math.exp(-Math.pow((normX - 0.28) * 5.0, 2)) * -160;
    const p2 = Math.exp(-Math.pow((normX - 0.65) * 4.2, 2)) * -135;
    const p3 = Math.exp(-Math.pow((normX - 0.88) * 7.0, 2)) * -90;
    const undulating = Math.sin(normX * 4.2 + 0.3) * 35;
    return p1 + p2 + p3 + undulating;
  } else if (layerIndex === 2) {
    const p1 = Math.exp(-Math.pow((normX - 0.18) * 4.5, 2)) * -105;
    const p2 = Math.exp(-Math.pow((normX - 0.52) * 3.8, 2)) * -115;
    const slope = Math.sin(normX * 5.0 + 1.2) * 38;
    const breath = Math.sin(time * 0.12 + normX * 2) * 6;
    return p1 + p2 + slope + breath;
  } else {
    const cliff = Math.exp(-Math.pow((normX - 0.82) * 4.0, 2)) * -75;
    const shore = Math.sin(normX * 3.5 + 2.0) * 28;
    return cliff + shore;
  }
}

export const CinematicOrientalInkEffect: EffectPlugin = {
  id: "cinematic_oriental_ink",
  name: "千里江山 · 流光墨韵",
  category: "space",
  description: "专为纯音乐与古风打造：东方青绿水墨画卷、水墨月海冷月、一叶轻舟渔火与水底灵动游鱼系统",
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
      name: "清幽月华光晕强度",
      type: "number",
      mode: "basic",
      min: 0.0,
      max: 2.5,
      step: 0.1,
      default: 1.2,
    },
    {
      id: "particleCount",
      name: "流萤金箔密度",
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
      name: "电影呼吸暗角与宣纸质感",
      type: "number",
      mode: "professional",
      min: 0.0,
      max: 1.0,
      step: 0.05,
      default: 0.65,
    },
  ],

  init(context: RenderContext): void {
    const width = Math.max(context.width, 320);
    const height = Math.max(context.height, 240);

    const fireflies: GoldFirefly[] = [];
    const count = 450;
    for (let i = 0; i < count; i++) {
      const z = 0.15 + Math.random() * 0.85;
      const x = Math.random() * width;
      const y = Math.random() * height;
      fireflies.push({
        x,
        y,
        z,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.18 * z,
        vy: -0.10 - Math.random() * 0.22 * z,
        size: (1.2 + Math.random() * 2.6) * z,
        baseAlpha: 0.2 + Math.random() * 0.65,
        alpha: 0.5,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.35 + Math.random() * 1.0,
        orbitRadius: 12 + Math.random() * 35,
        orbitSpeed: 0.2 + Math.random() * 0.4,
        colorType: Math.random() > 0.35 ? "gold" : Math.random() > 0.5 ? "moonlight" : "cinnabar",
      });
    }

    const clouds: CloudLayer[] = [
      { x: width * 0.22, y: height * 0.45, rx: 280, ry: 50, baseAlpha: 0.25, speed: 0.07, phase: 0 },
      { x: width * 0.68, y: height * 0.52, rx: 340, ry: 60, baseAlpha: 0.20, speed: 0.05, phase: 2.1 },
      { x: width * 0.40, y: height * 0.66, rx: 420, ry: 70, baseAlpha: 0.28, speed: 0.08, phase: 4.3 },
    ];

    const kois: SwimmingKoi[] = [
      { x: width * 0.42, y: height * 0.90, angle: 0.2, speed: 18, length: 22, alpha: 0.35, swimPhase: 0 },
      { x: width * 0.55, y: height * 0.93, angle: 3.3, speed: 14, length: 18, alpha: 0.30, swimPhase: 1.5 },
      { x: width * 0.28, y: height * 0.94, angle: 0.1, speed: 12, length: 16, alpha: 0.25, swimPhase: 3.0 },
    ];

    const starSparkleSprite = createStarSparkle(56);
    const moonDiscTexture = createMoonDiscTexture(256);
    const moonGlowSprite = createMoonGlowSprite(512);
    const grainCanvas = createGrain();

    const state: CinematicInkState = {
      fireflies,
      clouds,
      ripples: [],
      kois,
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedEnergy: 0,
      timeAccumulator: 0,
      breathTime: 0,
      activePoemIndex: 0,
      poemAlpha: 0,
      poemTimer: 0,
      lastTransientPeak: 0,
      starSparkleSprite,
      moonDiscTexture,
      moonGlowSprite,
      grainCanvas,
    };

    context.private = { state };
  },

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
    const dt = Math.min(context.deltaTime || 0.016, 0.05);

    const schemeKey = String(rawParameters?.colorScheme || "qianli_green");
    const colors = COLOR_SCHEMES[schemeKey] || COLOR_SCHEMES.qianli_green;
    const inkSpeedMult = typeof rawParameters?.inkFlowSpeed === "number" ? rawParameters.inkFlowSpeed : 1.0;
    const showPoetry = rawParameters?.showPoetry !== false;
    const filmVignette = typeof rawParameters?.filmVignette === "number" ? rawParameters.filmVignette : 0.65;

    const rawBass = audioData?.bass || 0;
    const rawMid = audioData?.mid || 0;
    const rawTreble = audioData?.treble || 0;
    const rawFull = audioData?.full || 0;

    const attack = 0.05;
    const decay = 0.025;
    state.smoothedBass += (rawBass - state.smoothedBass) * (rawBass > state.smoothedBass ? attack : decay);
    state.smoothedMid += (rawMid - state.smoothedMid) * (rawMid > state.smoothedMid ? attack : decay);
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * (rawTreble > state.smoothedTreble ? attack : decay);
    state.smoothedEnergy += (rawFull - state.smoothedEnergy) * (rawFull > state.smoothedEnergy ? attack : decay);

    state.timeAccumulator += dt * (0.32 + state.smoothedMid * 0.25 * inkSpeedMult);
    state.breathTime += dt * 0.25;

    // 1. 苍穹古色
    const skyGrd = ctx.createLinearGradient(0, 0, 0, height);
    skyGrd.addColorStop(0, colors.skyTop);
    skyGrd.addColorStop(0.5, colors.skyMid);
    skyGrd.addColorStop(1.0, colors.skyBottom);
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, width, height);

    // 2. 艺术级水墨月华与月面肌理
    const moonX = width * 0.16;
    const moonY = height * 0.21;
    const moonDiameter = Math.min(width, height) * 0.11;
    const moonRadius = moonDiameter / 2;

    ctx.save();

    if (state.moonGlowSprite) {
      ctx.globalCompositeOperation = "screen";
      const glowSize = moonDiameter * 6.5 * (1.0 + state.smoothedEnergy * 0.12);
      ctx.globalAlpha = 0.70 + Math.sin(state.breathTime) * 0.06 + state.smoothedMid * 0.15;
      ctx.drawImage(state.moonGlowSprite, moonX - glowSize / 2, moonY - glowSize / 2, glowSize, glowSize);
    }

    if (state.moonDiscTexture) {
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(
        state.moonDiscTexture,
        moonX - moonRadius * 1.08,
        moonY - moonRadius * 1.08,
        moonDiameter * 1.08,
        moonDiameter * 1.08
      );
    }

    const cloudWisps = [
      { dy: -moonRadius * 0.25, w: moonDiameter * 2.2, h: moonRadius * 0.28, rot: 0.04, speed: 0.18, phase: 0 },
      { dy: moonRadius * 0.20, w: moonDiameter * 2.8, h: moonRadius * 0.35, rot: -0.03, speed: 0.24, phase: 1.8 },
      { dy: moonRadius * 0.55, w: moonDiameter * 1.9, h: moonRadius * 0.22, rot: 0.02, speed: 0.14, phase: 3.5 },
    ];

    ctx.globalCompositeOperation = "source-over";
    cloudWisps.forEach((wisp) => {
      const cloudOffset = Math.sin(state.timeAccumulator * wisp.speed + wisp.phase) * (moonRadius * 0.6);
      const cx = moonX + cloudOffset;
      const cy = moonY + wisp.dy;

      const wispGrd = ctx.createLinearGradient(cx - wisp.w / 2, 0, cx + wisp.w / 2, 0);
      wispGrd.addColorStop(0, "rgba(0, 0, 0, 0)");
      wispGrd.addColorStop(0.3, colors.skyMid);
      wispGrd.addColorStop(0.5, "rgba(4, 18, 22, 0.85)");
      wispGrd.addColorStop(0.7, colors.skyMid);
      wispGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = wispGrd;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(wisp.rot);
      ctx.scale(wisp.w / 2, wisp.h / 2);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();

    // 3. 实心山水画卷
    const drawShanShui = (layerIndex: number, baseYRatio: number, colorStops: [string, string, string], goldWireAlpha: number) => {
      ctx.save();
      const baseY = height * baseYRatio;
      const mtnGrd = ctx.createLinearGradient(0, baseY - 180, 0, height);
      mtnGrd.addColorStop(0, colorStops[0]);
      mtnGrd.addColorStop(0.45, colorStops[1]);
      mtnGrd.addColorStop(1.0, colorStops[2]);
      ctx.fillStyle = mtnGrd;

      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, baseY);

      const stepPx = 8;
      const totalSteps = Math.ceil(width / stepPx) + 1;
      const ridgePoints: { x: number; y: number }[] = [];

      for (let i = 0; i <= totalSteps; i++) {
        const curX = i * stepPx;
        const normX = curX / width;
        const hOffset = shanShuiRidgeHeight(normX, layerIndex, state.timeAccumulator);
        const curY = baseY + hOffset;
        ridgePoints.push({ x: curX, y: curY });
        ctx.lineTo(curX, curY);
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      if (goldWireAlpha > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = colors.goldWire;
        ctx.lineWidth = 1.2 + state.smoothedTreble * 0.6;
        ctx.shadowColor = colors.goldGlint;
        ctx.shadowBlur = 6 + state.smoothedTreble * 8;
        ctx.globalAlpha = goldWireAlpha * (0.60 + state.smoothedTreble * 0.35);

        ctx.beginPath();
        for (let i = 0; i < ridgePoints.length; i++) {
          if (i === 0) ctx.moveTo(ridgePoints[i].x, ridgePoints[i].y);
          else ctx.lineTo(ridgePoints[i].x, ridgePoints[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      const mistY = baseY - 35;
      const mistGrd = ctx.createLinearGradient(0, mistY, 0, mistY + 120);
      mistGrd.addColorStop(0, "rgba(0, 0, 0, 0)");
      mistGrd.addColorStop(0.45, colors.cloudColor);
      mistGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = mistGrd;
      ctx.fillRect(0, mistY, width, 120);
      ctx.restore();

      ctx.restore();
    };

    drawShanShui(1, 0.46, colors.farMountain, 0.30);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    state.clouds.forEach((cloud) => {
      const cx = (cloud.x + Math.sin(state.timeAccumulator * cloud.speed + cloud.phase) * 50) % (width + 280) - 140;
      const cloudGrd = ctx.createRadialGradient(cx, cloud.y, 0, cx, cloud.y, cloud.rx);
      cloudGrd.addColorStop(0, colors.cloudColor);
      cloudGrd.addColorStop(0.6, "rgba(6, 26, 29, 0.12)");
      cloudGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = cloudGrd;
      ctx.globalAlpha = cloud.baseAlpha * (0.8 + Math.sin(state.breathTime) * 0.2);
      ctx.save();
      ctx.translate(cx, cloud.y);
      ctx.scale(cloud.rx, cloud.ry);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    drawShanShui(2, 0.62, colors.midMountain, 0.55);
    drawShanShui(3, 0.78, colors.nearMountain, 0.80);

    // 4. 清潭水镜、月影倒影、扁舟与游鱼
    const lakeY = height * 0.82;
    ctx.save();
    const lakeGrd = ctx.createLinearGradient(0, lakeY, 0, height);
    lakeGrd.addColorStop(0, "rgba(2, 7, 10, 0.6)");
    lakeGrd.addColorStop(1.0, colors.waterColor);
    ctx.fillStyle = lakeGrd;
    ctx.fillRect(0, lakeY, width, height - lakeY);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const moonReflectGrd = ctx.createLinearGradient(moonX - moonRadius * 1.8, 0, moonX + moonRadius * 1.8, 0);
    moonReflectGrd.addColorStop(0, "rgba(0, 0, 0, 0)");
    moonReflectGrd.addColorStop(0.5, "rgba(215, 240, 250, 0.12)");
    moonReflectGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = moonReflectGrd;
    ctx.fillRect(moonX - moonRadius * 1.8, lakeY, moonRadius * 3.6, height - lakeY);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    state.kois.forEach((koi) => {
      koi.swimPhase += dt * 3.5;
      koi.x += Math.cos(koi.angle) * koi.speed * dt;
      koi.y += Math.sin(koi.angle) * (koi.speed * 0.3) * dt;

      if (koi.x < -40) koi.x = width + 40;
      if (koi.x > width + 40) koi.x = -40;
      if (koi.y < lakeY + 20) koi.y = height - 30;
      if (koi.y > height + 20) koi.y = lakeY + 40;

      const wiggle = Math.sin(koi.swimPhase) * 3;

      ctx.save();
      ctx.translate(koi.x, koi.y);
      ctx.rotate(koi.angle);
      ctx.fillStyle = colors.koiColor;
      ctx.globalAlpha = koi.alpha * (0.8 + state.smoothedMid * 0.3);

      ctx.beginPath();
      ctx.moveTo(koi.length * 0.5, 0);
      ctx.quadraticCurveTo(0, 3, -koi.length * 0.5, wiggle);
      ctx.quadraticCurveTo(-koi.length * 0.7, wiggle * 1.5, -koi.length * 0.8, wiggle * 2);
      ctx.quadraticCurveTo(-koi.length * 0.5, 0, 0, -3);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    });
    ctx.restore();

    ctx.globalCompositeOperation = "screen";
    for (let w = 0; w < 3; w++) {
      const waveY = lakeY + (height - lakeY) * ((w + 1) / 4);
      const waveAlpha = (0.16 - w * 0.04) * (0.7 + state.smoothedMid * 0.3);
      ctx.strokeStyle = colors.waterWave;
      ctx.lineWidth = 1.0;
      ctx.globalAlpha = waveAlpha;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 20) {
        const sinOffset = Math.sin(x * 0.01 + state.timeAccumulator * (0.28 + w * 0.1) + w) * 2.2;
        if (x === 0) ctx.moveTo(x, waveY + sinOffset);
        else ctx.lineTo(x, waveY + sinOffset);
      }
      ctx.stroke();
    }

    const boatX = width * 0.32;
    const boatBobbing = Math.sin(state.timeAccumulator * 0.55) * 2.5;
    const boatY = height * 0.86 + boatBobbing;

    ctx.save();
    ctx.translate(boatX, boatY);
    ctx.rotate(Math.sin(state.timeAccumulator * 0.55) * 0.018);

    ctx.fillStyle = "rgba(3, 6, 8, 0.95)";
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.quadraticCurveTo(-9, 6, 0, 7);
    ctx.quadraticCurveTo(13, 6, 22, 0);
    ctx.quadraticCurveTo(9, 3, 0, 3);
    ctx.quadraticCurveTo(-9, 3, -20, 0);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-2, 0, 6.5, Math.PI, 0, false);
    ctx.fill();

    ctx.globalCompositeOperation = "screen";
    const lanternX = 13;
    const lanternY = -3;
    const lanternGrd = ctx.createRadialGradient(lanternX, lanternY, 0, lanternX, lanternY, 22);
    lanternGrd.addColorStop(0, "rgba(255, 242, 185, 0.95)");
    lanternGrd.addColorStop(0.25, colors.lanternGlow);
    lanternGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = lanternGrd;
    ctx.beginPath();
    ctx.arc(lanternX, lanternY, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();

    // 5. 空灵流萤
    ctx.save();
    const trebleBoost = state.smoothedTreble * 1.0;
    state.fireflies.forEach((p) => {
      p.phase += dt * p.phaseSpeed;
      const hoverX = Math.sin(p.phase) * p.orbitRadius;
      const hoverY = Math.cos(p.phase * 0.7) * (p.orbitRadius * 0.35);

      p.baseY += p.vy * dt * 60;
      p.baseX += p.vx * dt * 60;

      if (p.baseY < -30) {
        p.baseY = height + 20;
        p.baseX = Math.random() * width;
      }
      if (p.baseX < -30) p.baseX = width + 20;
      if (p.baseX > width + 30) p.baseX = -20;

      p.x = p.baseX + hoverX;
      p.y = p.baseY + hoverY;

      const twinkle = Math.sin(p.phase) * 0.35 + 0.65;
      p.alpha = Math.min(1.0, p.baseAlpha * twinkle * (0.8 + trebleBoost));

      ctx.save();
      ctx.translate(p.x, p.y);

      const halfSize = p.size;
      if (p.colorType === "gold") {
        ctx.fillStyle = `rgba(245, 200, 110, ${p.alpha})`;
      } else if (p.colorType === "moonlight") {
        ctx.fillStyle = `rgba(225, 245, 255, ${p.alpha * 0.9})`;
      } else {
        ctx.fillStyle = `rgba(225, 120, 90, ${p.alpha * 0.85})`;
      }

      ctx.beginPath();
      ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
      ctx.fill();

      if (p.z > 0.72 && p.alpha > 0.78 && state.starSparkleSprite) {
        ctx.globalCompositeOperation = "screen";
        const spSize = halfSize * 6 * (1.0 + state.smoothedTreble * 0.5);
        ctx.globalAlpha = p.alpha * 0.80;
        ctx.drawImage(state.starSparkleSprite, -spSize / 2, -spSize / 2, spSize, spSize);
      }
      ctx.restore();
    });
    ctx.restore();

    // 6. 诗词呼吸层
    if (showPoetry) {
      state.poemTimer += dt;
      const cycleTime = 16;
      const progress = state.poemTimer % cycleTime;
      if (progress < 2.5) state.poemAlpha = progress / 2.5;
      else if (progress < 13.5) state.poemAlpha = 1.0;
      else state.poemAlpha = Math.max(0, (cycleTime - progress) / 2.5);

      if (progress < dt * 2 && state.poemTimer > 5) {
        state.activePoemIndex = (state.activePoemIndex + 1) % ORIENTAL_POEMS.length;
      }

      const currentPoem = ORIENTAL_POEMS[state.activePoemIndex];
      if (currentPoem && state.poemAlpha > 0.01) {
        ctx.save();
        ctx.font = 'normal 400 16px "Noto Serif SC", "Songti SC", "SimSun", serif';
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const textX = width - 48;
        const textY = height - 46;
        ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        ctx.shadowBlur = 14;
        ctx.fillStyle = `rgba(240, 235, 220, ${state.poemAlpha * 0.85})`;
        ctx.fillText(currentPoem.line, textX, textY);

        ctx.font = '300 11px "Noto Serif SC", serif';
        ctx.fillStyle = `rgba(195, 185, 165, ${state.poemAlpha * 0.55})`;
        ctx.fillText(`— ${currentPoem.author}`, textX, textY + 22);

        const stampX = textX + 18;
        const stampY = textY - 2;
        ctx.fillStyle = `rgba(215, 50, 42, ${state.poemAlpha * 0.85})`;
        ctx.fillRect(stampX - 8, stampY - 8, 16, 16);
        ctx.strokeStyle = `rgba(255, 210, 190, ${state.poemAlpha * 0.90})`;
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

    // 7. 电影暗角与宣纸颗粒
    if (filmVignette > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      const cx = width / 2;
      const cy = height / 2;
      const maxDist = Math.sqrt(cx * cx + cy * cy);
      const vigGrd = ctx.createRadialGradient(cx, cy, maxDist * 0.38, cx, cy, maxDist);
      vigGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      vigGrd.addColorStop(0.7, "rgba(225, 225, 225, 0.96)");
      vigGrd.addColorStop(1.0, colors.vignetteColor);
      ctx.fillStyle = vigGrd;
      ctx.globalAlpha = filmVignette * (0.85 + Math.sin(state.breathTime) * 0.03);
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      if (state.grainCanvas) {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        const grainPattern = ctx.createPattern(state.grainCanvas, "repeat");
        if (grainPattern) {
          ctx.fillStyle = grainPattern;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
      }
    }
  },

  resize(_width: number, _height: number): void {},

  destroy(ctx?: RenderContext): void {
    if (ctx?.private?.state) {
      const state: CinematicInkState = ctx.private.state;
      state.fireflies = [];
      state.clouds = [];
      state.ripples = [];
      state.kois = [];
      state.starSparkleSprite = null;
      state.moonDiscTexture = null;
      state.moonGlowSprite = null;
      state.grainCanvas = null;
      ctx.private.state = null;
    }
  },
};
