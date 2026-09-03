"use client";

import React from "react";
import {
  getHaloRenderMode,
  paintHaloPreview,
  type HaloPaintContext,
  type HaloRenderMode,
} from "@/lib/skins/halo/haloSkins";
import { usePerformanceV8Store } from "@/store/performanceV8Store";
import { usePlayerSkinStore } from "@/store/playerSkinStore";

import { useAudioStore } from "@/store/audioStore";

interface NowPlayingHaloProps {
  currentTime?: number;
  isPlaying: boolean;
  level?: number;
  size?: number;
  className?: string;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

export const NowPlayingHalo: React.FC<NowPlayingHaloProps> = React.memo(({
  currentTime: propCurrentTime,
  isPlaying,
  level = 0,
  size = 72,
  className = "",
}) => {
  const storeTime = useAudioStore((state) => state.currentTime);
  const currentTime = propCurrentTime !== undefined ? propCurrentTime : storeTime;

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const activeHalo = usePlayerSkinStore((state) => state.getActiveHalo());
  const targetFps = usePerformanceV8Store((state) => state.config.targetFPS);
  const renderMode: HaloRenderMode = getHaloRenderMode({
    targetFps,
    reducedMotion: prefersReducedMotion(),
  });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = getCanvasContext(canvas);
    if (!context) return;

    paintHaloPreview(context as unknown as HaloPaintContext, activeHalo, {
      currentTime: isPlaying ? currentTime : 0,
      level: clamp01(level),
      renderMode,
    });
  }, [activeHalo, currentTime, isPlaying, level, renderMode]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={`${activeHalo.name} now playing halo`}
      data-halo-render-mode={renderMode}
      data-halo-skin={activeHalo.id}
      height={size}
      width={size}
      className={`pointer-events-none absolute left-1/2 top-1/2 z-0 max-w-none -translate-x-1/2 -translate-y-1/2 rounded-full ${className}`}
    />
  );
});
