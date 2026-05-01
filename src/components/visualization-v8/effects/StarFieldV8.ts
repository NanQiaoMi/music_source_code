"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const StarFieldV8Effect: EffectPlugin = {
  id: "star-field-v8",
  name: "星场穿越",
  category: "space",
  description: "3D星场穿越效果，音频驱动速度",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "starCount",
      name: "星星数量",
      type: "number",
      mode: "basic",
      min: 500,
      max: 5000,
      step: 100,
      default: 2000
    },
    {
      id: "speed",
      name: "飞行速度",
      type: "number",
      mode: "basic",
      min: 0.1,
      max: 5,
      step: 0.1,
      default: 2
    },
    {
      id: "starSize",
      name: "星星大小",
      type: "number",
      mode: "basic",
      min: 1,
      max: 10,
      step: 0.5,
      default: 3
    },
    {
      id: "fieldOfView",
      name: "视野角度",
      type: "number",
      mode: "professional",
      min: 60,
      max: 120,
      step: 5,
      default: 90
    },
    {
      id: "audioIntensity",
      name: "音频强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 3,
      step: 0.1,
      default: 1
    },
    {
      id: "colorScheme",
      name: "星星颜色",
      type: "select",
      mode: "basic",
      default: "white",
      options: [
        { label: "白色", value: "white" },
        { label: "彩色", value: "colorful" },
        { label: "蓝色", value: "blue" },
        { label: "红色", value: "red" }
      ]
    },
    {
      id: "trailLength",
      name: "轨迹长度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 5,
      step: 0.5,
      default: 0
    },
    {
      id: "warpEffect",
      name: "扭曲效果",
      type: "number",
      mode: "expert",
      min: 0,
      max: 2,
      step: 0.1,
      default: 0
    }
  ],
  private: {
    stars: [],
    time: 0
  },
  init(ctx) {
    (this as any).private.stars = [];
    (this as any).private.time = 0;
  },
  render(ctx, audioData, params) {
    if (!ctx.ctx || !ctx.canvas) return;
    
    const canvas = ctx.canvas;
    const context = ctx.ctx;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    (this as any).private.time += 0.016;

    const bass = audioData.bass || 0;
    const mid = audioData.mid || 0;
    const treble = audioData.treble || 0;
    const avgEnergy = (bass + mid + treble) / 3;
    const audioMultiplier = 1 + avgEnergy * params.audioIntensity;

    let stars = (this as any).private.stars;
    
    if (stars.length !== params.starCount) {
      stars = [];
      for (let i = 0; i < params.starCount; i++) {
        stars.push({
          x: (Math.random() - 0.5) * 2000,
          y: (Math.random() - 0.5) * 2000,
          z: Math.random() * 2000 + 100,
          pz: 0
        });
      }
      (this as any).private.stars = stars;
    }

    const fov = params.fieldOfView;
    const speed = params.speed * audioMultiplier * 20;

    context.fillStyle = "black";
    context.fillRect(0, 0, width, height);

    stars.forEach((star: any) => {
      star.pz = star.z;
      star.z -= speed;

      if (star.z < 1) {
        star.x = (Math.random() - 0.5) * 2000;
        star.y = (Math.random() - 0.5) * 2000;
        star.z = 2000;
        star.pz = star.z;
      }

      const warpFactor = 1 + params.warpEffect * avgEnergy;
      const sx = (star.x / star.z) * fov * warpFactor + centerX;
      const sy = (star.y / star.z) * fov * warpFactor + centerY;
      const px = (star.x / star.pz) * fov + centerX;
      const py = (star.y / star.pz) * fov + centerY;

      const size = Math.max(0.5, (1 - star.z / 2000) * params.starSize);
      const brightness = Math.max(0.2, 1 - star.z / 2000);

      let color = "white";
      switch (params.colorScheme) {
        case "colorful":
          const hue = (star.x + star.y + (this as any).private.time * 100) % 360;
          color = `hsl(${hue}, 100%, ${50 + brightness * 30}%)`;
          break;
        case "blue":
          color = `rgb(${Math.floor(100 * brightness)}, ${Math.floor(150 * brightness)}, ${Math.floor(255 * brightness)})`;
          break;
        case "red":
          color = `rgb(${Math.floor(255 * brightness)}, ${Math.floor(100 * brightness)}, ${Math.floor(100 * brightness)})`;
          break;
        default:
          const gray = Math.floor(255 * brightness);
          color = `rgb(${gray}, ${gray}, ${gray})`;
      }

      context.fillStyle = color;
      context.globalAlpha = brightness;

      if (params.trailLength > 0 && star.pz < 2000) {
        context.beginPath();
        context.moveTo(px, py);
        context.lineTo(sx, sy);
        context.strokeStyle = color;
        context.lineWidth = size * params.trailLength;
        context.stroke();
      }

      context.beginPath();
      context.arc(sx, sy, size, 0, Math.PI * 2);
      context.fill();
    });

    context.globalAlpha = 1;
  },
  resize() {
    (this as any).private.stars = [];
  },
  destroy(ctx) {
    if (ctx && ctx.private) {
      ctx.private.stars = [];
      ctx.private.time = 0;
    }
  }
};
