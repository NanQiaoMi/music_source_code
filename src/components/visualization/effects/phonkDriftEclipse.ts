/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface KeplerianStar {
  radius: number;
  angle: number;
  speed: number;
  height: number;
  size: number;
  alpha: number;
  hue: number;
}

interface SpeedLaser {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  speed: number;
  alpha: number;
  hue: number;
  length: number;
}

interface BokehOrb {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  vx: number;
  vy: number;
  hue: number;
}

// 模块级静态缓存与对象池 (0 GC 性能优化)
let accretionStars: KeplerianStar[] = [];
let speedLasers: SpeedLaser[] = [];
let bokehOrbs: BokehOrb[] = [];

let cachedGlowSprite: HTMLCanvasElement | null = null;
let cachedNebulaSprite: HTMLCanvasElement | null = null;
let filmGrainCanvas: HTMLCanvasElement | null = null;
let filmGrainPattern: CanvasPattern | null = null;

let prevBass = 0;
let prevMid = 0;
let prevTreble = 0;
let prevSuperBass = 0;
let roadScroll = 0;
let accretionRotation = 0;
let breathLFO = 0;

const STAR_COUNT = 1600;
const LASER_COUNT = 450;
const BOKEH_COUNT = 36;

// 高性能 Sprite 预生成
function getOrCreateSprites() {
  if (typeof document === "undefined") return;
  if (!cachedGlowSprite) {
    cachedGlowSprite = document.createElement("canvas");
    cachedGlowSprite.width = 128;
    cachedGlowSprite.height = 128;
    const g = cachedGlowSprite.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255, 255, 255, 1)");
    grd.addColorStop(0.25, "rgba(100, 240, 255, 0.7)");
    grd.addColorStop(0.65, "rgba(255, 60, 180, 0.2)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  if (!cachedNebulaSprite) {
    cachedNebulaSprite = document.createElement("canvas");
    cachedNebulaSprite.width = 128;
    cachedNebulaSprite.height = 128;
    const g = cachedNebulaSprite.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255, 200, 255, 0.8)");
    grd.addColorStop(0.35, "rgba(255, 80, 160, 0.35)");
    grd.addColorStop(0.7, "rgba(60, 180, 255, 0.08)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
}

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
      buf[i + 3] = 4; // 1.5% 电影胶片颗粒
    }
    gCtx.putImageData(imgData, 0, 0);
    filmGrainPattern = ctx.createPattern(filmGrainCanvas, "repeat");
  }
  return filmGrainPattern;
}

function initPools(width: number, height: number) {
  if (accretionStars.length >= STAR_COUNT) return;
  getOrCreateSprites();

  // 1. 开普勒物理向心吸积盘粒子群
  accretionStars = [];
  const arms = 4;
  for (let i = 0; i < STAR_COUNT; i++) {
    const arm = i % arms;
    const armAngle = (arm / arms) * Math.PI * 2;
    const distFrac = Math.pow(Math.random(), 1.4);
    const r = 40 + distFrac * (Math.min(width, height) * 0.48);
    const spiralAngle = armAngle + Math.log(r * 0.05 + 1) * 3.6 + (Math.random() - 0.5) * 0.35;
    const speed = (0.012 + (1 / Math.sqrt(r + 5)) * 0.42);
    const heightSpread = (Math.random() - 0.5) * (4 + (r / 350) * 16);

    accretionStars.push({
      radius: r,
      angle: spiralAngle,
      speed,
      height: heightSpread,
      size: Math.random() * 2.2 + 0.8,
      alpha: Math.random() * 0.7 + 0.3,
      hue: Math.random() > 0.4 ? 185 : 315,
    });
  }

  // 2. 高速穿梭光轨
  speedLasers = [];
  for (let i = 0; i < LASER_COUNT; i++) {
    speedLasers.push({
      x: (Math.random() - 0.5) * width * 2.6,
      y: (Math.random() - 0.5) * height * 1.6,
      z: Math.random() * 1000 + 10,
      prevZ: 0,
      speed: Math.random() * 2.2 + 1.2,
      alpha: Math.random() * 0.7 + 0.3,
      hue: Math.random() > 0.5 ? 330 : 190,
      length: Math.random() * 25 + 10,
    });
  }

  // 3. 漂移光斑与流光微粒
  bokehOrbs = [];
  for (let i = 0; i < BOKEH_COUNT; i++) {
    bokehOrbs.push({
      x: Math.random() * width,
      y: height * 0.45 + Math.random() * height * 0.55,
      radius: Math.random() * 24 + 10,
      alpha: Math.random() * 0.16 + 0.05,
      vx: (Math.random() - 0.5) * 0.8,
      vy: -Math.random() * 0.6 - 0.2,
      hue: Math.random() > 0.5 ? 185 : 320,
    });
  }
}

/**
 * 赛博漂移 · 电影级日蚀特异点 (Phonk Drift Eclipse 11.0 - Master Cinema Prestige)
 * 极致全貌 3D 《星际穿越》卡冈图雅黑洞、开普勒向心引力吸积流、午夜东京湿润沥青倒影
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

  // 1. Phonk 专项音频频段分析
  let subBassRaw = 0;
  for (let i = 1; i <= 3; i++) subBassRaw += data[i] || 0;
  subBassRaw = subBassRaw / (3 * 255);

  let bassRaw = 0;
  for (let i = 4; i <= 8; i++) bassRaw += data[i] || 0;
  bassRaw = bassRaw / (5 * 255);

  let midRaw = 0;
  for (let i = 9; i <= 28; i++) midRaw += data[i] || 0;
  midRaw = midRaw / (20 * 255);

  let trebleRaw = 0;
  for (let i = 35; i <= 95; i++) trebleRaw += data[i] || 0;
  trebleRaw = trebleRaw / (61 * 255);

  const superBass = subBassRaw > prevSuperBass ? prevSuperBass * 0.08 + subBassRaw * 0.92 : prevSuperBass * 0.94 + subBassRaw * 0.06;
  prevSuperBass = superBass;

  const bass = bassRaw > prevBass ? prevBass * 0.10 + bassRaw * 0.90 : prevBass * 0.94 + bassRaw * 0.06;
  prevBass = bass;

  const mid = midRaw > prevMid ? prevMid * 0.14 + midRaw * 0.86 : prevMid * 0.92 + midRaw * 0.08;
  prevMid = mid;

  const treble = trebleRaw > prevTreble ? prevTreble * 0.18 + trebleRaw * 0.82 : prevTreble * 0.88 + trebleRaw * 0.12;
  prevTreble = treble;

  breathLFO += 0.015;
  const organicBreath = Math.sin(breathLFO) * 0.5 + 0.5;

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

  // 镜头震荡与漂移晃动
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
  const blackHoleY = horizonY - height * 0.06; // 黄金分割悬浮位置

  // 黑洞事件视界物理半径与 3D 旋转
  const eventHorizonR = Math.min(width, height) * (0.125 + superBass * 0.045 * bassIntensity + organicBreath * 0.006);
  accretionRotation += (0.010 + cruiseSpeed * 0.005 + superBass * 0.015);

  ctx.save();

  // ─── 0. 底层深邃曜石黑虚空 ───
  ctx.fillStyle = "#010103";
  ctx.fillRect(0, 0, width, height);

  // ─── 1. 深空全域大气色阶与星云光晕 (Volumetric Sky Nebula) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const skyGrd = ctx.createRadialGradient(cx, blackHoleY, eventHorizonR * 0.8, cx, blackHoleY, Math.max(width, height) * 0.88);
  skyGrd.addColorStop(0, `hsla(${primaryHue}, 95%, 65%, ${0.25 + superBass * 0.18})`);
  skyGrd.addColorStop(0.28, `hsla(${secondaryHue}, 85%, 50%, ${0.12 + mid * 0.08})`);
  skyGrd.addColorStop(0.65, `hsla(${accentHue}, 90%, 35%, 0.04)`);
  skyGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // ─── 2. 远景东京赛博大厦剪影天际线 (Tokyo Cyber Skyline) ───
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const bCount = 38;
  const bStep = width / bCount;
  ctx.fillStyle = "#030307";
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  for (let i = 0; i <= bCount; i++) {
    const bx = i * bStep;
    const distRatio = Math.abs(bx - cx) / (width * 0.5);
    const isBuilding = i % 2 === 0 && distRatio > 0.25;
    const bHeight = isBuilding
      ? (34 + Math.sin(i * 3.7) * 28) * Math.pow(distRatio, 1.15)
      : (Math.sin(i * 1.5 + breathLFO * 0.2) * 0.5 + 0.5) * 28 * Math.pow(distRatio, 1.35);
    ctx.lineTo(bx, horizonY - bHeight);
    if (isBuilding) {
      ctx.lineTo(bx + bStep * 0.85, horizonY - bHeight);
    }
  }
  ctx.lineTo(width, horizonY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `hsla(${primaryHue}, 85%, 65%, ${0.18 + mid * 0.20})`;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.restore();

  // ─── 3. 真实《星际穿越》卡冈图雅 3D 物理引力黑洞 (Gargantua Singularity Engine) ───
  // 3D 投影参数：俯角 0.38 rad
  const diskPitch = 0.38 + Math.sin(breathLFO * 0.5) * 0.02;
  const cosP = Math.cos(diskPitch);
  const sinP = Math.sin(diskPitch);
  const cosR = Math.cos(accretionRotation);
  const sinR = Math.sin(accretionRotation);
  const fov = 480;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // A. 顶部引力透镜弯曲光弧 (Upper Lensing Halo: 后方吸积盘被引力拉扯到上方的像)
  // 多层柔和高斯光带，左侧多普勒蓝移白青色，右侧红移暗淡
  const haloBands = 8;
  for (let b = 0; b < haloBands; b++) {
    const bandR = eventHorizonR * (1.20 + b * 0.05 + superBass * 0.20);
    const bandGrd = ctx.createLinearGradient(cx - bandR, blackHoleY, cx + bandR, blackHoleY);
    bandGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 88%, ${0.80 - b * 0.08 + superBass * 0.15})`);
    bandGrd.addColorStop(0.35, `hsla(${primaryHue}, 95%, 72%, ${0.70 - b * 0.07})`);
    bandGrd.addColorStop(1, `hsla(${accentHue}, 90%, 55%, ${0.30 - b * 0.03})`);

    ctx.strokeStyle = bandGrd;
    ctx.lineWidth = Math.max(1.2, 7.0 - b * 0.6 + superBass * 4.0);
    ctx.beginPath();
    ctx.arc(cx, blackHoleY, bandR, Math.PI * 0.95, Math.PI * 2.05);
    ctx.stroke();
  }

  // B. 下部引力透镜微光弧 (Lower Lensing Halo)
  const btmHaloR = eventHorizonR * (1.18 + superBass * 0.15);
  const btmGrd = ctx.createLinearGradient(cx - btmHaloR, blackHoleY, cx + btmHaloR, blackHoleY);
  btmGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 80%, ${0.45 + superBass * 0.2})`);
  btmGrd.addColorStop(0.5, `hsla(${primaryHue}, 90%, 65%, 0.35)`);
  btmGrd.addColorStop(1, `hsla(${accentHue}, 85%, 50%, 0.2)`);
  ctx.strokeStyle = btmGrd;
  ctx.lineWidth = 3.5 + superBass * 3.5;
  ctx.beginPath();
  ctx.arc(cx, blackHoleY, btmHaloR, 0, Math.PI);
  ctx.stroke();

  // C. 1,600+ 物理级向心坍缩开普勒光子微粒流 (Keplerian Infall Photons)
  const photonSpeedMult = 1.0 + superBass * 2.4 + treble * 1.4;
  ctx.lineWidth = 1.1;

  for (let i = 0; i < accretionStars.length; i++) {
    const p = accretionStars[i];
    // 越接近事件视界，角速度和向心速度越呈指数级剧增 (Relativistic Orbital Acceleration)
    const normalizedDist = Math.max(0.04, (p.radius - eventHorizonR) / (width * 0.42));
    const speedFactor = 1.0 + (1.0 / normalizedDist) * 0.65;
    p.angle += p.speed * speedFactor * photonSpeedMult;
    p.radius -= (0.35 + (1.0 / normalizedDist) * 0.22 + superBass * 1.2);

    // 穿过事件视界后在外围重新生成被捕获
    if (p.radius <= eventHorizonR * 0.98) {
      p.radius = eventHorizonR * (1.5 + Math.random() * 2.6);
      p.angle = Math.random() * Math.PI * 2;
    }

    const pxRaw = Math.cos(p.angle) * p.radius;
    const pzRaw = Math.sin(p.angle) * p.radius;
    const pyRaw = p.height;

    const rx = pxRaw * cosR - pzRaw * sinR;
    const rz = pxRaw * sinR + pzRaw * cosR;
    const ry = pyRaw * cosP - rz * sinP;
    const finalZ = pyRaw * sinP + rz * cosP + fov;

    if (finalZ <= 10) continue;
    const scale = fov / finalZ;
    const screenX = cx + rx * scale;
    const screenY = blackHoleY + ry * scale;

    // 遮挡检查：处于黑洞后方且在投影半径内的粒子被遮挡
    const distToCenter = Math.hypot(screenX - cx, screenY - blackHoleY);
    if (rz < 0 && distToCenter < eventHorizonR * 0.95) continue;

    // 切线速度流线拖尾
    const tangentAngle = p.angle + Math.PI * 0.5;
    const streakLen = Math.max(1.8, (140 / Math.max(20, p.radius)) * scale * (1 + superBass * 1.6));
    const endX = screenX + Math.cos(tangentAngle) * streakLen;
    const endY = screenY + Math.sin(tangentAngle) * streakLen * cosP;

    // 相对论多普勒蓝移亮度
    const isApproaching = rx < 0;
    const dopplerAlpha = isApproaching ? 1.5 : 0.55;
    const photonAlpha = Math.min(1.0, (p.radius - eventHorizonR) / (eventHorizonR * 0.8)) * p.alpha * dopplerAlpha * (0.65 + superBass * 0.35);

    if (photonAlpha > 0.04) {
      ctx.strokeStyle = isApproaching
        ? `hsla(${secondaryHue}, 100%, 85%, ${photonAlpha})`
        : `hsla(${primaryHue}, 90%, 65%, ${photonAlpha})`;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  // D. 经典光子球面高能临界光环 (Blazing Photon Sphere Rim)
  const photonSphereR = eventHorizonR * (1.04 + superBass * 0.06);
  const photonGrd = ctx.createLinearGradient(cx - photonSphereR, blackHoleY, cx + photonSphereR, blackHoleY);
  photonGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 92%, ${0.95 + superBass * 0.05})`);
  photonGrd.addColorStop(0.35, `hsla(${primaryHue}, 95%, 75%, 0.85)`);
  photonGrd.addColorStop(1, `hsla(${accentHue}, 90%, 60%, 0.40)`);

  ctx.strokeStyle = photonGrd;
  ctx.lineWidth = 3.6 + superBass * 4.2;
  ctx.beginPath();
  ctx.arc(cx, blackHoleY, photonSphereR, 0, Math.PI * 2);
  ctx.stroke();

  // E. 宽银幕变形水平耀斑 (Anamorphic Streak Flare)
  const flareW = width * (0.92 + superBass * 0.35);
  const flareH = 14 + superBass * 18;
  const flareGrd = ctx.createRadialGradient(cx, blackHoleY, 0, cx, blackHoleY, flareW * 0.5);
  flareGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 90%, ${0.85 + mid * 0.15})`);
  flareGrd.addColorStop(0.2, `hsla(${primaryHue}, 90%, 65%, 0.45)`);
  flareGrd.addColorStop(0.6, `hsla(${accentHue}, 85%, 50%, 0.12)`);
  flareGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = flareGrd;
  ctx.fillRect(cx - flareW * 0.5, blackHoleY - flareH * 0.5, flareW, flareH);

  ctx.restore();

  // F. 事件视界绝对纯黑吞噬内核 (Absolute Pure Black Singularity Void)
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#010103";
  ctx.beginPath();
  ctx.arc(cx, blackHoleY, eventHorizonR, 0, Math.PI * 2);
  ctx.fill();

  // ─── 4. 湿润沥青赛博漂移高速路与倒影系统 (Wet Asphalt Midnight Highway) ───
  ctx.save();
  const roadHeight = height - horizonY;
  roadScroll += (0.016 + superBass * 0.024) * cruiseSpeed;

  // 地面自然连续底色 (无缝深空渐变)
  const groundGrd = ctx.createLinearGradient(0, horizonY - 10, 0, height);
  groundGrd.addColorStop(0, `hsla(${primaryHue}, 75%, 8%, 0.35)`);
  groundGrd.addColorStop(0.12, `hsla(${primaryHue}, 70%, 6%, 0.95)`);
  groundGrd.addColorStop(0.65, `hsla(${secondaryHue}, 65%, 4%, 0.98)`);
  groundGrd.addColorStop(1, "#010103");
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, horizonY - 10, width, roadHeight + 10);

  // 湿润路面高斯漫反射倒影锥 (Specular Floor Reflection)
  ctx.globalCompositeOperation = "screen";
  const floorReflectGrd = ctx.createRadialGradient(
    cx,
    horizonY,
    0,
    cx,
    horizonY + roadHeight * 0.5,
    Math.max(width * 0.45, roadHeight * 0.9)
  );
  floorReflectGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 75%, ${0.36 + superBass * 0.22})`);
  floorReflectGrd.addColorStop(0.3, `hsla(${primaryHue}, 85%, 55%, ${0.18 + mid * 0.12})`);
  floorReflectGrd.addColorStop(0.7, `hsla(${accentHue}, 80%, 40%, 0.04)`);
  floorReflectGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = floorReflectGrd;
  ctx.fillRect(0, horizonY, width, roadHeight);

  // 3D 弯道网格与引力漩涡拉扯
  const LAT_LINES = 24;
  const LONG_LINES = 20;
  const roadHalfW = width * 1.08;
  const gravitySink = superBass * 42 * bassIntensity;
  const driftOffset = Math.sin(breathLFO * 0.7) * (width * 0.07) * (1 + bass * 0.4);

  // 横向车道线 (双层柔光渲染)
  for (let i = 0; i < LAT_LINES; i++) {
    const rawProgress = ((i / LAT_LINES + (roadScroll % (1 / LAT_LINES))) % 1.0);
    const pZ = Math.pow(rawProgress, 2.3);
    if (pZ < 0.02) continue;

    const lineY = horizonY + roadHeight * pZ;
    const spanW = roadHalfW * Math.pow(rawProgress, 1.45);
    if (spanW < 5) continue;

    const swirlOffset = Math.pow(1 - pZ, 2.5) * (superBass * 28);
    const curveX = Math.sin(pZ * Math.PI) * driftOffset + swirlOffset;
    const depthAlpha = Math.min(1.0, Math.pow((pZ - 0.02) * 4.0, 1.2));
    const lineAlpha = Math.min(1.0, pZ * 1.4) * (0.28 + superBass * 0.32) * depthAlpha;

    const centerDip = Math.sin(pZ * Math.PI) * gravitySink;

    // 底层霓虹晕染
    ctx.strokeStyle = `hsla(${primaryHue}, 90%, 65%, ${lineAlpha * 0.35})`;
    ctx.lineWidth = Math.max(2.0, pZ * 4.6);
    ctx.beginPath();
    ctx.moveTo(cx + curveX - spanW, lineY);
    ctx.quadraticCurveTo(cx + curveX, lineY + centerDip, cx + curveX + spanW, lineY);
    ctx.stroke();

    // 顶层平滑核心
    ctx.strokeStyle = `hsla(${primaryHue}, 85%, ${55 + pZ * 22}%, ${lineAlpha})`;
    ctx.lineWidth = Math.max(0.7, pZ * 2.0);
    ctx.beginPath();
    ctx.moveTo(cx + curveX - spanW, lineY);
    ctx.quadraticCurveTo(cx + curveX, lineY + centerDip, cx + curveX + spanW, lineY);
    ctx.stroke();
  }

  // 纵向延伸车道线
  for (let j = 0; j <= LONG_LINES; j++) {
    const normX = (j / LONG_LINES - 0.5) * 2;
    const isCenterLane = Math.abs(normX) < 0.08;
    const isOuterRail = Math.abs(normX) > 0.88;

    const baseAlpha = isCenterLane ? 0.82 + superBass * 0.15 : isOuterRail ? 0.72 + mid * 0.20 : (0.28 + (1 - Math.abs(normX)) * 0.32) * (0.55 + superBass * 0.35);
    const laneHue = isCenterLane ? secondaryHue : isOuterRail ? accentHue : primaryHue;
    const laneSat = isCenterLane || isOuterRail ? 100 : 85;
    const laneLight = isCenterLane ? 80 : isOuterRail ? 72 : 55;

    // 底层柔光
    const bGrd = ctx.createLinearGradient(0, horizonY, 0, height);
    bGrd.addColorStop(0, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, 0)`);
    bGrd.addColorStop(0.2, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.12})`);
    bGrd.addColorStop(0.6, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.32})`);
    bGrd.addColorStop(1, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.42})`);

    ctx.strokeStyle = bGrd;
    ctx.lineWidth = isCenterLane ? 4.8 : isOuterRail ? 3.8 : 2.0;

    const endX = cx + normX * roadHalfW;
    const controlDip = isCenterLane ? gravitySink * 0.8 : gravitySink * 0.3 * (1 - Math.abs(normX));
    const laneSwirl = Math.sin(normX * Math.PI) * (superBass * 18);

    ctx.beginPath();
    ctx.moveTo(cx + normX * (eventHorizonR * 0.2), horizonY);
    ctx.quadraticCurveTo(
      cx + normX * (roadHalfW * 0.36) + driftOffset * 0.7 + laneSwirl,
      horizonY + roadHeight * 0.5 + controlDip,
      endX,
      height
    );
    ctx.stroke();

    // 顶层核心
    const cGrd = ctx.createLinearGradient(0, horizonY, 0, height);
    cGrd.addColorStop(0, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, 0)`);
    cGrd.addColorStop(0.2, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.18})`);
    cGrd.addColorStop(0.6, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.65})`);
    cGrd.addColorStop(1, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha})`);

    ctx.strokeStyle = cGrd;
    ctx.lineWidth = isCenterLane ? 2.0 : isOuterRail ? 1.6 : 0.85;

    ctx.beginPath();
    ctx.moveTo(cx + normX * (eventHorizonR * 0.2), horizonY);
    ctx.quadraticCurveTo(
      cx + normX * (roadHalfW * 0.36) + driftOffset * 0.7 + laneSwirl,
      horizonY + roadHeight * 0.5 + controlDip,
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
  mistRadialGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 70%, ${0.20 + superBass * 0.10})`);
  mistRadialGrd.addColorStop(0.4, `hsla(${primaryHue}, 85%, 40%, ${0.10 + superBass * 0.05})`);
  mistRadialGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mistRadialGrd;
  ctx.fillRect(0, horizonY - 35, width, 75);

  ctx.restore();

  // ─── 5. 极速漂移光轨与流光光斑 (Hyper-Speed Drift Lasers) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const speedMult = (1.0 + treble * 3.0 + superBass * 2.0) * cruiseSpeed;

  for (let i = 0; i < speedLasers.length; i++) {
    const st = speedLasers[i];
    st.prevZ = st.z;
    st.z -= st.speed * 8.5 * speedMult;

    if (st.z <= 1) {
      st.z = 1000;
      st.prevZ = 1000;
      st.x = (Math.random() - 0.5) * width * 2.4;
      st.y = (Math.random() - 0.5) * height * 1.8;
    }

    const cosS = Math.cos(cameraSway);
    const sinS = Math.sin(cameraSway);
    let rotX = st.x * cosS - st.y * sinS;
    let rotY = st.y * cosS + st.x * sinS;

    // 引力偏折
    const distToCenter = Math.hypot(rotX, rotY);
    if (distToCenter > 15) {
      const deflectionAngle = Math.atan2(rotY, rotX);
      const deflectionForce = (eventHorizonR * 420) / (distToCenter + 100);
      rotX += Math.cos(deflectionAngle + Math.PI * 0.5) * (deflectionForce * 0.22 * (1 + superBass));
      rotY += Math.sin(deflectionAngle + Math.PI * 0.5) * (deflectionForce * 0.22 * (1 + superBass));
    }

    const screenX = cx + (rotX / st.z) * fov;
    const screenY = horizonY + (rotY / st.z) * fov;
    const prevX = cx + (rotX / st.prevZ) * fov;
    const prevY = horizonY + (rotY / st.prevZ) * fov;

    if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50) continue;

    const scale = (1000 - st.z) / 1000;
    const alpha = st.alpha * Math.pow(scale, 1.2) * (0.55 + treble * 0.35);

    if (speedMult > 1.6) {
      ctx.strokeStyle = `hsla(${st.hue}, 100%, 80%, ${alpha})`;
      ctx.lineWidth = Math.max(0.85, 1.5 * scale * 1.5);
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(screenX, screenY);
      ctx.stroke();
    } else {
      ctx.fillStyle = `hsla(${st.hue}, 95%, 85%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 1.2 * (0.5 + scale * 1.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 漂移失焦光斑 (Bokeh Orbs)
  for (let i = 0; i < bokehOrbs.length; i++) {
    const orb = bokehOrbs[i];
    orb.x += orb.vx * (1 + superBass * 1.2);
    orb.y += orb.vy * (1 + superBass * 0.8);
    if (orb.y < horizonY - 50) {
      orb.y = height + 20;
      orb.x = Math.random() * width;
    }
    if (orb.x < -30) orb.x = width + 30;
    if (orb.x > width + 30) orb.x = -30;

    const orbGrd = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
    orbGrd.addColorStop(0, `hsla(${orb.hue}, 100%, 75%, ${orb.alpha * (1 + superBass * 0.8)})`);
    orbGrd.addColorStop(0.5, `hsla(${orb.hue}, 90%, 55%, ${orb.alpha * 0.35})`);
    orbGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = orbGrd;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // ─── 6. 35mm 电影胶片质感与 2.39:1 柔和暗角 ───
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

  ctx.restore();
}
