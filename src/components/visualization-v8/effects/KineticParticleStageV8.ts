/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as THREE from "three";
import { EffectPlugin, RenderContext, AudioData, EffectParameterMap } from "@/lib/visualization/types";
import { useAudioStore } from "@/store/audioStore";

interface DissolveParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
  life: number;
}

function renderCanvas2D(
  ctx: RenderContext,
  audioData: AudioData,
  params: EffectParameterMap,
  displayLyric: string,
  priv: any
) {
  const c = ctx.ctx!;
  const w = ctx.width;
  const h = ctx.height;
  const time = priv.time;

  const bass = (audioData.bass || 0) * (params.bassImpact || 1.5);
  const pulse = priv.pulseEnergy;

  // 1. 深邃暗场背景与暗角微光
  c.save();
  c.fillStyle = "#07030e";
  c.fillRect(0, 0, w, h);

  const radialGrad = c.createRadialGradient(w * 0.4, h * 0.5, 40, w * 0.4, h * 0.5, w * 0.85);
  if (params.colorTheme === "emerald-gold") {
    radialGrad.addColorStop(0, "rgba(5, 46, 22, 0.4)");
    radialGrad.addColorStop(1, "rgba(2, 6, 23, 0.95)");
  } else if (params.colorTheme === "cyberpunk") {
    radialGrad.addColorStop(0, "rgba(76, 5, 55, 0.4)");
    radialGrad.addColorStop(1, "rgba(5, 5, 20, 0.95)");
  } else {
    radialGrad.addColorStop(0, "rgba(49, 10, 84, 0.45)");
    radialGrad.addColorStop(1, "rgba(7, 3, 14, 0.98)");
  }
  c.fillStyle = radialGrad;
  c.fillRect(0, 0, w, h);

  // 2. 绘制 2.5D 透视粒子地形流场网格
  const cols = 88;
  const rows = 34;
  const fov = 400;
  const originX = w * 0.38;
  const originY = h * 0.58;
  const waveAmp = (params.waveHeight || 100) * (1 + bass * 0.7 + pulse * 0.4);

  for (let r = 0; r < rows; r++) {
    const zProgress = r / rows;
    const depthZ = 280 + (1 - zProgress) * 720;
    const scale = fov / depthZ;
    const rowAlpha = Math.sin(zProgress * Math.PI) * 0.9 + 0.1;

    for (let col = 0; col < cols; col++) {
      const xProgress = (col / (cols - 1) - 0.5) * 2;
      const worldX = xProgress * 1050;

      const dist = Math.sqrt(xProgress * xProgress + zProgress * zProgress);
      const wave1 = Math.sin(xProgress * 4.0 + time * 2.0 + dist * 3.0);
      const wave2 = Math.cos(zProgress * 5.5 - time * 1.4);
      const wave3 = Math.sin(dist * 7.5 - time * 2.8) * (bass * 0.5);
      const worldY = (wave1 * 0.5 + wave2 * 0.35 + wave3 * 0.15) * waveAmp;

      const screenX = originX + worldX * scale;
      const screenY = originY + (worldY + (r - rows * 0.5) * 22) * scale;
      const ptSize = Math.max(1.0, (1.8 - zProgress * 0.8) * scale * 2.0);

      const colorFactor = Math.min(1, Math.max(0, (xProgress + 1) * 0.5 + Math.sin(time + dist) * 0.2));
      let rVal = 168;
      let gVal = 85;
      let bVal = 247;

      if (params.colorTheme === "emerald-gold") {
        rVal = Math.floor(16 + colorFactor * 220);
        gVal = Math.floor(185 + colorFactor * 40);
        bVal = Math.floor(129 - colorFactor * 80);
      } else if (params.colorTheme === "cyberpunk") {
        rVal = Math.floor(236 - colorFactor * 100);
        gVal = Math.floor(72 + colorFactor * 120);
        bVal = Math.floor(153 + colorFactor * 90);
      } else {
        rVal = Math.floor(168 - colorFactor * 150);
        gVal = Math.floor(85 + colorFactor * 150);
        bVal = Math.floor(247 + colorFactor * 8);
      }

      const pointAlpha = Math.min(1.0, rowAlpha * (0.5 + bass * 0.5));
      c.fillStyle = "rgba(" + rVal + ", " + gVal + ", " + bVal + ", " + pointAlpha + ")";
      c.beginPath();
      c.arc(screenX, screenY, ptSize, 0, Math.PI * 2);
      c.fill();
    }
  }

  // 3. 绘制空间发光动感实体歌词 (3D 倾斜排版)
  c.save();
  const lyricCenterX = w * 0.44;
  const lyricCenterY = h * 0.42;
  const glowMult = params.lyricGlow || 1.8;

  c.translate(lyricCenterX, lyricCenterY);
  c.transform(1, -0.14, 0.2, 1, 0, 0);

  const fontSize = Math.max(26, Math.min(60, Math.floor(w * 0.04)));
  c.font = "800 " + fontSize + "px 'Cinzel Decorative', 'PingFang SC', 'Segoe UI', -apple-system, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";

  // 外发光层
  c.shadowColor = params.colorTheme === "emerald-gold" ? "#10B981" : "#00F5FF";
  c.shadowBlur = 22 * glowMult;
  c.fillStyle = "rgba(0, 245, 255, 0.4)";
  c.fillText(displayLyric, 0, 0);

  c.shadowColor = "#A855F7";
  c.shadowBlur = 10 * glowMult;
  c.fillStyle = "rgba(255, 255, 255, 0.95)";
  c.fillText(displayLyric, 0, 0);

  // 文字核心实体
  c.shadowBlur = 0;
  const textGrad = c.createLinearGradient(-w * 0.25, 0, w * 0.25, 0);
  textGrad.addColorStop(0, "#FFFFFF");
  textGrad.addColorStop(0.5, "#E0F2FE");
  textGrad.addColorStop(1, "#F3E8FF");
  c.fillStyle = textGrad;
  c.fillText(displayLyric, 0, 0);
  c.restore();

  // 4. 文字消散粒子系统
  if (priv.dissolveParticles.length > 0) {
    for (let i = priv.dissolveParticles.length - 1; i >= 0; i--) {
      const p = priv.dissolveParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.016 * 1.2;

      if (p.alpha <= 0) {
        priv.dissolveParticles.splice(i, 1);
        continue;
      }

      c.save();
      c.fillStyle = p.color;
      c.globalAlpha = Math.max(0, p.alpha);
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  c.restore();
}

export const KineticParticleStageV8Effect: EffectPlugin = {
  id: "kinetic-particle-stage",
  name: "暗场粒子歌词舞台",
  category: "particles",
  description: "3D粒子波浪地形与空间动感发光歌词舞台",
  preferredEngine: "auto",

  parameters: [
    {
      id: "colorTheme",
      name: "配色方案",
      type: "select",
      mode: "basic",
      default: "purple-cyan",
      options: [
        { label: "霓虹紫青 (经典)", value: "purple-cyan" },
        { label: "赛博朋克 (洋红蓝)", value: "cyberpunk" },
        { label: "翡翠流金 (高雅)", value: "emerald-gold" },
        { label: "深空冰蓝 (清冷)", value: "deep-space" },
      ],
    },
    {
      id: "particleDensity",
      name: "粒子密度",
      type: "number",
      mode: "basic",
      min: 4000,
      max: 16384,
      step: 1024,
      default: 8192,
    },
    {
      id: "waveHeight",
      name: "波浪振幅",
      type: "number",
      mode: "basic",
      min: 20,
      max: 250,
      step: 10,
      default: 100,
    },
    {
      id: "waveSpeed",
      name: "流动速度",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 3.0,
      step: 0.1,
      default: 1.0,
    },
    {
      id: "bassImpact",
      name: "低音冲击",
      type: "number",
      mode: "professional",
      min: 0.5,
      max: 3.0,
      step: 0.1,
      default: 1.5,
    },
    {
      id: "lyricGlow",
      name: "歌词发光强度",
      type: "number",
      mode: "professional",
      min: 0.5,
      max: 3.0,
      step: 0.1,
      default: 1.8,
    },
    {
      id: "cameraPitch",
      name: "镜头俯仰角",
      type: "number",
      mode: "expert",
      min: -30,
      max: 60,
      step: 2,
      default: 25,
    },
    {
      id: "dissolveIntensity",
      name: "文字消散粒子",
      type: "number",
      mode: "expert",
      min: 0,
      max: 2.0,
      step: 0.1,
      default: 1.0,
    },
  ],

  private: {
    time: 0,
    threeScene: null as THREE.Group | null,
    pointsMesh: null as THREE.Points | null,
    lastLyricText: "",
    dissolveParticles: [] as DissolveParticle[],
    pulseEnergy: 0,
  },

  init(ctx: RenderContext) {
    const priv = (this as any).private;
    priv.time = 0;
    priv.pulseEnergy = 0;
    priv.dissolveParticles = [];
    priv.lastLyricText = "";

    if (ctx.scene) {
      if (priv.threeScene) {
        ctx.scene.remove(priv.threeScene);
      }
      priv.threeScene = new THREE.Group();
      ctx.scene.add(priv.threeScene);
    }
  },

  render(ctx: RenderContext, audioData: AudioData, params: EffectParameterMap) {
    const priv = (this as any).private;
    const dt = ctx.deltaTime || 0.016;
    priv.time += dt * (params.waveSpeed || 1.0);

    const bass = audioData.bass || 0;
    const isBeat = audioData.isBeat || false;
    const isDownbeat = audioData.isDownbeat || false;
    const beatImpact = audioData.beatImpact || 0;

    // 强拍与瞬态冲击能量平滑衰减
    if (isDownbeat) {
      priv.pulseEnergy = Math.min(2.5, priv.pulseEnergy + 0.9 * (params.bassImpact || 1.5));
    } else if (isBeat || beatImpact > 0.6 || bass > 0.6) {
      priv.pulseEnergy = Math.min(2.0, priv.pulseEnergy + 0.45 * (params.bassImpact || 1.5));
    } else {
      priv.pulseEnergy = Math.max(0, priv.pulseEnergy - dt * 2.5);
    }

    // 获取当前播放歌曲与歌词
    const audioState = useAudioStore.getState();
    const currentSong = audioState.currentSong;
    const title = currentSong?.title || "MIMI Music Player";
    const artist = currentSong?.artist || "Vibe Studio";
    const displayLyric = title + " - " + artist;

    // 检查文字更新并触发粒子消散特效
    if (displayLyric !== priv.lastLyricText && priv.lastLyricText !== "") {
      const dissolveCount = Math.floor(50 * (params.dissolveIntensity || 1.0));
      for (let i = 0; i < dissolveCount; i++) {
        priv.dissolveParticles.push({
          x: ctx.width * 0.45 + (Math.random() - 0.5) * 300,
          y: ctx.height * 0.42 + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 6 + 1.5,
          vy: (Math.random() - 0.5) * 5 - 1.5,
          alpha: 1.0,
          size: Math.random() * 3.5 + 1.2,
          color: Math.random() > 0.5 ? "#00F5FF" : "#A855F7",
          life: Math.random() * 0.8 + 0.4,
        });
      }
    }
    priv.lastLyricText = displayLyric;

    // 渲染通用 2.5D 高保真画布与空间发光文字
    if (ctx.ctx && ctx.canvas) {
      renderCanvas2D(ctx, audioData, params, displayLyric, priv);
    }
  },

  resize(_width: number, _height: number) {
    const priv = (this as any).private;
    priv.dissolveParticles = [];
  },

  destroy(ctx?: RenderContext) {
    const priv = (this as any).private;
    if (priv.threeScene && ctx?.scene) {
      ctx.scene.remove(priv.threeScene);
      priv.threeScene = null;
    }
    if (priv.pointsMesh && ctx?.scene) {
      ctx.scene.remove(priv.pointsMesh);
      priv.pointsMesh.geometry.dispose();
      (priv.pointsMesh.material as THREE.Material).dispose();
      priv.pointsMesh = null;
    }
    priv.dissolveParticles = [];
  },
};
