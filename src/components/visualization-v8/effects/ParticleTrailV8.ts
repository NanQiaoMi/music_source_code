import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number; alpha: number }[];
  hue: number;
}

export const ParticleTrailV8: EffectPlugin = {
  id: "particle-trail",
  name: "粒子轨迹",
  category: "particles",
  description: "粒子留下发光轨迹",
  preferredEngine: "canvas",

  parameters: [
    {
      id: "particleCount",
      name: "粒子数量",
      type: "number",
      mode: "professional",
      min: 200,
      max: 2000,
      step: 100,
      default: 500,
    },
    {
      id: "trailLength",
      name: "轨迹长度",
      type: "number",
      mode: "professional",
      min: 10,
      max: 100,
      step: 5,
      default: 40,
    },
    {
      id: "speed",
      name: "移动速度",
      type: "number",
      mode: "professional",
      min: 1,
      max: 10,
      step: 0.5,
      default: 4,
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
        { label: "霓虹", value: "neon" },
      ],
      default: "rainbow",
    },
    {
      id: "glowIntensity",
      name: "光晕强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 5,
      step: 0.1,
      default: 2,
    },
  ],

  init(ctx: RenderContext) {
    (this as any).particles = [];
    (this as any).time = 0;

    const count = 500;
    for (let i = 0; i < count; i++) {
      (this as any).particles.push({
        x: Math.random() * ctx.width,
        y: Math.random() * ctx.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        trail: [],
        hue: Math.random() * 360,
      });
    }
  },

  render(ctx: RenderContext, audioData: AudioData, params: Record<string, any>) {
    if (!ctx.ctx) return;

    const context = ctx.ctx;
    const width = ctx.width;
    const height = ctx.height;

    (this as any).time += ctx.deltaTime;

    const particleCount = params.particleCount ?? 500;
    const trailLength = params.trailLength ?? 40;
    const speed = params.speed ?? 4;
    const colorScheme = params.colorScheme ?? "rainbow";
    const glowIntensity = params.glowIntensity ?? 2;

    const avgEnergy = audioData.bass + audioData.mid + audioData.treble;
    const audioMultiplier = 0.5 + avgEnergy * 0.5;

    while ((this as any).particles.length < particleCount) {
      (this as any).particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        trail: [],
        hue: Math.random() * 360,
      });
    }
    while ((this as any).particles.length > particleCount) {
      (this as any).particles.pop();
    }

    context.save();

    if (glowIntensity > 0) {
      context.shadowBlur = 8 * glowIntensity;
    }

    for (const particle of (this as any).particles) {
      const angleOffset =
        (Math.sin(particle.x * 0.01 + (this as any).time) +
          Math.cos(particle.y * 0.01 + (this as any).time * 0.7)) *
        0.5;

      const currentSpeed = speed * audioMultiplier;
      particle.vx += Math.cos(angleOffset) * 0.1 * currentSpeed;
      particle.vy += Math.sin(angleOffset) * 0.1 * currentSpeed;

      const maxSpeed = 6 * currentSpeed;
      const currentVelocity = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      if (currentVelocity > maxSpeed) {
        particle.vx = (particle.vx / currentVelocity) * maxSpeed;
        particle.vy = (particle.vy / currentVelocity) * maxSpeed;
      }

      particle.x += particle.vx;
      particle.y += particle.vy;

      particle.trail.unshift({ x: particle.x, y: particle.y, alpha: 1 });
      if (particle.trail.length > trailLength) {
        particle.trail.pop();
      }

      if (particle.x < -100) particle.x = width + 100;
      if (particle.x > width + 100) particle.x = -100;
      if (particle.y < -100) particle.y = height + 100;
      if (particle.y > height + 100) particle.y = -100;

      let hue = particle.hue;
      switch (colorScheme) {
        case "fire":
          hue = (particle.hue * 0.3 + 10 + audioData.bass * 50) % 360;
          break;
        case "ocean":
          hue = (180 + particle.hue * 0.3 + audioData.mid * 30) % 360;
          break;
        case "neon":
          hue = (particle.hue + (this as any).time * 30 + avgEnergy * 40) % 360;
          break;
        default:
          hue = (particle.hue + (this as any).time * 15 + avgEnergy * 25) % 360;
      }

      if (particle.trail.length > 1) {
        context.beginPath();
        for (let i = 0; i < particle.trail.length; i++) {
          const point = particle.trail[i];
          const alpha = (1 - i / particle.trail.length) * 0.8;
          context.strokeStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
          context.shadowColor = `hsla(${hue}, 100%, 60%, ${alpha})`;
          context.lineWidth = 2 + avgEnergy;

          if (i === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        }
        context.stroke();
      }

      const headAlpha = 0.9;
      context.fillStyle = `hsla(${hue}, 100%, 70%, ${headAlpha})`;
      context.shadowColor = `hsla(${hue}, 100%, 70%, ${headAlpha})`;
      const headSize = 3 + avgEnergy * 2;
      context.beginPath();
      context.arc(particle.x, particle.y, headSize, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  },

  resize(width: number, height: number) {},

  destroy() {
    (this as any).particles = [];
    (this as any).time = 0;
  },
};
