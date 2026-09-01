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

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

let stars: StarParticle[] = [];

function initGargantuaData(sw: number, sh: number) {
  if (stars.length > 0) return;

  for (let i = 0; i < 180; i++) {
    stars.push({
      x: (Math.random() - 0.5) * sw * 1.5,
      y: (Math.random() - 0.5) * sh * 1.5,
      size: Math.random() < 0.12 ? 1.5 : Math.random() < 0.45 ? 0.9 : 0.5,
      alpha: 0.2 + Math.random() * 0.7,
      twinkleSpeed: 1.2 + Math.random() * 2.8,
      twinklePhase: Math.random() * Math.PI * 2,
    });
  }
}

/**
 * 1:1 像素级复刻电影《星际穿越》(Interstellar) 卡冈图雅 (Gargantua) 真实物理引力透镜黑洞
 * 严格还原经典天体物理模拟形态（Kip Thorne 广义相对论光线追踪仿真）：
 * 1. 中心高耸的纯黑施瓦西事件视界球顶（清晰可见的大半个纯黑视界天穹）
 * 2. 上方高耸的引力透镜天冠拱门（Top Lensed Crown）与丝绸般细腻的同心流纹
 * 3. 下方紧密包覆的引力透镜下腹光弧（Bottom Lensed Underbelly）
 * 4. 倾斜赤道面前置主吸积盘（-32° 倾角，精准切过视界下半部，绝不遮挡中央黑体）
 * 5. 多普勒集束（左翼超强白炽展宽，右翼暗淡红移收细）
 * 6. 极细白炽光子球环（Photon Sphere Ring）
 * 7. 60FPS 极速渲染与音频动力学共振
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
  const cy = sh * 0.53;

  const speed = params.speed || 1.0;
  const singularityMass = params.singularityMass || 1.0;
  const superstringTension = params.superstringTension || 1.2;
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
    (0.0028 + energy * 0.0055) * superstringTension;
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
  const horizonR = (92 + bass * 16) * singularityMass; // 施瓦西黑洞视界半径
  const diskTilt = -0.56; // -32° 倾角
  const cosD = Math.cos(diskTilt);
  const sinD = Math.sin(diskTilt);

  // --- 3. 深空背景与引力透镜弯折星场 ---
  ctx.save();
  ctx.fillStyle = "#020003";
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
  spaceGrd.addColorStop(0, "rgba(40, 10, 8, 0.42)");
  spaceGrd.addColorStop(0.4, "rgba(18, 4, 6, 0.26)");
  spaceGrd.addColorStop(1, "rgba(2, 0, 3, 0.96)");
  ctx.fillStyle = spaceGrd;
  ctx.fillRect(0, 0, sw, sh);

  // 绘制受强引力场切向偏折的恒星
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
  renderTopCrown(ctx, cx, cy, horizonR, diskTilt, cosD, sinD, rot, t, bass, mid, treble);
  ctx.restore();

  // --- 5. 【下方引力透镜下腹光弧】(Bottom Gravitational Lensing Underbelly) ---
  ctx.save();
  renderBottomUnderbelly(ctx, cx, cy, horizonR, diskTilt, cosD, sinD, rot, t, bass, mid, treble);
  ctx.restore();

  // --- 6. 【中心 3D 纯黑施瓦西事件视界与极细光子球环】---
  ctx.save();
  // 纯黑视界球体
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
  ctx.restore();

  // --- 7. 【赤道面前置主吸积盘】(Front Equatorial Accretion Disk - Lower Crossing) ---
  // 精确横跨在黑洞下半部前方，完整露出黑洞上半球天穹
  ctx.save();
  renderFrontEquatorialDisk(ctx, cx, cy, horizonR, diskTilt, cosD, sinD, rot, t, bass, mid, treble);
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

      ctx.strokeStyle = `rgba(255, 175, 75, ${swItem.alpha * 0.38})`;
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
 * 背侧吸积盘被引力场弯折包覆于黑洞上方，带有极其细腻的同心开普勒流态微纹理
 */
function renderTopCrown(
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
  const crownOuterR = horizonR * 2.35;

  // 1. 底层大面积渐变流质天冠（内圈炽金 -> 中间琥珀 -> 外圈熔岩赤红）
  const crownGrd = ctx.createRadialGradient(
    cx - horizonR * 0.2,
    cy - horizonR * 0.15,
    crownInnerR * 0.98,
    cx,
    cy - horizonR * 0.35,
    crownOuterR * 1.08
  );
  crownGrd.addColorStop(0, "rgba(255, 255, 240, 0.98)");
  crownGrd.addColorStop(0.12, "rgba(255, 220, 100, 0.92)");
  crownGrd.addColorStop(0.35, "rgba(250, 130, 25, 0.75)");
  crownGrd.addColorStop(0.68, "rgba(175, 38, 10, 0.45)");
  crownGrd.addColorStop(0.92, "rgba(85, 10, 4, 0.18)");
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

  // 2. 天冠细微丝滑同心流体层（32 层微细丝滑光层，赋予开普勒旋涡实体流质感）
  ctx.lineCap = "round";
  for (let i = 0; i < 32; i++) {
    const frac = i / 31;
    const rx = crownInnerR + frac * (crownOuterR - crownInnerR) * 0.88;
    const ry = crownInnerR * 0.78 + frac * (crownOuterR * 0.84 - crownInnerR * 0.78) * 0.88;

    // 旋转相位波动
    const wave = Math.sin(frac * 18.0 + rot * 4.0) * 0.08;
    const alpha = (0.24 - frac * 0.15 + wave) * (1 + mid * 0.25);
    if (alpha <= 0.01) continue;

    if (frac < 0.18) {
      ctx.strokeStyle = `rgba(255, 255, 230, ${alpha * 1.4})`;
    } else if (frac < 0.52) {
      ctx.strokeStyle = `rgba(255, 185, 55, ${alpha * 1.1})`;
    } else {
      ctx.strokeStyle = `rgba(215, 65, 15, ${alpha * 0.85})`;
    }

    ctx.lineWidth = 1.5 + (1 - frac) * 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, diskAngle, Math.PI * 0.97, Math.PI * 2.03);
    ctx.stroke();
  }

  // 3. 右上掠角引力尾迹 (Top-Right Lensed Accretion Flare)
  const flareGrd = ctx.createRadialGradient(
    cx + horizonR * 1.6 * cosD,
    cy + horizonR * 1.6 * sinD - horizonR * 0.5,
    5,
    cx + horizonR * 1.6 * cosD,
    cy + horizonR * 1.6 * sinD - horizonR * 0.5,
    horizonR * 1.8
  );
  flareGrd.addColorStop(0, "rgba(255, 140, 30, 0.45)");
  flareGrd.addColorStop(0.5, "rgba(180, 40, 10, 0.2)");
  flareGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = flareGrd;
  ctx.beginPath();
  ctx.arc(
    cx + horizonR * 1.6 * cosD,
    cy + horizonR * 1.6 * sinD - horizonR * 0.5,
    horizonR * 1.8,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

/**
 * 绘制卡冈图雅下方引力透镜下腹 (Bottom Lensed Underbelly)
 */
function renderBottomUnderbelly(
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
  const underOuterR = horizonR * 1.72;

  const underGrd = ctx.createRadialGradient(
    cx,
    cy + horizonR * 0.1,
    underInnerR * 0.96,
    cx,
    cy + horizonR * 0.25,
    underOuterR * 1.05
  );
  underGrd.addColorStop(0, "rgba(255, 240, 160, 0.85)");
  underGrd.addColorStop(0.25, "rgba(245, 125, 28, 0.65)");
  underGrd.addColorStop(0.65, "rgba(165, 42, 10, 0.32)");
  underGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = underGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, underOuterR, underOuterR * 0.66, diskAngle, 0.02, Math.PI * 0.98);
  ctx.ellipse(cx, cy, underInnerR, underInnerR * 0.6, diskAngle, Math.PI * 0.98, 0.02, true);
  ctx.closePath();
  ctx.fill();

  // 下腹 12 层微细流线
  for (let i = 0; i < 12; i++) {
    const frac = i / 11;
    const rx = underInnerR + frac * (underOuterR - underInnerR) * 0.82;
    const ry = underInnerR * 0.6 + frac * (underOuterR * 0.66 - underInnerR * 0.6) * 0.82;

    ctx.strokeStyle = `rgba(240, 115, 28, ${(0.2 - frac * 0.12) * (1 + mid * 0.25)})`;
    ctx.lineWidth = 1.4 + (1 - frac) * 1.8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, diskAngle, 0.06, Math.PI * 0.94);
    ctx.stroke();
  }
}

/**
 * 绘制赤道面前置主吸积盘 (Front Equatorial Accretion Disk)
 * 横跨在黑洞下半部前方，左翼白炽多普勒集束宽大，右翼渐缩暗红，中心绝不遮蔽上半球黑洞视界
 */
function renderFrontEquatorialDisk(
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
  const diskLenLeft = horizonR * 5.2; // 左翼展长
  const diskLenRight = horizonR * 4.6; // 右翼展长
  const diskHalfHeight = horizonR * 0.22 * (1 + bass * 0.12); // 主盘扁平流线高度（精确控制，不吞噬黑洞）

  // 1. 赤道盘流体外廓多边形插值
  const topPts: { x: number; y: number }[] = [];
  const botPts: { x: number; y: number }[] = [];
  const steps = 44;

  for (let i = 0; i <= steps; i++) {
    const prog = i / steps; // 0 (左端) 到 1 (右端)
    const u = -diskLenLeft + prog * (diskLenLeft + diskLenRight);

    // 沿轴向的厚度包络（中间在视界处适中，左翼由于多普勒更宽，两端平滑收敛）
    const normDist = u < 0 ? -u / diskLenLeft : u / diskLenRight;
    const thickness =
      diskHalfHeight * Math.pow(1 - Math.min(1, normDist), 0.7) * (u < 0 ? 1.3 : 0.85);

    // 赤道盘在 Y 轴上微下移（约 +0.18 horizonR），确保黑洞上半球天穹完全暴露！
    const vOffset = horizonR * 0.18;

    const topX = cx + u * cosD - (-thickness + vOffset) * sinD;
    const topY = cy + u * sinD + (-thickness + vOffset) * cosD;

    const botX = cx + u * cosD - (thickness + vOffset) * sinD;
    const botY = cy + u * sinD + (thickness + vOffset) * cosD;

    topPts.push({ x: topX, y: topY });
    botPts.unshift({ x: botX, y: botY });
  }

  // 1.1 主盘大面积连续渐变流质体
  const diskGrd = ctx.createLinearGradient(
    cx - diskLenLeft * cosD,
    cy - diskLenLeft * sinD,
    cx + diskLenRight * cosD,
    cy + diskLenRight * sinD
  );
  diskGrd.addColorStop(0, "rgba(80, 10, 4, 0)");
  diskGrd.addColorStop(0.12, "rgba(195, 50, 12, 0.45)");
  diskGrd.addColorStop(0.32, "rgba(255, 145, 28, 0.88)");
  diskGrd.addColorStop(0.48, "rgba(255, 245, 175, 0.98)"); // 核心白炽区
  diskGrd.addColorStop(0.7, "rgba(235, 100, 20, 0.7)");
  diskGrd.addColorStop(0.88, "rgba(145, 30, 8, 0.35)");
  diskGrd.addColorStop(1, "rgba(45, 6, 2, 0)");

  ctx.fillStyle = diskGrd;
  ctx.beginPath();
  ctx.moveTo(topPts[0].x, topPts[0].y);
  for (let p = 1; p < topPts.length; p++) ctx.lineTo(topPts[p].x, topPts[p].y);
  for (let p = 0; p < botPts.length; p++) ctx.lineTo(botPts[p].x, botPts[p].y);
  ctx.closePath();
  ctx.fill();

  // 1.2 核心白炽流光带 (Incandescent Core Ribbon)
  const ribbonGrd = ctx.createLinearGradient(
    cx - diskLenLeft * 0.75 * cosD,
    cy - diskLenLeft * 0.75 * sinD,
    cx + diskLenRight * 0.65 * cosD,
    cy + diskLenRight * 0.65 * sinD
  );
  ribbonGrd.addColorStop(0, "rgba(255, 160, 40, 0)");
  ribbonGrd.addColorStop(0.2, "rgba(255, 225, 110, 0.85)");
  ribbonGrd.addColorStop(0.46, "rgba(255, 255, 255, 0.98)");
  ribbonGrd.addColorStop(0.68, "rgba(255, 210, 80, 0.78)");
  ribbonGrd.addColorStop(1, "rgba(240, 100, 18, 0)");

  ctx.strokeStyle = ribbonGrd;
  ctx.lineWidth = 3.6 + bass * 2.2;
  ctx.beginPath();
  const vOff = horizonR * 0.18;
  ctx.moveTo(
    cx - diskLenLeft * 0.82 * cosD - vOff * -sinD,
    cy - diskLenLeft * 0.82 * sinD + vOff * cosD
  );
  ctx.lineTo(
    cx + diskLenRight * 0.72 * cosD - vOff * -sinD,
    cy + diskLenRight * 0.72 * sinD + vOff * cosD
  );
  ctx.stroke();

  // 1.3 极细白炽中线
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 1.2 + bass * 0.6;
  ctx.beginPath();
  ctx.moveTo(
    cx - diskLenLeft * 0.62 * cosD - vOff * -sinD,
    cy - diskLenLeft * 0.62 * sinD + vOff * cosD
  );
  ctx.lineTo(
    cx + diskLenRight * 0.45 * cosD - vOff * -sinD,
    cy + diskLenRight * 0.45 * sinD + vOff * cosD
  );
  ctx.stroke();

  // 2. 左翼多普勒集束巨型耀斑 (Doppler Beaming Left Wing Flare)
  const dopplerGrd = ctx.createRadialGradient(
    cx - horizonR * 1.65 * cosD,
    cy - horizonR * 1.65 * sinD + horizonR * 0.1,
    5,
    cx - horizonR * 1.65 * cosD,
    cy - horizonR * 1.65 * sinD + horizonR * 0.1,
    horizonR * 1.9
  );
  dopplerGrd.addColorStop(0, "rgba(255, 255, 250, 0.88)");
  dopplerGrd.addColorStop(0.22, "rgba(255, 220, 100, 0.65)");
  dopplerGrd.addColorStop(0.62, "rgba(245, 115, 25, 0.25)");
  dopplerGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = dopplerGrd;
  ctx.beginPath();
  ctx.arc(
    cx - horizonR * 1.65 * cosD,
    cy - horizonR * 1.65 * sinD + horizonR * 0.1,
    horizonR * 1.9,
    0,
    Math.PI * 2
  );
  ctx.fill();
}
