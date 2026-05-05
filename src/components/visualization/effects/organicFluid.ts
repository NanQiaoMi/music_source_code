import { EffectContext } from "./types";

export const drawOrganicFluid = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  const effectParams = params || { speed: 1, complexity: 1, colorShift: 0.5 };
  const t = time * 0.001 * (effectParams.speed || 1);
  const cx = width / 2, cy = height / 2;
  
  // --- SANITIZATION & PRECISION ANALYTICS ---
  const safeWidth = isFinite(width) && width > 0 ? width : 1920;
  const safeHeight = isFinite(height) && height > 0 ? height : 1080;
  
  const rawBass = data && data[0] ? (data[0] + data[1] + data[2] + data[3]) / 4 / 255 : 0;
  const rawTreble = data && data[32] ? (data[32] + data[36] + data[40]) / 3 / 255 : 0;
  const rawMid = data && data[16] ? (data[16] + data[20] + data[24]) / 3 / 255 : 0;
  
  const safeRawBass = isFinite(rawBass) ? rawBass : 0;
  const safeRawTreble = isFinite(rawTreble) ? rawTreble : 0;
  const safeRawMid = isFinite(rawMid) ? rawMid : 0;

  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.88 + safeRawBass * 0.12;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.9 + safeRawTreble * 0.1;
  
  const bass = isFinite(refs.smoothBass.current) ? refs.smoothBass.current : 0;
  const treble = isFinite(refs.smoothTreble.current) ? refs.smoothTreble.current : 0;
  const energy = (bass + treble + safeRawMid) / 3;
  const isPeak = safeRawBass > 0.92;
  
  const breath = Math.sin(t * 0.4) * 0.5 + 0.5;

  // --- 1. DARK CINEMATIC VOID (Textured) ---
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(1, 2, 6, ${0.22 + (1 - bass) * 0.1})`; 
  ctx.fillRect(0, 0, width, height);
  
  // High-Frequency Digital Grain (Texture)
  if (Math.random() > 0.3) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.015 + (Math.random() * 0.01)})`;
    for (let i = 0; i < 150; i++) {
      ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
    }
  }

  // Ambient Flow Glow
  const pulseAlpha = isFinite(0.04 + bass * 0.08) ? 0.04 + bass * 0.08 : 0.04;
  const glowRadius = Math.max(0.1, safeWidth * 1.2);
  if (isFinite(cx) && isFinite(cy) && isFinite(glowRadius)) {
    const pulseGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    const pHue = isFinite(theme.primary) ? theme.primary : 200;
    const aHue = isFinite(theme.accent) ? theme.accent : 280;
    pulseGrd.addColorStop(0, `hsla(${pHue}, 100%, 15%, ${pulseAlpha})`);
    pulseGrd.addColorStop(0.5, `hsla(${aHue}, 100%, 10%, ${pulseAlpha * 0.5})`);
    pulseGrd.addColorStop(1, "transparent");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = pulseGrd; ctx.fillRect(0, 0, safeWidth, safeHeight);
  }
  ctx.restore();

  // --- 2. STABILIZED CAMERA ---
  const fov = 1.0 + bass * 0.06; 
  const dx = Math.sin(t * 0.06) * 70, dy = Math.cos(t * 0.05) * 50;
  const tilt = Math.sin(t * 0.04) * 0.03; 
  const sx = (Math.sin(t * 35) * 1.5) * bass;
  const sy = (Math.cos(t * 32) * 1.5) * bass;

  ctx.save();
  ctx.translate(cx + dx + sx, cy + dy + sy);
  ctx.rotate(tilt);
  ctx.scale(fov, fov);
  ctx.translate(-cx, -cy);

  const primaryHue = isFinite(theme.primary) ? theme.primary : 200;
  const accentHue = isFinite(theme.accent) ? theme.accent : 280;

  // --- 3. ORGANIC CELLS (Replaced Vector Shapes) ---
  if (!refs.particles.current || refs.particles.current.length < 40) {
    refs.particles.current = Array.from({ length: 45 }, () => ({
      x: Math.random() * safeWidth, y: Math.random() * safeHeight,
      size: Math.random() * 4 + 2, sp: Math.random() * 0.12 + 0.04,
      rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 0.015,
      type: 'cell',
      hue: primaryHue + (Math.random() - 0.5) * 40,
      depth: Math.random(),
      pulseOffset: Math.random() * Math.PI * 2
    }));
  }
  
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  refs.particles.current.forEach((p: any) => {
    p.y -= p.sp * (1 + bass * 3);
    p.rot += p.vrot * (1 + energy);
    if (p.y < -50) p.y = height + 50;
    
    const pAlpha = (0.08 + treble * 0.25) * (1 - p.depth * 0.8);
    const pPulse = Math.sin(t * 2 + p.pulseOffset) * 0.3 + 0.7;
    const currentSize = p.size * (1 + bass * 0.5) * pPulse;
    const safeSize = isFinite(currentSize) && currentSize > 0 ? currentSize : 0.1;

    ctx.save();
    ctx.translate(p.x, p.y);
    
    // Cell Glow
    const cGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, safeSize * 2);
    const safeHue = isFinite(p.hue) ? p.hue : primaryHue;
    cGrd.addColorStop(0, `hsla(${safeHue}, 100%, 85%, ${isFinite(pAlpha) ? pAlpha : 0})`);
    cGrd.addColorStop(0.4, `hsla(${safeHue}, 80%, 40%, ${isFinite(pAlpha) ? pAlpha * 0.3 : 0})`);
    cGrd.addColorStop(1, "transparent");
    
    ctx.fillStyle = cGrd;
    ctx.beginPath();
    ctx.arc(0, 0, safeSize * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Cell Core (Nucleus)
    ctx.fillStyle = `hsla(${safeHue}, 100%, 95%, ${isFinite(pAlpha) ? pAlpha * 1.5 : 0})`;
    ctx.beginPath();
    ctx.arc(0, 0, safeSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  });
  ctx.restore();

  // --- 5. PARALLAX NEBULA ---
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 2; i++) { 
    const layer = i + 1;
    const nx = cx - dx * 0.2 * layer, ny = cy - dy * 0.2 * layer;
    const nSize = Math.max(0.1, safeWidth * (1.1 + i * 0.5) * fov);
    if (isFinite(nx) && isFinite(ny) && isFinite(nSize)) {
      const nGrd = ctx.createRadialGradient(nx, ny, 0, nx, ny, nSize);
      nGrd.addColorStop(0, `hsla(${(primaryHue + i * 15) % 360}, 100%, 8%, ${0.08 + bass * 0.1})`);
      nGrd.addColorStop(1, "transparent");
      ctx.fillStyle = nGrd; ctx.fillRect(nx-nSize, ny-nSize, nSize*2, nSize*2);
    }
  }

  // --- 6. BIOLOGICAL FLOWS (Refined Ribbons) ---
  const ribbonCount = Math.floor(12 * (effectParams.complexity || 1));
  const bioNodes: {x: number, y: number, hue: number, val: number, alpha: number, id: number}[] = [];

  for (let i = 0; i < ribbonCount; i++) {
    const val = data ? (data[i * 4 % 128] || 0) / 255 : 0;
    const depth = (i / ribbonCount);
    const alpha = (0.15 + val * 0.75) * (1 - depth * 0.6) * (0.9 + breath * 0.1);
    const cShift = (effectParams.colorShift || 0.5) * 360;
    const bHue = (primaryHue - 40 + i * 15 + Math.sin(t * 0.15) * 40 + cShift + 360) % 360;
    
    const isSpecial = val > 0.85;
    const chromAb = (0.2 + bass * 0.8) * 10;

    [0, 1].forEach((pass) => {
      const isSpecular = pass === 1;
      if (isSpecular && val < 0.4) return;
      const pAlpha = isSpecular ? alpha * 1.5 : alpha;
      const pWidth = isSpecular ? (0.8 + val * 4) : (1.5 + val * 32) * (1 - depth * 0.5);
      
      ctx.globalCompositeOperation = isSpecular ? "lighter" : "screen";
      
      // Chromatic Refraction pass
      if (!isSpecular && isPeak) {
        drawRibbon(ctx, -chromAb, pAlpha * 0.4, (bHue - 20 + 360) % 360, pWidth, i);
        drawRibbon(ctx, chromAb, pAlpha * 0.4, (bHue + 20) % 360, pWidth, i);
      }
      
      drawRibbon(ctx, 0, pAlpha, bHue + (isSpecular ? 40 : 0), pWidth, i, isSpecular);
    });

    if (val > 0.7 && bioNodes.length < 4 && i % 3 === 0) {
      const nx = 0.5;
      const ry = safeHeight * 0.5 + Math.sin(nx * 1.8 + t * 0.25 + i * 0.5) * (safeHeight * 0.26);
      bioNodes.push({x: safeWidth * 0.5 + Math.sin(t * 0.8 + i) * safeWidth * 0.25, y: ry, hue: bHue, val, alpha, id: i});
    }
  }

  function drawRibbon(c: CanvasRenderingContext2D, off: number, a: number, h: number, lw: number, idx: number, spec = false) {
    c.beginPath();
    const segs = 45; // Increased segments for smoothness
    const xStep = (safeWidth + 800) / segs;
    for (let x = -400; x <= safeWidth + 400; x += xStep) {
      const nx = (x + 400) / (safeWidth + 800);
      const main = Math.sin(nx * 1.8 + t * 0.35 + idx * 0.25) * (safeHeight * 0.25);
      const turb = Math.sin(nx * 8 + t * 3.0) * (safeHeight * 0.03 * bass);
      const noise = Math.sin(nx * 25 + t * 5.0) * (safeHeight * 0.005); // Micro-turbulence
      const y = safeHeight * 0.5 + main + turb + noise + off;
      if (x === -400) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.strokeStyle = spec ? `hsla(${h}, 60%, 100%, ${a})` : `hsla(${h}, 100%, 75%, ${a})`;
    c.lineWidth = lw; c.stroke();
  }

  // --- 7. NEURAL LINKS (Simplified) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineWidth = 0.5;
  bioNodes.forEach((node) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(node.x, node.y);
    ctx.strokeStyle = `hsla(${node.hue}, 100%, 80%, ${node.alpha * 0.1})`;
    ctx.stroke();
  });
  ctx.restore();

  // --- 8. PRECISION NEURO-HUD (Glassmorphic) ---
  ctx.globalCompositeOperation = "source-over";
  bioNodes.forEach((node, i) => {
    const hA = Math.min(1.0, node.alpha * 1.6);
    const hue = node.hue;
    ctx.save();
    
    const s = 48 + node.val * 38;
    ctx.translate(node.x, node.y);
    
    // Neural Connection Line
    ctx.strokeStyle = `hsla(${hue}, 100%, 90%, ${hA * 0.3})`;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cx - node.x, cy - node.y); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = `hsla(${hue}, 100%, 90%, ${hA})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, s/2 + 10, -Math.PI/2, -Math.PI/2 + (Math.PI*2*node.val)); ctx.stroke();
    
    ctx.rotate(t * (i % 2 === 0 ? 0.4 : -0.4));
    ctx.strokeRect(-s/2, -s/2, s, s);
    
    ctx.lineWidth = 2;
    [[-1,-1], [1,-1], [1,1], [-1,1]].forEach(([mx, my]) => {
      ctx.beginPath(); ctx.moveTo(mx * s/2, my * (s/2 - 10)); ctx.lineTo(mx * s/2, my * s/2); ctx.lineTo(mx * (s/2 - 10), my * s/2);
      ctx.stroke();
    });
    ctx.restore();

    // Glass Panel
    const tx = node.x + s/2 + 28, ty = node.y - s/2;
    ctx.fillStyle = `rgba(1, 3, 12, ${hA * 0.8})`;
    ctx.shadowBlur = 15;
    ctx.shadowColor = `hsla(${hue}, 100%, 50%, ${hA * 0.3})`;
    ctx.fillRect(tx - 6, ty - 12, 125, 56);
    ctx.shadowBlur = 0;
    
    // Accent Border
    ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${hA * 0.5})`;
    ctx.strokeRect(tx - 6, ty - 12, 125, 56);
    
    ctx.fillStyle = `hsla(${hue}, 100%, 98%, ${hA})`;
    ctx.font = 'bold 12px "JetBrains Mono"';
    ctx.fillText(`NEURAL_NODE_${node.id}`, tx + 6, ty + 14);
    ctx.font = '600 9px "JetBrains Mono"';
    ctx.fillText(`POTENTIAL: ${(node.val * 100).toFixed(1)}%`, tx + 6, ty + 28);
    ctx.fillText(`STATUS: ${isPeak ? "ACTIVE_BURST" : "SYNAPTIC_OK"}`, tx + 6, ty + 42);
    
    ctx.restore();
  });

  // --- 9. GLOBAL STATUS HUD ---
  ctx.restore();
  ctx.save();
  ctx.translate(dx * 0.04, dy * 0.04);
  const scanA = 0.2 + Math.sin(t * 8) * 0.05;
  ctx.strokeStyle = `hsla(${primaryHue}, 100%, 85%, ${scanA})`;
  
  const sY = safeHeight - 130;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 250, sY); ctx.lineTo(cx + 250, sY); ctx.stroke();
  
  ctx.fillStyle = `hsla(${primaryHue}, 100%, 98%, ${scanA * 2})`;
  ctx.font = 'bold 12px "JetBrains Mono"';
  ctx.fillText(`NEURAL_OS_V10 // ${isPeak ? "[EMERGENCY]" : "[STABLE]"}`, cx - 245, sY + 25);
  
  ctx.lineWidth = 2;
  for (let j = 0; j < 30; j++) {
    const h = (data[j * 4] / 255) * 45 * bass;
    ctx.fillRect(cx - 245 + j * 8, sY + 40, 4, -h);
  }
  ctx.restore();

  // --- 10. FINAL VIGNETTE ---
  ctx.save();
  const vigInner = Math.max(0, safeWidth * 0.2);
  const vigOuter = Math.max(0.1, safeWidth * 1.5);
  if (isFinite(vigInner) && isFinite(vigOuter)) {
    const masterVig = ctx.createRadialGradient(cx, cy, vigInner, cx, cy, vigOuter);
    masterVig.addColorStop(0, "transparent");
    masterVig.addColorStop(1, "rgba(0, 0, 0, 0.95)");
    ctx.fillStyle = masterVig; ctx.fillRect(0, 0, safeWidth, safeHeight);
  }
  ctx.restore();
};
