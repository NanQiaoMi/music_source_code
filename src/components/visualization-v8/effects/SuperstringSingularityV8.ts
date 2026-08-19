"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface PhotonicParticle {
  radius: number;
  angle: number;
  speed: number;
  height: number;
  size: number;
  brightness: number;
  arm: number;
  trailLength: number;
}

interface WhiteShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  lineWidth: number;
}

interface SuperstringState {
  particles: PhotonicParticle[];
  shockwaves: WhiteShockwave[];
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
  description: "纯白光子引力奇点黑洞与高维时空曲率塌陷漏斗、5,200+ 量子光子流场的三维空间共振",
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
      name: "超弦波动张力",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.2,
    },
    {
      id: "stardustDensity",
      name: "量子光子密度",
      type: "number",
      mode: "professional",
      min: 1000,
      max: 8000,
      step: 500,
      default: 5200,
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
      name: "光子环光晕",
      type: "number",
      mode: "professional",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.6,
    },
    {
      id: "colorTheme",
      name: "调色风格",
      type: "select",
      mode: "basic",
      default: "purewhite",
      options: [
        { label: "纯白光子 (极简黑白银)", value: "purewhite" },
        { label: "铂金极光 (冷光钛银微蓝)", value: "platinum" },
        { label: "太阳香槟 (暖光铂金香槟)", value: "champagne" },
      ],
    },
  ],

  init(ctx: RenderContext) {
    const particleCount = 5200;
    const particles: PhotonicParticle[] = [];
    const arms = 3;

    for (let i = 0; i < particleCount; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distRatio = Math.pow(Math.random(), 1.7);
      const radius = 25 + distRatio * 720;
      const spiralAngle = armAngle + Math.log(radius + 1) * 2.8 + (Math.random() - 0.5) * 0.4;
      const orbitSpeed = (0.008 + (1 / Math.sqrt(radius)) * 0.28) * 0.75;

      particles.push({
        radius,
        angle: spiralAngle,
        speed: orbitSpeed,
        height: (Math.random() - 0.5) * (15 + distRatio * 50),
        size: 0.4 + Math.random() * 2.0,
        brightness: 0.3 + Math.random() * 0.7,
        arm,
        trailLength: 2 + Math.random() * 6,
      });
    }

    const state: SuperstringState = {
      particles,
      shockwaves: [],
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
      stardustDensity = 5200,
      burstSensitivity = 1.0,
      coreGlow = 1.6,
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
    state.smoothedMid += (rawMid - state.smoothedMid) * 0.15;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * 0.12;
    state.smoothedEnergy += (rawEnergy - state.smoothedEnergy) * 0.15;

    const bass = state.smoothedBass;
    const mid = state.smoothedMid;
    const treble = state.smoothedTreble;
    const energy = state.smoothedEnergy;

    const t = ctx.time || Date.now() * 0.0007;

    // 1. Obsidian Void Background & Soft Ambient Haze
    g.save();
    g.fillStyle = "#020204";
    g.fillRect(0, 0, sw, sh);

    g.globalCompositeOperation = "screen";
    const bgGrd = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.75);
    bgGrd.addColorStop(0, `rgba(235, 245, 255, ${0.08 + bass * 0.08})`);
    bgGrd.addColorStop(0.35, `rgba(180, 205, 235, ${0.03 + mid * 0.04})`);
    bgGrd.addColorStop(0.7, "rgba(80, 100, 130, 0.01)");
    bgGrd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = bgGrd;
    g.fillRect(0, 0, sw, sh);
    g.restore();

    // 2. Beat Impact & Shockwaves
    const now = ctx.time || Date.now() / 1000;
    if (audioData.isBeat && now - state.lastBeatTime > 0.25) {
      state.lastBeatTime = now;
      state.singularityPulse = 1.0 + (audioData.beatImpact || 0.8) * 0.45 * burstSensitivity;

      state.shockwaves.push({
        radius: 20 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.95,
        alpha: 0.95,
        speed: 10 + (audioData.beatImpact || 1.0) * 16 * burstSensitivity,
        lineWidth: 2 + (audioData.beatImpact || 1.0) * 5,
      });
    } else {
      state.singularityPulse += (1.0 - state.singularityPulse) * 0.08;
    }

    state.rotationAngle += 0.003 + energy * 0.01;

    // 3. 3D Camera Projection
    const fov = 540;
    const pitch = 0.64 + Math.sin(t * 0.25) * 0.04;
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosR = Math.cos(state.rotationAngle);
    const sinR = Math.sin(state.rotationAngle);

    // 4. 3D Spacetime Curvature Funnel Grid
    g.save();
    g.globalCompositeOperation = "screen";

    const gridRings = 16;
    const gridSpokes = 24;
    const maxGridRadius = Math.max(sw, sh) * 0.75;

    for (let gr = 1; gr <= gridRings; gr++) {
      const ringFrac = gr / gridRings;
      const rRadius = Math.pow(ringFrac, 1.4) * maxGridRadius;
      const depthWarp = -Math.pow(1 - ringFrac, 2.2) * (180 + bass * 120) * singularityMass;
      const ringAlpha = (0.03 + ringFrac * 0.09) * (0.8 + energy * 0.4);

      g.beginPath();
      let first = true;
      for (let s = 0; s <= 60; s++) {
        const theta = (s / 60) * Math.PI * 2;
        const rawX = Math.cos(theta) * rRadius;
        const rawZ = Math.sin(theta) * rRadius;
        const rawY = depthWarp;

        const rx = rawX * cosR - rawZ * sinR;
        const rz = rawX * sinR + rawZ * cosR;
        const ry = rawY * cosP - rz * sinP;
        const finalZ = rawY * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        const px = cx + rx * scale;
        const py = cy + ry * scale;

        if (first) {
          g.moveTo(px, py);
          first = false;
        } else {
          g.lineTo(px, py);
        }
      }
      g.strokeStyle = `rgba(220, 235, 255, ${ringAlpha.toFixed(3)})`;
      g.lineWidth = 0.6;
      g.stroke();
    }

    for (let gs = 0; gs < gridSpokes; gs++) {
      const spokeAngle = (gs / gridSpokes) * Math.PI * 2;
      g.beginPath();
      let first = true;

      for (let seg = 1; seg <= 25; seg++) {
        const ringFrac = seg / 25;
        const rRadius = Math.pow(ringFrac, 1.4) * maxGridRadius;
        const depthWarp = -Math.pow(1 - ringFrac, 2.2) * (180 + bass * 120) * singularityMass;

        const rawX = Math.cos(spokeAngle) * rRadius;
        const rawZ = Math.sin(spokeAngle) * rRadius;
        const rawY = depthWarp;

        const rx = rawX * cosR - rawZ * sinR;
        const rz = rawX * sinR + rawZ * cosR;
        const ry = rawY * cosP - rz * sinP;
        const finalZ = rawY * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        const px = cx + rx * scale;
        const py = cy + ry * scale;

        if (first) {
          g.moveTo(px, py);
          first = false;
        } else {
          g.lineTo(px, py);
        }
      }
      g.strokeStyle = `rgba(200, 225, 255, ${0.04 + bass * 0.04})`;
      g.lineWidth = 0.5;
      g.stroke();
    }
    g.restore();

    // 5. Draw Shockwaves
    g.save();
    g.globalCompositeOperation = "screen";
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const swObj = state.shockwaves[i];
      swObj.radius += swObj.speed;
      swObj.alpha *= 0.935;

      if (swObj.alpha < 0.015 || swObj.radius > swObj.maxRadius) {
        state.shockwaves.splice(i, 1);
        continue;
      }

      const swGrd = g.createRadialGradient(
        cx,
        cy,
        Math.max(0, swObj.radius - 40),
        cx,
        cy,
        swObj.radius + 40
      );
      swGrd.addColorStop(0, "rgba(255,255,255,0)");
      swGrd.addColorStop(0.5, `rgba(255, 255, 255, ${(swObj.alpha * 0.95).toFixed(3)})`);
      swGrd.addColorStop(0.7, `rgba(210, 235, 255, ${(swObj.alpha * 0.4).toFixed(3)})`);
      swGrd.addColorStop(1, "rgba(255,255,255,0)");

      g.strokeStyle = swGrd;
      g.lineWidth = swObj.lineWidth;
      g.beginPath();
      g.arc(cx, cy, swObj.radius, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();

    // 6. Relativistic Polar White Jets
    g.save();
    g.globalCompositeOperation = "screen";
    const jetLen = (320 + treble * 520 + bass * 300) * coreGlow;
    const jetWidth = (8 + mid * 18) * coreGlow;

    const drawWhiteJet = (dir: 1 | -1) => {
      const targetY = cy + dir * jetLen;
      const jGrd = g.createLinearGradient(cx, cy, cx, targetY);
      jGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
      jGrd.addColorStop(0.1, "rgba(240, 248, 255, 0.85)");
      jGrd.addColorStop(0.4, "rgba(190, 220, 255, 0.3)");
      jGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

      g.fillStyle = jGrd;
      g.beginPath();
      g.moveTo(cx - jetWidth, cy);
      g.quadraticCurveTo(cx - jetWidth * 0.2, cy + dir * jetLen * 0.4, cx, targetY);
      g.quadraticCurveTo(cx + jetWidth * 0.2, cy + dir * jetLen * 0.4, cx + jetWidth, cy);
      g.closePath();
      g.fill();
    };

    drawWhiteJet(-1);
    drawWhiteJet(1);
    g.restore();

    // 7. 3D Liquid Mercury Superstring Ribbons
    const ribbonCount = 6;
    const ribbonSegs = 80;
    const waveData = audioData.waveformData || new Uint8Array(ribbonSegs);

    g.save();
    g.globalCompositeOperation = "screen";

    for (let r = 0; r < ribbonCount; r++) {
      const phase = (r / ribbonCount) * Math.PI * 2 + t * 1.5 * superstringTension;
      const baseRadius = (70 + r * 52) * singularityMass * (1 + bass * 0.35);
      const points: { x: number; y: number }[] = [];

      for (let s = 0; s <= ribbonSegs; s++) {
        const theta = (s / ribbonSegs) * Math.PI * 2;
        const waveIdx = Math.floor((s / ribbonSegs) * waveData.length);
        const wave = ((waveData[waveIdx] || 128) - 128) / 128;

        const harm1 = Math.sin(theta * 3 + phase) * (20 + mid * 50);
        const harm2 = Math.cos(theta * 5 - phase * 1.2) * (12 + treble * 30);
        const audioWarp = wave * (36 * superstringTension + bass * 30);

        const curR = baseRadius + harm1 + harm2 + audioWarp;
        const rawX = Math.cos(theta) * curR;
        const rawY = Math.sin(theta * 3 + phase) * (22 + mid * 40) + wave * 20;
        const rawZ = Math.sin(theta) * curR;

        const rx = rawX * cosR - rawZ * sinR;
        const rz = rawX * sinR + rawZ * cosR;
        const ry = rawY * cosP - rz * sinP;
        const finalZ = rawY * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        points.push({
          x: cx + rx * scale,
          y: cy + ry * scale,
        });
      }

      if (points.length > 3) {
        g.beginPath();
        g.moveTo(points[0].x, points[0].y);

        for (let p = 0; p < points.length - 1; p++) {
          const p0 = points[p];
          const p1 = points[p + 1];
          const midX = (p0.x + p1.x) / 2;
          const midY = (p0.y + p1.y) / 2;
          g.quadraticCurveTo(p0.x, p0.y, midX, midY);
        }
        g.closePath();

        const alpha = 0.5 + mid * 0.45;
        g.strokeStyle = `rgba(245, 250, 255, ${alpha.toFixed(3)})`;
        g.lineWidth = (1.6 + (r % 2) * 0.8 + bass * 1.8) * coreGlow;
        g.shadowColor = "rgba(255, 255, 255, 0.9)";
        g.shadowBlur = (14 + mid * 24) * coreGlow;
        g.stroke();
      }
    }
    g.restore();

    // 8. 5,200+ Photonic Accretion Particles
    const activeCount = Math.min(stardustDensity, state.particles.length);
    g.save();
    g.globalCompositeOperation = "screen";

    for (let i = 0; i < activeCount; i++) {
      const p = state.particles[i];
      const speedMult = (1 + energy * 2.2 + bass * 1.6) * superstringTension;
      p.angle += p.speed * speedMult;

      const curR = p.radius * (1 + Math.sin(t * 2.5 + p.angle * 3) * (0.04 + bass * 0.16));
      const pxRaw = Math.cos(p.angle) * curR;
      const pyRaw = p.height + Math.sin(t * 3 + p.radius * 0.05) * (10 + treble * 25);
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
      const streakLen = p.trailLength * scale * (1 + bass * 1.5) * (180 / curR);
      const streakEndX = screenX + Math.cos(tangentAngle) * streakLen;
      const streakEndY = screenY + Math.sin(tangentAngle) * streakLen * cosP;

      const pAlpha = Math.min(1, p.brightness * (0.35 + energy * 0.75) * (scale * 0.95));
      const pSize = Math.max(0.5, p.size * scale * (1 + treble * 1.2));

      g.strokeStyle = `rgba(240, 248, 255, ${(pAlpha * 0.8).toFixed(3)})`;
      g.lineWidth = pSize * 0.7;
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

    // 9. Anamorphic Horizontal Pure White Flare
    g.save();
    g.globalCompositeOperation = "screen";
    const flareW = sw * (0.65 + bass * 0.35);
    const flareH = (8 + bass * 20) * coreGlow;

    const flareGrd = g.createRadialGradient(cx, cy, 0, cx, cy, flareW);
    flareGrd.addColorStop(0, `rgba(255, 255, 255, ${0.9 + bass * 0.1})`);
    flareGrd.addColorStop(0.15, "rgba(230, 245, 255, 0.65)");
    flareGrd.addColorStop(0.45, "rgba(180, 210, 245, 0.18)");
    flareGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

    g.fillStyle = flareGrd;
    g.beginPath();
    g.ellipse(cx, cy, flareW, flareH, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // 10. Blinding White-Hot Photonic Singularity Core
    const coreRadius = (16 + bass * 22) * singularityMass * state.singularityPulse * coreGlow;

    g.save();
    g.globalCompositeOperation = "screen";

    const glowGrd = g.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 4.5);
    glowGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    glowGrd.addColorStop(0.2, `rgba(240, 250, 255, ${0.85 + bass * 0.15})`);
    glowGrd.addColorStop(0.5, `rgba(190, 225, 255, ${0.4 + mid * 0.3})`);
    glowGrd.addColorStop(0.8, "rgba(100, 150, 220, 0.08)");
    glowGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

    g.fillStyle = glowGrd;
    g.beginPath();
    g.arc(cx, cy, coreRadius * 4.5, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#FFFFFF";
    g.beginPath();
    g.arc(cx, cy, coreRadius * 0.85, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(255, 255, 255, 1.0)";
    g.lineWidth = 2.5 + bass * 3.5;
    g.shadowColor = "#FFFFFF";
    g.shadowBlur = 30 * coreGlow;
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
