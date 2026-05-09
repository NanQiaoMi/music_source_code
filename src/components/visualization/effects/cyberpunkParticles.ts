import { EffectContext } from "./types";

export const drawCyberpunkParticles = ({
  ctx,
  width,
  height,
  data,
  params,
  time,
  refs,
  theme,
}: EffectContext) => {
  const effectParams = params || {
    speed: 1,
    particleCount: 600,
    particleSize: 2,
    glowIntensity: 1,
  };

  // --- CINEMATIC MULTI-BAND ANALYTICS ---
  const rawBass = data && data[0] ? (data[0] + data[1] + data[2] + data[3]) / 4 / 255 : 0;
  const rawMid = data && data[14] ? (data[14] + data[18] + data[22]) / 3 / 255 : 0;
  const rawTreble = data && data[45] ? (data[45] + data[55] + data[65]) / 3 / 255 : 0;

  // Robust smoothing
  refs.smoothBass.current = Math.max(
    0,
    Math.min(1, refs.smoothBass.current * 0.85 + (isFinite(rawBass) ? rawBass : 0) * 0.15)
  );
  const smoothMid =
    (refs.smoothMid ? refs.smoothMid.current : 0) * 0.88 + (isFinite(rawMid) ? rawMid : 0) * 0.12;
  if (!refs.smoothMid) (refs as any).smoothMid = { current: smoothMid };
  else refs.smoothMid.current = Math.max(0, Math.min(1, smoothMid));
  refs.smoothTreble.current = Math.max(
    0,
    Math.min(1, refs.smoothTreble.current * 0.92 + (isFinite(rawTreble) ? rawTreble : 0) * 0.08)
  );

  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;

  const t = time * 0.001;
  const speedMult = Math.min(10, (0.5 + bass * 2.8) * (effectParams.speed || 1));
  const cx = width / 2;
  const cy = height / 2;

  const themeHue = theme.primary || 200;
  const accentHue = theme.accent || 320;

  // --- BREATHING & SPATIAL KINETICS ---
  const breathe = Math.pow(Math.sin(t * 0.4) * 0.5 + 0.5, 1.5);
  const orbitX = Math.sin(t * 0.08) * 100;
  const orbitY = Math.cos(t * 0.06) * 80;

  const camScale = 1.05 + bass * 0.12 + breathe * 0.06;
  const camShake = bass > 0.96 ? (Math.random() - 0.5) * 15 : 0;
  const focusPlane = 1200 + Math.sin(t * 0.25) * 500 + (bass - mid) * 200;

  ctx.save();

  // 1. CINEMATIC ATMOSPHERE
  const drawBackground = () => {
    const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 1.8);
    bgGrd.addColorStop(0, `hsla(${themeHue}, 50%, 4%, 1)`);
    bgGrd.addColorStop(0.7, `hsla(${themeHue}, 30%, 1%, 1)`);
    bgGrd.addColorStop(1, "#000000");
    ctx.fillStyle = bgGrd;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 60; i++) {
      const seed = i * 17.7;
      const sx = (((Math.sin(seed) * 10000) % width) + width) % width;
      const sy = (((Math.cos(seed * 1.3) * 10000) % height) + height) % height;
      const sAlpha = (0.05 + bass * 0.08) * (0.5 + Math.sin(t * 0.5 + seed) * 0.5);
      ctx.fillStyle = `hsla(${themeHue}, 100%, 90%, ${sAlpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawScene = (offset: number, alphaMult: number = 1.0, tint: string | null = null) => {
    ctx.save();
    ctx.translate(cx + orbitX + offset + camShake, cy + orbitY + camShake);
    ctx.scale(camScale, camScale);
    ctx.translate(-cx, -cy);

    if (!tint && offset === 0) {
      // MASTER SPECTRAL HUD
      ctx.save();
      ctx.globalAlpha = Math.min(0.2, (0.08 + mid * 0.12) * alphaMult);
      ctx.strokeStyle = `hsla(${themeHue}, 100%, 75%, 1)`;
      ctx.lineWidth = 1;
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.05);

      const hr = 360 + breathe * 40;
      for (let i = 0; i < 64; i += 2) {
        const ang = (i / 64) * Math.PI * 2;
        const val = Math.min(60, (data[i] / 255) * 40 * (1 + bass));
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * hr, Math.sin(ang) * hr);
        ctx.lineTo(Math.cos(ang) * (hr + val), Math.sin(ang) * (hr + val));
        ctx.stroke();
      }

      ctx.rotate(-t * 0.1);
      ctx.setLineDash([10, 20]);
      ctx.beginPath();
      ctx.arc(0, 0, hr + 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // VOLUMETRIC GRID
      ctx.save();
      ctx.strokeStyle = `hsla(${themeHue}, 100%, 65%, ${Math.min(0.15, 0.03 + bass * 0.07)})`;
      ctx.lineWidth = 0.8;
      const gridSize = 420;
      const gridZ = (t * speedMult * 0.12) % gridSize;

      for (let i = -5; i <= 5; i++) {
        ctx.beginPath();
        for (let j = -12; j <= 12; j++) {
          const gx = cx + i * gridSize;
          const gy = cy + j * 70 + gridZ;
          const d = Math.hypot(gx - cx, gy - cy);
          const warp = (bass * 180000) / (d + 900);
          const px = gx + warp * (gx > cx ? 1 : -1);
          const py = gy + warp * (gy > cy ? 1 : -1);
          if (j === -12) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.beginPath();
        for (let j = -12; j <= 12; j++) {
          const gx = cx + j * 70 + gridZ;
          const gy = cy + i * gridSize;
          const d = Math.hypot(gx - cx, gy - cy);
          const warp = (bass * 180000) / (d + 900);
          const px = gx + warp * (gx > cx ? 1 : -1);
          const py = gy + warp * (gy > cy ? 1 : -1);
          if (j === -12) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // --- SINGULARITY CORE (Enhanced Geometry) ---
    ctx.globalCompositeOperation = "screen";
    const coreR = 70 + bass * 400;
    const ripple = Math.sin(t * 2.5) * 20;
    const coreAlpha = Math.min(0.25, (0.12 + mid * 0.1) * alphaMult);
    const auraGrd = ctx.createRadialGradient(cx, cy, coreR * 0.05, cx, cy, coreR * 8 + ripple);
    auraGrd.addColorStop(0, `hsla(${accentHue}, 100%, 95%, ${coreAlpha})`);
    auraGrd.addColorStop(0.3, `hsla(${themeHue}, 100%, 55%, ${coreAlpha * 0.4})`);
    auraGrd.addColorStop(1, "transparent");
    ctx.fillStyle = auraGrd;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 8 + ripple, 0, Math.PI * 2);
    ctx.fill();

    // Enhanced Nested Wireframe Singularity
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 1.2;
    const coreGeomR = 40 + bass * 120;

    ctx.save();
    ctx.rotate(t * 0.3 + treble * 0.5);
    ctx.strokeStyle = `hsla(${themeHue}, 100%, 85%, ${coreAlpha * 1.5})`;
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.strokeRect(-coreGeomR, -coreGeomR, coreGeomR * 2, coreGeomR * 2);
    }
    ctx.restore();

    ctx.save();
    ctx.rotate(-t * 0.5 - mid * 0.8);
    ctx.strokeStyle = `hsla(${accentHue}, 100%, 80%, ${coreAlpha * 1.2})`;
    for (let i = 0; i < 2; i++) {
      ctx.rotate(Math.PI);
      ctx.beginPath();
      const trR = coreGeomR * 1.2;
      ctx.moveTo(0, -trR);
      ctx.lineTo(trR * 0.86, trR * 0.5);
      ctx.lineTo(-trR * 0.86, trR * 0.5);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    // --- NEURAL PARTICLES ---
    const count = Math.min(refs.particles.current.length, effectParams.particleCount || 600);
    const nodes: any[] = [];

    for (let i = 0; i < count; i++) {
      const p = refs.particles.current[i];
      if (offset === 0) {
        p.z -= speedMult * (1 + (p.val || 0) * 0.6);
        const rot = 0.0001 + treble * 0.0015;
        const dx = p.x;
        p.x = p.x * Math.cos(rot) - p.y * Math.sin(rot);
        p.y = dx * Math.sin(rot) + p.y * Math.cos(rot);
      }

      if (p.z <= 5 || !isFinite(p.z)) {
        p.z = 2400 + Math.random() * 400;
        const angle = Math.random() * Math.PI * 2;
        const radius = 250 + Math.random() * 1600;
        p.x = Math.cos(angle) * radius;
        p.y = Math.sin(angle) * radius;
      }

      const dCenter = Math.hypot(p.x, p.y);
      const alphaDist = Math.pow(Math.min(1, (2400 - p.z) / 1800), 1.5) * Math.min(1, p.z / 200);
      if (alphaDist < 0.01) continue;

      const suction = Math.pow(Math.max(0, 1 - dCenter / 1800), 2.5) * (bass * 700 + mid * 300);
      const twist = Math.pow(Math.max(0, 1 - dCenter / 1400), 3) * (bass * 0.2 + 0.05);
      const ang = Math.atan2(p.y, p.x);
      const wx = p.x * (1 - suction / 1800) - Math.sin(ang) * dCenter * twist;
      const wy = p.y * (1 - suction / 1800) + Math.cos(ang) * dCenter * twist;

      const scale = (1800 / (p.z || 1)) * (1 + (bass * 400) / (dCenter + 400));
      const x2d = wx * scale + cx;
      const y2d = wy * scale + cy;

      const rawVal = data[Math.floor((i / count) * 64)] / 255;
      p.val = (p.val || 0) * 0.8 + (isFinite(rawVal) ? rawVal : 0) * 0.2;
      const val = p.val;

      const alpha = Math.min(1, alphaDist * (0.3 + val * 0.7) * alphaMult);
      if (alpha < 0.04) continue;

      const pSize = Math.min(40, (effectParams.particleSize || 2.4) * scale * (1 + val * 0.5));
      const hue = i % 15 === 0 ? accentHue : themeHue;

      // Bokeh Effect
      const blur = Math.abs(p.z - focusPlane) / 800;
      if (blur > 0.4) {
        ctx.fillStyle = `hsla(${hue}, 100%, 75%, ${Math.min(0.1, alpha * 0.08)})`;
        ctx.beginPath();
        ctx.arc(x2d, y2d, pSize * (1 + blur * 8), 0, Math.PI * 2);
        ctx.fill();
      }

      // Safe Stretching
      ctx.save();
      ctx.translate(x2d, y2d);
      ctx.rotate(ang + Math.PI / 2);
      const stretch = 1 + (suction / 150) * (1 + val) + speedMult * 0.1;
      ctx.scale(1, Math.min(10, stretch));

      const pGlow = effectParams.glowIntensity || 1.0;
      ctx.fillStyle = tint || `hsla(${hue}, 100%, ${90 + treble * 10}%, ${alpha * pGlow})`;
      ctx.beginPath();
      ctx.moveTo(0, -pSize * 1.5);
      ctx.lineTo(pSize, pSize);
      ctx.lineTo(-pSize, pSize);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (val > 0.92 && p.z < 1400 && !tint && nodes.length < 40) {
        nodes.push({ x: x2d, y: y2d, hue, alpha, val });
      }
    }

    // Neural Connections (With Traveling Pulses)
    if (nodes.length > 2 && (treble > 0.5 || mid > 0.6)) {
      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < Math.min(nodes.length, i + 3); j++) {
          const n2 = nodes[j];
          const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
          if (dist < 300) {
            const cAlpha = Math.min(0.12, n1.alpha * n2.alpha * 0.2);
            const grad = ctx.createLinearGradient(n1.x, n1.y, n2.x, n2.y);
            grad.addColorStop(0, `hsla(${n1.hue}, 100%, 80%, ${cAlpha})`);
            grad.addColorStop(1, `hsla(${n2.hue}, 100%, 80%, ${cAlpha})`);
            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();

            const pulsePos = (t * 2.2 + i) % 1;
            const px = n1.x + (n2.x - n1.x) * pulsePos;
            const py = n1.y + (n2.y - n1.y) * pulsePos;
            ctx.fillStyle = `hsla(${n1.hue}, 100%, 95%, ${Math.min(0.2, cAlpha * 2.5)})`;
            ctx.beginPath();
            ctx.arc(px, py, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    ctx.restore();
  };

  // --- RENDERING PIPELINE ---
  drawBackground();

  // 1. Subtle Radial Pulse (Safe Replacement for God-Rays)
  if (bass > 0.88) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const pulseR = width * 0.4 * (bass - 0.88);
    const pulseGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR);
    pulseGrd.addColorStop(0, "transparent");
    pulseGrd.addColorStop(
      0.8,
      `hsla(${themeHue}, 100%, 80%, ${Math.min(0.04, (bass - 0.88) * 0.12)})`
    );
    pulseGrd.addColorStop(1, "transparent");
    ctx.strokeStyle = pulseGrd;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Holographic HUD Layers
  const hAbr = 2 + bass * 6;
  ctx.save();
  drawScene(-hAbr, 0.5, `hsla(${accentHue}, 100%, 80%, 0.1)`);
  drawScene(hAbr, 0.5, `hsla(${themeHue}, 100%, 80%, 0.1)`);
  drawScene(0, 1.0);
  ctx.restore();

  // 3. Matrix Glitch Tiles
  if (treble > 0.94) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = `hsla(${themeHue}, 100%, 80%, 0.05)`;
    for (let i = 0; i < 4; i++) {
      const gx = Math.random() * width;
      const gy = Math.random() * height;
      const gs = 20 + Math.random() * 60;
      ctx.fillRect(gx, gy, gs, 1.2);
      ctx.fillRect(gx, gy, 1.2, gs);
    }
    ctx.restore();
  }

  // 4. CINEMATIC LENS GHOSTING
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 3; i++) {
    const gx = cx - orbitX * (0.4 + i * 0.4);
    const gy = cy - orbitY * (0.4 + i * 0.4);
    const gSize = 10 + i * 25 + bass * 15;
    const gAlpha = 0.02 * (0.5 + Math.sin(t + i) * 0.5);
    ctx.fillStyle = `hsla(${i % 2 === 0 ? accentHue : themeHue}, 100%, 85%, ${gAlpha})`;
    ctx.beginPath();
    ctx.arc(gx, gy, gSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `hsla(${themeHue}, 100%, 90%, ${gAlpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(gx, gy, gSize * 1.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- MASTER POST-PROCESS ---
  // Edge Terminal Data
  ctx.save();
  ctx.globalAlpha = 0.08 + mid * 0.1;
  ctx.font = "7px monospace";
  ctx.fillStyle = `hsla(${themeHue}, 100%, 80%, 0.4)`;
  for (let i = 0; i < 8; i++) {
    const y = (t * 40 + i * 50) % height;
    ctx.fillText(Math.random().toString(16).slice(2, 10).toUpperCase(), 15, y);
    ctx.fillText(`0x${Math.floor(Math.random() * 255).toString(16)}`, width - 45, height - y);
  }
  ctx.restore();

  // Cinematic Vignette
  ctx.globalCompositeOperation = "multiply";
  const vignette = ctx.createRadialGradient(cx, cy, height * 0.3, cx, cy, width * 1.3);
  vignette.addColorStop(0, "white");
  vignette.addColorStop(0.7, "rgba(220, 220, 220, 0.95)");
  vignette.addColorStop(1, `rgba(0,0,0,${0.96 + bass * 0.04})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // Corner Glow
  ctx.globalCompositeOperation = "screen";
  const leakAlpha = Math.min(0.06, 0.03 * (bass + breathe));
  const leakGrd = ctx.createRadialGradient(width, 0, 0, width, 0, width * 0.7);
  leakGrd.addColorStop(0, `hsla(${accentHue}, 100%, 70%, ${leakAlpha})`);
  leakGrd.addColorStop(1, "transparent");
  ctx.fillStyle = leakGrd;
  ctx.fillRect(0, 0, width, height);

  // Scanlines
  ctx.globalAlpha = Math.min(0.04, 0.02 + treble * 0.03);
  ctx.fillStyle = "white";
  for (let i = 0; i < height; i += 5) {
    ctx.fillRect(0, i, width, 0.5);
  }

  ctx.globalAlpha = 1.0;
  ctx.restore();
};
