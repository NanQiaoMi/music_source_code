import { EffectContext } from "./types";

export const drawCyberMatrix = ({ ctx, width, height, data, params, time, refs, theme }: EffectContext) => {
  const effectParams = params || { speed: 1, density: 1 };
  const t = time * 0.001 * (effectParams.speed || 1);
  const cx = width / 2, cy = height / 2;

  // --- 1. SIGNAL PROCESSING ---
  const rawBass = data && data[0] ? (data[0] + data[1] + data[2] + data[3]) / 4 / 255 : 0;
  const rawTreble = data && data[24] ? (data[24] + data[28] + data[32]) / 3 / 255 : 0;
  
  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.85 + rawBass * 0.15;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.88 + rawTreble * 0.12;
  const bass = refs.smoothBass.current;
  const treble = refs.smoothTreble.current;
  const isPeak = bass > 0.88;

  // --- 2. THE BREATHING UNIVERSE ---
  const breathe = Math.sin(t * 0.4);
  const driftX = Math.sin(t * 0.12) * 100 + breathe * 30;
  const driftY = Math.cos(t * 0.1) * 60 + breathe * 15;
  const globalScale = 1.0 + breathe * 0.04 + bass * 0.15;

  // --- 3. ATMOSPHERIC BASE ---
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(0, 3, 12, ${0.22 - bass * 0.08})`; 
  ctx.fillRect(0, 0, width, height);

  const matrixHue = theme.primary;
  const secondaryHue = theme.secondary;

  // Depth Mist
  ctx.globalCompositeOperation = "screen";
  const mist = ctx.createRadialGradient(cx + driftX, cy + driftY, 0, cx + driftX, cy + driftY, width * 1.4);
  mist.addColorStop(0, `hsla(${matrixHue}, 100%, 10%, ${0.1 + bass * 0.2})`);
  mist.addColorStop(1, "transparent");
  ctx.fillStyle = mist;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(cx + driftX, cy + driftY);
  ctx.scale(globalScale, globalScale);
  ctx.translate(-cx, -cy);

  // --- 4. 3D SPATIAL GRIDS ---
  const drawGrid = (dir: number) => {
    const spacing = 160;
    const scroll = (t * 240 + Math.sin(t * 0.5) * 60) % spacing;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const d = Math.pow(i / 12, 3.2);
      const y = cy + dir * (d * height + scroll * (i / 12));
      ctx.moveTo(0, y); ctx.lineTo(width, y);
    }
    ctx.strokeStyle = `hsla(${matrixHue}, 100%, 75%, ${0.03 + bass * 0.3})`;
    ctx.stroke();
    
    ctx.beginPath();
    for (let x = -width; x < width * 2; x += spacing) {
      const wave = Math.sin(t * 0.4 + x * 0.002) * 40;
      ctx.moveTo(cx, cy); ctx.lineTo(x + wave, cy + dir * height);
    }
    ctx.strokeStyle = `hsla(${matrixHue}, 100%, 60%, ${0.06 + bass * 0.2})`;
    ctx.stroke();
  };
  drawGrid(1); drawGrid(-1);

  // --- 5. GEOMETRIC SINGULARITY (Core) ---
  const drawPolygon = (x: number, y: number, r: number, sides: number, rot: number) => {
    ctx.beginPath();
    for(let i=0; i<sides; i++) {
      const angle = (i / sides) * Math.PI * 2 + rot;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if(i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  const drawGeometricCore = (x: number, y: number, size: number) => {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for(let i=0; i<5; i++) {
      const r = size * (0.8 + i * 0.4 + bass * 0.5);
      const rot = t * (i % 2 === 0 ? 1 : -1) * (0.3 + i * 0.2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `hsla(${i % 2 === 0 ? matrixHue : secondaryHue}, 100%, 80%, ${0.3 / (i + 1)})`;
      drawPolygon(x, y, r, 6, rot);
      ctx.stroke();
      if (i < 2) {
        ctx.fillStyle = `hsla(${matrixHue}, 100%, 70%, ${0.05 / (i + 1)})`;
        ctx.fill();
      }
    }
    const heartSize = size * (0.6 + bass * 0.4);
    const hGrd = ctx.createRadialGradient(x, y, 0, x, y, heartSize * 1.5);
    hGrd.addColorStop(0, `hsla(${matrixHue}, 100%, 90%, 0.6)`);
    hGrd.addColorStop(1, "transparent");
    ctx.fillStyle = hGrd;
    drawPolygon(x, y, heartSize, 6, t);
    ctx.fill();
    ctx.restore();
  };
  drawGeometricCore(cx, cy, 40 + bass * 20);

  // --- 6. ADVANCED DESIGNER DATA STREAMS ---
  const cols = 52;
  if (refs.matrixDrops.current.length < cols) {
    refs.matrixDrops.current = Array(cols).fill(0).map(() => Math.random() * height);
  }
  const glyphs = "▖▗▘▙▚▛▜▝▞▟⡀⡄⡆⡇⡏⡟⠿01«»‹›[]{}|/\\+=_-";
  for (let l = 0; l < 4; l++) {
    const z = [0.4, 0.8, 1.3, 2.5][l];
    const alpha = [0.12, 0.28, 0.85, 0.35][l];
    const fSize = Math.floor(17 * z * (1 + bass * 0.15));
    ctx.font = `${fSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";
    for (let i = 0; i < cols; i++) {
      if (i % 4 !== l) continue;
      const surge = 1 + bass * 4.8;
      const x = (i / cols) * width + Math.sin(t * 0.6 + i) * 30;
      refs.matrixDrops.current[i] += (1.2 + surge + treble * 48 + l * 4);
      if (refs.matrixDrops.current[i] > height + 600) refs.matrixDrops.current[i] = -600;
      const y = refs.matrixDrops.current[i];
      const len = 14 + l * 10;
      const compression = 0.88 + surge * 0.04;
      for (let j = 0; j < len; j++) {
        const cY = y - j * fSize * compression;
        if (cY < -250 || cY > height + 250) continue;
        const cAlpha = (1 - j / len) * alpha * (0.4 + bass * 0.6);
        let char = glyphs[Math.floor((t * 26 + i + j) % glyphs.length)];
        if (j === 0 && Math.random() > 0.8) char = Math.random() > 0.5 ? "0" : "1";
        if (j === 0) {
          if (isPeak) {
            ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; ctx.fillText(char, x-8, cY);
            ctx.fillStyle = "rgba(0, 255, 255, 0.5)"; ctx.fillText(char, x+8, cY);
          }
          ctx.fillStyle = "#fff";
          if (Math.random() > 0.95) {
            ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = `hsla(${secondaryHue}, 100%, 80%, 0.5)`;
            ctx.fillText(glyphs[Math.floor(Math.random() * 10)], x, cY); ctx.restore();
          }
        } else {
          if (Math.random() > 0.99 && j < 5) {
             ctx.fillStyle = `hsla(${matrixHue}, 100%, 75%, ${cAlpha})`;
             ctx.fillText(char, x + 10, cY); ctx.fillText(char, x - 10, cY);
          } else {
             ctx.fillStyle = `hsla(${matrixHue}, 100%, ${65 + treble * 30}%, ${cAlpha})`;
             ctx.fillText(char, x, cY);
          }
        }
        if (j === 0) ctx.fillText(char, x, cY);
        if (j === 0 && i % 8 === 0) {
          ctx.strokeStyle = `hsla(${matrixHue}, 100%, 80%, ${cAlpha * 0.8})`;
          ctx.beginPath(); ctx.moveTo(x - fSize/2, cY - fSize); ctx.lineTo(x + fSize/2, cY - fSize); ctx.stroke();
        }
      }
    }
  }

  // --- 7. MATRIX INTERFACE HUD (Premium & Inward-Focused) ---
  const drawMatrixHUD = () => {
    ctx.save();
    // Safety Margin: Increased to prevent clipping during vibration
    const m = 110; 
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    
    // Top-Left: System Readout
    ctx.textAlign = "left";
    ctx.fillStyle = `hsla(${matrixHue}, 100%, 80%, 0.8)`;
    ctx.fillText(`MATRIX_KERNEL_V1.4 // SYNC: ${isPeak ? "ACTIVE_PEAK" : "STABLE"}`, m, m);
    ctx.fillStyle = `hsla(${matrixHue}, 100%, 70%, 0.4)`;
    ctx.font = '8px monospace';
    ctx.fillText(`NEURAL_LINK: ${Math.floor(85 + bass * 15)}% ESTABLISHED`, m, m + 14);

    // Top-Right: Coordinate Tracker
    ctx.textAlign = "right";
    ctx.fillStyle = `hsla(${secondaryHue}, 100%, 80%, 0.7)`;
    ctx.font = 'bold 10px monospace';
    const locX = (driftX * 0.1).toFixed(2);
    const locY = (driftY * 0.1).toFixed(2);
    ctx.fillText(`LOC_X: ${locX} | LOC_Y: ${locY}`, width - m, m);
    ctx.font = '7px monospace';
    ctx.fillText(`Z_DEPTH: ${(globalScale * 100).toFixed(1)}%`, width - m, m + 12);

    // Bottom: Decryption Progress Bar
    const barW = 280;
    const barH = 3;
    const progress = (t * 0.05) % 1;
    ctx.save();
    ctx.translate(width/2 - barW/2, height - m);
    ctx.strokeStyle = `hsla(${matrixHue}, 100%, 75%, 0.3)`;
    ctx.strokeRect(0, 0, barW, barH);
    ctx.fillStyle = `hsla(${matrixHue}, 100%, 85%, ${0.6 + bass * 0.4})`;
    ctx.fillRect(0, 0, barW * progress, barH);
    ctx.textAlign = "center";
    ctx.font = 'bold 8px monospace';
    ctx.fillText(`DECRYPTING_DATA_STREAM... ${Math.floor(progress * 100)}%`, barW/2, -10);
    ctx.restore();

    // Main HUD Panel (Tucked Inward)
    ctx.save();
    ctx.translate(width - m - 180, cy - 110);
    ctx.strokeStyle = `hsla(${matrixHue}, 100%, 80%, 0.2)`;
    ctx.strokeRect(0, 0, 180, 220);
    ctx.fillStyle = `hsla(${matrixHue}, 100%, 90%, 0.5)`;
    ctx.font = '900 10px monospace';
    ctx.textAlign = "left";
    ctx.fillText("MATRIX_FLUX_OS", 10, 20);
    for(let i=0; i<6; i++) {
      const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase();
      ctx.fillStyle = `hsla(${secondaryHue}, 100%, 70%, 0.3)`;
      ctx.font = '7px monospace';
      ctx.fillText(`0x${hex} [SEQ_${i}]`, 10, 45 + i * 12);
      const v = (data[i * 12] || 0) / 255 * 140;
      ctx.fillStyle = `hsla(${matrixHue}, 100%, 75%, 0.2)`;
      ctx.fillRect(10, 140 + i * 10, v, 2);
    }
    ctx.restore();

    // Corner Brackets (Inward Position)
    ctx.lineWidth = 2;
    ctx.strokeStyle = `hsla(${matrixHue}, 100%, 75%, 0.3)`;
    const bL = 25;
    [ [m, m], [width-m, m], [width-m, height-m], [m, height-m] ].forEach(([x, y], i) => {
      ctx.save(); ctx.translate(x, y);
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath(); ctx.moveTo(0, bL); ctx.lineTo(0, 0); ctx.lineTo(bL, 0); ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  };
  drawMatrixHUD();

  ctx.restore();
  ctx.globalCompositeOperation = "screen";
  const vigScale = 1.0 + Math.sin(t * 0.4) * 0.2 + bass * 0.3;
  const vigGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * vigScale);
  vigGrd.addColorStop(0.6, "transparent");
  vigGrd.addColorStop(1, `rgba(0, 0, 0, ${0.9 + Math.sin(t)*0.05})`);
  ctx.fillStyle = vigGrd;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for(let i=0; i<height; i+=4) ctx.fillRect(0, i, width, 1);
};
