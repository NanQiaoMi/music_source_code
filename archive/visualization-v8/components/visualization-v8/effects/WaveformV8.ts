"use client";

import { EffectPlugin } from "@/lib/visualization/types";

export const WaveformV8Effect: EffectPlugin = {
  id: "waveform-v8",
  name: "流体波形",
  category: "spectrum",
  description: "Siri风格的流体光束波形",
  preferredEngine: "canvas",

  parameters: [
    {
      id: "waveCount",
      name: "波形数",
      type: "number",
      mode: "basic",
      min: 1,
      max: 5,
      step: 1,
      default: 3,
    },
    {
      id: "amplitude",
      name: "振幅",
      type: "number",
      mode: "basic",
      min: 0.3,
      max: 2,
      step: 0.1,
      default: 0.8,
    },
    {
      id: "lineWidth",
      name: "线宽",
      type: "number",
      mode: "professional",
      min: 1,
      max: 8,
      step: 0.5,
      default: 2.5,
    },
    {
      id: "color",
      name: "颜色",
      type: "color",
      mode: "basic",
      default: "#60a5fa",
    },
    {
      id: "glowIntensity",
      name: "光晕强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 8,
      step: 0.5,
      default: 3,
    },
    {
      id: "smoothing",
      name: "平滑度",
      type: "number",
      mode: "professional",
      min: 0.1,
      max: 0.95,
      step: 0.05,
      default: 0.75,
    },
    {
      id: "bassResponse",
      name: "低频响应",
      type: "number",
      mode: "professional",
      min: 0.5,
      max: 3,
      step: 0.1,
      default: 1.5,
    },
  ],

  init: (ctx) => {
    ctx.private!.smoothedData = new Float32Array(256).fill(128);
    ctx.private!.time = 0;
    console.log("WaveformV8 effect initialized");
  },

  render: (ctx, audioData, params) => {
    if (!ctx.ctx || !ctx.canvas || !ctx.private) return;

    const canvas = ctx.canvas;
    const context = ctx.ctx;
    const {
      waveCount = 3,
      amplitude = 0.8,
      lineWidth = 2.5,
      color = "#60a5fa",
      glowIntensity = 3,
      smoothing = 0.75,
      bassResponse = 1.5,
    } = params;

    context.globalCompositeOperation = "screen";

    context.fillStyle = "rgba(0, 0, 0, 0.15)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // 确保私有数据存在
    if (!ctx.private.time) ctx.private.time = 0;
    if (!ctx.private.smoothedData) {
      ctx.private.smoothedData = new Float32Array(256).fill(128);
    }

    ctx.private.time += ctx.deltaTime;

    const rawData = audioData.waveformData
      ? Array.from(audioData.waveformData)
      : Array.from({ length: 256 }, () => 128 + (Math.random() - 0.5) * 30);

    const smoothedData = ctx.private.smoothedData as Float32Array;
    for (let i = 0; i < Math.min(rawData.length, smoothedData.length); i++) {
      smoothedData[i] = smoothedData[i] * smoothing + rawData[i] * (1 - smoothing);
    }

    const bassBoost = 1 + audioData.bass * bassResponse;

    context.lineCap = "round";
    context.lineJoin = "round";

    if (glowIntensity > 0) {
      context.shadowBlur = glowIntensity * 12;
      context.shadowColor = color;
    }

    for (let wave = 0; wave < waveCount; wave++) {
      const waveProgress = wave / (waveCount - 1 || 1);
      const offsetY = (wave - (waveCount - 1) / 2) * (canvas.height * 0.12);
      const centerY = canvas.height / 2 + offsetY;
      const scaleY = canvas.height * 0.35 * amplitude * bassBoost;

      const phaseOffset = wave * 0.4;
      const frequencyMultiplier = 1 + wave * 0.3;

      const gradient = context.createLinearGradient(0, centerY - scaleY, 0, centerY + scaleY);
      const alpha = 0.6 - waveProgress * 0.3;
      gradient.addColorStop(0, `rgba(96, 165, 250, ${alpha})`);
      gradient.addColorStop(0.3, `rgba(147, 197, 253, ${alpha * 0.8})`);
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.6})`);
      gradient.addColorStop(0.7, `rgba(147, 197, 253, ${alpha * 0.8})`);
      gradient.addColorStop(1, `rgba(96, 165, 250, ${alpha})`);

      context.strokeStyle = gradient;
      context.lineWidth = lineWidth * (1 - waveProgress * 0.3);

      context.beginPath();

      const points: { x: number; y: number }[] = [];

      for (let i = 0; i < 128; i++) {
        const x = (i / 127) * canvas.width;
        const t = i / 127;
        const sineVal = Math.sin(t * Math.PI * 4 + phaseOffset + ctx.private!.time * 0.5) * 0.15;
        const dataIndex = Math.floor(t * (smoothedData.length - 1));
        const normalizedValue = (smoothedData[dataIndex] - 128) / 128;
        const y = centerY + normalizedValue * scaleY * (1 + sineVal * audioData.bass);
        points.push({ x, y });
      }

      if (points.length >= 4) {
        context.moveTo(points[0].x, points[0].y);

        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[Math.max(0, i - 1)];
          const p1 = points[i];
          const p2 = points[Math.min(points.length - 1, i + 1)];
          const p3 = points[Math.min(points.length - 1, i + 2)];

          const cp1x = p1.x + ((p2.x - p0.x) / 6) * frequencyMultiplier;
          const cp1y = p1.y + ((p2.y - p0.y) / 6) * frequencyMultiplier;
          const cp2x = p2.x - ((p3.x - p1.x) / 6) * frequencyMultiplier;
          const cp2y = p2.y - ((p3.y - p1.y) / 6) * frequencyMultiplier;

          context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
      }

      context.stroke();

      context.save();
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = `rgba(255, 255, 255, ${0.15 - waveProgress * 0.1})`;
      context.lineWidth = 0.5;
      context.stroke();
      context.restore();
    }

    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.shadowBlur = 0;
  },

  resize: (width, height) => {
    console.log(`WaveformV8 resized to ${width}x${height}`);
  },

  destroy: (ctx) => {
    if (ctx && ctx.private) {
      ctx.private.smoothedData = null;
      ctx.private.time = 0;
    }
    console.log("WaveformV8 effect destroyed");
  },
};
