export type HaloSkinId = "aurora" | "vinyl" | "pulse";
export type HaloRenderMode = "animated" | "static";

export interface HaloPaintContext {
  canvas: {
    width: number;
    height: number;
  };
  clearRect: (x: number, y: number, width: number, height: number) => void;
  beginPath: () => void;
  arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number) => void;
  stroke: () => void;
  fill: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  save: () => void;
  restore: () => void;
  translate: (x: number, y: number) => void;
  rotate: (angle: number) => void;
  createRadialGradient: (
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number
  ) => CanvasGradient;
  fillStyle: string | CanvasGradient;
  strokeStyle: string | CanvasGradient;
  globalAlpha: number;
  lineWidth: number;
}

export interface HaloPaintInput {
  level: number;
  currentTime: number;
  renderMode: HaloRenderMode;
}

export interface HaloRenderBudget {
  targetFps: number;
  reducedMotion: boolean;
}

export interface HaloSkin {
  id: HaloSkinId;
  name: string;
  description: string;
  accent: string;
  paint: (ctx: HaloPaintContext, input: HaloPaintInput) => void;
}

const TAU = Math.PI * 2;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function radiusFor(ctx: HaloPaintContext, scale: number): number {
  return (Math.min(ctx.canvas.width, ctx.canvas.height) / 2) * scale;
}

function drawRing(
  ctx: HaloPaintContext,
  radius: number,
  color: string,
  alpha: number,
  lineWidth: number
) {
  const centerX = ctx.canvas.width / 2;
  const centerY = ctx.canvas.height / 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, TAU);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawSpoke(ctx: HaloPaintContext, angle: number, innerRadius: number, outerRadius: number) {
  const centerX = ctx.canvas.width / 2;
  const centerY = ctx.canvas.height / 2;
  ctx.beginPath();
  ctx.moveTo(centerX + Math.cos(angle) * innerRadius, centerY + Math.sin(angle) * innerRadius);
  ctx.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
  ctx.stroke();
}

function paintAurora(ctx: HaloPaintContext, input: HaloPaintInput) {
  const level = clamp01(input.level);
  const spin = input.renderMode === "animated" ? input.currentTime * 0.65 : 0;
  const coreRadius = radiusFor(ctx, 0.42);
  const outerRadius = radiusFor(ctx, 0.74 + level * 0.06);
  const gradient = ctx.createRadialGradient(
    ctx.canvas.width / 2,
    ctx.canvas.height / 2,
    coreRadius * 0.4,
    ctx.canvas.width / 2,
    ctx.canvas.height / 2,
    outerRadius
  );

  gradient.addColorStop(0, "rgba(45, 212, 191, 0.08)");
  gradient.addColorStop(0.56, "rgba(168, 85, 247, 0.24)");
  gradient.addColorStop(1, "rgba(236, 72, 153, 0)");

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(ctx.canvas.width / 2, ctx.canvas.height / 2, outerRadius, 0, TAU);
  ctx.fill();
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.rotate(spin);
  ctx.translate(-ctx.canvas.width / 2, -ctx.canvas.height / 2);
  drawRing(ctx, coreRadius + level * 3, "rgba(45, 212, 191, 0.75)", 0.7, 2.25);
  drawRing(ctx, outerRadius, "rgba(236, 72, 153, 0.58)", 0.5, 1.5);
  ctx.restore();
}

function paintVinyl(ctx: HaloPaintContext, input: HaloPaintInput) {
  const level = clamp01(input.level);
  const rotation = input.renderMode === "animated" ? input.currentTime * 0.35 : 0;
  const innerRadius = radiusFor(ctx, 0.36);
  const outerRadius = radiusFor(ctx, 0.72);

  ctx.save();
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.rotate(rotation);
  ctx.translate(-ctx.canvas.width / 2, -ctx.canvas.height / 2);
  drawRing(ctx, innerRadius, "rgba(245, 245, 245, 0.68)", 0.55, 1.25);
  drawRing(ctx, innerRadius + 7, "rgba(148, 163, 184, 0.45)", 0.45, 1);
  drawRing(ctx, outerRadius, "rgba(250, 204, 21, 0.46)", 0.45 + level * 0.2, 2);
  ctx.strokeStyle = "rgba(250, 204, 21, 0.5)";
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.25;
  for (let i = 0; i < 12; i += 1) {
    drawSpoke(ctx, (i / 12) * TAU, outerRadius - 6, outerRadius + 3 + level * 4);
  }
  ctx.restore();
}

function paintPulse(ctx: HaloPaintContext, input: HaloPaintInput) {
  const level = clamp01(input.level);
  const animatedPulse =
    input.renderMode === "animated" ? (Math.sin(input.currentTime * 4) + 1) / 2 : 0.35;
  const baseRadius = radiusFor(ctx, 0.5);
  const pulseRadius = radiusFor(ctx, 0.64 + level * 0.12 + animatedPulse * 0.08);

  drawRing(ctx, baseRadius, "rgba(96, 165, 250, 0.72)", 0.7, 2.5);
  drawRing(ctx, pulseRadius, "rgba(244, 114, 182, 0.58)", 0.36 + level * 0.3, 2);
  drawRing(ctx, pulseRadius + 5, "rgba(34, 211, 238, 0.3)", 0.25, 1.25);
}

export const HALO_SKINS: HaloSkin[] = [
  {
    id: "aurora",
    name: "Aurora",
    description: "Soft cyan and magenta glow for spacious tracks.",
    accent: "rgb(45, 212, 191)",
    paint: paintAurora,
  },
  {
    id: "vinyl",
    name: "Vinyl",
    description: "A subtle record-ring treatment with warm spokes.",
    accent: "rgb(250, 204, 21)",
    paint: paintVinyl,
  },
  {
    id: "pulse",
    name: "Pulse",
    description: "Responsive blue and pink rings for energetic playback.",
    accent: "rgb(96, 165, 250)",
    paint: paintPulse,
  },
];

export function getHaloSkin(id: string | null | undefined): HaloSkin {
  return HALO_SKINS.find((skin) => skin.id === id) ?? HALO_SKINS[0];
}

export function getHaloRenderMode({ targetFps, reducedMotion }: HaloRenderBudget): HaloRenderMode {
  return reducedMotion || targetFps < 30 ? "static" : "animated";
}

export function paintHaloPreview(ctx: HaloPaintContext, skin: HaloSkin, input: HaloPaintInput) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  skin.paint(ctx, input);
  ctx.restore();
}
