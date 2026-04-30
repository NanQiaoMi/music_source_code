import { EffectContext } from "./types";

/**
 * GRAVITATIONAL FIELD (V110 - THE RED BASTION: BLOOD AWAKENING)
 * Aesthetics: High Soviet Brutalism, Visible Red Consciousness.
 * Tone: Monolithic, Oppressive, Epic Cinematic.
 */
export const drawGravitationalField = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  const sw = width || 1920;
  const sh = height || 1080;
  const cx = sw / 2;
  const cy = sh / 2;
  const t = time * 0.00015;

  // --- 1. AUDIO ANALYSIS & SMOOTHING ---
  const getVal = (i: number) => (data && data[i] !== undefined) ? data[i] / 255 : 0;
  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.85 + (getVal(0) + getVal(2)) / 2 * 0.15;
  const bass = refs.smoothBass.current;

  // --- 2. GLOBAL BREATHING ---
  ctx.save();
  const bScale = 1 + bass * 0.06;
  ctx.translate(cx, cy);
  ctx.scale(bScale, bScale);
  ctx.translate(-cx, -cy);

  // --- 3. DYNAMIC BACKGROUND: BLOOD RED AWAKENING ---
  ctx.save();
  // Significantly increased brightness and chroma for VISIBLE breathing
  // Black -> Vibrant Deep Red (oklch 10% -> 35%, chroma 0 -> 0.25)
  const bgL = 10 + bass * 25; 
  const bgC = bass * 0.25;
  ctx.fillStyle = `oklch(${bgL}% ${bgC} 25)`; 
  ctx.fillRect(0, 0, sw, sh);

  // Large Ambient Red Glow (Expanding with Bass)
  const bgGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, sw * 0.8);
  bgGrd.addColorStop(0, `oklch(45% 0.35 25 / ${bass * 0.25})`);
  bgGrd.addColorStop(1, "transparent");
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, sw, sh);

  // The Ghost Hammer & Sickle (VISIBLE IDEOLOGICAL TOTEM)
  if (bass > 0.3) {
    ctx.save();
    ctx.translate(cx, cy);
    // Increased alpha from 0.12 to 0.35
    ctx.globalAlpha = (bass - 0.3) * 0.4;
    ctx.fillStyle = `oklch(60% 0.3 25)`; // Brighter Red for totem
    ctx.rotate(-t * 0.15);
    // Abstract Hammer
    ctx.fillRect(-220, -50, 440, 100);
    ctx.fillRect(-50, -220, 100, 440);
    // Abstract Sickle
    ctx.beginPath();
    ctx.arc(0, 0, 320, 0, Math.PI, true);
    ctx.lineWidth = 65;
    ctx.strokeStyle = `oklch(60% 0.3 25)`;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // --- 4. THE IRON CURTAIN (HEAVY FRAMING) ---
  const beamH = sh * 0.12;
  const drawIronFrame = () => {
    ctx.save();
    ctx.fillStyle = `oklch(15% 0.02 20)`; // Soviet Iron
    ctx.fillRect(0, 0, sw, beamH);
    ctx.fillRect(0, sh - beamH, sw, beamH);
    // Rim highlight
    ctx.strokeStyle = `oklch(35% 0.03 20 / 0.5)`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, beamH); ctx.lineTo(sw, beamH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, sh - beamH); ctx.lineTo(sw, sh - beamH); ctx.stroke();
    ctx.restore();
  };
  drawIronFrame();

  // --- 5. BASTION SCATTERED RAYS (USER AURORA STYLE) ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = "screen";
  const beamCount = 42; 
  const beamLen = Math.max(sw, sh) * 1.8;
  
  for (let i = 0; i < beamCount; i++) {
    const angle = (i / beamCount) * Math.PI * 2 + t * 4.5; 
    const bGrd = ctx.createRadialGradient(0, 0, 80, 0, 0, beamLen);
    
    const bAlpha = (0.05 + bass * 0.45) * (Math.sin(t * 12 + i) * 0.5 + 0.5);
    const bWidth = 0.015 + bass * 0.08;
    
    const isRed = i % 3 !== 0;
    const beamColor = isRed 
      ? `oklch(55% 0.35 25 / ${bAlpha})`   
      : `oklch(85% 0.18 90 / ${bAlpha})`;  
      
    bGrd.addColorStop(0, beamColor);
    bGrd.addColorStop(0.5, isRed ? `oklch(45% 0.3 25 / ${bAlpha * 0.5})` : `oklch(75% 0.15 85 / ${bAlpha * 0.5})`);
    bGrd.addColorStop(1, "transparent");
    
    ctx.fillStyle = bGrd;
    ctx.beginPath(); 
    ctx.moveTo(0, 0); 
    ctx.arc(0, 0, beamLen, angle - bWidth, angle + bWidth); 
    ctx.fill();
  }
  ctx.restore();

  // --- 6. QUANTUM GRAVITY ORBITS (CRYSTAL TECH) ---
  ctx.save();
  ctx.translate(cx, cy);
  const ringCount = 10;
  for (let i = 0; i < ringCount; i++) {
    const rx = (160 + i * 55) * (1 + bass * 0.12);
    const aspect = 0.3 + Math.sin(t * 0.4 + i) * 0.15;
    const ry = rx * aspect;
    const rot = t * 0.6 * (i % 2 === 0 ? 1 : -1) + i;
    
    ctx.save();
    ctx.rotate(i * Math.PI / 5);
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = i % 3 === 0 ? `oklch(75% 0.15 80 / 0.4)` : `oklch(60% 0.35 25 / 0.35)`;
    ctx.lineWidth = i % 4 === 0 ? 2.5 : 1.0;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, rot, 0, Math.PI * 2);
    ctx.stroke();
    
    // Satellites
    const sAng = t * (1.5 + i * 0.1) + i;
    const sx = Math.cos(sAng) * rx;
    const sy = Math.sin(sAng) * ry;
    ctx.fillStyle = `oklch(95% 0.1 80 / 0.9)`;
    ctx.beginPath(); ctx.arc(sx, sy, 4 + (i % 3), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // --- 7. THE RED GIANT SINGULARITY (CORE) ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = "screen";
  const coreR = 150 * (1 + bass * 0.7);
  
  // High-Intensity Bloom
  const cG = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 1.6);
  cG.addColorStop(0, `oklch(60% 0.4 25 / ${0.5 + bass * 0.5})`);
  cG.addColorStop(1, "transparent");
  ctx.fillStyle = cG;
  ctx.fillRect(-sw, -sh, sw*2, sh*2); // Fill with light

  // Inner Nuclear Heart
  const hG = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 0.5);
  hG.addColorStop(0, "white");
  hG.addColorStop(0.3, `oklch(90% 0.1 80)`); // Gold glow
  hG.addColorStop(1, "transparent");
  ctx.fillStyle = hG;
  ctx.beginPath(); ctx.arc(0, 0, coreR * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // --- 8. ANAMORPHIC RED FLARE ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = "screen";
  const fW = sw * 1.5;
  const fG = ctx.createLinearGradient(-fW/2, 0, fW/2, 0);
  fG.addColorStop(0, "transparent");
  fG.addColorStop(0.5, `oklch(65% 0.4 25 / ${0.4 + bass * 0.6})`);
  fG.addColorStop(1, "transparent");
  ctx.fillStyle = fG;
  ctx.fillRect(-fW/2, -5, fW, 10);
  ctx.restore();

  // --- 9. BUNKER TARGETING HUD ---
  ctx.save();
  const hudAlpha = 0.6 + bass * 0.4;
  ctx.strokeStyle = `oklch(75% 0.15 80 / ${hudAlpha})`;
  ctx.lineWidth = 2.5;
  const sq = 260 * (1 + bass * 0.6);
  ctx.strokeRect(cx - sq/2, cy - sq/2, sq, sq);
  
  ctx.fillStyle = `oklch(75% 0.15 80 / 0.8)`;
  ctx.font = '900 14px "JetBrains Mono", monospace';
  ctx.fillText("ОБЪЕКТ: ГРАВИТАЦИЯ-B", 120, beamH + 60);
  ctx.restore();

  ctx.restore(); // End Global Breathing

  // --- 10. FINAL POST: CINEMATIC VIGNETTE ---
  const vg = ctx.createRadialGradient(cx, cy, sh * 0.3, cx, cy, sw);
  vg.addColorStop(0, "transparent");
  vg.addColorStop(1, "rgba(0,0,0,0.99)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, sw, sh);
};
