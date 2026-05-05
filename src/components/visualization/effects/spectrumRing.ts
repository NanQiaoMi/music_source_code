import { EffectContext } from "./types";

/**
 * SPECTRUM SINGULARITY (V210 - THE RED BASTION)
 * Aesthetics: Soviet Brutalism, Ghost of the Revolution, Crystal Tech.
 * Tone: Divine Oppression, Ideological, Cinematic, Masterpiece.
 */
export const drawSpectrumRing = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  // --- 0. DIMENSIONS & PARAMS ---
  const sw = width || 1920;
  const sh = height || 1080;
  const cx = sw / 2;
  const cy = sh / 2;
  
  const {
    rotationSpeed = 1.0,
    flareAmount = 1.0,
    hudDetail = 1.0,
    barWidth = 3.0,
    chromaticIntensity = 1.0,
    ringCount = 3,
    colorMode = 0, // 0: Red/Gold, 1: Ice/Silver
    haloStyle = 0
  } = params || {};

  const t = (time || 0) * 0.00018 * rotationSpeed; 

  // --- PALETTE SYSTEM ---
  const isIce = colorMode === 1;
  const cRed = isIce ? `oklch(60% 0.15 250)` : `#A20000`; // Ice Blue vs Revolutionary Red
  const cGold = isIce ? `oklch(85% 0.05 200)` : `oklch(80% 0.18 75)`; // Silver vs Gold
  const cHue = isIce ? 250 : 25;

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

  // --- 3. DYNAMIC BACKGROUND: REVOLUTIONARY VOID ---
  ctx.save();
  // Darkened the background significantly to prevent washing out the red emblem
  const bgRed = bass * 0.25; 
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.8);
  bgGrad.addColorStop(0, `oklch(${10 + bgRed * 12}% ${0.08 + bgRed * 0.1} 25)`); // Dimmest core
  bgGrad.addColorStop(1, `oklch(2% 0.02 20)`); // Deep oppressive void
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, sw, sh);

  // --- 3.4 MONUMENTAL SILHOUETTES (ABSTRACT ANCHORS) ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = 0.04 * flareAmount;
  ctx.fillStyle = "#000";
  // Abstract "The Motherland Calls" silhouette
  ctx.save();
  ctx.translate(-sw * 0.35, sh * 0.25);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(30, -450); // Massive Sword
  ctx.lineTo(60, 0);
  ctx.lineTo(120, 80);
  ctx.lineTo(40, 500);
  ctx.lineTo(-100, 500);
  ctx.fill();
  ctx.restore();
  // Abstract "Worker and Kolkhoz Woman" silhouette
  ctx.save();
  ctx.translate(sw * 0.32, sh * 0.28);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-40, -350); // Hammer/Sickle held high
  ctx.lineTo(40, -350);
  ctx.lineTo(80, 0);
  ctx.lineTo(0, 450);
  ctx.fill();
  ctx.restore();
  ctx.restore();

  // --- 3.5 BRUTALIST MONOLITHS (BACKGROUND ARCHITECTURE) ---
  ctx.save();
  ctx.globalAlpha = (0.15 + bass * 0.1) * (1 - (colorMode === 1 ? 0.5 : 0));
  const monoCount = 8;
  for (let i = 0; i < monoCount; i++) {
    const mWidth = sw / monoCount;
    const mHeight = sh * 0.5 + Math.sin(t * 0.5 + i) * 80 + getVal(i * 10 % 128) * 200;
    const mx = i * mWidth;
    const my = sh - mHeight;
    
    const mGrad = ctx.createLinearGradient(mx, my, mx, sh);
    mGrad.addColorStop(0, `oklch(25% 0.08 25 / 0.8)`);
    mGrad.addColorStop(1, `oklch(5% 0.02 20 / 0)`);
    
    ctx.fillStyle = mGrad;
    ctx.fillRect(mx + 15, my, mWidth - 30, mHeight);
    
    // Structural Detail Lines
    ctx.strokeStyle = `oklch(35% 0.15 25 / 0.25)`;
    ctx.lineWidth = 1;
    for(let j=1; j<6; j++) {
      const ly = my + j * (mHeight / 8);
      ctx.beginPath(); ctx.moveTo(mx + 15, ly); ctx.lineTo(mx + mWidth - 15, ly); ctx.stroke();
    }
  }
  ctx.restore();

  // --- 3.6 INDUSTRIAL GEAR MATRIX (FRAMEWORK) ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = (0.05 + bass * 0.08) * flareAmount;
  ctx.strokeStyle = cRed;
  ctx.lineWidth = 30;
  
  const drawLargeGear = (radius: number, speed: number, teeth: number) => {
    ctx.save();
    ctx.rotate(t * speed);
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a1 = (i * Math.PI * 2) / teeth;
      const a2 = ((i + 0.5) * Math.PI * 2) / teeth;
      const a3 = ((i + 1) * Math.PI * 2) / teeth;
      ctx.arc(0, 0, radius, a1, a2);
      ctx.lineTo(Math.cos(a2) * (radius + 60), Math.sin(a2) * (radius + 60));
      ctx.arc(0, 0, radius + 60, a2, a3);
      ctx.lineTo(Math.cos(a3) * radius, Math.sin(a3) * radius);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };
  
  drawLargeGear(Math.max(sw, sh) * 0.65, 0.15, 24);
  drawLargeGear(Math.max(sw, sh) * 0.9, -0.08, 36);
  ctx.restore();

  // --- 3.7 VOLUMETRIC INDUSTRIAL FOG (ATMOSPHERE) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const fogGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.7);
  // Reddish heavy fog
  fogGrad.addColorStop(0, `oklch(25% 0.12 25 / ${0.15 + bass * 0.2})`);
  fogGrad.addColorStop(0.5, `oklch(15% 0.08 25 / 0.08)`);
  fogGrad.addColorStop(1, "transparent");
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, 0, sw, sh);
  
  // Drifting Smoke Particles (Subtle)
  for(let i=0; i<4; i++) {
    const driftX = Math.sin(t * 0.4 + i) * 150;
    const driftY = Math.cos(t * 0.25 + i) * 80;
    const smokeG = ctx.createRadialGradient(cx + driftX, cy + driftY, 0, cx + driftX, cy + driftY, 500);
    smokeG.addColorStop(0, `oklch(35% 0.15 20 / 0.08)`);
    smokeG.addColorStop(1, "transparent");
    ctx.fillStyle = smokeG;
    ctx.fillRect(0, 0, sw, sh);
  }
  ctx.restore();

  // --- 3.8 INDUSTRIAL DEGRADATION (GRAIN & CONCRETE) ---
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.globalCompositeOperation = "overlay";
  // OPTIMIZED: Reduced loop count from 1500 to 400 for better performance
  for (let i = 0; i < 400; i++) {
    const gx = Math.random() * sw;
    const gy = Math.random() * sh;
    ctx.fillStyle = i % 2 === 0 ? "#fff" : "#000";
    ctx.fillRect(gx, gy, 2, 2); // Larger dots, fewer calls
  }
  ctx.restore();

  // --- 3.9 PISTON ENGINE SUB-SYSTEM (INTERNAL MACHINERY) ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = (0.08 + bass * 0.1) * flareAmount;
  ctx.strokeStyle = `oklch(35% 0.05 20)`;
  ctx.lineWidth = 12;
  
  for(let i=0; i<4; i++) {
    const ang = i * (Math.PI / 2) + Math.PI/4 + t * 0.1;
    const pLen = 180 + bass * 140;
    const px = Math.cos(ang) * pLen;
    const py = Math.sin(ang) * pLen;
    
    // Connecting Rod
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang)*40, Math.sin(ang)*40);
    ctx.lineTo(px, py);
    ctx.stroke();
    
    // Piston Head (Constructivist block)
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = `oklch(25% 0.05 20)`;
    ctx.fillRect(-25, -35, 50, 70);
    // Industrial Rivets on Piston
    ctx.fillStyle = cGold;
    ctx.beginPath(); ctx.arc(-15, -20, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(15, -20, 3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // --- 4. BASTION AURORA (MASSIVE VOLUMETRIC GOD-RAYS) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  // ringCount now affects the density of searchlights
  const rayCount = Math.floor(12 + ringCount * 8); 
  for (let i = 0; i < rayCount; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    const speed = 0.4 + (i % 3) * 0.3;
    const rAng = t * speed * direction + i * (Math.PI * 2 / rayCount) + Math.sin(t * 0.5 + i) * 0.2;
    
    const length = sw * 1.5; 
    const spread = (0.1 + (i % 4) * 0.05 + bass * 0.2) * (haloStyle === 2 ? 1.5 : 1.0); 
    
    const grd = ctx.createRadialGradient(cx, cy, sh * 0.1, cx, cy, length * 0.9);
    // flareAmount affects the intensity of the atmosphere
    const alpha = (i % 2 === 0 ? 0.05 : 0.025) * (1 + bass * 0.8) * flareAmount;
    
    grd.addColorStop(0, `oklch(60% 0.35 ${cHue} / ${alpha})`); 
    grd.addColorStop(0.4, `oklch(80% 0.2 ${isIce ? 200 : 85} / ${alpha * 0.6})`); 
    grd.addColorStop(1, "transparent"); 
    
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    if (haloStyle === 1) {
      // Stardust style: draw dots instead of rays
      for(let j=0; j<10; j++) {
        const dAng = rAng + (Math.random()-0.5) * spread;
        const dLen = Math.random() * length;
        ctx.arc(cx + Math.cos(dAng)*dLen, cy + Math.sin(dAng)*dLen, 2, 0, Math.PI*2);
      }
    } else {
      ctx.lineTo(cx + Math.cos(rAng - spread) * length, cy + Math.sin(rAng - spread) * length);
      ctx.lineTo(cx + Math.cos(rAng + spread) * length, cy + Math.sin(rAng + spread) * length);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // --- 4.8 CONSTRUCTIVIST POSTER SHAPES (GEOMETRIC SLICE) ---
  ctx.save();
  ctx.globalAlpha = (0.12 + bass * 0.08) * flareAmount;
  // Deep Red Blade
  ctx.fillStyle = cRed;
  ctx.beginPath();
  ctx.moveTo(0, sh * 0.15);
  ctx.lineTo(sw * 0.35, 0);
  ctx.lineTo(sw * 0.55, 0);
  ctx.lineTo(0, sh * 0.7);
  ctx.fill();
  
  // Black Void Blade
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(sw, sh * 0.1);
  ctx.lineTo(sw * 0.65, sh);
  ctx.lineTo(sw * 0.75, sh);
  ctx.lineTo(sw, sh * 0.25);
  ctx.fill();
  
  // Dynamic Chevron
  ctx.strokeStyle = cGold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sw * 0.1, sh * 0.8);
  ctx.lineTo(sw * 0.2, sh * 0.85);
  ctx.lineTo(sw * 0.1, sh * 0.9);
  ctx.stroke();
  ctx.restore();

  // --- 4.5 SOVIET CONSTRUCTIVIST ELEMENTS (GEOMETRY & TYPOGRAPHY) ---
  ctx.save();
  ctx.translate(cx, cy);
  
  // Faint heavy industrial geometry (Constructivist diagonal lines)
  ctx.globalAlpha = 0.12 + bass * 0.18;
  ctx.fillStyle = `oklch(45% 0.35 25)`;
  ctx.save();
  ctx.rotate(-Math.PI / 4); // Standard constructivist diagonal
  ctx.fillRect(-sw, -sh * 0.38, sw * 2, 70); // Heavy bar
  ctx.fillRect(-sw, -sh * 0.38 - 110, sw * 2, 30); // Sub bar
  ctx.fillRect(-sw, sh * 0.38, sw * 2, 70); // Bottom heavy bar
  
  // Industrial Rivets
  ctx.fillStyle = `oklch(20% 0.05 20)`;
  for(let i=0; i<15; i++) {
    const rx = -sw + i * 300;
    ctx.beginPath(); ctx.arc(rx, -sh * 0.38 + 35, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx, sh * 0.38 + 35, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Technical Labels (Corner Metadata)
  // hudDetail controls the visibility of all UI elements
  ctx.globalAlpha = (0.4 + bass * 0.3) * hudDetail;
  ctx.fillStyle = cGold;
  ctx.font = "900 18px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "left";
  // Corner status readouts
  ctx.fillText("КОНТРОЛЬ: АКТИВЕН", -cx + 40, -cy + 60);
  ctx.fillText("СЕКТОР-7 / МОЩНОСТЬ", -cx + 40, cy - 40);
  ctx.textAlign = "right";
  ctx.fillText(`СИСТЕМА: ${Math.floor(bass * 100)}%`, cx - 40, -cy + 60);
  ctx.fillText("ГОСТ-2024.X", cx - 40, cy - 40);

  // Cyrillic Typography Slogans
  ctx.globalAlpha = (0.12 + bass * 0.15) * hudDetail;
  ctx.fillStyle = cGold;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Top giant slogan: "GLORY TO LABOR"
  ctx.font = "900 160px 'Arial Black', Impact, sans-serif";
  ctx.fillText("СЛАВА ТРУДУ", 0, -sh * 0.4);
  
  // Bottom industrial stamps
  ctx.font = "900 70px 'Arial Black', Impact, sans-serif";
  ctx.letterSpacing = "25px";
  ctx.fillText("ГОСТ-1917", 0, sh * 0.42);
  ctx.letterSpacing = "0px";
  
  ctx.restore();

  // --- 4.7 SPUTNIK (THE FIRST SATELLITE) ---
  ctx.save();
  ctx.globalAlpha = hudDetail; // Hide with HUD detail
  ctx.translate(cx, cy);
  const orbRadius = sh * 0.45;
  const orbSpeed = t * 1.8;
  const sx = Math.cos(orbSpeed) * orbRadius * 1.2;
  const sy = Math.sin(orbSpeed) * orbRadius * 0.8; // Elliptical orbit

  // Orbit Path Line (Dashed)
  ctx.save();
  ctx.strokeStyle = `oklch(60% 0.2 25 / 0.1)`;
  ctx.setLineDash([5, 15]);
  ctx.beginPath(); ctx.ellipse(0, 0, orbRadius * 1.2, orbRadius * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // Sputnik Signal Rings (Expanding Waves)
  const signalT = (time * 0.005) % 1;
  ctx.save();
  ctx.strokeStyle = `oklch(70% 0.3 25 / ${0.2 * (1 - signalT)})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sx, sy, 20 + signalT * 80, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  ctx.translate(sx, sy);
  ctx.rotate(orbSpeed + Math.PI/2);
  
  // Sputnik Body
  ctx.fillStyle = `oklch(75% 0.05 20)`; // Polished Steel
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
  // Antennas
  ctx.strokeStyle = `oklch(85% 0.05 20)`;
  ctx.lineWidth = 2;
  for(let i=0; i<4; i++) {
    const a = -Math.PI/2 + (i-1.5) * 0.4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a)*60, Math.sin(a)*60); ctx.stroke();
  }
  // Signal Blink
  if (Math.sin(t * 15) > 0.7) {
    ctx.fillStyle = `oklch(75% 0.35 25)`;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
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
    const bW = barWidth + val * 8; // Connected to barWidth param
    const bH = 20 + val * 130 * (0.8 + bass * 0.6);
    
    // Core Material Gradient
    ctx.globalCompositeOperation = "screen";
    const g = ctx.createLinearGradient(baseR, 0, baseR + bH, 0);
    g.addColorStop(0, cGold); 
    g.addColorStop(1, cRed); 
    
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

  // --- 6.5 CHERENKOV CORE (BLUE RADIATION GLOW) ---
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const blueG = ctx.createRadialGradient(0, 0, 0, 0, 0, baseR * 1.4);
  blueG.addColorStop(0, `rgba(0, 160, 255, ${0.08 + bass * 0.15})`);
  blueG.addColorStop(0.6, `rgba(0, 80, 200, 0.05)`);
  blueG.addColorStop(1, "transparent");
  ctx.fillStyle = blueG;
  ctx.beginPath(); ctx.arc(0, 0, baseR * 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.restore();

  // --- 7. THE GHOST TOTEM (FULL SOVIET STATE EMBLEM) ---
  ctx.save();
  ctx.translate(cx, cy);

  // 7.0 CONSTRUCTIVIST SUNBURST (PROPAGANDA RAYS)
  ctx.save();
  // Increased visibility and music reactivity
  ctx.globalAlpha = (0.1 + bass * 0.15) * flareAmount; // Affected by flareAmount
  ctx.fillStyle = cRed;
  for(let i=0; i<12; i++) {
    const a = i * (Math.PI * 2 / 12) + t * 0.1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    // Wider rays for more presence
    ctx.lineTo(Math.cos(a - 0.12) * sw, Math.sin(a - 0.12) * sw);
    ctx.lineTo(Math.cos(a + 0.12) * sw, Math.sin(a + 0.12) * sw);
    ctx.fill();
  }
  ctx.restore();
  
  // REMOVED ALPHA TRANSPARENCY: The emblem is now 100% opaque, 
  // making the #A20000 color incredibly deep, solid, and striking.
  ctx.globalAlpha = 1.0; 
  
  // CHROMATIC ABERRATION SIMULATION
  if (chromaticIntensity > 0) {
    ctx.translate(chromaticIntensity * 2, 0);
  }
  
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
  // CHANGED TO cRed: Solid revolutionary color for the gear
  ctx.strokeStyle = cRed; 
  ctx.shadowColor = cRed;
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
  // CHANGED TO cRed: The world itself is now revolutionary color
  ctx.fillStyle = cRed; 
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = isIce ? `rgba(200, 220, 255, 0.35)` : `rgba(255, 215, 0, 0.35)`; 
  ctx.stroke(); 
  for (let i = 1; i <= 4; i++) { 
    ctx.beginPath(); ctx.ellipse(0, 0, emSize * 0.45 * (i / 5), emSize * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, emSize * 0.45, emSize * 0.45 * (i / 5), 0, 0, Math.PI * 2); ctx.stroke();
  }

  // 7.17 ICONIC GOLDEN HAMMER AND SICKLE
  ctx.save();
  ctx.fillStyle = cGold; 
  ctx.shadowColor = `rgba(0,0,0,0.5)`;
  ctx.shadowBlur = 10;
  const hsScale = emSize * 0.003;
  ctx.scale(hsScale, hsScale);
  ctx.translate(-50, -50);
  const hsPath = new Path2D("M86.5,29c-8.7-8.7-22.1-10.4-32.8-5.3l-5,5.1l11,11l3.5-3.5c4.7-2.3,10.6-1.5,14.5,2.4c3.9,3.9,4.7,9.8,2.4,14.5 l18.1,18.1c1.2,1.2,1.2,3.1,0,4.2l-3.5,3.5c-1.2,1.2-3.1,1.2-4.2,0L72.9,56.1c-4.7,2.3-10.6,1.5-14.5-2.4c-3.9-3.9-4.7-9.8-2.4-14.5 l-5.1,5l-11-11l3.5-3.5c2.3-4.7,1.5-10.6-2.4-14.5c-4.9-4.9-12.8-4.9-17.7,0l-14.1,14.1c-4.9,4.9-4.9,12.8,0,17.7l46,46 c4.9,4.9,12.8,4.9,17.7,0l14.1-14.1C91.4,51.1,91.4,43.2,86.5,38.3z");
  ctx.fill(hsPath);
  ctx.restore();
  
  ctx.restore();

  // 7.18 INDUSTRIAL FACTORY SILHOUETTES (NEW SOVIET ELEMENT)
  // Factories and chimneys transformed to Golden Glowing Icons
  ctx.save();
  ctx.globalAlpha = hudDetail; // Affected by hudDetail
  ctx.translate(0, emSize * 0.25); // Lower part of the emblem
  ctx.fillStyle = cGold; 
  ctx.shadowColor = isIce ? `rgba(100, 200, 255, 0.4)` : `rgba(255, 215, 0, 0.4)`;
  ctx.shadowBlur = 10;
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

  // 7.19 KREMLIN WALL SILHOUETTE (BOTTOM ANCHOR)
  ctx.save();
  ctx.globalAlpha = hudDetail;
  ctx.translate(0, emSize * 0.5);
  ctx.fillStyle = cGold; 
  ctx.shadowColor = isIce ? `rgba(100, 200, 255, 0.4)` : `rgba(255, 215, 0, 0.4)`;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  const kw = emSize * 1.5;
  ctx.moveTo(-kw/2, 0);
  // Teeth of the wall
  for(let i=0; i<10; i++) {
    const tx = -kw/2 + i * (kw/10);
    ctx.lineTo(tx, -10);
    ctx.lineTo(tx + (kw/20), -10);
    ctx.lineTo(tx + (kw/20), 0);
  }
  ctx.lineTo(kw/2, 0);
  ctx.lineTo(kw/2, 20);
  ctx.lineTo(-kw/2, 20);
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
  ctx.strokeStyle = cRed; 
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 4;
  for (let i = 0; i < 7; i++) {
    const angL = Math.PI * 0.72 + i * 0.1;
    ctx.beginPath(); ctx.arc(0, 0, wreathR - 5, angL, angL + 0.045); ctx.stroke();
    const angR = Math.PI * 1.72 + i * 0.1;
    ctx.beginPath(); ctx.arc(0, 0, wreathR - 5, angR, angR + 0.045); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, wreathR, 45, 0, Math.PI * 2); ctx.fillStyle = cRed; ctx.fill();
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
  ctx.fillStyle = cRed; 
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = cGold; 
  ctx.stroke();
  ctx.restore();

  // 7.35 CURVED SOVIET SLOGAN
  ctx.save();
  ctx.globalAlpha = hudDetail;
  ctx.fillStyle = cRed; 
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

  // --- 11. INDUSTRIAL GAUGES (TECHNICAL METADATA) ---
  ctx.save();
  ctx.globalAlpha = hudDetail;
  const drawGauge = (x: number, y: number, label: number, val: number, text: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = cRed; 
    ctx.lineWidth = 2;
    // Outer arc
    ctx.beginPath(); ctx.arc(0, 0, 35, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
    // Ticks
    for(let i=0; i<=5; i++) {
      const ta = Math.PI * 0.8 + i * (Math.PI * 1.4 / 5);
      ctx.beginPath(); ctx.moveTo(Math.cos(ta)*30, Math.sin(ta)*30); ctx.lineTo(Math.cos(ta)*35, Math.sin(ta)*35); ctx.stroke();
    }
    // Needle
    const na = Math.PI * 0.8 + val * Math.PI * 1.4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(na) * 32, Math.sin(na) * 32); ctx.stroke();
    // Center point
    ctx.fillStyle = cRed; 
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    // Label
    ctx.fillStyle = cGold; 
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, 0, 50);
    ctx.restore();
  };

  drawGauge(100, sh - 120, 0, bass, "РЕАКТОР");
  drawGauge(sw - 100, sh - 120, 1, energy, "ДАВЛЕНИЕ");

  // --- 11.9 FLYING PROPAGANDA TYPOGRAPHY (3D EFFECT) ---
  // OPTIMIZED: Reduced word count and simplified rendering to prevent lag
  if (bass > 0.4) {
    ctx.save();
    ctx.translate(cx, cy);
    const flyWords = ["ПРАВДА", "ПОБЕДА", "СИЛА"];
    ctx.font = "900 40px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = cRed;
    
    flyWords.forEach((word, i) => {
      const wordT = (time * 0.0003 + i * (1/flyWords.length)) % 1;
      // OPTIMIZED: Limited scale to 6.0 to prevent expensive large-glyph rasterization
      const wordScale = 0.1 + wordT * wordT * 6; 
      const wordAlpha = (1 - wordT) * Math.min(1, bass * 0.6);
      
      if (wordAlpha > 0.05) {
        ctx.save();
        ctx.globalAlpha = wordAlpha;
        ctx.scale(wordScale, wordScale);
        ctx.fillText(word, 0, 0);
        ctx.restore();
      }
    });
    ctx.restore();
  }

  // --- 11.7 CLASSIFIED STAMPS & SERIAL IDs ---
  ctx.save();
  ctx.globalAlpha = (0.6 + bass * 0.2) * hudDetail;
  ctx.fillStyle = cRed;
  
  // "TOP SECRET" Stamp (Cyrillic)
  ctx.save();
  ctx.translate(sw - 220, 160);
  ctx.rotate(-0.15);
  ctx.strokeStyle = cRed;
  ctx.lineWidth = 4;
  ctx.strokeRect(-140, -35, 280, 70);
  ctx.font = "900 24px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("СОВЕРШЕННО СЕКРЕТНО", 0, 10);
  ctx.restore();
  
  // Technical Data Stream (Left Side)
  ctx.font = "11px monospace";
  ctx.fillStyle = cGold;
  ctx.textAlign = "left";
  const dataLines = [
    `OBJECT: SINGULARITY-V220`,
    `AUTH: SUPREME COMMAND`,
    `STATUS: ${bass > 0.8 ? "OVERLOAD" : "STABLE"}`,
    `CORE_TEMP: ${Math.floor(700 + energy * 400)}K`,
    `SERIAL: №${Math.floor(time % 1000000)}`
  ];
  dataLines.forEach((line, i) => {
    ctx.fillText(line, 50, 180 + i * 18);
  });
  ctx.restore();

  // --- 11.5 PROPAGANDA TICKER (BOTTOM SCROLL) ---
  ctx.save();
  ctx.globalAlpha = (0.7 + bass * 0.3) * hudDetail;
  ctx.fillStyle = `rgba(162, 0, 0, 0.9)`;
  ctx.fillRect(0, sh - 45, sw, 45);
  
  ctx.fillStyle = cGold;
  ctx.font = "900 20px 'Arial Black', Impact, sans-serif";
  ctx.textBaseline = "middle";
  const slogans = [
    "ПРОЛЕТАРИИ ВСЕХ СТРАН, СОЕДИНЯЙТЕСЬ!",
    "МИР. ТРУД. МАЙ.",
    "СЛАВА ГЕРОЯМ ТРУДА!",
    "ВЫШЕ ЗНАМЯ СОВЕТСКОЙ НАУКИ!",
    "ПЯТИЛЕТКУ - В ЧЕТЫРЕ ГОДА!",
    "ВПЕРЕД, К ПОБЕДЕ КОММУНИЗМА!"
  ];
  const tickerText = slogans.join("   •   ");
  const scrollSpeed = 2.5;
  const scrollX = (time * 0.1 * scrollSpeed) % (sw * 3); 
  ctx.fillText(tickerText, sw - scrollX, sh - 22);
  ctx.fillText(tickerText, sw - scrollX + sw * 3, sh - 22); 
  ctx.restore();

  // --- 11.6 MILITARY COMMAND OVERLAY (CROSSHAIRS) ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = (0.2 + bass * 0.4) * hudDetail;
  ctx.strokeStyle = cRed;
  ctx.lineWidth = 1.5;
  
  // Central Crosshair
  const chSize = 120 + bass * 60;
  ctx.beginPath();
  ctx.moveTo(-chSize, 0); ctx.lineTo(-25, 0);
  ctx.moveTo(25, 0); ctx.lineTo(chSize, 0);
  ctx.moveTo(0, -chSize); ctx.lineTo(0, -25);
  ctx.moveTo(0, 25); ctx.lineTo(0, chSize);
  ctx.stroke();
  
  // Inner Diamond
  ctx.save();
  ctx.rotate(Math.PI / 4);
  ctx.strokeRect(-20, -20, 40, 40);
  ctx.restore();
  
  // Corner Brackets
  const br = 50;
  const dist = Math.min(sw, sh) * 0.42;
  const corners = [[-1,-1], [1,-1], [-1,1], [1,1]];
  corners.forEach(([sx, sy]) => {
    ctx.save();
    ctx.translate(sx * dist, sy * dist);
    ctx.beginPath();
    ctx.moveTo(0, -sy * br); ctx.lineTo(0, 0); ctx.lineTo(-sx * br, 0);
    ctx.stroke();
    // Coordinate readout
    ctx.fillStyle = cRed;
    ctx.font = "10px monospace";
    ctx.textAlign = sx > 0 ? "left" : "right";
    ctx.fillText(`LOC: ${Math.floor(cx + sx*dist)},${Math.floor(cy + sy*dist)}`, sx*10, sy*10);
    ctx.restore();
  });
  
  // Target Warning
  if (bass > 0.88) {
    ctx.fillStyle = cRed;
    ctx.font = "900 24px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("КРИТИЧЕСКАЯ МОЩНОСТЬ", 0, chSize + 50);
  }
  ctx.restore();

  ctx.restore();

  // --- 12. SCANLINES & RED ALERT GLITCH ---
  ctx.save();
  // Fine CRT Scanlines
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#000";
  for (let i = 0; i < sh; i += 3) {
    ctx.fillRect(0, i, sw, 1);
  }
  
  // High Intensity Peak Glitch
  if (bass > 0.94 && Math.random() > 0.7) {
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(162, 0, 0, 0.3)`;
    const h = Math.random() * 100;
    const y = Math.random() * (sh - h);
    ctx.fillRect(0, y, sw, h);
    
    // RGB Shift simulation (Horizontal)
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#0ff";
    ctx.fillRect(Math.random() * 20 - 10, y + h/2, sw, 2);
    ctx.fillStyle = "#f0f";
    ctx.fillRect(Math.random() * 20 - 10, y + h/2 + 5, sw, 2);
  }
  ctx.restore();

  // --- 12.5 THE IRON CURTAIN (SLIDING FRAMEWORK) ---
  ctx.save();
  // Plates close in based on bass energy
  const icPos = bass * 180 * flareAmount;
  ctx.fillStyle = `oklch(15% 0.02 20)`;
  ctx.strokeStyle = `oklch(35% 0.1 20)`;
  ctx.lineWidth = 12;
  
  // Left Heavy Plate
  ctx.fillRect(0, 0, icPos, sh);
  ctx.strokeRect(0, 0, icPos, sh);
  // Right Heavy Plate
  ctx.fillRect(sw - icPos, 0, icPos, sh);
  ctx.strokeRect(sw - icPos, 0, icPos, sh);
  
  // Industrial Rivets and Structural Grooves
  ctx.fillStyle = cGold;
  ctx.globalAlpha = 0.6;
  for(let i=0; i<sh; i+=80) {
    ctx.beginPath(); ctx.arc(icPos - 25, i + 40, 6, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sw - icPos + 25, i + 40, 6, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  ctx.restore(); // End Global Scale

  // --- 11. FINAL POST: CINEMATIC VIGNETTE & GRAIN ---
  // (User requested NO BLACK EDGES, removed vignette)
  // const vg = ctx.createRadialGradient(cx, cy, baseR * 1.5, cx, cy, sw * 1.2);
  // vg.addColorStop(0, "transparent");
  // vg.addColorStop(1, `rgba(0,0,0,0.85)`); // Less aggressive darkness at the edges
  // ctx.fillStyle = vg;
  // ctx.fillRect(0, 0, sw, sh);
};
