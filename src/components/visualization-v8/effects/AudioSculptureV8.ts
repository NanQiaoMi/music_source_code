"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const AudioSculptureV8Effect: EffectPlugin = {
  id: "audio-sculpture-v8",
  name: "音频雕塑",
  category: "shapes",
  description: "3D音频雕塑，音频驱动变形",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "detailLevel",
      name: "细节级别",
      type: "number",
      mode: "basic",
      min: 32,
      max: 128,
      step: 8,
      default: 64
    },
    {
      id: "deformIntensity",
      name: "变形强度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 10,
      step: 0.5,
      default: 5
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
        { label: "金属", value: "metal" },
        { label: "火焰", value: "fire" },
        { label: "海洋", value: "ocean" }
      ]
    },
    {
      id: "sculptureType",
      name: "雕塑类型",
      type: "select",
      mode: "basic",
      default: "sphere",
      options: [
        { label: "球体", value: "sphere" },
        { label: "立方体", value: "cube" },
        { label: "圆环", value: "torus" },
        { label: "星形", value: "star" }
      ]
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
      id: "glowIntensity",
      name: "发光强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 20,
      step: 1,
      default: 8
    },
    {
      id: "fillMode",
      name: "填充模式",
      type: "select",
      mode: "expert",
      default: "both",
      options: [
        { label: "仅描边", value: "stroke" },
        { label: "仅填充", value: "fill" },
        { label: "描边+填充", value: "both" }
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

    const detailLevel = params.detailLevel;
    const baseRadius = Math.min(width, height) * 0.3;

    context.fillStyle = "black";
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(centerX, centerY);

    const rotationX = (this as any).private.time * params.rotationSpeed * 0.3;
    const rotationY = (this as any).private.time * params.rotationSpeed * 0.5;

    const points: Array<{ x: number; y: number; z: number; originalX: number; originalY: number; originalZ: number }> = [];

    for (let i = 0; i < detailLevel; i++) {
      for (let j = 0; j < detailLevel; j++) {
        const u = (i / detailLevel) * Math.PI * 2;
        const v = (j / detailLevel) * Math.PI;

        let x = 0, y = 0, z = 0;

        switch (params.sculptureType) {
          case "sphere":
            x = Math.sin(v) * Math.cos(u);
            y = Math.sin(v) * Math.sin(u);
            z = Math.cos(v);
            break;
          case "cube":
            x = Math.sign(Math.cos(u)) * 0.5;
            y = Math.sign(Math.sin(u)) * 0.5;
            z = Math.cos(v) * 0.5;
            break;
          case "torus":
            const torusR = 0.7;
            const torusr = 0.3;
            x = (torusR + torusr * Math.cos(v)) * Math.cos(u);
            y = (torusR + torusr * Math.cos(v)) * Math.sin(u);
            z = torusr * Math.sin(v);
            break;
          case "star":
            const starR = 1;
            const starr = 0.4;
            const starAngle = (u * 5) % (Math.PI * 2);
            const starRadius = starAngle < Math.PI ? starR : starr;
            x = starRadius * Math.cos(u) * Math.sin(v);
            y = starRadius * Math.sin(u) * Math.sin(v);
            z = Math.cos(v);
            break;
        }

        const originalX = x;
        const originalY = y;
        const originalZ = z;

        const deformation = 
          Math.sin(x * 3 + (this as any).private.time) * 
          Math.cos(y * 3 + (this as any).private.time * 0.7) * 
          Math.sin(z * 3 + bass * 2) * 
          params.deformIntensity * audioMultiplier;

        x *= (1 + deformation * 0.3);
        y *= (1 + deformation * 0.3);
        z *= (1 + deformation * 0.3);

        const rotated = rotate3D(x, y, z, rotationX, rotationY);

        points.push({
          x: rotated.x,
          y: rotated.y,
          z: rotated.z,
          originalX,
          originalY,
          originalZ
        });
      }
    }

    const projectedPoints = points.map(p => {
      const scale = 400 / (400 + p.z * baseRadius);
      return {
        x: p.x * baseRadius * scale,
        y: p.y * baseRadius * scale,
        z: p.z,
        originalX: p.originalX,
        originalY: p.originalY,
        originalZ: p.originalZ
      };
    });

    if (params.glowIntensity > 0) {
      context.shadowBlur = params.glowIntensity;
    }
    context.lineWidth = params.lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";

    for (let i = 0; i < detailLevel; i++) {
      for (let j = 0; j < detailLevel - 1; j++) {
        const idx1 = i * detailLevel + j;
        const idx2 = i * detailLevel + j + 1;
        const idx3 = ((i + 1) % detailLevel) * detailLevel + j + 1;
        const idx4 = ((i + 1) % detailLevel) * detailLevel + j;

        const p1 = projectedPoints[idx1];
        const p2 = projectedPoints[idx2];
        const p3 = projectedPoints[idx3];
        const p4 = projectedPoints[idx4];

        const avgZ = (p1.z + p2.z + p3.z + p4.z) / 4;
        const brightness = Math.max(0.2, (1 + avgZ) / 2);

        const hue = getSculptureHue(params.colorScheme, p1.originalX, p1.originalY, p1.originalZ, (this as any).private.time);
        const color = `hsl(${hue}, 80%, ${40 + brightness * 40}%)`;

        context.strokeStyle = color;
        context.fillStyle = color;
        context.globalAlpha = brightness;

        context.beginPath();
        context.moveTo(p1.x, p1.y);
        context.lineTo(p2.x, p2.y);
        context.lineTo(p3.x, p3.y);
        context.lineTo(p4.x, p4.y);
        context.closePath();

        if (params.fillMode === "fill" || params.fillMode === "both") {
          context.fill();
        }
        if (params.fillMode === "stroke" || params.fillMode === "both") {
          context.stroke();
        }
      }
    }

    context.restore();
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  },
  resize() {},
  destroy(ctx) {
    if (ctx && ctx.private) {
      ctx.private.time = 0;
    }
  }
};

function rotate3D(x: number, y: number, z: number, rotX: number, rotY: number) {
  let cosX = Math.cos(rotX);
  let sinX = Math.sin(rotX);
  let cosY = Math.cos(rotY);
  let sinY = Math.sin(rotY);

  let y1 = y * cosX - z * sinX;
  let z1 = y * sinX + z * cosX;
  let x2 = x * cosY + z1 * sinY;
  let z2 = -x * sinY + z1 * cosY;

  return { x: x2, y: y1, z: z2 };
}

function getSculptureHue(scheme: string, x: number, y: number, z: number, time: number): number {
  switch (scheme) {
    case "neon":
      return ((Math.atan2(y, x) / Math.PI * 180 + 360) % 360 + time * 50) % 360;
    case "metal":
      return 200 + (z * 30);
    case "fire":
      return 20 + (z * 20);
    case "ocean":
      return 180 + (z * 40);
    default:
      return ((Math.atan2(y, x) / Math.PI * 180 + 360) % 360 + time * 50) % 360;
  }
}
