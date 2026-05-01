"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const TunnelFlightV8Effect: EffectPlugin = {
  id: "tunnel-flight-v8",
  name: "隧道飞行",
  category: "space",
  description: "3D隧道飞行效果，音频驱动变形",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "segmentCount",
      name: "分段数量",
      type: "number",
      mode: "basic",
      min: 20,
      max: 100,
      step: 5,
      default: 40
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
      id: "radius",
      name: "隧道半径",
      type: "number",
      mode: "basic",
      min: 50,
      max: 300,
      step: 10,
      default: 150
    },
    {
      id: "rotationSpeed",
      name: "旋转速度",
      type: "number",
      mode: "basic",
      min: -2,
      max: 2,
      step: 0.1,
      default: 0.5
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
        { label: "彩虹", value: "rainbow" }
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
      default: 2
    },
    {
      id: "glowIntensity",
      name: "发光强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 20,
      step: 1,
      default: 5
    },
    {
      id: "fillMode",
      name: "填充模式",
      type: "select",
      mode: "expert",
      default: "stroke",
      options: [
        { label: "仅描边", value: "stroke" },
        { label: "仅填充", value: "fill" },
        { label: "描边+填充", value: "both" }
      ]
    }
  ],
  private: {
    segments: [],
    time: 0
  },
  init(ctx) {
    (this as any).private.segments = [];
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

    let segments = (this as any).private.segments;
    
    if (segments.length !== params.segmentCount) {
      segments = [];
      for (let i = 0; i < params.segmentCount; i++) {
        segments.push({
          z: i * (500 / params.segmentCount),
          rotation: 0
        });
      }
      (this as any).private.segments = segments;
    }

    const speed = params.speed * audioMultiplier * 10;
    const baseRadius = params.radius;

    context.fillStyle = "black";
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(centerX, centerY);
    context.rotate((this as any).private.time * params.rotationSpeed);

    segments.forEach((segment: any, index: number) => {
      segment.z -= speed;
      
      if (segment.z < 1) {
        segment.z = 500;
      }

      const perspective = 300 / (segment.z + 300);
      const radius = baseRadius * perspective * audioMultiplier;
      const segmentAngle = (index / segments.length) * Math.PI * 2;

      const hue = getColorHue(params.colorScheme, index, segments.length, (this as any).private.time);
      const brightness = Math.max(0.3, 1 - segment.z / 500);
      
      let color: string;
      switch (params.colorScheme) {
        case "neon":
          color = `hsl(${hue}, 100%, ${50 + brightness * 30}%)`;
          break;
        case "fire":
          const fireHue = 10 + hue * 0.3;
          color = `hsl(${fireHue}, 100%, ${40 + brightness * 40}%)`;
          break;
        case "ocean":
          const oceanHue = 180 + hue * 0.4;
          color = `hsl(${oceanHue}, 80%, ${40 + brightness * 30}%)`;
          break;
        case "rainbow":
          color = `hsl(${hue}, 100%, ${50 + brightness * 30}%)`;
          break;
        default:
          color = `hsl(${hue}, 100%, ${50 + brightness * 30}%)`;
      }

      context.strokeStyle = color;
      context.fillStyle = color;
      context.globalAlpha = brightness;
      context.lineWidth = params.lineWidth * brightness;

      if (params.glowIntensity > 0) {
        context.shadowBlur = params.glowIntensity * brightness;
        context.shadowColor = color;
      }

      drawTunnelRing(context, radius, segmentAngle, 8);
      
      if (params.fillMode === "fill" || params.fillMode === "both") {
        context.fill();
      }
      if (params.fillMode === "stroke" || params.fillMode === "both") {
        context.stroke();
      }
    });

    context.restore();
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  },
  resize() {
    (this as any).private.segments = [];
  },
  destroy(ctx) {
    if (ctx && ctx.private) {
      ctx.private.segments = [];
      ctx.private.time = 0;
    }
  }
};

function getColorHue(scheme: string, index: number, total: number, time: number): number {
  const baseHue = (index / total) * 360;
  const timeHue = (time * 50) % 360;
  return (baseHue + timeHue) % 360;
}

function drawTunnelRing(ctx: CanvasRenderingContext2D, radius: number, offsetAngle: number, sides: number) {
  ctx.beginPath();
  
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + offsetAngle;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  ctx.closePath();
}
