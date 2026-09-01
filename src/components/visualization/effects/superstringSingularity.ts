/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface AccretionStream {
  radiusFactor: number;
  width: number;
  speed: number;
  angleOffset: number;
  noiseFreq: number;
  brightness: number;
  colorMix: number; // 0: 炽白, 0.5: 琥珀金, 1.0: 赤红熔岩
}

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  lineWidth: number;
}

let streams: AccretionStream[] = [];

function initStreams() {
  if (streams.length > 0) return;
  const count = 48;
  for (let i = 0; i < count; i++) {
    const norm = i / (count - 1);
    // 径向分布：内圈密集，外圈平滑发散
    const radiusFactor = 1.35 + Math.pow(norm, 1.3) * 4.2;
    // 开普勒差动自转：内快外慢
    const speed = (0.015 / Math.sqrt(radiusFactor)) * 0.9;
    streams.push({
      radiusFactor,
      width: 1.5 + norm * 4.0,
      speed,
      angleOffset: (i * 137.5 * Math.PI) / 180,
      noiseFreq: 2 + (i % 4),
      brightness: 0.35 + Math.sin(norm * Math.PI) * 0.5,
      colorMix: norm,
    });
  }
}

/**
 * 顶级电影级《星际穿越》真实相对论黑洞（Gargantua Black Hole）
 * - 绝对纯黑施瓦西事件视界（Pitch-Black Horizon），确保中心深邃无光
 * - 完美物理曲率爱因斯坦引力透镜垂直光环（Warped Upper Lensing Arc）
 * - 差动自转开普勒等离子体吸积盘（Keplerian Differential Rotation Disk）
 * - 0 过曝死白，极致精细的黑体辐射温度渐变（炽白 -> 琥珀金 -> 熔岩橙 -> 深赤红）
 * - 0 杂乱毛线，0 散落噪点粒子，纯粹高阶电影级流光
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
  const cx = sw / 2;
  const cy = sh / 2;

  initStreams();

  const speed = params.speed || 1.0;
  const singularityMass = params.singularityMass || 1.0;
  const superstringTension = params.superstringTension || 1.2;
  const coreGlow = params.coreGlow || 1.2;
  const chromaticAberration = params.chromaticAberration || 1.0;
  const burstSensitivity = params.burstSensitivity || 1.1;

  // 1. 音频特征提取与平滑响应
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

  // 状态维护与自转推进
  const rot =
    ((refs.bokeh.current && refs.bokeh.current[0]) || 0) +
    (0.003 + energy * 0.006) * superstringTension;
  if (!refs.bokeh.current) refs.bokeh.current = [];
  refs.bokeh.current[0] = rot;

  if (!refs.shockwaves.current) {
    refs.shockwaves.current = [];
  }
  const shockwaves = refs.shockwaves.current as GravitationalShockwave[];

  if (rawBass > 0.65 && rawBass - bass > 0.22 * burstSensitivity && shockwaves.length < 3) {
    shockwaves.push({
      radius: 65 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.65,
      alpha: 0.6,
      speed: 12 + bass * 16,
      lineWidth: 1.5 + bass * 2.0,
    });
  }

  // 基础物理尺度
  const horizonR = (52 + bass * 14) * singularityMass; // 施瓦西视界半径
  const diskTilt = 0.32; // 吸积盘视角倾斜压缩比
  const iscoR = horizonR * 1.45; // 最内侧稳定圆轨道 (ISCO)
  const maxDiskR = horizonR * 5.4; // 吸积盘外边界

  // --- 2. 纯净深邃宇宙深空背景 (Cosmic Void) ---
  ctx.save();
  ctx.fillStyle = "#010204";
  ctx.fillRect(0, 0, sw, sh);

  // 极微弱的引力红移深空微光（适度克制，绝不过曝）
  const bgGrd = ctx.createRadialGradient(cx, cy, horizonR, cx, cy, maxDiskR * 1.5);
  bgGrd.addColorStop(0, "rgba(255, 140, 40, 0.04)");
  bgGrd.addColorStop(0.3, "rgba(180, 50, 10, 0.025)");
  bgGrd.addColorStop(0.7, "rgba(20, 10, 30, 0.01)");
  bgGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, sw, sh);

  // --- 3. 引力波涟漪光膜 ---
  if (shockwaves.length > 0) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const swItem = shockwaves[i];
      swItem.radius += swItem.speed;
      swItem.alpha *= 0.94;

      if (swItem.alpha < 0.01 || swItem.radius > swItem.maxRadius) {
        shockwaves.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.strokeStyle = `rgba(255, 200, 120, ${swItem.alpha * 0.35})`;
      ctx.lineWidth = swItem.lineWidth;
      ctx.beginPath();
      ctx.ellipse(cx, cy, swItem.radius, swItem.radius * diskTilt, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // --- 4. 【引力透镜】黑洞背面上光拱 (Upper Warped Accretion Arc) ---
  // 吸积盘背侧光线由于黑洞后方引力场向上弯折，垂直环绕黑洞上方
  ctx.save();
  const upperArcOuterR = horizonR * 2.85;
  const upperArcInnerR = horizonR * 1.15;
  const upperCenterY = cy - horizonR * 0.35;

  // 上光拱主体平滑渐变
  const upperGrd = ctx.createRadialGradient(
    cx,
    upperCenterY,
    upperArcInnerR * 0.8,
    cx,
    upperCenterY,
    upperArcOuterR * 1.1
  );
  upperGrd.addColorStop(0, "rgba(255, 255, 250, 0.85)");
  upperGrd.addColorStop(0.2, "rgba(255, 215, 120, 0.7)");
  upperGrd.addColorStop(0.5, "rgba(245, 125, 30, 0.45)");
  upperGrd.addColorStop(0.8, "rgba(160, 40, 10, 0.15)");
  upperGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = upperGrd;
  ctx.beginPath();
  // 仅在上半球优雅展开，并在两端平滑隐入水平吸积盘
  ctx.ellipse(
    cx,
    upperCenterY,
    upperArcOuterR * 0.96,
    upperArcOuterR * 0.95,
    0,
    Math.PI * 0.92,
    Math.PI * 2.08
  );
  ctx.ellipse(
    cx,
    upperCenterY,
    upperArcInnerR * 1.05,
    upperArcInnerR * 1.05,
    0,
    Math.PI * 2.08,
    Math.PI * 0.92,
    true
  );
  ctx.fill();

  // 上光拱内缘高温高亮线 (Inner Lensing Crest)
  ctx.strokeStyle = "rgba(255, 250, 230, 0.8)";
  ctx.lineWidth = 2.0 + bass * 1.5;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    upperCenterY,
    upperArcInnerR * 1.12,
    upperArcInnerR * 1.12,
    0,
    Math.PI * 0.95,
    Math.PI * 2.05
  );
  ctx.stroke();
  ctx.restore();

  // --- 5. 【引力透镜】黑洞背面下光拱 (Lower Warped Accretion Arc) ---
  ctx.save();
  const lowerArcOuterR = horizonR * 2.3;
  const lowerArcInnerR = horizonR * 1.15;
  const lowerCenterY = cy + horizonR * 0.28;

  const lowerGrd = ctx.createRadialGradient(
    cx,
    lowerCenterY,
    lowerArcInnerR * 0.8,
    cx,
    lowerCenterY,
    lowerArcOuterR * 1.05
  );
  lowerGrd.addColorStop(0, "rgba(255, 235, 160, 0.6)");
  lowerGrd.addColorStop(0.3, "rgba(240, 110, 30, 0.35)");
  lowerGrd.addColorStop(0.7, "rgba(140, 30, 10, 0.1)");
  lowerGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = lowerGrd;
  ctx.beginPath();
  ctx.ellipse(cx, lowerCenterY, lowerArcOuterR * 0.92, lowerArcOuterR * 0.72, 0, 0, Math.PI);
  ctx.ellipse(cx, lowerCenterY, lowerArcInnerR * 1.05, lowerArcInnerR * 0.82, 0, Math.PI, 0, true);
  ctx.fill();
  ctx.restore();

  // --- 6. 【水平主吸积盘】开普勒差动流光带 (Differential Keplerian Plasma Bands) ---
  ctx.save();
  for (let i = 0; i < streams.length; i++) {
    const s = streams[i];
    const curR = horizonR * s.radiusFactor;
    if (curR < iscoR * 0.95 || curR > maxDiskR) continue;

    const streamAngle = rot * (s.speed * 80) + s.angleOffset + t;
    const waveAmp = (1.5 + bass * 4.0) * (curR / maxDiskR);
    const waveY = Math.sin(streamAngle * s.noiseFreq) * waveAmp;

    // 沿椭圆分段绘制具备多普勒相对论明暗差的细腻流光带
    const segments = 64;
    ctx.beginPath();

    for (let seg = 0; seg <= segments; seg++) {
      const segAngle = (seg / segments) * Math.PI * 2;
      const r = curR + Math.sin(segAngle * 3 + streamAngle) * waveAmp;
      const px = cx + Math.cos(segAngle) * r;
      const py = cy + Math.sin(segAngle) * r * diskTilt + waveY;

      if (seg === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();

    // 相对论多普勒渐变着色：
    // 左侧（迎面）：白金色/浅金白，适度明亮（绝不过曝）
    // 右侧（背向）：深金橙/深赤红
    const leftX = cx - curR;
    const rightX = cx + curR;
    const streamGrd = ctx.createLinearGradient(leftX, cy, rightX, cy);

    // 计算随距离衰减的 alpha 与颜色
    const distNorm = (curR - iscoR) / (maxDiskR - iscoR);
    const baseAlpha = (0.28 - distNorm * 0.2) * (s.brightness + mid * 0.3) * chromaticAberration;

    if (distNorm < 0.25) {
      // 靠近 ISCO 的白炽超高温区
      streamGrd.addColorStop(0, `rgba(255, 255, 255, ${baseAlpha * 1.3})`);
      streamGrd.addColorStop(0.35, `rgba(255, 230, 140, ${baseAlpha * 1.1})`);
      streamGrd.addColorStop(0.75, `rgba(255, 150, 40, ${baseAlpha * 0.85})`);
      streamGrd.addColorStop(1, `rgba(200, 60, 15, ${baseAlpha * 0.5})`);
    } else if (distNorm < 0.65) {
      // 中层琥珀金区域
      streamGrd.addColorStop(0, `rgba(255, 235, 160, ${baseAlpha * 1.1})`);
      streamGrd.addColorStop(0.4, `rgba(255, 170, 50, ${baseAlpha})`);
      streamGrd.addColorStop(0.8, `rgba(220, 90, 25, ${baseAlpha * 0.7})`);
      streamGrd.addColorStop(1, `rgba(160, 40, 10, ${baseAlpha * 0.4})`);
    } else {
      // 外层熔岩橙赤红区域
      streamGrd.addColorStop(0, `rgba(255, 180, 70, ${baseAlpha})`);
      streamGrd.addColorStop(0.5, `rgba(220, 90, 25, ${baseAlpha * 0.75})`);
      streamGrd.addColorStop(1, `rgba(130, 25, 10, ${baseAlpha * 0.3})`);
    }

    ctx.strokeStyle = streamGrd;
    ctx.lineWidth = s.width * (1 + bass * 0.35);
    ctx.stroke();
  }

  // ISCO 内边缘白炽高温切线 (ISCO Inner High-Temp Ring)
  ctx.strokeStyle = "rgba(255, 250, 220, 0.75)";
  ctx.lineWidth = 2.2 + bass * 1.8;
  ctx.beginPath();
  ctx.ellipse(cx, cy, iscoR, iscoR * diskTilt, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 7. 【核心关键】施瓦西绝对纯黑事件视界暗核 (Absolute Pitch-Black Event Horizon) ---
  // 黑洞视界内部绝对吞噬所有光线，保证中心深邃纯黑、轮廓极其清晰！
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR, 0, Math.PI * 2);
  ctx.fill();

  // 视界边缘极窄的深黑吸收环
  const edgeAbsorbGrd = ctx.createRadialGradient(cx, cy, horizonR * 0.88, cx, cy, horizonR * 1.04);
  edgeAbsorbGrd.addColorStop(0, "rgba(0, 0, 0, 1.0)");
  edgeAbsorbGrd.addColorStop(0.7, "rgba(2, 1, 3, 0.98)");
  edgeAbsorbGrd.addColorStop(1, "rgba(20, 10, 5, 0)");
  ctx.fillStyle = edgeAbsorbGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 1.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 8. 【极细锐利光子球环】(Razor-Sharp 1.5px Photon Sphere Ring) ---
  // 紧贴纯黑视界外缘的极细高能光子环，定义出清晰的黑洞边界
  ctx.save();
  // 外层极薄高斯微光
  ctx.strokeStyle = "rgba(255, 200, 90, 0.65)";
  ctx.lineWidth = 2.8 + bass * 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 1.01, 0, Math.PI * 2);
  ctx.stroke();

  // 核心极细 1.2px 白炽光子环
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 1.005, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 9. 【黑洞前景下半弧吸积盘覆盖】(Foreground Disk Arc) ---
  // 吸积盘的前半部分横跨在黑洞视界的前下方，形成完美的 3D 遮挡前后纵深
  ctx.save();
  const fgGrd = ctx.createLinearGradient(cx - iscoR * 2.2, cy, cx + iscoR * 2.2, cy);
  fgGrd.addColorStop(0, "rgba(255, 255, 240, 0.65)");
  fgGrd.addColorStop(0.35, "rgba(255, 200, 90, 0.55)");
  fgGrd.addColorStop(0.75, "rgba(240, 110, 30, 0.35)");
  fgGrd.addColorStop(1, "rgba(160, 40, 10, 0.15)");

  ctx.fillStyle = fgGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, horizonR * 2.4, horizonR * 2.4 * diskTilt, 0, 0, Math.PI);
  ctx.ellipse(cx, cy, horizonR * 1.02, horizonR * 1.02 * diskTilt, 0, Math.PI, 0, true);
  ctx.fill();
  ctx.restore();

  // --- 10. 【电影级克制横向微光耀斑】(Subtle Anamorphic Widescreen Streak) ---
  ctx.save();
  const flareWidth = Math.min(sw * 0.95, (480 + bass * 180 + mid * 120) * coreGlow);
  const flareHeight = 12 + bass * 8;
  const flareGrd = ctx.createLinearGradient(cx - flareWidth / 2, cy, cx + flareWidth / 2, cy);
  flareGrd.addColorStop(0, "rgba(255, 180, 80, 0)");
  flareGrd.addColorStop(0.25, "rgba(255, 210, 120, 0.12)");
  flareGrd.addColorStop(0.48, "rgba(255, 255, 255, 0.45)");
  flareGrd.addColorStop(0.5, "rgba(255, 255, 255, 0.7)");
  flareGrd.addColorStop(0.52, "rgba(255, 255, 255, 0.45)");
  flareGrd.addColorStop(0.75, "rgba(255, 160, 60, 0.12)");
  flareGrd.addColorStop(1, "rgba(255, 100, 30, 0)");

  ctx.fillStyle = flareGrd;
  ctx.fillRect(cx - flareWidth / 2, cy - flareHeight / 2, flareWidth, flareHeight);
  ctx.restore();
}
