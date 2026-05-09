"use client";

import { EffectPlugin } from "@/lib/visualization/types";

export const RingSpectrumV8Effect: EffectPlugin = {
  id: "ring-spectrum-v8",
  name: "环形频谱",
  category: "spectrum",
  description: "环形频谱可视化效果",
  preferredEngine: "canvas",

  parameters: [
    {
      id: "ringCount",
      name: "环数",
      type: "number",
      mode: "basic",
      min: 1,
      max: 8,
      step: 1,
      default: 3,
    },
    {
      id: "barCount",
      name: "柱数",
      type: "number",
      mode: "basic",
      min: 32,
      max: 128,
      step: 8,
      default: 64,
    },
    {
      id: "innerRadius",
      name: "内半径",
      type: "number",
      mode: "professional",
      min: 50,
      max: 200,
      step: 10,
      default: 100,
    },
    {
      id: "rotationSpeed",
      name: "旋转速度",
      type: "number",
      mode: "basic",
      min: 0,
      max: 5,
      step: 0.1,
      default: 0.5,
    },
    {
      id: "color",
      name: "颜色",
      type: "color",
      mode: "basic",
      default: "#ec4899",
    },
    {
      id: "glowIntensity",
      name: "光晕强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 5,
      step: 0.1,
      default: 1,
    },
  ],

  init: (ctx) => {
    console.log("RingSpectrumV8 effect initialized");
  },

  render: (ctx, audioData, params) => {
    if (!ctx.ctx || !ctx.canvas) return;

    const canvas = ctx.canvas;
    const context = ctx.ctx;
    const {
      ringCount = 3,
      barCount = 64,
      innerRadius = 100,
      rotationSpeed = 0.5,
      color = "#ec4899",
      glowIntensity = 1,
    } = params;

    context.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(canvas.width, canvas.height) / 2 - 50;

    const values = audioData.frequencyData
      ? Array.from(audioData.frequencyData).slice(0, barCount)
      : Array.from({ length: barCount }, () => Math.random() * 255);

    if (glowIntensity > 0) {
      context.shadowBlur = glowIntensity * 20;
      context.shadowColor = color;
    }

    for (let ring = 0; ring < ringCount; ring++) {
      const ringStartRadius = innerRadius + ring * ((maxRadius - innerRadius) / ringCount);
      const ringEndRadius = ringStartRadius + (maxRadius - innerRadius) / ringCount - 5;

      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 + ctx.time * rotationSpeed;
        const barHeight = (values[i] / 255) * (ringEndRadius - ringStartRadius);

        const startRadius = ringStartRadius;
        const endRadius = ringStartRadius + barHeight;

        const gradient = context.createLinearGradient(
          centerX + Math.cos(angle) * startRadius,
          centerY + Math.sin(angle) * startRadius,
          centerX + Math.cos(angle) * endRadius,
          centerY + Math.sin(angle) * endRadius
        );

        const hue = color.startsWith("#") ? 330 : parseInt(color);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, `hsla(${hue}, 80%, 40%, 0.3)`);

        context.strokeStyle = gradient;
        context.lineWidth = (Math.PI * 2 * (startRadius + endRadius)) / 2 / barCount - 2;
        context.lineCap = "round";

        context.beginPath();
        context.arc(centerX, centerY, startRadius + barHeight / 2, angle - 0.01, angle + 0.01);
        context.stroke();
      }
    }

    context.shadowBlur = 0;
  },

  resize: (width, height) => {
    console.log(`RingSpectrumV8 resized to ${width}x${height}`);
  },

  destroy: (ctx) => {
    console.log("RingSpectrumV8 effect destroyed");
  },
};
