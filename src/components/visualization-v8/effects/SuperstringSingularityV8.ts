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

interface AccretionRibbon {
  relRadius: number;
  speed: number;
  phase: number;
  width: number;
  alpha: number;
  turbFreq: number;
  turbAmp: number;
  tier: number;
}

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

interface SuperstringState {
  stars: StarParticle[];
  ribbons: AccretionRibbon[];
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
      max: 360,
      step: 20,
      default: 320,
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

    for (let i = 0; i < 320; i++) {
      stars.push({
        x: (Math.random() - 0.5) * sw * 1.6,
        y: (Math.random() - 0.5) * sh * 1.6,
        size: Math.random() < 0.1 ? 1.4 : Math.random() < 0.4 ? 0.8 : 0.45,
        alpha: 0.15 + Math.random() * 0.75,
        twinkleSpeed: 1.0 + Math.random() * 2.5,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    const ribbons: AccretionRibbon[] = [];
    const ribbonCount = 48;
    for (let i = 0; i < ribbonCount; i++) {
      const frac = i / (ribbonCount - 1);
      let tier = 2;
      if (frac < 0.12) tier = 0;
      else if (frac < 0.32) tier = 1;
      else if (frac < 0.6) tier = 2;
      else if (frac < 0.82) tier = 3;
      else tier = 4;

      ribbons.push({
        relRadius: frac,
        speed: (0.015 / Math.sqrt(Math.max(0.1, frac + 0.12))) * 0.75,
        phase: Math.random() * Math.PI * 2,
        width: 1.0 + frac * 2.0,
        alpha: 0.18 + Math.sin(frac * Math.PI) * 0.28,
        turbFreq: 3 + (i % 5),
        turbAmp: 1.2 + (i % 3) * 0.8,
        tier,
      });
    }

    const state: SuperstringState = {
      stars,
      ribbons,
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
        alpha: 0.6,
        speed: 18 + bass * 18,
      });
    }

    state.rotationAngle += (0.0025 + energy * 0.005) * superstringTension;
    const rot = state.rotationAngle;

    const horizonR = (94 + bass * 15) * singularityMass;
    const diskTilt = -0.56;
    const cosD = Math.cos(diskTilt);
    const sinD = Math.sin(diskTilt);

    // 1. 深空背景与透镜星场
    g.save();
    g.fillStyle = "#010003";
    g.fillRect(0, 0, sw, sh);

    const spaceGrd = g.createRadialGradient(
      cx,
      cy,
      horizonR * 1.1,
      cx,
      cy,
      Math.max(sw, sh) * 0.85
    );
    spaceGrd.addColorStop(0, "rgba(35, 8, 6, 0.38)");
    spaceGrd.addColorStop(0.45, "rgba(16, 3, 5, 0.22)");
    spaceGrd.addColorStop(1, "rgba(1, 0, 3, 0.98)");
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
    renderTopCrownPhotorealV8(g, cx, cy, horizonR, diskTilt, cosD, sinD, rot, t, bass, mid, treble);
    g.restore();

    // 3. 下方引力透镜下腹
    g.save();
    renderBottomUnderbellyPhotorealV8(
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

    // 4. 纯黑施瓦西事件视界球体与光子球环
    g.save();
    g.fillStyle = "#000000";
    g.beginPath();
    g.arc(cx, cy, horizonR, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(255, 255, 255, 0.95)";
    g.lineWidth = 1.2 + bass * 0.5;
    g.beginPath();
    g.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // 5. 赤道面前置主吸积盘
    g.save();
    renderFrontEquatorialDiskPhotorealV8(
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

        g.strokeStyle = `rgba(255, 175, 75, ${swItem.alpha * 0.35})`;
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

function renderTopCrownPhotorealV8(
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
  const crownOuterR = horizonR * 2.38;

  const crownGrd = g.createRadialGradient(
    cx - horizonR * 0.25,
    cy - horizonR * 0.18,
    crownInnerR * 0.98,
    cx,
    cy - horizonR * 0.35,
    crownOuterR * 1.05
  );
  crownGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  crownGrd.addColorStop(0.12, "rgba(255, 235, 110, 0.95)");
  crownGrd.addColorStop(0.35, "rgba(255, 135, 25, 0.8)");
  crownGrd.addColorStop(0.68, "rgba(185, 38, 10, 0.5)");
  crownGrd.addColorStop(0.92, "rgba(90, 10, 4, 0.18)");
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
  for (let i = 0; i < 36; i++) {
    const frac = i / 35;
    const rx = crownInnerR + frac * (crownOuterR - crownInnerR) * 0.88;
    const ry = crownInnerR * 0.78 + frac * (crownOuterR * 0.84 - crownInnerR * 0.78) * 0.88;

    const wave = Math.sin(frac * 24.0 + rot * 5.0) * 0.06;
    const alpha = (0.28 - frac * 0.18 + wave) * (1 + mid * 0.3);
    if (alpha <= 0.01) continue;

    if (frac < 0.15) {
      g.strokeStyle = `rgba(255, 255, 240, ${alpha * 1.5})`;
      g.lineWidth = 1.2;
    } else if (frac < 0.45) {
      g.strokeStyle = `rgba(255, 205, 75, ${alpha * 1.2})`;
      g.lineWidth = 1.4;
    } else if (frac < 0.75) {
      g.strokeStyle = `rgba(235, 95, 20, ${alpha * 0.9})`;
      g.lineWidth = 1.8;
    } else {
      g.strokeStyle = `rgba(160, 25, 8, ${alpha * 0.6})`;
      g.lineWidth = 2.4;
    }

    g.beginPath();
    g.ellipse(cx, cy, rx, ry, diskAngle, Math.PI * 0.97, Math.PI * 2.03);
    g.stroke();
  }

  const tailGrd = g.createRadialGradient(
    cx + horizonR * 2.0 * cosD,
    cy + horizonR * 2.0 * sinD - horizonR * 0.6,
    10,
    cx + horizonR * 2.0 * cosD,
    cy + horizonR * 2.0 * sinD - horizonR * 0.6,
    horizonR * 2.2
  );
  tailGrd.addColorStop(0, "rgba(225, 75, 18, 0.4)");
  tailGrd.addColorStop(0.45, "rgba(145, 25, 8, 0.22)");
  tailGrd.addColorStop(0.85, "rgba(65, 8, 2, 0.08)");
  tailGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = tailGrd;
  g.beginPath();
  g.arc(
    cx + horizonR * 2.0 * cosD,
    cy + horizonR * 2.0 * sinD - horizonR * 0.6,
    horizonR * 2.2,
    0,
    Math.PI * 2
  );
  g.fill();
}

function renderBottomUnderbellyPhotorealV8(
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
  const underOuterR = horizonR * 1.68;

  const underGrd = g.createRadialGradient(
    cx,
    cy + horizonR * 0.1,
    underInnerR * 0.96,
    cx,
    cy + horizonR * 0.25,
    underOuterR * 1.05
  );
  underGrd.addColorStop(0, "rgba(255, 245, 175, 0.9)");
  underGrd.addColorStop(0.22, "rgba(250, 135, 30, 0.7)");
  underGrd.addColorStop(0.65, "rgba(175, 45, 10, 0.35)");
  underGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = underGrd;
  g.beginPath();
  g.ellipse(cx, cy, underOuterR, underOuterR * 0.66, diskAngle, 0.02, Math.PI * 0.98);
  g.ellipse(cx, cy, underInnerR, underInnerR * 0.6, diskAngle, Math.PI * 0.98, 0.02, true);
  g.closePath();
  g.fill();

  for (let i = 0; i < 16; i++) {
    const frac = i / 15;
    const rx = underInnerR + frac * (underOuterR - underInnerR) * 0.82;
    const ry = underInnerR * 0.6 + frac * (underOuterR * 0.66 - underInnerR * 0.6) * 0.82;

    g.strokeStyle = `rgba(245, 120, 28, ${(0.22 - frac * 0.14) * (1 + mid * 0.25)})`;
    g.lineWidth = 1.2 + (1 - frac) * 1.4;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, diskAngle, 0.06, Math.PI * 0.94);
    g.stroke();
  }
}

function renderFrontEquatorialDiskPhotorealV8(
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
  const diskLenLeft = horizonR * 5.4;
  const diskLenRight = horizonR * 4.8;

  const topPts: { x: number; y: number }[] = [];
  const botPts: { x: number; y: number }[] = [];
  const steps = 48;

  const vOffset = horizonR * 0.22;
  const baseThickness = horizonR * 0.18 * (1 + bass * 0.12);

  for (let i = 0; i <= steps; i++) {
    const prog = i / steps;
    const u = -diskLenLeft + prog * (diskLenLeft + diskLenRight);

    const normDist = u < 0 ? -u / diskLenLeft : u / diskLenRight;
    const envelope = Math.pow(1 - Math.min(1, normDist), 0.72);
    const thick = baseThickness * envelope * (u < 0 ? 1.4 : 0.85);

    const topX = cx + u * cosD - (-thick * 0.5 + vOffset) * sinD;
    const topY = cy + u * sinD + (-thick * 0.5 + vOffset) * cosD;

    const botX = cx + u * cosD - (thick * 0.5 + vOffset) * sinD;
    const botY = cy + u * sinD + (thick * 0.5 + vOffset) * cosD;

    topPts.push({ x: topX, y: topY });
    botPts.unshift({ x: botX, y: botY });
  }

  const diskGrd = g.createLinearGradient(
    cx - diskLenLeft * cosD,
    cy - diskLenLeft * sinD,
    cx + diskLenRight * cosD,
    cy + diskLenRight * sinD
  );
  diskGrd.addColorStop(0, "rgba(90, 12, 4, 0)");
  diskGrd.addColorStop(0.1, "rgba(215, 65, 15, 0.55)");
  diskGrd.addColorStop(0.3, "rgba(255, 160, 32, 0.92)");
  diskGrd.addColorStop(0.46, "rgba(255, 255, 240, 1.0)");
  diskGrd.addColorStop(0.68, "rgba(240, 110, 22, 0.75)");
  diskGrd.addColorStop(0.88, "rgba(150, 32, 8, 0.38)");
  diskGrd.addColorStop(1, "rgba(50, 6, 2, 0)");

  g.fillStyle = diskGrd;
  g.beginPath();
  g.moveTo(topPts[0].x, topPts[0].y);
  for (let p = 1; p < topPts.length; p++) g.lineTo(topPts[p].x, topPts[p].y);
  for (let p = 0; p < botPts.length; p++) g.lineTo(botPts[p].x, botPts[p].y);
  g.closePath();
  g.fill();

  const beamGrd = g.createLinearGradient(
    cx - diskLenLeft * 0.8 * cosD,
    cy - diskLenLeft * 0.8 * sinD,
    cx + diskLenRight * 0.7 * cosD,
    cy + diskLenRight * 0.7 * sinD
  );
  beamGrd.addColorStop(0, "rgba(255, 175, 45, 0)");
  beamGrd.addColorStop(0.18, "rgba(255, 235, 120, 0.9)");
  beamGrd.addColorStop(0.44, "rgba(255, 255, 255, 1.0)");
  beamGrd.addColorStop(0.65, "rgba(255, 215, 85, 0.82)");
  beamGrd.addColorStop(1, "rgba(245, 105, 20, 0)");

  g.strokeStyle = beamGrd;
  g.lineWidth = 3.2 + bass * 2.0;
  g.beginPath();
  g.moveTo(
    cx - diskLenLeft * 0.85 * cosD - vOffset * -sinD,
    cy - diskLenLeft * 0.85 * sinD + vOffset * cosD
  );
  g.lineTo(
    cx + diskLenRight * 0.75 * cosD - vOffset * -sinD,
    cy + diskLenRight * 0.75 * sinD + vOffset * cosD
  );
  g.stroke();

  g.strokeStyle = "rgba(255, 255, 255, 0.98)";
  g.lineWidth = 1.2 + bass * 0.5;
  g.beginPath();
  g.moveTo(
    cx - diskLenLeft * 0.65 * cosD - vOffset * -sinD,
    cy - diskLenLeft * 0.65 * sinD + vOffset * cosD
  );
  g.lineTo(
    cx + diskLenRight * 0.45 * cosD - vOffset * -sinD,
    cy + diskLenRight * 0.45 * sinD + vOffset * cosD
  );
  g.stroke();

  const flareX = cx - horizonR * 1.7 * cosD - vOffset * -sinD;
  const flareY = cy - horizonR * 1.7 * sinD + vOffset * cosD;

  const flareGrd = g.createRadialGradient(flareX, flareY, 5, flareX, flareY, horizonR * 1.8);
  flareGrd.addColorStop(0, "rgba(255, 255, 255, 0.92)");
  flareGrd.addColorStop(0.18, "rgba(255, 230, 110, 0.72)");
  flareGrd.addColorStop(0.55, "rgba(250, 120, 25, 0.28)");
  flareGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

  g.fillStyle = flareGrd;
  g.beginPath();
  g.ellipse(flareX, flareY, horizonR * 1.8, horizonR * 0.55, diskAngle, 0, Math.PI * 2);
  g.fill();
}
