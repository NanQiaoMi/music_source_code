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

interface GoldenPetal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  rotation: number;
  vRot: number;
  aspect: number;
  phase: number;
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

interface MistPuff {
  x: number;
  y: number;
  vx: number;
  radius: number;
  alpha: number;
  phase: number;
}

let localRipples: WaterRipple[] = [];
let localPetals: GoldenPetal[] = [];
let localParticles: DustParticle[] = [];
let localMistPuffs: MistPuff[] = [];
let lastRippleTime = 0;
let initialized = false;

// 平滑阻尼追踪器 (EMA Damping: 40)
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;
let smoothEnergy = 0;

function initLivingElements(width: number, height: number, waterY: number) {
  localParticles = [];
  for (let i = 0; i < 40; i++) {
    localParticles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -Math.random() * 0.3 - 0.08,
      size: Math.random() * 1.8 + 0.6,
      alpha: Math.random() * 0.45 + 0.15,
      phase: Math.random() * Math.PI * 2,
    });
  }

  localPetals = [];
  for (let i = 0; i < 14; i++) {
    localPetals.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3 + 0.12,
      vy: Math.random() * 0.25 + 0.12,
      size: Math.random() * 3.5 + 1.8,
      alpha: Math.random() * 0.22 + 0.1, // 细腻半透明 (10%~32%)
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.02,
      aspect: 0.35 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // 水天交界处的 10 个独立飘动的高斯水雾团 (彻底替代生硬横条)
  localMistPuffs = [];
  for (let i = 0; i < 10; i++) {
    localMistPuffs.push({
      x: Math.random() * width,
      y: waterY + (Math.random() - 0.5) * 28,
      vx: (Math.random() - 0.5) * 0.18 + 0.08,
      radius: Math.random() * 90 + 70,
      alpha: Math.random() * 0.10 + 0.06,
      phase: Math.random() * Math.PI * 2,
    });
  }

  initialized = true;
}

/**
 * 120 FPS 宋画清幽 · 电影级柔焦水墨长卷 (Oriental Serene Landscape)
 * 极致清幽优雅：
 * 1. 彻底清除所有水平矩形发光条与生硬带状雾层，杜绝任何直角与直线截断；
 * 2. 依附山坳峡谷的有机流动云岫与晨曦透光（Mountain Saddle Pass Glow）；
 * 3. 水天交界处采用多团半透明高斯圆形水雾自然弥散，烟波浩渺；
 * 4. 水波粼粼碎金采用余弦两端羽化，浑然一体。
 */
export function drawOrientalLandscape(context: EffectContext): void {
  const { ctx, width, height, data, time, params } = context;
  if (!width || !height || width <= 0 || height <= 0) return;

  const lightRays = params?.lightRays ?? 1.0;
  const mountainBreath = params?.mountainBreath ?? 1.0;
  const waterRipple = params?.waterRipple ?? 1.0;
  const goldGlow = params?.goldGlow ?? 1.0;
  const filmVignette = params?.filmVignette ?? 0.65;

  // 1. 低通音频平滑滤波 (EMA Filtering, Damping: 40)
  let bassSum = 0;
  let midSum = 0;
  let trebleSum = 0;
  const bassEnd = Math.max(1, Math.floor(data.length * 0.12));
  const midEnd = Math.max(bassEnd + 1, Math.floor(data.length * 0.48));
  const trebleEnd = Math.max(midEnd + 1, Math.floor(data.length * 0.92));

  for (let i = 0; i < bassEnd; i++) bassSum += data[i] || 0;
  for (let i = bassEnd; i < midEnd; i++) midSum += data[i] || 0;
  for (let i = midEnd; i < trebleEnd; i++) trebleSum += data[i] || 0;

  const rawBass = bassSum / (bassEnd * 255 || 1);
  const rawMid = midSum / ((midEnd - bassEnd) * 255 || 1);
  const rawTreble = trebleSum / ((trebleEnd - midEnd) * 255 || 1);
  const rawEnergy = rawBass * 0.4 + rawMid * 0.4 + rawTreble * 0.2;

  smoothBass += (rawBass - smoothBass) * 0.04;
  smoothMid += (rawMid - smoothMid) * 0.06;
  smoothTreble += (rawTreble - smoothTreble) * 0.08;
  smoothEnergy += (rawEnergy - smoothEnergy) * 0.05;

  if (context.refs.smoothBass) context.refs.smoothBass.current = smoothBass;
  if (context.refs.smoothMid) context.refs.smoothMid.current = smoothMid;
  if (context.refs.smoothTreble) context.refs.smoothTreble.current = smoothTreble;

  const t = time * 0.0007;

  // ─── 2. 2.35:1 宽银幕电影绢帛画幅尺寸计算 ───
  const maxScrollW = width * 0.92;
  const targetAspect = 2.35;
  let scrollW = maxScrollW;
  let scrollH = scrollW / targetAspect;

  if (scrollH > height * 0.78) {
    scrollH = height * 0.78;
    scrollW = scrollH * targetAspect;
  }

  const scrollX = (width - scrollW) / 2;
  const scrollY = (height - scrollH) / 2;
  const waterY = scrollY + scrollH * 0.58;

  if (!initialized || localParticles.length === 0) {
    initLivingElements(width, height, waterY);
  }

  // 泛音微波涟漪生成
  if (smoothTreble > 0.36 && t - lastRippleTime > 0.30) {
    lastRippleTime = t;
    if (localRipples.length < 5) {
      localRipples.push({
        x: width * (0.36 + Math.random() * 0.36),
        y: waterY + 20 + Math.random() * 35,
        radius: 4,
        maxRadius: Math.min(width, height) * 0.25,
        alpha: 0.65 * waterRipple,
        speed: 1.2 + smoothTreble * 1.8,
      });
    }
  }

  ctx.save();

  // ─── 1. 外部暗夜背景与幽深玄青气韵 ───
  ctx.fillStyle = "#04070a";
  ctx.fillRect(0, 0, width, height);

  const ambientGlow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.46,
    width * 0.05,
    width * 0.5,
    height * 0.46,
    width * 0.75
  );
  ambientGlow.addColorStop(0, "rgba(8, 48, 64, 0.22)");
  ambientGlow.addColorStop(0.5, "rgba(12, 54, 50, 0.10)");
  ambientGlow.addColorStop(1, "rgba(4, 7, 10, 0)");
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(0, 0, width, height);

  // ─── 2. 画卷内部裁剪 ───
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, scrollX, scrollY, scrollW, scrollH, 16);
  ctx.clip();

  // 宣纸天际古色渐变 (深邃墨黛 ➔ 花青 ➔ 晨曦远天)
  const skyGrad = ctx.createLinearGradient(scrollX, scrollY, scrollX, scrollY + scrollH);
  skyGrad.addColorStop(0, "#050e14");
  skyGrad.addColorStop(0.35, "#081b24");
  skyGrad.addColorStop(0.60, "#0d282b");
  skyGrad.addColorStop(0.85, "#103230");
  skyGrad.addColorStop(1, "#030a0e");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(scrollX, scrollY, scrollW, scrollH);

  // 天际晨曦温润漫射晕 (Soft Dawn Atmosphere)
  const dawnGlow = ctx.createRadialGradient(
    scrollX + scrollW * 0.20,
    scrollY + scrollH * 0.15,
    10,
    scrollX + scrollW * 0.20,
    scrollY + scrollH * 0.15,
    scrollW * 0.50
  );
  dawnGlow.addColorStop(0, `rgba(254, 240, 138, ${0.20 * lightRays})`);
  dawnGlow.addColorStop(0.4, `rgba(245, 158, 11, ${0.07 * lightRays})`);
  dawnGlow.addColorStop(0.8, "rgba(56, 189, 248, 0.02)");
  dawnGlow.addColorStop(1, "rgba(5, 14, 20, 0)");
  ctx.fillStyle = dawnGlow;
  ctx.fillRect(scrollX, scrollY, scrollW, scrollH);

  // ─── 3. 6 重宋画《千里江山》水墨层峦 ───
  const breathFactor = mountainBreath * smoothBass;
  const midVibe = smoothMid * 5;

  const mountainPalette = [
    { fillTop: "#0a2835", fillBottom: "#041219", alpha: 0.35, baseY: 0.22, speed: 0.22 },
    { fillTop: "#0d3742", fillBottom: "#061a22", alpha: 0.50, baseY: 0.29, speed: 0.32 },
    { fillTop: "#104746", fillBottom: "#072223", alpha: 0.65, baseY: 0.36, speed: 0.44 },
    { fillTop: "#12544a", fillBottom: "#082a25", alpha: 0.80, baseY: 0.44, speed: 0.58 },
    { fillTop: "#0f4236", fillBottom: "#06201a", alpha: 0.92, baseY: 0.51, speed: 0.72 },
    { fillTop: "#0a261f", fillBottom: "#03110d", alpha: 1.00, baseY: 0.56, speed: 0.88 },
  ];

  const mountainPaths: { points: { x: number; y: number }[]; color: string; alpha: number }[] = [];

  for (let layer = 0; layer < 6; layer++) {
    const config = mountainPalette[layer];
    const layerDepth = (layer + 1) / 6;
    const basePeakHeight = scrollH * (config.baseY * 0.85);
    const layerTime = t * config.speed;
    const layerAmp = (basePeakHeight * 0.38 + breathFactor * 24 * layerDepth) * (1 + (layer >= 4 ? midVibe * 0.02 : 0));

    const points: { x: number; y: number }[] = [];
    ctx.beginPath();
    ctx.moveTo(scrollX, waterY + 40);

    const step = 4;
    for (let x = scrollX; x <= scrollX + scrollW; x += step) {
      const normX = (x - scrollX) / scrollW;
      const h1 = Math.sin(normX * (2.4 + layer * 1.1) + layerTime + layer * 1.6);
      const h2 = Math.cos(normX * (5.5 + layer * 1.5) - layerTime * 0.4 + layer);
      const h3 = Math.sin(normX * 11.0 + layerTime * 0.9) * 0.25;
      const h4 = Math.cos(normX * 20.0 - layerTime * 1.4) * 0.08;
      const mountainCurve = (h1 * 0.60 + h2 * 0.28 + h3 * 0.08 + h4 * 0.04);

      const y = waterY - basePeakHeight - mountainCurve * layerAmp;
      points.push({ x, y });
      ctx.lineTo(x, y);
    }

    ctx.lineTo(scrollX + scrollW, waterY + 40);
    ctx.closePath();

    mountainPaths.push({ points, color: config.fillTop, alpha: config.alpha });

    const mtnGrad = ctx.createLinearGradient(
      scrollX + scrollW * 0.22,
      waterY - basePeakHeight * 1.4,
      scrollX + scrollW * 0.5,
      waterY + 20
    );
    mtnGrad.addColorStop(0, config.fillTop);
    mtnGrad.addColorStop(0.7, config.fillBottom);
    mtnGrad.addColorStop(1, "rgba(3, 10, 14, 0.98)");

    ctx.fillStyle = mtnGrad;
    ctx.globalAlpha = config.alpha;
    ctx.fill();

    if (layer >= 4) {
      ctx.strokeStyle = layer === 5 ? "rgba(251, 191, 36, 0.22)" : "rgba(74, 222, 128, 0.16)";
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = (0.18 + smoothMid * 0.3) * goldGlow;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1.0;

  // ─── 4. 全柔焦高斯山坳透光 (Mountain Saddle Pass Glow - 绝无生硬横条) ───
  const rayStrength = lightRays * (0.5 + smoothBass * 0.6 + smoothEnergy * 0.2);
  if (rayStrength > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const lightCenterX = scrollX + scrollW * 0.22;
    const lightCenterY = scrollY + scrollH * 0.10;

    // 广角全柔焦高斯光晕 (圆形羽化扩散)
    for (let g = 0; g < 4; g++) {
      const radius = scrollW * (0.25 + g * 0.16);
      const alpha = (0.13 / (g + 1)) * rayStrength;

      const diffuseGrd = ctx.createRadialGradient(
        lightCenterX,
        lightCenterY,
        5,
        lightCenterX + scrollW * 0.12,
        lightCenterY + scrollH * 0.28,
        radius
      );
      diffuseGrd.addColorStop(0, `rgba(254, 240, 138, ${alpha * 1.3})`);
      diffuseGrd.addColorStop(0.35, `rgba(251, 191, 36, ${alpha * 0.7})`);
      diffuseGrd.addColorStop(0.70, `rgba(56, 189, 248, ${alpha * 0.15})`);
      diffuseGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = diffuseGrd;
      ctx.beginPath();
      ctx.arc(lightCenterX + scrollW * 0.12, lightCenterY + scrollH * 0.28, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 山坳峡谷处的柔焦微光云岫 (2D 高斯椭圆，绝无矩形直角)
    if (smoothBass > 0.35 || smoothMid > 0.40) {
      const cloudAlpha = Math.min(0.28, (Math.max(smoothBass, smoothMid) - 0.25) * 0.45) * goldGlow;
      const valleyX = scrollX + scrollW * 0.42;
      const valleyY = waterY - scrollH * 0.16;

      const valleyGrd = ctx.createRadialGradient(
        valleyX,
        valleyY,
        10,
        valleyX,
        valleyY,
        scrollW * 0.28
      );
      valleyGrd.addColorStop(0, `rgba(254, 240, 138, ${cloudAlpha})`);
      valleyGrd.addColorStop(0.4, `rgba(251, 191, 36, ${cloudAlpha * 0.45})`);
      valleyGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = valleyGrd;
      ctx.beginPath();
      ctx.ellipse(valleyX, valleyY, scrollW * 0.28, scrollH * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ─── 5. 水天融界 · 真实倒影与多团高斯流体水雾 ───
  const waterH = scrollY + scrollH - waterY;
  const waterGrad = ctx.createLinearGradient(scrollX, waterY, scrollX, scrollY + scrollH);
  waterGrad.addColorStop(0, "rgba(3, 10, 14, 0.85)");
  waterGrad.addColorStop(0.4, "rgba(4, 15, 20, 0.95)");
  waterGrad.addColorStop(1, "rgba(2, 6, 9, 1.0)");
  ctx.fillStyle = waterGrad;
  ctx.fillRect(scrollX, waterY, scrollW, waterH);

  // 渲染水面倒影
  ctx.save();
  ctx.beginPath();
  ctx.rect(scrollX, waterY, scrollW, waterH);
  ctx.clip();

  for (let l = mountainPaths.length - 1; l >= 2; l--) {
    const m = mountainPaths[l];
    ctx.beginPath();
    ctx.moveTo(scrollX, waterY);
    for (let i = 0; i < m.points.length; i++) {
      const p = m.points[i];
      const distFromWater = waterY - p.y;
      const waveShift = Math.sin((p.x - scrollX) * 0.03 + t * 1.8 + l) * (1.2 + smoothBass * 2.0);
      const reflectY = waterY + distFromWater * 0.48 + waveShift;
      ctx.lineTo(p.x, reflectY);
    }
    ctx.lineTo(scrollX + scrollW, waterY);
    ctx.closePath();

    ctx.fillStyle = m.color;
    ctx.globalAlpha = m.alpha * 0.20;
    ctx.fill();
  }
  ctx.restore();

  // 烟波浩渺 · 10 个漂移的高斯流体水雾团 (彻底消除矩形带)
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  localMistPuffs.forEach((puff: MistPuff) => {
    puff.x += puff.vx;
    if (puff.x < scrollX - 80) puff.x = scrollX + scrollW + 60;
    if (puff.x > scrollX + scrollW + 80) puff.x = scrollX - 60;

    const dynamicAlpha = puff.alpha * (0.7 + Math.sin(t * 1.5 + puff.phase) * 0.3 + smoothBass * 0.35);
    const mistGrd = ctx.createRadialGradient(puff.x, puff.y, 5, puff.x, puff.y, puff.radius);
    mistGrd.addColorStop(0, `rgba(180, 230, 225, ${dynamicAlpha})`);
    mistGrd.addColorStop(0.5, `rgba(150, 215, 210, ${dynamicAlpha * 0.5})`);
    mistGrd.addColorStop(1, "rgba(180, 230, 225, 0)");

    ctx.fillStyle = mistGrd;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // 有机多八度微波与碎金粼粼 (两端余弦渐隐，绝无通栏硬线)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const waveCount = 10;
  for (let w = 0; w < waveCount; w++) {
    const waveY = waterY + ((w + 1) / (waveCount + 1)) * waterH;
    const wavePhase = t * 1.1 + w * 0.75;
    const waveAlpha = (0.035 + Math.sin(wavePhase) * 0.02 + smoothTreble * 0.05) * (w > 5 ? 0.4 : 1.0);

    ctx.strokeStyle = `rgba(251, 191, 36, ${Math.max(0, waveAlpha) * goldGlow})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    let started = false;
    for (let x = scrollX + 30; x <= scrollX + scrollW - 30; x += 16) {
      const normX = (x - scrollX) / scrollW;
      const windowEdge = Math.sin(normX * Math.PI); // 两端自然淡出为 0
      const dy = Math.sin((x - scrollX) * 0.03 + wavePhase) * (0.8 + smoothBass * 1.4) * windowEdge;
      if (!started) {
        ctx.moveTo(x, waveY + dy);
        started = true;
      } else {
        ctx.lineTo(x, waveY + dy);
      }
    }
    ctx.stroke();
  }

  // 同心圆涟漪
  localRipples.forEach((rip: WaterRipple, idx: number) => {
    rip.radius += rip.speed;
    rip.alpha *= 0.965;

    if (rip.alpha > 0.02) {
      ctx.strokeStyle = `rgba(56, 189, 248, ${rip.alpha * 0.45})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(rip.x, rip.y, rip.radius, rip.radius * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      localRipples.splice(idx, 1);
    }
  });

  // ─── 6. 孤舟蓑笠与微芒渔火 ───
  const boatX = scrollX + scrollW * 0.75;
  const boatY = waterY + 14 + Math.sin(t * 1.5) * 2.0;

  ctx.fillStyle = "rgba(8, 16, 20, 0.92)";
  ctx.beginPath();
  ctx.moveTo(boatX - 16, boatY);
  ctx.quadraticCurveTo(boatX, boatY + 4, boatX + 16, boatY);
  ctx.quadraticCurveTo(boatX, boatY + 0.8, boatX - 16, boatY);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(boatX - 2, boatY - 1.5, 6, Math.PI, 0);
  ctx.fill();

  const lanternX = boatX + 10;
  const lanternY = boatY - 3;
  const lanternGlow = ctx.createRadialGradient(lanternX, lanternY, 1, lanternX, lanternY, 16);
  const lanternPulse = 0.75 + Math.sin(t * 3.0) * 0.25 + smoothMid * 0.3;
  lanternGlow.addColorStop(0, `rgba(254, 240, 138, ${0.80 * lanternPulse})`);
  lanternGlow.addColorStop(0.4, `rgba(245, 158, 11, ${0.35 * lanternPulse})`);
  lanternGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = lanternGlow;
  ctx.beginPath();
  ctx.arc(lanternX, lanternY, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // ─── 7. 半透明落英与金粉微尘 ───
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  localParticles.forEach((p: DustParticle) => {
    p.x += p.vx + Math.sin(t + p.phase) * 0.25;
    p.y += p.vy;
    if (p.y < scrollY) {
      p.y = scrollY + scrollH + 6;
      p.x = scrollX + Math.random() * scrollW;
    }
    if (p.x < scrollX) p.x = scrollX + scrollW;
    if (p.x > scrollX + scrollW) p.x = scrollX;

    const particleAlpha = p.alpha * (0.4 + Math.sin(t * 2.0 + p.phase) * 0.3);
    ctx.fillStyle = `rgba(251, 191, 36, ${particleAlpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  localPetals.forEach((petal: GoldenPetal) => {
    petal.x += petal.vx + Math.sin(t * 1.2 + petal.phase) * 0.35;
    petal.y += petal.vy;
    petal.rotation += petal.vRot;

    if (petal.y > scrollY + scrollH + 10) {
      petal.y = scrollY - 10;
      petal.x = scrollX + Math.random() * scrollW;
    }
    if (petal.x > scrollX + scrollW + 10) petal.x = scrollX - 10;

    ctx.save();
    ctx.translate(petal.x, petal.y);
    ctx.rotate(petal.rotation);

    const petalGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, petal.size);
    petalGrad.addColorStop(0, `rgba(254, 235, 200, ${petal.alpha * 1.2})`);
    petalGrad.addColorStop(0.6, `rgba(245, 200, 160, ${petal.alpha * 0.7})`);
    petalGrad.addColorStop(1, "rgba(245, 180, 140, 0)");
    ctx.fillStyle = petalGrad;

    ctx.beginPath();
    ctx.ellipse(0, 0, petal.size, petal.size * petal.aspect, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  ctx.restore();

  // ─── 8. 东方长卷极简淡金诗意留白 ───
  ctx.save();
  const textX = scrollX + 36;
  const textY = scrollY + 36;

  ctx.fillStyle = "rgba(245, 235, 215, 0.28)";
  ctx.font = "12px serif";
  ctx.textAlign = "center";
  ctx.fillText("千", textX, textY);
  ctx.fillText("里", textX, textY + 16);
  ctx.fillText("江", textX, textY + 32);
  ctx.fillText("山", textX, textY + 48);
  ctx.restore();

  // 电影级胶片暗角 (Film Vignette)
  if (filmVignette > 0) {
    const vigGrd = ctx.createRadialGradient(
      scrollX + scrollW / 2,
      scrollY + scrollH / 2,
      scrollW * 0.35,
      scrollX + scrollW / 2,
      scrollY + scrollH / 2,
      scrollW * 0.70
    );
    vigGrd.addColorStop(0, "rgba(0,0,0,0)");
    vigGrd.addColorStop(1, `rgba(0,0,0,${filmVignette * 0.72})`);
    ctx.fillStyle = vigGrd;
    ctx.fillRect(scrollX, scrollY, scrollW, scrollH);
  }

  // ─── 9. 绢帛羽化微边 ───
  ctx.restore(); // 退出剪裁

  ctx.strokeStyle = `rgba(251, 191, 36, ${0.12 * goldGlow})`;
  ctx.lineWidth = 0.8;
  roundRect(ctx, scrollX, scrollY, scrollW, scrollH, 16);
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
