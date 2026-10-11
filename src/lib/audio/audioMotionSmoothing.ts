/** Time-based attack/release smoothing for analyzer values across variable frame rates. */
export function smoothAudioValue(
  current: number,
  target: number,
  deltaMs: number,
  attackMs = 48,
  releaseMs = 175
): number {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, Math.min(1, current)) : 0;
  const safeTarget = Number.isFinite(target) ? Math.max(0, Math.min(1, target)) : 0;
  const safeDelta = Number.isFinite(deltaMs) ? Math.max(0, Math.min(100, deltaMs)) : 0;
  const timeConstant = safeTarget > safeCurrent ? attackMs : releaseMs;
  if (!Number.isFinite(timeConstant) || timeConstant <= 0 || safeDelta === 0) {
    return safeDelta === 0 ? safeCurrent : safeTarget;
  }

  const alpha = 1 - Math.exp(-safeDelta / timeConstant);
  return safeCurrent + (safeTarget - safeCurrent) * alpha;
}
