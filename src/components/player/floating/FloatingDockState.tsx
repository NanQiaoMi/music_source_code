"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { Play, Pause, ChevronRight, ChevronLeft } from "lucide-react";
import type { DragHandlers } from "./useFloatingDragPhysics";

export interface FloatingDockStateProps {
  /** Dock side: left edge or right edge */
  side: "dock-left" | "dock-right";
  /** Triggered to restore the floating player to pill or expanded view */
  onRestore: (targetState?: "pill" | "expanded") => void;
  /** Drag handlers to enable dragging directly from the dock */
  dragHandlers?: DragHandlers;
  /** Optional custom class name */
  className?: string;
}

const DEFAULT_COVER_SRC = "/default-cover.svg";

export const FloatingDockState: React.FC<FloatingDockStateProps> = ({
  side,
  onRestore,
  dragHandlers,
  className = "",
}) => {
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentSong = useAudioStore((state) => state.currentSong);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const isLoading = useAudioStore((state) => state.isLoading);

  const [isHovered, setIsHovered] = useState(false);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);

  const isLeft = side === "dock-left";

  const handleContainerClick = (e: React.MouseEvent) => {
    // If clicked on action button, prevent restore trigger
    if ((e.target as HTMLElement).closest(".dock-action-btn")) {
      return;
    }
    onRestore("pill");
  };

  const handlePlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoading) {
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <motion.div
      className={`dock-drag-target select-none cursor-pointer relative group ${className}`}
      data-dock-side={side}
      aria-label={currentSong?.title || "浮动播放器已吸边"}
      title={currentSong ? `${currentSong.title} - ${currentSong.artist}` : undefined}
      initial={{ opacity: 0, x: isLeft ? -30 : 30, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: isLeft ? -30 : 30, scale: 0.9 }}
      whileHover={{
        x: isLeft ? 8 : -8,
        transition: { type: "spring", stiffness: 450, damping: 25 },
      }}
      whileTap={{ scale: 0.96 }}
      onClick={handleContainerClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowPlayOverlay(false);
      }}
      onMouseDown={dragHandlers?.onMouseDown}
      onTouchStart={dragHandlers?.onTouchStart}
      style={{ touchAction: "none" }}
    >
      {/* Outer Glow Halo Pulse */}
      <motion.div
        className={`absolute inset-0 -z-10 rounded-full blur-xl pointer-events-none ${
          isLeft ? "-right-4" : "-left-4"
        }`}
        animate={
          isPlaying
            ? {
                opacity: [0.35, 0.75, 0.35],
                scale: [0.95, 1.2, 0.95],
                background: [
                  "radial-gradient(circle, rgba(56,189,248,0.45) 0%, rgba(99,102,241,0.2) 60%, transparent 80%)",
                  "radial-gradient(circle, rgba(168,85,247,0.55) 0%, rgba(236,72,153,0.25) 60%, transparent 80%)",
                  "radial-gradient(circle, rgba(56,189,248,0.45) 0%, rgba(99,102,241,0.2) 60%, transparent 80%)",
                ],
              }
            : {
                opacity: 0.15,
                scale: 1,
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)",
              }
        }
        transition={{
          repeat: Infinity,
          duration: 3.2,
          ease: "easeInOut",
        }}
      />

      {/* Main Crescent / Half-Pill Glass Container */}
      <div
        className={`relative flex items-center gap-2.5 py-2 px-2.5 bg-[#000000]/92 backdrop-blur-[36px] backdrop-saturate-[190%] border border-white/[0.12] shadow-[0_16px_40px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.2)] transition-all duration-300 ${
          isLeft
            ? "rounded-r-full rounded-l-none pl-1.5 pr-3 border-l-0"
            : "rounded-l-full rounded-r-none pr-1.5 pl-3 border-r-0 flex-row-reverse"
        }`}
        style={{
          minWidth: 64,
          height: 64,
        }}
      >
        {/* Apple-grade Top Specular Highlight Line */}
        <div
          className={`absolute top-0 h-[1px] bg-gradient-to-r from-white/30 via-white/10 to-transparent pointer-events-none ${
            isLeft ? "left-0 right-3" : "left-3 right-0"
          }`}
        />

        {/* Half-Circle Cover Art with Halo */}
        <div
          className="relative w-11 h-11 flex-shrink-0"
          onMouseEnter={() => setShowPlayOverlay(true)}
          onMouseLeave={() => setShowPlayOverlay(false)}
        >
          {/* Inner Cover Container */}
          <div className="relative w-full h-full rounded-full overflow-hidden shadow-inner ring-1 ring-white/20 bg-neutral-950">
            <div
              className={`absolute inset-0 ${
                isPlaying ? "animate-spin-slow" : ""
              }`}
            >
              <Image
                src={currentSong?.cover || DEFAULT_COVER_SRC}
                alt={currentSong?.title || "Now Playing"}
                fill
                className="object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = DEFAULT_COVER_SRC;
                }}
                unoptimized
              />
            </div>

            {/* Ambient vignette gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-white/15 pointer-events-none" />

            {/* Quick Play/Pause Overlay on Hover */}
            <AnimatePresence>
              {(showPlayOverlay || !isPlaying) && (
                <motion.button
                  type="button"
                  aria-label={isPlaying ? "暂停播放" : "继续播放"}
                  className="dock-action-btn absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center text-white transition-opacity z-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handlePlayToggle}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-white text-white drop-shadow-md" />
                  ) : (
                    <Play className="w-4 h-4 fill-white text-white ml-0.5 drop-shadow-md" />
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Dynamic Soundwave & Restore Indicator Content */}
        <div
          className={`flex flex-col justify-center items-center gap-1 ${
            isLeft ? "pr-1" : "pl-1"
          }`}
        >
          {/* 3 Mini Bouncing Soundwave Bars */}
          <div className="flex items-end justify-center gap-[2.5px] h-3.5 w-3.5">
            {[0, 1, 2].map((idx) => {
              const delays = [0, 0.22, 0.44];
              const heights = [
                ["30%", "95%", "40%", "85%", "30%"],
                ["50%", "25%", "100%", "35%", "50%"],
                ["25%", "85%", "30%", "95%", "25%"],
              ];

              return (
                <motion.span
                  key={idx}
                  className="w-[2px] rounded-full bg-[#2997ff]"
                  animate={
                    isPlaying
                      ? {
                          height: heights[idx],
                        }
                      : {
                          height: "25%",
                          opacity: 0.45,
                        }
                  }
                  transition={{
                    repeat: Infinity,
                    duration: 0.85 + idx * 0.18,
                    ease: "easeInOut",
                    delay: delays[idx],
                  }}
                  style={{
                    height: "30%",
                  }}
                />
              );
            })}
          </div>

          {/* Hover Expand Chevron Hint */}
          <motion.div
            className="text-white/60 group-hover:text-white transition-colors"
            animate={
              isHovered
                ? {
                    x: isLeft ? [0, 3, 0] : [0, -3, 0],
                  }
                : {}
            }
            transition={{
              repeat: Infinity,
              duration: 1.2,
              ease: "easeInOut",
            }}
          >
            {isLeft ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </motion.div>
        </div>

        {/* Hover Tooltip / Hint */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className={`absolute top-1/2 -translate-y-1/2 px-2.5 py-1 bg-black/85 backdrop-blur-md rounded-lg border border-white/10 text-white/90 text-[11px] font-medium whitespace-nowrap shadow-xl pointer-events-none z-30 flex items-center gap-1.5 ${
                isLeft ? "left-full ml-2.5" : "right-full mr-2.5"
              }`}
              initial={{ opacity: 0, scale: 0.85, x: isLeft ? -6 : 6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: isLeft ? -6 : 6 }}
              transition={{ duration: 0.15 }}
            >
              <span>{isPlaying ? currentSong?.title || "正在播放" : "点击唤醒"}</span>
              <span className="text-white/40 text-[9px]">
                {isLeft ? "向右拉出" : "向左拉出"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
