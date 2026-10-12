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

export type LyricFilmStageRigGeometry =
  | "followspot-truss"
  | "prism-scrim"
  | "arched-window"
  | "water-reflector"
  | "botanical-edges"
  | "astral-arch"
  | "minimal-side-rig";

export interface LyricFilmStageLight {
  kind: "beam" | "pool";
  color: "warm" | "cool" | "pale";
  /** Normalized light source point; pools use their landing point for both. */
  x1: number;
  y1: number;
  /** Normalized light target or pool center. */
  x2: number;
  y2: number;
  /** Beam half-width or pool radius, relative to the viewport width. */
  width: number;
  intensity: number;
}

export interface LyricFilmStageRig {
  geometry: LyricFilmStageRigGeometry;
  lights: readonly LyricFilmStageLight[];
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

const STAGE_RIGS: Record<LyricFilmStageProfile, LyricFilmStageRig> = {
  spotlight: {
    geometry: "followspot-truss",
    lights: [
      {
        kind: "beam",
        color: "warm",
        x1: 0.16,
        y1: 0.08,
        x2: 0.27,
        y2: 0.76,
        width: 0.075,
        intensity: 0.72,
      },
      {
        kind: "beam",
        color: "cool",
        x1: 0.84,
        y1: 0.09,
        x2: 0.74,
        y2: 0.74,
        width: 0.07,
        intensity: 0.5,
      },
      {
        kind: "pool",
        color: "warm",
        x1: 0.27,
        y1: 0.82,
        x2: 0.27,
        y2: 0.82,
        width: 0.15,
        intensity: 0.68,
      },
      {
        kind: "pool",
        color: "cool",
        x1: 0.74,
        y1: 0.82,
        x2: 0.74,
        y2: 0.82,
        width: 0.13,
        intensity: 0.34,
      },
    ],
  },
  prism: {
    geometry: "prism-scrim",
    lights: [
      {
        kind: "beam",
        color: "cool",
        x1: 0.12,
        y1: 0.16,
        x2: 0.32,
        y2: 0.73,
        width: 0.065,
        intensity: 0.62,
      },
      {
        kind: "beam",
        color: "warm",
        x1: 0.88,
        y1: 0.15,
        x2: 0.68,
        y2: 0.73,
        width: 0.065,
        intensity: 0.62,
      },
      {
        kind: "pool",
        color: "cool",
        x1: 0.34,
        y1: 0.82,
        x2: 0.34,
        y2: 0.82,
        width: 0.12,
        intensity: 0.52,
      },
      {
        kind: "pool",
        color: "warm",
        x1: 0.66,
        y1: 0.82,
        x2: 0.66,
        y2: 0.82,
        width: 0.12,
        intensity: 0.48,
      },
    ],
  },
  window: {
    geometry: "arched-window",
    lights: [
      {
        kind: "beam",
        color: "warm",
        x1: 0.94,
        y1: 0.16,
        x2: 0.76,
        y2: 0.78,
        width: 0.085,
        intensity: 0.76,
      },
      {
        kind: "beam",
        color: "pale",
        x1: 0.83,
        y1: 0.16,
        x2: 0.66,
        y2: 0.75,
        width: 0.05,
        intensity: 0.38,
      },
      {
        kind: "pool",
        color: "warm",
        x1: 0.76,
        y1: 0.83,
        x2: 0.76,
        y2: 0.83,
        width: 0.15,
        intensity: 0.72,
      },
    ],
  },
  caustic: {
    geometry: "water-reflector",
    lights: [
      {
        kind: "pool",
        color: "cool",
        x1: 0.18,
        y1: 0.83,
        x2: 0.18,
        y2: 0.83,
        width: 0.16,
        intensity: 0.66,
      },
      {
        kind: "pool",
        color: "pale",
        x1: 0.5,
        y1: 0.88,
        x2: 0.5,
        y2: 0.88,
        width: 0.17,
        intensity: 0.4,
      },
      {
        kind: "pool",
        color: "warm",
        x1: 0.82,
        y1: 0.82,
        x2: 0.82,
        y2: 0.82,
        width: 0.15,
        intensity: 0.58,
      },
    ],
  },
  botanical: {
    geometry: "botanical-edges",
    lights: [
      {
        kind: "beam",
        color: "warm",
        x1: 0.08,
        y1: 0.2,
        x2: 0.23,
        y2: 0.75,
        width: 0.07,
        intensity: 0.48,
      },
      {
        kind: "beam",
        color: "cool",
        x1: 0.92,
        y1: 0.22,
        x2: 0.77,
        y2: 0.75,
        width: 0.07,
        intensity: 0.48,
      },
      {
        kind: "pool",
        color: "warm",
        x1: 0.23,
        y1: 0.84,
        x2: 0.23,
        y2: 0.84,
        width: 0.13,
        intensity: 0.46,
      },
      {
        kind: "pool",
        color: "cool",
        x1: 0.77,
        y1: 0.84,
        x2: 0.77,
        y2: 0.84,
        width: 0.13,
        intensity: 0.46,
      },
    ],
  },
  astral: {
    geometry: "astral-arch",
    lights: [
      {
        kind: "beam",
        color: "pale",
        x1: 0.21,
        y1: 0.1,
        x2: 0.28,
        y2: 0.72,
        width: 0.055,
        intensity: 0.42,
      },
      {
        kind: "beam",
        color: "cool",
        x1: 0.79,
        y1: 0.1,
        x2: 0.72,
        y2: 0.72,
        width: 0.055,
        intensity: 0.42,
      },
      {
        kind: "pool",
        color: "pale",
        x1: 0.5,
        y1: 0.86,
        x2: 0.5,
        y2: 0.86,
        width: 0.12,
        intensity: 0.34,
      },
    ],
  },
  motes: {
    geometry: "minimal-side-rig",
    lights: [
      {
        kind: "beam",
        color: "warm",
        x1: 0.06,
        y1: 0.32,
        x2: 0.2,
        y2: 0.86,
        width: 0.045,
        intensity: 0.28,
      },
      {
        kind: "beam",
        color: "cool",
        x1: 0.94,
        y1: 0.32,
        x2: 0.8,
        y2: 0.86,
        width: 0.045,
        intensity: 0.28,
      },
      {
        kind: "pool",
        color: "warm",
        x1: 0.5,
        y1: 0.91,
        x2: 0.5,
        y2: 0.91,
        width: 0.12,
        intensity: 0.18,
      },
    ],
  },
};

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

/**
 * Resolve profile-specific practicals and fixtures. Seed and beam angle only
 * add a small repeatable sway, so profile identity remains legible on every seek.
 */
export function resolveLyricFilmStageRig(
  profile: LyricFilmStageProfile,
  seed: number,
  beamAngle = 0
): LyricFilmStageRig {
  const base = STAGE_RIGS[isStageProfile(profile) ? profile : "spotlight"];
  const validSeed = Math.trunc(finiteOr(seed, 0));
  const validAngle = finiteOr(beamAngle, 0);

  return {
    geometry: base.geometry,
    lights: base.lights.map((light, index) => {
      const seedSway = (hashUnit(validSeed, 0x2183 + index * 0x173) - 0.5) * 0.012;
      const shotSway = Math.sin(validAngle) * 0.012 * (index % 2 === 0 ? 1 : -1);
      const sway = seedSway + shotSway;
      return {
        ...light,
        x1: light.x1 + (light.kind === "beam" ? sway : 0),
        x2: clamp(light.x2 + sway, 0.02, 0.98),
      };
    }),
  };
}

function distanceToSegment(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { distance: number; progress: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const progress =
    lengthSquared === 0 ? 0 : clamp(((x - x1) * dx + (y - y1) * dy) / lengthSquared, 0, 1);
  return {
    distance: Math.hypot(x - (x1 + progress * dx), y - (y1 + progress * dy)),
    progress,
  };
}

/** Sample the repeatable 0..1 stage light field in normalized stage coordinates. */
export function sampleLyricFilmIllumination(
  frame: LyricFilmStageFrame,
  xRatio: number,
  yRatio: number
): number {
  if (!Number.isFinite(xRatio) || !Number.isFinite(yRatio)) return 0;

  const x = clamp(xRatio, 0, 1);
  const y = clamp(yRatio, 0, 1);
  const rig = resolveLyricFilmStageRig(frame.profile, frame.seed, frame.beamAngle);
  let illumination = 0.035;

  for (const light of rig.lights) {
    if (light.kind === "pool") {
      const radiusY = light.width * 0.58;
      const ellipseDistance = Math.hypot((x - light.x2) / light.width, (y - light.y2) / radiusY);
      illumination += light.intensity * frame.beamIntensity * Math.exp(-0.5 * ellipseDistance ** 2);
      continue;
    }

    const { distance, progress } = distanceToSegment(x, y, light.x1, light.y1, light.x2, light.y2);
    const beamWidth = Math.max(0.018, light.width * (0.34 + progress * 0.66));
    const beamFalloff = Math.exp(-0.5 * (distance / beamWidth) ** 2);
    illumination += light.intensity * frame.beamIntensity * (0.24 + progress * 0.76) * beamFalloff;
  }

  return clamp(illumination, 0, 1);
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
  const shotTravel = progress * progress * (3 - 2 * progress);
  const zoomDirection = hashUnit(seed, 0x386b) < 0.5 ? -1 : 1;
  const panDirection = hashUnit(seed, 0x4a27) < 0.5 ? -1 : 1;
  const cameraBaseZoom = 1.06 + hashUnit(seed, 0x5b91) * 0.015;
  const cameraBaseX = (hashUnit(seed, 0x6d3b) - 0.5) * 0.036;
  const cameraBaseY = (hashUnit(seed, 0x7c41) - 0.5) * 0.024;
  const cameraBaseRotation = (hashUnit(seed, 0x8a37) - 0.5) * 0.006;
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
      zoom: cameraBaseZoom + motionScale * motionSpeed * zoomDirection * 0.052 * shotTravel,
      x: cameraBaseX + motionScale * motionSpeed * panDirection * 0.055 * shotTravel,
      y:
        cameraBaseY +
        motionScale * motionSpeed * (hashUnit(seed, 0x9b13) < 0.5 ? -1 : 1) * 0.012 * shotTravel,
      rotation:
        cameraBaseRotation +
        motionScale * motionSpeed * (hashUnit(seed, 0xa73d) - 0.5) * 0.003 * shotTravel,
    },
    beamAngle:
      (hashUnit(seed, 0x7f19) - 0.5) * 0.36 +
      motionScale * motionSpeed * (hashUnit(seed, 0xb26f) - 0.5) * 0.08 * shotTravel,
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

function stageLightColor(light: LyricFilmStageLight, palette: LyricFilmStagePalette): string {
  if (light.color === "warm") return palette.warm;
  if (light.color === "cool") return palette.cool;
  return palette.pale;
}

function drawStageLight(
  ctx: CanvasRenderingContext2D,
  light: LyricFilmStageLight,
  frame: LyricFilmStageFrame,
  width: number,
  height: number,
  opacity: number,
  lightIntensity: number,
  palette: LyricFilmStagePalette
): void {
  const color = stageLightColor(light, palette);
  const contribution = clamp(
    opacity * lightIntensity * frame.beamIntensity * light.intensity,
    0,
    1
  );
  const targetX = width * light.x2;
  const targetY = height * light.y2;

  ctx.save();
  if (light.kind === "pool") {
    const radiusX = width * light.width;
    const radiusY = Math.min(height * 0.14, radiusX * 0.42);
    const glow = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, radiusX);
    glow.addColorStop(0, colorWithAlpha(color, 0.19));
    glow.addColorStop(0.42, colorWithAlpha(color, 0.09));
    glow.addColorStop(1, colorWithAlpha(color, 0));
    ctx.globalAlpha = contribution;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(targetX, targetY, radiusX, radiusY, -0.06, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }

  const sourceX = width * light.x1;
  const sourceY = height * light.y1;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  const sourceHalfWidth = width * light.width * 0.2;
  const targetHalfWidth = width * light.width * 0.82;
  const beam = ctx.createLinearGradient(sourceX, sourceY, targetX, targetY);
  beam.addColorStop(0, colorWithAlpha(color, 0));
  beam.addColorStop(0.46, colorWithAlpha(color, 0.13));
  beam.addColorStop(1, colorWithAlpha(color, 0));

  ctx.globalAlpha = contribution;
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(sourceX + normalX * sourceHalfWidth, sourceY + normalY * sourceHalfWidth);
  ctx.lineTo(targetX + normalX * targetHalfWidth, targetY + normalY * targetHalfWidth);
  ctx.lineTo(targetX - normalX * targetHalfWidth, targetY - normalY * targetHalfWidth);
  ctx.lineTo(sourceX - normalX * sourceHalfWidth, sourceY - normalY * sourceHalfWidth);
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
    const x = width * (0.24 + index * 0.52) + Math.sin(phase + index * 2.1) * width * 0.018;
    const y = height * (0.84 - index * 0.025);
    const radiusX = width * (0.24 + index * 0.035);
    const radiusY = height * 0.13;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radiusX);
    gradient.addColorStop(
      0,
      colorWithAlpha(
        index === 0 ? palette.cool : palette.warm,
        (index === 0 ? 0.06 : 0.045) * lightIntensity
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
  const profileAlpha = clamp(0.32 * frame.beamIntensity * lightIntensity * opacity, 0, 1);

  ctx.save();
  ctx.globalAlpha = profileAlpha;
  ctx.strokeStyle = colorWithAlpha(palette.pale, 0.58);
  ctx.fillStyle = colorWithAlpha(palette.cool, 0.12);
  ctx.lineWidth = Math.max(1, Math.min(width, height) * 0.0012);

  switch (frame.profile) {
    case "spotlight": {
      ctx.beginPath();
      ctx.moveTo(width * 0.11, height * 0.105);
      ctx.lineTo(width * 0.89, height * 0.105);
      ctx.moveTo(width * 0.16, height * 0.09);
      ctx.lineTo(width * 0.84, height * 0.09);
      ctx.stroke();
      for (const xRatio of [0.23, 0.5, 0.77]) {
        const x = width * xRatio;
        ctx.beginPath();
        ctx.moveTo(x, height * 0.105);
        ctx.lineTo(x, height * 0.17);
        ctx.stroke();
        ctx.fillRect(x - width * 0.014, height * 0.16, width * 0.028, height * 0.018);
        ctx.beginPath();
        ctx.moveTo(x - width * 0.012, height * 0.18);
        ctx.lineTo(x + width * 0.012, height * 0.18);
        ctx.stroke();
      }
      break;
    }
    case "prism": {
      for (const centerX of [0.22, 0.78]) {
        const x = width * centerX;
        ctx.beginPath();
        ctx.moveTo(x, height * 0.19);
        ctx.lineTo(x + width * 0.105, height * 0.39);
        ctx.lineTo(x, height * 0.59);
        ctx.lineTo(x - width * 0.105, height * 0.39);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - width * 0.105, height * 0.39);
        ctx.lineTo(x + width * 0.105, height * 0.39);
        ctx.moveTo(x, height * 0.19);
        ctx.lineTo(x, height * 0.59);
        ctx.stroke();
      }
      break;
    }
    case "window": {
      const left = width * 0.69;
      const right = width * 0.94;
      const top = height * 0.17;
      const base = height * 0.69;
      ctx.beginPath();
      ctx.moveTo(left, base);
      ctx.lineTo(left, top + height * 0.12);
      ctx.bezierCurveTo(
        left,
        top - height * 0.11,
        right,
        top - height * 0.11,
        right,
        top + height * 0.12
      );
      ctx.lineTo(right, base);
      ctx.moveTo(left + width * 0.055, base);
      ctx.lineTo(left + width * 0.055, top + height * 0.09);
      ctx.moveTo(left + width * 0.135, base);
      ctx.lineTo(left + width * 0.135, top + height * 0.09);
      for (const yRatio of [0.38, 0.55]) {
        ctx.moveTo(left, height * yRatio);
        ctx.lineTo(right, height * yRatio);
      }
      ctx.stroke();
      break;
    }
    case "caustic": {
      for (let index = 0; index < 5; index += 1) {
        const x = width * (0.13 + index * 0.18);
        const y = height * (0.76 + Math.sin(index * 1.7 + frame.fogPhase) * 0.025);
        ctx.beginPath();
        ctx.moveTo(x - width * 0.075, y);
        ctx.bezierCurveTo(
          x - width * 0.03,
          y - height * 0.025,
          x + width * 0.03,
          y + height * 0.025,
          x + width * 0.075,
          y
        );
        ctx.stroke();
      }
      break;
    }
    case "botanical": {
      for (const direction of [-1, 1]) {
        const stemX = width * (direction < 0 ? 0.065 : 0.935);
        ctx.beginPath();
        ctx.moveTo(stemX, height * 0.91);
        ctx.bezierCurveTo(
          stemX - direction * width * 0.025,
          height * 0.66,
          stemX + direction * width * 0.02,
          height * 0.4,
          stemX - direction * width * 0.01,
          height * 0.22
        );
        ctx.stroke();
        for (let leaf = 0; leaf < 3; leaf += 1) {
          const y = height * (0.69 - leaf * 0.16);
          const leafX = stemX - direction * width * 0.018;
          ctx.beginPath();
          ctx.moveTo(leafX, y);
          ctx.bezierCurveTo(
            leafX - direction * width * 0.045,
            y - height * 0.02,
            leafX - direction * width * 0.065,
            y + height * 0.02,
            leafX - direction * width * 0.083,
            y + height * 0.003
          );
          ctx.bezierCurveTo(
            leafX - direction * width * 0.055,
            y + height * 0.034,
            leafX - direction * width * 0.033,
            y + height * 0.022,
            leafX,
            y
          );
          ctx.stroke();
        }
      }
      break;
    }
    case "astral": {
      const stars = [
        [0.18, 0.31],
        [0.31, 0.2],
        [0.46, 0.13],
        [0.62, 0.15],
        [0.77, 0.28],
        [0.86, 0.41],
      ] as const;
      ctx.beginPath();
      ctx.moveTo(width * 0.15, height * 0.39);
      ctx.bezierCurveTo(
        width * 0.21,
        height * 0.03,
        width * 0.79,
        height * 0.03,
        width * 0.85,
        height * 0.39
      );
      ctx.stroke();
      ctx.beginPath();
      stars.forEach(([x, y], index) => {
        const px = width * x;
        const py = height * y;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        ctx.moveTo(px, py - 4);
        ctx.lineTo(px + 4, py);
        ctx.lineTo(px, py + 4);
        ctx.lineTo(px - 4, py);
        ctx.closePath();
      });
      ctx.stroke();
      break;
    }
    case "motes": {
      ctx.beginPath();
      ctx.moveTo(width * 0.055, height * 0.22);
      ctx.lineTo(width * 0.055, height * 0.83);
      ctx.moveTo(width * 0.945, height * 0.22);
      ctx.lineTo(width * 0.945, height * 0.83);
      ctx.moveTo(width * 0.055, height * 0.22);
      ctx.lineTo(width * 0.14, height * 0.15);
      ctx.moveTo(width * 0.945, height * 0.22);
      ctx.lineTo(width * 0.86, height * 0.15);
      ctx.stroke();
      break;
    }
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

function drawFloorPlane(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opacity: number,
  palette: LyricFilmStagePalette
): void {
  const horizonY = height * 0.7;
  const floor = ctx.createLinearGradient(0, horizonY, 0, height);
  floor.addColorStop(0, colorWithAlpha(palette.shadow, 0.08));
  floor.addColorStop(1, colorWithAlpha(palette.deep, 0.6));

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizonY, width, height - horizonY);
  ctx.globalAlpha = opacity * 0.25;
  ctx.strokeStyle = colorWithAlpha(palette.pale, 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width * 0.06, horizonY);
  ctx.lineTo(width * 0.94, horizonY);
  for (const xRatio of [0.08, 0.22, 0.38, 0.62, 0.78, 0.92]) {
    ctx.moveTo(width * 0.5, horizonY);
    ctx.lineTo(width * xRatio, height);
  }
  for (const yRatio of [0.8, 0.9, 0.98]) {
    ctx.moveTo(width * 0.04, height * yRatio);
    ctx.lineTo(width * 0.96, height * yRatio);
  }
  ctx.stroke();
  ctx.restore();
}

function drawForegroundFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opacity: number,
  palette: LyricFilmStagePalette
): void {
  const curtain = ctx.createLinearGradient(0, height * 0.9, 0, height);
  curtain.addColorStop(0, colorWithAlpha(palette.deep, 0));
  curtain.addColorStop(1, colorWithAlpha("#020307", 0.84));

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = curtain;
  ctx.fillRect(0, height * 0.9, width, height * 0.1);
  ctx.fillStyle = colorWithAlpha("#020307", 0.35);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width * 0.035, 0);
  ctx.lineTo(width * 0.045, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width * 0.965, 0);
  ctx.lineTo(width * 0.955, height);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
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
  const rig = resolveLyricFilmStageRig(frame.profile, frame.seed, frame.beamAngle);

  ctx.save();
  ctx.globalAlpha = 1;
  const backdrop = ctx.createLinearGradient(0, 0, 0, height);
  backdrop.addColorStop(0, palette.deep);
  backdrop.addColorStop(0.58, palette.shadow);
  backdrop.addColorStop(1, palette.deep);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);

  const lyricBed = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    0,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.62
  );
  lyricBed.addColorStop(0, colorWithAlpha(palette.deep, 0.48));
  lyricBed.addColorStop(0.5, colorWithAlpha(palette.deep, 0.28));
  lyricBed.addColorStop(1, colorWithAlpha(palette.deep, 0));
  ctx.globalAlpha = opacity;
  ctx.fillStyle = lyricBed;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 1;
  ctx.translate(width * (0.5 + camera.x), height * (0.5 + camera.y));
  ctx.rotate(camera.rotation);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-width * 0.5, -height * 0.5);

  drawProfile(ctx, frame, width, height, opacity, lightIntensity, palette);
  drawFloorPlane(ctx, width, height, opacity, palette);
  for (const light of rig.lights) {
    drawStageLight(ctx, light, frame, width, height, opacity, lightIntensity, palette);
  }
  drawFog(ctx, width, height, frame.fogPhase, opacity, lightIntensity, palette);
  drawDust(ctx, frame, width, height, dpr, opacity, lightIntensity, palette);
  drawForegroundFrame(ctx, width, height, opacity, palette);
  ctx.restore();

  ctx.save();
  drawTransitionOverlay(ctx, frame.transition, width, height, opacity, lightIntensity, palette);
  ctx.restore();
}
