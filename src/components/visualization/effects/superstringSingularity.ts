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

/**
 * COSMIC NEBULA VORTEX (超维星云旋涡)
 * - 4 Rich, Highly Visible Logarithmic Spiral Galactic Arms
 * - 4,500+ Luminous Titanium-White & Platinum Stardust Particles with Motion Trails
 * - 3D Flowing Cosmic Dust Streamers & Spiral Gas Nebula
 * - Compact White-Hot Singularity Core with Delicate Gravitational Photon Rings
 * - Full-Screen Cosmic Depth & Real-time FFT Harmonics
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

  // --- 2. INITIALIZE 4,500+ HIGHLY VISIBLE PARTICLES & NEBULA CLOUDS ---
  if (!refs.particles.current || refs.particles.current.length === 0) {
    const particles: VortexParticle[] = [];
    const count = 4600;
    const arms = 4;

    for (let i = 0; i < count; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      // Linear + power blend for balanced full-screen density (30px to 850px)
      const distFrac = 0.05 + 0.95 * Math.pow(Math.random(), 1.15);
      const radius = 30 + distFrac * 820;

      // Logarithmic spiral with arm dispersion
      const spiralAngle = armAngle + Math.log(radius * 0.05 + 1) * 2.8 + (Math.random() - 0.5) * 0.4;
      // Keplerian orbit speed: fast near core, slow at outer edge
      const orbitSpeed = (0.006 + (1 / Math.sqrt(radius)) * 0.18) * 0.8;
      // 3D vertical thickness
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
    refs.particles.current = particles;
  }

  if (!refs.nebulaStars.current || refs.nebulaStars.current.length === 0) {
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
    refs.nebulaStars.current = nebulae;
  }

  // --- 3. BACKGROUND: OBSIDIAN COSMIC VOID ---
  ctx.save();
  ctx.fillStyle = "#010103";
  ctx.fillRect(0, 0, sw, sh);

  // Soft Ambient Core Glow
  ctx.globalCompositeOperation = "screen";
  const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.65);
  bgGrd.addColorStop(0, `rgba(235, 245, 255, ${0.06 + bass * 0.06})`);
  bgGrd.addColorStop(0.35, `rgba(180, 205, 235, ${0.02 + mid * 0.02})`);
  bgGrd.addColorStop(0.8, "rgba(80, 110, 150, 0.008)");
  bgGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, sw, sh);
  ctx.restore();

  // --- 4. 3D CAMERA & GALAXY TILT MATRIX ---
  const fov = 580;
  // Cinematic 3D tilt perspective
  const pitch = 0.70 + Math.sin(t * 0.2) * 0.03;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const rotAngle = t * 0.7;
  const cosR = Math.cos(rotAngle);
  const sinR = Math.sin(rotAngle);

  // --- 5. 3D FLOWING SPIRAL NEBULA GAS CLOUDS ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const nebulae = refs.nebulaStars.current as NebulaCloud[];

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

    const nGrd = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, nRadius);
    const nAlpha = neb.alpha * (0.8 + energy * 0.6) * scale;
    nGrd.addColorStop(0, `rgba(235, 245, 255, ${nAlpha.toFixed(3)})`);
    nGrd.addColorStop(0.45, `rgba(180, 210, 245, ${(nAlpha * 0.4).toFixed(3)})`);
    nGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = nGrd;
    ctx.beginPath();
    ctx.arc(screenX, screenY, nRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- 6. 3D STREAMERS / SPIRAL ARM FILAMENT GUIDES ---
  const armsCount = 4;
  const armSteps = 70;
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let a = 0; a < armsCount; a++) {
    const armAngle = (a / armsCount) * Math.PI * 2;
    ctx.beginPath();
    let first = true;

    for (let s = 1; s <= armSteps; s++) {
      const frac = s / armSteps;
      const radius = 35 + frac * 780 * singularityMass;
      const spiralA = armAngle + Math.log(radius * 0.05 + 1) * 2.8 + t * 0.4;

      const waveIdx = Math.floor(frac * (data?.length || 1));
      const waveVal = (((data && data[waveIdx]) || 128) - 128) / 128;
      const disp = waveVal * (18 + mid * 25);

      const curR = radius + disp;
      const pxRaw = Math.cos(spiralA) * curR;
      const pyRaw = Math.sin(spiralA * 3 + t * 2) * (8 + mid * 20) + waveVal * 12;
      const pzRaw = Math.sin(spiralA) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const px = cx + rx * scale;
      const py = cy + ry * scale;

      if (first) {
        ctx.moveTo(px, py);
        first = false;
      } else {
        ctx.lineTo(px, py);
      }
    }

    const armAlpha = (0.08 + mid * 0.14);
    ctx.strokeStyle = `rgba(220, 240, 255, ${armAlpha.toFixed(3)})`;
    ctx.lineWidth = 1.2 * coreGlow;
    ctx.stroke();
  }
  ctx.restore();

  // --- 7. 4,600+ HIGHLY VISIBLE 3D VORTEX PARTICLES ---
  const particles = refs.particles.current as VortexParticle[];
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // Angular orbital velocity
    const speedMult = (1 + energy * 2.0 + bass * 1.5);
    p.angle += p.speed * speedMult;

    // Harmonic wave breathing
    const waveDisp = Math.sin(t * 3 + p.angle * 4) * (2 + bass * 8);
    const curR = (p.radius + waveDisp) * singularityMass;

    // 3D coordinates in disk space
    const pxRaw = Math.cos(p.angle) * curR;
    const pyRaw = p.height + Math.sin(t * 2.5 + p.radius * 0.05) * (4 + treble * 12);
    const pzRaw = Math.sin(p.angle) * curR;

    // Camera transform
    const rx = pxRaw * cosR - pzRaw * sinR;
    const rz = pxRaw * sinR + pzRaw * cosR;
    const ry = pyRaw * cosP - rz * sinP;
    const finalZ = pyRaw * sinP + rz * cosP + fov;

    if (finalZ <= 10) continue;
    const scale = fov / finalZ;
    const screenX = cx + rx * scale;
    const screenY = cy + ry * scale;

    // Streak vector along orbital tangent
    const tangentAngle = p.angle + Math.PI / 2;
    const streakLength = Math.max(2.0, (180 / Math.max(25, curR)) * (1 + bass * 1.5) * scale * 2.5);
    const streakEndX = screenX + Math.cos(tangentAngle) * streakLength;
    const streakEndY = screenY + Math.sin(tangentAngle) * streakLength * cosP;

    // Particle alpha & twinkle
    const twinkle = Math.sin(t * p.twinkleSpeed + p.twinklePhase) * 0.5 + 0.5;
    const pAlpha = Math.min(1, p.alpha * (0.55 + energy * 0.45 + twinkle * 0.35) * (scale * 0.95));
    const pSize = Math.max(0.7, p.size * scale * (1 + treble * 0.8));

    // Particle Streak Tail
    ctx.strokeStyle = `rgba(235, 245, 255, ${(pAlpha * 0.85).toFixed(3)})`;
    ctx.lineWidth = pSize * 0.85;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(streakEndX, streakEndY);
    ctx.stroke();

    // Particle Luminous Head
    ctx.fillStyle = `rgba(255, 255, 255, ${pAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(screenX, screenY, pSize, 0, Math.PI * 2);
    ctx.fill();

    // Specular Star Glow for bright stars
    if (p.isBrightStar && pAlpha > 0.6) {
      ctx.fillStyle = `rgba(240, 250, 255, ${(pAlpha * 0.45).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, pSize * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // --- 8. COMPACT REFINED SINGULARITY CORE & PHOTON RINGS ---
  // Keep the core compact so it does not block the screen (radius 14px to 22px)
  const coreRadius = (14 + bass * 12) * singularityMass * coreGlow;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // Soft Photonic Glow
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

  // Solid Bright Center Dot
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 0.65, 0, Math.PI * 2);
  ctx.fill();

  // Delicate Photon Orbit Ring
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 1.6 + bass * 1.8;
  ctx.shadowColor = "#FFFFFF";
  ctx.shadowBlur = 18 * coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 0.95, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 9. SWISS MINIMALIST ASTROPHYSICS HUD ---
  ctx.save();
  ctx.font = "10px 'SF Mono', 'Roboto Mono', monospace";
  ctx.fillStyle = "rgba(215, 230, 255, 0.4)";
  ctx.textBaseline = "top";

  // Top Left
  ctx.fillText("COSMIC VORTEX // KERR METRIC GALAXY", 32, 32);
  ctx.fillText(`GRAVITATIONAL INFLOW: ${(18.6 * (1 + bass * 5.2)).toFixed(1)} c`, 32, 48);
  ctx.fillText(`STAR PARTICLES: ${(4600).toFixed(0)} STARDUST`, 32, 64);

  // Top Right
  ctx.textAlign = "right";
  ctx.fillText("ACOUSTIC HARMONICS // REALTIME FFT", sw - 32, 32);
  ctx.fillText(`SUB-BASS [20-150Hz]: ${(bass * 100).toFixed(0)}%`, sw - 32, 48);
  ctx.fillText(`MID-VOX [300-2kHz]: ${(mid * 100).toFixed(0)}%`, sw - 32, 64);
  ctx.fillText(`TREBLE-AIR [2-16kHz]: ${(treble * 100).toFixed(0)}%`, sw - 32, 80);

  // Reticle Corner Marks
  ctx.strokeStyle = "rgba(200, 225, 255, 0.25)";
  ctx.lineWidth = 1;
  const markSize = 10;

  ctx.beginPath();
  ctx.moveTo(24, 24 + markSize);
  ctx.lineTo(24, 24);
  ctx.lineTo(24 + markSize, 24);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(sw - 24 - markSize, 24);
  ctx.lineTo(sw - 24, 24);
  ctx.lineTo(sw - 24, 24 + markSize);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(24, sh - 24 - markSize);
  ctx.lineTo(24, sh - 24);
  ctx.lineTo(24 + markSize, sh - 24);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(sw - 24 - markSize, sh - 24);
  ctx.lineTo(sw - 24, sh - 24);
  ctx.lineTo(sw - 24, sh - 24 - markSize);
  ctx.stroke();

  ctx.restore();
}
