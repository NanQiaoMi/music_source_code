/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

/**
 * 超弦连续曲线束定义（零点状粒子，纯连续多维空间曲率弦线）
 */
interface SuperstringFilament {
  baseAngle: number;
  length: number;
  innerRadius: number;
  outerRadius: number;
  spiralTightness: number;
  frequency: number;
  phase: number;
  harmonicRank: number;
  colorType: number; // 0: 铂金蓝白 (多普勒迎面), 1: 炽热琥珀金, 2: 极光金青, 3: 深空赤金
  lineWidth: number;
  alpha: number;
  rotationSpeed: number;
  verticalWaveAmp: number;
}

/**
 * 连续等离子流体光幕层（无粒子，纯连续流体曲率带）
 */
interface PlasmaRibbonLayer {
  radiusInner: number;
  radiusOuter: number;
  speed: number;
  phase: number;
  waveCount: number;
  hueOffset: number;
  alpha: number;
  thickness: number;
}

/**
 * 引力波曲率涟漪光膜
 */
interface GravitationalShockwave {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  lineWidth: number;
  hue: number;
}

interface SuperstringState {
  filaments: SuperstringFilament[];
  plasmaRibbons: PlasmaRibbonLayer[];
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

/**
 * 创建高性能离屏径向发光精灵
 */
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

/**
 * 创建电影级变形宽银幕横向拉丝光晕精灵
 */
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
    hGrd.addColorStop(0, "rgba(50, 160, 255, 0)");
    hGrd.addColorStop(0.2, "rgba(70, 200, 255, 0.18)");
    hGrd.addColorStop(0.38, "rgba(255, 210, 120, 0.45)");
    hGrd.addColorStop(0.48, "rgba(255, 250, 240, 0.95)");
    hGrd.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
    hGrd.addColorStop(0.52, "rgba(255, 250, 240, 0.95)");
    hGrd.addColorStop(0.62, "rgba(255, 190, 90, 0.45)");
    hGrd.addColorStop(0.8, "rgba(255, 120, 40, 0.15)");
    hGrd.addColorStop(1, "rgba(255, 80, 20, 0)");

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
    "电影级卡冈图雅黑洞吸积盘模拟：双曲引力透镜光弧、多维超弦连续曲率流光束与多普勒相对论等离子光幕",
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
      name: "超弦张力与流速",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.2,
    },
    {
      id: "stardustDensity",
      name: "超弦光丝密度",
      type: "number",
      mode: "professional",
      min: 24,
      max: 96,
      step: 4,
      default: 64,
    },
    {
      id: "chromaticAberration",
      name: "相对论光晕强度",
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
    const filamentCount = 64;
    const filaments: SuperstringFilament[] = [];

    for (let i = 0; i < filamentCount; i++) {
      const angle = (i / filamentCount) * Math.PI * 2;
      const rank = (i % 6) + 1;
      const colorType = i % 4;
      const innerRadius = 38 + (i % 8) * 6;
      const outerRadius = 380 + (i / filamentCount) * 460;

      filaments.push({
        baseAngle: angle,
        length: outerRadius - innerRadius,
        innerRadius,
        outerRadius,
        spiralTightness: 1.8 + (i % 5) * 0.35,
        frequency: 2 + rank * 1.2,
        phase: (i / filamentCount) * Math.PI * 4,
        harmonicRank: rank,
        colorType,
        lineWidth: 1.2 + (i % 4) * 0.5,
        alpha: 0.45 + (i % 3) * 0.2,
        rotationSpeed: (0.004 + (1 / (rank + 2)) * 0.008) * 1.1,
        verticalWaveAmp: 8 + (i % 6) * 4,
      });
    }

    // 6 层连续流体等离子曲率光幕
    const plasmaRibbons: PlasmaRibbonLayer[] = [];
    const ribbonRadii = [
      { inR: 45, outR: 110, spd: 0.016, thick: 28, alpha: 0.42 },
      { inR: 95, outR: 180, spd: 0.012, thick: 36, alpha: 0.35 },
      { inR: 160, outR: 280, spd: 0.009, thick: 48, alpha: 0.28 },
      { inR: 250, outR: 420, spd: 0.006, thick: 62, alpha: 0.22 },
      { inR: 380, outR: 580, spd: 0.004, thick: 80, alpha: 0.16 },
      { inR: 520, outR: 780, spd: 0.0025, thick: 110, alpha: 0.12 },
    ];

    ribbonRadii.forEach((r, idx) => {
      plasmaRibbons.push({
        radiusInner: r.inR,
        radiusOuter: r.outR,
        speed: r.spd,
        phase: (idx / ribbonRadii.length) * Math.PI * 2,
        waveCount: 3 + (idx % 3),
        hueOffset: idx * 0.15,
        alpha: r.alpha,
        thickness: r.thick,
      });
    });

    const anamorphicFlareSprite = createAnamorphicFlareSprite(800, 56);

    const photonRingSprite = createRadialGlowSprite(220, [
      [0, "rgba(255, 255, 255, 1.0)"],
      [0.15, "rgba(255, 230, 180, 0.95)"],
      [0.35, "rgba(255, 150, 50, 0.65)"],
      [0.65, "rgba(180, 80, 240, 0.22)"],
      [0.85, "rgba(50, 140, 255, 0.08)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);

    const coreHaloSprite = createRadialGlowSprite(320, [
      [0, "rgba(255, 200, 100, 0.85)"],
      [0.25, "rgba(240, 110, 30, 0.45)"],
      [0.55, "rgba(140, 40, 200, 0.18)"],
      [0.85, "rgba(30, 90, 220, 0.05)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);

    const state: SuperstringState = {
      filaments,
      plasmaRibbons,
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
      stardustDensity = 64,
      chromaticAberration = 1.35,
      burstSensitivity = 1.1,
      coreGlow = 1.5,
    } = params;

    let state = ctx.private?.state as SuperstringState | undefined;
    if (!state || !state.filaments || state.filaments.length === 0) {
      this.init(ctx);
      state = ctx.private?.state as SuperstringState;
    }

    // 平滑音频频段特征响应
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

    // 低频重击检测，生成引力波曲率涟漪光膜
    const nowMs = Date.now();
    if (
      rawBass > 0.65 &&
      rawBass - state.smoothedBass > 0.25 * burstSensitivity &&
      nowMs - state.lastBassTriggerTime > 300
    ) {
      state.lastBassTriggerTime = nowMs;
      state.shockwaves.push({
        radius: 40 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.68,
        alpha: 0.95,
        speed: 14 + bass * 20,
        lineWidth: 2.5 + bass * 3.0,
        hue: (t * 20) % 360,
      });
    }

    // 1. 深邃暗黑深空背景与引力透镜空间雾化 (Cinematic Cosmic Void)
    g.save();
    g.fillStyle = "#010204";
    g.fillRect(0, 0, sw, sh);

    g.globalCompositeOperation = "screen";
    const maxDim = Math.max(sw, sh);
    const bgGrd = g.createRadialGradient(cx, cy, 0, cx, cy, maxDim * 0.75);
    // 相对论多普勒渐变底色
    bgGrd.addColorStop(0, `rgba(255, 175, 60, ${(0.07 + bass * 0.1) * chromaticAberration})`);
    bgGrd.addColorStop(0.28, `rgba(220, 90, 25, ${0.04 + mid * 0.05})`);
    bgGrd.addColorStop(0.55, `rgba(130, 45, 180, ${0.025 + mid * 0.03})`);
    bgGrd.addColorStop(0.78, `rgba(35, 110, 220, ${0.02 + treble * 0.03})`);
    bgGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = bgGrd;
    g.fillRect(0, 0, sw, sh);
    g.restore();

    // 2. 3D 相机倾角与开普勒自转系统动力学
    const fov = 680;
    const pitch = 0.68 + Math.sin(t * 0.12) * 0.03; // 约 39° 倾角，展现吸积盘立体层次
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    state.rotationAngle += (0.003 + energy * 0.008) * superstringTension;
    const cosR = Math.cos(state.rotationAngle);
    const sinR = Math.sin(state.rotationAngle);

    // 3. 引力波曲率涟漪光膜（Gravitational Shockwave Ripple Membranes）
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

        // 双层发光等高线光膜
        g.strokeStyle = `rgba(255, 225, 150, ${ringAlpha * 0.85})`;
        g.lineWidth = swItem.lineWidth;
        g.beginPath();
        g.ellipse(cx, cy, swItem.radius, swItem.radius * cosP, 0, 0, Math.PI * 2);
        g.stroke();

        // 伴随的微弱蓝紫引力透镜反相波
        g.strokeStyle = `rgba(120, 180, 255, ${ringAlpha * 0.45})`;
        g.lineWidth = swItem.lineWidth * 0.6;
        g.beginPath();
        g.ellipse(cx, cy, swItem.radius * 0.94, swItem.radius * 0.94 * cosP, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }

    // 4. 爱因斯坦引力透镜上下双光拱（Upper & Lower Gravitational Lensing Halo Arcs）
    const lensingRadius = (78 + bass * 26) * singularityMass;
    const lensingHeight = lensingRadius * 0.92;

    g.save();
    g.globalCompositeOperation = "screen";

    // (4.1) 上部弯曲引力透镜主光拱 (Upper Lensing Halo)
    const upperGrd = g.createRadialGradient(
      cx,
      cy - lensingHeight * 0.38,
      lensingRadius * 0.32,
      cx,
      cy - lensingHeight * 0.38,
      lensingRadius * 1.65
    );
    upperGrd.addColorStop(0, `rgba(255, 250, 235, ${(0.92 + bass * 0.15) * chromaticAberration})`);
    upperGrd.addColorStop(0.25, `rgba(255, 180, 60, ${0.65 + mid * 0.3})`);
    upperGrd.addColorStop(0.55, `rgba(220, 80, 25, ${0.35 + mid * 0.2})`);
    upperGrd.addColorStop(0.82, "rgba(120, 40, 160, 0.12)");
    upperGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = upperGrd;
    g.beginPath();
    g.ellipse(
      cx,
      cy - lensingHeight * 0.45,
      lensingRadius * 1.42,
      lensingHeight * 0.96,
      0,
      Math.PI * 0.88,
      Math.PI * 2.12
    );
    g.fill();

    // (4.2) 下部弯曲引力透镜副光拱 (Lower Lensing Halo)
    const lowerGrd = g.createRadialGradient(
      cx,
      cy + lensingHeight * 0.38,
      lensingRadius * 0.32,
      cx,
      cy + lensingHeight * 0.38,
      lensingRadius * 1.5
    );
    lowerGrd.addColorStop(0, `rgba(255, 240, 200, ${(0.72 + bass * 0.2) * chromaticAberration})`);
    lowerGrd.addColorStop(0.32, `rgba(240, 140, 45, ${0.45 + mid * 0.25})`);
    lowerGrd.addColorStop(0.65, `rgba(180, 50, 20, ${0.18 + mid * 0.15})`);
    lowerGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = lowerGrd;
    g.beginPath();
    g.ellipse(
      cx,
      cy + lensingHeight * 0.42,
      lensingRadius * 1.32,
      lensingHeight * 0.8,
      0,
      0,
      Math.PI
    );
    g.fill();

    g.restore();

    // 5. 连续流体等离子吸积光幕层（Volumetric Continuous Fluid Plasma Accretion Ribbons）
    g.save();
    g.globalCompositeOperation = "screen";

    for (let layerIdx = 0; layerIdx < state.plasmaRibbons.length; layerIdx++) {
      const ribbon = state.plasmaRibbons[layerIdx];
      ribbon.phase += ribbon.speed * (1 + energy * 1.6 + bass * 1.2);

      const rInner = ribbon.radiusInner * singularityMass;
      const rOuter = ribbon.radiusOuter * singularityMass * (1 + bass * 0.18);
      const segments = 48;

      g.beginPath();
      // 外边缘流体曲线
      for (let s = 0; s <= segments; s++) {
        const segAngle = (s / segments) * Math.PI * 2;
        const wave = Math.sin(segAngle * ribbon.waveCount + ribbon.phase + t * 2) * (8 + bass * 16);
        const curR = rOuter + wave;

        const pxRaw = Math.cos(segAngle) * curR;
        const pyRaw = Math.sin(segAngle * 3 + ribbon.phase) * (6 + treble * 12);
        const pzRaw = Math.sin(segAngle) * curR;

        const rx = pxRaw * cosR - pzRaw * sinR;
        const rz = pxRaw * sinR + pzRaw * cosR;
        const ry = pyRaw * cosP - rz * sinP;
        const finalZ = pyRaw * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        const screenX = cx + rx * scale;
        const screenY = cy + ry * scale;

        if (s === 0) {
          g.moveTo(screenX, screenY);
        } else {
          g.lineTo(screenX, screenY);
        }
      }

      // 内边缘闭合
      for (let s = segments; s >= 0; s--) {
        const segAngle = (s / segments) * Math.PI * 2;
        const wave = Math.sin(segAngle * ribbon.waveCount + ribbon.phase * 1.3) * (4 + bass * 8);
        const curR = rInner + wave;

        const pxRaw = Math.cos(segAngle) * curR;
        const pyRaw = Math.sin(segAngle * 2 + ribbon.phase) * (4 + treble * 8);
        const pzRaw = Math.sin(segAngle) * curR;

        const rx = pxRaw * cosR - pzRaw * sinR;
        const rz = pxRaw * sinR + pzRaw * cosR;
        const ry = pyRaw * cosP - rz * sinP;
        const finalZ = pyRaw * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        const screenX = cx + rx * scale;
        const screenY = cy + ry * scale;

        g.lineTo(screenX, screenY);
      }
      g.closePath();

      // 多普勒相对论渐变着色 (左侧蓝白，右侧金红)
      const ribbonGrd = g.createLinearGradient(cx - rOuter * 0.8, cy, cx + rOuter * 0.8, cy);
      ribbonGrd.addColorStop(0, `rgba(70, 200, 255, ${ribbon.alpha * 0.85 * chromaticAberration})`);
      ribbonGrd.addColorStop(0.35, `rgba(255, 240, 200, ${ribbon.alpha * 0.95})`);
      ribbonGrd.addColorStop(0.68, `rgba(255, 160, 45, ${ribbon.alpha * 0.75})`);
      ribbonGrd.addColorStop(1, `rgba(220, 60, 20, ${ribbon.alpha * 0.35})`);

      g.fillStyle = ribbonGrd;
      g.fill();
    }
    g.restore();

    // 6. 64 根多维连续平滑空间曲率超弦（Harmonic Continuous Superstring Strands - 0 粒子）
    const activeFilamentCount = Math.min(
      Math.max(24, Math.floor(stardustDensity)),
      state.filaments.length
    );
    const waveAmp = (6 + bass * 22) * singularityMass;
    const vertAmp = (8 + treble * 26) * singularityMass;
    const speedMult = (1 + energy * 2.0 + bass * 1.5) * superstringTension;

    g.save();
    g.globalCompositeOperation = "screen";

    for (let fIdx = 0; fIdx < activeFilamentCount; fIdx++) {
      const filament = state.filaments[fIdx];
      filament.baseAngle += filament.rotationSpeed * speedMult;

      const curveSteps = 32;
      const points: { x: number; y: number; scale: number; alpha: number }[] = [];

      for (let s = 0; s <= curveSteps; s++) {
        const progress = s / curveSteps;
        const curRadius = (filament.innerRadius + progress * filament.length) * singularityMass;

        // 对数螺旋角 + 谐波高阶振动
        const spiralAngle =
          filament.baseAngle +
          Math.log(curRadius * 0.04 + 1) * filament.spiralTightness +
          Math.sin(progress * filament.frequency * Math.PI * 2 + t * 3 + filament.phase) *
            (waveAmp / Math.max(30, curRadius));

        const pxRaw = Math.cos(spiralAngle) * curRadius;
        const pyRaw =
          Math.sin(progress * Math.PI * 3 + t * 2.5 + filament.phase) *
          vertAmp *
          (1 - progress * 0.3);
        const pzRaw = Math.sin(spiralAngle) * curRadius;

        const rx = pxRaw * cosR - pzRaw * sinR;
        const rz = pxRaw * sinR + pzRaw * cosR;
        const ry = pyRaw * cosP - rz * sinP;
        const finalZ = pyRaw * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        const screenX = cx + rx * scale;
        const screenY = cy + ry * scale;

        // 视界边缘极亮，外缘淡化
        const alpha =
          filament.alpha * (1 - progress * 0.55) * scale * (0.7 + mid * 0.6) * chromaticAberration;

        points.push({ x: screenX, y: screenY, scale, alpha });
      }

      if (points.length < 3) continue;

      // 绘制平滑连续超弦贝塞尔曲线
      g.beginPath();
      g.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        g.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      g.lineTo(points[points.length - 1].x, points[points.length - 1].y);

      // 配色：迎面侧（左侧 rx < 0）偏冷白金/青蓝，背向侧（右侧）偏琥珀炽金
      const startPt = points[0];
      const endPt = points[points.length - 1];
      const strokeGrd = g.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);

      if (filament.colorType === 0) {
        // 铂金电光蓝白
        strokeGrd.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        strokeGrd.addColorStop(0.3, "rgba(100, 220, 255, 0.85)");
        strokeGrd.addColorStop(0.7, "rgba(60, 140, 240, 0.45)");
        strokeGrd.addColorStop(1, "rgba(40, 80, 200, 0)");
      } else if (filament.colorType === 1) {
        // 炽热琥珀金
        strokeGrd.addColorStop(0, "rgba(255, 250, 220, 0.95)");
        strokeGrd.addColorStop(0.35, "rgba(255, 190, 70, 0.85)");
        strokeGrd.addColorStop(0.75, "rgba(230, 95, 30, 0.4)");
        strokeGrd.addColorStop(1, "rgba(160, 40, 10, 0)");
      } else if (filament.colorType === 2) {
        // 极光金青
        strokeGrd.addColorStop(0, "rgba(255, 255, 255, 0.9)");
        strokeGrd.addColorStop(0.4, "rgba(120, 240, 220, 0.75)");
        strokeGrd.addColorStop(0.8, "rgba(80, 160, 220, 0.35)");
        strokeGrd.addColorStop(1, "rgba(30, 60, 160, 0)");
      } else {
        // 深空赤金
        strokeGrd.addColorStop(0, "rgba(255, 235, 180, 0.9)");
        strokeGrd.addColorStop(0.35, "rgba(255, 140, 45, 0.75)");
        strokeGrd.addColorStop(0.75, "rgba(190, 50, 80, 0.35)");
        strokeGrd.addColorStop(1, "rgba(120, 20, 60, 0)");
      }

      g.strokeStyle = strokeGrd;
      g.lineWidth = Math.max(0.8, filament.lineWidth * (1 + bass * 0.6));
      g.stroke();
    }

    g.restore();

    // 7. 黑洞事件视界（Schwarzschild Event Horizon Void）与光子球发光薄环（Photon Sphere Rim）
    const horizonRadius = (36 + bass * 16) * singularityMass;

    // (7.1) 光子球外晕大氛围光
    if (state.coreHaloSprite) {
      g.save();
      g.globalCompositeOperation = "screen";
      const haloDiameter = horizonRadius * 4.2 * coreGlow;
      g.globalAlpha = Math.min(1.0, 0.8 + bass * 0.2);
      g.drawImage(
        state.coreHaloSprite,
        cx - haloDiameter / 2,
        cy - haloDiameter / 2,
        haloDiameter,
        haloDiameter
      );
      g.restore();
    }

    // (7.2) 纯粹深邃黑洞暗核（Schwarzschild Event Horizon）
    g.save();
    const voidGrd = g.createRadialGradient(cx, cy, 0, cx, cy, horizonRadius);
    voidGrd.addColorStop(0, "rgba(0, 0, 0, 1.0)");
    voidGrd.addColorStop(0.82, "rgba(1, 2, 4, 1.0)");
    voidGrd.addColorStop(0.96, "rgba(15, 10, 8, 0.85)");
    voidGrd.addColorStop(1, "rgba(255, 210, 120, 0)");

    g.fillStyle = voidGrd;
    g.beginPath();
    g.arc(cx, cy, horizonRadius, 0, Math.PI * 2);
    g.fill();

    // (7.3) 极细高光光子环切线（Photon Sphere Ring）
    g.strokeStyle = "rgba(255, 250, 240, 0.98)";
    g.lineWidth = 1.8 + bass * 1.8;
    g.shadowColor = "#FFC870";
    g.shadowBlur = 20 * coreGlow;
    g.beginPath();
    g.arc(cx, cy, horizonRadius * 0.97, 0, Math.PI * 2);
    g.stroke();

    // 次级极光光子蓝光微晕
    g.strokeStyle = "rgba(100, 210, 255, 0.65)";
    g.lineWidth = 1.0;
    g.shadowColor = "#40B4FF";
    g.shadowBlur = 12 * coreGlow;
    g.beginPath();
    g.arc(cx, cy, horizonRadius * 1.02, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // 8. 电影级变形宽银幕横向拉丝光晕（Anamorphic Horizontal Lens Flare）
    if (state.anamorphicFlareSprite) {
      g.save();
      g.globalCompositeOperation = "screen";
      const flareWidth = Math.min(sw * 1.25, (640 + bass * 320 + energy * 220) * coreGlow);
      const flareHeight = (30 + bass * 26) * coreGlow;
      g.globalAlpha = Math.min(1.0, (0.65 + bass * 0.35) * chromaticAberration);
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
