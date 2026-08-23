/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface PhonkParticle {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  size: number;
  speed: number;
  alpha: number;
  hue: number;
  isStreak: boolean;
}

interface InfallPhoton {
  radius: number;
  baseRadius: number;
  angle: number;
  speed: number;
  size: number;
  alpha: number;
  hue: number;
  arm: number;
}

interface PhonkShockwave {
  z: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  speed: number;
  width: number;
}

interface PhonkDriftSmoke {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  vx: number;
  vy: number;
  scale: number;
  hue: number;
}

interface PhonkDriftSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
}

// 模块级高性能静态对象池与单例缓存（0 GC 垃圾回收卡顿）
let particlePool: PhonkParticle[] = [];
let infallPhotons: InfallPhoton[] = [];
let activeShockwaves: PhonkShockwave[] = [];
let driftSmokes: PhonkDriftSmoke[] = [];
let driftSparks: PhonkDriftSpark[] = [];
let lastCanvasWidth = 0;
let lastCanvasHeight = 0;

// 物理阻尼滤波与有机呼吸状态
let prevBassEnergy = 0;
let prevMidEnergy = 0;
let prevTrebleEnergy = 0;
let prevSuperBassEnergy = 0;
let roadScrollOffset = 0;
let driftCurveOffset = 0;
let cameraSwayAngle = 0;
let horizonLightPhase = 0;
let breathLFO = 0;

const PARTICLE_COUNT = 650;
const INFALL_PHOTON_COUNT = 450;
const SMOKE_COUNT = 24;
const SPARK_COUNT = 55;
const HORIZON_RATIO = 0.44; // 地平线黄金分割比例

// 预烘焙 128x128 电影 35mm 质感胶片纹理 (1.5% 极微底片颗粒)
let filmGrainCanvas: HTMLCanvasElement | null = null;
let filmGrainPattern: CanvasPattern | null = null;

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
      buf[i + 3] = 4; // 1.5% 纯净有机底片噪点
    }
    gCtx.putImageData(imgData, 0, 0);
    filmGrainPattern = ctx.createPattern(filmGrainCanvas, "repeat");
  }
  return filmGrainPattern;
}

function initParticlePool(width: number, height: number) {
  if (particlePool.length >= PARTICLE_COUNT && Math.abs(lastCanvasWidth - width) < 50) return;
  lastCanvasWidth = width;
  lastCanvasHeight = height;

  particlePool = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particlePool.push({
      x: (Math.random() - 0.5) * width * 3.4,
      y: (Math.random() - 0.5) * height * 2.4,
      z: Math.random() * 1000 + 10,
      prevZ: 0,
      size: Math.random() * 2.0 + 0.7,
      speed: Math.random() * 1.5 + 0.8,
      alpha: Math.random() * 0.7 + 0.25,
      hue: Math.random() > 0.45 ? 295 : 185,
      isStreak: Math.random() > 0.35,
    });
  }

  // 初始化向奇点坍缩被捕获的光子流 (Infalling Photons Trapped by Event Horizon)
  infallPhotons = [];
  for (let i = 0; i < INFALL_PHOTON_COUNT; i++) {
    const distFrac = Math.pow(Math.random(), 1.6);
    const r = 25 + distFrac * (Math.min(width, height) * 0.48);
    const arm = i % 4;
    const baseAngle = (arm / 4) * Math.PI * 2 + Math.random() * 0.8;
    infallPhotons.push({
      radius: r,
      baseRadius: r,
      angle: baseAngle + Math.log(r * 0.04 + 1) * 3.2,
      speed: (0.012 + (1 / Math.sqrt(r + 10)) * 0.45),
      size: Math.random() * 2.2 + 0.8,
      alpha: Math.random() * 0.7 + 0.3,
      hue: Math.random() > 0.5 ? 185 : 300,
      arm,
    });
  }

  driftSmokes = [];
  for (let i = 0; i < SMOKE_COUNT; i++) {
    driftSmokes.push({
      x: (Math.random() - 0.5) * width * 1.4,
      y: height * (HORIZON_RATIO + 0.08 + Math.random() * 0.45),
      radius: Math.random() * 120 + 60,
      alpha: Math.random() * 0.16 + 0.04,
      vx: (Math.random() - 0.5) * 1.3,
      vy: (Math.random() - 0.5) * 0.3,
      scale: Math.random() * 0.6 + 0.8,
      hue: Math.random() > 0.5 ? 300 : 190,
    });
  }

  driftSparks = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    driftSparks.push({
      x: (Math.random() > 0.5 ? 1 : -1) * (width * 0.22 + Math.random() * width * 0.28),
      y: height * (HORIZON_RATIO + 0.3 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * 7,
      vy: -Math.random() * 5 - 2,
      size: Math.random() * 2.4 + 1.0,
      alpha: Math.random() * 0.85 + 0.15,
      life: 0,
      maxLife: Math.random() * 35 + 20,
      color: Math.random() > 0.35 ? "#ffaa33" : "#00f0ff",
    });
  }
}

/**
 * 赛博漂移 · 电影级日蚀特异点 (Phonk Drift Eclipse 9.0 - Relativistic Event Horizon Edition)
 * 真实光线无法逃逸引力陷阱、丝绸极光光幕、地平线无缝深空交融、超柔高斯流光
 */
export function drawPhonkDriftEclipse({
  ctx,
  width,
  height,
  data,
  params,
  theme,
}: EffectContext) {
  initParticlePool(width, height);

  const bassIntensity = params?.bassIntensity ?? 1.25;
  const cruiseSpeed = params?.cruiseSpeed ?? 1.35;
  const colorMode = params?.colorMode ?? 0; // 0: 自适应流光, 1: 极夜霓虹, 2: 暗红狂暴, 3: 黑金奢华

  // 1. Phonk 专项音频解耦
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

  // Attack / Decay 双速动态平滑阻尼
  const superBass =
    subBassRaw > prevSuperBassEnergy
      ? prevSuperBassEnergy * 0.08 + subBassRaw * 0.92
      : prevSuperBassEnergy * 0.94 + subBassRaw * 0.06;
  prevSuperBassEnergy = superBass;

  const bassEnergy =
    bassRaw > prevBassEnergy
      ? prevBassEnergy * 0.10 + bassRaw * 0.90
      : prevBassEnergy * 0.94 + bassRaw * 0.06;
  prevBassEnergy = bassEnergy;

  const midEnergy =
    cowbellMidRaw > prevMidEnergy
      ? prevMidEnergy * 0.14 + cowbellMidRaw * 0.86
      : prevMidEnergy * 0.92 + cowbellMidRaw * 0.08;
  prevMidEnergy = midEnergy;

  const trebleEnergy =
    hihatTrebleRaw > prevTrebleEnergy
      ? prevTrebleEnergy * 0.18 + hihatTrebleRaw * 0.82
      : prevTrebleEnergy * 0.88 + hihatTrebleRaw * 0.12;
  prevTrebleEnergy = trebleEnergy;

  // 有机多频呼吸时钟
  breathLFO += 0.014;
  horizonLightPhase += 0.008;
  const organicBreath = Math.sin(breathLFO) * 0.5 + 0.5;

  // 漂移弯道横向摆幅
  driftCurveOffset = Math.sin(breathLFO * 0.7) * (width * 0.075) * (1 + bassEnergy * 0.45);

  // 808 瞬态平滑扩张冲击波
  if (superBass > 0.76 && Math.random() < 0.35) {
    activeShockwaves.push({
      z: 0.01,
      radius: 20,
      maxRadius: Math.max(width, height) * 0.92,
      alpha: 0.85,
      color: colorMode === 2 ? "#ff3366" : colorMode === 3 ? "#ffd700" : "#00f0ff",
      speed: 0.025 + superBass * 0.02,
      width: Math.random() * 3 + 2.0,
    });
  }

  // 镜头微动与节奏漂移倾角
  cameraSwayAngle = Math.sin(breathLFO * 0.7) * 0.016 * (1 + superBass * 0.5);
  let shakeX = 0;
  let shakeY = 0;
  if (superBass > 0.55) {
    const shakeMag = (superBass - 0.55) * 15 * bassIntensity;
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag * 0.6;
  }

  // 色相主题映射
  let primaryHue = theme?.primary ?? 290;
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

  // 视口基准点
  const dollyOffset = (superBass * 8 + organicBreath * 5) * bassIntensity;
  const horizonY = height * HORIZON_RATIO + shakeY - dollyOffset * 0.25;
  const centerX = width * 0.5 + shakeX;
  const eclipseRadius = Math.min(width, height) * (0.13 + superBass * 0.05 * bassIntensity + organicBreath * 0.008);

  ctx.save();

  // ─── 0. 底层深曜石黑与平滑深空夜幕 ───
  ctx.fillStyle = "#020204";
  ctx.fillRect(0, 0, width, height);

  // 天空至地平线的连续丝滑渐变 (无硬分界线)
  const skyGrd = ctx.createLinearGradient(0, 0, 0, horizonY + 80);
  skyGrd.addColorStop(0, "#010103");
  skyGrd.addColorStop(0.5, `hsla(${primaryHue}, 70%, ${5 + organicBreath * 3}%, 0.95)`);
  skyGrd.addColorStop(0.85, `hsla(${secondaryHue}, 80%, ${8 + midEnergy * 5}%, 0.85)`);
  skyGrd.addColorStop(1, `hsla(${primaryHue}, 85%, ${12 + superBass * 6}%, 0.4)`);
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, width, horizonY + 80);

  // ─── 1. 丝绸极光光幕与深空羽化光束 (Cinematic Silk Aurora Curtains - 替代生硬扇形光束) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const numAuroraWaves = 5;
  for (let w = 0; w < numAuroraWaves; w++) {
    const wavePhase = horizonLightPhase + (w * Math.PI) / numAuroraWaves;
    const waveAmp = (40 + w * 25) * (1 + midEnergy * 0.8);
    const waveHue = w % 2 === 0 ? secondaryHue : primaryHue;
    const waveAlpha = (0.045 + (data[10 + w * 6] || 0) / 255 * 0.08 + superBass * 0.05) * (0.7 + organicBreath * 0.3);

    const auroraGrd = ctx.createLinearGradient(0, 0, 0, horizonY);
    auroraGrd.addColorStop(0, `hsla(${waveHue}, 100%, 75%, 0)`);
    auroraGrd.addColorStop(0.35, `hsla(${waveHue}, 90%, 65%, ${waveAlpha * 0.5})`);
    auroraGrd.addColorStop(0.8, `hsla(${waveHue}, 95%, 70%, ${waveAlpha})`);
    auroraGrd.addColorStop(1, `hsla(${accentHue}, 100%, 80%, 0)`);

    ctx.fillStyle = auroraGrd;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    const waveSteps = 24;
    for (let s = 0; s <= waveSteps; s++) {
      const wx = (s / waveSteps) * width;
      const wy = horizonY - (Math.sin((s / waveSteps) * Math.PI * 3 + wavePhase) * waveAmp + (height * 0.32));
      ctx.lineTo(wx, wy);
    }
    ctx.lineTo(width, horizonY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // ─── 2. 远景东京赛博剪影与平滑引力沉降 ───
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const skylineBuildingCount = 28;
  const bStep = width / skylineBuildingCount;

  ctx.fillStyle = "#040408";
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  for (let i = 0; i <= skylineBuildingCount; i++) {
    const bx = i * bStep;
    const distFromCenter = Math.abs(bx - centerX) / (width * 0.5);
    const isBuilding = i % 2 === 0 && distFromCenter > 0.38;
    const gravitySinkSky = Math.pow(Math.max(0, 1 - distFromCenter), 2) * (14 * superBass);
    const bHeight = (isBuilding
      ? (30 + Math.sin(i * 3.7) * 20) * Math.pow(distFromCenter, 1.2)
      : (Math.sin(i * 1.5 + breathLFO * 0.15) * 0.5 + 0.5) * 28 * Math.pow(distFromCenter, 1.4)) - gravitySinkSky;
    ctx.lineTo(bx, horizonY - Math.max(0, bHeight));
    if (isBuilding) {
      ctx.lineTo(bx + bStep * 0.8, horizonY - Math.max(0, bHeight));
    }
  }
  ctx.lineTo(width, horizonY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `hsla(${primaryHue}, 90%, 65%, ${0.15 + midEnergy * 0.20})`;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();

  // ─── 3. 电影光学变形水平耀斑 (Anamorphic Horizontal Streak) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const flareWidth = width * (0.92 + superBass * 0.35);
  const flareHeight = 12 + superBass * 16;
  const flareGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    0,
    centerX,
    horizonY,
    flareWidth * 0.5
  );
  flareGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 88%, ${0.80 + midEnergy * 0.15})`);
  flareGrd.addColorStop(0.18, `hsla(${primaryHue}, 90%, 65%, 0.45)`);
  flareGrd.addColorStop(0.6, `hsla(${accentHue}, 85%, 50%, 0.12)`);
  flareGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = flareGrd;
  ctx.fillRect(centerX - flareWidth * 0.5, horizonY - flareHeight * 0.5, flareWidth, flareHeight);

  // 两极相对论等离子喷流 (Polar Relativistic Jets)
  const jetHeight = height * (0.58 + superBass * 0.38);
  const jetWidth = 3.0 + superBass * 3.8;
  const jetGrd = ctx.createLinearGradient(centerX, horizonY, centerX, horizonY - jetHeight);
  jetGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 92%, ${0.90 + superBass * 0.08})`);
  jetGrd.addColorStop(0.25, `hsla(${primaryHue}, 95%, 72%, 0.55)`);
  jetGrd.addColorStop(0.7, `hsla(${accentHue}, 85%, 50%, 0.12)`);
  jetGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = jetGrd;
  ctx.fillRect(centerX - jetWidth * 0.5, horizonY - jetHeight, jetWidth, jetHeight);
  ctx.restore();

  // ─── 4. 物理级“光线无法逃逸”黑洞引力光陷阱 (Relativistic Light-Sink & Event Horizon) ───
  // 彻底废除生硬拱门与几何悬浮环，纯由向心被吸入的光流、光子捕获球层与黑洞引力透镜构成！
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // A. 大尺度引力透镜弯曲光晕 (Gravitational Lensing Halo: 光线绕过黑洞产生的平滑柔光包层)
  const lensGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    eclipseRadius * 0.75,
    centerX,
    horizonY,
    eclipseRadius * (2.8 + superBass * 0.6)
  );
  lensGrd.addColorStop(0, `hsla(${primaryHue}, 95%, 70%, ${0.60 + superBass * 0.25})`);
  lensGrd.addColorStop(0.3, `hsla(${secondaryHue}, 90%, 60%, ${0.35 + midEnergy * 0.2})`);
  lensGrd.addColorStop(0.7, `hsla(${accentHue}, 85%, 45%, 0.12)`);
  lensGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = lensGrd;
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius * (2.8 + superBass * 0.6), 0, Math.PI * 2);
  ctx.fill();

  // B. 模拟光线向奇点螺旋坍缩吞噬的光流 (Infalling Relativistic Light Streams)
  ctx.save();
  ctx.translate(centerX, horizonY);
  for (let i = 0; i < infallPhotons.length; i++) {
    const ph = infallPhotons[i];
    // 越接近事件视界，角速度和向心径向速度越呈指数级剧增 (Relativistic Acceleration into Horizon)
    const normalizedR = (ph.radius - eclipseRadius) / (width * 0.45);
    const speedMult = 1.0 + (1.0 / Math.max(0.08, normalizedR)) * 0.85 + superBass * 1.5;
    ph.angle += ph.speed * speedMult * 0.35;
    ph.radius -= (0.45 + (1.0 / Math.max(0.12, normalizedR)) * 0.35 + superBass * 1.2);

    // 一旦穿过事件视界，光子在远端重置重新被引力捕获
    if (ph.radius <= eclipseRadius * 0.98) {
      ph.radius = eclipseRadius * (1.8 + Math.random() * 2.2);
      ph.angle = Math.random() * Math.PI * 2;
    }

    const currentR = ph.radius;
    const px = Math.cos(ph.angle) * currentR;
    const py = Math.sin(ph.angle) * (currentR * 0.42); // 扁平吸积盘倾角

    const prevAngle = ph.angle - ph.speed * speedMult * 0.6;
    const prevR = currentR + 4.0;
    const prevPx = Math.cos(prevAngle) * prevR;
    const prevPy = Math.sin(prevAngle) * (prevR * 0.42);

    // 多普勒蓝移：迎面而来的左侧更亮更蓝，右侧渐隐
    const isApproaching = Math.sin(ph.angle) > 0;
    const dopplerAlpha = isApproaching ? 1.4 : 0.6;
    const photonAlpha = Math.min(1.0, (currentR - eclipseRadius) / (eclipseRadius * 0.8)) * ph.alpha * dopplerAlpha * (0.6 + superBass * 0.4);

    if (photonAlpha > 0.05) {
      ctx.strokeStyle = isApproaching
        ? `hsla(${secondaryHue}, 100%, 85%, ${photonAlpha})`
        : `hsla(${primaryHue}, 90%, 65%, ${photonAlpha})`;
      ctx.lineWidth = Math.max(0.8, ph.size * (isApproaching ? 1.4 : 1.0));
      ctx.beginPath();
      ctx.moveTo(prevPx, prevPy);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
  }
  ctx.restore();

  // C. 经典光子球面炽热捕获临界环 (Blazing Photon Sphere Ring - 光无法逃逸的边缘)
  const photonSphereR = eclipseRadius * (1.05 + superBass * 0.08);
  const photonGrd = ctx.createLinearGradient(centerX - photonSphereR, horizonY, centerX + photonSphereR, horizonY);
  // 多普勒效应：左侧极亮白青色，右侧深玫瑰红
  photonGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 90%, ${0.95 + superBass * 0.05})`);
  photonGrd.addColorStop(0.35, `hsla(${primaryHue}, 95%, 75%, 0.85)`);
  photonGrd.addColorStop(1, `hsla(${accentHue}, 90%, 60%, 0.45)`);

  ctx.strokeStyle = photonGrd;
  ctx.lineWidth = 4.5 + superBass * 5.0;
  ctx.beginPath();
  ctx.arc(centerX, horizonY, photonSphereR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // D. 黑洞事件视界绝对纯黑吞噬内核 (Absolute Pure Black Void - 光线无法逃逸的内核)
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#020204";
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius, 0, Math.PI * 2);
  ctx.fill();

  // ─── 5. 地平线实时音频示波器微光激光 ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 78%, ${0.30 + superBass * 0.22})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const oscStep = 6;
  let firstOsc = true;
  for (let ox = 0; ox <= width; ox += oscStep) {
    if (Math.abs(ox - centerX) < eclipseRadius * 1.1) continue;
    const oscIdx = Math.floor((ox / width) * 45) + 5;
    const oscAmp = ((data[oscIdx] || 0) / 255 - 0.5) * 12 * superBass;
    const oy = horizonY + oscAmp;
    if (firstOsc) {
      ctx.moveTo(ox, oy);
      firstOsc = false;
    } else {
      ctx.lineTo(ox, oy);
    }
  }
  ctx.stroke();
  ctx.restore();

  // ─── 6. 808 低音同心超声速引力激波 ───
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

    const currentRadius = sw.radius + (sw.maxRadius - sw.radius) * Math.pow(sw.z, 1.3);
    ctx.strokeStyle = sw.color;
    ctx.globalAlpha = sw.alpha * 0.70;
    ctx.lineWidth = sw.width * (1 + sw.z * 1.8);

    ctx.beginPath();
    ctx.ellipse(centerX, horizonY + sw.z * (height - horizonY) * 0.9, currentRadius, currentRadius * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ─── 7. 湿润沥青公路与地平线无缝深空交融 (Seamless Horizon Road Blending) ───
  // 彻底根除地平线处的黑框/硬切断，由深空薄雾与渐变地面完美过渡！
  ctx.save();
  const roadHeight = height - horizonY;
  roadScrollOffset += (0.015 + superBass * 0.024) * cruiseSpeed;

  // 地面底层渐变：与天空在地平线处完全平滑连续衔接
  const groundGrd = ctx.createLinearGradient(0, horizonY - 20, 0, height);
  groundGrd.addColorStop(0, `hsla(${primaryHue}, 80%, 10%, 0.3)`);
  groundGrd.addColorStop(0.12, `hsla(${primaryHue}, 75%, 7%, 0.92)`);
  groundGrd.addColorStop(0.6, `hsla(${secondaryHue}, 70%, 5%, 0.98)`);
  groundGrd.addColorStop(1, "#020204");
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, horizonY - 10, width, roadHeight + 10);

  // 柔和高斯羽化镜面反光锥
  ctx.globalCompositeOperation = "screen";
  const mirrorGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    0,
    centerX,
    horizonY + roadHeight * 0.45,
    Math.max(width * 0.45, roadHeight * 0.9)
  );
  mirrorGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 75%, ${0.35 + superBass * 0.22})`);
  mirrorGrd.addColorStop(0.3, `hsla(${primaryHue}, 85%, 55%, ${0.18 + midEnergy * 0.12})`);
  mirrorGrd.addColorStop(0.7, `hsla(${accentHue}, 80%, 40%, 0.05)`);
  mirrorGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mirrorGrd;
  ctx.fillRect(0, horizonY, width, roadHeight);

  // 3D 透视网格公路
  const LATITUDE_LINES = 26;
  const LONGITUDE_LINES = 22;
  const roadHalfWidth = width * 1.05;
  const gravitySink = superBass * 44 * bassIntensity;

  // 绘制横向透视网格 (无缝消隐 + 奇点引力拉扯)
  for (let i = 0; i < LATITUDE_LINES; i++) {
    const rawProgress = ((i / LATITUDE_LINES + (roadScrollOffset % (1 / LATITUDE_LINES))) % 1.0);
    const perspectiveZ = Math.pow(rawProgress, 2.3);

    // 靠近地平线处平滑消隐进入深空薄雾 (Zero harsh cutoffs)
    if (perspectiveZ < 0.02) continue;

    const lineY = horizonY + roadHeight * perspectiveZ;
    const spanWidth = roadHalfWidth * Math.pow(rawProgress, 1.45);
    if (spanWidth < 6) continue;

    const swirlFactor = Math.pow(1 - perspectiveZ, 2.5) * (superBass * 28);
    const curveXOffset = Math.sin(perspectiveZ * Math.PI) * driftCurveOffset + swirlFactor;
    // 连续指数深度雾化
    const depthFogAlpha = Math.min(1.0, Math.pow((perspectiveZ - 0.02) * 4.0, 1.2));
    const lineAlpha = Math.min(1.0, perspectiveZ * 1.4) * (0.28 + superBass * 0.32) * depthFogAlpha;

    const waveUndulation = Math.sin(perspectiveZ * 10 - roadScrollOffset * 7) * (superBass * 10 * perspectiveZ);
    // 奇点引力拉扯：中心向上卷入事件视界
    const gravityPullUp = Math.pow(1 - perspectiveZ, 2.2) * (superBass * 32);
    const centerDip = Math.sin(perspectiveZ * Math.PI) * gravitySink + waveUndulation - gravityPullUp;

    // 1. 底层柔和 Bloom 辉光
    ctx.strokeStyle = `hsla(${primaryHue}, 90%, 65%, ${lineAlpha * 0.35})`;
    ctx.lineWidth = Math.max(2.0, perspectiveZ * 4.8);
    ctx.beginPath();
    ctx.moveTo(centerX + curveXOffset - spanWidth, lineY);
    ctx.quadraticCurveTo(centerX + curveXOffset, lineY + centerDip, centerX + curveXOffset + spanWidth, lineY);
    ctx.stroke();

    // 2. 顶层平滑核心线条
    ctx.strokeStyle = `hsla(${primaryHue}, 85%, ${55 + perspectiveZ * 22}%, ${lineAlpha})`;
    ctx.lineWidth = Math.max(0.7, perspectiveZ * 2.0);
    ctx.beginPath();
    ctx.moveTo(centerX + curveXOffset - spanWidth, lineY);
    ctx.quadraticCurveTo(centerX + curveXOffset, lineY + centerDip, centerX + curveXOffset + spanWidth, lineY);
    ctx.stroke();
  }

  // 绘制纵向车道延伸线 (渐变消隐至地平线深处)
  for (let j = 0; j <= LONGITUDE_LINES; j++) {
    const normX = (j / LONGITUDE_LINES - 0.5) * 2;
    const isCenterLane = Math.abs(normX) < 0.08;
    const isOuterRail = Math.abs(normX) > 0.88;

    const baseAlpha = isCenterLane
      ? 0.80 + superBass * 0.15
      : isOuterRail
      ? 0.70 + midEnergy * 0.20
      : (0.28 + (1 - Math.abs(normX)) * 0.32) * (0.55 + superBass * 0.35);

    const laneHue = isCenterLane ? secondaryHue : isOuterRail ? accentHue : primaryHue;
    const laneSat = isCenterLane || isOuterRail ? 100 : 85;
    const laneLight = isCenterLane ? 80 : isOuterRail ? 72 : 55;

    // 1. 底层柔和 Bloom 辉光
    const bloomGrd = ctx.createLinearGradient(0, horizonY, 0, height);
    bloomGrd.addColorStop(0, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, 0)`);
    bloomGrd.addColorStop(0.18, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.12})`);
    bloomGrd.addColorStop(0.55, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.30})`);
    bloomGrd.addColorStop(1, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.40})`);

    ctx.strokeStyle = bloomGrd;
    ctx.lineWidth = isCenterLane ? 4.8 : isOuterRail ? 3.8 : 2.0;

    const endX = centerX + normX * roadHalfWidth;
    const endY = height;
    const controlDip = isCenterLane ? gravitySink * 0.8 : gravitySink * 0.3 * (1 - Math.abs(normX));
    const laneSwirlOffset = Math.sin(normX * Math.PI) * (superBass * 18);

    ctx.beginPath();
    ctx.moveTo(centerX + normX * (eclipseRadius * 0.22), horizonY);
    ctx.quadraticCurveTo(
      centerX + normX * (roadHalfWidth * 0.36) + driftCurveOffset * 0.7 + laneSwirlOffset,
      horizonY + roadHeight * 0.5 + controlDip,
      endX,
      endY
    );
    ctx.stroke();

    // 2. 顶层核心线条
    const coreGrd = ctx.createLinearGradient(0, horizonY, 0, height);
    coreGrd.addColorStop(0, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, 0)`);
    coreGrd.addColorStop(0.18, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.18})`);
    coreGrd.addColorStop(0.55, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha * 0.65})`);
    coreGrd.addColorStop(1, `hsla(${laneHue}, ${laneSat}%, ${laneLight}%, ${baseAlpha})`);

    ctx.strokeStyle = coreGrd;
    ctx.lineWidth = isCenterLane ? 2.0 : isOuterRail ? 1.6 : 0.85;

    ctx.beginPath();
    ctx.moveTo(centerX + normX * (eclipseRadius * 0.22), horizonY);
    ctx.quadraticCurveTo(
      centerX + normX * (roadHalfWidth * 0.36) + driftCurveOffset * 0.7 + laneSwirlOffset,
      horizonY + roadHeight * 0.5 + controlDip,
      endX,
      endY
    );
    ctx.stroke();
  }

  // 两侧等离子方尖光塔
  const pillarCount = 10;
  for (let k = 0; k < pillarCount; k++) {
    const pProgress = ((k / pillarCount + (roadScrollOffset * 0.6 % (1 / pillarCount))) % 1.0);
    const pZ = Math.pow(pProgress, 1.85);
    if (pZ < 0.05) continue;

    const pY = horizonY + roadHeight * pZ;
    const pSpan = roadHalfWidth * Math.pow(pProgress, 1.4) * 1.02;
    const sampleIdx = Math.min(data.length - 1, 6 + k * 5);
    const colHeight = (data[sampleIdx] / 255) * 90 * pZ * bassIntensity;

    if (pY <= horizonY || colHeight < 3) continue;

    const colAlpha = pZ * (0.40 + midEnergy * 0.40);
    const pCurveX = Math.sin(pZ * Math.PI) * driftCurveOffset;
    ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 75%, ${colAlpha})`;
    ctx.lineWidth = Math.max(1.4, pZ * 3.4);

    ctx.beginPath();
    ctx.moveTo(centerX + pCurveX - pSpan, pY);
    ctx.lineTo(centerX + pCurveX - pSpan, pY - colHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + pCurveX + pSpan, pY);
    ctx.lineTo(centerX + pCurveX + pSpan, pY - colHeight);
    ctx.stroke();
  }

  // 地平线柔和深空羽化薄雾 (Seamless Depth Fog)
  const mistRadialGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    0,
    centerX,
    horizonY,
    Math.max(width * 0.55, 260)
  );
  mistRadialGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 70%, ${0.18 + superBass * 0.10})`);
  mistRadialGrd.addColorStop(0.4, `hsla(${primaryHue}, 85%, 40%, ${0.10 + superBass * 0.05})`);
  mistRadialGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mistRadialGrd;
  ctx.fillRect(0, horizonY - 35, width, 80);

  ctx.restore();

  // ─── 8. 漂移橙金火花与低空烟雾 ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < driftSmokes.length; i++) {
    const s = driftSmokes[i];
    s.x += s.vx * (1 + superBass * 1.8);
    s.y += s.vy;
    if (s.x > width * 0.75) s.x = -width * 0.75;
    if (s.x < -width * 0.75) s.x = width * 0.75;

    const smokeGrd = ctx.createRadialGradient(
      centerX + s.x,
      s.y,
      0,
      centerX + s.x,
      s.y,
      s.radius * s.scale
    );
    smokeGrd.addColorStop(0, `hsla(${s.hue}, 85%, 60%, ${s.alpha * (1 + superBass * 0.7)})`);
    smokeGrd.addColorStop(0.45, `hsla(${s.hue}, 75%, 40%, ${s.alpha * 0.35})`);
    smokeGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = smokeGrd;
    ctx.beginPath();
    ctx.arc(centerX + s.x, s.y, s.radius * s.scale, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < driftSparks.length; i++) {
    const sp = driftSparks[i];
    sp.life++;
    sp.x += sp.vx;
    sp.y += sp.vy;
    sp.vy += 0.16;

    if (sp.life >= sp.maxLife) {
      sp.life = 0;
      sp.x = (Math.random() > 0.5 ? 1 : -1) * (width * 0.22 + Math.random() * width * 0.28);
      sp.y = height * (HORIZON_RATIO + 0.35 + Math.random() * 0.2);
      sp.vx = (Math.random() - 0.5) * (6 + superBass * 4);
      sp.vy = -Math.random() * 5 - 2.0;
    }

    const sparkProgress = 1 - sp.life / sp.maxLife;
    ctx.fillStyle = sp.color;
    ctx.globalAlpha = sp.alpha * sparkProgress * (0.55 + superBass * 0.35);
    ctx.beginPath();
    ctx.arc(centerX + sp.x, sp.y, sp.size * sparkProgress, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ─── 9. 全域引力透镜偏折星尘粒子流 ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const speedMult = (1.0 + trebleEnergy * 3.2 + superBass * 1.8) * cruiseSpeed;

  for (let i = 0; i < particlePool.length; i++) {
    const p = particlePool[i];
    p.prevZ = p.z;
    p.z -= p.speed * 9.0 * speedMult;

    if (p.z <= 1) {
      p.z = 1000;
      p.prevZ = 1000;
      p.x = (Math.random() - 0.5) * width * 3.4;
      p.y = (Math.random() - 0.5) * height * 2.4;
    }

    const fov = 380;
    const cosS = Math.cos(cameraSwayAngle);
    const sinS = Math.sin(cameraSwayAngle);
    let rotX = p.x * cosS - p.y * sinS;
    let rotY = p.x * sinS + p.y * cosS;

    // 奇点引力透镜弯曲全屏星尘空间坐标
    const distToCenter = Math.hypot(rotX, rotY);
    if (distToCenter > 10) {
      const deflectionAngle = Math.atan2(rotY, rotX);
      const deflectionForce = (eclipseRadius * 450) / (distToCenter + 120);
      rotX += Math.cos(deflectionAngle + Math.PI * 0.5) * (deflectionForce * 0.25 * (1 + superBass));
      rotY += Math.sin(deflectionAngle + Math.PI * 0.5) * (deflectionForce * 0.25 * (1 + superBass));
    }

    const screenX = centerX + (rotX / p.z) * fov;
    const screenY = horizonY + (rotY / p.z) * fov;
    const prevScreenX = centerX + (rotX / p.prevZ) * fov;
    const prevScreenY = horizonY + (rotY / p.prevZ) * fov;

    if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50) continue;

    const pScale = (1000 - p.z) / 1000;
    const pAlpha = p.alpha * Math.pow(pScale, 1.2) * (0.55 + trebleEnergy * 0.35);

    if (p.isStreak && speedMult > 1.8) {
      ctx.strokeStyle = `hsla(${p.hue}, 100%, 80%, ${pAlpha})`;
      ctx.lineWidth = Math.max(0.85, p.size * pScale * 1.4);
      ctx.beginPath();
      ctx.moveTo(prevScreenX, prevScreenY);
      ctx.lineTo(screenX, screenY);
      ctx.stroke();
    } else {
      ctx.fillStyle = `hsla(${p.hue}, 95%, 85%, ${pAlpha})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.size * (0.5 + pScale * 1.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // ─── 10. 电影 35mm 胶片颗粒与 2.39:1 柔和变形暗角 ───
  ctx.save();

  // 胶片颗粒
  const grain = getOrCreateFilmGrain(ctx);
  if (grain) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, width, height);
  }

  // 四周电影级变形宽画幅暗角
  ctx.globalCompositeOperation = "source-over";
  const vigGrd = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.38,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.84
  );
  vigGrd.addColorStop(0, "rgba(0,0,0,0)");
  vigGrd.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = vigGrd;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();

  ctx.restore();
}
