import { EffectContext } from "./types";

export const drawGravitationalField = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  const effectParams = params || { speed: 1, sensitivity: 1, coreIntensity: 1 };
  const t = time * 0.0006 * (effectParams.speed || 1);
  const cx = width / 2;
  const cy = height / 2;

  // --- AUDIO ANALYSIS & SMOOTHING ---
  const rawBass = data && data[0] ? (data[0] + data[1] + data[2] + data[3]) / 4 / 255 : 0;
  const rawMid = data && data[12] ? (data[12] + data[16] + data[20]) / 3 / 255 : 0;
  const rawTreble = data && data[24] ? (data[24] + data[28] + data[32]) / 3 / 255 : 0;
  const rawFull = data ? Array.from(data).reduce((a, b) => a + b, 0) / (data.length * 255) : 0;
  
  // Use the refs for persistent smoothing
  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.85 + rawBass * 0.15;
  refs.smoothMid.current = (refs.smoothMid.current || 0) * 0.88 + rawMid * 0.12;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.9 + rawTreble * 0.1;
  
  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;
  const volume = rawFull;

  const breath = Math.sin(t * 0.6) * 0.5 + 0.5;

  // --- 1. CINEMATIC BACKGROUND ---
  // Opaque clear at the start of every frame
  const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 1.0);
  bgGrd.addColorStop(0, `hsla(${theme.primary}, 60%, 8%, 1)`);
  bgGrd.addColorStop(0.6, `hsla(${theme.primary}, 80%, 4%, 1)`);
  bgGrd.addColorStop(1, "#000");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, width, height);

  // Background Data Rain (Depth)
  ctx.strokeStyle = `hsla(${theme.primary}, 100%, 70%, 0.12)`;
  ctx.lineWidth = 0.5;
  if (!refs.particles.current.length || refs.particles.current.length < 50) {
    refs.particles.current = Array.from({ length: 80 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 1 + Math.random() * 4,
      len: 5 + Math.random() * 20
    }));
  }
  refs.particles.current.forEach(p => {
    p.y += p.speed * (1 + bass * 2);
    if (p.y > height) p.y = -p.len;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.len); ctx.stroke();
  });

  // --- 2. CINEMATIC CAMERA ---
  const cameraX = Math.sin(t * 0.12) * 40;
  const cameraY = Math.cos(t * 0.1) * 25;
  const cameraScale = 1 + bass * 0.08 + breath * 0.04;

  ctx.save();
  ctx.translate(cx + cameraX, cy + cameraY);
  ctx.scale(cameraScale, cameraScale);
  ctx.translate(-cx, -cy);

  // --- 3. THE QUANTUM SHELL (MULTI-DIRECTIONAL ORBITS) ---
  ctx.save();
  ctx.translate(cx, cy);

  // A. Volumetric Core Pulse (Advanced Optics)
  const coreGlowAlpha = (bass * 0.3 + mid * 0.2) * effectParams.coreIntensity;
  if (coreGlowAlpha > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const coreGrd = ctx.createRadialGradient(0, 0, 80 + bass * 40, 0, 0, 400 + bass * 200);
    coreGrd.addColorStop(0, `hsla(${theme.primary}, 100%, 80%, ${coreGlowAlpha})`);
    coreGrd.addColorStop(0.5, `hsla(${theme.primary}, 80%, 40%, ${coreGlowAlpha * 0.3})`);
    coreGrd.addColorStop(1, "transparent");
    ctx.fillStyle = coreGrd;
    ctx.beginPath(); ctx.arc(0, 0, 600, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // B. Core Anamorphic Flare (Refined)
  const flareAlpha = (bass * 0.4 + treble * 0.5) * effectParams.coreIntensity;
  if (flareAlpha > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const fGrd = ctx.createLinearGradient(-width, 0, width, 0);
    fGrd.addColorStop(0, "transparent");
    fGrd.addColorStop(0.5, `hsla(${theme.secondary}, 100%, 85%, ${flareAlpha * 0.8})`);
    fGrd.addColorStop(1, "transparent");
    ctx.fillStyle = fGrd;
    ctx.fillRect(-width, -1, width * 2, 2);
    // Secondary Cross Flare
    ctx.rotate(Math.PI / 2);
    ctx.fillRect(-width/2, -0.5, width, 1);
    ctx.restore();
  }

  // C. Nebula Vortex Particles (Preserved)
  if (!refs.bokeh.current || refs.bokeh.current.length < 300) {
    refs.bokeh.current = Array.from({ length: 450 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 100 + Math.random() * 900,
      speed: 0.0004 + Math.random() * 0.003,
      size: 1 + Math.random() * 2.5,
      alpha: 0.2 + Math.random() * 0.5,
      hueOffset: Math.random() * 40 - 20
    }));
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  refs.bokeh.current.forEach(p => {
    p.angle += p.speed * (0.5 + bass * 2.5);
    const r = p.radius * (1 + bass * 0.1);
    const px = Math.cos(p.angle) * r;
    const py = Math.sin(p.angle) * r * 0.42;
    const hue = (theme.primary + p.hueOffset + 360) % 360;
    ctx.fillStyle = `hsla(${hue}, 90%, 75%, ${p.alpha * (0.4 + treble * 0.6)})`;
    ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();

  // D. Multi-Directional Orbital Shell (Advanced Geometry)
  const ringCount = 18;
  const orbitPoints: {x: number, y: number}[] = [];
  for (let i = 0; i < ringCount; i++) {
    const rx = (180 + i * 45) * (1 + bass * (0.12 - i * 0.004));
    // Varying aspect ratio for 3D tilt feel
    const aspect = 0.2 + (Math.sin(t * 0.2 + i * 0.5) * 0.15) + (i % 3) * 0.1;
    const ry = rx * aspect;
    const orbitRot = (i * Math.PI / 9) + t * 0.15 * (i % 2 === 0 ? 1 : -1);
    const orbitTilt = (i % 4) * (Math.PI / 8); // Offset tilt for 3D look
    
    ctx.save();
    ctx.rotate(orbitTilt + Math.sin(t * 0.1 + i) * 0.1);
    
    const ringAlpha = (0.1 + (1 - i / ringCount) * 0.3) * (0.6 + bass * 0.6);
    const orbitHueOffset = 30; // Create contrast with core
    let ringHue = (theme.primary + orbitHueOffset) % 360;
    if (i % 3 === 1) ringHue = (theme.secondary + orbitHueOffset) % 360;
    if (i % 3 === 2) ringHue = (theme.accent + orbitHueOffset) % 360;
    
    ctx.strokeStyle = `hsla(${ringHue}, 100%, 80%, ${ringAlpha})`;
    ctx.lineWidth = i % 6 === 0 ? 1.5 : 0.6;
    if (i % 4 === 1) ctx.setLineDash([15, 25]);
    
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, orbitRot, 0, Math.PI * 2);
    ctx.stroke();
    
    // Satellites & Shards
    const sAngle = t * (0.8 + i * 0.04) + i;
    const cosA = Math.cos(sAngle), sinA = Math.sin(sAngle);
    const cosR = Math.cos(orbitRot), sinR = Math.sin(orbitRot);
    const sx = (rx * cosA * cosR - ry * sinA * sinR);
    const sy = (rx * cosA * sinR + ry * sinA * cosR);
    
    const sSize = (2 + (i % 4)) * (1 + mid * 0.5);
    ctx.fillStyle = `hsla(${ringHue}, 100%, 90%, 0.8)`;
    
    if (i % 3 === 0) {
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(sAngle * 2);
      ctx.beginPath(); ctx.moveTo(0, -sSize); ctx.lineTo(sSize, sSize); ctx.lineTo(-sSize, sSize); ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(sx, sy, sSize, 0, Math.PI * 2); ctx.fill();
    }

    if (i % 6 === 0) {
      ctx.fillStyle = `hsla(${ringHue}, 100%, 95%, 0.5)`;
      ctx.font = "8px monospace";
      ctx.fillText(`TRK_${i}`, sx + 8, sy);
    }
    if (i < 5) orbitPoints.push({x: sx, y: sy});
    ctx.restore();
  }

  // --- E. INTERNAL GYROSCOPIC CORE (NEW: Multi-directional Turning Rings) ---
  const gyroCount = 4;
  for (let i = 0; i < gyroCount; i++) {
    ctx.save();
    const gRadius = 100 + i * 20;
    const gTilt = t * 0.5 + i * (Math.PI / 3);
    const gPitch = Math.sin(t * 0.4 + i) * 0.5;
    
    ctx.rotate(gTilt);
    ctx.rotate(gPitch);
    
    const gAlpha = (0.2 + bass * 0.4) * (1 - i / gyroCount);
    ctx.strokeStyle = `hsla(${(theme.accent + i * 30) % 360}, 100%, 85%, ${gAlpha})`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 15]);
    
    ctx.beginPath();
    ctx.ellipse(0, 0, gRadius, gRadius * 0.3, t * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    
    // Tiny energy nodes on gyro rings (Theme-aware glow)
    const nAngle = t * 2 + i;
    const nx = Math.cos(nAngle) * gRadius, ny = Math.sin(nAngle) * gRadius * 0.3;
    ctx.fillStyle = `hsla(${(theme.accent + i * 30) % 360}, 100%, 95%, 0.9)`;
    ctx.beginPath(); ctx.arc(nx, ny, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // --- F. CINEMATIC OPTICAL SHIMMER ---
  const shimmerCount = 12;
  for (let i = 0; i < shimmerCount; i++) {
    const sAngle = t * 0.1 + i * (Math.PI * 2 / shimmerCount);
    const sLen = width * 0.4 * (1 + bass * 0.5);
    const sGrd = ctx.createLinearGradient(0, 0, sLen, 0);
    sGrd.addColorStop(0, `hsla(${theme.primary}, 100%, 95%, ${0.05 * bass})`);
    sGrd.addColorStop(1, "transparent");
    
    ctx.save();
    ctx.rotate(sAngle);
    ctx.fillStyle = sGrd;
    ctx.fillRect(0, -0.5, sLen, 1);
    ctx.restore();
  }

  // --- 4. BOLD GRAVITATIONAL CORE (ENHANCED) ---
  const coreR = 160 * (1 + volume * 0.9 + bass * 0.5);
  const coreHueShift = Math.sin(t * 0.5) * 30; // Subtle color oscillation
  
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  
  // Outer Soft Glow (Nebula-like)
  const outerGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 1.5);
  outerGrd.addColorStop(0, `hsla(${theme.primary + coreHueShift}, 80%, 50%, 0.3)`);
  outerGrd.addColorStop(1, "transparent");
  ctx.fillStyle = outerGrd;
  ctx.beginPath(); ctx.arc(0, 0, coreR * 1.5, 0, Math.PI * 2); ctx.fill();

  // Main Core Singularity (Softened for Cinematic Depth)
  const coreGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
  coreGrd.addColorStop(0, `hsla(${(theme.accent + coreHueShift) % 360}, 100%, 95%, 1)`);
  coreGrd.addColorStop(0.2, `hsla(${(theme.accent + coreHueShift) % 360}, 100%, 85%, 0.8)`);
  coreGrd.addColorStop(0.5, `hsla(${(theme.secondary - coreHueShift + 360) % 360}, 100%, 70%, 0.6)`);
  coreGrd.addColorStop(0.8, `hsla(${theme.primary}, 100%, 40%, 0.2)`);
  coreGrd.addColorStop(1, "transparent");
  ctx.fillStyle = coreGrd;
  ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();

  // Inner Energy "Heartbeat"
  if (bass > 0.4) {
    const innerR = coreR * 0.3 * (1 + treble);
    const innerGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, innerR);
    innerGrd.addColorStop(0, "#fff");
    innerGrd.addColorStop(1, "transparent");
    ctx.fillStyle = innerGrd;
    ctx.beginPath(); ctx.arc(0, 0, innerR, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // --- 5. SHARP HUD TARGETING ---
  const sqSize = 240 * (1 + volume * 1.3);
  const hudAlpha = 0.6 + bass * 0.4;
  const hudHue = theme.secondary;
  ctx.strokeStyle = `hsla(${hudHue}, 100%, 60%, ${hudAlpha})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(-sqSize / 2, -sqSize / 2, sqSize, sqSize);
  
  // Scanning lines to satellites
  if (bass > 0.3) {
    ctx.save();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = `hsla(${hudHue}, 100%, 60%, ${bass * 0.3})`;
    orbitPoints.forEach(p => {
      ctx.beginPath(); ctx.moveTo(p.x * 0.2, p.y * 0.2); ctx.lineTo(p.x, p.y); ctx.stroke();
    });
    ctx.restore();
  }

  const bL = 35;
  ctx.lineWidth = 4;
  [[-1,-1], [1,-1], [1,1], [-1,1]].forEach(([sx, sy]) => {
    ctx.save();
    ctx.scale(sx, sy);
    ctx.beginPath(); ctx.moveTo(sqSize/2, sqSize/2 - bL); ctx.lineTo(sqSize/2, sqSize/2); ctx.lineTo(sqSize/2 - bL, sqSize/2); ctx.stroke();
    ctx.restore();
  });
  ctx.restore(); // End Camera space

  // --- 6. TECHNICAL HUD OVERLAY ---
  ctx.save();
  const m = 140; // Corner margin
  ctx.fillStyle = `hsla(${hudHue}, 100%, 60%, 0.9)`;
  ctx.font = "900 13px 'JetBrains Mono', monospace";
  ctx.fillText("CRITICAL_OVERLOAD", m, m - 10);
  
  // Glitchy line
  ctx.save();
  ctx.strokeStyle = `hsla(${hudHue}, 100%, 60%, ${0.4 + bass * 0.5})`;
  ctx.beginPath();
  for (let i = 0; i < 110; i++) {
    const gx = m + i, gy = m - 2 + Math.sin(t * 15 + i * 0.2) * (2 + bass * 12);
    if (i === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
  }
  ctx.stroke();
  ctx.restore();

  ctx.font = "bold 10px monospace";
  ctx.fillText(`ENTROPY: ${(0.9211 + Math.random() * 0.05).toFixed(4)}`, m, m + 15);
  ctx.fillText(`G_WELL: ${(14.8 + bass * 5.2).toFixed(2)}G`, m, m + 28);
  
  ctx.textAlign = "right";
  ctx.fillText(`COORD_X: ${(cx + cameraX).toFixed(1)}`, width - m, m + 15);
  ctx.fillText(`COORD_Y: ${(cy + cameraY).toFixed(1)}`, width - m, m + 28);
  
  // Mini waveform
  ctx.save();
  ctx.translate(m, height - m);
  ctx.strokeStyle = `hsla(${hudHue}, 100%, 60%, 0.5)`;
  ctx.beginPath();
  for (let i = 0; i < 60; i++) {
    const val = (data[i] || 0) / 255 * 20;
    ctx.moveTo(i * 2, 0); ctx.lineTo(i * 2, -val);
  }
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // --- 7. POST-PROCESSING (Vibration Ghosting) ---
  if (bass > 0.75) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const intensity = (bass - 0.75) * 4;
    const offset = intensity * 15;
    ctx.globalAlpha = 0.3 * intensity;
    ctx.drawImage(ctx.canvas, offset * (Math.random() - 0.5), offset * (Math.random() - 0.5));
    ctx.globalAlpha = 0.2 * intensity;
    ctx.drawImage(ctx.canvas, -offset * (Math.random() - 0.5), -offset * (Math.random() - 0.5));
    ctx.restore();
  }

  // Final Vignette
  const vig = ctx.createRadialGradient(cx, cy, height * 0.3, cx, cy, width * 1.1);
  vig.addColorStop(0, "transparent");
  vig.addColorStop(1, "rgba(0, 0, 0, 0.9)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
};
