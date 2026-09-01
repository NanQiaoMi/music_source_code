/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface StarParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface AccretionRibbon {
  relRadius: number; // 0 (ISCO) to 1 (outer)
  speed: number;
  phase: number;
  width: number;
  alpha: number;
  turbFreq: number;
  turbAmp: number;
  tier: number; // 0: 纯白/白炽金, 1: 柠檬金, 2: 熔融琥珀, 3: 熔岩铜, 4: 暗赤褐
}

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

let stars: StarParticle[] = [];
let ribbons: AccretionRibbon[] = [];

function initGargantuaData(sw: number, sh: number) {
  if (stars.length > 0) return;

  // 1. 初始化背景引力透镜恒星场 (320 颗微细星点)
  for (let i = 0; i < 320; i++) {
    stars.push({
      x: (Math.random() - 0.5) * sw * 1.6,
      y: (Math.random() - 0.5) * sh * 1.6,
      size: Math.random() < 0.1 ? 1.4 : Math.random() < 0.4 ? 0.8 : 0.45,
      alpha: 0.15 + Math.random() * 0.75,
      twinkleSpeed: 1.0 + Math.random() * 2.5,
      twinklePhase: Math.random() * Math.PI * 2,
    });
  }

  // 2. 初始化吸积盘 48 层极细同心流体微光束 (开普勒自转拉丝纹理)
  ribbons = [];
  const ribbonCount = 48;
  for (let i = 0; i < ribbonCount; i++) {
    const frac = i / (ribbonCount - 1);
    let tier = 2;
    if (frac < 0.12)
      tier = 0; // 白炽核心
    else if (frac < 0.32)
      tier = 1; // 柠檬金
    else if (frac < 0.6)
      tier = 2; // 琥珀橙
    else if (frac < 0.82)
      tier = 3; // 熔岩铜
    else tier = 4; // 暗赤烟霞

    ribbons.push({
      relRadius: frac,
      speed: (0.015 / Math.sqrt(Math.max(0.1, frac + 0.12))) * 0.75,
      phase: Math.random() * Math.PI * 2,
      width: 1.0 + frac * 2.0,
      alpha: 0.18 + Math.sin(frac * Math.PI) * 0.28,
      turbFreq: 3 + (i % 5),
      turbAmp: 1.2 + (i % 3) * 0.8,
      tier,
    });
  }
}

/**
 * 1:1 像素级复刻电影《星际穿越》(Interstellar) 卡冈图雅 (Gargantua) 真实物理引力透镜黑洞
 * 严格按照基普·索恩 (Kip Thorne) 广义相对论光线追踪物理仿真图复刻：
 * 1. 中心高耸完整的纯黑施瓦西事件视界天穹（绝不被前置盘过曝覆盖）
 * 2. 上方高耸的爱因斯坦引力透镜天冠拱门（Top Lensed Crown）与细腻丝滑的开普勒气流光层
 * 3. 下方紧密包覆的引力透镜下腹光弧（Bottom Lensed Underbelly）
 * 4. 倾斜赤道面前置主吸积盘（-32° 倾角，精准横跨视界下半部）
 * 5. 多普勒集束（左翼超强白炽展宽与透亮高光，右翼暗淡红移收细）
 * 6. 极细白炽光子球环（Photon Sphere Ring）
 * 7. 右上方延伸的暗红色引力潮汐吸积彗尾 (Accretion Flare Tail)
 */
export function drawSuperstringSingularity({
  ctx,
  width,
  height,
  data,
  time,
  params = {},
  refs,
}: EffectContext) {
  const sw = width || 1920;
  const sh = height || 1080;

  initGargantuaData(sw, sh);

  const cx = sw * 0.5;
  const cy = sh * 0.52;

  const speed = params.speed || 1.0;
  const singularityMass = params.singularityMass || 1.0;
  const superstringTension = params.superstringTension || 1.2;
  const burstSensitivity = params.burstSensitivity || 1.1;

  // --- 1. 音频特征提取 ---
  const getVal = (idx: number) => (data && data[idx] !== undefined ? data[idx] / 255 : 0);
  const rawBass = (getVal(0) + getVal(1) + getVal(2) + getVal(3) + getVal(4)) / 5;
  const rawMid = (getVal(12) + getVal(24) + getVal(36) + getVal(48)) / 4;
  const rawTreble = (getVal(70) + getVal(90) + getVal(110) + getVal(130)) / 4;

  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.78 + rawBass * 0.22;
  refs.smoothMid.current = (refs.smoothMid.current || 0) * 0.82 + rawMid * 0.18;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.84 + rawTreble * 0.16;

  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;
  const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;

  const t = (time || 0) * 0.0008 * speed;

  // 自转推进
  const rot =
    ((refs.bokeh.current && refs.bokeh.current[0]) || 0) +
    (0.0025 + energy * 0.005) * superstringTension;
  if (!refs.bokeh.current) refs.bokeh.current = [];
  refs.bokeh.current[0] = rot;

  if (!refs.shockwaves.current) {
    refs.shockwaves.current = [];
  }
  const shockwaves = refs.shockwaves.current as GravitationalShockwave[];

  if (rawBass > 0.68 && rawBass - bass > 0.24 * burstSensitivity && shockwaves.length < 2) {
    shockwaves.push({
      radius: 95 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.85,
      alpha: 0.6,
      speed: 18 + bass * 18,
    });
  }

  // --- 2. 几何与空间参数 ---
  const horizonR = (94 + bass * 15) * singularityMass; // 施瓦西黑洞视界半径
  const diskTilt = -0.56; // -32° 倾角
  const cosD = Math.cos(diskTilt);
  const sinD = Math.sin(diskTilt);

  // --- 3. 深空背景与引力透镜弯折星场 ---
  ctx.save();
  ctx.fillStyle = "#010003";
  ctx.fillRect(0, 0, sw, sh);

  // 广域深空暗赤色星云微晕
  const spaceGrd = ctx.createRadialGradient(
    cx,
    cy,
    horizonR * 1.1,
    cx,
    cy,
    Math.max(sw, sh) * 0.85
  );
  spaceGrd.addColorStop(0, "rgba(35, 8, 6, 0.38)");
  spaceGrd.addColorStop(0.45, "rgba(16, 3, 5, 0.22)");
  spaceGrd.addColorStop(1, "rgba(1, 0, 3, 0.98)");
  ctx.fillStyle = spaceGrd;
  ctx.fillRect(0, 0, sw, sh);

  // 绘制受强引力场切向偏折的恒星点
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const sx = cx + s.x;
    const sy = cy + s.y;
    const dx = sx - cx;
    const dy = sy - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < horizonR * 0.98) continue; // 视界遮挡

    const deflection = (horizonR * horizonR * 1.35) / (dist + 0.1);
    const rx = sx + (dx / dist) * deflection;
    const ry = sy + (dy / dist) * deflection;

    if (rx < -10 || rx > sw + 10 || ry < -10 || ry > sh + 10) continue;

    const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
    ctx.fillStyle = `rgba(240, 245, 255, ${s.alpha * twinkle})`;
    ctx.beginPath();
    ctx.arc(rx, ry, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- 4. 【上方引力透镜天冠拱门】(Top Gravitational Lensing Crown) ---
  ctx.save();
  renderTopCrownPhotoreal(ctx, cx, cy, horizonR, diskTilt, cosD, sinD, rot, t, bass, mid, treble);
  ctx.restore();

  // --- 5. 【下方引力透镜下腹光弧】(Bottom Gravitational Lensing Underbelly) ---
  ctx.save();
  renderBottomUnderbellyPhotoreal(
    ctx,
    cx,
    cy,
    horizonR,
    diskTilt,
    cosD,
    sinD,
    rot,
    t,
    bass,
    mid,
    treble
  );
  ctx.restore();

  // --- 6. 【中心 3D 纯黑施瓦西事件视界球体与极细光子球环】---
  ctx.save();
  // 纯黑视界球体
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR, 0, Math.PI * 2);
  ctx.fill();

  // 极细 1.2px 光子球环（Photon Sphere Ring）
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 1.2 + bass * 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 7. 【赤道面前置主吸积盘】(Front Equatorial Accretion Disk) ---
  // 横跨在黑洞下半部前方，优美流线型，左侧多普勒强白炽，右侧渐隐收细，绝不遮挡上半球黑洞
  ctx.save();
  renderFrontEquatorialDiskPhotoreal(
    ctx,
    cx,
    cy,
    horizonR,
    diskTilt,
    cosD,
    sinD,
    rot,
    t,
    bass,
    mid,
    treble
  );
  ctx.restore();

  // --- 8. 引力波时空曲率冲击涟漪 ---
  if (shockwaves.length > 0) {
    ctx.save();
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const swItem = shockwaves[i];
      swItem.radius += swItem.speed;
      swItem.alpha *= 0.94;

      if (swItem.alpha < 0.01 || swItem.radius > swItem.maxRadius) {
        shockwaves.splice(i, 1);
        continue;
      }

      ctx.strokeStyle = `rgba(255, 175, 75, ${swItem.alpha * 0.35})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, swItem.radius, swItem.radius * 0.42, diskTilt, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * 绘制卡冈图雅上方引力透镜天冠 (Top Lensed Crown)
 */
function renderTopCrownPhotoreal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  diskAngle: number,
  cosD: number,
  sinD: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number
) {
  const crownInnerR = horizonR * 1.02;
  const crownOuterR = horizonR * 2.38;

  // 1. 底层大面积渐变流质天冠（白炽核心 -> 柠檬金 -> 琥珀金 -> 熔岩赤红 -> 暗赤烟霞）
  const crownGrd = ctx.createRadialGradient(
    cx - horizonR * 0.25,
    cy - horizonR * 0.18,
    crownInnerR * 0.98,
    cx,
    cy - horizonR * 0.35,
    crownOuterR * 1.05
  );
  crownGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  crownGrd.addColorStop(0.12, "rgba(255, 235, 110, 0.95)");
  crownGrd.addColorStop(0.35, "rgba(255, 135, 25, 0.8)");
  crownGrd.addColorStop(0.68, "rgba(185, 38, 10, 0.5)");
  crownGrd.addColorStop(0.92, "rgba(90, 10, 4, 0.18)");
  crownGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = crownGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, crownOuterR, crownOuterR * 0.84, diskAngle, Math.PI * 0.96, Math.PI * 2.04);
  ctx.ellipse(
    cx,
    cy,
    crownInnerR,
    crownInnerR * 0.78,
    diskAngle,
    Math.PI * 2.04,
    Math.PI * 0.96,
    true
  );
  ctx.closePath();
  ctx.fill();

  // 2. 天冠 36 层微细开普勒自转拉丝纹理 (Fibrous Stream Filaments)
  ctx.lineCap = "round";
  for (let i = 0; i < 36; i++) {
    const frac = i / 35;
    const rx = crownInnerR + frac * (crownOuterR - crownInnerR) * 0.88;
    const ry = crownInnerR * 0.78 + frac * (crownOuterR * 0.84 - crownInnerR * 0.78) * 0.88;

    const wave = Math.sin(frac * 24.0 + rot * 5.0) * 0.06;
    const alpha = (0.28 - frac * 0.18 + wave) * (1 + mid * 0.3);
    if (alpha <= 0.01) continue;

    if (frac < 0.15) {
      ctx.strokeStyle = `rgba(255, 255, 240, ${alpha * 1.5})`;
      ctx.lineWidth = 1.2;
    } else if (frac < 0.45) {
      ctx.strokeStyle = `rgba(255, 205, 75, ${alpha * 1.2})`;
      ctx.lineWidth = 1.4;
    } else if (frac < 0.75) {
      ctx.strokeStyle = `rgba(235, 95, 20, ${alpha * 0.9})`;
      ctx.lineWidth = 1.8;
    } else {
      ctx.strokeStyle = `rgba(160, 25, 8, ${alpha * 0.6})`;
      ctx.lineWidth = 2.4;
    }

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, diskAngle, Math.PI * 0.97, Math.PI * 2.03);
    ctx.stroke();
  }

  // 3. 右上方延伸的暗红色引力潮汐彗尾 (Top-Right Accretion Ejection Tail)
  const tailGrd = ctx.createRadialGradient(
    cx + horizonR * 2.0 * cosD,
    cy + horizonR * 2.0 * sinD - horizonR * 0.6,
    10,
    cx + horizonR * 2.0 * cosD,
    cy + horizonR * 2.0 * sinD - horizonR * 0.6,
    horizonR * 2.2
  );
  tailGrd.addColorStop(0, "rgba(225, 75, 18, 0.4)");
  tailGrd.addColorStop(0.45, "rgba(145, 25, 8, 0.22)");
  tailGrd.addColorStop(0.85, "rgba(65, 8, 2, 0.08)");
  tailGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = tailGrd;
  ctx.beginPath();
  ctx.arc(
    cx + horizonR * 2.0 * cosD,
    cy + horizonR * 2.0 * sinD - horizonR * 0.6,
    horizonR * 2.2,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

/**
 * 绘制卡冈图雅下方引力透镜下腹 (Bottom Lensed Underbelly)
 */
function renderBottomUnderbellyPhotoreal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  diskAngle: number,
  cosD: number,
  sinD: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number
) {
  const underInnerR = horizonR * 1.02;
  const underOuterR = horizonR * 1.68;

  const underGrd = ctx.createRadialGradient(
    cx,
    cy + horizonR * 0.1,
    underInnerR * 0.96,
    cx,
    cy + horizonR * 0.25,
    underOuterR * 1.05
  );
  underGrd.addColorStop(0, "rgba(255, 245, 175, 0.9)");
  underGrd.addColorStop(0.22, "rgba(250, 135, 30, 0.7)");
  underGrd.addColorStop(0.65, "rgba(175, 45, 10, 0.35)");
  underGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = underGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, underOuterR, underOuterR * 0.66, diskAngle, 0.02, Math.PI * 0.98);
  ctx.ellipse(cx, cy, underInnerR, underInnerR * 0.6, diskAngle, Math.PI * 0.98, 0.02, true);
  ctx.closePath();
  ctx.fill();

  // 下腹 16 层微细开普勒气流层
  for (let i = 0; i < 16; i++) {
    const frac = i / 15;
    const rx = underInnerR + frac * (underOuterR - underInnerR) * 0.82;
    const ry = underInnerR * 0.6 + frac * (underOuterR * 0.66 - underInnerR * 0.6) * 0.82;

    ctx.strokeStyle = `rgba(245, 120, 28, ${(0.22 - frac * 0.14) * (1 + mid * 0.25)})`;
    ctx.lineWidth = 1.2 + (1 - frac) * 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, diskAngle, 0.06, Math.PI * 0.94);
    ctx.stroke();
  }
}

/**
 * 绘制赤道面前置主吸积盘 (Front Equatorial Accretion Disk)
 * 严格按照物理光学：优美流线型双弧切片，左翼超强白炽多普勒集束，右翼红移渐细，绝不遮蔽上半球黑洞
 */
function renderFrontEquatorialDiskPhotoreal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  diskAngle: number,
  cosD: number,
  sinD: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number
) {
  const diskLenLeft = horizonR * 5.4; // 左翼展长
  const diskLenRight = horizonR * 4.8; // 右翼展长

  // 1. 赤道盘流体双弧流线轮廓（平滑流线型，中心微下移，完全露出黑洞圆顶）
  const topPts: { x: number; y: number }[] = [];
  const botPts: { x: number; y: number }[] = [];
  const steps = 48;

  // 赤道主盘在世界坐标中相对于黑洞中心的垂直偏移 (确保切过黑洞下半部)
  const vOffset = horizonR * 0.22;
  const baseThickness = horizonR * 0.18 * (1 + bass * 0.12);

  for (let i = 0; i <= steps; i++) {
    const prog = i / steps; // 0 (左端) 到 1 (右端)
    const u = -diskLenLeft + prog * (diskLenLeft + diskLenRight);

    // 沿轴向的厚度包络（左侧多普勒集束更宽更厚，两端流线型收尖）
    const normDist = u < 0 ? -u / diskLenLeft : u / diskLenRight;
    const envelope = Math.pow(1 - Math.min(1, normDist), 0.72);
    const thick = baseThickness * envelope * (u < 0 ? 1.4 : 0.85);

    // 计算世界坐标点
    const topX = cx + u * cosD - (-thick * 0.5 + vOffset) * sinD;
    const topY = cy + u * sinD + (-thick * 0.5 + vOffset) * cosD;

    const botX = cx + u * cosD - (thick * 0.5 + vOffset) * sinD;
    const botY = cy + u * sinD + (thick * 0.5 + vOffset) * cosD;

    topPts.push({ x: topX, y: topY });
    botPts.unshift({ x: botX, y: botY });
  }

  // 1.1 主盘大面积渐变流质体 (多普勒效应：左端极亮白炽，右端暗赤收尖)
  const diskGrd = ctx.createLinearGradient(
    cx - diskLenLeft * cosD,
    cy - diskLenLeft * sinD,
    cx + diskLenRight * cosD,
    cy + diskLenRight * sinD
  );
  diskGrd.addColorStop(0, "rgba(90, 12, 4, 0)");
  diskGrd.addColorStop(0.1, "rgba(215, 65, 15, 0.55)");
  diskGrd.addColorStop(0.3, "rgba(255, 160, 32, 0.92)");
  diskGrd.addColorStop(0.46, "rgba(255, 255, 240, 1.0)"); // 核心白炽区
  diskGrd.addColorStop(0.68, "rgba(240, 110, 22, 0.75)");
  diskGrd.addColorStop(0.88, "rgba(150, 32, 8, 0.38)");
  diskGrd.addColorStop(1, "rgba(50, 6, 2, 0)");

  ctx.fillStyle = diskGrd;
  ctx.beginPath();
  ctx.moveTo(topPts[0].x, topPts[0].y);
  for (let p = 1; p < topPts.length; p++) ctx.lineTo(topPts[p].x, topPts[p].y);
  for (let p = 0; p < botPts.length; p++) ctx.lineTo(botPts[p].x, botPts[p].y);
  ctx.closePath();
  ctx.fill();

  // 1.2 核心白炽强光束 (Core Incandescent Beam)
  const beamGrd = ctx.createLinearGradient(
    cx - diskLenLeft * 0.8 * cosD,
    cy - diskLenLeft * 0.8 * sinD,
    cx + diskLenRight * 0.7 * cosD,
    cy + diskLenRight * 0.7 * sinD
  );
  beamGrd.addColorStop(0, "rgba(255, 175, 45, 0)");
  beamGrd.addColorStop(0.18, "rgba(255, 235, 120, 0.9)");
  beamGrd.addColorStop(0.44, "rgba(255, 255, 255, 1.0)");
  beamGrd.addColorStop(0.65, "rgba(255, 215, 85, 0.82)");
  beamGrd.addColorStop(1, "rgba(245, 105, 20, 0)");

  ctx.strokeStyle = beamGrd;
  ctx.lineWidth = 3.2 + bass * 2.0;
  ctx.beginPath();
  ctx.moveTo(
    cx - diskLenLeft * 0.85 * cosD - vOffset * -sinD,
    cy - diskLenLeft * 0.85 * sinD + vOffset * cosD
  );
  ctx.lineTo(
    cx + diskLenRight * 0.75 * cosD - vOffset * -sinD,
    cy + diskLenRight * 0.75 * sinD + vOffset * cosD
  );
  ctx.stroke();

  // 1.3 极细白炽高光中线
  ctx.strokeStyle = "rgba(255, 255, 255, 0.98)";
  ctx.lineWidth = 1.2 + bass * 0.5;
  ctx.beginPath();
  ctx.moveTo(
    cx - diskLenLeft * 0.65 * cosD - vOffset * -sinD,
    cy - diskLenLeft * 0.65 * sinD + vOffset * cosD
  );
  ctx.lineTo(
    cx + diskLenRight * 0.45 * cosD - vOffset * -sinD,
    cy + diskLenRight * 0.45 * sinD + vOffset * cosD
  );
  ctx.stroke();

  // 2. 左翼多普勒集束透亮耀斑 (Doppler Beaming Left Wing Flare)
  // 采用狭长椭圆高光束，完美契合主盘流线，杜绝生硬大圆球
  const flareX = cx - horizonR * 1.7 * cosD - vOffset * -sinD;
  const flareY = cy - horizonR * 1.7 * sinD + vOffset * cosD;

  const flareGrd = ctx.createRadialGradient(flareX, flareY, 5, flareX, flareY, horizonR * 1.8);
  flareGrd.addColorStop(0, "rgba(255, 255, 255, 0.92)");
  flareGrd.addColorStop(0.18, "rgba(255, 230, 110, 0.72)");
  flareGrd.addColorStop(0.55, "rgba(250, 120, 25, 0.28)");
  ctx.fillStyle = flareGrd;
  ctx.beginPath();
  ctx.ellipse(flareX, flareY, horizonR * 1.8, horizonR * 0.55, diskAngle, 0, Math.PI * 2);
  ctx.fill();
}
