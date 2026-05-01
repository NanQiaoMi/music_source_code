"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const ParticleExplosionV8Effect: EffectPlugin = {
  id: "particle-explosion-v8",
  name: "音频爆炸",
  category: "particles",
  description: "粒子爆炸效果，音频触发爆炸",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "explosionThreshold",
      name: "爆炸阈值",
      type: "number",
      mode: "basic",
      min: 0.2,
      max: 1,
      step: 0.05,
      default: 0.5
    },
    {
      id: "explosionSize",
      name: "爆炸大小",
      type: "number",
      mode: "basic",
      min: 50,
      max: 300,
      step: 10,
      default: 150
    },
    {
      id: "particlePerExplosion",
      name: "每次爆炸粒子数",
      type: "number",
      mode: "basic",
      min: 20,
      max: 200,
      step: 10,
      default: 80
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
      default: "explosion",
      options: [
        { label: "爆炸", value: "explosion" },
        { label: "烟花", value: "fireworks" },
        { label: "星云", value: "nebula" },
        { label: "闪电", value: "lightning" }
      ]
    },
    {
      id: "particleSize",
      name: "粒子大小",
      type: "number",
      mode: "professional",
      min: 2,
      max: 15,
      step: 1,
      default: 6
    },
    {
      id: "gravity",
      name: "重力强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.2
    },
    {
      id: "fadeOut",
      name: "淡出效果",
      type: "select",
      mode: "expert",
      default: "fade",
      options: [
        { label: "淡出", value: "fade" },
        { label: "保留", value: "persist" },
        { label: "清除", value: "clear" }
      ]
    }
  ],
  private: {
    particles: [],
    lastBassValue: 0,
    time: 0
  },
  init(ctx) {
    (this as any).private.particles = [];
    (this as any).private.lastBassValue = 0;
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

    let particles = (this as any).private.particles;

    if (bass > params.explosionThreshold && (this as any).private.lastBassValue < params.explosionThreshold) {
      const explosionX = centerX + (Math.random() - 0.5) * width * 0.5;
      const explosionY = centerY + (Math.random() - 0.5) * height * 0.5;
      
      for (let i = 0; i < params.particlePerExplosion; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (2 + Math.random() * 8) * audioMultiplier;
        
        particles.push({
          x: explosionX,
          y: explosionY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 0.8 + Math.random() * 0.4,
          size: params.particleSize * (0.5 + Math.random() * 0.5),
          color: Math.random()
        });
      }
    }
    (this as any).private.lastBassValue = bass;

    if (params.fadeOut === "clear") {
      context.fillStyle = "black";
      context.fillRect(0, 0, width, height);
    } else if (params.fadeOut === "fade") {
      context.fillStyle = "rgba(0, 0, 0, 0.05)";
      context.fillRect(0, 0, width, height);
    }

    particles = particles.filter((p: any) => p.life > 0);

    particles.forEach((particle: any) => {
      particle.vy += params.gravity;
      
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      particle.life -= 0.015;
      
      if (particle.x < 0 || particle.x > width) particle.vx *= -0.8;
      if (particle.y > height) particle.vy *= -0.8;
      particle.x = Math.max(0, Math.min(width, particle.x));
      particle.y = Math.max(0, Math.min(height, particle.y));

      const hue = getExplosionColor(params.colorScheme, particle.color, (this as any).private.time);
      const alpha = particle.life;
      const size = particle.size * particle.life;

      context.beginPath();
      context.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      context.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
      context.fill();
    });

    (this as any).private.particles = particles;
  },
  resize() {
    (this as any).private.particles = [];
  },
  destroy(ctx) {
    if (ctx && ctx.private) {
      ctx.private.particles = [];
      ctx.private.lastBassValue = 0;
      ctx.private.time = 0;
    }
  }
};

function getExplosionColor(scheme: string, colorValue: number, time: number): number {
  switch (scheme) {
    case "explosion":
      return 10 + colorValue * 40;
    case "fireworks":
      return (colorValue * 360 + time * 20) % 360;
    case "nebula":
      return 200 + colorValue * 80;
    case "lightning":
      return 180 + Math.sin(colorValue * Math.PI * 4 + time) * 40;
    default:
      return 10 + colorValue * 40;
  }
}
