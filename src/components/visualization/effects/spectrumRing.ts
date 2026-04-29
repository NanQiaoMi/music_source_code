import { EffectContext } from "./types";

/**
 * SPECTRUM SINGULARITY (V50 - CINEMATIC MASTERPIECE)
 * The definitive reconstruction. Focus: Breathing, Optical Bloom, Technical Layers.
 */
export const drawSpectrumRing = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  const effectParams = params || { rotationSpeed: 0.35, hudDetail: 1.0 };

  // --- 0. DIMENSIONS & INITIALIZATION ---
  const safeWidth = (typeof width === 'number' && isFinite(width) && width > 0) ? width : 1920;
  const safeHeight = (typeof height === 'number' && isFinite(height) && height > 0) ? height : 1080;
  const cx = safeWidth / 2;
  const cy = safeHeight / 2;
  const t = (typeof time === 'number' && isFinite(time) ? time : 0) * 0.001 * (effectParams.rotationSpeed || 1);

  // --- 1. SIGNAL ANALYTICS ---
  const getVal = (i: number) => (data && data[i] !== undefined) ? data[i] / 255 : 0;
  
  // Organic smoothing (Breathing)
  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.85 + (getVal(0) + getVal(2)) / 2 * 0.15;
  refs.smoothMid.current = (refs.smoothMid.current || 0) * 0.88 + (getVal(10) + getVal(15)) / 2 * 0.12;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.9 + (getVal(30) + getVal(40)) / 2 * 0.1;

  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;
  const energy = (bass + mid + treble) / 3;

  const ringHue = (typeof theme?.primary === 'number' && isFinite(theme.primary)) ? theme.primary : 194;
  const atmosHue = 275; 

  // --- 2. THE VOID (BACKGROUND) ---
  ctx.save();
  ctx.fillStyle = "#010007"; 
  ctx.fillRect(0, 0, safeWidth, safeHeight);

  // Volumetric Fog Pulse
  ctx.globalCompositeOperation = "screen";
  for(let i=0; i<2; i++) {
    const r = safeWidth * (0.6 + i * 0.2);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `hsla(${atmosHue}, 100%, 5%, ${0.2 * (0.5 + bass * 0.5)})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // --- 3. 3D PULSING GRID ---
  const drawPulsingGrid = () => {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const hY = cy + 180;
    const gridAlpha = 0.01 + bass * 0.08;
    ctx.strokeStyle = `hsla(${ringHue}, 100%, 60%, ${gridAlpha})`;
    ctx.lineWidth = 0.5;

    // Pulse wave traveling down the grid
    const pulseOffset = (t * 2) % 1;
    
    for (let i = 0; i <= 15; i++) {
      const prog = i / 15;
      const y = hY + Math.pow(prog, 3.5) * (safeHeight - hY);
      const rowAlpha = gridAlpha * (1 - prog); // Horizon fade
      ctx.strokeStyle = `hsla(${ringHue}, 100%, 60%, ${rowAlpha})`;
      if (isFinite(y)) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(safeWidth, y); ctx.stroke(); }
    }
    
    const vCount = 12;
    for (let i = -vCount; i <= vCount; i++) {
      const xB = cx + i * 700;
      if (isFinite(xB)) { ctx.beginPath(); ctx.moveTo(cx + i * 20, hY); ctx.lineTo(xB, safeHeight); ctx.stroke(); }
    }
    ctx.restore();
  };
  drawPulsingGrid();

  // --- 4. ORGANIC BREATHING CORE ---
  // The core radius now "breathes" with bass
  const baseR = (safeHeight * 0.13) * (1 + bass * 0.06); 
  
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.1); 

  // Secondary Technical Rings (Refractive)
  const drawTechRing = (r: number, speed: number, dash: number[]) => {
    ctx.save();
    ctx.rotate(t * speed);
    ctx.setLineDash(dash);
    ctx.strokeStyle = `hsla(${ringHue}, 100%, 75%, 0.15)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };
  drawTechRing(baseR + 20, 0.5, [10, 20]);
  drawTechRing(baseR + 40, -0.3, [2, 5]);

  // --- 5. SOFT-BLOOM NEEDLE SPECTRUM ---
  const bars = 512;
  const step = (Math.PI * 2) / bars;
  
  for (let i = 0; i < bars; i++) {
    const val = getVal(i % 128);
    const h = 2 + val * 400 * (0.7 + treble * 0.5);
    if (h < 2) continue;
    
    const angle = i * step;
    const x1 = Math.cos(angle) * baseR;
    const y1 = Math.sin(angle) * baseR;
    const x2 = Math.cos(angle) * (baseR + h);
    const y2 = Math.sin(angle) * (baseR + h);

    if (isFinite(x1) && isFinite(x2)) {
      // Glow Pass
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = `hsla(${ringHue}, 100%, 60%, 0.1)`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      
      // Sharp Pass
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, `hsla(${ringHue}, 100%, 90%, 0.9)`);
      g.addColorStop(0.2, "white");
      g.addColorStop(1, "transparent");
      ctx.strokeStyle = g;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }

  // --- 6. FLOATING BITS (DEBRIS) ---
  if (!refs.particles.current || refs.particles.current.length < 40) {
    refs.particles.current = Array.from({ length: 40 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: baseR + Math.random() * 200,
      s: 1 + Math.random() * 3,
      v: 0.002 + Math.random() * 0.01
    }));
  }
  refs.particles.current.forEach(p => {
    p.a += p.v * (1 + energy * 2);
    const x = Math.cos(p.a) * p.r;
    const y = Math.sin(p.a) * p.r;
    ctx.fillStyle = `hsla(${ringHue}, 100%, 80%, ${0.1 + energy * 0.4})`;
    ctx.fillRect(x, y, p.s, p.s);
  });
  ctx.restore();

  // --- 7. ANAMORPHIC CROSS FLARE ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = "screen";
  const flareIntensity = 0.1 + bass * 0.2;
  const flareW = safeWidth * 0.7;
  const flareH = safeHeight * 0.4;
  
  const gH = ctx.createLinearGradient(-flareW/2, 0, flareW/2, 0);
  gH.addColorStop(0, "transparent"); gH.addColorStop(0.5, `hsla(${ringHue}, 100%, 80%, ${flareIntensity})`); gH.addColorStop(1, "transparent");
  ctx.fillStyle = gH; ctx.fillRect(-flareW/2, -1, flareW, 2);

  const gV = ctx.createLinearGradient(0, -flareH/2, 0, flareH/2);
  gV.addColorStop(0, "transparent"); gV.addColorStop(0.5, `hsla(${ringHue}, 100%, 80%, ${flareIntensity * 0.5})`); gV.addColorStop(1, "transparent");
  ctx.fillStyle = gV; ctx.fillRect(-0.5, -flareH/2, 1, flareH);
  ctx.restore();

  // --- 8. TECHNICAL HUD INTEGRATION ---
  const hA = 0.6 + Math.sin(t * 8) * 0.1;
  ctx.fillStyle = `hsla(${ringHue}, 100%, 95%, ${hA})`;
  ctx.font = '900 16px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.fillText("QUANTUM_SINGULARITY_V5.0", cx, cy - baseR - 110);

  // Stats Cluster
  ctx.font = '700 8px "JetBrains Mono", monospace';
  const ty = cy + baseR + 120;
  ctx.fillText(`SYSTEM_STATUS: [NOMINAL] // SINGULARITY_STABILITY: 99.982%`, cx, ty);
  ctx.fillText(`>> ENERGY_OUTPUT: ${(energy * 1.5).toFixed(4)} Pj // SYNC_LOCK: ${((0.8+bass*0.2)*100).toFixed(1)}%`, cx, ty + 12);
  
  // Orbiting HUD Marker
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.2);
  ctx.textAlign = "left";
  ctx.fillText("● LINK_STABLE", baseR + 100, 0);
  ctx.restore();

  // --- 9. CINEMATIC POST-PROCESSING ---
  // Vignette + Noise texture
  const vg = ctx.createRadialGradient(cx, cy, baseR * 1.5, cx, cy, safeWidth * 1.1);
  vg.addColorStop(0, "transparent");
  vg.addColorStop(1, "rgba(0, 0, 4, 0.98)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, safeWidth, safeHeight);

  ctx.globalCompositeOperation = "overlay";
  for (let i = 0; i < safeHeight; i += 4) {
    const n = Math.random() * 0.04;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.03 + n})`;
    ctx.fillRect(0, i, safeWidth, 2);
  }
};
