import { EffectContext } from "./types";

interface StardustParticle {
  x: number;
  y: number;
  z: number;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  verticalAmplitude: number;
  verticalFreq: number;
  size: number;
  baseAlpha: number;
  hueShift: number;
  armIndex: number;
}

interface Shockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  hue: number;
  width: number;
}

interface NebulaCloud {
  x: number;
  y: number;
  radius: number;
  hue: number;
  alpha: number;
  speed: number;
}

/**
 * QUANTUM SUPERSTRING SINGULARITY (次世代量子超弦引力奇点)
 * - Interstellar Gravitational Lensing (Kerr Metric Photonic Arch)
 * - 4,000+ Keplerian Accretion Stardust with Doppler Beaming
 * - Multi-dimensional Calabi-Yau Superstring Silk Ribbons
 * - Relativistic Polar Plasma Jets & Anamorphic Lens Flare
 * - Multi-layer Volumetric Cosmic Nebula & Chromatic Shockwaves
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
  const coreGlow = params.coreGlow || 1.6;

  // --- 1. SIGNAL PROCESSING & SMOOTHING ---
  const getVal = (idx: number) => (data && data[idx] !== undefined ? data[idx] / 255 : 0);
  const rawBass = ((getVal(0) + getVal(1) + getVal(2) + getVal(3)) / 4);
  const rawMid = ((getVal(12) + getVal(24) + getVal(36)) / 3);
  const rawTreble = ((getVal(60) + getVal(80) + getVal(100)) / 3);
  const rawEnergy = (rawBass * 0.5 + rawMid * 0.3 + rawTreble * 0.2);

  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.82 + rawBass * 0.18;
  refs.smoothMid.current = (refs.smoothMid.current || 0) * 0.85 + rawMid * 0.15;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.88 + rawTreble * 0.12;

  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;
  const energy = (bass + mid + treble) / 3;

  const t = (time || 0) * 0.0008 * speed;

  // Dynamic Theme Colors
  const baseHue = theme.primary || 275;
  const secondaryHue = theme.secondary || 190;
  const accentHue = theme.accent || 335;

  // --- 2. INITIALIZE PARTICLES, NEBULA & SHOCKWAVES IN REFS ---
  if (!refs.particles.current || refs.particles.current.length === 0) {
    const particles: StardustParticle[] = [];
    const count = 3600;
    const arms = 4;

    for (let i = 0; i < count; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distRatio = Math.pow(Math.random(), 1.6);
      const radius = 60 + distRatio * 620;
      const spiralAngle = armAngle + (radius * 0.015) + (Math.random() - 0.5) * 0.6;
      const orbitSpeed = (0.008 + (1 / Math.sqrt(radius)) * 0.22) * 0.6;

      particles.push({
        x: 0,
        y: 0,
        z: 0,
        orbitRadius: radius,
        orbitAngle: spiralAngle,
        orbitSpeed,
        verticalAmplitude: 15 + Math.random() * 45 * distRatio,
        verticalFreq: 1 + Math.random() * 3,
        size: 0.6 + Math.random() * 2.4,
        baseAlpha: 0.25 + Math.random() * 0.75,
        hueShift: (Math.random() - 0.5) * 60,
        armIndex: arm,
      });
    }
    refs.particles.current = particles;
  }

  if (!refs.nebulaStars.current || refs.nebulaStars.current.length === 0) {
    const nebulae: NebulaCloud[] = [];
    for (let i = 0; i < 9; i++) {
      nebulae.push({
        x: (Math.random() - 0.5) * sw * 0.8,
        y: (Math.random() - 0.5) * sh * 0.8,
        radius: 200 + Math.random() * 400,
        hue: i % 2 === 0 ? baseHue : i % 3 === 0 ? accentHue : secondaryHue,
        alpha: 0.04 + Math.random() * 0.06,
        speed: (Math.random() - 0.5) * 0.002,
      });
    }
    refs.nebulaStars.current = nebulae;
  }

  // --- 3. COSMIC DEEP SPACE BACKGROUND & VOLUMETRIC NEBULA ---
  ctx.save();
  ctx.fillStyle = "#020108";
  ctx.fillRect(0, 0, sw, sh);

  // Volumetric Nebula Gas Clouds
  ctx.globalCompositeOperation = "screen";
  const nebulae = refs.nebulaStars.current as NebulaCloud[];
  for (let i = 0; i < nebulae.length; i++) {
    const neb = nebulae[i];
    const nx = cx + neb.x + Math.sin(t * neb.speed + i) * 60;
    const ny = cy + neb.y + Math.cos(t * neb.speed + i) * 40;
    const nRadius = neb.radius * (1 + bass * 0.25);

    const nebGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nRadius);
    const nAlpha = neb.alpha * (0.8 + energy * 0.6);
    nebGrad.addColorStop(0, `hsla(${neb.hue}, 90%, 55%, ${nAlpha.toFixed(3)})`);
    nebGrad.addColorStop(0.45, `hsla(${(neb.hue + 25) % 360}, 85%, 40%, ${(nAlpha * 0.4).toFixed(3)})`);
    nebGrad.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = nebGrad;
    ctx.beginPath();
    ctx.arc(nx, ny, nRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- 4. BEAT TRIGGERED CHROMATIC SHOCKWAVES ---
  if (!refs.shockwaves.current) refs.shockwaves.current = [];
  const shockwaves = refs.shockwaves.current as Shockwave[];

  if (bass > 0.65 && (shockwaves.length === 0 || shockwaves[shockwaves.length - 1].radius > 120)) {
    shockwaves.push({
      radius: 45 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.85,
      alpha: 0.9,
      speed: 9 + bass * 14,
      hue: (accentHue + (Math.random() - 0.5) * 40) % 360,
      width: 2 + bass * 5,
    });
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const swObj = shockwaves[i];
    swObj.radius += swObj.speed;
    swObj.alpha *= 0.94;

    if (swObj.alpha < 0.02 || swObj.radius > swObj.maxRadius) {
      shockwaves.splice(i, 1);
      continue;
    }

    const swGrad = ctx.createRadialGradient(
      cx,
      cy,
      Math.max(0, swObj.radius - swObj.width * 4),
      cx,
      cy,
      swObj.radius + swObj.width * 4
    );
    swGrad.addColorStop(0, "rgba(0,0,0,0)");
    swGrad.addColorStop(0.5, `hsla(${swObj.hue}, 95%, 72%, ${swObj.alpha.toFixed(3)})`);
    swGrad.addColorStop(1, "rgba(0,0,0,0)");

    ctx.strokeStyle = swGrad;
    ctx.lineWidth = swObj.width;
    ctx.beginPath();
    ctx.arc(cx, cy, swObj.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // --- 5. 3D CAMERA & KERR METRIC GEOMETRY ---
  const fov = 480;
  const pitch = 0.58 + Math.sin(t * 0.35) * 0.06;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const rotAngle = t * 0.6;
  const cosR = Math.cos(rotAngle);
  const sinR = Math.sin(rotAngle);

  // --- 6. RELATIVISTIC POLAR PLASMA JETS (HIGH FREQUENCY QUASAR JETS) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const jetLength = (220 + treble * 380 + bass * 240) * coreGlow;
  const jetBaseWidth = (14 + mid * 26) * coreGlow;

  // Upward Jet
  const jetUpGrad = ctx.createLinearGradient(cx, cy, cx, cy - jetLength);
  jetUpGrad.addColorStop(0, `hsla(${accentHue}, 100%, 95%, 0.95)`);
  jetUpGrad.addColorStop(0.15, `hsla(${baseHue}, 95%, 75%, 0.75)`);
  jetUpGrad.addColorStop(0.55, `hsla(${secondaryHue}, 90%, 60%, 0.3)`);
  jetUpGrad.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = jetUpGrad;
  ctx.beginPath();
  ctx.moveTo(cx - jetBaseWidth, cy);
  ctx.quadraticCurveTo(cx - jetBaseWidth * 0.3, cy - jetLength * 0.5, cx, cy - jetLength);
  ctx.quadraticCurveTo(cx + jetBaseWidth * 0.3, cy - jetLength * 0.5, cx + jetBaseWidth, cy);
  ctx.closePath();
  ctx.fill();

  // Downward Jet
  const jetDownGrad = ctx.createLinearGradient(cx, cy, cx, cy + jetLength);
  jetDownGrad.addColorStop(0, `hsla(${accentHue}, 100%, 95%, 0.95)`);
  jetDownGrad.addColorStop(0.15, `hsla(${baseHue}, 95%, 75%, 0.75)`);
  jetDownGrad.addColorStop(0.55, `hsla(${secondaryHue}, 90%, 60%, 0.3)`);
  jetDownGrad.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = jetDownGrad;
  ctx.beginPath();
  ctx.moveTo(cx - jetBaseWidth, cy);
  ctx.quadraticCurveTo(cx - jetBaseWidth * 0.3, cy + jetLength * 0.5, cx, cy + jetLength);
  ctx.quadraticCurveTo(cx + jetBaseWidth * 0.3, cy + jetLength * 0.5, cx + jetBaseWidth, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- 7. GRAVITATIONAL LENSING: UPPER & LOWER PHOTON ARCHES (INTERSTELLAR EINSTEIN RING) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const coreRadius = 52 * singularityMass * (1 + bass * 0.45);

  // Upper Lensed Arch (Bending light from back of disk upward)
  const lensedArchGrad = ctx.createRadialGradient(
    cx,
    cy - coreRadius * 0.4,
    coreRadius * 0.8,
    cx,
    cy - coreRadius * 0.4,
    coreRadius * 3.2 * coreGlow
  );
  lensedArchGrad.addColorStop(0, `hsla(${accentHue}, 100%, 88%, 0.9)`);
  lensedArchGrad.addColorStop(0.25, `hsla(${baseHue}, 95%, 70%, 0.65)`);
  lensedArchGrad.addColorStop(0.6, `hsla(${secondaryHue}, 90%, 55%, 0.25)`);
  lensedArchGrad.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = lensedArchGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy - coreRadius * 0.4, coreRadius * 2.8 * coreGlow, coreRadius * 1.8 * coreGlow, 0, Math.PI, 0);
  ctx.fill();

  // Lower Lensed Arch (Bending light from back of disk downward)
  ctx.beginPath();
  ctx.ellipse(cx, cy + coreRadius * 0.4, coreRadius * 2.5 * coreGlow, coreRadius * 1.4 * coreGlow, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();

  // --- 8. SUPERSTRING SILK HARMONIC RIBBONS (3D CALABI-YAU WAVEFORM FLOW) ---
  const ribbonCount = 9;
  const ribbonSteps = 120;
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let r = 0; r < ribbonCount; r++) {
    const ribbonPhase = (r / ribbonCount) * Math.PI * 2 + t * 1.6 * superstringTension;
    const ribbonRadius = (75 + r * 42) * singularityMass * (1 + bass * 0.35);
    const ribbonHue = (baseHue + r * 22 + rotAngle * 30) % 360;

    ctx.beginPath();
    let firstPoint = true;

    for (let s = 0; s <= ribbonSteps; s++) {
      const theta = (s / ribbonSteps) * Math.PI * 2;
      const dataIdx = Math.floor((s / ribbonSteps) * (data?.length || 1));
      const waveVal = (((data && data[dataIdx]) || 128) - 128) / 128;

      const harm1 = Math.sin(theta * 5 + ribbonPhase) * (22 + mid * 55);
      const harm2 = Math.cos(theta * 8 - ribbonPhase * 1.5) * (12 + treble * 35);
      const harm3 = Math.sin(theta * 12 + t * 3) * (6 + energy * 20);
      const audioDisplacement = waveVal * (40 * superstringTension + bass * 35);

      const currentR = ribbonRadius + harm1 + harm2 + harm3 + audioDisplacement;
      const rawX = Math.cos(theta) * currentR;
      const rawY = Math.sin(theta * 4 + ribbonPhase) * (26 + mid * 45) + waveVal * 25;
      const rawZ = Math.sin(theta) * currentR;

      // 3D Matrix Transform
      const rx = rawX * cosR - rawZ * sinR;
      const rz = rawX * sinR + rawZ * cosR;
      const ry = rawY * cosP - rz * sinP;
      const finalZ = rawY * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const projScale = fov / finalZ;
      const px = cx + rx * projScale;
      const py = cy + ry * projScale;

      if (firstPoint) {
        ctx.moveTo(px, py);
        firstPoint = false;
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.strokeStyle = `hsla(${ribbonHue}, 92%, ${65 + mid * 25}%, ${0.45 + mid * 0.45})`;
    ctx.lineWidth = (1.6 + (r % 3) * 0.9 + bass * 2.0) * coreGlow;
    ctx.shadowColor = `hsla(${ribbonHue}, 98%, 75%, 0.9)`;
    ctx.shadowBlur = (14 + mid * 26) * coreGlow;
    ctx.stroke();
  }
  ctx.restore();

  // --- 9. ACCRETION DISK STARDUST PARTICLES (3,600+ PARTICLES WITH DOPPLER BEAMING) ---
  const particles = refs.particles.current as StardustParticle[];
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const speedMult = (1 + energy * 2.2 + bass * 1.5) * superstringTension;
    p.orbitAngle += p.orbitSpeed * speedMult;

    // Keplerian Spiral breathing
    const currentRadius = p.orbitRadius * (1 + Math.sin(t * 2.5 + p.orbitAngle * 4) * (0.06 + bass * 0.2));
    const pxRaw = Math.cos(p.orbitAngle) * currentRadius;
    const pyRaw = Math.sin(t * p.verticalFreq + p.orbitRadius * 0.08) * (p.verticalAmplitude * (1 + treble * 1.6));
    const pzRaw = Math.sin(p.orbitAngle) * currentRadius;

    // 3D Projection
    const rx = pxRaw * cosR - pzRaw * sinR;
    const rz = pxRaw * sinR + pzRaw * cosR;
    const ry = pyRaw * cosP - rz * sinP;
    const finalZ = pyRaw * sinP + rz * cosP + fov;

    if (finalZ <= 10) continue;
    const projScale = fov / finalZ;
    const screenX = cx + rx * projScale;
    const screenY = cy + ry * projScale;

    // Doppler Beaming Effect (Approaching side is brighter and bluer, receding side is dimmer)
    const doppler = Math.sin(p.orbitAngle + rotAngle); // -1 to 1
    const dopplerBrightness = 1 + doppler * 0.45;
    const dopplerHueShift = doppler * 25;

    const particleSize = p.size * projScale * (1 + treble * 1.4);
    const alpha = Math.min(1, p.baseAlpha * (0.35 + energy * 0.75) * (projScale * 0.9) * dopplerBrightness);
    const hue = (baseHue + p.hueOffset + dopplerHueShift + p.orbitRadius * 0.18 + energy * 45) % 360;

    ctx.fillStyle = `hsla(${hue}, 95%, ${72 + treble * 25}%, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(screenX, screenY, Math.max(0.6, particleSize), 0, Math.PI * 2);
    ctx.fill();

    // Secondary Bloom Halo for larger particles
    if (p.size > 1.8 && alpha > 0.4) {
      ctx.fillStyle = `hsla(${accentHue}, 100%, 80%, ${(alpha * 0.35).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, particleSize * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // --- 10. ANAMORPHIC HORIZONTAL LENS FLARE (CINEMATIC GLOW) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const flareWidth = sw * (0.6 + bass * 0.35);
  const flareHeight = (8 + bass * 22) * coreGlow;

  const flareGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, flareWidth);
  flareGrad.addColorStop(0, `hsla(${accentHue}, 100%, 95%, ${0.75 + bass * 0.25})`);
  flareGrad.addColorStop(0.15, `hsla(${baseHue}, 100%, 75%, 0.45)`);
  flareGrad.addColorStop(0.45, `hsla(${secondaryHue}, 90%, 60%, 0.15)`);
  flareGrad.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = flareGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, flareWidth, flareHeight, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 11. CENTRAL PHOTON RING & EVENT HORIZON (ABSOLUTE SHADOW) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // Intense Radial Corona
  const coronaGrad = ctx.createRadialGradient(
    cx,
    cy,
    coreRadius * 0.6,
    cx,
    cy,
    coreRadius * 3.4 * coreGlow
  );
  coronaGrad.addColorStop(0, `hsla(${accentHue}, 100%, 92%, 0.95)`);
  coronaGrad.addColorStop(0.2, `hsla(${baseHue}, 100%, 75%, 0.75)`);
  coronaGrad.addColorStop(0.55, `hsla(${secondaryHue}, 95%, 55%, 0.3)`);
  coronaGrad.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = coronaGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 3.4 * coreGlow, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Void Black Event Horizon
  ctx.save();
  ctx.fillStyle = "#010003";
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 0.94, 0, Math.PI * 2);
  ctx.fill();

  // Event Horizon Gravitational Edge
  ctx.strokeStyle = `hsla(${accentHue}, 100%, 92%, ${0.85 + bass * 0.15})`;
  ctx.lineWidth = (3.2 + bass * 4.0) * coreGlow;
  ctx.shadowColor = `hsla(${accentHue}, 100%, 80%, 1)`;
  ctx.shadowBlur = (24 + bass * 35) * coreGlow;
  ctx.stroke();
  ctx.restore();
}
