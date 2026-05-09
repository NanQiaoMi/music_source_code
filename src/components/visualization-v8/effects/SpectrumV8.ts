"use client";

import { EffectPlugin } from "@/lib/visualization/types";

export const SpectrumV8Effect: EffectPlugin = {
  id: "spectrum-modern",
  name: "镜像频谱",
  category: "spectrum",
  description: "现代胶囊状频谱柱可视化",
  preferredEngine: "canvas",

  parameters: [
    {
      id: "barCount",
      name: "柱数",
      type: "number",
      mode: "basic",
      min: 16,
      max: 128,
      step: 8,
      default: 48,
    },
    {
      id: "barWidth",
      name: "柱宽",
      type: "number",
      mode: "basic",
      min: 4,
      max: 40,
      step: 2,
      default: 12,
    },
    {
      id: "barSpacing",
      name: "柱间距",
      type: "number",
      mode: "professional",
      min: 1,
      max: 16,
      step: 1,
      default: 4,
    },
    {
      id: "color",
      name: "颜色",
      type: "color",
      mode: "basic",
      default: "#a855f7",
    },
    {
      id: "glowIntensity",
      name: "光晕强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 6,
      step: 0.5,
      default: 2,
    },
    {
      id: "smoothing",
      name: "平滑衰减",
      type: "number",
      mode: "professional",
      min: 0.1,
      max: 0.95,
      step: 0.05,
      default: 0.8,
    },
    {
      id: "mirror",
      name: "镜像显示",
      type: "boolean",
      mode: "basic",
      default: true,
    },
  ],

  init: (ctx) => {
    ctx.private!.smoothedBars = new Float32Array(128).fill(0);
    console.log("SpectrumV8 effect initialized");
  },

  render: (ctx, audioData, params) => {
    if (!ctx.ctx || !ctx.canvas || !ctx.private) return;

    const canvas = ctx.canvas;
    const context = ctx.ctx;
    const {
      barCount = 48,
      barWidth = 12,
      barSpacing = 4,
      color = "#a855f7",
      glowIntensity = 2,
      smoothing = 0.8,
      mirror = true,
    } = params;

    context.globalCompositeOperation = "screen";

    context.fillStyle = "rgba(0, 0, 0, 0.2)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const rawValues = audioData.frequencyData
      ? Array.from(audioData.frequencyData).slice(0, barCount)
      : Array.from({ length: barCount }, () => Math.random() * 200 + 55);

    // 确保 smoothedBars 存在
    if (!ctx.private.smoothedBars) {
      ctx.private.smoothedBars = new Float32Array(128).fill(0);
    }

    const smoothedBars = ctx.private.smoothedBars as Float32Array;
    for (let i = 0; i < Math.min(rawValues.length, smoothedBars.length); i++) {
      const rawHeight = rawValues[i] / 255;
      smoothedBars[i] = smoothedBars[i] * smoothing + rawHeight * (1 - smoothing);
    }

    const totalWidth = barCount * (barWidth + barSpacing);
    const startX = (canvas.width - totalWidth) / 2;
    const centerY = canvas.height / 2;
    const maxBarHeight = canvas.height * 0.4;

    if (glowIntensity > 0) {
      context.shadowBlur = glowIntensity * 10;
      context.shadowColor = color;
    }

    const parseColor = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : { r: 168, g: 85, b: 247 };
    };

    const rgb = parseColor(color);

    context.save();

    for (let i = 0; i < barCount; i++) {
      const barHeight = Math.max(4, smoothedBars[i] * maxBarHeight);
      const x = startX + i * (barWidth + barSpacing);

      const gradient = context.createLinearGradient(x, centerY - barHeight, x, centerY);
      const alpha = 0.4 + smoothedBars[i] * 0.6;
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
      gradient.addColorStop(
        0.4,
        `rgba(${rgb.r + 50}, ${rgb.g + 50}, ${rgb.b + 50}, ${alpha * 0.8})`
      );
      gradient.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.5})`);

      context.fillStyle = gradient;

      context.beginPath();
      const radius = barWidth / 2;
      const topY = centerY - barHeight;
      context.moveTo(x + radius, topY);
      context.arcTo(x + barWidth, topY, x + barWidth, centerY, radius);
      context.lineTo(x + barWidth, centerY);
      context.lineTo(x, centerY);
      context.lineTo(x, topY);
      context.arcTo(x, topY, x + radius, topY, radius);
      context.closePath();
      context.fill();

      if (mirror) {
        const mirrorGradient = context.createLinearGradient(
          x,
          centerY,
          x,
          centerY + barHeight * 0.6
        );
        mirrorGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.4})`);
        mirrorGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

        context.fillStyle = mirrorGradient;

        context.beginPath();
        const mirrorHeight = barHeight * 0.6;
        const mirrorY = centerY;
        context.moveTo(x + radius, mirrorY);
        context.arcTo(x + barWidth, mirrorY, x + barWidth, mirrorY + mirrorHeight, radius);
        context.lineTo(x + barWidth, mirrorY + mirrorHeight);
        context.lineTo(x, mirrorY + mirrorHeight);
        context.lineTo(x, mirrorY);
        context.arcTo(x, mirrorY, x + radius, mirrorY, radius);
        context.closePath();
        context.fill();
      }
    }

    context.restore();

    context.save();
    context.globalCompositeOperation = "screen";
    context.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.03)`;
    context.fillRect(startX - 20, centerY - maxBarHeight, totalWidth + 40, maxBarHeight * 2.6);
    context.restore();

    context.globalCompositeOperation = "source-over";
    context.shadowBlur = 0;
  },

  resize: (width, height) => {
    console.log(`SpectrumV8 resized to ${width}x${height}`);
  },

  destroy: (ctx) => {
    if (ctx && ctx.private) {
      ctx.private.smoothedBars = null;
    }
    console.log("SpectrumV8 effect destroyed");
  },
};
