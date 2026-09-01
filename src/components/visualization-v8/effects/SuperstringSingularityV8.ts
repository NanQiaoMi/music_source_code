/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface AccretionStream {
  radiusFactor: number;
  width: number;
  speed: number;
  angleOffset: number;
  noiseFreq: number;
  brightness: number;
  colorMix: number;
}

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  lineWidth: number;
}

interface SuperstringState {
  streams: AccretionStream[];
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
    "电影级卡冈图雅真实相对论黑洞模拟：清晰施瓦西纯黑视界、爱因斯坦双引力透镜弯曲光拱与开普勒差动自转吸积盘",
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
      name: "吸积盘流速",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.2,
    },
    {
      id: "stardustDensity",
      name: "等离子带密度",
      type: "number",
      mode: "professional",
      min: 24,
      max: 64,
      step: 4,
      default: 48,
    },
    {
      id: "chromaticAberration",
      name: "色彩对比度",
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
    const streams: AccretionStream[] = [];
    const count = 48;
    for (let i = 0; i < count; i++) {
      const norm = i / (count - 1);
      const radiusFactor = 1.35 + Math.pow(norm, 1.3) * 4.2;
      const speed = (0.015 / Math.sqrt(radiusFactor)) * 0.9;
      streams.push({
        radiusFactor,
        width: 1.5 + norm * 4.0,
        speed,
        angleOffset: (i * 137.5 * Math.PI) / 180,
        noiseFreq: 2 + (i % 4),
        brightness: 0.35 + Math.sin(norm * Math.PI) * 0.5,
        colorMix: norm,
      });
    }

    const state: SuperstringState = {
      streams,
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
    const cx = sw / 2;
    const cy = sh / 2;

    const {
      singularityMass = 1.0,
      superstringTension = 1.2,
      chromaticAberration = 1.0,
      burstSensitivity = 1.1,
      coreGlow = 1.2,
    } = params;

    let state = ctx.private?.state as SuperstringState | undefined;
    if (!state || !state.streams || state.streams.length === 0) {
      this.init(ctx);
      state = ctx.private?.state as SuperstringState;
    }

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
    const energy = state.smoothedEnergy;

    const t = ctx.time || Date.now() * 0.0008;

    const nowMs = Date.now();
    if (
      rawBass > 0.65 &&
      rawBass - state.smoothedBass > 0.25 * burstSensitivity &&
      nowMs - state.lastBassTriggerTime > 300 &&
      state.shockwaves.length < 3
    ) {
      state.lastBassTriggerTime = nowMs;
      state.shockwaves.push({
        radius: 65 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.65,
        alpha: 0.6,
        speed: 12 + bass * 16,
        lineWidth: 1.5 + bass * 2.0,
      });
    }

    state.rotationAngle += (0.003 + energy * 0.006) * superstringTension;
    const rot = state.rotationAngle;

    const horizonR = (52 + bass * 14) * singularityMass;
    const diskTilt = 0.32;
    const iscoR = horizonR * 1.45;
    const maxDiskR = horizonR * 5.4;

    // 1. 深空暗黑背景
    g.save();
    g.fillStyle = "#010204";
    g.fillRect(0, 0, sw, sh);

    const bgGrd = g.createRadialGradient(cx, cy, horizonR, cx, cy, maxDiskR * 1.5);
    bgGrd.addColorStop(0, "rgba(255, 140, 40, 0.04)");
    bgGrd.addColorStop(0.3, "rgba(180, 50, 10, 0.025)");
    bgGrd.addColorStop(0.7, "rgba(20, 10, 30, 0.01)");
    bgGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = bgGrd;
    g.fillRect(0, 0, sw, sh);

    // 2. 引力波冲击光膜
    if (state.shockwaves.length > 0) {
      for (let i = state.shockwaves.length - 1; i >= 0; i--) {
        const swItem = state.shockwaves[i];
        swItem.radius += swItem.speed;
        swItem.alpha *= 0.94;

        if (swItem.alpha < 0.01 || swItem.radius > swItem.maxRadius) {
          state.shockwaves.splice(i, 1);
          continue;
        }

        g.strokeStyle = `rgba(255, 200, 120, ${swItem.alpha * 0.35})`;
        g.lineWidth = swItem.lineWidth;
        g.beginPath();
        g.ellipse(cx, cy, swItem.radius, swItem.radius * diskTilt, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }

    // 3. 爱因斯坦引力透镜：上部主光环 (Upper Warped Accretion Arc)
    const upperArcOuterR = horizonR * 2.85;
    const upperArcInnerR = horizonR * 1.15;
    const upperCenterY = cy - horizonR * 0.35;

    const upperGrd = g.createRadialGradient(
      cx,
      upperCenterY,
      upperArcInnerR * 0.8,
      cx,
      upperCenterY,
      upperArcOuterR * 1.1
    );
    upperGrd.addColorStop(0, "rgba(255, 255, 250, 0.85)");
    upperGrd.addColorStop(0.2, "rgba(255, 215, 120, 0.7)");
    upperGrd.addColorStop(0.5, "rgba(245, 125, 30, 0.45)");
    upperGrd.addColorStop(0.8, "rgba(160, 40, 10, 0.15)");
    upperGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = upperGrd;
    g.beginPath();
    g.ellipse(
      cx,
      upperCenterY,
      upperArcOuterR * 0.96,
      upperArcOuterR * 0.95,
      0,
      Math.PI * 0.92,
      Math.PI * 2.08
    );
    g.ellipse(
      cx,
      upperCenterY,
      upperArcInnerR * 1.05,
      upperArcInnerR * 1.05,
      0,
      Math.PI * 2.08,
      Math.PI * 0.92,
      true
    );
    g.fill();

    // 上光拱内缘高温线
    g.strokeStyle = "rgba(255, 250, 230, 0.8)";
    g.lineWidth = 2.0 + bass * 1.5;
    g.beginPath();
    g.ellipse(
      cx,
      upperCenterY,
      upperArcInnerR * 1.12,
      upperArcInnerR * 1.12,
      0,
      Math.PI * 0.95,
      Math.PI * 2.05
    );
    g.stroke();

    // 4. 爱因斯坦引力透镜：下部副光环 (Lower Warped Accretion Arc)
    const lowerArcOuterR = horizonR * 2.3;
    const lowerArcInnerR = horizonR * 1.15;
    const lowerCenterY = cy + horizonR * 0.28;

    const lowerGrd = g.createRadialGradient(
      cx,
      lowerCenterY,
      lowerArcInnerR * 0.8,
      cx,
      lowerCenterY,
      lowerArcOuterR * 1.05
    );
    lowerGrd.addColorStop(0, "rgba(255, 235, 160, 0.6)");
    lowerGrd.addColorStop(0.3, "rgba(240, 110, 30, 0.35)");
    lowerGrd.addColorStop(0.7, "rgba(140, 30, 10, 0.1)");
    lowerGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = lowerGrd;
    g.beginPath();
    g.ellipse(cx, lowerCenterY, lowerArcOuterR * 0.92, lowerArcOuterR * 0.72, 0, 0, Math.PI);
    g.ellipse(cx, lowerCenterY, lowerArcInnerR * 1.05, lowerArcInnerR * 0.82, 0, Math.PI, 0, true);
    g.fill();

    // 5. 水平开普勒差动吸积流光带 (Differential Keplerian Bands)
    for (let i = 0; i < state.streams.length; i++) {
      const s = state.streams[i];
      const curR = horizonR * s.radiusFactor;
      if (curR < iscoR * 0.95 || curR > maxDiskR) continue;

      const streamAngle = rot * (s.speed * 80) + s.angleOffset + t;
      const waveAmp = (1.5 + bass * 4.0) * (curR / maxDiskR);
      const waveY = Math.sin(streamAngle * s.noiseFreq) * waveAmp;

      const segments = 64;
      g.beginPath();

      for (let seg = 0; seg <= segments; seg++) {
        const segAngle = (seg / segments) * Math.PI * 2;
        const r = curR + Math.sin(segAngle * 3 + streamAngle) * waveAmp;
        const px = cx + Math.cos(segAngle) * r;
        const py = cy + Math.sin(segAngle) * r * diskTilt + waveY;

        if (seg === 0) {
          g.moveTo(px, py);
        } else {
          g.lineTo(px, py);
        }
      }
      g.closePath();

      const leftX = cx - curR;
      const rightX = cx + curR;
      const streamGrd = g.createLinearGradient(leftX, cy, rightX, cy);

      const distNorm = (curR - iscoR) / (maxDiskR - iscoR);
      const baseAlpha = (0.28 - distNorm * 0.2) * (s.brightness + mid * 0.3) * chromaticAberration;

      if (distNorm < 0.25) {
        streamGrd.addColorStop(0, `rgba(255, 255, 255, ${baseAlpha * 1.3})`);
        streamGrd.addColorStop(0.35, `rgba(255, 230, 140, ${baseAlpha * 1.1})`);
        streamGrd.addColorStop(0.75, `rgba(255, 150, 40, ${baseAlpha * 0.85})`);
        streamGrd.addColorStop(1, `rgba(200, 60, 15, ${baseAlpha * 0.5})`);
      } else if (distNorm < 0.65) {
        streamGrd.addColorStop(0, `rgba(255, 235, 160, ${baseAlpha * 1.1})`);
        streamGrd.addColorStop(0.4, `rgba(255, 170, 50, ${baseAlpha})`);
        streamGrd.addColorStop(0.8, `rgba(220, 90, 25, ${baseAlpha * 0.7})`);
        streamGrd.addColorStop(1, `rgba(160, 40, 10, ${baseAlpha * 0.4})`);
      } else {
        streamGrd.addColorStop(0, `rgba(255, 180, 70, ${baseAlpha})`);
        streamGrd.addColorStop(0.5, `rgba(220, 90, 25, ${baseAlpha * 0.75})`);
        streamGrd.addColorStop(1, `rgba(130, 25, 10, ${baseAlpha * 0.3})`);
      }

      g.strokeStyle = streamGrd;
      g.lineWidth = s.width * (1 + bass * 0.35);
      g.stroke();
    }

    // ISCO 内缘高温光环
    g.strokeStyle = "rgba(255, 250, 220, 0.75)";
    g.lineWidth = 2.2 + bass * 1.8;
    g.beginPath();
    g.ellipse(cx, cy, iscoR, iscoR * diskTilt, 0, 0, Math.PI * 2);
    g.stroke();

    // 6. 施瓦西绝对纯黑事件视界暗核 (Pitch-Black Horizon)
    g.fillStyle = "#000000";
    g.beginPath();
    g.arc(cx, cy, horizonR, 0, Math.PI * 2);
    g.fill();

    const edgeAbsorbGrd = g.createRadialGradient(cx, cy, horizonR * 0.88, cx, cy, horizonR * 1.04);
    edgeAbsorbGrd.addColorStop(0, "rgba(0, 0, 0, 1.0)");
    edgeAbsorbGrd.addColorStop(0.7, "rgba(2, 1, 3, 0.98)");
    edgeAbsorbGrd.addColorStop(1, "rgba(20, 10, 5, 0)");
    g.fillStyle = edgeAbsorbGrd;
    g.beginPath();
    g.arc(cx, cy, horizonR * 1.04, 0, Math.PI * 2);
    g.fill();

    // 7. 极细锐利光子球层 (Razor-sharp 1.5px Photon Sphere)
    g.strokeStyle = "rgba(255, 200, 90, 0.65)";
    g.lineWidth = 2.8 + bass * 1.5;
    g.beginPath();
    g.arc(cx, cy, horizonR * 1.01, 0, Math.PI * 2);
    g.stroke();

    g.strokeStyle = "rgba(255, 255, 255, 0.95)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(cx, cy, horizonR * 1.005, 0, Math.PI * 2);
    g.stroke();

    // 8. 前景下半弧吸积盘覆盖
    const fgGrd = g.createLinearGradient(cx - iscoR * 2.2, cy, cx + iscoR * 2.2, cy);
    fgGrd.addColorStop(0, "rgba(255, 255, 240, 0.65)");
    fgGrd.addColorStop(0.35, "rgba(255, 200, 90, 0.55)");
    fgGrd.addColorStop(0.75, "rgba(240, 110, 30, 0.35)");
    fgGrd.addColorStop(1, "rgba(160, 40, 10, 0.15)");

    g.fillStyle = fgGrd;
    g.beginPath();
    g.ellipse(cx, cy, horizonR * 2.4, horizonR * 2.4 * diskTilt, 0, 0, Math.PI);
    g.ellipse(cx, cy, horizonR * 1.02, horizonR * 1.02 * diskTilt, 0, Math.PI, 0, true);
    g.fill();

    // 9. 变形宽银幕横向拉丝耀斑
    const flareWidth = Math.min(sw * 0.95, (480 + bass * 180 + mid * 120) * coreGlow);
    const flareHeight = 12 + bass * 8;
    const flareGrd = g.createLinearGradient(cx - flareWidth / 2, cy, cx + flareWidth / 2, cy);
    flareGrd.addColorStop(0, "rgba(255, 180, 80, 0)");
    flareGrd.addColorStop(0.25, "rgba(255, 210, 120, 0.12)");
    flareGrd.addColorStop(0.48, "rgba(255, 255, 255, 0.45)");
    flareGrd.addColorStop(0.5, "rgba(255, 255, 255, 0.7)");
    flareGrd.addColorStop(0.52, "rgba(255, 255, 255, 0.45)");
    flareGrd.addColorStop(0.75, "rgba(255, 160, 60, 0.12)");
    flareGrd.addColorStop(1, "rgba(255, 100, 30, 0)");

    g.fillStyle = flareGrd;
    g.fillRect(cx - flareWidth / 2, cy - flareHeight / 2, flareWidth, flareHeight);

    g.restore();
  },

  resize(_width: number, _height: number) {},

  destroy(ctx?: RenderContext) {
    if (ctx && ctx.private) {
      ctx.private.state = null;
    }
  },
};
