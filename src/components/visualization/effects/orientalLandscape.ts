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

// 平滑阻尼追踪器 (EMA Damping)
let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;
let smoothEnergy = 0;

function initLivingElements(width: number, height: number) {
  localParticles = [];
  for (let i = 0; i < 50; i++) {
    localParticles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -Math.random() * 0.45 - 0.15,
      size: Math.random() * 2.2 + 0.8,
      alpha: Math.random() * 0.65 + 0.25,
      phase: Math.random() * Math.PI * 2,
    });
  }

  localPetals = [];
  for (let i = 0; i < 20; i++) {
    localPetals.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5 + 0.2,
      vy: Math.random() * 0.4 + 0.2,
      size: Math.random() * 4.5 + 2.5,
      alpha: Math.random() * 0.6 + 0.3,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.03,
      aspect: 0.4 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    });
  }

  initialized = true;
}

/**
 * 120 FPS 东方青绿水墨重彩 · 电影级丁达尔神光画卷 (Oriental Cinematic Scroll)
 * 核心升级：6重千里江山真迹矿物石色层峦、柔焦高斯体积散射神光、真实水镜倒影与水波折射、山谷流云薄雾、孤舟蓑笠渔火、东方书法印章
 */
export function drawOrientalLandscape(context: EffectContext): void {
  const { ctx, width, height, data, time, params } = context;
  if (!width || !height || width <= 0 || height <= 0) return;

  const lightRays = params?.lightRays ?? 1.0;
  const mountainBreath = params?.mountainBreath ?? 1.0;
  const waterRipple = params?.waterRipple ?? 1.0;
  const goldGlow = params?.goldGlow ?? 1.2;
  const filmVignette = params?.filmVignette ?? 0.65;

  // 1. 低通音频平滑滤波 (EMA Filtering, Damping: 55)
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

  smoothBass += (rawBass - smoothBass) * 0.055;
  smoothMid += (rawMid - smoothMid) * 0.075;
  smoothTreble += (rawTreble - smoothTreble) * 0.095;
  smoothEnergy += (rawEnergy - smoothEnergy) * 0.065;

  if (context.refs.smoothBass) context.refs.smoothBass.current = smoothBass;
  if (context.refs.smoothMid) context.refs.smoothMid.current = smoothMid;
  if (context.refs.smoothTreble) context.refs.smoothTreble.current = smoothTreble;

  const t = time * 0.00085;

  if (!initialized || localParticles.length === 0) {
    initLivingElements(width, height);
  }

  // 泛音高频涟漪生成 (笛箫/古筝泛音)
  if (smoothTreble > 0.32 && t - lastRippleTime > 0.22) {
    lastRippleTime = t;
    if (localRipples.length < 8) {
      localRipples.push({
        x: width * (0.28 + Math.random() * 0.44),
        y: height * (0.64 + Math.random() * 0.14),
        radius: 6,
        maxRadius: Math.min(width, height) * 0.32,
        alpha: 0.9 * waterRipple,
        speed: 1.8 + smoothTreble * 2.5,
      });
    }
  }

  ctx.save();

  // ─── 1. 外部暗夜背景与深邃极光渐晕 ───
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, width, height);

  const ambientGlow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    width * 0.06,
    width * 0.5,
    height * 0.45,
    width * 0.72
  );
  ambientGlow.addColorStop(0, "rgba(12, 65, 88, 0.32)");
  ambientGlow.addColorStop(0.45, "rgba(22, 78, 73, 0.16)");
  ambientGlow.addColorStop(1, "rgba(5, 7, 10, 0)");
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(0, 0, width, height);

  // ─── 2. 2.35:1 宽银幕电影绢帛画幅 (羽化画境，消除生硬黄色外框) ───
  const maxScrollW = width * 0.92;
  const targetAspect = 2.35;
  let scrollW = maxScrollW;
  let scrollH = scrollW / targetAspect;

  if (scrollH > height * 0.76) {
    scrollH = height * 0.76;
    scrollW = scrollH * targetAspect;
  }

  const scrollX = (width - scrollW) / 2;
  const scrollY = (height - scrollH) / 2;

  // 画卷内部剪裁
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, scrollX, scrollY, scrollW, scrollH, 20);
  ctx.clip();

  // 宣纸天际古色渐变 (《千里江山》远天晨曦)
  const skyGrad = ctx.createLinearGradient(scrollX, scrollY, scrollX, scrollY + scrollH);
  skyGrad.addColorStop(0, "#06131c");
  skyGrad.addColorStop(0.3, "#0a232f");
  skyGrad.addColorStop(0.55, "#103236");
  skyGrad.addColorStop(0.75, "#18453f");
  skyGrad.addColorStop(1, "#040e14");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(scrollX, scrollY, scrollW, scrollH);

  // 天际晨曦暖金光照晕染 (Sky Dawn Glow)
  const dawnGlow = ctx.createRadialGradient(
    scrollX + scrollW * 0.22,
    scrollY + scrollH * 0.15,
    10,
    scrollX + scrollW * 0.22,
    scrollY + scrollH * 0.15,
    scrollW * 0.45
  );
  dawnGlow.addColorStop(0, `rgba(251, 191, 36, ${0.28 * lightRays})`);
  dawnGlow.addColorStop(0.5, `rgba(245, 158, 11, ${0.12 * lightRays})`);
  dawnGlow.addColorStop(1, "rgba(6, 19, 28, 0)");
  ctx.fillStyle = dawnGlow;
  ctx.fillRect(scrollX, scrollY, scrollW, scrollH);

  // 水面分界线 Y 坐标
  const waterY = scrollY + scrollH * 0.60;

  // ─── 3. 6 重《千里江山图》青绿水墨山峦与山谷烟岚 (6-Layer Qinglu Peaks) ───
  const breathFactor = mountainBreath * smoothBass;
  const midVibe = smoothMid * 10;

  // 6 层真实矿物石色：石青 ➔ 头绿 ➔ 孔雀绿 ➔ 墨黛
  const mountainPalette = [
    { fillTop: "#0d3545", fillBottom: "#061822", rim: "#38bdf8", alpha: 0.40, baseY: 0.24, speed: 0.25 },
    { fillTop: "#104754", fillBottom: "#082129", rim: "#22d3ee", alpha: 0.55, baseY: 0.31, speed: 0.35 },
    { fillTop: "#145958", fillBottom: "#0b2b2c", rim: "#34d399", alpha: 0.70, baseY: 0.38, speed: 0.48 },
    { fillTop: "#176c5e", fillBottom: "#0e3831", rim: "#4ade80", alpha: 0.85, baseY: 0.46, speed: 0.62 },
    { fillTop: "#155745", fillBottom: "#0a2921", rim: "#a3e635", alpha: 0.94, baseY: 0.53, speed: 0.78 },
    { fillTop: "#0d2822", fillBottom: "#051613", rim: "#fbbf24", alpha: 1.00, baseY: 0.58, speed: 0.95 },
  ];

  // 记录各层山峰路径用于水镜倒影
  const mountainPaths: { points: { x: number; y: number }[]; color: string; alpha: number }[] = [];

  for (let layer = 0; layer < 6; layer++) {
    const config = mountainPalette[layer];
    const layerDepth = (layer + 1) / 6;
    const basePeakHeight = scrollH * (config.baseY * 0.85);
    const layerTime = t * config.speed;
    const layerAmp = (basePeakHeight * 0.42 + breathFactor * 32 * layerDepth) * (1 + (layer >= 4 ? midVibe * 0.03 : 0));

    const points: { x: number; y: number }[] = [];
    ctx.beginPath();
    ctx.moveTo(scrollX, waterY);

    const step = 4;
    for (let x = scrollX; x <= scrollX + scrollW; x += step) {
      const normX = (x - scrollX) / scrollW;
      // 5 谐波精细水墨起伏，塑造刀劈斧凿的山势
      const h1 = Math.sin(normX * (2.8 + layer * 1.3) + layerTime + layer * 1.8);
      const h2 = Math.cos(normX * (6.5 + layer * 1.8) - layerTime * 0.5 + layer);
      const h3 = Math.sin(normX * 13.0 + layerTime * 1.1) * 0.32;
      const h4 = Math.cos(normX * 24.0 - layerTime * 1.8) * 0.12;
      const mountainCurve = (h1 * 0.55 + h2 * 0.30 + h3 * 0.10 + h4 * 0.05);

      const y = waterY - basePeakHeight - mountainCurve * layerAmp;
      points.push({ x, y });
      ctx.lineTo(x, y);
    }

    ctx.lineTo(scrollX + scrollW, waterY);
    ctx.closePath();

    mountainPaths.push({ points, color: config.fillTop, alpha: config.alpha });

    // 山体水墨向光晨曦渐变
    const mtnGrad = ctx.createLinearGradient(
      scrollX + scrollW * 0.25,
      waterY - basePeakHeight * 1.5,
      scrollX + scrollW * 0.6,
      waterY
    );
    mtnGrad.addColorStop(0, config.fillTop);
    mtnGrad.addColorStop(0.65, config.fillBottom);
    mtnGrad.addColorStop(1, "rgba(4, 15, 20, 0.98)");

    ctx.fillStyle = mtnGrad;
    ctx.globalAlpha = config.alpha;
    ctx.fill();

    // 山脊流金勾线 (Gold Rim Stroke)
    if (layer >= 2) {
      ctx.strokeStyle = config.rim;
      ctx.lineWidth = layer === 5 ? 1.6 : layer === 4 ? 1.2 : 0.8;
      ctx.globalAlpha = (0.35 + smoothMid * 0.65) * (layer === 5 ? goldGlow : 0.85);
      ctx.stroke();
    }

    // 在第 2、4 层山峦之间穿插流动的水墨烟岚 (Volumetric Mist Bands)
    if (layer === 2 || layer === 4) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const fogY = waterY - basePeakHeight * 0.45;
      const fogGrad = ctx.createLinearGradient(scrollX, fogY - 25, scrollX, fogY + 35);
      fogGrad.addColorStop(0, "rgba(210, 245, 240, 0)");
      fogGrad.addColorStop(0.5, `rgba(180, 230, 225, ${0.14 + smoothBass * 0.08})`);
      fogGrad.addColorStop(1, "rgba(210, 245, 240, 0)");
      ctx.fillStyle = fogGrad;

      ctx.beginPath();
      ctx.moveTo(scrollX, fogY);
      for (let fx = scrollX; fx <= scrollX + scrollW; fx += 16) {
        const fogCurve = Math.sin((fx - scrollX) * 0.015 + t * (layer === 2 ? 0.6 : -0.8)) * 12;
        ctx.lineTo(fx, fogY + fogCurve);
      }
      ctx.lineTo(scrollX + scrollW, fogY + 50);
      ctx.lineTo(scrollX, fogY + 50);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1.0;

  // ─── 4. 电影级柔焦高斯体积丁达尔神光 (Atmospheric Mie Scattering) ───
  const rayStrength = lightRays * (0.65 + smoothBass * 0.75 + smoothEnergy * 0.35);
  if (rayStrength > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const rayOriginX = scrollX + scrollW * 0.20;
    const rayOriginY = scrollY - 25;

    // 绘制 6 束柔焦弥散光锥
    const rayAngles = [0.26, 0.33, 0.41, 0.49, 0.58, 0.67];
    for (let r = 0; r < rayAngles.length; r++) {
      const baseAngle = Math.PI * rayAngles[r] + Math.sin(t * 0.35 + r * 1.2) * 0.035;
      const rayLen = scrollH * 1.55;
      const spread = scrollW * (0.055 + r * 0.018);

      const rayGrd = ctx.createRadialGradient(
        rayOriginX,
        rayOriginY,
        15,
        rayOriginX + Math.cos(baseAngle) * rayLen * 0.6,
        rayOriginY + Math.sin(baseAngle) * rayLen * 0.6,
        rayLen
      );

      const rayAlpha = (0.38 - r * 0.04) * rayStrength;
      rayGrd.addColorStop(0, `rgba(253, 230, 138, ${rayAlpha * 1.2})`);
      rayGrd.addColorStop(0.3, `rgba(251, 191, 36, ${rayAlpha * 0.8})`);
      rayGrd.addColorStop(0.65, `rgba(56, 189, 248, ${rayAlpha * 0.25})`);
      rayGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = rayGrd;
      ctx.beginPath();
      ctx.moveTo(rayOriginX, rayOriginY);
      ctx.lineTo(
        rayOriginX + Math.cos(baseAngle - 0.12) * rayLen - spread,
        rayOriginY + Math.sin(baseAngle - 0.12) * rayLen
      );
      ctx.lineTo(
        rayOriginX + Math.cos(baseAngle + 0.12) * rayLen + spread,
        rayOriginY + Math.sin(baseAngle + 0.12) * rayLen
      );
      ctx.closePath();
      ctx.fill();
    }

    // 光源处柔焦高光辉光 (Ray Source Soft Bloom)
    const sourceBloom = ctx.createRadialGradient(rayOriginX, rayOriginY, 5, rayOriginX, rayOriginY, 120);
    sourceBloom.addColorStop(0, `rgba(254, 240, 138, ${0.65 * rayStrength})`);
    sourceBloom.addColorStop(0.5, `rgba(251, 191, 36, ${0.30 * rayStrength})`);
    sourceBloom.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = sourceBloom;
    ctx.beginPath();
    ctx.arc(rayOriginX, rayOriginY, 120, 0, Math.PI * 2);
    ctx.fill();

    // 电影级横向宽银幕金色耀斑 (Anamorphic Gold Flare Streak)
    if (smoothBass > 0.38 || smoothMid > 0.45) {
      const streakIntensity = Math.min(1, (Math.max(smoothBass, smoothMid) - 0.3) * 1.6);
      const streakY = waterY - scrollH * 0.22;
      const streakGrd = ctx.createLinearGradient(scrollX, streakY, scrollX + scrollW, streakY);
      streakGrd.addColorStop(0, "rgba(251, 191, 36, 0)");
      streakGrd.addColorStop(0.2, "rgba(251, 191, 36, 0.08)");
      streakGrd.addColorStop(0.5, `rgba(254, 240, 138, ${0.75 * streakIntensity * goldGlow})`);
      streakGrd.addColorStop(0.8, "rgba(251, 191, 36, 0.08)");
      streakGrd.addColorStop(1, "rgba(251, 191, 36, 0)");

      ctx.fillStyle = streakGrd;
      ctx.fillRect(scrollX, streakY - 1.5, scrollW, 3);

      // 耀斑中心十字高光
      ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * streakIntensity})`;
      ctx.fillRect(rayOriginX + scrollW * 0.15 - 35, streakY - 1, 70, 2);
    }

    ctx.restore();
  }

  // ─── 5. 真实水镜倒影与水波折射 (True Water Reflection & Ripples) ───
  const waterH = scrollY + scrollH - waterY;
  const waterGrad = ctx.createLinearGradient(scrollX, waterY, scrollX, scrollY + scrollH);
  waterGrad.addColorStop(0, "rgba(4, 14, 19, 0.88)");
  waterGrad.addColorStop(0.4, "rgba(6, 20, 27, 0.95)");
  waterGrad.addColorStop(1, "rgba(3, 8, 12, 1.0)");
  ctx.fillStyle = waterGrad;
  ctx.fillRect(scrollX, waterY, scrollW, waterH);

  // 渲染山体倒影 (Inverted Mountain Reflection)
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
      // 倒影随着深度产生水波扭曲
      const waveShift = Math.sin((p.x - scrollX) * 0.04 + t * 2.2 + l) * (2 + smoothBass * 3.5);
      const reflectY = waterY + distFromWater * 0.55 + waveShift;
      ctx.lineTo(p.x, reflectY);
    }
    ctx.lineTo(scrollX + scrollW, waterY);
    ctx.closePath();

    ctx.fillStyle = m.color;
    ctx.globalAlpha = m.alpha * 0.28;
    ctx.fill();
  }
  ctx.restore();

  // 水面金色微波折射纹理 (Water Shimmer Waves)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const waveCount = 15;
  for (let w = 0; w < waveCount; w++) {
    const waveY = waterY + ((w + 1) / (waveCount + 1)) * waterH;
    const wavePhase = t * 1.4 + w * 0.65;
    const waveAlpha = (0.05 + Math.sin(wavePhase) * 0.035 + smoothTreble * 0.08) * (w > 8 ? 0.5 : 1.0);

    ctx.strokeStyle = `rgba(251, 191, 36, ${Math.max(0, waveAlpha) * goldGlow})`;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(scrollX, waveY);
    for (let x = scrollX; x <= scrollX + scrollW; x += 14) {
      const dy = Math.sin((x - scrollX) * 0.035 + wavePhase) * (1.2 + smoothBass * 2.2);
      ctx.lineTo(x, waveY + dy);
    }
    ctx.stroke();
  }

  // 笛箫泛音同心圆涟漪 (Concentric Water Ripples)
  localRipples.forEach((rip: WaterRipple, idx: number) => {
    rip.radius += rip.speed;
    rip.alpha *= 0.965;

    if (rip.alpha > 0.02) {
      ctx.strokeStyle = `rgba(56, 189, 248, ${rip.alpha * 0.75})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(rip.x, rip.y, rip.radius, rip.radius * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(251, 191, 36, ${rip.alpha * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(rip.x, rip.y, rip.radius * 0.65, rip.radius * 0.20, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      localRipples.splice(idx, 1);
    }
  });

  // ─── 6. 孤舟蓑笠与微芒渔火 (Solitary Boat & Lantern Glow) ───
  const boatX = scrollX + scrollW * 0.74;
  const boatY = waterY + 12 + Math.sin(t * 1.8) * 2.5;

  // 船体剪影
  ctx.fillStyle = "rgba(10, 18, 24, 0.95)";
  ctx.beginPath();
  ctx.moveTo(boatX - 18, boatY);
  ctx.quadraticCurveTo(boatX, boatY + 5, boatX + 18, boatY);
  ctx.quadraticCurveTo(boatX, boatY + 1, boatX - 18, boatY);
  ctx.fill();

  // 乌篷
  ctx.beginPath();
  ctx.arc(boatX - 2, boatY - 2, 7, Math.PI, 0);
  ctx.fill();

  // 船头渔火微芒 (Lantern Amber Glow)
  const lanternX = boatX + 12;
  const lanternY = boatY - 4;
  const lanternGlow = ctx.createRadialGradient(lanternX, lanternY, 1, lanternX, lanternY, 22);
  const lanternPulse = 0.75 + Math.sin(t * 3.5) * 0.25 + smoothMid * 0.4;
  lanternGlow.addColorStop(0, `rgba(254, 240, 138, ${0.95 * lanternPulse})`);
  lanternGlow.addColorStop(0.35, `rgba(245, 158, 11, ${0.55 * lanternPulse})`);
  lanternGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = lanternGlow;
  ctx.beginPath();
  ctx.arc(lanternX, lanternY, 22, 0, Math.PI * 2);
  ctx.fill();

  // 渔火在水中的微弱倒影
  const lanternReflect = ctx.createRadialGradient(lanternX, boatY + 8, 1, lanternX, boatY + 8, 16);
  lanternReflect.addColorStop(0, `rgba(251, 191, 36, ${0.45 * lanternPulse})`);
  lanternReflect.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = lanternReflect;
  ctx.beginPath();
  ctx.arc(lanternX, boatY + 8, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // ─── 7. 浮空金粉与飘零落英 (Golden Petals & Light Dust) ───
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // 金粉微尘
  localParticles.forEach((p: DustParticle) => {
    p.x += p.vx + Math.sin(t + p.phase) * 0.35;
    p.y += p.vy;
    if (p.y < scrollY) {
      p.y = scrollY + scrollH + 8;
      p.x = scrollX + Math.random() * scrollW;
    }
    if (p.x < scrollX) p.x = scrollX + scrollW;
    if (p.x > scrollX + scrollW) p.x = scrollX;

    const particleAlpha = p.alpha * (0.6 + Math.sin(t * 2.2 + p.phase) * 0.4);
    ctx.fillStyle = `rgba(251, 191, 36, ${particleAlpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // 落英花瓣
  localPetals.forEach((petal: GoldenPetal) => {
    petal.x += petal.vx + Math.sin(t * 1.5 + petal.phase) * 0.45;
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
    ctx.fillStyle = `rgba(253, 230, 138, ${petal.alpha * (0.7 + smoothMid * 0.4)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, petal.size, petal.size * petal.aspect, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  ctx.restore();

  // ─── 8. 东方长卷书法印章与电影胶片暗角 ───
  // 左上角古典书法与朱砂印章
  ctx.save();
  const stampX = scrollX + 36;
  const stampY = scrollY + 36;

  // 朱砂印章 (Vermilion Seal Stamp)
  ctx.fillStyle = "rgba(215, 50, 40, 0.85)";
  ctx.strokeStyle = "rgba(255, 200, 180, 0.9)";
  ctx.lineWidth = 1;
  roundRect(ctx, stampX, stampY, 26, 26, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.font = "bold 11px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("国风", stampX + 13, stampY + 13);

  // 竖排淡金曲风小楷
  ctx.fillStyle = "rgba(245, 235, 215, 0.65)";
  ctx.font = "12px serif";
  ctx.textAlign = "center";
  ctx.fillText("千", stampX + 44, stampY + 10);
  ctx.fillText("里", stampX + 44, stampY + 26);
  ctx.fillText("江", stampX + 44, stampY + 42);
  ctx.fillText("山", stampX + 44, stampY + 58);
  ctx.restore();

  // 电影级胶片暗角 (Film Vignette)
  if (filmVignette > 0) {
    const vigGrd = ctx.createRadialGradient(
      scrollX + scrollW / 2,
      scrollY + scrollH / 2,
      scrollW * 0.32,
      scrollX + scrollW / 2,
      scrollY + scrollH / 2,
      scrollW * 0.68
    );
    vigGrd.addColorStop(0, "rgba(0,0,0,0)");
    vigGrd.addColorStop(1, `rgba(0,0,0,${filmVignette * 0.70})`);
    ctx.fillStyle = vigGrd;
    ctx.fillRect(scrollX, scrollY, scrollW, scrollH);
  }

  // ─── 9. 绢帛羽化微边 (极细0.5px仿古金丝，去除粗重黄线) ───
  ctx.restore(); // 退出剪裁

  ctx.strokeStyle = `rgba(251, 191, 36, ${0.20 * goldGlow})`;
  ctx.lineWidth = 1.0;
  roundRect(ctx, scrollX, scrollY, scrollW, scrollH, 20);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 0.5;
  roundRect(ctx, scrollX + 2, scrollY + 2, scrollW - 4, scrollH - 4, 18);
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
