import { buildABLoopMarkerLayout } from "@/lib/playback/abLoopMarkers";

interface ABLoopProgressMarkersProps {
  isEnabled: boolean;
  pointA: number | null;
  pointB: number | null;
  duration: number;
}

export function ABLoopProgressMarkers({
  isEnabled,
  pointA,
  pointB,
  duration,
}: ABLoopProgressMarkersProps) {
  const layout = buildABLoopMarkerLayout({ isEnabled, pointA, pointB, duration });

  if (!layout) return null;

  return (
    <>
      <div
        data-ab-loop-range="true"
        className="absolute top-0 z-10 h-full bg-blue-400/20"
        style={{
          left: `${layout.rangeLeftPercent}%`,
          width: `${layout.rangeWidthPercent}%`,
        }}
      />
      <div
        data-ab-loop-marker="a"
        className="absolute top-0 z-20 h-full w-0.5 bg-blue-400"
        style={{ left: `${layout.pointAPercent}%` }}
      />
      <div
        data-ab-loop-marker="b"
        className="absolute top-0 z-20 h-full w-0.5 bg-red-400"
        style={{ left: `${layout.pointBPercent}%` }}
      />
    </>
  );
}
