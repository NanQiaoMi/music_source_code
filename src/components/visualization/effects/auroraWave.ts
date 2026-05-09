import { EffectContext } from "./types";

/**
 * AURORA PHANTOM (V125 - TRIPLE GEOMETRY EDITION)
 * Features: Three Distinct Central Geometric Shapes (Circle, Square, Triangle),
 * Luminous Background, High-Intensity Beams, Spring-Damper Core Physics,
 * and Liquid Silk Filaments.
 */
export const drawAuroraWave = ({
  ctx,
  width,
  height,
  data,
  params,
  time,
  theme,
  refs,
}: EffectContext) => {
  const effectParams = params || {
    speed: 1,
    colorIntensity: 1,
    coreComplexity: 1,
    flareAmount: 1,
    hudDetail: 1,
  };
  const t = time * 0.0007 * (effectParams.speed || 1);
  const cx = width / 2,
    cy = height / 2;

  // --- 1. SIGNAL ANALYTICS & SPRING PHYSICS ---
  const getSafeVal = (idx: number) => (data && data[idx] !== undefined ? data[idx] / 255 : 0);
  const rawBass = (getSafeVal(0) + getSafeVal(1) + getSafeVal(2) + getSafeVal(3)) / 4;
  const rawTreble = (getSafeVal(24) + getSafeVal(28) + getSafeVal(32)) / 3;

  refs.smoothBass.current = (refs.smoothBass.current || 0) * 0.88 + rawBass * 0.12;
  refs.smoothTreble.current = (refs.smoothTreble.current || 0) * 0.92 + rawTreble * 0.08;

  const bass = refs.smoothBass.current;
  const treble = refs.smoothTreble.current;
  const energy = (bass + treble) / 2;
  const isPeak = bass > 0.92;
  const breath = Math.sin(t * 0.25) * 0.5 + 0.5;

  const auroraHue = theme.primary;
  const accentHue = theme.accent;
  const colorInt = (effectParams.colorIntensity || 1.0) * 1.2;

  // --- 2. CINEMATIC CAMERA ---
  const zoom = 1.05 + bass * 0.15 + breath * 0.03;
  const driftX = Math.sin(t * 0.08) * 100 + Math.sin(t * 0.18) * 30 + Math.cos(t * 0.32) * 15;
  const driftY = Math.cos(t * 0.07) * 80 + Math.cos(t * 0.22) * 25 + Math.sin(t * 0.35) * 10;
  const roll = Math.sin(t * 0.04) * 0.025 + Math.cos(t * 0.11) * 0.012;

  ctx.save();
  ctx.translate(cx + driftX, cy + driftY);
  ctx.rotate(roll);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);

  // --- 3. DYNAMIC BACKGROUND & VOLUMETRIC ATMOS ---
  const bgHue = (auroraHue + energy * 15) % 360;
  const bgL = 2 + energy * 8;
  ctx.fillStyle = `hsla(${bgHue}, 80%, ${bgL}%, 1)`;
  ctx.fillRect(-width, -height, width * 3, height * 3);

  // A. Volumetric Liquid Mist
  const drawMist = () => {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const mistGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 1.5);
    mistGrd.addColorStop(
      0,
      `hsla(${auroraHue}, 100%, 18%, ${0.15 * (0.5 + energy * 0.5) * colorInt})`
    );
    mistGrd.addColorStop(0.6, `hsla(${accentHue}, 100%, 6%, ${0.1 * breath * colorInt})`);
    mistGrd.addColorStop(1, "transparent");
    ctx.fillStyle = mistGrd;
    ctx.fillRect(-width, -height, width * 3, height * 3);
    ctx.restore();
  };
  drawMist();

  // B. Scattered Background Beams
  const drawScatteredBeams = () => {
    if (effectParams.hudDetail < 0.1) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = "screen";
    const beamCount = 42;
    const beamLen = Math.max(width, height) * 1.8;
    for (let i = 0; i < beamCount; i++) {
      const angle = (i / beamCount) * Math.PI * 2 + t * 0.035;
      const bGrd = ctx.createRadialGradient(0, 0, 100, 0, 0, beamLen);
      const bAlpha =
        (0.05 + energy * 0.3) *
        (Math.sin(t * 1.3 + i) * 0.5 + 0.5) *
        colorInt *
        effectParams.hudDetail;
      const bWidth = 0.015 + energy * 0.05;
      bGrd.addColorStop(0, `hsla(${auroraHue}, 100%, 75%, ${bAlpha})`);
      bGrd.addColorStop(1, "transparent");
      ctx.fillStyle = bGrd;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, beamLen, angle - bWidth, angle + bWidth);
      ctx.fill();
    }
    ctx.restore();
  };
  drawScatteredBeams();

  // --- 4. THE CORE ---
  const drawCore = () => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = "screen";

    // A. Liquid Silk Filaments
    const layerCount = 3;
    if (effectParams.hudDetail > 0.2) {
      for (let l = 0; l < layerCount; l++) {
        ctx.save();
        ctx.rotate(t * (0.08 + l * 0.03) + (l * Math.PI) / 3);
        ctx.beginPath();
        const filamentAlpha =
          (0.12 + bass * 0.15) * (1 - l * 0.2) * colorInt * effectParams.hudDetail;
        const rBase = 190 + l * 45 + bass * 20;
        for (let i = 0; i <= 360; i += 3) {
          const rad = (i * Math.PI) / 180;
          const hue = (auroraHue + Math.sin(rad * 2 + t) * 20) % 360;
          ctx.strokeStyle = `hsla(${hue}, 100%, 90%, ${filamentAlpha})`;
          ctx.lineWidth = 0.45;
          const wave =
            Math.sin(rad * 3 + t * 1.1) * (12 + treble * 25) +
            Math.sin(rad * 6 - t * 0.7) * 10 +
            Math.cos(rad * 4 + t * 0.4) * 8;
          const px = Math.cos(rad) * (rBase + wave);
          const py = Math.sin(rad) * (rBase + wave);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // B. The Prism Core (Hexagon Layers)
    const prismSize = 95 + bass * 40 + breath * 8;
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.rotate(t * (0.25 + i * 0.1) + (i * Math.PI) / 3);
      ctx.strokeStyle = `hsla(${auroraHue}, 100%, 98%, ${0.55 - i * 0.15})`;
      ctx.lineWidth = 1.8 - i * 0.3;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2;
        const px = Math.cos(a) * prismSize,
          py = Math.sin(a) * prismSize;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // E. Triple Inner Shapes (三个不同图形在中心 - Requested)
    const shapeConfig = [
      { sides: 0, scale: 0.25, rot: 1.8 }, // Inner Circle
      { sides: 4, scale: 0.5, rot: -1.2 }, // Middle Square
      { sides: 3, scale: 0.75, rot: 0.6 }, // Outer Triangle
    ];
    shapeConfig.forEach((s, i) => {
      ctx.save();
      ctx.rotate(t * s.rot + i);
      ctx.strokeStyle = `hsla(${auroraHue}, 100%, 95%, ${0.75 - i * 0.2})`;
      ctx.lineWidth = 1.2;
      const r = prismSize * s.scale;
      ctx.beginPath();
      if (s.sides === 0) {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      } else {
        for (let j = 0; j <= s.sides; j++) {
          const a = (j / s.sides) * Math.PI * 2 - Math.PI / 2;
          const px = Math.cos(a) * r,
            py = Math.sin(a) * r;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      ctx.restore();
    });

    // C. Soft Core Bloom
    const bloomSize = prismSize * 2.2;
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, bloomSize);
    grd.addColorStop(0, `hsla(${auroraHue}, 100%, 98%, 0.85)`);
    grd.addColorStop(0.3, `hsla(${auroraHue}, 100%, 85%, 0.35)`);
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, bloomSize, 0, Math.PI * 2);
    ctx.fill();

    // D. Fine Spectrum
    const bars = 128;
    const step = (Math.PI * 2) / bars;
    for (let i = 0; i < bars; i++) {
      const angle = i * step + t * 0.15;
      const val = getSafeVal(i % 64);
      const h = val * 180 * (1 + bass * 0.35);
      if (h < 5) continue;
      const rIn = prismSize + 12;
      const x1 = Math.cos(angle) * rIn,
        y1 = Math.sin(angle) * rIn;
      const x2 = Math.cos(angle) * (rIn + h),
        y2 = Math.sin(angle) * (rIn + h);
      const bGrd = ctx.createLinearGradient(x1, y1, x2, y2);
      bGrd.addColorStop(0, `hsla(${auroraHue}, 100%, 95%, 0.9)`);
      bGrd.addColorStop(1, "transparent");
      ctx.strokeStyle = bGrd;
      ctx.lineWidth = 2 * (1 + val * 2.5);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  };
  if (effectParams.hudDetail > 0.1) {
    drawCore();
  }

  // --- 5. OPTICAL SUITE ---
  const fInt = (bass * 0.4 + treble * 0.4) * breath * effectParams.flareAmount;
  if (fInt > 0.04) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const fGrd = ctx.createLinearGradient(0, cy, width, cy);
    fGrd.addColorStop(0, "transparent");
    fGrd.addColorStop(0.5, `hsla(${auroraHue}, 100%, 95%, ${fInt * 0.45})`);
    fGrd.addColorStop(1, "transparent");
    ctx.fillStyle = fGrd;
    ctx.fillRect(-width, cy - 1.5, width * 3, 3);
    ctx.restore();
  }

  // --- 6. POST-PROCESSING ---
  if (isPeak) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const intensity = (bass - 0.92) * 10;
    ctx.globalAlpha = 0.25 * intensity;
    ctx.drawImage(ctx.canvas, 5 * intensity, 0);
    ctx.globalAlpha = 0.15 * intensity;
    ctx.drawImage(ctx.canvas, -5 * intensity, 0);
    ctx.restore();
  }

  const vig = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 1.6);
  vig.addColorStop(0, "transparent");
  vig.addColorStop(0.8, "transparent");
  vig.addColorStop(1, "rgba(0, 0, 0, 1.0)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
};
