/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface VortexParticle {
  radius: number;
  baseRadius: number;
  angle: number;
  speed: number;
  height: number;
  size: number;
  alpha: number;
  arm: number;
  twinkleSpeed: number;
  twinklePhase: number;
  isBrightStar: boolean;
}

interface NebulaCloud {
  angle: number;
  radius: number;
  size: number;
  speed: number;
  alpha: number;
}

interface SuperstringState {
  particles: VortexParticle[];
  nebulae: NebulaCloud[];
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  rotationAngle: number;
  nebulaSprite: HTMLCanvasElement | null;
  starSprite: HTMLCanvasElement | null;
}

/**
 * Creates an offscreen sprite canvas with a soft radial glow
 */
function createRadialGlowSprite(size: number, colorStops: [number, string][]): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ctx.createRadialGradient !== "function") return null;

    const center = size / 2;
    const grd = ctx.createRadialGradient(center, center, 0, center, center, center);
    if (!grd) return null;
    colorStops.forEach(([stop, color]) => grd.addColorStop(stop, color));

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    return canvas;
  } catch {
    return null;
  }
}

export const SuperstringSingularityV8Effect: EffectPlugin = {
  id: "superstring-singularity-v8",
  name: "量子超弦奇点",
  category: "space",
  description: "纯白量子超维星云旋涡与 4,600+ 颗开普勒对数螺旋星尘流场的三维空间共振 (60FPS/120FPS 硬件批量渲染)",
  preferredEngine: "canvas",

  parameters: [
    {
      id: "singularityMass",
      name: "引力奇点质量",
      type: "number",
      mode: "basic",
      min: 0.5,
      max: 3.0,
      step: 0.1,
      default: 1.0,
    },
    {
      id: "superstringTension",
      name: "旋涡旋转速度",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.2,
    },
    {
      id: "stardustDensity",
      name: "星尘粒子密度",
      type: "number",
      mode: "professional",
      min: 1000,
      max: 8000,
      step: 500,
      default: 4600,
    },
    {
      id: "chromaticAberration",
      name: "光子色散强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 2.0,
      step: 0.1,
      default: 0.8,
    },
    {
      id: "burstSensitivity",
      name: "瞬态爆发灵敏度",
      type: "number",
      mode: "basic",
      min: 0.1,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
    {
      id: "coreGlow",
      name: "核心光晕强度",
      type: "number",
      mode: "professional",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.5,
    },
  ],

  init(ctx: RenderContext) {
    const particleCount = 4600;
    const particles: VortexParticle[] = [];
    const arms = 4;

    for (let i = 0; i < particleCount; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distFrac = 0.05 + 0.95 * Math.pow(Math.random(), 1.15);
      const radius = 30 + distFrac * 820;

      const spiralAngle = armAngle + Math.log(radius * 0.05 + 1) * 2.8 + (Math.random() - 0.5) * 0.4;
      const orbitSpeed = (0.006 + (1 / Math.sqrt(radius)) * 0.18) * 0.8;
      const diskThickness = 10 + (radius / 820) * 45;
      const height = (Math.random() - 0.5) * diskThickness;
      const isBrightStar = Math.random() < 0.12;

      particles.push({
        radius,
        baseRadius: radius,
        angle: spiralAngle,
        speed: orbitSpeed,
        height,
        size: isBrightStar ? 1.8 + Math.random() * 2.4 : 0.8 + Math.random() * 1.6,
        alpha: isBrightStar ? 0.8 + Math.random() * 0.2 : 0.4 + Math.random() * 0.5,
        arm,
        twinkleSpeed: 1.5 + Math.random() * 4,
        twinklePhase: Math.random() * Math.PI * 2,
        isBrightStar,
      });
    }

    const nebulae: NebulaCloud[] = [];
    for (let i = 0; i < 28; i++) {
      const arm = i % 4;
      const armAngle = (arm / 4) * Math.PI * 2;
      const distFrac = 0.1 + (i / 28) * 0.85;
      const radius = 60 + distFrac * 700;
      const spiralAngle = armAngle + Math.log(radius * 0.05 + 1) * 2.8;

      nebulae.push({
        angle: spiralAngle,
        radius,
        size: 90 + Math.random() * 140,
        speed: (0.005 + (1 / Math.sqrt(radius)) * 0.14) * 0.8,
        alpha: 0.045 + Math.random() * 0.045,
      });
    }

    // 预渲染高性能离屏精灵纹理，杜绝逐帧创建 RadialGradient
    const nebulaSprite = createRadialGlowSprite(128, [
      [0, "rgba(235, 245, 255, 1)"],
      [0.45, "rgba(180, 210, 245, 0.4)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);

    const starSprite = createRadialGlowSprite(64, [
      [0, "rgba(255, 255, 255, 1)"],
      [0.25, "rgba(240, 250, 255, 0.6)"],
      [1, "rgba(240, 250, 255, 0)"],
    ]);

    const state: SuperstringState = {
      particles,
      nebulae,
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedEnergy: 0,
      rotationAngle: 0,
      nebulaSprite,
      starSprite,
    };

    ctx.private = { state };
  },

  render(ctx: RenderContext, audioData: AudioData, params) {
    if (!ctx.ctx || !ctx.canvas) return;
    const canvas = ctx.canvas;
    const g = ctx.ctx;
    const sw = canvas.width;
    const sh = canvas.height;
    const cx = sw / 2;
    const cy = sh / 2;

    const {
      singularityMass = 1.0,
      superstringTension = 1.2,
      stardustDensity = 4600,
      coreGlow = 1.5,
    } = params;

    let state = ctx.private?.state as SuperstringState | undefined;
    if (!state) {
      this.init(ctx);
      state = ctx.private?.state as SuperstringState;
    }

    // Audio smoothing
    const rawBass = audioData.bass || 0;
    const rawMid = audioData.mid || 0;
    const rawTreble = audioData.treble || 0;
    const rawEnergy = audioData.full || 0.2;

    state.smoothedBass += (rawBass - state.smoothedBass) * 0.18;
    state.smoothedMid += (rawMid - state.smoothedMid) * 0.16;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * 0.14;
    state.smoothedEnergy += (rawEnergy - state.smoothedEnergy) * 0.15;

    const bass = state.smoothedBass;
    const mid = state.smoothedMid;
    const treble = state.smoothedTreble;
    const energy = state.smoothedEnergy;

    const t = ctx.time || Date.now() * 0.0008;

    // 1. Obsidian Void Background & Ambient Haze
    g.save();
    g.fillStyle = "#010103";
    g.fillRect(0, 0, sw, sh);

    g.globalCompositeOperation = "screen";
    const bgGrd = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.65);
    bgGrd.addColorStop(0, `rgba(235, 245, 255, ${0.06 + bass * 0.06})`);
    bgGrd.addColorStop(0.35, `rgba(180, 205, 235, ${0.02 + mid * 0.02})`);
    bgGrd.addColorStop(0.8, "rgba(80, 110, 150, 0.008)");
    bgGrd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = bgGrd;
    g.fillRect(0, 0, sw, sh);
    g.restore();

    // 2. 3D Camera Projection Constants
    const fov = 580;
    const pitch = 0.70 + Math.sin(t * 0.2) * 0.03;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    state.rotationAngle += (0.003 + energy * 0.008) * superstringTension;
    const cosR = Math.cos(state.rotationAngle);
    const sinR = Math.sin(state.rotationAngle);

    // 3. 3D Flowing Spiral Nebula Gas Clouds (Blitted via Pre-rendered Sprite)
    if (state.nebulaSprite) {
      g.save();
      g.globalCompositeOperation = "screen";
      const sprite = state.nebulaSprite;

      for (let i = 0; i < state.nebulae.length; i++) {
        const neb = state.nebulae[i];
        neb.angle += neb.speed * (1 + energy * 1.5 + bass * 1.2);

        const curR = neb.radius * singularityMass * (1 + Math.sin(t * 2 + neb.angle * 2) * 0.05);
        const pxRaw = Math.cos(neb.angle) * curR;
        const pyRaw = Math.sin(t * 1.5 + neb.radius * 0.02) * 15;
        const pzRaw = Math.sin(neb.angle) * curR;

        const rx = pxRaw * cosR - pzRaw * sinR;
        const rz = pxRaw * sinR + pzRaw * cosR;
        const ry = pyRaw * cosP - rz * sinP;
        const finalZ = pyRaw * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        const screenX = cx + rx * scale;
        const screenY = cy + ry * scale;
        const nRadius = neb.size * scale * (1 + bass * 0.3);
        const nDiameter = nRadius * 2;
        const nAlpha = Math.min(0.25, neb.alpha * (0.8 + energy * 0.6) * scale);

        g.globalAlpha = nAlpha;
        g.drawImage(sprite, screenX - nRadius, screenY - nRadius, nDiameter, nDiameter);
      }
      g.restore();
    }

    // 4. 4,600+ Keplerian Vortex Particles (Hardware Batched Path Rendering)
    const activeCount = Math.min(stardustDensity, state.particles.length);
    const speedMult = 1 + energy * 2.0 + bass * 1.5;
    const waveAmp = 2 + bass * 8;
    const vertAmp = 4 + treble * 12;

    g.save();
    g.globalCompositeOperation = "screen";

    // 批量收集绘制指令，将数万次 draw calls 压缩为 2 次批量 GPU 渲染
    g.beginPath();
    g.strokeStyle = "rgba(235, 245, 255, 0.75)";
    g.lineWidth = 1.1;

    for (let i = 0; i < activeCount; i++) {
      const p = state.particles[i];
      p.angle += p.speed * speedMult;

      const waveDisp = Math.sin(t * 3 + p.angle * 4) * waveAmp;
      const curR = (p.radius + waveDisp) * singularityMass;

      const pxRaw = Math.cos(p.angle) * curR;
      const pyRaw = p.height + Math.sin(t * 2.5 + p.radius * 0.05) * vertAmp;
      const pzRaw = Math.sin(p.angle) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = cy + ry * scale;

      const tangentAngle = p.angle + Math.PI / 2;
      const streakLength = Math.max(2.0, (180 / Math.max(25, curR)) * (1 + bass * 1.5) * scale * 2.5);
      const streakEndX = screenX + Math.cos(tangentAngle) * streakLength;
      const streakEndY = screenY + Math.sin(tangentAngle) * streakLength * cosP;

      g.moveTo(screenX, screenY);
      g.lineTo(streakEndX, streakEndY);
    }
    g.stroke();

    // 批量填充星尘粒子圆点
    g.beginPath();
    g.fillStyle = "rgba(255, 255, 255, 0.9)";
    for (let i = 0; i < activeCount; i++) {
      const p = state.particles[i];
      const waveDisp = Math.sin(t * 3 + p.angle * 4) * waveAmp;
      const curR = (p.radius + waveDisp) * singularityMass;

      const pxRaw = Math.cos(p.angle) * curR;
      const pyRaw = p.height + Math.sin(t * 2.5 + p.radius * 0.05) * vertAmp;
      const pzRaw = Math.sin(p.angle) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = cy + ry * scale;
      const pSize = Math.max(0.7, p.size * scale * (1 + treble * 0.8));

      g.moveTo(screenX + pSize, screenY);
      g.arc(screenX, screenY, pSize, 0, Math.PI * 2);
    }
    g.fill();

    // 亮星高光光晕快速贴图
    if (state.starSprite) {
      const starSprite = state.starSprite;
      for (let i = 0; i < activeCount; i += 7) {
        const p = state.particles[i];
        if (!p.isBrightStar) continue;

        const waveDisp = Math.sin(t * 3 + p.angle * 4) * waveAmp;
        const curR = (p.radius + waveDisp) * singularityMass;
        const pxRaw = Math.cos(p.angle) * curR;
        const pyRaw = p.height + Math.sin(t * 2.5 + p.radius * 0.05) * vertAmp;
        const pzRaw = Math.sin(p.angle) * curR;

        const rx = pxRaw * cosR - pzRaw * sinR;
        const rz = pxRaw * sinR + pzRaw * cosR;
        const ry = pyRaw * cosP - rz * sinP;
        const finalZ = pyRaw * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        const screenX = cx + rx * scale;
        const screenY = cy + ry * scale;
        const glowSize = Math.max(8, p.size * scale * 6);

        g.globalAlpha = 0.45;
        g.drawImage(starSprite, screenX - glowSize / 2, screenY - glowSize / 2, glowSize, glowSize);
      }
    }

    g.restore();

    // 5. Compact Singularity Core
    const coreRadius = (14 + bass * 12) * singularityMass * coreGlow;
    g.save();
    g.globalCompositeOperation = "screen";

    const coreGrd = g.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 3.5);
    coreGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    coreGrd.addColorStop(0.2, `rgba(240, 248, 255, ${0.85 + bass * 0.15})`);
    coreGrd.addColorStop(0.5, `rgba(180, 215, 255, ${0.35 + mid * 0.25})`);
    coreGrd.addColorStop(0.8, "rgba(100, 150, 220, 0.05)");
    coreGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

    g.fillStyle = coreGrd;
    g.beginPath();
    g.arc(cx, cy, coreRadius * 3.5, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#FFFFFF";
    g.beginPath();
    g.arc(cx, cy, coreRadius * 0.65, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(255, 255, 255, 0.95)";
    g.lineWidth = 1.6 + bass * 1.8;
    g.shadowColor = "#FFFFFF";
    g.shadowBlur = 18 * coreGlow;
    g.beginPath();
    g.arc(cx, cy, coreRadius * 0.95, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  },

  resize(_width: number, _height: number) {},

  destroy(ctx?: RenderContext) {
    if (ctx && ctx.private) {
      ctx.private.state = null;
    }
  },
};
