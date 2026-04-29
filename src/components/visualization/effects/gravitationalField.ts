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
  bgGrd.addColorStop(0, "#080c25");
  bgGrd.addColorStop(0.6, "#02040c");
  bgGrd.addColorStop(1, "#000");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, width, height);

  // Background Data Rain (Depth)
  ctx.strokeStyle = "rgba(100, 180, 255, 0.12)";
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

  // Optical Light Leaks
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const leakHue = (theme.primary + Math.sin(t * 0.1) * 30) % 360;
  const leakGrd = ctx.createRadialGradient(cx * 0.4, cy * 0.6, 0, cx * 0.4, cy * 0.6, width * 0.7);
  leakGrd.addColorStop(0, `hsla(${leakHue}, 80%, 35%, ${0.1 * breath})`);
  leakGrd.addColorStop(1, "transparent");
  ctx.fillStyle = leakGrd;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // --- 2. CINEMATIC CAMERA ---
  const cameraX = Math.sin(t * 0.12) * 40;
  const cameraY = Math.cos(t * 0.1) * 25;
  const cameraScale = 1 + bass * 0.08 + breath * 0.04;

  ctx.save();
  ctx.translate(cx + cameraX, cy + cameraY);
  ctx.scale(cameraScale, cameraScale);
  ctx.translate(-cx, -cy);

  // --- 3. THE GALAXY ORBITS ---
  ctx.save();
  ctx.translate(cx, cy);

  // Core Anamorphic Flare
  const flareAlpha = (bass * 0.4 + treble * 0.5) * effectParams.coreIntensity;
  if (flareAlpha > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const fGrd = ctx.createLinearGradient(-width / 1.5, 0, width / 1.5, 0);
    fGrd.addColorStop(0, "transparent");
    fGrd.addColorStop(0.5, `rgba(160, 210, 255, ${flareAlpha * 0.7})`);
    fGrd.addColorStop(1, "transparent");
    ctx.fillStyle = fGrd;
    ctx.fillRect(-width / 1.5, -1, width * 1.3, 2);
    ctx.restore();
  }

  // Nebula Vortex Particles
  if (!refs.bokeh.current || refs.bokeh.current.length < 300) {
    refs.bokeh.current = Array.from({ length: 450 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 100 + Math.random() * 900,
      speed: 0.0004 + Math.random() * 0.003,
      size: 1 + Math.random() * 2.5,
      alpha: 0.2 + Math.random() * 0.5,
      hue: Math.random() > 0.8 ? 0 : 210 + Math.random() * 40
    }));
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  refs.bokeh.current.forEach(p => {
    p.angle += p.speed * (0.5 + bass * 2.5);
    const r = p.radius * (1 + bass * 0.1);
    const px = Math.cos(p.angle) * r;
    const py = Math.sin(p.angle) * r * 0.42;
    ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, ${p.alpha * (0.4 + treble * 0.6)})`;
    ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();

  // Massive Orbital Ring System
  const ringCount = 22;
  const orbitPoints: {x: number, y: number}[] = [];
  for (let i = 0; i < ringCount; i++) {
    const rx = (150 + i * 40) * (1 + bass * (0.15 - i * 0.005));
    const ry = rx * (0.28 + (i % 7) * 0.06);
    const orbitT = t * (0.12 + i * 0.02) + (i * Math.PI / 11);
    
    ctx.save();
    ctx.rotate(orbitT);
    
    const ringAlpha = (0.15 + (1 - i / ringCount) * 0.35) * (0.7 + bass * 0.5);
    const hue = i % 3 === 0 ? 210 : (i % 3 === 1 ? 190 : 340);
    ctx.strokeStyle = `hsla(${hue}, 100%, 75%, ${ringAlpha})`;
    ctx.lineWidth = i % 5 === 0 ? 1.8 : 0.8;
    
    if (i % 4 === 1) ctx.setLineDash([10, 20]);
    
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // Satellites
    const sAngle = t * (1 + i * 0.05);
    const sx = Math.cos(sAngle) * rx;
    const sy = Math.sin(sAngle) * ry;
    const sSize = (3 + (i % 5)) * (1 + mid * 0.4);
    ctx.fillStyle = `hsla(${hue}, 100%, 85%, 0.9)`;
    if (i % 4 === 0) ctx.strokeRect(sx - sSize/2, sy - sSize/2, sSize, sSize);
    else { ctx.beginPath(); ctx.arc(sx, sy, sSize, 0, Math.PI * 2); ctx.fill(); }
    if (i % 5 === 0) {
      ctx.fillStyle = `hsla(${hue}, 100%, 90%, 0.6)`;
      ctx.font = "bold 9px monospace";
      ctx.fillText(`SAT_V${i}`, sx + 10, sy);
    }
    if (i < 4) orbitPoints.push({x: sx, y: sy});
    ctx.restore();
  }

  // --- 4. BOLD GRAVITATIONAL CORE ---
  const coreR = 160 * (1 + volume * 0.9 + bass * 0.5);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const coreGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
  coreGrd.addColorStop(0, "#fff");
  coreGrd.addColorStop(0.3, "rgba(180, 230, 255, 1)");
  coreGrd.addColorStop(0.6, "rgba(40, 100, 255, 0.4)");
  coreGrd.addColorStop(1, "transparent");
  ctx.fillStyle = coreGrd;
  ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // --- 5. SHARP HUD TARGETING ---
  const sqSize = 240 * (1 + volume * 1.3);
  const hudAlpha = 0.6 + bass * 0.4;
  ctx.strokeStyle = `rgba(255, 60, 60, ${hudAlpha})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(-sqSize / 2, -sqSize / 2, sqSize, sqSize);
  
  // Scanning lines to satellites
  if (bass > 0.3) {
    ctx.save();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = `rgba(255, 60, 60, ${bass * 0.3})`;
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
  ctx.fillStyle = "rgba(255, 60, 60, 0.9)";
  ctx.font = "900 13px 'JetBrains Mono', monospace";
  ctx.fillText("CRITICAL_OVERLOAD", m, m - 10);
  
  // Glitchy line
  ctx.save();
  ctx.strokeStyle = `rgba(255, 60, 60, ${0.4 + bass * 0.5})`;
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
  ctx.strokeStyle = "rgba(255, 60, 60, 0.5)";
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
