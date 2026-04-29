"use client";

import { EffectPlugin } from "@/lib/visualization/types";

export const AudioShapeV8Effect: EffectPlugin = {
  id: "audio-shape-v8",
  name: "音频形状",
  category: "shapes",
  description: "音频反应的动态几何形状",
  preferredEngine: "canvas",
  
  parameters: [
    {
      id: "shapeType",
      name: "形状类型",
      type: "select",
      mode: "basic",
      default: "circle",
      options: [
        { label: "圆形", value: "circle" },
        { label: "方形", value: "square" },
        { label: "三角形", value: "triangle" },
        { label: "星形", value: "star" }
      ]
    },
    {
      id: "shapeCount",
      name: "形状数量",
      type: "number",
      mode: "basic",
      min: 1,
      max: 20,
      step: 1,
      default: 5
    },
    {
      id: "vibrationIntensity",
      name: "振动强度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 100,
      step: 5,
      default: 30
    },
    {
      id: "rotationSpeed",
      name: "旋转速度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 5,
      step: 0.1,
      default: 0.3
    },
    {
      id: "color",
      name: "颜色",
      type: "color",
      mode: "basic",
      default: "#a855f7"
    },
    {
      id: "glowIntensity",
      name: "光晕强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 5,
      step: 0.1,
      default: 1
    }
  ],
  
  init: (ctx) => {
    console.log("AudioShapeV8 effect initialized");
  },
  
  render: (ctx, audioData, params) => {
    if (!ctx.ctx || !ctx.canvas) return;
    
    const canvas = ctx.canvas;
    const context = ctx.ctx;
    const { 
      shapeType = "circle", 
      shapeCount = 5, 
      vibrationIntensity = 30,
      rotationSpeed = 0.3,
      color = "#a855f7", 
      glowIntensity = 1 
    } = params;
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const energy = audioData.full || 0.3;
    const bassEnergy = audioData.bass || 0;
    
    if (glowIntensity > 0) {
      context.shadowBlur = glowIntensity * 20;
      context.shadowColor = color;
    }
    
    const drawShape = (
      x: number, 
      y: number, 
      size: number, 
      rotation: number, 
      type: string
    ) => {
      context.save();
      context.translate(x, y);
      context.rotate(rotation);
      
      context.beginPath();
      
      switch (type) {
        case "square":
          const halfSize = size / 2;
          context.rect(-halfSize, -halfSize, size, size);
          break;
          
        case "triangle":
          context.moveTo(0, -size);
          context.lineTo(size * 0.866, size * 0.5);
          context.lineTo(-size * 0.866, size * 0.5);
          context.closePath();
          break;
          
        case "star":
          for (let i = 0; i < 10; i++) {
            const radius = i % 2 === 0 ? size : size * 0.5;
            const angle = (i * Math.PI * 2) / 10 - Math.PI / 2;
            if (i === 0) {
              context.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            } else {
              context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
          }
          context.closePath();
          break;
          
        default:
          context.arc(0, 0, size, 0, Math.PI * 2);
      }
      
      context.stroke();
      context.restore();
    };
    
    for (let i = 0; i < shapeCount; i++) {
      const layerRotation = ctx.time * rotationSpeed + (i * Math.PI * 2) / shapeCount;
      const layerDistance = (i + 1) * (canvas.height / (shapeCount + 1) / 2);
      
      const layerX = centerX + Math.cos(layerRotation) * layerDistance;
      const layerY = centerY + Math.sin(layerRotation) * layerDistance;
      
      const baseSize = 30 + i * 15;
      const sizeMod = 1 + energy * 0.5 + bassEnergy * 0.3;
      const size = baseSize * sizeMod;
      
      const vibration = (energy * vibrationIntensity * (i + 1)) / shapeCount;
      const finalX = layerX + Math.sin(ctx.time * 5 + i) * vibration;
      const finalY = layerY + Math.cos(ctx.time * 5 + i * 0.7) * vibration;
      
      const hue = (color.startsWith("#") ? 270 : parseInt(color));
      const gradient = context.createRadialGradient(finalX, finalY, 0, finalX, finalY, size);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.7, color);
      gradient.addColorStop(1, `hsla(${hue}, 70%, 50%, 0)`);
      
      context.strokeStyle = gradient;
      context.lineWidth = 3;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.globalAlpha = 0.8 - (i / shapeCount) * 0.3;
      
      drawShape(finalX, finalY, size, layerRotation * 2, shapeType);
    }
    
    const centerSize = 50 + energy * 50 + bassEnergy * 30;
    const centerGradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, centerSize);
    centerGradient.addColorStop(0, color);
    centerGradient.addColorStop(0.5, color);
    centerGradient.addColorStop(1, "transparent");
    
    context.strokeStyle = centerGradient;
    context.lineWidth = 4;
    context.globalAlpha = 1;
    drawShape(centerX, centerY, centerSize, ctx.time * rotationSpeed, shapeType);
    
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  },
  
  resize: (width, height) => {
    console.log(`AudioShapeV8 resized to ${width}x${height}`);
  },
  
  destroy: () => {
    console.log("AudioShapeV8 effect destroyed");
  }
};
