/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface StarParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

interface SuperstringState {
  stars: StarParticle[];
  shockwaves: GravitationalShockwave[];
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  rotationAngle: number;
  lastBassTriggerTime: number;
}

export const SuperstringSingularityV8Effect: EffectPlugin = {
  id: "superstring-singularity-v8",
  name: "量子超弦奇点",
  category: "space",
  description:
    "电影《星际穿越》卡冈图雅（Gargantua）真实引力透镜黑洞：爱因斯坦天冠光拱、赤道多普勒集束盘与纯黑事件视界",
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
      name: "自转流速",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.2,
    },
    {
      id: "stardustDensity",
      name: "透镜星场密度",
      type: "number",
      mode: "professional",
      min: 60,
      max: 240,
      step: 20,
      default: 160,
    },
    {
      id: "chromaticAberration",
      name: "多普勒光芒强度",
      type: "number",
      mode: "professional",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.0,
    },
    {
      id: "burstSensitivity",
      name: "引力冲击灵敏度",
      type: "number",
      mode: "basic",
      min: 0.1,
      max: 2.0,
      step: 0.1,
      default: 1.1,
    },
    {
      id: "coreGlow",
      name: "光子球发光倍率",
      type: "number",
      mode: "professional",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.2,
    },
  ],

  init(ctx: RenderContext) {
    const stars: StarParticle[] = [];
    const sw = ctx.canvas?.width || 1920;
    const sh = ctx.canvas?.height || 1080;

    for (let i = 0; i < 160; i++) {
      stars.push({
        x: (Math.random() - 0.5) * sw * 1.4,
        y: (Math.random() - 0.5) * sh * 1.4,
        size: Math.random() < 0.15 ? 1.6 : Math.random() < 0.5 ? 1.0 : 0.6,
        alpha: 0.25 + Math.random() * 0.65,
        twinkleSpeed: 1.5 + Math.random() * 3.0,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    const state: SuperstringState = {
      stars,
      shockwaves: [],
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedEnergy: 0,
      rotationAngle: 0,
      lastBassTriggerTime: 0,
    };

    ctx.private = { state };
  },

  render(ctx: RenderContext, audioData: AudioData, params) {
    if (!ctx.ctx || !ctx.canvas) return;
    const canvas = ctx.canvas;
    const g = ctx.ctx;
    const sw = canvas.width;
    const sh = canvas.height;

    const {
      singularityMass = 1.0,
      superstringTension = 1.2,
      burstSensitivity = 1.1,
      coreGlow = 1.2,
    } = params;

    let state = ctx.private?.state as SuperstringState | undefined;
    if (!state || !state.stars || state.stars.length === 0) {
      this.init(ctx);
      state = ctx.private?.state as SuperstringState;
    }

    const cx = sw * 0.5;
    const cy = sh * 0.52;

    const rawBass = audioData.bass || 0;
    const rawMid = audioData.mid || 0;
    const rawTreble = audioData.treble || 0;
    const rawEnergy = audioData.full || 0.15;

    state.smoothedBass += (rawBass - state.smoothedBass) * 0.22;
    state.smoothedMid += (rawMid - state.smoothedMid) * 0.18;
    state.smoothedTreble += (rawTreble - state.smoothedTreble) * 0.16;
    state.smoothedEnergy += (rawEnergy - state.smoothedEnergy) * 0.18;

    const bass = state.smoothedBass;
    const mid = state.smoothedMid;
    const treble = state.smoothedTreble;
    const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;

    const t = ctx.time || Date.now() * 0.0008;

    const nowMs = Date.now();
    if (
      rawBass > 0.68 &&
      rawBass - state.smoothedBass > 0.24 * burstSensitivity &&
      nowMs - state.lastBassTriggerTime > 300 &&
      state.shockwaves.length < 2
    ) {
      state.lastBassTriggerTime = nowMs;
      state.shockwaves.push({
        radius: 95 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.85,
        alpha: 0.65,
        speed: 18 + bass * 20,
      });
    }

    state.rotationAngle += (0.003 + energy * 0.006) * superstringTension;
    const rot = state.rotationAngle;

    const horizonR = (98 + bass * 18) * singularityMass;
    const diskTiltAngle = -0.58;
    const cosD = Math.cos(diskTiltAngle);
    const sinD = Math.sin(diskTiltAngle);

    // 1. 深空背景与透镜星场
    g.save();
    g.fillStyle = "#010003";
    g.fillRect(0, 0, sw, sh);

    const spaceGrd = g.createRadialGradient(cx, cy, horizonR * 1.2, cx, cy, Math.max(sw, sh) * 0.8);
    spaceGrd.addColorStop(0, "rgba(45, 12, 10, 0.4)");
    spaceGrd.addColorStop(0.4, "rgba(22, 6, 8, 0.25)");
    spaceGrd.addColorStop(1, "rgba(1, 0, 3, 0.95)");
    g.fillStyle = spaceGrd;
    g.fillRect(0, 0, sw, sh);

    for (let i = 0; i < state.stars.length; i++) {
      const s = state.stars[i];
      const sx = cx + s.x;
      const sy = cy + s.y;
      const dx = sx - cx;
      const dy = sy - cy;
      const dist = Math.hypot(dx, dy);

      if (dist < horizonR * 0.95) continue;

      const deflection = (horizonR * horizonR * 1.4) / (dist + 0.1);
      const renderX = sx + (dx / dist) * deflection;
      const renderY = sy + (dy / dist) * deflection;

      if (renderX < -20 || renderX > sw + 20 || renderY < -20 || renderY > sh + 20) continue;

      const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
      const starAlpha = s.alpha * twinkle;

      g.fillStyle = `rgba(240, 245, 255, ${starAlpha})`;
      g.beginPath();
      g.arc(renderX, renderY, s.size, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // 2. 上方引力透镜天冠
    g.save();
    renderLensedCrownV8(
      g,
      cx,
      cy,
      horizonR,
      diskTiltAngle,
      cosD,
      sinD,
      rot,
      t,
      bass,
      mid,
      treble,
      coreGlow
    );
    g.restore();

    // 3. 下方引力透镜下腹
    g.save();
    renderLensedUnderbellyV8(
      g,
      cx,
      cy,
      horizonR,
      diskTiltAngle,
      cosD,
      sinD,
      rot,
      t,
      bass,
      mid,
      treble
    );
    g.restore();

    // 4. 3D 纯黑施瓦西视界与光子球环
    g.save();
    g.fillStyle = "#000000";
    g.beginPath();
    g.arc(cx, cy, horizonR, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(255, 255, 255, 0.95)";
    g.lineWidth = 1.2 + bass * 0.6;
    g.beginPath();
    g.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
    g.stroke();

    g.strokeStyle = "rgba(255, 240, 180, 0.4)";
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // 5. 赤道面前置主吸积盘
    g.save();
    renderEquatorialDiskV8(
      g,
      cx,
      cy,
      horizonR,
      diskTiltAngle,
      cosD,
      sinD,
      rot,
      t,
      bass,
      mid,
      treble,
      coreGlow
    );
    g.restore();

    // 6. 引力波涟漪
    if (state.shockwaves.length > 0) {
      g.save();
      for (let i = state.shockwaves.length - 1; i >= 0; i--) {
        const swItem = state.shockwaves[i];
        swItem.radius += swItem.speed;
        swItem.alpha *= 0.94;

        if (swItem.alpha < 0.01 || swItem.radius > swItem.maxRadius) {
          state.shockwaves.splice(i, 1);
          continue;
        }

        g.strokeStyle = `rgba(255, 180, 80, ${swItem.alpha * 0.4})`;
        g.lineWidth = 1.8;
        g.beginPath();
        g.ellipse(cx, cy, swItem.radius, swItem.radius * 0.38, diskTiltAngle, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }
  },

  resize(_width: number, _height: number) {},

  destroy(ctx?: RenderContext) {
    if (ctx && ctx.private) {
      ctx.private.state = null;
    }
  },
};

function renderLensedCrownV8(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  diskAngle: number,
  cosD: number,
  sinD: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number,
  coreGlow: number
) {
  const crownOuterR = horizonR * 2.25;
  const crownInnerR = horizonR * 1.03;

  const outerSmearGrd = g.createRadialGradient(
    cx,
    cy,
    crownInnerR * 1.05,
    cx,
    cy - horizonR * 0.15,
    crownOuterR * 1.15
  );
  outerSmearGrd.addColorStop(0, "rgba(255, 180, 40, 0.85)");
  outerSmearGrd.addColorStop(0.28, "rgba(235, 95, 20, 0.65)");
  outerSmearGrd.addColorStop(0.65, "rgba(160, 30, 8, 0.35)");
  outerSmearGrd.addColorStop(0.9, "rgba(80, 10, 4, 0.15)");
  outerSmearGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = outerSmearGrd;
  g.beginPath();
  g.ellipse(cx, cy, crownOuterR, crownOuterR * 0.82, diskAngle, Math.PI * 0.96, Math.PI * 2.04);
  g.ellipse(
    cx,
    cy,
    crownInnerR,
    crownInnerR * 0.76,
    diskAngle,
    Math.PI * 2.04,
    Math.PI * 0.96,
    true
  );
  g.closePath();
  g.fill();

  const innerArchGrd = g.createRadialGradient(
    cx - horizonR * 0.15,
    cy - horizonR * 0.1,
    crownInnerR * 0.98,
    cx,
    cy,
    crownInnerR * 1.55
  );
  innerArchGrd.addColorStop(0, "rgba(255, 255, 250, 0.98)");
  innerArchGrd.addColorStop(0.22, "rgba(255, 235, 130, 0.92)");
  innerArchGrd.addColorStop(0.6, "rgba(255, 145, 30, 0.6)");
  innerArchGrd.addColorStop(1, "rgba(200, 50, 10, 0)");

  g.fillStyle = innerArchGrd;
  g.beginPath();
  g.ellipse(
    cx,
    cy,
    crownInnerR * 1.5,
    crownInnerR * 1.18,
    diskAngle,
    Math.PI * 0.96,
    Math.PI * 2.04
  );
  g.ellipse(
    cx,
    cy,
    crownInnerR,
    crownInnerR * 0.78,
    diskAngle,
    Math.PI * 2.04,
    Math.PI * 0.96,
    true
  );
  g.closePath();
  g.fill();

  for (let i = 0; i < 12; i++) {
    const frac = i / 11;
    const r = crownInnerR + frac * (crownOuterR - crownInnerR) * 0.85;
    const ry = crownInnerR * 0.78 + frac * (crownOuterR * 0.82 - crownInnerR * 0.78) * 0.85;
    const alpha = (0.28 - frac * 0.18) * (1 + mid * 0.35);

    if (frac < 0.25) {
      g.strokeStyle = `rgba(255, 250, 220, ${alpha * 1.2})`;
    } else if (frac < 0.6) {
      g.strokeStyle = `rgba(255, 175, 45, ${alpha})`;
    } else {
      g.strokeStyle = `rgba(210, 65, 15, ${alpha * 0.8})`;
    }

    g.lineWidth = 2.0 + (1 - frac) * 3.5;
    g.beginPath();
    g.ellipse(cx, cy, r, ry, diskAngle, Math.PI * 0.98, Math.PI * 2.02);
    g.stroke();
  }

  const leftBoostGrd = g.createRadialGradient(
    cx - horizonR * 0.9,
    cy - horizonR * 0.4,
    10,
    cx - horizonR * 0.9,
    cy - horizonR * 0.4,
    horizonR * 1.2
  );
  leftBoostGrd.addColorStop(0, "rgba(255, 255, 255, 0.85)");
  leftBoostGrd.addColorStop(0.35, "rgba(255, 220, 100, 0.55)");
  leftBoostGrd.addColorStop(0.75, "rgba(255, 130, 25, 0.2)");
  leftBoostGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = leftBoostGrd;
  g.beginPath();
  g.arc(cx - horizonR * 0.9, cy - horizonR * 0.4, horizonR * 1.1, 0, Math.PI * 2);
  g.fill();
}

function renderLensedUnderbellyV8(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  diskAngle: number,
  cosD: number,
  sinD: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number
) {
  const underInnerR = horizonR * 1.03;
  const underOuterR = horizonR * 1.62;

  const underGrd = g.createRadialGradient(
    cx,
    cy + horizonR * 0.1,
    underInnerR * 0.98,
    cx,
    cy + horizonR * 0.2,
    underOuterR * 1.1
  );
  underGrd.addColorStop(0, "rgba(255, 240, 160, 0.75)");
  underGrd.addColorStop(0.3, "rgba(240, 115, 25, 0.55)");
  underGrd.addColorStop(0.7, "rgba(160, 40, 10, 0.28)");
  underGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = underGrd;
  g.beginPath();
  g.ellipse(cx, cy, underOuterR, underOuterR * 0.65, diskAngle, 0, Math.PI);
  g.ellipse(cx, cy, underInnerR, underInnerR * 0.6, diskAngle, Math.PI, 0, true);
  g.closePath();
  g.fill();

  for (let i = 0; i < 6; i++) {
    const frac = i / 5;
    const r = underInnerR + frac * (underOuterR - underInnerR) * 0.8;
    const ry = underInnerR * 0.6 + frac * (underOuterR * 0.65 - underInnerR * 0.6) * 0.8;

    g.strokeStyle = `rgba(235, 110, 25, ${(0.22 - frac * 0.15) * (1 + mid * 0.3)})`;
    g.lineWidth = 1.8 + (1 - frac) * 2.2;
    g.beginPath();
    g.ellipse(cx, cy, r, ry, diskAngle, 0.05, Math.PI - 0.05);
    g.stroke();
  }
}

function renderEquatorialDiskV8(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  diskAngle: number,
  cosD: number,
  sinD: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number,
  coreGlow: number
) {
  const diskLenL = horizonR * 5.4;
  const diskLenR = horizonR * 4.6;
  const diskThickness = horizonR * 0.52 * (1 + bass * 0.15);

  const ptsLeft: { x: number; y: number }[] = [];
  const ptsRight: { x: number; y: number }[] = [];
  const steps = 40;

  for (let i = 0; i <= steps; i++) {
    const prog = i / steps;
    const u = -diskLenL + prog * (diskLenL + diskLenR);

    const uDistNorm = u < 0 ? -u / diskLenL : u / diskLenR;
    const profile = Math.pow(1 - Math.min(1, uDistNorm), 0.65);
    const halfThick = diskThickness * profile * (u < 0 ? 1.25 : 0.85);

    const topX = cx + u * cosD - -halfThick * sinD;
    const topY = cy + u * sinD + -halfThick * cosD;
    const botX = cx + u * cosD - halfThick * sinD;
    const botY = cy + u * sinD + halfThick * cosD;

    ptsLeft.push({ x: topX, y: topY });
    ptsRight.unshift({ x: botX, y: botY });
  }

  const mainDiskGrd = g.createLinearGradient(
    cx - diskLenL * cosD,
    cy - diskLenL * sinD,
    cx + diskLenR * cosD,
    cy + diskLenR * sinD
  );
  mainDiskGrd.addColorStop(0, "rgba(80, 10, 4, 0)");
  mainDiskGrd.addColorStop(0.12, "rgba(180, 45, 12, 0.45)");
  mainDiskGrd.addColorStop(0.35, "rgba(255, 140, 30, 0.88)");
  mainDiskGrd.addColorStop(0.5, "rgba(255, 245, 180, 0.98)");
  mainDiskGrd.addColorStop(0.72, "rgba(230, 95, 20, 0.68)");
  mainDiskGrd.addColorStop(0.9, "rgba(140, 30, 8, 0.35)");
  mainDiskGrd.addColorStop(1, "rgba(50, 8, 3, 0)");

  g.fillStyle = mainDiskGrd;
  g.beginPath();
  g.moveTo(ptsLeft[0].x, ptsLeft[0].y);
  for (let p = 1; p < ptsLeft.length; p++) g.lineTo(ptsLeft[p].x, ptsLeft[p].y);
  for (let p = 0; p < ptsRight.length; p++) g.lineTo(ptsRight[p].x, ptsRight[p].y);
  g.closePath();
  g.fill();

  const coreBeamGrd = g.createLinearGradient(
    cx - diskLenL * 0.75 * cosD,
    cy - diskLenL * 0.75 * sinD,
    cx + diskLenR * 0.65 * cosD,
    cy + diskLenR * 0.65 * sinD
  );
  coreBeamGrd.addColorStop(0, "rgba(255, 160, 40, 0)");
  coreBeamGrd.addColorStop(0.2, "rgba(255, 225, 110, 0.85)");
  coreBeamGrd.addColorStop(0.45, "rgba(255, 255, 255, 1.0)");
  coreBeamGrd.addColorStop(0.65, "rgba(255, 215, 80, 0.8)");
  coreBeamGrd.addColorStop(1, "rgba(240, 110, 20, 0)");

  g.strokeStyle = coreBeamGrd;
  g.lineWidth = 5.5 + bass * 3.5;
  g.beginPath();
  g.moveTo(cx - diskLenL * 0.85 * cosD, cy - diskLenL * 0.85 * sinD);
  g.lineTo(cx + diskLenR * 0.75 * cosD, cy + diskLenR * 0.75 * sinD);
  g.stroke();

  g.strokeStyle = "rgba(255, 255, 255, 0.95)";
  g.lineWidth = 1.8 + bass * 1.0;
  g.beginPath();
  g.moveTo(cx - diskLenL * 0.65 * cosD, cy - diskLenL * 0.65 * sinD);
  g.lineTo(cx + diskLenR * 0.45 * cosD, cy + diskLenR * 0.45 * sinD);
  g.stroke();

  const dopplerFlareGrd = g.createRadialGradient(
    cx - horizonR * 1.8 * cosD,
    cy - horizonR * 1.8 * sinD,
    5,
    cx - horizonR * 1.8 * cosD,
    cy - horizonR * 1.8 * sinD,
    horizonR * 2.2
  );
  dopplerFlareGrd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  dopplerFlareGrd.addColorStop(0.25, "rgba(255, 230, 120, 0.7)");
  dopplerFlareGrd.addColorStop(0.65, "rgba(245, 115, 25, 0.3)");
  dopplerFlareGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = dopplerFlareGrd;
  g.beginPath();
  g.arc(cx - horizonR * 1.8 * cosD, cy - horizonR * 1.8 * sinD, horizonR * 2.2, 0, Math.PI * 2);
  g.fill();

  const iscoFlareGrd = g.createRadialGradient(cx, cy, horizonR * 0.95, cx, cy, horizonR * 1.6);
  iscoFlareGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  iscoFlareGrd.addColorStop(0.35, "rgba(255, 215, 90, 0.65)");
  iscoFlareGrd.addColorStop(0.75, "rgba(235, 100, 20, 0.25)");
  iscoFlareGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = iscoFlareGrd;
  g.beginPath();
  g.ellipse(cx, cy, horizonR * 1.55, horizonR * 0.65, diskAngle, 0, Math.PI * 2);
  g.fill();
}
