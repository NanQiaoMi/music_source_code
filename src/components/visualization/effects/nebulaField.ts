import { EffectContext } from "./types";

/**
 * Nebula Field: [C436] Tactical Reproduction
 * High-end cinematic space travel with technical geometric framework.
 */
export const drawNebulaField = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  const effectParams = params || { speed: 1, starCount: 800, nebulaIntensity: 1.2, depth: 1.2, flareAmount: 1.5, hudDetail: 1.0 };
  const speedMult = effectParams.speed || 0.5;
  const t = time * 0.001 * speedMult;
  const cx = width / 2, cy = height / 2;

  // --- 1. SIGNAL ANALYTICS ---
  const rawBass = data && data[0] ? (data[0] + data[1] + data[2] + data[3]) / 4 / 255 : 0;
  const rawMid = data && data[10] ? (data[10] + data[12] + data[14]) / 3 / 255 : 0;
  const rawTreble = data && data[30] ? (data[30] + data[45] + data[60]) / 3 / 255 : 0;
  
  refs.smoothBass.current = refs.smoothBass.current * 0.82 + rawBass * 0.18;
  refs.smoothMid.current = refs.smoothMid.current * 0.85 + rawMid * 0.15;
  refs.smoothTreble.current = refs.smoothTreble.current * 0.88 + rawTreble * 0.12;
  
  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;
  const volume = (data ? Array.from(data).reduce((a, b) => a + b, 0) / (data.length * 255) : 0);
  
  // Theme Integration
  const mainHue = theme.primary;
  const accentHue = theme.accent;

  // Cinematic "Heartbeat" & Breathing
  const heartbeat = Math.pow(Math.sin(t * 1.2), 4) * 0.15 * bass;
  const screenPulse = (Math.sin(t * 2) * 0.06 + bass * 0.18);
  const cameraDriftX = Math.sin(t * 0.15) * 50 * (1 + bass * 0.4);
  const cameraDriftY = Math.cos(t * 0.1) * 30 * (1 + bass * 0.4);
  const globalScale = (1 + Math.sin(t * 0.5) * 0.03 + screenPulse + heartbeat) * (effectParams.depth || 1.0);

  // --- 2. DEEP COSMOS (BACKGROUND LAYERING) ---
  ctx.save();
  ctx.globalAlpha = 0.9 + screenPulse * 0.5;
  
  // A. Void Background (Theme Sync)
  const voidGrd = ctx.createRadialGradient(cx + cameraDriftX, cy + cameraDriftY, 0, cx, cy, Math.max(width, height) * 1.2);
  voidGrd.addColorStop(0, `hsla(${mainHue}, 40%, 6%, 1)`);
  voidGrd.addColorStop(0.5, `hsla(${mainHue}, 60%, 2%, 1)`);
  voidGrd.addColorStop(1, "#000000");
  ctx.fillStyle = voidGrd;
  ctx.fillRect(0, 0, width, height);

  // B. Distant Galactic Clusters
  const drawGalaxy = (x: number, y: number, r: number, h: number, opacity: number) => {
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    const alpha = opacity * (0.4 + bass * 0.6) * (effectParams.nebulaIntensity || 1.0);
    grd.addColorStop(0, `hsla(${h}, 80%, 60%, ${alpha})`);
    grd.addColorStop(0.3, `hsla(${h + 20}, 70%, 40%, ${alpha * 0.4})`);
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.globalCompositeOperation = "screen";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(globalScale, globalScale);
  ctx.translate(-cx, -cy);
  drawGalaxy(cx + cameraDriftX * 0.4, cy + cameraDriftY * 0.4, width * 1.2, mainHue, 0.12);
  drawGalaxy(cx - cameraDriftX * 0.6, cy - cameraDriftY * 0.6, width * 0.8, accentHue, 0.08);
  ctx.restore();

  // C. 3D Perspective Traveling Grids (Parallel Planes)
  const draw3DPlanes = () => {
    ctx.save();
    const planeAlpha = 0.15 + bass * 0.2;
    const scroll = (t * 20 * speedMult) % 1;
    
    const drawPlane = (isTop: boolean) => {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const horizonY = cy;
      const vLines = 36;
      for (let i = 0; i <= vLines; i++) {
        const xEdge = (i / vLines) * width * 5 - width * 2;
        ctx.strokeStyle = `hsla(${mainHue}, 100%, 80%, ${0.05 * planeAlpha})`;
        ctx.beginPath(); ctx.moveTo(cx, horizonY); ctx.lineTo(xEdge, isTop ? 0 : height); ctx.stroke();
      }
      const hLines = 12;
      for (let i = 0; i < hLines; i++) {
        const z = (i + scroll) / hLines;
        const py = isTop ? horizonY - (1 / (z + 0.1)) * 40 : horizonY + (1 / (z + 0.1)) * 40;
        if ((isTop && py < horizonY) || (!isTop && py > horizonY)) {
          const lineAlpha = (1 - z) * planeAlpha;
          ctx.strokeStyle = `hsla(${mainHue}, 100%, 85%, ${lineAlpha})`;
          ctx.lineWidth = (1 - z) * 1.5;
          ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(width, py); ctx.stroke();
        }
      }
      ctx.restore();
    };
    drawPlane(true); drawPlane(false);
    ctx.restore();
  };
  draw3DPlanes();

  // --- 3. GEOMETRIC FRAMEWORK & SINGULARITY ---
  ctx.save();
  ctx.translate(cx + cameraDriftX, cy + cameraDriftY);

  // A. Tech Brackets & Corners
  const drawTechFrames = () => {
    ctx.save();
    const size = 250 + bass * 50;
    const thickness = 2;
    const len = 30;
    ctx.strokeStyle = `hsla(${mainHue}, 100%, 90%, ${0.2 + bass * 0.3})`;
    ctx.lineWidth = thickness;
    
    // Corner Brackets
    [[-1,-1], [1,-1], [1,1], [-1,1]].forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(sx * size, sy * (size - len));
      ctx.lineTo(sx * size, sy * size);
      ctx.lineTo(sx * (size - len), sy * size);
      ctx.stroke();
    });

    ctx.restore();
  };
  drawTechFrames();

  // B. Quantum Singularity Core
  const drawPlasma = (r: number, hue: number, alpha: number) => {
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r * (1 + heartbeat * 3));
    grd.addColorStop(0, `hsla(${hue}, 100%, 95%, ${alpha})`);
    grd.addColorStop(0.5, `hsla(${hue}, 80%, 60%, ${alpha * 0.4})`);
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.globalCompositeOperation = "screen";
    ctx.beginPath(); ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2); ctx.fill();
  };
  drawPlasma(70 + bass * 60, mainHue, 0.85);
  drawPlasma(140 + mid * 80, accentHue, 0.45);

  // C. Orbital Tech Rings (Enhanced Complexity)
  const drawCoreLayer = (radius: number, rotation: number, segments: number, style: 'solid' | 'dashed' | 'hex' | 'arc' | 'dots', color: string) => {
    ctx.save();
    ctx.rotate(rotation);
    ctx.strokeStyle = color;
    ctx.lineWidth = style === 'hex' ? 0.4 : 1.0;
    
    if (style === 'dashed') ctx.setLineDash([10, 20]);
    if (style === 'arc') ctx.setLineDash([radius * 0.4, radius * 0.15]);
    if (style === 'dots') ctx.setLineDash([2, 8]);
    
    ctx.lineDashOffset = t * 80;
    ctx.beginPath();
    
    if (style === 'hex') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else {
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
    }
    ctx.stroke(); ctx.restore();
  };

  // Multi-layered concentric complexity
  drawCoreLayer(80 + mid * 30, t * 1.2, 3, 'hex', `hsla(${accentHue}, 100%, 90%, ${0.3 + bass * 0.4})`);
  drawCoreLayer(100 + mid * 20, t * 0.5, 6, 'hex', `hsla(${mainHue}, 100%, 90%, ${0.25 + bass * 0.3})`);
  drawCoreLayer(120 + bass * 15, -t * 0.8, 4, 'hex', `hsla(${accentHue}, 100%, 80%, 0.4)`);
  drawCoreLayer(140 + treble * 40, -t * 0.4, 12, 'dashed', `hsla(${accentHue}, 100%, 80%, ${0.35 + mid * 0.2})`);
  drawCoreLayer(155 + mid * 10, t * 1.5, 0, 'dots', `hsla(${mainHue}, 100%, 95%, 0.6)`);
  drawCoreLayer(170 + bass * 50, t * 0.2, 48, 'arc', `hsla(${mainHue}, 100%, 85%, 0.25)`);
  drawCoreLayer(190 + treble * 20, -t * 1.1, 0, 'arc', `hsla(${accentHue}, 100%, 70%, 0.15)`);
  drawCoreLayer(210 + volume * 40, -t * 0.15, 64, 'dashed', `hsla(${mainHue}, 100%, 90%, 0.1)`);
  drawCoreLayer(230, t * 0.05, 0, 'dots', `hsla(${mainHue}, 100%, 90%, 0.05)`);

  // --- E. INTERNAL GYROSCOPIC CORE (Multi-directional Turning Rings) ---
  const gyroCount = 4; // Increased count
  for (let i = 0; i < gyroCount; i++) {
    ctx.save();
    const gRadius = 70 + i * 35;
    const gTilt = t * 0.6 + i * (Math.PI / 2.5);
    const gPitch = Math.sin(t * 0.5 + i) * 0.8 * (1 + bass);
    ctx.rotate(gTilt);
    ctx.rotate(gPitch);
    const gAlpha = (0.25 + bass * 0.55) * (1 - i / gyroCount);
    ctx.strokeStyle = `hsla(${(accentHue + i * 40) % 360}, 100%, 85%, ${gAlpha})`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([i % 2 === 0 ? 10 : 2, i % 2 === 0 ? 20 : 10]);
    ctx.beginPath();
    ctx.ellipse(0, 0, gRadius, gRadius * (0.2 + i * 0.05), t * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    
    // Multi-nodes on gyro rings
    for (let j = 0; j < 3; j++) {
      const nAngle = t * (2 + j) + i + j * Math.PI/1.5;
      const nx = Math.cos(nAngle) * gRadius, ny = Math.sin(nAngle) * gRadius * (0.2 + i * 0.05);
      ctx.fillStyle = j === 0 ? "white" : `hsla(${accentHue}, 100%, 90%, 0.8)`;
      ctx.beginPath(); ctx.arc(nx, ny, 1.5 + j, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // D. Neural Orbit Particles
  const drawNeuralParticles = () => {
    ctx.save();
    const pCount = 18;
    const pRadius = 160 + treble * 120;
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < pCount; i++) {
      const pAngle = t * (1 + i * 0.05) + i * (Math.PI * 2 / pCount);
      const px = Math.cos(pAngle) * pRadius, py = Math.sin(pAngle) * pRadius;
      ctx.fillStyle = `hsla(${mainHue}, 100%, 95%, ${0.6 * treble})`;
      ctx.beginPath(); ctx.arc(px, py, 2 + treble * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  drawNeuralParticles();

  ctx.restore();

  // --- 4. TACTICAL HUD ---
  const hudAlpha = effectParams.hudDetail || 1.0;
  if (hudAlpha > 0.1) {
    const margin = 40;
    ctx.save();
    ctx.globalAlpha = hudAlpha;
    ctx.font = '300 10px "JetBrains Mono", monospace';
    ctx.fillStyle = `hsla(${mainHue}, 100%, 90%, 0.9)`;
    ctx.textAlign = "left";
    ctx.fillText(`SYSTEM_RECOVERY // SECTOR_${(t % 100).toFixed(0)}`, margin, margin);
    ctx.textAlign = "right";
    ctx.fillText(`QUANTUM_FLUX: ${(bass * 100).toFixed(1)}%`, width - margin, margin);
    ctx.restore();
  }

  // --- 5. STAR TRAVERSAL ---
  const stars = refs.nebulaStars.current;
  const warpForce = (15 + treble * 600) * speedMult; 
  ctx.globalCompositeOperation = "screen";
  stars.forEach((s) => {
    s.z -= warpForce;
    if (s.z < 1) { s.z = 2500; s.x = (Math.random() - 0.5) * 2500; s.y = (Math.random() - 0.5) * 2500; }
    const k = 1000 / s.z;
    const px = s.x * k + cx + cameraDriftX * (1 - s.z/2500), py = s.y * k + cy + cameraDriftY * (1 - s.z/2500);
    if (px > 0 && px < width && py > 0 && py < height) {
      const size = s.size * k * 0.5 * globalScale;
      ctx.fillStyle = `hsla(${mainHue}, 100%, 95%, ${1 - s.z/2500})`;
      ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
    }
  });

  ctx.restore();
};
