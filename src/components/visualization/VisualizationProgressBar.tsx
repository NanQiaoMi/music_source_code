"use client";

import React, { useState, useRef, useCallback, memo } from "react";
import { motion } from "framer-motion";

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface VisualizationProgressBarProps {
  currentTime: number;
  duration: number;
  bufferedRanges: { start: number; end: number }[];
  onSeek: (time: number) => void;
}

export const VisualizationProgressBar = memo(({ 
  currentTime, 
  duration, 
  bufferedRanges, 
  onSeek 
}: VisualizationProgressBarProps) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  const progressPercent = (duration > 0 && !isNaN(currentTime)) 
    ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) 
    : 0;
    
  const bufferedWidth =
    (bufferedRanges.length > 0 && duration > 0 && !isNaN(bufferedRanges[bufferedRanges.length - 1].end))
      ? Math.max(0, Math.min(100, (bufferedRanges[bufferedRanges.length - 1].end / duration) * 100))
      : 0;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);

      if (!progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(percent * duration);
    },
    [duration, onSeek]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverPosition(percent * 100);

      if (isDragging) {
        onSeek(percent * duration);
      }
    },
    [isDragging, duration, onSeek]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverPosition(null);
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!progressRef.current || isDragging) return;
      const rect = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(percent * duration);
    },
    [duration, onSeek, isDragging]
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/60 text-sm">{formatTime(currentTime)}</span>
        <span className="text-white/60 text-sm">{formatTime(duration)}</span>
      </div>
      <div
        ref={progressRef}
        className="relative h-2 bg-white/10 rounded-full cursor-pointer group select-none overflow-visible"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div
          className="absolute h-full bg-white/10 rounded-full transition-all duration-150"
          style={{ width: `${bufferedWidth}%` }}
        />

        <div
          className="absolute h-full rounded-full transition-all duration-150 overflow-hidden"
          style={{
            width: `${progressPercent}%`,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.9) 100%)",
            boxShadow:
              "0 0 8px rgba(255,255,255,0.4), 0 0 16px rgba(255,255,255,0.2), inset 0 1px 0 rgba(255,255,255,0.3)",
          }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
            }}
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: "linear",
            }}
          />
        </div>

        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `calc(${progressPercent}% - 6px)`,
            top: "50%",
            width: "12px",
            height: "12px",
            marginTop: "-6px",
            background:
              "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.5) 40%, transparent 70%)",
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: "easeInOut",
          }}
        />

        {hoverPosition !== null && !isDragging && (
          <div
            className="absolute top-0 h-full bg-white/20 rounded-full pointer-events-none"
            style={{ width: `${hoverPosition}%` }}
          />
        )}

        <div
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-all duration-150 pointer-events-none ${
            isDragging ? "scale-125" : "scale-100"
          }`}
          style={{ left: `calc(${progressPercent}% - 6px)` }}
        />
      </div>
    </div>
  );
});

VisualizationProgressBar.displayName = "VisualizationProgressBar";
