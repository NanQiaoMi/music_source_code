/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface VortexParticle {
  radius: number;
  baseRadius: number;
  angle: number;
  speed: number;
  height: number;
  size: number;
  alpha: number;
  arm: number;
  twinkleSpeed: number;
  twinklePhase: number;
  isBrightStar: boolean;
  colorType: number; // 0: amber gold, 1: platinum white, 2: relativistic cyan
}

interface NebulaCloud {
  angle: number;
  radius: number;
  size: number;
  speed: number;
  alpha: number;
  hueOffset: number;
}

interface ShockwaveRing {
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  width: number;
}

interface SuperstringState {
  particles: VortexParticle[];
  nebulae: NebulaCloud[];
  shockwaves: ShockwaveRing[];
  smoothedBass: number;
  smoothedMid: number;
  smoothedTreble: number;
  smoothedEnergy: number;
  rotationAngle: number;
  lastBassTriggerTime: number;
  gasSpriteAmber: HTMLCanvasElement | null;
  gasSpriteCyan: HTMLCanvasElement | null;
  anamorphicFlareSprite: HTMLCanvasElement | null;
  photonRingSprite: HTMLCanvasElement | null;
  starSprite: HTMLCanvasElement | null;
}

/**
 * Creates an offscreen sprite canvas with a soft radial glow
 */
function createRadialGlowSprite(size: number, colorStops: [number, string][]): HTMLCanvasElement | null {
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
 * Creates an offscreen anamorphic horizontal streak flare sprite (Cinematic Widescreen Flare)
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

    // Horizontal linear gradient
    const hGrd = ctx.createLinearGradient(0, cy, width, cy);
    hGrd.addColorStop(0, "rgba(64, 210, 255, 0)");
    hGrd.addColorStop(0.25, "rgba(255, 185, 95, 0.25)");
    hGrd.addColorStop(0.48, "rgba(255, 245, 230, 0.95)");
    hGrd.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
    hGrd.addColorStop(0.52, "rgba(255, 245, 230, 0.95)");
    hGrd.addColorStop(0.75, "rgba(255, 185, 95, 0.25)");
    hGrd.addColorStop(1, "rgba(64, 210, 255, 0)");

    // Vertical linear fade
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
  description: "电影级卡冈图雅黑洞吸积盘模拟光效：引力透镜双光弧、多普勒相对论光谱与 4,600+ 开普勒对数星尘流场共振",
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
      name: "旋涡旋转速度",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.2,
    },
    {
      id: "stardustDensity",
      name: "星尘粒子密度",
      type: "number",
      mode: "professional",
      min: 1000,
      max: 8000,
      step: 500,
      default: 4600,
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
    const particleCount = 4600;
    const particles: VortexParticle[] = [];
    const arms = 4;

    for (let i = 0; i < particleCount; i++) {
      const arm = i % arms;
      const armAngle = (arm / arms) * Math.PI * 2;
      const distFrac = 0.04 + 0.96 * Math.pow(Math.random(), 1.18);
      const radius = 28 + distFrac * 860;

      const spiralAngle = armAngle + Math.log(radius * 0.05 + 1) * 2.8 + (Math.random() - 0.5) * 0.45;
      const orbitSpeed = (0.007 + (1 / Math.sqrt(radius)) * 0.22) * 0.75;
      const diskThickness = 8 + (radius / 860) * 52;
      const height = (Math.random() - 0.5) * diskThickness;
      const isBrightStar = Math.random() < 0.14;

      // 0: 琥珀金 (50%), 1: 白金 (35%), 2: 相对论青蓝 (15%)
      const randColor = Math.random();
      const colorType = randColor < 0.5 ? 0 : randColor < 0.85 ? 1 : 2;

      particles.push({
        radius,
        baseRadius: radius,
        angle: spiralAngle,
        speed: orbitSpeed,
        height,
        size: isBrightStar ? 1.8 + Math.random() * 2.6 : 0.8 + Math.random() * 1.6,
        alpha: isBrightStar ? 0.85 + Math.random() * 0.15 : 0.4 + Math.random() * 0.55,
        arm,
        twinkleSpeed: 1.8 + Math.random() * 4.5,
        twinklePhase: Math.random() * Math.PI * 2,
        isBrightStar,
        colorType,
      });
    }

    const nebulae: NebulaCloud[] = [];
    for (let i = 0; i < 36; i++) {
      const arm = i % 4;
      const armAngle = (arm / 4) * Math.PI * 2;
      const distFrac = 0.08 + (i / 36) * 0.88;
      const radius = 55 + distFrac * 740;
      const spiralAngle = armAngle + Math.log(radius * 0.05 + 1) * 2.8;

      nebulae.push({
        angle: spiralAngle,
        radius,
        size: 95 + Math.random() * 155,
        speed: (0.005 + (1 / Math.sqrt(radius)) * 0.15) * 0.75,
        alpha: 0.048 + Math.random() * 0.048,
        hueOffset: Math.random() * 0.3,
      });
    }

    // 预烘焙高性能离屏精灵（0 GC 垃圾回收，60/120FPS 极速渲染）
    const gasSpriteAmber = createRadialGlowSprite(140, [
      [0, "rgba(255, 235, 200, 1.0)"],
      [0.2, "rgba(255, 175, 75, 0.75)"],
      [0.5, "rgba(220, 100, 30, 0.32)"],
      [0.8, "rgba(160, 45, 10, 0.08)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);

    const gasSpriteCyan = createRadialGlowSprite(140, [
      [0, "rgba(235, 250, 255, 1.0)"],
      [0.25, "rgba(80, 215, 255, 0.65)"],
      [0.55, "rgba(45, 120, 240, 0.28)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);

    const anamorphicFlareSprite = createAnamorphicFlareSprite(640, 48);

    const photonRingSprite = createRadialGlowSprite(160, [
      [0, "rgba(255, 255, 255, 1.0)"],
      [0.2, "rgba(255, 220, 160, 0.85)"],
      [0.5, "rgba(255, 140, 40, 0.35)"],
      [0.85, "rgba(80, 180, 255, 0.08)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);

    const starSprite = createRadialGlowSprite(64, [
      [0, "rgba(255, 255, 255, 1.0)"],
      [0.25, "rgba(255, 240, 210, 0.75)"],
      [0.6, "rgba(180, 225, 255, 0.25)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]);

    const state: SuperstringState = {
      particles,
      nebulae,
      shockwaves: [],
      smoothedBass: 0,
      smoothedMid: 0,
      smoothedTreble: 0,
      smoothedEnergy: 0,
      rotationAngle: 0,
      lastBassTriggerTime: 0,
      gasSpriteAmber,
      gasSpriteCyan,
      anamorphicFlareSprite,
      photonRingSprite,
      starSprite,
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
      stardustDensity = 4600,
      chromaticAberration = 1.35,
      burstSensitivity = 1.1,
      coreGlow = 1.5,
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

    // 低频重击检测，触发引力波冲击环
    const nowMs = Date.now();
    if (rawBass > 0.65 && rawBass - state.smoothedBass > 0.25 * burstSensitivity && nowMs - state.lastBassTriggerTime > 320) {
      state.lastBassTriggerTime = nowMs;
      state.shockwaves.push({
        radius: 35 * singularityMass,
        maxRadius: Math.max(sw, sh) * 0.62,
        alpha: 0.85,
        speed: 12 + bass * 18,
        width: 2.2 + bass * 2.5,
      });
    }

    // 1. 深邃暗黑深空背景与引力透镜空间雾化 (Cinematic Cosmic Void)
    g.save();
    g.fillStyle = "#010204";
    g.fillRect(0, 0, sw, sh);

    g.globalCompositeOperation = "screen";
    const bgGrd = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(sw, sh) * 0.72);
    // 相对论暖光与冷光混合底色
    bgGrd.addColorStop(0, `rgba(255, 175, 70, ${(0.05 + bass * 0.08) * chromaticAberration})`);
    bgGrd.addColorStop(0.32, `rgba(180, 85, 30, ${0.03 + mid * 0.04})`);
    bgGrd.addColorStop(0.65, `rgba(45, 110, 185, ${0.015 + treble * 0.025})`);
    bgGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = bgGrd;
    g.fillRect(0, 0, sw, sh);
    g.restore();

    // 2. 3D 相机视角与开普勒对数自转动力学
    const fov = 620;
    const pitch = 0.68 + Math.sin(t * 0.15) * 0.025; // 约 39° 倾角，展现黑洞吸积盘立体层次
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    state.rotationAngle += (0.0035 + energy * 0.01) * superstringTension;
    const cosR = Math.cos(state.rotationAngle);
    const sinR = Math.sin(state.rotationAngle);

    // 3. 引力波冲击环（Gravitational Shockwave Rings）
    if (state.shockwaves.length > 0) {
      g.save();
      g.globalCompositeOperation = "screen";
      for (let i = state.shockwaves.length - 1; i >= 0; i--) {
        const swItem = state.shockwaves[i];
        swItem.radius += swItem.speed;
        swItem.alpha *= 0.94;

        if (swItem.alpha < 0.01 || swItem.radius > swItem.maxRadius) {
          state.shockwaves.splice(i, 1);
          continue;
        }

        g.strokeStyle = `rgba(255, 215, 140, ${swItem.alpha * 0.65})`;
        g.lineWidth = swItem.width;
        g.beginPath();
        // 沿吸积盘倾角压扁椭圆展开
        g.ellipse(cx, cy, swItem.radius, swItem.radius * cosP, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }

    // 4. 爱因斯坦引力透镜上下双光拱（Upper & Lower Gravitational Lensing Arcs）
    // 背面吸积盘光线由于黑洞引力场向上和向下弯曲，在黑洞视界上下方形成标志性光弧
    const lensingRadius = (72 + bass * 22) * singularityMass;
    const lensingHeight = lensingRadius * 0.85;

    g.save();
    g.globalCompositeOperation = "screen";

    // (4.1) 上部弯曲引力透镜主光拱 (Upper Lensing Halo)
    const upperGrd = g.createRadialGradient(cx, cy - lensingHeight * 0.35, lensingRadius * 0.35, cx, cy - lensingHeight * 0.35, lensingRadius * 1.55);
    upperGrd.addColorStop(0, `rgba(255, 245, 220, ${(0.85 + bass * 0.15) * chromaticAberration})`);
    upperGrd.addColorStop(0.35, `rgba(255, 160, 50, ${0.55 + mid * 0.3})`);
    upperGrd.addColorStop(0.75, "rgba(180, 60, 20, 0.15)");
    upperGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = upperGrd;
    g.beginPath();
    g.ellipse(cx, cy - lensingHeight * 0.42, lensingRadius * 1.35, lensingHeight * 0.92, 0, Math.PI * 0.92, Math.PI * 2.08);
    g.fill();

    // (4.2) 下部弯曲引力透镜副光拱 (Lower Lensing Halo)
    const lowerGrd = g.createRadialGradient(cx, cy + lensingHeight * 0.35, lensingRadius * 0.35, cx, cy + lensingHeight * 0.35, lensingRadius * 1.4);
    lowerGrd.addColorStop(0, `rgba(255, 235, 190, ${(0.65 + bass * 0.2) * chromaticAberration})`);
    lowerGrd.addColorStop(0.4, `rgba(240, 130, 40, ${0.38 + mid * 0.25})`);
    lowerGrd.addColorStop(0.8, "rgba(140, 45, 15, 0.08)");
    lowerGrd.addColorStop(1, "rgba(0, 0, 0, 0)");

    g.fillStyle = lowerGrd;
    g.beginPath();
    g.ellipse(cx, cy + lensingHeight * 0.38, lensingRadius * 1.25, lensingHeight * 0.75, 0, 0, Math.PI);
    g.fill();

    g.restore();

    // 5. 3D 流体气体云（Volumetric Relativistic Gas Clouds）
    if (state.gasSpriteAmber && state.gasSpriteCyan) {
      g.save();
      g.globalCompositeOperation = "screen";

      for (let i = 0; i < state.nebulae.length; i++) {
        const neb = state.nebulae[i];
        neb.angle += neb.speed * (1 + energy * 1.8 + bass * 1.4);

        const curR = neb.radius * singularityMass * (1 + Math.sin(t * 2 + neb.angle * 2) * 0.05);
        const pxRaw = Math.cos(neb.angle) * curR;
        const pyRaw = Math.sin(t * 1.5 + neb.radius * 0.02) * 16;
        const pzRaw = Math.sin(neb.angle) * curR;

        const rx = pxRaw * cosR - pzRaw * sinR;
        const rz = pxRaw * sinR + pzRaw * cosR;
        const ry = pyRaw * cosP - rz * sinP;
        const finalZ = pyRaw * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        const screenX = cx + rx * scale;
        const screenY = cy + ry * scale;
        const nRadius = neb.size * scale * (1 + bass * 0.35);
        const nDiameter = nRadius * 2;
        const nAlpha = Math.min(0.32, neb.alpha * (0.8 + energy * 0.7) * scale * chromaticAberration);

        // 迎面运动（左侧）倾向青蓝，背向运动（右侧）倾向琥珀金
        const sprite = rx < 0 && Math.random() < 0.4 ? state.gasSpriteCyan : state.gasSpriteAmber;
        g.globalAlpha = nAlpha;
        g.drawImage(sprite, screenX - nRadius, screenY - nRadius, nDiameter, nDiameter);
      }
      g.restore();
    }

    // 6. 4,600+ 开普勒吸积盘对数螺旋星尘流场（Hardware Batched Path Rendering）
    const activeCount = Math.min(stardustDensity, state.particles.length);
    const speedMult = 1 + energy * 2.2 + bass * 1.6;
    const waveAmp = 2.5 + bass * 9;
    const vertAmp = 4.5 + treble * 14;

    g.save();
    g.globalCompositeOperation = "screen";

    // 6.1 批量绘制高速切向光丝（Magnetic Flow Filaments）
    g.beginPath();
    g.strokeStyle = "rgba(255, 220, 160, 0.75)";
    g.lineWidth = 1.25;

    for (let i = 0; i < activeCount; i++) {
      const p = state.particles[i];
      p.angle += p.speed * speedMult;

      const waveDisp = Math.sin(t * 3 + p.angle * 4) * waveAmp;
      const curR = (p.radius + waveDisp) * singularityMass;

      const pxRaw = Math.cos(p.angle) * curR;
      const pyRaw = p.height + Math.sin(t * 2.5 + p.radius * 0.05) * vertAmp;
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
      const streakLength = Math.max(2.2, (200 / Math.max(25, curR)) * (1 + bass * 1.6) * scale * 2.8);
      const streakEndX = screenX + Math.cos(tangentAngle) * streakLength;
      const streakEndY = screenY + Math.sin(tangentAngle) * streakLength * cosP;

      g.moveTo(screenX, screenY);
      g.lineTo(streakEndX, streakEndY);
    }
    g.stroke();

    // 6.2 批量绘制金橙与白金星尘粒子
    g.beginPath();
    g.fillStyle = "rgba(255, 235, 205, 0.92)";
    for (let i = 0; i < activeCount; i++) {
      const p = state.particles[i];
      const waveDisp = Math.sin(t * 3 + p.angle * 4) * waveAmp;
      const curR = (p.radius + waveDisp) * singularityMass;

      const pxRaw = Math.cos(p.angle) * curR;
      const pyRaw = p.height + Math.sin(t * 2.5 + p.radius * 0.05) * vertAmp;
      const pzRaw = Math.sin(p.angle) * curR;

      const rx = pxRaw * cosR - pzRaw * sinR;
      const rz = pxRaw * sinR + pzRaw * cosR;
      const ry = pyRaw * cosP - rz * sinP;
      const finalZ = pyRaw * sinP + rz * cosP + fov;

      if (finalZ <= 10) continue;
      const scale = fov / finalZ;
      const screenX = cx + rx * scale;
      const screenY = cy + ry * scale;
      const pSize = Math.max(0.75, p.size * scale * (1 + treble * 0.85));

      g.moveTo(screenX + pSize, screenY);
      g.arc(screenX, screenY, pSize, 0, Math.PI * 2);
    }
    g.fill();

    // 6.3 亮星与光子耀斑快速贴图
    if (state.starSprite) {
      const starSprite = state.starSprite;
      for (let i = 0; i < activeCount; i += 6) {
        const p = state.particles[i];
        if (!p.isBrightStar) continue;

        const waveDisp = Math.sin(t * 3 + p.angle * 4) * waveAmp;
        const curR = (p.radius + waveDisp) * singularityMass;
        const pxRaw = Math.cos(p.angle) * curR;
        const pyRaw = p.height + Math.sin(t * 2.5 + p.radius * 0.05) * vertAmp;
        const pzRaw = Math.sin(p.angle) * curR;

        const rx = pxRaw * cosR - pzRaw * sinR;
        const rz = pxRaw * sinR + pzRaw * cosR;
        const ry = pyRaw * cosP - rz * sinP;
        const finalZ = pyRaw * sinP + rz * cosP + fov;

        if (finalZ <= 10) continue;
        const scale = fov / finalZ;
        const screenX = cx + rx * scale;
        const screenY = cy + ry * scale;
        const glowSize = Math.max(9, p.size * scale * 6.5);

        g.globalAlpha = 0.55;
        g.drawImage(starSprite, screenX - glowSize / 2, screenY - glowSize / 2, glowSize, glowSize);
      }
    }

    g.restore();

    // 7. 黑洞事件视界（Event Horizon Void）与光子球发光薄环（Photon Sphere Rim）
    const horizonRadius = (32 + bass * 14) * singularityMass;

    // (7.1) 光子球高亮外晕
    if (state.photonRingSprite) {
      g.save();
      g.globalCompositeOperation = "screen";
      const ringDiameter = horizonRadius * 3.6 * coreGlow;
      g.globalAlpha = Math.min(1.0, 0.85 + bass * 0.15);
      g.drawImage(state.photonRingSprite, cx - ringDiameter / 2, cy - ringDiameter / 2, ringDiameter, ringDiameter);
      g.restore();
    }

    // (7.2) 半透明深邃黑洞暗核（Black Void Lens）
    g.save();
    // 渐变暗核：中心深邃接近纯黑，边缘微弱透出空间折射
    const voidGrd = g.createRadialGradient(cx, cy, 0, cx, cy, horizonRadius);
    voidGrd.addColorStop(0, "rgba(2, 3, 6, 0.96)");
    voidGrd.addColorStop(0.75, "rgba(3, 4, 8, 0.90)");
    voidGrd.addColorStop(0.95, "rgba(20, 15, 10, 0.65)");
    voidGrd.addColorStop(1, "rgba(255, 200, 120, 0)");

    g.fillStyle = voidGrd;
    g.beginPath();
    g.arc(cx, cy, horizonRadius, 0, Math.PI * 2);
    g.fill();

    // (7.3) 极细 1.8px 光子环切线（Photon Sphere Ring）
    g.strokeStyle = "rgba(255, 245, 230, 0.95)";
    g.lineWidth = 1.6 + bass * 1.5;
    g.shadowColor = "#FFBA65";
    g.shadowBlur = 16 * coreGlow;
    g.beginPath();
    g.arc(cx, cy, horizonRadius * 0.96, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // 8. 电影变形宽银幕横向拉丝光丝（Anamorphic Horizontal Lens Flare）
    if (state.anamorphicFlareSprite) {
      g.save();
      g.globalCompositeOperation = "screen";
      const flareWidth = Math.min(sw * 1.15, (520 + bass * 260 + energy * 180) * coreGlow);
      const flareHeight = (26 + bass * 22) * coreGlow;
      g.globalAlpha = Math.min(1.0, (0.55 + bass * 0.45) * chromaticAberration);
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
