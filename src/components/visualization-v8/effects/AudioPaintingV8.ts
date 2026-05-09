"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const AudioPaintingV8Effect: EffectPlugin = {
  id: "audio-painting-v8",
  name: "音频绘画",
  category: "shapes",
  description: "音乐驱动的抽象绘画，画笔随音频而动",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "brushSize",
      name: "画笔大小",
      type: "number",
      mode: "basic",
      min: 5,
      max: 100,
      step: 1,
      default: 30,
    },
    {
      id: "opacity",
      name: "不透明度",
      type: "number",
      mode: "basic",
      min: 0.1,
      max: 1,
      step: 0.05,
      default: 0.6,
    },
    {
      id: "fadeSpeed",
      name: "褪色速度",
      type: "number",
      mode: "basic",
      min: 0.001,
      max: 0.05,
      step: 0.001,
      default: 0.005,
    },
    {
      id: "brushType",
      name: "画笔类型",
      type: "select",
      mode: "basic",
      default: "circle",
      options: [
        { label: "圆形", value: "circle" },
        { label: "方形", value: "square" },
        { label: "星形", value: "star" },
        { label: "模糊", value: "blur" },
      ],
    },
    {
      id: "colorScheme",
      name: "配色方案",
      type: "select",
      mode: "basic",
      default: "neon",
      options: [
        { label: "霓虹", value: "neon" },
        { label: "温暖", value: "warm" },
        { label: "冷色", value: "cool" },
        { label: "彩虹", value: "rainbow" },
        { label: "灰度", value: "grayscale" },
      ],
    },
    {
      id: "brushCount",
      name: "画笔数量",
      type: "number",
      mode: "professional",
      min: 1,
      max: 10,
      step: 1,
      default: 3,
    },
    {
      id: "moveSpeed",
      name: "移动速度",
      type: "number",
      mode: "professional",
      min: 0.1,
      max: 5,
      step: 0.1,
      default: 1,
    },
    {
      id: "audioSensitivity",
      name: "音频敏感度",
      type: "number",
      mode: "professional",
      min: 0.1,
      max: 3,
      step: 0.1,
      default: 1,
    },
    {
      id: "trailLength",
      name: "轨迹长度",
      type: "number",
      mode: "expert",
      min: 1,
      max: 20,
      step: 1,
      default: 5,
    },
    {
      id: "rotationSpeed",
      name: "旋转速度",
      type: "number",
      mode: "expert",
      min: -2,
      max: 2,
      step: 0.1,
      default: 0.5,
    },
    {
      id: "clearMode",
      name: "清除模式",
      type: "select",
      mode: "expert",
      default: "fade",
      options: [
        { label: "渐变", value: "fade" },
        { label: "黑色", value: "black" },
        { label: "白色", value: "white" },
        { label: "不清除", value: "none" },
      ],
    },
  ],
  private: {
    brushes: [],
    time: 0,
  },
  init(ctx) {
    (this as any).private.brushes = [];
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

    let brushes = (this as any).private.brushes;
    if (brushes.length !== params.brushCount) {
      brushes = [];
      for (let i = 0; i < params.brushCount; i++) {
        brushes.push({
          x: width / 2 + (Math.random() - 0.5) * 200,
          y: height / 2 + (Math.random() - 0.5) * 200,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          angle: Math.random() * Math.PI * 2,
          trail: [],
        });
      }
      (this as any).private.brushes = brushes;
    }

    context.save();

    if (params.clearMode !== "none") {
      if (params.clearMode === "fade") {
        context.fillStyle = "rgba(0, 0, 0, " + params.fadeSpeed + ")";
        context.fillRect(0, 0, width, height);
      } else if (params.clearMode === "black") {
        context.fillStyle = "black";
        context.fillRect(0, 0, width, height);
      } else if (params.clearMode === "white") {
        context.fillStyle = "white";
        context.fillRect(0, 0, width, height);
      }
    }

    context.globalCompositeOperation = "lighter";
    context.globalAlpha = params.opacity;

    brushes.forEach((brush: any, index: number) => {
      const color = getColor(params.colorScheme, index, brushes.length, (this as any).private.time);

      const audioMultiplier = 1 + avgEnergy * params.audioSensitivity;
      const speed = params.moveSpeed * audioMultiplier;

      const noiseAngle = (this as any).private.time * 2 + index * 1.5;
      brush.vx += Math.cos(noiseAngle) * 0.2;
      brush.vy += Math.sin(noiseAngle) * 0.2;

      brush.x += brush.vx * speed;
      brush.y += brush.vy * speed;
      brush.angle += params.rotationSpeed * 0.05;

      if (brush.x < 0 || brush.x > width) brush.vx *= -0.8;
      if (brush.y < 0 || brush.y > height) brush.vy *= -0.8;
      brush.x = Math.max(0, Math.min(width, brush.x));
      brush.y = Math.max(0, Math.min(height, brush.y));

      brush.trail.unshift({ x: brush.x, y: brush.y });
      if (brush.trail.length > params.trailLength) {
        brush.trail.pop();
      }

      brush.trail.forEach((point: any, trailIndex: number) => {
        const trailAlpha = 1 - trailIndex / brush.trail.length;
        const size = params.brushSize * audioMultiplier * trailAlpha;

        context.save();
        context.translate(point.x, point.y);
        context.rotate(brush.angle);
        context.globalAlpha = params.opacity * trailAlpha;
        context.fillStyle = color;

        drawBrush(context, params.brushType, size, bass, mid, treble);

        context.restore();
      });
    });

    context.restore();
  },
  resize() {},
  destroy(ctx) {
    if (ctx && ctx.private) {
      ctx.private.brushes = [];
      ctx.private.time = 0;
    }
  },
};

function getColor(scheme: string, index: number, total: number, time: number): string {
  const hue = ((index / total) * 360 + time * 50) % 360;

  switch (scheme) {
    case "neon":
      return `hsl(${hue}, 100%, 60%)`;
    case "warm":
      const warmHue = (hue % 90) + 10;
      return `hsl(${warmHue}, 80%, 55%)`;
    case "cool":
      const coolHue = (hue % 120) + 180;
      return `hsl(${coolHue}, 80%, 55%)`;
    case "rainbow":
      return `hsl(${hue}, 100%, 60%)`;
    case "grayscale":
      const gray = 30 + (index / total) * 40;
      return `hsl(0, 0%, ${gray}%)`;
    default:
      return `hsl(${hue}, 100%, 60%)`;
  }
}

function drawBrush(
  ctx: CanvasRenderingContext2D,
  type: string,
  size: number,
  bass: number,
  mid: number,
  treble: number
) {
  const audioSize = size * (1 + bass * 0.5);

  switch (type) {
    case "circle":
      ctx.beginPath();
      ctx.arc(0, 0, audioSize / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "square":
      ctx.fillRect(-audioSize / 2, -audioSize / 2, audioSize, audioSize);
      break;
    case "star":
      drawStar(ctx, 0, 0, audioSize / 2, audioSize / 4, 5);
      break;
    case "blur":
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, audioSize);
      gradient.addColorStop(0, ctx.fillStyle as string);
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, audioSize, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  spikes: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);

  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerR;
    y = cy + Math.sin(rot) * outerR;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerR;
    y = cy + Math.sin(rot) * innerR;
    ctx.lineTo(x, y);
    rot += step;
  }

  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
  ctx.fill();
}
