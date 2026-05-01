import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

export const KaleidoscopeV8: EffectPlugin = {
  id: "kaleidoscope",
  name: "万花筒",
  category: "geometry",
  description: "镜像对称的万花筒效果",
  preferredEngine: "canvas",
  
  parameters: [
    {
      id: "segments",
      name: "分块数",
      type: "number",
      mode: "professional",
      min: 6,
      max: 24,
      step: 2,
      default: 12
    },
    {
      id: "mirrorCount",
      name: "镜像数量",
      type: "number",
      mode: "expert",
      min: 2,
      max: 8,
      step: 1,
      default: 4
    },
    {
      id: "zoom",
      name: "缩放",
      type: "number",
      mode: "professional",
      min: 0.5,
      max: 2,
      step: 0.1,
      default: 1
    },
    {
      id: "rotationSpeed",
      name: "旋转速度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.4
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
  },
  
  render(ctx: RenderContext, audioData: AudioData, params: Record<string, any>) {
    if (!ctx.ctx) return;
    
    const context = ctx.ctx;
    const width = ctx.width;
    const height = ctx.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    (this as any).time += ctx.deltaTime;
    
    const segments = params.segments ?? 12;
    const mirrorCount = params.mirrorCount ?? 4;
    const zoom = params.zoom ?? 1;
    const rotationSpeed = params.rotationSpeed ?? 0.4;
    const colorScheme = params.colorScheme ?? "rainbow";
    const glowIntensity = params.glowIntensity ?? 1;
    
    const avgEnergy = audioData.bass + audioData.mid + audioData.treble;
    const audioMultiplier = 0.5 + avgEnergy * 0.5;
    
    context.save();
    
    context.translate(centerX, centerY);
    
    const segmentAngle = (Math.PI * 2) / segments;
    const scale = Math.min(width, height) * 0.4 * zoom * audioMultiplier;
    const rotation = (this as any).time * rotationSpeed;
    
    if (glowIntensity > 0) {
      context.shadowBlur = 6 * glowIntensity;
    }
    
    for (let i = 0; i < segments; i++) {
      context.save();
      
      context.rotate(i * segmentAngle + rotation);
      
      for (let m = 0; m < mirrorCount; m++) {
        context.save();
        
        if (m % 2 === 1) {
          context.scale(-1, 1);
        }
        
        const drawShape = (depth: number) => {
          if (depth > 5) return;
          
          const t = (this as any).time + i * 0.1 + m * 0.05;
          const energy = (audioData.bass * (i % 3 === 0 ? 1 : 0.5) + 
                         audioData.mid * (i % 3 === 1 ? 1 : 0.5) + 
                         audioData.treble * (i % 3 === 2 ? 1 : 0.5)) / 3;
          
          let hue: number;
          switch (colorScheme) {
            case "fire":
              hue = ((i * 30 + t * 50) % 360) * 0.2 + 10;
              break;
            case "ocean":
              hue = 180 + ((i * 30 + t * 40) % 360) * 0.3;
              break;
            case "neon":
              hue = (i * 30 + t * 60 + energy * 50) % 360;
              break;
            default:
              hue = (i * 30 + t * 40) % 360;
          }
          
          const alpha = 0.6 - depth * 0.08;
          const size = scale * (0.8 - depth * 0.1) * (0.5 + energy * 0.5);
          
          context.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
          context.shadowColor = `hsla(${hue}, 100%, 60%, ${alpha})`;
          
          const shapeType = (i + m + depth) % 4;
          
          context.beginPath();
          
          switch (shapeType) {
            case 0:
              const points = 6 + depth;
              for (let p = 0; p <= points; p++) {
                const angle = (p / points) * Math.PI * 2 + t * 0.5;
                const r = size * (0.7 + 0.3 * Math.sin(angle * 3 + t));
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                if (p === 0) {
                  context.moveTo(x, y);
                } else {
                  context.lineTo(x, y);
                }
              }
              break;
              
            case 1:
              context.arc(0, 0, size, 0, Math.PI * 2);
              break;
              
            case 2:
              const sqSize = size * 0.8;
              context.rect(-sqSize, -sqSize, sqSize * 2, sqSize * 2);
              break;
              
            case 3:
              const spiralTurns = 2 + depth;
              for (let s = 0; s <= spiralTurns * 20; s++) {
                const angle = (s / 20) * Math.PI * 2 + t;
                const r = (s / (spiralTurns * 20)) * size * (0.5 + energy * 0.5);
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                if (s === 0) {
                  context.moveTo(x, y);
                } else {
                  context.lineTo(x, y);
                }
              }
              break;
          }
          
          context.closePath();
          context.fill();
          
          if (depth < 3) {
            const nextSize = size * 0.4;
            context.save();
            context.translate(nextSize * Math.sin(t + i), nextSize * Math.cos(t + m));
            drawShape(depth + 1);
            context.restore();
          }
        };
        
        drawShape(0);
        
        context.restore();
      }
      
      context.restore();
    }
    
    context.restore();
  },
  
  resize(width: number, height: number) {
  },
  
  destroy() {
    (this as any).time = 0;
  }
};
