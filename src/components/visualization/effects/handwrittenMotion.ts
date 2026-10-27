import type { HandwrittenCameraFrame } from "./handwrittenScene";

export type HandwrittenRowMode = "past" | "active" | "future";

export interface HandwrittenTransitionFrame {
  /** Absolute music time used to render the frozen outgoing page. */
  snapshotTime: number;
  outgoingAlpha: number;
  incomingAlpha: number;
  /** A restrained lift impulse peaking while the page is between shots. */
  pageLift: number;
  /** Normalized per-page movement; both values evolve while the page is still visible. */
  outgoingProgress: number;
  incomingProgress: number;
}

/** Keep transition cache identity tied to every value that changes its rendered pixels. */
export function buildHandwrittenSnapshotRenderKey(
  baseKey: string,
  pixelRatio: number,
  translationLyricsText: string
): string {
  return JSON.stringify([baseKey, pixelRatio, translationLyricsText]);
}

/** Preserve the LRC reveal until its final unit is ready instead of showing a future snapshot. */
export function shouldRenderHandwrittenOutgoingLive(
  musicTime: number,
  contentReadyTime: number
): boolean {
  return (
    Number.isFinite(musicTime) && Number.isFinite(contentReadyTime) && musicTime < contentReadyTime
  );
}

/** Refuse vertical columns that would need unreadably small glyphs or clip their caption. */
export function canFitHandwrittenVerticalColumn(
  height: number,
  unitCount: number,
  reservedBottomSpace: number,
  minimumFontSize = 18
): boolean {
  if (
    !Number.isFinite(height) ||
    height <= 0 ||
    !Number.isFinite(unitCount) ||
    unitCount <= 0 ||
    !Number.isFinite(reservedBottomSpace) ||
    !Number.isFinite(minimumFontSize) ||
    minimumFontSize <= 0
  ) {
    return false;
  }

  const availableHeight = height * 0.76 - Math.max(0, reservedBottomSpace);
  return availableHeight >= unitCount * minimumFontSize * 1.06;
}

/** Preserve future-row timing even when the first lyric shot begins before its first LRC. */
export function resolveHandwrittenRowMode(
  musicTime: number,
  rowStartTime: number,
  focusStartTime: number
): HandwrittenRowMode {
  if (!Number.isFinite(musicTime) || !Number.isFinite(rowStartTime)) return "future";
  if (musicTime < rowStartTime) return "future";
  if (Number.isFinite(focusStartTime) && rowStartTime < focusStartTime) return "past";
  return "active";
}

/** Reduce reveal animation without bringing future LRC content forward in time. */
export function resolveHandwrittenReducedMotionReveal(
  reducedMotion: boolean,
  mode: HandwrittenRowMode
): number | undefined {
  return reducedMotion ? (mode === "future" ? 0 : 1) : undefined;
}

/** Select one deterministic page for reduced motion instead of blending two shots. */
export function resolveHandwrittenReducedMotionShot<T extends { startTime: number }>(
  outgoing: T,
  incoming: T | null,
  musicTime: number
): T {
  return incoming && Number.isFinite(musicTime) && musicTime >= incoming.startTime
    ? incoming
    : outgoing;
}

/** Keep motion-reduced lyrics fully legible at the exact shot/LRC start boundary. */
export function resolveHandwrittenRevealOpacity(
  reducedMotion: boolean,
  elapsedSinceStart: number
): number {
  return reducedMotion ? 1 : smoothstep(clamp(elapsedSinceStart / 0.24, 0, 1));
}

/** Keep a frozen lyric page's translation attached to its last source group at shot.endTime. */
export function resolveHandwrittenTranslationTime(
  musicTime: number,
  shotEndTime: number,
  restrictToShot: boolean
): number {
  if (!restrictToShot || !Number.isFinite(musicTime) || !Number.isFinite(shotEndTime)) {
    return musicTime;
  }
  return Math.min(musicTime, shotEndTime - 0.001);
}

/** Keep the frozen outgoing page at its transition boundary or final content reveal. */
export function resolveHandwrittenSnapshotTime(
  transitionStart: number,
  transitionEnd: number,
  contentReadyTime?: number
): number {
  const start = Number.isFinite(transitionStart) ? transitionStart : 0;
  const end = Number.isFinite(transitionEnd) ? Math.max(start, transitionEnd) : start;
  const ready = Number.isFinite(contentReadyTime) ? contentReadyTime! : start;
  return clamp(Math.max(start, ready), start, end);
}

export function blendHandwrittenCamera(
  from: HandwrittenCameraFrame,
  to: HandwrittenCameraFrame,
  progress: number
): HandwrittenCameraFrame {
  const t = smoothstep(progress);
  if (t <= 0) return { ...from };
  if (t >= 1) return { ...to };
  return {
    zoom: from.zoom + (to.zoom - from.zoom) * t,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    rotation: from.rotation + (to.rotation - from.rotation) * t,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Resolve separate exit, page-lift, and arrival phases from the absolute music clock. */
export function resolveHandwrittenTransitionFrame(
  startTime: number,
  endTime: number,
  musicTime: number,
  contentReadyTime?: number
): HandwrittenTransitionFrame {
  const start = Number.isFinite(startTime) ? startTime : 0;
  const end = Number.isFinite(endTime) ? Math.max(start, endTime) : start;
  const time = Number.isFinite(musicTime) ? musicTime : start;
  const duration = Math.max(0.001, end - start);
  const progress = clamp((time - start) / duration, 0, 1);
  const liftProgress = clamp((progress - 0.29) / 0.42, 0, 1);
  const outgoingProgress = smoothstep(progress / 0.72);
  const incomingProgress = smoothstep((progress - 0.28) / 0.72);

  return {
    snapshotTime: resolveHandwrittenSnapshotTime(start, end, contentReadyTime),
    outgoingAlpha: 1 - smoothstep(progress),
    incomingAlpha: incomingProgress,
    pageLift: progress <= 0.29 || progress >= 0.71 ? 0 : Math.sin(Math.PI * liftProgress),
    outgoingProgress,
    incomingProgress,
  };
}
