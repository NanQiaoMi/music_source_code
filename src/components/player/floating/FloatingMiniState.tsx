"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { FloatingAmbientGlow } from "./FloatingAmbientGlow";
import { LiquidGlassFilter } from "./LiquidGlassFilter";
import type { DragHandlers } from "./useFloatingDragPhysics";

const DEFAULT_COVER_SRC = "/default-cover.svg";

export interface FloatingMiniStateProps {
  /** Triggered when clicking card body to expand to compact controls state */
  onExpand?: () => void;
  /** Drag handlers to enable fluid pointer movement */
  dragHandlers?: DragHandlers;
  /** Optional custom class name */
  className?: string;
  /** Whether to render dynamic ambient glow */
  showGlow?: boolean;
}

export const FloatingMiniState: React.FC<FloatingMiniStateProps> = ({
  onExpand,
  dragHandlers,
  className = "",
  showGlow = true,
}) => {
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentSong = useAudioStore((state) => state.currentSong);

  const [isHovered, setIsHovered] = useState(false);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
    // If clicked on interactive elements, ignore
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
      data-floating-state="mini"
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ touchAction: "none" }}
      whileHover={{ scale: 1.035 }}
      whileTap={{ scale: 0.97 }}
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
          glowSpread={28}
        />
      )}

      {/* 2. Mineradio 8-Layer Physical Liquid Glass Dynamic Island Capsule */}
      <div
        className="drag-handle relative flex items-center justify-between gap-3 px-3 py-1.5 mineradio-liquid-glass rounded-full transition-all duration-300 overflow-hidden"
        style={{
          width: 175,
          height: 52,
        }}
      >
        {/* Top Edge Specular Glint Highlight */}
        <div className="mineradio-glass-specular-glint" />
        <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

        {/* 3. Left: Apple Squircle Album Artwork */}
        <div className="relative w-9 h-9 rounded-[10px] overflow-hidden bg-neutral-900 shadow-sm border border-white/20 ring-1 ring-inset ring-white/10 flex-shrink-0">
          <Image
            src={currentSong.cover || DEFAULT_COVER_SRC}
            alt={currentSong.title}
            fill
            sizes="36px"
            className="object-cover"
          />
        </div>

        {/* 4. Right: 5-Bar Apple Live Activity Equalizer Waveform */}
        <div className="flex items-end justify-center gap-[3px] h-5 px-1.5 flex-shrink-0 pointer-events-none">
          {[
            { ratios: ["20%", "85%", "35%", "75%", "20%"], duration: 0.82, delay: 0 },
            { ratios: ["35%", "100%", "30%", "90%", "35%"], duration: 0.7, delay: 0.12 },
            { ratios: ["15%", "65%", "95%", "30%", "15%"], duration: 0.92, delay: 0.2 },
            { ratios: ["40%", "90%", "45%", "100%", "40%"], duration: 0.76, delay: 0.08 },
            { ratios: ["25%", "70%", "85%", "35%", "25%"], duration: 0.88, delay: 0.16 },
          ].map((config, i) => (
            <motion.span
              key={i}
              className="w-[2.5px] rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]"
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
