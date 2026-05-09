"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const ParticleGravityV8Effect: EffectPlugin = {
  id: "particle-gravity-v8",
  name: "粒子引力",
  category: "particles",
  description: "粒子引力系统，音频驱动引力场",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "particleCount",
      name: "粒子数量",
      type: "number",
      mode: "basic",
      min: 100,
      max: 2000,
      step: 50,
      default: 800,
    },
    {
      id: "gravityStrength",
      name: "引力强度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 5,
      step: 0.1,
      default: 2,
    },
    {
      id: "attractorCount",
      name: "引力源数量",
      type: "number",
      mode: "basic",
      min: 1,
      max: 5,
      step: 1,
      default: 3,
    },
    {
      id: "audioIntensity",
      name: "音频强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 3,
      step: 0.1,
      default: 1,
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
        { label: "极光", value: "aurora" },
      ],
    },
    {
      id: "particleSize",
      name: "粒子大小",
      type: "number",
      mode: "professional",
      min: 1,
      max: 10,
      step: 0.5,
      default: 3,
    },
    {
      id: "fadeEffect",
      name: "淡出效果",
      type: "number",
      mode: "professional",
      min: 0,
      max: 0.1,
      step: 0.005,
      default: 0.02,
    },
    {
      id: "trailMode",
      name: "轨迹模式",
      type: "select",
      mode: "expert",
      default: "fade",
      options: [
        { label: "淡出", value: "fade" },
        { label: "不清除", value: "none" },
        { label: "清除", value: "clear" },
      ],
    },
  ],
  private: {
    particles: [],
    attractors: [],
    time: 0,
  },
  init(ctx) {
    (this as any).private.particles = [];
    (this as any).private.attractors = [];
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
    let attractors = (this as any).private.attractors;

    if (attractors.length !== params.attractorCount) {
      attractors = [];
      for (let i = 0; i < params.attractorCount; i++) {
        attractors.push({
          x: centerX + (Math.random() - 0.5) * 400,
          y: centerY + (Math.random() - 0.5) * 400,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          phase: i * ((Math.PI * 2) / params.attractorCount),
        });
      }
      (this as any).private.attractors = attractors;
    }

    if (particles.length !== params.particleCount) {
      particles = [];
      for (let i = 0; i < params.particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          color: Math.random(),
        });
      }
      (this as any).private.particles = particles;
    }

    if (params.trailMode === "clear") {
      context.fillStyle = "black";
      context.fillRect(0, 0, width, height);
    } else if (params.trailMode === "fade") {
      context.fillStyle = `rgba(0, 0, 0, ${params.fadeEffect})`;
      context.fillRect(0, 0, width, height);
    }

    attractors.forEach((attractor: any, index: number) => {
      attractor.phase += 0.01;
      const orbitRadius = 150;
      attractor.x =
        centerX + Math.cos(attractor.phase + (this as any).private.time * 0.5) * orbitRadius;
      attractor.y =
        centerY + Math.sin(attractor.phase * 0.7 + (this as any).private.time * 0.3) * orbitRadius;
    });

    particles.forEach((particle: any) => {
      let fx = 0;
      let fy = 0;

      attractors.forEach((attractor: any) => {
        const dx = attractor.x - particle.x;
        const dy = attractor.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = (params.gravityStrength * audioMultiplier) / Math.max(dist, 20);

        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      });

      particle.vx += fx * 0.1;
      particle.vy += fy * 0.1;

      particle.vx *= 0.99;
      particle.vy *= 0.99;

      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0 || particle.x > width) particle.vx *= -1;
      if (particle.y < 0 || particle.y > height) particle.vy *= -1;
      particle.x = Math.max(0, Math.min(width, particle.x));
      particle.y = Math.max(0, Math.min(height, particle.y));

      const hue = getGravityColor(params.colorScheme, particle.color, (this as any).private.time);
      const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      const alpha = Math.min(1, 0.3 + speed * 0.2);

      context.beginPath();
      context.arc(particle.x, particle.y, params.particleSize * (1 + speed * 0.1), 0, Math.PI * 2);
      context.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
      context.fill();
    });

    attractors.forEach((attractor: any, index: number) => {
      const hue = ((index / params.attractorCount) * 360 + (this as any).private.time * 50) % 360;
      context.beginPath();
      context.arc(attractor.x, attractor.y, 8 + avgEnergy * 10, 0, Math.PI * 2);
      context.fillStyle = `hsla(${hue}, 100%, 70%, 0.8)`;
      context.fill();
    });
  },
  resize() {
    (this as any).private.particles = [];
    (this as any).private.attractors = [];
  },
  destroy(ctx) {
    if (ctx && ctx.private) {
      ctx.private.particles = [];
      ctx.private.attractors = [];
      ctx.private.time = 0;
    }
  },
};

function getGravityColor(scheme: string, colorValue: number, time: number): number {
  switch (scheme) {
    case "neon":
      return (colorValue * 360 + time * 30) % 360;
    case "fire":
      return 10 + colorValue * 40;
    case "ocean":
      return 180 + colorValue * 60;
    case "aurora":
      return 80 + Math.sin(colorValue * Math.PI * 2 + time) * 80;
    default:
      return (colorValue * 360 + time * 30) % 360;
  }
}
