/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  lineWidth: number;
}

interface SuperstringState {
  shockwaves: GravitationalShockwave[];
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  rotationAngle: number;
  lastBassTriggerTime: number;
  anamorphicFlareSprite: HTMLCanvasElement | null;
  photonRingSprite: HTMLCanvasElement | null;
  coreHaloSprite: HTMLCanvasElement | null;
}

function createRadialGlowSprite(
  size: number,
  colorStops: [number, string][]
): HTMLCanvasElement | null {
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

function createAnamorphicFlareSprite(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const cx = width / 2;
    const cy = height / 2;

    const hGrd = ctx.createLinearGradient(0, cy, width, cy);
    hGrd.addColorStop(0, "rgba(70, 170, 255, 0)");
    hGrd.addColorStop(0.18, "rgba(90, 210, 255, 0.2)");
    hGrd.addColorStop(0.35, "rgba(255, 220, 130, 0.45)");
    hGrd.addColorStop(0.48, "rgba(255, 250, 240, 0.95)");
    hGrd.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
    hGrd.addColorStop(0.52, "rgba(255, 250, 240, 0.95)");
    hGrd.addColorStop(0.65, "rgba(255, 180, 70, 0.45)");
    hGrd.addColorStop(0.82, "rgba(255, 100, 30, 0.15)");
    hGrd.addColorStop(1, "rgba(255, 60, 10, 0)");

    const vGrd = ctx.createLinearGradient(cx, 0, cx, height);
    vGrd.addColorStop(0, "rgba(255, 255, 255, 0)");
    vGrd.addColorStop(0.5, "rgba(255, 255, 255, 1)");
    vGrd.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = hGrd;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = vGrd;
    ctx.fillRect(0, 0, width, height);

    return canvas;
  } catch {
    return null;
  }
}

export const SuperstringSingularityV8Effect: EffectPlugin = {
  id: "superstring-singularity-v8",
  name: "量子超弦奇点",
  category: "space",
  description:
    "电影级卡冈图雅黑洞真实吸积盘模拟：双曲引力透镜弯曲光环、纯黑施瓦西视界暗核与多普勒相对论等离子流体光晕",
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
      name: "光幕层数",
      type: "number",
      mode: "professional",
      min: 4,
      max: 12,
      step: 1,
      default: 6,
    },
    {
      id: "chromaticAberration",
      name: "多普勒光晕强度",
      type: "number",
      mode: "professional",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.35,
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
      default: 1.5,
    },
  ],

  init(ctx: RenderContext) {
    const anamorphicFlareSprite = createAnamorphicFlareSprite(1200, 64);

    const photonRingSprite = createRadialGlowSprite(280, [
      [0, "rgba(255, 255, 255, 1.0)"],
      [0.18, "rgba(255, 235, 190, 0.95)"],
      [0.35, "rgba(255, 160, 50, 0.6)"],
      [0.6, "rgba(220, 80, 20, 0.25)"],
      [0.85, "rgba(80, 160, 255, 0.08)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);

    const coreHaloSprite = createRadialGlowSprite(512, [
      [0, "rgba(255, 220, 120, 0.85)"],
      [0.22, "rgba(255, 140, 40, 0.5)"],
      [0.5, "rgba(200, 60, 15, 0.2)"],
      [0.78, "rgba(60, 100, 220, 0.06)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);

    const state: SuperstringState = {
      shockwaves: [],
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedEnergy: 0,
      rotationAngle: 0,
      lastBassTriggerTime: 0,
      anamorphicFlareSprite,
      photonRingSprite,
      coreHaloSprite,
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
      stardustDensity = 6,
      chromaticAberration = 1.35,
      burstSensitivity = 1.1,
      coreGlow = 1.5,
    } = params;

    let state = ctx.private?.state as SuperstringState | undefined;
    if (!state) {
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
      state.shockwaves.length < 4
    ) {
      state.lastBassTriggerTime = nowMs;
      state.shockwaves.push({
        radius: 50 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.72,
        alpha: 0.95,
        speed: 15 + bass * 22,
        lineWidth: 2.2 + bass * 2.8,
      });
    }

    // 1. 深空暗黑背景
    g.save();
    g.fillStyle = "#010204";
    g.fillRect(0, 0, sw, sh);

    g.globalCompositeOperation = "screen";
    const maxDim = Math.max(sw, sh);
    const bgGrd = g.createRadialGradient(cx, cy, 0, cx, cy, maxDim * 0.8);
    bgGrd.addColorStop(0, `rgba(255, 160, 45, ${(0.08 + bass * 0.12) * chromaticAberration})`);
    bgGrd.addColorStop(0.25, `rgba(210, 75, 20, ${0.05 + mid * 0.06})`);
    bgGrd.addColorStop(0.55, `rgba(110, 30, 150, ${0.03 + mid * 0.03})`);
    bgGrd.addColorStop(0.8, `rgba(20, 80, 180, ${0.02 + treble * 0.03})`);
    bgGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = bgGrd;
    g.fillRect(0, 0, sw, sh);
    g.restore();

    // 2. 引力波冲击光膜
    if (state.shockwaves.length > 0) {
      g.save();
      g.globalCompositeOperation = "screen";
      for (let i = state.shockwaves.length - 1; i >= 0; i--) {
        const swItem = state.shockwaves[i];
        swItem.radius += swItem.speed;
        swItem.alpha *= 0.935;

        if (swItem.alpha < 0.01 || swItem.radius > swItem.maxRadius) {
          state.shockwaves.splice(i, 1);
          continue;
        }

        const ringProgress = swItem.radius / swItem.maxRadius;
        const ringAlpha = swItem.alpha * (1 - ringProgress * 0.6);

        g.strokeStyle = `rgba(255, 220, 140, ${ringAlpha * 0.8})`;
        g.lineWidth = swItem.lineWidth;
        g.beginPath();
        g.ellipse(cx, cy, swItem.radius, swItem.radius * 0.42, 0, 0, Math.PI * 2);
        g.stroke();

        g.strokeStyle = `rgba(80, 170, 255, ${ringAlpha * 0.4})`;
        g.lineWidth = swItem.lineWidth * 0.6;
        g.beginPath();
        g.ellipse(cx, cy, swItem.radius * 0.93, swItem.radius * 0.93 * 0.42, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }

    state.rotationAngle += (0.0035 + energy * 0.008) * superstringTension;
    const rot = state.rotationAngle;

    const horizonRadius = (42 + bass * 18) * singularityMass;
    const diskTilt = 0.38;

    // 3. 爱因斯坦引力透镜弯曲光环：上部主光环 (Upper Warped Accretion Halo)
    const upperRadiusX = (165 + bass * 45) * singularityMass;
    const upperRadiusY = upperRadiusX * 0.92;

    g.save();
    g.globalCompositeOperation = "screen";

    const upperHaloGrd = g.createRadialGradient(
      cx,
      cy - upperRadiusY * 0.38,
      horizonRadius * 0.7,
      cx,
      cy - upperRadiusY * 0.38,
      upperRadiusX * 1.55
    );
    upperHaloGrd.addColorStop(
      0,
      `rgba(255, 255, 245, ${(0.96 + bass * 0.15) * chromaticAberration})`
    );
    upperHaloGrd.addColorStop(0.18, `rgba(255, 215, 110, ${0.85 + mid * 0.25})`);
    upperHaloGrd.addColorStop(0.42, `rgba(255, 130, 35, ${0.55 + mid * 0.2})`);
    upperHaloGrd.addColorStop(0.72, "rgba(180, 45, 10, 0.2)");
    upperHaloGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = upperHaloGrd;
    g.beginPath();
    g.ellipse(
      cx,
      cy - upperRadiusY * 0.42,
      upperRadiusX * 1.28,
      upperRadiusY * 0.98,
      0,
      Math.PI * 0.88,
      Math.PI * 2.12
    );
    g.fill();

    // 上光环内缘白炽高光
    g.strokeStyle = "rgba(255, 250, 220, 0.95)";
    g.lineWidth = 3.5 + bass * 2.5;
    g.shadowColor = "#FFA834";
    g.shadowBlur = 24 * coreGlow;
    g.beginPath();
    g.ellipse(
      cx,
      cy - upperRadiusY * 0.42,
      upperRadiusX * 0.96,
      upperRadiusY * 0.78,
      0,
      Math.PI * 0.92,
      Math.PI * 2.08
    );
    g.stroke();

    // 4. 爱因斯坦引力透镜弯曲光环：下部副光环 (Lower Warped Accretion Halo)
    const lowerRadiusX = (145 + bass * 38) * singularityMass;
    const lowerRadiusY = lowerRadiusX * 0.72;

    const lowerHaloGrd = g.createRadialGradient(
      cx,
      cy + lowerRadiusY * 0.38,
      horizonRadius * 0.65,
      cx,
      cy + lowerRadiusY * 0.38,
      lowerRadiusX * 1.4
    );
    lowerHaloGrd.addColorStop(
      0,
      `rgba(255, 235, 180, ${(0.78 + bass * 0.2) * chromaticAberration})`
    );
    lowerHaloGrd.addColorStop(0.25, `rgba(255, 150, 45, ${0.5 + mid * 0.2})`);
    lowerHaloGrd.addColorStop(0.65, "rgba(180, 50, 15, 0.18)");
    lowerHaloGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = lowerHaloGrd;
    g.beginPath();
    g.ellipse(cx, cy + lowerRadiusY * 0.4, lowerRadiusX * 1.2, lowerRadiusY * 0.82, 0, 0, Math.PI);
    g.fill();
    g.restore();

    // 5. 前景连续发光等离子吸积盘 (Volumetric Incandescent Accretion Disk)
    const diskOuterR = (480 + bass * 120 + mid * 80) * singularityMass;
    const diskInnerR = horizonRadius * 1.28;

    g.save();
    g.globalCompositeOperation = "screen";

    const layerCount = Math.max(4, Math.min(10, Math.floor(stardustDensity)));
    for (let l = 0; l < layerCount; l++) {
      const layerFrac = l / (layerCount - 1);
      const curInnerR = diskInnerR + (diskOuterR - diskInnerR) * (layerFrac * 0.55);
      const curOuterR = curInnerR + (diskOuterR - diskInnerR) * 0.45;
      const waveNoise = Math.sin(rot * 2 + l * 1.2 + t) * (8 + bass * 16);

      g.beginPath();
      g.ellipse(
        cx,
        cy,
        curOuterR + waveNoise,
        (curOuterR + waveNoise) * diskTilt,
        0,
        0,
        Math.PI * 2
      );
      g.ellipse(
        cx,
        cy,
        curInnerR - waveNoise * 0.5,
        (curInnerR - waveNoise * 0.5) * diskTilt,
        0,
        0,
        Math.PI * 2,
        true
      );

      const diskGrd = g.createLinearGradient(cx - curOuterR, cy, cx + curOuterR, cy);
      diskGrd.addColorStop(
        0,
        `rgba(100, 210, 255, ${(0.85 - layerFrac * 0.35) * chromaticAberration})`
      );
      diskGrd.addColorStop(
        0.28,
        `rgba(255, 255, 245, ${(0.98 - layerFrac * 0.3) * chromaticAberration})`
      );
      diskGrd.addColorStop(0.48, `rgba(255, 210, 95, ${0.85 - layerFrac * 0.35})`);
      diskGrd.addColorStop(0.72, `rgba(240, 110, 30, ${0.55 - layerFrac * 0.3})`);
      diskGrd.addColorStop(1, `rgba(160, 30, 10, ${0.25 - layerFrac * 0.2})`);

      g.fillStyle = diskGrd;
      g.fill();
    }

    // ISCO 内缘最稳定轨道白炽高温光环
    const iscoRadius = diskInnerR * 1.08;
    g.strokeStyle = "rgba(255, 255, 250, 0.98)";
    g.lineWidth = 4.2 + bass * 3.0;
    g.shadowColor = "#FFE080";
    g.shadowBlur = 32 * coreGlow;
    g.beginPath();
    g.ellipse(cx, cy, iscoRadius, iscoRadius * diskTilt, 0, 0, Math.PI * 2);
    g.stroke();

    if (state.coreHaloSprite) {
      const haloW = diskOuterR * 2.2;
      const haloH = haloW * diskTilt * 1.4;
      g.globalAlpha = Math.min(1.0, 0.75 + bass * 0.25);
      g.drawImage(state.coreHaloSprite, cx - haloW / 2, cy - haloH / 2, haloW, haloH);
    }
    g.restore();

    // 6. 施瓦西绝对纯黑事件视界暗核
    g.save();
    g.fillStyle = "#000000";
    g.beginPath();
    g.arc(cx, cy, horizonRadius, 0, Math.PI * 2);
    g.fill();

    const voidGrd = g.createRadialGradient(
      cx,
      cy,
      horizonRadius * 0.85,
      cx,
      cy,
      horizonRadius * 1.06
    );
    voidGrd.addColorStop(0, "rgba(0, 0, 0, 1.0)");
    voidGrd.addColorStop(0.7, "rgba(3, 2, 5, 0.95)");
    voidGrd.addColorStop(1, "rgba(255, 180, 70, 0)");
    g.fillStyle = voidGrd;
    g.beginPath();
    g.arc(cx, cy, horizonRadius * 1.06, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // 7. 极细高光光子球层 (Razor-sharp Photon Sphere Ring)
    g.save();
    g.globalCompositeOperation = "screen";

    g.strokeStyle = "rgba(255, 255, 255, 1.0)";
    g.lineWidth = 1.8 + bass * 1.6;
    g.shadowColor = "#FFD275";
    g.shadowBlur = 22 * coreGlow;
    g.beginPath();
    g.arc(cx, cy, horizonRadius * 0.99, 0, Math.PI * 2);
    g.stroke();

    g.strokeStyle = "rgba(120, 220, 255, 0.7)";
    g.lineWidth = 1.0;
    g.shadowColor = "#38B6FF";
    g.shadowBlur = 14 * coreGlow;
    g.beginPath();
    g.arc(cx, cy, horizonRadius * 1.03, 0, Math.PI * 2);
    g.stroke();

    if (state.photonRingSprite) {
      const ringDiam = horizonRadius * 3.8 * coreGlow;
      g.globalAlpha = Math.min(1.0, 0.85 + bass * 0.15);
      g.drawImage(state.photonRingSprite, cx - ringDiam / 2, cy - ringDiam / 2, ringDiam, ringDiam);
    }
    g.restore();

    // 8. 变形宽银幕横向拉丝耀斑
    if (state.anamorphicFlareSprite) {
      g.save();
      g.globalCompositeOperation = "screen";
      const flareWidth = Math.min(sw * 1.35, (720 + bass * 380 + energy * 260) * coreGlow);
      const flareHeight = (32 + bass * 28) * coreGlow;
      g.globalAlpha = Math.min(1.0, (0.7 + bass * 0.3) * chromaticAberration);
      g.drawImage(
        state.anamorphicFlareSprite,
        cx - flareWidth / 2,
        cy - flareHeight / 2,
        flareWidth,
        flareHeight
      );
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
