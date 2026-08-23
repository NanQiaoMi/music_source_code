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
let cameraSwayAngle = 0;
let accretionRotation = 0;
let orbitalRingAngle = 0;
let breathLFO = 0;

const PARTICLE_COUNT = 750;
const SMOKE_COUNT = 28;
const SPARK_COUNT = 60;
const HORIZON_RATIO = 0.45; // 地平线黄金分割比例

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
      x: (Math.random() - 0.5) * width * 3.2,
      y: (Math.random() - 0.5) * height * 2.2,
      z: Math.random() * 1000 + 10,
      prevZ: 0,
      size: Math.random() * 2.2 + 0.8,
      speed: Math.random() * 1.5 + 0.8,
      alpha: Math.random() * 0.7 + 0.25,
      hue: Math.random() > 0.5 ? 295 : 185,
      isStreak: Math.random() > 0.35,
    });
  }

  driftSmokes = [];
  for (let i = 0; i < SMOKE_COUNT; i++) {
    driftSmokes.push({
      x: (Math.random() - 0.5) * width * 1.3,
      y: height * (HORIZON_RATIO + 0.08 + Math.random() * 0.45),
      radius: Math.random() * 120 + 60,
      alpha: Math.random() * 0.16 + 0.04,
      vx: (Math.random() - 0.5) * 1.2,
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
      vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 4.5 - 2,
      size: Math.random() * 2.4 + 1.0,
      alpha: Math.random() * 0.8 + 0.2,
      life: 0,
      maxLife: Math.random() * 35 + 20,
      color: Math.random() > 0.4 ? "#ffaa33" : "#00f0ff",
    });
  }
}

/**
 * 赛博漂移 · 电影级日蚀特异点 (Phonk Drift Eclipse 4.0 - Pure Cinema Edition)
 * 极致克制的高级光学美学、柔和有机呼吸与多频段音乐互动
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

  const bassIntensity = params?.bassIntensity ?? 1.2;
  const cruiseSpeed = params?.cruiseSpeed ?? 1.3;
  const colorMode = params?.colorMode ?? 0; // 0: 自适应流光, 1: 极夜霓虹, 2: 暗红狂暴, 3: 黑金奢华

  // 1. Phonk 专项音频解耦 (Sub-bass, Bass, Cowbell mid, Snare/Hi-hat treble)
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

  // Attack / Decay 双速动态平滑阻尼 (绝不产生任何突兀跳变)
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

  // 有机多频呼吸时钟 (Continuous Organic LFO)
  breathLFO += 0.012;
  const organicBreath = Math.sin(breathLFO) * 0.5 + 0.5; // 0 ~ 1 慢速深呼吸
  const harmonicPulse = Math.sin(breathLFO * 2.2) * 0.5 + 0.5;

  // 808 重低音瞬态触发平滑扩张冲击波 (柔和扩散，绝无硬边)
  if (superBass > 0.78 && Math.random() < 0.35) {
    activeShockwaves.push({
      z: 0.01,
      radius: 20,
      maxRadius: Math.max(width, height) * 0.88,
      alpha: 0.85,
      color: colorMode === 2 ? "#ff3366" : colorMode === 3 ? "#ffd700" : "#00e5ff",
      speed: 0.024 + superBass * 0.018,
      width: Math.random() * 3 + 2.0,
    });
  }

  // 镜头微动与节奏漂移倾角 (Cinematic Drift Sway & Camera Breathing)
  cameraSwayAngle = Math.sin(Date.now() * 0.001) * 0.012 * (1 + superBass * 0.5);
  let shakeX = 0;
  let shakeY = 0;
  if (superBass > 0.58) {
    const shakeMag = (superBass - 0.58) * 14 * bassIntensity;
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag * 0.65;
  }

  // 色相主题映射
  let primaryHue = theme?.primary ?? 285;
  let secondaryHue = theme?.secondary ?? 190;
  let accentHue = theme?.accent ?? 325;

  if (colorMode === 1) {
    primaryHue = 320;
    secondaryHue = 185;
    accentHue = 275;
  } else if (colorMode === 2) {
    primaryHue = 355;
    secondaryHue = 18;
    accentHue = 0;
  } else if (colorMode === 3) {
    primaryHue = 45;
    secondaryHue = 205;
    accentHue = 55;
  }

  // 视口基准点 (Dolly Breathing 带来细腻的电影视距微推拉)
  const dollyOffset = (superBass * 8 + organicBreath * 5) * bassIntensity;
  const horizonY = height * HORIZON_RATIO + shakeY - dollyOffset * 0.25;
  const centerX = width * 0.5 + shakeX;

  ctx.save();

  // ─── 0. 底层深曜石黑与星云夜空 (Deep Obsidian Void) ───
  ctx.fillStyle = "#040406";
  ctx.fillRect(0, 0, width, height);

  // 动态天空渐变 (Sky Gradient)
  const skyGrd = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrd.addColorStop(0, "#020203");
  skyGrd.addColorStop(0.55, `hsla(${primaryHue}, 70%, ${5 + organicBreath * 3}%, 0.95)`);
  skyGrd.addColorStop(0.88, `hsla(${secondaryHue}, 85%, ${10 + midEnergy * 5}%, 0.85)`);
  skyGrd.addColorStop(1, `hsla(${accentHue}, 90%, ${14 + superBass * 6}%, 0.9)`);
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, width, horizonY);

  // ─── 1. 远景低多边形赛博山脉轮廓 (Horizon Cyber Mountains) ───
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const mountainPeakCount = 20;
  const mStep = width / mountainPeakCount;

  ctx.fillStyle = "#050509";
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  for (let i = 0; i <= mountainPeakCount; i++) {
    const mx = i * mStep;
    const distFromCenter = Math.abs(mx - centerX) / (width * 0.5);
    const mHeight = (Math.sin(i * 1.7 + breathLFO * 0.15) * 0.5 + 0.5) * 42 * Math.pow(distFromCenter, 1.4) * (1 + bassEnergy * 0.3);
    ctx.lineTo(mx, horizonY - mHeight);
  }
  ctx.lineTo(width, horizonY);
  ctx.closePath();
  ctx.fill();

  // 山脊柔和发光描边
  ctx.strokeStyle = `hsla(${primaryHue}, 85%, 60%, ${0.25 + midEnergy * 0.35})`;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  // ─── 2. 柔和连续的大气丁达尔体积光晕 (Soft Volumetric Crepuscular Haze) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const eclipseRadius = Math.min(width, height) * (0.13 + superBass * 0.05 * bassIntensity + organicBreath * 0.008);
  const rayCount = 18;
  const rayMaxLen = Math.max(width, height) * (0.75 + midEnergy * 0.35);

  for (let i = 0; i < rayCount; i++) {
    const rayAngle = ((i / rayCount) * Math.PI) + Math.PI + (Math.sin(Date.now() * 0.0003 + i) * 0.05);
    const rayFreqIdx = Math.min(data.length - 1, 8 + (i % 10) * 4);
    const rayVal = data[rayFreqIdx] / 255;
    const rayLen = rayMaxLen * (0.55 + rayVal * 0.45);
    const rayAlpha = (0.04 + rayVal * 0.14 + midEnergy * 0.10);

    const rayGrd = ctx.createRadialGradient(
      centerX,
      horizonY,
      eclipseRadius * 0.9,
      centerX,
      horizonY,
      rayLen
    );
    rayGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 75%, ${rayAlpha})`);
    rayGrd.addColorStop(0.35, `hsla(${primaryHue}, 90%, 55%, ${rayAlpha * 0.5})`);
    rayGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = rayGrd;
    ctx.beginPath();
    ctx.moveTo(centerX, horizonY);
    // 使用较宽且柔和的圆弧扇区，避免生硬刀锋棱角
    ctx.arc(centerX, horizonY, rayLen, rayAngle - 0.08, rayAngle + 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // ─── 3. 电影光学胶片光晕 (Film Halation Soft Orange Fringe) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const halationRadius = eclipseRadius * (2.2 + superBass * 0.5);
  const halationGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    eclipseRadius * 0.85,
    centerX,
    horizonY,
    halationRadius
  );
  halationGrd.addColorStop(0, `rgba(255, 75, 45, ${0.35 + superBass * 0.25})`);
  halationGrd.addColorStop(0.45, `rgba(255, 130, 35, ${0.15 + midEnergy * 0.15})`);
  halationGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halationGrd;
  ctx.beginPath();
  ctx.arc(centerX, horizonY, halationRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ─── 4. 地平线星际日蚀黑洞与吸积盘 (Solar Singularity & Accretion Disk) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // 宽银幕变形镜头柔和耀斑 (Smooth Anamorphic Horizontal Flare)
  const flareWidth = width * (0.85 + superBass * 0.35);
  const flareHeight = 16 + superBass * 22;
  const flareGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    0,
    centerX,
    horizonY,
    flareWidth * 0.5
  );
  flareGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 85%, ${0.75 + midEnergy * 0.15})`);
  flareGrd.addColorStop(0.2, `hsla(${primaryHue}, 90%, 65%, 0.5)`);
  flareGrd.addColorStop(0.55, `hsla(${accentHue}, 85%, 50%, 0.18)`);
  flareGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = flareGrd;
  ctx.fillRect(centerX - flareWidth * 0.5, horizonY - flareHeight * 0.5, flareWidth, flareHeight);

  // 4 束微光星芒光刺 (Cinematic Diffraction Spikes)
  const spikeLen = eclipseRadius * (2.6 + superBass * 1.2);
  ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 80%, ${0.2 + midEnergy * 0.25})`;
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
  coronaGrd.addColorStop(0, `hsla(${primaryHue}, 95%, 65%, ${0.55 + superBass * 0.25})`);
  coronaGrd.addColorStop(0.35, `hsla(${secondaryHue}, 85%, 55%, 0.3)`);
  coronaGrd.addColorStop(0.7, `hsla(${accentHue}, 90%, 45%, 0.12)`);
  coronaGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = coronaGrd;
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius * (3.0 + organicBreath * 0.3), 0, Math.PI * 2);
  ctx.fill();

  // 星际吸积盘 (Interstellar Accretion Disk)
  accretionRotation += 0.007 * (1 + cruiseSpeed * 0.5);
  const diskR = eclipseRadius * (1.62 + superBass * 0.3);
  ctx.save();
  ctx.translate(centerX, horizonY);
  ctx.scale(1.0, 0.36); // 倾斜椭圆吸积环

  const diskGrd = ctx.createRadialGradient(0, 0, eclipseRadius * 0.9, 0, 0, diskR);
  diskGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 85%, ${0.85 + superBass * 0.1})`);
  diskGrd.addColorStop(0.4, `hsla(${primaryHue}, 90%, 65%, 0.7)`);
  diskGrd.addColorStop(0.8, `hsla(${accentHue}, 85%, 50%, 0.28)`);
  diskGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.strokeStyle = diskGrd;
  ctx.lineWidth = 12 + superBass * 16;
  ctx.beginPath();
  ctx.arc(0, 0, diskR * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  // 吸积盘等离子流微粒 (Smooth Accretion Streams)
  const streamCount = 44;
  for (let s = 0; s < streamCount; s++) {
    const sAngle = (s / streamCount) * Math.PI * 2 + accretionRotation;
    const sRadius = eclipseRadius * (1.05 + ((s * 7) % 19) / 22);
    const sX = Math.cos(sAngle) * sRadius;
    const sY = Math.sin(sAngle) * sRadius;
    ctx.fillStyle = s % 2 === 0 ? "#ffffff" : `hsla(${secondaryHue}, 100%, 80%, 0.8)`;
    ctx.beginPath();
    ctx.arc(sX, sY, Math.random() * 2.0 + 1.0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ─── 5. 等离子音波几何轨道环 (Harmonic Orbital Rings) ───
  orbitalRingAngle += 0.005 * (1 + midEnergy * 1.2);
  ctx.save();
  ctx.translate(centerX, horizonY);
  ctx.rotate(Math.PI * 0.18 + Math.sin(breathLFO * 0.4) * 0.04);
  ctx.scale(1.0, 0.42);

  const ringRadius = eclipseRadius * (2.0 + midEnergy * 0.5);
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

  // ─── 6. 地平线精密赛博标尺与经纬 HUD 刻度 (Precision HUD Reticle) ───
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
  ctx.restore();

  // ─── 7. 808 低音同心超声速激波 (Supersonic Shockwaves) ───
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

  // ─── 8. 湿润沥青公路与高斯羽化镜面反射 (Wet Asphalt Gaussian Floor Reflection) ───
  ctx.save();
  const roadHeight = height - horizonY;
  roadScrollOffset += (0.014 + superBass * 0.02) * cruiseSpeed;

  // 地面底层渐变
  const groundGrd = ctx.createLinearGradient(0, horizonY, 0, height);
  groundGrd.addColorStop(0, "#06060e");
  groundGrd.addColorStop(0.25, `hsla(${primaryHue}, 75%, 8%, 0.95)`);
  groundGrd.addColorStop(0.7, `hsla(${secondaryHue}, 70%, 5%, 0.98)`);
  groundGrd.addColorStop(1, "#020204");
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, horizonY, width, roadHeight);

  // 柔和高斯羽化镜面反光锥 (Gaussian Feathered Reflection Cone - 绝无生硬矩形边缘)
  ctx.globalCompositeOperation = "screen";
  const mirrorGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    0,
    centerX,
    horizonY + roadHeight * 0.45,
    Math.max(width * 0.45, roadHeight * 0.9)
  );
  mirrorGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 75%, ${0.38 + superBass * 0.25})`);
  mirrorGrd.addColorStop(0.3, `hsla(${primaryHue}, 85%, 55%, ${0.2 + midEnergy * 0.15})`);
  mirrorGrd.addColorStop(0.65, `hsla(${accentHue}, 80%, 40%, 0.08)`);
  mirrorGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mirrorGrd;
  ctx.fillRect(0, horizonY, width, roadHeight);

  // 3D 透视网格公路
  const LATITUDE_LINES = 26;
  const LONGITUDE_LINES = 22;
  const roadHalfWidth = width * 1.05;
  const gravitySink = superBass * 48 * bassIntensity;

  // 绘制横向透视网格 (带有 808 行进波)
  for (let i = 0; i < LATITUDE_LINES; i++) {
    const rawProgress = ((i / LATITUDE_LINES + (roadScrollOffset % (1 / LATITUDE_LINES))) % 1.0);
    const perspectiveZ = Math.pow(rawProgress, 2.3);
    const lineY = horizonY + roadHeight * perspectiveZ;
    const spanWidth = roadHalfWidth * Math.pow(rawProgress, 1.45);

    if (lineY <= horizonY || spanWidth < 4) continue;

    const lineAlpha = Math.min(1.0, perspectiveZ * 1.4) * (0.35 + superBass * 0.4);
    ctx.strokeStyle = `hsla(${primaryHue}, 85%, ${50 + perspectiveZ * 22}%, ${lineAlpha})`;
    ctx.lineWidth = Math.max(1.0, perspectiveZ * 3.2);

    ctx.beginPath();
    const waveUndulation = Math.sin(perspectiveZ * 10 - roadScrollOffset * 7) * (superBass * 12 * perspectiveZ);
    const centerDip = Math.sin(perspectiveZ * Math.PI) * gravitySink + waveUndulation;
    ctx.moveTo(centerX - spanWidth, lineY);
    ctx.quadraticCurveTo(centerX, lineY + centerDip, centerX + spanWidth, lineY);
    ctx.stroke();
  }

  // 绘制纵向车道延伸线
  for (let j = 0; j <= LONGITUDE_LINES; j++) {
    const normX = (j / LONGITUDE_LINES - 0.5) * 2;
    const isCenterLane = Math.abs(normX) < 0.08;
    const isOuterRail = Math.abs(normX) > 0.88;

    const beamAlpha = isCenterLane
      ? 0.82 + superBass * 0.18
      : isOuterRail
      ? 0.72 + midEnergy * 0.22
      : (0.3 + (1 - Math.abs(normX)) * 0.35) * (0.6 + superBass * 0.35);

    ctx.strokeStyle = isCenterLane
      ? `hsla(${secondaryHue}, 100%, 78%, ${beamAlpha})`
      : isOuterRail
      ? `hsla(${accentHue}, 100%, 70%, ${beamAlpha})`
      : `hsla(${primaryHue}, 80%, 55%, ${beamAlpha})`;
    ctx.lineWidth = isCenterLane ? 2.8 : isOuterRail ? 2.4 : 1.2;

    ctx.beginPath();
    ctx.moveTo(centerX + normX * (eclipseRadius * 0.22), horizonY);

    const endX = centerX + normX * roadHalfWidth;
    const endY = height;
    const controlDip = isCenterLane ? gravitySink * 0.8 : gravitySink * 0.3 * (1 - Math.abs(normX));
    ctx.quadraticCurveTo(
      centerX + normX * (roadHalfWidth * 0.36),
      horizonY + roadHeight * 0.5 + controlDip,
      endX,
      endY
    );
    ctx.stroke();
  }

  // 两侧等离子方尖光塔与垂直激光
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
    ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 75%, ${colAlpha})`;
    ctx.lineWidth = Math.max(1.6, pZ * 3.8);

    // 左侧
    ctx.beginPath();
    ctx.moveTo(centerX - pSpan, pY);
    ctx.lineTo(centerX - pSpan, pY - colHeight);
    ctx.stroke();

    // 右侧
    ctx.beginPath();
    ctx.moveTo(centerX + pSpan, pY);
    ctx.lineTo(centerX + pSpan, pY - colHeight);
    ctx.stroke();
  }

  // 地平线柔和霓虹薄雾 (Horizon Neon Depth Mist - 消除拼接痕迹)
  const mistGrd = ctx.createLinearGradient(0, horizonY - 15, 0, horizonY + 35);
  mistGrd.addColorStop(0, `hsla(${primaryHue}, 80%, 15%, 0)`);
  mistGrd.addColorStop(0.4, `hsla(${secondaryHue}, 90%, 25%, ${0.28 + superBass * 0.15})`);
  mistGrd.addColorStop(1, `hsla(${primaryHue}, 80%, 10%, 0)`);
  ctx.fillStyle = mistGrd;
  ctx.fillRect(0, horizonY - 15, width, 50);

  ctx.restore();

  // ─── 9. 漂移火花与低空烟雾 (Drift Sparks & Ambient Smoke) ───
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

  // ─── 10. 光速穿梭星尘粒子流 (Hyper-Speed Stardust & Streaks) ───
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
      p.x = (Math.random() - 0.5) * width * 3.2;
      p.y = (Math.random() - 0.5) * height * 2.2;
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

  // ─── 11. 电影 35mm 胶片颗粒与 2.39:1 柔和变形暗角 (Film Grain & Anamorphic Vignette) ───
  ctx.save();

  // 胶片颗粒 (消解纯色色阶断层)
  const grain = getOrCreateFilmGrain(ctx);
  if (grain) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, width, height);
  }

  // 四周电影级变形宽画幅暗角 (完全柔和渐变)
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
