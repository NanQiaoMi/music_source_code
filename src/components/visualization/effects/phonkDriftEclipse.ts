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

interface PhonkShockwave {
  z: number; // 0 (horizon) to 1 (near camera)
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
let accretionRotation = 0;
let orbitalRingAngle = 0;
let breathLFO = 0;

const PARTICLE_COUNT = 800;
const SMOKE_COUNT = 32;
const SPARK_COUNT = 75;
const HORIZON_RATIO = 0.44; // 地平线黄金分割比例

// 预烘焙 128x128 电影 35mm 质感胶片纹理 (1.8% 极微底片颗粒，柔化画面)
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
      buf[i + 3] = 5; // 2% 纯净有机底片噪点
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
      size: Math.random() * 2.4 + 0.8,
      speed: Math.random() * 1.6 + 0.8,
      alpha: Math.random() * 0.75 + 0.25,
      hue: Math.random() > 0.45 ? 295 : 185,
      isStreak: Math.random() > 0.3,
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
      size: Math.random() * 2.6 + 1.0,
      alpha: Math.random() * 0.85 + 0.15,
      life: 0,
      maxLife: Math.random() * 35 + 20,
      color: Math.random() > 0.35 ? "#ffaa33" : "#00f0ff",
    });
  }
}

/**
 * 赛博漂移 · 电影级日蚀特异点 (Phonk Drift Eclipse 5.0 - Ultimate Drift Edition)
 * 极致硬核 Phonk 氛围：动态 S 弯道、赛车遥测 HUD 转速表、实时波形激光与星际等离子喷流
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

  // 1. Phonk 专项音频解耦 (Sub-bass 808, Bassline, Cowbell mid, Snare/Hi-hat treble)
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

  // 有机多频呼吸时钟与漂移弯道偏角 (Drift Curvature Swerve)
  breathLFO += 0.014;
  const organicBreath = Math.sin(breathLFO) * 0.5 + 0.5; // 0 ~ 1 慢速深呼吸
  const harmonicPulse = Math.sin(breathLFO * 2.4) * 0.5 + 0.5;

  // 漂移弯道横向摆幅（随音乐节奏自然 S 型压弯）
  driftCurveOffset = Math.sin(breathLFO * 0.7) * (width * 0.08) * (1 + bassEnergy * 0.5);

  // 808 重低音瞬态平滑扩张冲击波
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

  // 镜头微动与节奏漂移倾角 (Cinematic Drift Sway & Camera Breathing)
  cameraSwayAngle = Math.sin(breathLFO * 0.7) * 0.018 * (1 + superBass * 0.6);
  let shakeX = 0;
  let shakeY = 0;
  if (superBass > 0.55) {
    const shakeMag = (superBass - 0.55) * 16 * bassIntensity;
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag * 0.65;
  }

  // 色相主题映射 (Tokyo Noir Palette)
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
  const dollyOffset = (superBass * 9 + organicBreath * 5) * bassIntensity;
  const horizonY = height * HORIZON_RATIO + shakeY - dollyOffset * 0.25;
  const centerX = width * 0.5 + shakeX;

  ctx.save();

  // ─── 0. 底层深曜石黑与星云夜空 (Deep Tokyo Obsidian Void) ───
  ctx.fillStyle = "#030305";
  ctx.fillRect(0, 0, width, height);

  // 动态天空渐变
  const skyGrd = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrd.addColorStop(0, "#010103");
  skyGrd.addColorStop(0.55, `hsla(${primaryHue}, 75%, ${5 + organicBreath * 3}%, 0.95)`);
  skyGrd.addColorStop(0.88, `hsla(${secondaryHue}, 90%, ${10 + midEnergy * 6}%, 0.85)`);
  skyGrd.addColorStop(1, `hsla(${accentHue}, 95%, ${15 + superBass * 7}%, 0.9)`);
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, width, horizonY);

  // ─── 1. 远景东京赛博大厦与数字山脉天际线 (Tokyo Cyber Skyline & Mountains) ───
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const skylineBuildingCount = 28;
  const bStep = width / skylineBuildingCount;

  ctx.fillStyle = "#05050a";
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  for (let i = 0; i <= skylineBuildingCount; i++) {
    const bx = i * bStep;
    const distFromCenter = Math.abs(bx - centerX) / (width * 0.5);
    // 两侧是高耸的赛博大厦与山峦，中间让出给日蚀
    const isBuilding = i % 2 === 0 && distFromCenter > 0.35;
    const bHeight = isBuilding
      ? (35 + Math.sin(i * 3.7) * 25) * Math.pow(distFromCenter, 1.2)
      : (Math.sin(i * 1.5 + breathLFO * 0.15) * 0.5 + 0.5) * 35 * Math.pow(distFromCenter, 1.4);
    ctx.lineTo(bx, horizonY - bHeight);
    if (isBuilding) {
      ctx.lineTo(bx + bStep * 0.8, horizonY - bHeight);
    }
  }
  ctx.lineTo(width, horizonY);
  ctx.closePath();
  ctx.fill();

  // 天际线霓虹发光描边
  ctx.strokeStyle = `hsla(${primaryHue}, 90%, 65%, ${0.28 + midEnergy * 0.35})`;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  // ─── 2. 电影光学胶片光晕 (Film Halation Soft Orange Fringe) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const eclipseRadius = Math.min(width, height) * (0.13 + superBass * 0.05 * bassIntensity + organicBreath * 0.008);
  const halationRadius = eclipseRadius * (2.2 + superBass * 0.5);
  const halationGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    eclipseRadius * 0.85,
    centerX,
    horizonY,
    halationRadius
  );
  halationGrd.addColorStop(0, `rgba(255, 65, 40, ${0.38 + superBass * 0.25})`);
  halationGrd.addColorStop(0.45, `rgba(255, 125, 30, ${0.16 + midEnergy * 0.15})`);
  halationGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halationGrd;
  ctx.beginPath();
  ctx.arc(centerX, horizonY, halationRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ─── 3. 地平线星际日蚀黑洞与吸积盘 (Solar Singularity & Relativistic Accretion Swirl) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // 宽银幕变形镜头柔和水平耀斑 (Ultra-Clean Anamorphic Streak Flare)
  const flareWidth = width * (0.88 + superBass * 0.35);
  const flareHeight = 14 + superBass * 20;
  const flareGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    0,
    centerX,
    horizonY,
    flareWidth * 0.5
  );
  flareGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 88%, ${0.8 + midEnergy * 0.15})`);
  flareGrd.addColorStop(0.2, `hsla(${primaryHue}, 90%, 65%, 0.5)`);
  flareGrd.addColorStop(0.55, `hsla(${accentHue}, 85%, 50%, 0.18)`);
  flareGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = flareGrd;
  ctx.fillRect(centerX - flareWidth * 0.5, horizonY - flareHeight * 0.5, flareWidth, flareHeight);

  // 4 束微光星芒光刺 (Cinematic Diffraction Spikes)
  const spikeLen = eclipseRadius * (2.6 + superBass * 1.2);
  ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 80%, ${0.22 + midEnergy * 0.25})`;
  ctx.lineWidth = 1.2;
  for (let sp = 0; sp < 4; sp++) {
    const spAngle = (sp / 4) * Math.PI + Math.PI * 0.25;
    ctx.beginPath();
    ctx.moveTo(centerX - Math.cos(spAngle) * spikeLen, horizonY - Math.sin(spAngle) * spikeLen);
    ctx.lineTo(centerX + Math.cos(spAngle) * spikeLen, horizonY + Math.sin(spAngle) * spikeLen);
    ctx.stroke();
  }

  // 大气日冕扩散发光环 (Atmospheric Outer Corona)
  const coronaGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    eclipseRadius * 0.75,
    centerX,
    horizonY,
    eclipseRadius * (3.0 + organicBreath * 0.3)
  );
  coronaGrd.addColorStop(0, `hsla(${primaryHue}, 95%, 65%, ${0.58 + superBass * 0.25})`);
  coronaGrd.addColorStop(0.35, `hsla(${secondaryHue}, 85%, 55%, 0.32)`);
  coronaGrd.addColorStop(0.7, `hsla(${accentHue}, 90%, 45%, 0.12)`);
  coronaGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = coronaGrd;
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius * (3.0 + organicBreath * 0.3), 0, Math.PI * 2);
  ctx.fill();

  // 星际多普勒吸积盘 (Relativistic Accretion Disk with Doppler Beaming)
  accretionRotation += 0.007 * (1 + cruiseSpeed * 0.5);
  const diskR = eclipseRadius * (1.65 + superBass * 0.3);
  ctx.save();
  ctx.translate(centerX, horizonY);
  ctx.scale(1.0, 0.36);

  const diskGrd = ctx.createRadialGradient(0, 0, eclipseRadius * 0.9, 0, 0, diskR);
  diskGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 85%, ${0.88 + superBass * 0.1})`);
  diskGrd.addColorStop(0.4, `hsla(${primaryHue}, 90%, 65%, 0.72)`);
  diskGrd.addColorStop(0.8, `hsla(${accentHue}, 85%, 50%, 0.28)`);
  diskGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.strokeStyle = diskGrd;
  ctx.lineWidth = 14 + superBass * 18;
  ctx.beginPath();
  ctx.arc(0, 0, diskR * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  // 吸积盘等离子流微粒 (Smooth Accretion Streams)
  const streamCount = 48;
  for (let s = 0; s < streamCount; s++) {
    const sAngle = (s / streamCount) * Math.PI * 2 + accretionRotation;
    const sRadius = eclipseRadius * (1.05 + ((s * 7) % 19) / 22);
    const sX = Math.cos(sAngle) * sRadius;
    const sY = Math.sin(sAngle) * sRadius;
    // 多普勒效应：左侧迎光面偏青白，右侧背光面偏绯红
    const isApproaching = Math.sin(sAngle) > 0;
    ctx.fillStyle = isApproaching ? `hsla(${secondaryHue}, 100%, 85%, 0.9)` : `hsla(${primaryHue}, 95%, 70%, 0.7)`;
    ctx.beginPath();
    ctx.arc(sX, sY, Math.random() * 2.0 + 1.0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ─── 4. Phonk 专属：赛车遥测 HUD 转速表弧与矢量刻度 (Tachometer Arc & Telemetry HUD) ───
  ctx.save();
  ctx.translate(centerX, horizonY);

  // 顶部半环形音频峰值转速表 (Audio Peak RPM Tachometer Arc)
  const tachRadius = eclipseRadius * 1.35;
  const tachSegments = 32;
  const tachStartAngle = Math.PI * 1.1;
  const tachEndAngle = Math.PI * 1.9;
  const currentRPMProgress = Math.min(1.0, superBass * 1.25);

  ctx.lineWidth = 2.0;
  for (let t = 0; t < tachSegments; t++) {
    const tProgress = t / (tachSegments - 1);
    const tAngle = tachStartAngle + tProgress * (tachEndAngle - tachStartAngle);
    const isActive = tProgress <= currentRPMProgress;
    const isRedline = tProgress > 0.75;

    const innerR = tachRadius - (t % 4 === 0 ? 6 : 3);
    const outerR = tachRadius;

    ctx.strokeStyle = isActive
      ? isRedline
        ? "#ff3344"
        : `hsla(${secondaryHue}, 100%, 75%, 0.9)`
      : `hsla(${primaryHue}, 60%, 30%, 0.25)`;

    ctx.beginPath();
    ctx.moveTo(Math.cos(tAngle) * innerR, Math.sin(tAngle) * innerR);
    ctx.lineTo(Math.cos(tAngle) * outerR, Math.sin(tAngle) * outerR);
    ctx.stroke();
  }

  // 转速表外圈细圆环
  ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 70%, 0.2)`;
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.arc(0, 0, tachRadius + 3, tachStartAngle, tachEndAngle);
  ctx.stroke();

  // 等离子音波几何轨道环 (Harmonic Orbital Rings)
  orbitalRingAngle += 0.005 * (1 + midEnergy * 1.2);
  ctx.save();
  ctx.rotate(Math.PI * 0.18 + Math.sin(breathLFO * 0.4) * 0.04);
  ctx.scale(1.0, 0.42);

  const ringRadius = eclipseRadius * (2.05 + midEnergy * 0.5);
  ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 75%, ${0.28 + midEnergy * 0.35})`;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  // 谐波驻波能量节点
  const nodeCount = 14;
  for (let n = 0; n < nodeCount; n++) {
    const nAngle = (n / nodeCount) * Math.PI * 2 + orbitalRingAngle;
    const nFreqIdx = Math.min(data.length - 1, 10 + n * 3);
    const nEnergy = data[nFreqIdx] / 255;
    const nx = Math.cos(nAngle) * (ringRadius + nEnergy * 20);
    const ny = Math.sin(nAngle) * (ringRadius + nEnergy * 20);
    const nodeSize = 2.0 + nEnergy * 4.0;

    ctx.fillStyle = n % 2 === 0 ? "#ffffff" : `hsla(${primaryHue}, 100%, 80%, 0.85)`;
    ctx.beginPath();
    ctx.arc(nx, ny, nodeSize, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();

  // 黑洞事件视界绝对纯黑内核 (Black Hole Singularity Core)
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#030305";
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius, 0, Math.PI * 2);
  ctx.fill();

  // 光子球面等离子电光边缘 (Sharp Photon Sphere Rim)
  ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 80%, ${0.8 + superBass * 0.18})`;
  ctx.lineWidth = 3.2 + superBass * 3.0;
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // ─── 5. 地平线精密赛博标尺与经纬 HUD 刻度 (Precision HUD Reticle) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const hudTickCount = 28;
  const hudSpan = width * 0.62;
  const hudStep = hudSpan / hudTickCount;
  ctx.strokeStyle = `hsla(${secondaryHue}, 90%, 70%, ${0.2 + harmonicPulse * 0.12})`;
  ctx.lineWidth = 1.0;
  for (let h = 0; h <= hudTickCount; h++) {
    const hx = centerX - hudSpan * 0.5 + h * hudStep;
    if (Math.abs(hx - centerX) < eclipseRadius * 1.15) continue;
    const isMajor = h % 4 === 0;
    const tickLen = isMajor ? 7 : 3.5;
    ctx.beginPath();
    ctx.moveTo(hx, horizonY - tickLen);
    ctx.lineTo(hx, horizonY + tickLen);
    ctx.stroke();
  }

  // 地平线实时音频示波器激光线 (Real-Time Oscilloscope Laser Line)
  ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 78%, ${0.45 + superBass * 0.35})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const oscStep = 6;
  let firstOsc = true;
  for (let ox = 0; ox <= width; ox += oscStep) {
    if (Math.abs(ox - centerX) < eclipseRadius * 1.1) continue;
    const oscIdx = Math.floor((ox / width) * 45) + 5;
    const oscAmp = ((data[oscIdx] || 0) / 255 - 0.5) * 16 * superBass;
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

  // ─── 6. 808 低音同心超声速激波 (Supersonic Shockwaves) ───
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
    ctx.globalAlpha = sw.alpha * 0.8;
    ctx.lineWidth = sw.width * (1 + sw.z * 2.2);

    ctx.beginPath();
    ctx.ellipse(centerX, horizonY + sw.z * (height - horizonY) * 0.9, currentRadius, currentRadius * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ─── 7. 湿润沥青公路与 S 弯漂移网格 (Wet Asphalt with Drifting S-Curve Grid) ───
  ctx.save();
  const roadHeight = height - horizonY;
  roadScrollOffset += (0.015 + superBass * 0.024) * cruiseSpeed;

  // 地面底层渐变
  const groundGrd = ctx.createLinearGradient(0, horizonY, 0, height);
  groundGrd.addColorStop(0, "#05050c");
  groundGrd.addColorStop(0.25, `hsla(${primaryHue}, 75%, 8%, 0.95)`);
  groundGrd.addColorStop(0.7, `hsla(${secondaryHue}, 70%, 5%, 0.98)`);
  groundGrd.addColorStop(1, "#020204");
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, horizonY, width, roadHeight);

  // 柔和高斯羽化镜面反光锥 (Gaussian Feathered Floor Reflection)
  ctx.globalCompositeOperation = "screen";
  const mirrorGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    0,
    centerX,
    horizonY + roadHeight * 0.45,
    Math.max(width * 0.45, roadHeight * 0.9)
  );
  mirrorGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 75%, ${0.4 + superBass * 0.25})`);
  mirrorGrd.addColorStop(0.3, `hsla(${primaryHue}, 85%, 55%, ${0.2 + midEnergy * 0.15})`);
  mirrorGrd.addColorStop(0.65, `hsla(${accentHue}, 80%, 40%, 0.08)`);
  mirrorGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mirrorGrd;
  ctx.fillRect(0, horizonY, width, roadHeight);

  // 3D 透视网格公路与 S 弯道偏摆 (S-Curve Road Deformation)
  const LATITUDE_LINES = 26;
  const LONGITUDE_LINES = 22;
  const roadHalfWidth = width * 1.05;
  const gravitySink = superBass * 48 * bassIntensity;

  // 绘制横向透视网格
  for (let i = 0; i < LATITUDE_LINES; i++) {
    const rawProgress = ((i / LATITUDE_LINES + (roadScrollOffset % (1 / LATITUDE_LINES))) % 1.0);
    const perspectiveZ = Math.pow(rawProgress, 2.3);
    const lineY = horizonY + roadHeight * perspectiveZ;
    const spanWidth = roadHalfWidth * Math.pow(rawProgress, 1.45);

    if (lineY <= horizonY || spanWidth < 4) continue;

    // 弯道水平偏移随深度扩散
    const curveXOffset = Math.sin(perspectiveZ * Math.PI) * driftCurveOffset;
    const lineAlpha = Math.min(1.0, perspectiveZ * 1.4) * (0.35 + superBass * 0.4);
    ctx.strokeStyle = `hsla(${primaryHue}, 85%, ${50 + perspectiveZ * 22}%, ${lineAlpha})`;
    ctx.lineWidth = Math.max(1.0, perspectiveZ * 3.2);

    ctx.beginPath();
    const waveUndulation = Math.sin(perspectiveZ * 10 - roadScrollOffset * 7) * (superBass * 12 * perspectiveZ);
    const centerDip = Math.sin(perspectiveZ * Math.PI) * gravitySink + waveUndulation;
    ctx.moveTo(centerX + curveXOffset - spanWidth, lineY);
    ctx.quadraticCurveTo(centerX + curveXOffset, lineY + centerDip, centerX + curveXOffset + spanWidth, lineY);
    ctx.stroke();
  }

  // 绘制纵向车道延伸线 (带 S 弯漂移曲率)
  for (let j = 0; j <= LONGITUDE_LINES; j++) {
    const normX = (j / LONGITUDE_LINES - 0.5) * 2;
    const isCenterLane = Math.abs(normX) < 0.08;
    const isOuterRail = Math.abs(normX) > 0.88;

    const beamAlpha = isCenterLane
      ? 0.85 + superBass * 0.15
      : isOuterRail
      ? 0.75 + midEnergy * 0.22
      : (0.3 + (1 - Math.abs(normX)) * 0.35) * (0.6 + superBass * 0.35);

    ctx.strokeStyle = isCenterLane
      ? `hsla(${secondaryHue}, 100%, 80%, ${beamAlpha})`
      : isOuterRail
      ? `hsla(${accentHue}, 100%, 72%, ${beamAlpha})`
      : `hsla(${primaryHue}, 80%, 55%, ${beamAlpha})`;
    ctx.lineWidth = isCenterLane ? 3.0 : isOuterRail ? 2.5 : 1.2;

    ctx.beginPath();
    ctx.moveTo(centerX + normX * (eclipseRadius * 0.22), horizonY);

    const endX = centerX + normX * roadHalfWidth;
    const endY = height;
    const controlDip = isCenterLane ? gravitySink * 0.8 : gravitySink * 0.3 * (1 - Math.abs(normX));
    ctx.quadraticCurveTo(
      centerX + normX * (roadHalfWidth * 0.36) + driftCurveOffset * 0.7,
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
    const pY = horizonY + roadHeight * pZ;
    const pSpan = roadHalfWidth * Math.pow(pProgress, 1.4) * 1.02;
    const sampleIdx = Math.min(data.length - 1, 6 + k * 5);
    const colHeight = (data[sampleIdx] / 255) * 95 * pZ * bassIntensity;

    if (pY <= horizonY || colHeight < 3) continue;

    const colAlpha = pZ * (0.45 + midEnergy * 0.45);
    const pCurveX = Math.sin(pZ * Math.PI) * driftCurveOffset;
    ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 75%, ${colAlpha})`;
    ctx.lineWidth = Math.max(1.6, pZ * 3.8);

    // 左侧
    ctx.beginPath();
    ctx.moveTo(centerX + pCurveX - pSpan, pY);
    ctx.lineTo(centerX + pCurveX - pSpan, pY - colHeight);
    ctx.stroke();

    // 右侧
    ctx.beginPath();
    ctx.moveTo(centerX + pCurveX + pSpan, pY);
    ctx.lineTo(centerX + pCurveX + pSpan, pY - colHeight);
    ctx.stroke();
  }

  // 地平线柔和霓虹薄雾
  const mistGrd = ctx.createLinearGradient(0, horizonY - 15, 0, horizonY + 35);
  mistGrd.addColorStop(0, `hsla(${primaryHue}, 80%, 15%, 0)`);
  mistGrd.addColorStop(0.4, `hsla(${secondaryHue}, 90%, 25%, ${0.28 + superBass * 0.15})`);
  mistGrd.addColorStop(1, `hsla(${primaryHue}, 80%, 10%, 0)`);
  ctx.fillStyle = mistGrd;
  ctx.fillRect(0, horizonY - 15, width, 50);

  ctx.restore();

  // ─── 8. 漂移橙金火花与低空烟雾 (Drift Sparks & Ambient Smoke) ───
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

  // ─── 9. 光速穿梭星尘粒子流 (Hyper-Speed Stardust & Speed Streaks) ───
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
    const rotX = p.x * cosS - p.y * sinS;
    const rotY = p.x * sinS + p.y * cosS;

    const screenX = centerX + (rotX / p.z) * fov;
    const screenY = horizonY + (rotY / p.z) * fov;
    const prevScreenX = centerX + (rotX / p.prevZ) * fov;
    const prevScreenY = horizonY + (rotY / p.prevZ) * fov;

    if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50) continue;

    const pScale = (1000 - p.z) / 1000;
    const pAlpha = p.alpha * Math.pow(pScale, 1.2) * (0.6 + trebleEnergy * 0.35);

    if (p.isStreak && speedMult > 1.8) {
      ctx.strokeStyle = `hsla(${p.hue}, 100%, 80%, ${pAlpha})`;
      ctx.lineWidth = Math.max(1.0, p.size * pScale * 1.6);
      ctx.beginPath();
      ctx.moveTo(prevScreenX, prevScreenY);
      ctx.lineTo(screenX, screenY);
      ctx.stroke();
    } else {
      ctx.fillStyle = `hsla(${p.hue}, 95%, 85%, ${pAlpha})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.size * (0.5 + pScale * 1.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // ─── 10. 电影 35mm 胶片颗粒与 2.39:1 柔和变形暗角 (Film Grain & Anamorphic Vignette) ───
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
