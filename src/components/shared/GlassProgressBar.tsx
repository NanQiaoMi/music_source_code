"use client";

import React, { useState, useRef, useCallback, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface GlassProgressBarProps {
  currentTime: number;
  duration: number;
  bufferedRanges?: { start: number; end: number }[];
  abLoopEnabled?: boolean;
  pointA?: number | null;
  pointB?: number | null;
  onSeek: (time: number) => void;
  accentColor?: string;
  className?: string;
  showTimeLabels?: boolean;
  disabled?: boolean;
}

const TIME_DISPLAY_STORAGE_KEY = "mimi-time-display-mode";

export const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const GlassProgressBar: React.FC<GlassProgressBarProps> = memo(
  ({
    currentTime,
    duration,
    bufferedRanges = [],
    abLoopEnabled = false,
    pointA = null,
    pointB = null,
    onSeek,
    accentColor,
    className = "",
    showTimeLabels = true,
    disabled = false,
  }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragPercent, setDragPercent] = useState<number | null>(null);
    const [hoverPercent, setHoverPercent] = useState<number | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [timeDisplayMode, setTimeDisplayMode] = useState<"duration" | "remaining">("duration");

    // Load persisted time display mode preference
    useEffect(() => {
      try {
        const saved = localStorage.getItem(TIME_DISPLAY_STORAGE_KEY);
        if (saved === "remaining" || saved === "duration") {
          setTimeDisplayMode(saved);
        }
      } catch {
        // localStorage not available
      }
    }, []);

    const toggleTimeDisplayMode = useCallback(() => {
      setTimeDisplayMode((prev) => {
        const next = prev === "duration" ? "remaining" : "duration";
        try {
          localStorage.setItem(TIME_DISPLAY_STORAGE_KEY, next);
        } catch {
          // ignore storage errors
        }
        return next;
      });
    }, []);

    const hasValidDuration = Number.isFinite(duration) && duration > 0;
    const effectiveCurrentTime = Math.max(
      0,
      Math.min(currentTime, hasValidDuration ? duration : 0)
    );

    // Progress computation
    const livePercent = hasValidDuration ? (effectiveCurrentTime / duration) * 100 : 0;
    const currentPercent = isDragging && dragPercent !== null ? dragPercent : livePercent;
    const displayCurrentTime =
      isDragging && dragPercent !== null && hasValidDuration
        ? (dragPercent / 100) * duration
        : effectiveCurrentTime;

    // Pointer helper
    const calculatePercentFromPointer = useCallback((clientX: number): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const relativeX = clientX - rect.left;
      const rawPercent = (relativeX / rect.width) * 100;
      return Math.max(0, Math.min(100, rawPercent));
    }, []);

    // Pointer Event Handlers
    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled || !hasValidDuration) return;
        e.preventDefault();
        e.stopPropagation();

        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Fallback if pointer capture is not supported
        }

        const percent = calculatePercentFromPointer(e.clientX);
        setIsDragging(true);
        setDragPercent(percent);
      },
      [disabled, hasValidDuration, calculatePercentFromPointer]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled || !hasValidDuration) return;
        const percent = calculatePercentFromPointer(e.clientX);

        if (isDragging) {
          setDragPercent(percent);
        } else {
          setHoverPercent(percent);
        }
      },
      [disabled, hasValidDuration, isDragging, calculatePercentFromPointer]
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        e.preventDefault();
        e.stopPropagation();

        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore
        }

        const finalPercent =
          dragPercent !== null ? dragPercent : calculatePercentFromPointer(e.clientX);
        setIsDragging(false);
        setDragPercent(null);

        if (hasValidDuration) {
          const targetTime = (finalPercent / 100) * duration;
          onSeek(Math.max(0, Math.min(targetTime, duration)));
        }
      },
      [isDragging, dragPercent, hasValidDuration, duration, onSeek, calculatePercentFromPointer]
    );

    const handlePointerCancel = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore
        }
        setIsDragging(false);
        setDragPercent(null);
      },
      [isDragging]
    );

    // Keyboard navigation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled || !hasValidDuration) return;
        const step = e.shiftKey ? 1 : 5;

        switch (e.key) {
          case "ArrowLeft":
          case "ArrowDown":
            e.preventDefault();
            onSeek(Math.max(0, effectiveCurrentTime - step));
            break;
          case "ArrowRight":
          case "ArrowUp":
            e.preventDefault();
            onSeek(Math.min(duration, effectiveCurrentTime + step));
            break;
          case "Home":
            e.preventDefault();
            onSeek(0);
            break;
          case "End":
            e.preventDefault();
            onSeek(duration);
            break;
        }
      },
      [disabled, hasValidDuration, effectiveCurrentTime, duration, onSeek]
    );

    // Tooltip position & preview time
    const previewPercent = isDragging && dragPercent !== null ? dragPercent : hoverPercent;
    const previewTime =
      previewPercent !== null && hasValidDuration ? (previewPercent / 100) * duration : null;

    // Remaining time string
    const remainingTime = hasValidDuration ? duration - displayCurrentTime : 0;
    const rightTimeLabel =
      timeDisplayMode === "remaining" ? `-${formatTime(remainingTime)}` : formatTime(duration);

    // AB Loop Marker percentages
    const pointAPercent =
      hasValidDuration && pointA !== null
        ? Math.max(0, Math.min(100, (pointA / duration) * 100))
        : null;
    const pointBPercent =
      hasValidDuration && pointB !== null
        ? Math.max(0, Math.min(100, (pointB / duration) * 100))
        : null;

    return (
      <div className={`w-full flex flex-col select-none group/progressbar ${className}`}>
        {/* Apple Refined Time Labels */}
        {showTimeLabels && (
          <div className="flex justify-between items-center text-[11px] font-mono mb-1.5 px-0.5 tracking-wider font-medium">
            <span className="tabular-nums text-white/80 font-medium select-none">
              {formatTime(displayCurrentTime)}
            </span>
            <button
              type="button"
              onClick={toggleTimeDisplayMode}
              disabled={!hasValidDuration}
              className="tabular-nums text-white/50 hover:text-white/90 active:scale-95 transition-all text-right cursor-pointer select-none"
              title="点击切换总时长 / 剩余倒计时"
            >
              {rightTimeLabel}
            </button>
          </div>
        )}

        {/* Interactive Bar Container with Generous Hit Area */}
        <div
          ref={trackRef}
          role="slider"
          aria-label="音频播放进度"
          aria-valuemin={0}
          aria-valuemax={hasValidDuration ? duration : 0}
          aria-valuenow={displayCurrentTime}
          aria-valuetext={`${formatTime(displayCurrentTime)} / ${formatTime(duration)}`}
          tabIndex={disabled || !hasValidDuration ? -1 : 0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => {
            setIsHovered(false);
            if (!isDragging) setHoverPercent(null);
          }}
          onKeyDown={handleKeyDown}
          className={`relative w-full py-2.5 cursor-pointer touch-none focus:outline-none ${
            disabled || !hasValidDuration ? "opacity-40 cursor-not-allowed" : ""
          }`}
        >
          {/* Inner Morphing Track (Apple 4px -> 6px Spring Transition) */}
          <div
            className={`w-full relative rounded-full overflow-hidden transition-all duration-200 ease-out bg-white/[0.12] backdrop-blur-md ${
              isHovered || isDragging ? "h-1.5 bg-white/[0.18]" : "h-1"
            }`}
          >
            {/* Loading Breathing Shimmer when Duration is 0 */}
            {!hasValidDuration && (
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            )}

            {/* Buffered Ranges (translucent silky layer) */}
            {hasValidDuration &&
              bufferedRanges.map((range, idx) => {
                const startPct = Math.max(0, Math.min(100, (range.start / duration) * 100));
                const endPct = Math.max(0, Math.min(100, (range.end / duration) * 100));
                const widthPct = Math.max(0, endPct - startPct);
                if (widthPct <= 0) return null;

                return (
                  <div
                    key={idx}
                    className="absolute top-0 bottom-0 rounded-full bg-white/[0.16] transition-all duration-300 pointer-events-none"
                    style={{
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                    }}
                  />
                );
              })}

            {/* AB Loop Highlight Segment */}
            {abLoopEnabled &&
              pointAPercent !== null &&
              pointBPercent !== null &&
              pointBPercent > pointAPercent && (
                <div
                  className="absolute top-0 bottom-0 bg-gradient-to-r from-purple-500/35 via-indigo-500/35 to-purple-500/35 border-x border-white/40 pointer-events-none z-10 rounded-sm"
                  style={{
                    left: `${pointAPercent}%`,
                    width: `${pointBPercent - pointAPercent}%`,
                  }}
                />
              )}

            {/* AB Loop Point A Marker */}
            {abLoopEnabled && pointAPercent !== null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center"
                style={{ left: `${pointAPercent}%` }}
              >
                <div className="w-1 h-3 bg-purple-400 rounded-full shadow-[0_0_8px_rgba(192,132,252,0.9)]" />
                <span className="text-[7px] font-bold text-purple-300 -mt-0.5">A</span>
              </div>
            )}

            {/* AB Loop Point B Marker */}
            {abLoopEnabled && pointBPercent !== null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center"
                style={{ left: `${pointBPercent}%` }}
              >
                <div className="w-1 h-3 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.9)]" />
                <span className="text-[7px] font-bold text-indigo-300 -mt-0.5">B</span>
              </div>
            )}

            {/* Hover Ghost Track */}
            {isHovered && !isDragging && hoverPercent !== null && (
              <div
                className="absolute top-0 bottom-0 left-0 bg-white/[0.18] rounded-full pointer-events-none transition-all duration-75"
                style={{ width: `${hoverPercent}%` }}
              />
            )}

            {/* Active Filled Liquid Progress Track */}
            <div
              className="absolute top-0 bottom-0 left-0 rounded-full pointer-events-none transition-[width] duration-75 overflow-hidden"
              style={{
                width: `${currentPercent}%`,
                background: accentColor
                  ? `linear-gradient(90deg, rgba(255,255,255,0.92) 0%, ${accentColor} 100%)`
                  : "linear-gradient(90deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,1) 100%)",
                boxShadow: accentColor
                  ? `0 0 10px ${accentColor}80`
                  : "0 0 8px rgba(255,255,255,0.35)",
              }}
            >
              {/* Subtle internal liquid shimmer sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite]" />
            </div>
          </div>

          {/* Apple Refined Frosted Pearl Thumb / Scrubber Handle */}
          {hasValidDuration && (
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-30 flex items-center justify-center"
              style={{ left: `${currentPercent}%` }}
              animate={{
                scale: isDragging ? 1.25 : isHovered ? 1.05 : 0,
                opacity: isDragging || isHovered ? 1 : 0,
              }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
            >
              <div className="relative flex items-center justify-center">
                {/* 外部极光柔雾光环 */}
                <div
                  className="w-3.5 h-3.5 rounded-full bg-white/25 backdrop-blur-xl border border-white/60 shadow-[0_0_10px_rgba(255,255,255,0.7),0_2px_4px_rgba(0,0,0,0.35)] flex items-center justify-center transition-all duration-200"
                  style={{
                    boxShadow: accentColor
                      ? `0 0 12px ${accentColor}90, 0 2px 4px rgba(0,0,0,0.4)`
                      : "0 0 10px rgba(255,255,255,0.75), 0 2px 4px rgba(0,0,0,0.4)",
                  }}
                >
                  {/* 内部极清纯白高光微核 */}
                  <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,1)]" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Apple Floating Frosted Glass Time Preview Tooltip (shown on hover & drag) */}
          <AnimatePresence>
            {(isHovered || isDragging) && previewPercent !== null && previewTime !== null && (
              <motion.div
                initial={{ opacity: 0, y: 2, scale: 0.92 }}
                animate={{ opacity: 1, y: -22, scale: 1 }}
                exit={{ opacity: 0, y: 2, scale: 0.92 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="absolute top-0 -translate-x-1/2 pointer-events-none z-40"
                style={{
                  left: `clamp(24px, ${previewPercent}%, calc(100% - 24px))`,
                }}
              >
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/85 backdrop-blur-2xl border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.6)] text-white text-[11px] font-mono tracking-wider whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] animate-pulse" />
                  <span>{formatTime(previewTime)}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }
);

GlassProgressBar.displayName = "GlassProgressBar";
