import { EffectContext } from "./types";

export const drawSpatialMesh = ({
  ctx,
  width,
  height,
  data,
  params,
  time,
  refs,
  theme,
}: EffectContext) => {
  const effectParams = params || { speed: 1, blurIntensity: 60, colorIntensity: 1 };
  const t = time * 0.0004 * (effectParams.speed || 1);
  const cx = width / 2,
    cy = height / 2;

  // --- INTERACTION: Butter-Smooth Smoothing ---
  const rawBass = data && data[0] ? (data[0] + data[1] + data[2] + data[3]) / 4 / 255 : 0;
  const rawTreble = data && data[24] ? (data[24] + data[28] + data[32]) / 3 / 255 : 0;
  refs.smoothBass.current = refs.smoothBass.current * 0.95 + rawBass * 0.05;
  refs.smoothTreble.current = refs.smoothTreble.current * 0.96 + rawTreble * 0.04;
  const bass = refs.smoothBass.current;
  const treble = refs.smoothTreble.current;

  // --- Cinematic Stage: Anamorphic Wide Shot ---
  const driftX = Math.sin(t * 0.2) * 15;
  const driftY = Math.cos(t * 0.15) * 8;
  ctx.save();
  ctx.translate(cx + driftX, cy + driftY);
  ctx.scale(1.05, 1.05); // Slight overscan
  ctx.translate(-cx, -cy);

  // 1. Deep Celestial Foundation
  ctx.fillStyle = "#010206";
  ctx.fillRect(-50, -50, width + 100, height + 100);

  // 2. Atmospheric God Rays (Bass Driven)
  if (bass > 0.4) {
    ctx.globalCompositeOperation = "screen";
    const rayCount = 8;
    for (let i = 0; i < rayCount; i++) {
      const angle = t * 0.5 + (i / rayCount) * Math.PI * 2;
      const rayGrd = ctx.createLinearGradient(
        cx,
        cy,
        cx + Math.cos(angle) * width,
        cy + Math.sin(angle) * width
      );
      rayGrd.addColorStop(0, `hsla(${theme.primary}, 100%, 75%, ${0.1 * bass})`);
      rayGrd.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle - 0.2) * width, cy + Math.sin(angle - 0.2) * width);
      ctx.lineTo(cx + Math.cos(angle + 0.2) * width, cy + Math.sin(angle + 0.2) * width);
      ctx.fillStyle = rayGrd;
      ctx.fill();
    }
  }

  const hTheme = [
    { h: theme.primary },
    { h: theme.secondary },
    { h: theme.accent },
    { h: (theme.primary + 30) % 360 },
  ];

  // 3. Volumetric Orbs with Glass Refraction
  const orbs = [
    {
      x: 0.3 + Math.sin(t * 0.6) * 0.2,
      y: 0.4 + Math.cos(t * 0.4) * 0.2,
      r: 0.6 * (1 + bass * 0.4),
      h: hTheme[0].h,
      a: 0.45,
    },
    {
      x: 0.7 + Math.cos(t * 0.5) * 0.2,
      y: 0.6 + Math.sin(t * 0.7) * 0.2,
      r: 0.5 * (1 + bass * 0.3),
      h: hTheme[1].h,
      a: 0.35,
    },
    {
      x: 0.5 + Math.sin(t * 0.3) * 0.3,
      y: 0.3 + Math.cos(t * 0.8) * 0.2,
      r: 0.55 * (1 + treble * 0.3),
      h: hTheme[2].h,
      a: 0.35,
    },
  ];

  ctx.globalCompositeOperation = "screen";
  orbs.forEach((orb) => {
    const ox = width * orb.x;
    const oy = height * orb.y;
    const radius = width * orb.r;
    const alpha = orb.a * (effectParams.colorIntensity || 1.0);

    // --- OPTICAL: Triple Chromatic Split ---
    const layers = [
      { off: -12, h: orb.h - 15, a: alpha * 0.4 },
      { off: 0, h: orb.h, a: alpha },
      { off: 12, h: orb.h + 15, a: alpha * 0.4 },
    ];

    layers.forEach((l) => {
      const grad = ctx.createRadialGradient(ox + l.off, oy, 0, ox, oy, radius);
      grad.addColorStop(0, `hsla(${l.h}, 95%, 65%, ${l.a})`);
      grad.addColorStop(0.4, `hsla(${l.h}, 85%, 55%, ${l.a * 0.3})`);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ox, oy, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Volumetric Halo Rings
    ctx.beginPath();
    ctx.arc(ox, oy, radius * (0.8 + treble * 0.2), 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${orb.h}, 100%, 80%, ${treble * 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // 5. High-End Anamorphic Lens Flare
  const flareY = cy + Math.sin(t * 0.5) * 50;
  const flareAlpha = Math.pow(treble, 3) * 0.5;
  if (flareAlpha > 0.05) {
    const flareGrd = ctx.createLinearGradient(0, flareY, width, flareY);
    flareGrd.addColorStop(0, "transparent");
    flareGrd.addColorStop(0.5, `rgba(220, 240, 255, ${flareAlpha})`);
    flareGrd.addColorStop(1, "transparent");
    ctx.fillStyle = flareGrd;
    ctx.fillRect(0, flareY - 1, width, 2);

    // Lens Glints
    for (let j = 0; j < 3; j++) {
      const gx = cx + Math.sin(t + j) * 300;
      const gSize = 20 + j * 40;
      const gGrd = ctx.createRadialGradient(gx, flareY, 0, gx, flareY, gSize);
      gGrd.addColorStop(0, `rgba(255, 255, 255, ${flareAlpha * 0.2})`);
      gGrd.addColorStop(1, "transparent");
      ctx.fillStyle = gGrd;
      ctx.beginPath();
      ctx.arc(gx, flareY, gSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 6. Enhanced Celestial Stardust (Halo Formation)
  const starCount = 80;
  const baseRingR = Math.min(width, height) * 0.28;
  for (let i = 0; i < starCount; i++) {
    const orbitAngle = (i / starCount) * Math.PI * 2 + t * 0.2;
    const ringWidth = 60 + bass * 120; // Expands with bass
    const dist = baseRingR + Math.sin(i * 0.5 + t) * ringWidth * 0.5 + Math.cos(i * 1.5) * 20;

    const px = cx + Math.cos(orbitAngle) * dist;
    const py = cy + Math.sin(orbitAngle) * dist;

    const twinkle = Math.sin(t * 3 + i) * 0.5 + 0.5;
    const starAlpha = 0.08 + twinkle * 0.2 + bass * 0.3;
    const starSize = (i % 5 === 0 ? 1.8 : 0.9) * (1 + bass * 0.4);

    ctx.fillStyle = `hsla(${hTheme[i % 4].h}, 100%, 95%, ${starAlpha})`;
    ctx.beginPath();
    ctx.arc(px, py, starSize, 0, Math.PI * 2);
    ctx.fill();

    // Selective Diffraction Spike (Star cross)
    if (i % 15 === 0 && bass > 0.6) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${bass * 0.2})`;
      ctx.lineWidth = 0.5;
      const sz = 8 * bass;
      ctx.beginPath();
      ctx.moveTo(px - sz, py);
      ctx.lineTo(px + sz, py);
      ctx.moveTo(px, py - sz);
      ctx.lineTo(px, py + sz);
      ctx.stroke();
    }
  }

  // 7. Cinematic Vignette
  const vignette = ctx.createRadialGradient(cx, cy, height * 0.45, cx, cy, width * 0.95);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, `rgba(0,0,0,${0.7 + bass * 0.15})`);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = vignette;
  ctx.fillRect(-50, -50, width + 100, height + 100);

  ctx.restore();
};
