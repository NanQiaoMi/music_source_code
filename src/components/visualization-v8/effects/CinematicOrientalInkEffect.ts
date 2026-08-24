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

export interface LakeWaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

export interface CloudPuff {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  baseAlpha: number;
  speed: number;
  phase: number;
}

export interface CinematicInkState {
  fireflies: GoldFirefly[];
  clouds: CloudPuff[];
  ripples: LakeWaveRing[];
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
  moonHaloSprite: HTMLCanvasElement | null;
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
    moonColor: string;
    farMountain: [string, string, string];
    midMountain: [string, string, string];
    nearMountain: [string, string, string];
    goldGlint: string;
    goldWire: string;
    cloudColor: string;
    waterColor: string;
    waterWave: string;
    lanternGlow: string;
    vignetteColor: string;
  }
> = {
  qianli_green: {
    skyTop: "#010709",
    skyMid: "#041419",
    skyBottom: "#092227",
    moonColor: "rgba(240, 248, 255, 0.95)",
    farMountain: ["#07161b", "#051115", "#02080a"],
    midMountain: ["#0a262a", "#071c1f", "#030d0f"],
    nearMountain: ["#0e3233", "#082121", "#030e0f"],
    goldGlint: "rgba(255, 235, 170, 0.95)",
    goldWire: "rgba(235, 195, 110, 0.70)",
    cloudColor: "rgba(12, 45, 48, 0.30)",
    waterColor: "rgba(3, 12, 15, 0.96)",
    waterWave: "rgba(220, 245, 240, 0.35)",
    lanternGlow: "rgba(255, 200, 100, 0.85)",
    vignetteColor: "rgba(1, 4, 5, 0.88)",
  },
  jiangnan_ink: {
    skyTop: "#020305",
    skyMid: "#080a10",
    skyBottom: "#111520",
    moonColor: "rgba(245, 248, 255, 0.95)",
    farMountain: ["#0f121a", "#0a0c12", "#050609"],
    midMountain: ["#161b26", "#0f131c", "#07090e"],
    nearMountain: ["#1e2535", "#131824", "#090c13"],
    goldGlint: "rgba(220, 238, 255, 0.95)",
    goldWire: "rgba(175, 205, 245, 0.65)",
    cloudColor: "rgba(25, 32, 48, 0.32)",
    waterColor: "rgba(5, 7, 11, 0.96)",
    waterWave: "rgba(195, 220, 255, 0.30)",
    lanternGlow: "rgba(255, 215, 130, 0.85)",
    vignetteColor: "rgba(1, 2, 4, 0.88)",
  },
  tang_sunset: {
    skyTop: "#08020a",
    skyMid: "#18061c",
    skyBottom: "#290924",
    moonColor: "rgba(255, 240, 225, 0.95)",
    farMountain: ["#18061a", "#100312", "#070108"],
    midMountain: ["#280a29", "#1a041c", "#0d010e"],
    nearMountain: ["#3d1037", "#260624", "#120211"],
    goldGlint: "rgba(255, 220, 140, 0.98)",
    goldWire: "rgba(250, 180, 75, 0.75)",
    cloudColor: "rgba(58, 16, 44, 0.35)",
    waterColor: "rgba(12, 3, 14, 0.96)",
    waterWave: "rgba(255, 190, 140, 0.40)",
    lanternGlow: "rgba(255, 180, 80, 0.90)",
    vignetteColor: "rgba(5, 1, 7, 0.88)",
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

function createMoonHalo(size: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const c = size / 2;
    const grd = ctx.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    grd.addColorStop(0.12, "rgba(240, 248, 255, 0.75)");
    grd.addColorStop(0.35, "rgba(210, 235, 245, 0.25)");
    grd.addColorStop(0.70, "rgba(160, 205, 225, 0.06)");
    grd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
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
      const noise = (Math.random() - 0.5) * 30;
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
    const peak1 = Math.exp(-Math.pow((normX - 0.28) * 6, 2)) * -140;
    const peak2 = Math.exp(-Math.pow((normX - 0.65) * 5, 2)) * -110;
    const peak3 = Math.exp(-Math.pow((normX - 0.88) * 8, 2)) * -75;
    const baseWave = Math.sin(normX * 4.2 + 0.5) * 30;
    return peak1 + peak2 + peak3 + baseWave;
  } else if (layerIndex === 2) {
    const peak1 = Math.exp(-Math.pow((normX - 0.18) * 5, 2)) * -85;
    const peak2 = Math.exp(-Math.pow((normX - 0.52) * 4, 2)) * -95;
    const slope = Math.sin(normX * 5.5 + 1.2) * 35;
    const slowBreathe = Math.sin(time * 0.15 + normX * 2) * 6;
    return peak1 + peak2 + slope + slowBreathe;
  } else {
    const cliff = Math.exp(-Math.pow((normX - 0.82) * 4, 2)) * -60;
    const shore = Math.sin(normX * 3.8 + 2.0) * 25;
    return cliff + shore;
  }
}

export const CinematicOrientalInkEffect: EffectPlugin = {
  id: "cinematic_oriental_ink",
  name: "千里江山 · 流光墨韵",
  category: "space",
  description: "专为纯音乐与古风打造：东方青绿水墨画卷、清幽冷月月华、一叶轻舟渔火与空灵流萤系统",
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
        vx: (Math.random() - 0.5) * 0.2 * z,
        vy: -0.12 - Math.random() * 0.25 * z,
        size: (1.2 + Math.random() * 2.8) * z,
        baseAlpha: 0.2 + Math.random() * 0.65,
        alpha: 0.5,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.4 + Math.random() * 1.2,
        orbitRadius: 15 + Math.random() * 40,
        orbitSpeed: 0.2 + Math.random() * 0.5,
        colorType: Math.random() > 0.35 ? "gold" : Math.random() > 0.5 ? "moonlight" : "cinnabar",
      });
    }

    const clouds: CloudPuff[] = [
      { x: width * 0.2, y: height * 0.46, radiusX: 280, radiusY: 55, baseAlpha: 0.28, speed: 0.08, phase: 0 },
      { x: width * 0.65, y: height * 0.52, radiusX: 340, radiusY: 65, baseAlpha: 0.22, speed: 0.06, phase: 2.1 },
      { x: width * 0.4, y: height * 0.68, radiusX: 420, radiusY: 75, baseAlpha: 0.30, speed: 0.09, phase: 4.3 },
    ];

    const starSparkleSprite = createStarSparkle(56);
    const moonHaloSprite = createMoonHalo(384);
    const grainCanvas = createGrain();

    const state: CinematicInkState = {
      fireflies,
      clouds,
      ripples: [],
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
      moonHaloSprite,
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

    state.timeAccumulator += dt * (0.4 + state.smoothedMid * 0.3 * inkSpeedMult);
    state.breathTime += dt * 0.3;

    // 1. 苍穹夜色
    const skyGrd = ctx.createLinearGradient(0, 0, 0, height);
    skyGrd.addColorStop(0, colors.skyTop);
    skyGrd.addColorStop(0.5, colors.skyMid);
    skyGrd.addColorStop(1.0, colors.skyBottom);
    ctx.fillStyle = skyGrd;
    ctx.fillRect(0, 0, width, height);

    // 2. 清幽冷月与月华晕轮
    const moonX = width * 0.16;
    const moonY = height * 0.22;
    const moonRadius = Math.min(width, height) * 0.055;

    ctx.save();
    if (state.moonHaloSprite) {
      ctx.globalCompositeOperation = "screen";
      const haloSize = moonRadius * 8.5 * (1.0 + state.smoothedEnergy * 0.15);
      ctx.globalAlpha = 0.65 + Math.sin(state.breathTime) * 0.08 + state.smoothedMid * 0.2;
      ctx.drawImage(state.moonHaloSprite, moonX - haloSize / 2, moonY - haloSize / 2, haloSize, haloSize);
    }

    ctx.globalCompositeOperation = "source-over";
    const moonDiscGrd = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.3, moonX, moonY, moonRadius);
    moonDiscGrd.addColorStop(0, colors.moonColor);
    moonDiscGrd.addColorStop(0.85, "rgba(240, 248, 255, 0.90)");
    moonDiscGrd.addColorStop(1.0, "rgba(220, 235, 245, 0.0)");
    ctx.fillStyle = moonDiscGrd;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
    ctx.fill();

    const cloudGrd = ctx.createLinearGradient(moonX - moonRadius * 1.5, 0, moonX + moonRadius * 1.5, 0);
    cloudGrd.addColorStop(0, "rgba(0, 0, 0, 0)");
    cloudGrd.addColorStop(0.5, colors.skyMid);
    cloudGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = cloudGrd;
    ctx.save();
    ctx.translate(moonX + Math.sin(state.timeAccumulator * 0.2) * 20, moonY + moonRadius * 0.2);
    ctx.rotate(0.05);
    ctx.scale(moonRadius * 1.6, moonRadius * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    // 3. 实心山水画卷
    const drawShanShui = (layerIndex: number, baseYRatio: number, colorStops: [string, string, string], goldWireAlpha: number) => {
      ctx.save();
      const baseY = height * baseYRatio;
      const mtnGrd = ctx.createLinearGradient(0, baseY - 160, 0, height);
      mtnGrd.addColorStop(0, colorStops[0]);
      mtnGrd.addColorStop(0.5, colorStops[1]);
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
        ctx.lineWidth = 1.2 + state.smoothedTreble * 0.8;
        ctx.shadowColor = colors.goldGlint;
        ctx.shadowBlur = 6 + state.smoothedTreble * 10;
        ctx.globalAlpha = goldWireAlpha * (0.60 + state.smoothedTreble * 0.40);

        ctx.beginPath();
        for (let i = 0; i < ridgePoints.length; i++) {
          if (i === 0) ctx.moveTo(ridgePoints[i].x, ridgePoints[i].y);
          else ctx.lineTo(ridgePoints[i].x, ridgePoints[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      const mistY = baseY - 30;
      const mistGrd = ctx.createLinearGradient(0, mistY, 0, mistY + 110);
      mistGrd.addColorStop(0, "rgba(0, 0, 0, 0)");
      mistGrd.addColorStop(0.45, colors.cloudColor);
      mistGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = mistGrd;
      ctx.fillRect(0, mistY, width, 110);
      ctx.restore();

      ctx.restore();
    };

    drawShanShui(1, 0.46, colors.farMountain, 0.30);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    state.clouds.forEach((cloud) => {
      const cx = (cloud.x + Math.sin(state.timeAccumulator * cloud.speed + cloud.phase) * 60) % (width + 300) - 150;
      const cloudGrd = ctx.createRadialGradient(cx, cloud.y, 0, cx, cloud.y, cloud.radiusX);
      cloudGrd.addColorStop(0, colors.cloudColor);
      cloudGrd.addColorStop(0.6, "rgba(10, 35, 38, 0.15)");
      cloudGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = cloudGrd;
      ctx.globalAlpha = cloud.baseAlpha * (0.8 + Math.sin(state.breathTime) * 0.2);
      ctx.save();
      ctx.translate(cx, cloud.y);
      ctx.scale(cloud.radiusX, cloud.radiusY);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    drawShanShui(2, 0.62, colors.midMountain, 0.55);
    drawShanShui(3, 0.78, colors.nearMountain, 0.80);

    // 4. 清潭、扁舟与渔火
    const lakeY = height * 0.82;
    ctx.save();
    const lakeGrd = ctx.createLinearGradient(0, lakeY, 0, height);
    lakeGrd.addColorStop(0, "rgba(3, 10, 14, 0.6)");
    lakeGrd.addColorStop(1.0, colors.waterColor);
    ctx.fillStyle = lakeGrd;
    ctx.fillRect(0, lakeY, width, height - lakeY);

    ctx.globalCompositeOperation = "screen";
    for (let w = 0; w < 3; w++) {
      const waveY = lakeY + (height - lakeY) * ((w + 1) / 4);
      const waveAlpha = (0.18 - w * 0.04) * (0.7 + state.smoothedMid * 0.4);
      ctx.strokeStyle = colors.waterWave;
      ctx.lineWidth = 1.0;
      ctx.globalAlpha = waveAlpha;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 20) {
        const sinOffset = Math.sin(x * 0.01 + state.timeAccumulator * (0.3 + w * 0.1) + w) * 2.5;
        if (x === 0) ctx.moveTo(x, waveY + sinOffset);
        else ctx.lineTo(x, waveY + sinOffset);
      }
      ctx.stroke();
    }

    const boatX = width * 0.32;
    const boatBobbing = Math.sin(state.timeAccumulator * 0.6) * 3;
    const boatY = height * 0.86 + boatBobbing;

    ctx.save();
    ctx.translate(boatX, boatY);
    ctx.rotate(Math.sin(state.timeAccumulator * 0.6) * 0.02);

    ctx.fillStyle = "rgba(4, 8, 10, 0.95)";
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

    ctx.globalCompositeOperation = "screen";
    const lanternX = 14;
    const lanternY = -4;
    const lanternGrd = ctx.createRadialGradient(lanternX, lanternY, 0, lanternX, lanternY, 24);
    lanternGrd.addColorStop(0, "rgba(255, 240, 180, 0.95)");
    lanternGrd.addColorStop(0.25, colors.lanternGlow);
    lanternGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = lanternGrd;
    ctx.beginPath();
    ctx.arc(lanternX, lanternY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    // 5. 空灵流萤
    ctx.save();
    const trebleBoost = state.smoothedTreble * 1.2;
    state.fireflies.forEach((p) => {
      p.phase += dt * p.phaseSpeed;
      const hoverX = Math.sin(p.phase) * p.orbitRadius;
      const hoverY = Math.cos(p.phase * 0.7) * (p.orbitRadius * 0.4);

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

      if (p.z > 0.7 && p.alpha > 0.75 && state.starSparkleSprite) {
        ctx.globalCompositeOperation = "screen";
        const spSize = halfSize * 7 * (1.0 + state.smoothedTreble * 0.6);
        ctx.globalAlpha = p.alpha * 0.85;
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
      ctx.globalAlpha = filmVignette * (0.85 + Math.sin(state.breathTime) * 0.04);
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
      state.starSparkleSprite = null;
      state.moonHaloSprite = null;
      state.grainCanvas = null;
      ctx.private.state = null;
    }
  },
};
