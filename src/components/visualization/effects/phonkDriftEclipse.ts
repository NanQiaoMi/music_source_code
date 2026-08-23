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

  // ─── 1. 深空全域大气色阶与天鹅绒柔和流体极光幕 (Volumetric Sky Nebula & Silk Aurora) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const skyGrd = ctx.createRadialGradient(cx, blackHoleY, eventHorizonR * 0.8, cx, blackHoleY, Math.max(width, height) * 0.88);
  skyGrd.addColorStop(0, `hsla(${primaryHue}, 95%, 65%, ${0.22 + superBass * 0.15})`);
  skyGrd.addColorStop(0.28, `hsla(${secondaryHue}, 85%, 50%, ${0.10 + mid * 0.08})`);
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

  // ─── 4. 真实《星际穿越》数学一体化闭合相对论流体吸积盘 (Unified Relativistic Accretion Engine) ───
  // 采用广义相对论引力透镜连续映射：多重高斯羽化与丝滑等离子流光
  const diskTilt = 0.22; // 倾角
  const NUM_RINGS = 95;
  const ANGULAR_STEPS = 64;
  const minR = eventHorizonR * 1.05;
  const maxR = eventHorizonR * (3.3 + superBass * 0.5);

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // ─── 4.0 底层超柔引力透镜天鹅绒漫射光晕 (Soft Relativistic Atmosphere) ───
  const softHaloGrd = ctx.createRadialGradient(
    cx,
    blackHoleY - eventHorizonR * 0.3,
    eventHorizonR * 0.9,
    cx,
    blackHoleY - eventHorizonR * 0.3,
    eventHorizonR * 2.8
  );
  softHaloGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 85%, ${0.18 + superBass * 0.08})`);
  softHaloGrd.addColorStop(0.35, `hsla(${primaryHue}, 90%, 65%, ${0.10 + mid * 0.05})`);
  softHaloGrd.addColorStop(0.75, `hsla(${accentHue}, 85%, 50%, 0.03)`);
  softHaloGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = softHaloGrd;
  ctx.fillRect(cx - maxR, blackHoleY - maxR, maxR * 2, maxR * 2);

  // ─── 4.1 绘制吸积盘背部引力透镜光拱 (Back Half: Lensed Upper Arch) ───
  // 双 Pass 渲染：底层宽幅高斯漫射羽化 + 顶层丝滑柔光流体
  for (let k = 0; k < NUM_RINGS; k++) {
    const frac = k / (NUM_RINGS - 1);
    const r = minR + Math.pow(frac, 1.18) * (maxR - minR);
    const ringSpeed = (0.010 + (1 / Math.sqrt(r * 2)) * 0.24) * (1 + superBass * 1.8);
    const ringRot = diskRotation * ringSpeed * 36;

    // 柔和边缘羽化：外圈以平方平滑衰减，无生硬边界
    const edgeFade = Math.pow(1 - frac, 1.4);
    const baseAlpha = edgeFade * (0.22 + superBass * 0.16);
    const waveMod = Math.sin(ringRot * 2 + k * 0.25) * 0.08;

    const ringHue = frac < 0.25 ? secondaryHue : frac < 0.65 ? primaryHue : accentHue;
    const ringLight = frac < 0.15 ? 90 : frac < 0.5 ? 72 : 52;
    const alphaVal = Math.max(0, baseAlpha + waveMod);

    // Pass 1: 底层宽幅漫射高斯羽化 (Soft Glow Bloom)
    if (k % 2 === 0 && alphaVal > 0.02) {
      ctx.beginPath();
      let p1Started = false;
      for (let j = 0; j <= ANGULAR_STEPS / 2; j++) {
        const theta = Math.PI + (j / (ANGULAR_STEPS / 2)) * Math.PI;
        const curR = r + Math.sin(theta * 4 + ringRot) * (1.5 + superBass * 2.0);
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const px = cx + curR * cosT;
        const lensedY = blackHoleY - Math.abs(sinT) * curR * (0.82 - 0.24 * (eventHorizonR / curR));
        if (!p1Started) {
          ctx.moveTo(px, lensedY);
          p1Started = true;
        } else {
          ctx.lineTo(px, lensedY);
        }
      }
      ctx.strokeStyle = `hsla(${ringHue}, 95%, ${ringLight}%, ${alphaVal * 0.22})`;
      ctx.lineWidth = Math.max(2.5, (1 - frac) * 9.0 + superBass * 3.5);
      ctx.stroke();
    }

    // Pass 2: 顶层丝滑柔光流纤 (Silky Filament)
    ctx.beginPath();
    let started = false;
    for (let j = 0; j <= ANGULAR_STEPS / 2; j++) {
      const theta = Math.PI + (j / (ANGULAR_STEPS / 2)) * Math.PI;
      const curR = r + Math.sin(theta * 4 + ringRot) * (1.5 + superBass * 2.0);
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const px = cx + curR * cosT;
      const lensedY = blackHoleY - Math.abs(sinT) * curR * (0.82 - 0.24 * (eventHorizonR / curR));
      if (!started) {
        ctx.moveTo(px, lensedY);
        started = true;
      } else {
        ctx.lineTo(px, lensedY);
      }
    }
    ctx.strokeStyle = `hsla(${ringHue}, 100%, ${ringLight}%, ${alphaVal * 0.80})`;
    ctx.lineWidth = Math.max(0.65, (1 - frac) * 2.4 + superBass * 1.4);
    ctx.stroke();
  }

  // ─── 4.2 事件视界绝对纯黑吞噬内核 (Pure Black Event Horizon Void) ───
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

  // ─── 4.3 绘制吸积盘前部倾斜主光盘 (Front Half: Tilted Equatorial Disk) ───
  // 双 Pass 渲染：底层柔光漫射 + 顶层丝滑前倾光流
  for (let k = 0; k < NUM_RINGS; k++) {
    const frac = k / (NUM_RINGS - 1);
    const r = minR + Math.pow(frac, 1.18) * (maxR - minR);
    const ringSpeed = (0.010 + (1 / Math.sqrt(r * 2)) * 0.24) * (1 + superBass * 1.8);
    const ringRot = diskRotation * ringSpeed * 36;

    const edgeFade = Math.pow(1 - frac, 1.35);
    const baseAlpha = edgeFade * (0.26 + superBass * 0.18);
    const waveMod = Math.sin(ringRot * 2 + k * 0.25) * 0.08;

    const ringHue = frac < 0.25 ? secondaryHue : frac < 0.65 ? primaryHue : accentHue;
    const ringLight = frac < 0.15 ? 92 : frac < 0.5 ? 76 : 56;
    const alphaVal = Math.max(0, baseAlpha + waveMod);

    // Pass 1: 底层漫射柔光 (Soft Glow)
    if (k % 2 === 0 && alphaVal > 0.02) {
      ctx.beginPath();
      let p1Started = false;
      for (let j = 0; j <= ANGULAR_STEPS / 2; j++) {
        const theta = (j / (ANGULAR_STEPS / 2)) * Math.PI;
        const curR = r + Math.sin(theta * 4 + ringRot) * (1.5 + superBass * 2.0);
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const px = cx + curR * cosT;
        const frontY = blackHoleY + sinT * curR * diskTilt;
        if (!p1Started) {
          ctx.moveTo(px, frontY);
          p1Started = true;
        } else {
          ctx.lineTo(px, frontY);
        }
      }
      ctx.strokeStyle = `hsla(${ringHue}, 95%, ${ringLight}%, ${alphaVal * 0.24})`;
      ctx.lineWidth = Math.max(3.0, (1 - frac) * 10.0 + superBass * 4.0);
      ctx.stroke();
    }

    // Pass 2: 顶层柔光流纤
    ctx.beginPath();
    let started = false;
    for (let j = 0; j <= ANGULAR_STEPS / 2; j++) {
      const theta = (j / (ANGULAR_STEPS / 2)) * Math.PI;
      const curR = r + Math.sin(theta * 4 + ringRot) * (1.5 + superBass * 2.0);
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
    ctx.strokeStyle = `hsla(${ringHue}, 100%, ${ringLight}%, ${alphaVal * 0.85})`;
    ctx.lineWidth = Math.max(0.70, (1 - frac) * 2.8 + superBass * 1.6);
    ctx.stroke();
  }

  // ─── 4.4 极细柔和光子球临界薄环 (Soft Photon Sphere Rim) ───
  const photonSphereR = eventHorizonR * 1.02;
  ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 94%, ${0.85 + superBass * 0.10})`;
  ctx.lineWidth = 1.2 + superBass * 1.2;
  ctx.shadowColor = `hsla(${primaryHue}, 100%, 75%, 0.65)`;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(cx, blackHoleY, photonSphereR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0; // 重置阴影避免污染其他图元

  // ─── 4.5 2.39:1 变形宽银幕柔和水平拉丝耀斑 (Silky Anamorphic Flare) ───
  const flareW = width * (0.88 + superBass * 0.25);
  const flareH = 8 + superBass * 10;
  const leftFlareGrd = ctx.createLinearGradient(cx - flareW * 0.5, blackHoleY, cx - eventHorizonR * 1.04, blackHoleY);
  leftFlareGrd.addColorStop(0, "rgba(0,0,0,0)");
  leftFlareGrd.addColorStop(0.5, `hsla(${secondaryHue}, 100%, 85%, 0.20)`);
  leftFlareGrd.addColorStop(1, `hsla(${secondaryHue}, 100%, 96%, 0.75)`);
  ctx.fillStyle = leftFlareGrd;
  ctx.fillRect(cx - flareW * 0.5, blackHoleY - flareH * 0.5, flareW * 0.5 - eventHorizonR * 1.04, flareH);

  const rightFlareGrd = ctx.createLinearGradient(cx + eventHorizonR * 1.04, blackHoleY, cx + flareW * 0.5, blackHoleY);
  rightFlareGrd.addColorStop(0, `hsla(${accentHue}, 90%, 82%, 0.55)`);
  rightFlareGrd.addColorStop(0.5, `hsla(${primaryHue}, 85%, 65%, 0.18)`);
  rightFlareGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rightFlareGrd;
  ctx.fillRect(cx + eventHorizonR * 1.04, blackHoleY - flareH * 0.5, flareW * 0.5 - eventHorizonR * 1.04, flareH);

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

