import { EffectContext } from "./types";

/**
 * SPECTRUM SINGULARITY (V210 - THE RED BASTION)
 * Aesthetics: Soviet Brutalism, Ghost of the Revolution, Crystal Tech.
 * Tone: Divine Oppression, Ideological, Cinematic, Masterpiece.
 */
export const drawSpectrumRing = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  // --- 0. DIMENSIONS ---
  const sw = width || 1920;
  const sh = height || 1080;
  const cx = sw / 2;
  const cy = sh / 2;
  const t = (time || 0) * 0.00018; 

  // --- 1. SIGNAL PROCESSING ---
  const getVal = (i: number) => (data && data[i] !== undefined) ? data[i] / 255 : 0;
  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.85 + (getVal(0) + getVal(2)) / 2 * 0.15;
  const bass = refs.smoothBass.current;
  const energy = bass * 0.8 + getVal(20) * 0.2;

  // --- 2. GLOBAL BREATHING & LENS SWEEP ---
  ctx.save();
  const bScale = 1 + bass * 0.06;
  ctx.translate(cx, cy);
  ctx.scale(bScale, bScale);
  ctx.translate(-cx, -cy);

  // --- 3. DYNAMIC BACKGROUND: RED SHIFT & GHOST TOTEM ---
  ctx.save();
  // Background shifts from Black to Deep Charred Red
  const bgRed = bass * 0.2;
  ctx.fillStyle = `oklch(${10 + bgRed * 10}% ${bgRed * 0.15} 25)`; 
  ctx.fillRect(0, 0, sw, sh);

  // The Ghost Hammer & Sickle (Ideological Totem)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = 0.02 + bass * 0.08;
  ctx.fillStyle = `oklch(55% 0.3 25)`;
  ctx.rotate(-t * 0.1);
  // Hammer Abstraction
  ctx.fillRect(-200, -50, 400, 100);
  ctx.fillRect(-50, -200, 100, 400);
  // Sickle Abstraction (Arc)
  ctx.beginPath();
  ctx.arc(0, 0, 300, 0, Math.PI, true);
  ctx.lineWidth = 60;
  ctx.strokeStyle = `oklch(55% 0.3 25)`;
  ctx.stroke();
  ctx.restore();

  // --- 4. BASTION AURORA (SCATTERED VOLUMETRIC RAYS) ---
  ctx.globalCompositeOperation = "screen";
  const rayCount = 16;
  for (let i = 0; i < rayCount; i++) {
    const rAng = t * 2.5 + i * (Math.PI * 2 / rayCount) + Math.cos(t + i) * 0.3;
    const length = sw * 0.9;
    const rWidth = 60 + bass * 180;
    
    const grd = ctx.createLinearGradient(cx, cy, cx + Math.cos(rAng) * length, cy + Math.sin(rAng) * length);
    grd.addColorStop(0, `oklch(55% 0.35 25 / ${0.1 + bass * 0.3})`); 
    grd.addColorStop(0.6, `oklch(75% 0.15 80 / ${0.05 + bass * 0.15})`); 
    grd.addColorStop(1, "transparent");
    
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(rAng - 0.06 - bass * 0.1) * length, cy + Math.sin(rAng - 0.06 - bass * 0.1) * length);
    ctx.lineTo(cx + Math.cos(rAng + 0.06 + bass * 0.1) * length, cy + Math.sin(rAng + 0.06 + bass * 0.1) * length);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // --- 5. THE CRYSTAL TURBINE (CENTRAL SCULPTURE) ---
  const bladeCount = 56;
  const baseR = sh * 0.16;
  
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.35);

  // Inner Rotating Gear Ring (Complexity Layer)
  ctx.save();
  ctx.rotate(-t * 1.2);
  ctx.strokeStyle = `oklch(30% 0.02 20 / 0.5)`;
  ctx.lineWidth = 15;
  ctx.setLineDash([10, 20]);
  ctx.beginPath(); ctx.arc(0, 0, baseR - 20, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  for (let i = 0; i < bladeCount; i++) {
    const val = getVal(i * 1.5 % 128);
    const ang = (i / bladeCount) * Math.PI * 2;
    
    ctx.save();
    ctx.rotate(ang);
    
    // Diamond-Cut Lens Blade Geometry
    const bW = 3 + val * 8;
    const bH = 20 + val * 130 * (0.8 + bass * 0.6);
    
    // Core Material Gradient
    ctx.globalCompositeOperation = "screen";
    const g = ctx.createLinearGradient(baseR, 0, baseR + bH, 0);
    g.addColorStop(0, `oklch(75% 0.15 80)`); // Imperial Gold Core
    g.addColorStop(1, `oklch(60% 0.35 25)`); // Revolutionary Red Crystal
    
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(baseR, -bW);
    ctx.lineTo(baseR + bH, -bW * 0.2);
    ctx.lineTo(baseR + bH, bW * 0.2);
    ctx.lineTo(baseR, bW);
    ctx.fill();

    // High-Contrast Edge Highlight
    ctx.strokeStyle = `rgba(255, 255, 255, ${val * 0.6})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(baseR + 2, -bW); ctx.lineTo(baseR + bH, -bW * 0.2); ctx.stroke();
    
    ctx.restore();
  }
  ctx.restore();

  // --- 6. RED STAR REACTOR HEART ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-t * 0.7);
  
  // Core Glow Depth
  const cG = ctx.createRadialGradient(0, 0, 0, 0, 0, baseR * 0.8);
  cG.addColorStop(0, `oklch(60% 0.35 25 / ${0.5 + bass * 0.5})`);
  cG.addColorStop(1, "transparent");
  ctx.fillStyle = cG;
  ctx.beginPath(); ctx.arc(0, 0, baseR, 0, Math.PI * 2); ctx.fill();

  // Sharp Geometric Soviet Star (Core)
  ctx.strokeStyle = `oklch(90% 0.1 80)`; // Gold Highlight Star
  ctx.lineWidth = 4;
  ctx.globalCompositeOperation = "screen";
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const rO = baseR * 0.38 * (1 + bass * 0.2);
    const rI = baseR * 0.14;
    const a1 = (i * Math.PI * 2 / 5) - Math.PI / 2;
    const a2 = a1 + (Math.PI / 5);
    ctx.lineTo(Math.cos(a1) * rO, Math.sin(a1) * rO);
    ctx.lineTo(Math.cos(a2) * rI, Math.sin(a2) * rI);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // --- 7. THE IRON CURTAIN (FRAMING WITH STEAM) ---
  const beamH = sh * 0.12;
  ctx.save();
  ctx.fillStyle = `oklch(15% 0.02 20)`; // Leaden Iron
  ctx.fillRect(0, 0, sw, beamH);
  ctx.fillRect(0, sh - beamH, sw, beamH);
  
  // Steam Release Interactions
  if (bass > 0.85) {
    ctx.globalAlpha = (bass - 0.85) * 0.6;
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(0, beamH, sw, 30);
    ctx.fillRect(0, sh - beamH - 30, sw, 20);
  }
  ctx.restore();

  // --- 8. ANAMORPHIC RED FLARE ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = "screen";
  const fW = sw * 1.2;
  const fG = ctx.createLinearGradient(-fW/2, 0, fW/2, 0);
  fG.addColorStop(0, "transparent");
  fG.addColorStop(0.5, `oklch(60% 0.35 25 / ${0.3 + bass * 0.5})`);
  fG.addColorStop(1, "transparent");
  ctx.fillStyle = fG;
  ctx.fillRect(-fW/2, -4, fW, 8);
  ctx.restore();

  // --- 9. REVOLUTIONARY METEORS (PARTICLES) ---
  if (refs.particles.current) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    refs.particles.current.forEach((p, idx) => {
      p.x += p.vx * 0.6; p.y += p.vy * 0.6 - 1.5;
      p.life *= 0.93;
      // Long tail effect
      ctx.strokeStyle = `oklch(65% 0.3 25 / ${p.life})`;
      ctx.lineWidth = p.s * p.life;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); ctx.stroke();
      if (p.life < 0.01) refs.particles.current.splice(idx, 1);
    });
    ctx.restore();
  }

  ctx.restore(); // End Global Scale

  // --- 10. FINAL POST: CINEMATIC VIGNETTE & GRAIN ---
  const vg = ctx.createRadialGradient(cx, cy, baseR * 1.1, cx, cy, sw);
  vg.addColorStop(0, "transparent");
  vg.addColorStop(1, `rgba(0,0,0,0.98)`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, sw, sh);
};
