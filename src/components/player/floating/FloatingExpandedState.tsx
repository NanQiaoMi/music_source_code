"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, type Variants } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { useFloatingDebugStore } from "@/store/floatingDebugStore";
import { useBilingualLyricParser } from "@/hooks/useBilingualLyricParser";
import { FloatingControls, HeartFavoriteButton } from "./FloatingControls";
import { FloatingProgressScrubber } from "./FloatingProgressScrubber";
import { FloatingWaveformGlow } from "./FloatingWaveformGlow";
import { FloatingSpectrumGlow } from "./FloatingSpectrumGlow";
import type { DragHandlers } from "./useFloatingDragPhysics";
import { ChevronDown, Maximize2 } from "lucide-react";

const DEFAULT_COVER_SRC = "/default-cover.svg";

export interface FloatingExpandedStateProps {
  /** Callback fired to collapse back to pill or dock */
  onCollapse: () => void;
  /** Optional drag handlers to enable moving the card */
  dragHandlers?: DragHandlers;
  /** Custom class name */
  className?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      staggerChildren: 0.035,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 8,
    transition: { duration: 0.2 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

export const FloatingExpandedState: React.FC<FloatingExpandedStateProps> = ({
  onCollapse,
  dragHandlers,
  className = "",
}) => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const currentTime = useAudioStore((state) => state.currentTime);
  const { setCurrentView } = useUIStore();

  const visualizerMode = useFloatingDebugStore((state) => state.visualizerMode);
  const setVisualizerMode = useFloatingDebugStore((state) => state.setVisualizerMode);
  const [activeVisTab, setActiveVisTab] = useState<"waveform" | "spectrum">(
    visualizerMode === "spectrum" ? "spectrum" : "waveform"
  );

  // Parse lyrics for subtle one-line live preview
  const { lyrics, getCurrentLyricIndex } = useBilingualLyricParser(
    currentSong?.lyrics,
    currentSong?.translationLyrics,
    currentSong?.transliterationLyrics
  );

  const lyricList = lyrics.merged;
  const currentLyricIndex = getCurrentLyricIndex(currentTime);
  const activeLyric = currentLyricIndex >= 0 ? lyricList[currentLyricIndex] : (lyricList[0] || null);

  const handleExpandFullPlayer = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentView("player");
  };

  if (!currentSong) return null;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`relative w-[340px] select-none rounded-[36px] bg-[#000000] border border-white/[0.12] shadow-[0_28px_70px_rgba(0,0,0,0.85),inset_0_1px_1.5px_rgba(255,255,255,0.2)] overflow-hidden flex flex-col p-4 gap-3 text-white ${className}`}
      style={{ touchAction: "none" }}
    >
      {/* Top Edge Specular Glint Highlight */}
      <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

      {/* 1. Header Drag Handle & Top Bar */}
      <motion.div
        variants={itemVariants}
        className="drag-handle relative w-full flex items-center justify-between pt-0.5 cursor-grab active:cursor-grabbing z-20"
        onMouseDown={dragHandlers?.onMouseDown}
        onTouchStart={dragHandlers?.onTouchStart}
      >
        {/* Left Lossless Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.1] text-[10px] font-medium text-white/70 tracking-tight">
          <span>Apple Lossless</span>
        </div>

        {/* Center Grab Notch */}
        <div className="w-9 h-1 rounded-full bg-white/30 hover:bg-white/50 transition-colors" />

        {/* Collapse Action Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCollapse();
          }}
          className="control-interactive w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-white/70 hover:text-white flex items-center justify-center transition-all focus:outline-none active:scale-90"
          title="收起为灵动岛"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </motion.div>

      {/* 2. Hero Stage: Apple Squircle Album Artwork */}
      <motion.div
        variants={itemVariants}
        className="relative w-40 h-40 mx-auto rounded-[20px] overflow-hidden bg-neutral-900 shadow-[0_14px_36px_rgba(0,0,0,0.6)] border border-white/10 flex-shrink-0"
      >
        <Image
          src={currentSong.cover || DEFAULT_COVER_SRC}
          alt={currentSong.title}
          fill
          priority
          sizes="160px"
          className="object-cover"
        />
      </motion.div>

      {/* 3. Metadata & Heart Action */}
      <motion.div variants={itemVariants} className="flex items-center justify-between gap-2 px-1">
        <div className="flex-1 min-w-0">
          <h3
            className="text-white font-semibold text-[15px] leading-tight truncate tracking-[-0.016em]"
            title={currentSong.title}
          >
            {currentSong.title}
          </h3>
          <p className="text-[#86868b] text-[12px] font-normal tracking-[-0.01em] truncate mt-0.5">
            {(currentSong.artist || "未知歌手").replace(/;/g, ", ")}
          </p>
        </div>

        <HeartFavoriteButton size={17} className="control-interactive p-1 flex-shrink-0" />
      </motion.div>

      {/* 4. Apple Segmented Visualizer Tab & View */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1.5 px-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/40 font-medium">音频动态</span>
          <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setActiveVisTab("waveform");
                setVisualizerMode("waveform");
              }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                activeVisTab === "waveform"
                  ? "bg-white/20 text-white shadow-xs"
                  : "text-white/45 hover:text-white"
              }`}
            >
              波形
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveVisTab("spectrum");
                setVisualizerMode("spectrum");
              }}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                activeVisTab === "spectrum"
                  ? "bg-white/20 text-white shadow-xs"
                  : "text-white/45 hover:text-white"
              }`}
            >
              频谱
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-black/40 border border-white/[0.08] p-1 shadow-inner overflow-hidden">
          {activeVisTab === "waveform" ? (
            <FloatingWaveformGlow height={40} interactive={true} />
          ) : (
            <FloatingSpectrumGlow height={40} barCount={28} />
          )}
        </div>
      </motion.div>

      {/* 5. Subtle Synced Lyric Preview (Apple Music Subtitle Style) */}
      {activeLyric && (
        <motion.div
          variants={itemVariants}
          className="px-1 text-center -mt-0.5 cursor-pointer"
          onClick={handleExpandFullPlayer}
        >
          <p className="text-xs text-white/50 italic truncate tracking-tight">
            {activeLyric.original}
          </p>
        </motion.div>
      )}

      {/* 6. Sleek Apple Progress & Volume Scrubber */}
      <motion.div variants={itemVariants} className="px-1">
        <FloatingProgressScrubber showVolume={false} />
      </motion.div>

      {/* 7. Playback Controls Bar with FloatingControls */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-center px-1"
      >
        <FloatingControls
          showShuffleAndLoop={true}
          showFavorite={false}
          compact={false}
        />
      </motion.div>

      {/* 8. Quick "Expand Full Immersive Player" Frosted Pill */}
      <motion.button
        variants={itemVariants}
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleExpandFullPlayer}
        className="control-interactive relative group w-full py-2 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-white/80 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm"
      >
        <Maximize2 className="w-3.5 h-3.5 text-white/70 group-hover:rotate-45 transition-transform" />
        <span className="tracking-tight">展开沉浸播放器</span>
      </motion.button>
    </motion.div>
  );
};


