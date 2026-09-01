/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface JetHelicalStrand {
  phase: number;
  radiusBase: number;
  radiusGrowth: number;
  speed: number;
  width: number;
  alpha: number;
  colorType: number;
  pitch: number;
}

interface SpiralGasFilament {
  baseRadius: number;
  angleOffset: number;
  length: number;
  speed: number;
  spiralK: number;
  width: number;
  alpha: number;
  tier: number;
  waveFreq: number;
  wavePhase: number;
}

interface ShockwaveRing {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

interface SuperstringState {
  filaments: SpiralGasFilament[];
  jetStrands: JetHelicalStrand[];
  shockwaves: ShockwaveRing[];
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
    "电影级天体物理黑洞与相对论极向螺旋喷流：48°俯视透视、铜金旋涡实体连续盘与爱因斯坦引力透镜弯月环（60FPS 极速渲染）",
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
      min: 30,
      max: 120,
      step: 10,
      default: 54,
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
    const filaments: SpiralGasFilament[] = [];
    const filamentCount = 54;
    for (let i = 0; i < filamentCount; i++) {
      const frac = i / (filamentCount - 1);
      const baseRadius = 46 + Math.pow(frac, 1.35) * 780;
      const speed = (0.012 / Math.sqrt(Math.max(1, baseRadius * 0.025))) * 0.75;

      let tier = 1;
      if (frac < 0.1) tier = 0;
      else if (frac < 0.38) tier = 1;
      else if (frac < 0.68) tier = 2;
      else if (frac < 0.88) tier = 3;
      else tier = 4;

      filaments.push({
        baseRadius,
        angleOffset: (i * 137.508 * Math.PI) / 180,
        length: Math.PI * (2.0 + (i % 3) * 0.5),
        speed,
        spiralK: 0.12 + (i % 4) * 0.015,
        width: 2.5 + frac * 8.0,
        alpha: 0.18 + Math.sin(frac * Math.PI) * 0.22,
        tier,
        waveFreq: 2 + (i % 3),
        wavePhase: Math.random() * Math.PI * 2,
      });
    }

    const jetStrands: JetHelicalStrand[] = [];
    const strandCount = 6;
    for (let i = 0; i < strandCount; i++) {
      const frac = i / strandCount;
      jetStrands.push({
        phase: frac * Math.PI * 2,
        radiusBase: 7 + (i % 2) * 5,
        radiusGrowth: 36 + (i % 3) * 14,
        speed: 0.022 + (i % 2) * 0.008,
        width: 2.2 + (i % 2) * 1.5,
        alpha: 0.35 + (i % 2) * 0.25,
        colorType: i % 3,
        pitch: 3.2 + (i % 2) * 0.8,
      });
    }

    const state: SuperstringState = {
      filaments,
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

    const { singularityMass = 1.0, superstringTension = 1.2, burstSensitivity = 1.1 } = params;

    let state = ctx.private?.state as SuperstringState | undefined;
    if (!state || !state.filaments || state.filaments.length === 0) {
      this.init(ctx);
      state = ctx.private?.state as SuperstringState;
    }

    const cx = sw * 0.53;
    const cy = sh * 0.6;

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
        radius: 50 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.8,
        alpha: 0.5,
        speed: 16 + bass * 18,
      });
    }

    state.rotationAngle += (0.0025 + energy * 0.006) * superstringTension;
    const rot = state.rotationAngle;

    const horizonR = (48 + bass * 12) * singularityMass;
    const iscoR = horizonR * 1.34;
    const diskTilt = 0.42;
    const diskAngle = -0.46;
    const cosD = Math.cos(diskAngle);
    const sinD = Math.sin(diskAngle);

    // 1. 深空宇宙底色
    g.save();
    g.fillStyle = "#070202";
    g.fillRect(0, 0, sw, sh);

    const spaceAmbientGrd = g.createRadialGradient(
      cx + sw * 0.08,
      cy + sh * 0.08,
      horizonR * 1.5,
      cx,
      cy,
      Math.max(sw, sh) * 0.88
    );
    spaceAmbientGrd.addColorStop(0, "rgba(55, 16, 6, 0.42)");
    spaceAmbientGrd.addColorStop(0.35, "rgba(30, 8, 3, 0.32)");
    spaceAmbientGrd.addColorStop(0.7, "rgba(12, 3, 1, 0.22)");
    spaceAmbientGrd.addColorStop(1, "rgba(4, 1, 1, 0.95)");
    g.fillStyle = spaceAmbientGrd;
    g.fillRect(0, 0, sw, sh);

    // 2. 左上方侧向银河系盘面
    const galaxyX = sw * 0.12;
    const galaxyY = sh * 0.14;

    const galaxyHalo = g.createRadialGradient(galaxyX, galaxyY, 15, galaxyX, galaxyY, sw * 0.36);
    galaxyHalo.addColorStop(0, "rgba(220, 240, 255, 0.55)");
    galaxyHalo.addColorStop(0.2, "rgba(150, 195, 255, 0.32)");
    galaxyHalo.addColorStop(0.5, "rgba(70, 120, 200, 0.12)");
    galaxyHalo.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = galaxyHalo;
    g.beginPath();
    g.ellipse(galaxyX, galaxyY, sw * 0.32, sh * 0.14, -0.58, 0, Math.PI * 2);
    g.fill();

    const galaxyCore = g.createLinearGradient(
      galaxyX - sw * 0.2,
      galaxyY + sh * 0.1,
      galaxyX + sw * 0.2,
      galaxyY - sh * 0.1
    );
    galaxyCore.addColorStop(0, "rgba(200, 230, 255, 0)");
    galaxyCore.addColorStop(0.4, "rgba(240, 250, 255, 0.65)");
    galaxyCore.addColorStop(0.5, "rgba(255, 255, 255, 0.88)");
    galaxyCore.addColorStop(0.6, "rgba(240, 250, 255, 0.65)");
    galaxyCore.addColorStop(1, "rgba(200, 230, 255, 0)");

    g.fillStyle = galaxyCore;
    g.beginPath();
    g.ellipse(galaxyX, galaxyY, sw * 0.24, 11, -0.58, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(15, 6, 3, 0.5)";
    g.lineWidth = 3.2;
    g.beginPath();
    g.ellipse(galaxyX, galaxyY + 1.5, sw * 0.22, 3.2, -0.58, 0, Math.PI * 2);
    g.stroke();

    for (let s = 0; s < 32; s++) {
      const starX = galaxyX + Math.sin(s * 87.3) * sw * 0.2;
      const starY = galaxyY + Math.cos(s * 43.7) * sh * 0.11;
      const starAlpha = 0.3 + (Math.sin(t * 3.0 + s * 1.5) * 0.5 + 0.5) * 0.6;
      g.fillStyle = `rgba(240, 248, 255, ${starAlpha})`;
      g.beginPath();
      g.arc(starX, starY, s % 3 === 0 ? 1.4 : 0.7, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // 3. 吸积盘后半部分
    g.save();
    renderSmoothAccretionDiskV8(
      g,
      cx,
      cy,
      horizonR,
      iscoR,
      diskTilt,
      cosD,
      sinD,
      diskAngle,
      rot,
      t,
      bass,
      mid,
      treble,
      false,
      state.filaments
    );
    g.restore();

    // 4. 爱因斯坦引力透镜弯月光拱
    g.save();
    const lensR = horizonR * 1.34;
    const lensGrd = g.createLinearGradient(
      cx - lensR,
      cy - lensR * 0.8,
      cx + lensR * 0.7,
      cy + lensR * 0.5
    );
    lensGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    lensGrd.addColorStop(0.3, "rgba(255, 225, 120, 0.88)");
    lensGrd.addColorStop(0.7, "rgba(235, 115, 25, 0.45)");
    lensGrd.addColorStop(1, "rgba(160, 30, 5, 0)");

    g.strokeStyle = "rgba(255, 175, 45, 0.25)";
    g.lineWidth = 9 + bass * 4;
    g.beginPath();
    g.ellipse(
      cx,
      cy - horizonR * 0.12,
      lensR * 1.05,
      lensR * 0.75,
      diskAngle,
      Math.PI * 0.8,
      Math.PI * 2.2
    );
    g.stroke();

    g.strokeStyle = lensGrd;
    g.lineWidth = 3.5 + bass * 2.0;
    g.beginPath();
    g.ellipse(
      cx,
      cy - horizonR * 0.12,
      lensR * 1.05,
      lensR * 0.75,
      diskAngle,
      Math.PI * 0.8,
      Math.PI * 2.2
    );
    g.stroke();
    g.restore();

    // 5. 3D 纯黑施瓦西事件视界球体
    g.save();
    g.fillStyle = "#000000";
    g.beginPath();
    g.arc(cx, cy, horizonR, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = "rgba(255, 255, 255, 0.85)";
    g.lineWidth = 1.2 + bass * 0.6;
    g.beginPath();
    g.arc(cx, cy, horizonR * 0.99, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // 6. 吸积盘前半部分
    g.save();
    renderSmoothAccretionDiskV8(
      g,
      cx,
      cy,
      horizonR,
      iscoR,
      diskTilt,
      cosD,
      sinD,
      diskAngle,
      rot,
      t,
      bass,
      mid,
      treble,
      true,
      state.filaments
    );
    g.restore();

    // 7. 相对论极向幽蓝/白炽双螺旋等离子体喷流
    g.save();
    const jetAngle = -2.13;
    const jetCos = Math.cos(jetAngle);
    const jetSin = Math.sin(jetAngle);
    const jetPerpX = -jetSin;
    const jetPerpY = jetCos;

    const jetLength = Math.min(sw, sh) * (0.95 + bass * 0.2);
    const jetBaseR = horizonR * 0.38;

    const jetConeGrd = g.createLinearGradient(
      cx,
      cy,
      cx + jetCos * jetLength,
      cy + jetSin * jetLength
    );
    jetConeGrd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    jetConeGrd.addColorStop(0.08, "rgba(185, 230, 255, 0.7)");
    jetConeGrd.addColorStop(0.3, "rgba(100, 185, 255, 0.28)");
    jetConeGrd.addColorStop(0.7, "rgba(40, 110, 220, 0.08)");
    jetConeGrd.addColorStop(1, "rgba(15, 50, 160, 0)");

    g.fillStyle = jetConeGrd;
    g.beginPath();
    const jetTipWidth = 48 + bass * 24;
    g.moveTo(cx - jetPerpX * jetBaseR, cy - jetPerpY * jetBaseR);
    g.lineTo(
      cx + jetCos * jetLength - jetPerpX * jetTipWidth,
      cy + jetSin * jetLength - jetPerpY * jetTipWidth
    );
    g.lineTo(
      cx + jetCos * jetLength + jetPerpX * jetTipWidth,
      cy + jetSin * jetLength + jetPerpY * jetTipWidth
    );
    g.lineTo(cx + jetPerpX * jetBaseR, cy + jetPerpY * jetBaseR);
    g.closePath();
    g.fill();

    g.strokeStyle = "rgba(255, 255, 255, 0.95)";
    g.lineWidth = 2.4 + bass * 1.6;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + jetCos * (jetLength * 0.72), cy + jetSin * (jetLength * 0.72));
    g.stroke();

    for (let h = 0; h < state.jetStrands.length; h++) {
      const strand = state.jetStrands[h];
      const steps = 32;
      const pts: { x: number; y: number }[] = [];

      for (let s = 0; s <= steps; s++) {
        const prog = s / steps;
        const curDist = prog * jetLength;
        const helixRadius =
          (strand.radiusBase + Math.pow(prog, 1.15) * strand.radiusGrowth) * (1 + bass * 0.22);
        const helixAngle = prog * Math.PI * strand.pitch + t * (strand.speed * 80) + strand.phase;

        const offsetX = jetPerpX * (Math.sin(helixAngle) * helixRadius);
        const offsetY = jetPerpY * (Math.sin(helixAngle) * helixRadius);

        pts.push({
          x: cx + jetCos * curDist + offsetX,
          y: cy + jetSin * curDist + offsetY,
        });
      }

      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length - 1; p++) {
        const mx = (pts[p].x + pts[p + 1].x) / 2;
        const my = (pts[p].y + pts[p + 1].y) / 2;
        g.quadraticCurveTo(pts[p].x, pts[p].y, mx, my);
      }
      g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

      if (strand.colorType === 0) {
        g.strokeStyle = `rgba(255, 255, 255, ${strand.alpha * (0.8 + treble * 0.2)})`;
      } else if (strand.colorType === 1) {
        g.strokeStyle = `rgba(135, 220, 255, ${strand.alpha * (0.75 + treble * 0.2)})`;
      } else {
        g.strokeStyle = `rgba(160, 245, 240, ${strand.alpha * (0.7 + treble * 0.2)})`;
      }

      g.lineWidth = strand.width * (1 + treble * 0.3);
      g.stroke();
    }

    const baseFlareR = horizonR * 0.42 * (1 + bass * 0.35);
    const baseGrd = g.createRadialGradient(cx, cy, 0, cx, cy, baseFlareR);
    baseGrd.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    baseGrd.addColorStop(0.35, "rgba(215, 245, 255, 0.85)");
    baseGrd.addColorStop(0.7, "rgba(90, 180, 255, 0.35)");
    baseGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = baseGrd;
    g.beginPath();
    g.arc(cx, cy, baseFlareR, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // 8. 引力波涟漪
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
        g.lineWidth = 1.6;
        g.beginPath();
        g.ellipse(cx, cy, swItem.radius, swItem.radius * diskTilt, diskAngle, 0, Math.PI * 2);
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

function renderSmoothAccretionDiskV8(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  horizonR: number,
  iscoR: number,
  diskTilt: number,
  cosD: number,
  sinD: number,
  diskAngle: number,
  rot: number,
  t: number,
  bass: number,
  mid: number,
  treble: number,
  isForeground: boolean,
  filaments: SpiralGasFilament[]
) {
  const maxDiskR = horizonR * 12.0;

  if (isForeground) {
    const startAngle = 0;
    const endAngle = Math.PI;

    const iscoGrd = g.createRadialGradient(cx, cy, iscoR * 0.9, cx, cy, horizonR * 3.5);
    iscoGrd.addColorStop(0, "rgba(255, 250, 220, 0.75)");
    iscoGrd.addColorStop(0.3, "rgba(255, 190, 60, 0.55)");
    iscoGrd.addColorStop(0.7, "rgba(235, 110, 25, 0.35)");
    iscoGrd.addColorStop(1, "rgba(160, 45, 10, 0)");

    g.fillStyle = iscoGrd;
    g.beginPath();
    g.ellipse(cx, cy, horizonR * 3.5, horizonR * 3.5 * diskTilt, diskAngle, startAngle, endAngle);
    g.ellipse(cx, cy, iscoR * 0.95, iscoR * 0.95 * diskTilt, diskAngle, endAngle, startAngle, true);
    g.fill();

    const mainDiskGrd = g.createRadialGradient(cx, cy, horizonR * 2.8, cx, cy, maxDiskR * 0.85);
    mainDiskGrd.addColorStop(0, "rgba(225, 105, 22, 0.38)");
    mainDiskGrd.addColorStop(0.35, "rgba(175, 55, 14, 0.26)");
    mainDiskGrd.addColorStop(0.7, "rgba(110, 25, 6, 0.15)");
    mainDiskGrd.addColorStop(1, "rgba(45, 8, 2, 0)");

    g.fillStyle = mainDiskGrd;
    g.beginPath();
    g.ellipse(cx, cy, maxDiskR * 0.85, maxDiskR * 0.85 * diskTilt, diskAngle, startAngle, endAngle);
    g.ellipse(
      cx,
      cy,
      horizonR * 2.6,
      horizonR * 2.6 * diskTilt,
      diskAngle,
      endAngle,
      startAngle,
      true
    );
    g.fill();
  }

  const tierColors = [
    `rgba(255, 248, 215, ${0.45 + mid * 0.2})`,
    `rgba(255, 185, 65, ${0.35 + mid * 0.15})`,
    `rgba(230, 105, 28, ${0.28 + mid * 0.12})`,
    `rgba(170, 52, 14, ${0.22 + mid * 0.08})`,
    `rgba(100, 22, 6, ${0.15 + mid * 0.05})`,
  ];

  for (let tier = 0; tier < 5; tier++) {
    g.beginPath();
    let hasPaths = false;

    for (let i = 0; i < filaments.length; i++) {
      const f = filaments[i];
      if (f.tier !== tier) continue;

      const curBaseR = f.baseRadius * (1 + bass * 0.05);
      if (curBaseR < iscoR * 0.95 || curBaseR > maxDiskR) continue;

      const angleStart = rot * (f.speed * 85) + f.angleOffset;
      const steps = 30;
      let started = false;

      for (let s = 0; s <= steps; s++) {
        const prog = s / steps;
        const angle = angleStart + prog * f.length;

        const r = curBaseR * Math.exp(prog * f.spiralK);
        if (r > maxDiskR * 1.1) break;

        const wave = Math.sin(angle * f.waveFreq + t * 2.0 + f.wavePhase) * (2.5 + bass * 4.0);
        const finalR = r + wave;

        const ex = Math.cos(angle) * finalR;
        const ey = Math.sin(angle) * finalR * diskTilt;
        const px = cx + ex * cosD - ey * sinD;
        const py = cy + ex * sinD + ey * cosD;

        const isInFront = ey >= -horizonR * 0.18;
        if (isForeground === isInFront) {
          if (!started) {
            g.moveTo(px, py);
            started = true;
            hasPaths = true;
          } else {
            g.lineTo(px, py);
          }
        } else {
          started = false;
        }
      }
    }

    if (hasPaths) {
      g.strokeStyle = tierColors[tier];
      g.lineWidth = (3.0 + tier * 1.2) * (1 + treble * 0.25);
      g.stroke();
    }
  }

  if (isForeground) {
    g.strokeStyle = "rgba(255, 255, 240, 0.92)";
    g.lineWidth = 2.6 + bass * 1.5;
    g.beginPath();
    g.ellipse(cx, cy, iscoR, iscoR * diskTilt, diskAngle, 0, Math.PI);
    g.stroke();
  }
}
