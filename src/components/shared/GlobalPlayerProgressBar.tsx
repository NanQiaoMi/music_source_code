"use client";

import React, { useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { ABLoopProgressMarkers } from "@/components/shared/ABLoopProgressMarkers";

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface GlobalPlayerProgressBarProps {
  duration: number;
  abLoopEnabled: boolean;
  pointA: number | null;
  pointB: number | null;
}

/**
 * 独立隔离的高频进度条与时间指示器叶子组件：
 * 内部自闭环订阅 currentTime，避免整个 GlobalPlayerBar 顶层容器每秒 10 次的全局 Diff
 */
export const GlobalPlayerProgressBar: React.FC<GlobalPlayerProgressBarProps> = memo(
  ({ duration, abLoopEnabled, pointA, pointB }) => {
    const currentTime = useAudioStore((state) => state.currentTime);
    const [isHoveringProgress, setIsHoveringProgress] = useState(false);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const [hoverX, setHoverX] = useState<number>(0);

    const progress =
      duration > 0 && !isNaN(currentTime) && !isNaN(duration) ? (currentTime / duration) * 100 : 0;

    const handleProgressClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;
        useAudioStore.getState().seekTo(newTime);
      },
      [duration]
    );

    const handleProgressHover = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        setHoverTime(percentage * duration);
        setHoverX(x);
      },
      [duration]
    );

    const handleProgressLeave = useCallback(() => {
      setIsHoveringProgress(false);
      setHoverTime(null);
    }, []);

    return (
      <>
        <div
          className="relative w-full group"
          onMouseEnter={() => setIsHoveringProgress(true)}
          onMouseLeave={handleProgressLeave}
        >
          <div
            className={`relative h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer transition-all duration-200 ${
              isHoveringProgress ? "h-2" : ""
            }`}
            onClick={handleProgressClick}
            onMouseMove={handleProgressHover}
          >
            <motion.div
              className="absolute top-0 left-0 h-full bg-white/80 rounded-full"
              style={{ width: `${progress}%` }}
            />
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                left: `calc(${progress}% - 6px)`,
                opacity: isHoveringProgress ? 1 : 0,
              }}
            />

            <ABLoopProgressMarkers
              isEnabled={abLoopEnabled}
              pointA={pointA}
              pointB={pointB}
              duration={duration}
            />
          </div>

          <AnimatePresence>
            {isHoveringProgress && hoverTime !== null && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
                className="absolute -top-10 px-2 py-1 bg-black/80 backdrop-blur-md rounded-lg text-xs text-white/90 pointer-events-none"
                style={{
                  left: hoverX,
                  transform: "translateX(-50%)",
                  willChange: "transform, opacity",
                }}
              >
                {formatTime(hoverTime)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-4 mt-1.5">
          <span className="text-[10px] text-white/50 tabular-nums w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-white/50 tabular-nums w-10">
            {formatTime(duration)}
          </span>
        </div>
      </>
    );
  }
);

GlobalPlayerProgressBar.displayName = "GlobalPlayerProgressBar";
