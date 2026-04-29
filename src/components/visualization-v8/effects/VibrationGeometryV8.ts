"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const VibrationGeometryV8Effect: EffectPlugin = {
  id: "vibration-geometry-v8",
  name: "振动几何",
  category: "shapes",
  description: "几何图形随音乐振动变形",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "shapeType",
      name: "几何形状",
      type: "select",
      mode: "basic",
      default: "circle",
      options: [
        { label: "圆形", value: "circle" },
        { label: "方形", value: "square" },
        { label: "三角形", value: "triangle" },
        { label: "星形", value: "star" },
        { label: "六边形", value: "hexagon" }
      ]
    },
    {
      id: "vibrationIntensity",
      name: "振动强度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 50,
      step: 1,
      default: 20
    },
    {
      id: "count",
      name: "图形数量",
      type: "number",
      mode: "basic",
      min: 1,
      max: 20,
      step: 1,
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
      id: "baseSize",
      name: "基础大小",
      type: "number",
      mode: "professional",
      min: 20,
      max: 200,
      step: 5,
      default: 80
    },
    {
      id: "audioResponse",
      name: "音频响应",
      type: "select",
      mode: "professional",
      default: "bass",
      options: [
        { label: "低频", value: "bass" },
        { label: "中频", value: "mid" },
        { label: "高频", value: "treble" },
        { label: "全频", value: "full" }
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
      default: 3
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
      id: "fillMode",
      name: "填充模式",
      type: "select",
      mode: "professional",
      default: "stroke",
      options: [
        { label: "仅描边", value: "stroke" },
        { label: "仅填充", value: "fill" },
        { label: "描边+填充", value: "both" }
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
    },
    {
      id: "glowIntensity",
      name: "发光强度",
      type: "number",
      mode: "expert",
      min: 0,
      max: 20,
      step: 1,
      default: 5
    }
  ],
  private: {
    time: 0,
    shapes: []
  },
  init(ctx) {
    (this as any).private.time = 0;
    (this as any).private.shapes = [];
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

    let audioValue = 0;
    switch (params.audioResponse) {
      case "bass":
        audioValue = audioData.bass || 0;
        break;
      case "mid":
        audioValue = audioData.mid || 0;
        break;
      case "treble":
        audioValue = audioData.treble || 0;
        break;
      case "full":
        audioValue = ((audioData.bass || 0) + (audioData.mid || 0) + (audioData.treble || 0)) / 3;
        break;
    }

    let shapes = (this as any).private.shapes;
    if (shapes.length !== params.count) {
      shapes = [];
      for (let i = 0; i < params.count; i++) {
        shapes.push({
          angle: (i / params.count) * Math.PI * 2,
          phase: i * 0.5,
          distance: 80 + i * 40
        });
      }
      (this as any).private.shapes = shapes;
    }

    context.save();
    context.globalAlpha = params.opacity;
    context.lineWidth = params.lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";

    if (params.glowIntensity > 0) {
      context.shadowBlur = params.glowIntensity;
    }

    shapes.forEach((shape: any, index: number) => {
      shape.angle += params.rotationSpeed * 0.02;
      const vibration = audioValue * params.vibrationIntensity;

      const x = centerX + Math.cos(shape.angle) * shape.distance;
      const y = centerY + Math.sin(shape.angle) * shape.distance;

      const size = params.baseSize + vibration;
      const hueOffset = (index / params.count) * 360;

      const gradient = context.createRadialGradient(x, y, 0, x, y, size);
      gradient.addColorStop(0, shiftHue(params.color1, hueOffset));
      gradient.addColorStop(1, shiftHue(params.color2, hueOffset + 180));

      context.strokeStyle = gradient;
      context.fillStyle = gradient;
      context.shadowColor = shiftHue(params.color1, hueOffset);

      context.save();
      context.translate(x, y);
      context.rotate(shape.angle + (this as any).private.time);

      drawShape(context, params.shapeType, size + vibration * Math.sin((this as any).private.time * 3 + shape.phase));

      if (params.fillMode === "fill" || params.fillMode === "both") {
        context.fill();
      }
      if (params.fillMode === "stroke" || params.fillMode === "both") {
        context.stroke();
      }

      context.restore();
    });

    context.restore();
  },
  resize() {},
  destroy() {}
};

function shiftHue(color: string, degrees: number): string {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const hsl = rgbToHsl(r, g, b);
  hsl.h = (hsl.h + degrees / 360) % 1;
  const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);

  return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}

function drawShape(ctx: CanvasRenderingContext2D, type: string, size: number) {
  ctx.beginPath();

  switch (type) {
    case "circle":
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(-size / 2, -size / 2, size, size);
      break;
    case "triangle":
      drawPolygon(ctx, 0, 0, size / 2, 3);
      break;
    case "star":
      drawStar(ctx, 0, 0, size / 2, size / 4, 5);
      break;
    case "hexagon":
      drawPolygon(ctx, 0, 0, size / 2, 6);
      break;
  }
}

function drawPolygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, sides: number) {
  ctx.moveTo(cx + radius * Math.cos(0), cy + radius * Math.sin(0));
  for (let i = 1; i <= sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  ctx.closePath();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, spikes: number) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

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
}
