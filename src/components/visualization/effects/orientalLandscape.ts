/* eslint-disable @typescript-eslint/no-explicit-any */
import { EffectContext } from "./types";

interface WaterRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}

let localRipples: WaterRipple[] = [];
let localParticles: DustParticle[] = [];
let lastRippleTime = 0;
let initialized = false;

function initParticles(width: number, height: number) {
  localParticles = [];
  for (let i = 0; i < 45; i++) {
    localParticles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -Math.random() * 0.5 - 0.2,
      size: Math.random() * 2.5 + 1.2,
      alpha: Math.random() * 0.7 + 0.3,
      phase: Math.random() * Math.PI * 2,
    });
  }
  initialized = true;
}

/**
 * 120 FPS 东方水墨重彩与电影级丁达尔神光远山画卷 (Oriental Cinematic Scroll)
 * 专为纯音乐与古风设计：5重远山视差叠嶂、体积光束呼吸、水面泛音涟漪、锦绫宣纸画框
 */
export function drawOrientalLandscape(context: EffectContext): void {
  const { ctx, width, height, data, time, params } = context;
  if (!width || !height || width <= 0 || height <= 0) return;

  const lightRays = params?.lightRays ?? 1.0;
  const mountainBreath = params?.mountainBreath ?? 1.0;
  const waterRipple = params?.waterRipple ?? 1.0;
  const goldGlow = params?.goldGlow ?? 1.2;
  const filmVignette = params?.filmVignette ?? 0.65;

  // 1. 低通音频平滑滤波 (EMA Filtering)
  let bassSum = 0;
  let midSum = 0;
  let trebleSum = 0;
  const bassEnd = Math.max(1, Math.floor(data.length * 0.12));
  const midEnd = Math.max(bassEnd + 1, Math.floor(data.length * 0.5));
  const trebleEnd = Math.max(midEnd + 1, Math.floor(data.length * 0.92));

  for (let i = 0; i < bassEnd; i++) bassSum += data[i] || 0;
  for (let i = bassEnd; i < midEnd; i++) midSum += data[i] || 0;
  for (let i = midEnd; i < trebleEnd; i++) trebleSum += data[i] || 0;

  const rawBass = bassSum / (bassEnd * 255 || 1);
  const rawMid = midSum / ((midEnd - bassEnd) * 255 || 1);
  const rawTreble = trebleSum / ((trebleEnd - midEnd) * 255 || 1);

  if (context.refs.smoothBass) {
    context.refs.smoothBass.current += (rawBass - context.refs.smoothBass.current) * 0.06;
  }
  if (context.refs.smoothMid) {
    context.refs.smoothMid.current += (rawMid - context.refs.smoothMid.current) * 0.08;
  }
  if (context.refs.smoothTreble) {
    context.refs.smoothTreble.current += (rawTreble - context.refs.smoothTreble.current) * 0.1;
  }

  const bass = Number.isFinite(context.refs.smoothBass?.current) ? context.refs.smoothBass.current : 0;
  const mid = Number.isFinite(context.refs.smoothMid?.current) ? context.refs.smoothMid.current : 0;
  const treble = Number.isFinite(context.refs.smoothTreble?.current) ? context.refs.smoothTreble.current : 0;

  const t = time * 0.001;

  if (!initialized || localParticles.length === 0) {
    initParticles(width, height);
  }

  // 泛音高频涟漪生成
  if (treble > 0.35 && t - lastRippleTime > 0.28) {
    lastRippleTime = t;
    if (localRipples.length < 8) {
      localRipples.push({
        x: width * (0.32 + Math.random() * 0.36),
        y: height * (0.64 + Math.random() * 0.12),
        radius: 4,
        maxRadius: Math.min(width, height) * 0.28,
        alpha: 0.85 * waterRipple,
        speed: 1.6 + treble * 2.2,
      });
    }
  }

  ctx.save();

  // ─── 1. 外部暗夜背景与弥散极光 ───
  ctx.fillStyle = "#07080b";
  ctx.fillRect(0, 0, width, height);

  const ambientGlow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    width * 0.08,
    width * 0.5,
    height * 0.45,
    width * 0.65
  );
  ambientGlow.addColorStop(0, "rgba(13, 79, 108, 0.26)");
  ambientGlow.addColorStop(0.5, "rgba(26, 93, 87, 0.14)");
  ambientGlow.addColorStop(1, "rgba(7, 8, 11, 0)");
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(0, 0, width, height);

  // ─── 2. 2.35:1 宽银幕东方宣纸画卷剪裁区 ───
  const maxScrollW = width * 0.88;
  const targetAspect = 2.35;
  let scrollW = maxScrollW;
  let scrollH = scrollW / targetAspect;

  if (scrollH > height * 0.72) {
    scrollH = height * 0.72;
    scrollW = scrollH * targetAspect;
  }

  const scrollX = (width - scrollW) / 2;
  const scrollY = (height - scrollH) / 2;

  // 画卷外框阴影
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "rgba(15, 19, 25, 0.95)";
  roundRect(ctx, scrollX, scrollY, scrollW, scrollH, 18);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 画卷内部剪裁
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, scrollX, scrollY, scrollW, scrollH, 18);
  ctx.clip();

  // 宣纸底色天际渐变 (青绿千载)
  const skyGrad = ctx.createLinearGradient(scrollX, scrollY, scrollX, scrollY + scrollH);
  skyGrad.addColorStop(0, "#081620");
  skyGrad.addColorStop(0.35, "#0c2834");
  skyGrad.addColorStop(0.65, "#14373a");
  skyGrad.addColorStop(1, "#06131a");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(scrollX, scrollY, scrollW, scrollH);

  // 水面分界线 Y 坐标
  const waterY = scrollY + scrollH * 0.62;

  // ─── 3. 5 重远山叠嶂与水墨视差起伏 ───
  const breathFactor = mountainBreath * bass;
  const midVibe = mid * 8;

  const mountainColors = [
    { fill: "#0e313d", rim: "#38bdf8", alpha: 0.4 },
    { fill: "#11454a", rim: "#34d399", alpha: 0.65 },
    { fill: "#155e5b", rim: "#4ade80", alpha: 0.85 },
    { fill: "#164e43", rim: "#a3e635", alpha: 0.95 },
    { fill: "#0b2c28", rim: "#fbbf24", alpha: 1.0 },
  ];

  for (let layer = 0; layer < 5; layer++) {
    const layerDepth = (layer + 1) / 5;
    const baseHeight = scrollH * (0.28 + layer * 0.08);
    const waveSpeed = 0.3 + layer * 0.15;
    const layerTime = t * waveSpeed;
    const layerAmp = (baseHeight * 0.35 + breathFactor * 25 * layerDepth) * (1 + (layer === 4 ? midVibe * 0.04 : 0));

    ctx.beginPath();
    ctx.moveTo(scrollX, waterY);

    const step = 4;
    for (let x = scrollX; x <= scrollX + scrollW; x += step) {
      const normX = (x - scrollX) / scrollW;
      const s1 = Math.sin(normX * (3 + layer * 1.5) + layerTime + layer * 2.1);
      const s2 = Math.cos(normX * (7 + layer * 2) - layerTime * 0.6);
      const s3 = Math.sin(normX * 14 + layerTime * 1.2) * 0.25;
      const mountainCurve = (s1 * 0.6 + s2 * 0.3 + s3 * 0.1);

      const y = waterY - baseHeight - mountainCurve * layerAmp;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(scrollX + scrollW, waterY);
    ctx.closePath();

    const mtnGrad = ctx.createLinearGradient(scrollX, waterY - baseHeight * 1.4, scrollX, waterY);
    mtnGrad.addColorStop(0, mountainColors[layer].fill);
    mtnGrad.addColorStop(1, "rgba(6, 18, 24, 0.95)");
    ctx.fillStyle = mtnGrad;
    ctx.globalAlpha = mountainColors[layer].alpha;
    ctx.fill();

    if (layer >= 3) {
      ctx.strokeStyle = mountainColors[layer].rim;
      ctx.lineWidth = layer === 4 ? 1.5 : 1.0;
      ctx.globalAlpha = (0.45 + mid * 0.55) * goldGlow;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1.0;

  // ─── 4. 丁达尔神光体积光束 ───
  const rayStrength = lightRays * (0.6 + bass * 0.8);
  if (rayStrength > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const rayOriginX = scrollX + scrollW * 0.22;
    const rayOriginY = scrollY - 20;

    for (let r = 0; r < 5; r++) {
      const rayAngle = Math.PI * 0.28 + (r - 2) * 0.12 + Math.sin(t * 0.4 + r) * 0.04;
      const rayLength = scrollH * 1.4;
      const raySpread = scrollW * (0.06 + r * 0.02);

      const rayGrad = ctx.createRadialGradient(
        rayOriginX,
        rayOriginY,
        10,
        rayOriginX + Math.cos(rayAngle) * rayLength * 0.6,
        rayOriginY + Math.sin(rayAngle) * rayLength * 0.6,
        rayLength
      );

      rayGrad.addColorStop(0, `rgba(251, 191, 36, ${0.45 * rayStrength})`);
      rayGrad.addColorStop(0.35, `rgba(245, 158, 11, ${0.2 * rayStrength})`);
      rayGrad.addColorStop(0.7, `rgba(56, 189, 248, ${0.08 * rayStrength})`);
      rayGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(rayOriginX, rayOriginY);
      ctx.lineTo(
        rayOriginX + Math.cos(rayAngle - 0.14) * rayLength - raySpread,
        rayOriginY + Math.sin(rayAngle - 0.14) * rayLength
      );
      ctx.lineTo(
        rayOriginX + Math.cos(rayAngle + 0.14) * rayLength + raySpread,
        rayOriginY + Math.sin(rayAngle + 0.14) * rayLength
      );
      ctx.closePath();
      ctx.fill();
    }

    if (bass > 0.45) {
      const streakY = waterY - scrollH * 0.25;
      const streakGrad = ctx.createLinearGradient(scrollX, streakY, scrollX + scrollW, streakY);
      streakGrad.addColorStop(0, "rgba(251, 191, 36, 0)");
      streakGrad.addColorStop(0.5, `rgba(251, 191, 36, ${(bass - 0.3) * 0.7 * goldGlow})`);
      streakGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = streakGrad;
      ctx.fillRect(scrollX, streakY - 1.5, scrollW, 3);
    }

    ctx.restore();
  }

  // ─── 5. 水镜实时微波倒影与泛音涟漪 ───
  const waterGrad = ctx.createLinearGradient(scrollX, waterY, scrollX, scrollY + scrollH);
  waterGrad.addColorStop(0, "rgba(6, 18, 24, 0.85)");
  waterGrad.addColorStop(0.4, "rgba(9, 28, 38, 0.95)");
  waterGrad.addColorStop(1, "rgba(4, 11, 15, 1.0)");
  ctx.fillStyle = waterGrad;
  ctx.fillRect(scrollX, waterY, scrollW, scrollH - (waterY - scrollY));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const shimmerCount = 12;
  for (let w = 0; w < shimmerCount; w++) {
    const lineY = waterY + ((w + 1) / (shimmerCount + 1)) * (scrollY + scrollH - waterY);
    const wavePhase = t * 1.2 + w * 0.8;
    const lineAlpha = (0.06 + Math.sin(wavePhase) * 0.04 + treble * 0.1) * (w > 6 ? 0.6 : 1.0);

    ctx.strokeStyle = `rgba(251, 191, 36, ${Math.max(0, lineAlpha)})`;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(scrollX, lineY);
    for (let x = scrollX; x <= scrollX + scrollW; x += 16) {
      const dy = Math.sin((x - scrollX) * 0.04 + wavePhase) * (1.5 + bass * 2);
      ctx.lineTo(x, lineY + dy);
    }
    ctx.stroke();
  }

  localRipples.forEach((rip: WaterRipple, idx: number) => {
    rip.radius += rip.speed;
    rip.alpha *= 0.96;

    if (rip.alpha > 0.02) {
      ctx.strokeStyle = `rgba(56, 189, 248, ${rip.alpha * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(rip.x, rip.y, rip.radius, rip.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(251, 191, 36, ${rip.alpha * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(rip.x, rip.y, rip.radius * 0.6, rip.radius * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      localRipples.splice(idx, 1);
    }
  });
  ctx.restore();

  // ─── 6. 浮空微尘金粉落英 ───
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  localParticles.forEach((p: DustParticle) => {
    p.x += p.vx + Math.sin(t + p.phase) * 0.3;
    p.y += p.vy;
    if (p.y < scrollY) {
      p.y = scrollY + scrollH + 10;
      p.x = scrollX + Math.random() * scrollW;
    }
    if (p.x < scrollX) p.x = scrollX + scrollW;
    if (p.x > scrollX + scrollW) p.x = scrollX;

    const particleAlpha = p.alpha * (0.6 + Math.sin(t * 2 + p.phase) * 0.4);
    ctx.fillStyle = `rgba(251, 191, 36, ${particleAlpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // 电影级胶片暗角 (Film Vignette)
  if (filmVignette > 0) {
    const vigGrd = ctx.createRadialGradient(
      scrollX + scrollW / 2,
      scrollY + scrollH / 2,
      scrollW * 0.3,
      scrollX + scrollW / 2,
      scrollY + scrollH / 2,
      scrollW * 0.65
    );
    vigGrd.addColorStop(0, "rgba(0,0,0,0)");
    vigGrd.addColorStop(1, `rgba(0,0,0,${filmVignette * 0.65})`);
    ctx.fillStyle = vigGrd;
    ctx.fillRect(scrollX, scrollY, scrollW, scrollH);
  }

  // ─── 7. 宣纸锦绫金丝装裱边缘 ───
  ctx.restore(); // 退出内部剪裁

  ctx.strokeStyle = `rgba(251, 191, 36, ${0.45 * goldGlow})`;
  ctx.lineWidth = 1.5;
  roundRect(ctx, scrollX, scrollY, scrollW, scrollH, 18);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  roundRect(ctx, scrollX + 3.5, scrollY + 3.5, scrollW - 7, scrollH - 7, 15);
  ctx.stroke();

  // 四角暗纹
  const cornerSize = 14;
  ctx.strokeStyle = `rgba(251, 191, 36, ${0.85 * goldGlow})`;
  ctx.lineWidth = 2;
  // 左上
  ctx.beginPath();
  ctx.moveTo(scrollX + 8, scrollY + 8 + cornerSize);
  ctx.lineTo(scrollX + 8, scrollY + 8);
  ctx.lineTo(scrollX + 8 + cornerSize, scrollY + 8);
  ctx.stroke();
  // 右上
  ctx.beginPath();
  ctx.moveTo(scrollX + scrollW - 8 - cornerSize, scrollY + 8);
  ctx.lineTo(scrollX + scrollW - 8, scrollY + 8);
  ctx.lineTo(scrollX + scrollW - 8, scrollY + 8 + cornerSize);
  ctx.stroke();
  // 左下
  ctx.beginPath();
  ctx.moveTo(scrollX + 8, scrollY + scrollH - 8 - cornerSize);
  ctx.lineTo(scrollX + 8, scrollY + scrollH - 8);
  ctx.lineTo(scrollX + 8 + cornerSize, scrollY + scrollH - 8);
  ctx.stroke();
  // 右下
  ctx.beginPath();
  ctx.moveTo(scrollX + scrollW - 8 - cornerSize, scrollY + scrollH - 8);
  ctx.lineTo(scrollX + scrollW - 8, scrollY + scrollH - 8);
  ctx.lineTo(scrollX + scrollW - 8, scrollY + scrollH - 8 - cornerSize);
  ctx.stroke();

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
