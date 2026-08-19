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
  twinklePhase: number;
  twinkleSpeed: number;
}

interface DeepBackgroundStar {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
}

interface NebulaCloudPuff {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  vx: number;
  vy: number;
}

/**
 * COSMIC NEBULA VORTEX (超维星云旋涡)
 * Style: Pure White / Titanium Silver / Platinum Monochrome Luxury
 * Physics: 3D Keplerian Logarithmic Spiral Galactic Disk + Gravitational Vortex Flow
 * Aesthetics: Interstellar / Denis Villeneuve / Apple Pro Design (No hard bars, no target rings)
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

  const t = (time || 0) * 0.0006 * speed;

  // --- 2. INITIALIZE 6,000+ VORTEX PARTICLES & DEEP STARS IN REFS ---
  if (!refs.particles.current || refs.particles.current.length === 0) {
    const particles: VortexParticle[] = [];
    const count = 5800;
    const arms = 3;

    for (let i = 0; i < count; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      // Exponential distribution for high density near core
      const distFrac = Math.pow(Math.random(), 2.2);
      const radius = 12 + distFrac * 680;
      // Logarithmic spiral angle + natural dispersion
      const spiralAngle = armAngle + Math.log(radius + 1) * 3.6 + (Math.random() - 0.5) * 0.45;
      // Keplerian orbital speed: faster near core, slower at rim
      const orbitSpeed = (0.008 + (1 / Math.pow(radius, 0.45)) * 0.22) * 0.85;
      // Disk vertical thickness increases with radius
      const diskThickness = 6 + (radius / 680) * 35;
      const height = (Math.random() - 0.5) * diskThickness;

      particles.push({
        radius,
        baseRadius: radius,
        angle: spiralAngle,
        speed: orbitSpeed,
        height,
        size: 0.4 + Math.random() * 1.8,
        alpha: 0.25 + Math.random() * 0.75,
        arm,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 1 + Math.random() * 3,
      });
    }
    refs.particles.current = particles;
  }

  if (!refs.spectrumStars.current || refs.spectrumStars.current.length === 0) {
    const stars: DeepBackgroundStar[] = [];
    for (let i = 0; i < 450; i++) {
      stars.push({
        x: (Math.random() - 0.5) * sw * 1.5,
        y: (Math.random() - 0.5) * sh * 1.5,
        z: Math.random() * 900 + 100,
        size: 0.4 + Math.random() * 1.5,
        alpha: 0.15 + Math.random() * 0.8,
      });
    }
    refs.spectrumStars.current = stars;
  }

  if (!refs.nebulaStars.current || refs.nebulaStars.current.length === 0) {
    const nebulae: NebulaCloudPuff[] = [];
    for (let i = 0; i < 6; i++) {
      nebulae.push({
        x: (Math.random() - 0.5) * sw * 0.6,
        y: (Math.random() - 0.5) * sh * 0.5,
        radius: 260 + Math.random() * 320,
        alpha: 0.03 + Math.random() * 0.04,
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.04,
      });
    }
    refs.nebulaStars.current = nebulae;
  }

  // --- 3. BACKGROUND: OBSIDIAN VOID & VOLUMETRIC MONOCHROME NEBULA ---
  ctx.save();
  ctx.fillStyle = "#010103";
  ctx.fillRect(0, 0, sw, sh);

  // Soft Ambient Core Glow
  ctx.globalCompositeOperation = "screen";
  const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.7);
  bgGrd.addColorStop(0, `rgba(235, 245, 255, ${0.08 + bass * 0.08})`);
  bgGrd.addColorStop(0.25, `rgba(180, 205, 235, ${0.03 + mid * 0.03})`);
  bgGrd.addColorStop(0.65, "rgba(80, 110, 150, 0.01)");
  bgGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, sw, sh);

  // Volumetric Cosmic Dust Clouds
  const nebulae = refs.nebulaStars.current as NebulaCloudPuff[];
  for (let i = 0; i < nebulae.length; i++) {
    const neb = nebulae[i];
    neb.x += neb.vx;
    neb.y += neb.vy;
    const nx = cx + neb.x + Math.sin(t * 0.4 + i) * 40;
    const ny = cy + neb.y + Math.cos(t * 0.3 + i) * 30;
    const nRadius = neb.radius * (1 + bass * 0.25);

    const nGrd = ctx.createRadialGradient(nx, ny, 0, nx, ny, nRadius);
    const nAlpha = neb.alpha * (0.8 + energy * 0.6);
    nGrd.addColorStop(0, `rgba(220, 235, 255, ${nAlpha.toFixed(3)})`);
    nGrd.addColorStop(0.5, `rgba(160, 190, 230, ${(nAlpha * 0.35).toFixed(3)})`);
    nGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = nGrd;
    ctx.beginPath();
    ctx.arc(nx, ny, nRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Deep Background Starfield
  const stars = refs.spectrumStars.current as DeepBackgroundStar[];
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const sx = cx + (s.x / s.z) * 520;
    const sy = cy + (s.y / s.z) * 520;

    if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
      const sAlpha = s.alpha * (0.4 + (Math.sin(t * 2 + i) * 0.5 + 0.5) * 0.6) * (1 - s.z / 1100);
      ctx.fillStyle = `rgba(235, 245, 255, ${sAlpha.toFixed(3)})`;
      ctx.fillRect(sx, sy, s.size, s.size);
    }
  }
  ctx.restore();

  // --- 4. 3D CAMERA & GALAXY DISK TILT MATRIX ---
  const fov = 560;
  // Cinematic perspective angle (tilt galaxy disk for high 3D depth)
  const pitch = 0.72 + Math.sin(t * 0.2) * 0.03;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const rotAngle = t * 0.75;
  const cosR = Math.cos(rotAngle);
  const sinR = Math.sin(rotAngle);

  // --- 5. 3D KEPLERIAN VORTEX PARTICLES (5,800+ PARTICLES) ---
  const particles = refs.particles.current as VortexParticle[];
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // Angular orbital velocity with audio reactivity
    const speedMult = (1 + energy * 1.8 + bass * 1.4);
    p.angle += p.speed * speedMult;

    // Subtle breathing of spiral arms
    const waveDisplacement = Math.sin(t * 2.5 + p.angle * 3) * (1 + bass * 0.15);
    const curR = (p.radius + waveDisplacement * 4) * singularityMass;

    // 3D coordinates in galaxy disk space
    const pxRaw = Math.cos(p.angle) * curR;
    const pyRaw = p.height + Math.sin(t * 3 + p.radius * 0.08) * (2 + treble * 8);
    const pzRaw = Math.sin(p.angle) * curR;

    // Transform by Camera rotation & tilt
    const rx = pxRaw * cosR - pzRaw * sinR;
    const rz = pxRaw * sinR + pzRaw * cosR;
    const ry = pyRaw * cosP - rz * sinP;
    const finalZ = pyRaw * sinP + rz * cosP + fov;

    if (finalZ <= 10) continue;
    const scale = fov / finalZ;
    const screenX = cx + rx * scale;
    const screenY = cy + ry * scale;

    // Velocity vector for fluid particle streak
    const tangentAngle = p.angle + Math.PI / 2;
    // Faster streak near core (high gravity acceleration)
    const streakLength = Math.max(1.5, (120 / Math.max(15, curR)) * (1 + bass * 1.4) * scale * 2.2);
    const streakEndX = screenX + Math.cos(tangentAngle) * streakLength;
    const streakEndY = screenY + Math.sin(tangentAngle) * streakLength * cosP;

    // Brightness & size modulation
    const twinkle = Math.sin(t * p.twinkleSpeed + p.twinklePhase) * 0.5 + 0.5;
    const pAlpha = Math.min(1, p.alpha * (0.35 + energy * 0.65 + twinkle * 0.25) * (scale * 0.95));
    const pSize = Math.max(0.4, p.size * scale * (1 + treble * 1.2));

    // Draw Smooth Particle Streak Trail
    ctx.strokeStyle = `rgba(235, 245, 255, ${(pAlpha * 0.75).toFixed(3)})`;
    ctx.lineWidth = pSize * 0.75;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(streakEndX, streakEndY);
    ctx.stroke();

    // Draw Luminous Particle Core
    ctx.fillStyle = `rgba(255, 255, 255, ${pAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(screenX, screenY, pSize, 0, Math.PI * 2);
    ctx.fill();

    // Specular halo for prominent foreground particles
    if (p.size > 1.4 && pAlpha > 0.45) {
      ctx.fillStyle = `rgba(240, 250, 255, ${(pAlpha * 0.3).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, pSize * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // --- 6. SUBTLE GRAVITATIONAL LENSING HALO (SOFT EINSTEIN LIGHT) ---
  const coreRadius = (22 + bass * 18) * singularityMass * coreGlow;
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // Multi-layered Soft Gaussian Photonic Glow (No hard lines or boxes!)
  const coreGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 3.8);
  coreGrd.addColorStop(0, `rgba(255, 255, 255, ${0.95 + bass * 0.05})`);
  coreGrd.addColorStop(0.18, `rgba(240, 248, 255, ${0.8 + bass * 0.2})`);
  coreGrd.addColorStop(0.45, `rgba(190, 220, 255, ${0.35 + mid * 0.25})`);
  coreGrd.addColorStop(0.75, "rgba(100, 150, 220, 0.06)");
  coreGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = coreGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 3.8, 0, Math.PI * 2);
  ctx.fill();

  // Pure White Singularity Point
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 0.75, 0, Math.PI * 2);
  ctx.fill();

  // High-Energy Lensing Ring Edge
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 1.8 + bass * 2.2;
  ctx.shadowColor = "#FFFFFF";
  ctx.shadowBlur = 24 * coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 0.95, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // --- 7. REFINED SWISS ASTROPHYSICS HUD TELEMETRY OVERLAY ---
  ctx.save();
  ctx.font = "10px 'SF Mono', 'Roboto Mono', monospace";
  ctx.fillStyle = "rgba(215, 230, 255, 0.4)";
  ctx.textBaseline = "top";

  // Top Left: Galactic Metric
  ctx.fillText("GALACTIC VORTEX // KERR METRIC MATRIX", 32, 32);
  ctx.fillText(`GRAVITATIONAL ACCEL: ${(14.2 * (1 + bass * 6.5)).toFixed(1)} G`, 32, 48);
  ctx.fillText(`PHOTON ACCRETION FLUX: ${(5800 * (1 + energy * 0.4)).toFixed(0)} pts/s`, 32, 64);
  ctx.fillText(`ORBITAL VELOCITY: ${(0.82 * (1 + bass * 0.35)).toFixed(2)} c`, 32, 80);

  // Top Right: Realtime Acoustic Harmonics
  ctx.textAlign = "right";
  ctx.fillText("ACOUSTIC HARMONICS // REALTIME FFT", sw - 32, 32);
  ctx.fillText(`SUB-BASS [20-150Hz]: ${(bass * 100).toFixed(0)}%`, sw - 32, 48);
  ctx.fillText(`MID-VOX [300-2kHz]: ${(mid * 100).toFixed(0)}%`, sw - 32, 64);
  ctx.fillText(`TREBLE-AIR [2-16kHz]: ${(treble * 100).toFixed(0)}%`, sw - 32, 80);

  // Precision Reticle Corner Marks
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
