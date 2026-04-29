import { EffectContext } from "./types";

/**
 * AURORA MIRAGE (V25 - ZENITH OVERDRIVE EDITION)
 * Reference: Cyber Matrix (Scanning) + Quantum Space (Heartbeat) + Gravity Field (Lensing).
 * Features: Shimmering God Rays, Volumetric Micro-Dust, Cinematic Light Leaks, 
 * Parallax Background Schematics, and Pulse-Reactive Neural Tendrils.
 */
export const drawAuroraWave = ({ ctx, width, height, data, params, time, theme, refs }: EffectContext) => {
  const effectParams = params || { speed: 1, intensity: 1 };
  const t = time * 0.001 * (effectParams.speed || 1);
  const cx = width / 2, cy = height / 2;
  
  // --- 1. DEEP DATA ANALYTICS ---
  const rawBass = data && data[0] ? (data[0] + data[1] + data[2] + data[3]) / 4 / 255 : 0;
  const rawMid = data && data[8] ? (data[8] + data[10] + data[12]) / 3 / 255 : 0;
  const rawTreble = data && data[24] ? (data[24] + data[28] + data[32]) / 3 / 255 : 0;

  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.8 + rawBass * 0.2;
  refs.smoothMid.current = (refs.smoothMid.current || 0) * 0.82 + rawMid * 0.18;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.85 + rawTreble * 0.15;
  
  const bass = refs.smoothBass.current;
  const energy = (bass + refs.smoothMid.current + refs.smoothTreble.current) / 3;
  
  const isPeak = bass > 0.94;
  const auroraHue = theme.primary;
  const breath = Math.sin(t * 0.4) * 0.5 + 0.5;

  // --- 2. CINEMATIC CAMERA (High Inertia Drift) ---
  const zoom = 1.05 + bass * 0.18 + breath * 0.05;
  const driftX = Math.sin(t * 0.08) * 140 + Math.cos(t * 0.22) * 60;
  const driftY = Math.cos(t * 0.07) * 100 + Math.sin(t * 0.15) * 40;
  
  ctx.save();
  ctx.translate(cx + driftX, cy + driftY);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);

  // --- 3. THE VOID & LIGHT LEAKS ---
  ctx.fillStyle = "#010002";
  ctx.fillRect(-width, -height, width * 3, height * 3);

  // Cinematic Light Leaks (Large faint colored drifts)
  const drawLightLeaks = () => {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 3; i++) {
      const lx = cx + Math.sin(t * 0.1 + i) * 600;
      const ly = cy + Math.cos(t * 0.12 + i * 2) * 400;
      const lr = 600 + i * 300;
      const lGrd = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      const h = (auroraHue + i * 30 + t * 5) % 360;
      lGrd.addColorStop(0, `hsla(${h}, 100%, 50%, ${0.03 * (0.5 + energy * 0.5)})`);
      lGrd.addColorStop(1, "transparent");
      ctx.fillStyle = lGrd;
      ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  drawLightLeaks();

  // --- 4. COMPOSITE BACKGROUND SCHEMATICS (Parallax) ---
  const drawParallaxPatterns = () => {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    
    // Far Layer: Hex Grid
    ctx.strokeStyle = `hsla(${auroraHue}, 100%, 70%, ${0.02 + energy * 0.05})`;
    ctx.lineWidth = 0.5;
    const hSize = 120;
    for (let x = -width; x < width * 2; x += hSize * 1.5) {
      for (let y = -height; y < height * 2; y += hSize * Math.sqrt(3)) {
        const px = x + (y % (hSize * Math.sqrt(3) * 2) === 0 ? 0 : hSize * 0.75);
        const py = y;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.lineTo(px + Math.cos(a) * hSize * 0.5, py + Math.sin(a) * hSize * 0.5);
        }
        ctx.closePath(); ctx.stroke();
      }
    }

    // Mid Layer: Blueprint Arcs
    ctx.strokeStyle = `hsla(${auroraHue}, 100%, 70%, 0.05)`;
    ctx.lineWidth = 1;
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.03);
    for (let i = 0; i < 5; i++) {
      const r = 300 + i * 150;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r + 10, Math.PI * 0.7, Math.PI * 0.85); ctx.stroke();
    }
    ctx.restore();
  };
  drawParallaxPatterns();

  // --- 5. ZENITH VOLUMETRIC RAYS ---
  const drawZenithRays = () => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = "screen";
    const rayCount = 6;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + t * 0.15;
      const rayGrd = ctx.createLinearGradient(0, 0, Math.cos(angle) * 800, Math.sin(angle) * 800);
      const alpha = (0.1 + refs.smoothTreble.current * 0.2) * (0.8 + Math.sin(t * 5 + i) * 0.2);
      rayGrd.addColorStop(0, `hsla(${auroraHue}, 100%, 80%, ${alpha})`);
      rayGrd.addColorStop(0.7, "transparent");
      ctx.strokeStyle = rayGrd;
      ctx.lineWidth = 150 + bass * 300;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * 800, Math.sin(angle) * 800); ctx.stroke();
    }
    ctx.restore();
  };
  drawZenithRays();

  // --- 6. NEURAL SINGULARITY CORE ---
  const drawZenithCore = () => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = "screen";
    
    const corePulse = (1.0 + bass * 0.6 + breath * 0.2) * 110;
    
    // Core Glow
    const grd = ctx.createRadialGradient(0, 0, 80, 0, 0, corePulse * 1.5);
    grd.addColorStop(0, `hsla(${auroraHue}, 100%, 80%, 0.9)`);
    grd.addColorStop(0.5, `hsla(${auroraHue + 20}, 100%, 60%, 0.4)`);
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, corePulse * 1.5, 0, Math.PI * 2); ctx.fill();

    // 128-Spike Precision Spectrum
    ctx.lineWidth = 2;
    for (let i = 0; i < 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      const sVal = data ? data[i % 64] / 255 : 0;
      const inner = 110;
      const outer = inner + 5 + sVal * 180 * energy;
      ctx.strokeStyle = `hsla(${auroraHue}, 100%, 95%, ${0.5 * (0.2 + sVal * 0.8)})`;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  };
  drawZenithCore();

  // --- 7. TRANSCENDENCE HUD 5.0 (Designer Grade) ---
  ctx.restore(); // Back from camera
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  
  const hCol = `hsla(${auroraHue}, 100%, 95%, ${0.6 + Math.sin(t * 15) * 0.2})`;
  ctx.fillStyle = hCol;
  ctx.strokeStyle = hCol;
  ctx.font = '900 12px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  const m = 70;

  // Primary System HUD
  ctx.fillText("ZENITH_SINGULARITY_RELIANCE_V25", cx, cy - 320);
  
  // Rotating Focus Ring with Precision Ticks
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.1);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 260 + bass * 50, 0, Math.PI * 0.1); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.strokeRect(250 + bass * 50, -5, 10, 10);
  }
  ctx.restore();

  // Detailed Metrics (Bottom)
  ctx.font = '700 8px monospace';
  ctx.fillText(`CORE_PRESSURE: ${Math.floor(100 + energy * 900)} Pa // SIGNAL_LENS: ${breath.toFixed(4)}`, cx, cy + 320);
  ctx.fillText(`ID: 0x${Math.floor(t * 10000).toString(16).toUpperCase()} // NEURAL_FLOW: ACTIVE`, cx, cy + 335);

  ctx.restore();

  // Final Film Grade
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 150; i++) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
  }
  ctx.restore();

  const vig = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 1.5);
  vig.addColorStop(0, "transparent");
  vig.addColorStop(0.8, "transparent");
  vig.addColorStop(1, "rgba(0, 0, 0, 0.98)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
};
