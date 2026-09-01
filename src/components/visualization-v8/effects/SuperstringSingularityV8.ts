/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface JetSmokyStrand {
  phase: number;
  radiusBase: number;
  radiusExp: number;
  speed: number;
  width: number;
  alpha: number;
  colorType: number;
  freq: number;
}

interface AccretionGasBand {
  baseRadius: number;
  armAngle: number;
  length: number;
  speed: number;
  spiralRate: number;
  width: number;
  alpha: number;
  colorIndex: number;
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
  gasBands: AccretionGasBand[];
  jetStrands: JetSmokyStrand[];
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
    "电影级天体物理黑洞与相对论双螺旋极向喷流模拟：48°俯视透视、铜金旋涡流态实体盘与爱因斯坦引力透镜弯月环",
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
      name: "流体层密度",
      type: "number",
      mode: "professional",
      min: 80,
      max: 240,
      step: 20,
      default: 180,
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
    const gasBands: AccretionGasBand[] = [];
    const bandCount = 180;
    for (let i = 0; i < bandCount; i++) {
      const frac = i / (bandCount - 1);
      const baseRadius = 45 + Math.pow(frac, 1.25) * 850;
      const speed = (0.01 / Math.sqrt(Math.max(1, baseRadius * 0.02))) * 0.8;

      let colorIndex = 1;
      if (frac < 0.12) colorIndex = 0;
      else if (frac < 0.42) colorIndex = 1;
      else if (frac < 0.72) colorIndex = 2;
      else if (frac < 0.92) colorIndex = 3;
      else colorIndex = 4;

      gasBands.push({
        baseRadius,
        armAngle: (i * 137.508 * Math.PI) / 180,
        length: Math.PI * (2.2 + Math.random() * 1.6),
        speed,
        spiralRate: 0.14 + (i % 6) * 0.015,
        width: 6.0 + frac * 28.0,
        alpha: 0.08 + Math.sin(frac * Math.PI) * 0.14,
        colorIndex,
        waveFreq: 2 + (i % 5),
        wavePhase: Math.random() * Math.PI * 2,
      });
    }

    const jetStrands: JetSmokyStrand[] = [];
    const strandCount = 18;
    for (let i = 0; i < strandCount; i++) {
      const frac = i / strandCount;
      jetStrands.push({
        phase: frac * Math.PI * 2,
        radiusBase: 8 + (i % 3) * 6,
        radiusExp: 32 + (i % 4) * 12,
        speed: 0.018 + (i % 3) * 0.005,
        width: 4.0 + (i % 4) * 3.5,
        alpha: 0.12 + Math.random() * 0.15,
        colorType: i % 3,
        freq: 3.5 + (i % 3) * 1.5,
      });
    }

    const state: SuperstringState = {
      gasBands,
      jetStrands,
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
    if (!state || !state.gasBands || state.gasBands.length === 0) {
      this.init(ctx);
      state = ctx.private?.state as SuperstringState;
    }

    const cx = sw * 0.53;
    const cy = sh * 0.59;

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
      rawBass > 0.66 &&
      rawBass - state.smoothedBass > 0.22 * burstSensitivity &&
      nowMs - state.lastBassTriggerTime > 300 &&
      state.shockwaves.length < 3
    ) {
      state.lastBassTriggerTime = nowMs;
      state.shockwaves.push({
        radius: 48 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.85,
        alpha: 0.6,
        speed: 15 + bass * 18,
      });
    }

    state.rotationAngle += (0.0022 + energy * 0.005) * superstringTension;
    const rot = state.rotationAngle;

    const horizonR = (48 + bass * 12) * singularityMass;
    const diskTilt = 0.43;
    const diskRotationAngle = -0.48;
    const cosD = Math.cos(diskRotationAngle);
    const sinD = Math.sin(diskRotationAngle);

    // 1. 深空底色
    g.save();
    g.fillStyle = "#0a0302";
    g.fillRect(0, 0, sw, sh);

    const spaceAmbientGrd = g.createRadialGradient(
      cx + sw * 0.1,
      cy + sh * 0.1,
      horizonR * 2.0,
      cx,
      cy,
      Math.max(sw, sh) * 0.95
    );
    spaceAmbientGrd.addColorStop(0, "rgba(70, 20, 8, 0.45)");
    spaceAmbientGrd.addColorStop(0.35, "rgba(40, 10, 4, 0.35)");
    spaceAmbientGrd.addColorStop(0.7, "rgba(18, 4, 2, 0.25)");
    spaceAmbientGrd.addColorStop(1, "rgba(5, 1, 1, 0.9)");
    g.fillStyle = spaceAmbientGrd;
    g.fillRect(0, 0, sw, sh);

    // 2. 左上方银河星系流光
    const galaxyX = sw * 0.14;
    const galaxyY = sh * 0.13;

    const galaxyHalo = g.createRadialGradient(galaxyX, galaxyY, 10, galaxyX, galaxyY, sw * 0.42);
    galaxyHalo.addColorStop(0, "rgba(225, 240, 255, 0.6)");
    galaxyHalo.addColorStop(0.18, "rgba(170, 210, 255, 0.38)");
    galaxyHalo.addColorStop(0.45, "rgba(90, 140, 210, 0.16)");
    galaxyHalo.addColorStop(0.75, "rgba(35, 60, 110, 0.05)");
    galaxyHalo.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = galaxyHalo;
    g.beginPath();
    g.ellipse(galaxyX, galaxyY, sw * 0.35, sh * 0.15, -0.62, 0, Math.PI * 2);
    g.fill();

    const galaxyCore = g.createLinearGradient(
      galaxyX - sw * 0.25,
      galaxyY + sh * 0.12,
      galaxyX + sw * 0.25,
      galaxyY - sh * 0.12
    );
    galaxyCore.addColorStop(0, "rgba(200, 230, 255, 0)");
    galaxyCore.addColorStop(0.35, "rgba(240, 248, 255, 0.45)");
    galaxyCore.addColorStop(0.5, "rgba(255, 255, 255, 0.85)");
    galaxyCore.addColorStop(0.65, "rgba(240, 248, 255, 0.45)");
    galaxyCore.addColorStop(1, "rgba(200, 230, 255, 0)");

    g.fillStyle = galaxyCore;
    g.beginPath();
    g.ellipse(galaxyX, galaxyY, sw * 0.28, 14, -0.62, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(20, 8, 4, 0.45)";
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(galaxyX, galaxyY + 2, sw * 0.26, 4, -0.62, 0, Math.PI * 2);
    g.stroke();

    for (let s = 0; s < 48; s++) {
      const starX = galaxyX + Math.sin(s * 87.3 + t * 0.05) * sw * 0.22;
      const starY = galaxyY + Math.cos(s * 43.7) * sh * 0.12;
      const starAlpha = 0.25 + (Math.sin(t * 2.5 + s) * 0.5 + 0.5) * 0.55;
      g.fillStyle = `rgba(245, 250, 255, ${starAlpha})`;
      g.beginPath();
      g.arc(starX, starY, s % 4 === 0 ? 1.6 : 0.8, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // 3. 吸积盘后半部分
    g.save();
    renderVolumetricDiskV8(
      g,
      cx,
      cy,
      horizonR,
      diskTilt,
      cosD,
      sinD,
      diskRotationAngle,
      rot,
      t,
      bass,
      mid,
      treble,
      false,
      state.gasBands
    );
    g.restore();

    // 4. 爱因斯坦引力透镜弯月光拱
    g.save();
    const lensR = horizonR * 1.36;
    const lensGrd = g.createLinearGradient(
      cx - lensR * 1.1,
      cy - lensR * 0.85,
      cx + lensR * 0.8,
      cy + lensR * 0.6
    );
    lensGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    lensGrd.addColorStop(0.25, "rgba(255, 215, 110, 0.88)");
    lensGrd.addColorStop(0.65, "rgba(240, 120, 28, 0.55)");
    lensGrd.addColorStop(1, "rgba(170, 35, 8, 0.1)");

    g.strokeStyle = lensGrd;
    g.lineWidth = 4.2 + bass * 2.5;
    g.shadowColor = "#FFA825";
    g.shadowBlur = 20 * coreGlow;
    g.beginPath();
    g.ellipse(
      cx - 2,
      cy - horizonR * 0.14,
      lensR * 1.04,
      lensR * 0.74,
      diskRotationAngle,
      Math.PI * 0.82,
      Math.PI * 2.18
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
      horizonR * 0.86,
      cx,
      cy,
      horizonR * 1.04
    );
    horizonAbsorbGrd.addColorStop(0, "rgba(0, 0, 0, 1.0)");
    horizonAbsorbGrd.addColorStop(0.8, "rgba(2, 1, 3, 0.96)");
    horizonAbsorbGrd.addColorStop(1, "rgba(255, 160, 45, 0)");
    g.fillStyle = horizonAbsorbGrd;
    g.beginPath();
    g.arc(cx, cy, horizonR * 1.04, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(255, 255, 255, 0.92)";
    g.lineWidth = 1.2 + bass * 0.8;
    g.beginPath();
    g.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // 6. 吸积盘前半部分
    g.save();
    renderVolumetricDiskV8(
      g,
      cx,
      cy,
      horizonR,
      diskTilt,
      cosD,
      sinD,
      diskRotationAngle,
      rot,
      t,
      bass,
      mid,
      treble,
      true,
      state.gasBands
    );
    g.restore();

    // 7. 相对论极向幽蓝/白炽双螺旋等离子体喷流
    g.save();
    const jetAngle = -2.13;
    const jetCos = Math.cos(jetAngle);
    const jetSin = Math.sin(jetAngle);
    const jetPerpX = -jetSin;
    const jetPerpY = jetCos;

    const jetLength = Math.min(sw, sh) * (0.92 + bass * 0.22);
    const jetBaseRadius = horizonR * 0.42;

    const jetConeGrd = g.createLinearGradient(
      cx,
      cy,
      cx + jetCos * jetLength,
      cy + jetSin * jetLength
    );
    jetConeGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    jetConeGrd.addColorStop(0.06, "rgba(195, 235, 255, 0.85)");
    jetConeGrd.addColorStop(0.22, "rgba(110, 195, 255, 0.42)");
    jetConeGrd.addColorStop(0.55, "rgba(50, 130, 240, 0.16)");
    jetConeGrd.addColorStop(1, "rgba(20, 60, 180, 0)");

    g.fillStyle = jetConeGrd;
    g.beginPath();
    const jetTipWidth = 56 + bass * 35;
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
    g.lineWidth = 2.8 + bass * 2.2;
    g.shadowColor = "#80D8FF";
    g.shadowBlur = 18 * coreGlow;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + jetCos * (jetLength * 0.75), cy + jetSin * (jetLength * 0.75));
    g.stroke();

    for (let h = 0; h < state.jetStrands.length; h++) {
      const strand = state.jetStrands[h];
      const steps = 36;
      const pts: { x: number; y: number }[] = [];

      for (let s = 0; s <= steps; s++) {
        const prog = s / steps;
        const curDist = prog * jetLength;
        const helixRadius =
          (strand.radiusBase + Math.pow(prog, 1.1) * strand.radiusExp) * (1 + bass * 0.25);
        const helixAngle = prog * Math.PI * strand.freq + t * (strand.speed * 85) + strand.phase;

        const offsetX = jetPerpX * (Math.sin(helixAngle) * helixRadius);
        const offsetY = jetPerpY * (Math.sin(helixAngle) * helixRadius);

        const px = cx + jetCos * curDist + offsetX;
        const py = cy + jetSin * curDist + offsetY;
        pts.push({ x: px, y: py });
      }

      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length - 1; p++) {
        const mx = (pts[p].x + pts[p + 1].x) / 2;
        const my = (pts[p].y + pts[p + 1].y) / 2;
        g.quadraticCurveTo(pts[p].x, pts[p].y, mx, my);
      }
      g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

      const strandGrd = g.createLinearGradient(
        cx,
        cy,
        cx + jetCos * jetLength,
        cy + jetSin * jetLength
      );

      if (strand.colorType === 0) {
        strandGrd.addColorStop(0, `rgba(255, 255, 255, ${strand.alpha * 1.5})`);
        strandGrd.addColorStop(0.25, `rgba(220, 248, 255, ${strand.alpha * 1.2})`);
        strandGrd.addColorStop(0.7, `rgba(110, 200, 255, ${strand.alpha * 0.6})`);
        strandGrd.addColorStop(1, "rgba(50, 120, 240, 0)");
      } else if (strand.colorType === 1) {
        strandGrd.addColorStop(0, `rgba(230, 245, 255, ${strand.alpha * 1.3})`);
        strandGrd.addColorStop(0.3, `rgba(120, 215, 255, ${strand.alpha * 1.1})`);
        strandGrd.addColorStop(0.75, `rgba(60, 150, 245, ${strand.alpha * 0.5})`);
        strandGrd.addColorStop(1, "rgba(30, 80, 200, 0)");
      } else {
        strandGrd.addColorStop(0, `rgba(245, 255, 255, ${strand.alpha * 1.2})`);
        strandGrd.addColorStop(0.35, `rgba(140, 245, 235, ${strand.alpha * 1.0})`);
        strandGrd.addColorStop(0.8, `rgba(70, 180, 230, ${strand.alpha * 0.4})`);
        strandGrd.addColorStop(1, "rgba(30, 90, 180, 0)");
      }

      g.strokeStyle = strandGrd;
      g.lineWidth = strand.width * (1 + treble * 0.35);
      g.stroke();
    }

    const baseFlareR = horizonR * 0.48 * (1 + bass * 0.4);
    const baseGrd = g.createRadialGradient(cx, cy, 0, cx, cy, baseFlareR);
    baseGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    baseGrd.addColorStop(0.4, "rgba(210, 245, 255, 0.9)");
    baseGrd.addColorStop(0.8, "rgba(100, 190, 255, 0.4)");
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

        g.strokeStyle = `rgba(255, 195, 110, ${swItem.alpha * 0.3})`;
        g.lineWidth = 1.6;
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

function renderVolumetricDiskV8(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  diskTilt: number,
  cosD: number,
  sinD: number,
  rotAngle: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number,
  isForeground: boolean,
  gasBands: AccretionGasBand[]
) {
  const iscoR = horizonR * 1.32;
  const maxR = horizonR * 18.0;

  if (isForeground) {
    const fgBaseGrd = g.createRadialGradient(cx, cy, iscoR * 1.1, cx, cy, horizonR * 6.5);
    fgBaseGrd.addColorStop(0, "rgba(255, 240, 180, 0.4)");
    fgBaseGrd.addColorStop(0.2, "rgba(245, 140, 35, 0.32)");
    fgBaseGrd.addColorStop(0.55, "rgba(180, 65, 15, 0.2)");
    fgBaseGrd.addColorStop(0.85, "rgba(90, 20, 6, 0.1)");
    fgBaseGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = fgBaseGrd;
    g.beginPath();
    for (let a = 0; a <= 36; a++) {
      const rad = (a / 36) * Math.PI;
      const ex = Math.cos(rad) * (horizonR * 8.5);
      const ey = Math.sin(rad) * (horizonR * 8.5) * diskTilt;
      const px = cx + ex * cosD - ey * sinD;
      const py = cy + ex * sinD + ey * cosD;
      if (a === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    for (let a = 36; a >= 0; a--) {
      const rad = (a / 36) * Math.PI;
      const ex = Math.cos(rad) * (iscoR * 0.98);
      const ey = Math.sin(rad) * (iscoR * 0.98) * diskTilt;
      const px = cx + ex * cosD - ey * sinD;
      const py = cy + ex * sinD + ey * cosD;
      g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
  }

  for (let i = 0; i < gasBands.length; i++) {
    const band = gasBands[i];
    const curBaseR = band.baseRadius * (1 + bass * 0.06);

    if (curBaseR < iscoR * 0.95 || curBaseR > maxR) continue;

    const angleStart = rot * (band.speed * 85) + band.armAngle;
    const steps = 42;
    const pts: { x: number; y: number; alpha: number }[] = [];

    for (let s = 0; s <= steps; s++) {
      const prog = s / steps;
      const angle = angleStart + prog * band.length;

      const r = curBaseR * Math.exp(prog * band.spiralRate);
      if (r > maxR * 1.15) break;

      const waveDisp =
        Math.sin(angle * band.waveFreq + t * 1.8 + band.wavePhase) * (3.0 + bass * 5.0);
      const finalR = r + waveDisp;

      const ex = Math.cos(angle) * finalR;
      const ey = Math.sin(angle) * finalR * diskTilt;
      const px = cx + ex * cosD - ey * sinD;
      const py = cy + ex * sinD + ey * cosD;

      const isInFront = ey >= -horizonR * 0.22;

      if (isForeground === isInFront) {
        const distRatio = (finalR - iscoR) / (horizonR * 7.5);
        const alpha =
          band.alpha *
          (1 - Math.min(1, Math.max(0, distRatio * 0.75))) *
          (isForeground ? 1.0 : 0.75) *
          (1 + mid * 0.3);

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

    if (band.colorIndex === 0) {
      strokeGrd.addColorStop(0, `rgba(255, 255, 245, ${pts[0].alpha * 1.4})`);
      strokeGrd.addColorStop(0.3, `rgba(255, 228, 140, ${pts[0].alpha * 1.2})`);
      strokeGrd.addColorStop(0.7, `rgba(255, 165, 50, ${pts[0].alpha * 0.9})`);
      strokeGrd.addColorStop(1, `rgba(215, 85, 22, ${pts[pts.length - 1].alpha * 0.5})`);
    } else if (band.colorIndex === 1) {
      strokeGrd.addColorStop(0, `rgba(255, 235, 165, ${pts[0].alpha * 1.2})`);
      strokeGrd.addColorStop(0.35, `rgba(248, 155, 48, ${pts[0].alpha * 1.05})`);
      strokeGrd.addColorStop(0.75, `rgba(205, 90, 26, ${pts[0].alpha * 0.8})`);
      strokeGrd.addColorStop(1, `rgba(155, 48, 14, ${pts[pts.length - 1].alpha * 0.45})`);
    } else if (band.colorIndex === 2) {
      strokeGrd.addColorStop(0, `rgba(245, 150, 48, ${pts[0].alpha * 1.05})`);
      strokeGrd.addColorStop(0.45, `rgba(200, 80, 22, ${pts[0].alpha * 0.85})`);
      strokeGrd.addColorStop(0.85, `rgba(140, 40, 12, ${pts[0].alpha * 0.55})`);
      strokeGrd.addColorStop(1, `rgba(85, 20, 6, ${pts[pts.length - 1].alpha * 0.28})`);
    } else if (band.colorIndex === 3) {
      strokeGrd.addColorStop(0, `rgba(190, 70, 22, ${pts[0].alpha * 0.85})`);
      strokeGrd.addColorStop(0.5, `rgba(130, 36, 12, ${pts[0].alpha * 0.6})`);
      strokeGrd.addColorStop(1, `rgba(60, 12, 4, ${pts[pts.length - 1].alpha * 0.2})`);
    } else {
      strokeGrd.addColorStop(0, `rgba(140, 40, 12, ${pts[0].alpha * 0.6})`);
      strokeGrd.addColorStop(0.5, `rgba(80, 18, 6, ${pts[0].alpha * 0.35})`);
      strokeGrd.addColorStop(1, `rgba(30, 6, 2, ${pts[pts.length - 1].alpha * 0.1})`);
    }

    g.strokeStyle = strokeGrd;
    g.lineWidth = band.width * (1 + treble * 0.3);
    g.stroke();
  }

  if (isForeground) {
    g.strokeStyle = "rgba(255, 252, 235, 0.85)";
    g.lineWidth = 3.2 + bass * 2.0;
    g.shadowColor = "#FFC450";
    g.shadowBlur = 18;
    g.beginPath();
    g.ellipse(cx, cy, iscoR, iscoR * diskTilt, rotAngle, 0, Math.PI);
    g.stroke();
  }
}
