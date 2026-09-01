/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface JetHelix {
  phase: number;
  radiusFactor: number;
  speed: number;
  colorType: number; // 0: 亮白, 1: 幽蓝, 2: 冰青
  width: number;
}

interface SpiralStream {
  baseRadius: number;
  armAngle: number;
  length: number;
  speed: number;
  spiralRate: number;
  width: number;
  brightness: number;
  tempIndex: number; // 0: 白炽高温, 1: 琥珀铜金, 2: 熔岩橙, 3: 深褐红
  waveFreq: number;
  wavePhase: number;
}

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

let jetHelices: JetHelix[] = [];
let spiralStreams: SpiralStream[] = [];

function initAstrophysicsData() {
  if (spiralStreams.length > 0) return;

  // 1. 初始化吸积盘 120 条对数螺旋连续流体带
  const streamCount = 120;
  for (let i = 0; i < streamCount; i++) {
    const frac = i / (streamCount - 1);
    // 径向分布：内圈密集，向外呈对数扩散
    const baseRadius = 42 + Math.pow(frac, 1.4) * 380;
    const speed = (0.012 / Math.sqrt(Math.max(1, baseRadius * 0.03))) * 0.85;

    let tempIndex = 1;
    if (frac < 0.15)
      tempIndex = 0; // 白炽高温
    else if (frac < 0.55)
      tempIndex = 1; // 琥珀铜金
    else if (frac < 0.85)
      tempIndex = 2; // 熔岩赭石
    else tempIndex = 3; // 深褐赤红

    spiralStreams.push({
      baseRadius,
      armAngle: (i * 137.508 * Math.PI) / 180, // 黄金分割角自然分布
      length: Math.PI * (1.8 + Math.random() * 1.4),
      speed,
      spiralRate: 0.16 + (i % 5) * 0.02,
      width: 1.2 + frac * 3.2,
      brightness: 0.4 + Math.sin(frac * Math.PI) * 0.6,
      tempIndex,
      waveFreq: 2 + (i % 4),
      wavePhase: Math.random() * Math.PI * 2,
    });
  }

  // 2. 初始化相对论极向喷流 6 条双螺旋等离子体磁力线
  jetHelices = [
    { phase: 0, radiusFactor: 1.0, speed: 0.025, colorType: 0, width: 2.2 },
    { phase: Math.PI * 0.66, radiusFactor: 1.15, speed: 0.022, colorType: 1, width: 1.8 },
    { phase: Math.PI * 1.33, radiusFactor: 0.85, speed: 0.028, colorType: 2, width: 1.6 },
    { phase: Math.PI * 0.33, radiusFactor: 1.3, speed: 0.02, colorType: 1, width: 1.5 },
    { phase: Math.PI * 1.0, radiusFactor: 0.95, speed: 0.026, colorType: 0, width: 2.0 },
    { phase: Math.PI * 1.66, radiusFactor: 1.2, speed: 0.023, colorType: 2, width: 1.4 },
  ];
}

/**
 * 1:1 复刻天体物理黑洞与极向相对论螺旋喷流（Gargantua with Polar Jet）
 * - 48° 俯视倾斜透视视角（Oblique 3D Perspective）
 * - 左上方向激射的幽蓝/白炽相对论双螺旋等离子体喷流（Relativistic Polar Helical Jet）
 * - 左上方深空银河星流背景（Deep Space Milky Way Galaxy Backdrop）
 * - 纯黑 3D 施瓦西视界球体与爱因斯坦引力透镜弯月光环（Lensing Crescent Arc）
 * - 细腻流态铜金色对数螺旋剪切吸积盘（Continuous Copper-Bronze Spiral Disk）
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

  initAstrophysicsData();

  // 黑洞中心略偏右下方（对应参考图中的经典构图）
  const cx = sw * 0.53;
  const cy = sh * 0.58;

  const speed = params.speed || 1.0;
  const singularityMass = params.singularityMass || 1.0;
  const superstringTension = params.superstringTension || 1.2;
  const coreGlow = params.coreGlow || 1.2;
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

  // 吸积盘自转与演化
  const rot =
    ((refs.bokeh.current && refs.bokeh.current[0]) || 0) +
    (0.0028 + energy * 0.007) * superstringTension;
  if (!refs.bokeh.current) refs.bokeh.current = [];
  refs.bokeh.current[0] = rot;

  if (!refs.shockwaves.current) {
    refs.shockwaves.current = [];
  }
  const shockwaves = refs.shockwaves.current as GravitationalShockwave[];

  if (rawBass > 0.66 && rawBass - bass > 0.22 * burstSensitivity && shockwaves.length < 3) {
    shockwaves.push({
      radius: 45 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.7,
      alpha: 0.65,
      speed: 14 + bass * 18,
    });
  }

  // 透视投影参数（俯视 48°，吸积盘倾角压缩比 0.44，主轴倾角 -28°）
  const horizonR = (48 + bass * 12) * singularityMass; // 施瓦西视界球体半径
  const diskTilt = 0.44; // 椭圆压缩
  const diskRotationAngle = -0.48; // 逆时针倾斜约 28° 模拟空间朝向
  const cosD = Math.cos(diskRotationAngle);
  const sinD = Math.sin(diskRotationAngle);

  // --- 2. 深邃深空暗黑宇宙底色 (Deep Space Void) ---
  ctx.save();
  ctx.fillStyle = "#010203";
  ctx.fillRect(0, 0, sw, sh);

  // 吸积盘整体微弱温润底光（右下方温暖深红褐，左上方深空幽冷）
  const ambientGrd = ctx.createRadialGradient(
    cx,
    cy,
    horizonR * 1.5,
    cx,
    cy,
    Math.max(sw, sh) * 0.8
  );
  ambientGrd.addColorStop(0, "rgba(220, 90, 20, 0.08)");
  ambientGrd.addColorStop(0.35, "rgba(120, 35, 10, 0.05)");
  ambientGrd.addColorStop(0.75, "rgba(40, 10, 5, 0.02)");
  ambientGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = ambientGrd;
  ctx.fillRect(0, 0, sw, sh);

  // --- 3. 左上方深空银河星系流光 (Top-Left Galaxy Stream Backdrop) ---
  const galaxyCenterX = sw * 0.15;
  const galaxyCenterY = sh * 0.12;
  const galaxyGrd = ctx.createRadialGradient(
    galaxyCenterX,
    galaxyCenterY,
    10,
    galaxyCenterX,
    galaxyCenterY,
    sw * 0.38
  );
  galaxyGrd.addColorStop(0, "rgba(215, 235, 255, 0.45)");
  galaxyGrd.addColorStop(0.2, "rgba(160, 200, 245, 0.28)");
  galaxyGrd.addColorStop(0.5, "rgba(80, 120, 180, 0.12)");
  galaxyGrd.addColorStop(0.8, "rgba(30, 50, 90, 0.04)");
  galaxyGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = galaxyGrd;
  ctx.beginPath();
  // 斜向银河椭圆盘
  ctx.ellipse(galaxyCenterX, galaxyCenterY, sw * 0.32, sh * 0.14, -0.65, 0, Math.PI * 2);
  ctx.fill();

  // 银河星点微光
  for (let s = 0; s < 36; s++) {
    const starX = galaxyCenterX + Math.sin(s * 99 + t * 0.1) * sw * 0.18;
    const starY = galaxyCenterY + Math.cos(s * 37) * sh * 0.09;
    const starAlpha = 0.2 + (Math.sin(t * 2 + s) * 0.5 + 0.5) * 0.45;
    ctx.fillStyle = `rgba(240, 248, 255, ${starAlpha})`;
    ctx.beginPath();
    ctx.arc(starX, starY, s % 3 === 0 ? 1.5 : 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- 4. 【吸积盘后半部分】(Back-side Accretion Disk - Drawn Behind Black Hole) ---
  ctx.save();
  // 绘制后半圈对数螺旋流体
  drawSpiralAccretionDisk(
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
    treble,
    false
  );
  ctx.restore();

  // --- 5. 【爱因斯坦引力透镜弯月光拱】(Gravitational Lensing Crescent Halo) ---
  // 吸积盘背侧光线由于黑洞强大引力弯折，在黑洞球面上方形成清晰明亮的白金弯月拱
  ctx.save();
  const lensR = horizonR * 1.35;
  const lensGrd = ctx.createLinearGradient(
    cx - lensR * 1.1,
    cy - lensR * 0.8,
    cx + lensR * 0.8,
    cy + lensR * 0.6
  );
  lensGrd.addColorStop(0, "rgba(255, 255, 240, 0.95)");
  lensGrd.addColorStop(0.3, "rgba(255, 210, 100, 0.85)");
  lensGrd.addColorStop(0.7, "rgba(245, 120, 30, 0.5)");
  lensGrd.addColorStop(1, "rgba(180, 40, 10, 0.1)");

  ctx.strokeStyle = lensGrd;
  ctx.lineWidth = 3.6 + bass * 2.2;
  ctx.shadowColor = "#FFAA30";
  ctx.shadowBlur = 18 * coreGlow;
  ctx.beginPath();
  // 环绕在黑洞上后方的引力透镜弯月光弧
  ctx.ellipse(
    cx - 2,
    cy - horizonR * 0.15,
    lensR * 1.02,
    lensR * 0.72,
    diskRotationAngle,
    Math.PI * 0.85,
    Math.PI * 2.15
  );
  ctx.stroke();
  ctx.restore();

  // --- 6. 【3D 纯黑施瓦西事件视界球体】(Pitch-Black Event Horizon Sphere) ---
  // 绝对纯黑，干净利落地遮挡后面的吸积盘，呈现出震撼的 3D 立体球体剪影！
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR, 0, Math.PI * 2);
  ctx.fill();

  // 视界边缘微弱的引力色散吸收边缘
  const horizonAbsorbGrd = ctx.createRadialGradient(
    cx,
    cy,
    horizonR * 0.85,
    cx,
    cy,
    horizonR * 1.04
  );
  horizonAbsorbGrd.addColorStop(0, "rgba(0, 0, 0, 1.0)");
  horizonAbsorbGrd.addColorStop(0.75, "rgba(2, 1, 3, 0.96)");
  horizonAbsorbGrd.addColorStop(1, "rgba(255, 160, 50, 0)");
  ctx.fillStyle = horizonAbsorbGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 1.04, 0, Math.PI * 2);
  ctx.fill();

  // 极细 1.2px 光子球环（Photon Sphere Ring）
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 1.2 + bass * 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 7. 【吸积盘前半部分】(Front-side Accretion Disk - Flows in Front of Black Hole) ---
  ctx.save();
  drawSpiralAccretionDisk(
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
    treble,
    true
  );
  ctx.restore();

  // --- 8. 【相对论极向双螺旋等离子体喷流】(Relativistic Helical Polar Synchrotron Jet) ---
  // 从黑洞极点向左上方喷射而出（角度约 -122°）
  ctx.save();
  const jetAngle = -2.13; // 约 -122°，朝向左上方
  const jetCos = Math.cos(jetAngle);
  const jetSin = Math.sin(jetAngle);
  const jetPerpX = -jetSin;
  const jetPerpY = jetCos;

  const jetLength = Math.min(sw, sh) * (0.85 + bass * 0.2);
  const jetBaseRadius = horizonR * 0.38;

  // (8.1) 幽蓝半透明发光等离子喷流锥体 (Cyan Plasma Jet Cone)
  const jetConeGrd = ctx.createLinearGradient(
    cx,
    cy,
    cx + jetCos * jetLength,
    cy + jetSin * jetLength
  );
  jetConeGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  jetConeGrd.addColorStop(0.08, "rgba(180, 230, 255, 0.85)");
  jetConeGrd.addColorStop(0.28, "rgba(90, 185, 255, 0.45)");
  jetConeGrd.addColorStop(0.65, "rgba(45, 120, 240, 0.18)");
  jetConeGrd.addColorStop(1, "rgba(20, 60, 180, 0)");

  ctx.fillStyle = jetConeGrd;
  ctx.beginPath();
  const jetTipWidth = 48 + bass * 30;
  ctx.moveTo(cx - jetPerpX * jetBaseRadius, cy - jetPerpY * jetBaseRadius);
  ctx.lineTo(
    cx + jetCos * jetLength - jetPerpX * jetTipWidth,
    cy + jetSin * jetLength - jetPerpY * jetTipWidth
  );
  ctx.lineTo(
    cx + jetCos * jetLength + jetPerpX * jetTipWidth,
    cy + jetSin * jetLength + jetPerpY * jetTipWidth
  );
  ctx.lineTo(cx + jetPerpX * jetBaseRadius, cy + jetPerpY * jetBaseRadius);
  ctx.closePath();
  ctx.fill();

  // (8.2) 核心极亮白炽等离子光柱 (Ultra-bright Jet Core Needle)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 2.5 + bass * 2.0;
  ctx.shadowColor = "#70D0FF";
  ctx.shadowBlur = 16 * coreGlow;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + jetCos * (jetLength * 0.7), cy + jetSin * (jetLength * 0.7));
  ctx.stroke();

  // (8.3) 相对论双螺旋缠绕磁力线 (Parametric Helical Magnetic Flux Threads)
  for (let h = 0; h < jetHelices.length; h++) {
    const helix = jetHelices[h];
    const steps = 40;
    const helixPoints: { x: number; y: number }[] = [];

    for (let s = 0; s <= steps; s++) {
      const prog = s / steps;
      const curDist = prog * jetLength;
      const helixRadius = (12 + prog * 36) * helix.radiusFactor * (1 + bass * 0.25);
      const helixAngle = prog * Math.PI * 8 + t * (helix.speed * 80) + helix.phase;

      // 沿喷流中心轴向展开的正交螺旋偏移
      const offsetX = jetPerpX * (Math.sin(helixAngle) * helixRadius);
      const offsetY = jetPerpY * (Math.sin(helixAngle) * helixRadius);

      const px = cx + jetCos * curDist + offsetX;
      const py = cy + jetSin * curDist + offsetY;
      helixPoints.push({ x: px, y: py });
    }

    ctx.beginPath();
    ctx.moveTo(helixPoints[0].x, helixPoints[0].y);
    for (let p = 1; p < helixPoints.length - 1; p++) {
      const mx = (helixPoints[p].x + helixPoints[p + 1].x) / 2;
      const my = (helixPoints[p].y + helixPoints[p + 1].y) / 2;
      ctx.quadraticCurveTo(helixPoints[p].x, helixPoints[p].y, mx, my);
    }
    ctx.lineTo(helixPoints[helixPoints.length - 1].x, helixPoints[helixPoints.length - 1].y);

    const helixGrd = ctx.createLinearGradient(
      cx,
      cy,
      cx + jetCos * jetLength,
      cy + jetSin * jetLength
    );

    if (helix.colorType === 0) {
      helixGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      helixGrd.addColorStop(0.3, "rgba(210, 245, 255, 0.75)");
      helixGrd.addColorStop(0.8, "rgba(100, 190, 255, 0.25)");
      helixGrd.addColorStop(1, "rgba(60, 130, 240, 0)");
    } else if (helix.colorType === 1) {
      helixGrd.addColorStop(0, "rgba(220, 240, 255, 0.9)");
      helixGrd.addColorStop(0.35, "rgba(100, 210, 255, 0.7)");
      helixGrd.addColorStop(0.75, "rgba(50, 140, 240, 0.3)");
      helixGrd.addColorStop(1, "rgba(30, 80, 200, 0)");
    } else {
      helixGrd.addColorStop(0, "rgba(240, 255, 255, 0.85)");
      helixGrd.addColorStop(0.4, "rgba(130, 240, 230, 0.65)");
      helixGrd.addColorStop(0.8, "rgba(60, 170, 220, 0.25)");
      helixGrd.addColorStop(1, "rgba(30, 90, 180, 0)");
    }

    ctx.strokeStyle = helixGrd;
    ctx.lineWidth = helix.width * (1 + treble * 0.4);
    ctx.stroke();
  }

  // (8.4) 喷流基底白炽耀斑 (Blinding White-Hot Base Flare)
  const baseFlareR = horizonR * 0.45 * (1 + bass * 0.4);
  const baseGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseFlareR);
  baseGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  baseGrd.addColorStop(0.4, "rgba(200, 240, 255, 0.85)");
  baseGrd.addColorStop(0.8, "rgba(90, 180, 255, 0.35)");
  baseGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = baseGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, baseFlareR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 9. 引力波时空曲率涟漪 (Gravitational Ripples) ---
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

      ctx.strokeStyle = `rgba(255, 190, 100, ${swItem.alpha * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // 沿吸积盘倾角绘制扩散椭圆
      for (let a = 0; a <= 36; a++) {
        const rad = (a / 36) * Math.PI * 2;
        const ex = Math.cos(rad) * swItem.radius;
        const ey = Math.sin(rad) * swItem.radius * diskTilt;
        const rx = cx + ex * cosD - ey * sinD;
        const ry = cy + ex * sinD + ey * cosD;
        if (a === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * 绘制对数螺旋剪切流态吸积盘（支持分层：前半圈覆盖黑洞，后半圈被黑洞遮挡）
 */
function drawSpiralAccretionDisk(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  diskTilt: number,
  cosD: number,
  sinD: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number,
  isForeground: boolean
) {
  const iscoR = horizonR * 1.32;
  const maxR = horizonR * 6.5;

  for (let i = 0; i < spiralStreams.length; i++) {
    const stream = spiralStreams[i];
    const curBaseR = stream.baseRadius * (1 + bass * 0.08);

    if (curBaseR < iscoR * 0.95 || curBaseR > maxR) continue;

    const angleStart = rot * (stream.speed * 85) + stream.armAngle;
    const steps = 36;
    const pts: { x: number; y: number; alpha: number }[] = [];

    for (let s = 0; s <= steps; s++) {
      const prog = s / steps;
      const angle = angleStart + prog * stream.length;

      // 对数螺旋半径公式
      const r = curBaseR * Math.exp(prog * stream.spiralRate);
      if (r > maxR * 1.2) break;

      // 扰动微波
      const waveDisp =
        Math.sin(angle * stream.waveFreq + t * 2 + stream.wavePhase) * (2.0 + bass * 4.0);
      const finalR = r + waveDisp;

      // 椭圆投影并旋转倾斜角
      const ex = Math.cos(angle) * finalR;
      const ey = Math.sin(angle) * finalR * diskTilt;
      const px = cx + ex * cosD - ey * sinD;
      const py = cy + ex * sinD + ey * cosD;

      // 判断当前点在黑洞前半球还是后半球（根据未旋转前的 ey 判断）
      const isInFront = ey >= -horizonR * 0.25;

      if (isForeground === isInFront) {
        // 沿流线的黑体辐射渐变透明度
        const distRatio = (finalR - iscoR) / (maxR - iscoR);
        const alpha =
          stream.brightness *
          (1 - Math.min(1, Math.max(0, distRatio * 0.85))) *
          (isForeground ? 0.42 : 0.32) *
          (1 + mid * 0.25);

        pts.push({ x: px, y: py, alpha });
      }
    }

    if (pts.length < 2) continue;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let p = 1; p < pts.length; p++) {
      ctx.lineTo(pts[p].x, pts[p].y);
    }

    // 根据温度梯度配置着色器
    const startPt = pts[0];
    const endPt = pts[pts.length - 1];
    const strokeGrd = ctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);

    if (stream.tempIndex === 0) {
      // 白炽超高温（ISCO 附近）
      strokeGrd.addColorStop(0, `rgba(255, 255, 245, ${pts[0].alpha * 1.3})`);
      strokeGrd.addColorStop(0.3, `rgba(255, 225, 130, ${pts[0].alpha * 1.1})`);
      strokeGrd.addColorStop(0.7, `rgba(255, 160, 45, ${pts[0].alpha * 0.85})`);
      strokeGrd.addColorStop(1, `rgba(210, 80, 20, ${pts[pts.length - 1].alpha * 0.5})`);
    } else if (stream.tempIndex === 1) {
      // 琥珀铜金（主盘区）
      strokeGrd.addColorStop(0, `rgba(255, 235, 160, ${pts[0].alpha * 1.1})`);
      strokeGrd.addColorStop(0.35, `rgba(245, 150, 45, ${pts[0].alpha})`);
      strokeGrd.addColorStop(0.75, `rgba(200, 85, 25, ${pts[0].alpha * 0.75})`);
      strokeGrd.addColorStop(1, `rgba(150, 45, 12, ${pts[pts.length - 1].alpha * 0.4})`);
    } else if (stream.tempIndex === 2) {
      // 熔岩赭石
      strokeGrd.addColorStop(0, `rgba(240, 145, 45, ${pts[0].alpha})`);
      strokeGrd.addColorStop(0.45, `rgba(195, 75, 20, ${pts[0].alpha * 0.8})`);
      strokeGrd.addColorStop(0.85, `rgba(135, 38, 10, ${pts[0].alpha * 0.5})`);
      strokeGrd.addColorStop(1, `rgba(80, 18, 6, ${pts[pts.length - 1].alpha * 0.25})`);
    } else {
      // 深褐赤红（外边缘）
      strokeGrd.addColorStop(0, `rgba(180, 65, 20, ${pts[0].alpha * 0.75})`);
      strokeGrd.addColorStop(0.5, `rgba(120, 32, 10, ${pts[0].alpha * 0.5})`);
      strokeGrd.addColorStop(1, `rgba(50, 10, 4, ${pts[pts.length - 1].alpha * 0.15})`);
    }

    ctx.strokeStyle = strokeGrd;
    ctx.lineWidth = stream.width * (1 + treble * 0.35);
    ctx.stroke();
  }
}
