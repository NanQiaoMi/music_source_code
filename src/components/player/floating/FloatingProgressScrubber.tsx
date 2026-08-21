"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { Volume2, Volume1, VolumeX } from "lucide-react";

export interface FloatingProgressScrubberProps {
  /** Optional custom class name */
  className?: string;
  /** Whether to show the volume slider controls (default: true) */
  showVolume?: boolean;
  /** Compact styling flag */
  compact?: boolean;
  /** Optional seek start callback */
  onSeekStart?: () => void;
  /** Optional seek finish callback */
  onSeekEnd?: (targetTime: number) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const FloatingProgressScrubber: React.FC<FloatingProgressScrubberProps> = ({
  className = "",
  showVolume = true,
  compact = false,
  onSeekStart,
  onSeekEnd,
}) => {
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);
  const seekTo = useAudioStore((state) => state.seekTo);
  const setVolume = useAudioStore((state) => state.setVolume);
  const toggleMute = useAudioStore((state) => state.toggleMute);

  // Progress scrubbing states
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [scrubPercent, setScrubPercent] = useState<number | null>(null);
  const [tooltipState, setTooltipState] = useState<{
    visible: boolean;
    x: number;
    time: number;
  }>({ visible: false, x: 0, time: 0 });

  // Volume scrubbing states
  const volumeBarRef = useRef<HTMLDivElement | null>(null);
  const [isHoveringVolume, setIsHoveringVolume] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  // Calculate active progress percentage
  const actualProgressPercent =
    duration > 0 && !isNaN(currentTime)
      ? Math.min(Math.max((currentTime / duration) * 100, 0), 100)
      : 0;

  const displayProgressPercent =
    scrubPercent !== null ? scrubPercent * 100 : actualProgressPercent;

  // Track progress scrubbing pointer logic
  const calculateProgressFromPointer = useCallback(
    (clientX: number) => {
      const bar = progressBarRef.current;
      if (!bar || !duration) return { ratio: 0, x: 0, time: 0 };

      const rect = bar.getBoundingClientRect();
      const clampedX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const ratio = clampedX / rect.width;
      const targetTime = ratio * duration;

      return { ratio, x: clampedX, time: targetTime };
    },
    [duration]
  );

  const handleProgressPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    onSeekStart?.();
    setIsDraggingProgress(true);

    const { ratio, x, time } = calculateProgressFromPointer(e.clientX);
    setScrubPercent(ratio);
    setTooltipState({ visible: true, x, time });

    const handlePointerMove = (ev: PointerEvent) => {
      const { ratio: newRatio, x: newX, time: newTime } = calculateProgressFromPointer(ev.clientX);
      setScrubPercent(newRatio);
      setTooltipState({ visible: true, x: newX, time: newTime });
    };

    const handlePointerUp = (ev: PointerEvent) => {
      const { ratio: finalRatio, time: finalTime } = calculateProgressFromPointer(ev.clientX);
      seekTo(finalTime);
      onSeekEnd?.(finalTime);

      setScrubPercent(null);
      setIsDraggingProgress(false);
      setTooltipState((prev) => ({ ...prev, visible: false }));

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingProgress) return;
    const { x, time } = calculateProgressFromPointer(e.clientX);
    setTooltipState({ visible: true, x, time });
  };

  const handleProgressMouseLeave = () => {
    if (!isDraggingProgress) {
      setTooltipState((prev) => ({ ...prev, visible: false }));
      setIsHoveringProgress(false);
    }
  };

  // Volume pointer interactions
  const calculateVolumeFromPointer = useCallback(
    (clientX: number) => {
      const bar = volumeBarRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      const clampedX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return clampedX / rect.width;
    },
    []
  );

  const handleVolumePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDraggingVolume(true);
    const newVol = calculateVolumeFromPointer(e.clientX);
    setVolume(newVol);

    const handlePointerMove = (ev: PointerEvent) => {
      const v = calculateVolumeFromPointer(ev.clientX);
      setVolume(v);
    };

    const handlePointerUp = () => {
      setIsDraggingVolume(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Clean up global event listeners on unmount
  useEffect(() => {
    return () => {
      setScrubPercent(null);
      setIsDraggingProgress(false);
      setIsDraggingVolume(false);
    };
  }, []);

  const isExpandedTrack = isHoveringProgress || isDraggingProgress;
  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div className={`flex flex-col gap-2.5 select-none ${className}`}>
      {/* 1. Main Fluid Tactile Timeline Scrubber */}
      <div className="relative flex flex-col gap-1.5">
        {/* Floating Glassmorphic Time Bubble Tooltip */}
        <AnimatePresence>
          {tooltipState.visible && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className="absolute -top-9 z-30 pointer-events-none -translate-x-1/2"
              style={{
                left: Math.max(
                  24,
                  Math.min(
                    tooltipState.x,
                    (progressBarRef.current?.clientWidth || 300) - 24
                  )
                ),
              }}
            >
              <div className="relative px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-xl border border-white/20 text-white font-mono text-[11px] font-semibold tracking-wider shadow-[0_8px_20px_rgba(0,0,0,0.6)] flex items-center gap-1">
                <span>{formatTime(tooltipState.time)}</span>
                {duration > 0 && (
                  <span className="text-white/40 text-[9px]">/ {formatTime(duration)}</span>
                )}
                {/* Tooltip caret */}
                <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-black/85 border-r border-b border-white/20 rotate-45" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tactile Progress Track (3px default -> 8px on hover/drag) */}
        <div
          ref={progressBarRef}
          className="relative py-2 cursor-pointer flex items-center"
          style={{ touchAction: "none" }}
          onPointerDown={handleProgressPointerDown}
          onMouseEnter={() => setIsHoveringProgress(true)}
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={handleProgressMouseLeave}
        >
          <div
            className={`relative w-full rounded-full bg-white/[0.12] overflow-visible transition-all duration-200 ease-out ${
              isExpandedTrack ? "h-[8px]" : "h-[3px]"
            }`}
          >
            {/* Filled Active Monochrome Track */}
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-white transition-all duration-75"
              style={{
                width: `${displayProgressPercent}%`,
                boxShadow: isExpandedTrack
                  ? "0 0 12px rgba(255, 255, 255, 0.6)"
                  : "0 0 5px rgba(255, 255, 255, 0.35)",
              }}
            />

            {/* Pure White Glass Thumb Knob */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-transform"
              style={{
                left: `${displayProgressPercent}%`,
                transform: `translate(-50%, -50%) scale(${isExpandedTrack ? 1.25 : 1})`,
              }}
            >
              {/* Outer Radiant Aura */}
              <div
                className={`absolute inset-0 rounded-full blur-sm bg-white/40 ${
                  isPlaying ? "animate-pulse" : ""
                }`}
                style={{ width: 14, height: 14, margin: -1 }}
              />

              {/* Luminous Solid White Core */}
              <div className="relative w-3.5 h-3.5 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.5),0_0_10px_rgba(255,255,255,0.8)] ring-2 ring-white/30" />
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex items-center justify-between text-[10px] font-mono text-white/50 tracking-wider">
          <span className="tabular-nums font-medium text-white/80">
            {formatTime(currentTime)}
          </span>
          <span className="tabular-nums">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 2. Sleek Volume Scrubber with Mute Toggle and Real-time Percentage Feedback */}
      {showVolume && (
        <div className="flex items-center gap-3 pt-0.5">
          {/* Mute/Unmute Tactile Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors focus:outline-none"
            title={isMuted ? "取消静音" : "静音"}
          >
            {effectiveVolume === 0 ? (
              <VolumeX className="w-4 h-4 text-white/40" />
            ) : effectiveVolume < 0.5 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Volume Slider Track */}
          <div
            ref={volumeBarRef}
            className="flex-1 relative py-2 cursor-pointer flex items-center"
            style={{ touchAction: "none" }}
            onPointerDown={handleVolumePointerDown}
            onMouseEnter={() => setIsHoveringVolume(true)}
            onMouseLeave={() => setIsHoveringVolume(false)}
          >
            <div
              className={`relative w-full rounded-full bg-white/[0.1] overflow-hidden transition-all duration-200 ${
                isHoveringVolume || isDraggingVolume ? "h-[6px]" : "h-[3px]"
              }`}
            >
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-white/85 transition-all duration-75 shadow-[0_0_6px_rgba(255,255,255,0.4)]"
                style={{ width: `${Math.round(effectiveVolume * 100)}%` }}
              />
            </div>
          </div>


          {/* Real-time Percentage Badge */}
          <div className="w-8 text-right text-[10px] font-mono text-white/50 tabular-nums">
            {Math.round(effectiveVolume * 100)}%
          </div>
        </div>
      )}
    </div>
  );
};
