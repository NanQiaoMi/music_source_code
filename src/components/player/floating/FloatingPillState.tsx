"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { FloatingAmbientGlow } from "./FloatingAmbientGlow";
import { LiquidGlassFilter } from "./LiquidGlassFilter";
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
      className={`relative select-none group cursor-pointer ${className}`}
      data-floating-state="pill"
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ touchAction: "none" }}
      whileHover={{ scale: 1.025 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 30,
      }}
    >
      {/* 0. Mineradio Flagship SVG Liquid Glass Dispersion Filter */}
      <LiquidGlassFilter />

      {/* 1. Subtle Monochrome Liquid Glass Ambient Glow */}
      {showGlow && (
        <FloatingAmbientGlow
          rounded="rounded-full"
          borderBeam={false}
          intensity={0.65}
          glowSpread={32}
        />
      )}

      {/* 2. Mineradio 8-Layer Physical Liquid Glass Dynamic Island Capsule (Ultra-Transparent) */}
      <div
        className="drag-handle relative flex items-center justify-between gap-3.5 px-3.5 py-2 mineradio-liquid-glass rounded-full transition-all duration-300 overflow-hidden"
        style={{
          width: 340,
          height: 58,
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.05) 40%, rgba(20, 20, 30, 0.20) 100%)",
          backdropFilter: "blur(48px) saturate(200%)",
          WebkitBackdropFilter: "blur(48px) saturate(200%)",
          border: "1px solid rgba(255, 255, 255, 0.28)",
        }}
      >
        {/* Top Edge Specular Glint Highlight */}
        <div className="mineradio-glass-specular-glint" />
        <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none" />

        {/* 3. Left Section: Apple Squircle Album Artwork */}
        <div className="relative w-10 h-10 rounded-[11px] overflow-hidden bg-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.25)] border border-white/30 ring-1 ring-inset ring-white/20 flex-shrink-0">
          <Image
            src={currentSong.cover || DEFAULT_COVER_SRC}
            alt={currentSong.title}
            fill
            sizes="40px"
            className="object-cover"
          />
        </div>

        {/* 4. Center Section: Spacious SF Pro Typography (Full Song Title + Artist) */}
        <div
          ref={textContainerRef}
          className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden pr-2"
          style={{
            maskImage: isOverflowing
              ? "linear-gradient(to right, black 85%, transparent 100%)"
              : "none",
            WebkitMaskImage: isOverflowing
              ? "linear-gradient(to right, black 85%, transparent 100%)"
              : "none",
          }}
        >
          {/* Song Title */}
          <div className="overflow-hidden whitespace-nowrap">
            <motion.h4
              ref={textContentRef}
              className="text-white font-semibold text-[14px] tracking-[-0.018em] leading-snug inline-block"
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
          <p className="text-[#98989d] text-[12px] font-normal tracking-[-0.01em] truncate leading-tight mt-0.5">
            {(currentSong.artist || "未知歌手").replace(/;/g, ", ")}
          </p>
        </div>

        {/* 5. Right Section: Apple Dynamic Island Live Audio Equalizer Waveform */}
        <div className="flex items-end justify-center gap-[3px] h-5 px-2 flex-shrink-0 pointer-events-none">
          {[
            { ratios: ["25%", "85%", "40%", "75%", "25%"], duration: 0.85, delay: 0 },
            { ratios: ["40%", "100%", "30%", "90%", "40%"], duration: 0.72, delay: 0.15 },
            { ratios: ["20%", "70%", "95%", "35%", "20%"], duration: 0.95, delay: 0.08 },
            { ratios: ["35%", "90%", "50%", "100%", "35%"], duration: 0.78, delay: 0.22 },
          ].map((config, i) => (
            <motion.span
              key={i}
              className="w-[3px] rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]"
              animate={
                isPlaying
                  ? {
                      height: config.ratios,
                    }
                  : { height: "20%" }
              }
              transition={
                isPlaying
                  ? {
                      repeat: Infinity,
                      repeatType: "mirror",
                      duration: config.duration,
                      delay: config.delay,
                      ease: "easeInOut",
                    }
                  : { duration: 0.25 }
              }
              style={{
                opacity: isPlaying ? 0.95 : 0.35,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};



