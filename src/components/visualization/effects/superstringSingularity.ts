/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface JetSmokyStrand {
  phase: number;
  radiusBase: number;
  radiusExp: number;
  speed: number;
  width: number;
  alpha: number;
  colorType: number; // 0: 亮白, 1: 幽蓝, 2: 冰青
  freq: number;
}

interface AccretionGasBand {
  baseRadius: number;
  armAngle: number;
  length: number;
  speed: number;
  spiralRate: number;
  width: number;
  alpha: number;
  colorIndex: number; // 0: 白炽高温, 1: 琥珀金, 2: 铜红, 3: 深赤褐, 4: 烟黑
  waveFreq: number;
  wavePhase: number;
}

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

let gasBands: AccretionGasBand[] = [];
let jetStrands: JetSmokyStrand[] = [];

function initAstrophysicsData() {
  if (gasBands.length > 0) return;

  // 1. 初始化吸积盘 180 条宽幅连续流体烟霞带（超密重叠，形成完整实体流态盘面）
  const bandCount = 180;
  for (let i = 0; i < bandCount; i++) {
    const frac = i / (bandCount - 1);
    const baseRadius = 45 + Math.pow(frac, 1.25) * 850;
    const speed = (0.01 / Math.sqrt(Math.max(1, baseRadius * 0.02))) * 0.8;

    let colorIndex = 1;
    if (frac < 0.12) colorIndex = 0;
    else if (frac < 0.42) colorIndex = 1;
    else if (frac < 0.72) colorIndex = 2;
    else if (frac < 0.92) colorIndex = 3;
    else colorIndex = 4;

    gasBands.push({
      baseRadius,
      armAngle: (i * 137.508 * Math.PI) / 180,
      length: Math.PI * (2.2 + Math.random() * 1.6),
      speed,
      spiralRate: 0.14 + (i % 6) * 0.015,
      width: 6.0 + frac * 28.0,
      alpha: 0.08 + Math.sin(frac * Math.PI) * 0.14,
      colorIndex,
      waveFreq: 2 + (i % 5),
      wavePhase: Math.random() * Math.PI * 2,
    });
  }

  // 2. 初始化极向相对论喷流 18 条多重缠绕半透明幽蓝烟雾螺旋束
  jetStrands = [];
  const strandCount = 18;
  for (let i = 0; i < strandCount; i++) {
    const frac = i / strandCount;
    jetStrands.push({
      phase: frac * Math.PI * 2,
      radiusBase: 8 + (i % 3) * 6,
      radiusExp: 32 + (i % 4) * 12,
      speed: 0.018 + (i % 3) * 0.005,
      width: 4.0 + (i % 4) * 3.5,
      alpha: 0.12 + Math.random() * 0.15,
      colorType: i % 3,
      freq: 3.5 + (i % 3) * 1.5,
    });
  }
}

/**
 * 1:1 像素级复刻天体物理黑洞与相对论极向幽蓝等离子体喷流（Gargantua Black Hole & Jet）
 * - 48° 俯视倾斜三维场景，吸积盘铺满右下方广袤空间
 * - 幽蓝/白炽半透明双螺旋龙卷风态相对论极向喷流（Helical Polar Synchrotron Jet）
 * - 左上方倾斜银河系边缘盘面与星芒背景（Edge-on Milky Way Galaxy Disk）
 * - 纯黑 3D 施瓦西视界球体与爱因斯坦引力透镜弯月环
 * - 实体连续流态铜金-赭石-深褐多层黑体辐射吸积盘（Volumetric Accretion Disk）
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

  // 黑洞中心构图：右下方偏置 (约 53% W, 59% H)
  const cx = sw * 0.53;
  const cy = sh * 0.59;

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
    (0.0022 + energy * 0.005) * superstringTension;
  if (!refs.bokeh.current) refs.bokeh.current = [];
  refs.bokeh.current[0] = rot;

  if (!refs.shockwaves.current) {
    refs.shockwaves.current = [];
  }
  const shockwaves = refs.shockwaves.current as GravitationalShockwave[];

  if (rawBass > 0.66 && rawBass - bass > 0.22 * burstSensitivity && shockwaves.length < 3) {
    shockwaves.push({
      radius: 48 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.85,
      alpha: 0.6,
      speed: 15 + bass * 18,
    });
  }

  // 几何透视参数（俯视 48° 倾斜，吸积盘倾角压缩比 0.43，主轴倾角 -28°）
  const horizonR = (48 + bass * 12) * singularityMass;
  const diskTilt = 0.43;
  const diskRotationAngle = -0.48; // -28°
  const cosD = Math.cos(diskRotationAngle);
  const sinD = Math.sin(diskRotationAngle);

  // --- 2. 深邃深空暗黑宇宙底色 ---
  ctx.save();
  ctx.fillStyle = "#0a0302";
  ctx.fillRect(0, 0, sw, sh);

  const spaceAmbientGrd = ctx.createRadialGradient(
    cx + sw * 0.1,
    cy + sh * 0.1,
    horizonR * 2.0,
    cx,
    cy,
    Math.max(sw, sh) * 0.95
  );
  spaceAmbientGrd.addColorStop(0, "rgba(70, 20, 8, 0.45)");
  spaceAmbientGrd.addColorStop(0.35, "rgba(40, 10, 4, 0.35)");
  spaceAmbientGrd.addColorStop(0.7, "rgba(18, 4, 2, 0.25)");
  spaceAmbientGrd.addColorStop(1, "rgba(5, 1, 1, 0.9)");
  ctx.fillStyle = spaceAmbientGrd;
  ctx.fillRect(0, 0, sw, sh);

  // --- 3. 左上方倾斜银河系盘面与星光 ---
  const galaxyX = sw * 0.14;
  const galaxyY = sh * 0.13;

  ctx.save();
  const galaxyHalo = ctx.createRadialGradient(galaxyX, galaxyY, 10, galaxyX, galaxyY, sw * 0.42);
  galaxyHalo.addColorStop(0, "rgba(225, 240, 255, 0.6)");
  galaxyHalo.addColorStop(0.18, "rgba(170, 210, 255, 0.38)");
  galaxyHalo.addColorStop(0.45, "rgba(90, 140, 210, 0.16)");
  galaxyHalo.addColorStop(0.75, "rgba(35, 60, 110, 0.05)");
  galaxyHalo.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = galaxyHalo;
  ctx.beginPath();
  ctx.ellipse(galaxyX, galaxyY, sw * 0.35, sh * 0.15, -0.62, 0, Math.PI * 2);
  ctx.fill();

  const galaxyCore = ctx.createLinearGradient(
    galaxyX - sw * 0.25,
    galaxyY + sh * 0.12,
    galaxyX + sw * 0.25,
    galaxyY - sh * 0.12
  );
  galaxyCore.addColorStop(0, "rgba(200, 230, 255, 0)");
  galaxyCore.addColorStop(0.35, "rgba(240, 248, 255, 0.45)");
  galaxyCore.addColorStop(0.5, "rgba(255, 255, 255, 0.85)");
  galaxyCore.addColorStop(0.65, "rgba(240, 248, 255, 0.45)");
  galaxyCore.addColorStop(1, "rgba(200, 230, 255, 0)");

  ctx.fillStyle = galaxyCore;
  ctx.beginPath();
  ctx.ellipse(galaxyX, galaxyY, sw * 0.28, 14, -0.62, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(20, 8, 4, 0.45)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(galaxyX, galaxyY + 2, sw * 0.26, 4, -0.62, 0, Math.PI * 2);
  ctx.stroke();

  for (let s = 0; s < 48; s++) {
    const starX = galaxyX + Math.sin(s * 87.3 + t * 0.05) * sw * 0.22;
    const starY = galaxyY + Math.cos(s * 43.7) * sh * 0.12;
    const starAlpha = 0.25 + (Math.sin(t * 2.5 + s) * 0.5 + 0.5) * 0.55;
    ctx.fillStyle = `rgba(245, 250, 255, ${starAlpha})`;
    ctx.beginPath();
    ctx.arc(starX, starY, s % 4 === 0 ? 1.6 : 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- 4. 【吸积盘后半部分】---
  ctx.save();
  renderVolumetricDisk(
    ctx,
    cx,
    cy,
    horizonR,
    diskTilt,
    cosD,
    sinD,
    diskRotationAngle,
    rot,
    t,
    bass,
    mid,
    treble,
    false
  );
  ctx.restore();

  // --- 5. 【爱因斯坦引力透镜弯月光拱】---
  ctx.save();
  const lensR = horizonR * 1.36;
  const lensGrd = ctx.createLinearGradient(
    cx - lensR * 1.1,
    cy - lensR * 0.85,
    cx + lensR * 0.8,
    cy + lensR * 0.6
  );
  lensGrd.addColorStop(0, "rgba(255, 255, 245, 0.95)");
  lensGrd.addColorStop(0.25, "rgba(255, 215, 110, 0.88)");
  lensGrd.addColorStop(0.65, "rgba(240, 120, 28, 0.55)");
  lensGrd.addColorStop(1, "rgba(170, 35, 8, 0.1)");

  ctx.strokeStyle = lensGrd;
  ctx.lineWidth = 4.2 + bass * 2.5;
  ctx.shadowColor = "#FFA825";
  ctx.shadowBlur = 20 * coreGlow;
  ctx.beginPath();
  ctx.ellipse(
    cx - 2,
    cy - horizonR * 0.14,
    lensR * 1.04,
    lensR * 0.74,
    diskRotationAngle,
    Math.PI * 0.82,
    Math.PI * 2.18
  );
  ctx.stroke();
  ctx.restore();

  // --- 6. 【3D 纯黑施瓦西事件视界球体】---
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR, 0, Math.PI * 2);
  ctx.fill();

  const horizonAbsorbGrd = ctx.createRadialGradient(
    cx,
    cy,
    horizonR * 0.86,
    cx,
    cy,
    horizonR * 1.04
  );
  horizonAbsorbGrd.addColorStop(0, "rgba(0, 0, 0, 1.0)");
  horizonAbsorbGrd.addColorStop(0.8, "rgba(2, 1, 3, 0.96)");
  horizonAbsorbGrd.addColorStop(1, "rgba(255, 160, 45, 0)");
  ctx.fillStyle = horizonAbsorbGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 1.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.lineWidth = 1.2 + bass * 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 7. 【吸积盘前半部分】---
  ctx.save();
  renderVolumetricDisk(
    ctx,
    cx,
    cy,
    horizonR,
    diskTilt,
    cosD,
    sinD,
    diskRotationAngle,
    rot,
    t,
    bass,
    mid,
    treble,
    true
  );
  ctx.restore();

  // --- 8. 【相对论极向幽蓝/白炽双螺旋等离子体喷流】---
  ctx.save();
  const jetAngle = -2.13;
  const jetCos = Math.cos(jetAngle);
  const jetSin = Math.sin(jetAngle);
  const jetPerpX = -jetSin;
  const jetPerpY = jetCos;

  const jetLength = Math.min(sw, sh) * (0.92 + bass * 0.22);
  const jetBaseRadius = horizonR * 0.42;

  // 喷流发光锥
  const jetConeGrd = ctx.createLinearGradient(
    cx,
    cy,
    cx + jetCos * jetLength,
    cy + jetSin * jetLength
  );
  jetConeGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  jetConeGrd.addColorStop(0.06, "rgba(195, 235, 255, 0.85)");
  jetConeGrd.addColorStop(0.22, "rgba(110, 195, 255, 0.42)");
  jetConeGrd.addColorStop(0.55, "rgba(50, 130, 240, 0.16)");
  jetConeGrd.addColorStop(1, "rgba(20, 60, 180, 0)");

  ctx.fillStyle = jetConeGrd;
  ctx.beginPath();
  const jetTipWidth = 56 + bass * 35;
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

  // 核心白炽光针
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 2.8 + bass * 2.2;
  ctx.shadowColor = "#80D8FF";
  ctx.shadowBlur = 18 * coreGlow;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + jetCos * (jetLength * 0.75), cy + jetSin * (jetLength * 0.75));
  ctx.stroke();

  // 18 条相对论双螺旋烟雾状磁力等离子流
  for (let h = 0; h < jetStrands.length; h++) {
    const strand = jetStrands[h];
    const steps = 36;
    const pts: { x: number; y: number }[] = [];

    for (let s = 0; s <= steps; s++) {
      const prog = s / steps;
      const curDist = prog * jetLength;
      const helixRadius =
        (strand.radiusBase + Math.pow(prog, 1.1) * strand.radiusExp) * (1 + bass * 0.25);
      const helixAngle = prog * Math.PI * strand.freq + t * (strand.speed * 85) + strand.phase;

      const offsetX = jetPerpX * (Math.sin(helixAngle) * helixRadius);
      const offsetY = jetPerpY * (Math.sin(helixAngle) * helixRadius);

      const px = cx + jetCos * curDist + offsetX;
      const py = cy + jetSin * curDist + offsetY;
      pts.push({ x: px, y: py });
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let p = 1; p < pts.length - 1; p++) {
      const mx = (pts[p].x + pts[p + 1].x) / 2;
      const my = (pts[p].y + pts[p + 1].y) / 2;
      ctx.quadraticCurveTo(pts[p].x, pts[p].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

    const strandGrd = ctx.createLinearGradient(
      cx,
      cy,
      cx + jetCos * jetLength,
      cy + jetSin * jetLength
    );

    if (strand.colorType === 0) {
      strandGrd.addColorStop(0, `rgba(255, 255, 255, ${strand.alpha * 1.5})`);
      strandGrd.addColorStop(0.25, `rgba(220, 248, 255, ${strand.alpha * 1.2})`);
      strandGrd.addColorStop(0.7, `rgba(110, 200, 255, ${strand.alpha * 0.6})`);
      strandGrd.addColorStop(1, "rgba(50, 120, 240, 0)");
    } else if (strand.colorType === 1) {
      strandGrd.addColorStop(0, `rgba(230, 245, 255, ${strand.alpha * 1.3})`);
      strandGrd.addColorStop(0.3, `rgba(120, 215, 255, ${strand.alpha * 1.1})`);
      strandGrd.addColorStop(0.75, `rgba(60, 150, 245, ${strand.alpha * 0.5})`);
      strandGrd.addColorStop(1, "rgba(30, 80, 200, 0)");
    } else {
      strandGrd.addColorStop(0, `rgba(245, 255, 255, ${strand.alpha * 1.2})`);
      strandGrd.addColorStop(0.35, `rgba(140, 245, 235, ${strand.alpha * 1.0})`);
      strandGrd.addColorStop(0.8, `rgba(70, 180, 230, ${strand.alpha * 0.4})`);
      strandGrd.addColorStop(1, "rgba(30, 90, 180, 0)");
    }

    ctx.strokeStyle = strandGrd;
    ctx.lineWidth = strand.width * (1 + treble * 0.35);
    ctx.stroke();
  }

  // 喷流基底耀斑
  const baseFlareR = horizonR * 0.48 * (1 + bass * 0.4);
  const baseGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseFlareR);
  baseGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  baseGrd.addColorStop(0.4, "rgba(210, 245, 255, 0.9)");
  baseGrd.addColorStop(0.8, "rgba(100, 190, 255, 0.4)");
  baseGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = baseGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, baseFlareR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 9. 引力波时空曲率涟漪 ---
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

      ctx.strokeStyle = `rgba(255, 195, 110, ${swItem.alpha * 0.3})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
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
 * 绘制高密度实体流态对数螺旋吸积盘（通过大面积多层柔光笔刷重叠，呈现致密流体感）
 */
function renderVolumetricDisk(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  diskTilt: number,
  cosD: number,
  sinD: number,
  rotAngle: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number,
  isForeground: boolean
) {
  const iscoR = horizonR * 1.32;
  const maxR = horizonR * 18.0;

  // 1. 底层实体等离子体大光幕
  if (isForeground) {
    const fgBaseGrd = ctx.createRadialGradient(cx, cy, iscoR * 1.1, cx, cy, horizonR * 6.5);
    fgBaseGrd.addColorStop(0, "rgba(255, 240, 180, 0.4)");
    fgBaseGrd.addColorStop(0.2, "rgba(245, 140, 35, 0.32)");
    fgBaseGrd.addColorStop(0.55, "rgba(180, 65, 15, 0.2)");
    fgBaseGrd.addColorStop(0.85, "rgba(90, 20, 6, 0.1)");
    fgBaseGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = fgBaseGrd;
    ctx.beginPath();
    for (let a = 0; a <= 36; a++) {
      const rad = (a / 36) * Math.PI;
      const ex = Math.cos(rad) * (horizonR * 8.5);
      const ey = Math.sin(rad) * (horizonR * 8.5) * diskTilt;
      const px = cx + ex * cosD - ey * sinD;
      const py = cy + ex * sinD + ey * cosD;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let a = 36; a >= 0; a--) {
      const rad = (a / 36) * Math.PI;
      const ex = Math.cos(rad) * (iscoR * 0.98);
      const ey = Math.sin(rad) * (iscoR * 0.98) * diskTilt;
      const px = cx + ex * cosD - ey * sinD;
      const py = cy + ex * sinD + ey * cosD;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 2. 绘制 180 条宽幅对数螺旋流霞带
  for (let i = 0; i < gasBands.length; i++) {
    const band = gasBands[i];
    const curBaseR = band.baseRadius * (1 + bass * 0.06);

    if (curBaseR < iscoR * 0.95 || curBaseR > maxR) continue;

    const angleStart = rot * (band.speed * 85) + band.armAngle;
    const steps = 42;
    const pts: { x: number; y: number; alpha: number }[] = [];

    for (let s = 0; s <= steps; s++) {
      const prog = s / steps;
      const angle = angleStart + prog * band.length;

      const r = curBaseR * Math.exp(prog * band.spiralRate);
      if (r > maxR * 1.15) break;

      const waveDisp =
        Math.sin(angle * band.waveFreq + t * 1.8 + band.wavePhase) * (3.0 + bass * 5.0);
      const finalR = r + waveDisp;

      const ex = Math.cos(angle) * finalR;
      const ey = Math.sin(angle) * finalR * diskTilt;
      const px = cx + ex * cosD - ey * sinD;
      const py = cy + ex * sinD + ey * cosD;

      const isInFront = ey >= -horizonR * 0.22;

      if (isForeground === isInFront) {
        const distRatio = (finalR - iscoR) / (horizonR * 7.5);
        const alpha =
          band.alpha *
          (1 - Math.min(1, Math.max(0, distRatio * 0.75))) *
          (isForeground ? 1.0 : 0.75) *
          (1 + mid * 0.3);

        pts.push({ x: px, y: py, alpha });
      }
    }

    if (pts.length < 2) continue;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let p = 1; p < pts.length; p++) {
      ctx.lineTo(pts[p].x, pts[p].y);
    }

    const startPt = pts[0];
    const endPt = pts[pts.length - 1];
    const strokeGrd = ctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);

    if (band.colorIndex === 0) {
      strokeGrd.addColorStop(0, `rgba(255, 255, 245, ${pts[0].alpha * 1.4})`);
      strokeGrd.addColorStop(0.3, `rgba(255, 228, 140, ${pts[0].alpha * 1.2})`);
      strokeGrd.addColorStop(0.7, `rgba(255, 165, 50, ${pts[0].alpha * 0.9})`);
      strokeGrd.addColorStop(1, `rgba(215, 85, 22, ${pts[pts.length - 1].alpha * 0.5})`);
    } else if (band.colorIndex === 1) {
      strokeGrd.addColorStop(0, `rgba(255, 235, 165, ${pts[0].alpha * 1.2})`);
      strokeGrd.addColorStop(0.35, `rgba(248, 155, 48, ${pts[0].alpha * 1.05})`);
      strokeGrd.addColorStop(0.75, `rgba(205, 90, 26, ${pts[0].alpha * 0.8})`);
      strokeGrd.addColorStop(1, `rgba(155, 48, 14, ${pts[pts.length - 1].alpha * 0.45})`);
    } else if (band.colorIndex === 2) {
      strokeGrd.addColorStop(0, `rgba(245, 150, 48, ${pts[0].alpha * 1.05})`);
      strokeGrd.addColorStop(0.45, `rgba(200, 80, 22, ${pts[0].alpha * 0.85})`);
      strokeGrd.addColorStop(0.85, `rgba(140, 40, 12, ${pts[0].alpha * 0.55})`);
      strokeGrd.addColorStop(1, `rgba(85, 20, 6, ${pts[pts.length - 1].alpha * 0.28})`);
    } else if (band.colorIndex === 3) {
      strokeGrd.addColorStop(0, `rgba(190, 70, 22, ${pts[0].alpha * 0.85})`);
      strokeGrd.addColorStop(0.5, `rgba(130, 36, 12, ${pts[0].alpha * 0.6})`);
      strokeGrd.addColorStop(1, `rgba(60, 12, 4, ${pts[pts.length - 1].alpha * 0.2})`);
    } else {
      strokeGrd.addColorStop(0, `rgba(140, 40, 12, ${pts[0].alpha * 0.6})`);
      strokeGrd.addColorStop(0.5, `rgba(80, 18, 6, ${pts[0].alpha * 0.35})`);
      strokeGrd.addColorStop(1, `rgba(30, 6, 2, ${pts[pts.length - 1].alpha * 0.1})`);
    }

    ctx.strokeStyle = strokeGrd;
    ctx.lineWidth = band.width * (1 + treble * 0.3);
    ctx.stroke();
  }

  // 3. ISCO 内边缘白炽高温流光环
  if (isForeground) {
    ctx.strokeStyle = "rgba(255, 252, 235, 0.85)";
    ctx.lineWidth = 3.2 + bass * 2.0;
    ctx.shadowColor = "#FFC450";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.ellipse(cx, cy, iscoR, iscoR * diskTilt, rotAngle, 0, Math.PI);
    ctx.stroke();
  }
}
