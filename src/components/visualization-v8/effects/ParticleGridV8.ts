"use client";

import { EffectPlugin } from "@/lib/visualization/types";

interface GridParticle {
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

let particles: GridParticle[] = [];
let gridSizeX = 10;
let gridSizeY = 10;

export const ParticleGridV8Effect: EffectPlugin = {
  id: "particle-grid-v8",
  name: "粒子网格",
  category: "particles",
  description: "动态粒子网格效果",
  preferredEngine: "canvas",
  
  parameters: [
    {
      id: "gridSize",
      name: "网格大小",
      type: "select",
      mode: "basic",
      default: "10x10",
      options: [
        { label: "8x8", value: "8x8" },
        { label: "10x10", value: "10x10" },
        { label: "16x16", value: "16x16" },
        { label: "20x20", value: "20x20" }
      ]
    },
    {
      id: "particleSize",
      name: "粒子大小",
      type: "number",
      mode: "basic",
      min: 2,
      max: 20,
      step: 1,
      default: 6
    },
    {
      id: "connectionDistance",
      name: "连接距离",
      type: "number",
      mode: "professional",
      min: 20,
      max: 200,
      step: 10,
      default: 80
    },
    {
      id: "elasticity",
      name: "弹性",
      type: "number",
      mode: "professional",
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.3
    },
    {
      id: "color",
      name: "颜色",
      type: "color",
      mode: "basic",
      default: "#22c55e"
    },
    {
      id: "glowIntensity",
      name: "光晕强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 3,
      step: 0.1,
      default: 0.5
    }
  ],
  
  init: (ctx) => {
    particles = [];
    console.log("ParticleGridV8 effect initialized");
  },
  
  render: (ctx, audioData, params) => {
    if (!ctx.ctx || !ctx.canvas) return;
    
    const canvas = ctx.canvas;
    const context = ctx.ctx;
    const { 
      gridSize = "10x10", 
      particleSize = 6, 
      connectionDistance = 80,
      elasticity = 0.3,
      color = "#22c55e", 
      glowIntensity = 0.5 
    } = params;
    
    const [newGridSizeX, newGridSizeY] = gridSize.split("x").map(Number);
    
    if (gridSizeX !== newGridSizeX || gridSizeY !== newGridSizeY || particles.length === 0) {
      gridSizeX = newGridSizeX;
      gridSizeY = newGridSizeY;
      particles = [];
      
      const spacingX = canvas.width / (gridSizeX + 1);
      const spacingY = canvas.height / (gridSizeY + 1);
      
      for (let i = 0; i < gridSizeY; i++) {
        for (let j = 0; j < gridSizeX; j++) {
          const x = spacingX * (j + 1);
          const y = spacingY * (i + 1);
          particles.push({
            x,
            y,
            originalX: x,
            originalY: y,
            vx: 0,
            vy: 0,
            size: particleSize * (0.5 + Math.random() * 0.5),
            color
          });
        }
      }
    }
    
    context.fillStyle = "rgba(0, 0, 0, 0.15)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    const energy = audioData.full || 0.3;
    const bassEnergy = audioData.bass || 0;
    
    if (glowIntensity > 0) {
      context.shadowBlur = glowIntensity * 15;
      context.shadowColor = color;
    }
    
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.globalAlpha = 0.3;
    
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < connectionDistance) {
          context.globalAlpha = 0.3 * (1 - distance / connectionDistance);
          context.beginPath();
          context.moveTo(particles[i].x, particles[i].y);
          context.lineTo(particles[j].x, particles[j].y);
          context.stroke();
        }
      }
    }
    
    context.globalAlpha = 1;
    
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      
      const forceX = (p.originalX - p.x) * elasticity;
      const forceY = (p.originalY - p.y) * elasticity;
      
      p.vx += forceX;
      p.vy += forceY;
      
      const noiseX = (Math.sin(ctx.time * 2 + i * 0.5) + Math.sin(ctx.time * 3 + i * 0.3)) * 30 * energy;
      const noiseY = (Math.cos(ctx.time * 2.5 + i * 0.5) + Math.sin(ctx.time * 3.5 + i * 0.3)) * 30 * bassEnergy;
      
      p.x += p.vx + noiseX;
      p.y += p.vy + noiseY;
      
      p.vx *= 0.95;
      p.vy *= 0.95;
      
      context.fillStyle = color;
      context.globalAlpha = 0.8;
      context.beginPath();
      context.arc(p.x, p.y, p.size * (0.8 + energy * 0.4), 0, Math.PI * 2);
      context.fill();
    }
    
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  },
  
  resize: (width, height) => {
    particles = [];
    console.log(`ParticleGridV8 resized to ${width}x${height}`);
  },
  
  destroy: (ctx) => {
    particles = [];
    console.log("ParticleGridV8 effect destroyed");
  }
};
