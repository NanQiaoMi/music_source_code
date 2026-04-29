import { EffectContext } from "./types";

export function drawPrismPulse({ ctx, width, height, data, time, params, theme }: EffectContext) {
  const complexity = params.complexity || 6;
  const refraction = params.refraction || 1.0;
  const drift = params.drift || 0.5;
  const speed = params.speed || 1.0;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(5, 5, 10, 1)";
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const bass = data[0] / 255;
  const mid = data[Math.floor(data.length / 2)] / 255;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(time * 0.0002 * speed);

  for (let i = 0; i < complexity; i++) {
    const angle = (i / complexity) * Math.PI * 2;
    const layerRadius = 150 + bass * 100 + Math.sin(time * 0.001 + i) * 20;
    
    ctx.beginPath();
    for (let j = 0; j < 3; j++) {
      const pAngle = angle + (j / 3) * Math.PI * 2 + Math.sin(time * 0.0005) * drift;
      const x = Math.cos(pAngle) * layerRadius;
      const y = Math.sin(pAngle) * layerRadius;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const hue = (theme.primary + i * (360 / complexity)) % 360;
    ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${0.3 + mid * 0.7})`;
    ctx.lineWidth = 2 + bass * 5;
    ctx.stroke();

    // Refraction lines
    if (refraction > 0) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const rAngle = angle + Math.PI / complexity;
      const rx = Math.cos(rAngle) * (layerRadius * 1.5);
      const ry = Math.sin(rAngle) * (layerRadius * 1.5);
      ctx.lineTo(rx, ry);
      ctx.strokeStyle = `hsla(${(hue + 180) % 360}, 100%, 70%, ${0.1 * refraction})`;
      ctx.stroke();
    }
  }

  // Floating prisms
  for (let i = 0; i < 12; i++) {
    const fAngle = (i / 12) * Math.PI * 2 + time * 0.0001;
    const fRadius = 300 + Math.sin(time * 0.0005 + i) * 100;
    const fx = Math.cos(fAngle) * fRadius;
    const fy = Math.sin(fAngle) * fRadius;

    ctx.beginPath();
    ctx.arc(fx, fy, 2 + bass * 10, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${theme.accent}, 100%, 80%, ${0.2})`;
    ctx.fill();
    
    ctx.shadowBlur = 15 * bass;
    ctx.shadowColor = `hsla(${theme.accent}, 100%, 80%, 0.5)`;
  }

  ctx.restore();

  // Overlay vignettes
  const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width / 1.5);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}
