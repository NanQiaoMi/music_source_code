"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const FractalGeometryV8Effect: EffectPlugin = {
  id: "fractal-geometry-v8",
  name: "分形几何",
  category: "geometry",
  description: "递归分形几何图形，音频驱动变形",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "iterations",
      name: "迭代次数",
      type: "number",
      mode: "basic",
      min: 3,
      max: 10,
      step: 1,
      default: 5
    },
    {
      id: "scale",
      name: "缩放比例",
      type: "number",
      mode: "basic",
      min: 0.5,
      max: 3,
      step: 0.1,
      default: 1
    },
    {
      id: "rotation",
      name: "旋转角度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 360,
      step: 1,
      default: 0
    },
    {
      id: "shapeType",
      name: "分形形状",
      type: "select",
      mode: "basic",
      default: "sierpinski",
      options: [
        { label: "谢尔宾斯基三角形", value: "sierpinski" },
        { label: "科赫雪花", value: "koch" },
        { label: "分形树", value: "tree" },
        { label: "分形圆", value: "circles" }
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
      id: "audioIntensity",
      name: "音频强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 2,
      step: 0.1,
      default: 1
    },
    {
      id: "rotationSpeed",
      name: "旋转速度",
      type: "number",
      mode: "professional",
      min: -2,
      max: 2,
      step: 0.1,
      default: 0
    },
    {
      id: "color1",
      name: "主颜色",
      type: "color",
      mode: "basic",
      default: "#00ffff"
    },
    {
      id: "color2",
      name: "辅助颜色",
      type: "color",
      mode: "professional",
      default: "#ff00ff"
    },
    {
      id: "fillOpacity",
      name: "填充透明度",
      type: "number",
      mode: "expert",
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.3
    },
    {
      id: "strokeOpacity",
      name: "描边透明度",
      type: "number",
      mode: "expert",
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.8
    }
  ],
  private: {
    time: 0,
    baseRotation: 0
  },
  init(ctx) {
    (this as any).private.time = 0;
    (this as any).private.baseRotation = 0;
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
    (this as any).private.baseRotation += params.rotationSpeed * 0.01;

    const bass = audioData.bass || 0;
    const mid = audioData.mid || 0;
    const treble = audioData.treble || 0;
    const avgEnergy = (bass + mid + treble) / 3;
    const audioMultiplier = 1 + avgEnergy * params.audioIntensity;

    context.save();
    context.translate(centerX, centerY);
    context.rotate((this as any).private.baseRotation + (params.rotation * Math.PI / 180));
    context.scale(params.scale * audioMultiplier, params.scale * audioMultiplier);

    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, Math.max(width, height) / 2);
    gradient.addColorStop(0, params.color1);
    gradient.addColorStop(1, params.color2);

    context.strokeStyle = gradient;
    context.fillStyle = gradient;
    context.globalAlpha = params.strokeOpacity;
    context.lineWidth = params.lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";

    const maxSize = Math.min(width, height) * 0.35;

    switch (params.shapeType) {
      case "sierpinski":
        drawSierpinskiTriangle(context, 0, -maxSize * 0.5, maxSize, params.iterations);
        break;
      case "koch":
        drawKochSnowflake(context, 0, 0, maxSize, params.iterations);
        break;
      case "tree":
        drawFractalTree(context, 0, maxSize * 0.5, -maxSize, -90, params.iterations);
        break;
      case "circles":
        drawFractalCircles(context, 0, 0, maxSize, params.iterations);
        break;
    }

    context.globalAlpha = params.fillOpacity;
    context.fill();

    context.restore();
  },
  resize() {},
  destroy() {}
};

function drawSierpinskiTriangle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, depth: number) {
  if (depth <= 0) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size / 2, y + size * Math.sqrt(3) / 2);
    ctx.lineTo(x - size / 2, y + size * Math.sqrt(3) / 2);
    ctx.closePath();
    ctx.stroke();
    return;
  }

  const newSize = size / 2;
  drawSierpinskiTriangle(ctx, x, y, newSize, depth - 1);
  drawSierpinskiTriangle(ctx, x + newSize / 2, y + newSize * Math.sqrt(3) / 2, newSize, depth - 1);
  drawSierpinskiTriangle(ctx, x - newSize / 2, y + newSize * Math.sqrt(3) / 2, newSize, depth - 1);
}

function drawKochSnowflake(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, depth: number) {
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const angle = (i * 120 - 90) * Math.PI / 180;
    const nextAngle = ((i + 1) * 120 - 90) * Math.PI / 180;
    drawKochLine(
      ctx,
      x + size * Math.cos(angle),
      y + size * Math.sin(angle),
      x + size * Math.cos(nextAngle),
      y + size * Math.sin(nextAngle),
      depth
    );
  }
  ctx.stroke();
}

function drawKochLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, depth: number) {
  if (depth <= 0) {
    ctx.lineTo(x2, y2);
    return;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;

  const xA = x1 + dx / 3;
  const yA = y1 + dy / 3;
  const xB = x1 + dx * 2 / 3;
  const yB = y1 + dy * 2 / 3;

  const xC = xA + (dx / 3) * 0.5 - (dy / 3) * (Math.sqrt(3) / 2);
  const yC = yA + (dx / 3) * (Math.sqrt(3) / 2) + (dy / 3) * 0.5;

  drawKochLine(ctx, x1, y1, xA, yA, depth - 1);
  drawKochLine(ctx, xA, yA, xC, yC, depth - 1);
  drawKochLine(ctx, xC, yC, xB, yB, depth - 1);
  drawKochLine(ctx, xB, yB, x2, y2, depth - 1);
}

function drawFractalTree(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, angle: number, depth: number) {
  if (depth <= 0 || length < 2) return;

  const endX = x + length * Math.cos(angle * Math.PI / 180);
  const endY = y + length * Math.sin(angle * Math.PI / 180);

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  const branchLength = length * 0.65;
  const branchAngle = 25;

  drawFractalTree(ctx, endX, endY, branchLength, angle - branchAngle, depth - 1);
  drawFractalTree(ctx, endX, endY, branchLength, angle + branchAngle, depth - 1);
}

function drawFractalCircles(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, depth: number) {
  if (depth <= 0 || radius < 2) return;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  const newRadius = radius * 0.5;
  const offset = radius * 0.5;

  drawFractalCircles(ctx, x + offset, y, newRadius, depth - 1);
  drawFractalCircles(ctx, x - offset, y, newRadius, depth - 1);
  drawFractalCircles(ctx, x, y + offset, newRadius, depth - 1);
  drawFractalCircles(ctx, x, y - offset, newRadius, depth - 1);
}
