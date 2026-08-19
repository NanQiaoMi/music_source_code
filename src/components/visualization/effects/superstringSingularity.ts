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

interface DeepStar {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
}

interface WhiteShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  lineWidth: number;
}

/**
 * PURE WHITE QUANTUM SINGULARITY (纯白量子引力奇点)
 * - 7-Layer Cinematic Physics Engine
 * - 4,800+ Logarithmic Keplerian Spiral Streak Particles
 * - 3D Wormhole Gravitational Curvature Spacetime Grid
 * - 12-Ring 3D Harmonic Spherical Resonance Mesh & Mercury Ribbons
 * - Pulsing White-Hot Photonic Core & Volumetric Infall / Shockwaves
 * - Anamorphic Soft White Bloom & Polar Relativistic Beams
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

  // --- 1. MULTI-BAND SIGNAL EXTRACTION ---
  const getVal = (idx: number) => (data && data[idx] !== undefined ? data[idx] / 255 : 0);
  const rawSubBass = (getVal(0) + getVal(1) + getVal(2)) / 3;
  const rawBass = (getVal(3) + getVal(5) + getVal(7)) / 3;
  const rawMid = (getVal(15) + getVal(25) + getVal(35) + getVal(45)) / 4;
  const rawTreble = (getVal(70) + getVal(90) + getVal(110) + getVal(130)) / 4;

  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.82 + ((rawSubBass * 0.6 + rawBass * 0.4)) * 0.18;
  refs.smoothMid.current = (refs.smoothMid.current || 0) * 0.84 + rawMid * 0.16;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.86 + rawTreble * 0.14;

  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;
  const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;

  const t = (time || 0) * 0.0008 * speed;

  // --- 2. INITIALIZE ARRAYS IN REFS IF EMPTY ---
  if (!refs.particles.current || refs.particles.current.length === 0) {
    const particles: PhotonicParticle[] = [];
    const count = 4800;
    const arms = 4;

    for (let i = 0; i < count; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distRatio = Math.pow(Math.random(), 1.6);
      const radius = 18 + distRatio * 740;
      const spiralAngle = armAngle + Math.log(radius + 1) * 3.2 + (Math.random() - 0.5) * 0.35;
      const orbitSpeed = (0.006 + (1 / Math.sqrt(radius)) * 0.32) * 0.8;

      particles.push({
        radius,
        angle: spiralAngle,
        speed: orbitSpeed,
        height: (Math.random() - 0.5) * (10 + distRatio * 60),
        size: 0.4 + Math.random() * 1.8,
        brightness: 0.35 + Math.random() * 0.65,
        arm,
        trailLength: 3 + Math.random() * 8,
      });
    }
    refs.particles.current = particles;
  }

  if (!refs.spectrumStars.current || refs.spectrumStars.current.length === 0) {
    const stars: DeepStar[] = [];
    for (let i = 0; i < 400; i++) {
      stars.push({
        x: (Math.random() - 0.5) * sw * 1.4,
        y: (Math.random() - 0.5) * sh * 1.4,
        z: Math.random() * 800 + 100,
        size: 0.5 + Math.random() * 1.6,
        alpha: 0.2 + Math.random() * 0.8,
        twinkleSpeed: 1 + Math.random() * 3,
      });
    }
    refs.spectrumStars.current = stars;
  }

  if (!refs.shockwaves.current) refs.shockwaves.current = [];
  const shockwaves = refs.shockwaves.current as WhiteShockwave[];

  if (bass > 0.65 && (shockwaves.length === 0 || shockwaves[shockwaves.length - 1].radius > 120)) {
    shockwaves.push({
      radius: 15 * singularityMass,
      maxRadius: Math.max(sw, sh) * 0.95,
      alpha: 0.95,
      speed: 12 + bass * 18,
      lineWidth: 2 + bass * 6,
    });
  }

  // --- 3. LAYER 1: DEEP COSMIC VOID & 3D BACKGROUND STARFIELD ---
  ctx.save();
  ctx.fillStyle = "#010103";
  ctx.fillRect(0, 0, sw, sh);

  // Soft Monochrome Ambient Glow
  ctx.globalCompositeOperation = "screen";
  const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.8);
  bgGrd.addColorStop(0, `rgba(240, 248, 255, ${0.12 + bass * 0.12})`);
  bgGrd.addColorStop(0.3, `rgba(190, 215, 245, ${0.04 + mid * 0.05})`);
  bgGrd.addColorStop(0.7, `rgba(100, 130, 170, 0.015)`);
  bgGrd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, sw, sh);

  // Deep 3D Starfield
  const stars = refs.spectrumStars.current as DeepStar[];
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const sx = cx + (s.x / s.z) * 500;
    const sy = cy + (s.y / s.z) * 500;

    if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
      const twinkle = Math.sin(t * s.twinkleSpeed + i) * 0.5 + 0.5;
      const sAlpha = s.alpha * (0.3 + twinkle * 0.7) * (1 - s.z / 1000);
      ctx.fillStyle = `rgba(235, 245, 255, ${sAlpha.toFixed(3)})`;
      ctx.fillRect(sx, sy, s.size, s.size);
    }
  }
  ctx.restore();

  // --- 4. 3D CAMERA & SPACETIME PROJECTION MATRIX ---
  const fov = 540;
  const pitch = 0.65 + Math.sin(t * 0.3) * 0.05;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const rotAngle = t * 0.7;
  const cosR = Math.cos(rotAngle);
  const sinR = Math.sin(rotAngle);

  // --- 5. LAYER 2: 3D EINSTEIN SPACETIME CURVATURE FUNNEL (引力塌陷时空网格) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const gridRings = 20;
  const gridSpokes = 32;
  const maxGridRadius = Math.max(sw, sh) * 0.8;

  // Curvature Concentric Rings
  for (let gr = 1; gr <= gridRings; gr++) {
    const ringFrac = gr / gridRings;
    const rRadius = Math.pow(ringFrac, 1.35) * maxGridRadius;
    const depthWarp = -Math.pow(1 - ringFrac, 2.0) * (220 + bass * 160) * singularityMass;
    const ringAlpha = (0.025 + ringFrac * 0.08) * (0.7 + energy * 0.5);

    ctx.beginPath();
    let first = true;
    for (let s = 0; s <= 64; s++) {
      const theta = (s / 64) * Math.PI * 2;
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
    ctx.strokeStyle = `rgba(215, 235, 255, ${ringAlpha.toFixed(3)})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Curvature Radial Spokes
  for (let gs = 0; gs < gridSpokes; gs++) {
    const spokeAngle = (gs / gridSpokes) * Math.PI * 2;
    ctx.beginPath();
    let first = true;

    for (let seg = 1; seg <= 30; seg++) {
      const ringFrac = seg / 30;
      const rRadius = Math.pow(ringFrac, 1.35) * maxGridRadius;
      const depthWarp = -Math.pow(1 - ringFrac, 2.0) * (220 + bass * 160) * singularityMass;

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
    ctx.strokeStyle = `rgba(200, 225, 255, ${0.035 + bass * 0.04})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.restore();

  // --- 6. LAYER 3: 3D SPHERICAL HARMONIC RESONANCE RINGS & WATERFALL WAVES ---
  const sphereRings = 10;
  const ringSegs = 90;
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let r = 0; r < sphereRings; r++) {
    const rRatio = (r + 1) / sphereRings;
    const baseR = (50 + rRatio * 280) * singularityMass * (1 + bass * 0.28);
    const ringPhase = t * (1.2 + r * 0.2) * superstringTension;
    const points: { x: number; y: number }[] = [];

    for (let s = 0; s <= ringSegs; s++) {
      const theta = (s / ringSegs) * Math.PI * 2;
      const waveIdx = Math.floor((s / ringSegs) * (data?.length || 1));
      const waveVal = (((data && data[waveIdx]) || 128) - 128) / 128;

      const harm1 = Math.sin(theta * 4 + ringPhase + r) * (15 + mid * 45);
      const harm2 = Math.cos(theta * 6 - ringPhase * 0.8) * (8 + treble * 25);
      const audioDisp = waveVal * (25 * superstringTension + bass * 25);

      const curR = baseR + harm1 + harm2 + audioDisp;
      const rawX = Math.cos(theta) * curR;
      const rawY = Math.sin(theta * 2 + ringPhase) * (16 + mid * 35) + waveVal * 15;
      const rawZ = Math.sin(theta) * curR;

      // 3D Matrix
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

      const alpha = (0.2 + (1 - rRatio) * 0.6) * (0.6 + mid * 0.45);
      ctx.strokeStyle = `rgba(240, 248, 255, ${alpha.toFixed(3)})`;
      ctx.lineWidth = (1.2 + (r % 3) * 0.6 + bass * 1.5) * coreGlow;
      ctx.shadowColor = "rgba(255, 255, 255, 0.85)";
      ctx.shadowBlur = (10 + mid * 18) * coreGlow;
      ctx.stroke();
    }
  }
  ctx.restore();

  // --- 7. LAYER 4: 4,800+ PHOTONIC ACCRETION PARTICLES WITH STREAK TRAILS ---
  const particles = refs.particles.current as PhotonicParticle[];
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const speedMult = (1 + energy * 2.4 + bass * 1.8) * superstringTension;
    p.angle += p.speed * speedMult;

    // Fast Infall Motion
    const curR = p.radius * (1 + Math.sin(t * 2.5 + p.angle * 3) * (0.04 + bass * 0.18));
    const pxRaw = Math.cos(p.angle) * curR;
    const pyRaw = p.height + Math.sin(t * 3 + p.radius * 0.06) * (12 + treble * 30);
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
    const streakLen = p.trailLength * scale * (1 + bass * 1.6) * (200 / Math.max(20, curR));
    const streakEndX = screenX + Math.cos(tangentAngle) * streakLen;
    const streakEndY = screenY + Math.sin(tangentAngle) * streakLen * cosP;

    const pAlpha = Math.min(1, p.brightness * (0.4 + energy * 0.75) * (scale * 0.95));
    const pSize = Math.max(0.6, p.size * scale * (1 + treble * 1.4));

    // Particle Streak
    ctx.strokeStyle = `rgba(235, 245, 255, ${(pAlpha * 0.85).toFixed(3)})`;
    ctx.lineWidth = pSize * 0.8;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(streakEndX, streakEndY);
    ctx.stroke();

    // Particle Head
    ctx.fillStyle = `rgba(255, 255, 255, ${pAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(screenX, screenY, pSize, 0, Math.PI * 2);
    ctx.fill();

    // Specular Luminous Halos on prominent particles
    if (p.size > 1.4 && pAlpha > 0.5) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(pAlpha * 0.4).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, pSize * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // --- 8. LAYER 5: RELATIVISTIC WHITE POLAR JETS & HORIZONTAL ANAMORPHIC FLARE ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  // Polar Jets
  const jetLen = (360 + treble * 580 + bass * 340) * coreGlow;
  const jetWidth = (12 + mid * 24) * coreGlow;

  const drawWhiteJet = (dir: 1 | -1) => {
    const targetY = cy + dir * jetLen;
    const jGrd = ctx.createLinearGradient(cx, cy, cx, targetY);
    jGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    jGrd.addColorStop(0.08, "rgba(240, 248, 255, 0.9)");
    jGrd.addColorStop(0.35, "rgba(180, 215, 255, 0.35)");
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

  // Soft Anamorphic Flare (Smooth Gaussian Fade - No Hard Lines)
  const flareW = sw * (0.7 + bass * 0.3);
  const flareH = (14 + bass * 26) * coreGlow;

  const flareGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, flareW);
  flareGrd.addColorStop(0, `rgba(255, 255, 255, ${0.95 + bass * 0.05})`);
  flareGrd.addColorStop(0.12, "rgba(235, 245, 255, 0.75)");
  flareGrd.addColorStop(0.4, "rgba(180, 210, 250, 0.2)");
  flareGrd.addColorStop(0.7, "rgba(120, 160, 220, 0.05)");
  flareGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = flareGrd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, flareW, flareH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 9. LAYER 6: PURE WHITE SHOCKWAVES & PHOTON SPHERE ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const swObj = shockwaves[i];
    swObj.radius += swObj.speed;
    swObj.alpha *= 0.93;

    if (swObj.alpha < 0.015 || swObj.radius > swObj.maxRadius) {
      shockwaves.splice(i, 1);
      continue;
    }

    const swGrd = ctx.createRadialGradient(
      cx,
      cy,
      Math.max(0, swObj.radius - 45),
      cx,
      cy,
      swObj.radius + 45
    );
    swGrd.addColorStop(0, "rgba(255,255,255,0)");
    swGrd.addColorStop(0.5, `rgba(255, 255, 255, ${(swObj.alpha * 0.95).toFixed(3)})`);
    swGrd.addColorStop(0.7, `rgba(200, 230, 255, ${(swObj.alpha * 0.35).toFixed(3)})`);
    swGrd.addColorStop(1, "rgba(255,255,255,0)");

    ctx.strokeStyle = swGrd;
    ctx.lineWidth = swObj.lineWidth;
    ctx.beginPath();
    ctx.arc(cx, cy, swObj.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Blinding White-Hot Singularity Point & Multi-Layer Corona
  const coreRadius = (18 + bass * 26) * singularityMass * coreGlow;

  const coronaGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 4.8);
  coronaGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  coronaGrd.addColorStop(0.18, `rgba(240, 250, 255, ${0.9 + bass * 0.1})`);
  coronaGrd.addColorStop(0.45, `rgba(185, 220, 255, ${0.45 + mid * 0.3})`);
  coronaGrd.addColorStop(0.75, "rgba(100, 150, 220, 0.1)");
  coronaGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = coronaGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 4.8, 0, Math.PI * 2);
  ctx.fill();

  // Solid Pure White Center
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 0.9, 0, Math.PI * 2);
  ctx.fill();

  // High-Energy Halo Edge
  ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";
  ctx.lineWidth = 3 + bass * 4;
  ctx.shadowColor = "#FFFFFF";
  ctx.shadowBlur = 35 * coreGlow;
  ctx.stroke();
  ctx.restore();

  // --- 10. LAYER 7: SWISS ASTROPHYSICS HUD TELEMETRY ---
  ctx.save();
  ctx.font = "10px 'SF Mono', 'Roboto Mono', monospace";
  ctx.fillStyle = "rgba(220, 235, 255, 0.45)";
  ctx.textBaseline = "top";

  // Top Left: Singularity Telemetry
  ctx.fillText("QUANTUM METRIC // PURE PHOTONIC SINGULARITY", 32, 32);
  ctx.fillText(`GRAVITATIONAL INFLOW: ${(12.4 * (1 + bass * 8.5)).toFixed(2)} c`, 32, 48);
  ctx.fillText(`PHOTON SPHERE DENSITY: ${(4800 * (1 + energy * 0.5)).toFixed(0)} / m³`, 32, 64);
  ctx.fillText(`SUPERSTRING FREQ: ${(superstringTension * 120).toFixed(0)} GHz`, 32, 80);

  // Top Right: Realtime FFT Spectrogram
  ctx.textAlign = "right";
  ctx.fillText("ACOUSTIC HARMONICS // REALTIME FFT", sw - 32, 32);
  ctx.fillText(`SUB-BASS [20-150Hz]: ${(bass * 100).toFixed(0)}%`, sw - 32, 48);
  ctx.fillText(`MID-VOX [300-2kHz]: ${(mid * 100).toFixed(0)}%`, sw - 32, 64);
  ctx.fillText(`TREBLE-AIR [2-16kHz]: ${(treble * 100).toFixed(0)}%`, sw - 32, 80);

  // Precision Reticle Corner Marks
  ctx.strokeStyle = "rgba(200, 225, 255, 0.35)";
  ctx.lineWidth = 1;
  const markSize = 12;

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
