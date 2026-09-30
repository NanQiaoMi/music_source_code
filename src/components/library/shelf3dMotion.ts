export interface SpringState {
  position: number;
  velocity: number;
}

const MAX_SPRING_STEP_SECONDS = 0.032;
const EXPONENTIAL_UNDERFLOW_LIMIT = 745;
const MAX_ENVELOPE_STEP_MS = 32;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Advances a critically damped spring by one frame using its closed-form solution.
 * The time step is capped at 32 ms so background-tab pauses do not cause large jumps.
 */
export function stepCriticalSpring(
  state: SpringState,
  target: number,
  dtSeconds: number,
  omega = 18
): SpringState {
  const position = Number.isFinite(state?.position) ? state.position : 0;
  const velocity = Number.isFinite(state?.velocity) ? state.velocity : 0;
  const safeTarget = Number.isFinite(target) ? target : position;
  const dt = Number.isNaN(dtSeconds)
    ? 0
    : Math.max(0, Math.min(MAX_SPRING_STEP_SECONDS, dtSeconds));
  const frequency = Number.isFinite(omega) && omega > 0 ? omega : 0;

  if (dt === 0) {
    return { position, velocity };
  }

  if (frequency === 0) {
    const nextPosition = position + velocity * dt;
    return {
      position: Number.isFinite(nextPosition) ? nextPosition : position,
      velocity,
    };
  }

  const frequencyStep = frequency * dt;
  if (!Number.isFinite(frequencyStep) || frequencyStep >= EXPONENTIAL_UNDERFLOW_LIMIT) {
    return { position: safeTarget, velocity: 0 };
  }

  const displacement = position - safeTarget;
  const decay = Math.exp(-frequencyStep);
  const nextPosition = safeTarget + ((1 + frequencyStep) * displacement + velocity * dt) * decay;
  const nextVelocity =
    (velocity * (1 - frequencyStep) - frequency * frequencyStep * displacement) * decay;

  return {
    position: Number.isFinite(nextPosition) ? nextPosition : safeTarget,
    velocity: Number.isFinite(nextVelocity) ? nextVelocity : 0,
  };
}

/**
 * Returns the mean byte-frequency level for bins whose center frequencies fall
 * within [lowHz, highHz]. AnalyserNode byte data is scaled from 0 to 255.
 */
export function readBandEnergy(
  data: ArrayLike<number> | null | undefined,
  sampleRate: number,
  fftSize: number,
  lowHz: number,
  highHz: number
): number {
  if (
    !data ||
    !Number.isInteger(data.length) ||
    data.length <= 0 ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0 ||
    !Number.isInteger(fftSize) ||
    fftSize <= 0 ||
    !Number.isFinite(lowHz) ||
    lowHz < 0 ||
    !Number.isFinite(highHz) ||
    highHz <= lowHz
  ) {
    return 0;
  }

  const nyquistHz = sampleRate / 2;
  if (!Number.isFinite(nyquistHz) || nyquistHz <= 0 || lowHz > nyquistHz) {
    return 0;
  }

  const maxBin = Math.min(data.length - 1, Math.ceil(fftSize / 2) - 1);
  const firstBin = Math.ceil((lowHz / sampleRate) * fftSize);
  const lastBin = Math.min(
    maxBin,
    Math.floor((Math.min(highHz, nyquistHz) / sampleRate) * fftSize)
  );

  if (
    !Number.isFinite(firstBin) ||
    !Number.isFinite(lastBin) ||
    firstBin < 0 ||
    firstBin > lastBin
  ) {
    return 0;
  }

  let total = 0;
  const binCount = lastBin - firstBin + 1;
  for (let bin = firstBin; bin <= lastBin; bin += 1) {
    const sample = data[bin];
    if (!Number.isFinite(sample)) {
      return 0;
    }

    total += Math.max(0, Math.min(255, sample));
  }

  return clamp01(total / (binCount * 255));
}

/**
 * Smooths a normalized envelope with separate attack and release time constants.
 * The frame interval is capped at 32 ms; invalid intervals act as zero.
 * Zero time constants snap to the target; negative or invalid time constants hold.
 */
export function approachEnvelope(
  current: number,
  target: number,
  dtMs: number,
  attackMs: number,
  releaseMs: number
): number {
  const safeCurrent = clamp01(Number.isFinite(current) ? current : 0);
  const safeTarget = clamp01(Number.isFinite(target) ? target : 0);

  if (safeCurrent === safeTarget) {
    return safeTarget;
  }

  const dt = Number.isFinite(dtMs) ? Math.max(0, Math.min(MAX_ENVELOPE_STEP_MS, dtMs)) : 0;
  if (dt === 0) {
    return safeCurrent;
  }

  const timeConstant = safeTarget > safeCurrent ? attackMs : releaseMs;
  if (Number.isNaN(timeConstant) || timeConstant < 0) {
    return safeCurrent;
  }
  if (timeConstant === 0) {
    return safeTarget;
  }
  if (!Number.isFinite(timeConstant)) {
    return safeCurrent;
  }

  const alpha = -Math.expm1(-dt / timeConstant);
  return clamp01(safeCurrent + (safeTarget - safeCurrent) * alpha);
}
