/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectContext } from "./types";

// =========================================================================
// 1. Data Structures & Scene Graph
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

interface CloudLayer {
  x: number;
  y: number;
  rx: number;
  ry: number;
  baseAlpha: number;
  speed: number;
  phase: number;
}

interface SwimmingKoi {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  speed: number;
  length: number;
  alpha: number;
  swimPhase: number;
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
    // 0: 【青绿千山 · 幽谷月华】(宋代王希孟青绿设色，清雅绝尘)
    skyTop: "#010709",
    skyMid: "#031317",
    skyBottom: "#082025",
    moonColor: "rgba(240, 248, 255, 0.98)",
    moonHalo: "rgba(215, 242, 250, 0.10)",
    farMountain: ["#061418", "#040e11", "#020709"],
    midMountain: ["#092326", "#06181b", "#030c0e"],
    nearMountain: ["#0d2f30", "#081d1e", "#030a0b"],
    goldGlint: "rgba(255, 235, 160, 0.95)",
    goldWire: "rgba(235, 195, 100, 0.70)",
    cloudColor: "rgba(10, 42, 45, 0.28)",
    waterColor: "rgba(3, 10, 13, 0.96)",
    waterWave: "rgba(210, 245, 235, 0.35)",
    lanternGlow: "rgba(255, 205, 110, 0.90)",
    koiColor: "rgba(255, 190, 110, 0.45)",
    vignetteColor: "rgba(1, 3, 5, 0.88)",
  },
  {
    // 1: 【烟雨水墨 · 孤舟晚渡】(新安徽派水墨，空灵幽邃)
    skyTop: "#020305",
    skyMid: "#07090f",
    skyBottom: "#0f131d",
    moonColor: "rgba(245, 248, 255, 0.98)",
    moonHalo: "rgba(205, 225, 255, 0.08)",
    farMountain: ["#0e1017", "#090a0f", "#040508"],
    midMountain: ["#141822", "#0d1017", "#06070b"],
    nearMountain: ["#1b212f", "#111520", "#080a0f"],
    goldGlint: "rgba(220, 240, 255, 0.95)",
    goldWire: "rgba(175, 205, 245, 0.65)",
    cloudColor: "rgba(22, 28, 42, 0.30)",
    waterColor: "rgba(4, 6, 9, 0.96)",
    waterWave: "rgba(190, 220, 255, 0.30)",
    lanternGlow: "rgba(255, 215, 130, 0.85)",
    koiColor: "rgba(210, 230, 255, 0.40)",
    vignetteColor: "rgba(1, 2, 3, 0.88)",
  },
  {
    // 2: 【暮霞沉香 · 金碧流丹】(盛唐沉香朱砂，典雅华贵)
    skyTop: "#070209",
    skyMid: "#160519",
    skyBottom: "#260822",
    moonColor: "rgba(255, 242, 230, 0.98)",
    moonHalo: "rgba(255, 195, 150, 0.12)",
    farMountain: ["#150517", "#0e020f", "#060107"],
    midMountain: ["#240925", "#160317", "#0b010c"],
    nearMountain: ["#380f33", "#220520", "#10010f"],
    goldGlint: "rgba(255, 225, 140, 0.98)",
    goldWire: "rgba(250, 180, 75, 0.75)",
    cloudColor: "rgba(52, 14, 40, 0.32)",
    waterColor: "rgba(10, 2, 12, 0.96)",
    waterWave: "rgba(255, 190, 140, 0.38)",
    lanternGlow: "rgba(255, 185, 80, 0.90)",
    koiColor: "rgba(255, 160, 90, 0.50)",
    vignetteColor: "rgba(4, 1, 6, 0.88)",
  },
];

// 复用对象池
let firefliesPool: GoldFirefly[] | null = null;
let cloudsPool: CloudLayer[] | null = null;
let ripplesPool: LakeRipple[] = [];
let koisPool: SwimmingKoi[] | null = null;
let starSparkleSprite: HTMLCanvasElement | null = null;
let moonHaloSprite: HTMLCanvasElement | null = null;
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
// 2. High-Performance Sprites (0 GC)
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
    grd.addColorStop(0.15, "rgba(240, 248, 255, 0.70)");
    grd.addColorStop(0.40, "rgba(205, 235, 245, 0.20)");
    grd.addColorStop(0.75, "rgba(150, 200, 220, 0.05)");
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

// 国画写意山峰轮廓（远岫嶙峋，中山层叠，近岸幽深）
function shanShuiRidgeHeight(
  normX: number,
  layerIndex: number,
  time: number
): number {
  if (layerIndex === 1) {
    // 远山：峰峦起伏，峻拔出尘
    const p1 = Math.exp(-Math.pow((normX - 0.26) * 5.5, 2)) * -145;
    const p2 = Math.exp(-Math.pow((normX - 0.68) * 4.8, 2)) * -120;
    const p3 = Math.exp(-Math.pow((normX - 0.90) * 7.5, 2)) * -80;
    const undulating = Math.sin(normX * 4.5 + 0.4) * 32;
    return p1 + p2 + p3 + undulating;
  } else if (layerIndex === 2) {
    // 中山：层峦叠嶂，缓坡流岚
    const p1 = Math.exp(-Math.pow((normX - 0.16) * 4.8, 2)) * -90;
    const p2 = Math.exp(-Math.pow((normX - 0.50) * 4.2, 2)) * -100;
    const slope = Math.sin(normX * 5.2 + 1.1) * 36;
    const breath = Math.sin(time * 0.15 + normX * 2) * 5;
    return p1 + p2 + slope + breath;
  } else {
    // 近山：临水岩矶，古木磐石
    const cliff = Math.exp(-Math.pow((normX - 0.84) * 4.2, 2)) * -65;
    const shore = Math.sin(normX * 3.6 + 2.1) * 26;
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

  // 2. 声学滤波：双阶温润包络
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

  timeAccum += dt * (0.35 + smoothMid * 0.25 * inkSpeedMult);
  breathTime += dt * 0.25;

  // 泛音清潭涟漪触发
  if (rawTreble > 0.42 && time - lastTransientPeak > 550) {
    lastTransientPeak = time;
    if (ripplesPool.length < 6) {
      ripplesPool.push({
        x: width * 0.25 + Math.random() * width * 0.5,
        y: height * 0.83 + Math.random() * height * 0.12,
        radius: 3,
        maxRadius: 50 + Math.random() * 70,
        alpha: 0.65,
        speed: 24 + Math.random() * 18,
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

  if (!cloudsPool) {
    cloudsPool = [
      { x: width * 0.2, y: height * 0.45, rx: 260, ry: 50, baseAlpha: 0.25, speed: 0.07, phase: 0 },
      { x: width * 0.68, y: height * 0.52, rx: 320, ry: 60, baseAlpha: 0.20, speed: 0.05, phase: 2.1 },
      { x: width * 0.42, y: height * 0.66, rx: 400, ry: 70, baseAlpha: 0.28, speed: 0.08, phase: 4.3 },
    ];
  }

  if (!koisPool) {
    koisPool = [
      { x: width * 0.42, y: height * 0.90, vx: 0.4, vy: 0.1, angle: 0.2, targetAngle: 0.2, speed: 18, length: 22, alpha: 0.35, swimPhase: 0 },
      { x: width * 0.55, y: height * 0.93, vx: -0.3, vy: -0.08, angle: 3.3, targetAngle: 3.3, speed: 14, length: 18, alpha: 0.30, swimPhase: 1.5 },
      { x: width * 0.28, y: height * 0.94, vx: 0.25, vy: 0.05, angle: 0.1, targetAngle: 0.1, speed: 12, length: 16, alpha: 0.25, swimPhase: 3.0 },
    ];
  }

  // =========================================================================
  // 4. 空灵静谧的苍穹古色 (Ethereal Sky Gradient)
  // =========================================================================
  const skyGrd = ctx.createLinearGradient(0, 0, 0, height);
  skyGrd.addColorStop(0, colors.skyTop);
  skyGrd.addColorStop(0.5, colors.skyMid);
  skyGrd.addColorStop(1.0, colors.skyBottom);
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, width, height);

  // =========================================================================
  // 5. 清幽冷月、月华晕轮与变形水平微光丝 (Celestial Moon with Anamorphic Streak)
  // =========================================================================
  const moonX = width * 0.16;
  const moonY = height * 0.20;
  const moonRadius = Math.min(width, height) * 0.052;

  ctx.save();
  // 1. 广域柔焦月华
  if (moonHaloSprite) {
    ctx.globalCompositeOperation = "screen";
    const haloSize = moonRadius * 9.0 * (1.0 + smoothEnergy * 0.12);
    ctx.globalAlpha = 0.65 + Math.sin(breathTime) * 0.06 + smoothMid * 0.15;
    ctx.drawImage(moonHaloSprite, moonX - haloSize / 2, moonY - haloSize / 2, haloSize, haloSize);
  }

  // 2. 电影级横向水平微光丝 (Subtle Anamorphic Moon Streak)
  if (smoothTreble > 0.25) {
    ctx.globalCompositeOperation = "screen";
    const streakAlpha = Math.min(0.35, (smoothTreble - 0.25) * 1.2);
    const streakW = width * 0.55;
    const streakGrd = ctx.createLinearGradient(moonX - streakW / 2, moonY, moonX + streakW / 2, moonY);
    streakGrd.addColorStop(0, "rgba(240, 248, 255, 0)");
    streakGrd.addColorStop(0.4, "rgba(220, 240, 255, 0.1)");
    streakGrd.addColorStop(0.5, `rgba(255, 255, 255, ${streakAlpha})`);
    streakGrd.addColorStop(0.6, "rgba(220, 240, 255, 0.1)");
    streakGrd.addColorStop(1, "rgba(240, 248, 255, 0)");
    ctx.fillStyle = streakGrd;
    ctx.fillRect(moonX - streakW / 2, moonY - 1, streakW, 2);
  }

  // 3. 清幽月轮
  ctx.globalCompositeOperation = "source-over";
  const moonDiscGrd = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.3, moonX, moonY, moonRadius);
  moonDiscGrd.addColorStop(0, colors.moonColor);
  moonDiscGrd.addColorStop(0.85, "rgba(240, 248, 255, 0.92)");
  moonDiscGrd.addColorStop(1.0, "rgba(215, 235, 245, 0.0)");
  ctx.fillStyle = moonDiscGrd;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  ctx.fill();

  // 4. 游云遮月
  const cloudGrd = ctx.createLinearGradient(moonX - moonRadius * 1.5, 0, moonX + moonRadius * 1.5, 0);
  cloudGrd.addColorStop(0, "rgba(0, 0, 0, 0)");
  cloudGrd.addColorStop(0.5, colors.skyMid);
  cloudGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = cloudGrd;
  ctx.save();
  ctx.translate(moonX + Math.sin(timeAccum * 0.2) * 18, moonY + moonRadius * 0.2);
  ctx.rotate(0.04);
  ctx.scale(moonRadius * 1.5, moonRadius * 0.22);
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

    // 山脊受光面金碧金线勾勒
    if (goldWireAlpha > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = colors.goldWire;
      ctx.lineWidth = 1.1 + smoothTreble * 0.6;
      ctx.shadowColor = colors.goldGlint;
      ctx.shadowBlur = 6 + smoothTreble * 8;
      ctx.globalAlpha = goldWireAlpha * (0.60 + smoothTreble * 0.35);

      ctx.beginPath();
      for (let i = 0; i < ridgePoints.length; i++) {
        if (i === 0) ctx.moveTo(ridgePoints[i].x, ridgePoints[i].y);
        else ctx.lineTo(ridgePoints[i].x, ridgePoints[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 山谷水墨云岚
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

  // 远山
  drawShanShuiLayer(1, 0.46, colors.farMountain, 0.30);

  // 山间流云
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  cloudsPool.forEach((cloud) => {
    const cx = (cloud.x + Math.sin(timeAccum * cloud.speed + cloud.phase) * 50) % (width + 280) - 140;
    const cloudGrd = ctx.createRadialGradient(cx, cloud.y, 0, cx, cloud.y, cloud.rx);
    cloudGrd.addColorStop(0, colors.cloudColor);
    cloudGrd.addColorStop(0.6, "rgba(8, 30, 33, 0.12)");
    cloudGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = cloudGrd;
    ctx.globalAlpha = cloud.baseAlpha * (0.8 + Math.sin(breathTime) * 0.2);
    ctx.save();
    ctx.translate(cx, cloud.y);
    ctx.scale(cloud.rx, cloud.ry);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  // 中山与近山
  drawShanShuiLayer(2, 0.62, colors.midMountain, 0.55);
  drawShanShuiLayer(3, 0.78, colors.nearMountain, 0.80);

  // =========================================================================
  // 7. 清潭水镜、一叶扁舟、渔火微光与水底游鱼 (Lake with Lone Boat & Koi Silhouettes)
  // =========================================================================
  const lakeY = height * 0.82;
  ctx.save();

  // 清潭深邃如镜
  const lakeGrd = ctx.createLinearGradient(0, lakeY, 0, height);
  lakeGrd.addColorStop(0, "rgba(3, 8, 11, 0.6)");
  lakeGrd.addColorStop(1.0, colors.waterColor);
  ctx.fillStyle = lakeGrd;
  ctx.fillRect(0, lakeY, width, height - lakeY);

  // 水底灵动锦鲤游弋 (Graceful Koi Silhouettes)
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  koisPool.forEach((koi) => {
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
    ctx.globalAlpha = koi.alpha * (0.8 + smoothMid * 0.3);

    // 鱼身与轻柔鱼尾
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

  // 柔和微波水纹
  ctx.globalCompositeOperation = "screen";
  for (let w = 0; w < 3; w++) {
    const waveY = lakeY + (height - lakeY) * ((w + 1) / 4);
    const waveAlpha = (0.16 - w * 0.04) * (0.7 + smoothMid * 0.3);
    ctx.strokeStyle = colors.waterWave;
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = waveAlpha;

    ctx.beginPath();
    for (let x = 0; x <= width; x += 20) {
      const sinOffset = Math.sin(x * 0.01 + timeAccum * (0.28 + w * 0.1) + w) * 2.2;
      if (x === 0) ctx.moveTo(x, waveY + sinOffset);
      else ctx.lineTo(x, waveY + sinOffset);
    }
    ctx.stroke();
  }

  // 琴音泛音涟漪
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

  // 一叶扁舟与渔火微光
  const boatX = width * 0.32;
  const boatBobbing = Math.sin(timeAccum * 0.55) * 2.5;
  const boatY = height * 0.86 + boatBobbing;

  ctx.save();
  ctx.translate(boatX, boatY);
  ctx.rotate(Math.sin(timeAccum * 0.55) * 0.018);

  ctx.fillStyle = "rgba(3, 6, 8, 0.95)";
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.quadraticCurveTo(-9, 6, 0, 7);
  ctx.quadraticCurveTo(13, 6, 22, 0);
  ctx.quadraticCurveTo(9, 3, 0, 3);
  ctx.quadraticCurveTo(-9, 3, -20, 0);
  ctx.closePath();
  ctx.fill();

  // 乌篷
  ctx.beginPath();
  ctx.arc(-2, 0, 6.5, Math.PI, 0, false);
  ctx.fill();

  // 船头暖黄渔火
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

  // 水中渔火纵向倒影
  const reflectGrd = ctx.createRadialGradient(lanternX, 8, 0, lanternX, 8, 16);
  reflectGrd.addColorStop(0, "rgba(255, 210, 130, 0.40)");
  reflectGrd.addColorStop(1.0, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = reflectGrd;
  ctx.save();
  ctx.translate(lanternX, 8);
  ctx.scale(16, 4.5);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
  ctx.restore();

  // =========================================================================
  // 8. 空灵流萤与悬浮金箔微粒 (Luminous Fireflies & Floating Gold Dust)
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
    if (p.z > 0.72 && p.alpha > 0.78 && starSparkleSprite) {
      ctx.globalCompositeOperation = "screen";
      const spSize = halfSize * 6 * (1.0 + smoothTreble * 0.5);
      ctx.globalAlpha = p.alpha * 0.80;
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
