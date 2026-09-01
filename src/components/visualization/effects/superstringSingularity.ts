/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  lineWidth: number;
}

let cachedAnamorphicSprite: HTMLCanvasElement | null = null;
let cachedPhotonRingSprite: HTMLCanvasElement | null = null;
let cachedCoreHaloSprite: HTMLCanvasElement | null = null;
let cachedUpperLensingSprite: HTMLCanvasElement | null = null;

function createRadialGlowSprite(
  size: number,
  colorStops: [number, string][]
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ctx.createRadialGradient !== "function") return null;

    const center = size / 2;
    const grd = ctx.createRadialGradient(center, center, 0, center, center, center);
    if (!grd) return null;
    colorStops.forEach(([stop, color]) => grd.addColorStop(stop, color));

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    return canvas;
  } catch {
    return null;
  }
}

function createAnamorphicFlareSprite(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const cx = width / 2;
    const cy = height / 2;

    const hGrd = ctx.createLinearGradient(0, cy, width, cy);
    hGrd.addColorStop(0, "rgba(70, 170, 255, 0)");
    hGrd.addColorStop(0.18, "rgba(90, 210, 255, 0.2)");
    hGrd.addColorStop(0.35, "rgba(255, 220, 130, 0.45)");
    hGrd.addColorStop(0.48, "rgba(255, 250, 240, 0.95)");
    hGrd.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
    hGrd.addColorStop(0.52, "rgba(255, 250, 240, 0.95)");
    hGrd.addColorStop(0.65, "rgba(255, 180, 70, 0.45)");
    hGrd.addColorStop(0.82, "rgba(255, 100, 30, 0.15)");
    hGrd.addColorStop(1, "rgba(255, 60, 10, 0)");

    const vGrd = ctx.createLinearGradient(cx, 0, cx, height);
    vGrd.addColorStop(0, "rgba(255, 255, 255, 0)");
    vGrd.addColorStop(0.5, "rgba(255, 255, 255, 1)");
    vGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = hGrd;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = vGrd;
    ctx.fillRect(0, 0, width, height);

    return canvas;
  } catch {
    return null;
  }
}

function initSprites() {
  if (typeof document === "undefined") return;
  if (!cachedAnamorphicSprite) {
    cachedAnamorphicSprite = createAnamorphicFlareSprite(1200, 64);
  }
  if (!cachedPhotonRingSprite) {
    cachedPhotonRingSprite = createRadialGlowSprite(280, [
      [0, "rgba(255, 255, 255, 1.0)"],
      [0.18, "rgba(255, 235, 190, 0.95)"],
      [0.35, "rgba(255, 160, 50, 0.6)"],
      [0.6, "rgba(220, 80, 20, 0.25)"],
      [0.85, "rgba(80, 160, 255, 0.08)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
  }
  if (!cachedCoreHaloSprite) {
    cachedCoreHaloSprite = createRadialGlowSprite(512, [
      [0, "rgba(255, 220, 120, 0.85)"],
      [0.22, "rgba(255, 140, 40, 0.5)"],
      [0.5, "rgba(200, 60, 15, 0.2)"],
      [0.78, "rgba(60, 100, 220, 0.06)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
  }
  if (!cachedUpperLensingSprite) {
    cachedUpperLensingSprite = createRadialGlowSprite(512, [
      [0, "rgba(255, 255, 240, 1.0)"],
      [0.25, "rgba(255, 190, 75, 0.8)"],
      [0.55, "rgba(235, 95, 25, 0.4)"],
      [0.8, "rgba(140, 30, 10, 0.12)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
  }
}

/**
 * 电影级《星际穿越》卡冈图雅真实相对论黑洞模拟 (Gargantua General Relativity Black Hole)
 * - 纯净连续发光等离子吸积盘 (Volumetric Incandescent Plasma Fluid Disk)
 * - 爱因斯坦弯曲双光环引力透镜 (Warped Lensing Halo Arcs)
 * - 相对论多普勒辐射不对称增强 (Doppler Beaming - Left Bright Blue-White, Right Dark Amber-Red)
 * - 纯黑施瓦西事件视界暗核 (Pure Absolute Pitch-Black Event Horizon)
 * - 1.8px 极细高亮光子球层 (Razor-sharp Photon Sphere Ring)
 * - 0 杂乱线条，0 噪点粒子，纯粹电影级流体光晕
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

  initSprites();

  const speed = params.speed || 1.0;
  const singularityMass = params.singularityMass || 1.0;
  const coreGlow = params.coreGlow || 1.5;
  const chromaticAberration = params.chromaticAberration || 1.35;
  const burstSensitivity = params.burstSensitivity || 1.1;

  // --- 1. 音频特征提取与平滑响应 ---
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

  // 旋转自转角累加
  const rot =
    ((refs.bokeh.current && refs.bokeh.current[0]) || 0) +
    (0.0035 + energy * 0.008) * (params.superstringTension || 1.2);
  if (!refs.bokeh.current) refs.bokeh.current = [];
  refs.bokeh.current[0] = rot;

  if (!refs.shockwaves.current) {
    refs.shockwaves.current = [];
  }
  const shockwaves = refs.shockwaves.current as GravitationalShockwave[];

  // 低音重击生成引力波时空曲率光膜
  if (rawBass > 0.62 && rawBass - bass > 0.22 * burstSensitivity && shockwaves.length < 4) {
    shockwaves.push({
      radius: 50 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.72,
      alpha: 0.95,
      speed: 15 + bass * 22,
      lineWidth: 2.2 + bass * 2.8,
    });
  }

  // --- 2. 深邃深空暗黑宇宙底色与引力透镜微光 ---
  ctx.save();
  ctx.fillStyle = "#010204";
  ctx.fillRect(0, 0, sw, sh);

  ctx.globalCompositeOperation = "screen";
  const maxDim = Math.max(sw, sh);
  const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDim * 0.8);
  bgGrd.addColorStop(0, `rgba(255, 160, 45, ${(0.08 + bass * 0.12) * chromaticAberration})`);
  bgGrd.addColorStop(0.25, `rgba(210, 75, 20, ${0.05 + mid * 0.06})`);
  bgGrd.addColorStop(0.55, `rgba(110, 30, 150, ${0.03 + mid * 0.03})`);
  bgGrd.addColorStop(0.8, `rgba(20, 80, 180, ${0.02 + treble * 0.03})`);
  bgGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, sw, sh);
  ctx.restore();

  // --- 3. 引力波时空震颤光膜 ---
  if (shockwaves.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const swItem = shockwaves[i];
      swItem.radius += swItem.speed;
      swItem.alpha *= 0.935;

      if (swItem.alpha < 0.01 || swItem.radius > swItem.maxRadius) {
        shockwaves.splice(i, 1);
        continue;
      }

      const ringProgress = swItem.radius / swItem.maxRadius;
      const ringAlpha = swItem.alpha * (1 - ringProgress * 0.6);

      ctx.strokeStyle = `rgba(255, 220, 140, ${ringAlpha * 0.8})`;
      ctx.lineWidth = swItem.lineWidth;
      ctx.beginPath();
      ctx.ellipse(cx, cy, swItem.radius, swItem.radius * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(80, 170, 255, ${ringAlpha * 0.4})`;
      ctx.lineWidth = swItem.lineWidth * 0.6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, swItem.radius * 0.93, swItem.radius * 0.93 * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 基础物理尺度
  const horizonRadius = (42 + bass * 18) * singularityMass; // 施瓦西半径
  const diskTilt = 0.38; // 约 35° 倾角

  // --- 4. 爱因斯坦引力透镜弯曲光环：上部主光环 (Upper Warped Accretion Halo) ---
  // 被黑洞强大引力弯曲到黑洞上方的吸积盘背面光线
  const upperRadiusX = (165 + bass * 45) * singularityMass;
  const upperRadiusY = upperRadiusX * 0.92;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // 上光环多层流体发光
  const upperHaloGrd = ctx.createRadialGradient(
    cx,
    cy - upperRadiusY * 0.38,
    horizonRadius * 0.7,
    cx,
    cy - upperRadiusY * 0.38,
    upperRadiusX * 1.55
  );
  upperHaloGrd.addColorStop(
    0,
    `rgba(255, 255, 245, ${(0.96 + bass * 0.15) * chromaticAberration})`
  );
  upperHaloGrd.addColorStop(0.18, `rgba(255, 215, 110, ${0.85 + mid * 0.25})`);
  upperHaloGrd.addColorStop(0.42, `rgba(255, 130, 35, ${0.55 + mid * 0.2})`);
  upperHaloGrd.addColorStop(0.72, "rgba(180, 45, 10, 0.2)");
  upperHaloGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = upperHaloGrd;
  ctx.beginPath();
  // 绘制饱满的上部弯曲光弧
  ctx.ellipse(
    cx,
    cy - upperRadiusY * 0.42,
    upperRadiusX * 1.28,
    upperRadiusY * 0.98,
    0,
    Math.PI * 0.88,
    Math.PI * 2.12
  );
  ctx.fill();

  // 上光环内缘白炽高光带 (Inner Hot Lensing Crest)
  ctx.strokeStyle = "rgba(255, 250, 220, 0.95)";
  ctx.lineWidth = 3.5 + bass * 2.5;
  ctx.shadowColor = "#FFA834";
  ctx.shadowBlur = 24 * coreGlow;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy - upperRadiusY * 0.42,
    upperRadiusX * 0.96,
    upperRadiusY * 0.78,
    0,
    Math.PI * 0.92,
    Math.PI * 2.08
  );
  ctx.stroke();

  // --- 5. 爱因斯坦引力透镜弯曲光环：下部副光环 (Lower Warped Accretion Halo) ---
  const lowerRadiusX = (145 + bass * 38) * singularityMass;
  const lowerRadiusY = lowerRadiusX * 0.72;

  const lowerHaloGrd = ctx.createRadialGradient(
    cx,
    cy + lowerRadiusY * 0.38,
    horizonRadius * 0.65,
    cx,
    cy + lowerRadiusY * 0.38,
    lowerRadiusX * 1.4
  );
  lowerHaloGrd.addColorStop(0, `rgba(255, 235, 180, ${(0.78 + bass * 0.2) * chromaticAberration})`);
  lowerHaloGrd.addColorStop(0.25, `rgba(255, 150, 45, ${0.5 + mid * 0.2})`);
  lowerHaloGrd.addColorStop(0.65, "rgba(180, 50, 15, 0.18)");
  lowerHaloGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = lowerHaloGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy + lowerRadiusY * 0.4, lowerRadiusX * 1.2, lowerRadiusY * 0.82, 0, 0, Math.PI);
  ctx.fill();

  ctx.restore();

  // --- 6. 前景连续发光等离子吸积盘 (Volumetric Incandescent Foreground Accretion Disk) ---
  // 横跨黑洞前方的炽热等离子体主盘，具有真实的多普勒相对论辐射增强（左亮白右暗红）
  const diskOuterR = (480 + bass * 120 + mid * 80) * singularityMass;
  const diskInnerR = horizonRadius * 1.28;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // 6.1 主吸积盘多层热流体渐变光幕 (Multi-layered Continuous Plasma Ribbons)
  const layerCount = 6;
  for (let l = 0; l < layerCount; l++) {
    const layerFrac = l / (layerCount - 1);
    const curInnerR = diskInnerR + (diskOuterR - diskInnerR) * (layerFrac * 0.55);
    const curOuterR = curInnerR + (diskOuterR - diskInnerR) * 0.45;
    const waveNoise = Math.sin(rot * 2 + l * 1.2 + t) * (8 + bass * 16);

    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      curOuterR + waveNoise,
      (curOuterR + waveNoise) * diskTilt,
      0,
      0,
      Math.PI * 2
    );
    ctx.ellipse(
      cx,
      cy,
      curInnerR - waveNoise * 0.5,
      (curInnerR - waveNoise * 0.5) * diskTilt,
      0,
      0,
      Math.PI * 2,
      true
    );

    // 相对论多普勒渐变：左侧（迎面运动）极亮白蓝白，右侧（背向运动）深邃暗金赤红
    const diskGrd = ctx.createLinearGradient(cx - curOuterR, cy, cx + curOuterR, cy);
    diskGrd.addColorStop(
      0,
      `rgba(100, 210, 255, ${(0.85 - layerFrac * 0.35) * chromaticAberration})`
    );
    diskGrd.addColorStop(
      0.28,
      `rgba(255, 255, 245, ${(0.98 - layerFrac * 0.3) * chromaticAberration})`
    );
    diskGrd.addColorStop(0.48, `rgba(255, 210, 95, ${0.85 - layerFrac * 0.35})`);
    diskGrd.addColorStop(0.72, `rgba(240, 110, 30, ${0.55 - layerFrac * 0.3})`);
    diskGrd.addColorStop(1, `rgba(160, 30, 10, ${0.25 - layerFrac * 0.2})`);

    ctx.fillStyle = diskGrd;
    ctx.fill();
  }

  // 6.2 吸积盘内缘最稳定轨道（ISCO）白炽高温等离子湍流光环
  const iscoRadius = diskInnerR * 1.08;
  ctx.strokeStyle = "rgba(255, 255, 250, 0.98)";
  ctx.lineWidth = 4.2 + bass * 3.0;
  ctx.shadowColor = "#FFE080";
  ctx.shadowBlur = 32 * coreGlow;
  ctx.beginPath();
  ctx.ellipse(cx, cy, iscoRadius, iscoRadius * diskTilt, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 6.3 宽幅等离子柔光外晕
  if (cachedCoreHaloSprite) {
    const haloW = diskOuterR * 2.2;
    const haloH = haloW * diskTilt * 1.4;
    ctx.globalAlpha = Math.min(1.0, 0.75 + bass * 0.25);
    ctx.drawImage(cachedCoreHaloSprite, cx - haloW / 2, cy - haloH / 2, haloW, haloH);
  }

  ctx.restore();

  // --- 7. 施瓦西绝对纯黑事件视界暗核 (Pure Absolute Pitch-Black Event Horizon Void) ---
  // 黑洞中心彻底吞噬一切光线的引力黑体
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius, 0, Math.PI * 2);
  ctx.fill();

  // 视界边缘微弱的引力色散吸收边缘
  const voidGrd = ctx.createRadialGradient(
    cx,
    cy,
    horizonRadius * 0.85,
    cx,
    cy,
    horizonRadius * 1.06
  );
  voidGrd.addColorStop(0, "rgba(0, 0, 0, 1.0)");
  voidGrd.addColorStop(0.7, "rgba(3, 2, 5, 0.95)");
  voidGrd.addColorStop(1, "rgba(255, 180, 70, 0)");
  ctx.fillStyle = voidGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius * 1.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 8. 极细高光光子球层 (Razor-sharp Photon Sphere Ring) ---
  // 光子在黑洞临界轨道无数次自转形成的高能极光光子环
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // 主光子白金切线环 (1.8px)
  ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";
  ctx.lineWidth = 1.8 + bass * 1.6;
  ctx.shadowColor = "#FFD275";
  ctx.shadowBlur = 22 * coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius * 0.99, 0, Math.PI * 2);
  ctx.stroke();

  // 次级多普勒蓝移微光
  ctx.strokeStyle = "rgba(120, 220, 255, 0.7)";
  ctx.lineWidth = 1.0;
  ctx.shadowColor = "#38B6FF";
  ctx.shadowBlur = 14 * coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius * 1.03, 0, Math.PI * 2);
  ctx.stroke();

  // 光子球层贴图高亮外晕
  if (cachedPhotonRingSprite) {
    const ringDiam = horizonRadius * 3.8 * coreGlow;
    ctx.globalAlpha = Math.min(1.0, 0.85 + bass * 0.15);
    ctx.drawImage(cachedPhotonRingSprite, cx - ringDiam / 2, cy - ringDiam / 2, ringDiam, ringDiam);
  }
  ctx.restore();

  // --- 9. 电影级宽银幕横向变形拉丝耀斑 (Anamorphic Panavision Lens Flare) ---
  if (cachedAnamorphicSprite) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const flareWidth = Math.min(sw * 1.35, (720 + bass * 380 + energy * 260) * coreGlow);
    const flareHeight = (32 + bass * 28) * coreGlow;
    ctx.globalAlpha = Math.min(1.0, (0.7 + bass * 0.3) * chromaticAberration);
    ctx.drawImage(
      cachedAnamorphicSprite,
      cx - flareWidth / 2,
      cy - flareHeight / 2,
      flareWidth,
      flareHeight
    );
    ctx.restore();
  }
}
