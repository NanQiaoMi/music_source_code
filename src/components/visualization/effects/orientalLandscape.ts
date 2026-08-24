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

let localRipples: WaterRipple[] = [];
let localPetals: GoldenPetal[] = [];
let localParticles: DustParticle[] = [];
let lastRippleTime = 0;
let initialized = false;

// 平滑阻尼追踪器 (EMA Damping: 32 极平滑呼吸)
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;
let smoothEnergy = 0;

function initLivingElements(width: number, height: number) {
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

  initialized = true;
}

/**
 * 120 FPS 宋画清幽 · 电影级柔焦水墨长卷 (Oriental Serene Landscape)
 * 极致清幽优雅：
 * 1. 彻底清除生硬白色椭圆雾盘与水平色块断层，全画面浑然一体；
 * 2. 全柔焦无硬边丁达尔光束（Anti-Aliased Gaussian Volumetric Rays），双向平滑羽化；
 * 3. 宋代青绿重彩自然沉入深潭水墨，水面倒影如镜；
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
  const bottomY = scrollY + scrollH + 30;

  if (!initialized || localParticles.length === 0) {
    initLivingElements(width, height);
  }

  // 泛音微波涟漪生成
  if (smoothTreble > 0.36 && t - lastRippleTime > 0.30) {
    lastRippleTime = t;
    if (localRipples.length < 5) {
      localRipples.push({
        x: width * (0.36 + Math.random() * 0.36),
        y: waterY + 15 + Math.random() * 35,
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

  // 宣纸天际古色渐变 (深邃墨黛 ➔ 花青 ➔ 晨曦远天 ➔ 幽深水体)
  const skyGrad = ctx.createLinearGradient(scrollX, scrollY, scrollX, scrollY + scrollH);
  skyGrad.addColorStop(0, "#050e14");
  skyGrad.addColorStop(0.35, "#081b24");
  skyGrad.addColorStop(0.58, "#0a2228");
  skyGrad.addColorStop(0.75, "#06151a");
  skyGrad.addColorStop(1, "#03080b");
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

  // ─── 3. 6 重宋画《千里江山》水墨层峦 (自然渐变入深潭，绝无色块断层) ───
  const breathFactor = mountainBreath * smoothBass;
  const midVibe = smoothMid * 5;

  const mountainPalette = [
    { fillTop: "#0b2633", fillBottom: "#041017", alpha: 0.40, baseY: 0.22, speed: 0.22 },
    { fillTop: "#0d313c", fillBottom: "#05151c", alpha: 0.55, baseY: 0.29, speed: 0.32 },
    { fillTop: "#103c3e", fillBottom: "#071b1e", alpha: 0.70, baseY: 0.36, speed: 0.44 },
    { fillTop: "#124740", fillBottom: "#08211e", alpha: 0.82, baseY: 0.44, speed: 0.58 },
    { fillTop: "#0f3a32", fillBottom: "#061815", alpha: 0.92, baseY: 0.51, speed: 0.72 },
    { fillTop: "#0a241e", fillBottom: "#030e0b", alpha: 1.00, baseY: 0.56, speed: 0.88 },
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

    // 山体从山峰自然向下浸润至深水水墨色，平滑无界
    const mtnGrad = ctx.createLinearGradient(
      scrollX + scrollW * 0.22,
      waterY - basePeakHeight * 1.3,
      scrollX + scrollW * 0.35,
      waterY + scrollH * 0.30
    );
    mtnGrad.addColorStop(0, config.fillTop);
    mtnGrad.addColorStop(0.45, config.fillBottom);
    mtnGrad.addColorStop(0.85, "rgba(4, 12, 16, 0.95)");
    mtnGrad.addColorStop(1, "rgba(2, 6, 9, 1.0)");

    ctx.fillStyle = mtnGrad;
    ctx.globalAlpha = config.alpha;
    ctx.fill();

    if (layer >= 4) {
      ctx.strokeStyle = layer === 5 ? "rgba(251, 191, 36, 0.20)" : "rgba(74, 222, 128, 0.14)";
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = (0.16 + smoothMid * 0.28) * goldGlow;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1.0;

  // ─── 4. 电影级柔焦单束神光 · 左右悠扬摇摆与动态呼吸 (Single Swaying Volumetric Ray) ───
  const rayStrength = lightRays * (0.55 + smoothBass * 0.65 + smoothEnergy * 0.25);
  if (rayStrength > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // 光源原点在左上角悠扬微动
    const lightOriginX = scrollX + scrollW * 0.18 + Math.sin(t * 0.4) * (scrollW * 0.02);
    const lightOriginY = scrollY - 15 + Math.cos(t * 0.35) * 8;

    // 左右柔和悠扬摇摆主角度 (约 35°~52° 之间慢速摆动)
    const swayAngle = Math.sin(t * 0.52) * 0.09 + Math.cos(t * 0.26) * 0.05 + smoothBass * 0.03;
    const masterAngle = Math.PI * 0.42 + swayAngle;
    const rayLen = scrollH * 1.85;

    // 光束范围随低频深呼吸收放变化 (Dynamic Beam Spread)
    const baseWidth = scrollW * (0.16 + smoothBass * 0.14 + smoothEnergy * 0.06);

    ctx.save();
    ctx.translate(lightOriginX, lightOriginY);
    ctx.rotate(masterAngle - Math.PI / 2); // 旋转对齐光束主轴

    // 1. 广角超柔外围光晕 (Wide Ambient Soft Aura)
    const wideW = baseWidth * 2.2;
    const wideGrad = ctx.createLinearGradient(-wideW, 0, wideW, 0);
    wideGrad.addColorStop(0, "rgba(254, 240, 138, 0)");
    wideGrad.addColorStop(0.35, `rgba(245, 158, 11, ${0.06 * rayStrength})`);
    wideGrad.addColorStop(0.5, `rgba(254, 240, 138, ${0.12 * rayStrength})`);
    wideGrad.addColorStop(0.65, `rgba(245, 158, 11, ${0.06 * rayStrength})`);
    wideGrad.addColorStop(1, "rgba(254, 240, 138, 0)");
    ctx.fillStyle = wideGrad;
    ctx.fillRect(-wideW, 0, wideW * 2, rayLen);

    // 2. 主体积神光柱 (Main Volumetric God Ray, 极其柔和的高斯双向羽化)
    const mainW = baseWidth;
    const mainGrad = ctx.createLinearGradient(-mainW, 0, mainW, 0);
    mainGrad.addColorStop(0, "rgba(254, 240, 138, 0)");
    mainGrad.addColorStop(0.25, `rgba(251, 191, 36, ${0.16 * rayStrength})`);
    mainGrad.addColorStop(0.5, `rgba(254, 240, 138, ${0.36 * rayStrength})`);
    mainGrad.addColorStop(0.75, `rgba(251, 191, 36, ${0.16 * rayStrength})`);
    mainGrad.addColorStop(1, "rgba(254, 240, 138, 0)");
    ctx.fillStyle = mainGrad;
    ctx.fillRect(-mainW, 0, mainW * 2, rayLen);

    // 3. 核心温润光轴 (Radiant Core Beam)
    const coreW = baseWidth * 0.42;
    const coreGrad = ctx.createLinearGradient(-coreW, 0, coreW, 0);
    coreGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
    coreGrad.addColorStop(0.3, `rgba(254, 243, 199, ${0.28 * rayStrength})`);
    coreGrad.addColorStop(0.5, `rgba(255, 255, 240, ${0.45 * rayStrength})`);
    coreGrad.addColorStop(0.7, `rgba(254, 243, 199, ${0.28 * rayStrength})`);
    coreGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = coreGrad;
    ctx.fillRect(-coreW, 0, coreW * 2, rayLen * 0.9);

    ctx.restore();

    // 晨曦源头超大柔焦散射晕 (Atmospheric Broad Bloom)
    const sourceBloom = ctx.createRadialGradient(
      lightOriginX,
      lightOriginY,
      5,
      lightOriginX + scrollW * 0.15,
      lightOriginY + scrollH * 0.35,
      scrollW * 0.52
    );
    sourceBloom.addColorStop(0, `rgba(254, 240, 138, ${0.35 * rayStrength})`);
    sourceBloom.addColorStop(0.35, `rgba(251, 191, 36, ${0.15 * rayStrength})`);
    sourceBloom.addColorStop(0.70, `rgba(56, 189, 248, ${0.03 * rayStrength})`);
    sourceBloom.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = sourceBloom;
    ctx.beginPath();
    ctx.arc(lightOriginX + scrollW * 0.15, lightOriginY + scrollH * 0.35, scrollW * 0.52, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ─── 5. 水天融界 · 水面镜像倒影与水波 ───
  const waterH = scrollY + scrollH - waterY;

  // 倒影自然翻折
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
      const reflectY = waterY + distFromWater * 0.42 + waveShift;
      ctx.lineTo(p.x, reflectY);
    }
    ctx.lineTo(scrollX + scrollW, waterY);
    ctx.closePath();

    ctx.fillStyle = m.color;
    ctx.globalAlpha = m.alpha * 0.15;
    ctx.fill();
  }
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
