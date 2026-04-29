"use client";

import { EffectPlugin } from "@/lib/visualization/types";

interface HistoryFrame {
  values: number[];
  timestamp: number;
}

let history: HistoryFrame[] = [];
const maxHistoryLength = 200;

export const SpectrumWaterfallV8Effect: EffectPlugin = {
  id: "spectrum-waterfall-v8",
  name: "频谱瀑布",
  category: "spectrum",
  description: "频谱瀑布图效果",
  preferredEngine: "canvas",
  
  parameters: [
    {
      id: "barCount",
      name: "柱数",
      type: "number",
      mode: "basic",
      min: 32,
      max: 128,
      step: 8,
      default: 64
    },
    {
      id: "scrollSpeed",
      name: "滚动速度",
      type: "number",
      mode: "basic",
      min: 1,
      max: 10,
      step: 1,
      default: 3
    },
    {
      id: "intensityMultiplier",
      name: "强度倍数",
      type: "number",
      mode: "professional",
      min: 0.5,
      max: 3,
      step: 0.1,
      default: 1.5
    },
    {
      id: "colorScheme",
      name: "颜色方案",
      type: "select",
      mode: "basic",
      default: "rainbow",
      options: [
        { label: "彩虹", value: "rainbow" },
        { label: "火焰", value: "fire" },
        { label: "海洋", value: "ocean" },
        { label: "霓虹", value: "neon" }
      ]
    },
    {
      id: "glowIntensity",
      name: "光晕强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 3,
      step: 0.1,
      default: 0.3
    }
  ],
  
  init: (ctx) => {
    history = [];
    console.log("SpectrumWaterfallV8 effect initialized");
  },
  
  render: (ctx, audioData, params) => {
    if (!ctx.ctx || !ctx.canvas) return;
    
    const canvas = ctx.canvas;
    const context = ctx.ctx;
    const { 
      barCount = 64, 
      scrollSpeed = 3,
      intensityMultiplier = 1.5,
      colorScheme = "rainbow",
      glowIntensity = 0.3 
    } = params;
    
    const values = audioData.frequencyData 
      ? Array.from(audioData.frequencyData).slice(0, barCount)
      : Array.from({ length: barCount }, () => Math.random() * 255);
    
    history.push({
      values: [...values],
      timestamp: ctx.time
    });
    
    while (history.length > maxHistoryLength) {
      history.shift();
    }
    
    context.fillStyle = "rgba(0, 0, 0, 0.1)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = canvas.width / barCount;
    
    if (glowIntensity > 0) {
      context.shadowBlur = glowIntensity * 10;
    }
    
    for (let frameIndex = 0; frameIndex < history.length; frameIndex++) {
      const frame = history[frameIndex];
      const y = canvas.height - (frameIndex / history.length) * canvas.height;
      const nextY = canvas.height - ((frameIndex + 1) / history.length) * canvas.height;
      const alpha = frameIndex / history.length;
      
      for (let i = 0; i < barCount; i++) {
        const value = frame.values[i] * intensityMultiplier;
        const x = i * barWidth;
        
        let color: string;
        const normalizedValue = Math.min(1, value / 255);
        
        switch (colorScheme) {
          case "fire":
            const fireHue = 0 + normalizedValue * 60;
            color = `hsla(${fireHue}, 100%, ${50 + normalizedValue * 30}%, ${alpha})`;
            break;
          case "ocean":
            const oceanHue = 180 + normalizedValue * 60;
            color = `hsla(${oceanHue}, 80%, ${40 + normalizedValue * 40}%, ${alpha})`;
            break;
          case "neon":
            const neonHue = 280 + normalizedValue * 80;
            color = `hsla(${neonHue}, 100%, 60%, ${alpha})`;
            break;
          default:
            const hue = (i / barCount) * 360;
            color = `hsla(${hue}, 80%, ${50 + normalizedValue * 30}%, ${alpha})`;
        }
        
        context.shadowColor = color;
        context.fillStyle = color;
        context.fillRect(x, y, barWidth - 1, nextY - y);
      }
    }
    
    context.shadowBlur = 0;
  },
  
  resize: (width, height) => {
    history = [];
    console.log(`SpectrumWaterfallV8 resized to ${width}x${height}`);
  },
  
  destroy: () => {
    history = [];
    console.log("SpectrumWaterfallV8 effect destroyed");
  }
};
