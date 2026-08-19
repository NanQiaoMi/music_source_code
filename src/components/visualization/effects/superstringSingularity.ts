import { EffectContext } from "./types";

interface StardustParticle {
  x: number;
  y: number;
  z: number;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  verticalOffset: number;
  size: number;
  brightness: number;
  hueOffset: number;
}

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
  const speed = params.speed || 1.0;
  const singularityMass = params.singularityMass || 1.0;
  const superstringTension = params.superstringTension || 1.2;
  const coreGlow = params.coreGlow || 1.5;

  // 1. Audio Signal Extraction
  const rawBass = data && data[0] ? (data[0] + data[2] + data[4]) / 3 / 255 : 0;
  const rawMid =
    data && data[Math.floor(data.length / 2)] ? data[Math.floor(data.length / 2)] / 255 : 0;
  const rawTreble = data && data[data.length - 1] ? data[data.length - 1] / 255 : 0;
  const rawEnergy = (rawBass + rawMid + rawTreble) / 3;

  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.82 + rawBass * 0.18;
  refs.smoothMid.current = (refs.smoothMid.current || 0) * 0.85 + rawMid * 0.15;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.88 + rawTreble * 0.12;

  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;
  const energy = rawEnergy;

  const cx = width / 2;
  const cy = height / 2;
  const t = (time * 0.001 * speed) || 0;

  // Background clearing with cosmic trail fade
  ctx.fillStyle = "rgba(3, 2, 8, 0.32)";
  ctx.fillRect(0, 0, width, height);

  // Palette from theme or default
  const baseHue = theme.primary || 270;
  const secondaryHue = theme.secondary || 195;
  const accentHue = theme.accent || 330;

  // Initialize Particles in refs if empty
  if (!refs.particles.current || refs.particles.current.length === 0) {
    const particles: StardustParticle[] = [];
    const count = 1800;
    for (let i = 0; i < count; i++) {
      const radius = 50 + Math.pow(Math.random(), 1.7) * 450;
      const angle = Math.random() * Math.PI * 2;
      const orbitSpeed = (0.006 + (1 / Math.sqrt(radius)) * 0.1) * (Math.random() > 0.15 ? 1 : -1);

      particles.push({
        x: Math.cos(angle) * radius,
        y: (Math.random() - 0.5) * (radius * 0.3),
        z: Math.sin(angle) * radius,
        orbitRadius: radius,
        orbitAngle: angle,
        orbitSpeed,
        verticalOffset: (Math.random() - 0.5) * 35,
        size: 0.8 + Math.random() * 2.2,
        brightness: 0.3 + Math.random() * 0.7,
        hueOffset: (Math.random() - 0.5) * 50,
      });
    }
    refs.particles.current = particles;
  }

  // 2. 3D Camera Projection Settings
  const fov = 420;
  const pitch = 0.52 + Math.sin(t * 0.4) * 0.08;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const rotAngle = t * 0.5;
  const cosR = Math.cos(rotAngle);
  const sinR = Math.sin(rotAngle);

  // 3. Superstring Harmonic Ribbons (3D Parametric Wave Ribbons)
  const ribbonCount = 7;
  const ribbonSteps = 90;
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let r = 0; r < ribbonCount; r++) {
    const ribbonPhase = (r / ribbonCount) * Math.PI * 2 + t * 1.2 * superstringTension;
    const ribbonRadius = (80 + r * 35) * singularityMass * (1 + bass * 0.3);
    const ribbonHue = (baseHue + r * 20 + rotAngle * 25) % 360;

    ctx.beginPath();
    let firstPoint = true;

    for (let s = 0; s <= ribbonSteps; s++) {
      const theta = (s / ribbonSteps) * Math.PI * 2;
      const dataIdx = Math.floor((s / ribbonSteps) * (data?.length || 1));
      const waveVal = (((data && data[dataIdx]) || 128) - 128) / 128;

      const harm1 = Math.sin(theta * 4 + ribbonPhase) * (18 + mid * 40);
      const harm2 = Math.cos(theta * 6 - ribbonPhase * 1.3) * (8 + treble * 25);
      const audioDisplacement = waveVal * (30 * superstringTension + bass * 25);

      const currentR = ribbonRadius + harm1 + harm2 + audioDisplacement;
      const rawX = Math.cos(theta) * currentR;
      const rawY = Math.sin(theta * 3 + ribbonPhase) * (20 + mid * 30) + waveVal * 15;
      const rawZ = Math.sin(theta) * currentR;

      // 3D Matrix transform
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

    ctx.strokeStyle = `hsla(${ribbonHue}, 90%, ${60 + mid * 25}%, ${0.35 + mid * 0.45})`;
    ctx.lineWidth = (1.4 + (r % 3) * 0.8 + bass * 1.5) * coreGlow;
    ctx.shadowColor = `hsla(${ribbonHue}, 95%, 70%, 0.8)`;
    ctx.shadowBlur = (10 + mid * 20) * coreGlow;
    ctx.stroke();
  }
  ctx.restore();

  // 4. Quantum Stardust Particles
  const particles = refs.particles.current as StardustParticle[];
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const speedMult = (1 + energy * 1.8 + bass * 1.2) * superstringTension;
    p.orbitAngle += p.orbitSpeed * speedMult;

    const currentRadius = p.orbitRadius * (1 + Math.sin(t * 2 + p.orbitAngle * 3) * (0.05 + bass * 0.15));
    const pxRaw = Math.cos(p.orbitAngle) * currentRadius;
    const pyRaw = p.y + Math.sin(t * 3 + p.orbitRadius * 0.05) * (p.verticalOffset * (1 + treble * 1.5));
    const pzRaw = Math.sin(p.orbitAngle) * currentRadius;

    const rx = pxRaw * cosR - pzRaw * sinR;
    const rz = pxRaw * sinR + pzRaw * cosR;
    const ry = pyRaw * cosP - rz * sinP;
    const finalZ = pyRaw * sinP + rz * cosP + fov;

    if (finalZ <= 10) continue;
    const projScale = fov / finalZ;
    const screenX = cx + rx * projScale;
    const screenY = cy + ry * projScale;

    const particleSize = p.size * projScale * (1 + treble * 1.2);
    const alpha = Math.min(1, p.brightness * (0.3 + energy * 0.7) * (projScale * 0.8));
    const hue = (baseHue + p.hueOffset + p.orbitRadius * 0.2 + energy * 40) % 360;

    ctx.fillStyle = `hsla(${hue}, 92%, ${70 + treble * 25}%, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(screenX, screenY, Math.max(0.5, particleSize), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 5. Gravitational Singularity Core (Event Horizon & Photon Ring)
  const coreRadius = 38 * singularityMass * (1 + bass * 0.4);

  // Relativistic Jet Beams
  if (treble > 0.35 || bass > 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const jetLength = (150 + treble * 250 + bass * 180) * coreGlow;
    const jetWidth = (8 + mid * 16) * coreGlow;

    const gradTop = ctx.createLinearGradient(cx, cy, cx, cy - jetLength);
    gradTop.addColorStop(0, `hsla(${accentHue}, 95%, 85%, 0.85)`);
    gradTop.addColorStop(0.3, `hsla(${baseHue}, 90%, 65%, 0.4)`);
    gradTop.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = gradTop;
    ctx.beginPath();
    ctx.moveTo(cx - jetWidth, cy);
    ctx.lineTo(cx, cy - jetLength);
    ctx.lineTo(cx + jetWidth, cy);
    ctx.closePath();
    ctx.fill();

    const gradBottom = ctx.createLinearGradient(cx, cy, cx, cy + jetLength);
    gradBottom.addColorStop(0, `hsla(${accentHue}, 95%, 85%, 0.85)`);
    gradBottom.addColorStop(0.3, `hsla(${baseHue}, 90%, 65%, 0.4)`);
    gradBottom.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = gradBottom;
    ctx.beginPath();
    ctx.moveTo(cx - jetWidth, cy);
    ctx.lineTo(cx, cy + jetLength);
    ctx.lineTo(cx + jetWidth, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Outer Photon Ring Glow
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const photonRingGrad = ctx.createRadialGradient(
    cx,
    cy,
    coreRadius * 0.5,
    cx,
    cy,
    coreRadius * 2.6 * coreGlow
  );
  photonRingGrad.addColorStop(0, `hsla(${accentHue}, 100%, 80%, 0.9)`);
  photonRingGrad.addColorStop(0.25, `hsla(${baseHue}, 95%, 65%, 0.65)`);
  photonRingGrad.addColorStop(0.65, `hsla(${secondaryHue}, 90%, 50%, 0.25)`);
  photonRingGrad.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = photonRingGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 2.6 * coreGlow, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Dark Matter Event Horizon (Absolute Void Black)
  ctx.save();
  ctx.fillStyle = "#010103";
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 0.92, 0, Math.PI * 2);
  ctx.fill();

  // Event Horizon Lensing Edge
  ctx.strokeStyle = `hsla(${accentHue}, 100%, 88%, ${0.75 + bass * 0.25})`;
  ctx.lineWidth = (2.2 + bass * 2.8) * coreGlow;
  ctx.shadowColor = `hsla(${accentHue}, 100%, 75%, 1)`;
  ctx.shadowBlur = (16 + bass * 22) * coreGlow;
  ctx.stroke();
  ctx.restore();
}
