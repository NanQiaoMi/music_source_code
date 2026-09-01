/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface JetHelicalStrand {
  phase: number;
  radiusBase: number;
  radiusGrowth: number;
  speed: number;
  width: number;
  alpha: number;
  colorType: number; // 0: 纯亮白, 1: 幽蓝, 2: 冰青
  pitch: number;
}

interface UltraSmoothFilament {
  baseRadius: number;
  angleOffset: number;
  length: number;
  speed: number;
  spiralK: number;
  width: number;
  baseAlpha: number;
  tier: number; // 0: 白炽金, 1: 琥珀金, 2: 熔岩铜, 3: 赭石褐, 4: 暗赤黑
  waveFreq: number;
  wavePhase: number;
}

interface ShockwaveRing {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

let filaments: UltraSmoothFilament[] = [];
let jetStrands: JetHelicalStrand[] = [];

// 预先静态初始化参数，避免每帧 GC 垃圾回收
function initVisualData() {
  if (filaments.length > 0) return;

  // 1. 吸积盘 140 条超细、高密、平滑的开普勒对数螺旋流线（两端渐隐、无粗糙断裂、无顿挫）
  const filamentCount = 140;
  for (let i = 0; i < filamentCount; i++) {
    const frac = i / (filamentCount - 1);
    const baseRadius = 46 + Math.pow(frac, 1.28) * 820;
    // 开普勒自转角速度 v ~ 1/sqrt(r)
    const speed = (0.012 / Math.sqrt(Math.max(1, baseRadius * 0.025))) * 0.75;

    let tier = 1;
    if (frac < 0.1)
      tier = 0; // ISCO 核心白炽金
    else if (frac < 0.38)
      tier = 1; // 琥珀金
    else if (frac < 0.68)
      tier = 2; // 熔岩铜
    else if (frac < 0.88)
      tier = 3; // 赭石褐
    else tier = 4; // 外边缘暗赤

    filaments.push({
      baseRadius,
      angleOffset: (i * 137.508 * Math.PI) / 180,
      length: Math.PI * (2.4 + (i % 4) * 0.4),
      speed,
      spiralK: 0.1 + (i % 5) * 0.012,
      width: 1.0 + frac * 2.8, // 极细高精流线（1.0px ~ 3.8px），绝无粗糙感
      baseAlpha: 0.14 + Math.sin(frac * Math.PI) * 0.18,
      tier,
      waveFreq: 2 + (i % 4),
      wavePhase: Math.random() * Math.PI * 2,
    });
  }

  // 2. 相对论极向喷流 6 条优雅的双螺旋等离子磁力线（清爽、飘逸、丝滑）
  jetStrands = [];
  const strandCount = 6;
  for (let i = 0; i < strandCount; i++) {
    const frac = i / strandCount;
    jetStrands.push({
      phase: frac * Math.PI * 2,
      radiusBase: 6 + (i % 2) * 5,
      radiusGrowth: 34 + (i % 3) * 12,
      speed: 0.02 + (i % 2) * 0.006,
      width: 1.8 + (i % 2) * 1.2,
      alpha: 0.38 + (i % 2) * 0.22,
      colorType: i % 3,
      pitch: 3.2 + (i % 2) * 0.8,
    });
  }
}

/**
 * 1:1 像素级复刻天体物理黑洞与相对论极向螺旋喷流（Gargantua with Relativistic Helical Jet）
 * 极致高精丝滑与 60FPS 满帧渲染：
 * - 48° 俯视倾斜三维透视构图
 * - 细腻无缝的实体流态铜金吸积盘（多层大面积连续流幕基底 + 140条极细端头渐隐螺旋流线）
 * - 幽蓝半透明双螺旋龙卷风态相对论极向喷流
 * - 纯黑 3D 施瓦西视界球体与爱因斯坦引力透镜弯月环
 * - 左上方柔和自然侧向银河系盘面与深空暖暗星云背景
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

  initVisualData();

  // 黑洞中心构图：右下方偏置 (约 53% W, 60% H)
  const cx = sw * 0.53;
  const cy = sh * 0.6;

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

  // 自转累加推进
  const rot =
    ((refs.bokeh.current && refs.bokeh.current[0]) || 0) +
    (0.0025 + energy * 0.006) * superstringTension;
  if (!refs.bokeh.current) refs.bokeh.current = [];
  refs.bokeh.current[0] = rot;

  if (!refs.shockwaves.current) {
    refs.shockwaves.current = [];
  }
  const shockwaves = refs.shockwaves.current as ShockwaveRing[];

  if (rawBass > 0.68 && rawBass - bass > 0.24 * burstSensitivity && shockwaves.length < 2) {
    shockwaves.push({
      radius: 50 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.8,
      alpha: 0.5,
      speed: 16 + bass * 18,
    });
  }

  // 几何透视常数
  const horizonR = (48 + bass * 12) * singularityMass;
  const iscoR = horizonR * 1.34;
  const diskTilt = 0.42; // 48° 俯视倾斜压缩比
  const diskAngle = -0.46; // -26° 倾角
  const cosD = Math.cos(diskAngle);
  const sinD = Math.sin(diskAngle);

  // --- 2. 深空暖暗宇宙底色 (Deep Space Ambient Void) ---
  ctx.save();
  ctx.fillStyle = "#070202";
  ctx.fillRect(0, 0, sw, sh);

  // 广域深空暖棕暗星云漫射
  const spaceAmbientGrd = ctx.createRadialGradient(
    cx + sw * 0.08,
    cy + sh * 0.08,
    horizonR * 1.5,
    cx,
    cy,
    Math.max(sw, sh) * 0.88
  );
  spaceAmbientGrd.addColorStop(0, "rgba(55, 16, 6, 0.42)");
  spaceAmbientGrd.addColorStop(0.35, "rgba(30, 8, 3, 0.32)");
  spaceAmbientGrd.addColorStop(0.7, "rgba(12, 3, 1, 0.22)");
  spaceAmbientGrd.addColorStop(1, "rgba(4, 1, 1, 0.95)");
  ctx.fillStyle = spaceAmbientGrd;
  ctx.fillRect(0, 0, sw, sh);

  // --- 3. 左上方真实侧向银河系盘面与星芒 (Edge-on Galaxy in Top-Left) ---
  const galaxyX = sw * 0.12;
  const galaxyY = sh * 0.14;

  ctx.save();
  // 银河冷蓝星云晕
  const galaxyHalo = ctx.createRadialGradient(galaxyX, galaxyY, 15, galaxyX, galaxyY, sw * 0.36);
  galaxyHalo.addColorStop(0, "rgba(220, 240, 255, 0.55)");
  galaxyHalo.addColorStop(0.2, "rgba(150, 195, 255, 0.32)");
  galaxyHalo.addColorStop(0.5, "rgba(70, 120, 200, 0.12)");
  galaxyHalo.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = galaxyHalo;
  ctx.beginPath();
  ctx.ellipse(galaxyX, galaxyY, sw * 0.32, sh * 0.14, -0.58, 0, Math.PI * 2);
  ctx.fill();

  // 银河中心核球白炽亮带
  const galaxyCore = ctx.createLinearGradient(
    galaxyX - sw * 0.2,
    galaxyY + sh * 0.1,
    galaxyX + sw * 0.2,
    galaxyY - sh * 0.1
  );
  galaxyCore.addColorStop(0, "rgba(200, 230, 255, 0)");
  galaxyCore.addColorStop(0.4, "rgba(240, 250, 255, 0.65)");
  galaxyCore.addColorStop(0.5, "rgba(255, 255, 255, 0.88)");
  galaxyCore.addColorStop(0.6, "rgba(240, 250, 255, 0.65)");
  galaxyCore.addColorStop(1, "rgba(200, 230, 255, 0)");

  ctx.fillStyle = galaxyCore;
  ctx.beginPath();
  ctx.ellipse(galaxyX, galaxyY, sw * 0.24, 11, -0.58, 0, Math.PI * 2);
  ctx.fill();

  // 银河中心暗尘埃带
  ctx.strokeStyle = "rgba(15, 6, 3, 0.5)";
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.ellipse(galaxyX, galaxyY + 1.5, sw * 0.22, 3.2, -0.58, 0, Math.PI * 2);
  ctx.stroke();

  // 稀疏星芒点
  for (let s = 0; s < 32; s++) {
    const starX = galaxyX + Math.sin(s * 87.3) * sw * 0.2;
    const starY = galaxyY + Math.cos(s * 43.7) * sh * 0.11;
    const starAlpha = 0.3 + (Math.sin(t * 3.0 + s * 1.5) * 0.5 + 0.5) * 0.6;
    ctx.fillStyle = `rgba(240, 248, 255, ${starAlpha})`;
    ctx.beginPath();
    ctx.arc(starX, starY, s % 3 === 0 ? 1.4 : 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- 4. 【吸积盘后半部分】(Back-side Accretion Disk - Behind Horizon) ---
  ctx.save();
  renderSmoothAccretionDisk(
    ctx,
    cx,
    cy,
    horizonR,
    iscoR,
    diskTilt,
    cosD,
    sinD,
    diskAngle,
    rot,
    t,
    bass,
    mid,
    treble,
    false
  );
  ctx.restore();

  // --- 5. 【爱因斯坦引力透镜弯月光拱】(Gravitational Lensing Crescent Arc) ---
  ctx.save();
  const lensR = horizonR * 1.34;
  const lensGrd = ctx.createLinearGradient(
    cx - lensR,
    cy - lensR * 0.8,
    cx + lensR * 0.7,
    cy + lensR * 0.5
  );
  lensGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  lensGrd.addColorStop(0.3, "rgba(255, 225, 120, 0.88)");
  lensGrd.addColorStop(0.7, "rgba(235, 115, 25, 0.45)");
  lensGrd.addColorStop(1, "rgba(160, 30, 5, 0)");

  // 柔和微光晕层
  ctx.strokeStyle = "rgba(255, 175, 45, 0.25)";
  ctx.lineWidth = 8 + bass * 4;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy - horizonR * 0.12,
    lensR * 1.05,
    lensR * 0.75,
    diskAngle,
    Math.PI * 0.8,
    Math.PI * 2.2
  );
  ctx.stroke();

  ctx.strokeStyle = lensGrd;
  ctx.lineWidth = 3.2 + bass * 1.8;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy - horizonR * 0.12,
    lensR * 1.05,
    lensR * 0.75,
    diskAngle,
    Math.PI * 0.8,
    Math.PI * 2.2
  );
  ctx.stroke();
  ctx.restore();

  // --- 6. 【3D 纯黑施瓦西事件视界球体】(Pitch-Black Event Horizon Sphere) ---
  // 纯粹、致密的黑洞球影，干净利落地遮挡背侧盘面，确立真实 3D 纵深！
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR, 0, Math.PI * 2);
  ctx.fill();

  // 极细光子球环（Photon Sphere Ring）
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.2 + bass * 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 7. 【吸积盘前半部分】(Front-side Accretion Disk - In Front of Horizon) ---
  ctx.save();
  renderSmoothAccretionDisk(
    ctx,
    cx,
    cy,
    horizonR,
    iscoR,
    diskTilt,
    cosD,
    sinD,
    diskAngle,
    rot,
    t,
    bass,
    mid,
    treble,
    true
  );
  ctx.restore();

  // --- 8. 【相对论极向幽蓝/白炽双螺旋等离子体喷流】(Helical Polar Synchrotron Jet) ---
  // 从黑洞极点向左上方喷射（角度约 -122°）
  ctx.save();
  const jetAngle = -2.13;
  const jetCos = Math.cos(jetAngle);
  const jetSin = Math.sin(jetAngle);
  const jetPerpX = -jetSin;
  const jetPerpY = jetCos;

  const jetLength = Math.min(sw, sh) * (0.95 + bass * 0.2);
  const jetBaseR = horizonR * 0.38;

  // (8.1) 幽蓝半透明发光喷流光锥 (Ethereal Jet Cone)
  const jetConeGrd = ctx.createLinearGradient(
    cx,
    cy,
    cx + jetCos * jetLength,
    cy + jetSin * jetLength
  );
  jetConeGrd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  jetConeGrd.addColorStop(0.08, "rgba(185, 230, 255, 0.7)");
  jetConeGrd.addColorStop(0.3, "rgba(100, 185, 255, 0.28)");
  jetConeGrd.addColorStop(0.7, "rgba(40, 110, 220, 0.08)");
  jetConeGrd.addColorStop(1, "rgba(15, 50, 160, 0)");

  ctx.fillStyle = jetConeGrd;
  ctx.beginPath();
  const jetTipWidth = 48 + bass * 24;
  ctx.moveTo(cx - jetPerpX * jetBaseR, cy - jetPerpY * jetBaseR);
  ctx.lineTo(
    cx + jetCos * jetLength - jetPerpX * jetTipWidth,
    cy + jetSin * jetLength - jetPerpY * jetTipWidth
  );
  ctx.lineTo(
    cx + jetCos * jetLength + jetPerpX * jetTipWidth,
    cy + jetSin * jetLength + jetPerpY * jetTipWidth
  );
  ctx.lineTo(cx + jetPerpX * jetBaseR, cy + jetPerpY * jetBaseR);
  ctx.closePath();
  ctx.fill();

  // (8.2) 核心极细白炽等离子光针
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 2.4 + bass * 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + jetCos * (jetLength * 0.72), cy + jetSin * (jetLength * 0.72));
  ctx.stroke();

  // (8.3) 6 条清爽丝滑的双螺旋等离子磁力线（两端渐隐、曲线平滑）
  for (let h = 0; h < jetStrands.length; h++) {
    const strand = jetStrands[h];
    const steps = 48;
    const pts: { x: number; y: number }[] = [];

    for (let s = 0; s <= steps; s++) {
      const prog = s / steps;
      const curDist = prog * jetLength;
      const helixRadius =
        (strand.radiusBase + Math.pow(prog, 1.15) * strand.radiusGrowth) * (1 + bass * 0.22);
      const helixAngle = prog * Math.PI * strand.pitch + t * (strand.speed * 80) + strand.phase;

      const offsetX = jetPerpX * (Math.sin(helixAngle) * helixRadius);
      const offsetY = jetPerpY * (Math.sin(helixAngle) * helixRadius);

      pts.push({
        x: cx + jetCos * curDist + offsetX,
        y: cy + jetSin * curDist + offsetY,
      });
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let p = 1; p < pts.length - 1; p++) {
      const mx = (pts[p].x + pts[p + 1].x) / 2;
      const my = (pts[p].y + pts[p + 1].y) / 2;
      ctx.quadraticCurveTo(pts[p].x, pts[p].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

    if (strand.colorType === 0) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${strand.alpha * (0.8 + treble * 0.2)})`;
    } else if (strand.colorType === 1) {
      ctx.strokeStyle = `rgba(135, 220, 255, ${strand.alpha * (0.75 + treble * 0.2)})`;
    } else {
      ctx.strokeStyle = `rgba(160, 245, 240, ${strand.alpha * (0.7 + treble * 0.2)})`;
    }

    ctx.lineWidth = strand.width * (1 + treble * 0.3);
    ctx.stroke();
  }

  // (8.4) 喷流基底白炽耀斑 (White-hot Base Flare)
  const baseFlareR = horizonR * 0.42 * (1 + bass * 0.35);
  const baseGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseFlareR);
  baseGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  baseGrd.addColorStop(0.35, "rgba(215, 245, 255, 0.85)");
  baseGrd.addColorStop(0.7, "rgba(90, 180, 255, 0.35)");
  baseGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = baseGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, baseFlareR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 9. 引力波时空曲率冲击涟漪 ---
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
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, swItem.radius, swItem.radius * diskTilt, diskAngle, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * 极速高精渲染连续平滑吸积盘（通过分层实体连续光幕 + 批处理对数螺旋流线）
 * - 移除任何生硬的切线与断层，保证前后过渡平滑如丝
 * - 螺旋流线两端渐隐（Tapering），杜绝粗糙线头
 */
function renderSmoothAccretionDisk(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  iscoR: number,
  diskTilt: number,
  cosD: number,
  sinD: number,
  diskAngle: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number,
  isForeground: boolean
) {
  const maxDiskR = horizonR * 12.0;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 1. 实体连续流态大光幕（快速构建饱满厚重的铜金盘面，杜绝黑色空隙与色块断层）
  if (isForeground) {
    // (1.1) ISCO 核心炽金光幕（半圈柔和过渡）
    const iscoGrd = ctx.createRadialGradient(cx, cy, iscoR * 0.9, cx, cy, horizonR * 3.5);
    iscoGrd.addColorStop(0, "rgba(255, 250, 220, 0.7)");
    iscoGrd.addColorStop(0.3, "rgba(255, 190, 60, 0.5)");
    iscoGrd.addColorStop(0.7, "rgba(235, 110, 25, 0.3)");
    iscoGrd.addColorStop(1, "rgba(160, 45, 10, 0)");

    ctx.fillStyle = iscoGrd;
    ctx.beginPath();
    ctx.ellipse(cx, cy, horizonR * 3.5, horizonR * 3.5 * diskTilt, diskAngle, 0, Math.PI);
    ctx.ellipse(cx, cy, iscoR * 0.95, iscoR * 0.95 * diskTilt, diskAngle, Math.PI, 0, true);
    ctx.fill();

    // (1.2) 主盘区金属铜金与熔岩赭石大光幕
    const mainDiskGrd = ctx.createRadialGradient(cx, cy, horizonR * 2.8, cx, cy, maxDiskR * 0.85);
    mainDiskGrd.addColorStop(0, "rgba(225, 105, 22, 0.35)");
    mainDiskGrd.addColorStop(0.35, "rgba(175, 55, 14, 0.24)");
    mainDiskGrd.addColorStop(0.7, "rgba(110, 25, 6, 0.14)");
    mainDiskGrd.addColorStop(1, "rgba(45, 8, 2, 0)");

    ctx.fillStyle = mainDiskGrd;
    ctx.beginPath();
    ctx.ellipse(cx, cy, maxDiskR * 0.85, maxDiskR * 0.85 * diskTilt, diskAngle, 0, Math.PI);
    ctx.ellipse(cx, cy, horizonR * 2.6, horizonR * 2.6 * diskTilt, diskAngle, Math.PI, 0, true);
    ctx.fill();
  }

  // 2. 批处理绘制 140 条极细对数螺旋流线（按颜色组批量绘制，平滑插值）
  const tierColors = [
    `rgba(255, 248, 215, ${0.42 + mid * 0.2})`, // Tier 0: 白炽超高温
    `rgba(255, 185, 65, ${0.32 + mid * 0.15})`, // Tier 1: 琥珀金
    `rgba(230, 105, 28, ${0.25 + mid * 0.12})`, // Tier 2: 熔岩铜
    `rgba(170, 52, 14, ${0.18 + mid * 0.08})`, // Tier 3: 赭石褐
    `rgba(100, 22, 6, ${0.12 + mid * 0.05})`, // Tier 4: 外缘暗赤
  ];

  for (let tier = 0; tier < 5; tier++) {
    ctx.beginPath();
    let hasPaths = false;

    for (let i = 0; i < filaments.length; i++) {
      const f = filaments[i];
      if (f.tier !== tier) continue;

      const curBaseR = f.baseRadius * (1 + bass * 0.05);
      if (curBaseR < iscoR * 0.95 || curBaseR > maxDiskR) continue;

      const angleStart = rot * (f.speed * 85) + f.angleOffset;
      const steps = 40;
      let started = false;

      for (let s = 0; s <= steps; s++) {
        const prog = s / steps;
        const angle = angleStart + prog * f.length;

        // 对数螺旋半径
        const r = curBaseR * Math.exp(prog * f.spiralK);
        if (r > maxDiskR * 1.08) break;

        // 流体平滑微扰动
        const wave = Math.sin(angle * f.waveFreq + t * 2.0 + f.wavePhase) * (2.2 + bass * 3.5);
        const finalR = r + wave;

        const ex = Math.cos(angle) * finalR;
        const ey = Math.sin(angle) * finalR * diskTilt;
        const px = cx + ex * cosD - ey * sinD;
        const py = cy + ex * sinD + ey * cosD;

        // 3D 深度平滑切分（在边界处自然连续过渡）
        const isInFront = ey >= -horizonR * 0.2;
        if (isForeground === isInFront) {
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
            hasPaths = true;
          } else {
            ctx.lineTo(px, py);
          }
        } else {
          started = false;
        }
      }
    }

    if (hasPaths) {
      ctx.strokeStyle = tierColors[tier];
      ctx.lineWidth = (1.2 + tier * 0.5) * (1 + treble * 0.2); // 极细丝滑流线
      ctx.stroke();
    }
  }

  // 3. ISCO 内边缘白炽高温光环
  if (isForeground) {
    ctx.strokeStyle = "rgba(255, 255, 240, 0.92)";
    ctx.lineWidth = 2.4 + bass * 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, iscoR, iscoR * diskTilt, diskAngle, 0, Math.PI);
    ctx.stroke();
  }
}
