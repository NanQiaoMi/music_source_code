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

// 模块级高性能静态对象池与单例缓存（杜绝 GC 内存抖动）
let particlePool: PhonkParticle[] = [];
let activeShockwaves: PhonkShockwave[] = [];
let driftSmokes: PhonkDriftSmoke[] = [];
let lastCanvasWidth = 0;
let lastCanvasHeight = 0;

// 物理阻尼滤波记忆
let prevBassEnergy = 0;
let prevMidEnergy = 0;
let prevTrebleEnergy = 0;
let roadScrollOffset = 0;
let glitchTimer = 0;
let glitchOffset = 0;

const PARTICLE_COUNT = 900;
const SMOKE_COUNT = 36;
const HORIZON_RATIO = 0.46; // 地平线位于画面 46% 黄金分割处

function initParticlePool(width: number, height: number) {
  if (particlePool.length >= PARTICLE_COUNT && Math.abs(lastCanvasWidth - width) < 50) return;
  lastCanvasWidth = width;
  lastCanvasHeight = height;

  particlePool = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particlePool.push({
      x: (Math.random() - 0.5) * width * 2.8,
      y: (Math.random() - 0.5) * height * 2.0,
      z: Math.random() * 1000 + 10,
      prevZ: 0,
      size: Math.random() * 2.2 + 0.8,
      speed: Math.random() * 1.5 + 0.8,
      alpha: Math.random() * 0.7 + 0.3,
      hue: Math.random() > 0.5 ? 285 : 190,
      isStreak: Math.random() > 0.35,
    });
  }

  driftSmokes = [];
  for (let i = 0; i < SMOKE_COUNT; i++) {
    driftSmokes.push({
      x: (Math.random() - 0.5) * width * 1.2,
      y: height * (HORIZON_RATIO + 0.1 + Math.random() * 0.45),
      radius: Math.random() * 90 + 50,
      alpha: Math.random() * 0.18 + 0.05,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 0.3,
      scale: Math.random() * 0.6 + 0.8,
      hue: Math.random() > 0.6 ? 290 : 195,
    });
  }
}

/**
 * 赛博漂移 · 日蚀特异点 (Phonk Drift Eclipse)
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

  const bassIntensity = params?.bassIntensity ?? 1.2;
  const cruiseSpeed = params?.cruiseSpeed ?? 1.3;
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

  // Attack / Decay 双速动态阻尼：上升沿零延迟(0.92)，下降沿柔和呼吸(0.06)
  const bassEnergy =
    subBassRaw > prevBassEnergy
      ? prevBassEnergy * 0.08 + subBassRaw * 0.92
      : prevBassEnergy * 0.94 + subBassRaw * 0.06;
  prevBassEnergy = bassEnergy;

  const midEnergy =
    cowbellMidRaw > prevMidEnergy
      ? prevMidEnergy * 0.15 + cowbellMidRaw * 0.85
      : prevMidEnergy * 0.92 + cowbellMidRaw * 0.08;
  prevMidEnergy = midEnergy;

  const trebleEnergy =
    hihatTrebleRaw > prevTrebleEnergy
      ? prevTrebleEnergy * 0.2 + hihatTrebleRaw * 0.8
      : prevTrebleEnergy * 0.9 + hihatTrebleRaw * 0.1;
  prevTrebleEnergy = trebleEnergy;

  // 综合过载系数（当 808 处于高潮区间时触发全屏白热过载）
  const isOverloaded = bassEnergy > 0.72 && midEnergy > 0.45;
  const overloadIntensity = isOverloaded ? Math.min(1.0, (bassEnergy - 0.72) * 3.5) : 0;

  // 808 重低音瞬态冲击触发同心震波
  if (subBassRaw > 0.78 && Math.random() < 0.35) {
    activeShockwaves.push({
      z: 0.05,
      radius: 20,
      maxRadius: Math.max(width, height) * 0.85,
      alpha: 0.9,
      color: isOverloaded ? "#ffffff" : colorMode === 2 ? "#ef4444" : "#e879f9",
      speed: 0.022 + bassEnergy * 0.015,
      width: Math.random() * 3 + 2,
    });
  }

  // 镜头震颤 (Camera Shake on 808 sub-bass drops)
  let shakeX = 0;
  let shakeY = 0;
  if (bassEnergy > 0.55) {
    const shakeMag = (bassEnergy - 0.55) * 16 * bassIntensity;
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag * 0.7;
  }

  // 色相主题映射
  let primaryHue = theme?.primary ?? 280;
  let secondaryHue = theme?.secondary ?? 190;
  let accentHue = theme?.accent ?? 330;

  if (colorMode === 1) {
    // 极夜霓虹
    primaryHue = 315;
    secondaryHue = 190;
    accentHue = 270;
  } else if (colorMode === 2) {
    // 暗红狂暴
    primaryHue = 355;
    secondaryHue = 15;
    accentHue = 0;
  } else if (colorMode === 3) {
    // 黑金奢华
    primaryHue = 42;
    secondaryHue = 210;
    accentHue = 55;
  }

  // 视口与地平线基准点
  const horizonY = height * HORIZON_RATIO + shakeY;
  const centerX = width * 0.5 + shakeX;

  ctx.save();

  // ─── 0. 底层深曜石黑与星云环境光渲染 ───
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, width, height);

  // 天空深渊渐变 (Top to Horizon)
  const skyGrd = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrd.addColorStop(0, "#030305");
  skyGrd.addColorStop(0.65, `hsla(${primaryHue}, 65%, 6%, 0.95)`);
  skyGrd.addColorStop(1, `hsla(${secondaryHue}, 85%, 12%, 0.8)`);
  ctx.fillStyle = skyGrd;
  ctx.fillRect(0, 0, width, horizonY);

  // ─── 1. 地平线超巨型日蚀特异点 (Solar Eclipse Singularity) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const eclipseRadius = Math.min(width, height) * (0.13 + bassEnergy * 0.05 * bassIntensity);

  // 日蚀背后多层宽银幕光芒（Anamorphic Horizontal Flare）
  const flareWidth = width * (0.8 + bassEnergy * 0.4);
  const flareHeight = (12 + bassEnergy * 16) * (1 + overloadIntensity);
  const flareGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    0,
    centerX,
    horizonY,
    flareWidth * 0.5
  );
  flareGrd.addColorStop(0, `hsla(${secondaryHue}, 100%, 75%, ${0.75 + midEnergy * 0.25})`);
  flareGrd.addColorStop(0.25, `hsla(${primaryHue}, 90%, 60%, 0.4)`);
  flareGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = flareGrd;
  ctx.fillRect(centerX - flareWidth * 0.5, horizonY - flareHeight * 0.5, flareWidth, flareHeight);

  // 日蚀超大发光冕环 (Atmospheric Outer Corona)
  const coronaGrd = ctx.createRadialGradient(
    centerX,
    horizonY,
    eclipseRadius * 0.7,
    centerX,
    horizonY,
    eclipseRadius * 2.8
  );
  coronaGrd.addColorStop(0, `hsla(${primaryHue}, 95%, 65%, ${0.5 + bassEnergy * 0.4})`);
  coronaGrd.addColorStop(0.35, `hsla(${secondaryHue}, 85%, 55%, 0.25)`);
  coronaGrd.addColorStop(0.7, `hsla(${accentHue}, 90%, 45%, 0.1)`);
  coronaGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = coronaGrd;
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius * 2.8, 0, Math.PI * 2);
  ctx.fill();

  // 牛铃/主音色高频射线 (Cowbell Solar Ray Flares)
  const rayCount = 18;
  const rayMaxLen = eclipseRadius * (1.8 + midEnergy * 1.5);
  ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 80%, ${0.2 + midEnergy * 0.5})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2 + Date.now() * 0.0003;
    const len = rayMaxLen * (0.6 + Math.sin(angle * 4 + Date.now() * 0.002) * 0.4);
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * (eclipseRadius * 0.95), horizonY + Math.sin(angle) * (eclipseRadius * 0.95));
    ctx.lineTo(centerX + Math.cos(angle) * (eclipseRadius * 0.95 + len), horizonY + Math.sin(angle) * (eclipseRadius * 0.95 + len));
    ctx.stroke();
  }

  // 日蚀绝对纯黑曜石遮罩内核 (Black Hole Singularity Core)
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#040406";
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius, 0, Math.PI * 2);
  ctx.fill();

  // 日蚀内圈锐利电光边缘 (Sharp Rim Highlight)
  ctx.strokeStyle = isOverloaded
    ? "rgba(255, 255, 255, 0.95)"
    : `hsla(${secondaryHue}, 100%, 75%, ${0.7 + bassEnergy * 0.3})`;
  ctx.lineWidth = 2.5 + bassEnergy * 2.5;
  ctx.beginPath();
  ctx.arc(centerX, horizonY, eclipseRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // ─── 2. 808 低音同心震波扩散系统 (Expanding 808 Shockwaves) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = activeShockwaves.length - 1; i >= 0; i--) {
    const sw = activeShockwaves[i];
    sw.z += sw.speed;
    sw.alpha *= 0.965;

    if (sw.alpha < 0.02 || sw.z > 1.0) {
      activeShockwaves.splice(i, 1);
      continue;
    }

    const currentRadius = sw.radius + (sw.maxRadius - sw.radius) * sw.z;
    ctx.strokeStyle = sw.color;
    ctx.globalAlpha = sw.alpha;
    ctx.lineWidth = sw.width * (1 + sw.z * 2);

    ctx.beginPath();
    ctx.ellipse(centerX, horizonY + sw.z * height * 0.3, currentRadius, currentRadius * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ─── 3. 立体合成波网格公路 (Perspective Synthwave Wireframe Highway) ───
  ctx.save();
  const roadHeight = height - horizonY;
  roadScrollOffset += (0.012 + bassEnergy * 0.018) * cruiseSpeed;

  // 地面反光底层
  const groundGrd = ctx.createLinearGradient(0, horizonY, 0, height);
  groundGrd.addColorStop(0, "#05050a");
  groundGrd.addColorStop(0.3, `hsla(${primaryHue}, 70%, 7%, 0.95)`);
  groundGrd.addColorStop(1, "#020204");
  ctx.fillStyle = groundGrd;
  ctx.fillRect(0, horizonY, width, roadHeight);

  // 3D 透视网格参数
  const LATITUDE_LINES = 26; // 横向透视线数量
  const LONGITUDE_LINES = 22; // 纵向延伸线数量
  const roadHalfWidth = width * 0.95;

  ctx.globalCompositeOperation = "screen";

  // 808 低音重力漏斗下陷量 (Bass Gravity Sink)
  const gravitySink = bassEnergy * 45 * bassIntensity;

  // 绘制横向透视线 (Latitudinal Perspective Rings)
  for (let i = 0; i < LATITUDE_LINES; i++) {
    const rawProgress = ((i / LATITUDE_LINES + (roadScrollOffset % (1 / LATITUDE_LINES))) % 1.0);
    // 指数级透视畸变映射 (0 at horizon -> 1 at screen bottom)
    const perspectiveZ = Math.pow(rawProgress, 2.2);
    const lineY = horizonY + roadHeight * perspectiveZ;
    const spanWidth = roadHalfWidth * Math.pow(rawProgress, 1.4);

    if (lineY <= horizonY || spanWidth < 4) continue;

    // 随深度雾化衰减的透明度
    const lineAlpha = Math.min(1.0, perspectiveZ * 1.3) * (0.35 + bassEnergy * 0.35);
    ctx.strokeStyle = isOverloaded
      ? `rgba(255, 255, 255, ${lineAlpha * 0.85})`
      : `hsla(${primaryHue}, 85%, ${50 + perspectiveZ * 20}%, ${lineAlpha})`;
    ctx.lineWidth = Math.max(1, perspectiveZ * 2.8);

    ctx.beginPath();
    // 带有中央重力下陷的平滑曲线
    const centerDip = Math.sin(perspectiveZ * Math.PI) * gravitySink;
    ctx.moveTo(centerX - spanWidth, lineY);
    ctx.quadraticCurveTo(centerX, lineY + centerDip, centerX + spanWidth, lineY);
    ctx.stroke();
  }

  // 绘制纵向延伸线 (Longitudinal Beams to Horizon)
  for (let j = 0; j <= LONGITUDE_LINES; j++) {
    const normX = (j / LONGITUDE_LINES - 0.5) * 2; // -1 to +1
    const isCenterLane = Math.abs(normX) < 0.12;

    const beamAlpha = isCenterLane
      ? 0.75 + bassEnergy * 0.25
      : (0.3 + (1 - Math.abs(normX)) * 0.35) * (0.6 + bassEnergy * 0.4);

    ctx.strokeStyle = isCenterLane
      ? `hsla(${secondaryHue}, 100%, 75%, ${beamAlpha})`
      : `hsla(${primaryHue}, 80%, 55%, ${beamAlpha})`;
    ctx.lineWidth = isCenterLane ? 2.5 : 1.2;

    ctx.beginPath();
    ctx.moveTo(centerX + normX * (eclipseRadius * 0.2), horizonY);

    // 绘制下沉曲率折线
    const endX = centerX + normX * roadHalfWidth;
    const endY = height;
    const controlDip = isCenterLane ? gravitySink * 0.8 : gravitySink * 0.3 * (1 - Math.abs(normX));
    ctx.quadraticCurveTo(
      centerX + normX * (roadHalfWidth * 0.35),
      horizonY + roadHeight * 0.5 + controlDip,
      endX,
      endY
    );
    ctx.stroke();
  }

  // 道路两侧等离子音频能量柱 (Flanking Equalizer Plasma Columns)
  const pillarCount = 10;
  for (let k = 0; k < pillarCount; k++) {
    const pProgress = ((k / pillarCount + (roadScrollOffset * 0.5 % (1 / pillarCount))) % 1.0);
    const pZ = Math.pow(pProgress, 1.8);
    const pY = horizonY + roadHeight * pZ;
    const pSpan = roadHalfWidth * Math.pow(pProgress, 1.35) * 1.04;
    const sampleIdx = Math.min(data.length - 1, 8 + k * 4);
    const colHeight = (data[sampleIdx] / 255) * 75 * pZ * bassIntensity;

    if (pY <= horizonY || colHeight < 3) continue;

    const colAlpha = pZ * (0.4 + midEnergy * 0.6);
    ctx.strokeStyle = `hsla(${secondaryHue}, 100%, 70%, ${colAlpha})`;
    ctx.lineWidth = Math.max(1.5, pZ * 3.5);

    // 左侧柱
    ctx.beginPath();
    ctx.moveTo(centerX - pSpan, pY);
    ctx.lineTo(centerX - pSpan, pY - colHeight);
    ctx.stroke();

    // 右侧柱
    ctx.beginPath();
    ctx.moveTo(centerX + pSpan, pY);
    ctx.lineTo(centerX + pSpan, pY - colHeight);
    ctx.stroke();
  }

  ctx.restore();

  // ─── 4. 低空漂移电光烟雾层 (Drift Ground Smoke) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < driftSmokes.length; i++) {
    const s = driftSmokes[i];
    s.x += s.vx * (1 + bassEnergy * 2);
    s.y += s.vy;
    if (s.x > width * 0.7) s.x = -width * 0.7;
    if (s.x < -width * 0.7) s.x = width * 0.7;

    const smokeGrd = ctx.createRadialGradient(
      centerX + s.x,
      s.y,
      0,
      centerX + s.x,
      s.y,
      s.radius * s.scale
    );
    smokeGrd.addColorStop(0, `hsla(${s.hue}, 85%, 60%, ${s.alpha * (1 + bassEnergy * 0.8)})`);
    smokeGrd.addColorStop(0.5, `hsla(${s.hue}, 70%, 40%, ${s.alpha * 0.4})`);
    smokeGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = smokeGrd;
    ctx.beginPath();
    ctx.arc(centerX + s.x, s.y, s.radius * s.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ─── 5. 光速穿梭星尘粒子流 (Hyper-Speed Stardust & Streaks) ───
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const speedMult = (1.0 + trebleEnergy * 3.5 + bassEnergy * 2.0) * cruiseSpeed;

  for (let i = 0; i < particlePool.length; i++) {
    const p = particlePool[i];
    p.prevZ = p.z;
    p.z -= p.speed * 8.5 * speedMult;

    if (p.z <= 1) {
      p.z = 1000;
      p.prevZ = 1000;
      p.x = (Math.random() - 0.5) * width * 2.8;
      p.y = (Math.random() - 0.5) * height * 2.0;
    }

    // 3D 透视点转换
    const fov = 350;
    const screenX = centerX + (p.x / p.z) * fov;
    const screenY = horizonY + (p.y / p.z) * fov;
    const prevScreenX = centerX + (p.x / p.prevZ) * fov;
    const prevScreenY = horizonY + (p.y / p.prevZ) * fov;

    if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50) continue;

    const pScale = (1000 - p.z) / 1000;
    const pAlpha = p.alpha * Math.pow(pScale, 1.2) * (0.6 + trebleEnergy * 0.4);

    if (p.isStreak && speedMult > 2.0) {
      // 极速光流拉丝 (Speed Streaks)
      ctx.strokeStyle = `hsla(${p.hue}, 95%, 75%, ${pAlpha})`;
      ctx.lineWidth = Math.max(1, p.size * pScale * 1.5);
      ctx.beginPath();
      ctx.moveTo(prevScreenX, prevScreenY);
      ctx.lineTo(screenX, screenY);
      ctx.stroke();
    } else {
      // 微观星尘与雨丝粒子
      ctx.fillStyle = `hsla(${p.hue}, 90%, 80%, ${pAlpha})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.size * (0.5 + pScale * 1.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // ─── 6. 电影级色散故障抖动 (Chromatic Aberration & Glitch on Drops) ───
  if (glitchAberration > 0 && (bassEnergy > 0.82 || Math.random() < 0.025 * glitchAberration)) {
    glitchTimer = 3; // 持续 3 帧微秒抖动
    glitchOffset = (Math.random() - 0.5) * 8 * glitchAberration;
  }

  if (glitchTimer > 0) {
    glitchTimer--;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.25 * glitchAberration;

    // 水平 RGB 通道微移色散
    ctx.fillStyle = "#00ffff";
    ctx.fillRect(glitchOffset, 0, width, height);
    ctx.fillStyle = "#ff0055";
    ctx.fillRect(-glitchOffset, 0, width, height);

    ctx.restore();
  }

  // ─── 7. 电影 2.39:1 宽画幅柔和暗角遮幅 (Cinematic Letterbox & Vignette) ───
  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  // 四周电影级自然渐变暗角 (Vignette)
  const vigGrd = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.45,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.8
  );
  vigGrd.addColorStop(0, "rgba(0,0,0,0)");
  vigGrd.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = vigGrd;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();

  ctx.restore();
}
