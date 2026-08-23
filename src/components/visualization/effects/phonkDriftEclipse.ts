/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface KeplerianPhoton {
  radius: number;
  baseRadius: number;
  angle: number;
  speed: number;
  height: number;
  size: number;
  alpha: number;
  hue: number;
  arm: number;
}

interface NebulaSpriteCloud {
  radius: number;
  angle: number;
  speed: number;
  size: number;
  alpha: number;
  hue: number;
}

interface SpeedTrail {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  speed: number;
  alpha: number;
  hue: number;
  size: number;
  isSideRail: boolean;
}

interface DriftSmokePuff {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  vx: number;
  vy: number;
  scale: number;
  hue: number;
}

// 模块级静态缓存与对象池 (0 GC 性能优化)
let keplerianPhotons: KeplerianPhoton[] = [];
let nebulaClouds: NebulaSpriteCloud[] = [];
let speedTrails: SpeedTrail[] = [];
let driftSmokes: DriftSmokePuff[] = [];

let cachedGlowSprite: HTMLCanvasElement | null = null;
let cachedPlasmaSprite: HTMLCanvasElement | null = null;
let cachedStarSprite: HTMLCanvasElement | null = null;
let filmGrainCanvas: HTMLCanvasElement | null = null;
let filmGrainPattern: CanvasPattern | null = null;

let prevBass = 0;
let prevMid = 0;
let prevTreble = 0;
let prevSuperBass = 0;
let roadScroll = 0;
let accretionTime = 0;
let cameraSway = 0;
let breathLFO = 0;

const PHOTON_COUNT = 1100;
const NEBULA_COUNT = 32;
const SPEED_TRAIL_COUNT = 480;
const SMOKE_COUNT = 24;

// 预生成极高质量羽化光斑贴图
function getOrCreateSprite(type: "glow" | "plasma" | "star", size: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (type === "glow" && cachedGlowSprite) return cachedGlowSprite;
  if (type === "plasma" && cachedPlasmaSprite) return cachedPlasmaSprite;
  if (type === "star" && cachedStarSprite) return cachedStarSprite;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d")!;
  const center = size / 2;
  const grd = g.createRadialGradient(center, center, 0, center, center, center);

  if (type === "star") {
    grd.addColorStop(0, "rgba(255, 255, 255, 1)");
    grd.addColorStop(0.2, "rgba(220, 245, 255, 0.8)");
    grd.addColorStop(0.6, "rgba(180, 220, 255, 0.15)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0)");
  } else if (type === "plasma") {
    grd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    grd.addColorStop(0.25, "rgba(255, 120, 220, 0.65)");
    grd.addColorStop(0.6, "rgba(100, 200, 255, 0.2)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0)");
  } else {
    grd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    grd.addColorStop(0.3, "rgba(240, 90, 180, 0.45)");
    grd.addColorStop(0.7, "rgba(50, 140, 255, 0.1)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0)");
  }

  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);

  if (type === "glow") cachedGlowSprite = canvas;
  else if (type === "plasma") cachedPlasmaSprite = canvas;
  else cachedStarSprite = canvas;
  return canvas;
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
  if (keplerianPhotons.length >= PHOTON_COUNT) return;

  // 1. 初始化吸积盘向心坍缩光子流 (Keplerian Infall Photons)
  keplerianPhotons = [];
  const arms = 4;
  for (let i = 0; i < PHOTON_COUNT; i++) {
    const arm = i % arms;
    const armAngle = (arm / arms) * Math.PI * 2;
    const distFrac = Math.pow(Math.random(), 1.4);
    const r = 35 + distFrac * (Math.min(width, height) * 0.46);
    const spiralAngle = armAngle + Math.log(r * 0.05 + 1) * 3.5 + (Math.random() - 0.5) * 0.4;
    const speed = (0.015 + (1 / Math.sqrt(r + 5)) * 0.38);
    const heightSpread = (Math.random() - 0.5) * (6 + (r / 300) * 18);

    keplerianPhotons.push({
      radius: r,
      baseRadius: r,
      angle: spiralAngle,
      speed,
      height: heightSpread,
      size: Math.random() * 2.2 + 0.8,
      alpha: Math.random() * 0.65 + 0.35,
      hue: Math.random() > 0.45 ? 185 : 315,
      arm,
    });
  }

  // 2. 初始化吸积盘等离子星云气团 (Relativistic Plasma Cloud Sprites)
  nebulaClouds = [];
  for (let i = 0; i < NEBULA_COUNT; i++) {
    const distFrac = 0.1 + (i / NEBULA_COUNT) * 0.9;
    const r = 50 + distFrac * (Math.min(width, height) * 0.42);
    const angle = Math.random() * Math.PI * 2;
    nebulaClouds.push({
      radius: r,
      angle,
      speed: (0.008 + (1 / Math.sqrt(r)) * 0.22),
      size: 70 + Math.random() * 110,
      alpha: 0.06 + Math.random() * 0.08,
      hue: i % 2 === 0 ? 185 : 310,
    });
  }

  // 3. 初始化高速公路光速穿梭光轨 (Highway Speed Trails)
  speedTrails = [];
  for (let i = 0; i < SPEED_TRAIL_COUNT; i++) {
    const isSideRail = Math.random() > 0.65;
    speedTrails.push({
      x: (Math.random() - 0.5) * width * 2.4,
      y: (Math.random() - 0.5) * height * 1.8,
      z: Math.random() * 1000 + 10,
      prevZ: 0,
      speed: Math.random() * 2.0 + 1.0,
      alpha: Math.random() * 0.7 + 0.3,
      hue: Math.random() > 0.5 ? 330 : 190,
      size: Math.random() * 2.0 + 0.8,
      isSideRail,
    });
  }

  // 4. 漂移烟雾
  driftSmokes = [];
  for (let i = 0; i < SMOKE_COUNT; i++) {
    driftSmokes.push({
      x: (Math.random() - 0.5) * width * 1.2,
      y: height * 0.75 + Math.random() * height * 0.2,
      radius: Math.random() * 100 + 60,
      alpha: Math.random() * 0.14 + 0.04,
      vx: (Math.random() - 0.5) * 1.4,
      vy: (Math.random() - 0.5) * 0.3,
      scale: Math.random() * 0.6 + 0.8,
      hue: Math.random() > 0.5 ? 310 : 190,
    });
  }
}

/**
 * 赛博漂移 · 电影级日蚀特异点 (Phonk Drift Eclipse 10.0 - Grand Cinematic IMAX Edition)
 * 纯 3D 旋转开普勒引力光陷阱黑洞、深空等离子星云气团、东京午夜极速公路光轨
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

  // 1. 音频能量提取与平滑
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

  breathLFO += 0.016;
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

  // 镜头微动与震颤
  cameraSway = Math.sin(breathLFO * 0.6) * 0.015 * (1 + superBass * 0.5);
  let shakeX = 0;
  let shakeY = 0;
  if (superBass > 0.55) {
    const shakeMag = (superBass - 0.55) * 14 * bassIntensity;
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag * 0.6;
  }

  const cx = width * 0.5 + shakeX;
  const horizonY = height * 0.46 + shakeY;
  const blackHoleY = horizonY - height * 0.04; // 黑洞中心优雅悬浮在地平线稍上方

  const plasmaSprite = getOrCreateSprite("plasma", 128);

  ctx.save();

  // ─── 0. 底层深邃午夜纯黑虚空 ───
  ctx.fillStyle = "#010103";
  ctx.fillRect(0, 0, width, height);

  // ─── 1. 深空环境星云氛围微光 ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const bgGrd = ctx.createRadialGradient(cx, blackHoleY, 0, cx, blackHoleY, Math.max(width, height) * 0.85);
  bgGrd.addColorStop(0, `hsla(${primaryHue}, 90%, 60%, ${0.18 + superBass * 0.12})`);
  bgGrd.addColorStop(0.35, `hsla(${secondaryHue}, 80%, 45%, ${0.08 + mid * 0.06})`);
  bgGrd.addColorStop(0.7, `hsla(${accentHue}, 85%, 30%, 0.03)`);
  bgGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // ─── 2. 远景东京赛博剪影与微光建筑群 (Tokyo Cyber Skyline) ───
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const skylineBuildingCount = 36;
  const bStep = width / skylineBuildingCount;

  ctx.fillStyle = "#030307";
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  for (let i = 0; i <= skylineBuildingCount; i++) {
    const bx = i * bStep;
    const distRatio = Math.abs(bx - cx) / (width * 0.5);
    const isBuilding = i % 2 === 0 && distRatio > 0.28;
    const bHeight = isBuilding
      ? (32 + Math.sin(i * 3.7) * 26) * Math.pow(distRatio, 1.1)
      : (Math.sin(i * 1.5 + breathLFO * 0.2) * 0.5 + 0.5) * 25 * Math.pow(distRatio, 1.3);
    ctx.lineTo(bx, horizonY - bHeight);
    if (isBuilding) {
      ctx.lineTo(bx + bStep * 0.85, horizonY - bHeight);
    }
  }
  ctx.lineTo(width, horizonY);
  ctx.closePath();
  ctx.fill();

  // 建筑顶部微光天际线
  ctx.strokeStyle = `hsla(${primaryHue}, 85%, 65%, ${0.18 + mid * 0.20})`;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.restore();

  // ─── 3. 3D 物理级“光线无法逃逸”卡冈图雅黑洞 (Grand 3D Relativistic Black Hole) ───
  // 黑洞事件视界物理半径
  const eventHorizonR = Math.min(width, height) * (0.11 + superBass * 0.04 * bassIntensity + organicBreath * 0.006);
  accretionTime += (0.010 + cruiseSpeed * 0.005 + superBass * 0.015);

  // 3D 摄像机与吸积盘倾角透视变换
  const diskPitch = 0.38 + Math.sin(breathLFO * 0.5) * 0.02; // 吸积盘俯角
  const cosP = Math.cos(diskPitch);
  const sinP = Math.sin(diskPitch);
  const cosR = Math.cos(accretionTime);
  const sinR = Math.sin(accretionTime);
  const fov = 480;

  // A. 顶部引力透镜弯曲光弧 (Gravitational Lensing Halo: 后方吸积盘被强引力弯折到黑洞上方的像)
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const topHaloR = eventHorizonR * (1.35 + superBass * 0.25);
  const topHaloGrd = ctx.createLinearGradient(cx - topHaloR, blackHoleY, cx + topHaloR, blackHoleY);
  // 相对论多普勒蓝移：左侧旋转迎向观察者，呈现炽热电光青蓝；右侧红移暗淡
  topHaloGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 88%, ${0.85 + superBass * 0.15})`);
  topHaloGrd.addColorStop(0.4, `hsla(${primaryHue}, 95%, 72%, 0.75)`);
  topHaloGrd.addColorStop(1, `hsla(${accentHue}, 90%, 55%, ${0.35 + mid * 0.15})`);

  ctx.strokeStyle = topHaloGrd;
  ctx.lineWidth = 6.0 + superBass * 7.0;
  ctx.beginPath();
  ctx.arc(cx, blackHoleY, topHaloR, Math.PI * 0.96, Math.PI * 2.04);
  ctx.stroke();

  // B. 3D 等离子星云气团贴图渲染 (Blitted Volumetric Nebula Gas Clouds)
  if (plasmaSprite && nebulaClouds.length > 0) {
    for (let i = 0; i < nebulaClouds.length; i++) {
      const neb = nebulaClouds[i];
      neb.angle += neb.speed * (1 + superBass * 1.5 + mid * 0.8);

      const pxRaw = Math.cos(neb.angle) * neb.radius;
      const pzRaw = Math.sin(neb.angle) * neb.radius;
      const pyRaw = Math.sin(accretionTime * 2 + neb.radius * 0.05) * 8;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = blackHoleY + ry * scale;

      // 遮挡关系：处于黑洞后方且距离过近的被黑洞吞噬
      const dist2D = Math.hypot(screenX - cx, screenY - blackHoleY);
      if (rz < 0 && dist2D < eventHorizonR * 0.95) continue;

      const nSize = neb.size * scale * (1 + superBass * 0.3);
      const nAlpha = Math.min(0.35, neb.alpha * (0.8 + superBass * 0.5) * scale);

      ctx.globalAlpha = nAlpha;
      ctx.drawImage(plasmaSprite, screenX - nSize * 0.5, screenY - nSize * 0.5, nSize, nSize);
    }
  }

  // C. 1,100+ 物理级向心坍缩吸积光子流 (Keplerian Infall Photons into Horizon)
  const photonSpeedMult = 1.0 + superBass * 2.2 + treble * 1.2;
  ctx.lineWidth = 1.2;

  for (let i = 0; i < keplerianPhotons.length; i++) {
    const p = keplerianPhotons[i];
    // 越靠近事件视界，角速度和向心速度越呈指数级剧增 (Relativistic Orbital Acceleration)
    const normalizedDist = Math.max(0.05, (p.radius - eventHorizonR) / (width * 0.4));
    const speedFactor = 1.0 + (1.0 / normalizedDist) * 0.6;
    p.angle += p.speed * speedFactor * photonSpeedMult;
    p.radius -= (0.35 + (1.0 / normalizedDist) * 0.25 + superBass * 1.2);

    // 穿过事件视界后在外围重新生成被捕获
    if (p.radius <= eventHorizonR * 0.98) {
      p.radius = eventHorizonR * (1.6 + Math.random() * 2.4);
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

    // 遮挡检查：黑洞背面被视界遮挡
    const distToCenter = Math.hypot(screenX - cx, screenY - blackHoleY);
    if (rz < 0 && distToCenter < eventHorizonR * 0.95) continue;

    // 切线速度拖尾
    const tangentAngle = p.angle + Math.PI * 0.5;
    const streakLen = Math.max(1.8, (120 / Math.max(20, p.radius)) * scale * (1 + superBass * 1.5));
    const endX = screenX + Math.cos(tangentAngle) * streakLen;
    const endY = screenY + Math.sin(tangentAngle) * streakLen * cosP;

    // 相对论多普勒蓝移亮度
    const isApproaching = rx < 0;
    const dopplerAlpha = isApproaching ? 1.4 : 0.6;
    const photonAlpha = Math.min(1.0, (p.radius - eventHorizonR) / (eventHorizonR * 0.8)) * p.alpha * dopplerAlpha * (0.65 + superBass * 0.35);

    if (photonAlpha > 0.05) {
      ctx.strokeStyle = isApproaching
        ? `hsla(${secondaryHue}, 100%, 85%, ${photonAlpha})`
        : `hsla(${primaryHue}, 90%, 65%, ${photonAlpha})`;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  // D. 经典光子球层临界发光环 (Blazing Relativistic Photon Sphere Rim)
  const photonSphereR = eventHorizonR * (1.04 + superBass * 0.06);
  const photonGrd = ctx.createLinearGradient(cx - photonSphereR, blackHoleY, cx + photonSphereR, blackHoleY);
  photonGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 92%, ${0.95 + superBass * 0.05})`);
  photonGrd.addColorStop(0.35, `hsla(${primaryHue}, 95%, 75%, 0.85)`);
  photonGrd.addColorStop(1, `hsla(${accentHue}, 90%, 60%, 0.40)`);

  ctx.strokeStyle = photonGrd;
  ctx.lineWidth = 3.5 + superBass * 4.0;
  ctx.beginPath();
  ctx.arc(cx, blackHoleY, photonSphereR, 0, Math.PI * 2);
  ctx.stroke();

  // E. 宽银幕变形水平耀斑
  const flareW = width * (0.90 + superBass * 0.35);
  const flareH = 12 + superBass * 16;
  const flareGrd = ctx.createRadialGradient(cx, blackHoleY, 0, cx, blackHoleY, flareW * 0.5);
  flareGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 90%, ${0.80 + mid * 0.15})`);
  flareGrd.addColorStop(0.2, `hsla(${primaryHue}, 90%, 65%, 0.45)`);
  flareGrd.addColorStop(0.6, `hsla(${accentHue}, 85%, 50%, 0.12)`);
  flareGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = flareGrd;
  ctx.fillRect(cx - flareW * 0.5, blackHoleY - flareH * 0.5, flareW, flareH);

  ctx.restore();

  // F. 事件视界绝对纯黑吞噬内核 (Absolute Black Void Singularity)
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#010103";
  ctx.beginPath();
  ctx.arc(cx, blackHoleY, eventHorizonR, 0, Math.PI * 2);
  ctx.fill();

  // ─── 4. 湿润沥青赛博漂移高速路 (Wet Asphalt Midnight Highway) ───
  ctx.save();
  const roadHeight = height - horizonY;
  roadScroll += (0.016 + superBass * 0.024) * cruiseSpeed;

  // 地面自然渐变底色
  const groundGrd = ctx.createLinearGradient(0, horizonY - 10, 0, height);
  groundGrd.addColorStop(0, `hsla(${primaryHue}, 75%, 8%, 0.4)`);
  groundGrd.addColorStop(0.12, `hsla(${primaryHue}, 70%, 6%, 0.95)`);
  groundGrd.addColorStop(0.65, `hsla(${secondaryHue}, 65%, 4%, 0.98)`);
  groundGrd.addColorStop(1, "#010103");
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, horizonY - 10, width, roadHeight + 10);

  // 湿润路面高斯漫反射倒影锥 (Asphalt Specular Floor Reflection)
  ctx.globalCompositeOperation = "screen";
  const floorReflectGrd = ctx.createRadialGradient(
    cx,
    horizonY,
    0,
    cx,
    horizonY + roadHeight * 0.5,
    Math.max(width * 0.45, roadHeight * 0.9)
  );
  floorReflectGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 75%, ${0.35 + superBass * 0.22})`);
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

  // 地平线深空羽化薄雾 (Seamless Horizon Mist)
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

  // ─── 5. 极速漂移尾灯流光与光速穿梭微粒 (Hyper-Speed Drift Trails) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const speedMult = (1.0 + treble * 3.0 + superBass * 2.0) * cruiseSpeed;

  for (let i = 0; i < speedTrails.length; i++) {
    const st = speedTrails[i];
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

  // 漂移火花与微烟
  for (let i = 0; i < driftSmokes.length; i++) {
    const s = driftSmokes[i];
    s.x += s.vx * (1 + superBass * 1.6);
    s.y += s.vy;
    if (s.x > width * 0.7) s.x = -width * 0.7;
    if (s.x < -width * 0.7) s.x = width * 0.7;

    const smokeGrd = ctx.createRadialGradient(cx + s.x, s.y, 0, cx + s.x, s.y, s.radius * s.scale);
    smokeGrd.addColorStop(0, `hsla(${s.hue}, 85%, 60%, ${s.alpha * (1 + superBass * 0.6)})`);
    smokeGrd.addColorStop(0.45, `hsla(${s.hue}, 75%, 40%, ${s.alpha * 0.3})`);
    smokeGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = smokeGrd;
    ctx.beginPath();
    ctx.arc(cx + s.x, s.y, s.radius * s.scale, 0, Math.PI * 2);
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
}
