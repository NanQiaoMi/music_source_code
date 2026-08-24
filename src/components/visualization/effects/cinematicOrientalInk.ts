/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectContext } from "./types";

// =========================================================================
// 1. Types & Data Structures
// =========================================================================

interface GoldFirefly {
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

interface LakeRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

interface MistRibbon {
  x: number;
  y: number;
  rx: number;
  ry: number;
  baseAlpha: number;
  speed: number;
  phase: number;
  driftY: number;
}

interface SwimmingKoi {
  x: number;
  y: number;
  angle: number;
  speed: number;
  length: number;
  alpha: number;
  swimPhase: number;
  trail: { x: number; y: number; alpha: number }[];
}

interface StarNode {
  x: number;
  y: number;
  baseAlpha: number;
  size: number;
  phase: number;
}

interface CrestEmber {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
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

const COLOR_SCHEMES = [
  {
    // 0: 【青绿千山 · 幽谷月华】(宋代王希孟青绿设色，重彩矿物石青石绿，层峦叠翠)
    skyTop: "#01070d",
    skyMid: "#03141d",
    skyBottom: "#08222b",
    farMountain: ["#124856", "#0c323d", "#061c22"],
    midMountain: ["#1a6064", "#114448", "#082225"],
    nearMountain: ["#22786e", "#16554f", "#0a2a29"],
    shoreMountain: ["#2b8f82", "#1d665f", "#0d3634"],
    goldGlint: "rgba(255, 235, 150, 0.98)",
    goldWire: "rgba(240, 205, 110, 0.88)",
    cloudColor: "rgba(160, 220, 230, 0.18)",
    waterWave: "rgba(180, 240, 245, 0.35)",
    waterReflect: "rgba(14, 52, 60, 0.40)",
    lanternGlow: "rgba(255, 210, 110, 0.95)",
    koiColor: "rgba(255, 190, 110, 0.65)",
    vignetteColor: "rgba(1, 4, 7, 0.85)",
  },
  {
    // 1: 【烟雨水墨 · 孤舟晚渡】(江南徽派水墨，空灵幽邃)
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
    waterReflect: "rgba(22, 34, 52, 0.38)",
    lanternGlow: "rgba(255, 220, 130, 0.90)",
    koiColor: "rgba(215, 235, 255, 0.55)",
    vignetteColor: "rgba(2, 3, 5, 0.85)",
  },
  {
    // 2: 【暮霞沉香 · 金碧流丹】(盛唐沉香朱砂，典雅华贵)
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
    waterReflect: "rgba(42, 14, 38, 0.40)",
    lanternGlow: "rgba(255, 190, 80, 0.95)",
    koiColor: "rgba(255, 165, 90, 0.65)",
    vignetteColor: "rgba(5, 1, 7, 0.85)",
  },
];

// 复用对象池 (0 GC)
let firefliesPool: GoldFirefly[] | null = null;
let mistRibbonsPool: MistRibbon[] | null = null;
let ripplesPool: LakeRipple[] = [];
let koisPool: SwimmingKoi[] | null = null;
let starsPool: StarNode[] | null = null;
let crestEmbers: CrestEmber[] = [];
let starSparkleSprite: HTMLCanvasElement | null = null;
let grainCanvas: HTMLCanvasElement | null = null;

// 声学双阶平滑滤波器
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;
let smoothEnergy = 0;
let breathTime = 0;
let timeAccum = 0;
let lastTimestamp = 0;

// 意境诗词
let poemTimer = 0;
let poemIndex = 0;
let poemAlpha = 0;
let lastTransientPeak = 0;

// =========================================================================
// 2. High-Performance Sprites
// =========================================================================

function createStarSparkleSprite(size: number): HTMLCanvasElement | null {
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

function createFilmGrainTexture(): HTMLCanvasElement | null {
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

// 宋代《千里江山》式秀美雄奇山脊高度函数（克制而典雅）
function dynamicShanShuiRidge(
  normX: number,
  layerIndex: number,
  time: number,
  energy: number,
  hScale: number
): number {
  if (layerIndex === 1) {
    // 远岫：秀美雄奇，远峰挺拔，克制在 0.17*height
    const spire1 = Math.exp(-Math.pow((normX - 0.32 + Math.sin(time * 0.05) * 0.02) * 6.0, 2)) * (-0.17 * hScale);
    const subSpire1 = Math.exp(-Math.pow((normX - 0.40) * 9.5, 2)) * (-0.10 * hScale);
    const spire2 = Math.exp(-Math.pow((normX - 0.68 + Math.cos(time * 0.05) * 0.02) * 5.2, 2)) * (-0.15 * hScale);
    const subSpire2 = Math.exp(-Math.pow((normX - 0.58) * 8.5, 2)) * (-0.09 * hScale);
    const spire3 = Math.exp(-Math.pow((normX - 0.88) * 7.0, 2)) * (-0.12 * hScale);
    const rolling = Math.sin(normX * 4.0 + time * 0.10) * (0.03 * hScale);
    const microCrests = Math.sin(normX * 14.0 + 1.2) * (0.008 * hScale);
    const breath = Math.sin(time * 0.22) * (0.012 * hScale + energy * 0.018 * hScale);
    return spire1 + subSpire1 + spire2 + subSpire2 + spire3 + rolling + microCrests + breath;
  } else if (layerIndex === 2) {
    // 中山：层峦叠嶂，起伏适中
    const peak1 = Math.exp(-Math.pow((normX - 0.20 + Math.sin(time * 0.07) * 0.02) * 5.5, 2)) * (-0.14 * hScale);
    const peak2 = Math.exp(-Math.pow((normX - 0.50 - Math.cos(time * 0.06) * 0.02) * 4.8, 2)) * (-0.15 * hScale);
    const peak3 = Math.exp(-Math.pow((normX - 0.78) * 6.0, 2)) * (-0.11 * hScale);
    const slope = Math.sin(normX * 4.8 - time * 0.15) * (0.028 * hScale);
    const microCrests = Math.sin(normX * 16.0 + 0.8) * (0.007 * hScale);
    const breath = Math.cos(time * 0.30 + normX * 3) * (0.015 * hScale + energy * 0.02 * hScale);
    return peak1 + peak2 + peak3 + slope + microCrests + breath;
  } else if (layerIndex === 3) {
    // 近山：临水险峰、岩矶古岸
    const cliff1 = Math.exp(-Math.pow((normX - 0.84 + Math.sin(time * 0.08) * 0.02) * 5.0, 2)) * (-0.11 * hScale);
    const cliff2 = Math.exp(-Math.pow((normX - 0.26) * 6.0, 2)) * (-0.09 * hScale);
    const cliff3 = Math.exp(-Math.pow((normX - 0.60) * 7.5, 2)) * (-0.08 * hScale);
    const shore = Math.sin(normX * 5.2 + time * 0.20) * (0.022 * hScale);
    const microCrests = Math.sin(normX * 18.0) * (0.005 * hScale);
    const breath = Math.sin(time * 0.38 + normX * 4) * (0.012 * hScale + energy * 0.018 * hScale);
    return cliff1 + cliff2 + cliff3 + shore + microCrests + breath;
  } else {
    // 前景芳渚：临江秀渚
    const hummock1 = Math.exp(-Math.pow((normX - 0.14) * 6.5, 2)) * (-0.06 * hScale);
    const hummock2 = Math.exp(-Math.pow((normX - 0.72) * 5.5, 2)) * (-0.06 * hScale);
    const shoreWave = Math.sin(normX * 6.5 - time * 0.25) * (0.018 * hScale);
    const breath = Math.sin(time * 0.45 + normX * 5) * (0.008 * hScale + energy * 0.012 * hScale);
    return hummock1 + hummock2 + shoreWave + breath;
  }
}

// =========================================================================
// 3. Master Render Entry
// =========================================================================

export function drawCinematicOrientalInk(context: EffectContext): void {
  const { ctx, width, height, data, time, params } = context;
  if (!ctx || width <= 0 || height <= 0) return;

  const dt = lastTimestamp ? Math.min((time - lastTimestamp) / 1000, 0.05) : 0.016;
  lastTimestamp = time;

  // 1. 参数解构
  const targetParticleCount = typeof params?.particleCount === "number" ? Math.round(params.particleCount) : 450;
  const inkSpeedMult = typeof params?.inkFlowSpeed === "number" ? params.inkFlowSpeed : 1.0;
  const showPoetry = params?.showPoetry !== false && params?.showPoetry !== 0;
  const filmVignette = typeof params?.filmVignette === "number" ? params.filmVignette : 0.65;
  const schemeIndex = typeof params?.colorScheme === "number" ? Math.max(0, Math.min(COLOR_SCHEMES.length - 1, params.colorScheme)) : 0;
  const colors = COLOR_SCHEMES[schemeIndex] || COLOR_SCHEMES[0];

  // 2. 声学平滑（双阶长余韵包络器）
  let rawBass = 0;
  let rawMid = 0;
  let rawTreble = 0;
  let rawEnergy = 0;

  if (data && data.length >= 32) {
    let bSum = 0;
    for (let i = 1; i <= 5; i++) bSum += data[i] || 0;
    rawBass = bSum / (5 * 255);

    let mSum = 0;
    for (let i = 6; i <= 24; i++) mSum += data[i] || 0;
    rawMid = mSum / (19 * 255);

    let tSum = 0;
    for (let i = 25; i <= 64; i++) tSum += data[i] || 0;
    rawTreble = tSum / (40 * 255);

    rawEnergy = rawBass * 0.4 + rawMid * 0.4 + rawTreble * 0.2;
  }

  const attack = 0.05;
  const decay = 0.025;
  smoothBass += (rawBass - smoothBass) * (rawBass > smoothBass ? attack : decay);
  smoothMid += (rawMid - smoothMid) * (rawMid > smoothMid ? attack : decay);
  smoothTreble += (rawTreble - smoothTreble) * (rawTreble > smoothTreble ? attack : decay);
  smoothEnergy += (rawEnergy - smoothEnergy) * (rawEnergy > smoothEnergy ? attack : decay);

  timeAccum += dt * (0.35 + smoothMid * 0.30 * inkSpeedMult);
  breathTime += dt * 0.28;

  // 泛音清潭涟漪与山脊金屑生成
  if (rawTreble > 0.40 && time - lastTransientPeak > 500) {
    lastTransientPeak = time;
    if (ripplesPool.length < 6) {
      ripplesPool.push({
        x: width * 0.18 + Math.random() * width * 0.60,
        y: height * 0.86 + Math.random() * height * 0.10,
        radius: 3,
        maxRadius: 50 + Math.random() * 70,
        alpha: 0.65,
        speed: 24 + Math.random() * 18,
      });
    }

    // 山脊升腾金屑
    if (crestEmbers.length < 24) {
      for (let k = 0; k < 3; k++) {
        crestEmbers.push({
          x: width * (0.2 + Math.random() * 0.6),
          y: height * (0.55 + Math.random() * 0.15),
          vx: (Math.random() - 0.5) * 12,
          vy: -15 - Math.random() * 25,
          size: 1.2 + Math.random() * 1.8,
          alpha: 0.85,
          life: 0,
          maxLife: 1.8 + Math.random() * 1.2,
        });
      }
    }
  }

  // 3. 资源初始化
  if (!starSparkleSprite) starSparkleSprite = createStarSparkleSprite(56);
  if (!grainCanvas) grainCanvas = createFilmGrainTexture();

  if (!starsPool) {
    starsPool = [];
    for (let i = 0; i < 48; i++) {
      starsPool.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.50,
        baseAlpha: 0.15 + Math.random() * 0.45,
        size: 0.8 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  if (!firefliesPool || firefliesPool.length !== targetParticleCount) {
    firefliesPool = [];
    for (let i = 0; i < targetParticleCount; i++) {
      const z = 0.15 + Math.random() * 0.85;
      const x = Math.random() * width;
      const y = Math.random() * height;
      firefliesPool.push({
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
  }

  if (!mistRibbonsPool) {
    mistRibbonsPool = [
      { x: width * 0.24, y: height * 0.54, rx: 360, ry: 48, baseAlpha: 0.18, speed: 0.07, phase: 0, driftY: 0 },
      { x: width * 0.70, y: height * 0.64, rx: 420, ry: 56, baseAlpha: 0.16, speed: 0.05, phase: 2.1, driftY: 0 },
      { x: width * 0.45, y: height * 0.74, rx: 490, ry: 64, baseAlpha: 0.20, speed: 0.08, phase: 4.3, driftY: 0 },
    ];
  }

  if (!koisPool) {
    koisPool = [
      { x: width * 0.42, y: height * 0.90, angle: 0.2, speed: 18, length: 22, alpha: 0.50, swimPhase: 0, trail: [] },
      { x: width * 0.55, y: height * 0.93, angle: 3.3, speed: 14, length: 18, alpha: 0.45, swimPhase: 1.5, trail: [] },
      { x: width * 0.28, y: height * 0.95, angle: 0.1, speed: 12, length: 16, alpha: 0.40, swimPhase: 3.0, trail: [] },
    ];
  }

  // =========================================================================
  // 4. 空灵静谧的苍穹夜色与北斗星宿 (Ethereal Night Sky with Constellations)
  // =========================================================================
  const skyGrd = ctx.createLinearGradient(0, 0, 0, height);
  skyGrd.addColorStop(0, colors.skyTop);
  skyGrd.addColorStop(0.50, colors.skyMid);
  skyGrd.addColorStop(1.0, colors.skyBottom);
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, width, height);

  // 绘制深空微弱星宿
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  starsPool.forEach((st) => {
    const twinkle = Math.sin(timeAccum * 0.8 + st.phase) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(220, 240, 255, ${st.baseAlpha * twinkle * (0.6 + smoothTreble * 0.4)})`;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // 北斗星宿极淡连线
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

  // =========================================================================
  // 5. 极度柔和朦胧的空灵冷月 (Ultra-Soft Luminous Moon with Multi-Stage Halo)
  // =========================================================================
  const moonX = width * 0.16;
  const moonY = height * 0.18;
  const moonRadius = Math.min(width, height) * 0.052;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // 1. 广域深远漫射月辉
  const outerBloom = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.5, moonX, moonY, moonRadius * 7.5);
  outerBloom.addColorStop(0, "rgba(200, 240, 255, 0.30)");
  outerBloom.addColorStop(0.35, "rgba(150, 215, 240, 0.12)");
  outerBloom.addColorStop(0.70, "rgba(90, 160, 200, 0.03)");
  outerBloom.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = outerBloom;
  ctx.globalAlpha = 0.85 + Math.sin(breathTime) * 0.10 + smoothMid * 0.15;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius * 7.5, 0, Math.PI * 2);
  ctx.fill();

  // 2. 近距天青色温润月冕
  const midCorona = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.3, moonX, moonY, moonRadius * 3.2);
  midCorona.addColorStop(0, "rgba(240, 252, 255, 0.75)");
  midCorona.addColorStop(0.40, "rgba(195, 235, 250, 0.40)");
  midCorona.addColorStop(0.80, "rgba(140, 205, 230, 0.08)");
  midCorona.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = midCorona;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius * 3.2, 0, Math.PI * 2);
  ctx.fill();

  // 3. 核心柔焦玉轮
  const coreMoon = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonRadius * 1.2);
  coreMoon.addColorStop(0, "rgba(255, 255, 255, 0.98)");
  coreMoon.addColorStop(0.45, "rgba(245, 250, 255, 0.90)");
  coreMoon.addColorStop(0.80, "rgba(220, 242, 252, 0.45)");
  coreMoon.addColorStop(1.0, "rgba(180, 220, 245, 0.0)");
  ctx.fillStyle = coreMoon;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius * 1.2, 0, Math.PI * 2);
  ctx.fill();

  // 4. 诗意水墨薄云拂月
  const cloudWisps = [
    { dy: -moonRadius * 0.25, w: moonRadius * 3.6, h: moonRadius * 0.42, rot: 0.04, speed: 0.18, phase: 0 },
    { dy: moonRadius * 0.20, w: moonRadius * 4.5, h: moonRadius * 0.48, rot: -0.03, speed: 0.24, phase: 1.8 },
  ];

  ctx.globalCompositeOperation = "source-over";
  cloudWisps.forEach((wisp) => {
    const cloudOffset = Math.sin(timeAccum * wisp.speed + wisp.phase) * (moonRadius * 0.6);
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

  // =========================================================================
  // 6. 宋代青绿动态山峦画卷 (四层重彩矿物青绿，气韵生动)
  // =========================================================================
  const drawShanShuiLayer = (
    layerIndex: number,
    baseYRatio: number,
    colorStops: string[],
    goldWireAlpha: number
  ) => {
    ctx.save();
    const baseY = height * baseYRatio;

    // 1. 实心山体矿物重彩渐变填充（延伸至底端）
    const mtnGrd = ctx.createLinearGradient(0, baseY - height * 0.20, 0, height + 80);
    mtnGrd.addColorStop(0, colorStops[0]);
    mtnGrd.addColorStop(0.35, colorStops[1]);
    mtnGrd.addColorStop(0.80, colorStops[2]);
    mtnGrd.addColorStop(1.0, "rgba(2, 6, 9, 0.98)");
    ctx.fillStyle = mtnGrd;

    ctx.beginPath();
    ctx.moveTo(0, height + 80);
    ctx.lineTo(0, baseY);

    const stepPx = 5;
    const totalSteps = Math.ceil(width / stepPx) + 1;
    const ridgePoints: { x: number; y: number }[] = [];

    for (let i = 0; i <= totalSteps; i++) {
      const curX = i * stepPx;
      const normX = curX / width;
      const hOffset = dynamicShanShuiRidge(normX, layerIndex, timeAccum, smoothEnergy, height);
      const curY = baseY + hOffset;
      ridgePoints.push({ x: curX, y: curY });
      ctx.lineTo(curX, curY);
    }

    ctx.lineTo(width, height + 80);
    ctx.closePath();
    ctx.fill();

    // 2. 山脊受月光勾勒出灵动描金金线
    if (goldWireAlpha > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = colors.goldWire;
      ctx.lineWidth = 1.3 + smoothTreble * 0.8;
      ctx.shadowColor = colors.goldGlint;
      ctx.shadowBlur = 8 + smoothTreble * 10;

      const lightPulse = (Math.sin(timeAccum * 1.5 + layerIndex) + 1) * 0.5;
      ctx.globalAlpha = goldWireAlpha * (0.65 + smoothTreble * 0.35 + lightPulse * 0.25);

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

  // 1. 远岫巍峨奇峰 (Distant Peaks: 石青设色)
  drawShanShuiLayer(1, 0.60, colors.farMountain, 0.35);

  // 2. 山间缭绕游岚 (Inter-Mountain Silk Mist Ribbons)
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  mistRibbonsPool.forEach((mist) => {
    const cx = (mist.x + Math.sin(timeAccum * mist.speed + mist.phase) * 70) % (width + 320) - 160;
    const cy = mist.y + Math.sin(timeAccum * 0.4 + mist.phase) * 6;
    const cloudGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, mist.rx);
    cloudGrd.addColorStop(0, colors.cloudColor);
    cloudGrd.addColorStop(0.6, "rgba(8, 30, 36, 0.12)");
    cloudGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = cloudGrd;
    ctx.globalAlpha = mist.baseAlpha * (0.85 + Math.sin(breathTime) * 0.15 + smoothMid * 0.20);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(mist.rx, mist.ry);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  // 3. 中山苍峦叠嶂 (Mid Mountain: 石绿设色)
  drawShanShuiLayer(2, 0.72, colors.midMountain, 0.60);

  // 4. 近山峭壁磐石 (Near Mountain: 浓翠焦墨)
  drawShanShuiLayer(3, 0.82, colors.nearMountain, 0.85);

  // 5. 前景临江秀渚 (Foreground River Shoreline)
  drawShanShuiLayer(4, 0.90, colors.shoreMountain, 0.70);

  // 6. 山脊升腾的流金星屑微粒
  for (let i = crestEmbers.length - 1; i >= 0; i--) {
    const ember = crestEmbers[i];
    ember.life += dt;
    ember.x += ember.vx * dt;
    ember.y += ember.vy * dt;
    ember.alpha = Math.max(0, 1.0 - ember.life / ember.maxLife);

    if (ember.life >= ember.maxLife) {
      crestEmbers.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(255, 230, 140, ${ember.alpha * 0.85})`;
    ctx.shadowColor = colors.goldGlint;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // =========================================================================
  // 7. 清潭水波、碎金倒影、一叶扁舟与游鱼 (Water Ripple & Lone Boat on Shore)
  // =========================================================================
  ctx.save();

  // 1. 水面微光波纹叠加
  ctx.globalCompositeOperation = "screen";
  for (let w = 0; w < 4; w++) {
    const waveY = height * (0.85 + w * 0.035);
    const waveAlpha = (0.20 - w * 0.03) * (0.7 + smoothMid * 0.35);
    ctx.strokeStyle = colors.waterWave;
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = waveAlpha;

    ctx.beginPath();
    for (let x = 0; x <= width; x += 18) {
      const sinOffset = Math.sin(x * 0.015 + timeAccum * (0.35 + w * 0.12) + w) * 2.5;
      if (x === 0) ctx.moveTo(x, waveY + sinOffset);
      else ctx.lineTo(x, waveY + sinOffset);
    }
    ctx.stroke();
  }

  // 2. 乐曲泛音清潭涟漪
  for (let i = ripplesPool.length - 1; i >= 0; i--) {
    const r = ripplesPool[i];
    r.radius += r.speed * dt;
    r.alpha -= dt * 0.32;

    if (r.alpha <= 0 || r.radius >= r.maxRadius) {
      ripplesPool.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.strokeStyle = colors.waterWave;
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = r.alpha * 0.45;
    ctx.translate(r.x, r.y);
    ctx.scale(r.radius, r.radius * 0.28);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 3. 水底游弋灵动锦鲤（带有游光星露拖尾）
  koisPool.forEach((koi) => {
    koi.swimPhase += dt * 3.5;
    koi.x += Math.cos(koi.angle) * koi.speed * dt;
    koi.y += Math.sin(koi.angle) * (koi.speed * 0.3) * dt;

    if (koi.x < -40) koi.x = width + 40;
    if (koi.x > width + 40) koi.x = -40;
    if (koi.y < height * 0.84) koi.y = height - 15;
    if (koi.y > height + 20) koi.y = height * 0.86;

    // 拖尾记录
    koi.trail.unshift({ x: koi.x, y: koi.y, alpha: 0.5 });
    if (koi.trail.length > 8) koi.trail.pop();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    koi.trail.forEach((tr, tIdx) => {
      tr.alpha -= dt * 0.6;
      ctx.fillStyle = `rgba(255, 205, 130, ${Math.max(0, tr.alpha * 0.35)})`;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, (1 - tIdx / 8) * 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    const wiggle = Math.sin(koi.swimPhase) * 3;

    ctx.save();
    ctx.translate(koi.x, koi.y);
    ctx.rotate(koi.angle);
    ctx.fillStyle = colors.koiColor;
    ctx.globalAlpha = koi.alpha * (0.8 + smoothMid * 0.3);

    ctx.beginPath();
    ctx.moveTo(koi.length * 0.5, 0);
    ctx.quadraticCurveTo(0, 3, -koi.length * 0.5, wiggle);
    ctx.quadraticCurveTo(-koi.length * 0.7, wiggle * 1.5, -koi.length * 0.8, wiggle * 2);
    ctx.quadraticCurveTo(-koi.length * 0.5, 0, 0, -3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  });

  // 4. 一叶扁舟、青竹钓竿与暖黄渔火
  const boatX = width * 0.28;
  const boatBobbing = Math.sin(timeAccum * 0.65) * 3.0;
  const boatY = height * 0.89 + boatBobbing;

  ctx.save();
  ctx.translate(boatX, boatY);
  ctx.rotate(Math.sin(timeAccum * 0.65) * 0.025);

  // 乌篷船身
  ctx.fillStyle = "rgba(4, 10, 12, 0.98)";
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.quadraticCurveTo(-10, 7, 0, 8);
  ctx.quadraticCurveTo(14, 7, 24, 0);
  ctx.quadraticCurveTo(10, 3, 0, 3);
  ctx.quadraticCurveTo(-10, 3, -22, 0);
  ctx.closePath();
  ctx.fill();

  // 乌篷拱顶
  ctx.beginPath();
  ctx.arc(-2, 0, 7, Math.PI, 0, false);
  ctx.fill();

  // 青竹钓竿
  ctx.strokeStyle = "rgba(200, 220, 210, 0.65)";
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.quadraticCurveTo(-26, -14, -36, -20);
  ctx.stroke();

  // 钓丝
  ctx.strokeStyle = "rgba(220, 240, 255, 0.25)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-36, -20);
  ctx.lineTo(-36, 12);
  ctx.stroke();

  // 船头暖黄渔火
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

  // 水中渔火倒影
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

  // =========================================================================
  // 8. 空灵流萤与悬浮金箔微粒 (3D Depth-of-Field Bokeh & Gold Dust)
  // =========================================================================
  ctx.save();
  const trebleBoost = smoothTreble * 1.0;

  firefliesPool.forEach((p) => {
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

    if (p.z > 0.70 && p.alpha > 0.75 && starSparkleSprite) {
      ctx.globalCompositeOperation = "screen";
      const spSize = halfSize * 6 * (1.0 + smoothTreble * 0.5);
      ctx.globalAlpha = p.alpha * 0.85;
      ctx.drawImage(starSparkleSprite, -spSize / 2, -spSize / 2, spSize, spSize);
    }
    ctx.restore();
  });
  ctx.restore();

  // =========================================================================
  // 9. 宋画竖版典雅题跋诗词与朱砂篆刻 (Vertical Calligraphy Inscription on Right)
  // =========================================================================
  if (showPoetry) {
    poemTimer += dt;
    const cycleTime = 16;
    const progress = poemTimer % cycleTime;

    if (progress < 2.5) {
      poemAlpha = progress / 2.5;
    } else if (progress < 13.5) {
      poemAlpha = 1.0;
    } else {
      poemAlpha = Math.max(0, (cycleTime - progress) / 2.5);
    }

    if (progress < dt * 2 && poemTimer > 5) {
      poemIndex = (poemIndex + 1) % ORIENTAL_POEMS.length;
    }

    const currentPoem = ORIENTAL_POEMS[poemIndex];
    if (currentPoem && poemAlpha > 0.01) {
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
      ctx.fillStyle = `rgba(240, 235, 220, ${poemAlpha * 0.88})`;
      chars.forEach((ch) => {
        if (ch === "，" || ch === " " || ch === "、") {
          curY += charSpacing * 0.6;
        } else {
          ctx.fillText(ch, textX, curY);
          curY += charSpacing;
        }
      });

      ctx.font = '300 11px "Noto Serif SC", serif';
      ctx.fillStyle = `rgba(195, 185, 165, ${poemAlpha * 0.60})`;
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
      ctx.fillStyle = `rgba(215, 50, 42, ${poemAlpha * 0.85})`;
      ctx.fillRect(stampX - 7, stampY - 7, 14, 14);
      ctx.strokeStyle = `rgba(255, 210, 190, ${poemAlpha * 0.90})`;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(stampX - 7, stampY - 7, 14, 14);

      ctx.font = 'bold 8px "Noto Serif SC", serif';
      ctx.fillStyle = `rgba(255, 255, 255, ${poemAlpha * 0.95})`;
      ctx.fillText("墨", stampX, stampY);

      ctx.restore();
    }
  }

  // =========================================================================
  // 10. 电影级清幽暗角与宣纸微颗粒 (Film Grain & Cinematic Vignette)
  // =========================================================================
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
    ctx.globalAlpha = filmVignette * (0.85 + Math.sin(breathTime) * 0.03);
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    if (grainCanvas) {
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      const grainPattern = ctx.createPattern(grainCanvas, "repeat");
      if (grainPattern) {
        ctx.fillStyle = grainPattern;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.restore();
    }
  }
}
