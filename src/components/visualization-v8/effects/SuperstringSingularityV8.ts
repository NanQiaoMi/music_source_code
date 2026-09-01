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
    "电影《星际穿越》卡冈图雅（Gargantua）真实物理引力透镜黑洞：爱因斯坦天冠光拱、赤道多普勒集束盘与纯黑事件视界",
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
      default: 180,
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

    for (let i = 0; i < 180; i++) {
      stars.push({
        x: (Math.random() - 0.5) * sw * 1.5,
        y: (Math.random() - 0.5) * sh * 1.5,
        size: Math.random() < 0.12 ? 1.5 : Math.random() < 0.45 ? 0.9 : 0.5,
        alpha: 0.2 + Math.random() * 0.7,
        twinkleSpeed: 1.2 + Math.random() * 2.8,
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

    const { singularityMass = 1.0, superstringTension = 1.2, burstSensitivity = 1.1 } = params;

    let state = ctx.private?.state as SuperstringState | undefined;
    if (!state || !state.stars || state.stars.length === 0) {
      this.init(ctx);
      state = ctx.private?.state as SuperstringState;
    }

    const cx = sw * 0.5;
    const cy = sh * 0.53;

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
        alpha: 0.6,
        speed: 18 + bass * 18,
      });
    }

    state.rotationAngle += (0.0028 + energy * 0.0055) * superstringTension;
    const rot = state.rotationAngle;

    const horizonR = (92 + bass * 16) * singularityMass;
    const diskTilt = -0.56;
    const cosD = Math.cos(diskTilt);
    const sinD = Math.sin(diskTilt);

    // 1. 深空背景
    g.save();
    g.fillStyle = "#020003";
    g.fillRect(0, 0, sw, sh);

    const spaceGrd = g.createRadialGradient(
      cx,
      cy,
      horizonR * 1.1,
      cx,
      cy,
      Math.max(sw, sh) * 0.85
    );
    spaceGrd.addColorStop(0, "rgba(40, 10, 8, 0.42)");
    spaceGrd.addColorStop(0.4, "rgba(18, 4, 6, 0.26)");
    spaceGrd.addColorStop(1, "rgba(2, 0, 3, 0.96)");
    g.fillStyle = spaceGrd;
    g.fillRect(0, 0, sw, sh);

    for (let i = 0; i < state.stars.length; i++) {
      const s = state.stars[i];
      const sx = cx + s.x;
      const sy = cy + s.y;
      const dx = sx - cx;
      const dy = sy - cy;
      const dist = Math.hypot(dx, dy);

      if (dist < horizonR * 0.98) continue;

      const deflection = (horizonR * horizonR * 1.35) / (dist + 0.1);
      const rx = sx + (dx / dist) * deflection;
      const ry = sy + (dy / dist) * deflection;

      if (rx < -10 || rx > sw + 10 || ry < -10 || ry > sh + 10) continue;

      const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
      g.fillStyle = `rgba(240, 245, 255, ${s.alpha * twinkle})`;
      g.beginPath();
      g.arc(rx, ry, s.size, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // 2. 上方引力透镜天冠
    g.save();
    renderTopCrownV8(g, cx, cy, horizonR, diskTilt, cosD, sinD, rot, t, bass, mid, treble);
    g.restore();

    // 3. 下方引力透镜下腹
    g.save();
    renderBottomUnderbellyV8(g, cx, cy, horizonR, diskTilt, cosD, sinD, rot, t, bass, mid, treble);
    g.restore();

    // 4. 纯黑施瓦西视界球体与光子球环
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
    g.restore();

    // 5. 赤道面前置主吸积盘
    g.save();
    renderFrontEquatorialDiskV8(
      g,
      cx,
      cy,
      horizonR,
      diskTilt,
      cosD,
      sinD,
      rot,
      t,
      bass,
      mid,
      treble
    );
    g.restore();

    // 6. 引力波冲击
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

        g.strokeStyle = `rgba(255, 175, 75, ${swItem.alpha * 0.38})`;
        g.lineWidth = 1.6;
        g.beginPath();
        g.ellipse(cx, cy, swItem.radius, swItem.radius * 0.42, diskTilt, 0, Math.PI * 2);
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

function renderTopCrownV8(
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
  const crownInnerR = horizonR * 1.02;
  const crownOuterR = horizonR * 2.35;

  const crownGrd = g.createRadialGradient(
    cx - horizonR * 0.2,
    cy - horizonR * 0.15,
    crownInnerR * 0.98,
    cx,
    cy - horizonR * 0.35,
    crownOuterR * 1.08
  );
  crownGrd.addColorStop(0, "rgba(255, 255, 240, 0.98)");
  crownGrd.addColorStop(0.12, "rgba(255, 220, 100, 0.92)");
  crownGrd.addColorStop(0.35, "rgba(250, 130, 25, 0.75)");
  crownGrd.addColorStop(0.68, "rgba(175, 38, 10, 0.45)");
  crownGrd.addColorStop(0.92, "rgba(85, 10, 4, 0.18)");
  crownGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = crownGrd;
  g.beginPath();
  g.ellipse(cx, cy, crownOuterR, crownOuterR * 0.84, diskAngle, Math.PI * 0.96, Math.PI * 2.04);
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

  g.lineCap = "round";
  for (let i = 0; i < 32; i++) {
    const frac = i / 31;
    const rx = crownInnerR + frac * (crownOuterR - crownInnerR) * 0.88;
    const ry = crownInnerR * 0.78 + frac * (crownOuterR * 0.84 - crownInnerR * 0.78) * 0.88;

    const wave = Math.sin(frac * 18.0 + rot * 4.0) * 0.08;
    const alpha = (0.24 - frac * 0.15 + wave) * (1 + mid * 0.25);
    if (alpha <= 0.01) continue;

    if (frac < 0.18) {
      g.strokeStyle = `rgba(255, 255, 230, ${alpha * 1.4})`;
    } else if (frac < 0.52) {
      g.strokeStyle = `rgba(255, 185, 55, ${alpha * 1.1})`;
    } else {
      g.strokeStyle = `rgba(215, 65, 15, ${alpha * 0.85})`;
    }

    g.lineWidth = 1.5 + (1 - frac) * 2.5;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, diskAngle, Math.PI * 0.97, Math.PI * 2.03);
    g.stroke();
  }

  const flareGrd = g.createRadialGradient(
    cx + horizonR * 1.6 * cosD,
    cy + horizonR * 1.6 * sinD - horizonR * 0.5,
    5,
    cx + horizonR * 1.6 * cosD,
    cy + horizonR * 1.6 * sinD - horizonR * 0.5,
    horizonR * 1.8
  );
  flareGrd.addColorStop(0, "rgba(255, 140, 30, 0.45)");
  flareGrd.addColorStop(0.5, "rgba(180, 40, 10, 0.2)");
  flareGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = flareGrd;
  g.beginPath();
  g.arc(
    cx + horizonR * 1.6 * cosD,
    cy + horizonR * 1.6 * sinD - horizonR * 0.5,
    horizonR * 1.8,
    0,
    Math.PI * 2
  );
  g.fill();
}

function renderBottomUnderbellyV8(
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
  const underInnerR = horizonR * 1.02;
  const underOuterR = horizonR * 1.72;

  const underGrd = g.createRadialGradient(
    cx,
    cy + horizonR * 0.1,
    underInnerR * 0.96,
    cx,
    cy + horizonR * 0.25,
    underOuterR * 1.05
  );
  underGrd.addColorStop(0, "rgba(255, 240, 160, 0.85)");
  underGrd.addColorStop(0.25, "rgba(245, 125, 28, 0.65)");
  underGrd.addColorStop(0.65, "rgba(165, 42, 10, 0.32)");
  underGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = underGrd;
  g.beginPath();
  g.ellipse(cx, cy, underOuterR, underOuterR * 0.66, diskAngle, 0.02, Math.PI * 0.98);
  g.ellipse(cx, cy, underInnerR, underInnerR * 0.6, diskAngle, Math.PI * 0.98, 0.02, true);
  g.closePath();
  g.fill();

  for (let i = 0; i < 12; i++) {
    const frac = i / 11;
    const rx = underInnerR + frac * (underOuterR - underInnerR) * 0.82;
    const ry = underInnerR * 0.6 + frac * (underOuterR * 0.66 - underInnerR * 0.6) * 0.82;

    g.strokeStyle = `rgba(240, 115, 28, ${(0.2 - frac * 0.12) * (1 + mid * 0.25)})`;
    g.lineWidth = 1.4 + (1 - frac) * 1.8;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, diskAngle, 0.06, Math.PI * 0.94);
    g.stroke();
  }
}

function renderFrontEquatorialDiskV8(
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
  const diskLenLeft = horizonR * 5.2;
  const diskLenRight = horizonR * 4.6;
  const diskHalfHeight = horizonR * 0.22 * (1 + bass * 0.12);

  const topPts: { x: number; y: number }[] = [];
  const botPts: { x: number; y: number }[] = [];
  const steps = 44;

  for (let i = 0; i <= steps; i++) {
    const prog = i / steps;
    const u = -diskLenLeft + prog * (diskLenLeft + diskLenRight);

    const normDist = u < 0 ? -u / diskLenLeft : u / diskLenRight;
    const thickness =
      diskHalfHeight * Math.pow(1 - Math.min(1, normDist), 0.7) * (u < 0 ? 1.3 : 0.85);

    const vOffset = horizonR * 0.18;

    const topX = cx + u * cosD - (-thickness + vOffset) * sinD;
    const topY = cy + u * sinD + (-thickness + vOffset) * cosD;

    const botX = cx + u * cosD - (thickness + vOffset) * sinD;
    const botY = cy + u * sinD + (thickness + vOffset) * cosD;

    topPts.push({ x: topX, y: topY });
    botPts.unshift({ x: botX, y: botY });
  }

  const diskGrd = g.createLinearGradient(
    cx - diskLenLeft * cosD,
    cy - diskLenLeft * sinD,
    cx + diskLenRight * cosD,
    cy + diskLenRight * sinD
  );
  diskGrd.addColorStop(0, "rgba(80, 10, 4, 0)");
  diskGrd.addColorStop(0.12, "rgba(195, 50, 12, 0.45)");
  diskGrd.addColorStop(0.32, "rgba(255, 145, 28, 0.88)");
  diskGrd.addColorStop(0.48, "rgba(255, 245, 175, 0.98)");
  diskGrd.addColorStop(0.7, "rgba(235, 100, 20, 0.7)");
  diskGrd.addColorStop(0.88, "rgba(145, 30, 8, 0.35)");
  diskGrd.addColorStop(1, "rgba(45, 6, 2, 0)");

  g.fillStyle = diskGrd;
  g.beginPath();
  g.moveTo(topPts[0].x, topPts[0].y);
  for (let p = 1; p < topPts.length; p++) g.lineTo(topPts[p].x, topPts[p].y);
  for (let p = 0; p < botPts.length; p++) g.lineTo(botPts[p].x, botPts[p].y);
  g.closePath();
  g.fill();

  const ribbonGrd = g.createLinearGradient(
    cx - diskLenLeft * 0.75 * cosD,
    cy - diskLenLeft * 0.75 * sinD,
    cx + diskLenRight * 0.65 * cosD,
    cy + diskLenRight * 0.65 * sinD
  );
  ribbonGrd.addColorStop(0, "rgba(255, 160, 40, 0)");
  ribbonGrd.addColorStop(0.2, "rgba(255, 225, 110, 0.85)");
  ribbonGrd.addColorStop(0.46, "rgba(255, 255, 255, 0.98)");
  ribbonGrd.addColorStop(0.68, "rgba(255, 210, 80, 0.78)");
  ribbonGrd.addColorStop(1, "rgba(240, 100, 18, 0)");

  g.strokeStyle = ribbonGrd;
  g.lineWidth = 3.6 + bass * 2.2;
  g.beginPath();
  const vOff = horizonR * 0.18;
  g.moveTo(
    cx - diskLenLeft * 0.82 * cosD - vOff * -sinD,
    cy - diskLenLeft * 0.82 * sinD + vOff * cosD
  );
  g.lineTo(
    cx + diskLenRight * 0.72 * cosD - vOff * -sinD,
    cy + diskLenRight * 0.72 * sinD + vOff * cosD
  );
  g.stroke();

  g.strokeStyle = "rgba(255, 255, 255, 0.95)";
  g.lineWidth = 1.2 + bass * 0.6;
  g.beginPath();
  g.moveTo(
    cx - diskLenLeft * 0.62 * cosD - vOff * -sinD,
    cy - diskLenLeft * 0.62 * sinD + vOff * cosD
  );
  g.lineTo(
    cx + diskLenRight * 0.45 * cosD - vOff * -sinD,
    cy + diskLenRight * 0.45 * sinD + vOff * cosD
  );
  g.stroke();

  const dopplerGrd = g.createRadialGradient(
    cx - horizonR * 1.65 * cosD,
    cy - horizonR * 1.65 * sinD + horizonR * 0.1,
    5,
    cx - horizonR * 1.65 * cosD,
    cy - horizonR * 1.65 * sinD + horizonR * 0.1,
    horizonR * 1.9
  );
  dopplerGrd.addColorStop(0, "rgba(255, 255, 250, 0.88)");
  dopplerGrd.addColorStop(0.22, "rgba(255, 220, 100, 0.65)");
  dopplerGrd.addColorStop(0.62, "rgba(245, 115, 25, 0.25)");
  dopplerGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = dopplerGrd;
  g.beginPath();
  g.arc(
    cx - horizonR * 1.65 * cosD,
    cy - horizonR * 1.65 * sinD + horizonR * 0.1,
    horizonR * 1.9,
    0,
    Math.PI * 2
  );
  g.fill();
}
