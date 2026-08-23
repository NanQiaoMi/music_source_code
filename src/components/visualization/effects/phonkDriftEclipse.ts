/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

// ─── 数据结构定义 ───
interface SpeedWarpLaser {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  speed: number;
  alpha: number;
  hue: number;
  size: number;
}

interface CinematicBokehOrb {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  vx: number;
  vy: number;
  hue: number;
  phase: number;
}

interface ConcentricShockwave {
  z: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  color: string;
}

// ─── 模块级高性能静态对象池与单例缓存（0 GC 垃圾回收零卡顿） ───
let speedWarpLasers: SpeedWarpLaser[] = [];
let cinematicBokehOrbs: CinematicBokehOrb[] = [];
let activeShockwaves: ConcentricShockwave[] = [];

let filmGrainCanvas: HTMLCanvasElement | null = null;
let filmGrainPattern: CanvasPattern | null = null;

let prevBass = 0;
let prevMid = 0;
let prevTreble = 0;
let prevSuperBass = 0;
let roadScroll = 0;
let diskRotation = 0;
let breathLFO = 0;
let lastCanvasW = 0;
let lastCanvasH = 0;

const LASER_COUNT = 400;
const BOKEH_COUNT = 32;

function getOrCreateFilmGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (filmGrainPattern) return filmGrainPattern;
  if (!filmGrainCanvas && typeof document !== "undefined") {
    filmGrainCanvas = document.createElement("canvas");
    filmGrainCanvas.width = 128;
    filmGrainCanvas.height = 128;
    const gCtx = filmGrainCanvas.getContext("2d")!;
    const imgData = gCtx.createImageData(128, 128);
    const buf = imgData.data;
    for (let i = 0; i < buf.length; i += 4) {
      const val = Math.random() * 255;
      buf[i] = val;
      buf[i + 1] = val;
      buf[i + 2] = val;
      buf[i + 3] = 3; // 1.2% 细腻胶片颗粒
    }
    gCtx.putImageData(imgData, 0, 0);
    filmGrainPattern = ctx.createPattern(filmGrainCanvas, "repeat");
  }
  return filmGrainPattern;
}

function initPools(width: number, height: number) {
  if (speedWarpLasers.length >= LASER_COUNT && Math.abs(lastCanvasW - width) < 40) return;
  lastCanvasW = width;
  lastCanvasH = height;

  // 1. 高速穿梭光轨 (Speed Warp Lasers)
  speedWarpLasers = [];
  for (let i = 0; i < LASER_COUNT; i++) {
    speedWarpLasers.push({
      x: (Math.random() - 0.5) * width * 2.5,
      y: (Math.random() - 0.5) * height * 1.6,
      z: Math.random() * 1000 + 10,
      prevZ: 0,
      speed: Math.random() * 2.2 + 1.2,
      alpha: Math.random() * 0.7 + 0.3,
      hue: Math.random() > 0.5 ? 330 : 190,
      size: Math.random() * 1.8 + 0.7,
    });
  }

  // 2. 电影级柔焦失焦光斑 (Cinematic Bokeh Orbs)
  cinematicBokehOrbs = [];
  for (let i = 0; i < BOKEH_COUNT; i++) {
    cinematicBokehOrbs.push({
      x: Math.random() * width,
      y: height * 0.42 + Math.random() * height * 0.58,
      radius: Math.random() * 26 + 10,
      alpha: Math.random() * 0.14 + 0.04,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -Math.random() * 0.5 - 0.15,
      hue: Math.random() > 0.5 ? 185 : 320,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

/**
 * 赛博漂移 · 电影级日蚀特异点 (Phonk Drift Eclipse 15.0 - Mathematical Unified Accretion Cinema Edition)
 * 数学一体化闭合相对论流体吸积盘、爱因斯坦-罗森重力井、无断层无色块、2.39:1 宽银幕光学
 */
export function drawPhonkDriftEclipse({
  ctx,
  width,
  height,
  data,
  params,
  theme,
}: EffectContext) {
  initPools(width, height);

  const bassIntensity = params?.bassIntensity ?? 1.25;
  const cruiseSpeed = params?.cruiseSpeed ?? 1.35;
  const colorMode = params?.colorMode ?? 0;

  // ─── 1. 音频频段解耦 ───
  let subBassRaw = 0;
  for (let i = 1; i <= 3; i++) subBassRaw += data[i] || 0;
  subBassRaw = subBassRaw / (3 * 255);

  let bassRaw = 0;
  for (let i = 4; i <= 8; i++) bassRaw += data[i] || 0;
  bassRaw = bassRaw / (5 * 255);

  let cowbellMidRaw = 0;
  for (let i = 9; i <= 28; i++) cowbellMidRaw += data[i] || 0;
  cowbellMidRaw = cowbellMidRaw / (20 * 255);

  let hihatTrebleRaw = 0;
  for (let i = 35; i <= 95; i++) hihatTrebleRaw += data[i] || 0;
  hihatTrebleRaw = hihatTrebleRaw / (61 * 255);

  const superBass = subBassRaw > prevSuperBass ? prevSuperBass * 0.08 + subBassRaw * 0.92 : prevSuperBass * 0.94 + subBassRaw * 0.06;
  prevSuperBass = superBass;

  const bass = bassRaw > prevBass ? prevBass * 0.10 + bassRaw * 0.90 : prevBass * 0.94 + bassRaw * 0.06;
  prevBass = bass;

  const mid = cowbellMidRaw > prevMid ? prevMid * 0.14 + cowbellMidRaw * 0.86 : prevMid * 0.92 + cowbellMidRaw * 0.08;
  prevMid = mid;

  const treble = hihatTrebleRaw > prevTreble ? prevTreble * 0.18 + hihatTrebleRaw * 0.82 : prevTreble * 0.88 + hihatTrebleRaw * 0.12;
  prevTreble = treble;

  breathLFO += 0.015;
  const organicBreath = Math.sin(breathLFO) * 0.5 + 0.5;

  // 808 重低音爆发全屏同心引力激波
  if (superBass > 0.78 && Math.random() < 0.32 && activeShockwaves.length < 5) {
    activeShockwaves.push({
      z: 0.01,
      radius: 20,
      maxRadius: Math.max(width, height) * 0.95,
      alpha: 0.85,
      speed: 0.024 + superBass * 0.018,
      color: colorMode === 2 ? "#ff3366" : colorMode === 3 ? "#ffd700" : "#00f0ff",
    });
  }

  // 主题色彩映射
  let primaryHue = theme?.primary ?? 295;
  let secondaryHue = theme?.secondary ?? 185;
  let accentHue = theme?.accent ?? 335;

  if (colorMode === 1) {
    primaryHue = 320;
    secondaryHue = 180;
    accentHue = 275;
  } else if (colorMode === 2) {
    primaryHue = 355;
    secondaryHue = 16;
    accentHue = 0;
  } else if (colorMode === 3) {
    primaryHue = 45;
    secondaryHue = 205;
    accentHue = 55;
  }

  // 优雅温润高光色相：柔和香槟紫罗兰，告别刺眼电光青蓝
  const softHighlightHue = (primaryHue + 20) % 360;

  // 镜头 Z 轴弹性推拉震颤与漂移摆幅
  const zPunch = superBass > 0.6 ? (superBass - 0.6) * 16 * bassIntensity : 0;
  const cameraSway = Math.sin(breathLFO * 0.55) * 0.014 * (1 + superBass * 0.4);
  let shakeX = 0;
  let shakeY = 0;
  if (superBass > 0.55) {
    const shakeMag = (superBass - 0.55) * 15 * bassIntensity;
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag * 0.6;
  }

  const cx = width * 0.5 + shakeX;
  const horizonY = height * 0.47 + shakeY;
  const blackHoleY = horizonY - height * 0.055 - zPunch * 0.5;

  // 黑洞事件视界物理半径与 3D 旋转
  const eventHorizonR = Math.min(width, height) * (0.118 + superBass * 0.038 * bassIntensity + organicBreath * 0.005);
  diskRotation += (0.009 + cruiseSpeed * 0.003 + superBass * 0.014);

  ctx.save();

  // ─── 0. 底层深邃曜石黑纯黑虚空 ───
  ctx.fillStyle = "#010103";
  ctx.fillRect(0, 0, width, height);

  // ─── 1. 深空全域大气色阶 (Volumetric Deep Sky Atmosphere) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const skyGrd = ctx.createRadialGradient(cx, blackHoleY, eventHorizonR * 0.8, cx, blackHoleY, Math.max(width, height) * 0.75);
  skyGrd.addColorStop(0, `hsla(${softHighlightHue}, 80%, 70%, ${0.15 + superBass * 0.10})`);
  skyGrd.addColorStop(0.35, `hsla(${primaryHue}, 75%, 50%, ${0.08 + mid * 0.05})`);
  skyGrd.addColorStop(0.70, `hsla(${accentHue}, 70%, 30%, 0.02)`);
  skyGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // ─── 2. 远景东京赛博大厦微光天际线 (Tokyo Cyber Skyline) ───
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const bCount = 36;
  const bStep = width / bCount;
  ctx.fillStyle = "#030307";
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  for (let i = 0; i <= bCount; i++) {
    const bx = i * bStep;
    const distRatio = Math.abs(bx - cx) / (width * 0.5);
    const isBuilding = i % 2 === 0 && distRatio > 0.28;
    const bHeight = isBuilding
      ? (36 + Math.sin(i * 3.7) * 28) * Math.pow(distRatio, 1.2)
      : (Math.sin(i * 1.5 + breathLFO * 0.2) * 0.5 + 0.5) * 25 * Math.pow(distRatio, 1.4);
    ctx.lineTo(bx, horizonY - bHeight);
    if (isBuilding) {
      ctx.lineTo(bx + bStep * 0.85, horizonY - bHeight);
    }
  }
  ctx.lineTo(width, horizonY);
  ctx.closePath();
  ctx.fill();

  // 建筑顶部红色航空指示微光灯
  for (let i = 0; i <= bCount; i++) {
    const bx = i * bStep;
    const distRatio = Math.abs(bx - cx) / (width * 0.5);
    if (i % 2 === 0 && distRatio > 0.28) {
      const bHeight = (36 + Math.sin(i * 3.7) * 28) * Math.pow(distRatio, 1.2);
      ctx.fillStyle = "#ff1133";
      ctx.globalAlpha = Math.sin(breathLFO * 3 + i) > 0.2 ? 0.75 : 0.2;
      ctx.beginPath();
      ctx.arc(bx + bStep * 0.42, horizonY - bHeight - 3, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // ─── 3. 真实《星际穿越》超轻量 GPU 硬件级柔光吸积盘 (Silky Soft Volumetric Accretion Engine) ───
  // 告别 95 层繁重 CPU 计算与杂乱线条，彻底消除卡顿，呈现纯净、柔美、温润的电影级天体柔光！
  const diskTilt = 0.22;
  const minR = eventHorizonR * 1.05;
  const maxR = eventHorizonR * (2.8 + superBass * 0.35);

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // ─── 3.1 【背光拱高斯柔光云团 (Upper Lensed Corona Soft Glow)】───
  const upperArchGrd = ctx.createRadialGradient(
    cx,
    blackHoleY - eventHorizonR * 0.45,
    eventHorizonR * 0.75,
    cx,
    blackHoleY - eventHorizonR * 0.45,
    maxR * 1.05
  );
  upperArchGrd.addColorStop(0, `hsla(${softHighlightHue}, 85%, 82%, ${0.40 + superBass * 0.18})`);
  upperArchGrd.addColorStop(0.28, `hsla(${primaryHue}, 80%, 65%, ${0.25 + mid * 0.10})`);
  upperArchGrd.addColorStop(0.68, `hsla(${accentHue}, 75%, 45%, 0.06)`);
  upperArchGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = upperArchGrd;
  ctx.beginPath();
  ctx.ellipse(cx, blackHoleY - eventHorizonR * 0.40, maxR * 0.95, maxR * 0.75, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // ─── 3.2 【背部 8 条精美高斯羽化流动细光环 (8 Silky Back Streamlines)】───
  const NUM_RINGS = 8;
  const ANGULAR_STEPS = 32;

  for (let k = 0; k < NUM_RINGS; k++) {
    const frac = k / (NUM_RINGS - 1);
    const r = minR + Math.pow(frac, 1.2) * (maxR - minR);
    const ringSpeed = (0.008 + (1 / Math.sqrt(r * 2)) * 0.18) * (1 + superBass * 1.4);
    const ringRot = diskRotation * ringSpeed * 28;

    const baseAlpha = (1 - frac * 0.75) * (0.24 + superBass * 0.16);
    const ringHue = frac < 0.3 ? softHighlightHue : frac < 0.7 ? primaryHue : accentHue;
    const ringLight = frac < 0.2 ? 82 : frac < 0.6 ? 68 : 50;

    ctx.beginPath();
    let started = false;
    for (let j = 0; j <= ANGULAR_STEPS / 2; j++) {
      const theta = Math.PI + (j / (ANGULAR_STEPS / 2)) * Math.PI;
      const curR = r + Math.sin(theta * 3 + ringRot) * (1.2 + superBass * 1.5);
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const px = cx + curR * cosT;
      const lensedY = blackHoleY - Math.abs(sinT) * curR * (0.80 - 0.22 * (eventHorizonR / curR));
      if (!started) {
        ctx.moveTo(px, lensedY);
        started = true;
      } else {
        ctx.lineTo(px, lensedY);
      }
    }
    ctx.strokeStyle = `hsla(${ringHue}, 80%, ${ringLight}%, ${baseAlpha})`;
    ctx.lineWidth = Math.max(1.2, (1 - frac) * 3.5 + superBass * 1.8);
    ctx.stroke();
  }

  // ─── 3.3 【事件视界绝对纯黑吞噬内核 (Pure Black Event Horizon Void)】───
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const voidGrd = ctx.createRadialGradient(cx, blackHoleY, 0, cx, blackHoleY, eventHorizonR);
  voidGrd.addColorStop(0, "#010103");
  voidGrd.addColorStop(0.92, "#010103");
  voidGrd.addColorStop(0.98, "#040308");
  voidGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = voidGrd;
  ctx.beginPath();
  ctx.arc(cx, blackHoleY, eventHorizonR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ─── 3.4 【前主盘高斯柔光云团 (Front Equatorial Disk Soft Glow)】───
  const frontDiskGrd = ctx.createRadialGradient(
    cx,
    blackHoleY + eventHorizonR * 0.25,
    eventHorizonR * 0.70,
    cx,
    blackHoleY + eventHorizonR * 0.25,
    maxR * 1.05
  );
  frontDiskGrd.addColorStop(0, `hsla(${softHighlightHue}, 85%, 82%, ${0.35 + superBass * 0.16})`);
  frontDiskGrd.addColorStop(0.30, `hsla(${primaryHue}, 80%, 65%, ${0.22 + mid * 0.08})`);
  frontDiskGrd.addColorStop(0.70, `hsla(${accentHue}, 75%, 45%, 0.05)`);
  frontDiskGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = frontDiskGrd;
  ctx.beginPath();
  ctx.ellipse(cx, blackHoleY + eventHorizonR * 0.25, maxR * 0.98, maxR * diskTilt * 1.6, 0, 0, Math.PI);
  ctx.fill();

  // ─── 3.5 【前部 8 条精美高斯羽化流动细光环 (8 Silky Front Streamlines)】───
  for (let k = 0; k < NUM_RINGS; k++) {
    const frac = k / (NUM_RINGS - 1);
    const r = minR + Math.pow(frac, 1.2) * (maxR - minR);
    const ringSpeed = (0.008 + (1 / Math.sqrt(r * 2)) * 0.18) * (1 + superBass * 1.4);
    const ringRot = diskRotation * ringSpeed * 28;

    const baseAlpha = (1 - frac * 0.70) * (0.26 + superBass * 0.18);
    const ringHue = frac < 0.3 ? softHighlightHue : frac < 0.7 ? primaryHue : accentHue;
    const ringLight = frac < 0.2 ? 84 : frac < 0.6 ? 70 : 52;

    ctx.beginPath();
    let started = false;
    for (let j = 0; j <= ANGULAR_STEPS / 2; j++) {
      const theta = (j / (ANGULAR_STEPS / 2)) * Math.PI;
      const curR = r + Math.sin(theta * 3 + ringRot) * (1.2 + superBass * 1.5);
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const px = cx + curR * cosT;
      const frontY = blackHoleY + sinT * curR * diskTilt;
      if (!started) {
        ctx.moveTo(px, frontY);
        started = true;
      } else {
        ctx.lineTo(px, frontY);
      }
    }
    ctx.strokeStyle = `hsla(${ringHue}, 80%, ${ringLight}%, ${baseAlpha})`;
    ctx.lineWidth = Math.max(1.2, (1 - frac) * 3.8 + superBass * 2.0);
    ctx.stroke();
  }

  // ─── 3.6 【极细柔和光子球临界薄环 (Soft Photon Sphere Rim)】───
  const photonSphereR = eventHorizonR * 1.02;
  ctx.strokeStyle = `hsla(${softHighlightHue}, 85%, 85%, ${0.65 + superBass * 0.10})`;
  ctx.lineWidth = 1.2 + superBass * 1.0;
  ctx.shadowColor = `hsla(${primaryHue}, 85%, 65%, 0.45)`;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(cx, blackHoleY, photonSphereR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ─── 3.7 【2.39:1 变形宽银幕双向柔光透镜光梭 (Soft Anamorphic Spindles)】───
  const flareRadiusX = width * (0.38 + superBass * 0.10);
  const flareRadiusY = 10 + superBass * 10;

  // 左侧柔光光梭
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, cx - eventHorizonR * 1.02, height);
  ctx.clip();
  const leftGrd = ctx.createRadialGradient(
    cx - eventHorizonR * 1.05,
    blackHoleY,
    0,
    cx - eventHorizonR * 1.05,
    blackHoleY,
    flareRadiusX
  );
  leftGrd.addColorStop(0, `hsla(${softHighlightHue}, 85%, 85%, ${0.35 + superBass * 0.12})`);
  leftGrd.addColorStop(0.35, `hsla(${primaryHue}, 75%, 60%, 0.12)`);
  leftGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = leftGrd;
  ctx.beginPath();
  ctx.ellipse(cx - eventHorizonR * 1.05 - flareRadiusX * 0.40, blackHoleY, flareRadiusX * 0.50, flareRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 右侧柔光光梭
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx + eventHorizonR * 1.02, 0, width, height);
  ctx.clip();
  const rightGrd = ctx.createRadialGradient(
    cx + eventHorizonR * 1.05,
    blackHoleY,
    0,
    cx + eventHorizonR * 1.05,
    blackHoleY,
    flareRadiusX * 0.85
  );
  rightGrd.addColorStop(0, `hsla(${accentHue}, 80%, 75%, ${0.28 + superBass * 0.10})`);
  rightGrd.addColorStop(0.35, `hsla(${primaryHue}, 75%, 60%, 0.08)`);
  rightGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rightGrd;
  ctx.beginPath();
  ctx.ellipse(cx + eventHorizonR * 1.05 + flareRadiusX * 0.35, blackHoleY, flareRadiusX * 0.45, flareRadiusY * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // ─── 4. 808 低音同心超声速引力激波环 (Concentric Gravity Shockwaves) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = activeShockwaves.length - 1; i >= 0; i--) {
    const sw = activeShockwaves[i];
    sw.z += sw.speed;
    sw.alpha *= 0.96;
    if (sw.alpha < 0.02 || sw.z > 1.0) {
      activeShockwaves.splice(i, 1);
      continue;
    }
    const curR = sw.radius + (sw.maxRadius - sw.radius) * Math.pow(sw.z, 1.3);
    ctx.strokeStyle = sw.color;
    ctx.globalAlpha = sw.alpha * 0.40;
    ctx.lineWidth = 1.3 + sw.z * 2.2;
    ctx.beginPath();
    ctx.ellipse(cx, horizonY + sw.z * (height - horizonY) * 0.85, curR, curR * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ─── 5. 爱因斯坦-罗森重力井网格公路 (Einstein Gravity Well Highway) ───
  ctx.save();
  const roadHeight = height - horizonY;
  roadScroll += (0.016 + superBass * 0.024) * cruiseSpeed;

  // 地面全域无缝天体融合底色（彻底消除地平线生硬水平切面色块）
  const groundGrd = ctx.createLinearGradient(0, horizonY - 60, 0, height);
  groundGrd.addColorStop(0, "rgba(1, 1, 3, 0)");
  groundGrd.addColorStop(0.25, `hsla(${primaryHue}, 70%, 6%, 0.60)`);
  groundGrd.addColorStop(0.7, `hsla(${accentHue}, 65%, 4%, 0.95)`);
  groundGrd.addColorStop(1, "#010103");
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, horizonY - 60, width, roadHeight + 60);

  // 湿润沥青路面高斯镜面漫反射倒影锥 (Specular Floor Reflection)
  ctx.globalCompositeOperation = "screen";
  const floorReflectGrd = ctx.createRadialGradient(
    cx,
    horizonY,
    0,
    cx,
    horizonY + roadHeight * 0.5,
    Math.max(width * 0.45, roadHeight * 0.9)
  );
  floorReflectGrd.addColorStop(0, `hsla(${softHighlightHue}, 85%, 70%, ${0.25 + superBass * 0.15})`);
  floorReflectGrd.addColorStop(0.3, `hsla(${primaryHue}, 80%, 50%, ${0.12 + mid * 0.08})`);
  floorReflectGrd.addColorStop(0.7, `hsla(${accentHue}, 75%, 35%, 0.02)`);
  floorReflectGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = floorReflectGrd;
  ctx.fillRect(0, horizonY, width, roadHeight);

  // 3D 弯道与重力井漏斗拉扯
  const LAT_LINES = 26;
  const LONG_LINES = 22;
  const roadHalfW = width * 1.08;
  const gravityFunnelSink = superBass * 45 * bassIntensity;
  const driftOffset = Math.sin(breathLFO * 0.7) * (width * 0.075) * (1 + bass * 0.4);

  // 横向车道线 (随深度弯曲下陷)
  for (let i = 0; i < LAT_LINES; i++) {
    const rawProgress = ((i / LAT_LINES + (roadScroll % (1 / LAT_LINES))) % 1.0);
    const pZ = Math.pow(rawProgress, 2.3);
    if (pZ < 0.015) continue;

    const lineY = horizonY + roadHeight * pZ;
    const spanW = roadHalfW * Math.pow(rawProgress, 1.45);
    if (spanW < 5) continue;

    const swirlOffset = Math.pow(1 - pZ, 2.5) * (superBass * 28);
    const curveX = Math.sin(pZ * Math.PI) * driftOffset + swirlOffset;
    const depthAlpha = Math.min(1.0, Math.pow((pZ - 0.015) * 4.2, 1.2));
    const lineAlpha = Math.min(1.0, pZ * 1.4) * (0.24 + superBass * 0.26) * depthAlpha;

    const centerDip = Math.sin(pZ * Math.PI) * gravityFunnelSink - Math.pow(1 - pZ, 2.2) * (superBass * 25);

    // 底层霓虹晕染
    ctx.strokeStyle = `hsla(${primaryHue}, 85%, 60%, ${lineAlpha * 0.30})`;
    ctx.lineWidth = Math.max(2.0, pZ * 4.2);
    ctx.beginPath();
    ctx.moveTo(cx + curveX - spanW, lineY);
    ctx.quadraticCurveTo(cx + curveX, lineY + centerDip, cx + curveX + spanW, lineY);
    ctx.stroke();

    // 顶层激光核心
    ctx.strokeStyle = `hsla(${primaryHue}, 80%, ${50 + pZ * 20}%, ${lineAlpha * 0.85})`;
    ctx.lineWidth = Math.max(0.65, pZ * 1.8);
    ctx.beginPath();
    ctx.moveTo(cx + curveX - spanW, lineY);
    ctx.quadraticCurveTo(cx + curveX, lineY + centerDip, cx + curveX + spanW, lineY);
    ctx.stroke();
  }

  // 纵向延伸车道线 (3D 漏斗曲率向上弯曲直接卷入黑洞视界下沿，零水平断层硬切)
  for (let j = 0; j <= LONG_LINES; j++) {
    const normX = (j / LONG_LINES - 0.5) * 2;
    const isCenterLane = Math.abs(normX) < 0.08;
    const isOuterRail = Math.abs(normX) > 0.88;

    const baseAlpha = isCenterLane ? 0.72 + superBass * 0.12 : isOuterRail ? 0.65 + mid * 0.16 : (0.24 + (1 - Math.abs(normX)) * 0.28) * (0.50 + superBass * 0.30);
    const laneHue = isCenterLane ? softHighlightHue : isOuterRail ? accentHue : primaryHue;
    const laneSat = isCenterLane || isOuterRail ? 85 : 80;
    const laneLight = isCenterLane ? 75 : isOuterRail ? 68 : 52;

    // 底层柔光
    const bGrd = ctx.createLinearGradient(0, horizonY, 0, height);
    bGrd.addColorStop(0, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, 0)`);
    bGrd.addColorStop(0.18, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.10})`);
    bGrd.addColorStop(0.6, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.28})`);
    bGrd.addColorStop(1, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.38})`);

    ctx.strokeStyle = bGrd;
    ctx.lineWidth = isCenterLane ? 4.2 : isOuterRail ? 3.4 : 1.8;

    const endX = cx + normX * roadHalfW;
    const controlDip = isCenterLane ? gravityFunnelSink * 0.8 : gravityFunnelSink * 0.3 * (1 - Math.abs(normX));
    const laneSwirl = Math.sin(normX * Math.PI) * (superBass * 18);

    // 消失点平滑汇聚至黑洞视界下沿
    ctx.beginPath();
    ctx.moveTo(cx + normX * (eventHorizonR * 0.18), blackHoleY + eventHorizonR * 0.95);
    ctx.quadraticCurveTo(
      cx + normX * (roadHalfW * 0.36) + driftOffset * 0.7 + laneSwirl,
      horizonY + roadHeight * 0.45 + controlDip,
      endX,
      height
    );
    ctx.stroke();

    // 顶层核心激光
    const cGrd = ctx.createLinearGradient(0, horizonY, 0, height);
    cGrd.addColorStop(0, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, 0)`);
    cGrd.addColorStop(0.18, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.15})`);
    cGrd.addColorStop(0.6, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.55})`);
    cGrd.addColorStop(1, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.85})`);

    ctx.strokeStyle = cGrd;
    ctx.lineWidth = isCenterLane ? 1.6 : isOuterRail ? 1.3 : 0.75;

    ctx.beginPath();
    ctx.moveTo(cx + normX * (eventHorizonR * 0.18), blackHoleY + eventHorizonR * 0.95);
    ctx.quadraticCurveTo(
      cx + normX * (roadHalfW * 0.36) + driftOffset * 0.7 + laneSwirl,
      horizonY + roadHeight * 0.45 + controlDip,
      endX,
      height
    );
    ctx.stroke();
  }

  // 地平线深空羽化薄雾
  const mistRadialGrd = ctx.createRadialGradient(
    cx,
    horizonY,
    0,
    cx,
    horizonY,
    Math.max(width * 0.55, 260)
  );
  mistRadialGrd.addColorStop(0, `hsla(${softHighlightHue}, 85%, 65%, ${0.16 + superBass * 0.08})`);
  mistRadialGrd.addColorStop(0.4, `hsla(${primaryHue}, 80%, 35%, ${0.08 + superBass * 0.04})`);
  mistRadialGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mistRadialGrd;
  ctx.fillRect(0, horizonY - 35, width, 75);

  ctx.restore();

  // ─── 7. 极速穿梭光轨与电影级失焦光斑 (Speed Warp Lasers & Bokeh Orbs) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const speedMultLaser = (1.0 + treble * 3.0 + superBass * 2.0) * cruiseSpeed;
  const laserFov = 480;

  for (let i = 0; i < speedWarpLasers.length; i++) {
    const st = speedWarpLasers[i];
    st.prevZ = st.z;
    st.z -= st.speed * 8.5 * speedMultLaser;

    if (st.z <= 1) {
      st.z = 1000;
      st.prevZ = 1000;
      st.x = (Math.random() - 0.5) * width * 2.5;
      st.y = (Math.random() - 0.5) * height * 1.6;
    }

    const cosS = Math.cos(cameraSway);
    const sinS = Math.sin(cameraSway);
    let rotX = st.x * cosS - st.y * sinS;
    let rotY = st.y * cosS + st.x * sinS;

    const distToCenter = Math.hypot(rotX, rotY);
    if (distToCenter > 15) {
      const deflectionAngle = Math.atan2(rotY, rotX);
      const deflectionForce = (eventHorizonR * 420) / (distToCenter + 100);
      rotX += Math.cos(deflectionAngle + Math.PI * 0.5) * (deflectionForce * 0.22 * (1 + superBass));
      rotY += Math.sin(deflectionAngle + Math.PI * 0.5) * (deflectionForce * 0.22 * (1 + superBass));
    }

    const screenX = cx + (rotX / st.z) * laserFov;
    const screenY = horizonY + (rotY / st.z) * laserFov;
    const prevX = cx + (rotX / st.prevZ) * laserFov;
    const prevY = horizonY + (rotY / st.prevZ) * laserFov;

    if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50) continue;

    const scale = (1000 - st.z) / 1000;
    const alpha = st.alpha * Math.pow(scale, 1.2) * (0.55 + treble * 0.35);

    if (speedMultLaser > 1.6) {
      ctx.strokeStyle = `hsla(${st.hue}, 100%, 80%, ${alpha})`;
      ctx.lineWidth = Math.max(0.85, st.size * scale * 1.5);
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(screenX, screenY);
      ctx.stroke();
    } else {
      ctx.fillStyle = `hsla(${st.hue}, 95%, 85%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, st.size * (0.5 + scale * 1.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 漂移失焦霓虹光斑
  for (let i = 0; i < cinematicBokehOrbs.length; i++) {
    const orb = cinematicBokehOrbs[i];
    orb.phase += 0.02;
    orb.x += orb.vx * (1 + superBass * 1.2);
    orb.y += orb.vy * (1 + superBass * 0.8);
    if (orb.y < horizonY - 50) {
      orb.y = height + 20;
      orb.x = Math.random() * width;
    }
    if (orb.x < -30) orb.x = width + 30;
    if (orb.x > width + 30) orb.x = -30;

    const orbGrd = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
    const orbAlpha = orb.alpha * (0.7 + Math.sin(orb.phase) * 0.3) * (1 + superBass * 0.6);
    orbGrd.addColorStop(0, `hsla(${orb.hue}, 100%, 75%, ${orbAlpha})`);
    orbGrd.addColorStop(0.5, `hsla(${orb.hue}, 90%, 55%, ${orbAlpha * 0.35})`);
    orbGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = orbGrd;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // ─── 8. 35mm 电影胶片质感与 2.39:1 柔和暗角 ───
  ctx.save();
  const grain = getOrCreateFilmGrain(ctx);
  if (grain) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.globalCompositeOperation = "source-over";
  const vigGrd = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.38,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.85
  );
  vigGrd.addColorStop(0, "rgba(0,0,0,0)");
  vigGrd.addColorStop(1, "rgba(0,0,0,0.70)");
  ctx.fillStyle = vigGrd;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

