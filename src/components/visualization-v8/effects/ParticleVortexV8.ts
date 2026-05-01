"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const ParticleVortexV8Effect: EffectPlugin = {
  id: "particle-vortex-v8",
  name: "粒子旋涡",
  category: "particles",
  description: "粒子旋涡效果，音频驱动旋转",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "particleCount",
      name: "粒子数量",
      type: "number",
      mode: "basic",
      min: 200,
      max: 3000,
      step: 100,
      default: 1500
    },
    {
      id: "vortexStrength",
      name: "旋涡强度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 5,
      step: 0.1,
      default: 2
    },
    {
      id: "vortexCount",
      name: "旋涡数量",
      type: "number",
      mode: "basic",
      min: 1,
      max: 5,
      step: 1,
      default: 2
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
      default: "vortex",
      options: [
        { label: "旋涡", value: "vortex" },
        { label: "火焰", value: "fire" },
        { label: "海洋", value: "ocean" },
        { label: "银河", value: "galaxy" }
      ]
    },
    {
      id: "particleSize",
      name: "粒子大小",
      type: "number",
      mode: "professional",
      min: 1,
      max: 8,
      step: 0.5,
      default: 3
    },
    {
      id: "fadeSpeed",
      name: "淡出速度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 0.1,
      step: 0.005,
      default: 0.015
    },
    {
      id: "direction",
      name: "旋转方向",
      type: "select",
      mode: "expert",
      default: "clockwise",
      options: [
        { label: "顺时针", value: "clockwise" },
        { label: "逆时针", value: "counter" },
        { label: "混合", value: "mixed" }
      ]
    }
  ],
  private: {
    particles: [],
    time: 0
  },
  init(ctx) {
    (this as any).private.particles = [];
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

    if (particles.length !== params.particleCount) {
      particles = [];
      for (let i = 0; i < params.particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          angle: Math.random() * Math.PI * 2,
          color: Math.random(),
          vortexIndex: i % params.vortexCount
        });
      }
      (this as any).private.particles = particles;
    }

    context.fillStyle = `rgba(0, 0, 0, ${params.fadeSpeed})`;
    context.fillRect(0, 0, width, height);

    const vortexCenters: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < params.vortexCount; i++) {
      const angle = (i / params.vortexCount) * Math.PI * 2 + (this as any).private.time * 0.2;
      const radius = Math.min(width, height) * 0.2;
      vortexCenters.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    }

    particles.forEach((particle: any) => {
      let fx = 0;
      let fy = 0;

      vortexCenters.forEach((center, index) => {
        const dx = center.x - particle.x;
        const dy = center.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 10) {
          let direction = 1;
          if (params.direction === "counter") {
            direction = -1;
          } else if (params.direction === "mixed") {
            direction = index % 2 === 0 ? 1 : -1;
          }

          const strength = params.vortexStrength * audioMultiplier / Math.max(dist, 50);
          
          fx += (-dy / dist) * strength * direction;
          fy += (dx / dist) * strength * direction;
          
          const pullStrength = 0.3 / Math.max(dist, 100);
          fx += (dx / dist) * pullStrength;
          fy += (dy / dist) * pullStrength;
        }
      });

      particle.vx += fx;
      particle.vy += fy;
      
      particle.vx *= 0.99;
      particle.vy *= 0.99;

      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0 || particle.x > width) particle.vx *= -1;
      if (particle.y < 0 || particle.y > height) particle.vy *= -1;
      particle.x = Math.max(0, Math.min(width, particle.x));
      particle.y = Math.max(0, Math.min(height, particle.y));

      const hue = getVortexColor(params.colorScheme, particle.color, particle.vortexIndex, (this as any).private.time);
      const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      const alpha = Math.min(1, 0.3 + speed * 0.15);

      context.beginPath();
      context.arc(particle.x, particle.y, params.particleSize * (1 + speed * 0.1), 0, Math.PI * 2);
      context.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
      context.fill();
    });

    vortexCenters.forEach((center, index) => {
      const hue = (index / params.vortexCount * 360 + (this as any).private.time * 30) % 360;
      context.beginPath();
      context.arc(center.x, center.y, 10 + avgEnergy * 15, 0, Math.PI * 2);
      context.fillStyle = `hsla(${hue}, 100%, 70%, 0.7)`;
      context.fill();
    });
  },
  resize() {
    (this as any).private.particles = [];
  },
  destroy(ctx) {
    if (ctx && ctx.private) {
      ctx.private.particles = [];
      ctx.private.time = 0;
    }
  }
};

function getVortexColor(scheme: string, colorValue: number, vortexIndex: number, time: number): number {
  switch (scheme) {
    case "vortex":
      return (colorValue * 360 + time * 40 + vortexIndex * 60) % 360;
    case "fire":
      return 10 + colorValue * 40;
    case "ocean":
      return 180 + colorValue * 60;
    case "galaxy":
      return 280 + Math.sin(colorValue * Math.PI * 2 + time) * 40;
    default:
      return (colorValue * 360 + time * 40 + vortexIndex * 60) % 360;
  }
}
