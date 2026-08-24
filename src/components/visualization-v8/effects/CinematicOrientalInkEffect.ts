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
  progress: number;
  maxRadius: number;
  duration: number;
  life: number;
  driftVx: number;
  driftVy: number;
  alpha: number;
}

export interface MistRibbon {
  x: number;
  y: number;
  rx: number;
  ry: number;
  baseAlpha: number;
  speed: number;
  phase: number;
  driftY: number;
}

export interface SwimmingKoi {
  x: number;
  y: number;
  targetAngle: number;
  angle: number;
  baseSpeed: number;
  currentSpeed: number;
  length: number;
  alpha: number;
  swimPhase: number;
  glideTimer: number;
  trail: { x: number; y: number; alpha: number; size: number }[];
}

export interface StarNode {
  x: number;
  y: number;
  baseAlpha: number;
  size: number;
  phase: number;
}

export interface CrestEmber {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface CinematicInkState {
  fireflies: GoldFirefly[];
  mistRibbons: MistRibbon[];
  clouds: MistRibbon[];
  ripples: LakeRipple[];
  kois: SwimmingKoi[];
  stars: StarNode[];
  crestEmbers: CrestEmber[];
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

const CONSTELLATION_NODES = [
  { x: 0.72, y: 0.10 },
  { x: 0.76, y: 0.13 },
  { x: 0.81, y: 0.16 },
  { x: 0.84, y: 0.22 },
  { x: 0.89, y: 0.23 },
  { x: 0.92, y: 0.28 },
  { x: 0.87, y: 0.29 },
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
    shoreMountain: [string, string, string];
    goldGlint: string;
    goldWire: string;
    cloudColor: string;
    waterWave: string;
    waterReflect: string;
    koiColor: string;
    vignetteColor: string;
  }
> = {
  qianli_green: {
    skyTop: "#01070d",
    skyMid: "#03141d",
    skyBottom: "#08222b",
    farMountain: ["#144e5f", "#0c323e", "#04171d"],
    midMountain: ["#1b686f", "#10464d", "#062227"],
    nearMountain: ["#23867d", "#145953", "#08292a"],
    shoreMountain: ["#2da093", "#1b6d65", "#0b3635"],
    goldGlint: "rgba(255, 238, 160, 0.98)",
    goldWire: "rgba(245, 210, 115, 0.90)",
    cloudColor: "rgba(160, 230, 240, 0.24)",
    waterWave: "rgba(185, 245, 250, 0.38)",
    waterReflect: "rgba(18, 65, 75, 0.45)",
    koiColor: "rgba(255, 195, 115, 0.80)",
    vignetteColor: "rgba(1, 4, 7, 0.85)",
  },
  jiangnan_ink: {
    skyTop: "#030509",
    skyMid: "#090e18",
    skyBottom: "#101928",
    farMountain: ["#1c2336", "#121825", "#080c13"],
    midMountain: ["#28344c", "#1a2335", "#0d121d"],
    nearMountain: ["#364767", "#243148", "#111824"],
    shoreMountain: ["#445a82", "#2d3e5c", "#162030"],
    goldGlint: "rgba(230, 245, 255, 0.98)",
    goldWire: "rgba(190, 220, 255, 0.80)",
    cloudColor: "rgba(180, 210, 245, 0.22)",
    waterWave: "rgba(200, 230, 255, 0.35)",
    waterReflect: "rgba(22, 34, 52, 0.38)",
    koiColor: "rgba(215, 235, 255, 0.55)",
    vignetteColor: "rgba(2, 3, 5, 0.85)",
  },
  tang_sunset: {
    skyTop: "#08010a",
    skyMid: "#18051c",
    skyBottom: "#290923",
    farMountain: ["#2a0c2b", "#1c071e", "#0e0210"],
    midMountain: ["#3e1239", "#2b0a28", "#160415"],
    nearMountain: ["#561849", "#3b0f33", "#1f061c"],
    shoreMountain: ["#6e205c", "#4c1341", "#280824"],
    goldGlint: "rgba(255, 230, 140, 0.98)",
    goldWire: "rgba(255, 195, 85, 0.90)",
    cloudColor: "rgba(240, 185, 205, 0.22)",
    waterWave: "rgba(255, 200, 165, 0.38)",
    waterReflect: "rgba(42, 14, 38, 0.40)",
    koiColor: "rgba(255, 165, 90, 0.65)",
    vignetteColor: "rgba(5, 1, 7, 0.85)",
  },
};

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
      const noise = (Math.random() - 0.5) * 18;
      d[i] = 128 + noise;
      d[i + 1] = 128 + noise;
      d[i + 2] = 128 + noise;
      d[i + 3] = 5;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

function dynamicShanShuiRidge(
  normX: number,
  layerIndex: number,
  time: number,
  energy: number,
  hScale: number
): number {
  if (layerIndex === 1) {
    const spire1 = Math.exp(-Math.pow((normX - 0.33 + Math.sin(time * 0.05) * 0.02) * 5.8, 2)) * (-0.17 * hScale);
    const subSpire1 = Math.exp(-Math.pow((normX - 0.42) * 9.0, 2)) * (-0.10 * hScale);
    const spire2 = Math.exp(-Math.pow((normX - 0.69 + Math.cos(time * 0.05) * 0.02) * 5.2, 2)) * (-0.15 * hScale);
    const subSpire2 = Math.exp(-Math.pow((normX - 0.60) * 8.5, 2)) * (-0.09 * hScale);
    const spire3 = Math.exp(-Math.pow((normX - 0.88) * 6.8, 2)) * (-0.12 * hScale);
    const rolling = Math.sin(normX * 4.0 + time * 0.10) * (0.028 * hScale);
    const microCrests = Math.sin(normX * 16.0 + 1.2) * (0.006 * hScale);
    const breath = Math.sin(time * 0.22) * (0.012 * hScale + energy * 0.018 * hScale);
    return spire1 + subSpire1 + spire2 + subSpire2 + spire3 + rolling + microCrests + breath;
  } else if (layerIndex === 2) {
    const peak1 = Math.exp(-Math.pow((normX - 0.22 + Math.sin(time * 0.07) * 0.02) * 5.2, 2)) * (-0.14 * hScale);
    const peak2 = Math.exp(-Math.pow((normX - 0.52 - Math.cos(time * 0.06) * 0.02) * 4.6, 2)) * (-0.15 * hScale);
    const peak3 = Math.exp(-Math.pow((normX - 0.80) * 5.8, 2)) * (-0.11 * hScale);
    const slope = Math.sin(normX * 4.8 - time * 0.15) * (0.025 * hScale);
    const microCrests = Math.sin(normX * 18.0 + 0.8) * (0.005 * hScale);
    const breath = Math.cos(time * 0.30 + normX * 3) * (0.015 * hScale + energy * 0.02 * hScale);
    return peak1 + peak2 + peak3 + slope + microCrests + breath;
  } else if (layerIndex === 3) {
    const cliff1 = Math.exp(-Math.pow((normX - 0.85 + Math.sin(time * 0.08) * 0.02) * 4.8, 2)) * (-0.11 * hScale);
    const cliff2 = Math.exp(-Math.pow((normX - 0.28) * 5.8, 2)) * (-0.09 * hScale);
    const cliff3 = Math.exp(-Math.pow((normX - 0.62) * 7.2, 2)) * (-0.08 * hScale);
    const shore = Math.sin(normX * 5.2 + time * 0.20) * (0.020 * hScale);
    const microCrests = Math.sin(normX * 20.0) * (0.004 * hScale);
    const breath = Math.sin(time * 0.38 + normX * 4) * (0.012 * hScale + energy * 0.018 * hScale);
    return cliff1 + cliff2 + cliff3 + shore + microCrests + breath;
  } else {
    const hummock1 = Math.exp(-Math.pow((normX - 0.14) * 6.5, 2)) * (-0.06 * hScale);
    const hummock2 = Math.exp(-Math.pow((normX - 0.72) * 5.5, 2)) * (-0.06 * hScale);
    const shoreWave = Math.sin(normX * 6.5 - time * 0.25) * (0.016 * hScale);
    const breath = Math.sin(time * 0.45 + normX * 5) * (0.008 * hScale + energy * 0.012 * hScale);
    return hummock1 + hummock2 + shoreWave + breath;
  }
}

export const CinematicOrientalInkEffect: EffectPlugin = {
  id: "cinematic_oriental_ink",
  name: "千里江山",
  category: "space",
  description: "专为纯音乐与古风打造：动态东方青绿水墨画卷、柔和空灵冷月与水底灵动游鱼系统",
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

    const mistRibbons: MistRibbon[] = [
      { x: width * 0.24, y: height * 0.54, rx: 360, ry: 48, baseAlpha: 0.18, speed: 0.07, phase: 0, driftY: 0 },
      { x: width * 0.70, y: height * 0.64, rx: 420, ry: 56, baseAlpha: 0.16, speed: 0.05, phase: 2.1, driftY: 0 },
      { x: width * 0.45, y: height * 0.74, rx: 490, ry: 64, baseAlpha: 0.20, speed: 0.08, phase: 4.3, driftY: 0 },
    ];

    const kois: SwimmingKoi[] = [
      {
        x: width * 0.36,
        y: height * 0.86,
        targetAngle: 0.1,
        angle: 0.1,
        baseSpeed: 20,
        currentSpeed: 20,
        length: 22,
        alpha: 0.70,
        swimPhase: 0,
        glideTimer: 0,
        trail: [],
      },
      {
        x: width * 0.68,
        y: height * 0.89,
        targetAngle: Math.PI + 0.2,
        angle: Math.PI + 0.2,
        baseSpeed: 16,
        currentSpeed: 16,
        length: 19,
        alpha: 0.60,
        swimPhase: 1.8,
        glideTimer: 1.5,
        trail: [],
      },
      {
        x: width * 0.20,
        y: height * 0.92,
        targetAngle: 0.3,
        angle: 0.3,
        baseSpeed: 14,
        currentSpeed: 14,
        length: 16,
        alpha: 0.55,
        swimPhase: 3.5,
        glideTimer: 3.0,
        trail: [],
      },
    ];

    const stars: StarNode[] = [];
    for (let i = 0; i < 48; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.50,
        baseAlpha: 0.15 + Math.random() * 0.45,
        size: 0.8 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const starSparkleSprite = createStarSparkle(56);
    const grainCanvas = createGrain();

    const state: CinematicInkState = {
      fireflies,
      mistRibbons,
      clouds: mistRibbons,
      ripples: [],
      kois,
      stars,
      crestEmbers: [],
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

    state.timeAccumulator += dt * (0.35 + state.smoothedMid * 0.30 * inkSpeedMult);
    state.breathTime += dt * 0.28;

    // 1. 苍穹夜色
    const skyGrd = ctx.createLinearGradient(0, 0, 0, height);
    skyGrd.addColorStop(0, colors.skyTop);
    skyGrd.addColorStop(0.50, colors.skyMid);
    skyGrd.addColorStop(1.0, colors.skyBottom);
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, width, height);

    // 2. 二十八宿微星连线
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    state.stars.forEach((st) => {
      const twinkle = Math.sin(state.timeAccumulator * 0.8 + st.phase) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(220, 240, 255, ${st.baseAlpha * twinkle * (0.6 + state.smoothedTreble * 0.4)})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = "rgba(180, 220, 245, 0.12)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < CONSTELLATION_NODES.length; i++) {
      const node = CONSTELLATION_NODES[i];
      const px = width * node.x;
      const py = height * node.y;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    CONSTELLATION_NODES.forEach((node) => {
      const px = width * node.x;
      const py = height * node.y;
      ctx.fillStyle = "rgba(235, 250, 255, 0.45)";
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 3. 极度柔和朦胧的空灵冷月
    const moonX = width * 0.16;
    const moonY = height * 0.18;
    const moonRadius = Math.min(width, height) * 0.052;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const outerBloom = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.4, moonX, moonY, moonRadius * 6.5);
    outerBloom.addColorStop(0, "rgba(215, 245, 255, 0.32)");
    outerBloom.addColorStop(0.35, "rgba(160, 220, 245, 0.14)");
    outerBloom.addColorStop(0.70, "rgba(90, 160, 200, 0.03)");
    outerBloom.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = outerBloom;
    ctx.globalAlpha = 0.85 + Math.sin(state.breathTime) * 0.10 + state.smoothedMid * 0.15;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 6.5, 0, Math.PI * 2);
    ctx.fill();

    const midCorona = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.2, moonX, moonY, moonRadius * 2.8);
    midCorona.addColorStop(0, "rgba(240, 252, 255, 0.80)");
    midCorona.addColorStop(0.40, "rgba(195, 235, 250, 0.42)");
    midCorona.addColorStop(0.80, "rgba(140, 205, 230, 0.08)");
    midCorona.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = midCorona;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 2.8, 0, Math.PI * 2);
    ctx.fill();

    const coreMoon = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonRadius * 1.15);
    coreMoon.addColorStop(0, "rgba(255, 255, 255, 0.98)");
    coreMoon.addColorStop(0.45, "rgba(245, 250, 255, 0.90)");
    coreMoon.addColorStop(0.80, "rgba(220, 242, 252, 0.45)");
    coreMoon.addColorStop(1.0, "rgba(180, 220, 245, 0.0)");
    ctx.fillStyle = coreMoon;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 1.15, 0, Math.PI * 2);
    ctx.fill();

    const cloudWisps = [
      { dy: -moonRadius * 0.25, w: moonRadius * 3.6, h: moonRadius * 0.42, rot: 0.04, speed: 0.18, phase: 0 },
      { dy: moonRadius * 0.20, w: moonRadius * 4.5, h: moonRadius * 0.48, rot: -0.03, speed: 0.24, phase: 1.8 },
    ];

    ctx.globalCompositeOperation = "source-over";
    cloudWisps.forEach((wisp) => {
      const cloudOffset = Math.sin(state.timeAccumulator * wisp.speed + wisp.phase) * (moonRadius * 0.6);
      const cx = moonX + cloudOffset;
      const cy = moonY + wisp.dy;

      const wispGrd = ctx.createLinearGradient(cx - wisp.w / 2, 0, cx + wisp.w / 2, 0);
      wispGrd.addColorStop(0, "rgba(0, 0, 0, 0)");
      wispGrd.addColorStop(0.3, colors.skyMid);
      wispGrd.addColorStop(0.5, "rgba(3, 16, 22, 0.75)");
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

    // 4. 动态宋代青绿画卷（四层重彩矿物青绿，气韵生动）
    const drawShanShui = (layerIndex: number, baseYRatio: number, colorStops: [string, string, string], goldWireAlpha: number) => {
      ctx.save();
      const baseY = height * baseYRatio;
      const mtnGrd = ctx.createLinearGradient(0, baseY - height * 0.22, 0, height + 80);
      mtnGrd.addColorStop(0, colorStops[0]);
      mtnGrd.addColorStop(0.35, colorStops[1]);
      mtnGrd.addColorStop(0.80, colorStops[2]);
      mtnGrd.addColorStop(1.0, "rgba(2, 6, 9, 0.98)");
      ctx.fillStyle = mtnGrd;

      ctx.beginPath();
      ctx.moveTo(0, height + 80);
      ctx.lineTo(0, baseY);

      const stepPx = 4;
      const totalSteps = Math.ceil(width / stepPx) + 1;
      const ridgePoints: { x: number; y: number }[] = [];

      for (let i = 0; i <= totalSteps; i++) {
        const curX = i * stepPx;
        const normX = curX / width;
        const hOffset = dynamicShanShuiRidge(normX, layerIndex, state.timeAccumulator, state.smoothedEnergy, height);
        const curY = baseY + hOffset;
        ridgePoints.push({ x: curX, y: curY });
        ctx.lineTo(curX, curY);
      }

      ctx.lineTo(width, height + 80);
      ctx.closePath();
      ctx.fill();


      if (goldWireAlpha > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.strokeStyle = colors.goldWire;
        ctx.lineWidth = 1.3 + state.smoothedTreble * 0.8;
        ctx.shadowColor = colors.goldGlint;
        ctx.shadowBlur = 8 + state.smoothedTreble * 10;

        const lightPulse = (Math.sin(state.timeAccumulator * 1.5 + layerIndex) + 1) * 0.5;
        ctx.globalAlpha = goldWireAlpha * (0.65 + state.smoothedTreble * 0.35 + lightPulse * 0.25);

        ctx.beginPath();
        for (let i = 0; i < ridgePoints.length; i++) {
          if (i === 0) ctx.moveTo(ridgePoints[i].x, ridgePoints[i].y);
          else ctx.lineTo(ridgePoints[i].x, ridgePoints[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    };

    drawShanShui(1, 0.60, colors.farMountain, 0.35);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    state.mistRibbons.forEach((mist) => {
      const cx = (mist.x + Math.sin(state.timeAccumulator * mist.speed + mist.phase) * 70) % (width + 320) - 160;
      const cy = mist.y + Math.sin(state.timeAccumulator * 0.4 + mist.phase) * 6;
      const cloudGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, mist.rx);
      cloudGrd.addColorStop(0, colors.cloudColor);
      cloudGrd.addColorStop(0.6, "rgba(8, 30, 36, 0.12)");
      cloudGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = cloudGrd;
      ctx.globalAlpha = mist.baseAlpha * (0.85 + Math.sin(state.breathTime) * 0.15 + state.smoothedMid * 0.20);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(mist.rx, mist.ry);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    drawShanShui(2, 0.72, colors.midMountain, 0.60);
    drawShanShui(3, 0.82, colors.nearMountain, 0.85);
    drawShanShui(4, 0.90, colors.shoreMountain, 0.70);

    // 5. 多重谐波水波、水月微澜与游弋锦鲤 (Pure Luminous Lake Caustics & Fish)
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // 水面月影微光垂注 (Subtle Lunar Water Column Reflection)
    const moonReflectGrd = ctx.createRadialGradient(moonX, height * 0.88, 5, moonX, height * 0.88, 140);
    moonReflectGrd.addColorStop(0, "rgba(200, 245, 255, 0.12)");
    moonReflectGrd.addColorStop(0.5, "rgba(160, 225, 245, 0.05)");
    moonReflectGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = moonReflectGrd;
    ctx.save();
    ctx.translate(moonX, height * 0.88);
    ctx.scale(1.0, 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (let w = 0; w < 4; w++) {
      const waveY = height * (0.84 + w * 0.035);
      const waveAlpha = (0.20 - w * 0.03) * (0.7 + state.smoothedMid * 0.35);
      ctx.strokeStyle = colors.waterWave;
      ctx.lineWidth = 1.0;
      ctx.globalAlpha = waveAlpha;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 14) {
        const harm1 = Math.sin(x * 0.012 + state.timeAccumulator * (0.32 + w * 0.10) + w) * 2.2;
        const harm2 = Math.sin(x * 0.026 - state.timeAccumulator * 0.22 + w * 1.5) * 1.1;
        const harm3 = Math.cos(x * 0.006 + state.timeAccumulator * 0.15) * 1.6;
        const totalOffset = harm1 + harm2 + harm3;
        if (x === 0) ctx.moveTo(x, waveY + totalOffset);
        else ctx.lineTo(x, waveY + totalOffset);
      }
      ctx.stroke();
    }

    for (let i = state.ripples.length - 1; i >= 0; i--) {
      const r = state.ripples[i];
      r.life += dt;
      r.x += r.driftVx * dt;
      r.y += r.driftVy * dt;
      const progress = Math.min(1.0, r.life / r.duration);

      if (progress >= 1.0) {
        state.ripples.splice(i, 1);
        continue;
      }

      const easedProgress = 1.0 - Math.pow(1.0 - progress, 2.6);
      const curRadius = Math.max(1, easedProgress * r.maxRadius);
      const curAlpha = Math.pow(1.0 - progress, 1.5) * r.alpha;

      ctx.save();
      ctx.shadowColor = "rgba(180, 245, 255, 0.75)";
      ctx.shadowBlur = 6;

      ctx.strokeStyle = "rgba(175, 245, 255, 0.85)";
      ctx.lineWidth = Math.max(0.7, 1.4 * (1.0 - progress * 0.5));
      ctx.globalAlpha = curAlpha * 0.75;
      ctx.translate(r.x, r.y);
      ctx.scale(curRadius, curRadius * 0.46);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.stroke();

      if (progress < 0.80) {
        ctx.shadowColor = "rgba(255, 220, 130, 0.60)";
        ctx.shadowBlur = 4;
        ctx.strokeStyle = "rgba(255, 230, 145, 0.80)";
        ctx.lineWidth = Math.max(0.5, 1.0 * (1.0 - progress));
        ctx.globalAlpha = curAlpha * 0.55;
        ctx.beginPath();
        ctx.arc(0, 0, 0.58, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    state.kois.forEach((koi) => {
      koi.glideTimer += dt * (1.2 + state.smoothedEnergy * 1.5);
      const strokePhase = Math.sin(koi.glideTimer);

      if (strokePhase > 0.2) {
        koi.currentSpeed += (koi.baseSpeed * (1.3 + state.smoothedEnergy * 0.8) - koi.currentSpeed) * (dt * 4.0);
        koi.swimPhase += dt * (4.5 + state.smoothedEnergy * 3.0);
      } else {
        koi.currentSpeed += (koi.baseSpeed * 0.65 - koi.currentSpeed) * (dt * 2.0);
        koi.swimPhase += dt * 1.8;
      }

      const turnDrift = Math.sin(state.timeAccumulator * 0.5 + koi.length) * 0.015;
      koi.targetAngle += turnDrift;
      koi.angle += (koi.targetAngle - koi.angle) * (dt * 2.5);

      koi.x += Math.cos(koi.angle) * koi.currentSpeed * dt;
      koi.y += Math.sin(koi.angle) * (koi.currentSpeed * 0.35) * dt;

      if (koi.x < -60) {
        koi.x = width + 50;
        koi.targetAngle = Math.PI + (Math.random() - 0.5) * 0.4;
        koi.angle = koi.targetAngle;
      }
      if (koi.x > width + 60) {
        koi.x = -50;
        koi.targetAngle = (Math.random() - 0.5) * 0.4;
        koi.angle = koi.targetAngle;
      }
      if (koi.y < height * 0.79) {
        koi.y = height * 0.80;
        koi.targetAngle += 0.3;
      }
      if (koi.y > height + 20) {
        koi.y = height * 0.83;
        koi.targetAngle -= 0.3;
      }

      koi.trail.unshift({ x: koi.x, y: koi.y, alpha: 0.65, size: (1.0 + strokePhase * 0.5) * 2.8 });
      if (koi.trail.length > 12) koi.trail.pop();

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      koi.trail.forEach((tr, tIdx) => {
        tr.alpha -= dt * 0.6;
        if (tr.alpha > 0) {
          ctx.fillStyle = `rgba(255, 215, 140, ${tr.alpha * 0.38})`;
          ctx.beginPath();
          ctx.arc(tr.x, tr.y, Math.max(0.5, tr.size * (1 - tIdx / 12)), 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();

      const wiggle1 = Math.sin(koi.swimPhase) * 3.8;
      const wiggle2 = Math.sin(koi.swimPhase - 0.8) * 6.2;
      const wiggle3 = Math.sin(koi.swimPhase - 1.6) * 8.5;

      ctx.save();
      ctx.translate(koi.x, koi.y);
      ctx.rotate(koi.angle);
      ctx.fillStyle = colors.koiColor;
      ctx.shadowColor = "rgba(255, 205, 120, 0.65)";
      ctx.shadowBlur = 6;
      ctx.globalAlpha = koi.alpha * (0.85 + state.smoothedMid * 0.3);

      ctx.beginPath();
      ctx.moveTo(koi.length * 0.55, 0);
      ctx.quadraticCurveTo(koi.length * 0.2, 4.2, 0, wiggle1 * 0.5);
      ctx.quadraticCurveTo(-koi.length * 0.4, wiggle1 + 3.0, -koi.length * 0.7, wiggle2);
      ctx.quadraticCurveTo(-koi.length * 0.95, wiggle3, -koi.length * 1.1, wiggle3 * 1.2);
      ctx.quadraticCurveTo(-koi.length * 0.7, wiggle2, -koi.length * 0.4, wiggle1 - 3.0);
      ctx.quadraticCurveTo(0, -wiggle1 * 0.5, koi.length * 0.2, -4.2);
      ctx.closePath();
      ctx.fill();

      const finWiggle = Math.cos(koi.swimPhase * 1.2) * 2.0;
      ctx.fillStyle = "rgba(255, 235, 175, 0.70)";
      ctx.beginPath();
      ctx.moveTo(koi.length * 0.15, 2);
      ctx.lineTo(koi.length * 0.05, 7 + finWiggle);
      ctx.lineTo(-koi.length * 0.1, 4);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(koi.length * 0.15, -2);
      ctx.lineTo(koi.length * 0.05, -7 - finWiggle);
      ctx.lineTo(-koi.length * 0.1, -4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    });

    ctx.restore();

    // 6. 空灵流萤与悬浮金箔微粒 (3D Depth-of-Field Bokeh & Gold Dust)
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
        ctx.fillStyle = `rgba(245, 205, 110, ${p.alpha})`;
      } else if (p.colorType === "moonlight") {
        ctx.fillStyle = `rgba(225, 245, 255, ${p.alpha * 0.9})`;
      } else {
        ctx.fillStyle = `rgba(230, 125, 95, ${p.alpha * 0.85})`;
      }

      ctx.beginPath();
      ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
      ctx.fill();

      if (p.z > 0.70 && p.alpha > 0.75 && state.starSparkleSprite) {
        ctx.globalCompositeOperation = "screen";
        const spSize = halfSize * 6 * (1.0 + state.smoothedTreble * 0.5);
        ctx.globalAlpha = p.alpha * 0.85;
        ctx.drawImage(state.starSparkleSprite, -spSize / 2, -spSize / 2, spSize, spSize);
      }
      ctx.restore();
    });
    ctx.restore();

    // 7. 宋画竖版典雅题跋诗词与朱砂篆刻 (Vertical Calligraphy Inscription on Right)
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
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textX = width - 56;
        const startY = height * 0.16;
        const charSpacing = 22;

        ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        ctx.shadowBlur = 12;

        const chars = currentPoem.line.split("");
        let curY = startY;
        ctx.fillStyle = `rgba(240, 235, 220, ${state.poemAlpha * 0.88})`;
        chars.forEach((ch) => {
          if (ch === "，" || ch === " " || ch === "、") {
            curY += charSpacing * 0.6;
          } else {
            ctx.fillText(ch, textX, curY);
            curY += charSpacing;
          }
        });

        ctx.font = '300 11px "Noto Serif SC", serif';
        ctx.fillStyle = `rgba(195, 185, 165, ${state.poemAlpha * 0.60})`;
        const authorX = textX - 22;
        let authorY = startY + 20;
        const authorChars = currentPoem.author.split("");
        authorChars.forEach((ch) => {
          if (ch === "·" || ch === " ") {
            authorY += 14;
          } else {
            ctx.fillText(ch, authorX, authorY);
            authorY += 16;
          }
        });

        const stampX = authorX;
        const stampY = authorY + 12;
        ctx.fillStyle = `rgba(215, 50, 42, ${state.poemAlpha * 0.85})`;
        ctx.fillRect(stampX - 7, stampY - 7, 14, 14);
        ctx.strokeStyle = `rgba(255, 210, 190, ${state.poemAlpha * 0.90})`;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(stampX - 7, stampY - 7, 14, 14);

        ctx.font = 'bold 8px "Noto Serif SC", serif';
        ctx.fillStyle = `rgba(255, 255, 255, ${state.poemAlpha * 0.95})`;
        ctx.fillText("墨", stampX, stampY);

        ctx.restore();
      }
    }

    // 8. 电影暗角与宣纸颗粒
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
      state.mistRibbons = [];
      state.clouds = [];
      state.ripples = [];
      state.kois = [];
      state.stars = [];
      state.crestEmbers = [];
      state.starSparkleSprite = null;
      state.grainCanvas = null;
      ctx.private.state = null;
    }
  },
};
