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

interface GasFlowStratum {
  relativeRadius: number; // 0 (ISCO) to 1 (outer)
  speed: number;
  phase: number;
  width: number;
  alpha: number;
  turbFreq: number;
  turbAmp: number;
  colorType: number; // 0: 白炽, 1: 琥珀金, 2: 熔岩铜, 3: 赭红
}

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

let stars: StarParticle[] = [];
let strata: GasFlowStratum[] = [];

function initGargantuaData(sw: number, sh: number) {
  if (stars.length > 0) return;

  // 1. 初始化背景引力透镜恒星场 (160 颗星点)
  for (let i = 0; i < 160; i++) {
    stars.push({
      x: (Math.random() - 0.5) * sw * 1.4,
      y: (Math.random() - 0.5) * sh * 1.4,
      size: Math.random() < 0.15 ? 1.6 : Math.random() < 0.5 ? 1.0 : 0.6,
      alpha: 0.25 + Math.random() * 0.65,
      twinkleSpeed: 1.5 + Math.random() * 3.0,
      twinklePhase: Math.random() * Math.PI * 2,
    });
  }

  // 2. 初始化吸积盘流体气流层 (18 层致密平滑无缝流质体，完全杜绝细线条)
  strata = [];
  const strataCount = 20;
  for (let i = 0; i < strataCount; i++) {
    const frac = i / (strataCount - 1);
    let colorType = 1;
    if (frac < 0.18)
      colorType = 0; // 白炽金核心
    else if (frac < 0.5)
      colorType = 1; // 琥珀金
    else if (frac < 0.8)
      colorType = 2; // 熔岩铜
    else colorType = 3; // 赭石赤红

    strata.push({
      relativeRadius: frac,
      speed: (0.012 / Math.sqrt(Math.max(0.1, frac + 0.15))) * 0.8,
      phase: Math.random() * Math.PI * 2,
      width: 4.0 + frac * 18.0,
      alpha: 0.25 + Math.sin(frac * Math.PI) * 0.35,
      turbFreq: 3 + (i % 4),
      turbAmp: 2.0 + (i % 3) * 1.5,
      colorType,
    });
  }
}

/**
 * 1:1 像素级复刻电影《星际穿越》(Interstellar) 卡冈图雅 (Gargantua) 真实引力透镜黑洞
 * - 纯黑施瓦西事件视界与极细光子球环
 * - 上方引力透镜天冠光拱 (Top Lensed Accretion Crown)
 * - 下方引力透镜下腹光弧 (Bottom Lensed Accretion Underbelly)
 * - 倾斜赤道面前置主吸积盘 (Tilted Equatorial Accretion Disk with Doppler Beaming)
 * - 多普勒集束效应 (左侧朝向观察者：更亮更白炽；右侧远离：更暗红移)
 * - 实体连续流质感（完全摒弃线框，采用连续多重体绘制与流体光幕）
 * - 极速 60FPS 满帧运行
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
  const coreGlow = params.coreGlow || 1.2;
  const burstSensitivity = params.burstSensitivity || 1.1;

  // --- 1. 音频特征平滑提取 ---
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
    (0.003 + energy * 0.006) * superstringTension;
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
      alpha: 0.65,
      speed: 18 + bass * 20,
    });
  }

  // --- 2. 几何与物理常数 (Kip Thorne Gargantua Geometry) ---
  const horizonR = (98 + bass * 18) * singularityMass; // 施瓦西视界半径
  const diskTiltAngle = -0.58; // 倾角约 -33.2° (左下至右上)
  const cosD = Math.cos(diskTiltAngle);
  const sinD = Math.sin(diskTiltAngle);

  // --- 3. 深空背景与引力透镜扭曲星场 (Einstein Lensed Starfield) ---
  ctx.save();
  ctx.fillStyle = "#010003";
  ctx.fillRect(0, 0, sw, sh);

  // 广域深空暗赤色星云微晕
  const spaceGrd = ctx.createRadialGradient(cx, cy, horizonR * 1.2, cx, cy, Math.max(sw, sh) * 0.8);
  spaceGrd.addColorStop(0, "rgba(45, 12, 10, 0.4)");
  spaceGrd.addColorStop(0.4, "rgba(22, 6, 8, 0.25)");
  spaceGrd.addColorStop(1, "rgba(1, 0, 3, 0.95)");
  ctx.fillStyle = spaceGrd;
  ctx.fillRect(0, 0, sw, sh);

  // 绘制受引力透镜弯折拉伸的恒星点
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const sx = cx + s.x;
    const sy = cy + s.y;
    const dx = sx - cx;
    const dy = sy - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < horizonR * 0.95) continue; // 视界内部黑洞遮挡

    // 爱因斯坦环引力偏折与切向微拉伸
    const deflection = (horizonR * horizonR * 1.4) / (dist + 0.1);
    const renderX = sx + (dx / dist) * deflection;
    const renderY = sy + (dy / dist) * deflection;

    if (renderX < -20 || renderX > sw + 20 || renderY < -20 || renderY > sh + 20) continue;

    const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
    const starAlpha = s.alpha * twinkle;

    ctx.fillStyle = `rgba(240, 245, 255, ${starAlpha})`;
    ctx.beginPath();
    ctx.arc(renderX, renderY, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- 4. 【上方引力透镜天冠光拱】(Top Gravitational Lensing Crown) ---
  // 吸积盘背侧光线被黑洞引力场弯折至视界上方，形成拱门状皇冠
  ctx.save();
  renderLensedCrown(
    ctx,
    cx,
    cy,
    horizonR,
    diskTiltAngle,
    cosD,
    sinD,
    rot,
    t,
    bass,
    mid,
    treble,
    coreGlow
  );
  ctx.restore();

  // --- 5. 【下方引力透镜下腹光弧】(Bottom Gravitational Lensing Underbelly) ---
  // 吸积盘底部光线被弯折至视界下方，形成较细的弧形底晕
  ctx.save();
  renderLensedUnderbelly(
    ctx,
    cx,
    cy,
    horizonR,
    diskTiltAngle,
    cosD,
    sinD,
    rot,
    t,
    bass,
    mid,
    treble
  );
  ctx.restore();

  // --- 6. 【3D 纯黑施瓦西事件视界球体与光子球环】---
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR, 0, Math.PI * 2);
  ctx.fill();

  // 极细 1.2px 光子球环（Photon Sphere Ring）
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 1.2 + bass * 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
  ctx.stroke();

  // 光子球内圈白炽微边
  ctx.strokeStyle = "rgba(255, 240, 180, 0.4)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 7. 【赤道面前置主吸积盘】(Equatorial Accretion Disk - Front Crossing) ---
  // 横跨黑洞前方的倾斜实体主吸积盘，左侧更亮更白炽（多普勒集束），右侧更暗红移
  ctx.save();
  renderEquatorialDisk(
    ctx,
    cx,
    cy,
    horizonR,
    diskTiltAngle,
    cosD,
    sinD,
    rot,
    t,
    bass,
    mid,
    treble,
    coreGlow
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

      ctx.strokeStyle = `rgba(255, 180, 80, ${swItem.alpha * 0.4})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, swItem.radius, swItem.radius * 0.38, diskTiltAngle, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * 绘制卡冈图雅上方引力透镜天冠 (Top Lensed Crown)
 */
function renderLensedCrown(
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
  treble: number,
  coreGlow: number
) {
  const crownOuterR = horizonR * 2.25;
  const crownInnerR = horizonR * 1.03;

  // 1. 底层大面积外扩散赤红/赭石晕轮 (Outer Crimson/Copper Smear)
  const outerSmearGrd = ctx.createRadialGradient(
    cx,
    cy,
    crownInnerR * 1.05,
    cx,
    cy - horizonR * 0.15,
    crownOuterR * 1.15
  );
  outerSmearGrd.addColorStop(0, "rgba(255, 180, 40, 0.85)");
  outerSmearGrd.addColorStop(0.28, "rgba(235, 95, 20, 0.65)");
  outerSmearGrd.addColorStop(0.65, "rgba(160, 30, 8, 0.35)");
  outerSmearGrd.addColorStop(0.9, "rgba(80, 10, 4, 0.15)");
  outerSmearGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = outerSmearGrd;
  ctx.beginPath();
  // 绘制上拱形区域
  ctx.ellipse(cx, cy, crownOuterR, crownOuterR * 0.82, diskAngle, Math.PI * 0.96, Math.PI * 2.04);
  ctx.ellipse(
    cx,
    cy,
    crownInnerR,
    crownInnerR * 0.76,
    diskAngle,
    Math.PI * 2.04,
    Math.PI * 0.96,
    true
  );
  ctx.closePath();
  ctx.fill();

  // 2. 内部白炽超高温透镜光拱 (Inner Incandescent Lensing Arch)
  const innerArchGrd = ctx.createRadialGradient(
    cx - horizonR * 0.15,
    cy - horizonR * 0.1,
    crownInnerR * 0.98,
    cx,
    cy,
    crownInnerR * 1.55
  );
  innerArchGrd.addColorStop(0, "rgba(255, 255, 250, 0.98)");
  innerArchGrd.addColorStop(0.22, "rgba(255, 235, 130, 0.92)");
  innerArchGrd.addColorStop(0.6, "rgba(255, 145, 30, 0.6)");
  innerArchGrd.addColorStop(1, "rgba(200, 50, 10, 0)");

  ctx.fillStyle = innerArchGrd;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy,
    crownInnerR * 1.5,
    crownInnerR * 1.18,
    diskAngle,
    Math.PI * 0.96,
    Math.PI * 2.04
  );
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

  // 3. 极速平滑流体微纹理 (12 层同心平滑流体微弧，赋予真实开普勒旋涡细节)
  for (let i = 0; i < 12; i++) {
    const frac = i / 11;
    const r = crownInnerR + frac * (crownOuterR - crownInnerR) * 0.85;
    const ry = crownInnerR * 0.78 + frac * (crownOuterR * 0.82 - crownInnerR * 0.78) * 0.85;

    // 多普勒不对称度：左侧增强
    const alpha = (0.28 - frac * 0.18) * (1 + mid * 0.35);

    if (frac < 0.25) {
      ctx.strokeStyle = `rgba(255, 250, 220, ${alpha * 1.2})`;
    } else if (frac < 0.6) {
      ctx.strokeStyle = `rgba(255, 175, 45, ${alpha})`;
    } else {
      ctx.strokeStyle = `rgba(210, 65, 15, ${alpha * 0.8})`;
    }

    ctx.lineWidth = 2.0 + (1 - frac) * 3.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, ry, diskAngle, Math.PI * 0.98, Math.PI * 2.02);
    ctx.stroke();
  }

  // 4. 天冠左侧多普勒强光束 (Doppler Beaming Boost on Left Flank)
  const leftBoostGrd = ctx.createRadialGradient(
    cx - horizonR * 0.9,
    cy - horizonR * 0.4,
    10,
    cx - horizonR * 0.9,
    cy - horizonR * 0.4,
    horizonR * 1.2
  );
  leftBoostGrd.addColorStop(0, "rgba(255, 255, 255, 0.85)");
  leftBoostGrd.addColorStop(0.35, "rgba(255, 220, 100, 0.55)");
  leftBoostGrd.addColorStop(0.75, "rgba(255, 130, 25, 0.2)");
  leftBoostGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = leftBoostGrd;
  ctx.beginPath();
  ctx.arc(cx - horizonR * 0.9, cy - horizonR * 0.4, horizonR * 1.1, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 绘制卡冈图雅下方引力透镜光弧 (Bottom Lensed Underbelly)
 */
function renderLensedUnderbelly(
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
  const underInnerR = horizonR * 1.03;
  const underOuterR = horizonR * 1.62;

  const underGrd = ctx.createRadialGradient(
    cx,
    cy + horizonR * 0.1,
    underInnerR * 0.98,
    cx,
    cy + horizonR * 0.2,
    underOuterR * 1.1
  );
  underGrd.addColorStop(0, "rgba(255, 240, 160, 0.75)");
  underGrd.addColorStop(0.3, "rgba(240, 115, 25, 0.55)");
  underGrd.addColorStop(0.7, "rgba(160, 40, 10, 0.28)");
  underGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = underGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, underOuterR, underOuterR * 0.65, diskAngle, 0, Math.PI);
  ctx.ellipse(cx, cy, underInnerR, underInnerR * 0.6, diskAngle, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();

  // 下腹 6 层细微流光层
  for (let i = 0; i < 6; i++) {
    const frac = i / 5;
    const r = underInnerR + frac * (underOuterR - underInnerR) * 0.8;
    const ry = underInnerR * 0.6 + frac * (underOuterR * 0.65 - underInnerR * 0.6) * 0.8;

    ctx.strokeStyle = `rgba(235, 110, 25, ${(0.22 - frac * 0.15) * (1 + mid * 0.3)})`;
    ctx.lineWidth = 1.8 + (1 - frac) * 2.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, ry, diskAngle, 0.05, Math.PI - 0.05);
    ctx.stroke();
  }
}

/**
 * 绘制赤道面主吸积盘 (Equatorial Accretion Disk - Front Crossing with Doppler Asymmetry)
 */
function renderEquatorialDisk(
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
  treble: number,
  coreGlow: number
) {
  const diskLenL = horizonR * 5.4; // 左翼长度（多普勒朝向观察者，更长更宽）
  const diskLenR = horizonR * 4.6; // 右翼长度（红移远离观察者）
  const diskThickness = horizonR * 0.52 * (1 + bass * 0.15);

  // 1. 赤道盘大面积实体流体填充（无任何细线，纯净平滑）
  // 构造沿主轴的多边形流体区域
  const ptsLeft: { x: number; y: number }[] = [];
  const ptsRight: { x: number; y: number }[] = [];
  const steps = 40;

  for (let i = 0; i <= steps; i++) {
    const prog = i / steps; // 0 (左端) 到 1 (右端)
    const u = -diskLenL + prog * (diskLenL + diskLenR);

    // 盘面厚度沿轴向分布：中间靠近黑洞较厚，两端平滑收尖
    const uDistNorm = u < 0 ? -u / diskLenL : u / diskLenR;
    const profile = Math.pow(1 - Math.min(1, uDistNorm), 0.65);
    const halfThick = diskThickness * profile * (u < 0 ? 1.25 : 0.85);

    // 旋转变换至世界坐标
    const topX = cx + u * cosD - -halfThick * sinD;
    const topY = cy + u * sinD + -halfThick * cosD;
    const botX = cx + u * cosD - halfThick * sinD;
    const botY = cy + u * sinD + halfThick * cosD;

    ptsLeft.push({ x: topX, y: topY });
    ptsRight.unshift({ x: botX, y: botY });
  }

  // 1.1 主盘底层红铜/深赤渐变流体
  const mainDiskGrd = ctx.createLinearGradient(
    cx - diskLenL * cosD,
    cy - diskLenL * sinD,
    cx + diskLenR * cosD,
    cy + diskLenR * sinD
  );
  mainDiskGrd.addColorStop(0, "rgba(80, 10, 4, 0)");
  mainDiskGrd.addColorStop(0.12, "rgba(180, 45, 12, 0.45)");
  mainDiskGrd.addColorStop(0.35, "rgba(255, 140, 30, 0.88)");
  mainDiskGrd.addColorStop(0.5, "rgba(255, 245, 180, 0.98)"); // 核心超高温
  mainDiskGrd.addColorStop(0.72, "rgba(230, 95, 20, 0.68)");
  mainDiskGrd.addColorStop(0.9, "rgba(140, 30, 8, 0.35)");
  mainDiskGrd.addColorStop(1, "rgba(50, 8, 3, 0)");

  ctx.fillStyle = mainDiskGrd;
  ctx.beginPath();
  ctx.moveTo(ptsLeft[0].x, ptsLeft[0].y);
  for (let p = 1; p < ptsLeft.length; p++) ctx.lineTo(ptsLeft[p].x, ptsLeft[p].y);
  for (let p = 0; p < ptsRight.length; p++) ctx.lineTo(ptsRight[p].x, ptsRight[p].y);
  ctx.closePath();
  ctx.fill();

  // 1.2 赤道盘核心白炽高能强光束 (Center Blazing White-Hot Beam)
  const coreBeamGrd = ctx.createLinearGradient(
    cx - diskLenL * 0.75 * cosD,
    cy - diskLenL * 0.75 * sinD,
    cx + diskLenR * 0.65 * cosD,
    cy + diskLenR * 0.65 * sinD
  );
  coreBeamGrd.addColorStop(0, "rgba(255, 160, 40, 0)");
  coreBeamGrd.addColorStop(0.2, "rgba(255, 225, 110, 0.85)");
  coreBeamGrd.addColorStop(0.45, "rgba(255, 255, 255, 1.0)");
  coreBeamGrd.addColorStop(0.65, "rgba(255, 215, 80, 0.8)");
  coreBeamGrd.addColorStop(1, "rgba(240, 110, 20, 0)");

  ctx.strokeStyle = coreBeamGrd;
  ctx.lineWidth = 5.5 + bass * 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - diskLenL * 0.85 * cosD, cy - diskLenL * 0.85 * sinD);
  ctx.lineTo(cx + diskLenR * 0.75 * cosD, cy + diskLenR * 0.75 * sinD);
  ctx.stroke();

  // 1.3 核心白炽微线
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 1.8 + bass * 1.0;
  ctx.beginPath();
  ctx.moveTo(cx - diskLenL * 0.65 * cosD, cy - diskLenL * 0.65 * sinD);
  ctx.lineTo(cx + diskLenR * 0.45 * cosD, cy + diskLenR * 0.45 * sinD);
  ctx.stroke();

  // 2. 左翼多普勒集束巨型光团 (Doppler Beaming Left Wing Flare)
  const dopplerFlareGrd = ctx.createRadialGradient(
    cx - horizonR * 1.8 * cosD,
    cy - horizonR * 1.8 * sinD,
    5,
    cx - horizonR * 1.8 * cosD,
    cy - horizonR * 1.8 * sinD,
    horizonR * 2.2
  );
  dopplerFlareGrd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  dopplerFlareGrd.addColorStop(0.25, "rgba(255, 230, 120, 0.7)");
  dopplerFlareGrd.addColorStop(0.65, "rgba(245, 115, 25, 0.3)");
  dopplerFlareGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = dopplerFlareGrd;
  ctx.beginPath();
  ctx.arc(cx - horizonR * 1.8 * cosD, cy - horizonR * 1.8 * sinD, horizonR * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // 3. 内部 ISCO 耀斑光晕
  const iscoFlareGrd = ctx.createRadialGradient(cx, cy, horizonR * 0.95, cx, cy, horizonR * 1.6);
  iscoFlareGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  iscoFlareGrd.addColorStop(0.35, "rgba(255, 215, 90, 0.65)");
  iscoFlareGrd.addColorStop(0.75, "rgba(235, 100, 20, 0.25)");
  iscoFlareGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = iscoFlareGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, horizonR * 1.55, horizonR * 0.65, diskAngle, 0, Math.PI * 2);
  ctx.fill();
}
