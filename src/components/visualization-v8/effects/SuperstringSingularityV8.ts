/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface JetHelix {
  phase: number;
  radiusFactor: number;
  speed: number;
  colorType: number;
  width: number;
}

interface SpiralStream {
  baseRadius: number;
  armAngle: number;
  length: number;
  speed: number;
  spiralRate: number;
  width: number;
  brightness: number;
  tempIndex: number;
  waveFreq: number;
  wavePhase: number;
}

interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

interface SuperstringState {
  spiralStreams: SpiralStream[];
  jetHelices: JetHelix[];
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
    "电影级天体物理黑洞与相对论双螺旋极向喷流模拟：48°俯视透视、铜金旋涡对数流盘与爱因斯坦引力透镜光弧",
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
      name: "对数流带密度",
      type: "number",
      mode: "professional",
      min: 60,
      max: 160,
      step: 10,
      default: 120,
    },
    {
      id: "chromaticAberration",
      name: "喷流等离子亮度",
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
    const spiralStreams: SpiralStream[] = [];
    const streamCount = 120;
    for (let i = 0; i < streamCount; i++) {
      const frac = i / (streamCount - 1);
      const baseRadius = 42 + Math.pow(frac, 1.4) * 380;
      const speed = (0.012 / Math.sqrt(Math.max(1, baseRadius * 0.03))) * 0.85;

      let tempIndex = 1;
      if (frac < 0.15) tempIndex = 0;
      else if (frac < 0.55) tempIndex = 1;
      else if (frac < 0.85) tempIndex = 2;
      else tempIndex = 3;

      spiralStreams.push({
        baseRadius,
        armAngle: (i * 137.508 * Math.PI) / 180,
        length: Math.PI * (1.8 + Math.random() * 1.4),
        speed,
        spiralRate: 0.16 + (i % 5) * 0.02,
        width: 1.2 + frac * 3.2,
        brightness: 0.4 + Math.sin(frac * Math.PI) * 0.6,
        tempIndex,
        waveFreq: 2 + (i % 4),
        wavePhase: Math.random() * Math.PI * 2,
      });
    }

    const jetHelices: JetHelix[] = [
      { phase: 0, radiusFactor: 1.0, speed: 0.025, colorType: 0, width: 2.2 },
      { phase: Math.PI * 0.66, radiusFactor: 1.15, speed: 0.022, colorType: 1, width: 1.8 },
      { phase: Math.PI * 1.33, radiusFactor: 0.85, speed: 0.028, colorType: 2, width: 1.6 },
      { phase: Math.PI * 0.33, radiusFactor: 1.3, speed: 0.02, colorType: 1, width: 1.5 },
      { phase: Math.PI * 1.0, radiusFactor: 0.95, speed: 0.026, colorType: 0, width: 2.0 },
      { phase: Math.PI * 1.66, radiusFactor: 1.2, speed: 0.023, colorType: 2, width: 1.4 },
    ];

    const state: SuperstringState = {
      spiralStreams,
      jetHelices,
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
    if (!state || !state.spiralStreams || state.spiralStreams.length === 0) {
      this.init(ctx);
      state = ctx.private?.state as SuperstringState;
    }

    const cx = sw * 0.53;
    const cy = sh * 0.58;

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
      rawBass > 0.66 &&
      rawBass - state.smoothedBass > 0.22 * burstSensitivity &&
      nowMs - state.lastBassTriggerTime > 300 &&
      state.shockwaves.length < 3
    ) {
      state.lastBassTriggerTime = nowMs;
      state.shockwaves.push({
        radius: 45 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.7,
        alpha: 0.65,
        speed: 14 + bass * 18,
      });
    }

    state.rotationAngle += (0.0028 + energy * 0.007) * superstringTension;
    const rot = state.rotationAngle;

    const horizonR = (48 + bass * 12) * singularityMass;
    const diskTilt = 0.44;
    const diskRotationAngle = -0.48;
    const cosD = Math.cos(diskRotationAngle);
    const sinD = Math.sin(diskRotationAngle);

    // 1. 深空底色
    g.save();
    g.fillStyle = "#010203";
    g.fillRect(0, 0, sw, sh);

    const ambientGrd = g.createRadialGradient(
      cx,
      cy,
      horizonR * 1.5,
      cx,
      cy,
      Math.max(sw, sh) * 0.8
    );
    ambientGrd.addColorStop(0, "rgba(220, 90, 20, 0.08)");
    ambientGrd.addColorStop(0.35, "rgba(120, 35, 10, 0.05)");
    ambientGrd.addColorStop(0.75, "rgba(40, 10, 5, 0.02)");
    ambientGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = ambientGrd;
    g.fillRect(0, 0, sw, sh);

    // 2. 左上方深空银河星流背景
    const galaxyCenterX = sw * 0.15;
    const galaxyCenterY = sh * 0.12;
    const galaxyGrd = g.createRadialGradient(
      galaxyCenterX,
      galaxyCenterY,
      10,
      galaxyCenterX,
      galaxyCenterY,
      sw * 0.38
    );
    galaxyGrd.addColorStop(0, "rgba(215, 235, 255, 0.45)");
    galaxyGrd.addColorStop(0.2, "rgba(160, 200, 245, 0.28)");
    galaxyGrd.addColorStop(0.5, "rgba(80, 120, 180, 0.12)");
    galaxyGrd.addColorStop(0.8, "rgba(30, 50, 90, 0.04)");
    galaxyGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = galaxyGrd;
    g.beginPath();
    g.ellipse(galaxyCenterX, galaxyCenterY, sw * 0.32, sh * 0.14, -0.65, 0, Math.PI * 2);
    g.fill();

    for (let s = 0; s < 36; s++) {
      const starX = galaxyCenterX + Math.sin(s * 99 + t * 0.1) * sw * 0.18;
      const starY = galaxyCenterY + Math.cos(s * 37) * sh * 0.09;
      const starAlpha = 0.2 + (Math.sin(t * 2 + s) * 0.5 + 0.5) * 0.45;
      g.fillStyle = `rgba(240, 248, 255, ${starAlpha})`;
      g.beginPath();
      g.arc(starX, starY, s % 3 === 0 ? 1.5 : 0.8, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // 3. 吸积盘后半部分
    g.save();
    renderSpiralDisk(
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
      treble,
      false,
      state.spiralStreams
    );
    g.restore();

    // 4. 爱因斯坦引力透镜弯月光拱
    g.save();
    const lensR = horizonR * 1.35;
    const lensGrd = g.createLinearGradient(
      cx - lensR * 1.1,
      cy - lensR * 0.8,
      cx + lensR * 0.8,
      cy + lensR * 0.6
    );
    lensGrd.addColorStop(0, "rgba(255, 255, 240, 0.95)");
    lensGrd.addColorStop(0.3, "rgba(255, 210, 100, 0.85)");
    lensGrd.addColorStop(0.7, "rgba(245, 120, 30, 0.5)");
    lensGrd.addColorStop(1, "rgba(180, 40, 10, 0.1)");

    g.strokeStyle = lensGrd;
    g.lineWidth = 3.6 + bass * 2.2;
    g.shadowColor = "#FFAA30";
    g.shadowBlur = 18 * coreGlow;
    g.beginPath();
    g.ellipse(
      cx - 2,
      cy - horizonR * 0.15,
      lensR * 1.02,
      lensR * 0.72,
      diskRotationAngle,
      Math.PI * 0.85,
      Math.PI * 2.15
    );
    g.stroke();
    g.restore();

    // 5. 3D 纯黑施瓦西事件视界球体
    g.save();
    g.fillStyle = "#000000";
    g.beginPath();
    g.arc(cx, cy, horizonR, 0, Math.PI * 2);
    g.fill();

    const horizonAbsorbGrd = g.createRadialGradient(
      cx,
      cy,
      horizonR * 0.85,
      cx,
      cy,
      horizonR * 1.04
    );
    horizonAbsorbGrd.addColorStop(0, "rgba(0, 0, 0, 1.0)");
    horizonAbsorbGrd.addColorStop(0.75, "rgba(2, 1, 3, 0.96)");
    horizonAbsorbGrd.addColorStop(1, "rgba(255, 160, 50, 0)");
    g.fillStyle = horizonAbsorbGrd;
    g.beginPath();
    g.arc(cx, cy, horizonR * 1.04, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(255, 255, 255, 0.9)";
    g.lineWidth = 1.2 + bass * 0.8;
    g.beginPath();
    g.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // 6. 吸积盘前半部分
    g.save();
    renderSpiralDisk(
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
      treble,
      true,
      state.spiralStreams
    );
    g.restore();

    // 7. 相对论极向双螺旋等离子体喷流
    g.save();
    const jetAngle = -2.13;
    const jetCos = Math.cos(jetAngle);
    const jetSin = Math.sin(jetAngle);
    const jetPerpX = -jetSin;
    const jetPerpY = jetCos;

    const jetLength = Math.min(sw, sh) * (0.85 + bass * 0.2);
    const jetBaseRadius = horizonR * 0.38;

    const jetConeGrd = g.createLinearGradient(
      cx,
      cy,
      cx + jetCos * jetLength,
      cy + jetSin * jetLength
    );
    jetConeGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    jetConeGrd.addColorStop(0.08, "rgba(180, 230, 255, 0.85)");
    jetConeGrd.addColorStop(0.28, "rgba(90, 185, 255, 0.45)");
    jetConeGrd.addColorStop(0.65, "rgba(45, 120, 240, 0.18)");
    jetConeGrd.addColorStop(1, "rgba(20, 60, 180, 0)");

    g.fillStyle = jetConeGrd;
    g.beginPath();
    const jetTipWidth = 48 + bass * 30;
    g.moveTo(cx - jetPerpX * jetBaseRadius, cy - jetPerpY * jetBaseRadius);
    g.lineTo(
      cx + jetCos * jetLength - jetPerpX * jetTipWidth,
      cy + jetSin * jetLength - jetPerpY * jetTipWidth
    );
    g.lineTo(
      cx + jetCos * jetLength + jetPerpX * jetTipWidth,
      cy + jetSin * jetLength + jetPerpY * jetTipWidth
    );
    g.lineTo(cx + jetPerpX * jetBaseRadius, cy + jetPerpY * jetBaseRadius);
    g.closePath();
    g.fill();

    g.strokeStyle = "rgba(255, 255, 255, 0.95)";
    g.lineWidth = 2.5 + bass * 2.0;
    g.shadowColor = "#70D0FF";
    g.shadowBlur = 16 * coreGlow;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + jetCos * (jetLength * 0.7), cy + jetSin * (jetLength * 0.7));
    g.stroke();

    for (let h = 0; h < state.jetHelices.length; h++) {
      const helix = state.jetHelices[h];
      const steps = 40;
      const helixPoints: { x: number; y: number }[] = [];

      for (let s = 0; s <= steps; s++) {
        const prog = s / steps;
        const curDist = prog * jetLength;
        const helixRadius = (12 + prog * 36) * helix.radiusFactor * (1 + bass * 0.25);
        const helixAngle = prog * Math.PI * 8 + t * (helix.speed * 80) + helix.phase;

        const offsetX = jetPerpX * (Math.sin(helixAngle) * helixRadius);
        const offsetY = jetPerpY * (Math.sin(helixAngle) * helixRadius);

        const px = cx + jetCos * curDist + offsetX;
        const py = cy + jetSin * curDist + offsetY;
        helixPoints.push({ x: px, y: py });
      }

      g.beginPath();
      g.moveTo(helixPoints[0].x, helixPoints[0].y);
      for (let p = 1; p < helixPoints.length - 1; p++) {
        const mx = (helixPoints[p].x + helixPoints[p + 1].x) / 2;
        const my = (helixPoints[p].y + helixPoints[p + 1].y) / 2;
        g.quadraticCurveTo(helixPoints[p].x, helixPoints[p].y, mx, my);
      }
      g.lineTo(helixPoints[helixPoints.length - 1].x, helixPoints[helixPoints.length - 1].y);

      const helixGrd = g.createLinearGradient(
        cx,
        cy,
        cx + jetCos * jetLength,
        cy + jetSin * jetLength
      );

      if (helix.colorType === 0) {
        helixGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        helixGrd.addColorStop(0.3, "rgba(210, 245, 255, 0.75)");
        helixGrd.addColorStop(0.8, "rgba(100, 190, 255, 0.25)");
        helixGrd.addColorStop(1, "rgba(60, 130, 240, 0)");
      } else if (helix.colorType === 1) {
        helixGrd.addColorStop(0, "rgba(220, 240, 255, 0.9)");
        helixGrd.addColorStop(0.35, "rgba(100, 210, 255, 0.7)");
        helixGrd.addColorStop(0.75, "rgba(50, 140, 240, 0.3)");
        helixGrd.addColorStop(1, "rgba(30, 80, 200, 0)");
      } else {
        helixGrd.addColorStop(0, "rgba(240, 255, 255, 0.85)");
        helixGrd.addColorStop(0.4, "rgba(130, 240, 230, 0.65)");
        helixGrd.addColorStop(0.8, "rgba(60, 170, 220, 0.25)");
        helixGrd.addColorStop(1, "rgba(30, 90, 180, 0)");
      }

      g.strokeStyle = helixGrd;
      g.lineWidth = helix.width * (1 + treble * 0.4);
      g.stroke();
    }

    const baseFlareR = horizonR * 0.45 * (1 + bass * 0.4);
    const baseGrd = g.createRadialGradient(cx, cy, 0, cx, cy, baseFlareR);
    baseGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    baseGrd.addColorStop(0.4, "rgba(200, 240, 255, 0.85)");
    baseGrd.addColorStop(0.8, "rgba(90, 180, 255, 0.35)");
    baseGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = baseGrd;
    g.beginPath();
    g.arc(cx, cy, baseFlareR, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // 8. 引力波冲击
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

        g.strokeStyle = `rgba(255, 190, 100, ${swItem.alpha * 0.35})`;
        g.lineWidth = 1.5;
        g.beginPath();
        for (let a = 0; a <= 36; a++) {
          const rad = (a / 36) * Math.PI * 2;
          const ex = Math.cos(rad) * swItem.radius;
          const ey = Math.sin(rad) * swItem.radius * diskTilt;
          const rx = cx + ex * cosD - ey * sinD;
          const ry = cy + ex * sinD + ey * cosD;
          if (a === 0) g.moveTo(rx, ry);
          else g.lineTo(rx, ry);
        }
        g.closePath();
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

function renderSpiralDisk(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  diskTilt: number,
  cosD: number,
  sinD: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number,
  isForeground: boolean,
  spiralStreams: SpiralStream[]
) {
  const iscoR = horizonR * 1.32;
  const maxR = horizonR * 6.5;

  for (let i = 0; i < spiralStreams.length; i++) {
    const stream = spiralStreams[i];
    const curBaseR = stream.baseRadius * (1 + bass * 0.08);

    if (curBaseR < iscoR * 0.95 || curBaseR > maxR) continue;

    const angleStart = rot * (stream.speed * 85) + stream.armAngle;
    const steps = 36;
    const pts: { x: number; y: number; alpha: number }[] = [];

    for (let s = 0; s <= steps; s++) {
      const prog = s / steps;
      const angle = angleStart + prog * stream.length;

      const r = curBaseR * Math.exp(prog * stream.spiralRate);
      if (r > maxR * 1.2) break;

      const waveDisp =
        Math.sin(angle * stream.waveFreq + t * 2 + stream.wavePhase) * (2.0 + bass * 4.0);
      const finalR = r + waveDisp;

      const ex = Math.cos(angle) * finalR;
      const ey = Math.sin(angle) * finalR * diskTilt;
      const px = cx + ex * cosD - ey * sinD;
      const py = cy + ex * sinD + ey * cosD;

      const isInFront = ey >= -horizonR * 0.25;

      if (isForeground === isInFront) {
        const distRatio = (finalR - iscoR) / (maxR - iscoR);
        const alpha =
          stream.brightness *
          (1 - Math.min(1, Math.max(0, distRatio * 0.85))) *
          (isForeground ? 0.42 : 0.32) *
          (1 + mid * 0.25);

        pts.push({ x: px, y: py, alpha });
      }
    }

    if (pts.length < 2) continue;

    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let p = 1; p < pts.length; p++) {
      g.lineTo(pts[p].x, pts[p].y);
    }

    const startPt = pts[0];
    const endPt = pts[pts.length - 1];
    const strokeGrd = g.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);

    if (stream.tempIndex === 0) {
      strokeGrd.addColorStop(0, `rgba(255, 255, 245, ${pts[0].alpha * 1.3})`);
      strokeGrd.addColorStop(0.3, `rgba(255, 225, 130, ${pts[0].alpha * 1.1})`);
      strokeGrd.addColorStop(0.7, `rgba(255, 160, 45, ${pts[0].alpha * 0.85})`);
      strokeGrd.addColorStop(1, `rgba(210, 80, 20, ${pts[pts.length - 1].alpha * 0.5})`);
    } else if (stream.tempIndex === 1) {
      strokeGrd.addColorStop(0, `rgba(255, 235, 160, ${pts[0].alpha * 1.1})`);
      strokeGrd.addColorStop(0.35, `rgba(245, 150, 45, ${pts[0].alpha})`);
      strokeGrd.addColorStop(0.75, `rgba(200, 85, 25, ${pts[0].alpha * 0.75})`);
      strokeGrd.addColorStop(1, `rgba(150, 45, 12, ${pts[pts.length - 1].alpha * 0.4})`);
    } else if (stream.tempIndex === 2) {
      strokeGrd.addColorStop(0, `rgba(240, 145, 45, ${pts[0].alpha})`);
      strokeGrd.addColorStop(0.45, `rgba(195, 75, 20, ${pts[0].alpha * 0.8})`);
      strokeGrd.addColorStop(0.85, `rgba(135, 38, 10, ${pts[0].alpha * 0.5})`);
      strokeGrd.addColorStop(1, `rgba(80, 18, 6, ${pts[pts.length - 1].alpha * 0.25})`);
    } else {
      strokeGrd.addColorStop(0, `rgba(180, 65, 20, ${pts[0].alpha * 0.75})`);
      strokeGrd.addColorStop(0.5, `rgba(120, 32, 10, ${pts[0].alpha * 0.5})`);
      strokeGrd.addColorStop(1, `rgba(50, 10, 4, ${pts[pts.length - 1].alpha * 0.15})`);
    }

    g.strokeStyle = strokeGrd;
    g.lineWidth = stream.width * (1 + treble * 0.35);
    g.stroke();
  }
}
