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
  description: "宋画清幽雅韵与电影级柔焦水墨长卷，专为纯音乐与国风设计",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "lightRays",
      name: "天际烟岚光强度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 2,
      step: 0.1,
      default: 1.0,
      audioDriven: {
        enabled: true,
        band: "bass",
        multiplier: 0.5,
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
        multiplier: 0.4,
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
        multiplier: 0.7,
      },
    },
    {
      id: "goldGlow",
      name: "锦绫金丝微光",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 2.0,
      step: 0.05,
      default: 1.0,
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
    const goldGlow = params?.goldGlow ?? 1.0;
    const filmVignette = params?.filmVignette ?? 0.65;

    // 音频平滑处理 (Damping: 35 极平滑呼吸)
    const rawBass = audioData.bass || 0;
    const rawMid = audioData.mid || 0;
    const rawTreble = audioData.treble || 0;
    const rawEnergy = rawBass * 0.4 + rawMid * 0.4 + rawTreble * 0.2;

    priv.smoothBass += (rawBass - priv.smoothBass) * 0.035;
    priv.smoothMid += (rawMid - priv.smoothMid) * 0.055;
    priv.smoothTreble += (rawTreble - priv.smoothTreble) * 0.075;
    priv.smoothEnergy += (rawEnergy - priv.smoothEnergy) * 0.045;

    const t = priv.time * 0.045;

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

    if (!priv.initParticles) {
      priv.particles = [];
      for (let i = 0; i < 40; i++) {
        priv.particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.2,
          vy: -Math.random() * 0.3 - 0.08,
          size: Math.random() * 1.8 + 0.6,
          alpha: Math.random() * 0.45 + 0.15,
          phase: Math.random() * Math.PI * 2,
        });
      }
      priv.petals = [];
      for (let i = 0; i < 14; i++) {
        priv.petals.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3 + 0.12,
          vy: Math.random() * 0.25 + 0.12,
          size: Math.random() * 3.5 + 1.8,
          alpha: Math.random() * 0.22 + 0.1,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.02,
          aspect: 0.35 + Math.random() * 0.35,
          phase: Math.random() * Math.PI * 2,
        });
      }
      priv.initParticles = true;
    }

    if (priv.smoothTreble > 0.36 && priv.time - priv.lastRippleSpawn > 0.30) {
      priv.lastRippleSpawn = priv.time;
      if (priv.ripples.length < 5) {
        priv.ripples.push({
          x: width * (0.36 + Math.random() * 0.36),
          y: waterY + 20 + Math.random() * 35,
          radius: 4,
          maxRadius: Math.min(width, height) * 0.25,
          alpha: 0.65 * waterRipple,
          speed: 1.2 + priv.smoothTreble * 1.8,
        });
      }
    }

    context.save();

    // ─── 1. 外部暗夜背景 ───
    context.fillStyle = "#04070a";
    context.fillRect(0, 0, width, height);

    const ambientGlow = context.createRadialGradient(
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
    context.fillStyle = ambientGlow;
    context.fillRect(0, 0, width, height);

    // ─── 2. 画幅内部裁剪 ───
    context.save();
    context.beginPath();
    roundRect(context, scrollX, scrollY, scrollW, scrollH, 16);
    context.clip();

    const skyGrad = context.createLinearGradient(scrollX, scrollY, scrollX, scrollY + scrollH);
    skyGrad.addColorStop(0, "#050e14");
    skyGrad.addColorStop(0.35, "#081b24");
    skyGrad.addColorStop(0.60, "#0d282b");
    skyGrad.addColorStop(0.85, "#103230");
    skyGrad.addColorStop(1, "#030a0e");
    context.fillStyle = skyGrad;
    context.fillRect(scrollX, scrollY, scrollW, scrollH);

    const dawnGlow = context.createRadialGradient(
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
    context.fillStyle = dawnGlow;
    context.fillRect(scrollX, scrollY, scrollW, scrollH);

    // ─── 3. 6 重宋画《千里江山》水墨层峦 (通底闭合，无任何中间截断线) ───
    const breathFactor = mountainBreath * priv.smoothBass;
    const midVibe = priv.smoothMid * 5;

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
      context.beginPath();
      context.moveTo(scrollX, bottomY); // 底部闭合至画卷最底端

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
        context.lineTo(x, y);
      }

      context.lineTo(scrollX + scrollW, bottomY);
      context.closePath();

      mountainPaths.push({ points, color: config.fillTop, alpha: config.alpha });

      const mtnGrad = context.createLinearGradient(
        scrollX + scrollW * 0.22,
        waterY - basePeakHeight * 1.4,
        scrollX + scrollW * 0.5,
        bottomY
      );
      mtnGrad.addColorStop(0, config.fillTop);
      mtnGrad.addColorStop(0.55, config.fillBottom);
      mtnGrad.addColorStop(1, "rgba(2, 6, 9, 0.98)");

      context.fillStyle = mtnGrad;
      context.globalAlpha = config.alpha;
      context.fill();

      if (layer >= 4) {
        context.strokeStyle = layer === 5 ? "rgba(251, 191, 36, 0.22)" : "rgba(74, 222, 128, 0.16)";
        context.lineWidth = 0.6;
        context.globalAlpha = (0.18 + priv.smoothMid * 0.3) * goldGlow;
        context.stroke();
      }
    }
    context.globalAlpha = 1.0;

    // ─── 4. 电影级斜向高斯体积丁达尔光柱 (Cinematic Volumetric God Rays) ───
    const rayStrength = lightRays * (0.55 + priv.smoothBass * 0.65 + priv.smoothEnergy * 0.25);
    if (rayStrength > 0.05) {
      context.save();
      context.globalCompositeOperation = "screen";

      const lightOriginX = scrollX + scrollW * 0.16;
      const lightOriginY = scrollY - 20;

      const rayConfigs = [
        { angle: 0.29, spread: 0.045, intensity: 0.32 },
        { angle: 0.36, spread: 0.055, intensity: 0.40 },
        { angle: 0.44, spread: 0.065, intensity: 0.45 },
        { angle: 0.52, spread: 0.055, intensity: 0.36 },
        { angle: 0.60, spread: 0.045, intensity: 0.28 },
      ];

      const rayLen = scrollH * 1.65;

      for (let r = 0; r < rayConfigs.length; r++) {
        const cfg = rayConfigs[r];
        const baseAngle = Math.PI * cfg.angle + Math.sin(t * 0.3 + r * 1.1) * 0.025;
        const spread = scrollW * cfg.spread;
        const beamAlpha = cfg.intensity * rayStrength * 0.28;

        const rayGrd = context.createRadialGradient(
          lightOriginX,
          lightOriginY,
          10,
          lightOriginX + Math.cos(baseAngle) * rayLen * 0.55,
          lightOriginY + Math.sin(baseAngle) * rayLen * 0.55,
          rayLen
        );
        rayGrd.addColorStop(0, `rgba(254, 240, 138, ${beamAlpha * 1.3})`);
        rayGrd.addColorStop(0.35, `rgba(251, 191, 36, ${beamAlpha * 0.8})`);
        rayGrd.addColorStop(0.70, `rgba(56, 189, 248, ${beamAlpha * 0.2})`);
        rayGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

        context.fillStyle = rayGrd;
        context.beginPath();
        context.moveTo(lightOriginX, lightOriginY);
        context.lineTo(
          lightOriginX + Math.cos(baseAngle - 0.08) * rayLen - spread,
          lightOriginY + Math.sin(baseAngle - 0.08) * rayLen
        );
        context.lineTo(
          lightOriginX + Math.cos(baseAngle + 0.08) * rayLen + spread,
          lightOriginY + Math.sin(baseAngle + 0.08) * rayLen
        );
        context.closePath();
        context.fill();
      }

      const sourceBloom = context.createRadialGradient(
        lightOriginX,
        lightOriginY,
        5,
        lightOriginX + scrollW * 0.15,
        lightOriginY + scrollH * 0.35,
        scrollW * 0.45
      );
      sourceBloom.addColorStop(0, `rgba(254, 240, 138, ${0.35 * rayStrength})`);
      sourceBloom.addColorStop(0.4, `rgba(251, 191, 36, ${0.15 * rayStrength})`);
      sourceBloom.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = sourceBloom;
      context.beginPath();
      context.arc(lightOriginX + scrollW * 0.15, lightOriginY + scrollH * 0.35, scrollW * 0.45, 0, Math.PI * 2);
      context.fill();

      context.restore();
    }

    // ─── 5. 水天融界 · 深潭水墨水体与倒影 ───
    const waterH = scrollY + scrollH - waterY;
    const waterGrad = context.createLinearGradient(scrollX, waterY, scrollX, scrollY + scrollH);
    waterGrad.addColorStop(0, "rgba(3, 10, 14, 0.82)");
    waterGrad.addColorStop(0.4, "rgba(4, 15, 20, 0.94)");
    waterGrad.addColorStop(1, "rgba(2, 6, 9, 1.0)");
    context.fillStyle = waterGrad;
    context.fillRect(scrollX, waterY, scrollW, waterH);

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
        const waveShift = Math.sin((p.x - scrollX) * 0.03 + t * 1.8 + l) * (1.2 + priv.smoothBass * 2.0);
        const reflectY = waterY + distFromWater * 0.45 + waveShift;
        context.lineTo(p.x, reflectY);
      }
      context.lineTo(scrollX + scrollW, waterY);
      context.closePath();

      context.fillStyle = m.color;
      context.globalAlpha = m.alpha * 0.20;
      context.fill();
    }
    context.restore();

    // 有机微波碎金
    context.save();
    context.globalCompositeOperation = "lighter";
    const waveCount = 10;
    for (let w = 0; w < waveCount; w++) {
      const waveY = waterY + ((w + 1) / (waveCount + 1)) * waterH;
      const wavePhase = t * 1.1 + w * 0.75;
      const waveAlpha = (0.035 + Math.sin(wavePhase) * 0.02 + priv.smoothTreble * 0.05) * (w > 5 ? 0.4 : 1.0);

      context.strokeStyle = `rgba(251, 191, 36, ${Math.max(0, waveAlpha) * goldGlow})`;
      context.lineWidth = 0.7;
      context.beginPath();
      let started = false;
      for (let x = scrollX + 30; x <= scrollX + scrollW - 30; x += 16) {
        const normX = (x - scrollX) / scrollW;
        const windowEdge = Math.sin(normX * Math.PI);
        const dy = Math.sin((x - scrollX) * 0.03 + wavePhase) * (0.8 + priv.smoothBass * 1.4) * windowEdge;
        if (!started) {
          context.moveTo(x, waveY + dy);
          started = true;
        } else {
          context.lineTo(x, waveY + dy);
        }
      }
      context.stroke();
    }

    // 涟漪
    priv.ripples.forEach((rip: Ripple, idx: number) => {
      rip.radius += rip.speed;
      rip.alpha *= 0.965;

      if (rip.alpha > 0.02) {
        context.strokeStyle = `rgba(56, 189, 248, ${rip.alpha * 0.45})`;
        context.lineWidth = 0.8;
        context.beginPath();
        context.ellipse(rip.x, rip.y, rip.radius, rip.radius * 0.28, 0, 0, Math.PI * 2);
        context.stroke();
      } else {
        priv.ripples.splice(idx, 1);
      }
    });

    // ─── 6. 孤舟蓑笠与微芒渔火 ───
    const boatX = scrollX + scrollW * 0.75;
    const boatY = waterY + 14 + Math.sin(t * 1.5) * 2.0;

    context.fillStyle = "rgba(8, 16, 20, 0.92)";
    context.beginPath();
    context.moveTo(boatX - 16, boatY);
    context.quadraticCurveTo(boatX, boatY + 4, boatX + 16, boatY);
    context.quadraticCurveTo(boatX, boatY + 0.8, boatX - 16, boatY);
    context.fill();

    context.beginPath();
    context.arc(boatX - 2, boatY - 1.5, 6, Math.PI, 0);
    context.fill();

    const lanternX = boatX + 10;
    const lanternY = boatY - 3;
    const lanternGlow = context.createRadialGradient(lanternX, lanternY, 1, lanternX, lanternY, 16);
    const lanternPulse = 0.75 + Math.sin(t * 3.0) * 0.25 + priv.smoothMid * 0.3;
    lanternGlow.addColorStop(0, `rgba(254, 240, 138, ${0.80 * lanternPulse})`);
    lanternGlow.addColorStop(0.4, `rgba(245, 158, 11, ${0.35 * lanternPulse})`);
    lanternGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = lanternGlow;
    context.beginPath();
    context.arc(lanternX, lanternY, 16, 0, Math.PI * 2);
    context.fill();

    context.restore();

    // ─── 7. 半透明落英与金粉微尘 ───
    context.save();
    context.globalCompositeOperation = "lighter";

    priv.particles.forEach((p: DustParticle) => {
      p.x += p.vx + Math.sin(t + p.phase) * 0.25;
      p.y += p.vy;
      if (p.y < scrollY) {
        p.y = scrollY + scrollH + 6;
        p.x = scrollX + Math.random() * scrollW;
      }
      if (p.x < scrollX) p.x = scrollX + scrollW;
      if (p.x > scrollX + scrollW) p.x = scrollX;

      const particleAlpha = p.alpha * (0.4 + Math.sin(t * 2.0 + p.phase) * 0.3);
      context.fillStyle = `rgba(251, 191, 36, ${particleAlpha})`;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    });

    priv.petals.forEach((petal: GoldenPetal) => {
      petal.x += petal.vx + Math.sin(t * 1.2 + petal.phase) * 0.35;
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

      const petalGrad = context.createRadialGradient(0, 0, 0, 0, 0, petal.size);
      petalGrad.addColorStop(0, `rgba(254, 235, 200, ${petal.alpha * 1.2})`);
      petalGrad.addColorStop(0.6, `rgba(245, 200, 160, ${petal.alpha * 0.7})`);
      petalGrad.addColorStop(1, "rgba(245, 180, 140, 0)");
      context.fillStyle = petalGrad;

      context.beginPath();
      context.ellipse(0, 0, petal.size, petal.size * petal.aspect, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });

    context.restore();

    // ─── 8. 东方长卷极简淡金诗意留白 ───
    context.save();
    const textX = scrollX + 36;
    const textY = scrollY + 36;

    context.fillStyle = "rgba(245, 235, 215, 0.28)";
    context.font = "12px serif";
    context.textAlign = "center";
    context.fillText("千", textX, textY);
    context.fillText("里", textX, textY + 16);
    context.fillText("江", textX, textY + 32);
    context.fillText("山", textX, textY + 48);
    context.restore();

    if (filmVignette > 0) {
      const vigGrd = context.createRadialGradient(
        scrollX + scrollW / 2,
        scrollY + scrollH / 2,
        scrollW * 0.35,
        scrollX + scrollW / 2,
        scrollY + scrollH / 2,
        scrollW * 0.70
      );
      vigGrd.addColorStop(0, "rgba(0,0,0,0)");
      vigGrd.addColorStop(1, `rgba(0,0,0,${filmVignette * 0.72})`);
      context.fillStyle = vigGrd;
      context.fillRect(scrollX, scrollY, scrollW, scrollH);
    }

    // ─── 9. 绢帛羽化微边 ───
    context.restore(); // 退出剪裁

    context.strokeStyle = `rgba(251, 191, 36, ${0.12 * goldGlow})`;
    context.lineWidth = 0.8;
    roundRect(context, scrollX, scrollY, scrollW, scrollH, 16);
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
