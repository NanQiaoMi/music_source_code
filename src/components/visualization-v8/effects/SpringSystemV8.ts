"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const SpringSystemV8Effect: EffectPlugin = {
  id: "spring-system-v8",
  name: "弹簧系统",
  category: "physics",
  description: "物理弹簧系统，音频驱动弹跳",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "springCount",
      name: "弹簧数量",
      type: "number",
      mode: "basic",
      min: 10,
      max: 100,
      step: 5,
      default: 30
    },
    {
      id: "stiffness",
      name: "弹性系数",
      type: "number",
      mode: "basic",
      min: 0.1,
      max: 2,
      step: 0.05,
      default: 0.5
    },
    {
      id: "damping",
      name: "阻尼系数",
      type: "number",
      mode: "basic",
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.3
    },
    {
      id: "gravity",
      name: "重力强度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 2,
      step: 0.1,
      default: 0.5
    },
    {
      id: "layout",
      name: "布局方式",
      type: "select",
      mode: "professional",
      default: "grid",
      options: [
        { label: "网格", value: "grid" },
        { label: "圆形", value: "circle" },
        { label: "垂直线", value: "vertical" },
        { label: "水平线", value: "horizontal" }
      ]
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
      id: "springColor",
      name: "弹簧颜色",
      type: "color",
      mode: "basic",
      default: "#00ffff"
    },
    {
      id: "particleColor",
      name: "粒子颜色",
      type: "color",
      mode: "basic",
      default: "#ff00ff"
    },
    {
      id: "particleSize",
      name: "粒子大小",
      type: "number",
      mode: "professional",
      min: 3,
      max: 20,
      step: 1,
      default: 8
    },
    {
      id: "lineWidth",
      name: "弹簧线宽",
      type: "number",
      mode: "professional",
      min: 1,
      max: 5,
      step: 0.5,
      default: 2
    },
    {
      id: "connectionMode",
      name: "连接模式",
      type: "select",
      mode: "expert",
      default: "neighbors",
      options: [
        { label: "邻居连接", value: "neighbors" },
        { label: "全部连接", value: "all" },
        { label: "不连接", value: "none" }
      ]
    },
    {
      id: "opacity",
      name: "不透明度",
      type: "number",
      mode: "expert",
      min: 0.1,
      max: 1,
      step: 0.05,
      default: 0.8
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

    (this as any).private.time += 0.016;

    const bass = audioData.bass || 0;
    const mid = audioData.mid || 0;
    const treble = audioData.treble || 0;
    const avgEnergy = (bass + mid + treble) / 3;
    const audioForce = avgEnergy * params.audioIntensity * 50;

    let particles = (this as any).private.particles;

    if (particles.length !== params.springCount) {
      particles = [];
      for (let i = 0; i < params.springCount; i++) {
        let x, y;

        switch (params.layout) {
          case "grid":
            const cols = Math.ceil(Math.sqrt(params.springCount));
            const row = Math.floor(i / cols);
            const col = i % cols;
            x = width * 0.2 + (col / (cols - 1 || 1)) * width * 0.6;
            y = height * 0.2 + (row / (Math.ceil(params.springCount / cols) - 1 || 1)) * height * 0.6;
            break;
          case "circle":
            const angle = (i / params.springCount) * Math.PI * 2;
            const radius = Math.min(width, height) * 0.3;
            x = width / 2 + Math.cos(angle) * radius;
            y = height / 2 + Math.sin(angle) * radius;
            break;
          case "vertical":
            x = width / 2;
            y = height * 0.1 + (i / (params.springCount - 1 || 1)) * height * 0.8;
            break;
          case "horizontal":
            x = width * 0.1 + (i / (params.springCount - 1 || 1)) * width * 0.8;
            y = height / 2;
            break;
          default:
            x = width / 2;
            y = height / 2;
        }

        particles.push({
          x: x,
          y: y,
          originX: x,
          originY: y,
          vx: 0,
          vy: 0,
          index: i
        });
      }
      (this as any).private.particles = particles;
    }

    context.save();
    context.globalAlpha = params.opacity;
    context.lineWidth = params.lineWidth;
    context.lineCap = "round";

    particles.forEach((particle: any, i: number) => {
      const dx = particle.originX - particle.x;
      const dy = particle.originY - particle.y;

      particle.vx += dx * params.stiffness * 0.01;
      particle.vy += dy * params.stiffness * 0.01;

      particle.vy += params.gravity * 0.1;

      const noiseAngle = (this as any).private.time * 2 + i * 0.5;
      particle.vx += Math.cos(noiseAngle) * audioForce * 0.01;
      particle.vy += Math.sin(noiseAngle) * audioForce * 0.01;

      particle.vx *= (1 - params.damping * 0.05);
      particle.vy *= (1 - params.damping * 0.05);

      particle.x += particle.vx;
      particle.y += particle.vy;

      particle.x = Math.max(10, Math.min(width - 10, particle.x));
      particle.y = Math.max(10, Math.min(height - 10, particle.y));
    });

    if (params.connectionMode !== "none") {
      context.strokeStyle = params.springColor;
      context.beginPath();

      if (params.connectionMode === "neighbors") {
        for (let i = 0; i < particles.length - 1; i++) {
          context.moveTo(particles[i].x, particles[i].y);
          context.lineTo(particles[i + 1].x, particles[i + 1].y);
        }
      } else if (params.connectionMode === "all") {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            context.moveTo(particles[i].x, particles[i].y);
            context.lineTo(particles[j].x, particles[j].y);
          }
        }
      }

      context.stroke();
    }

    particles.forEach((particle: any) => {
      context.beginPath();
      context.arc(particle.x, particle.y, params.particleSize, 0, Math.PI * 2);
      context.fillStyle = params.particleColor;
      context.fill();
    });

    context.restore();
  },
  resize() {
    (this as any).private.particles = [];
  },
  destroy() {}
};
