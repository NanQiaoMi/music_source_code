export interface ABLoopMarkerInput {
  isEnabled: boolean;
  pointA: number | null;
  pointB: number | null;
  duration: number;
}

export interface ABLoopMarkerLayout {
  pointAPercent: number;
  pointBPercent: number;
  rangeLeftPercent: number;
  rangeWidthPercent: number;
}

export function buildABLoopMarkerLayout({
  isEnabled,
  pointA,
  pointB,
  duration,
}: ABLoopMarkerInput): ABLoopMarkerLayout | null {
  if (
    !isEnabled ||
    pointA === null ||
    pointB === null ||
    !Number.isFinite(pointA) ||
    !Number.isFinite(pointB) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    pointA >= pointB
  ) {
    return null;
  }

  const pointAPercent = toClampedPercent(pointA, duration);
  const pointBPercent = toClampedPercent(pointB, duration);
  const rangeWidthPercent = pointBPercent - pointAPercent;

  if (rangeWidthPercent <= 0) {
    return null;
  }

  return {
    pointAPercent,
    pointBPercent,
    rangeLeftPercent: pointAPercent,
    rangeWidthPercent,
  };
}

function toClampedPercent(time: number, duration: number): number {
  const percent = (time / duration) * 100;
  return Math.min(100, Math.max(0, percent));
}
