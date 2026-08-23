/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

// ─── 数据结构定义 ───
interface AccretionParticle {
  radius: number;
  baseRadius: number;
  angle: number;
  speed: number;
  height: number;
  size: number;
  alpha: number;
  arm: number;
  isBright: boolean;
  colorType: number; // 0: cyan-white (doppler approach), 1: neon-magenta, 2: purple-blue
}

interface VolumetricGasNebula {
  radius: number;
  angle: number;
  speed: number;
  size: number;
  alpha: number;
  isCyan: boolean;
}

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
let accretionParticles: AccretionParticle[] = [];
let gasNebulae: VolumetricGasNebula[] = [];
let speedWarpLasers: SpeedWarpLaser[] = [];
let cinematicBokehOrbs: CinematicBokehOrb[] = [];
let activeShockwaves: ConcentricShockwave[] = [];

let cachedCyanGasSprite: HTMLCanvasElement | null = null;
let cachedMagentaGasSprite: HTMLCanvasElement | null = null;
let cachedStarGlowSprite: HTMLCanvasElement | null = null;
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

const PARTICLE_COUNT = 3200;
const GAS_COUNT = 64;
const LASER_COUNT = 450;
const BOKEH_COUNT = 36;

// 高清柔光等离子气团 Sprite 预烘焙
function getOrCreateSprites() {
  if (typeof document === "undefined") return;
  if (!cachedCyanGasSprite) {
    cachedCyanGasSprite = document.createElement("canvas");
    cachedCyanGasSprite.width = 128;
    cachedCyanGasSprite.height = 128;
    const g = cachedCyanGasSprite.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(235, 250, 255, 0.95)");
    grd.addColorStop(0.25, "rgba(80, 220, 255, 0.55)");
    grd.addColorStop(0.65, "rgba(40, 140, 240, 0.15)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  if (!cachedMagentaGasSprite) {
    cachedMagentaGasSprite = document.createElement("canvas");
    cachedMagentaGasSprite.width = 128;
    cachedMagentaGasSprite.height = 128;
    const g = cachedMagentaGasSprite.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255, 240, 250, 0.95)");
    grd.addColorStop(0.25, "rgba(255, 70, 180, 0.55)");
    grd.addColorStop(0.65, "rgba(180, 40, 220, 0.15)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  if (!cachedStarGlowSprite) {
    cachedStarGlowSprite = document.createElement("canvas");
    cachedStarGlowSprite.width = 64;
    cachedStarGlowSprite.height = 64;
    const g = cachedStarGlowSprite.getContext("2d")!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    grd.addColorStop(0.3, "rgba(180, 240, 255, 0.65)");
    grd.addColorStop(0.7, "rgba(255, 100, 200, 0.18)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
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
      buf[i + 3] = 3; // 1.2% 细腻胶片颗粒
    }
    gCtx.putImageData(imgData, 0, 0);
    filmGrainPattern = ctx.createPattern(filmGrainCanvas, "repeat");
  }
  return filmGrainPattern;
}

function initPools(width: number, height: number) {
  if (accretionParticles.length >= PARTICLE_COUNT && Math.abs(lastCanvasW - width) < 40) return;
  lastCanvasW = width;
  lastCanvasH = height;
  getOrCreateSprites();

  // 1. 3,200+ 3D 相对论开普勒吸积盘微粒群
  accretionParticles = [];
  const arms = 4;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const arm = i % arms;
    const armAngle = (arm / arms) * Math.PI * 2;
    const distFrac = 0.05 + 0.95 * Math.pow(Math.random(), 1.35);
    const r = 45 + distFrac * (Math.min(width, height) * 0.45);
    const spiralAngle = armAngle + Math.log(r * 0.05 + 1) * 3.8 + (Math.random() - 0.5) * 0.28;
    const speed = 0.012 + (1 / Math.sqrt(r + 10)) * 0.38;
    const heightSpread = (Math.random() - 0.5) * (3 + (r / 300) * 12);

    accretionParticles.push({
      radius: r,
      baseRadius: r,
      angle: spiralAngle,
      speed,
      height: heightSpread,
      size: Math.random() * 1.5 + 0.6,
      alpha: Math.random() * 0.7 + 0.3,
      arm,
      isBright: Math.random() < 0.12,
      colorType: Math.random() < 0.4 ? 0 : Math.random() < 0.8 ? 1 : 2,
    });
  }

  // 2. 64 团 3D 流体气体等离子云
  gasNebulae = [];
  for (let i = 0; i < GAS_COUNT; i++) {
    const distFrac = 0.08 + 0.92 * Math.pow(Math.random(), 1.25);
    const r = 50 + distFrac * (Math.min(width, height) * 0.42);
    gasNebulae.push({
      radius: r,
      angle: Math.random() * Math.PI * 2,
      speed: 0.006 + (1 / Math.sqrt(r + 15)) * 0.22,
      size: 40 + Math.random() * 60,
      alpha: 0.18 + Math.random() * 0.22,
      isCyan: Math.random() < 0.5,
    });
  }

  // 3. 高速穿梭光轨 (Speed Warp Lasers)
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

  // 4. 电影级柔焦失焦光斑 (Cinematic Bokeh Orbs)
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
 * 赛博漂移 · 电影级日蚀特异点 (Phonk Drift Eclipse 14.0 - True Gargantua Cinema Edition)
 * 真实 3D 摄像机矩阵相对论流体吸积盘、爱因斯坦-罗森重力井、无生硬色块、2.39:1 宽银幕光学
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
  diskRotation += (0.010 + cruiseSpeed * 0.004 + superBass * 0.015);

  ctx.save();

  // ─── 0. 底层深邃曜石黑纯黑虚空 ───
  ctx.fillStyle = "#010103";
  ctx.fillRect(0, 0, width, height);

  // ─── 1. 深空全域大气色阶与天鹅绒柔和流体极光幕 (Volumetric Sky Nebula & Silk Aurora) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const skyGrd = ctx.createRadialGradient(cx, blackHoleY, eventHorizonR * 0.8, cx, blackHoleY, Math.max(width, height) * 0.88);
  skyGrd.addColorStop(0, `hsla(${primaryHue}, 95%, 65%, ${0.24 + superBass * 0.16})`);
  skyGrd.addColorStop(0.28, `hsla(${secondaryHue}, 85%, 50%, ${0.12 + mid * 0.08})`);
  skyGrd.addColorStop(0.65, `hsla(${accentHue}, 90%, 35%, 0.03)`);
  skyGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, width, height);

  // 天鹅绒流体极光幕
  const numAuroraWaves = 4;
  for (let w = 0; w < numAuroraWaves; w++) {
    const wavePhase = breathLFO * 0.8 + (w * Math.PI) / numAuroraWaves;
    const waveAmp = (35 + w * 22) * (1 + mid * 0.7);
    const waveHue = w % 2 === 0 ? secondaryHue : primaryHue;
    const waveAlpha = (0.04 + (data[10 + w * 7] || 0) / 255 * 0.07 + superBass * 0.04) * (0.7 + organicBreath * 0.3);

    const auroraGrd = ctx.createLinearGradient(0, 0, 0, horizonY);
    auroraGrd.addColorStop(0, `hsla(${waveHue}, 100%, 75%, 0)`);
    auroraGrd.addColorStop(0.4, `hsla(${waveHue}, 90%, 65%, ${waveAlpha * 0.5})`);
    auroraGrd.addColorStop(0.85, `hsla(${waveHue}, 95%, 70%, ${waveAlpha})`);
    auroraGrd.addColorStop(1, `hsla(${accentHue}, 100%, 80%, 0)`);

    ctx.fillStyle = auroraGrd;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    const waveSteps = 24;
    for (let s = 0; s <= waveSteps; s++) {
      const wx = (s / waveSteps) * width;
      const wy = horizonY - (Math.sin((s / waveSteps) * Math.PI * 3 + wavePhase) * waveAmp + (height * 0.30));
      ctx.lineTo(wx, wy);
    }
    ctx.lineTo(width, horizonY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // ─── 2. 远景东京赛博大厦微光天际线 (Tokyo Cyber Skyline) ───
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const bCount = 40;
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

  // 建筑顶部微光与红色航空指示灯
  for (let i = 0; i <= bCount; i++) {
    const bx = i * bStep;
    const distRatio = Math.abs(bx - cx) / (width * 0.5);
    if (i % 2 === 0 && distRatio > 0.28) {
      const bHeight = (36 + Math.sin(i * 3.7) * 28) * Math.pow(distRatio, 1.2);
      ctx.fillStyle = "#ff1133";
      ctx.globalAlpha = Math.sin(breathLFO * 3 + i) > 0.2 ? 0.85 : 0.2;
      ctx.beginPath();
      ctx.arc(bx + bStep * 0.42, horizonY - bHeight - 3, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = `hsla(${primaryHue}, 85%, 65%, ${0.16 + mid * 0.20})`;
  ctx.lineWidth = 0.85;
  ctx.stroke();
  ctx.restore();

  // ─── 3. 垂直超相对论等离子喷流 (Polar Relativistic Plasma Jets) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const jetH = height * (0.60 + superBass * 0.35);
  const jetW = 2.8 + superBass * 3.5;

  const topJetGrd = ctx.createLinearGradient(cx, blackHoleY, cx, blackHoleY - jetH);
  topJetGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 94%, ${0.90 + superBass * 0.08})`);
  topJetGrd.addColorStop(0.2, `hsla(${primaryHue}, 95%, 75%, 0.60)`);
  topJetGrd.addColorStop(0.65, `hsla(${accentHue}, 85%, 55%, 0.12)`);
  topJetGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topJetGrd;
  ctx.fillRect(cx - jetW * 0.5, blackHoleY - jetH, jetW, jetH);
  ctx.restore();

  // ─── 4. 真实好莱坞《星际穿越》3D 相对论吸积盘引擎 (3D Relativistic Accretion Engine) ───
  // 采用 3D 摄像机矩阵投影 ($pitch \approx 38^\circ, fov = 580$)
  const fov = 580;
  const pitch = 0.66 + Math.sin(breathLFO * 0.4) * 0.02;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const cosR = Math.cos(diskRotation);
  const sinR = Math.sin(diskRotation);

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // A. 【背景上/下爱因斯坦引力透镜双光拱 (Upper/Lower Gravitational Lensing Halos)】
  const lensingR = eventHorizonR * (1.28 + superBass * 0.18);
  const lensingH = lensingR * 0.86;

  // (A.1) 上部弯曲引力透镜主光拱
  const upperGrd = ctx.createRadialGradient(
    cx,
    blackHoleY - lensingH * 0.35,
    lensingR * 0.35,
    cx,
    blackHoleY - lensingH * 0.35,
    lensingR * 1.55
  );
  upperGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 92%, ${0.85 + superBass * 0.15})`);
  upperGrd.addColorStop(0.35, `hsla(${primaryHue}, 95%, 72%, ${0.55 + mid * 0.25})`);
  upperGrd.addColorStop(0.75, `hsla(${accentHue}, 88%, 52%, 0.15)`);
  upperGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = upperGrd;
  ctx.beginPath();
  ctx.ellipse(cx, blackHoleY - lensingH * 0.42, lensingR * 1.35, lensingH * 0.92, 0, Math.PI * 0.92, Math.PI * 2.08);
  ctx.fill();

  // (A.2) 下部弯曲引力透镜副光拱
  const lowerGrd = ctx.createRadialGradient(
    cx,
    blackHoleY + lensingH * 0.35,
    lensingR * 0.35,
    cx,
    blackHoleY + lensingH * 0.35,
    lensingR * 1.40
  );
  lowerGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 88%, ${0.65 + superBass * 0.20})`);
  lowerGrd.addColorStop(0.4, `hsla(${primaryHue}, 90%, 65%, ${0.38 + mid * 0.20})`);
  lowerGrd.addColorStop(0.8, `hsla(${accentHue}, 85%, 50%, 0.08)`);
  lowerGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = lowerGrd;
  ctx.beginPath();
  ctx.ellipse(cx, blackHoleY + lensingH * 0.38, lensingR * 1.25, lensingH * 0.75, 0, 0, Math.PI);
  ctx.fill();

  // B. 【3D 流体气体等离子云 (Volumetric Relativistic Gas Clouds)】
  if (cachedCyanGasSprite && cachedMagentaGasSprite) {
    for (let i = 0; i < gasNebulae.length; i++) {
      const neb = gasNebulae[i];
      neb.angle += neb.speed * (1 + superBass * 2.2 + mid * 1.2);

      const curR = (neb.radius / (width * 0.25)) * eventHorizonR * 2.4;
      const pxRaw = Math.cos(neb.angle) * curR;
      const pyRaw = Math.sin(breathLFO * 2 + neb.radius * 0.02) * 8;
      const pzRaw = Math.sin(neb.angle) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = blackHoleY + ry * scale;

      // 遮挡检查：黑洞后方且在投影半径内的气体被事件视界遮挡
      const distToHole = Math.hypot(screenX - cx, screenY - blackHoleY);
      if (rz < 0 && distToHole < eventHorizonR * 0.92) continue;

      const nDiameter = neb.size * scale * (0.8 + superBass * 0.4);
      // 多普勒增强：左侧（迎面运动）更亮且偏向青蓝
      const isApproaching = rx < 0;
      const sprite = isApproaching ? cachedCyanGasSprite : cachedMagentaGasSprite;
      const nAlpha = Math.min(0.35, neb.alpha * (isApproaching ? 1.3 : 0.7) * (0.8 + superBass * 0.5));

      ctx.globalAlpha = nAlpha;
      ctx.drawImage(sprite, screenX - nDiameter * 0.5, screenY - nDiameter * 0.5, nDiameter, nDiameter);
    }
  }

  // C. 【3,200+ 3D 相对论开普勒吸积盘微粒流场 (Keplerian Magnetic Streamlines)】
  const speedMult = 1 + superBass * 2.4 + treble * 1.5;
  const particleScaleBase = (1 + superBass * 0.3);

  // 1. 批量绘制高速切向磁光丝 (Filaments)
  ctx.beginPath();
  ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 88%, ${0.65 + superBass * 0.25})`;
  ctx.lineWidth = 1.15;

  for (let i = 0; i < accretionParticles.length; i++) {
    const p = accretionParticles[i];
    p.angle += p.speed * speedMult;

    const curR = (p.radius / (width * 0.25)) * eventHorizonR * 2.4;
    const pxRaw = Math.cos(p.angle) * curR;
    const pyRaw = p.height + Math.sin(breathLFO * 2.5 + p.radius * 0.05) * 6;
    const pzRaw = Math.sin(p.angle) * curR;

    const rx = pxRaw * cosR - pzRaw * sinR;
    const rz = pxRaw * sinR + pzRaw * cosR;
    const ry = pyRaw * cosP - rz * sinP;
    const finalZ = pyRaw * sinP + rz * cosP + fov;

    if (finalZ <= 10) continue;
    const scale = fov / finalZ;
    const screenX = cx + rx * scale;
    const screenY = blackHoleY + ry * scale;

    // 视界遮挡：黑洞后方粒子被吞噬
    const distToHole = Math.hypot(screenX - cx, screenY - blackHoleY);
    if (rz < 0 && distToHole < eventHorizonR * 0.94) continue;

    const tangentAngle = p.angle + Math.PI * 0.5;
    const streakLen = Math.max(1.6, (140 / Math.max(20, curR)) * (1 + superBass * 1.5) * scale * 2.2);
    const endX = screenX + Math.cos(tangentAngle) * streakLen;
    const endY = screenY + Math.sin(tangentAngle) * streakLen * cosP;

    ctx.moveTo(screenX, screenY);
    ctx.lineTo(endX, endY);
  }
  ctx.stroke();

  // 2. 批量绘制星尘微粒点
  ctx.beginPath();
  ctx.fillStyle = `hsla(${secondaryHue}, 100%, 92%, 0.88)`;
  for (let i = 0; i < accretionParticles.length; i++) {
    const p = accretionParticles[i];
    const curR = (p.radius / (width * 0.25)) * eventHorizonR * 2.4;
    const pxRaw = Math.cos(p.angle) * curR;
    const pyRaw = p.height + Math.sin(breathLFO * 2.5 + p.radius * 0.05) * 6;
    const pzRaw = Math.sin(p.angle) * curR;

    const rx = pxRaw * cosR - pzRaw * sinR;
    const rz = pxRaw * sinR + pzRaw * cosR;
    const ry = pyRaw * cosP - rz * sinP;
    const finalZ = pyRaw * sinP + rz * cosP + fov;

    if (finalZ <= 10) continue;
    const scale = fov / finalZ;
    const screenX = cx + rx * scale;
    const screenY = blackHoleY + ry * scale;

    const distToHole = Math.hypot(screenX - cx, screenY - blackHoleY);
    if (rz < 0 && distToHole < eventHorizonR * 0.94) continue;

    const pSize = Math.max(0.65, p.size * scale * particleScaleBase);
    ctx.moveTo(screenX + pSize, screenY);
    ctx.arc(screenX, screenY, pSize, 0, Math.PI * 2);
  }
  ctx.fill();

  // 3. 高亮亮星与光子闪烁
  if (cachedStarGlowSprite) {
    for (let i = 0; i < accretionParticles.length; i += 8) {
      const p = accretionParticles[i];
      if (!p.isBright) continue;

      const curR = (p.radius / (width * 0.25)) * eventHorizonR * 2.4;
      const pxRaw = Math.cos(p.angle) * curR;
      const pyRaw = p.height + Math.sin(breathLFO * 2.5 + p.radius * 0.05) * 6;
      const pzRaw = Math.sin(p.angle) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = blackHoleY + ry * scale;

      const distToHole = Math.hypot(screenX - cx, screenY - blackHoleY);
      if (rz < 0 && distToHole < eventHorizonR * 0.94) continue;

      const glowSize = Math.max(8, p.size * scale * 7.0);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(cachedStarGlowSprite, screenX - glowSize * 0.5, screenY - glowSize * 0.5, glowSize, glowSize);
    }
  }

  ctx.restore();

  // D. 【事件视界绝对纯黑吞噬内核 (Pure Black Event Horizon Core)】
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const voidGrd = ctx.createRadialGradient(cx, blackHoleY, 0, cx, blackHoleY, eventHorizonR);
  voidGrd.addColorStop(0, "#010103");
  voidGrd.addColorStop(0.85, "#010103");
  voidGrd.addColorStop(0.96, "#080612");
  voidGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = voidGrd;
  ctx.beginPath();
  ctx.arc(cx, blackHoleY, eventHorizonR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // E. 【极细 1.5px 纯正光子球临界薄环 (Sharp Photon Sphere Rim)】
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const photonSphereR = eventHorizonR * 0.98;
  ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 95%, ${0.92 + superBass * 0.08})`;
  ctx.lineWidth = 1.6 + superBass * 1.5;
  ctx.shadowColor = `hsla(${primaryHue}, 100%, 75%, 0.8)`;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(cx, blackHoleY, photonSphereR, 0, Math.PI * 2);
  ctx.stroke();

  // F. 【2.39:1 变形宽银幕水平纤细拉丝耀斑 (Anamorphic Streak Flare)】
  const flareW = width * (0.90 + superBass * 0.30);
  const flareH = 8 + superBass * 12;
  const flareGrd = ctx.createRadialGradient(cx, blackHoleY, 0, cx, blackHoleY, flareW * 0.5);
  flareGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 95%, ${0.85 + mid * 0.15})`);
  flareGrd.addColorStop(0.18, `hsla(${primaryHue}, 90%, 70%, 0.40)`);
  flareGrd.addColorStop(0.6, `hsla(${accentHue}, 85%, 50%, 0.10)`);
  flareGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = flareGrd;
  ctx.fillRect(cx - flareW * 0.5, blackHoleY - flareH * 0.5, flareW, flareH);

  ctx.restore();

  // ─── 5. 808 低音同心超声速引力激波环 (Concentric Gravity Shockwaves) ───
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
    ctx.globalAlpha = sw.alpha * 0.70;
    ctx.lineWidth = 2.0 + sw.z * 3.5;
    ctx.beginPath();
    ctx.ellipse(cx, horizonY + sw.z * (height - horizonY) * 0.85, curR, curR * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ─── 6. 爱因斯坦-罗森重力井网格公路 (Einstein Gravity Well Highway - 3D 漏斗无缝吸入) ───
  ctx.save();
  const roadHeight = height - horizonY;
  roadScroll += (0.016 + superBass * 0.024) * cruiseSpeed;

  // 地面自然平滑深空渐变底色
  const groundGrd = ctx.createLinearGradient(0, horizonY - 20, 0, height);
  groundGrd.addColorStop(0, `hsla(${primaryHue}, 75%, 8%, 0.35)`);
  groundGrd.addColorStop(0.12, `hsla(${primaryHue}, 70%, 6%, 0.95)`);
  groundGrd.addColorStop(0.65, `hsla(${secondaryHue}, 65%, 4%, 0.98)`);
  groundGrd.addColorStop(1, "#010103");
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, horizonY - 20, width, roadHeight + 20);

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
  floorReflectGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 75%, ${0.40 + superBass * 0.25})`);
  floorReflectGrd.addColorStop(0.3, `hsla(${primaryHue}, 85%, 55%, ${0.20 + mid * 0.12})`);
  floorReflectGrd.addColorStop(0.7, `hsla(${accentHue}, 80%, 40%, 0.05)`);
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
    const lineAlpha = Math.min(1.0, pZ * 1.4) * (0.28 + superBass * 0.32) * depthAlpha;

    const centerDip = Math.sin(pZ * Math.PI) * gravityFunnelSink - Math.pow(1 - pZ, 2.2) * (superBass * 25);

    // 底层霓虹晕染
    ctx.strokeStyle = `hsla(${primaryHue}, 90%, 65%, ${lineAlpha * 0.35})`;
    ctx.lineWidth = Math.max(2.0, pZ * 4.8);
    ctx.beginPath();
    ctx.moveTo(cx + curveX - spanW, lineY);
    ctx.quadraticCurveTo(cx + curveX, lineY + centerDip, cx + curveX + spanW, lineY);
    ctx.stroke();

    // 顶层激光核心
    ctx.strokeStyle = `hsla(${primaryHue}, 85%, ${55 + pZ * 22}%, ${lineAlpha})`;
    ctx.lineWidth = Math.max(0.7, pZ * 2.0);
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

    const baseAlpha = isCenterLane ? 0.82 + superBass * 0.15 : isOuterRail ? 0.72 + mid * 0.20 : (0.28 + (1 - Math.abs(normX)) * 0.32) * (0.55 + superBass * 0.35);
    const laneHue = isCenterLane ? secondaryHue : isOuterRail ? accentHue : primaryHue;
    const laneSat = isCenterLane || isOuterRail ? 100 : 85;
    const laneLight = isCenterLane ? 80 : isOuterRail ? 72 : 55;

    // 底层柔光
    const bGrd = ctx.createLinearGradient(0, horizonY, 0, height);
    bGrd.addColorStop(0, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, 0)`);
    bGrd.addColorStop(0.18, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.12})`);
    bGrd.addColorStop(0.6, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.32})`);
    bGrd.addColorStop(1, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.42})`);

    ctx.strokeStyle = bGrd;
    ctx.lineWidth = isCenterLane ? 4.8 : isOuterRail ? 3.8 : 2.0;

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
    cGrd.addColorStop(0.18, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.18})`);
    cGrd.addColorStop(0.6, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.65})`);
    cGrd.addColorStop(1, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha})`);

    ctx.strokeStyle = cGrd;
    ctx.lineWidth = isCenterLane ? 2.0 : isOuterRail ? 1.6 : 0.85;

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
  mistRadialGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 70%, ${0.20 + superBass * 0.10})`);
  mistRadialGrd.addColorStop(0.4, `hsla(${primaryHue}, 85%, 40%, ${0.10 + superBass * 0.05})`);
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

