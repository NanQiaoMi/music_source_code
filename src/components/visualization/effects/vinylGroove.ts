import { EffectContext } from "./types";

export const drawVinylGroove = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  const effectParams = params || { spinSpeed: 1, grooveIntensity: 1, glowAmount: 1, opticalComplexity: 1, chromaticIntensity: 1 };
  const t = time * 0.001 * (effectParams.spinSpeed || 1);

  // --- SANITIZE & PERFORMANCE CONFIG ---
  const safeWidth = isFinite(width) && width > 0 ? width : 1920;
  const safeHeight = isFinite(height) && height > 0 ? height : 1080;
  const cx = safeWidth / 2;
  const cy = safeHeight / 2;

  const optComp = isFinite(effectParams.opticalComplexity) ? effectParams.opticalComplexity : 1.0;
  const chromInt = isFinite(effectParams.chromaticIntensity) ? effectParams.chromaticIntensity : 1.0;
  const isHighPerformance = optComp > 0.8;

  // --- ENHANCED ANALYTICS ---
  const rawBass = data && data[0] ? (data[0] + data[1] + data[2] + data[3]) / 4 / 255 : 0;
  const rawTreble = data && data[32] ? (data[32] + data[36] + data[40]) / 3 / 255 : 0;
  const rawMid = data && data[16] ? (data[16] + data[20] + data[24]) / 3 / 255 : 0;
  
  const safeBass = isFinite(rawBass) ? rawBass : 0;
  const safeTreble = isFinite(rawTreble) ? rawTreble : 0;
  const safeMid = isFinite(rawMid) ? rawMid : 0;
  
  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.82 + safeBass * 0.18;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.85 + safeTreble * 0.15;
  
  const bass = refs.smoothBass.current;
  const treble = refs.smoothTreble.current;
  const mid = safeMid;

  const isPeak = bass > 0.90;
  const themeHue = isFinite(theme.primary) ? theme.primary : 280;
  const accentHue = isFinite(theme.accent) ? theme.accent : 320;

  // --- BREATHING RHYTHM ---
  const breath = Math.sin(t * 0.4) * 0.5 + 0.5; 
  const slowPulse = Math.sin(t * 0.15) * 0.5 + 0.5;
  const twitch = Math.random() > 0.98 ? Math.random() : 0;

  // Initialize Bokeh if needed
  if (!refs.bokeh.current || refs.bokeh.current.length === 0) {
    refs.bokeh.current = Array.from({ length: 40 }, () => ({
      x: Math.random() * safeWidth,
      y: Math.random() * safeHeight,
      size: Math.random() * 120 + 40,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      hue: themeHue + (Math.random() - 0.5) * 60,
      alpha: Math.random() * 0.12
    }));
  }

  // --- 1. CINEMATIC BACKGROUND & LIGHT LEAKS ---
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(1, 2, 5, ${0.18 + (1 - bass) * 0.05})`; 
  ctx.fillRect(0, 0, safeWidth, safeHeight);
  
  // Optimized grain (Subtle digital noise)
  if (Math.random() > 0.4) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.015 + twitch * 0.02})`;
    for (let i = 0; i < 150; i++) { 
      const gx = Math.random() * safeWidth;
      const gy = Math.random() * safeHeight;
      ctx.beginPath();
      ctx.arc(gx, gy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Volumetric Light Leaks (Static Gradient)
  if (optComp > 0.4) {
    ctx.globalCompositeOperation = "screen";
    const leakGrd = ctx.createLinearGradient(0, 0, safeWidth, safeHeight);
    leakGrd.addColorStop(0, `hsla(${themeHue}, 100%, 8%, ${0.04 * slowPulse * optComp})`);
    leakGrd.addColorStop(1, `hsla(${accentHue}, 100%, 8%, ${0.04 * breath * optComp})`);
    ctx.fillStyle = leakGrd;
    ctx.fillRect(0, 0, safeWidth, safeHeight);
  }
  ctx.restore();

  // --- 2. FLOATING BOKEH ---
  if (optComp > 0.1) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const bokehCount = Math.floor(refs.bokeh.current.length * optComp);
    refs.bokeh.current.slice(0, bokehCount).forEach(b => {
      const moveFactor = (1 + bass * 2) * (1 + twitch * 2);
      b.x += b.vx * moveFactor;
      b.y += b.vy * moveFactor;

      if (b.x < -200) b.x = safeWidth + 200;
      if (b.x > safeWidth + 200) b.x = -200;
      if (b.y < -200) b.y = safeHeight + 200;
      if (b.y > safeHeight + 200) b.y = -200;

      // Sanitize coordinates and size to prevent "non-finite" Canvas error
      const bx = isFinite(b.x) ? b.x : Math.random() * safeWidth;
      const by = isFinite(b.y) ? b.y : Math.random() * safeHeight;
      const bSize = Math.max(0.1, (b.size * (0.85 + (isFinite(bass) ? bass : 0) * 0.3)) * optComp);
      const bPulse = Math.max(0, Math.min(1, b.alpha * (0.5 + breath * 0.5) * (1 + (isFinite(mid) ? mid : 0) * 0.6) * optComp));
      const bHue = isFinite(b.hue) ? b.hue : themeHue;

      if (isFinite(bx) && isFinite(by) && isFinite(bSize) && bSize > 0) {
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, bSize);
        grad.addColorStop(0, `hsla(${bHue}, 80%, 70%, ${isFinite(bPulse) ? bPulse : 0})`);
        grad.addColorStop(1, "transparent");
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bx, by, bSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  // --- 3. THE SINGULARITY CAMERA & DISTORTION ---
  const fov = 1 + bass * 0.12 + slowPulse * 0.02; 
  const dx = Math.sin(t * 0.08) * 60, dy = Math.cos(t * 0.06) * 40;
  const tilt = Math.sin(t * 0.05) * 0.04; 
  const sx = (Math.sin(t * 60) * 2) * bass;
  const sy = (Math.cos(t * 55) * 2) * bass;

  ctx.save();
  ctx.translate(cx + dx + sx, cy + dy + sy);
  ctx.rotate(tilt);
  ctx.scale(fov, fov);
  ctx.translate(-cx, -cy);

  // --- 4. ANAMORPHIC FLARE ---
  const flareIntensity = (bass * 0.4 + treble * 0.4) * (effectParams.glowAmount || 1) * optComp;
  if (flareIntensity > 0.08) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const fGrd = ctx.createLinearGradient(0, cy, safeWidth, cy);
    fGrd.addColorStop(0.4, "transparent");
    fGrd.addColorStop(0.5, `hsla(${themeHue}, 100%, 85%, ${flareIntensity * 0.5})`);
    fGrd.addColorStop(0.6, "transparent");
    ctx.fillStyle = fGrd;
    ctx.fillRect(0, cy - 2, safeWidth, 4);
    ctx.restore();
  }

  // --- 5. ATMOSPHERE & SACRED GEOMETRY ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const atmosCount = isHighPerformance ? 3 : 2;
  for(let i=0; i<atmosCount; i++) {
    const d = i + 1;
    const nGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, safeWidth * (0.8 + i * 0.4));
    const h = (themeHue + i * 20) % 360;
    nGrd.addColorStop(0, `hsla(${h}, 90%, 20%, ${0.12 * (bass + breath * 0.2) / d})`);
    nGrd.addColorStop(1, "transparent");
    ctx.fillStyle = nGrd;
    ctx.fillRect(0, 0, safeWidth, safeHeight);
  }

  if (treble > 0.8 && optComp > 0.7) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.3);
    ctx.strokeStyle = `hsla(${accentHue}, 100%, 80%, ${treble * 0.15})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { // Reduced count
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.arc(0, 0, 150 * treble, 0, Math.PI / 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  // --- 5.5 QUANTUM STAR FIELD (Twinkling Glows & Glints) ---
  const starCount = Math.floor(300 * optComp);
  refs.particles.current.slice(0, starCount).forEach((p, i) => {
    p.z -= p.v * (1 + bass * 25);
    if (p.z < 1) { p.z = 2500; }
    const s = 1000 / p.z;
    const px = p.x * s + cx;
    const py = p.y * s + cy;
    
    if (px > 0 && px < safeWidth && py > 0 && py < safeHeight) {
      // Add a unique twinkle based on index and time
      const twinkle = Math.sin(t * 5 + i) * 0.3 + 0.7;
      const alpha = (1 - p.z / 2500) * (0.3 + treble * 0.6) * twinkle;
      const size = p.s * s * 0.9;
      
      // Star Body
      ctx.fillStyle = `hsla(${themeHue + p.z/50}, 100%, 98%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Star Glint (Dynamic Lens Flare)
      if (alpha > 0.6 && optComp > 0.6) {
        ctx.strokeStyle = `hsla(${themeHue}, 100%, 95%, ${alpha * 0.5})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        const gS = size * (4 + Math.sin(t * 10 + i) * 2);
        ctx.moveTo(px - gS, py); ctx.lineTo(px + gS, py);
        ctx.moveTo(px, py - gS); ctx.lineTo(px, py + gS);
        ctx.stroke();
      }

      // Soft Bloom
      if (alpha > 0.7 && optComp > 0.8) {
        const starGrad = ctx.createRadialGradient(px, py, 0, px, py, size * 5);
        starGrad.addColorStop(0, `hsla(${themeHue}, 100%, 80%, ${alpha * 0.25})`);
        starGrad.addColorStop(1, "transparent");
        ctx.fillStyle = starGrad;
        ctx.beginPath();
        ctx.arc(px, py, size * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });


  // --- 6. THE QUANTUM GRID ---
  const floorY = cy + 180;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const gridAlpha = 0.06 + bass * 0.15;
  
  const warp = (x: number, y: number) => {
    const distSq = (x - cx) ** 2 + (y - cy) ** 2;
    if (distSq > 1000000) return { wx: x, wy: y }; // Skip distant warp
    const force = Math.exp(-Math.sqrt(distSq) / 500) * bass * 120;
    const ang = Math.atan2(y - cy, x - cx);
    return { wx: x + Math.cos(ang) * force, wy: y + Math.sin(ang) * force };
  };

  ctx.lineWidth = 1;
  for (let i = -15; i <= 15; i += 2) { // Step 2 for performance
    const xBase = cx + i * 400;
    ctx.strokeStyle = `hsla(${themeHue}, 100%, 65%, ${gridAlpha * (1 - Math.abs(i)/15)})`;
    ctx.beginPath(); 
    for (let j = 0; j <= 6; j++) {
      const py = floorY - 100 + j * 250;
      const { wx, wy } = warp(xBase, py);
      if (j === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // --- 7. CORE SINGULARITY ---
  const drawQuantumCore = (x: number, y: number, w: number, h: number, rot: number, opacity: number, isCore = false) => {
    ctx.save();
    ctx.translate(x, y);
    if (isCore) ctx.translate(Math.sin(t * 18) * 8 * bass, Math.cos(t * 14) * 8 * bass);
    ctx.rotate(rot);
    
    const scale = isCore ? 1 + bass * 0.2 + breath * 0.05 : 1;
    const pW = w * scale, pH = h * scale;

    if (isCore && optComp > 0.5) {
      ctx.globalCompositeOperation = "screen";
      const shaftCount = 12; 
      for(let i=0; i<shaftCount; i++) {
        const a = (i / shaftCount) * Math.PI * 2 + t * 0.4;
        const baseLength = (600 + bass * 500) * optComp;
        const shaftLen = isFinite(baseLength) && baseLength > 0 ? baseLength : 100;
        
        // Use a wedge/cone shape for volumetric light instead of a simple line
        const spread = (0.1 + bass * 0.15);
        const x1 = Math.cos(a - spread) * shaftLen;
        const y1 = Math.sin(a - spread) * shaftLen;
        const x2 = Math.cos(a + spread) * shaftLen;
        const y2 = Math.sin(a + spread) * shaftLen;

        const vG = ctx.createRadialGradient(0, 0, 0, 0, 0, shaftLen);
        vG.addColorStop(0, `hsla(${accentHue}, 100%, 80%, ${0.3 * bass})`);
        vG.addColorStop(0.3, `hsla(${themeHue}, 100%, 50%, ${0.1 * bass})`);
        vG.addColorStop(1, "transparent");
        
        ctx.fillStyle = vG;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fill();
        
        // Occasional intense "Needle" light
        if (i % 3 === 0) {
          ctx.strokeStyle = `hsla(${themeHue}, 100%, 95%, ${0.2 * bass})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * shaftLen * 1.2, Math.sin(a) * shaftLen * 1.2);
          ctx.stroke();
        }
      }
    }

    const chCount = (isPeak && chromInt > 0.2) ? 3 : 1;
    for(let i=0; i<chCount; i++) {
      ctx.save();
      if (chCount > 1) ctx.translate((i - 1) * chromInt * bass * 10, 0);
      
      for (let side = 0; side < 4; side++) {
        const angle = (Math.PI / 2) * side;
        const z = Math.sin(angle) + Math.sin(angle + Math.PI/2);
        if (z > 0) {
          const x1 = Math.cos(angle) * (pW / 2), x2 = Math.cos(angle + Math.PI/2) * (pW / 2);
          const faceAlpha = opacity * (0.8 + (z/4) * 0.2);
          ctx.beginPath();
          ctx.moveTo(x1, -pH/2); ctx.lineTo(x2, -pH/2); ctx.lineTo(x2, pH/2); ctx.lineTo(x1, pH/2);
          ctx.closePath();
          
          if (isFinite(x1) && isFinite(x2) && isFinite(pH)) {
            const fG = ctx.createLinearGradient(x1, -pH/2, x2, pH/2);
            const h = (themeHue + (i * 120)) % 360;
            fG.addColorStop(0, `hsla(${h}, 100%, 20%, ${faceAlpha})`);
            fG.addColorStop(1, `hsla(${h}, 100%, 2%, ${faceAlpha})`);
            ctx.fillStyle = fG; ctx.fill();
            ctx.strokeStyle = `hsla(${themeHue}, 100%, 90%, ${faceAlpha * (0.5 + (isFinite(treble) ? treble : 0) * 0.5)})`;
            ctx.lineWidth = isCore ? 1.5 : 0.8; ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    ctx.restore();
  };

  const mw = 220 + bass * 150, mh = 550 + bass * 350;
  const fr = bass > 0.9 ? (bass - 0.9) * 10 : 0;
  ctx.globalCompositeOperation = "screen";
  if (fr > 0.1) {
    const smallCores = isHighPerformance ? 8 : 4;
    for (let i = 0; i < smallCores; i++) {
      const ang = t * 1.3 + (i / smallCores) * Math.PI * 2;
      const fx = cx + Math.cos(ang) * 400 * fr, fy = cy + Math.sin(ang) * 400 * fr;
      drawQuantumCore(fx, fy, mw * 0.15, mh * 0.15, t * 2 + i, 0.8, false);
    }
  }
  drawQuantumCore(cx, cy, mw, mh, t * 0.4, 1.0, true);

  // --- 8. HOLOGRAPHIC SCAN HUD (Ultra-Dense Interface) ---
  ctx.restore();
  ctx.save();
  const hudTwitch = (twitch > 0.97 ? Math.random() * 6 : 0);
  ctx.translate(dx * 0.1 + sx * 0.4 + hudTwitch, dy * 0.1 + sy * 0.4); 
  const hudAlpha = (0.4 + Math.sin(t * 10) * 0.15) * (0.7 + optComp * 0.3);
  const hudHue = themeHue;
  
  // 1. Center Reticle & Dynamic Labels
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.2);
  ctx.strokeStyle = `hsla(${hudHue}, 100%, 85%, ${hudAlpha * 0.4})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 180 + bass * 40, 0, Math.PI * 2);
  ctx.stroke();

  // Rotating Reticle Text
  ctx.font = '700 7px "JetBrains Mono"';
  ctx.fillStyle = `hsla(${hudHue}, 100%, 90%, ${hudAlpha * 0.6})`;
  for(let i=0; i<8; i++) {
    ctx.save();
    ctx.rotate(i * (Math.PI / 4));
    ctx.fillText(`FLUX_V:${(1200 + bass * 800).toFixed(0)}`, 190 + bass * 40, 0);
    ctx.fillText(`THETA:${(i * 45).toFixed(1)}°`, 190 + bass * 40, 10);
    ctx.restore();
  }
  ctx.restore();

  // 2. Vertical Sidebars (Hex Data Streams)
  const drawSidebar = (x: number, isRight = false) => {
    ctx.save();
    ctx.translate(x, safeHeight / 2);
    ctx.font = '500 7px "JetBrains Mono"';
    ctx.fillStyle = `hsla(${hudHue}, 80%, 70%, ${hudAlpha * 0.3})`;
    for(let i=-15; i<15; i++) {
      const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
      ctx.fillText(hex, isRight ? -40 : 10, i * 18 + Math.sin(t + i) * 10);
      if (i % 5 === 0) {
        ctx.fillStyle = `hsla(${accentHue}, 100%, 80%, ${hudAlpha})`;
        ctx.fillRect(isRight ? -5 : 0, i * 18 - 4, 5, 1);
        ctx.fillStyle = `hsla(${hudHue}, 80%, 70%, ${hudAlpha * 0.3})`;
      }
    }
    ctx.restore();
  };
  drawSidebar(40);
  drawSidebar(safeWidth - 40, true);

  // 3. Coordinate Background Grid Labels
  ctx.save();
  ctx.font = '400 6px "JetBrains Mono"';
  ctx.fillStyle = `hsla(${hudHue}, 100%, 95%, ${hudAlpha * 0.15})`;
  for(let x = 200; x < safeWidth; x += 300) {
    for(let y = 100; y < safeHeight; y += 200) {
      ctx.fillText(`POS[${x},${y}]`, x, y);
      ctx.fillText(`ID_0x${(x+y).toString(16)}`, x, y + 10);
    }
  }
  ctx.restore();

  // 4. Extended Corner Data Panels
  const pad = 70;
  ctx.fillStyle = `hsla(${hudHue}, 100%, 95%, ${hudAlpha})`;
  
  // Corner Brackets
  const bS = 25;
  const drawBracket = (x: number, y: number, xDir: number, yDir: number) => {
    ctx.strokeStyle = `hsla(${hudHue}, 100%, 85%, ${hudAlpha * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + bS * xDir, y); ctx.lineTo(x, y); ctx.lineTo(x, y + bS * yDir);
    ctx.stroke();
  };
  drawBracket(pad-15, pad-15, 1, 1); drawBracket(safeWidth-pad+15, pad-15, -1, 1);
  drawBracket(pad-15, safeHeight-pad+15, 1, -1); drawBracket(safeWidth-pad+15, safeHeight-pad+15, -1, -1);

  // Top Left Panel
  ctx.textAlign = "left";
  ctx.font = '900 13px "JetBrains Mono"';
  ctx.fillText("CORE_ENGINE_V4.0", pad, pad);
  ctx.font = '600 8px "JetBrains Mono"';
  const stats = [
    `SYS_LOAD: ${(bass * 88).toFixed(2)}%`,
    `NET_SYNC: ${(0.98 + mid * 0.02).toFixed(4)}`,
    `BUF_SIZE: 1024_QBITS`,
    `STASH_ST: ACTIVE`
  ];
  stats.forEach((s, i) => ctx.fillText(`> ${s}`, pad, pad + 18 + i * 12));
  
  // Top Right Panel
  ctx.textAlign = "right";
  ctx.font = '900 11px "JetBrains Mono"';
  ctx.fillText("NEURAL_SYNC_LINK", safeWidth - pad, pad);
  ctx.font = '600 7px "JetBrains Mono"';
  ctx.fillText(`FR_INDEX: ${(t * 60).toFixed(0)}`, safeWidth - pad, pad + 15);
  ctx.fillText(`BIT_RATE: 24.5GBPS`, safeWidth - pad, pad + 25);
  ctx.fillStyle = `hsla(${accentHue}, 100%, 80%, ${hudAlpha * 0.5})`;
  for(let i=0; i<10; i++) {
    const active = bass > (i/10);
    ctx.fillRect(safeWidth - pad - 120 + i * 12, pad + 35, 8, 3);
    if (active) {
      ctx.fillStyle = `hsla(${accentHue}, 100%, 80%, ${hudAlpha})`;
      ctx.fillRect(safeWidth - pad - 120 + i * 12, pad + 35, 8, 3);
      ctx.fillStyle = `hsla(${accentHue}, 100%, 80%, ${hudAlpha * 0.5})`;
    }
  }

  // Bottom Left Logs
  ctx.textAlign = "left";
  ctx.fillStyle = `hsla(${hudHue}, 100%, 95%, ${hudAlpha})`;
  const logLines = [
    `[INFO] Handshaking @ 0x${Math.floor(t*1000).toString(16)}`,
    `[DATA] Neural weight adjustment: ${(mid*0.5).toFixed(4)}`,
    `[DBUG] Flux field stability: ${bass > 0.8 ? 'LOW' : 'HIGH'}`,
    `[WARN] Latency detected in sector_0${Math.floor(t%9)}`,
    `[LOGS] System heartbeat OK - ${Date.now()}`
  ];
  ctx.font = '500 7px "JetBrains Mono"';
  logLines.forEach((line, i) => {
    ctx.fillStyle = `hsla(${hudHue}, 80%, 75%, ${hudAlpha * (0.2 + (i/5) * 0.6)})`;
    ctx.fillText(line, pad, safeHeight - pad - (5 - i) * 10);
  });

  // Bottom Right Branding
  ctx.textAlign = "right";
  ctx.fillStyle = `hsla(${hudHue}, 100%, 98%, ${hudAlpha})`;
  ctx.font = '900 15px "JetBrains Mono"';
  ctx.fillText("QUANTUM_OS_PREMIUM", safeWidth - pad, safeHeight - pad);
  ctx.font = '700 9px "JetBrains Mono"';
  ctx.fillText(`BUILD_REL_2026_04_29`, safeWidth - pad, safeHeight - pad + 15);

  // Scanline Overlay
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  const scanGrd = ctx.createLinearGradient(0, 0, 0, safeHeight);
  scanGrd.addColorStop(0, "rgba(0,0,0,0)");
  for(let i=0; i<1; i+=0.012) {
    scanGrd.addColorStop(i, "rgba(0,0,0,0.12)");
    scanGrd.addColorStop(i+0.003, "rgba(0,0,0,0)");
  }
  ctx.fillStyle = scanGrd;
  ctx.fillRect(0,0, safeWidth, safeHeight);
  ctx.restore();

  ctx.restore();

  // --- 9. FINAL POST-PROCESSING ---
  const vig = ctx.createRadialGradient(cx, cy, 0, cx, cy, safeWidth * 1.3);
  vig.addColorStop(0.6, "transparent");
  vig.addColorStop(1, "rgba(0, 0, 0, 0.95)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, safeWidth, safeHeight);
  
  ctx.restore();
};
