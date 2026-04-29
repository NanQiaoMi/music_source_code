import { EffectContext } from "./types";

export const drawSpectrumRing = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  const effectParams = params || { rotationSpeed: 1, haloStyle: 0, barWidth: 2, glowIntensity: 1 };
  const style = effectParams.haloStyle || 0; 
  const t = time * 0.001 * (effectParams.rotationSpeed || 1);
  const breathe = Math.sin(t * 0.45);
  const slowPulse = Math.sin(t * 0.15) * 0.5 + 0.5;
  const pulse = Math.sin(t * 0.8) * 0.5 + 0.5;
  
  // --- 0. SANITIZATION (Safety first) ---
  const safeWidth = isFinite(width) && width > 0 ? width : 1920;
  const safeHeight = isFinite(height) && height > 0 ? height : 1080;
  const cx = safeWidth / 2, cy = safeHeight / 2;
  const sanitize = (val: number, def = 0) => (isFinite(val) ? val : def);
  const sanitizePos = (val: number, def = 0) => (isFinite(val) ? Math.max(0, val) : def);
  const getSafeVal = (idx: number) => (data && data[idx] !== undefined) ? data[idx] / 255 : 0;

  // --- 1. ADVANCED SIGNAL ANALYTICS ---
  const rawBass = (getSafeVal(0) + getSafeVal(1) + getSafeVal(2) + getSafeVal(3)) / 4;
  const rawMid = (getSafeVal(12) + getSafeVal(16) + getSafeVal(20)) / 3;
  const rawTreble = (getSafeVal(24) + getSafeVal(28) + getSafeVal(32)) / 3;

  refs.smoothBass.current = sanitize(refs.smoothBass.current) * 0.82 + rawBass * 0.18;
  refs.smoothMid.current = sanitize(refs.smoothMid.current) * 0.85 + rawMid * 0.15;
  refs.smoothTreble.current = sanitize(refs.smoothTreble.current) * 0.88 + rawTreble * 0.12;

  const bass = sanitize(refs.smoothBass.current);
  const mid = sanitize(refs.smoothMid.current);
  const treble = sanitize(refs.smoothTreble.current);
  const energy = (bass + mid + treble) / 3;
  const isPeak = bass > 0.85;

  const driftX = sanitize(Math.sin(t * 0.2) * 80 + breathe * 30);
  const driftY = sanitize(Math.cos(t * 0.18) * 50 + breathe * 20);
  const globalScale = sanitize(1.0 + breathe * 0.04 + bass * 0.12, 1.0);
  const tilt = sanitize(Math.sin(t * 0.1) * 0.04 + Math.cos(t * 0.05) * 0.02);
  
  // Core Geometry
  const baseR = sanitizePos(Math.min(safeWidth, safeHeight) * 0.18 * (1 + bass * 0.1) * (1 + breathe * 0.03), 60);

  // --- 3. ATMOSPHERIC BASE & DEPTH ---
  ctx.save();
  // Semi-transparent clear for subtle motion blur trails
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(1, 1, 4, ${0.15 + (1 - bass) * 0.1})`; 
  ctx.fillRect(0, 0, safeWidth, safeHeight);

  const ringHue = sanitize(theme.primary, 280);
  const accentHue = sanitize(theme.accent, 320);

  // Mood-Driven Hue Shift (Subtle mood based on frequency balance)
  const moodHue = (bass - treble) * 15;
  const activeRingHue = ringHue + moodHue;
  const activeAccentHue = accentHue + moodHue;

  // Volumetric Depth Mist
  ctx.globalCompositeOperation = "screen";
  const mistR = sanitize(safeWidth * 1.4, 100);
  const mistGrd = ctx.createRadialGradient(cx + driftX, cy + driftY, 0, cx + driftX, cy + driftY, mistR);
  mistGrd.addColorStop(0, `hsla(${activeRingHue}, 100%, 15%, ${0.12 + bass * 0.2})`);
  mistGrd.addColorStop(0.6, `hsla(${activeAccentHue}, 100%, 8%, ${0.06 + mid * 0.12})`);
  mistGrd.addColorStop(1, "transparent");
  ctx.fillStyle = mistGrd;
  ctx.fillRect(0, 0, safeWidth, safeHeight);

  // --- 4. GRAVITY-BOUND BOKEH ---
  if (!refs.bokeh.current || refs.bokeh.current.length < 50) {
    refs.bokeh.current = Array.from({ length: 70 }, () => ({
      x: Math.random() * safeWidth,
      y: Math.random() * safeHeight,
      size: Math.random() * 120 + 40,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      hue: activeRingHue + (Math.random() - 0.5) * 80,
      alpha: Math.random() * 0.12
    }));
  }

  refs.bokeh.current.forEach(b => {
    const dx = cx + driftX - b.x;
    const dy = cy + driftY - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const pull = (150 / (dist + 500)) * (1 + bass * 4);
    b.vx += (dx / dist) * pull * 0.02;
    b.vy += (dy / dist) * pull * 0.02;
    b.x += b.vx * (1 + energy * 2);
    b.y += b.vy * (1 + energy * 2);
    
    if (b.x < -200) b.x = safeWidth + 200; if (b.x > safeWidth + 200) b.x = -200;
    if (b.y < -200) b.y = safeHeight + 200; if (b.y > safeHeight + 200) b.y = -200;

    const bSize = sanitize(b.size * (0.8 + bass * 0.5) * (1 - slowPulse * 0.2), 1);
    const bx = sanitize(b.x), by = sanitize(b.y);
    if (bSize > 1 && isFinite(bx) && isFinite(by)) {
      const bGrd = ctx.createRadialGradient(bx, by, 0, bx, by, bSize);
      bGrd.addColorStop(0, `hsla(${b.hue}, 85%, 65%, ${b.alpha * (0.3 + pulse * 0.7)})`);
      bGrd.addColorStop(1, "transparent");
      ctx.fillStyle = bGrd;
      ctx.beginPath(); ctx.arc(bx, by, bSize, 0, Math.PI * 2); ctx.fill();
    }
  });
  ctx.restore();

  // --- 5. CINEMATIC CAMERA SYSTEM ---
  ctx.save();
  ctx.translate(cx + driftX, cy + driftY);
  ctx.rotate(tilt);
  ctx.scale(globalScale, globalScale);
  ctx.translate(-cx, -cy);

  // --- 6. QUANTUM SPACE GRID (Warped) ---
  const drawQuantumWarpGrid = () => {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const spacing = 120;
    const scroll = (t * 100) % spacing;
    const gridHue = activeRingHue;
    
    // Perspective / Warp function
    const warp = (x: number, y: number) => {
      const dX = x - cx;
      const dY = y - cy;
      const d = Math.sqrt(dX * dX + dY * dY);
      const strength = 180 * bass + 40;
      const f = Math.exp(-d / 400) * strength;
      const a = Math.atan2(dY, dX);
      return { 
        wx: sanitize(x + Math.cos(a) * f), 
        wy: sanitize(y + Math.sin(a) * f),
        alpha: sanitize(Math.max(0, 0.08 * (1 - d / (safeWidth * 0.8))))
      };
    };

    ctx.lineWidth = 0.6;
    for (let x = -spacing; x < safeWidth + spacing; x += spacing) {
      ctx.beginPath();
      for (let y = -spacing; y < safeHeight + spacing; y += 30) {
        const { wx, wy, alpha } = warp(x, y + scroll);
        ctx.strokeStyle = `hsla(${gridHue}, 100%, 75%, ${alpha * (0.5 + bass * 0.5)})`;
        if (y === -spacing) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    }
    
    for (let y = -spacing; y < safeHeight + spacing; y += spacing) {
      ctx.beginPath();
      for (let x = -spacing; x < safeWidth + spacing; x += 30) {
        const { wx, wy, alpha } = warp(x, y + (t * 50) % spacing);
        ctx.strokeStyle = `hsla(${gridHue}, 100%, 75%, ${alpha * (0.5 + bass * 0.5)})`;
        if (x === -spacing) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    }
    ctx.restore();
  };
  drawQuantumWarpGrid();

  // --- 7. RADIAL SHOCKWAVES (Peak Hits) ---
  if (isPeak && (!refs.shockwaves.current.length || t - refs.shockwaves.current[refs.shockwaves.current.length-1].start > 0.3)) {
    refs.shockwaves.current.push({ start: t, life: 1.0 });
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  refs.shockwaves.current = refs.shockwaves.current.filter(s => {
    const age = (t - s.start) * 2;
    if (age > 1 || age < 0) return false; // age < 0 handles time resets/jumps
    const r = Math.max(0, baseR * (1 + age * 8));
    ctx.strokeStyle = `hsla(${activeRingHue}, 100%, 90%, ${(1 - age) * 0.4})`;
    ctx.lineWidth = 3 * (1 - age);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    
    // Add data hex glitches along the shockwave
    if (age < 0.3) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(age * 10);
      ctx.font = '8px monospace';
      ctx.fillStyle = `hsla(${activeAccentHue}, 100%, 90%, ${1 - age * 3})`;
      for(let i=0; i<8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.fillText(Math.random().toString(16).slice(2, 6).toUpperCase(), r + 10, 0);
      }
      ctx.restore();
    }
    return true;
  });
  ctx.restore();

  // --- 8. THE EVENT HORIZON RING (Nested Geometric) ---
  const drawEventHorizon = () => {
    ctx.save();
    ctx.translate(cx, cy);
    
    // Inner Tech Ring
    for(let i=0; i<3; i++) {
      const r = baseR * (1.1 + i * 0.15 + bass * 0.05);
      const rot = t * (i % 2 === 0 ? 0.4 : -0.3) + i * 0.5;
      const sides = 6 + i * 2;
      
      ctx.save();
      ctx.rotate(rot);
      ctx.strokeStyle = `hsla(${activeRingHue}, 100%, 85%, ${0.15 / (i + 1) + pulse * 0.2})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for(let j=0; j<sides; j++) {
        const a = (j / sides) * Math.PI * 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if(j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      
      // Add small vertices
      ctx.fillStyle = "white";
      for(let j=0; j<sides; j++) {
        const a = (j / sides) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    
    // Rotating Hex Data
    ctx.rotate(-t * 0.2);
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillStyle = `hsla(${activeRingHue}, 100%, 90%, ${0.3 + bass * 0.4})`;
    const hexCount = 14;
    for (let i = 0; i < hexCount; i++) {
      ctx.save();
      ctx.rotate((i / hexCount) * Math.PI * 2 + t * 0.5);
      const hex = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
      ctx.fillText(`SYS_${hex}`, baseR * 1.5, 0);
      if (i % 4 === 0) {
        ctx.fillRect(baseR * 1.4, -1, 15, 1);
      }
      ctx.restore();
    }
    ctx.restore();
  };
  drawEventHorizon();

  // --- 9. SPECTRAL MODES ---
  if (style === 0) { // --- 🌈 HYPER-SPECTRAL FORGE 4.0 ---
    const bars = 140;
    const step = (Math.PI * 2) / bars;
    
    if (bass > 0.65) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const sW = safeWidth * 0.95 * bass;
      const sG = ctx.createLinearGradient(-sW/2, 0, sW/2, 0);
      sG.addColorStop(0, "transparent");
      sG.addColorStop(0.5, `hsla(${activeAccentHue}, 100%, 85%, ${(bass - 0.5) * 0.6})`);
      sG.addColorStop(1, "transparent");
      ctx.fillStyle = sG;
      ctx.fillRect(cx - sW/2, cy - 4, sW, 8);
      ctx.restore();
    }

    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < bars; i++) {
      const angle = i * step + t * 0.4;
      const val = getSafeVal((i % 32) * 2);
      const barH = val * 240 * (1 + bass * 0.5);
      if (barH < 3) continue;

      const x1 = cx + Math.cos(angle) * baseR;
      const y1 = cy + Math.sin(angle) * baseR;
      const x2 = cx + Math.cos(angle) * (baseR + barH);
      const y2 = cy + Math.sin(angle) * (baseR + barH);

      const bHue = activeRingHue + i * 1.8 + t * 60;
      const bG = ctx.createLinearGradient(x1, y1, x2, y2);
      bG.addColorStop(0, `hsla(${bHue}, 100%, 88%, 0.95)`);
      bG.addColorStop(0.4, `hsla(${bHue + 35}, 100%, 75%, 0.5)`);
      bG.addColorStop(1, "transparent");

      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = bG;
      ctx.lineWidth = (effectParams.barWidth || 2.5) * (1.2 + val * 3);
      ctx.lineCap = "round";
      ctx.stroke();

      // Data Pulse Streams (Cyber Matrix crossover)
      if (val > 0.7 && i % 8 === 0) {
        ctx.save();
        ctx.translate(x2, y2);
        ctx.rotate(angle);
        ctx.fillStyle = `hsla(${bHue}, 100%, 90%, ${val * 0.6})`;
        ctx.font = '6px monospace';
        const streamText = Math.random() > 0.5 ? "1" : "0";
        ctx.fillText(streamText, val * 50 * t % 40, 0);
        ctx.restore();
      }

      if (val > 0.88) {
        const sz = 18 * val;
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x2 - sz, y2); ctx.lineTo(x2 + sz, y2);
        ctx.moveTo(x2, y2 - sz); ctx.lineTo(x2, y2 + sz);
        ctx.stroke();
      }
    }
  } 
  else if (style === 1) { // --- ✨ CELESTIAL STAR DUST 4.0 ---
    if (refs.spectrumStars.current.length < 600) {
      for (let i = 0; i < 600; i++) {
        refs.spectrumStars.current.push({
          angle: Math.random() * Math.PI * 2,
          dist: baseR + Math.random() * 500,
          size: Math.random() * 2.5 + 0.5,
          speed: 0.004 + Math.random() * 0.008,
          twinkle: Math.random() * Math.PI * 2,
          depth: Math.random(),
          hue: activeRingHue + (Math.random() - 0.5) * 90
        });
      }
    }

    const stars = refs.spectrumStars.current;
    ctx.globalCompositeOperation = "screen";
    stars.forEach((p, pi) => {
      const idx = (pi % 32) * 2;
      const val = getSafeVal(idx);
      
      p.dist = p.dist * 0.95 + (baseR + 60 + val * 400 * p.depth) * 0.05;
      p.angle += p.speed * (0.8 + bass * 1.6);
      p.twinkle += 0.12;

      const px = sanitize(cx + Math.cos(p.angle) * p.dist);
      const py = sanitize(cy + Math.sin(p.angle) * p.dist);
      const alpha = (Math.sin(p.twinkle) * 0.5 + 0.5) * (0.4 + val * 0.6);
      
      ctx.fillStyle = `hsla(${p.hue}, 95%, ${p.depth > 0.85 ? 98 : 82}%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, p.size * (1 + val * 3), 0, Math.PI * 2);
      ctx.fill();

      if (pi % 20 === 0 && val > 0.65) {
        const nP = stars[(pi + 1) % stars.length];
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.lineTo(cx + Math.cos(nP.angle)*nP.dist, cy + Math.sin(nP.angle)*nP.dist);
        ctx.strokeStyle = `hsla(${activeRingHue}, 100%, 92%, ${0.1 * val})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    });
  }

  // --- 10. THE UNSTABLE SINGULARITY CORE ---
  ctx.globalCompositeOperation = "source-over";
  const jitter = (Math.random() - 0.5) * 10 * treble;
  const singR = sanitizePos(baseR * (0.9 + bass * 0.5) + jitter, 25);
  
  if (singR > 5) {
    const cG = ctx.createRadialGradient(cx + jitter, cy + jitter, 0, cx, cy, singR);
    cG.addColorStop(0, "#fff");
    cG.addColorStop(0.2, `hsla(${activeRingHue}, 100%, 90%, ${0.9 + pulse * 0.1})`);
    cG.addColorStop(0.6, `hsla(${activeRingHue}, 100%, 50%, ${0.5 + bass * 0.5})`);
    cG.addColorStop(1, "transparent");
    ctx.fillStyle = cG;
    ctx.beginPath(); ctx.arc(cx, cy, singR, 0, Math.PI * 2); ctx.fill();
    
    if (treble > 0.7) {
      ctx.strokeStyle = `hsla(${activeAccentHue}, 100%, 95%, ${treble * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, singR + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // --- 11. HOLOGRAPHIC HUD TELEMETRY (Bridge Style) ---
  ctx.restore();
  ctx.save();
  const hudA = sanitize((0.6 + Math.sin(t * 12) * 0.15) * (0.4 + bass * 0.6));
  const m = 140;
  
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.fillStyle = `hsla(${activeRingHue}, 100%, 90%, ${hudA})`;
  
  // Left: Core Status & Flux
  ctx.textAlign = "left";
  ctx.fillText(`SINGULARITY_SYNC_V9.2 // STATUS: ${isPeak ? "CRITICAL_OVERLOAD" : "STABLE_FLOW"}`, m, m);
  ctx.font = '7px monospace';
  ctx.fillText(`FLUX_DENSITY: ${(1500 + bass * 1200).toFixed(2)} Q-BITS/s`, m, m + 14);
  ctx.fillText(`THETA_INDEX: ${(t % 360).toFixed(3)}°`, m, m + 24);
  ctx.fillText(`EVENT_HORIZON_STABILITY: ${(99.98 - energy * 2).toFixed(2)}%`, m, m + 34);
  
  // Right: Navigation & Entropy
  ctx.textAlign = "right";
  ctx.font = 'bold 9px monospace';
  ctx.fillText(`GEO_COORD: [${(driftX * 0.2).toFixed(4)}, ${(driftY * 0.2).toFixed(4)}]`, safeWidth - m, m);
  ctx.font = '7px monospace';
  ctx.fillText(`ENTROPY_INDEX: ${(0.85 + energy * 0.15).toFixed(5)}`, safeWidth - m, m + 12);
  ctx.fillText(`SIGNAL_PEAK: ${(bass * 100).toFixed(0)}%`, safeWidth - m, m + 22);

  // Bottom Center: Spectrum Log
  ctx.textAlign = "center";
  ctx.font = '6px monospace';
  const logStr = `B:${bass.toFixed(2)} M:${mid.toFixed(2)} T:${treble.toFixed(2)} | SIGNAL_LOCK_ACTIVE`;
  ctx.fillText(logStr, cx, safeHeight - m + 40);

  // Orbital HUD Detail
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = `hsla(${activeAccentHue}, 100%, 80%, ${hudA * 0.3})`;
  ctx.setLineDash([2, 10]);
  ctx.beginPath(); ctx.arc(0, 0, baseR * 1.7, 0, Math.PI * 2); ctx.stroke();
  
  // Add a secondary dashed ring
  ctx.rotate(-t * 0.6);
  ctx.setLineDash([20, 40]);
  ctx.beginPath(); ctx.arc(0, 0, baseR * 1.9, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // Tactical Corner Brackets
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = `hsla(${activeRingHue}, 100%, 90%, 0.35)`;
  const bL = 35;
  [ [m, m], [safeWidth-m, m], [safeWidth-m, safeHeight-m], [m, safeHeight-m] ].forEach(([x, y], i) => {
    ctx.save(); ctx.translate(x, y);
    ctx.rotate((i * Math.PI) / 2);
    ctx.beginPath(); ctx.moveTo(0, bL); ctx.lineTo(0, 0); ctx.lineTo(bL, 0); ctx.stroke();
    // Add small technical dots
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  // --- 12. IMPECCABLE POST-PROCESSING (Enhanced Optical) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  
  // Multiple Lens Ghosting Layers
  const drawGhost = (dist: number, size: number, opacity: number, hueShift: number, type: 'circle' | 'poly' = 'circle') => {
    const gx = cx - driftX * dist;
    const gy = cy - driftY * dist;
    const gR = sanitizePos(size * (1 + bass * 0.3));
    if (gR > 0) {
      const gG = ctx.createRadialGradient(gx, gy, 0, gx, gy, gR);
      gG.addColorStop(0, `hsla(${activeRingHue + hueShift}, 100%, 70%, ${opacity * 0.25})`);
      gG.addColorStop(1, "transparent");
      ctx.fillStyle = gG;
      if (type === 'circle') {
        ctx.beginPath(); ctx.arc(gx, gy, gR, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath();
        for(let i=0; i<6; i++) {
          const a = (i / 6) * Math.PI * 2 + t * 0.2;
          const px = gx + Math.cos(a) * gR;
          const py = gy + Math.sin(a) * gR;
          if(i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
      }
    }
  };
  
  drawGhost(1.4, 35, 0.4, 15);
  drawGhost(1.0, 20, 0.3, -25, 'poly');
  drawGhost(0.6, 50, 0.2, 45);
  drawGhost(-0.4, 70, 0.15, -10);

  // Peak Chromatic Ghosting
  // Peak Chromatic Ghosting (Fixed feedback loop by using source-over)
  if (isPeak) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.15;
    const off = bass * 12;
    ctx.drawImage(ctx.canvas, off, 0);
    ctx.drawImage(ctx.canvas, -off, 0);
    ctx.restore();
  }

  // Organic Interlaced Scanlines (Cyber Matrix feel)
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = `rgba(255, 255, 255, ${0.015 + Math.random() * 0.01})`;
  for (let i = 0; i < safeHeight; i += 3) {
    const y = (i + t * 30) % safeHeight;
    ctx.fillRect(0, y, safeWidth, 1);
  }
  ctx.restore();

  // Dynamic Film Grain & Static Glitch
  for (let i = 0; i < 15; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.02 + Math.random() * 0.05})`;
    const sz = Math.random() * 2 + 1;
    ctx.fillRect(Math.random() * safeWidth, Math.random() * safeHeight, sz, sz);
  }

  // Cinematic Heavy Vignette
  const vigR = sanitize(safeWidth * 1.0, 100);
  const vigGrd = ctx.createRadialGradient(cx, cy, baseR * 1.5, cx, cy, vigR);
  vigGrd.addColorStop(0, "transparent");
  vigGrd.addColorStop(0.7, "rgba(0,0,10,0.4)");
  vigGrd.addColorStop(1, "rgba(0,0,0,0.95)");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = vigGrd;
  ctx.fillRect(0, 0, safeWidth, safeHeight);
  
  ctx.restore();
};
