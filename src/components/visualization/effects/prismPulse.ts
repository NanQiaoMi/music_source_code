import { EffectContext } from "./types";

export function drawPrismPulse({ ctx, width, height, data, time, params, theme, refs }: EffectContext) {
  const complexity = params.complexity || 6;
  const refraction = params.refraction || 1.0;
  const drift = params.drift || 0.5;
  const speed = params.speed || 1.0;

  // --- 1. SIGNAL PROCESSING ---
  const rawBass = data && data[0] ? (data[0] + data[2]) / 2 / 255 : 0;
  const rawMid = data && data[Math.floor(data.length / 2)] ? data[Math.floor(data.length / 2)] / 255 : 0;
  const rawTreble = data && data[data.length - 1] ? data[data.length - 1] / 255 : 0;

  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.82 + rawBass * 0.18;
  refs.smoothMid.current = (refs.smoothMid.current || 0) * 0.85 + rawMid * 0.15;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.88 + rawTreble * 0.12;

  const bass = refs.smoothBass.current;
  const mid = refs.smoothMid.current;
  const treble = refs.smoothTreble.current;

  // --- 2. THE BREATHING & CAMERA ---
  const t = time * 0.001 * speed;
  const driftX = Math.sin(t * 0.3) * 50;
  const driftY = Math.cos(t * 0.2) * 30;
  const zoom = 1.0 + bass * 0.15 + Math.sin(t * 0.5) * 0.05;
  const centerX = width / 2;
  const centerY = height / 2;

  // Background
  ctx.clearRect(0, 0, width, height);
  const bgHue = (theme.primary + bass * 40) % 360;
  const bgGrd = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width);
  bgGrd.addColorStop(0, `hsla(${bgHue}, 50%, 6%, 1)`);
  bgGrd.addColorStop(1, `#000`);
  ctx.fillStyle = bgGrd;
  ctx.fillRect(0, 0, width, height);

  // Background Data Rain (Technical Depth - Reference Gravitational Field)
  ctx.save();
  ctx.strokeStyle = `hsla(${theme.primary}, 100%, 70%, ${0.08 * mid})`;
  ctx.lineWidth = 0.5;
  if (!refs.particles.current.length) {
    refs.particles.current = Array.from({ length: 50 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 1 + Math.random() * 3,
      len: 10 + Math.random() * 20
    }));
  }
  ctx.restore();

  // --- 2.5 AURORA-STYLE SCATTERED BEAMS (REFINED) ---
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.globalCompositeOperation = "screen";
  const beamCount = 48; // High density as requested
  const beamLen = Math.max(width, height) * 1.8;
  const energy = (bass + mid + treble) / 3;
  
  for (let i = 0; i < beamCount; i++) {
    const angle = (i / beamCount) * Math.PI * 2 + t * 0.05;
    const bGrd = ctx.createRadialGradient(0, 0, 60, 0, 0, beamLen);
    const bAlpha = (0.04 + energy * 0.35) * (Math.sin(t * 1.2 + i) * 0.5 + 0.5);
    const bWidth = 0.012 + energy * 0.04; // Thin radial sectors
    
    bGrd.addColorStop(0, `hsla(${theme.primary}, 100%, 80%, ${bAlpha})`);
    bGrd.addColorStop(0.3, `hsla(${theme.primary}, 100%, 60%, ${bAlpha * 0.3})`);
    bGrd.addColorStop(1, "transparent");
    
    ctx.fillStyle = bGrd;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, beamLen, angle - bWidth, angle + bWidth);
    ctx.fill();
  }
  ctx.restore();

  // --- 3. QUANTUM PERSPECTIVE GRID ---
  const drawGrid = () => {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const spacing = 120;
    const scroll = (t * 200) % spacing;
    ctx.beginPath();
    ctx.strokeStyle = `hsla(${theme.primary}, 100%, 75%, ${0.03 + bass * 0.1})`;
    ctx.lineWidth = 1;
    for (let x = -width; x < width * 2; x += spacing) {
      ctx.moveTo(centerX, height * 0.45);
      ctx.lineTo(x + driftX * 0.4, height);
    }
    for (let y = 0; y < 10; y++) {
      const d = Math.pow(y / 10, 2.5);
      const py = height * 0.45 + d * height * 0.55 + scroll * (y / 10);
      ctx.moveTo(0, py); ctx.lineTo(width, py);
    }
    ctx.stroke();
    ctx.restore();
  };
  drawGrid();

  ctx.save();
  ctx.translate(centerX + driftX, centerY + driftY);
  ctx.scale(zoom, zoom);
  if (bass > 0.85) ctx.translate(Math.random() * 4 - 2, 0);
  ctx.rotate(time * 0.00018 * speed);

  // Center Crosshair
  ctx.save();
  ctx.strokeStyle = `hsla(${theme.primary}, 100%, 80%, 0.1)`;
  ctx.beginPath();
  ctx.moveTo(-20, 0); ctx.lineTo(20, 0);
  ctx.moveTo(0, -20); ctx.lineTo(0, 20);
  ctx.stroke();
  ctx.restore();

  // --- 4. THE INTERLEAVED TECH PRISM (REFINED) ---
  const drawTechShape = (radius: number, sides: number, rot: number, hue: number, alpha: number, style: 'solid' | 'dashed' | 'ghost') => {
    ctx.save();
    ctx.rotate(rot);
    
    if (style === 'dashed') ctx.setLineDash([10, 15]);
    if (style === 'ghost') {
      ctx.setLineDash([2, 20]);
      ctx.globalAlpha = alpha * 0.3;
    }
    
    ctx.beginPath();
    const vertices = [];
    for (let j = 0; j < sides; j++) {
      const pAngle = (j / sides) * Math.PI * 2 + Math.sin(t * 0.4) * drift;
      const jitter = Math.sin(t * 12 + j) * treble * 10;
      const x = Math.cos(pAngle) * (radius + jitter);
      const y = Math.sin(pAngle) * (radius + jitter);
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      vertices.push({x, y});
    }
    ctx.closePath();
    
    ctx.strokeStyle = `hsla(${hue}, 100%, 85%, ${alpha})`;
    ctx.lineWidth = style === 'solid' ? (0.8 + bass * 1.5) : 0.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // Vertex Nodes (Detailed Schematics)
    if (style === 'solid') {
      vertices.forEach((v, idx) => {
        ctx.fillStyle = `hsla(${hue}, 100%, 95%, ${alpha})`;
        ctx.beginPath(); ctx.arc(v.x, v.y, 1.2, 0, Math.PI * 2); ctx.fill();
        
        // Bitstream Connectors (Center to Vertex)
        ctx.save();
        ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${alpha * 0.15})`;
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(v.x, v.y); ctx.stroke();
        ctx.restore();

        // Expanded Telemetry Labels
        if (alpha > 0.5) {
          ctx.font = "800 6px 'JetBrains Mono', monospace";
          ctx.fillStyle = `hsla(${hue}, 100%, 90%, ${alpha * 0.5})`;
          ctx.fillText(`FLUX:${(radius * bass).toFixed(1)}`, v.x + 8, v.y - 4);
          ctx.fillText(`POS_Z:${(v.x + v.y).toFixed(0)}`, v.x + 8, v.y + 4);
          ctx.fillText(`TRK_ID:${(idx + 100)}`, v.x + 8, v.y + 12);
        }
      });
    }
    ctx.restore();
  };

  // --- 4.5 THE MYSTERIOUS TECH CORE (HUD INTEGRATED) ---
  const coreR = 45 + bass * 70;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  
  // Floating Orbiting Text Labels (New)
  const labelCount = 4;
  for (let i = 0; i < labelCount; i++) {
    const lAngle = t * 0.4 + i * (Math.PI * 2 / labelCount);
    const lRadius = coreR * 1.8;
    const lx = Math.cos(lAngle) * lRadius, ly = Math.sin(lAngle) * lRadius;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(lAngle + Math.PI/2);
    ctx.font = "bold 7px monospace";
    ctx.fillStyle = `hsla(${theme.primary}, 100%, 80%, ${0.3 * bass})`;
    ctx.fillText(`[SECTOR_CORE_0${i}]`, 0, 0);
    ctx.restore();
  }
  const coreGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2.5);
  coreGrd.addColorStop(0, `hsla(${(theme.primary + 10) % 360}, 100%, 98%, 0.9)`);
  coreGrd.addColorStop(0.3, `hsla(${theme.primary}, 100%, 60%, 0.35)`);
  coreGrd.addColorStop(1, "transparent");
  ctx.fillStyle = coreGrd;
  ctx.beginPath(); ctx.arc(0, 0, coreR * 2.5, 0, Math.PI * 2); ctx.fill();

  // B. Counter-Rotating Tech Components (Subtle Variation)
  for (let i = 0; i < 4; i++) {
    const sR = 25 + i * 18 + mid * 15;
    const sRot = t * (i % 2 === 0 ? 1.8 : -1.4) + i;
    ctx.save();
    ctx.rotate(sRot);
    // Variation is small (±15 degrees)
    const sHue = (theme.primary + (i % 2 === 0 ? 15 : -15) + 360) % 360;
    ctx.strokeStyle = `hsla(${sHue}, 100%, 85%, 0.45)`;
    ctx.lineWidth = 0.5;
    if (i % 2 === 0) {
      ctx.strokeRect(-sR/2, -sR/2, sR, sR);
    } else {
      ctx.beginPath();
      for(let j=0; j<3; j++) {
        const a = (j/3)*Math.PI*2;
        const x = Math.cos(a)*sR, y = Math.sin(a)*sR;
        if(j===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
  
  // C. Scanning Tech Arcs (Theme Primary)
  for (let i = 0; i < 2; i++) {
    const sRadius = coreR * (1.2 + i * 0.4);
    ctx.save();
    ctx.rotate(-t * (0.5 + i * 0.2));
    ctx.strokeStyle = `hsla(${theme.primary}, 100%, 80%, 0.25)`;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([sRadius * 0.5, sRadius * 1.5]);
    ctx.beginPath(); ctx.arc(0, 0, sRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  
  // D. Data Horizontal Flare
  const flareAlpha = bass * 0.5;
  const fGrd = ctx.createLinearGradient(-width/2, 0, width/2, 0);
  fGrd.addColorStop(0, "transparent");
  fGrd.addColorStop(0.5, `hsla(${theme.primary}, 100%, 98%, ${flareAlpha})`);
  fGrd.addColorStop(1, "transparent");
  ctx.fillStyle = fGrd;
  ctx.fillRect(-width/2, -0.5, width, 1);
  ctx.restore();

  // --- 5. THE INTERLEAVED SHELLS ---
  for (let i = 0; i < complexity; i++) {
    const angle = (i / complexity) * Math.PI * 2;
    const baseRadius = 160 + bass * 140 + Math.sin(t * 1.5 + i) * 35;
    // SUBTLE Color Variation (±25 degrees from primary)
    const hueOffset = Math.sin(t * 0.2 + i) * 25;
    const hue = (theme.primary + hueOffset + 360) % 360;
    
    ctx.save();
    ctx.rotate(angle);

    // Layering Interleaved Shapes (Real & Virtual)
    const layers = [
      { r: 1.0, rot: 0.3, style: 'solid' },
      { r: 0.8, rot: -0.5, style: 'dashed' },
      { r: 0.6, rot: 0.8, style: 'ghost' }
    ];

    layers.forEach((layer, lIdx) => {
      const r = baseRadius * layer.r;
      const rot = t * layer.rot * (1 + lIdx * 0.2) + (i * 0.5);
      // Subtle variations in luminosity based on layer
      drawTechShape(r, 3, rot, hue, (0.45 + mid * 0.45) / (lIdx + 1), layer.style as any);
      
      if (lIdx === 0) {
        ctx.save(); ctx.rotate(rot); ctx.beginPath();
        for (let j = 0; j < 3; j++) {
          const x = Math.cos((j / 3) * Math.PI * 2) * r;
          const y = Math.sin((j / 3) * Math.PI * 2) * r;
          if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const glassGrd = ctx.createLinearGradient(-r, -r, r, r);
        glassGrd.addColorStop(0, `hsla(${hue}, 100%, 75%, ${0.05 * mid})`);
        glassGrd.addColorStop(1, "transparent");
        ctx.fillStyle = glassGrd; ctx.fill(); ctx.restore();
      }
    });

    // MULTI-AXIAL 3D TILTED RINGS (Subtle Sync)
    for (let rIdx = 0; rIdx < 2; rIdx++) {
      const ringR = baseRadius * (1.35 + rIdx * 0.35 + mid * 0.25);
      ctx.save();
      ctx.rotate(t * (0.25 + rIdx * 0.15) * (rIdx % 2 === 0 ? 1 : -1));
      ctx.scale(1, 0.25 + Math.sin(t * 0.6 + rIdx) * 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      const ringHue = (theme.primary + (rIdx === 0 ? 10 : -10) + 360) % 360;
      ctx.strokeStyle = `hsla(${ringHue}, 100%, 85%, ${0.08 * mid})`;
      ctx.lineWidth = 0.5;
      ctx.setLineDash(rIdx === 0 ? [5, 20] : [2, 10]);
      ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }

  ctx.restore();

  // Cinematic Post-Processing
  const flareInt = (bass * 0.5 + treble * 0.5) * mid;
  if (flareInt > 0.1) {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const fGrd = ctx.createLinearGradient(0, centerY, width, centerY);
    fGrd.addColorStop(0.4, "transparent"); fGrd.addColorStop(0.5, `hsla(${theme.primary}, 100%, 95%, ${flareInt})`);
    fGrd.addColorStop(0.6, "transparent"); ctx.fillStyle = fGrd; ctx.fillRect(0, centerY - 2, width, 4); ctx.restore();
  }
  // Final Vignette
  const vig = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width * 0.9);
  vig.addColorStop(0.6, "transparent"); vig.addColorStop(1, `rgba(0, 0, 0, ${0.9 + bass * 0.05})`);
  ctx.fillStyle = vig; ctx.fillRect(0, 0, width, height);

  // --- 6. TECHNICAL HUD OVERLAY (NEW) ---
  ctx.save();
  const margin = 50;
  ctx.fillStyle = `hsla(${theme.primary}, 100%, 85%, 0.9)`;
  ctx.font = "900 12px 'JetBrains Mono', monospace";
  
  // Top Left: System Status
  ctx.textAlign = "left";
  ctx.fillText("QUANTUM_PRISM_V.2 // ACTIVE", margin, margin);
  ctx.font = "800 8px monospace";
  ctx.fillText(`SYS_TIME: ${time.toFixed(0)}MS`, margin, margin + 15);
  ctx.fillText(`GEOM_COMPLEXITY: ${complexity}`, margin, margin + 25);
  
  // Top Right: Freq Analysis
  ctx.textAlign = "right";
  ctx.font = "900 10px 'JetBrains Mono', monospace";
  ctx.fillText(`[ BASS: ${(bass * 100).toFixed(1)}% ]`, width - margin, margin);
  ctx.fillText(`[ MID: ${(mid * 100).toFixed(1)}% ]`, width - margin, margin + 15);
  ctx.fillText(`[ TREBLE: ${(treble * 100).toFixed(1)}% ]`, width - margin, margin + 30);

  // Bottom Left: Coordinates
  ctx.textAlign = "left";
  ctx.fillText(`COORD_X: ${driftX.toFixed(2)}`, margin, height - margin);
  ctx.fillText(`COORD_Y: ${driftY.toFixed(2)}`, margin, height - margin + 12);
  
  // Bottom Right: Bitstream status
  ctx.textAlign = "right";
  ctx.fillText(`SECTOR_SYNC: ENABLED`, width - margin, height - margin);
  ctx.fillText(`DATA_FLUX: ${(energy * 1024).toFixed(0)}KB/S`, width - margin, height - margin + 12);
  
  ctx.restore();

  ctx.fillStyle = "rgba(255, 255, 255, 0.012)";
  for (let i = 0; i < height; i += 4) ctx.fillRect(0, i, width, 1);
}







