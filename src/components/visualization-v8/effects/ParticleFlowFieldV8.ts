import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface FlowFieldParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: number;
}

export const ParticleFlowFieldV8: EffectPlugin = {
  id: "particle-flow-field",
  name: "粒子流场",
  category: "particles",
  description: "粒子在动态流体场中流动",
  preferredEngine: "canvas",

  parameters: [
    {
      id: "particleCount",
      name: "粒子数量",
      type: "number",
      mode: "professional",
      min: 1000,
      max: 10000,
      step: 500,
      default: 3000,
    },
    {
      id: "flowSpeed",
      name: "流动速度",
      type: "number",
      mode: "professional",
      min: 0.1,
      max: 3,
      step: 0.1,
      default: 1,
    },
    {
      id: "turbulence",
      name: "湍流强度",
      type: "number",
      mode: "expert",
      min: 0,
      max: 2,
      step: 0.1,
      default: 0.8,
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
      max: 3,
      step: 0.1,
      default: 1,
    },
  ],

  init(ctx: RenderContext) {
    (this as any).particles = [];
    (this as any).time = 0;
    (this as any).fieldSize = 20;

    const cols = Math.ceil(ctx.width / (this as any).fieldSize) + 2;
    const rows = Math.ceil(ctx.height / (this as any).fieldSize) + 2;
    (this as any).field = Array(rows)
      .fill(0)
      .map(() => Array(cols).fill(0));

    const count = 3000;
    for (let i = 0; i < count; i++) {
      (this as any).particles.push({
        x: Math.random() * ctx.width,
        y: Math.random() * ctx.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: Math.random(),
        maxLife: 1,
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

    const particleCount = params.particleCount ?? 3000;
    const flowSpeed = params.flowSpeed ?? 1;
    const turbulence = params.turbulence ?? 0.8;
    const colorScheme = params.colorScheme ?? "rainbow";
    const glowIntensity = params.glowIntensity ?? 1;

    const avgEnergy = audioData.bass + audioData.mid + audioData.treble;
    const audioMultiplier = 0.5 + avgEnergy * 0.5;

    const cols = Math.ceil(width / (this as any).fieldSize) + 2;
    const rows = Math.ceil(height / (this as any).fieldSize) + 2;

    if ((this as any).field.length !== rows || (this as any).field[0]?.length !== cols) {
      (this as any).field = Array(rows)
        .fill(0)
        .map(() => Array(cols).fill(0));
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const noiseScale = 0.003;
        const angle =
          (Math.sin(x * noiseScale + (this as any).time * flowSpeed) * 2 +
            Math.cos(y * noiseScale + (this as any).time * flowSpeed * 0.7) * 2 +
            Math.sin((x + y) * noiseScale * 0.5 + (this as any).time * flowSpeed * 0.5) * 3) *
          Math.PI;
        (this as any).field[y][x] = angle;
      }
    }

    while ((this as any).particles.length < particleCount) {
      (this as any).particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: Math.random(),
        maxLife: 1,
        hue: Math.random() * 360,
      });
    }
    while ((this as any).particles.length > particleCount) {
      (this as any).particles.pop();
    }

    context.save();

    if (glowIntensity > 0) {
      context.shadowBlur = 5 * glowIntensity;
    }

    for (const particle of (this as any).particles) {
      const fieldX = Math.floor(particle.x / (this as any).fieldSize);
      const fieldY = Math.floor(particle.y / (this as any).fieldSize);

      const fx = Math.max(0, Math.min(cols - 1, fieldX));
      const fy = Math.max(0, Math.min(rows - 1, fieldY));

      const angle = (this as any).field[fy][fx];
      const speed = 2 * flowSpeed * audioMultiplier;

      particle.vx += Math.cos(angle) * 0.1 * speed;
      particle.vy += Math.sin(angle) * 0.1 * speed;

      const maxSpeed = 4 * speed;
      const currentSpeed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      if (currentSpeed > maxSpeed) {
        particle.vx = (particle.vx / currentSpeed) * maxSpeed;
        particle.vy = (particle.vy / currentSpeed) * maxSpeed;
      }

      const turboX = (Math.random() - 0.5) * turbulence * audioMultiplier;
      const turboY = (Math.random() - 0.5) * turbulence * audioMultiplier;
      particle.vx += turboX;
      particle.vy += turboY;

      particle.x += particle.vx;
      particle.y += particle.vy;

      particle.life -= 0.002;

      if (
        particle.life <= 0 ||
        particle.x < -50 ||
        particle.x > width + 50 ||
        particle.y < -50 ||
        particle.y > height + 50
      ) {
        particle.x = Math.random() * width;
        particle.y = Math.random() * height;
        particle.vx = (Math.random() - 0.5) * 2;
        particle.vy = (Math.random() - 0.5) * 2;
        particle.life = 1;
        particle.hue = Math.random() * 360;
      }

      const alpha = particle.life * 0.6;
      let hue = particle.hue;

      switch (colorScheme) {
        case "fire":
          hue = (particle.hue * 0.3 + 10 + audioData.bass * 50) % 360;
          break;
        case "ocean":
          hue = (180 + particle.hue * 0.3 + audioData.mid * 30) % 360;
          break;
        case "neon":
          hue = (particle.hue + (this as any).time * 20 + avgEnergy * 30) % 360;
          break;
        default:
          hue = (particle.hue + (this as any).time * 10 + avgEnergy * 20) % 360;
      }

      context.fillStyle = `hsla(${hue}, 100%, 60%, ${alpha})`;
      context.shadowColor = `hsla(${hue}, 100%, 60%, ${alpha})`;

      const size = 1.5 + avgEnergy;
      context.beginPath();
      context.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  },

  resize(width: number, height: number) {},

  destroy() {
    (this as any).particles = [];
    (this as any).field = [];
  },
};
