"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { useProfessionalModeStore } from "@/store/professionalModeStore";
import { Sparkles, Maximize2 } from "lucide-react";
import { FloatingAmbientGlow } from "./FloatingAmbientGlow";
import {
  VinylRecord,
  MorphingPlayPauseButton,
  HeartFavoriteButton,
  JellyButton,
} from "./FloatingControls";
import { SkipBack, SkipForward } from "lucide-react";
import type { DragHandlers } from "./useFloatingDragPhysics";

export interface FloatingPillStateProps {
  /** Triggered when clicking card body to expand to expanded state */
  onExpand?: () => void;
  /** Drag handlers to enable fluid pointer movement */
  dragHandlers?: DragHandlers;
  /** Optional custom class name */
  className?: string;
  /** Whether to render dynamic ambient glow & border beam */
  showGlow?: boolean;
  /** Whether to render border beam */
  showBorderBeam?: boolean;
}

export const FloatingPillState: React.FC<FloatingPillStateProps> = ({
  onExpand,
  dragHandlers,
  className = "",
  showGlow = true,
  showBorderBeam = true,
}) => {
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentSong = useAudioStore((state) => state.currentSong);
  const isLoading = useAudioStore((state) => state.isLoading);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const togglePlay = () => setIsPlaying(!isPlaying);
  const prevSong = useAudioStore((state) => state.prevSong);
  const nextSong = useAudioStore((state) => state.nextSong);

  const { isFeatureEnabled } = useProfessionalModeStore();

  const [isHovered, setIsHovered] = useState(false);
  const textContainerRef = useRef<HTMLDivElement | null>(null);
  const textContentRef = useRef<HTMLHeadingElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Measure text overflow for Marquee
  useEffect(() => {
    const container = textContainerRef.current;
    const content = textContentRef.current;
    if (container && content) {
      setIsOverflowing(content.scrollWidth > container.clientWidth);
    }
  }, [currentSong?.title, currentSong?.artist]);

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicked on any button or interactive element, ignore expansion
    if ((e.target as HTMLElement).closest(".control-interactive, button, a")) {
      return;
    }
    onExpand?.();
  };

  if (!currentSong) return null;

  return (
    <motion.div
      layoutId="floating-player-shell"
      className={`relative select-none group cursor-pointer ${className}`}
      data-floating-state="pill"
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={dragHandlers?.onMouseDown}
      onTouchStart={dragHandlers?.onTouchStart}
      style={{ touchAction: "none" }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.985 }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 30,
      }}
    >
      {/* 1. Dynamic Ambient Glow & Border Beam Backing */}
      {showGlow && (
        <FloatingAmbientGlow
          rounded="rounded-full"
          borderBeam={showBorderBeam}
          intensity={0.9}
          glowSpread={40}
        />
      )}

      {/* 2. Frosted Liquid Glass Capsule Shell */}
      <div
        className="relative flex items-center justify-between gap-3 px-3.5 py-2.5 bg-black/55 backdrop-blur-[36px] backdrop-saturate-[200%] border border-white/[0.14] rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.55),inset_0_1px_1.5px_rgba(255,255,255,0.22)] transition-all duration-300"
        style={{
          width: 340,
          height: 64,
        }}
      >
        {/* Top Edge Specular Glint Highlight */}
        <div className="absolute top-0 left-6 right-6 h-[1.5px] bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

        {/* 3. Left Section: Micro Vinyl Record */}
        <div className="relative flex-shrink-0 flex items-center">
          <VinylRecord
            coverUrl={currentSong.cover}
            title={currentSong.title}
            isPlaying={isPlaying}
            size={44}
            onClick={() => onExpand?.()}
          />

          {/* Audio Waveform Indicator in Bottom Corner */}
          <div className="absolute -bottom-0.5 -right-1 flex items-end gap-[2px] h-3.5 px-1 py-0.5 bg-black/75 backdrop-blur-sm rounded-full border border-white/10 pointer-events-none">
            {[0.4, 0.9, 0.6, 0.8].map((baseRatio, i) => (
              <motion.span
                key={i}
                className="w-[2px] rounded-full bg-gradient-to-t from-cyan-400 to-white shadow-[0_0_4px_rgba(56,189,248,0.7)]"
                animate={
                  isPlaying
                    ? {
                        height: ["20%", `${baseRatio * 100}%`, "25%"],
                      }
                    : { height: "20%" }
                }
                transition={
                  isPlaying
                    ? {
                        repeat: Infinity,
                        repeatType: "mirror",
                        duration: 0.45 + i * 0.12,
                        ease: "easeInOut",
                      }
                    : { duration: 0.2 }
                }
                style={{
                  opacity: isPlaying ? 0.95 : 0.4,
                }}
              />
            ))}
          </div>
        </div>


        {/* 4. Center Section: Marquee Title & Artist */}
        <div
          ref={textContainerRef}
          className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden cursor-pointer pl-1"
          style={{
            maskImage: isOverflowing
              ? "linear-gradient(to right, transparent, black 6%, black 94%, transparent)"
              : "none",
            WebkitMaskImage: isOverflowing
              ? "linear-gradient(to right, transparent, black 6%, black 94%, transparent)"
              : "none",
          }}
        >
          {/* Song Title with Smooth Marquee */}
          <div className="overflow-hidden whitespace-nowrap">
            <motion.h4
              ref={textContentRef}
              className="text-white font-semibold text-xs tracking-tight inline-block"
              animate={
                isOverflowing && isPlaying
                  ? {
                      x: [0, -120],
                      transition: {
                        repeat: Infinity,
                        repeatType: "mirror",
                        duration: 7,
                        ease: "linear",
                      },
                    }
                  : { x: 0 }
              }
            >
              {currentSong.title}
            </motion.h4>
          </div>

          {/* Artist & Badges */}
          <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
            <p className="text-white/60 text-[11px] truncate tracking-normal font-normal">
              {currentSong.artist || "未知歌手"}
            </p>

            {isFeatureEnabled("hi-res-indicator") && (
              <span className="flex-shrink-0 px-1 py-0.2 bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[8px] font-bold rounded">
                HR
              </span>
            )}
          </div>
        </div>

        {/* 5. Right Section: Compact Micro-interaction Controls */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Previous Song */}
          <JellyButton
            onClick={prevSong}
            disabled={isLoading}
            ariaLabel="上一首"
            nudgeDirection="left"
            className="p-1.5"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </JellyButton>

          {/* Play/Pause Morphing SVG */}
          <MorphingPlayPauseButton
            isPlaying={isPlaying}
            onToggle={togglePlay}
            disabled={isLoading}
            size="sm"
          />

          {/* Next Song */}
          <JellyButton
            onClick={nextSong}
            disabled={isLoading}
            ariaLabel="下一首"
            nudgeDirection="right"
            className="p-1.5"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </JellyButton>

          {/* Favorite Heart Button */}
          <HeartFavoriteButton size={14} className="p-0.5" />
        </div>

        {/* Hover Quick Expand Hint icon */}
        <motion.div
          className="absolute -top-7 right-3 px-2 py-0.5 bg-black/80 backdrop-blur-md rounded-full border border-white/10 text-white/70 text-[10px] pointer-events-none flex items-center gap-1 shadow-lg"
          initial={{ opacity: 0, y: 4 }}
          animate={isHovered ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
        >
          <Maximize2 className="w-2.5 h-2.5" />
          <span>展开</span>
        </motion.div>
      </div>
    </motion.div>
  );
};
