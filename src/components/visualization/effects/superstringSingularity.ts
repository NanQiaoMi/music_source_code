/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface SuperstringFilament {
  baseAngle: number;
  length: number;
  innerRadius: number;
  outerRadius: number;
  spiralTightness: number;
  frequency: number;
  phase: number;
  harmonicRank: number;
  colorType: number; // 0: 铂金蓝白, 1: 炽热琥珀金, 2: 极光金青, 3: 深空赤金
  lineWidth: number;
  alpha: number;
  rotationSpeed: number;
  verticalWaveAmp: number;
}

interface PlasmaRibbonLayer {
  radiusInner: number;
  radiusOuter: number;
  speed: number;
  phase: number;
  waveCount: number;
  hueOffset: number;
  alpha: number;
  thickness: number;
}

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
    hGrd.addColorStop(0, "rgba(50, 160, 255, 0)");
    hGrd.addColorStop(0.2, "rgba(70, 200, 255, 0.18)");
    hGrd.addColorStop(0.38, "rgba(255, 210, 120, 0.45)");
    hGrd.addColorStop(0.48, "rgba(255, 250, 240, 0.95)");
    hGrd.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
    hGrd.addColorStop(0.52, "rgba(255, 250, 240, 0.95)");
    hGrd.addColorStop(0.62, "rgba(255, 190, 90, 0.45)");
    hGrd.addColorStop(0.8, "rgba(255, 120, 40, 0.15)");
    hGrd.addColorStop(1, "rgba(255, 80, 20, 0)");

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
    cachedAnamorphicSprite = createAnamorphicFlareSprite(800, 56);
  }
  if (!cachedPhotonRingSprite) {
    cachedPhotonRingSprite = createRadialGlowSprite(220, [
      [0, "rgba(255, 255, 255, 1.0)"],
      [0.15, "rgba(255, 230, 180, 0.95)"],
      [0.35, "rgba(255, 150, 50, 0.65)"],
      [0.65, "rgba(180, 80, 240, 0.22)"],
      [0.85, "rgba(50, 140, 255, 0.08)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
  }
  if (!cachedCoreHaloSprite) {
    cachedCoreHaloSprite = createRadialGlowSprite(320, [
      [0, "rgba(255, 200, 100, 0.85)"],
      [0.25, "rgba(240, 110, 30, 0.45)"],
      [0.55, "rgba(140, 40, 200, 0.18)"],
      [0.85, "rgba(30, 90, 220, 0.05)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
  }
}

/**
 * 电影级卡冈图雅黑洞吸积光盘模拟光效 (零粒子 · 纯连续流体光带与超弦曲率束流)
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
  const burstSensitivity = params.burstSensitivity || 1.1;

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

  // --- 2. INITIALIZE 64 HARMONIC SUPERSTRING FILAMENTS & 6 CONTINUOUS PLASMA RIBBONS ---
  if (!refs.particles.current || refs.particles.current.length === 0) {
    const filamentCount = 64;
    const filaments: SuperstringFilament[] = [];

    for (let i = 0; i < filamentCount; i++) {
      const angle = (i / filamentCount) * Math.PI * 2;
      const rank = (i % 6) + 1;
      const colorType = i % 4;
      const innerRadius = 38 + (i % 8) * 6;
      const outerRadius = 380 + (i / filamentCount) * 460;

      filaments.push({
        baseAngle: angle,
        length: outerRadius - innerRadius,
        innerRadius,
        outerRadius,
        spiralTightness: 1.8 + (i % 5) * 0.35,
        frequency: 2 + rank * 1.2,
        phase: (i / filamentCount) * Math.PI * 4,
        harmonicRank: rank,
        colorType,
        lineWidth: 1.2 + (i % 4) * 0.5,
        alpha: 0.45 + (i % 3) * 0.2,
        rotationSpeed: (0.004 + (1 / (rank + 2)) * 0.008) * 1.1,
        verticalWaveAmp: 8 + (i % 6) * 4,
      });
    }

    const plasmaRibbons: PlasmaRibbonLayer[] = [];
    const ribbonRadii = [
      { inR: 45, outR: 110, spd: 0.016, thick: 28, alpha: 0.42 },
      { inR: 95, outR: 180, spd: 0.012, thick: 36, alpha: 0.35 },
      { inR: 160, outR: 280, spd: 0.009, thick: 48, alpha: 0.28 },
      { inR: 250, outR: 420, spd: 0.006, thick: 62, alpha: 0.22 },
      { inR: 380, outR: 580, spd: 0.004, thick: 80, alpha: 0.16 },
      { inR: 520, outR: 780, spd: 0.0025, thick: 110, alpha: 0.12 },
    ];

    ribbonRadii.forEach((r, idx) => {
      plasmaRibbons.push({
        radiusInner: r.inR,
        radiusOuter: r.outR,
        speed: r.spd,
        phase: (idx / ribbonRadii.length) * Math.PI * 2,
        waveCount: 3 + (idx % 3),
        hueOffset: idx * 0.15,
        alpha: r.alpha,
        thickness: r.thick,
      });
    });

    refs.particles.current = filaments as any[];
    refs.nebulaStars.current = plasmaRibbons as any[];
    refs.shockwaves.current = [];
  }

  const filaments = refs.particles.current as unknown as SuperstringFilament[];
  const plasmaRibbons = refs.nebulaStars.current as unknown as PlasmaRibbonLayer[];
  const shockwaves = (refs.shockwaves.current || []) as GravitationalShockwave[];

  // 低音重击生成引力波时空曲率等高线涟漪光膜
  if (rawBass > 0.62 && rawBass - bass > 0.22 * burstSensitivity && shockwaves.length < 5) {
    shockwaves.push({
      radius: 40 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.68,
      alpha: 0.95,
      speed: 14 + bass * 20,
      lineWidth: 2.5 + bass * 3.0,
    });
  }

  // --- 3. 深邃暗黑深空背景与引力透镜空间雾化 ---
  ctx.save();
  ctx.fillStyle = "#010204";
  ctx.fillRect(0, 0, sw, sh);

  ctx.globalCompositeOperation = "screen";
  const maxDim = Math.max(sw, sh);
  const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDim * 0.75);
  bgGrd.addColorStop(0, `rgba(255, 175, 60, ${(0.07 + bass * 0.1) * chromaticAberration})`);
  bgGrd.addColorStop(0.28, `rgba(220, 90, 25, ${0.04 + mid * 0.05})`);
  bgGrd.addColorStop(0.55, `rgba(130, 45, 180, ${0.025 + mid * 0.03})`);
  bgGrd.addColorStop(0.78, `rgba(35, 110, 220, ${0.02 + treble * 0.03})`);
  bgGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, sw, sh);
  ctx.restore();

  // --- 4. 3D CAMERA PROJECTION & MATRIX ROTATION ---
  const fov = 680;
  const pitch = 0.68 + Math.sin(t * 0.12) * 0.03; // 约 39° 倾角
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  const rot =
    ((refs.bokeh.current && refs.bokeh.current[0]) || 0) +
    (0.003 + energy * 0.008) * superstringTension;
  if (!refs.bokeh.current) refs.bokeh.current = [];
  refs.bokeh.current[0] = rot;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);

  // --- 5. 引力波冲击光膜 ---
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

      ctx.strokeStyle = `rgba(255, 225, 150, ${ringAlpha * 0.85})`;
      ctx.lineWidth = swItem.lineWidth;
      ctx.beginPath();
      ctx.ellipse(cx, cy, swItem.radius, swItem.radius * cosP, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(120, 180, 255, ${ringAlpha * 0.45})`;
      ctx.lineWidth = swItem.lineWidth * 0.6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, swItem.radius * 0.94, swItem.radius * 0.94 * cosP, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- 6. 爱因斯坦引力透镜弯曲双光拱 (Upper & Lower Gravitational Lensing Halos) ---
  const lensingRadius = (78 + bass * 26) * singularityMass;
  const lensingHeight = lensingRadius * 0.92;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // (6.1) 上部弯曲引力透镜主光拱
  const upperGrd = ctx.createRadialGradient(
    cx,
    cy - lensingHeight * 0.38,
    lensingRadius * 0.32,
    cx,
    cy - lensingHeight * 0.38,
    lensingRadius * 1.65
  );
  upperGrd.addColorStop(0, `rgba(255, 250, 235, ${(0.92 + bass * 0.15) * chromaticAberration})`);
  upperGrd.addColorStop(0.25, `rgba(255, 180, 60, ${0.65 + mid * 0.3})`);
  upperGrd.addColorStop(0.55, `rgba(220, 80, 25, ${0.35 + mid * 0.2})`);
  upperGrd.addColorStop(0.82, "rgba(120, 40, 160, 0.12)");
  upperGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = upperGrd;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy - lensingHeight * 0.45,
    lensingRadius * 1.42,
    lensingHeight * 0.96,
    0,
    Math.PI * 0.88,
    Math.PI * 2.12
  );
  ctx.fill();

  // (6.2) 下部弯曲引力透镜副光拱
  const lowerGrd = ctx.createRadialGradient(
    cx,
    cy + lensingHeight * 0.38,
    lensingRadius * 0.32,
    cx,
    cy + lensingHeight * 0.38,
    lensingRadius * 1.5
  );
  lowerGrd.addColorStop(0, `rgba(255, 240, 200, ${(0.72 + bass * 0.2) * chromaticAberration})`);
  lowerGrd.addColorStop(0.32, `rgba(240, 140, 45, ${0.45 + mid * 0.25})`);
  lowerGrd.addColorStop(0.65, `rgba(180, 50, 20, ${0.18 + mid * 0.15})`);
  lowerGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = lowerGrd;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy + lensingHeight * 0.42,
    lensingRadius * 1.32,
    lensingHeight * 0.8,
    0,
    0,
    Math.PI
  );
  ctx.fill();

  ctx.restore();

  // --- 7. 6 层连续流体等离子曲率吸积光幕 (Volumetric Continuous Fluid Plasma Ribbons) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let layerIdx = 0; layerIdx < plasmaRibbons.length; layerIdx++) {
    const ribbon = plasmaRibbons[layerIdx];
    ribbon.phase += ribbon.speed * (1 + energy * 1.6 + bass * 1.2);

    const rInner = ribbon.radiusInner * singularityMass;
    const rOuter = ribbon.radiusOuter * singularityMass * (1 + bass * 0.18);
    const segments = 48;

    ctx.beginPath();
    // 外边缘流体曲线
    for (let s = 0; s <= segments; s++) {
      const segAngle = (s / segments) * Math.PI * 2;
      const wave = Math.sin(segAngle * ribbon.waveCount + ribbon.phase + t * 2) * (8 + bass * 16);
      const curR = rOuter + wave;

      const pxRaw = Math.cos(segAngle) * curR;
      const pyRaw = Math.sin(segAngle * 3 + ribbon.phase) * (6 + treble * 12);
      const pzRaw = Math.sin(segAngle) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = cy + ry * scale;

      if (s === 0) {
        ctx.moveTo(screenX, screenY);
      } else {
        ctx.lineTo(screenX, screenY);
      }
    }

    // 内边缘闭合
    for (let s = segments; s >= 0; s--) {
      const segAngle = (s / segments) * Math.PI * 2;
      const wave = Math.sin(segAngle * ribbon.waveCount + ribbon.phase * 1.3) * (4 + bass * 8);
      const curR = rInner + wave;

      const pxRaw = Math.cos(segAngle) * curR;
      const pyRaw = Math.sin(segAngle * 2 + ribbon.phase) * (4 + treble * 8);
      const pzRaw = Math.sin(segAngle) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = cy + ry * scale;

      ctx.lineTo(screenX, screenY);
    }
    ctx.closePath();

    const ribbonGrd = ctx.createLinearGradient(cx - rOuter * 0.8, cy, cx + rOuter * 0.8, cy);
    ribbonGrd.addColorStop(0, `rgba(70, 200, 255, ${ribbon.alpha * 0.85 * chromaticAberration})`);
    ribbonGrd.addColorStop(0.35, `rgba(255, 240, 200, ${ribbon.alpha * 0.95})`);
    ribbonGrd.addColorStop(0.68, `rgba(255, 160, 45, ${ribbon.alpha * 0.75})`);
    ribbonGrd.addColorStop(1, `rgba(220, 60, 20, ${ribbon.alpha * 0.35})`);

    ctx.fillStyle = ribbonGrd;
    ctx.fill();
  }
  ctx.restore();

  // --- 8. 64 根多维连续平滑空间曲率超弦 (Harmonic Continuous Superstring Strands - 0 粒子) ---
  const waveAmp = (6 + bass * 22) * singularityMass;
  const vertAmp = (8 + treble * 26) * singularityMass;
  const speedMult = (1 + energy * 2.0 + bass * 1.5) * superstringTension;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let fIdx = 0; fIdx < filaments.length; fIdx++) {
    const filament = filaments[fIdx];
    filament.baseAngle += filament.rotationSpeed * speedMult;

    const curveSteps = 32;
    const points: { x: number; y: number; scale: number; alpha: number }[] = [];

    for (let s = 0; s <= curveSteps; s++) {
      const progress = s / curveSteps;
      const curRadius = (filament.innerRadius + progress * filament.length) * singularityMass;

      const spiralAngle =
        filament.baseAngle +
        Math.log(curRadius * 0.04 + 1) * filament.spiralTightness +
        Math.sin(progress * filament.frequency * Math.PI * 2 + t * 3 + filament.phase) *
          (waveAmp / Math.max(30, curRadius));

      const pxRaw = Math.cos(spiralAngle) * curRadius;
      const pyRaw =
        Math.sin(progress * Math.PI * 3 + t * 2.5 + filament.phase) *
        vertAmp *
        (1 - progress * 0.3);
      const pzRaw = Math.sin(spiralAngle) * curRadius;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = cy + ry * scale;

      const alpha =
        filament.alpha * (1 - progress * 0.55) * scale * (0.7 + mid * 0.6) * chromaticAberration;

      points.push({ x: screenX, y: screenY, scale, alpha });
    }

    if (points.length < 3) continue;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

    const startPt = points[0];
    const endPt = points[points.length - 1];
    const strokeGrd = ctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);

    if (filament.colorType === 0) {
      strokeGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      strokeGrd.addColorStop(0.3, "rgba(100, 220, 255, 0.85)");
      strokeGrd.addColorStop(0.7, "rgba(60, 140, 240, 0.45)");
      strokeGrd.addColorStop(1, "rgba(40, 80, 200, 0)");
    } else if (filament.colorType === 1) {
      strokeGrd.addColorStop(0, "rgba(255, 250, 220, 0.95)");
      strokeGrd.addColorStop(0.35, "rgba(255, 190, 70, 0.85)");
      strokeGrd.addColorStop(0.75, "rgba(230, 95, 30, 0.4)");
      strokeGrd.addColorStop(1, "rgba(160, 40, 10, 0)");
    } else if (filament.colorType === 2) {
      strokeGrd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      strokeGrd.addColorStop(0.4, "rgba(120, 240, 220, 0.75)");
      strokeGrd.addColorStop(0.8, "rgba(80, 160, 220, 0.35)");
      strokeGrd.addColorStop(1, "rgba(30, 60, 160, 0)");
    } else {
      strokeGrd.addColorStop(0, "rgba(255, 235, 180, 0.9)");
      strokeGrd.addColorStop(0.35, "rgba(255, 140, 45, 0.75)");
      strokeGrd.addColorStop(0.75, "rgba(190, 50, 80, 0.35)");
      strokeGrd.addColorStop(1, "rgba(120, 20, 60, 0)");
    }

    ctx.strokeStyle = strokeGrd;
    ctx.lineWidth = Math.max(0.8, filament.lineWidth * (1 + bass * 0.6));
    ctx.stroke();
  }

  ctx.restore();

  // --- 9. 纯黑施瓦西视界暗核与光子球发光薄环 ---
  const horizonRadius = (36 + bass * 16) * singularityMass;

  // (9.1) 光子球外晕大氛围光
  if (cachedCoreHaloSprite) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const haloDiameter = horizonRadius * 4.2 * coreGlow;
    ctx.globalAlpha = Math.min(1.0, 0.8 + bass * 0.2);
    ctx.drawImage(
      cachedCoreHaloSprite,
      cx - haloDiameter / 2,
      cy - haloDiameter / 2,
      haloDiameter,
      haloDiameter
    );
    ctx.restore();
  }

  // (9.2) 纯粹深邃黑洞暗核
  ctx.save();
  const voidGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, horizonRadius);
  voidGrd.addColorStop(0, "rgba(0, 0, 0, 1.0)");
  voidGrd.addColorStop(0.82, "rgba(1, 2, 4, 1.0)");
  voidGrd.addColorStop(0.96, "rgba(15, 10, 8, 0.85)");
  voidGrd.addColorStop(1, "rgba(255, 210, 120, 0)");

  ctx.fillStyle = voidGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius, 0, Math.PI * 2);
  ctx.fill();

  // (9.3) 极细高光光子环切线
  ctx.strokeStyle = "rgba(255, 250, 240, 0.98)";
  ctx.lineWidth = 1.8 + bass * 1.8;
  ctx.shadowColor = "#FFC870";
  ctx.shadowBlur = 20 * coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius * 0.97, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(100, 210, 255, 0.65)";
  ctx.lineWidth = 1.0;
  ctx.shadowColor = "#40B4FF";
  ctx.shadowBlur = 12 * coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonRadius * 1.02, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 10. 电影级变形宽银幕横向拉丝光晕 ---
  if (cachedAnamorphicSprite) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const flareWidth = Math.min(sw * 1.25, (640 + bass * 320 + energy * 220) * coreGlow);
    const flareHeight = (30 + bass * 26) * coreGlow;
    ctx.globalAlpha = Math.min(1.0, (0.65 + bass * 0.35) * chromaticAberration);
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
