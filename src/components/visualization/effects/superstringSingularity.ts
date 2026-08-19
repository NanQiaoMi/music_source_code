import { EffectContext } from "./types";

interface PhotonicParticle {
  radius: number;
  angle: number;
  speed: number;
  height: number;
  size: number;
  brightness: number;
  arm: number;
  trailLength: number;
}

interface WhiteShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  lineWidth: number;
}

/**
 * PURE WHITE PHOTONIC SINGULARITY (纯白光子引力奇点)
 * - Pure White / Platinum / Titanium Silver Monochrome Luxury Aesthetic
 * - 3D Einstein Spacetime Curvature Funnel (引力时空塌陷网格)
 * - 5,200+ Keplerian Logarithmic Spiral Photonic Particles with Streak Trails
 * - 3D Liquid Mercury Superstring Ribbons with Cubic Bezier Splines
 * - Blinding White-Hot Photonic Core with Gravitational Infall & Pulse Compression
 * - Anamorphic Horizontal Pure White Flare & Polar Relativistic Jets
 * - Swiss Typography & Astrophysics HUD Telemetry
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
  const superstringTension = params.superstringTension || 1.2;
  const coreGlow = params.coreGlow || 1.6;

  // --- 1. SIGNAL EXTRACTION & AUDIO METRICS ---
  const getVal = (idx: number) => (data && data[idx] !== undefined ? data[idx] / 255 : 0);
  const rawBass = (getVal(0) + getVal(1) + getVal(2) + getVal(3) + getVal(4)) / 5;
  const rawMid = (getVal(12) + getVal(22) + getVal(34) + getVal(46)) / 4;
  const rawTreble = (getVal(64) + getVal(84) + getVal(104) + getVal(124)) / 4;

  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.82 + rawBass * 0.18;
  refs.smoothMid.current = (refs.smoothMid.current || 0) * 0.85 + rawMid * 0.15;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.88 + rawTreble * 0.12;

  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;
  const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;

  const t = (time || 0) * 0.0007 * speed;

  // --- 2. INITIALIZE 5,200+ PHOTONIC PARTICLES & SHOCKWAVES IN REFS ---
  if (!refs.particles.current || refs.particles.current.length === 0) {
    const particles: PhotonicParticle[] = [];
    const count = 5200;
    const arms = 3;

    for (let i = 0; i < count; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distRatio = Math.pow(Math.random(), 1.7);
      const radius = 25 + distRatio * 720;
      const spiralAngle = armAngle + Math.log(radius + 1) * 2.8 + (Math.random() - 0.5) * 0.4;
      const orbitSpeed = (0.008 + (1 / Math.sqrt(radius)) * 0.28) * 0.75;

      particles.push({
        radius,
        angle: spiralAngle,
        speed: orbitSpeed,
        height: (Math.random() - 0.5) * (15 + distRatio * 50),
        size: 0.4 + Math.random() * 2.0,
        brightness: 0.3 + Math.random() * 0.7,
        arm,
        trailLength: 2 + Math.random() * 6,
      });
    }
    refs.particles.current = particles;
  }

  if (!refs.shockwaves.current) refs.shockwaves.current = [];
  const shockwaves = refs.shockwaves.current as WhiteShockwave[];

  // Trigger high-intensity pure white shockwaves on heavy beat/bass
  if (bass > 0.65 && (shockwaves.length === 0 || shockwaves[shockwaves.length - 1].radius > 140)) {
    shockwaves.push({
      radius: 20 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.95,
      alpha: 0.95,
      speed: 10 + bass * 16,
      lineWidth: 2 + bass * 5,
    });
  }

  // --- 3. OBSIDIAN VOID BACKGROUND & VOLUMETRIC MONOCHROME HAZE ---
  ctx.save();
  ctx.fillStyle = "#020204";
  ctx.fillRect(0, 0, sw, sh);

  // Soft Monochrome Deep-Space Haze
  ctx.globalCompositeOperation = "screen";
  const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.75);
  bgGrd.addColorStop(0, `rgba(235, 245, 255, ${0.08 + bass * 0.08})`);
  bgGrd.addColorStop(0.35, `rgba(180, 205, 235, ${0.03 + mid * 0.04})`);
  bgGrd.addColorStop(0.7, `rgba(80, 100, 130, 0.01)`);
  bgGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, sw, sh);
  ctx.restore();

  // --- 4. 3D CAMERA & SPACETIME PERSPECTIVE MATRIX ---
  const fov = 540;
  const pitch = 0.64 + Math.sin(t * 0.25) * 0.04;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const rotAngle = t * 0.6;
  const cosR = Math.cos(rotAngle);
  const sinR = Math.sin(rotAngle);

  // --- 5. 3D EINSTEIN SPACETIME CURVATURE FUNNEL (引力时空塌陷网格) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const gridRings = 16;
  const gridSpokes = 24;
  const maxGridRadius = Math.max(sw, sh) * 0.75;

  // Draw Curvature Concentric Rings (Warping downward into center)
  for (let gr = 1; gr <= gridRings; gr++) {
    const ringFrac = gr / gridRings;
    const rRadius = Math.pow(ringFrac, 1.4) * maxGridRadius;
    const depthWarp = -Math.pow(1 - ringFrac, 2.2) * (180 + bass * 120) * singularityMass;
    const ringAlpha = (0.03 + ringFrac * 0.09) * (0.8 + energy * 0.4);

    ctx.beginPath();
    let first = true;
    for (let s = 0; s <= 60; s++) {
      const theta = (s / 60) * Math.PI * 2;
      const rawX = Math.cos(theta) * rRadius;
      const rawZ = Math.sin(theta) * rRadius;
      const rawY = depthWarp;

      const rx = rawX * cosR - rawZ * sinR;
      const rz = rawX * sinR + rawZ * cosR;
      const ry = rawY * cosP - rz * sinP;
      const finalZ = rawY * sinP + rz * cosP + fov;

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
    ctx.strokeStyle = `rgba(220, 235, 255, ${ringAlpha.toFixed(3)})`;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  // Draw Curvature Radial Spokes (Curves converging into singularity)
  for (let gs = 0; gs < gridSpokes; gs++) {
    const spokeAngle = (gs / gridSpokes) * Math.PI * 2;
    ctx.beginPath();
    let first = true;

    for (let seg = 1; seg <= 25; seg++) {
      const ringFrac = seg / 25;
      const rRadius = Math.pow(ringFrac, 1.4) * maxGridRadius;
      const depthWarp = -Math.pow(1 - ringFrac, 2.2) * (180 + bass * 120) * singularityMass;

      const rawX = Math.cos(spokeAngle) * rRadius;
      const rawZ = Math.sin(spokeAngle) * rRadius;
      const rawY = depthWarp;

      const rx = rawX * cosR - rawZ * sinR;
      const rz = rawX * sinR + rawZ * cosR;
      const ry = rawY * cosP - rz * sinP;
      const finalZ = rawY * sinP + rz * cosP + fov;

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
    ctx.strokeStyle = `rgba(200, 225, 255, ${0.04 + bass * 0.04})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.restore();

  // --- 6. PURE WHITE TRANSIENT SHOCKWAVES ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const swObj = shockwaves[i];
    swObj.radius += swObj.speed;
    swObj.alpha *= 0.935;

    if (swObj.alpha < 0.015 || swObj.radius > swObj.maxRadius) {
      shockwaves.splice(i, 1);
      continue;
    }

    const swGrd = ctx.createRadialGradient(
      cx,
      cy,
      Math.max(0, swObj.radius - 40),
      cx,
      cy,
      swObj.radius + 40
    );
    swGrd.addColorStop(0, "rgba(255,255,255,0)");
    swGrd.addColorStop(0.5, `rgba(255, 255, 255, ${(swObj.alpha * 0.95).toFixed(3)})`);
    swGrd.addColorStop(0.7, `rgba(210, 235, 255, ${(swObj.alpha * 0.4).toFixed(3)})`);
    swGrd.addColorStop(1, "rgba(255,255,255,0)");

    ctx.strokeStyle = swGrd;
    ctx.lineWidth = swObj.lineWidth;
    ctx.beginPath();
    ctx.arc(cx, cy, swObj.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // --- 7. RELATIVISTIC POLAR PLASMA JETS (PURE WHITE DUAL BEAMS) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const jetLen = (320 + treble * 520 + bass * 300) * coreGlow;
  const jetWidth = (8 + mid * 18) * coreGlow;

  const drawWhiteJet = (dir: 1 | -1) => {
    const targetY = cy + dir * jetLen;
    const jGrd = ctx.createLinearGradient(cx, cy, cx, targetY);
    jGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    jGrd.addColorStop(0.1, "rgba(240, 248, 255, 0.85)");
    jGrd.addColorStop(0.4, "rgba(190, 220, 255, 0.3)");
    jGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = jGrd;
    ctx.beginPath();
    ctx.moveTo(cx - jetWidth, cy);
    ctx.quadraticCurveTo(cx - jetWidth * 0.2, cy + dir * jetLen * 0.4, cx, targetY);
    ctx.quadraticCurveTo(cx + jetWidth * 0.2, cy + dir * jetLen * 0.4, cx + jetWidth, cy);
    ctx.closePath();
    ctx.fill();
  };

  drawWhiteJet(-1);
  drawWhiteJet(1);
  ctx.restore();

  // --- 8. 3D LIQUID MERCURY SUPERSTRING RIBBONS (CUBIC SPLINES) ---
  const ribbonCount = 6;
  const ribbonSegs = 80;
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let r = 0; r < ribbonCount; r++) {
    const phase = (r / ribbonCount) * Math.PI * 2 + t * 1.5 * superstringTension;
    const baseRadius = (70 + r * 52) * singularityMass * (1 + bass * 0.35);
    const points: { x: number; y: number }[] = [];

    for (let s = 0; s <= ribbonSegs; s++) {
      const theta = (s / ribbonSegs) * Math.PI * 2;
      const dataIdx = Math.floor((s / ribbonSegs) * (data?.length || 1));
      const wave = (((data && data[dataIdx]) || 128) - 128) / 128;

      const harm1 = Math.sin(theta * 3 + phase) * (20 + mid * 50);
      const harm2 = Math.cos(theta * 5 - phase * 1.2) * (12 + treble * 30);
      const audioWarp = wave * (36 * superstringTension + bass * 30);

      const curR = baseRadius + harm1 + harm2 + audioWarp;
      const rawX = Math.cos(theta) * curR;
      const rawY = Math.sin(theta * 3 + phase) * (22 + mid * 40) + wave * 20;
      const rawZ = Math.sin(theta) * curR;

      const rx = rawX * cosR - rawZ * sinR;
      const rz = rawX * sinR + rawZ * cosR;
      const ry = rawY * cosP - rz * sinP;
      const finalZ = rawY * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      points.push({
        x: cx + rx * scale,
        y: cy + ry * scale,
      });
    }

    if (points.length > 3) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let p = 0; p < points.length - 1; p++) {
        const p0 = points[p];
        const p1 = points[p + 1];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }
      ctx.closePath();

      // Liquid Mercury Silver-White Glow
      const alpha = 0.5 + mid * 0.45;
      ctx.strokeStyle = `rgba(245, 250, 255, ${alpha.toFixed(3)})`;
      ctx.lineWidth = (1.6 + (r % 2) * 0.8 + bass * 1.8) * coreGlow;
      ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
      ctx.shadowBlur = (14 + mid * 24) * coreGlow;
      ctx.stroke();
    }
  }
  ctx.restore();

  // --- 9. 5,200+ PHOTONIC ACCRETION PARTICLES WITH STREAK TRAILS ---
  const particles = refs.particles.current as PhotonicParticle[];
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const speedMult = (1 + energy * 2.2 + bass * 1.6) * superstringTension;
    p.angle += p.speed * speedMult;

    // Logarithmic Infall toward center
    const curR = p.radius * (1 + Math.sin(t * 2.5 + p.angle * 3) * (0.04 + bass * 0.16));
    const pxRaw = Math.cos(p.angle) * curR;
    const pyRaw = p.height + Math.sin(t * 3 + p.radius * 0.05) * (10 + treble * 25);
    const pzRaw = Math.sin(p.angle) * curR;

    const rx = pxRaw * cosR - pzRaw * sinR;
    const rz = pxRaw * sinR + pzRaw * cosR;
    const ry = pyRaw * cosP - rz * sinP;
    const finalZ = pyRaw * sinP + rz * cosP + fov;

    if (finalZ <= 10) continue;
    const scale = fov / finalZ;
    const screenX = cx + rx * scale;
    const screenY = cy + ry * scale;

    // Velocity vector for Streak Trail
    const tangentAngle = p.angle + Math.PI / 2;
    const streakLen = p.trailLength * scale * (1 + bass * 1.5) * (180 / curR);
    const streakEndX = screenX + Math.cos(tangentAngle) * streakLen;
    const streakEndY = screenY + Math.sin(tangentAngle) * streakLen * cosP;

    const pAlpha = Math.min(1, p.brightness * (0.35 + energy * 0.75) * (scale * 0.95));
    const pSize = Math.max(0.5, p.size * scale * (1 + treble * 1.2));

    // Particle Streak Line
    ctx.strokeStyle = `rgba(240, 248, 255, ${(pAlpha * 0.8).toFixed(3)})`;
    ctx.lineWidth = pSize * 0.7;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(streakEndX, streakEndY);
    ctx.stroke();

    // Particle Luminous Head
    ctx.fillStyle = `rgba(255, 255, 255, ${pAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(screenX, screenY, pSize, 0, Math.PI * 2);
    ctx.fill();

    // High energy specular bloom for prominent particles
    if (p.size > 1.6 && pAlpha > 0.5) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(pAlpha * 0.35).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, pSize * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // --- 10. CINEMATIC ANAMORPHIC HORIZONTAL PURE WHITE FLARE ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const flareW = sw * (0.65 + bass * 0.35);
  const flareH = (8 + bass * 20) * coreGlow;

  const flareGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, flareW);
  flareGrd.addColorStop(0, `rgba(255, 255, 255, ${0.9 + bass * 0.1})`);
  flareGrd.addColorStop(0.15, `rgba(230, 245, 255, 0.65)`);
  flareGrd.addColorStop(0.45, `rgba(180, 210, 245, 0.18)`);
  flareGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = flareGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, flareW, flareH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 11. BLINDING WHITE-HOT PHOTONIC SINGULARITY CORE ---
  // Gravitational Infall & Pulse: Inhales on buildup, explodes outward on beat
  const coreRadius = (16 + bass * 22) * singularityMass * coreGlow;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // Massive Multi-Layered Soft Ambient Glow
  const glowGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 4.5);
  glowGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  glowGrd.addColorStop(0.2, `rgba(240, 250, 255, ${0.85 + bass * 0.15})`);
  glowGrd.addColorStop(0.5, `rgba(190, 225, 255, ${0.4 + mid * 0.3})`);
  glowGrd.addColorStop(0.8, "rgba(100, 150, 220, 0.08)");
  glowGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = glowGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Ultra-Bright White-Hot Photonic Core Point
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // High-Energy Photon Halo Edge
  ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";
  ctx.lineWidth = 2.5 + bass * 3.5;
  ctx.shadowColor = "#FFFFFF";
  ctx.shadowBlur = 30 * coreGlow;
  ctx.stroke();
  ctx.restore();

  // --- 12. MONOCHROME SWISS ASTROPHYSICS HUD TELEMETRY OVERLAY ---
  ctx.save();
  ctx.font = "10px 'SF Mono', 'Roboto Mono', monospace";
  ctx.fillStyle = "rgba(220, 235, 255, 0.45)";
  ctx.textBaseline = "top";

  // Top Left: Quantum Metric
  ctx.fillText("QUANTUM METRIC // PURE PHOTONIC SINGULARITY", 32, 32);
  ctx.fillText(`GRAVITATIONAL ACCEL: ${(9.81 * (1 + bass * 12.5)).toFixed(2)} G`, 32, 48);
  ctx.fillText(`PHOTON SPHERE RADIUS: ${(coreRadius).toFixed(1)} px`, 32, 64);
  ctx.fillText(`SUPERSTRING FREQ: ${(superstringTension * 100).toFixed(0)} GHz`, 32, 80);

  // Top Right: Realtime Acoustic Spectrum
  ctx.textAlign = "right";
  ctx.fillText("ACOUSTIC HARMONICS // REALTIME FFT", sw - 32, 32);
  ctx.fillText(`SUB-BASS [20-150Hz]: ${(bass * 100).toFixed(0)}%`, sw - 32, 48);
  ctx.fillText(`MID-VOX [300-2kHz]: ${(mid * 100).toFixed(0)}%`, sw - 32, 64);
  ctx.fillText(`TREBLE-AIR [2-16kHz]: ${(treble * 100).toFixed(0)}%`, sw - 32, 80);

  // Precision Reticle Corner Marks
  ctx.strokeStyle = "rgba(200, 225, 255, 0.3)";
  ctx.lineWidth = 1;
  const markSize = 12;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(24, 24 + markSize);
  ctx.lineTo(24, 24);
  ctx.lineTo(24 + markSize, 24);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(sw - 24 - markSize, 24);
  ctx.lineTo(sw - 24, 24);
  ctx.lineTo(sw - 24, 24 + markSize);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(24, sh - 24 - markSize);
  ctx.lineTo(24, sh - 24);
  ctx.lineTo(24 + markSize, sh - 24);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(sw - 24 - markSize, sh - 24);
  ctx.lineTo(sw - 24, sh - 24);
  ctx.lineTo(sw - 24, sh - 24 - markSize);
  ctx.stroke();

  ctx.restore();
}
