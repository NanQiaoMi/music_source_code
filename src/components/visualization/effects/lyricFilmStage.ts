export type LyricFilmStageProfile =
  | "spotlight"
  | "prism"
  | "window"
  | "caustic"
  | "botanical"
  | "astral"
  | "motes";

export type LyricFilmStageTransitionKind = "lights-out" | "flare-cut" | "focus-pull";

export interface LyricFilmStageTransition {
  kind: LyricFilmStageTransitionKind;
  duration: number;
}

export interface LyricFilmStageInput {
  startTime: number;
  endTime: number;
  musicTime: number;
  seed: number;
  profile: LyricFilmStageProfile;
  transitionOut?: LyricFilmStageTransition | null;
  /** Multiplier for continuous stage motion; does not change shot-time progress. */
  motionSpeed?: number;
  isPlaying: boolean;
  reducedMotion: boolean;
}

export interface LyricFilmStageCamera {
  /** Scale multiplier for the entire stage composition. */
  zoom: number;
  /** Horizontal translation as a fraction of the viewport width. */
  x: number;
  /** Vertical translation as a fraction of the viewport height. */
  y: number;
  /** Small camera roll in radians. */
  rotation: number;
}

export interface LyricFilmStageTransitionFrame {
  kind: LyricFilmStageTransitionKind;
  /** Absolute-time progress, clamped to [0, 1]. */
  progress: number;
  /** Suggested opacity weights for callers compositing two shot frames. */
  outgoingOpacity: number;
  incomingOpacity: number;
  /** Black overlay amount for lights-out. */
  blackout: number;
  /** Warm white overlay amount for flare-cut. */
  flare: number;
  /** Focus emphasis for focus-pull, peaking near the middle of the transition. */
  focus: number;
}

export interface LyricFilmStageFrame {
  profile: LyricFilmStageProfile;
  seed: number;
  /** Normalized shot progress, clamped to [0, 1]. */
  progress: number;
  camera: LyricFilmStageCamera;
  beamAngle: number;
  beamIntensity: number;
  fogPhase: number;
  particlePhase: number;
  particleCount: number;
  transition: LyricFilmStageTransitionFrame | null;
}

export interface LyricFilmStageDrawInput {
  ctx: CanvasRenderingContext2D;
  frame: LyricFilmStageFrame;
  width: number;
  height: number;
  /** Device pixel ratio is used only to reduce decorative dust work. */
  dpr: number;
  /** Canvas compositing opacity for this shot, useful during a crossfade. */
  opacity?: number;
  /** Multiplier for stage lighting only; does not affect shot compositing opacity. */
  lightIntensity?: number;
  palette?: Partial<LyricFilmStagePalette>;
}

export interface LyricFilmStagePalette {
  deep: string;
  shadow: string;
  warm: string;
  cool: string;
  pale: string;
}

export const LYRIC_FILM_STAGE_LIMITS = {
  maxParticles: 18,
  minParticles: 6,
  minTransitionSeconds: 0.35,
  maxTransitionSeconds: 1.1,
  maxDprForBudget: 4,
  minMotionSpeed: 0,
  maxMotionSpeed: 2,
} as const;

const TAU = Math.PI * 2;
const DEFAULT_PALETTE: LyricFilmStagePalette = {
  deep: "#070a13",
  shadow: "#11182a",
  warm: "#f5c98d",
  cool: "#8ccdd5",
  pale: "#f3ead8",
};

const STAGE_PROFILES: readonly LyricFilmStageProfile[] = [
  "spotlight",
  "prism",
  "window",
  "caustic",
  "botanical",
  "astral",
  "motes",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function colorWithAlpha(color: string, alpha: number): string {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());
  if (!match) return color;

  const hex =
    match[1].length === 3 ? [...match[1]].map((part) => `${part}${part}`).join("") : match[1];
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1)})`;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function isStageProfile(value: string): value is LyricFilmStageProfile {
  return STAGE_PROFILES.includes(value as LyricFilmStageProfile);
}

function hashUnit(seed: number, salt: number): number {
  let value = (Math.trunc(finiteOr(seed, 0)) ^ Math.trunc(salt)) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
}

function wrapUnit(value: number): number {
  return value - Math.floor(value);
}

function isTransitionKind(value: string): value is LyricFilmStageTransitionKind {
  return value === "lights-out" || value === "flare-cut" || value === "focus-pull";
}

/**
 * Resolve a short transition against absolute music time. The same timestamp
 * always produces the same frame, including after a backward or forward seek.
 */
export function resolveLyricFilmTransitionFrame(
  transition: LyricFilmStageTransition | null | undefined,
  shotEndTime: number,
  musicTime: number,
  reducedMotion = false
): LyricFilmStageTransitionFrame | null {
  if (
    !transition ||
    !isTransitionKind(transition.kind) ||
    !Number.isFinite(shotEndTime) ||
    !Number.isFinite(musicTime) ||
    !Number.isFinite(transition.duration)
  ) {
    return null;
  }

  const duration = clamp(
    transition.duration,
    LYRIC_FILM_STAGE_LIMITS.minTransitionSeconds,
    LYRIC_FILM_STAGE_LIMITS.maxTransitionSeconds
  );
  const transitionStart = shotEndTime - duration;
  const progress = clamp((musicTime - transitionStart) / duration, 0, 1);
  const focus = Math.sin(Math.PI * progress);

  return {
    kind: transition.kind,
    progress,
    outgoingOpacity: 1 - progress,
    incomingOpacity: progress,
    blackout: transition.kind === "lights-out" ? progress : 0,
    flare: !reducedMotion && transition.kind === "flare-cut" ? focus : 0,
    focus: !reducedMotion && transition.kind === "focus-pull" ? focus : 0,
  };
}

/**
 * Resolve a deterministic stage frame from a shot and absolute music time.
 * No render history is retained, so seek, replay, and redraw remain stable.
 */
export function resolveLyricFilmStageFrame(input: LyricFilmStageInput): LyricFilmStageFrame {
  const startTime = finiteOr(input.startTime, 0);
  const requestedEndTime = finiteOr(input.endTime, startTime + 1);
  const endTime = Math.max(startTime + 0.001, requestedEndTime);
  const musicTime = finiteOr(input.musicTime, startTime);
  const seed = Math.trunc(finiteOr(input.seed, 0));
  const profile = isStageProfile(input.profile) ? input.profile : "spotlight";
  const duration = endTime - startTime;
  const progress = clamp((musicTime - startTime) / duration, 0, 1);
  const reducedMotion = Boolean(input.reducedMotion);
  const motionScale = reducedMotion ? 0 : input.isPlaying ? 1 : 0.16;
  const motionSpeed = clamp(
    finiteOr(input.motionSpeed ?? 1, 1),
    LYRIC_FILM_STAGE_LIMITS.minMotionSpeed,
    LYRIC_FILM_STAGE_LIMITS.maxMotionSpeed
  );
  const phaseRate = (0.72 + hashUnit(seed, 0x13a5) * 0.38) * motionSpeed;
  const particlePhase = reducedMotion ? 0 : progress * TAU * phaseRate;
  const fogPhase = reducedMotion ? 0 : particlePhase * 0.63 + hashUnit(seed, 0x27c1) * TAU;
  const cameraTravel = 0.5 - 0.5 * Math.cos(particlePhase);
  const cameraBaseZoom = 1.015 + hashUnit(seed, 0x386b) * 0.03;
  const cameraBaseX = (hashUnit(seed, 0x4a27) - 0.5) * 0.05;
  const cameraBaseY = (hashUnit(seed, 0x5b91) - 0.5) * 0.04;
  const cameraBaseRotation = (hashUnit(seed, 0x6d3b) - 0.5) * 0.006;
  const transition = resolveLyricFilmTransitionFrame(
    input.transitionOut,
    endTime,
    musicTime,
    reducedMotion
  );

  return {
    profile,
    seed,
    progress,
    camera: {
      zoom: cameraBaseZoom + motionScale * 0.035 * cameraTravel,
      x: cameraBaseX + motionScale * 0.035 * Math.sin(particlePhase * 0.5),
      y: cameraBaseY + motionScale * 0.025 * Math.sin(particlePhase * 0.58),
      rotation: cameraBaseRotation + motionScale * 0.003 * Math.sin(particlePhase * 0.35),
    },
    beamAngle:
      (hashUnit(seed, 0x7f19) - 0.5) * 0.48 + motionScale * 0.055 * Math.sin(particlePhase * 0.42),
    beamIntensity: clamp(
      0.64 + hashUnit(seed, 0x8d57) * 0.16 + motionScale * 0.08 * Math.sin(particlePhase),
      0.5,
      0.92
    ),
    fogPhase,
    particlePhase,
    particleCount: LYRIC_FILM_STAGE_LIMITS.maxParticles,
    transition,
  };
}

/** Return the bounded dust count used by the stage renderer for a given DPR. */
export function getLyricFilmStageParticleCount(dpr: number): number {
  const qualityDpr = clamp(finiteOr(dpr, 1), 1, LYRIC_FILM_STAGE_LIMITS.maxDprForBudget);
  return Math.max(
    LYRIC_FILM_STAGE_LIMITS.minParticles,
    Math.floor(LYRIC_FILM_STAGE_LIMITS.maxParticles / Math.sqrt(qualityDpr))
  );
}

function drawBeam(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  x: number,
  angle: number,
  widthRatio: number,
  color: string,
  alpha: number,
  opacity: number
): void {
  const topX = x + Math.tan(angle) * height * 0.48;
  const bottomHalfWidth = width * widthRatio;
  const gradient = ctx.createLinearGradient(topX, 0, x, height);
  gradient.addColorStop(0, colorWithAlpha(color, 0));
  gradient.addColorStop(0.24, colorWithAlpha(color, 0.14));
  gradient.addColorStop(1, colorWithAlpha(color, 0));

  ctx.save();
  ctx.globalAlpha = clamp(alpha * opacity, 0, 1);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(topX, 0);
  ctx.lineTo(x + bottomHalfWidth, height);
  ctx.lineTo(x - bottomHalfWidth, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFog(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phase: number,
  opacity: number,
  lightIntensity: number,
  palette: LyricFilmStagePalette
): void {
  for (let index = 0; index < 2; index += 1) {
    const x = width * (0.28 + index * 0.44) + Math.sin(phase + index * 2.1) * width * 0.025;
    const y = height * (0.72 - index * 0.06);
    const radiusX = width * (0.34 + index * 0.04);
    const radiusY = height * 0.24;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radiusX);
    gradient.addColorStop(
      0,
      colorWithAlpha(
        index === 0 ? palette.cool : palette.warm,
        (index === 0 ? 0.09 : 0.07) * lightIntensity
      )
    );
    gradient.addColorStop(1, colorWithAlpha(palette.deep, 0));

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX, radiusY, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawProfile(
  ctx: CanvasRenderingContext2D,
  frame: LyricFilmStageFrame,
  width: number,
  height: number,
  opacity: number,
  lightIntensity: number,
  palette: LyricFilmStagePalette
): void {
  const centerX = width * (0.5 + frame.camera.x * 0.24);
  const horizon = height * 0.68;
  const profileAlpha = clamp(0.42 * frame.beamIntensity * lightIntensity * opacity, 0, 1);

  ctx.save();
  ctx.globalAlpha = profileAlpha;
  ctx.strokeStyle = colorWithAlpha(palette.pale, 0.51);
  ctx.fillStyle = colorWithAlpha(palette.cool, 0.09);
  ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.0014);

  switch (frame.profile) {
    case "spotlight": {
      const spot = ctx.createRadialGradient(centerX, horizon, 0, centerX, horizon, width * 0.32);
      spot.addColorStop(0, colorWithAlpha(palette.warm, 0.16));
      spot.addColorStop(1, colorWithAlpha(palette.warm, 0));
      ctx.fillStyle = spot;
      ctx.beginPath();
      ctx.ellipse(centerX, horizon, width * 0.32, height * 0.1, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case "prism": {
      ctx.beginPath();
      ctx.moveTo(width * 0.34, height * 0.25);
      ctx.lineTo(width * 0.57, height * 0.3);
      ctx.lineTo(width * 0.47, height * 0.56);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(width * 0.48, height * 0.55);
      ctx.lineTo(width * 0.85, height * 0.73);
      ctx.stroke();
      break;
    }
    case "window": {
      const slatWidth = width * 0.035;
      for (let index = 0; index < 3; index += 1) {
        const x = width * (0.24 + index * 0.08);
        ctx.fillRect(x, height * 0.12, slatWidth, height * 0.52);
        ctx.beginPath();
        ctx.moveTo(x + slatWidth, height * 0.12);
        ctx.lineTo(x + slatWidth * 0.75, height * 0.64);
        ctx.stroke();
      }
      break;
    }
    case "caustic": {
      for (let index = 0; index < 6; index += 1) {
        const x = width * (0.2 + index * 0.12);
        const y = height * (0.68 + Math.sin(index * 1.7 + frame.fogPhase) * 0.045);
        ctx.beginPath();
        ctx.ellipse(x, y, width * 0.075, height * 0.028, -0.12 + index * 0.04, 0, Math.PI * 1.55);
        ctx.stroke();
      }
      break;
    }
    case "botanical": {
      for (let stemIndex = 0; stemIndex < 3; stemIndex += 1) {
        const stemX = width * (0.18 + stemIndex * 0.31);
        const direction = stemIndex === 1 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(stemX, height * 0.88);
        ctx.bezierCurveTo(
          stemX + direction * width * 0.05,
          height * 0.68,
          stemX - direction * width * 0.02,
          height * 0.42,
          stemX + direction * width * 0.07,
          height * 0.2
        );
        ctx.stroke();
        for (let leaf = 0; leaf < 2; leaf += 1) {
          const y = height * (0.61 - leaf * 0.16);
          ctx.beginPath();
          ctx.ellipse(
            stemX + direction * width * 0.035,
            y,
            width * 0.028,
            height * 0.012,
            direction * -0.38,
            0,
            TAU
          );
          ctx.stroke();
        }
      }
      break;
    }
    case "astral": {
      const stars = [
        [0.18, 0.25],
        [0.35, 0.19],
        [0.53, 0.29],
        [0.71, 0.17],
        [0.82, 0.36],
      ] as const;
      ctx.beginPath();
      stars.forEach(([x, y], index) => {
        const px = width * x;
        const py = height * y;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        ctx.moveTo(px + 3, py);
        ctx.arc(px, py, 3, 0, TAU);
      });
      ctx.stroke();
      break;
    }
    case "motes":
      // The motes profile leaves the stage mostly empty for sparse interludes.
      break;
  }

  ctx.restore();
}

function drawDust(
  ctx: CanvasRenderingContext2D,
  frame: LyricFilmStageFrame,
  width: number,
  height: number,
  dpr: number,
  opacity: number,
  lightIntensity: number,
  palette: LyricFilmStagePalette
): void {
  const count = Math.min(frame.particleCount, getLyricFilmStageParticleCount(dpr));
  ctx.save();
  ctx.fillStyle = palette.pale;

  for (let index = 0; index < count; index += 1) {
    const xBase = hashUnit(frame.seed, index * 0x1f123 + 0x31a7);
    const yBase = hashUnit(frame.seed, index * 0x2c927 + 0x43d9);
    const driftX =
      frame.particlePhase === 0 ? 0 : Math.sin(frame.particlePhase + index * 1.73) * 0.012;
    const driftY =
      frame.particlePhase === 0 ? 0 : Math.cos(frame.particlePhase * 0.68 + index * 1.19) * 0.02;
    const x = wrapUnit(xBase + driftX) * width;
    const y = wrapUnit(yBase + driftY) * height;
    const radius = 0.45 + hashUnit(frame.seed, index * 0x3aa51 + 0x56e1) * 1.25;

    ctx.globalAlpha = clamp(
      (0.12 + hashUnit(frame.seed, index * 0x4b127 + 0x67f3) * 0.24) * opacity * lightIntensity,
      0,
      1
    );
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
}

function drawTransitionOverlay(
  ctx: CanvasRenderingContext2D,
  transition: LyricFilmStageTransitionFrame | null,
  width: number,
  height: number,
  opacity: number,
  lightIntensity: number,
  palette: LyricFilmStagePalette
): void {
  if (!transition) return;

  if (transition.blackout > 0) {
    ctx.save();
    ctx.globalAlpha = transition.blackout * opacity;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  if (transition.flare > 0) {
    const flare = ctx.createRadialGradient(
      width * 0.5,
      height * 0.48,
      0,
      width * 0.5,
      height * 0.48,
      Math.max(width, height) * 0.72
    );
    flare.addColorStop(0, colorWithAlpha(palette.pale, 0.85));
    flare.addColorStop(0.45, colorWithAlpha(palette.warm, 0.44));
    flare.addColorStop(1, colorWithAlpha(palette.warm, 0));
    ctx.save();
    ctx.globalAlpha = clamp(transition.flare * 0.72 * opacity * lightIntensity, 0, 1);
    ctx.fillStyle = flare;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  if (transition.focus > 0) {
    const focus = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * (0.12 + transition.focus * 0.24),
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.72
    );
    focus.addColorStop(0, colorWithAlpha(palette.deep, 0));
    focus.addColorStop(1, colorWithAlpha(palette.deep, (36 + transition.focus * 54) / 255));
    ctx.save();
    ctx.globalAlpha = 0.8 * opacity;
    ctx.fillStyle = focus;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

/** Draw a lightweight, asset-free Canvas 2D stage behind the current lyric shot. */
export function drawLyricFilmStage(input: LyricFilmStageDrawInput): void {
  const { ctx, frame } = input;
  const width = finiteOr(input.width, 0);
  const height = finiteOr(input.height, 0);
  const opacity = clamp(finiteOr(input.opacity ?? 1, 1), 0, 1);
  const lightIntensity = clamp(finiteOr(input.lightIntensity ?? 1, 1), 0, 1.5);
  if (width <= 0 || height <= 0 || opacity <= 0) return;

  const palette: LyricFilmStagePalette = { ...DEFAULT_PALETTE, ...input.palette };
  const dpr = finiteOr(input.dpr, 1);
  const { camera } = frame;

  ctx.save();
  ctx.globalAlpha = 1;
  const backdrop = ctx.createLinearGradient(0, 0, 0, height);
  backdrop.addColorStop(0, palette.deep);
  backdrop.addColorStop(0.58, palette.shadow);
  backdrop.addColorStop(1, palette.deep);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);

  const centralGlow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.47,
    0,
    width * 0.5,
    height * 0.47,
    Math.max(width, height) * 0.65
  );
  centralGlow.addColorStop(0, colorWithAlpha(palette.cool, 0.13 * lightIntensity));
  centralGlow.addColorStop(0.55, colorWithAlpha(palette.shadow, 0.07 * lightIntensity));
  centralGlow.addColorStop(1, colorWithAlpha(palette.deep, 0));
  ctx.globalAlpha = opacity;
  ctx.fillStyle = centralGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 1;
  ctx.translate(width * (0.5 + camera.x), height * (0.5 + camera.y));
  ctx.rotate(camera.rotation);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-width * 0.5, -height * 0.5);

  const beamCount = frame.profile === "window" ? 3 : frame.profile === "prism" ? 4 : 2;
  for (let index = 0; index < beamCount; index += 1) {
    const spread = (index - (beamCount - 1) / 2) * 0.17;
    const x = width * (0.5 + Math.sin(frame.beamAngle + spread) * 0.22);
    const color = index % 2 === 0 ? palette.warm : palette.cool;
    drawBeam(
      ctx,
      width,
      height,
      x,
      frame.beamAngle + spread,
      0.11 + index * 0.01,
      color,
      frame.beamIntensity * lightIntensity,
      opacity
    );
  }

  drawFog(ctx, width, height, frame.fogPhase, opacity, lightIntensity, palette);
  drawProfile(ctx, frame, width, height, opacity, lightIntensity, palette);

  ctx.save();
  ctx.globalAlpha = clamp(0.24 * opacity * lightIntensity, 0, 1);
  ctx.strokeStyle = colorWithAlpha(palette.pale, 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width * 0.08, height * 0.78);
  ctx.lineTo(width * 0.92, height * 0.78);
  ctx.stroke();
  ctx.restore();

  drawDust(ctx, frame, width, height, dpr, opacity, lightIntensity, palette);
  ctx.restore();

  ctx.save();
  drawTransitionOverlay(ctx, frame.transition, width, height, opacity, lightIntensity, palette);
  ctx.restore();
}
