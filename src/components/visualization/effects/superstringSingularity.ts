import { EffectContext } from "./types";

interface StardustParticle {
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  verticalAmp: number;
  verticalFreq: number;
  size: number;
  alpha: number;
  hueOffset: number;
  depth: number;
}

interface NebulaPuff {
  x: number;
  y: number;
  r: number;
  hue: number;
  alpha: number;
  vx: number;
  vy: number;
}

interface ShockwaveWaveform {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  hue: number;
  energy: number;
}

/**
 * QUANTUM SUPERSTRING SINGULARITY (次世代电影级量子超弦引力奇点)
 * Design Direction: Interstellar / Dune / Denis Villeneuve / High-End Generative Art
 * Color Palette: Deep Space Obsidian, Bioluminescent Cyan, Ethereal Violet, Solar Gold
 */
export function drawSuperstringSingularity({
  ctx,
  width,
  height,
  data,
  time,
  params = {},
  theme,
  refs,
}: EffectContext) {
  const sw = width || 1920;
  const sh = height || 1080;
  const cx = sw / 2;
  const cy = sh / 2;

  const speed = params.speed || 1.0;
  const singularityMass = params.singularityMass || 1.0;
  const superstringTension = params.superstringTension || 1.2;
  const coreGlow = params.coreGlow || 1.5;

  // --- 1. SIGNAL EXTRACTION & CINEMATIC SMOOTHING ---
  const getVal = (idx: number) => (data && data[idx] !== undefined ? data[idx] / 255 : 0);
  const rawBass = (getVal(0) + getVal(1) + getVal(2) + getVal(3) + getVal(4)) / 5;
  const rawMid = (getVal(15) + getVal(25) + getVal(35) + getVal(45)) / 4;
  const rawTreble = (getVal(70) + getVal(90) + getVal(110) + getVal(130)) / 4;
  const rawEnergy = rawBass * 0.55 + rawMid * 0.3 + rawTreble * 0.15;

  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.84 + rawBass * 0.16;
  refs.smoothMid.current = (refs.smoothMid.current || 0) * 0.86 + rawMid * 0.14;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.88 + rawTreble * 0.12;

  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;
  const energy = (bass * 0.5 + mid * 0.3 + treble * 0.2);

  const t = (time || 0) * 0.0006 * speed;

  // Refined Luxury Color System (Calibrated OKLCH-like HSLA tones)
  const baseHue = theme.primary || 265; // Deep Violet
  const cyanHue = 192; // Electric Cyan
  const goldHue = 42; // Solar Champagne Gold
  const purpleHue = 295; // Ethereal Purple

  // --- 2. INITIALIZE PARTICLES, NEBULA & SHOCKWAVES IN REFS ---
  if (!refs.particles.current || refs.particles.current.length === 0) {
    const particles: StardustParticle[] = [];
    const count = 4200;
    const arms = 3;

    for (let i = 0; i < count; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distRatio = Math.pow(Math.random(), 1.8);
      const radius = 55 + distRatio * 680;
      const spiralAngle = armAngle + radius * 0.012 + (Math.random() - 0.5) * 0.5;
      const orbitSpeed = (0.006 + (1 / Math.sqrt(radius)) * 0.18) * 0.7;

      particles.push({
        orbitRadius: radius,
        orbitAngle: spiralAngle,
        orbitSpeed,
        verticalAmp: 12 + Math.random() * 38 * distRatio,
        verticalFreq: 1 + Math.random() * 2.5,
        size: 0.5 + Math.random() * 2.0,
        alpha: 0.2 + Math.random() * 0.75,
        hueOffset: (Math.random() - 0.5) * 40,
        depth: Math.random(),
      });
    }
    refs.particles.current = particles;
  }

  if (!refs.nebulaStars.current || refs.nebulaStars.current.length === 0) {
    const nebulae: NebulaPuff[] = [];
    for (let i = 0; i < 7; i++) {
      nebulae.push({
        x: (Math.random() - 0.5) * sw * 0.7,
        y: (Math.random() - 0.5) * sh * 0.6,
        r: 250 + Math.random() * 350,
        hue: i % 2 === 0 ? purpleHue : cyanHue,
        alpha: 0.035 + Math.random() * 0.045,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.05,
      });
    }
    refs.nebulaStars.current = nebulae;
  }

  if (!refs.shockwaves.current) refs.shockwaves.current = [];
  const shockwaves = refs.shockwaves.current as ShockwaveWaveform[];

  // Trigger high-end fluid shockwaves on deep bass hits
  if (bass > 0.68 && (shockwaves.length === 0 || shockwaves[shockwaves.length - 1].radius > 160)) {
    shockwaves.push({
      radius: 40 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.9,
      alpha: 0.75,
      speed: 8 + bass * 12,
      hue: cyanHue,
      energy: bass,
    });
  }

  // --- 3. CINEMATIC BACKGROUND: OBSIDIAN VOID & VOLUMETRIC NEBULA ---
  ctx.save();
  // Deep space obsidian gradient
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.85);
  bgGrad.addColorStop(0, `hsla(${baseHue}, 50%, 6%, 1)`);
  bgGrad.addColorStop(0.6, `hsla(${baseHue}, 40%, 3%, 1)`);
  bgGrad.addColorStop(1, "#020105");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, sw, sh);

  // Volumetric Ethereal Nebula Gas
  ctx.globalCompositeOperation = "screen";
  const nebulae = refs.nebulaStars.current as NebulaPuff[];
  for (let i = 0; i < nebulae.length; i++) {
    const neb = nebulae[i];
    neb.x += neb.vx;
    neb.y += neb.vy;
    const nx = cx + neb.x + Math.sin(t * 0.4 + i) * 50;
    const ny = cy + neb.y + Math.cos(t * 0.3 + i) * 35;
    const nRadius = neb.r * (1 + bass * 0.3);

    const nebGrd = ctx.createRadialGradient(nx, ny, 0, nx, ny, nRadius);
    const nAlpha = neb.alpha * (0.8 + energy * 0.7);
    nebGrd.addColorStop(0, `hsla(${neb.hue}, 85%, 55%, ${nAlpha.toFixed(3)})`);
    nebGrd.addColorStop(0.5, `hsla(${(neb.hue + 30) % 360}, 80%, 35%, ${(nAlpha * 0.35).toFixed(3)})`);
    nebGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = nebGrd;
    ctx.beginPath();
    ctx.arc(nx, ny, nRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Drifting Star Dust Micro-Points (Background cosmic dust)
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  for (let i = 0; i < 80; i++) {
    const sx = ((i * 137.5 + t * 20) % sw);
    const sy = ((i * 93.3 + Math.sin(i + t) * 15) % sh);
    const sAlpha = 0.2 + (Math.sin(t * 3 + i) * 0.5 + 0.5) * 0.6;
    ctx.fillStyle = `rgba(220, 235, 255, ${sAlpha.toFixed(2)})`;
    ctx.fillRect(sx, sy, 1.2, 1.2);
  }
  ctx.restore();

  // --- 4. GRAVITATIONAL SHOCKWAVES WITH VOLUMETRIC DISPERSION ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const swObj = shockwaves[i];
    swObj.radius += swObj.speed;
    swObj.alpha *= 0.945;

    if (swObj.alpha < 0.015 || swObj.radius > swObj.maxRadius) {
      shockwaves.splice(i, 1);
      continue;
    }

    const swGrd = ctx.createRadialGradient(
      cx,
      cy,
      Math.max(0, swObj.radius - 35),
      cx,
      cy,
      swObj.radius + 35
    );
    swGrd.addColorStop(0, "rgba(0,0,0,0)");
    swGrd.addColorStop(0.45, `hsla(${swObj.hue}, 95%, 75%, ${(swObj.alpha * 0.7).toFixed(3)})`);
    swGrd.addColorStop(0.55, `hsla(${goldHue}, 100%, 85%, ${(swObj.alpha * 0.9).toFixed(3)})`);
    swGrd.addColorStop(1, "rgba(0,0,0,0)");

    ctx.strokeStyle = swGrd;
    ctx.lineWidth = 3 + swObj.energy * 4;
    ctx.beginPath();
    ctx.arc(cx, cy, swObj.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // --- 5. 3D CAMERA & KERR SPACETIME PROJECTION MATRIX ---
  const fov = 520;
  const pitch = 0.62 + Math.sin(t * 0.3) * 0.05;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const rotAngle = t * 0.55;
  const cosR = Math.cos(rotAngle);
  const sinR = Math.sin(rotAngle);

  // --- 6. RELATIVISTIC POLAR PLASMA QUASAR JETS (SOFT GOD-RAYS) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const jetLength = (280 + treble * 450 + bass * 260) * coreGlow;
  const jetWidth = (10 + mid * 22) * coreGlow;

  // Smooth Dual Hyperbolic Beams
  const drawJet = (dir: 1 | -1) => {
    const targetY = cy + dir * jetLength;
    const jGrad = ctx.createLinearGradient(cx, cy, cx, targetY);
    jGrad.addColorStop(0, `hsla(${goldHue}, 100%, 95%, 0.9)`);
    jGrad.addColorStop(0.12, `hsla(${cyanHue}, 95%, 80%, 0.7)`);
    jGrad.addColorStop(0.45, `hsla(${purpleHue}, 90%, 65%, 0.25)`);
    jGrad.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = jGrad;
    ctx.beginPath();
    ctx.moveTo(cx - jetWidth, cy);
    ctx.quadraticCurveTo(cx - jetWidth * 0.25, cy + dir * jetLength * 0.5, cx, targetY);
    ctx.quadraticCurveTo(cx + jetWidth * 0.25, cy + dir * jetLength * 0.5, cx + jetWidth, cy);
    ctx.closePath();
    ctx.fill();
  };

  drawJet(-1); // Upward jet
  drawJet(1);  // Downward jet
  ctx.restore();

  // --- 7. INTERSTELLAR KERR METRIC GRAVITATIONAL LENSING ARCHES ---
  const coreRadius = 48 * singularityMass * (1 + bass * 0.4);
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // Upper Lensed Arch (Smooth curved photon halo over black hole)
  const upperLensedGrad = ctx.createRadialGradient(
    cx,
    cy - coreRadius * 0.35,
    coreRadius * 0.7,
    cx,
    cy - coreRadius * 0.35,
    coreRadius * 3.6 * coreGlow
  );
  upperLensedGrad.addColorStop(0, `hsla(${goldHue}, 100%, 90%, 0.95)`);
  upperLensedGrad.addColorStop(0.2, `hsla(${cyanHue}, 95%, 75%, 0.7)`);
  upperLensedGrad.addColorStop(0.55, `hsla(${purpleHue}, 90%, 55%, 0.22)`);
  upperLensedGrad.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = upperLensedGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy - coreRadius * 0.35, coreRadius * 2.9 * coreGlow, coreRadius * 1.7 * coreGlow, 0, Math.PI, 0);
  ctx.fill();

  // Lower Lensed Arch
  ctx.beginPath();
  ctx.ellipse(cx, cy + coreRadius * 0.35, coreRadius * 2.6 * coreGlow, coreRadius * 1.3 * coreGlow, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();

  // --- 8. SMOOTH CALABI-YAU SUPERSTRING WAVEFORM RIBBONS (CUBIC SPLINES) ---
  const ribbonCount = 7;
  const ribbonSegments = 72;
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let r = 0; r < ribbonCount; r++) {
    const ribbonPhase = (r / ribbonCount) * Math.PI * 2 + t * 1.4 * superstringTension;
    const ribbonRadius = (80 + r * 48) * singularityMass * (1 + bass * 0.32);
    // Cohesive elegant color palette: smoothly transitions from Electric Cyan -> Ethereal Lavender -> Solar Gold
    const ribbonHue = r % 2 === 0 ? (cyanHue + r * 15) % 360 : (purpleHue + r * 10) % 360;

    const points: { x: number; y: number }[] = [];

    for (let s = 0; s <= ribbonSegments; s++) {
      const theta = (s / ribbonSegments) * Math.PI * 2;
      const dataIdx = Math.floor((s / ribbonSegments) * (data?.length || 1));
      const waveVal = (((data && data[dataIdx]) || 128) - 128) / 128;

      const harm1 = Math.sin(theta * 4 + ribbonPhase) * (18 + mid * 45);
      const harm2 = Math.cos(theta * 6 - ribbonPhase * 1.2) * (10 + treble * 28);
      const audioDisp = waveVal * (32 * superstringTension + bass * 26);

      const currentR = ribbonRadius + harm1 + harm2 + audioDisp;
      const rawX = Math.cos(theta) * currentR;
      const rawY = Math.sin(theta * 3 + ribbonPhase) * (20 + mid * 36) + waveVal * 18;
      const rawZ = Math.sin(theta) * currentR;

      // 3D Projection
      const rx = rawX * cosR - rawZ * sinR;
      const rz = rawX * sinR + rawZ * cosR;
      const ry = rawY * cosP - rz * sinP;
      const finalZ = rawY * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const projScale = fov / finalZ;
      points.push({
        x: cx + rx * projScale,
        y: cy + ry * projScale,
      });
    }

    if (points.length > 3) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      // Smooth Spline interpolation using quadratic bezier midpoint curves
      for (let p = 0; p < points.length - 1; p++) {
        const p0 = points[p];
        const p1 = points[p + 1];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }
      ctx.closePath();

      ctx.strokeStyle = `hsla(${ribbonHue}, 95%, ${70 + mid * 20}%, ${0.5 + mid * 0.4})`;
      ctx.lineWidth = (1.8 + (r % 3) * 0.8 + bass * 1.6) * coreGlow;
      ctx.shadowColor = `hsla(${ribbonHue}, 100%, 75%, 0.85)`;
      ctx.shadowBlur = (12 + mid * 20) * coreGlow;
      ctx.stroke();
    }
  }
  ctx.restore();

  // --- 9. ACCRETION DISK STARDUST PARTICLES (4,200+ WITH DOPPLER BEAMING) ---
  const particles = refs.particles.current as StardustParticle[];
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const speedMult = (1 + energy * 2.0 + bass * 1.4) * superstringTension;
    p.orbitAngle += p.orbitSpeed * speedMult;

    const currentRadius = p.orbitRadius * (1 + Math.sin(t * 2.2 + p.orbitAngle * 3) * (0.05 + bass * 0.18));
    const pxRaw = Math.cos(p.orbitAngle) * currentRadius;
    const pyRaw = Math.sin(t * p.verticalFreq + p.orbitRadius * 0.06) * (p.verticalAmp * (1 + treble * 1.5));
    const pzRaw = Math.sin(p.orbitAngle) * currentRadius;

    // 3D Matrix Transform
    const rx = pxRaw * cosR - pzRaw * sinR;
    const rz = pxRaw * sinR + pzRaw * cosR;
    const ry = pyRaw * cosP - rz * sinP;
    const finalZ = pyRaw * sinP + rz * cosP + fov;

    if (finalZ <= 10) continue;
    const projScale = fov / finalZ;
    const screenX = cx + rx * projScale;
    const screenY = cy + ry * projScale;

    // Doppler Beaming Effect (Approaching = bright cyan/gold, Receding = dimmer violet)
    const doppler = Math.sin(p.orbitAngle + rotAngle);
    const dopplerBrightness = 1 + doppler * 0.4;
    const pHue = doppler > 0 ? (cyanHue + p.hueOffset) % 360 : (purpleHue + p.hueOffset) % 360;

    const particleSize = p.size * projScale * (1 + treble * 1.2);
    const alpha = Math.min(1, p.alpha * (0.3 + energy * 0.7) * (projScale * 0.9) * dopplerBrightness);

    ctx.fillStyle = `hsla(${pHue}, 95%, ${72 + treble * 22}%, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(screenX, screenY, Math.max(0.5, particleSize), 0, Math.PI * 2);
    ctx.fill();

    // High energy stardust specular bloom
    if (p.size > 1.7 && alpha > 0.45) {
      ctx.fillStyle = `hsla(${goldHue}, 100%, 85%, ${(alpha * 0.4).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, particleSize * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // --- 10. CINEMATIC ANAMORPHIC HORIZONTAL LENS FLARE (GAUSSIAN FALLOFF) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const flareWidth = sw * (0.65 + bass * 0.35);
  const flareHeight = (12 + bass * 28) * coreGlow;

  const flareGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, flareWidth);
  flareGrd.addColorStop(0, `hsla(${goldHue}, 100%, 96%, ${0.85 + bass * 0.15})`);
  flareGrd.addColorStop(0.15, `hsla(${cyanHue}, 95%, 80%, 0.55)`);
  flareGrd.addColorStop(0.45, `hsla(${purpleHue}, 90%, 65%, 0.18)`);
  flareGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = flareGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, flareWidth, flareHeight, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 11. CENTRAL PHOTON CAPTURE RING & EVENT HORIZON ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // High-Energy Radial Corona
  const coronaGrd = ctx.createRadialGradient(
    cx,
    cy,
    coreRadius * 0.5,
    cx,
    cy,
    coreRadius * 3.5 * coreGlow
  );
  coronaGrd.addColorStop(0, `hsla(${goldHue}, 100%, 95%, 0.95)`);
  coronaGrd.addColorStop(0.22, `hsla(${cyanHue}, 100%, 75%, 0.75)`);
  coronaGrd.addColorStop(0.55, `hsla(${purpleHue}, 95%, 55%, 0.28)`);
  coronaGrd.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = coronaGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 3.5 * coreGlow, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Void Black Event Horizon
  ctx.save();
  ctx.fillStyle = "#010003";
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 0.95, 0, Math.PI * 2);
  ctx.fill();

  // Event Horizon Relativistic Edge Glow
  ctx.strokeStyle = `hsla(${goldHue}, 100%, 92%, ${0.88 + bass * 0.12})`;
  ctx.lineWidth = (3.5 + bass * 4.5) * coreGlow;
  ctx.shadowColor = `hsla(${cyanHue}, 100%, 80%, 1)`;
  ctx.shadowBlur = (26 + bass * 38) * coreGlow;
  ctx.stroke();
  ctx.restore();

  // --- 12. CINEMATIC ASTROPHYSICS HUD TELEMETRY OVERLAY ---
  ctx.save();
  ctx.font = "10px 'SF Mono', 'Roboto Mono', monospace";
  ctx.fillStyle = "rgba(200, 225, 255, 0.4)";
  ctx.textBaseline = "top";

  // Top Left: Gravitational Metrics
  ctx.fillText("SINGULARITY METRIC // KERR-dS", 32, 32);
  ctx.fillText(`GRAVITATIONAL MASS: ${(singularityMass * (1 + bass * 0.3)).toFixed(3)} M☉`, 32, 48);
  ctx.fillText(`EVENT HORIZON RAD: ${(coreRadius).toFixed(1)} px`, 32, 64);
  ctx.fillText(`SUPERSTRING TENSION: ${superstringTension.toFixed(2)} α'`, 32, 80);

  // Top Right: Realtime Audio Harmonics
  ctx.textAlign = "right";
  ctx.fillText("ACOUSTIC HARMONICS MATRIX", sw - 32, 32);
  ctx.fillText(`SUB-BASS [20-150Hz]: ${(bass * 100).toFixed(0)}%`, sw - 32, 48);
  ctx.fillText(`MID-VOX [300-2kHz]: ${(mid * 100).toFixed(0)}%`, sw - 32, 64);
  ctx.fillText(`TREBLE-AIR [2-16kHz]: ${(treble * 100).toFixed(0)}%`, sw - 32, 80);

  // Corner Reticle Marks
  ctx.strokeStyle = "rgba(100, 180, 255, 0.25)";
  ctx.lineWidth = 1;
  const markSize = 14;

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
