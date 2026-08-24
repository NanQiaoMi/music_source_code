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

export interface StarNode {
  x: number;
  y: number;
  baseAlpha: number;
  size: number;
  phase: number;
}

export interface CinematicInkState {
  fireflies: GoldFirefly[];
  clouds: CloudLayer[];
  ripples: LakeRipple[];
  kois: SwimmingKoi[];
  stars: StarNode[];
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
  { x: 0.72, y: 0.12 },
  { x: 0.76, y: 0.15 },
  { x: 0.81, y: 0.19 },
  { x: 0.84, y: 0.25 },
  { x: 0.89, y: 0.26 },
  { x: 0.92, y: 0.32 },
  { x: 0.87, y: 0.33 },
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
    lanternGlow: string;
    koiColor: string;
    vignetteColor: string;
  }
> = {
  qianli_green: {
    skyTop: "#01070d",
    skyMid: "#03141d",
    skyBottom: "#08222b",
    farMountain: ["#0e3844", "#09252e", "#041419"],
    midMountain: ["#165053", "#0f383c", "#061a1d"],
    nearMountain: ["#1c655d", "#124744", "#072021"],
    shoreMountain: ["#23776d", "#17524e", "#0a2a2b"],
    goldGlint: "rgba(255, 235, 150, 0.98)",
    goldWire: "rgba(240, 205, 110, 0.85)",
    cloudColor: "rgba(160, 220, 230, 0.18)",
    waterWave: "rgba(180, 240, 245, 0.35)",
    lanternGlow: "rgba(255, 210, 110, 0.95)",
    koiColor: "rgba(255, 190, 110, 0.60)",
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
    cloudColor: "rgba(180, 205, 240, 0.20)",
    waterWave: "rgba(200, 225, 255, 0.32)",
    lanternGlow: "rgba(255, 220, 130, 0.90)",
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
    cloudColor: "rgba(240, 180, 200, 0.20)",
    waterWave: "rgba(255, 195, 160, 0.36)",
    lanternGlow: "rgba(255, 190, 80, 0.95)",
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
      const noise = (Math.random() - 0.5) * 20;
      d[i] = 128 + noise;
      d[i + 1] = 128 + noise;
      d[i + 2] = 128 + noise;
      d[i + 3] = 6;
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
  energy: number
): number {
  if (layerIndex === 1) {
    const waveFlow = Math.sin(normX * 3.6 + time * 0.15) * 22;
    const spire1 = Math.exp(-Math.pow((normX - 0.28 + Math.sin(time * 0.08) * 0.03) * 4.5, 2)) * -190;
    const spire2 = Math.exp(-Math.pow((normX - 0.65 + Math.cos(time * 0.07) * 0.03) * 4.0, 2)) * -160;
    const spire3 = Math.exp(-Math.pow((normX - 0.86) * 6.0, 2)) * -110;
    const breath = Math.sin(time * 0.25) * (8 + energy * 15);
    return spire1 + spire2 + spire3 + waveFlow + breath;
  } else if (layerIndex === 2) {
    const waveFlow = Math.sin(normX * 4.6 - time * 0.22) * 28;
    const peak1 = Math.exp(-Math.pow((normX - 0.18 + Math.sin(time * 0.12) * 0.04) * 4.0, 2)) * -135;
    const peak2 = Math.exp(-Math.pow((normX - 0.50 - Math.cos(time * 0.10) * 0.04) * 3.5, 2)) * -145;
    const peak3 = Math.exp(-Math.pow((normX - 0.78) * 4.8, 2)) * -105;
    const breath = Math.cos(time * 0.35 + normX * 3) * (10 + energy * 20);
    return peak1 + peak2 + peak3 + waveFlow + breath;
  } else if (layerIndex === 3) {
    const waveFlow = Math.sin(normX * 5.2 + time * 0.30) * 32;
    const cliff = Math.exp(-Math.pow((normX - 0.82 + Math.sin(time * 0.15) * 0.03) * 3.8, 2)) * -100;
    const rock = Math.exp(-Math.pow((normX - 0.26) * 4.6, 2)) * -75;
    const breath = Math.sin(time * 0.45 + normX * 4) * (12 + energy * 24);
    return cliff + rock + waveFlow + breath;
  } else {
    const shoreWave = Math.sin(normX * 6.0 - time * 0.38) * 24;
    const hummock = Math.sin(normX * 3.2 + 1.5) * 20;
    const breath = Math.sin(time * 0.55 + normX * 5) * (8 + energy * 16);
    return shoreWave + hummock + breath;
  }
}

export const CinematicOrientalInkEffect: EffectPlugin = {
  id: "cinematic_oriental_ink",
  name: "千里江山 · 流光墨韵",
  category: "space",
  description: "专为纯音乐与古风打造：动态东方青绿水墨画卷、柔和空灵冷月、一叶轻舟渔火与水底灵动游鱼系统",
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
      { x: width * 0.22, y: height * 0.52, rx: 320, ry: 60, baseAlpha: 0.24, speed: 0.07, phase: 0 },
      { x: width * 0.68, y: height * 0.62, rx: 380, ry: 70, baseAlpha: 0.20, speed: 0.05, phase: 2.1 },
      { x: width * 0.40, y: height * 0.74, rx: 460, ry: 80, baseAlpha: 0.26, speed: 0.08, phase: 4.3 },
    ];

    const kois: SwimmingKoi[] = [
      { x: width * 0.42, y: height * 0.88, angle: 0.2, speed: 18, length: 22, alpha: 0.50, swimPhase: 0 },
      { x: width * 0.55, y: height * 0.92, angle: 3.3, speed: 14, length: 18, alpha: 0.45, swimPhase: 1.5 },
      { x: width * 0.28, y: height * 0.94, angle: 0.1, speed: 12, length: 16, alpha: 0.40, swimPhase: 3.0 },
    ];

    const stars: StarNode[] = [];
    for (let i = 0; i < 48; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.6,
        baseAlpha: 0.15 + Math.random() * 0.45,
        size: 0.8 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const starSparkleSprite = createStarSparkle(56);
    const grainCanvas = createGrain();

    const state: CinematicInkState = {
      fireflies,
      clouds,
      ripples: [],
      kois,
      stars,
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

    const outerBloom = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.5, moonX, moonY, moonRadius * 7.5);
    outerBloom.addColorStop(0, "rgba(200, 240, 255, 0.30)");
    outerBloom.addColorStop(0.35, "rgba(150, 215, 240, 0.12)");
    outerBloom.addColorStop(0.70, "rgba(90, 160, 200, 0.03)");
    outerBloom.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = outerBloom;
    ctx.globalAlpha = 0.85 + Math.sin(state.breathTime) * 0.10 + state.smoothedMid * 0.15;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 7.5, 0, Math.PI * 2);
    ctx.fill();

    const midCorona = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.3, moonX, moonY, moonRadius * 3.2);
    midCorona.addColorStop(0, "rgba(240, 252, 255, 0.75)");
    midCorona.addColorStop(0.40, "rgba(195, 235, 250, 0.40)");
    midCorona.addColorStop(0.80, "rgba(140, 205, 230, 0.08)");
    midCorona.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = midCorona;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 3.2, 0, Math.PI * 2);
    ctx.fill();

    const coreMoon = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonRadius * 1.2);
    coreMoon.addColorStop(0, "rgba(255, 255, 255, 0.98)");
    coreMoon.addColorStop(0.45, "rgba(245, 250, 255, 0.90)");
    coreMoon.addColorStop(0.80, "rgba(220, 242, 252, 0.45)");
    coreMoon.addColorStop(1.0, "rgba(180, 220, 245, 0.0)");
    ctx.fillStyle = coreMoon;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 1.2, 0, Math.PI * 2);
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

    // 4. 动态宋代青绿画卷（四层沉底铺满，彻底消除断层）
    const drawShanShui = (layerIndex: number, baseYRatio: number, colorStops: [string, string, string], goldWireAlpha: number) => {
      ctx.save();
      const baseY = height * baseYRatio;
      const mtnGrd = ctx.createLinearGradient(0, baseY - 200, 0, height + 80);
      mtnGrd.addColorStop(0, colorStops[0]);
      mtnGrd.addColorStop(0.40, colorStops[1]);
      mtnGrd.addColorStop(0.85, colorStops[2]);
      mtnGrd.addColorStop(1.0, "rgba(2, 6, 9, 0.98)");
      ctx.fillStyle = mtnGrd;

      ctx.beginPath();
      ctx.moveTo(0, height + 80);
      ctx.lineTo(0, baseY);

      const stepPx = 6;
      const totalSteps = Math.ceil(width / stepPx) + 1;
      const ridgePoints: { x: number; y: number }[] = [];

      for (let i = 0; i <= totalSteps; i++) {
        const curX = i * stepPx;
        const normX = curX / width;
        const hOffset = dynamicShanShuiRidge(normX, layerIndex, state.timeAccumulator, state.smoothedEnergy);
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

    drawShanShui(1, 0.54, colors.farMountain, 0.35);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    state.clouds.forEach((cloud) => {
      const cx = (cloud.x + Math.sin(state.timeAccumulator * cloud.speed + cloud.phase) * 70) % (width + 320) - 160;
      const cloudGrd = ctx.createRadialGradient(cx, cloud.y, 0, cx, cloud.y, cloud.rx);
      cloudGrd.addColorStop(0, colors.cloudColor);
      cloudGrd.addColorStop(0.6, "rgba(8, 30, 36, 0.12)");
      cloudGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = cloudGrd;
      ctx.globalAlpha = cloud.baseAlpha * (0.85 + Math.sin(state.breathTime) * 0.15);
      ctx.save();
      ctx.translate(cx, cloud.y);
      ctx.scale(cloud.rx, cloud.ry);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    drawShanShui(2, 0.68, colors.midMountain, 0.60);
    drawShanShui(3, 0.80, colors.nearMountain, 0.85);
    drawShanShui(4, 0.90, colors.shoreMountain, 0.70);

    // 5. 水面微波、钓翁扁舟与锦鲤
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let w = 0; w < 4; w++) {
      const waveY = height * (0.84 + w * 0.04);
      const waveAlpha = (0.20 - w * 0.03) * (0.7 + state.smoothedMid * 0.35);
      ctx.strokeStyle = colors.waterWave;
      ctx.lineWidth = 1.1;
      ctx.globalAlpha = waveAlpha;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 18) {
        const sinOffset = Math.sin(x * 0.015 + state.timeAccumulator * (0.35 + w * 0.12) + w) * 2.5;
        if (x === 0) ctx.moveTo(x, waveY + sinOffset);
        else ctx.lineTo(x, waveY + sinOffset);
      }
      ctx.stroke();
    }

    state.kois.forEach((koi) => {
      koi.swimPhase += dt * 3.5;
      koi.x += Math.cos(koi.angle) * koi.speed * dt;
      koi.y += Math.sin(koi.angle) * (koi.speed * 0.3) * dt;

      if (koi.x < -40) koi.x = width + 40;
      if (koi.x > width + 40) koi.x = -40;
      if (koi.y < height * 0.82) koi.y = height - 20;
      if (koi.y > height + 20) koi.y = height * 0.85;

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

    const boatX = width * 0.28;
    const boatBobbing = Math.sin(state.timeAccumulator * 0.65) * 3.0;
    const boatY = height * 0.88 + boatBobbing;

    ctx.save();
    ctx.translate(boatX, boatY);
    ctx.rotate(Math.sin(state.timeAccumulator * 0.65) * 0.025);

    ctx.fillStyle = "rgba(4, 10, 12, 0.98)";
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.quadraticCurveTo(-10, 7, 0, 8);
    ctx.quadraticCurveTo(14, 7, 24, 0);
    ctx.quadraticCurveTo(10, 3, 0, 3);
    ctx.quadraticCurveTo(-10, 3, -22, 0);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-2, 0, 7, Math.PI, 0, false);
    ctx.fill();

    ctx.strokeStyle = "rgba(200, 220, 210, 0.65)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(-26, -14, -36, -20);
    ctx.stroke();

    ctx.strokeStyle = "rgba(220, 240, 255, 0.25)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-36, -20);
    ctx.lineTo(-36, 12);
    ctx.stroke();

    ctx.globalCompositeOperation = "screen";
    const lanternX = 14;
    const lanternY = -4;
    const lanternGrd = ctx.createRadialGradient(lanternX, lanternY, 0, lanternX, lanternY, 26);
    lanternGrd.addColorStop(0, "rgba(255, 248, 200, 1.0)");
    lanternGrd.addColorStop(0.25, colors.lanternGlow);
    lanternGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = lanternGrd;
    ctx.beginPath();
    ctx.arc(lanternX, lanternY, 26, 0, Math.PI * 2);
    ctx.fill();

    const reflectGrd = ctx.createRadialGradient(lanternX, 10, 0, lanternX, 10, 18);
    reflectGrd.addColorStop(0, "rgba(255, 215, 130, 0.50)");
    reflectGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = reflectGrd;
    ctx.save();
    ctx.translate(lanternX, 10);
    ctx.scale(18, 5.0);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
    ctx.restore();

    // 6. 空灵流萤
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

    // 7. 诗词呼吸层
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
      state.clouds = [];
      state.ripples = [];
      state.kois = [];
      state.stars = [];
      state.starSparkleSprite = null;
      state.grainCanvas = null;
      ctx.private.state = null;
    }
  },
};
