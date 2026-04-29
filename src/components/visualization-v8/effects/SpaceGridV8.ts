"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const SpaceGridV8Effect: EffectPlugin = {
  id: "space-grid-v8",
  name: "3D网格",
  category: "space",
  description: "3D空间网格效果，音频驱动波浪",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "gridSize",
      name: "网格大小",
      type: "number",
      mode: "basic",
      min: 10,
      max: 50,
      step: 5,
      default: 20
    },
    {
      id: "waveHeight",
      name: "波浪高度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 100,
      step: 5,
      default: 50
    },
    {
      id: "waveSpeed",
      name: "波浪速度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 5,
      step: 0.1,
      default: 2
    },
    {
      id: "rotationSpeed",
      name: "旋转速度",
      type: "number",
      mode: "basic",
      min: -1,
      max: 1,
      step: 0.05,
      default: 0.3
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
      id: "color1",
      name: "主颜色",
      type: "color",
      mode: "basic",
      default: "#00ffff"
    },
    {
      id: "color2",
      name: "辅助颜色",
      type: "color",
      mode: "professional",
      default: "#ff00ff"
    },
    {
      id: "lineWidth",
      name: "线条宽度",
      type: "number",
      mode: "professional",
      min: 0.5,
      max: 5,
      step: 0.5,
      default: 1.5
    },
    {
      id: "perspective",
      name: "透视强度",
      type: "number",
      mode: "expert",
      min: 100,
      max: 1000,
      step: 50,
      default: 400
    },
    {
      id: "fillMode",
      name: "填充模式",
      type: "select",
      mode: "expert",
      default: "none",
      options: [
        { label: "不填充", value: "none" },
        { label: "渐变填充", value: "gradient" },
        { label: "纯色填充", value: "solid" }
      ]
    }
  ],
  private: {
    time: 0
  },
  init(ctx) {
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

    const gridSize = params.gridSize;
    const spacing = 400 / gridSize;
    const perspective = params.perspective;

    context.fillStyle = "black";
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(centerX, centerY);
    context.rotate((this as any).private.time * params.rotationSpeed);

    const gradient = context.createLinearGradient(-200, -200, 200, 200);
    gradient.addColorStop(0, params.color1);
    gradient.addColorStop(1, params.color2);

    context.strokeStyle = gradient;
    context.lineWidth = params.lineWidth;
    context.lineCap = "round";

    for (let z = -gridSize / 2; z <= gridSize / 2; z++) {
      context.beginPath();
      let first = true;
      
      for (let x = -gridSize / 2; x <= gridSize / 2; x++) {
        const wavePhase = (this as any).private.time * params.waveSpeed;
        const wave = Math.sin(x * 0.3 + wavePhase) * Math.cos(z * 0.3 + wavePhase * 0.7);
        const y = wave * params.waveHeight * audioMultiplier;
        
        const projected = project3D(x * spacing, y, z * spacing, perspective);
        
        if (first) {
          context.moveTo(projected.x, projected.y);
          first = false;
        } else {
          context.lineTo(projected.x, projected.y);
        }
      }
      context.stroke();
    }

    for (let x = -gridSize / 2; x <= gridSize / 2; x++) {
      context.beginPath();
      let first = true;
      
      for (let z = -gridSize / 2; z <= gridSize / 2; z++) {
        const wavePhase = (this as any).private.time * params.waveSpeed;
        const wave = Math.sin(x * 0.3 + wavePhase) * Math.cos(z * 0.3 + wavePhase * 0.7);
        const y = wave * params.waveHeight * audioMultiplier;
        
        const projected = project3D(x * spacing, y, z * spacing, perspective);
        
        if (first) {
          context.moveTo(projected.x, projected.y);
          first = false;
        } else {
          context.lineTo(projected.x, projected.y);
        }
      }
      context.stroke();
    }

    if (params.fillMode !== "none") {
      context.globalAlpha = 0.2;
      
      for (let z = -gridSize / 2; z < gridSize / 2; z++) {
        for (let x = -gridSize / 2; x < gridSize / 2; x++) {
          const wavePhase = (this as any).private.time * params.waveSpeed;
          
          const y1 = Math.sin(x * 0.3 + wavePhase) * Math.cos(z * 0.3 + wavePhase * 0.7) * params.waveHeight * audioMultiplier;
          const y2 = Math.sin((x + 1) * 0.3 + wavePhase) * Math.cos(z * 0.3 + wavePhase * 0.7) * params.waveHeight * audioMultiplier;
          const y3 = Math.sin((x + 1) * 0.3 + wavePhase) * Math.cos((z + 1) * 0.3 + wavePhase * 0.7) * params.waveHeight * audioMultiplier;
          const y4 = Math.sin(x * 0.3 + wavePhase) * Math.cos((z + 1) * 0.3 + wavePhase * 0.7) * params.waveHeight * audioMultiplier;
          
          const p1 = project3D(x * spacing, y1, z * spacing, perspective);
          const p2 = project3D((x + 1) * spacing, y2, z * spacing, perspective);
          const p3 = project3D((x + 1) * spacing, y3, (z + 1) * spacing, perspective);
          const p4 = project3D(x * spacing, y4, (z + 1) * spacing, perspective);
          
          context.beginPath();
          context.moveTo(p1.x, p1.y);
          context.lineTo(p2.x, p2.y);
          context.lineTo(p3.x, p3.y);
          context.lineTo(p4.x, p4.y);
          context.closePath();
          
          if (params.fillMode === "gradient") {
            const fillGradient = context.createLinearGradient(p1.x, p1.y, p3.x, p3.y);
            fillGradient.addColorStop(0, params.color1);
            fillGradient.addColorStop(1, params.color2);
            context.fillStyle = fillGradient;
          } else {
            const depth = (y1 + y2 + y3 + y4) / 4;
            const hue = 180 + (depth / params.waveHeight) * 60;
            context.fillStyle = `hsl(${hue}, 80%, 50%)`;
          }
          
          context.fill();
        }
      }
    }

    context.restore();
    context.globalAlpha = 1;
  },
  resize() {},
  destroy() {}
};

function project3D(x: number, y: number, z: number, perspective: number) {
  const scale = perspective / (perspective + z + 500);
  return {
    x: x * scale,
    y: y * scale
  };
}
