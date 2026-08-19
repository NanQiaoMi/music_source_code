"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { useBilingualLyricParser } from "@/hooks/useBilingualLyricParser";
import { FloatingAmbientGlow } from "./FloatingAmbientGlow";
import { LiquidGlassFilter } from "./LiquidGlassFilter";
import {
  MorphingPlayPauseButton,
  HeartFavoriteButton,
} from "./FloatingControls";
import { SkipBack, SkipForward, Mic2, ChevronUp } from "lucide-react";
import type { DragHandlers } from "./useFloatingDragPhysics";

const DEFAULT_COVER_SRC = "/default-cover.svg";

export interface FloatingCompactControlsStateProps {
  /** Triggered when clicking card body to open full expanded view */
  onExpandFull?: () => void;
  /** Triggered to collapse back to minimal state */
  onCollapseToMini?: () => void;
  /** Drag handlers */
  dragHandlers?: DragHandlers;
  /** Optional custom class name */
  className?: string;
  /** Whether to render glow */
  showGlow?: boolean;
}

export const FloatingCompactControlsState: React.FC<FloatingCompactControlsStateProps> = ({
  onExpandFull,
  onCollapseToMini,
  dragHandlers,
  className = "",
  showGlow = true,
}) => {
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentSong = useAudioStore((state) => state.currentSong);
  const currentTime = useAudioStore((state) => state.currentTime);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const togglePlay = () => setIsPlaying(!isPlaying);
  const prevSong = useAudioStore((state) => state.prevSong);
  const nextSong = useAudioStore((state) => state.nextSong);

  const [showMiniLyricTooltip, setShowMiniLyricTooltip] = useState(false);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Synced lyric parsing
  const { lyrics, getCurrentLyricIndex } = useBilingualLyricParser(
    currentSong?.lyrics,
    currentSong?.translationLyrics,
    currentSong?.transliterationLyrics
  );

  const lyricList = lyrics.merged;
  const currentLyricIndex = getCurrentLyricIndex(currentTime);
  const activeLyric = currentLyricIndex >= 0 ? lyricList[currentLyricIndex] : (lyricList[0] || null);

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
    // If clicked on buttons/controls, ignore
    if ((e.target as HTMLElement).closest(".control-interactive, button, a, input")) {
      return;
    }
    // If dragging moved > 5px, ignore
    const distance = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y
    );
    if (distance > 5) {
      return;
    }
    // Clicking in this interface returns to the initial state (mini dynamic island)
    onCollapseToMini?.();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".control-interactive, button, a, input")) {
      return;
    }
    // Double clicking expands to full card
    onExpandFull?.();
  };

  if (!currentSong) return null;

  return (
    <motion.div
      layoutId="floating-player-shell"
      className={`relative select-none group cursor-pointer ${className}`}
      data-floating-state="compact"
      onClick={handleCardClick}
      onDoubleClick={handleDoubleClick}
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

      {/* 0. Mineradio Flagship SVG Liquid Glass Dispersion Filter */}
      <LiquidGlassFilter />

      {/* 1. Ambient Glow Backing */}
      {showGlow && (
        <FloatingAmbientGlow
          rounded="rounded-full"
          borderBeam={false}
          intensity={0.7}
          glowSpread={32}
        />
      )}

      {/* 2. Mineradio 8-Layer Physical Liquid Glass Capsule Shell */}
      <div
        className="drag-handle relative flex items-center justify-between gap-3 px-3.5 py-2 mineradio-liquid-glass rounded-full transition-all duration-300"
        style={{
          width: 360,
          height: 60,
        }}
      >
        {/* Top Edge Specular Glint Highlight */}
        <div className="mineradio-glass-specular-glint" />
        <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

        {/* 3. Left Section: Cover Artwork */}
        <div className="relative w-10 h-10 rounded-[11px] overflow-hidden bg-neutral-900 shadow-md border border-white/20 ring-1 ring-inset ring-white/10 flex-shrink-0">
          <Image
            src={currentSong.cover || DEFAULT_COVER_SRC}
            alt={currentSong.title}
            fill
            sizes="40px"
            className="object-cover"
          />
        </div>

        {/* 4. Center Section: Title & Synced Lyric / Artist */}
        <div className="flex-1 min-w-0 flex flex-col justify-center pr-1">
          <h4
            className="text-white font-semibold text-[13.5px] tracking-[-0.016em] leading-tight truncate"
            title={currentSong.title}
          >
            {currentSong.title}
          </h4>

          <p className="text-[#98989d] text-[11.5px] font-normal tracking-[-0.01em] truncate leading-tight mt-0.5">
            {activeLyric?.original || (currentSong.artist || "未知歌手").replace(/;/g, ", ")}
          </p>
        </div>

        {/* 5. Right Section: The 5 Dedicated Controls (Pause/Play, Prev, Next, Lyric, Favorite) */}
        <div
          className="flex items-center gap-1 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Control 1: Lyric Preview Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMiniLyricTooltip((prev) => !prev)}
              className={`control-interactive w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                showMiniLyricTooltip || activeLyric
                  ? "text-white bg-white/15 hover:bg-white/25"
                  : "text-white/50 hover:text-white hover:bg-white/[0.08]"
              }`}
              title="歌词"
            >
              <Mic2 className="w-3.5 h-3.5" />
            </button>

            {/* Floating Mini Lyric Popover */}
            <AnimatePresence>
              {showMiniLyricTooltip && activeLyric && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute bottom-full right-0 mb-3 w-56 p-2.5 rounded-2xl bg-neutral-950/90 backdrop-blur-2xl border border-white/20 shadow-2xl text-center z-50 pointer-events-none"
                >
                  <p className="text-xs font-medium text-white tracking-tight">
                    {activeLyric.original}
                  </p>
                  {activeLyric.translation && (
                    <p className="text-[10px] text-white/60 mt-0.5">
                      {activeLyric.translation}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Control 2: Previous Song */}
          <button
            type="button"
            onClick={prevSong}
            className="control-interactive w-7 h-7 rounded-full text-white/70 hover:text-white flex items-center justify-center transition-colors active:scale-90"
            title="上一首"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Control 3: Play / Pause Morphing Button */}
          <MorphingPlayPauseButton
            isPlaying={isPlaying}
            onToggle={togglePlay}
            disabled={false}
            size="sm"
          />

          {/* Control 4: Next Song */}
          <button
            type="button"
            onClick={nextSong}
            className="control-interactive w-7 h-7 rounded-full text-white/70 hover:text-white flex items-center justify-center transition-colors active:scale-90"
            title="下一首"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Control 5: Favorite Heart Button */}
          <HeartFavoriteButton size={14} className="control-interactive p-1" />

          {/* Expand to Full Card Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpandFull?.();
            }}
            className="control-interactive w-6 h-6 rounded-full text-white/40 hover:text-white hover:bg-white/15 flex items-center justify-center transition-all ml-0.5 active:scale-90"
            title="展开为完整卡片 (双击卡片亦可)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

