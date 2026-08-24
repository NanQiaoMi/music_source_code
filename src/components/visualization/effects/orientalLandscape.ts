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

interface LakeMist {
  x: number;
  y: number;
  vx: number;
  radiusX: number;
  radiusY: number;
  alpha: number;
  phase: number;
}

let localRipples: WaterRipple[] = [];
let localPetals: GoldenPetal[] = [];
let localParticles: DustParticle[] = [];
let localMists: LakeMist[] = [];
let lastRippleTime = 0;
let initialized = false;

// 平滑阻尼追踪器 (EMA Damping: 32 极平滑呼吸)
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;
let smoothEnergy = 0;

function initLivingElements(width: number, height: number, waterY: number) {
  localParticles = [];
  for (let i = 0; i < 45; i++) {
    localParticles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: -Math.random() * 0.32 - 0.08,
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
      vx: (Math.random() - 0.5) * 0.28 + 0.12,
      vy: Math.random() * 0.24 + 0.12,
      size: Math.random() * 3.5 + 1.8,
      alpha: Math.random() * 0.22 + 0.1,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.02,
      aspect: 0.35 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
    });
  }

  localMists = [];
  for (let i = 0; i < 8; i++) {
    localMists.push({
      x: Math.random() * width,
      y: waterY + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 0.15 + 0.05,
      radiusX: Math.random() * 120 + 80,
      radiusY: Math.random() * 25 + 15,
      alpha: Math.random() * 0.08 + 0.04,
      phase: Math.random() * Math.PI * 2,
    });
  }

  initialized = true;
}

/**
 * 120 FPS 宋画清幽 · 电影级柔焦水墨长卷 (Oriental Serene Landscape)
 * 极致清幽优雅：
 * 1. 彻底消除水天水平硬切线：水体自山腰至深潭以 0 阶跃连续渐变无缝融合；
 * 2. 全柔焦无硬边丁达尔光束（Anti-Aliased Gaussian Volumetric Rays），双向平滑羽化，绝无硬三角形棱角；
 * 3. 山峦通底闭合（底部 scrollY + scrollH + 40），宋代重彩矿物青绿叠染；
 * 4. 半透明轻柔落英、一叶孤舟与轻晃渔火，意境空灵雅致。
 */
export function drawOrientalLandscape(context: EffectContext): void {
  const { ctx, width, height, data, time, params } = context;
  if (!width || !height || width <= 0 || height <= 0) return;

  const lightRays = params?.lightRays ?? 1.0;
  const mountainBreath = params?.mountainBreath ?? 1.0;
  const waterRipple = params?.waterRipple ?? 1.0;
  const goldGlow = params?.goldGlow ?? 1.0;
  const filmVignette = params?.filmVignette ?? 0.65;

  // 1. 低通音频平滑滤波 (EMA Filtering, Damping: 32 带来空灵大气的呼吸感)
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

  smoothBass += (rawBass - smoothBass) * 0.032;
  smoothMid += (rawMid - smoothMid) * 0.052;
  smoothTreble += (rawTreble - smoothTreble) * 0.072;
  smoothEnergy += (rawEnergy - smoothEnergy) * 0.042;

  if (context.refs.smoothBass) context.refs.smoothBass.current = smoothBass;
  if (context.refs.smoothMid) context.refs.smoothMid.current = smoothMid;
  if (context.refs.smoothTreble) context.refs.smoothTreble.current = smoothTreble;

  const t = time * 0.00065;

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
  const bottomY = scrollY + scrollH + 40;

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

  // ─── 1. 外部暗夜背景 ───
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
    scrollX + scrollW * 0.18,
    scrollY + scrollH * 0.12,
    10,
    scrollX + scrollW * 0.18,
    scrollY + scrollH * 0.12,
    scrollW * 0.55
  );
  dawnGlow.addColorStop(0, `rgba(254, 240, 138, ${0.22 * lightRays})`);
  dawnGlow.addColorStop(0.4, `rgba(245, 158, 11, ${0.08 * lightRays})`);
  dawnGlow.addColorStop(0.8, "rgba(56, 189, 248, 0.02)");
  dawnGlow.addColorStop(1, "rgba(5, 14, 20, 0)");
  ctx.fillStyle = dawnGlow;
  ctx.fillRect(scrollX, scrollY, scrollW, scrollH);

  // ─── 3. 6 重宋画《千里江山》水墨层峦 (通底自然晕染) ───
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
    ctx.moveTo(scrollX, bottomY);

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

    ctx.lineTo(scrollX + scrollW, bottomY);
    ctx.closePath();

    mountainPaths.push({ points, color: config.fillTop, alpha: config.alpha });

    const mtnGrad = ctx.createLinearGradient(
      scrollX + scrollW * 0.22,
      waterY - basePeakHeight * 1.4,
      scrollX + scrollW * 0.5,
      bottomY
    );
    mtnGrad.addColorStop(0, config.fillTop);
    mtnGrad.addColorStop(0.55, config.fillBottom);
    mtnGrad.addColorStop(1, "rgba(2, 6, 9, 0.98)");

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

  // ─── 4. 全柔焦无硬边高斯体积丁达尔光束 (True Gaussian Soft God Rays) ───
  const rayStrength = lightRays * (0.55 + smoothBass * 0.65 + smoothEnergy * 0.25);
  if (rayStrength > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const lightOriginX = scrollX + scrollW * 0.16;
    const lightOriginY = scrollY - 20;

    // 5 条斜向柔焦光束（利用旋转坐标系与双向高斯羽化渐变，彻底杜绝硬三角形棱角）
    const rayAngles = [0.29, 0.36, 0.44, 0.52, 0.60];
    const rayWidths = [45, 60, 70, 55, 40];
    const rayIntensities = [0.25, 0.35, 0.40, 0.32, 0.22];
    const rayLen = scrollH * 1.65;

    for (let r = 0; r < rayAngles.length; r++) {
      const baseAngle = Math.PI * rayAngles[r] + Math.sin(t * 0.3 + r * 1.1) * 0.025;
      const beamHalfW = rayWidths[r] * (0.85 + smoothBass * 0.25);
      const beamAlpha = rayIntensities[r] * rayStrength * 0.30;

      ctx.save();
      ctx.translate(lightOriginX, lightOriginY);
      ctx.rotate(baseAngle - Math.PI / 2); // 旋转对齐光束主轴

      // 横向平滑高斯余弦羽化渐变 (X 轴: -beamHalfW ➔ 0 ➔ +beamHalfW)
      const beamXGrad = ctx.createLinearGradient(-beamHalfW, 0, beamHalfW, 0);
      beamXGrad.addColorStop(0, "rgba(254, 240, 138, 0)");
      beamXGrad.addColorStop(0.3, `rgba(254, 240, 138, ${beamAlpha * 0.5})`);
      beamXGrad.addColorStop(0.5, `rgba(254, 240, 138, ${beamAlpha})`);
      beamXGrad.addColorStop(0.7, `rgba(254, 240, 138, ${beamAlpha * 0.5})`);
      beamXGrad.addColorStop(1, "rgba(254, 240, 138, 0)");

      ctx.fillStyle = beamXGrad;

      // 纵向衰减 (Y 轴: 0 ➔ rayLen)
      const beamRectH = rayLen;
      ctx.fillRect(-beamHalfW, 0, beamHalfW * 2, beamRectH);

      ctx.restore();
    }

    // 晨曦源头超大柔焦散射晕 (Atmospheric Broad Bloom)
    const sourceBloom = ctx.createRadialGradient(
      lightOriginX,
      lightOriginY,
      5,
      lightOriginX + scrollW * 0.15,
      lightOriginY + scrollH * 0.35,
      scrollW * 0.50
    );
    sourceBloom.addColorStop(0, `rgba(254, 240, 138, ${0.38 * rayStrength})`);
    sourceBloom.addColorStop(0.35, `rgba(251, 191, 36, ${0.16 * rayStrength})`);
    sourceBloom.addColorStop(0.70, `rgba(56, 189, 248, ${0.04 * rayStrength})`);
    sourceBloom.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = sourceBloom;
    ctx.beginPath();
    ctx.arc(lightOriginX + scrollW * 0.15, lightOriginY + scrollH * 0.35, scrollW * 0.50, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ─── 5. 水天融界 · 无缝深潭水墨水体与倒影 (Seamless Lake Blend, Zero Horizontal Line) ───
  // 从水天交界上方 60px 以 0 透明度平滑过渡入深潭水墨，彻底根除水平切线
  const lakeFadeTop = waterY - 50;
  const lakeFadeH = scrollY + scrollH - lakeFadeTop;
  const waterGrad = ctx.createLinearGradient(scrollX, lakeFadeTop, scrollX, scrollY + scrollH);
  waterGrad.addColorStop(0, "rgba(3, 10, 14, 0.0)");
  waterGrad.addColorStop(0.30, "rgba(3, 10, 14, 0.70)");
  waterGrad.addColorStop(0.65, "rgba(4, 15, 20, 0.94)");
  waterGrad.addColorStop(1, "rgba(2, 6, 9, 1.0)");
  ctx.fillStyle = waterGrad;
  ctx.fillRect(scrollX, lakeFadeTop, scrollW, lakeFadeH);

  // 水面倒影自然翻折
  ctx.save();
  ctx.beginPath();
  ctx.rect(scrollX, waterY, scrollW, scrollY + scrollH - waterY);
  ctx.clip();

  for (let l = mountainPaths.length - 1; l >= 2; l--) {
    const m = mountainPaths[l];
    ctx.beginPath();
    ctx.moveTo(scrollX, waterY);
    for (let i = 0; i < m.points.length; i++) {
      const p = m.points[i];
      const distFromWater = waterY - p.y;
      const waveShift = Math.sin((p.x - scrollX) * 0.03 + t * 1.8 + l) * (1.2 + smoothBass * 2.0);
      const reflectY = waterY + distFromWater * 0.45 + waveShift;
      ctx.lineTo(p.x, reflectY);
    }
    ctx.lineTo(scrollX + scrollW, waterY);
    ctx.closePath();

    ctx.fillStyle = m.color;
    ctx.globalAlpha = m.alpha * 0.18;
    ctx.fill();
  }
  ctx.restore();

  // 烟波浩渺 · 湖面高斯流动薄雾 (Drifting Lake Mist)
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  localMists.forEach((mist: LakeMist) => {
    mist.x += mist.vx;
    if (mist.x < scrollX - 100) mist.x = scrollX + scrollW + 80;
    if (mist.x > scrollX + scrollW + 100) mist.x = scrollX - 80;

    const dynamicAlpha = mist.alpha * (0.7 + Math.sin(t * 1.4 + mist.phase) * 0.3 + smoothBass * 0.3);
    const mistGrd = ctx.createRadialGradient(mist.x, mist.y, 5, mist.x, mist.y, mist.radiusX);
    mistGrd.addColorStop(0, `rgba(180, 230, 225, ${dynamicAlpha})`);
    mistGrd.addColorStop(0.5, `rgba(150, 215, 210, ${dynamicAlpha * 0.4})`);
    mistGrd.addColorStop(1, "rgba(180, 230, 225, 0)");

    ctx.fillStyle = mistGrd;
    ctx.beginPath();
    ctx.ellipse(mist.x, mist.y, mist.radiusX, mist.radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // 有机多八度微波与碎金粼粼
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const waveCount = 10;
  for (let w = 0; w < waveCount; w++) {
    const waveY = waterY + ((w + 1) / (waveCount + 1)) * (scrollY + scrollH - waterY);
    const wavePhase = t * 1.1 + w * 0.75;
    const waveAlpha = (0.035 + Math.sin(wavePhase) * 0.02 + smoothTreble * 0.05) * (w > 5 ? 0.4 : 1.0);

    ctx.strokeStyle = `rgba(251, 191, 36, ${Math.max(0, waveAlpha) * goldGlow})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    let started = false;
    for (let x = scrollX + 30; x <= scrollX + scrollW - 30; x += 16) {
      const normX = (x - scrollX) / scrollW;
      const windowEdge = Math.sin(normX * Math.PI);
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
