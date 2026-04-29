import { EffectContext } from "./types";

/**
 * Nebula Field: [C436] Tactical Reproduction
 * Pixel-perfect recreation of the provided sci-fi industrial aesthetic.
 */
export const drawNebulaField = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  const effectParams = params || { speed: 1, starCount: 500, nebulaIntensity: 1.2, depth: 1.5 };
  const t = time * 0.001 * (effectParams.speed || 1);
  const cx = width / 2, cy = height / 2;

  // --- 1. QUANTUM ANALYTICS ---
  const rawBass = data && data[0] ? (data[0] + data[1] + data[2] + data[3]) / 4 / 255 : 0;
  const rawMid = data && data[12] ? (data[12] + data[14] + data[16]) / 3 / 255 : 0;
  
  refs.smoothBass.current = refs.smoothBass.current * 0.82 + rawBass * 0.18;
  refs.smoothMid.current = refs.smoothMid.current * 0.85 + rawMid * 0.15;
  
  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const isPeak = bass > 0.82;
  const breath = Math.sin(t * 1.5) * 0.05; 
  const pulseVal = 0.5 + Math.sin(t * 2) * 0.1 + bass * 0.4;

  // --- 2. THE TACTICAL VOID ---
  ctx.save();
  ctx.fillStyle = "#020a1a"; // Exact deep navy from reference
  ctx.fillRect(0, 0, width, height);
  
  // Subtle Background Grid
  ctx.strokeStyle = "rgba(0, 80, 200, 0.08)";
  ctx.lineWidth = 1;
  const gridSize = 80;
  ctx.beginPath();
  for (let x = 0; x < width; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let y = 0; y < height; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();

  // --- 3. RADIAL GOD RAYS (CENTRAL ENGINE) ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.03); // Slow rotation for the rays
  const rayCount = 28;
  const innerRadius = 40, outerRadius = Math.max(width, height) * 1.2;
  
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const grd = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, outerRadius);
    const alphaBase = i % 3 === 0 ? 0.12 : 0.04;
    const alpha = alphaBase * (0.8 + bass * 0.5);
    grd.addColorStop(0, `rgba(0, 120, 255, ${alpha})`);
    grd.addColorStop(1, "transparent");
    
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, outerRadius, angle - 0.06, angle + 0.06);
    ctx.lineTo(0, 0);
    ctx.fill();
  }
  ctx.restore();

  // --- 4. GEOMETRIC CORE & LENS GHOSTS ---
  ctx.save();
  ctx.translate(cx, cy);
  
  // Hexagonal Outer Shield
  ctx.strokeStyle = `rgba(140, 240, 255, ${0.1 + mid * 0.2})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const r = 110 + Math.sin(t * 2) * 3;
    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath(); ctx.stroke();

  // Circular Inner Cores (Nested)
  ctx.strokeStyle = `rgba(100, 220, 255, ${0.05 + bass * 0.1})`;
  for (let r = 70; r <= 90; r += 10) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  }

  // Tactical Lens Ghost (Purple Tint as seen in ref)
  const ghostX = Math.sin(t * 0.8) * 15, ghostY = 120 + Math.cos(t * 0.8) * 15;
  const gGrd = ctx.createRadialGradient(ghostX, ghostY, 0, ghostX, ghostY, 70);
  gGrd.addColorStop(0, `rgba(180, 100, 255, ${0.08 + bass * 0.08})`);
  gGrd.addColorStop(1, "transparent");
  ctx.fillStyle = gGrd;
  ctx.beginPath(); ctx.arc(ghostX, ghostY, 70, 0, Math.PI * 2); ctx.fill();
  
  ctx.restore();

  // --- 5. DATA HUD REPRODUCTION ---
  const margin = 60;
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.fillStyle = "rgba(180, 240, 255, 0.85)";
  
  // Top Left: SEQ: [C436]
  ctx.textAlign = "left";
  ctx.fillText("SEQ: [C436]", margin, margin);
  ctx.strokeStyle = "rgba(180, 240, 255, 0.3)";
  ctx.strokeRect(margin, margin + 12, 120, 3);
  ctx.fillRect(margin, margin + 12, (t % 15) * 8, 3); // Dynamic progress bar

  // Top Right: TELEMETRY
  ctx.textAlign = "right";
  ctx.fillText("TELEMETRY", width - margin, margin);
  ctx.font = '500 9px "JetBrains Mono", monospace';
  ctx.fillStyle = "rgba(180, 240, 255, 0.6)";
  const relX = 150.782 + Math.sin(t) * 0.05;
  const relY = 226.282 + Math.cos(t) * 0.05;
  ctx.fillText(`REL_X: ${relX.toFixed(3)}`, width - margin, margin + 18);
  ctx.fillText(`REL_Y: ${relY.toFixed(3)}`, width - margin, margin + 30);
  ctx.fillText(`PULSE: ${(pulseVal * 100).toFixed(1)}%`, width - margin, margin + 42);

  // Scattered Memory Addresses
  const hexMarkers = ["0x8C11", "0xEF56", "0xB031", "0x037C"];
  ctx.textAlign = "center";
  hexMarkers.forEach((m, i) => {
    const x = cx + Math.sin(t * 0.15 + i * 2) * (width * 0.35);
    const y = cy + Math.cos(t * 0.2 + i * 1.5) * (height * 0.25);
    ctx.fillStyle = `rgba(180, 240, 255, ${0.1 + Math.sin(t + i) * 0.05})`;
    ctx.fillText(m, x, y);
  });

  // Corner Accents (L-Brackets)
  ctx.strokeStyle = "rgba(180, 240, 255, 0.5)";
  ctx.lineWidth = 1.5;
  const bSize = 35;
  // Bottom Left
  ctx.beginPath(); ctx.moveTo(margin, height - margin - bSize); ctx.lineTo(margin, height - margin); ctx.lineTo(margin + bSize, height - margin); ctx.stroke();
  // Bottom Right
  ctx.beginPath(); ctx.moveTo(width - margin - bSize, height - margin); ctx.lineTo(width - margin, height - margin); ctx.lineTo(width - margin, height - margin - bSize); ctx.stroke();

  // --- 6. PARTICLE TRAVERSAL (SUBTLE) ---
  const stars = refs.nebulaStars.current;
  const warpForce = 25 + bass * 250;
  stars.forEach((s) => {
    s.z -= warpForce;
    if (s.z < 1) s.z = 2500;
    const k = 1000 / s.z;
    const px = s.x * k + cx, py = s.y * k + cy;
    const alpha = (1 - s.z / 2500) * 0.4;
    ctx.fillStyle = `rgba(160, 230, 255, ${alpha})`;
    ctx.beginPath(); ctx.arc(px, py, s.size * k * 0.5, 0, Math.PI * 2); ctx.fill();
  });

  ctx.restore();
};














