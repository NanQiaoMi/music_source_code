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

// 物理阻尼滤波记忆
let prevBassEnergy = 0;
let prevMidEnergy = 0;
let prevTrebleEnergy = 0;
let roadScrollOffset = 0;
let cameraSwayAngle = 0;
let accretionRotation = 0;
let lightningFlashTimer = 0;
let lightningFlashIntensity = 0;
let glitchTimer = 0;
let glitchOffset = 0;

const PARTICLE_COUNT = 850;
const SMOKE_COUNT = 32;
const SPARK_COUNT = 65;
const HORIZON_RATIO = 0.44; // 地平线黄金分割比例

// 预烘焙 128x128 电影 35mm 质感胶片纹理
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
      buf[i + 3] = 6; // 2.3% 细腻电影噪点
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
      size: Math.random() * 2.5 + 0.8,
      speed: Math.random() * 1.6 + 0.8,
      alpha: Math.random() * 0.75 + 0.25,
      hue: Math.random() > 0.45 ? 295 : 185,
      isStreak: Math.random() > 0.3,
    });
  }

  driftSmokes = [];
  for (let i = 0; i < SMOKE_COUNT; i++) {
    driftSmokes.push({
      x: (Math.random() - 0.5) * width * 1.3,
      y: height * (HORIZON_RATIO + 0.08 + Math.random() * 0.45),
      radius: Math.random() * 110 + 60,
      alpha: Math.random() * 0.22 + 0.06,
      vx: (Math.random() - 0.5) * 1.4,
      vy: (Math.random() - 0.5) * 0.35,
      scale: Math.random() * 0.6 + 0.8,
      hue: Math.random() > 0.5 ? 300 : 190,
    });
  }

  driftSparks = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    driftSparks.push({
      x: (Math.random() > 0.5 ? 1 : -1) * (width * 0.25 + Math.random() * width * 0.25),
      y: height * (HORIZON_RATIO + 0.3 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 5 - 2,
      size: Math.random() * 2.5 + 1.2,
      alpha: Math.random() * 0.8 + 0.2,
      life: 0,
      maxLife: Math.random() * 35 + 20,
      color: Math.random() > 0.3 ? "#ff9933" : "#00f0ff",
    });
  }
}

/**
 * 赛博漂移 · 电影级日蚀特异点 (Phonk Drift Eclipse 2.0)
 * 专为 Phonk、Drift Phonk 及 808 重低音打造的次世代电影级视听互动引擎
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
  const glitchAberration = params?.glitchAberration ?? 1.0;
  const colorMode = params?.colorMode ?? 0; // 0: 自适应流光, 1: 极夜霓虹, 2: 暗红狂暴, 3: 黑金奢华

  // 1. Phonk 专项音频解耦与动力学分析 (Sub-bass, Cowbell mid, Hi-hat treble)
  let subBassRaw = 0;
  for (let i = 1; i <= 4; i++) subBassRaw += data[i] || 0;
  subBassRaw = subBassRaw / (4 * 255);

  let cowbellMidRaw = 0;
  for (let i = 6; i <= 26; i++) cowbellMidRaw += data[i] || 0;
  cowbellMidRaw = cowbellMidRaw / (21 * 255);

  let hihatTrebleRaw = 0;
  for (let i = 40; i <= 95; i++) hihatTrebleRaw += data[i] || 0;
  hihatTrebleRaw = hihatTrebleRaw / (56 * 255);

  // Attack / Decay 双速动态阻尼：瞬态极速爆发(0.92)，下降沿丝滑呼吸(0.06)
  const bassEnergy =
    subBassRaw > prevBassEnergy
      ? prevBassEnergy * 0.08 + subBassRaw * 0.92
      : prevBassEnergy * 0.93 + subBassRaw * 0.07;
  prevBassEnergy = bassEnergy;

  const midEnergy =
    cowbellMidRaw > prevMidEnergy
      ? prevMidEnergy * 0.12 + cowbellMidRaw * 0.88
      : prevMidEnergy * 0.91 + cowbellMidRaw * 0.09;
  prevMidEnergy = midEnergy;

  const trebleEnergy =
    hihatTrebleRaw > prevTrebleEnergy
      ? prevTrebleEnergy * 0.18 + hihatTrebleRaw * 0.82
      : prevTrebleEnergy * 0.88 + hihatTrebleRaw * 0.12;
  prevTrebleEnergy = trebleEnergy;

  // 综合过载系数（当 808 处于高潮区间时触发全屏白热与雷暴微闪）
  const isOverloaded = bassEnergy > 0.70 && midEnergy > 0.40;
  const overloadIntensity = isOverloaded ? Math.min(1.0, (bassEnergy - 0.70) * 3.6) : 0;

  // 808 重低音瞬态冲击触发同心超声速激波
  if (subBassRaw > 0.75 && Math.random() < 0.38) {
    activeShockwaves.push({
      z: 0.02,
      radius: 25,
      maxRadius: Math.max(width, height) * 0.92,
      alpha: 1.0,
      color: isOverloaded ? "#ffffff" : colorMode === 2 ? "#ff2a55" : colorMode === 3 ? "#ffd700" : "#00f0ff",
      speed: 0.026 + bassEnergy * 0.02,
      width: Math.random() * 4 + 2.5,
    });
  }

  // 雷暴闪电计时器（Snare / Drop 触发暗光微闪）
  if (subBassRaw > 0.84 || (trebleEnergy > 0.75 && Math.random() < 0.08)) {
    lightningFlashTimer = 4;
    lightningFlashIntensity = 0.45 * (bassEnergy + 0.3);
  }
  if (lightningFlashTimer > 0) {
    lightningFlashTimer--;
  } else {
    lightningFlashIntensity *= 0.85;
  }

  // 镜头微动与节奏漂移倾角 (Cinematic Drift Sway & Camera Shake)
  cameraSwayAngle = Math.sin(Date.now() * 0.0012) * 0.015 * (1 + bassEnergy * 0.6);
  let shakeX = 0;
  let shakeY = 0;
  if (bassEnergy > 0.52) {
    const shakeMag = (bassEnergy - 0.52) * 22 * bassIntensity;
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag * 0.75;
  }

  // 色相主题映射
  let primaryHue = theme?.primary ?? 285;
  let secondaryHue = theme?.secondary ?? 190;
  let accentHue = theme?.accent ?? 325;

  if (colorMode === 1) {
    // 极夜霓虹
    primaryHue = 320;
    secondaryHue = 185;
    accentHue = 275;
  } else if (colorMode === 2) {
    // 暗红狂暴
    primaryHue = 355;
    secondaryHue = 18;
    accentHue = 0;
  } else if (colorMode === 3) {
    // 黑金奢华
    primaryHue = 45;
    secondaryHue = 205;
    accentHue = 55;
  }

  // 视口与地平线基准点
  const horizonY = height * HORIZON_RATIO + shakeY;
  const centerX = width * 0.5 + shakeX;

  ctx.save();

  // ─── 0. 底层深曜石黑与星云雷暴天空 (Deep Nebula Void & Ambient Lightning) ───
  ctx.fillStyle = "#040407";
  ctx.fillRect(0, 0, width, height);

  // 动态星云天空渐变 (Sky Gradient)
  const skyGrd = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrd.addColorStop(0, "#020204");
  skyGrd.addColorStop(0.5, `hsla(${primaryHue}, 75%, 7%, 0.95)`);
  skyGrd.addColorStop(0.85, `hsla(${secondaryHue}, 90%, 14%, 0.85)`);
  skyGrd.addColorStop(1, `hsla(${accentHue}, 95%, 22%, 0.9)`);
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, width, horizonY);

  // 雷暴闪电环境微闪
  if (lightningFlashIntensity > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(180, 220, 255, ${lightningFlashIntensity * 0.28})`;
    ctx.fillRect(0, 0, width, horizonY);
    ctx.restore();
  }

  // ─── 1. 远景低多边形赛博山脉轮廓 (Cyber Mountain Range & Horizon Peaks) ───
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const mountainPeakCount = 18;
  const mStep = width / mountainPeakCount;

  // 远景山脉底层剪影
  ctx.fillStyle = "#07070e";
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  for (let i = 0; i <= mountainPeakCount; i++) {
    const mx = i * mStep;
    // 越靠近中心越低，为日蚀让出视觉通道
    const distFromCenter = Math.abs(mx - centerX) / (width * 0.5);
    const mHeight = (Math.sin(i * 1.8) * 0.5 + 0.5) * 45 * Math.pow(distFromCenter, 1.4) * (1 + bassEnergy * 0.3);
    ctx.lineTo(mx, horizonY - mHeight);
  }
  ctx.lineTo(width, horizonY);
  ctx.closePath();
  ctx.fill();

  // 山脊霓虹发光描边 (Neon Crest Highlight)
  ctx.strokeStyle = `hsla(${primaryHue}, 90%, 65%, ${0.35 + midEnergy * 0.45})`;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();

  // ─── 2. 24道立体动态丁达尔神圣光束 (Volumetric Crepuscular God Rays) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const eclipseRadius = Math.min(width, height) * (0.135 + bassEnergy * 0.055 * bassIntensity);
  const rayCount = 24;
  const rayMaxLen = Math.max(width, height) * (0.75 + midEnergy * 0.45);

  for (let i = 0; i < rayCount; i++) {
    const rayAngle = ((i / rayCount) * Math.PI) + Math.PI + (Math.sin(Date.now() * 0.0004 + i) * 0.06);
    const rayFreqIdx = Math.min(data.length - 1, 10 + (i % 12) * 4);
    const rayVal = data[rayFreqIdx] / 255;
    const rayLen = rayMaxLen * (0.5 + rayVal * 0.5);
    const rayAlpha = (0.08 + rayVal * 0.22 + midEnergy * 0.15) * (isOverloaded ? 1.4 : 1.0);

    const rayGrd = ctx.createLinearGradient(
      centerX,
      horizonY,
      centerX + Math.cos(rayAngle) * rayLen,
      horizonY + Math.sin(rayAngle) * rayLen
    );
    rayGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 80%, ${rayAlpha})`);
    rayGrd.addColorStop(0.35, `hsla(${primaryHue}, 95%, 60%, ${rayAlpha * 0.6})`);
    rayGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = rayGrd;
    ctx.beginPath();
    ctx.moveTo(centerX, horizonY);
    ctx.arc(centerX, horizonY, rayLen, rayAngle - 0.035, rayAngle + 0.035);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // ─── 3. 地平线星际日蚀黑洞特异点 (Solar Singularity & Interstellar Accretion Disk) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // 日蚀背后多层宽银幕光芒（Anamorphic Horizontal Flare Beam）
  const flareWidth = width * (0.88 + bassEnergy * 0.45);
  const flareHeight = (18 + bassEnergy * 24) * (1 + overloadIntensity * 1.3);
  const flareGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    0,
    centerX,
    horizonY,
    flareWidth * 0.5
  );
  flareGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 85%, ${0.85 + midEnergy * 0.15})`);
  flareGrd.addColorStop(0.2, `hsla(${primaryHue}, 95%, 70%, 0.6)`);
  flareGrd.addColorStop(0.5, `hsla(${accentHue}, 90%, 55%, 0.25)`);
  flareGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = flareGrd;
  ctx.fillRect(centerX - flareWidth * 0.5, horizonY - flareHeight * 0.5, flareWidth, flareHeight);

  // 六角光斑透镜伪影 (Hexagonal Aperture Ghosts)
  const ghostDistances = [-0.35, -0.18, 0.22, 0.45];
  for (let g = 0; g < ghostDistances.length; g++) {
    const gx = centerX + ghostDistances[g] * width * 0.4;
    const gy = horizonY + (ghostDistances[g] * 0.2) * height * 0.3;
    const gRadius = (16 + Math.abs(ghostDistances[g]) * 24) * (1 + bassEnergy * 0.4);
    ctx.strokeStyle = `hsla(${g % 2 === 0 ? secondaryHue : primaryHue}, 90%, 75%, ${0.15 + midEnergy * 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let s = 0; s < 6; s++) {
      const gAngle = (s / 6) * Math.PI * 2;
      const px = gx + Math.cos(gAngle) * gRadius;
      const py = gy + Math.sin(gAngle) * gRadius;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 大气日冕扩散发光环 (Outer Atmospheric Corona)
  const coronaGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    eclipseRadius * 0.7,
    centerX,
    horizonY,
    eclipseRadius * 3.2
  );
  coronaGrd.addColorStop(0, `hsla(${primaryHue}, 100%, 70%, ${0.65 + bassEnergy * 0.35})`);
  coronaGrd.addColorStop(0.3, `hsla(${secondaryHue}, 90%, 60%, 0.38)`);
  coronaGrd.addColorStop(0.65, `hsla(${accentHue}, 95%, 50%, 0.14)`);
  coronaGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = coronaGrd;
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius * 3.2, 0, Math.PI * 2);
  ctx.fill();

  // 星际吸积盘 (Interstellar Accretion Disk - Upper Gravitational Lensing Arc)
  accretionRotation += 0.008 * (1 + cruiseSpeed * 0.5);
  const diskR = eclipseRadius * (1.65 + bassEnergy * 0.3);
  ctx.save();
  ctx.translate(centerX, horizonY);
  ctx.scale(1.0, 0.38); // 倾斜椭圆吸积环

  // 吸积盘多层等离子光辉
  const diskGrd = ctx.createRadialGradient(0, 0, eclipseRadius * 0.9, 0, 0, diskR);
  diskGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 85%, ${0.9 + bassEnergy * 0.1})`);
  diskGrd.addColorStop(0.4, `hsla(${primaryHue}, 95%, 65%, 0.75)`);
  diskGrd.addColorStop(0.8, `hsla(${accentHue}, 90%, 55%, 0.35)`);
  diskGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.strokeStyle = diskGrd;
  ctx.lineWidth = 14 + bassEnergy * 18;
  ctx.beginPath();
  ctx.arc(0, 0, diskR * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  // 吸积盘高能粒子环流 (Accretion Streams)
  const streamCount = 48;
  for (let s = 0; s < streamCount; s++) {
    const sAngle = (s / streamCount) * Math.PI * 2 + accretionRotation;
    const sRadius = eclipseRadius * (1.05 + ((s * 7) % 19) / 22);
    const sX = Math.cos(sAngle) * sRadius;
    const sY = Math.sin(sAngle) * sRadius;
    ctx.fillStyle = s % 2 === 0 ? "#ffffff" : `hsla(${secondaryHue}, 100%, 80%, 0.8)`;
    ctx.beginPath();
    ctx.arc(sX, sY, Math.random() * 2 + 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 黑洞事件视界绝对纯黑内核 (Black Hole Singularity Core)
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#030305";
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius, 0, Math.PI * 2);
  ctx.fill();

  // 事件视界极度锐利等离子电光边缘 (Sharp Photon Sphere Rim)
  ctx.strokeStyle = isOverloaded
    ? "rgba(255, 255, 255, 0.98)"
    : `hsla(${secondaryHue}, 100%, 80%, ${0.85 + bassEnergy * 0.15})`;
  ctx.lineWidth = 3.5 + bassEnergy * 3.5;
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // ─── 4. 808 低音超声速冲击激波 (Supersonic Expanding Shockwaves) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = activeShockwaves.length - 1; i >= 0; i--) {
    const sw = activeShockwaves[i];
    sw.z += sw.speed;
    sw.alpha *= 0.962;

    if (sw.alpha < 0.02 || sw.z > 1.0) {
      activeShockwaves.splice(i, 1);
      continue;
    }

    const currentRadius = sw.radius + (sw.maxRadius - sw.radius) * Math.pow(sw.z, 1.3);
    ctx.strokeStyle = sw.color;
    ctx.globalAlpha = sw.alpha;
    ctx.lineWidth = sw.width * (1 + sw.z * 2.5);

    ctx.beginPath();
    ctx.ellipse(centerX, horizonY + sw.z * (height - horizonY) * 0.9, currentRadius, currentRadius * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ─── 5. 湿润镜面沥青公路与双层 Tron 发光护栏 (Wet Asphalt Mirror & Cyber Highway) ───
  ctx.save();
  const roadHeight = height - horizonY;
  roadScrollOffset += (0.014 + bassEnergy * 0.022) * cruiseSpeed;

  // 地面反光底层 (Wet Asphalt with Mirror Gradient)
  const groundGrd = ctx.createLinearGradient(0, horizonY, 0, height);
  groundGrd.addColorStop(0, "#080812");
  groundGrd.addColorStop(0.25, `hsla(${primaryHue}, 80%, 10%, 0.95)`);
  groundGrd.addColorStop(0.7, `hsla(${secondaryHue}, 75%, 6%, 0.98)`);
  groundGrd.addColorStop(1, "#020205");
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, horizonY, width, roadHeight);

  // 湿润沥青镜面反射光柱 (Screen-Space Wet Mirror Highlights)
  ctx.globalCompositeOperation = "screen";
  const mirrorWidth = eclipseRadius * (2.6 + bassEnergy * 0.8);
  const mirrorGrd = ctx.createLinearGradient(centerX, horizonY, centerX, height);
  mirrorGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 75%, ${0.45 + bassEnergy * 0.3})`);
  mirrorGrd.addColorStop(0.3, `hsla(${primaryHue}, 90%, 55%, 0.25)`);
  mirrorGrd.addColorStop(0.85, `hsla(${accentHue}, 85%, 45%, 0.1)`);
  mirrorGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = mirrorGrd;
  ctx.fillRect(centerX - mirrorWidth * 0.5, horizonY, mirrorWidth, roadHeight);

  // 3D 透视网格公路参数
  const LATITUDE_LINES = 28; // 横向透视线数量
  const LONGITUDE_LINES = 24; // 纵向车道线数量
  const roadHalfWidth = width * 1.05;

  // 808 低音重力漏斗下陷量 (Bass Gravity Sink)
  const gravitySink = bassEnergy * 55 * bassIntensity;

  // 绘制横向透视网格 (Latitudinal Ground Rings with Bass Sink)
  for (let i = 0; i < LATITUDE_LINES; i++) {
    const rawProgress = ((i / LATITUDE_LINES + (roadScrollOffset % (1 / LATITUDE_LINES))) % 1.0);
    // 指数级透视畸变映射 (0 at horizon -> 1 at screen bottom)
    const perspectiveZ = Math.pow(rawProgress, 2.3);
    const lineY = horizonY + roadHeight * perspectiveZ;
    const spanWidth = roadHalfWidth * Math.pow(rawProgress, 1.45);

    if (lineY <= horizonY || spanWidth < 4) continue;

    // 随深度增强的透明度与线条宽度
    const lineAlpha = Math.min(1.0, perspectiveZ * 1.4) * (0.4 + bassEnergy * 0.45);
    ctx.strokeStyle = isOverloaded
      ? `rgba(255, 255, 255, ${lineAlpha * 0.9})`
      : `hsla(${primaryHue}, 90%, ${52 + perspectiveZ * 24}%, ${lineAlpha})`;
    ctx.lineWidth = Math.max(1.2, perspectiveZ * 3.6);

    ctx.beginPath();
    // 带有中央重力下陷的平滑曲线
    const centerDip = Math.sin(perspectiveZ * Math.PI) * gravitySink;
    ctx.moveTo(centerX - spanWidth, lineY);
    ctx.quadraticCurveTo(centerX, lineY + centerDip, centerX + spanWidth, lineY);
    ctx.stroke();
  }

  // 绘制纵向车道延伸线 (Longitudinal Highway Lanes)
  for (let j = 0; j <= LONGITUDE_LINES; j++) {
    const normX = (j / LONGITUDE_LINES - 0.5) * 2; // -1 to +1
    const isCenterLane = Math.abs(normX) < 0.08;
    const isOuterRail = Math.abs(normX) > 0.88;

    const beamAlpha = isCenterLane
      ? 0.85 + bassEnergy * 0.15
      : isOuterRail
      ? 0.75 + midEnergy * 0.25
      : (0.35 + (1 - Math.abs(normX)) * 0.4) * (0.65 + bassEnergy * 0.35);

    ctx.strokeStyle = isCenterLane
      ? `hsla(${secondaryHue}, 100%, 78%, ${beamAlpha})`
      : isOuterRail
      ? `hsla(${accentHue}, 100%, 70%, ${beamAlpha})`
      : `hsla(${primaryHue}, 85%, 58%, ${beamAlpha})`;
    ctx.lineWidth = isCenterLane ? 3.0 : isOuterRail ? 2.5 : 1.3;

    ctx.beginPath();
    ctx.moveTo(centerX + normX * (eclipseRadius * 0.25), horizonY);

    // 绘制下沉曲率折线
    const endX = centerX + normX * roadHalfWidth;
    const endY = height;
    const controlDip = isCenterLane ? gravitySink * 0.85 : gravitySink * 0.35 * (1 - Math.abs(normX));
    ctx.quadraticCurveTo(
      centerX + normX * (roadHalfWidth * 0.38),
      horizonY + roadHeight * 0.5 + controlDip,
      endX,
      endY
    );
    ctx.stroke();
  }

  // 两侧音频响应等离子方尖光塔与垂直激光 (Flanking Equalizer Pylons & Sky Lasers)
  const pillarCount = 12;
  for (let k = 0; k < pillarCount; k++) {
    const pProgress = ((k / pillarCount + (roadScrollOffset * 0.6 % (1 / pillarCount))) % 1.0);
    const pZ = Math.pow(pProgress, 1.85);
    const pY = horizonY + roadHeight * pZ;
    const pSpan = roadHalfWidth * Math.pow(pProgress, 1.4) * 1.02;
    const sampleIdx = Math.min(data.length - 1, 6 + k * 5);
    const colHeight = (data[sampleIdx] / 255) * 110 * pZ * bassIntensity;

    if (pY <= horizonY || colHeight < 3) continue;

    const colAlpha = pZ * (0.5 + midEnergy * 0.5);
    ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 75%, ${colAlpha})`;
    ctx.lineWidth = Math.max(1.8, pZ * 4.2);

    // 左侧等离子柱与天顶激光
    ctx.beginPath();
    ctx.moveTo(centerX - pSpan, pY);
    ctx.lineTo(centerX - pSpan, pY - colHeight);
    ctx.stroke();

    // 垂直射向天空的细激光束
    if (k % 3 === 0 && pZ > 0.3) {
      ctx.strokeStyle = `hsla(${primaryHue}, 100%, 80%, ${colAlpha * 0.4})`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(centerX - pSpan, pY - colHeight);
      ctx.lineTo(centerX - pSpan, 0);
      ctx.stroke();
    }

    // 右侧等离子柱与天顶激光
    ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 75%, ${colAlpha})`;
    ctx.lineWidth = Math.max(1.8, pZ * 4.2);
    ctx.beginPath();
    ctx.moveTo(centerX + pSpan, pY);
    ctx.lineTo(centerX + pSpan, pY - colHeight);
    ctx.stroke();

    if (k % 3 === 0 && pZ > 0.3) {
      ctx.strokeStyle = `hsla(${primaryHue}, 100%, 80%, ${colAlpha * 0.4})`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(centerX + pSpan, pY - colHeight);
      ctx.lineTo(centerX + pSpan, 0);
      ctx.stroke();
    }
  }

  ctx.restore();

  // ─── 6. 漂移橙金火花粒子与低空电光烟雾 (Drift Sparks & Volumetric Smoke) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // 漂移烟雾
  for (let i = 0; i < driftSmokes.length; i++) {
    const s = driftSmokes[i];
    s.x += s.vx * (1 + bassEnergy * 2.2);
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
    smokeGrd.addColorStop(0, `hsla(${s.hue}, 90%, 65%, ${s.alpha * (1 + bassEnergy * 0.85)})`);
    smokeGrd.addColorStop(0.45, `hsla(${s.hue}, 80%, 45%, ${s.alpha * 0.45})`);
    smokeGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = smokeGrd;
    ctx.beginPath();
    ctx.arc(centerX + s.x, s.y, s.radius * s.scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // 漂移飞溅火花
  for (let i = 0; i < driftSparks.length; i++) {
    const sp = driftSparks[i];
    sp.life++;
    sp.x += sp.vx;
    sp.y += sp.vy;
    sp.vy += 0.18; // 重力

    if (sp.life >= sp.maxLife) {
      sp.life = 0;
      sp.x = (Math.random() > 0.5 ? 1 : -1) * (width * 0.22 + Math.random() * width * 0.28);
      sp.y = height * (HORIZON_RATIO + 0.35 + Math.random() * 0.2);
      sp.vx = (Math.random() - 0.5) * (7 + bassEnergy * 5);
      sp.vy = -Math.random() * 6 - 2.5;
    }

    const sparkProgress = 1 - sp.life / sp.maxLife;
    ctx.fillStyle = sp.color;
    ctx.globalAlpha = sp.alpha * sparkProgress * (0.6 + bassEnergy * 0.4);
    ctx.beginPath();
    ctx.arc(centerX + sp.x, sp.y, sp.size * sparkProgress, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // ─── 7. 光速穿梭星尘粒子与拉丝 (Hyper-Speed Stardust & Speed Streaks) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const speedMult = (1.1 + trebleEnergy * 3.8 + bassEnergy * 2.2) * cruiseSpeed;

  for (let i = 0; i < particlePool.length; i++) {
    const p = particlePool[i];
    p.prevZ = p.z;
    p.z -= p.speed * 9.5 * speedMult;

    if (p.z <= 1) {
      p.z = 1000;
      p.prevZ = 1000;
      p.x = (Math.random() - 0.5) * width * 3.2;
      p.y = (Math.random() - 0.5) * height * 2.2;
    }

    // 3D 透视点转换 (带镜头倾角)
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
    const pAlpha = p.alpha * Math.pow(pScale, 1.2) * (0.65 + trebleEnergy * 0.35);

    if (p.isStreak && speedMult > 1.8) {
      // 极速光流拉丝 (Speed Streaks)
      ctx.strokeStyle = `hsla(${p.hue}, 100%, 80%, ${pAlpha})`;
      ctx.lineWidth = Math.max(1.2, p.size * pScale * 1.8);
      ctx.beginPath();
      ctx.moveTo(prevScreenX, prevScreenY);
      ctx.lineTo(screenX, screenY);
      ctx.stroke();
    } else {
      // 空间星尘微粒
      ctx.fillStyle = `hsla(${p.hue}, 95%, 85%, ${pAlpha})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.size * (0.6 + pScale * 1.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // ─── 8. 电影级色散故障抖动 (Chromatic Aberration & Glitch on Drops) ───
  if (glitchAberration > 0 && (bassEnergy > 0.80 || Math.random() < 0.03 * glitchAberration)) {
    glitchTimer = 3;
    glitchOffset = (Math.random() - 0.5) * 10 * glitchAberration;
  }

  if (glitchTimer > 0) {
    glitchTimer--;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.28 * glitchAberration;

    // 水平 RGB 通道微移色散
    ctx.fillStyle = "#00ffff";
    ctx.fillRect(glitchOffset, 0, width, height);
    ctx.fillStyle = "#ff0055";
    ctx.fillRect(-glitchOffset, 0, width, height);

    ctx.restore();
  }

  // ─── 9. 电影 35mm 胶片颗粒与 2.39:1 变形暗角 (Film Grain & Vignette) ───
  ctx.save();

  // 胶片颗粒
  const grain = getOrCreateFilmGrain(ctx);
  if (grain) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, width, height);
  }

  // 四周电影级变形宽画幅暗角 (Anamorphic Letterbox Vignette)
  ctx.globalCompositeOperation = "source-over";
  const vigGrd = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.42,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.82
  );
  vigGrd.addColorStop(0, "rgba(0,0,0,0)");
  vigGrd.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = vigGrd;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();

  ctx.restore();
}
