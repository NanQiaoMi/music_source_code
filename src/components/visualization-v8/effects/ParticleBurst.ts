"use client";

import { EffectPlugin } from "@/lib/visualization/types";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

let particles: Particle[] = [];
let lastBurstTime = 0;

export const ParticleBurstEffect: EffectPlugin = {
  id: "particle-burst",
  name: "粒子爆发",
  category: "particles",
  description: "随节拍粒子从中心爆发",
  preferredEngine: "canvas",
  
  parameters: [
    {
      id: "particleCount",
      name: "粒子数量",
      type: "number",
      mode: "basic",
      min: 100,
      max: 2000,
      step: 100,
      default: 500
    },
    {
      id: "burstIntensity",
      name: "爆发强度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 10,
      step: 0.5,
      default: 3
    },
    {
      id: "speed",
      name: "速度",
      type: "number",
      mode: "basic",
      min: 0.5,
      max: 10,
      step: 0.5,
      default: 2
    },
    {
      id: "colorScheme",
      name: "颜色方案",
      type: "select",
      mode: "professional",
      default: "rainbow",
      options: [
        { label: "彩虹", value: "rainbow" },
        { label: "粉色", value: "pink" },
        { label: "蓝色", value: "blue" },
        { label: "绿色", value: "green" }
      ]
    },
    {
      id: "glowIntensity",
      name: "光晕强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 5,
      step: 0.1,
      default: 1
    }
  ],
  
  init: (ctx) => {
    particles = [];
    lastBurstTime = 0;
    console.log("ParticleBurst effect initialized");
  },
  
  render: (ctx, audioData, params) => {
    if (!ctx.ctx || !ctx.canvas) return;
    
    const canvas = ctx.canvas;
    const context = ctx.ctx;
    const { 
      particleCount = 500, 
      burstIntensity = 3, 
      speed = 2, 
      colorScheme = "rainbow",
      glowIntensity = 1
    } = params;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const avgEnergy = audioData.full || 0.5;
    const shouldBurst = audioData.isBeat || avgEnergy > 0.7;
    
    if (shouldBurst && ctx.time - lastBurstTime > 0.1) {
      lastBurstTime = ctx.time;
      const burstCount = Math.floor(50 * burstIntensity);
      
      for (let i = 0; i < burstCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = (Math.random() * 3 + 1) * speed * burstIntensity;
        
        let color: string;
        const hue = Math.random() * 360;
        
        switch (colorScheme) {
          case "pink":
            color = `hsl(330, 80%, ${50 + Math.random() * 30}%)`;
            break;
          case "blue":
            color = `hsl(210, 80%, ${50 + Math.random() * 30}%)`;
            break;
          case "green":
            color = `hsl(150, 80%, ${50 + Math.random() * 30}%)`;
            break;
          default:
            color = `hsl(${hue}, 80%, 60%)`;
        }
        
        particles.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: 1,
          maxLife: 2 + Math.random() * 2,
          size: 2 + Math.random() * 4,
          color
        });
      }
    }
    
    while (particles.length > particleCount) {
      particles.shift();
    }
    
    context.fillStyle = "rgba(0, 0, 0, 0.1)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    if (glowIntensity > 0) {
      context.shadowBlur = glowIntensity * 15;
    }
    
    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= ctx.deltaTime / p.maxLife;
      p.vx *= 0.99;
      p.vy *= 0.99;
      
      if (p.life > 0) {
        context.shadowColor = p.color;
        context.globalAlpha = p.life;
        context.fillStyle = p.color;
        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        context.fill();
        return true;
      }
      return false;
    });
    
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  },
  
  resize: (width, height) => {
    console.log(`ParticleBurst resized to ${width}x${height}`);
  },
  
  destroy: () => {
    particles = [];
    console.log("ParticleBurst effect destroyed");
  }
};
