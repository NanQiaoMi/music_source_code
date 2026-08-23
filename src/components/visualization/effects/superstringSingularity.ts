/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface VortexParticle {
  radius: number;
  baseRadius: number;
  angle: number;
  speed: number;
  height: number;
  size: number;
  alpha: number;
  arm: number;
  twinkleSpeed: number;
  twinklePhase: number;
  isBrightStar: boolean;
  colorType: number; // 0: amber gold, 1: platinum white, 2: relativistic cyan
}

interface NebulaCloud {
  angle: number;
  radius: number;
  size: number;
  speed: number;
  alpha: number;
  hueOffset: number;
}

interface ShockwaveRing {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  width: number;
}

let cachedGasAmberSprite: HTMLCanvasElement | null = null;
let cachedGasCyanSprite: HTMLCanvasElement | null = null;
let cachedAnamorphicSprite: HTMLCanvasElement | null = null;
let cachedPhotonRingSprite: HTMLCanvasElement | null = null;
let cachedStarSprite: HTMLCanvasElement | null = null;

function createRadialGlowSprite(size: number, colorStops: [number, string][]): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

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
    hGrd.addColorStop(0, "rgba(64, 210, 255, 0)");
    hGrd.addColorStop(0.25, "rgba(255, 185, 95, 0.25)");
    hGrd.addColorStop(0.48, "rgba(255, 245, 230, 0.95)");
    hGrd.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
    hGrd.addColorStop(0.52, "rgba(255, 245, 230, 0.95)");
    hGrd.addColorStop(0.75, "rgba(255, 185, 95, 0.25)");
    hGrd.addColorStop(1, "rgba(64, 210, 255, 0)");

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
  if (!cachedGasAmberSprite) {
    cachedGasAmberSprite = createRadialGlowSprite(140, [
      [0, "rgba(255, 235, 200, 1.0)"],
      [0.2, "rgba(255, 175, 75, 0.75)"],
      [0.5, "rgba(220, 100, 30, 0.32)"],
      [0.8, "rgba(160, 45, 10, 0.08)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
  }
  if (!cachedGasCyanSprite) {
    cachedGasCyanSprite = createRadialGlowSprite(140, [
      [0, "rgba(235, 250, 255, 1.0)"],
      [0.25, "rgba(80, 215, 255, 0.65)"],
      [0.55, "rgba(45, 120, 240, 0.28)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
  }
  if (!cachedAnamorphicSprite) {
    cachedAnamorphicSprite = createAnamorphicFlareSprite(640, 48);
  }
  if (!cachedPhotonRingSprite) {
    cachedPhotonRingSprite = createRadialGlowSprite(160, [
      [0, "rgba(255, 255, 255, 1.0)"],
      [0.2, "rgba(255, 220, 160, 0.85)"],
      [0.5, "rgba(255, 140, 40, 0.35)"],
      [0.85, "rgba(80, 180, 255, 0.08)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
  }
  if (!cachedStarSprite) {
    cachedStarSprite = createRadialGlowSprite(64, [
      [0, "rgba(255, 255, 255, 1.0)"],
      [0.25, "rgba(255, 240, 210, 0.75)"],
      [0.6, "rgba(180, 225, 255, 0.25)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
  }
}

/**
 * 电影级卡冈图雅相对论黑洞吸积盘模拟光效 (Cinematic Gargantua Relativistic Accretion Disk)
 * - 爱因斯坦引力透镜弯曲双光拱 (Upper/Lower Gravitational Lensing Halos)
 * - 相对论多普勒频移光谱 (迎面青蓝 / 背向金橙)
 * - 4,600+ 开普勒对数螺旋星尘流场
 * - 变形宽银幕拉丝眩光与光子球发光薄环
 * - 低频潮汐引力冲击波
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
  const superstringTension = params.superstringTension || 1.2;
  const coreGlow = params.coreGlow || 1.5;
  const chromaticAberration = params.chromaticAberration || 1.35;

  // --- 1. SIGNAL EXTRACTION & AUDIO METRICS ---
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

  // --- 2. INITIALIZE 4,600+ PARTICLES & NEBULA CLOUDS ---
  if (!refs.particles.current || refs.particles.current.length === 0) {
    const particles: VortexParticle[] = [];
    const count = 4600;
    const arms = 4;

    for (let i = 0; i < count; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distFrac = 0.04 + 0.96 * Math.pow(Math.random(), 1.18);
      const radius = 28 + distFrac * 860;

      const spiralAngle = armAngle + Math.log(radius * 0.05 + 1) * 2.8 + (Math.random() - 0.5) * 0.45;
      const orbitSpeed = (0.007 + (1 / Math.sqrt(radius)) * 0.22) * 0.75;
      const diskThickness = 8 + (radius / 860) * 52;
      const height = (Math.random() - 0.5) * diskThickness;
      const isBrightStar = Math.random() < 0.14;

      const randColor = Math.random();
      const colorType = randColor < 0.5 ? 0 : randColor < 0.85 ? 1 : 2;

      particles.push({
        radius,
        baseRadius: radius,
        angle: spiralAngle,
        speed: orbitSpeed,
        height,
        size: isBrightStar ? 1.8 + Math.random() * 2.6 : 0.8 + Math.random() * 1.6,
        alpha: isBrightStar ? 0.85 + Math.random() * 0.15 : 0.4 + Math.random() * 0.55,
        arm,
        twinkleSpeed: 1.8 + Math.random() * 4.5,
        twinklePhase: Math.random() * Math.PI * 2,
        isBrightStar,
        colorType,
      });
    }

    const nebulae: NebulaCloud[] = [];
    for (let i = 0; i < 36; i++) {
      const arm = i % 4;
      const armAngle = (arm / 4) * Math.PI * 2;
      const distFrac = 0.08 + (i / 36) * 0.88;
      const radius = 55 + distFrac * 740;
      const spiralAngle = armAngle + Math.log(radius * 0.05 + 1) * 2.8;

      nebulae.push({
        angle: spiralAngle,
        radius,
        size: 95 + Math.random() * 155,
        speed: (0.005 + (1 / Math.sqrt(radius)) * 0.15) * 0.75,
        alpha: 0.048 + Math.random() * 0.048,
        hueOffset: Math.random() * 0.3,
      });
    }

    refs.particles.current = particles as any;
    refs.nebulaStars.current = nebulae as any;
    refs.shockwaves.current = [] as any;
  }

  const particles = refs.particles.current as unknown as VortexParticle[];
  const nebulae = refs.nebulaStars.current as unknown as NebulaCloud[];
  const shockwaves = (refs.shockwaves.current || []) as unknown as ShockwaveRing[];

  // 低音重击生成引力冲击波
  if (rawBass > 0.62 && rawBass - bass > 0.22 && shockwaves.length < 5) {
    shockwaves.push({
      radius: 35 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.62,
      alpha: 0.85,
      speed: 12 + bass * 18,
      width: 2.2 + bass * 2.5,
    });
  }

  // --- 3. 深邃暗黑深空背景与引力透镜空间雾化 ---
  ctx.save();
  ctx.fillStyle = "#010204";
  ctx.fillRect(0, 0, sw, sh);

  ctx.globalCompositeOperation = "screen";
  const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.72);
  bgGrd.addColorStop(0, `rgba(255, 175, 70, ${(0.05 + bass * 0.08) * chromaticAberration})`);
  bgGrd.addColorStop(0.32, `rgba(180, 85, 30, ${0.03 + mid * 0.04})`);
  bgGrd.addColorStop(0.65, `rgba(45, 110, 185, ${0.015 + treble * 0.025})`);
  bgGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, sw, sh);
  ctx.restore();

  // --- 4. 3D CAMERA PROJECTION & MATRIX ROTATION ---
  const fov = 620;
  const pitch = 0.68 + Math.sin(t * 0.15) * 0.025; // 约 39° 倾角
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  const rot = ((refs.bokeh.current && refs.bokeh.current[0]) || 0) + (0.0035 + energy * 0.01) * superstringTension;
  if (!refs.bokeh.current) refs.bokeh.current = [];
  refs.bokeh.current[0] = rot;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);

  // --- 5. 引力波冲击环 ---
  if (shockwaves.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const swItem = shockwaves[i];
      swItem.radius += swItem.speed;
      swItem.alpha *= 0.94;

      if (swItem.alpha < 0.01 || swItem.radius > swItem.maxRadius) {
        shockwaves.splice(i, 1);
        continue;
      }

      ctx.strokeStyle = `rgba(255, 215, 140, ${swItem.alpha * 0.65})`;
      ctx.lineWidth = swItem.width;
      ctx.beginPath();
      ctx.ellipse(cx, cy, swItem.radius, swItem.radius * cosP, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- 6. 爱因斯坦引力透镜弯曲双光拱 (Upper/Lower Gravitational Lensing Halos) ---
  const lensingRadius = (72 + bass * 22) * singularityMass;
  const lensingHeight = lensingRadius * 0.85;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // (6.1) 上部弯曲引力透镜主光拱 (Upper Lensing Halo)
  const upperGrd = ctx.createRadialGradient(cx, cy - lensingHeight * 0.35, lensingRadius * 0.35, cx, cy - lensingHeight * 0.35, lensingRadius * 1.55);
  upperGrd.addColorStop(0, `rgba(255, 245, 220, ${(0.85 + bass * 0.15) * chromaticAberration})`);
  upperGrd.addColorStop(0.35, `rgba(255, 160, 50, ${0.55 + mid * 0.3})`);
  upperGrd.addColorStop(0.75, "rgba(180, 60, 20, 0.15)");
  upperGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = upperGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy - lensingHeight * 0.42, lensingRadius * 1.35, lensingHeight * 0.92, 0, Math.PI * 0.92, Math.PI * 2.08);
  ctx.fill();

  // (6.2) 下部弯曲引力透镜副光拱 (Lower Lensing Halo)
  const lowerGrd = ctx.createRadialGradient(cx, cy + lensingHeight * 0.35, lensingRadius * 0.35, cx, cy + lensingHeight * 0.35, lensingRadius * 1.4);
  lowerGrd.addColorStop(0, `rgba(255, 235, 190, ${(0.65 + bass * 0.2) * chromaticAberration})`);
  lowerGrd.addColorStop(0.4, `rgba(240, 130, 40, ${0.38 + mid * 0.25})`);
  lowerGrd.addColorStop(0.8, "rgba(140, 45, 15, 0.08)");
  lowerGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = lowerGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy + lensingHeight * 0.38, lensingRadius * 1.25, lensingHeight * 0.75, 0, 0, Math.PI);
  ctx.fill();

  ctx.restore();

  // --- 7. 3D 流体气体云 (Volumetric Relativistic Gas Clouds) ---
  if (cachedGasAmberSprite && cachedGasCyanSprite && nebulae) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (let i = 0; i < nebulae.length; i++) {
      const neb = nebulae[i];
      neb.angle += neb.speed * (1 + energy * 1.8 + bass * 1.4);

      const curR = neb.radius * singularityMass * (1 + Math.sin(t * 2 + neb.angle * 2) * 0.05);
      const pxRaw = Math.cos(neb.angle) * curR;
      const pyRaw = Math.sin(t * 1.5 + neb.radius * 0.02) * 16;
      const pzRaw = Math.sin(neb.angle) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = cy + ry * scale;
      const nRadius = neb.size * scale * (1 + bass * 0.35);
      const nDiameter = nRadius * 2;
      const nAlpha = Math.min(0.32, neb.alpha * (0.8 + energy * 0.7) * scale * chromaticAberration);

      // 迎面运动（左侧）倾向青蓝，背向运动（右侧）倾向琥珀金
      const sprite = rx < 0 && Math.random() < 0.4 ? cachedGasCyanSprite : cachedGasAmberSprite;
      ctx.globalAlpha = nAlpha;
      ctx.drawImage(sprite, screenX - nRadius, screenY - nRadius, nDiameter, nDiameter);
    }
    ctx.restore();
  }

  // --- 8. 4,600+ 开普勒吸积盘对数螺旋星尘流场 ---
  const activeCount = particles.length;
  const speedMult = 1 + energy * 2.2 + bass * 1.6;
  const waveAmp = 2.5 + bass * 9;
  const vertAmp = 4.5 + treble * 14;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // 8.1 批量绘制高速切向光丝 (Magnetic Flow Filaments)
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 220, 160, 0.75)";
  ctx.lineWidth = 1.25;

  for (let i = 0; i < activeCount; i++) {
    const p = particles[i];
    p.angle += p.speed * speedMult;

    const waveDisp = Math.sin(t * 3 + p.angle * 4) * waveAmp;
    const curR = (p.radius + waveDisp) * singularityMass;

    const pxRaw = Math.cos(p.angle) * curR;
    const pyRaw = p.height + Math.sin(t * 2.5 + p.radius * 0.05) * vertAmp;
    const pzRaw = Math.sin(p.angle) * curR;

    const rx = pxRaw * cosR - pzRaw * sinR;
    const rz = pxRaw * sinR + pzRaw * cosR;
    const ry = pyRaw * cosP - rz * sinP;
    const finalZ = pyRaw * sinP + rz * cosP + fov;

    if (finalZ <= 10) continue;
    const scale = fov / finalZ;
    const screenX = cx + rx * scale;
    const screenY = cy + ry * scale;

    const tangentAngle = p.angle + Math.PI / 2;
    const streakLength = Math.max(2.2, (200 / Math.max(25, curR)) * (1 + bass * 1.6) * scale * 2.8);
    const streakEndX = screenX + Math.cos(tangentAngle) * streakLength;
    const streakEndY = screenY + Math.sin(tangentAngle) * streakLength * cosP;

    ctx.moveTo(screenX, screenY);
    ctx.lineTo(streakEndX, streakEndY);
  }
  ctx.stroke();

  // 8.2 批量绘制金橙与白金星尘粒子
  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 235, 205, 0.92)";
  for (let i = 0; i < activeCount; i++) {
    const p = particles[i];
    const waveDisp = Math.sin(t * 3 + p.angle * 4) * waveAmp;
    const curR = (p.radius + waveDisp) * singularityMass;

    const pxRaw = Math.cos(p.angle) * curR;
    const pyRaw = p.height + Math.sin(t * 2.5 + p.radius * 0.05) * vertAmp;
    const pzRaw = Math.sin(p.angle) * curR;

    const rx = pxRaw * cosR - pzRaw * sinR;
    const rz = pxRaw * sinR + pzRaw * cosR;
    const ry = pyRaw * cosP - rz * sinP;
    const finalZ = pyRaw * sinP + rz * cosP + fov;

    if (finalZ <= 10) continue;
    const scale = fov / finalZ;
    const screenX = cx + rx * scale;
    const screenY = cy + ry * scale;
    const pSize = Math.max(0.75, p.size * scale * (1 + treble * 0.85));

    ctx.moveTo(screenX + pSize, screenY);
    ctx.arc(screenX, screenY, pSize, 0, Math.PI * 2);
  }
  ctx.fill();

  // 8.3 亮星与光子耀斑快速贴图
  if (cachedStarSprite) {
    for (let i = 0; i < activeCount; i += 6) {
      const p = particles[i];
      if (!p.isBrightStar) continue;

      const waveDisp = Math.sin(t * 3 + p.angle * 4) * waveAmp;
      const curR = (p.radius + waveDisp) * singularityMass;
      const pxRaw = Math.cos(p.angle) * curR;
      const pyRaw = p.height + Math.sin(t * 2.5 + p.radius * 0.05) * vertAmp;
      const pzRaw = Math.sin(p.angle) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = cy + ry * scale;
      const glowSize = Math.max(9, p.size * scale * 6.5);

      ctx.globalAlpha = 0.55;
      ctx.drawImage(cachedStarSprite, screenX - glowSize / 2, screenY - glowSize / 2, glowSize, glowSize);
    }
  }

  ctx.restore();

  // --- 9. 黑洞事件视界与光子球发光薄环 ---
  const horizonRadius = (32 + bass * 14) * singularityMass;

  // (9.1) 光子球高亮外晕
  if (cachedPhotonRingSprite) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const ringDiameter = horizonRadius * 3.6 * coreGlow;
    ctx.globalAlpha = Math.min(1.0, 0.85 + bass * 0.15);
    ctx.drawImage(cachedPhotonRingSprite, cx - ringDiameter / 2, cy - ringDiameter / 2, ringDiameter, ringDiameter);
    ctx.restore();
  }

  // (9.2) 半透明深邃黑洞暗核 (Black Void Lens)
  ctx.save();
  const voidGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, horizonRadius);
  voidGrd.addColorStop(0, "rgba(2, 3, 6, 0.96)");
  voidGrd.addColorStop(0.75, "rgba(3, 4, 8, 0.90)");
  voidGrd.addColorStop(0.95, "rgba(20, 15, 10, 0.65)");
  voidGrd.addColorStop(1, "rgba(255, 200, 120, 0)");

  ctx.fillStyle = voidGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius, 0, Math.PI * 2);
  ctx.fill();

  // (9.3) 极细 1.8px 光子环切线 (Photon Sphere Ring)
  ctx.strokeStyle = "rgba(255, 245, 230, 0.95)";
  ctx.lineWidth = 1.6 + bass * 1.5;
  ctx.shadowColor = "#FFBA65";
  ctx.shadowBlur = 16 * coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius * 0.96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 10. 电影变形宽银幕横向拉丝光丝 (Anamorphic Horizontal Lens Flare) ---
  if (cachedAnamorphicSprite) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const flareWidth = Math.min(sw * 1.15, (520 + bass * 260 + energy * 180) * coreGlow);
    const flareHeight = (26 + bass * 22) * coreGlow;
    ctx.globalAlpha = Math.min(1.0, (0.55 + bass * 0.45) * chromaticAberration);
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
