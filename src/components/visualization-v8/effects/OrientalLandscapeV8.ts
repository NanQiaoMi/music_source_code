/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext } from "@/lib/visualization/types";

interface Ripple {
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

export const OrientalLandscapeV8Effect: EffectPlugin = {
  id: "oriental-landscape-v8",
  name: "青绿千里 · 电影画卷",
  category: "shapes",
  description: "东方水墨重彩与电影级丁达尔神光远山画卷，专为纯音乐与国风设计",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "lightRays",
      name: "丁达尔神光强度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 2,
      step: 0.1,
      default: 1.0,
      audioDriven: {
        enabled: true,
        band: "bass",
        multiplier: 0.6,
      },
    },
    {
      id: "mountainBreath",
      name: "远山呼吸感",
      type: "number",
      mode: "basic",
      min: 0.5,
      max: 2.5,
      step: 0.1,
      default: 1.0,
      audioDriven: {
        enabled: true,
        band: "bass",
        multiplier: 0.5,
      },
    },
    {
      id: "waterRipple",
      name: "水面涟漪灵敏度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 2,
      step: 0.1,
      default: 1.0,
      audioDriven: {
        enabled: true,
        band: "treble",
        multiplier: 0.8,
      },
    },
    {
      id: "goldGlow",
      name: "锦绫金丝辉光",
      type: "number",
      mode: "basic",
      min: 0.5,
      max: 2.0,
      step: 0.05,
      default: 1.2,
    },
    {
      id: "filmVignette",
      name: "电影胶片与暗角",
      type: "number",
      mode: "professional",
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.65,
    },
  ],

  init() {
    (this as any).private = {
      time: 0,
      smoothBass: 0,
      smoothMid: 0,
      smoothTreble: 0,
      smoothEnergy: 0,
      ripples: [] as Ripple[],
      particles: [] as DustParticle[],
      petals: [] as GoldenPetal[],
      lastRippleSpawn: 0,
      initParticles: false,
    };
  },

  render(ctx, audioData, params) {
    if (!ctx.ctx || !ctx.canvas) return;

    const canvas = ctx.canvas;
    const context = ctx.ctx;
    const width = canvas.width;
    const height = canvas.height;

    const priv = (this as any).private || {
      time: 0,
      smoothBass: 0,
      smoothMid: 0,
      smoothTreble: 0,
      smoothEnergy: 0,
      ripples: [],
      particles: [],
      petals: [],
      lastRippleSpawn: 0,
      initParticles: false,
    };
    (this as any).private = priv;

    priv.time += 0.016;

    const lightRays = params?.lightRays ?? 1.0;
    const mountainBreath = params?.mountainBreath ?? 1.0;
    const waterRipple = params?.waterRipple ?? 1.0;
    const goldGlow = params?.goldGlow ?? 1.2;
    const filmVignette = params?.filmVignette ?? 0.65;

    // 音频平滑处理 (Damping: 55)
    const rawBass = audioData.bass || 0;
    const rawMid = audioData.mid || 0;
    const rawTreble = audioData.treble || 0;
    const rawEnergy = rawBass * 0.4 + rawMid * 0.4 + rawTreble * 0.2;

    priv.smoothBass += (rawBass - priv.smoothBass) * 0.055;
    priv.smoothMid += (rawMid - priv.smoothMid) * 0.075;
    priv.smoothTreble += (rawTreble - priv.smoothTreble) * 0.095;
    priv.smoothEnergy += (rawEnergy - priv.smoothEnergy) * 0.065;

    const t = priv.time * 0.05;

    // 初始化微尘与落英
    if (!priv.initParticles) {
      priv.particles = [];
      for (let i = 0; i < 50; i++) {
        priv.particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: -Math.random() * 0.45 - 0.15,
          size: Math.random() * 2.2 + 0.8,
          alpha: Math.random() * 0.65 + 0.25,
          phase: Math.random() * Math.PI * 2,
        });
      }
      priv.petals = [];
      for (let i = 0; i < 20; i++) {
        priv.petals.push({
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
      priv.initParticles = true;
    }

    // 泛音高频涟漪生成
    if (priv.smoothTreble > 0.32 && priv.time - priv.lastRippleSpawn > 0.22) {
      priv.lastRippleSpawn = priv.time;
      if (priv.ripples.length < 8) {
        priv.ripples.push({
          x: width * (0.28 + Math.random() * 0.44),
          y: height * (0.64 + Math.random() * 0.14),
          radius: 6,
          maxRadius: Math.min(width, height) * 0.32,
          alpha: 0.9 * waterRipple,
          speed: 1.8 + priv.smoothTreble * 2.5,
        });
      }
    }

    context.save();

    // ─── 1. 外部暗夜背景与极光渐晕 ───
    context.fillStyle = "#05070a";
    context.fillRect(0, 0, width, height);

    const ambientGlow = context.createRadialGradient(
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
    context.fillStyle = ambientGlow;
    context.fillRect(0, 0, width, height);

    // ─── 2. 2.35:1 宽银幕电影绢帛画幅 (羽化画境) ───
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
    context.save();
    context.beginPath();
    roundRect(context, scrollX, scrollY, scrollW, scrollH, 20);
    context.clip();

    // 宣纸天际古色渐变
    const skyGrad = context.createLinearGradient(scrollX, scrollY, scrollX, scrollY + scrollH);
    skyGrad.addColorStop(0, "#06131c");
    skyGrad.addColorStop(0.3, "#0a232f");
    skyGrad.addColorStop(0.55, "#103236");
    skyGrad.addColorStop(0.75, "#18453f");
    skyGrad.addColorStop(1, "#040e14");
    context.fillStyle = skyGrad;
    context.fillRect(scrollX, scrollY, scrollW, scrollH);

    // 晨曦暖金光照
    const dawnGlow = context.createRadialGradient(
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
    context.fillStyle = dawnGlow;
    context.fillRect(scrollX, scrollY, scrollW, scrollH);

    // 水面分界线 Y 坐标
    const waterY = scrollY + scrollH * 0.60;

    // ─── 3. 6 重《千里江山图》青绿水墨山峦与山谷烟岚 ───
    const breathFactor = mountainBreath * priv.smoothBass;
    const midVibe = priv.smoothMid * 10;

    const mountainPalette = [
      { fillTop: "#0d3545", fillBottom: "#061822", rim: "#38bdf8", alpha: 0.40, baseY: 0.24, speed: 0.25 },
      { fillTop: "#104754", fillBottom: "#082129", rim: "#22d3ee", alpha: 0.55, baseY: 0.31, speed: 0.35 },
      { fillTop: "#145958", fillBottom: "#0b2b2c", rim: "#34d399", alpha: 0.70, baseY: 0.38, speed: 0.48 },
      { fillTop: "#176c5e", fillBottom: "#0e3831", rim: "#4ade80", alpha: 0.85, baseY: 0.46, speed: 0.62 },
      { fillTop: "#155745", fillBottom: "#0a2921", rim: "#a3e635", alpha: 0.94, baseY: 0.53, speed: 0.78 },
      { fillTop: "#0d2822", fillBottom: "#051613", rim: "#fbbf24", alpha: 1.00, baseY: 0.58, speed: 0.95 },
    ];

    const mountainPaths: { points: { x: number; y: number }[]; color: string; alpha: number }[] = [];

    for (let layer = 0; layer < 6; layer++) {
      const config = mountainPalette[layer];
      const layerDepth = (layer + 1) / 6;
      const basePeakHeight = scrollH * (config.baseY * 0.85);
      const layerTime = t * config.speed;
      const layerAmp = (basePeakHeight * 0.42 + breathFactor * 32 * layerDepth) * (1 + (layer >= 4 ? midVibe * 0.03 : 0));

      const points: { x: number; y: number }[] = [];
      context.beginPath();
      context.moveTo(scrollX, waterY);

      const step = 4;
      for (let x = scrollX; x <= scrollX + scrollW; x += step) {
        const normX = (x - scrollX) / scrollW;
        const h1 = Math.sin(normX * (2.8 + layer * 1.3) + layerTime + layer * 1.8);
        const h2 = Math.cos(normX * (6.5 + layer * 1.8) - layerTime * 0.5 + layer);
        const h3 = Math.sin(normX * 13.0 + layerTime * 1.1) * 0.32;
        const h4 = Math.cos(normX * 24.0 - layerTime * 1.8) * 0.12;
        const mountainCurve = (h1 * 0.55 + h2 * 0.30 + h3 * 0.10 + h4 * 0.05);

        const y = waterY - basePeakHeight - mountainCurve * layerAmp;
        points.push({ x, y });
        context.lineTo(x, y);
      }

      context.lineTo(scrollX + scrollW, waterY);
      context.closePath();

      mountainPaths.push({ points, color: config.fillTop, alpha: config.alpha });

      const mtnGrad = context.createLinearGradient(
        scrollX + scrollW * 0.25,
        waterY - basePeakHeight * 1.5,
        scrollX + scrollW * 0.6,
        waterY
      );
      mtnGrad.addColorStop(0, config.fillTop);
      mtnGrad.addColorStop(0.65, config.fillBottom);
      mtnGrad.addColorStop(1, "rgba(4, 15, 20, 0.98)");

      context.fillStyle = mtnGrad;
      context.globalAlpha = config.alpha;
      context.fill();

      if (layer >= 2) {
        context.strokeStyle = config.rim;
        context.lineWidth = layer === 5 ? 1.6 : layer === 4 ? 1.2 : 0.8;
        context.globalAlpha = (0.35 + priv.smoothMid * 0.65) * (layer === 5 ? goldGlow : 0.85);
        context.stroke();
      }

      // 山谷烟岚
      if (layer === 2 || layer === 4) {
        context.save();
        context.globalCompositeOperation = "screen";
        const fogY = waterY - basePeakHeight * 0.45;
        const fogGrad = context.createLinearGradient(scrollX, fogY - 25, scrollX, fogY + 35);
        fogGrad.addColorStop(0, "rgba(210, 245, 240, 0)");
        fogGrad.addColorStop(0.5, `rgba(180, 230, 225, ${0.14 + priv.smoothBass * 0.08})`);
        fogGrad.addColorStop(1, "rgba(210, 245, 240, 0)");
        context.fillStyle = fogGrad;

        context.beginPath();
        context.moveTo(scrollX, fogY);
        for (let fx = scrollX; fx <= scrollX + scrollW; fx += 16) {
          const fogCurve = Math.sin((fx - scrollX) * 0.015 + t * (layer === 2 ? 0.6 : -0.8)) * 12;
          context.lineTo(fx, fogY + fogCurve);
        }
        context.lineTo(scrollX + scrollW, fogY + 50);
        context.lineTo(scrollX, fogY + 50);
        context.closePath();
        context.fill();
        context.restore();
      }
    }
    context.globalAlpha = 1.0;

    // ─── 4. 柔焦高斯体积丁达尔神光 ───
    const rayStrength = lightRays * (0.65 + priv.smoothBass * 0.75 + priv.smoothEnergy * 0.35);
    if (rayStrength > 0.05) {
      context.save();
      context.globalCompositeOperation = "screen";

      const rayOriginX = scrollX + scrollW * 0.20;
      const rayOriginY = scrollY - 25;

      const rayAngles = [0.26, 0.33, 0.41, 0.49, 0.58, 0.67];
      for (let r = 0; r < rayAngles.length; r++) {
        const baseAngle = Math.PI * rayAngles[r] + Math.sin(t * 0.35 + r * 1.2) * 0.035;
        const rayLen = scrollH * 1.55;
        const spread = scrollW * (0.055 + r * 0.018);

        const rayGrd = context.createRadialGradient(
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

        context.fillStyle = rayGrd;
        context.beginPath();
        context.moveTo(rayOriginX, rayOriginY);
        context.lineTo(
          rayOriginX + Math.cos(baseAngle - 0.12) * rayLen - spread,
          rayOriginY + Math.sin(baseAngle - 0.12) * rayLen
        );
        context.lineTo(
          rayOriginX + Math.cos(baseAngle + 0.12) * rayLen + spread,
          rayOriginY + Math.sin(baseAngle + 0.12) * rayLen
        );
        context.closePath();
        context.fill();
      }

      const sourceBloom = context.createRadialGradient(rayOriginX, rayOriginY, 5, rayOriginX, rayOriginY, 120);
      sourceBloom.addColorStop(0, `rgba(254, 240, 138, ${0.65 * rayStrength})`);
      sourceBloom.addColorStop(0.5, `rgba(251, 191, 36, ${0.30 * rayStrength})`);
      sourceBloom.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = sourceBloom;
      context.beginPath();
      context.arc(rayOriginX, rayOriginY, 120, 0, Math.PI * 2);
      context.fill();

      // 横向耀斑
      if (priv.smoothBass > 0.38 || priv.smoothMid > 0.45) {
        const streakIntensity = Math.min(1, (Math.max(priv.smoothBass, priv.smoothMid) - 0.3) * 1.6);
        const streakY = waterY - scrollH * 0.22;
        const streakGrd = context.createLinearGradient(scrollX, streakY, scrollX + scrollW, streakY);
        streakGrd.addColorStop(0, "rgba(251, 191, 36, 0)");
        streakGrd.addColorStop(0.2, "rgba(251, 191, 36, 0.08)");
        streakGrd.addColorStop(0.5, `rgba(254, 240, 138, ${0.75 * streakIntensity * goldGlow})`);
        streakGrd.addColorStop(0.8, "rgba(251, 191, 36, 0.08)");
        streakGrd.addColorStop(1, "rgba(251, 191, 36, 0)");

        context.fillStyle = streakGrd;
        context.fillRect(scrollX, streakY - 1.5, scrollW, 3);
      }

      context.restore();
    }

    // ─── 5. 真实水镜倒影与水波折射 ───
    const waterH = scrollY + scrollH - waterY;
    const waterGrad = context.createLinearGradient(scrollX, waterY, scrollX, scrollY + scrollH);
    waterGrad.addColorStop(0, "rgba(4, 14, 19, 0.88)");
    waterGrad.addColorStop(0.4, "rgba(6, 20, 27, 0.95)");
    waterGrad.addColorStop(1, "rgba(3, 8, 12, 1.0)");
    context.fillStyle = waterGrad;
    context.fillRect(scrollX, waterY, scrollW, waterH);

    // 水面倒影
    context.save();
    context.beginPath();
    context.rect(scrollX, waterY, scrollW, waterH);
    context.clip();

    for (let l = mountainPaths.length - 1; l >= 2; l--) {
      const m = mountainPaths[l];
      context.beginPath();
      context.moveTo(scrollX, waterY);
      for (let i = 0; i < m.points.length; i++) {
        const p = m.points[i];
        const distFromWater = waterY - p.y;
        const waveShift = Math.sin((p.x - scrollX) * 0.04 + t * 2.2 + l) * (2 + priv.smoothBass * 3.5);
        const reflectY = waterY + distFromWater * 0.55 + waveShift;
        context.lineTo(p.x, reflectY);
      }
      context.lineTo(scrollX + scrollW, waterY);
      context.closePath();

      context.fillStyle = m.color;
      context.globalAlpha = m.alpha * 0.28;
      context.fill();
    }
    context.restore();

    // 水面金色微波
    context.save();
    context.globalCompositeOperation = "lighter";
    const waveCount = 15;
    for (let w = 0; w < waveCount; w++) {
      const waveY = waterY + ((w + 1) / (waveCount + 1)) * waterH;
      const wavePhase = t * 1.4 + w * 0.65;
      const waveAlpha = (0.05 + Math.sin(wavePhase) * 0.035 + priv.smoothTreble * 0.08) * (w > 8 ? 0.5 : 1.0);

      context.strokeStyle = `rgba(251, 191, 36, ${Math.max(0, waveAlpha) * goldGlow})`;
      context.lineWidth = 1.0;
      context.beginPath();
      context.moveTo(scrollX, waveY);
      for (let x = scrollX; x <= scrollX + scrollW; x += 14) {
        const dy = Math.sin((x - scrollX) * 0.035 + wavePhase) * (1.2 + priv.smoothBass * 2.2);
        context.lineTo(x, waveY + dy);
      }
      context.stroke();
    }

    // 泛音涟漪
    priv.ripples.forEach((rip: Ripple, idx: number) => {
      rip.radius += rip.speed;
      rip.alpha *= 0.965;

      if (rip.alpha > 0.02) {
        context.strokeStyle = `rgba(56, 189, 248, ${rip.alpha * 0.75})`;
        context.lineWidth = 1.5;
        context.beginPath();
        context.ellipse(rip.x, rip.y, rip.radius, rip.radius * 0.32, 0, 0, Math.PI * 2);
        context.stroke();

        context.strokeStyle = `rgba(251, 191, 36, ${rip.alpha * 0.45})`;
        context.beginPath();
        context.ellipse(rip.x, rip.y, rip.radius * 0.65, rip.radius * 0.20, 0, 0, Math.PI * 2);
        context.stroke();
      } else {
        priv.ripples.splice(idx, 1);
      }
    });

    // ─── 6. 孤舟蓑笠与微芒渔火 ───
    const boatX = scrollX + scrollW * 0.74;
    const boatY = waterY + 12 + Math.sin(t * 1.8) * 2.5;

    context.fillStyle = "rgba(10, 18, 24, 0.95)";
    context.beginPath();
    context.moveTo(boatX - 18, boatY);
    context.quadraticCurveTo(boatX, boatY + 5, boatX + 18, boatY);
    context.quadraticCurveTo(boatX, boatY + 1, boatX - 18, boatY);
    context.fill();

    context.beginPath();
    context.arc(boatX - 2, boatY - 2, 7, Math.PI, 0);
    context.fill();

    const lanternX = boatX + 12;
    const lanternY = boatY - 4;
    const lanternGlow = context.createRadialGradient(lanternX, lanternY, 1, lanternX, lanternY, 22);
    const lanternPulse = 0.75 + Math.sin(t * 3.5) * 0.25 + priv.smoothMid * 0.4;
    lanternGlow.addColorStop(0, `rgba(254, 240, 138, ${0.95 * lanternPulse})`);
    lanternGlow.addColorStop(0.35, `rgba(245, 158, 11, ${0.55 * lanternPulse})`);
    lanternGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = lanternGlow;
    context.beginPath();
    context.arc(lanternX, lanternY, 22, 0, Math.PI * 2);
    context.fill();

    const lanternReflect = context.createRadialGradient(lanternX, boatY + 8, 1, lanternX, boatY + 8, 16);
    lanternReflect.addColorStop(0, `rgba(251, 191, 36, ${0.45 * lanternPulse})`);
    lanternReflect.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = lanternReflect;
    context.beginPath();
    context.arc(lanternX, boatY + 8, 16, 0, Math.PI * 2);
    context.fill();

    context.restore();

    // ─── 7. 浮空金粉与飘零落英 ───
    context.save();
    context.globalCompositeOperation = "lighter";

    priv.particles.forEach((p: DustParticle) => {
      p.x += p.vx + Math.sin(t + p.phase) * 0.35;
      p.y += p.vy;
      if (p.y < scrollY) {
        p.y = scrollY + scrollH + 8;
        p.x = scrollX + Math.random() * scrollW;
      }
      if (p.x < scrollX) p.x = scrollX + scrollW;
      if (p.x > scrollX + scrollW) p.x = scrollX;

      const particleAlpha = p.alpha * (0.6 + Math.sin(t * 2.2 + p.phase) * 0.4);
      context.fillStyle = `rgba(251, 191, 36, ${particleAlpha})`;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    });

    priv.petals.forEach((petal: GoldenPetal) => {
      petal.x += petal.vx + Math.sin(t * 1.5 + petal.phase) * 0.45;
      petal.y += petal.vy;
      petal.rotation += petal.vRot;

      if (petal.y > scrollY + scrollH + 10) {
        petal.y = scrollY - 10;
        petal.x = scrollX + Math.random() * scrollW;
      }
      if (petal.x > scrollX + scrollW + 10) petal.x = scrollX - 10;

      context.save();
      context.translate(petal.x, petal.y);
      context.rotate(petal.rotation);
      context.fillStyle = `rgba(253, 230, 138, ${petal.alpha * (0.7 + priv.smoothMid * 0.4)})`;
      context.beginPath();
      context.ellipse(0, 0, petal.size, petal.size * petal.aspect, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });

    context.restore();

    // ─── 8. 东方长卷书法印章与电影胶片暗角 ───
    context.save();
    const stampX = scrollX + 36;
    const stampY = scrollY + 36;

    context.fillStyle = "rgba(215, 50, 40, 0.85)";
    context.strokeStyle = "rgba(255, 200, 180, 0.9)";
    context.lineWidth = 1;
    roundRect(context, stampX, stampY, 26, 26, 4);
    context.fill();
    context.stroke();

    context.fillStyle = "rgba(255, 255, 255, 0.95)";
    context.font = "bold 11px serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("国风", stampX + 13, stampY + 13);

    context.fillStyle = "rgba(245, 235, 215, 0.65)";
    context.font = "12px serif";
    context.textAlign = "center";
    context.fillText("千", stampX + 44, stampY + 10);
    context.fillText("里", stampX + 44, stampY + 26);
    context.fillText("江", stampX + 44, stampY + 42);
    context.fillText("山", stampX + 44, stampY + 58);
    context.restore();

    if (filmVignette > 0) {
      const vigGrd = context.createRadialGradient(
        scrollX + scrollW / 2,
        scrollY + scrollH / 2,
        scrollW * 0.32,
        scrollX + scrollW / 2,
        scrollY + scrollH / 2,
        scrollW * 0.68
      );
      vigGrd.addColorStop(0, "rgba(0,0,0,0)");
      vigGrd.addColorStop(1, `rgba(0,0,0,${filmVignette * 0.70})`);
      context.fillStyle = vigGrd;
      context.fillRect(scrollX, scrollY, scrollW, scrollH);
    }

    // ─── 9. 绢帛羽化微边 ───
    context.restore(); // 退出剪裁

    context.strokeStyle = `rgba(251, 191, 36, ${0.20 * goldGlow})`;
    context.lineWidth = 1.0;
    roundRect(context, scrollX, scrollY, scrollW, scrollH, 20);
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 255, 0.06)";
    context.lineWidth = 0.5;
    roundRect(context, scrollX + 2, scrollY + 2, scrollW - 4, scrollH - 4, 18);
    context.stroke();

    context.restore();
  },

  resize(width: number, height: number) {
    console.log(`OrientalLandscapeV8 resized to ${width}x${height}`);
  },

  destroy(ctx?: RenderContext) {
    (this as any).private = null;
    if (ctx && ctx.private) {
      ctx.private.orientalState = null;
    }
  },
};

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

export default OrientalLandscapeV8Effect;
