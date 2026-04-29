"use client";

import { EffectPlugin, EffectParameterDefinition } from "@/lib/visualization/types";

export const AudioCrystalV8Effect: EffectPlugin = {
  id: "audio-crystal-v8",
  name: "音频水晶",
  category: "shapes",
  description: "3D水晶效果，音频驱动折射",
  preferredEngine: "canvas",
  parameters: [
    {
      id: "crystalType",
      name: "水晶类型",
      type: "select",
      mode: "basic",
      default: "diamond",
      options: [
        { label: "钻石", value: "diamond" },
        { label: "八面体", value: "octahedron" },
        { label: "立方体", value: "cube" },
        { label: "十二面体", value: "dodecahedron" }
      ]
    },
    {
      id: "crystalSize",
      name: "水晶大小",
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
      default: "crystal",
      options: [
        { label: "水晶", value: "crystal" },
        { label: "红宝石", value: "ruby" },
        { label: "蓝宝石", value: "sapphire" },
        { label: "祖母绿", value: "emerald" }
      ]
    },
    {
      id: "refraction",
      name: "折射强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 2,
      step: 0.1,
      default: 1
    },
    {
      id: "lineWidth",
      name: "线条宽度",
      type: "number",
      mode: "professional",
      min: 1,
      max: 5,
      step: 0.5,
      default: 2
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

    context.fillStyle = "black";
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(centerX, centerY);
    context.rotate((this as any).private.time * params.rotationSpeed);

    const size = params.crystalSize * audioMultiplier;
    const colors = getCrystalColors(params.colorScheme);

    context.lineWidth = params.lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";

    drawCrystal(context, params.crystalType, size, colors, params.refraction * audioMultiplier, params.fillOpacity);

    context.restore();
  },
  resize() {},
  destroy() {}
};

function getCrystalColors(scheme: string) {
  switch (scheme) {
    case "crystal":
      return ["#00ffff", "#00ff99", "#00ccff", "#66ffff"];
    case "ruby":
      return ["#ff0066", "#ff3399", "#cc0033", "#ff6699"];
    case "sapphire":
      return ["#0066ff", "#0099ff", "#0033cc", "#6699ff"];
    case "emerald":
      return ["#00ff66", "#33ff99", "#00cc33", "#66ff99"];
    default:
      return ["#00ffff", "#00ff99", "#00ccff", "#66ffff"];
  }
}

function drawCrystal(ctx: CanvasRenderingContext2D, type: string, size: number, colors: string[], refraction: number, opacity: number) {
  switch (type) {
    case "diamond":
      drawDiamond(ctx, size, colors, opacity);
      break;
    case "octahedron":
      drawOctahedron(ctx, size, colors, opacity);
      break;
    case "cube":
      drawCube(ctx, size, colors, opacity);
      break;
    case "dodecahedron":
      drawDodecahedron(ctx, size, colors, opacity);
      break;
  }
}

function drawDiamond(ctx: CanvasRenderingContext2D, size: number, colors: string[], opacity: number) {
  const faces = [
    [{ x: 0, y: -size }, { x: size * 0.8, y: 0 }, { x: 0, y: size * 0.3 }],
    [{ x: 0, y: -size }, { x: -size * 0.8, y: 0 }, { x: 0, y: size * 0.3 }],
    [{ x: 0, y: -size }, { x: size * 0.8, y: 0 }, { x: 0, y: -size * 0.2 }],
    [{ x: 0, y: -size }, { x: -size * 0.8, y: 0 }, { x: 0, y: -size * 0.2 }],
    [{ x: size * 0.8, y: 0 }, { x: 0, y: size * 0.5 }, { x: -size * 0.8, y: 0 }]
  ];

  faces.forEach((face, i) => {
    ctx.beginPath();
    ctx.moveTo(face[0].x, face[0].y);
    face.forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    
    ctx.strokeStyle = colors[i % colors.length];
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = opacity;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  });
}

function drawOctahedron(ctx: CanvasRenderingContext2D, size: number, colors: string[], opacity: number) {
  const vertices = [
    { x: 0, y: -size },
    { x: size, y: 0 },
    { x: 0, y: size },
    { x: -size, y: 0 }
  ];

  const faces = [
    [0, 1, 3],
    [1, 2, 3],
    [0, 1, 2],
    [0, 2, 3]
  ];

  faces.forEach((face, i) => {
    ctx.beginPath();
    ctx.moveTo(vertices[face[0]].x, vertices[face[0]].y);
    face.forEach(idx => ctx.lineTo(vertices[idx].x, vertices[idx].y));
    ctx.closePath();
    
    ctx.strokeStyle = colors[i % colors.length];
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = opacity;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  });
}

function drawCube(ctx: CanvasRenderingContext2D, size: number, colors: string[], opacity: number) {
  const s = size * 0.7;
  const offset = size * 0.3;
  
  const faces = [
    [{ x: -s, y: -s - offset }, { x: s, y: -s - offset }, { x: s, y: s - offset }, { x: -s, y: s - offset }],
    [{ x: -s + offset, y: -s }, { x: s + offset, y: -s }, { x: s + offset, y: s }, { x: -s + offset, y: s }],
    [{ x: -s, y: -s - offset }, { x: s, y: -s - offset }, { x: s + offset, y: -s }, { x: -s + offset, y: -s }]
  ];

  faces.forEach((face, i) => {
    ctx.beginPath();
    ctx.moveTo(face[0].x, face[0].y);
    face.forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    
    ctx.strokeStyle = colors[i % colors.length];
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = opacity;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  });
}

function drawDodecahedron(ctx: CanvasRenderingContext2D, size: number, colors: string[], opacity: number) {
  const sides = 12;
  const innerRadius = size * 0.4;
  const outerRadius = size;

  for (let i = 0; i < sides; i++) {
    const angle1 = (i / sides) * Math.PI * 2;
    const angle2 = ((i + 1) / sides) * Math.PI * 2;
    
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle1) * outerRadius, Math.sin(angle1) * outerRadius);
    ctx.lineTo(Math.cos(angle1) * innerRadius, Math.sin(angle1) * innerRadius);
    ctx.lineTo(Math.cos(angle2) * innerRadius, Math.sin(angle2) * innerRadius);
    ctx.lineTo(Math.cos(angle2) * outerRadius, Math.sin(angle2) * outerRadius);
    ctx.closePath();
    
    ctx.strokeStyle = colors[i % colors.length];
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = opacity;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  }
}
