/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectContext } from "./types";

interface GoldFlake {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  alpha: number;
  rotation: number;
  vRot: number;
  twinklePhase: number;
  twinkleSpeed: number;
  aspectRatio: number;
  colorType: "gold" | "platinum" | "copper";
}

interface VolumetricShaft {
  angle: number;
  width: number;
  intensity: number;
  speed: number;
  offset: number;
}

interface InkWave {
  speed: number;
  wavelength: number;
  amplitude: number;
  baseYPercent: number;
  phase: number;
}

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

const COLOR_SCHEMES = [
  {
    // 0: 青绿千山
    bgGradient: ["#040d12", "#091e24", "#0f2e34"],
    inkLayers: [
      "rgba(10, 31, 36, 0.95)",
      "rgba(20, 58, 68, 0.85)",
      "rgba(35, 95, 75, 0.70)",
    ],
    godrayColor: "rgba(255, 238, 195, 0.08)",
    goldColor: "rgba(245, 192, 101, 0.90)",
    highlightColor: "rgba(255, 248, 220, 1.0)",
    ambientGlow: "rgba(16, 185, 129, 0.15)",
  },
  {
    // 1: 烟雨水墨
    bgGradient: ["#050608", "#12141a", "#1a1d26"],
    inkLayers: [
      "rgba(15, 17, 22, 0.96)",
      "rgba(32, 36, 46, 0.86)",
      "rgba(55, 62, 78, 0.65)",
    ],
    godrayColor: "rgba(215, 235, 255, 0.07)",
    goldColor: "rgba(186, 215, 245, 0.92)",
    highlightColor: "rgba(255, 255, 255, 0.98)",
    ambientGlow: "rgba(56, 189, 248, 0.12)",
  },
  {
    // 2: 暮霞流丹
    bgGradient: ["#120516", "#260d26", "#38132e"],
    inkLayers: [
      "rgba(31, 11, 36, 0.96)",
      "rgba(78, 22, 54, 0.86)",
      "rgba(136, 44, 76, 0.68)",
    ],
    godrayColor: "rgba(255, 205, 150, 0.09)",
    goldColor: "rgba(251, 191, 36, 0.95)",
    highlightColor: "rgba(254, 243, 199, 1.0)",
    ambientGlow: "rgba(244, 63, 94, 0.18)",
  },
];

let particlesPool: GoldFlake[] | null = null;
let shaftsPool: VolumetricShaft[] | null = null;
let inkWavesPool: InkWave[] | null = null;
let goldGlowSprite: HTMLCanvasElement | null = null;
let flareSprite: HTMLCanvasElement | null = null;

let smoothedBassVal = 0;
let smoothedMidVal = 0;
let smoothedTrebleVal = 0;
let smoothedEnergyVal = 0;
let timeAccum = 0;
let lastTimestamp = 0;

let poemTimer = 0;
let poemIndex = 0;
let poemAlpha = 0;

function createGoldSprite(size: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const c = size / 2;
    const grd = ctx.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    grd.addColorStop(0.2, "rgba(255, 225, 140, 0.95)");
    grd.addColorStop(0.5, "rgba(245, 185, 80, 0.4)");
    grd.addColorStop(1.0, "rgba(180, 110, 20, 0.0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    return canvas;
  } catch {
    return null;
  }
}

function createFlareSprite(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const cy = h / 2;
    const grd = ctx.createLinearGradient(0, cy, w, cy);
    grd.addColorStop(0, "rgba(180, 230, 255, 0)");
    grd.addColorStop(0.35, "rgba(245, 200, 120, 0.2)");
    grd.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
    grd.addColorStop(0.65, "rgba(245, 200, 120, 0.2)");
    grd.addColorStop(1.0, "rgba(180, 230, 255, 0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    return canvas;
  } catch {
    return null;
  }
}

function pseudoNoise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export function drawCinematicOrientalInk(context: EffectContext): void {
  const { ctx, width, height, data, time, params } = context;
  if (!ctx || width <= 0 || height <= 0) return;

  const dt = lastTimestamp ? Math.min((time - lastTimestamp) / 1000, 0.064) : 0.016;
  lastTimestamp = time;

  // 1. 参数解构
  const godraysIntensity = typeof params?.godraysIntensity === "number" ? params.godraysIntensity : 1.2;
  const targetParticleCount = typeof params?.particleCount === "number" ? Math.round(params.particleCount) : 450;
  const inkSpeedMult = typeof params?.inkFlowSpeed === "number" ? params.inkFlowSpeed : 1.0;
  const showPoetry = params?.showPoetry !== false && params?.showPoetry !== 0;
  const filmVignette = typeof params?.filmVignette === "number" ? params.filmVignette : 0.65;
  const schemeIndex = typeof params?.colorScheme === "number" ? Math.max(0, Math.min(COLOR_SCHEMES.length - 1, params.colorScheme)) : 0;
  const colors = COLOR_SCHEMES[schemeIndex] || COLOR_SCHEMES[0];

  // 2. 音频频段解耦与 EMA 平滑
  let rawBass = 0;
  let rawMid = 0;
  let rawTreble = 0;
  let rawEnergy = 0;

  if (data && data.length >= 32) {
    let bSum = 0;
    for (let i = 1; i <= 6; i++) bSum += data[i] || 0;
    rawBass = bSum / (6 * 255);

    let mSum = 0;
    for (let i = 7; i <= 24; i++) mSum += data[i] || 0;
    rawMid = mSum / (18 * 255);

    let tSum = 0;
    for (let i = 25; i <= 64; i++) tSum += data[i] || 0;
    rawTreble = tSum / (40 * 255);

    rawEnergy = (rawBass * 0.4 + rawMid * 0.4 + rawTreble * 0.2);
  }

  const ema = 0.12;
  smoothedBassVal += (rawBass - smoothedBassVal) * ema;
  smoothedMidVal += (rawMid - smoothedMidVal) * ema;
  smoothedTrebleVal += (rawTreble - smoothedTrebleVal) * ema;
  smoothedEnergyVal += (rawEnergy - smoothedEnergyVal) * ema;

  timeAccum += dt * (0.8 + smoothedMidVal * 0.6 * inkSpeedMult);

  // 3. 延迟初始化资源
  if (!particlesPool) {
    particlesPool = [];
    for (let i = 0; i < targetParticleCount; i++) {
      const z = 0.15 + Math.random() * 0.85;
      particlesPool.push({
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
  }

  if (!shaftsPool) {
    shaftsPool = [
      { angle: 0.58, width: 0.22, intensity: 0.85, speed: 0.08, offset: 0.0 },
      { angle: 0.68, width: 0.16, intensity: 1.10, speed: 0.12, offset: 1.8 },
      { angle: 0.76, width: 0.28, intensity: 0.70, speed: 0.07, offset: 3.5 },
      { angle: 0.88, width: 0.19, intensity: 0.95, speed: 0.10, offset: 5.1 },
      { angle: 0.98, width: 0.25, intensity: 0.60, speed: 0.06, offset: 2.2 },
    ];
  }

  if (!inkWavesPool) {
    inkWavesPool = [
      { speed: 0.18, wavelength: 0.0022, amplitude: 35, baseYPercent: 0.52, phase: 0 },
      { speed: 0.26, wavelength: 0.0035, amplitude: 55, baseYPercent: 0.66, phase: 1.5 },
      { speed: 0.38, wavelength: 0.0048, amplitude: 75, baseYPercent: 0.82, phase: 3.2 },
    ];
  }

  if (!goldGlowSprite) goldGlowSprite = createGoldSprite(64);
  if (!flareSprite) flareSprite = createFlareSprite(512, 32);

  // ----------------------------------------------------
  // 4. 绘制背景渐变
  // ----------------------------------------------------
  const bgGrd = ctx.createLinearGradient(0, 0, width * 0.3, height);
  bgGrd.addColorStop(0, colors.bgGradient[0]);
  bgGrd.addColorStop(0.55, colors.bgGradient[1]);
  bgGrd.addColorStop(1.0, colors.bgGradient[2]);
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, width, height);

  // ----------------------------------------------------
  // 5. 绘制体积光柱 (God Rays / 丁达尔晨曦光)
  // ----------------------------------------------------
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const lightSourceX = width * 0.15;
  const lightSourceY = -height * 0.1;
  const maxRayLength = Math.sqrt(width * width + height * height) * 1.3;

  shaftsPool.forEach((shaft, idx) => {
    const dynamicAngle =
      shaft.angle +
      Math.sin(timeAccum * shaft.speed + shaft.offset) * 0.04 +
      (smoothedMidVal - 0.3) * 0.05;

    const dynamicIntensity =
      shaft.intensity *
      godraysIntensity *
      (0.65 + Math.sin(timeAccum * 0.5 + idx) * 0.15 + smoothedMidVal * 0.5);

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
  // 6. 绘制三层水墨流动山峦 (Fluid Ink Wash Waveforms)
  // ----------------------------------------------------
  ctx.save();
  inkWavesPool.forEach((wave, idx) => {
    const baseY = height * wave.baseYPercent;
    const layerColor = colors.inkLayers[idx] || colors.inkLayers[0];
    const audioPulse = idx === 0 ? smoothedMidVal * 25 : idx === 1 ? smoothedBassVal * 40 : smoothedEnergyVal * 30;

    ctx.fillStyle = layerColor;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, baseY);

    const segmentWidth = 16;
    const numSegments = Math.ceil(width / segmentWidth) + 1;

    for (let s = 0; s <= numSegments; s++) {
      const segX = s * segmentWidth;
      const noiseVal =
        Math.sin(segX * wave.wavelength + timeAccum * wave.speed + wave.phase) *
          wave.amplitude +
        Math.cos(segX * wave.wavelength * 1.8 - timeAccum * wave.speed * 0.7) *
          (wave.amplitude * 0.35);

      const curY = baseY + noiseVal - audioPulse;
      ctx.lineTo(segX, curY);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    if (idx < 2) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = colors.ambientGlow;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = colors.goldColor;
      ctx.shadowBlur = 12 + smoothedMidVal * 15;
      ctx.stroke();
      ctx.restore();
    }
  });
  ctx.restore();

  // ----------------------------------------------------
  // 7. 物理动力学与金箔微粒渲染 (3D Floating Gold Flakes)
  // ----------------------------------------------------
  ctx.save();
  const trebleBoost = smoothedTrebleVal * 1.8;

  particlesPool.forEach((p) => {
    const windAngle = pseudoNoise(p.x * 0.0012, p.y * 0.0012 + timeAccum * 0.2) * Math.PI * 2;
    const windForce = (0.15 + smoothedMidVal * 0.3) * p.z;

    p.vx += Math.cos(windAngle) * windForce * dt;
    p.vy += (Math.sin(windAngle) * windForce * 0.5 - 0.2 * p.z) * dt;

    p.vx *= 0.96;
    p.vy *= 0.96;

    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.rotation += p.vRot * (1.0 + smoothedMidVal);

    if (p.y < -30) {
      p.y = height + 20;
      p.x = Math.random() * width;
    }
    if (p.x < -30) p.x = width + 20;
    if (p.x > width + 30) p.x = -20;

    p.twinklePhase += dt * p.twinkleSpeed;
    const twinkle = Math.sin(p.twinklePhase) * 0.35 + 0.65;
    p.alpha = Math.min(1.0, p.baseAlpha * twinkle * (0.8 + trebleBoost));

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.scale(1.0, p.aspectRatio);

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

    if (p.z > 0.65 && goldGlowSprite) {
      ctx.globalCompositeOperation = "screen";
      const glowSize = halfSize * 6;
      ctx.drawImage(goldGlowSprite, -glowSize / 2, -glowSize / 2, glowSize, glowSize);
    }

    ctx.restore();
  });
  ctx.restore();

  // ----------------------------------------------------
  // 8. 变形镜头光晕 (Anamorphic Flare)
  // ----------------------------------------------------
  if (flareSprite && smoothedTrebleVal > 0.35) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const flareAlpha = Math.min(0.65, (smoothedTrebleVal - 0.35) * 1.5);
    ctx.globalAlpha = flareAlpha;
    const flareW = width * 0.8;
    const flareH = 24;
    ctx.drawImage(flareSprite, (width - flareW) / 2, height * 0.62 - flareH / 2, flareW, flareH);
    ctx.restore();
  }

  // ----------------------------------------------------
  // 9. 东方意境诗词浮现层
  // ----------------------------------------------------
  if (showPoetry) {
    poemTimer += dt;
    const cycleTime = 14;
    const progress = poemTimer % cycleTime;

    if (progress < 2.0) {
      poemAlpha = progress / 2.0;
    } else if (progress < 12.0) {
      poemAlpha = 1.0;
    } else {
      poemAlpha = Math.max(0, (cycleTime - progress) / 2.0);
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
      const textY = height - 44;

      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = `rgba(245, 235, 215, ${poemAlpha * 0.85})`;
      ctx.fillText(currentPoem.line, textX, textY);

      ctx.font = '300 11px "Noto Serif SC", serif';
      ctx.fillStyle = `rgba(200, 185, 160, ${poemAlpha * 0.55})`;
      ctx.fillText(`— ${currentPoem.author}`, textX, textY + 22);

      const stampX = textX + 16;
      const stampY = textY - 2;
      ctx.fillStyle = `rgba(215, 50, 40, ${poemAlpha * 0.85})`;
      ctx.fillRect(stampX - 8, stampY - 8, 16, 16);
      ctx.strokeStyle = `rgba(255, 200, 180, ${poemAlpha * 0.9})`;
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

  // ----------------------------------------------------
  // 10. 电影级慢呼吸暗角 (Cinematic Vignette)
  // ----------------------------------------------------
  if (filmVignette > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const cx = width / 2;
    const cy = height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    const vigGrd = ctx.createRadialGradient(cx, cy, maxDist * 0.35, cx, cy, maxDist);
    vigGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    vigGrd.addColorStop(0.7, "rgba(220, 220, 220, 0.95)");
    vigGrd.addColorStop(1.0, "rgba(0, 0, 0, 0.75)");

    ctx.fillStyle = vigGrd;
    ctx.globalAlpha = filmVignette * (0.85 + Math.sin(timeAccum * 0.4) * 0.08);
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
