import { EffectPlugin, RenderContext, AudioData } from "@/lib/visualization/types";

interface DustParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  alpha: number;
  color: number;
}

export const ParticleNebulaV8: EffectPlugin = {
  id: "particle-ambient-dust",
  name: "极简浮尘",
  category: "particles",
  description: "优雅的三维环境微粒漂浮效果",
  preferredEngine: "canvas",

  parameters: [
    {
      id: "particleCount",
      name: "微粒数量",
      type: "number",
      mode: "basic",
      min: 500,
      max: 5000,
      step: 500,
      default: 2000,
    },
    {
      id: "driftSpeed",
      name: "漂浮速度",
      type: "number",
      mode: "basic",
      min: 0.1,
      max: 2,
      step: 0.1,
      default: 0.5,
    },
    {
      id: "beatResponse",
      name: "节拍响应",
      type: "number",
      mode: "professional",
      min: 0,
      max: 2,
      step: 0.1,
      default: 0.8,
    },
    {
      id: "colorScheme",
      name: "色彩风格",
      type: "select",
      mode: "basic",
      options: [
        { label: "月光银", value: "moonlight" },
        { label: "暖阳金", value: "warmlight" },
        { label: "深海蓝", value: "deepsea" },
        { label: "极光绿", value: "aurora" },
      ],
      default: "moonlight",
    },
    {
      id: "glowIntensity",
      name: "发光强度",
      type: "number",
      mode: "professional",
      min: 0,
      max: 4,
      step: 0.2,
      default: 1.5,
    },
  ],

  init(ctx: RenderContext) {
    const particles = [] as DustParticle[];
    const time = 0;
    const lastBeatTime = 0;
    const beatIntensity = 0;

    const count = 2000;
    const baseHue: Record<string, number> = {
      moonlight: 220,
      warmlight: 35,
      deepsea: 200,
      aurora: 160,
    };

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = Math.pow(Math.random(), 0.5);

      particles.push({
        x: Math.sin(phi) * Math.cos(theta) * radius,
        y: Math.sin(phi) * Math.sin(theta) * radius,
        z: Math.cos(phi) * radius,
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.0003,
        vz: (Math.random() - 0.5) * 0.0001,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
        color: baseHue.moonlight + (Math.random() - 0.5) * 30,
      });
    }

    ctx.private = { particles, time, lastBeatTime, beatIntensity };
  },

  render(ctx: RenderContext, audioData: AudioData, params: Record<string, any>) {
    if (!ctx.ctx || !ctx.private) return;

    const context = ctx.ctx;
    const width = ctx.width;
    const height = ctx.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.private.time += ctx.deltaTime;

    const particleCount = params.particleCount ?? 2000;
    const driftSpeed = params.driftSpeed ?? 0.5;
    const beatResponse = params.beatResponse ?? 0.8;
    const colorScheme = params.colorScheme ?? "moonlight";
    const glowIntensity = params.glowIntensity ?? 1.5;

    const avgEnergy = (audioData.bass + audioData.mid + audioData.treble) / 3;
    const currentBeatIntensity = avgEnergy > 0.6 ? avgEnergy : ctx.private.beatIntensity * 0.95;
    ctx.private.beatIntensity = currentBeatIntensity;

    const baseHue: Record<string, number> = {
      moonlight: 220,
      warmlight: 35,
      deepsea: 200,
      aurora: 160,
    };

    // 确保 particles 数组存在
    if (!ctx.private.particles) {
      ctx.private.particles = [];
    }

    const particles = ctx.private.particles as DustParticle[];
    while (particles.length < particleCount) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = Math.pow(Math.random(), 0.5);

      particles.push({
        x: Math.sin(phi) * Math.cos(theta) * radius,
        y: Math.sin(phi) * Math.sin(theta) * radius,
        z: Math.cos(phi) * radius,
        vx: (Math.random() - 0.5) * 0.0003 * driftSpeed,
        vy: (Math.random() - 0.5) * 0.0003 * driftSpeed,
        vz: (Math.random() - 0.5) * 0.0001 * driftSpeed,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
        color: baseHue[colorScheme] + (Math.random() - 0.5) * 30,
      });
    }
    while (particles.length > particleCount) {
      particles.pop();
    }

    context.save();
    context.globalCompositeOperation = "screen";

    if (currentBeatIntensity > 0.3) {
      context.fillStyle = `rgba(${colorScheme === "warmlight" ? "255,200,100" : colorScheme === "deepsea" ? "100,150,255" : "200,220,255"}, ${currentBeatIntensity * 0.08})`;
      context.fillRect(0, 0, width, height);
    }

    if (glowIntensity > 0) {
      context.shadowBlur = 6 * glowIntensity;
    }

    const scale = Math.min(width, height) * 0.35 * (1 + currentBeatIntensity * beatResponse * 0.3);
    const rotAngle = ctx.private.time * 0.05 * driftSpeed;
    const rotCos = Math.cos(rotAngle);
    const rotSin = Math.sin(rotAngle);

    for (const particle of particles) {
      let x = particle.x;
      let y = particle.y;
      let z = particle.z;

      const newX = x * rotCos - y * rotSin;
      const newY = x * rotSin + y * rotCos;
      x = newX;
      y = newY;

      const rotAngle2 = ctx.private.time * 0.02 * driftSpeed;
      const rotCos2 = Math.cos(rotAngle2);
      const rotSin2 = Math.sin(rotAngle2);
      const newZ = z * rotCos2 - y * rotSin2;
      const newY2 = z * rotSin2 + y * rotCos2;
      z = newZ;
      y = newY2;

      particle.x = x + particle.vx * driftSpeed;
      particle.y = y + particle.vy * driftSpeed;
      particle.z = z + particle.vz * driftSpeed;

      const distance = Math.sqrt(x * x + y * y + z * z);
      if (distance > 1.3) {
        const factor = 1.3 / distance;
        particle.x *= factor;
        particle.y *= factor;
        particle.z *= factor;
      }

      const perspective = 1.8 / (1.8 - z);
      const screenX = centerX + x * scale * perspective;
      const screenY = centerY + y * scale * perspective;
      const screenSize =
        particle.size * perspective * (1 + currentBeatIntensity * beatResponse * 0.5);

      let hue = particle.color;
      switch (colorScheme) {
        case "moonlight":
          hue = (particle.color + ctx.private.time * 3) % 360;
          break;
        case "warmlight":
          hue = (particle.color + Math.sin(ctx.private.time * 0.5) * 10) % 360;
          break;
        case "deepsea":
          hue = (particle.color + ctx.private.time * 2) % 360;
          break;
        case "aurora":
          hue = (particle.color + ctx.private.time * 4 + avgEnergy * 20) % 360;
          break;
      }

      const alpha =
        particle.alpha * (0.4 + z * 0.4) * perspective * (0.6 + currentBeatIntensity * 0.4);

      context.fillStyle = `hsla(${hue}, 70%, 65%, ${alpha})`;
      context.shadowColor = `hsla(${hue}, 80%, 70%, ${alpha * 0.8})`;

      context.beginPath();
      context.arc(screenX, screenY, screenSize, 0, Math.PI * 2);
      context.fill();

      particle.alpha += (Math.random() - 0.5) * 0.01;
      particle.alpha = Math.max(0.1, Math.min(0.8, particle.alpha));
    }

    context.restore();
  },

  resize(width: number, height: number) {},

  destroy(ctx?: RenderContext) {
    if (ctx && ctx.private) {
      ctx.private.particles = [];
      ctx.private.time = 0;
    }
  },
};
