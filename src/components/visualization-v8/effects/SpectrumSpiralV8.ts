import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

export const SpectrumSpiralV8: EffectPlugin = {
  id: "spectrum-spiral",
  name: "频谱螺旋",
  category: "spectrum",
  description: "频谱呈螺旋状排列",
  preferredEngine: "canvas",
  
  parameters: [
    {
      id: "spiralTurns",
      name: "螺旋圈数",
      type: "number",
      mode: "professional",
      min: 1,
      max: 5,
      step: 0.5,
      default: 3
    },
    {
      id: "barCount",
      name: "柱数",
      type: "number",
      mode: "professional",
      min: 32,
      max: 128,
      step: 16,
      default: 64
    },
    {
      id: "rotationSpeed",
      name: "旋转速度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 2,
      step: 0.1,
      default: 0.8
    },
    {
      id: "expansionRate",
      name: "扩张速率",
      type: "number",
      mode: "expert",
      min: 0.5,
      max: 3,
      step: 0.1,
      default: 1.2
    },
    {
      id: "colorScheme",
      name: "颜色方案",
      type: "select",
      mode: "basic",
      options: [
        { label: "彩虹", value: "rainbow" },
        { label: "火焰", value: "fire" },
        { label: "海洋", value: "ocean" },
        { label: "霓虹", value: "neon" }
      ],
      default: "rainbow"
    },
    {
      id: "glowIntensity",
      name: "光晕强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 3,
      step: 0.1,
      default: 1
    }
  ],
  
  init(ctx: RenderContext) {
    (this as any).time = 0;
    (this as any).history = [];
  },
  
  render(ctx: RenderContext, audioData: AudioData, params: Record<string, any>) {
    if (!ctx.ctx) return;
    
    const context = ctx.ctx;
    const width = ctx.width;
    const height = ctx.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    (this as any).time += ctx.deltaTime;
    
    const spiralTurns = params.spiralTurns ?? 3;
    const barCount = params.barCount ?? 64;
    const rotationSpeed = params.rotationSpeed ?? 0.8;
    const expansionRate = params.expansionRate ?? 1.2;
    const colorScheme = params.colorScheme ?? "rainbow";
    const glowIntensity = params.glowIntensity ?? 1;
    
    const avgEnergy = audioData.bass + audioData.mid + audioData.treble;
    const audioMultiplier = 0.5 + avgEnergy * 0.5;
    
    (this as any).history.push({
      bass: audioData.bass,
      mid: audioData.mid,
      treble: audioData.treble
    });
    if ((this as any).history.length > 60) {
      (this as any).history.shift();
    }
    
    context.save();
    
    context.translate(centerX, centerY);
    context.rotate((this as any).time * rotationSpeed);
    
    if (glowIntensity > 0) {
      context.shadowBlur = 6 * glowIntensity;
    }
    
    const maxRadius = Math.min(width, height) * 0.4 * audioMultiplier;
    const baseRadius = maxRadius * 0.1;
    
    for (let i = 0; i < barCount; i++) {
      const t = i / barCount;
      const angle = t * Math.PI * 2 * spiralTurns;
      const radius = baseRadius + (maxRadius - baseRadius) * Math.pow(t, expansionRate);
      
      const frequencyIndex = Math.floor((i / barCount) * audioData.frequencyData.length);
      const frequencyValue = audioData.frequencyData[frequencyIndex] / 255;
      
      const barHeight = frequencyValue * maxRadius * 0.6 * (0.5 + audioMultiplier);
      const barWidth = (maxRadius / barCount) * 2 * (0.8 + avgEnergy * 0.5);
      
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      let hue: number;
      switch (colorScheme) {
        case "fire":
          hue = (t * 120 + 10 + audioData.bass * 50) % 360;
          break;
        case "ocean":
          hue = (180 + t * 120 + audioData.mid * 40) % 360;
          break;
        case "neon":
          hue = (t * 360 + (this as any).time * 50 + avgEnergy * 40) % 360;
          break;
        default:
          hue = (t * 360 + (this as any).time * 30) % 360;
      }
      
      const saturation = 85 + avgEnergy * 15;
      const lightness = 50 + frequencyValue * 20;
      const alpha = 0.7 + frequencyValue * 0.3;
      
      context.save();
      context.translate(x, y);
      context.rotate(angle + Math.PI / 2);
      
      context.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
      context.shadowColor = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
      
      context.beginPath();
      context.roundRect(-barWidth / 2, 0, barWidth, barHeight, barWidth / 4);
      context.fill();
      
      context.restore();
    }
    
    for (let layer = 0; layer < 3; layer++) {
      context.save();
      context.rotate((this as any).time * rotationSpeed * (1 + layer * 0.3));
      context.globalAlpha = 0.15 - layer * 0.04;
      
      const historyIndex = Math.max(0, (this as any).history.length - 1 - layer * 10);
      const historyData = (this as any).history[historyIndex] || { bass: 0, mid: 0, treble: 0 };
      const layerEnergy = historyData.bass + historyData.mid + historyData.treble;
      
      for (let i = 0; i < barCount / 2; i++) {
        const t = i / (barCount / 2);
        const angle = t * Math.PI * 2 * spiralTurns * (1 - layer * 0.2);
        const radius = baseRadius + (maxRadius - baseRadius) * Math.pow(t, expansionRate) * (0.6 - layer * 0.1);
        
        const frequencyIndex = Math.floor((i / (barCount / 2)) * audioData.frequencyData.length);
        const frequencyValue = audioData.frequencyData[frequencyIndex] / 255;
        
        const barHeight = frequencyValue * maxRadius * 0.4 * (0.5 + layerEnergy * 0.3);
        const barWidth = (maxRadius / barCount) * 3 * (0.7 - layer * 0.1);
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        let hue: number;
        switch (colorScheme) {
          case "fire":
            hue = ((t * 120 + layer * 30) + 10) % 360;
            break;
          case "ocean":
            hue = (180 + t * 120 + layer * 20) % 360;
            break;
          case "neon":
            hue = (t * 360 + (this as any).time * 40 + layer * 50) % 360;
            break;
          default:
            hue = (t * 360 + (this as any).time * 25 + layer * 40) % 360;
        }
        
        context.fillStyle = `hsla(${hue}, 100%, 60%, 1)`;
        context.shadowColor = `hsla(${hue}, 100%, 60%, 1)`;
        
        context.save();
        context.translate(x, y);
        context.rotate(angle + Math.PI / 2);
        
        context.beginPath();
        context.roundRect(-barWidth / 2, 0, barWidth, barHeight, barWidth / 4);
        context.fill();
        
        context.restore();
      }
      
      context.restore();
    }
    
    context.restore();
  },
  
  resize(width: number, height: number) {
  },
  
  destroy() {
    (this as any).history = [];
    (this as any).time = 0;
  }
};
