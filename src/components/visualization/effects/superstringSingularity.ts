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
}

interface NebulaCloud {
  angle: number;
  radius: number;
  size: number;
  speed: number;
  alpha: number;
}

let cachedNebulaSprite: HTMLCanvasElement | null = null;
let cachedStarSprite: HTMLCanvasElement | null = null;

function getOrCreateSprite(size: number, isStar: boolean): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (isStar && cachedStarSprite) return cachedStarSprite;
  if (!isStar && cachedNebulaSprite) return cachedNebulaSprite;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return null;

  const center = size / 2;
  const grd = g.createRadialGradient(center, center, 0, center, center, center);
  if (isStar) {
    grd.addColorStop(0, "rgba(255, 255, 255, 1)");
    grd.addColorStop(0.25, "rgba(240, 250, 255, 0.6)");
    grd.addColorStop(1, "rgba(240, 250, 255, 0)");
  } else {
    grd.addColorStop(0, "rgba(235, 245, 255, 1)");
    grd.addColorStop(0.45, "rgba(180, 210, 245, 0.4)");
    grd.addColorStop(1, "rgba(0, 0, 0, 0)");
  }

  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);

  if (isStar) cachedStarSprite = canvas;
  else cachedNebulaSprite = canvas;
  return canvas;
}

/**
 * COSMIC NEBULA VORTEX (超维星云旋涡 - 120FPS 硬件批量渲染优化版)
 * - 4 Rich Logarithmic Spiral Galactic Arms
 * - 4,600+ Keplerian Stardust Particles with Batched GPU Path Rendering
 * - Offscreen Sprite Blitted Nebula Clouds
 * - Pure White-Hot Singularity Core with Delicate Gravitational Rings
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

  const speed = params.speed || 1.0;
  const singularityMass = params.singularityMass || 1.0;
  const coreGlow = params.coreGlow || 1.5;

  // --- 1. SIGNAL EXTRACTION & AUDIO METRICS ---
  const getVal = (idx: number) => (data && data[idx] !== undefined ? data[idx] / 255 : 0);
  const rawBass = (getVal(0) + getVal(1) + getVal(2) + getVal(3) + getVal(4)) / 5;
  const rawMid = (getVal(12) + getVal(24) + getVal(36) + getVal(48)) / 4;
  const rawTreble = (getVal(70) + getVal(90) + getVal(110) + getVal(130)) / 4;

  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.82 + rawBass * 0.18;
  refs.smoothMid.current = (refs.smoothMid.current || 0) * 0.84 + rawMid * 0.16;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.86 + rawTreble * 0.14;

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
      const distFrac = 0.05 + 0.95 * Math.pow(Math.random(), 1.15);
      const radius = 30 + distFrac * 820;

      const spiralAngle = armAngle + Math.log(radius * 0.05 + 1) * 2.8 + (Math.random() - 0.5) * 0.4;
      const orbitSpeed = (0.006 + (1 / Math.sqrt(radius)) * 0.18) * 0.8;
      const diskThickness = 10 + (radius / 820) * 45;
      const height = (Math.random() - 0.5) * diskThickness;
      const isBrightStar = Math.random() < 0.12;

      particles.push({
        radius,
        baseRadius: radius,
        angle: spiralAngle,
        speed: orbitSpeed,
        height,
        size: isBrightStar ? 1.8 + Math.random() * 2.4 : 0.8 + Math.random() * 1.6,
        alpha: isBrightStar ? 0.8 + Math.random() * 0.2 : 0.4 + Math.random() * 0.5,
        arm,
        twinkleSpeed: 1.5 + Math.random() * 4,
        twinklePhase: Math.random() * Math.PI * 2,
        isBrightStar,
      });
    }

    const nebulae: NebulaCloud[] = [];
    for (let i = 0; i < 28; i++) {
      const arm = i % 4;
      const armAngle = (arm / 4) * Math.PI * 2;
      const distFrac = 0.1 + (i / 28) * 0.85;
      const radius = 60 + distFrac * 700;
      const spiralAngle = armAngle + Math.log(radius * 0.05 + 1) * 2.8;

      nebulae.push({
        angle: spiralAngle,
        radius,
        size: 90 + Math.random() * 140,
        speed: (0.005 + (1 / Math.sqrt(radius)) * 0.14) * 0.8,
        alpha: 0.045 + Math.random() * 0.045,
      });
    }

    refs.particles.current = particles as any;
    refs.nebulaStars.current = nebulae as any;
    refs.shockwaves.current = [0] as any; // rotation angle
  }

  const particles = refs.particles.current as unknown as VortexParticle[];
  const nebulae = refs.nebulaStars.current as unknown as NebulaCloud[];

  const nebulaSprite = getOrCreateSprite(128, false);
  const starSprite = getOrCreateSprite(64, true);

  // --- 3. OBSIDIAN VOID BACKGROUND & HAZE ---
  ctx.save();
  ctx.fillStyle = "#010103";
  ctx.fillRect(0, 0, sw, sh);

  ctx.globalCompositeOperation = "screen";
  const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.65);
  bgGrd.addColorStop(0, `rgba(235, 245, 255, ${0.06 + bass * 0.06})`);
  bgGrd.addColorStop(0.35, `rgba(180, 205, 235, ${0.02 + mid * 0.02})`);
  bgGrd.addColorStop(0.8, "rgba(80, 110, 150, 0.008)");
  bgGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, sw, sh);
  ctx.restore();

  // --- 4. 3D CAMERA PROJECTION & MATRIX ROTATION ---
  const fov = 580;
  const pitch = 0.70 + Math.sin(t * 0.2) * 0.03;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  const rot = (refs.shockwaves.current ? refs.shockwaves.current[0] : 0) + (0.003 + energy * 0.008) * speed;
  refs.shockwaves.current = [rot] as any;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);

  // --- 5. 3D FLOWING NEBULA GAS CLOUDS (Sprite Blitting) ---
  if (nebulaSprite && nebulae) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (let i = 0; i < nebulae.length; i++) {
      const neb = nebulae[i];
      neb.angle += neb.speed * (1 + energy * 1.5 + bass * 1.2);

      const curR = neb.radius * singularityMass * (1 + Math.sin(t * 2 + neb.angle * 2) * 0.05);
      const pxRaw = Math.cos(neb.angle) * curR;
      const pyRaw = Math.sin(t * 1.5 + neb.radius * 0.02) * 15;
      const pzRaw = Math.sin(neb.angle) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = cy + ry * scale;
      const nRadius = neb.size * scale * (1 + bass * 0.3);
      const nDiameter = nRadius * 2;
      const nAlpha = Math.min(0.25, neb.alpha * (0.8 + energy * 0.6) * scale);

      ctx.globalAlpha = nAlpha;
      ctx.drawImage(nebulaSprite, screenX - nRadius, screenY - nRadius, nDiameter, nDiameter);
    }
    ctx.restore();
  }

  // --- 6. 4,600+ PARTICLES (Hardware Batched Path Rendering) ---
  const speedMult = 1 + energy * 2.0 + bass * 1.5;
  const waveAmp = 2 + bass * 8;
  const vertAmp = 4 + treble * 12;
  const activeCount = particles.length;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // A. Batched Streaks
  ctx.beginPath();
  ctx.strokeStyle = "rgba(235, 245, 255, 0.75)";
  ctx.lineWidth = 1.1;

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
    const streakLength = Math.max(2.0, (180 / Math.max(25, curR)) * (1 + bass * 1.5) * scale * 2.5);
    const streakEndX = screenX + Math.cos(tangentAngle) * streakLength;
    const streakEndY = screenY + Math.sin(tangentAngle) * streakLength * cosP;

    ctx.moveTo(screenX, screenY);
    ctx.lineTo(streakEndX, streakEndY);
  }
  ctx.stroke();

  // B. Batched Point Stars
  ctx.beginPath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
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
    const pSize = Math.max(0.7, p.size * scale * (1 + treble * 0.8));

    ctx.moveTo(screenX + pSize, screenY);
    ctx.arc(screenX, screenY, pSize, 0, Math.PI * 2);
  }
  ctx.fill();

  // C. Star Glows
  if (starSprite) {
    for (let i = 0; i < activeCount; i += 7) {
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
      const glowSize = Math.max(8, p.size * scale * 6);

      ctx.globalAlpha = 0.45;
      ctx.drawImage(starSprite, screenX - glowSize / 2, screenY - glowSize / 2, glowSize, glowSize);
    }
  }

  ctx.restore();

  // --- 7. SINGULARITY CORE & PHOTON RINGS ---
  const coreRadius = (14 + bass * 12) * singularityMass * coreGlow;
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const coreGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 3.5);
  coreGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  coreGrd.addColorStop(0.2, `rgba(240, 248, 255, ${0.85 + bass * 0.15})`);
  coreGrd.addColorStop(0.5, `rgba(180, 215, 255, ${0.35 + mid * 0.25})`);
  coreGrd.addColorStop(0.8, "rgba(100, 150, 220, 0.05)");
  coreGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = coreGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 0.65, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 1.6 + bass * 1.8;
  ctx.shadowColor = "#FFFFFF";
  ctx.shadowBlur = 18 * coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 0.95, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
