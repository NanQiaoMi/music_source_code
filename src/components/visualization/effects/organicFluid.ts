import { EffectContext } from "./types";

export const drawOrganicFluid = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  const effectParams = params || { speed: 1, complexity: 1, colorShift: 0.5 };
  const t = time * 0.001 * (effectParams.speed || 1);
  const cx = width / 2, cy = height / 2;
  
  // --- PRECISION ANALYTICS ---
  const rawBass = data && data[0] ? (data[0] + data[1] + data[2] + data[3]) / 4 / 255 : 0;
  const rawTreble = data && data[32] ? (data[32] + data[36] + data[40]) / 3 / 255 : 0;
  const rawMid = data && data[16] ? (data[16] + data[20] + data[24]) / 3 / 255 : 0;
  
  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.88 + rawBass * 0.12;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.9 + rawTreble * 0.1;
  const bass = refs.smoothBass.current;
  const treble = refs.smoothTreble.current;
  const energy = (bass + treble + rawMid) / 3;
  const isPeak = rawBass > 0.92;
  
  const breath = Math.sin(t * 0.4) * 0.5 + 0.5;

  // --- 1. DARK CINEMATIC VOID (Optimized) ---
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(0, 1, 4, ${0.2 + (1 - bass) * 0.08})`; 
  ctx.fillRect(0, 0, width, height);
  
  // Ambient Glow
  const pulseAlpha = bass * 0.05;
  const pulseGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.9);
  pulseGrd.addColorStop(0, `hsla(${theme.primary}, 100%, 25%, ${pulseAlpha})`);
  pulseGrd.addColorStop(1, "transparent");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = pulseGrd; ctx.fillRect(0, 0, width, height);
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

  const primaryHue = theme.primary;
  const accentHue = theme.accent;

  // --- 3. PARTICLES (Optimized: No Filter) ---
  if (!refs.particles.current || refs.particles.current.length < 30) {
    refs.particles.current = Array.from({ length: 35 }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      size: Math.random() * 2 + 1, sp: Math.random() * 0.15 + 0.05,
      rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 0.02,
      type: Math.random() > 0.5 ? 'tri' : 'rect',
      hue: primaryHue + (Math.random() - 0.5) * 20,
      depth: Math.random()
    }));
  }
  
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineWidth = 0.8;
  refs.particles.current.forEach((p: any) => {
    p.y -= p.sp * (1 + bass * 2);
    p.rot += p.vrot * (1 + energy);
    if (p.y < -50) p.y = height + 50;
    
    // Use Alpha instead of Blur filter for performance
    const pAlpha = (0.06 + treble * 0.2) * (1 - p.depth * 0.7);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.strokeStyle = `hsla(${p.hue}, 100%, 80%, ${pAlpha})`;
    ctx.beginPath();
    if (p.type === 'tri') {
      ctx.moveTo(0, -p.size); ctx.lineTo(p.size, p.size); ctx.lineTo(-p.size, p.size);
    } else {
      ctx.rect(-p.size/2, -p.size/2, p.size, p.size);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  });
  ctx.restore();

  // --- 5. PARALLAX NEBULA ---
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 2; i++) { // Reduced layers
    const layer = i + 1;
    const nx = cx - dx * 0.2 * layer, ny = cy - dy * 0.2 * layer;
    const nSize = width * (1.1 + i * 0.5) * fov;
    const nGrd = ctx.createRadialGradient(nx, ny, 0, nx, ny, nSize);
    nGrd.addColorStop(0, `hsla(${(primaryHue + i * 15) % 360}, 100%, 8%, ${0.08 + bass * 0.1})`);
    nGrd.addColorStop(1, "transparent");
    ctx.fillStyle = nGrd; ctx.fillRect(nx-nSize, ny-nSize, nSize*2, nSize*2);
  }

  // --- 6. QUANTUM RIBBONS (Optimized Segments) ---
  const ribbonCount = Math.floor(10 * (effectParams.complexity || 1));
  const bioNodes: {x: number, y: number, hue: number, val: number, alpha: number, id: number}[] = [];

  for (let i = 0; i < ribbonCount; i++) {
    const val = data ? (data[i * 4 % 128] || 0) / 255 : 0;
    const depth = (i / ribbonCount);
    const alpha = (0.2 + val * 0.7) * (1 - depth * 0.6) * (0.9 + breath * 0.1);
    const bHue = (primaryHue - 35 + i * 12 + Math.sin(t * 0.2) * 35 + 360) % 360;
    
    // Simpler Chromatic Ab (Only during peak and one pass)
    const chromAb = isPeak ? 12 * bass : 0;

    [0, 1].forEach((pass) => {
      const isSpecular = pass === 1;
      if (isSpecular && val < 0.3) return;
      const pAlpha = isSpecular ? alpha * 1.4 : alpha;
      const pWidth = isSpecular ? (0.6 + val * 3) : (1.2 + val * 28) * (1 - depth * 0.5);
      
      ctx.globalCompositeOperation = isSpecular ? "lighter" : "screen";
      if (chromAb > 0 && !isSpecular) {
        drawRibbon(ctx, -chromAb, pAlpha * 0.6, 0, pWidth, i);
        drawRibbon(ctx, chromAb, pAlpha * 0.6, 210, pWidth, i);
      } else {
        drawRibbon(ctx, 0, pAlpha, bHue + (isSpecular ? 30 : 0), pWidth, i, isSpecular);
      }
    });

    if (val > 0.72 && bioNodes.length < 3 && i % 4 === 0) {
      const nx = 0.5;
      const ry = height * 0.5 + Math.sin(nx * 1.6 + t * 0.3 + i * 0.4) * (height * 0.24);
      bioNodes.push({x: width * 0.5 + Math.sin(t + i) * width * 0.2, y: ry, hue: bHue, val, alpha, id: i});
    }
  }

  function drawRibbon(c: CanvasRenderingContext2D, off: number, a: number, h: number, lw: number, idx: number, spec = false) {
    c.beginPath();
    const segs = 18; // Reduced segments
    const xStep = (width + 600) / segs;
    for (let x = -300; x <= width + 300; x += xStep) {
      const nx = (x + 300) / (width + 600);
      const main = Math.sin(nx * 2 + t * 0.4 + idx * 0.3) * (height * 0.22);
      const turb = Math.sin(nx * 10 + t * 3.5) * (height * 0.02 * bass);
      const y = height * 0.5 + main + turb + off;
      if (x === -300) c.moveTo(x, y);
      else c.lineTo(x, y); // Simpler lineTo instead of bezierCurveTo for performance
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

  // --- 8. PRECISION NEURO-HUD ---
  ctx.globalCompositeOperation = "source-over";
  bioNodes.forEach((node, i) => {
    const hA = Math.min(1.0, node.alpha * 1.5);
    const hue = node.hue;
    ctx.save();
    
    const s = 45 + node.val * 35;
    ctx.translate(node.x, node.y);
    
    ctx.strokeStyle = `hsla(${hue}, 100%, 90%, ${hA})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, s/2 + 8, -Math.PI/2, -Math.PI/2 + (Math.PI*2*node.val)); ctx.stroke();
    
    ctx.rotate(t * (i % 2 === 0 ? 0.5 : -0.5));
    ctx.strokeRect(-s/2, -s/2, s, s);
    
    ctx.lineWidth = 2;
    [[-1,-1], [1,-1], [1,1], [-1,1]].forEach(([mx, my]) => {
      ctx.beginPath(); ctx.moveTo(mx * s/2, my * (s/2 - 8)); ctx.lineTo(mx * s/2, my * s/2); ctx.lineTo(mx * (s/2 - 8), my * s/2);
      ctx.stroke();
    });
    ctx.restore();

    // Panel (Simplified)
    const tx = node.x + s/2 + 25, ty = node.y - s/2;
    ctx.fillStyle = `rgba(0, 1, 8, ${hA * 0.7})`;
    ctx.fillRect(tx - 5, ty - 10, 115, 52);
    
    ctx.fillStyle = `hsla(${hue}, 100%, 98%, ${hA})`;
    ctx.font = 'bold 11px "JetBrains Mono"';
    ctx.fillText(`SYNC_${node.id}`, tx + 5, ty + 12);
    ctx.font = '600 8px "JetBrains Mono"';
    ctx.fillText(`FLX: ${(node.val * 99).toFixed(0)}`, tx + 5, ty + 25);
    ctx.fillText(`STA: ${isPeak ? "WARN" : "NOM"}`, tx + 5, ty + 38);
    
    ctx.restore();
  });

  // --- 9. GLOBAL STATUS HUD ---
  ctx.restore();
  ctx.save();
  ctx.translate(dx * 0.04, dy * 0.04);
  const scanA = 0.2 + Math.sin(t * 8) * 0.05;
  ctx.strokeStyle = `hsla(${primaryHue}, 100%, 85%, ${scanA})`;
  
  const sY = height - 130;
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
  const masterVig = ctx.createRadialGradient(cx, cy, width * 0.2, cx, cy, width * 1.5);
  masterVig.addColorStop(0, "transparent");
  masterVig.addColorStop(1, "rgba(0, 0, 0, 0.95)");
  ctx.fillStyle = masterVig; ctx.fillRect(0, 0, width, height);
  ctx.restore();
};
