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
  // Background shifts from Pitch Black to a Deep Charred Reactor Glow
  const bgRed = bass * 0.35;
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.8);
  bgGrad.addColorStop(0, `oklch(${12 + bgRed * 25}% ${0.1 + bgRed * 0.2} 25)`); // Glowing core
  bgGrad.addColorStop(1, `oklch(2% 0.02 20)`); // Pitch black/charcoal oppressive edges
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, sw, sh);

  // --- 4. BASTION AURORA (MASSIVE VOLUMETRIC GOD-RAYS) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const rayCount = 24; // Increased density for a heavy, foggy atmosphere
  for (let i = 0; i < rayCount; i++) {
    // Complex interplay of rotating searchlights
    const direction = i % 2 === 0 ? 1 : -1;
    const speed = 0.4 + (i % 3) * 0.3;
    const rAng = t * speed * direction + i * (Math.PI * 2 / rayCount) + Math.sin(t * 0.5 + i) * 0.2;
    
    const length = sw * 1.2; // Reach far beyond the screen
    // Massive volumetric spread that heavily reacts to bass, simulating air displacement
    const spread = 0.08 + (i % 4) * 0.04 + bass * 0.25; 
    
    // Radial gradient gives the illusion of thick atmospheric scattering
    const grd = ctx.createRadialGradient(cx, cy, sh * 0.15, cx, cy, length * 0.8);
    // Reduced alpha so the rays don't completely wash out the background
    const alpha = (i % 2 === 0 ? 0.08 : 0.04) * (1 + bass * 1.2);
    
    grd.addColorStop(0, `oklch(65% 0.35 25 / ${alpha})`); // Oppressive Crimson Origin
    grd.addColorStop(0.4, `oklch(85% 0.2 75 / ${alpha * 0.6})`); // Piercing Gold Mid
    grd.addColorStop(1, "transparent"); // Fades into the dark void
    
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    // Draw wide expanding trapezoidal rays
    ctx.lineTo(cx + Math.cos(rAng - spread) * length, cy + Math.sin(rAng - spread) * length);
    ctx.lineTo(cx + Math.cos(rAng + spread) * length, cy + Math.sin(rAng + spread) * length);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // --- 4.5 SOVIET CONSTRUCTIVIST ELEMENTS (GEOMETRY & TYPOGRAPHY) ---
  ctx.save();
  ctx.translate(cx, cy);
  
  // Faint heavy industrial geometry (Constructivist diagonal lines)
  ctx.globalAlpha = 0.05 + bass * 0.05;
  ctx.fillStyle = `oklch(40% 0.3 25)`;
  ctx.save();
  ctx.rotate(-Math.PI / 4); // Standard constructivist diagonal
  ctx.fillRect(-sw, -sh * 0.35, sw * 2, 50); // Heavy bar
  ctx.fillRect(-sw, -sh * 0.35 - 80, sw * 2, 20); // Sub bar
  ctx.fillRect(-sw, sh * 0.35, sw * 2, 50); // Bottom heavy bar
  ctx.restore();

  // Cyrillic Typography Slogans
  ctx.globalAlpha = 0.06 + bass * 0.1;
  ctx.fillStyle = `oklch(60% 0.3 25)`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Top giant slogan: "GLORY TO LABOR"
  ctx.font = "900 140px 'Arial Black', Impact, sans-serif";
  ctx.fillText("СЛАВА ТРУДУ", 0, -sh * 0.38);
  
  // Bottom industrial stamps
  ctx.font = "900 60px 'Arial Black', Impact, sans-serif";
  ctx.letterSpacing = "20px";
  ctx.fillText("ГОСТ-1917", 0, sh * 0.4);
  ctx.letterSpacing = "0px";
  
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

  // Sharp Geometric Soviet Star (Core) - INCREASED SIZE
  ctx.strokeStyle = `oklch(90% 0.1 80)`; // Gold Highlight Star
  ctx.lineWidth = 5; // Thicker lines
  ctx.globalCompositeOperation = "screen";
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    // Scaled up the star so it punches out of the core haze
    const rO = baseR * 0.65 * (1 + bass * 0.3);
    const rI = baseR * 0.25;
    const a1 = (i * Math.PI * 2 / 5) - Math.PI / 2;
    const a2 = a1 + (Math.PI / 5);
    ctx.lineTo(Math.cos(a1) * rO, Math.sin(a1) * rO);
    ctx.lineTo(Math.cos(a2) * rI, Math.sin(a2) * rI);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // --- 7. THE GHOST TOTEM (FULL SOVIET STATE EMBLEM) ---
  ctx.save();
  ctx.translate(cx, cy);
  
  // REMOVED ALPHA TRANSPARENCY: The emblem is now 100% opaque, 
  // making the #A20000 color incredibly deep, solid, and striking.
  ctx.globalAlpha = 1.0; 
  
  // Gentle, oppressive rotation
  ctx.rotate(Math.PI / 12 - t * 0.04);

  // Scale the whole emblem to fit perfectly
  const emSize = Math.min(sw, sh) * 0.35; 
  const emScale = 1 + bass * 0.05;
  ctx.scale(emScale, emScale);

  // 7.1 THE INDUSTRIAL COGWHEEL (Outer Ring)
  ctx.save();
  ctx.lineWidth = 18;
  ctx.lineJoin = "miter";
  // Heavy industrial steel with a red backlit glow
  ctx.strokeStyle = `rgba(15, 15, 15, 0.95)`; 
  ctx.shadowColor = `#A20000`;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  const gearR = emSize * 0.7;
  for (let i = 0; i < 24; i++) {
    const a1 = (i * Math.PI * 2) / 24;
    const a2 = ((i + 0.5) * Math.PI * 2) / 24;
    ctx.arc(0, 0, gearR, a1, a2);
    ctx.lineTo(Math.cos(a2) * (gearR + 25), Math.sin(a2) * (gearR + 25));
    const a3 = ((i + 1) * Math.PI * 2) / 24;
    ctx.arc(0, 0, gearR + 25, a2, a3);
    ctx.lineTo(Math.cos(a3) * gearR, Math.sin(a3) * gearR);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // 7.15 THE RISING SUN & GLOBE (CLASSIC USSR EMBLEM BACKGROUND)
  ctx.save();
  ctx.translate(0, emSize * 0.2); 
  // Golden Sun Core
  ctx.beginPath();
  ctx.arc(0, 0, emSize * 0.3, Math.PI, Math.PI * 2);
  ctx.fillStyle = `oklch(80% 0.18 75 / 0.95)`; // Solid Bright Gold
  ctx.fill();
  
  // Sharp Golden Sun Rays
  ctx.fillStyle = `oklch(80% 0.18 75 / 0.6)`;
  for(let i=1; i<20; i++) {
    const ang = Math.PI + i * (Math.PI / 20);
    const rayLength = emSize * (0.6 + (i % 2 === 0 ? 0.4 : 0)); 
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ang - 0.02) * rayLength, Math.sin(ang - 0.02) * rayLength);
    ctx.lineTo(Math.cos(ang + 0.02) * rayLength, Math.sin(ang + 0.02) * rayLength);
    ctx.fill();
  }
  ctx.restore();

  // The World Globe (Grid of Longitudes and Latitudes)
  ctx.save();
  ctx.translate(0, -emSize * 0.15);
  ctx.beginPath();
  ctx.arc(0, 0, emSize * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(10, 20, 30, 0.9)`; // Deep ocean
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = `rgba(255, 215, 0, 0.35)`; // Golden grid lines
  ctx.stroke(); 
  for (let i = 1; i <= 4; i++) { 
    ctx.beginPath(); ctx.ellipse(0, 0, emSize * 0.45 * (i / 5), emSize * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, emSize * 0.45, emSize * 0.45 * (i / 5), 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  // 7.18 INDUSTRIAL FACTORY SILHOUETTES (NEW SOVIET ELEMENT)
  // Factories and chimneys at the bottom of the globe, rising up into the scene
  ctx.save();
  ctx.translate(0, emSize * 0.25); // Lower part of the emblem
  ctx.fillStyle = `oklch(15% 0.05 20)`; // Pitch black iron silhouette
  ctx.beginPath();
  // Left side factories
  ctx.moveTo(-emSize * 0.4, 0);
  ctx.lineTo(-emSize * 0.35, -emSize * 0.1); 
  ctx.lineTo(-emSize * 0.25, -emSize * 0.1);
  ctx.lineTo(-emSize * 0.25, 0);
  // Heavy Chimney 1
  ctx.lineTo(-emSize * 0.2, 0);
  ctx.lineTo(-emSize * 0.18, -emSize * 0.25);
  ctx.lineTo(-emSize * 0.15, -emSize * 0.25);
  ctx.lineTo(-emSize * 0.13, 0);
  // Center Blocks
  ctx.lineTo(emSize * 0.1, 0);
  // Heavy Chimney 2
  ctx.lineTo(emSize * 0.15, 0);
  ctx.lineTo(emSize * 0.17, -emSize * 0.3);
  ctx.lineTo(emSize * 0.22, -emSize * 0.3);
  ctx.lineTo(emSize * 0.24, 0);
  // Right side factories
  ctx.lineTo(emSize * 0.3, 0);
  ctx.lineTo(emSize * 0.35, -emSize * 0.15);
  ctx.lineTo(emSize * 0.4, -emSize * 0.15);
  ctx.lineTo(emSize * 0.45, 0);
  ctx.fill();
  ctx.restore();

  // 7.2 THE WHEAT WREATH (GEOMETRIC USSR STYLE KERNELS)
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `oklch(75% 0.18 75)`; // Bright Golden Bronze
  ctx.fillStyle = `oklch(75% 0.18 75)`;
  ctx.shadowColor = `rgba(255, 215, 0, 0.4)`;
  ctx.shadowBlur = 12;
  const wreathR = emSize * 0.85;
  
  // Base Stems
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0, 0, wreathR, Math.PI * 0.65, Math.PI * 1.35, false); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, wreathR, Math.PI * 1.65, Math.PI * 2.35, false); ctx.stroke();
  
  // Wheat Kernels and Awns
  const drawKernel = (x: number, y: number, angle: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Diamond kernel
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(6, 0); ctx.lineTo(0, 12); ctx.lineTo(-6, 0);
    ctx.fill();
    // Awn (wheat hair extending outwards)
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(15, -35);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  };

  for(let i=0; i<16; i++) {
    const angL = Math.PI * 0.65 + i * 0.045;
    drawKernel(Math.cos(angL)*wreathR, Math.sin(angL)*wreathR, angL + Math.PI/4);
    drawKernel(Math.cos(angL)*(wreathR-14), Math.sin(angL)*(wreathR-14), angL - Math.PI/4);
    
    const angR = Math.PI * 1.65 + i * 0.045;
    drawKernel(Math.cos(angR)*wreathR, Math.sin(angR)*wreathR, angR - Math.PI/4);
    drawKernel(Math.cos(angR)*(wreathR-14), Math.sin(angR)*(wreathR-14), angR + Math.PI/4);
  }
  ctx.restore();

  // 7.25 RED RIBBONS WRAPPING THE WHEAT
  ctx.save();
  ctx.lineWidth = 32; // Thicker ribbons
  ctx.strokeStyle = `#A20000`; // EXACT COLOR REQUESTED BY USER
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 4;
  for (let i = 0; i < 7; i++) {
    const angL = Math.PI * 0.72 + i * 0.1;
    ctx.beginPath(); ctx.arc(0, 0, wreathR - 5, angL, angL + 0.045); ctx.stroke();
    const angR = Math.PI * 1.72 + i * 0.1;
    ctx.beginPath(); ctx.arc(0, 0, wreathR - 5, angR, angR + 0.045); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, wreathR, 45, 0, Math.PI * 2); ctx.fillStyle = `#A20000`; ctx.fill();
  ctx.restore();

  // 7.3 THE TOP RED STAR
  ctx.save();
  ctx.translate(0, -emSize * 0.85);
  ctx.beginPath();
  const starR = emSize * 0.18;
  for (let i = 0; i < 5; i++) {
    const a1 = (i * Math.PI * 2 / 5) - Math.PI / 2;
    const a2 = a1 + (Math.PI / 5);
    ctx.lineTo(Math.cos(a1) * starR, Math.sin(a1) * starR);
    ctx.lineTo(Math.cos(a2) * (starR * 0.4), Math.sin(a2) * (starR * 0.4));
  }
  ctx.closePath();
  ctx.fillStyle = `#A20000`; // EXACT COLOR
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = `oklch(80% 0.2 70)`; // Golden rim
  ctx.stroke();
  ctx.restore();

  // 7.35 CURVED SOVIET SLOGAN
  ctx.save();
  ctx.fillStyle = `#A20000`; // EXACT COLOR
  ctx.shadowColor = "rgba(0,0,0,0.6)"; // Text shadow for readability
  ctx.shadowBlur = 5;
  const text = "ПРОЛЕТАРИИ ВСЕХ СТРАН, СОЕДИНЯЙТЕСЬ!"; // Workers of the world, unite!
  ctx.font = `900 ${emSize * 0.12}px 'Arial Black', Impact, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const textR = emSize * 1.05; 
  const totalAngle = Math.PI * 1.2; 
  const startAngle = -Math.PI / 2 - totalAngle / 2;
  for (let i = 0; i < text.length; i++) {
    ctx.save();
    const charAngle = startAngle + (i / (text.length - 1)) * totalAngle;
    ctx.rotate(charAngle + Math.PI / 2);
    ctx.translate(0, -textR);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // 7.4 EXACT CCP EMBLEM (FROM PROVIDED SVG)
  ctx.save();
  const pathScale = emSize / 110; 
  ctx.scale(pathScale, pathScale);
  ctx.translate(-100, -110); 
  
  const emblemPath = new Path2D("M172 159 c6 7-8 21-15 15 l-83-86-14 14-20-20 32-31 33 6-18 18 m-22 62 -3 3 3 3 c4 4-2 10-6 6 l-3-3 c-5 10-9 14-15 20 -8 8-21-5-13-13 6-6 10-10 20-15 l-3-3 c-4-4 2-10 6-6 l3 3 8-8 h8 c8 12 30 28 57 7 23-18 24-69-26-98 50 4 82 77 41 113 -26 23-64 15-77-9");
  
  // Extreme deep contrast shadow to make the emblem pop off the globe
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 10;
  
  // EXACT #A20000 color requested by user, COMPLETELY NO STROKE
  ctx.fillStyle = `#A20000`; 
  ctx.fill(emblemPath);
  ctx.restore();

  ctx.restore(); // End Totem Group

  // --- 7.5 CONSTRUCTIVIST CORNER CHEVRONS (NEW SOVIET ELEMENT) ---
  ctx.save();
  ctx.fillStyle = `#A20000`;
  ctx.globalAlpha = 0.85;
  const cSize = Math.min(sw, sh) * 0.15;
  // Top Left Triangle
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cSize, 0); ctx.lineTo(0, cSize); ctx.fill();
  // Top Right Triangle
  ctx.beginPath(); ctx.moveTo(sw, 0); ctx.lineTo(sw - cSize, 0); ctx.lineTo(sw, cSize); ctx.fill();
  // Bottom Left Triangle
  ctx.beginPath(); ctx.moveTo(0, sh); ctx.lineTo(cSize, sh); ctx.lineTo(0, sh - cSize); ctx.fill();
  // Bottom Right Triangle
  ctx.beginPath(); ctx.moveTo(sw, sh); ctx.lineTo(sw - cSize, sh); ctx.lineTo(sw, sh - cSize); ctx.fill();
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

  // --- 10. REVOLUTIONARY METEORS (PARTICLES) ---
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

  // --- 11. FINAL POST: CINEMATIC VIGNETTE & GRAIN ---
  // (User requested NO BLACK EDGES, removed vignette)
  // const vg = ctx.createRadialGradient(cx, cy, baseR * 1.5, cx, cy, sw * 1.2);
  // vg.addColorStop(0, "transparent");
  // vg.addColorStop(1, `rgba(0,0,0,0.85)`); // Less aggressive darkness at the edges
  // ctx.fillStyle = vg;
  // ctx.fillRect(0, 0, sw, sh);
};
