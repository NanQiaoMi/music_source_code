/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectContext } from "./types";

// =========================================================================
// 1. Data Structures & Oriental Shan-Shui Scene Graph
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

interface LakeWaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

interface CloudPuff {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  baseAlpha: number;
  speed: number;
  phase: number;
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

const COLOR_SCHEMES = [
  {
    // 0: 【青绿千山 · 幽谷月华】(宋代王希孟青绿设色，清雅出尘)
    skyTop: "#010709",
    skyMid: "#041419",
    skyBottom: "#092227",
    moonColor: "rgba(240, 248, 255, 0.95)",
    moonHalo: "rgba(210, 238, 245, 0.12)",
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
  {
    // 1: 【烟雨水墨 · 孤舟晚渡】(新安徽派水墨，空灵出世)
    skyTop: "#020305",
    skyMid: "#080a10",
    skyBottom: "#111520",
    moonColor: "rgba(245, 248, 255, 0.95)",
    moonHalo: "rgba(200, 220, 255, 0.10)",
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
  {
    // 2: 【暮霞沉香 · 金碧流丹】(盛唐沉香朱砂，典雅华贵)
    skyTop: "#08020a",
    skyMid: "#18061c",
    skyBottom: "#290924",
    moonColor: "rgba(255, 240, 225, 0.95)",
    moonHalo: "rgba(255, 195, 150, 0.14)",
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
];

// 专属复用对象池
let firefliesPool: GoldFirefly[] | null = null;
let cloudsPool: CloudPuff[] | null = null;
let ripplesPool: LakeWaveRing[] = [];
let starSparkleSprite: HTMLCanvasElement | null = null;
let moonHaloSprite: HTMLCanvasElement | null = null;
let grainCanvas: HTMLCanvasElement | null = null;

// 深度声学呼吸状态（双阶极平滑）
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

// 乐曲高频触发
let lastTransientPeak = 0;

// =========================================================================
// 2. High-End Canvas Sprites (0 GC)
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

function createMoonHaloSprite(size: number): HTMLCanvasElement | null {
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

// 险峻古朴的国画山峰轮廓函数（远山挺拔，中山层叠，近山浑厚）
function shanShuiRidgeHeight(
  normX: number,
  layerIndex: number,
  time: number
): number {
  if (layerIndex === 1) {
    // 远山：高耸入云的仙山奇峰 (Tall jagged peaks)
    const peak1 = Math.exp(-Math.pow((normX - 0.28) * 6, 2)) * -140;
    const peak2 = Math.exp(-Math.pow((normX - 0.65) * 5, 2)) * -110;
    const peak3 = Math.exp(-Math.pow((normX - 0.88) * 8, 2)) * -75;
    const baseWave = Math.sin(normX * 4.2 + 0.5) * 30;
    return peak1 + peak2 + peak3 + baseWave;
  } else if (layerIndex === 2) {
    // 中山：层峦叠嶂的缓坡山脊 (Layered slopes)
    const peak1 = Math.exp(-Math.pow((normX - 0.18) * 5, 2)) * -85;
    const peak2 = Math.exp(-Math.pow((normX - 0.52) * 4, 2)) * -95;
    const slope = Math.sin(normX * 5.5 + 1.2) * 35;
    const slowBreathe = Math.sin(time * 0.15 + normX * 2) * 6;
    return peak1 + peak2 + slope + slowBreathe;
  } else {
    // 近山：温润沉稳的临水岩矶 (Gentle lakeside ridges)
    const cliff = Math.exp(-Math.pow((normX - 0.82) * 4, 2)) * -60;
    const shore = Math.sin(normX * 3.8 + 2.0) * 25;
    return cliff + shore;
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

  // 2. 声学平滑（双阶极平滑包络，余韵悠扬长存）
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

  timeAccum += dt * (0.4 + smoothMid * 0.3 * inkSpeedMult);
  breathTime += dt * 0.3; // 悠扬长呼吸

  // 乐曲泛音触发清潭涟漪
  if (rawTreble > 0.42 && time - lastTransientPeak > 500) {
    lastTransientPeak = time;
    if (ripplesPool.length < 6) {
      ripplesPool.push({
        x: width * 0.25 + Math.random() * width * 0.5,
        y: height * 0.83 + Math.random() * height * 0.12,
        radius: 3,
        maxRadius: 50 + Math.random() * 70,
        alpha: 0.65,
        speed: 25 + Math.random() * 20,
      });
    }
  }

  // 3. 资源初始化
  if (!starSparkleSprite) starSparkleSprite = createStarSparkleSprite(56);
  if (!moonHaloSprite) moonHaloSprite = createMoonHaloSprite(384);
  if (!grainCanvas) grainCanvas = createFilmGrainTexture();

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
  }

  if (!cloudsPool) {
    cloudsPool = [
      { x: width * 0.2, y: height * 0.46, radiusX: 280, radiusY: 55, baseAlpha: 0.28, speed: 0.08, phase: 0 },
      { x: width * 0.65, y: height * 0.52, radiusX: 340, radiusY: 65, baseAlpha: 0.22, speed: 0.06, phase: 2.1 },
      { x: width * 0.4, y: height * 0.68, radiusX: 420, radiusY: 75, baseAlpha: 0.30, speed: 0.09, phase: 4.3 },
    ];
  }

  // =========================================================================
  // 4. 空灵静谧的苍穹夜色 (Ethereal Sky Gradient)
  // =========================================================================
  const skyGrd = ctx.createLinearGradient(0, 0, 0, height);
  skyGrd.addColorStop(0, colors.skyTop);
  skyGrd.addColorStop(0.5, colors.skyMid);
  skyGrd.addColorStop(1.0, colors.skyBottom);
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, width, height);

  // =========================================================================
  // 5. 清幽冷月与朦胧月华晕轮 (Luminous Celestial Moon with Soft Mist Halo)
  // =========================================================================
  const moonX = width * 0.16;
  const moonY = height * 0.22;
  const moonRadius = Math.min(width, height) * 0.055;

  ctx.save();
  // 1. 广域月华柔和漫射 (Multi-layer Ambient Moonlight Bloom)
  if (moonHaloSprite) {
    ctx.globalCompositeOperation = "screen";
    const haloSize = moonRadius * 8.5 * (1.0 + smoothEnergy * 0.15);
    ctx.globalAlpha = 0.65 + Math.sin(breathTime) * 0.08 + smoothMid * 0.2;
    ctx.drawImage(moonHaloSprite, moonX - haloSize / 2, moonY - haloSize / 2, haloSize, haloSize);
  }

  // 2. 清幽皓月本体 (Moon Disc with Ethereal Soft Edge)
  ctx.globalCompositeOperation = "source-over";
  const moonDiscGrd = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.3, moonX, moonY, moonRadius);
  moonDiscGrd.addColorStop(0, colors.moonColor);
  moonDiscGrd.addColorStop(0.85, "rgba(240, 248, 255, 0.90)");
  moonDiscGrd.addColorStop(1.0, "rgba(220, 235, 245, 0.0)");
  ctx.fillStyle = moonDiscGrd;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  ctx.fill();

  // 3. 遮月游云（缕缕水墨薄云拂过月面，古风意境画龙点睛）
  ctx.globalCompositeOperation = "source-over";
  const cloudGrd = ctx.createLinearGradient(moonX - moonRadius * 1.5, 0, moonX + moonRadius * 1.5, 0);
  cloudGrd.addColorStop(0, "rgba(0, 0, 0, 0)");
  cloudGrd.addColorStop(0.5, colors.skyMid);
  cloudGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = cloudGrd;
  ctx.save();
  ctx.translate(moonX + Math.sin(timeAccum * 0.2) * 20, moonY + moonRadius * 0.2);
  ctx.rotate(0.05);
  ctx.scale(moonRadius * 1.6, moonRadius * 0.25);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();

  // =========================================================================
  // 6. 宋代青绿空灵山水画卷 (Solid Chinese Shan-Shui Mountain Layers)
  // =========================================================================
  const drawShanShuiLayer = (
    layerIndex: number,
    baseYRatio: number,
    colorStops: string[],
    goldWireAlpha: number
  ) => {
    ctx.save();
    const baseY = height * baseYRatio;

    // 1. 实心山水渐变
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
      const hOffset = shanShuiRidgeHeight(normX, layerIndex, timeAccum);
      const curY = baseY + hOffset;
      ridgePoints.push({ x: curX, y: curY });
      ctx.lineTo(curX, curY);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // 2. 山脊受月光面金碧勾勒 (Delicate Gold Outline Inlay)
    if (goldWireAlpha > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = colors.goldWire;
      ctx.lineWidth = 1.2 + smoothTreble * 0.8;
      ctx.shadowColor = colors.goldGlint;
      ctx.shadowBlur = 6 + smoothTreble * 10;
      ctx.globalAlpha = goldWireAlpha * (0.60 + smoothTreble * 0.40);

      ctx.beginPath();
      for (let i = 0; i < ridgePoints.length; i++) {
        if (i === 0) ctx.moveTo(ridgePoints[i].x, ridgePoints[i].y);
        else ctx.lineTo(ridgePoints[i].x, ridgePoints[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3. 山脚与山谷间漫漫升腾的水墨流岚 (Valley Mist)
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

  // 1. 远山耸翠 (Distant Majestic Peaks: 苍茫出尘)
  drawShanShuiLayer(1, 0.46, colors.farMountain, 0.30);

  // 2. 山间悠悠游云 (Drifting Mid Clouds)
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  cloudsPool.forEach((cloud) => {
    const cx = (cloud.x + Math.sin(timeAccum * cloud.speed + cloud.phase) * 60) % (width + 300) - 150;
    const cloudGrd = ctx.createRadialGradient(cx, cloud.y, 0, cx, cloud.y, cloud.radiusX);
    cloudGrd.addColorStop(0, colors.cloudColor);
    cloudGrd.addColorStop(0.6, "rgba(10, 35, 38, 0.15)");
    cloudGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = cloudGrd;
    ctx.globalAlpha = cloud.baseAlpha * (0.8 + Math.sin(breathTime) * 0.2);
    ctx.save();
    ctx.translate(cx, cloud.y);
    ctx.scale(cloud.radiusX, cloud.radiusY);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  // 3. 中山苍峦 (Mid Mountain Slopes: 石青石绿)
  drawShanShuiLayer(2, 0.62, colors.midMountain, 0.55);

  // 4. 近山磐石 (Near Mountain: 沉稳深邃)
  drawShanShuiLayer(3, 0.78, colors.nearMountain, 0.80);

  // =========================================================================
  // 7. 清潭水镜、一叶扁舟与渔火微光 (Lone Boat with Gentle Lantern & Lake Reflection)
  // =========================================================================
  const lakeY = height * 0.82;
  ctx.save();

  // 清潭深邃如镜
  const lakeGrd = ctx.createLinearGradient(0, lakeY, 0, height);
  lakeGrd.addColorStop(0, "rgba(3, 10, 14, 0.6)");
  lakeGrd.addColorStop(1.0, colors.waterColor);
  ctx.fillStyle = lakeGrd;
  ctx.fillRect(0, lakeY, width, height - lakeY);

  // 柔和微波水纹
  ctx.globalCompositeOperation = "screen";
  for (let w = 0; w < 3; w++) {
    const waveY = lakeY + (height - lakeY) * ((w + 1) / 4);
    const waveAlpha = (0.18 - w * 0.04) * (0.7 + smoothMid * 0.4);

    ctx.strokeStyle = colors.waterWave;
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = waveAlpha;

    ctx.beginPath();
    for (let x = 0; x <= width; x += 20) {
      const sinOffset = Math.sin(x * 0.01 + timeAccum * (0.3 + w * 0.1) + w) * 2.5;
      if (x === 0) ctx.moveTo(x, waveY + sinOffset);
      else ctx.lineTo(x, waveY + sinOffset);
    }
    ctx.stroke();
  }

  // 音乐琴音泛音激发的清潭涟漪
  for (let i = ripplesPool.length - 1; i >= 0; i--) {
    const r = ripplesPool[i];
    r.radius += r.speed * dt;
    r.alpha -= dt * 0.35;

    if (r.alpha <= 0 || r.radius >= r.maxRadius) {
      ripplesPool.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.strokeStyle = colors.waterWave;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = r.alpha * 0.5;
    ctx.translate(r.x, r.y);
    ctx.scale(r.radius, r.radius * 0.30);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 【经典国画意象】：一叶轻舟（Lone Boat Silhouette）
  const boatX = width * 0.32;
  const boatBobbing = Math.sin(timeAccum * 0.6) * 3; // 随波轻漾
  const boatY = height * 0.86 + boatBobbing;

  ctx.save();
  ctx.translate(boatX, boatY);
  ctx.rotate(Math.sin(timeAccum * 0.6) * 0.02);

  // 船体剪影
  ctx.fillStyle = "rgba(4, 8, 10, 0.95)";
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.quadraticCurveTo(-10, 7, 0, 8);
  ctx.quadraticCurveTo(14, 7, 24, 0);
  ctx.quadraticCurveTo(10, 3, 0, 3);
  ctx.quadraticCurveTo(-10, 3, -22, 0);
  ctx.closePath();
  ctx.fill();

  // 乌篷船蓬
  ctx.beginPath();
  ctx.arc(-2, 0, 7, Math.PI, 0, false);
  ctx.fill();

  // 船头渔火 (Warm Glowing Lantern)
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

  // 水中渔火微弱倒影
  const reflectGrd = ctx.createRadialGradient(lanternX, 10, 0, lanternX, 10, 18);
  reflectGrd.addColorStop(0, "rgba(255, 210, 130, 0.45)");
  reflectGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = reflectGrd;
  ctx.save();
  ctx.translate(lanternX, 10);
  ctx.scale(18, 5);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
  ctx.restore();

  // =========================================================================
  // 8. 空灵流萤与悬浮金箔微粒 (Luminous Fireflies & Ethereal Gold Dust)
  // =========================================================================
  ctx.save();
  const trebleBoost = smoothTreble * 1.2;

  firefliesPool.forEach((p) => {
    p.phase += dt * p.phaseSpeed;
    // 柔缓如流萤盘旋升腾 (Gentle drifting & hovering)
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

    // 近景耀眼流萤触发典雅四角微星芒
    if (p.z > 0.7 && p.alpha > 0.75 && starSparkleSprite) {
      ctx.globalCompositeOperation = "screen";
      const spSize = halfSize * 7 * (1.0 + smoothTreble * 0.6);
      ctx.globalAlpha = p.alpha * 0.85;
      ctx.drawImage(starSparkleSprite, -spSize / 2, -spSize / 2, spSize, spSize);
    }

    ctx.restore();
  });
  ctx.restore();

  // =========================================================================
  // 9. 东方名家意境诗词呼吸层 (Poetry Calligraphy & Vermilion Seal)
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
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      const textX = width - 48;
      const textY = height - 46;

      ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = `rgba(240, 235, 220, ${poemAlpha * 0.85})`;
      ctx.fillText(currentPoem.line, textX, textY);

      ctx.font = '300 11px "Noto Serif SC", serif';
      ctx.fillStyle = `rgba(195, 185, 165, ${poemAlpha * 0.55})`;
      ctx.fillText(`— ${currentPoem.author}`, textX, textY + 22);

      // 朱红小印
      const stampX = textX + 18;
      const stampY = textY - 2;
      ctx.fillStyle = `rgba(215, 50, 42, ${poemAlpha * 0.85})`;
      ctx.fillRect(stampX - 8, stampY - 8, 16, 16);
      ctx.strokeStyle = `rgba(255, 210, 190, ${poemAlpha * 0.90})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(stampX - 8, stampY - 8, 16, 16);

      ctx.font = 'bold 8px "Noto Serif SC", serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(255, 255, 255, ${poemAlpha * 0.95})`;
      ctx.fillText("墨", stampX, stampY);

      ctx.restore();
    }
  }

  // =========================================================================
  // 10. 电影级清幽暗角与宣纸微胶片质感 (Film Grain & Cinematic Vignette)
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
    ctx.globalAlpha = filmVignette * (0.85 + Math.sin(breathTime) * 0.04);
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // 宣纸/微电影噪点
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
