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
  twinklePhase: number;
  twinkleSpeed: number;
}

interface DeepBackgroundStar {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
}

interface NebulaCloudPuff {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  vx: number;
  vy: number;
}

interface SuperstringState {
  particles: VortexParticle[];
  stars: DeepBackgroundStar[];
  nebulae: NebulaCloudPuff[];
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  rotationAngle: number;
  singularityPulse: number;
  lastBeatTime: number;
}

export const SuperstringSingularityV8Effect: EffectPlugin = {
  id: "superstring-singularity-v8",
  name: "量子超弦奇点",
  category: "space",
  description: "纯白量子超维星云旋涡与 5,800+ 颗开普勒对数螺旋星尘流场的三维空间共振",
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
      default: 5800,
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
    const particleCount = 5800;
    const particles: VortexParticle[] = [];
    const arms = 3;

    for (let i = 0; i < particleCount; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distFrac = Math.pow(Math.random(), 2.2);
      const radius = 12 + distFrac * 680;
      const spiralAngle = armAngle + Math.log(radius + 1) * 3.6 + (Math.random() - 0.5) * 0.45;
      const orbitSpeed = (0.008 + (1 / Math.pow(radius, 0.45)) * 0.22) * 0.85;
      const diskThickness = 6 + (radius / 680) * 35;
      const height = (Math.random() - 0.5) * diskThickness;

      particles.push({
        radius,
        baseRadius: radius,
        angle: spiralAngle,
        speed: orbitSpeed,
        height,
        size: 0.4 + Math.random() * 1.8,
        alpha: 0.25 + Math.random() * 0.75,
        arm,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 1 + Math.random() * 3,
      });
    }

    const stars: DeepBackgroundStar[] = [];
    for (let i = 0; i < 450; i++) {
      stars.push({
        x: (Math.random() - 0.5) * (ctx.width || 1920) * 1.5,
        y: (Math.random() - 0.5) * (ctx.height || 1080) * 1.5,
        z: Math.random() * 900 + 100,
        size: 0.4 + Math.random() * 1.5,
        alpha: 0.15 + Math.random() * 0.8,
      });
    }

    const nebulae: NebulaCloudPuff[] = [];
    for (let i = 0; i < 6; i++) {
      nebulae.push({
        x: (Math.random() - 0.5) * (ctx.width || 1920) * 0.6,
        y: (Math.random() - 0.5) * (ctx.height || 1080) * 0.5,
        radius: 260 + Math.random() * 320,
        alpha: 0.03 + Math.random() * 0.04,
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.04,
      });
    }

    const state: SuperstringState = {
      particles,
      stars,
      nebulae,
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedEnergy: 0,
      rotationAngle: 0,
      singularityPulse: 1.0,
      lastBeatTime: 0,
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
      stardustDensity = 5800,
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

    const t = ctx.time || Date.now() * 0.0006;

    // 1. Obsidian Void Background & Ambient Haze
    g.save();
    g.fillStyle = "#010103";
    g.fillRect(0, 0, sw, sh);

    g.globalCompositeOperation = "screen";
    const bgGrd = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.7);
    bgGrd.addColorStop(0, `rgba(235, 245, 255, ${0.08 + bass * 0.08})`);
    bgGrd.addColorStop(0.25, `rgba(180, 205, 235, ${0.03 + mid * 0.03})`);
    bgGrd.addColorStop(0.65, "rgba(80, 110, 150, 0.01)");
    bgGrd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = bgGrd;
    g.fillRect(0, 0, sw, sh);

    // Volumetric Cosmic Dust Clouds
    for (let i = 0; i < state.nebulae.length; i++) {
      const neb = state.nebulae[i];
      neb.x += neb.vx;
      neb.y += neb.vy;
      const nx = cx + neb.x + Math.sin(t * 0.4 + i) * 40;
      const ny = cy + neb.y + Math.cos(t * 0.3 + i) * 30;
      const nRadius = neb.radius * (1 + bass * 0.25);

      const nGrd = g.createRadialGradient(nx, ny, 0, nx, ny, nRadius);
      const nAlpha = neb.alpha * (0.8 + energy * 0.6);
      nGrd.addColorStop(0, `rgba(220, 235, 255, ${nAlpha.toFixed(3)})`);
      nGrd.addColorStop(0.5, `rgba(160, 190, 230, ${(nAlpha * 0.35).toFixed(3)})`);
      nGrd.addColorStop(1, "rgba(0,0,0,0)");

      g.fillStyle = nGrd;
      g.beginPath();
      g.arc(nx, ny, nRadius, 0, Math.PI * 2);
      g.fill();
    }

    // Deep Starfield
    for (let i = 0; i < state.stars.length; i++) {
      const s = state.stars[i];
      const sx = cx + (s.x / s.z) * 520;
      const sy = cy + (s.y / s.z) * 520;

      if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
        const sAlpha = s.alpha * (0.4 + (Math.sin(t * 2 + i) * 0.5 + 0.5) * 0.6) * (1 - s.z / 1100);
        g.fillStyle = `rgba(235, 245, 255, ${sAlpha.toFixed(3)})`;
        g.fillRect(sx, sy, s.size, s.size);
      }
    }
    g.restore();

    // 2. 3D Camera Projection
    const fov = 560;
    const pitch = 0.72 + Math.sin(t * 0.2) * 0.03;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    state.rotationAngle += (0.003 + energy * 0.008) * superstringTension;
    const cosR = Math.cos(state.rotationAngle);
    const sinR = Math.sin(state.rotationAngle);

    // 3. 3D Keplerian Vortex Particles (No Hard Lines / Bars)
    const activeCount = Math.min(stardustDensity, state.particles.length);
    g.save();
    g.globalCompositeOperation = "screen";

    for (let i = 0; i < activeCount; i++) {
      const p = state.particles[i];
      const speedMult = (1 + energy * 1.8 + bass * 1.4);
      p.angle += p.speed * speedMult;

      const waveDisplacement = Math.sin(t * 2.5 + p.angle * 3) * (1 + bass * 0.15);
      const curR = (p.radius + waveDisplacement * 4) * singularityMass;

      const pxRaw = Math.cos(p.angle) * curR;
      const pyRaw = p.height + Math.sin(t * 3 + p.radius * 0.08) * (2 + treble * 8);
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
      const streakLength = Math.max(1.5, (120 / Math.max(15, curR)) * (1 + bass * 1.4) * scale * 2.2);
      const streakEndX = screenX + Math.cos(tangentAngle) * streakLength;
      const streakEndY = screenY + Math.sin(tangentAngle) * streakLength * cosP;

      const twinkle = Math.sin(t * p.twinkleSpeed + p.twinklePhase) * 0.5 + 0.5;
      const pAlpha = Math.min(1, p.alpha * (0.35 + energy * 0.65 + twinkle * 0.25) * (scale * 0.95));
      const pSize = Math.max(0.4, p.size * scale * (1 + treble * 1.2));

      g.strokeStyle = `rgba(235, 245, 255, ${(pAlpha * 0.75).toFixed(3)})`;
      g.lineWidth = pSize * 0.75;
      g.beginPath();
      g.moveTo(screenX, screenY);
      g.lineTo(streakEndX, streakEndY);
      g.stroke();

      g.fillStyle = `rgba(255, 255, 255, ${pAlpha.toFixed(3)})`;
      g.beginPath();
      g.arc(screenX, screenY, pSize, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // 4. Soft Singularity Core Glow
    const coreRadius = (22 + bass * 18) * singularityMass * coreGlow;
    g.save();
    g.globalCompositeOperation = "screen";

    const coreGrd = g.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 3.8);
    coreGrd.addColorStop(0, `rgba(255, 255, 255, ${0.95 + bass * 0.05})`);
    coreGrd.addColorStop(0.18, `rgba(240, 248, 255, ${0.8 + bass * 0.2})`);
    coreGrd.addColorStop(0.45, `rgba(190, 220, 255, ${0.35 + mid * 0.25})`);
    coreGrd.addColorStop(0.75, "rgba(100, 150, 220, 0.06)");
    coreGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

    g.fillStyle = coreGrd;
    g.beginPath();
    g.arc(cx, cy, coreRadius * 3.8, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#FFFFFF";
    g.beginPath();
    g.arc(cx, cy, coreRadius * 0.75, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(255, 255, 255, 0.9)";
    g.lineWidth = 1.8 + bass * 2.2;
    g.shadowColor = "#FFFFFF";
    g.shadowBlur = 24 * coreGlow;
    g.beginPath();
    g.arc(cx, cy, coreRadius * 0.95, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  },

  resize(_width: number, _height: number) {},

  destroy(ctx?: RenderContext) {
    if (ctx?.private?.state) {
      ctx.private.state = null;
    }
  },
};
