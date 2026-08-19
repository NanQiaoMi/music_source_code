"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { FloatingAmbientGlow } from "./FloatingAmbientGlow";
import {
  MorphingPlayPauseButton,
  HeartFavoriteButton,
} from "./FloatingControls";
import { SkipBack, SkipForward, Maximize2 } from "lucide-react";
import type { DragHandlers } from "./useFloatingDragPhysics";

const DEFAULT_COVER_SRC = "/default-cover.svg";

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
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const togglePlay = () => setIsPlaying(!isPlaying);
  const prevSong = useAudioStore((state) => state.prevSong);
  const nextSong = useAudioStore((state) => state.nextSong);

  const [isHovered, setIsHovered] = useState(false);
  const textContainerRef = useRef<HTMLDivElement | null>(null);
  const textContentRef = useRef<HTMLHeadingElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Measure text overflow for Marquee
  useEffect(() => {
    const container = textContainerRef.current;
    const content = textContentRef.current;
    if (container && content) {
      setIsOverflowing(content.scrollWidth > container.clientWidth);
    }
  }, [currentSong?.title, currentSong?.artist]);

  const handleMouseDown = (e: React.MouseEvent) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    dragHandlers?.onMouseDown(e);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      pointerDownPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    dragHandlers?.onTouchStart(e);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicked on any interactive element, ignore expansion
    if ((e.target as HTMLElement).closest(".control-interactive, button, a, input")) {
      return;
    }
    // If pointer moved more than 5px during drag, don't trigger expand
    const distance = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y
    );
    if (distance > 5) {
      return;
    }
    onExpand?.();
  };

  if (!currentSong) return null;

  return (
    <motion.div
      layoutId="floating-player-shell"
      className={`relative select-none group cursor-grab active:cursor-grabbing ${className}`}
      data-floating-state="pill"
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ touchAction: "none" }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.985 }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 30,
      }}
    >
      {/* 1. Subtle Ambient Glow Backing */}
      {showGlow && (
        <FloatingAmbientGlow
          rounded="rounded-full"
          borderBeam={false}
          intensity={0.65}
          glowSpread={32}
        />
      )}

      {/* 2. Apple Dynamic Island Solid Jet-Black Capsule Shell */}
      <div
        className="drag-handle relative flex items-center justify-between gap-2.5 px-3 py-1.5 bg-[#000000] border border-white/[0.14] rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.22)] transition-all duration-300"
        style={{
          width: 320,
          height: 50,
        }}
      >
        {/* Top Edge Specular Glint Highlight */}
        <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

        {/* 3. Left Section: Apple Squircle Album Artwork + 3-Bar Live Activity Soundwave */}
        <div className="relative flex-shrink-0 flex items-center">
          <div className="relative w-8 h-8 rounded-[8px] overflow-hidden bg-neutral-900 shadow-sm border border-white/10 flex-shrink-0">
            <Image
              src={currentSong.cover || DEFAULT_COVER_SRC}
              alt={currentSong.title}
              fill
              sizes="32px"
              className="object-cover"
            />
          </div>

          {/* 3-Bar Apple Live Activity Soundwave */}
          <div className="absolute -bottom-0.5 -right-1 flex items-end gap-[1.5px] h-3 px-1 py-0.5 bg-black/90 rounded-full border border-white/20 pointer-events-none">
            {[0.4, 0.9, 0.6].map((ratio, i) => (
              <motion.span
                key={i}
                className="w-[2px] rounded-full bg-[#2997ff]"
                animate={
                  isPlaying
                    ? {
                        height: ["25%", `${ratio * 100}%`, "30%"],
                      }
                    : { height: "25%" }
                }
                transition={
                  isPlaying
                    ? {
                        repeat: Infinity,
                        repeatType: "mirror",
                        duration: 0.38 + i * 0.12,
                        ease: "easeInOut",
                      }
                    : { duration: 0.2 }
                }
                style={{
                  opacity: isPlaying ? 1 : 0.4,
                }}
              />
            ))}
          </div>
        </div>

        {/* 4. Center Section: SF Pro Clean Typography Marquee */}
        <div
          ref={textContainerRef}
          className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden cursor-pointer pl-0.5"
          style={{
            maskImage: isOverflowing
              ? "linear-gradient(to right, transparent, black 6%, black 94%, transparent)"
              : "none",
            WebkitMaskImage: isOverflowing
              ? "linear-gradient(to right, transparent, black 6%, black 94%, transparent)"
              : "none",
          }}
        >
          {/* Song Title */}
          <div className="overflow-hidden whitespace-nowrap">
            <motion.h4
              ref={textContentRef}
              className="text-white font-medium text-[13px] tracking-[-0.016em] leading-tight inline-block"
              animate={
                isOverflowing && isPlaying
                  ? {
                      x: [0, -100],
                      transition: {
                        repeat: Infinity,
                        repeatType: "mirror",
                        duration: 6,
                        ease: "linear",
                      },
                    }
                  : { x: 0 }
              }
            >
              {currentSong.title}
            </motion.h4>
          </div>

          {/* Artist */}
          <p className="text-[#86868b] text-[11px] font-normal tracking-[-0.01em] truncate leading-tight mt-0.5">
            {(currentSong.artist || "未知歌手").replace(/;/g, ", ")}
          </p>
        </div>

        {/* 5. Right Section: Apple Music Minimalist Controls */}
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Previous Song */}
          <button
            type="button"
            onClick={prevSong}
            className="control-interactive w-7 h-7 rounded-full text-white/65 hover:text-white flex items-center justify-center transition-colors active:scale-90"
            title="上一首"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Play/Pause Morphing SVG */}
          <MorphingPlayPauseButton
            isPlaying={isPlaying}
            onToggle={togglePlay}
            disabled={false}
            size="sm"
          />

          {/* Next Song */}
          <button
            type="button"
            onClick={nextSong}
            className="control-interactive w-7 h-7 rounded-full text-white/65 hover:text-white flex items-center justify-center transition-colors active:scale-90"
            title="下一首"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Favorite Heart Button */}
          <HeartFavoriteButton size={13} className="control-interactive p-1" />
        </div>
      </div>
    </motion.div>
  );
};

