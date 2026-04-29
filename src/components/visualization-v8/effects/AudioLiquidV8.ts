"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const AudioLiquidV8Effect: EffectPlugin = {
  id: "audio-liquid-v8",
  name: "音频液体",
  category: "particles",
  description: "流体模拟效果，音频驱动波动",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "resolution",
      name: "分辨率",
      type: "number",
      mode: "basic",
      min: 32,
      max: 128,
      step: 8,
      default: 64
    },
    {
      id: "waveHeight",
      name: "波动高度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 100,
      step: 5,
      default: 50
    },
    {
      id: "damping",
      name: "阻尼系数",
      type: "number",
      mode: "basic",
      min: 0.9,
      max: 0.999,
      step: 0.005,
      default: 0.98
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
      name: "配色方案",
      type: "select",
      mode: "basic",
      default: "neon",
      options: [
        { label: "霓虹", value: "neon" },
        { label: "火焰", value: "fire" },
        { label: "海洋", value: "ocean" },
        { label: "熔岩", value: "lava" }
      ]
    },
    {
      id: "lineWidth",
      name: "线条宽度",
      type: "number",
      mode: "professional",
      min: 1,
      max: 10,
      step: 0.5,
      default: 3
    },
    {
      id: "fillMode",
      name: "填充模式",
      type: "select",
      mode: "professional",
      default: "both",
      options: [
        { label: "仅描边", value: "stroke" },
        { label: "仅填充", value: "fill" },
        { label: "描边+填充", value: "both" }
      ]
    },
    {
      id: "waveCount",
      name: "波浪数量",
      type: "number",
      mode: "expert",
      min: 1,
      max: 5,
      step: 1,
      default: 3
    }
  ],
  private: {
    grid: [],
    prevGrid: [],
    time: 0
  },
  init(ctx) {
    (this as any).private.grid = [];
    (this as any).private.prevGrid = [];
    (this as any).private.time = 0;
  },
  render(ctx, audioData, params) {
    if (!ctx.ctx || !ctx.canvas) return;
    
    const canvas = ctx.canvas;
    const context = ctx.ctx;
    const width = canvas.width;
    const height = canvas.height;

    (this as any).private.time += 0.016;

    const bass = audioData.bass || 0;
    const mid = audioData.mid || 0;
    const treble = audioData.treble || 0;
    const avgEnergy = (bass + mid + treble) / 3;
    const audioMultiplier = 1 + avgEnergy * params.audioIntensity;

    const resolution = params.resolution;
    const cellWidth = width / resolution;
    const cellHeight = height / resolution;

    let grid = (this as any).private.grid;
    let prevGrid = (this as any).private.prevGrid;

    if (grid.length !== resolution || grid[0]?.length !== resolution) {
      grid = [];
      prevGrid = [];
      for (let i = 0; i < resolution; i++) {
        grid[i] = [];
        prevGrid[i] = [];
        for (let j = 0; j < resolution; j++) {
          grid[i][j] = 0;
          prevGrid[i][j] = 0;
        }
      }
      (this as any).private.grid = grid;
      (this as any).private.prevGrid = prevGrid;
    }

    if (bass > 0.3) {
      const centerX = Math.floor(resolution / 2);
      const centerY = Math.floor(resolution / 2);
      const force = bass * params.waveHeight * audioMultiplier;
      
      for (let wave = 0; wave < params.waveCount; wave++) {
        const angle = (wave / params.waveCount) * Math.PI * 2 + (this as any).private.time;
        const dx = Math.floor(Math.cos(angle) * resolution * 0.3);
        const dy = Math.floor(Math.sin(angle) * resolution * 0.3);
        
        if (centerX + dx >= 0 && centerX + dx < resolution && 
            centerY + dy >= 0 && centerY + dy < resolution) {
          grid[centerX + dx][centerY + dy] = force;
        }
      }
    }

    const newGrid: number[][] = [];
    for (let i = 0; i < resolution; i++) {
      newGrid[i] = [];
      for (let j = 0; j < resolution; j++) {
        let avg = 0;
        let count = 0;
        
        if (i > 0) { avg += grid[i - 1][j]; count++; }
        if (i < resolution - 1) { avg += grid[i + 1][j]; count++; }
        if (j > 0) { avg += grid[i][j - 1]; count++; }
        if (j < resolution - 1) { avg += grid[i][j + 1]; count++; }
        
        avg /= count;
        
        newGrid[i][j] = (avg * 2 - prevGrid[i][j]) * params.damping;
      }
    }

    (this as any).private.prevGrid = grid;
    (this as any).private.grid = newGrid;

    context.fillStyle = "black";
    context.fillRect(0, 0, width, height);

    context.lineWidth = params.lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";

    for (let i = 0; i < resolution - 1; i++) {
      for (let j = 0; j < resolution - 1; j++) {
        const x = i * cellWidth;
        const y = j * cellHeight;
        
        const h1 = newGrid[i][j];
        const h2 = newGrid[i + 1][j];
        const h3 = newGrid[i + 1][j + 1];
        const h4 = newGrid[i][j + 1];
        
        const avgH = (h1 + h2 + h3 + h4) / 4;
        const hue = getLiquidColor(params.colorScheme, avgH, params.waveHeight, (this as any).private.time);
        
        context.beginPath();
        context.moveTo(x + h1 * 0.1, y + h1 * 0.1);
        context.lineTo(x + cellWidth + h2 * 0.1, y + h2 * 0.1);
        context.lineTo(x + cellWidth + h3 * 0.1, y + cellHeight + h3 * 0.1);
        context.lineTo(x + h4 * 0.1, y + cellHeight + h4 * 0.1);
        context.closePath();
        
        const brightness = 50 + Math.abs(avgH) * 0.5;
        const color = `hsl(${hue}, 80%, ${brightness}%)`;
        
        context.strokeStyle = color;
        context.fillStyle = color;
        context.globalAlpha = 0.3 + Math.abs(avgH) * 0.005;
        
        if (params.fillMode === "fill" || params.fillMode === "both") {
          context.fill();
        }
        if (params.fillMode === "stroke" || params.fillMode === "both") {
          context.stroke();
        }
      }
    }

    context.globalAlpha = 1;
  },
  resize() {
    (this as any).private.grid = [];
    (this as any).private.prevGrid = [];
  },
  destroy() {}
};

function getLiquidColor(scheme: string, height: number, maxHeight: number, time: number): number {
  const normalized = Math.abs(height) / maxHeight;
  
  switch (scheme) {
    case "neon":
      return (normalized * 300 + time * 50) % 360;
    case "fire":
      return 20 + normalized * 30;
    case "ocean":
      return 180 + normalized * 60;
    case "lava":
      return normalized < 0.3 ? 40 : normalized < 0.6 ? 20 : 0;
    default:
      return (normalized * 300 + time * 50) % 360;
  }
}
