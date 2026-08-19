"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { useProfessionalModeStore } from "@/store/professionalModeStore";
import { useBilingualLyricParser } from "@/hooks/useBilingualLyricParser";
import { useFloatingDebugStore } from "@/store/floatingDebugStore";
import { NowPlayingHalo } from "@/components/player/NowPlayingHalo";
import {
  FloatingControls,
  VinylRecord,
  HeartFavoriteButton,
} from "./FloatingControls";
import { FloatingWaveformGlow } from "./FloatingWaveformGlow";
import { FloatingSpectrumGlow } from "./FloatingSpectrumGlow";
import { FloatingProgressScrubber } from "./FloatingProgressScrubber";
import type { DragHandlers } from "./useFloatingDragPhysics";
import {
  ChevronDown,
  Sparkles,
  Maximize2,
  Award,
  Activity,
  Waves,
} from "lucide-react";

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
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentTime = useAudioStore((state) => state.currentTime);
  const currentSong = useAudioStore((state) => state.currentSong);
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);

  const { setCurrentView } = useUIStore();
  const { isFeatureEnabled } = useProfessionalModeStore();

  const visualizerMode = useFloatingDebugStore((state) => state.visualizerMode);
  const setVisualizerMode = useFloatingDebugStore((state) => state.setVisualizerMode);

  const [activeVisTab, setActiveVisTab] = useState<"waveform" | "spectrum">(
    visualizerMode === "spectrum" ? "spectrum" : "waveform"
  );

  // Parse lyrics for the live synced preview
  const { lyrics, getCurrentLyricIndex } = useBilingualLyricParser(
    currentSong?.lyrics,
    currentSong?.translationLyrics,
    currentSong?.transliterationLyrics
  );

  const lyricList = lyrics.merged;
  const currentLyricIndex = getCurrentLyricIndex(currentTime);
  const activeLyric = currentLyricIndex >= 0 ? lyricList[currentLyricIndex] : (lyricList[0] || null);
  const prevLyric = currentLyricIndex > 0 ? lyricList[currentLyricIndex - 1] : null;
  const nextLyric =
    currentLyricIndex >= 0 && currentLyricIndex < lyricList.length - 1
      ? lyricList[currentLyricIndex + 1]
      : null;

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
      className={`relative w-[360px] min-h-[500px] max-w-[92vw] select-none rounded-[32px] bg-black/65 backdrop-blur-[64px] backdrop-saturate-[200%] border border-white/[0.12] shadow-[0_32px_80px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] overflow-hidden flex flex-col p-4 gap-3 text-white ${className}`}
      style={{ touchAction: "none" }}
    >
      {/* Background Subtle Gradient Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.07] via-fuchsia-500/[0.05] to-purple-500/[0.07] pointer-events-none" />
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/[0.25] to-transparent pointer-events-none" />

      {/* 1. Header Drag Handle & Minimize Bar */}
      <motion.div
        variants={itemVariants}
        className="drag-handle relative w-full flex items-center justify-between pt-1 pb-1 cursor-grab active:cursor-grabbing z-20"
        onMouseDown={dragHandlers?.onMouseDown}
        onTouchStart={dragHandlers?.onTouchStart}
      >
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.08] text-[10px] font-mono text-cyan-300">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>IMMERSIVE V8</span>
        </div>

        {/* Center Grab Notch */}
        <div className="w-10 h-1.5 rounded-full bg-white/30 hover:bg-white/50 transition-colors" />

        {/* Collapse Action Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCollapse();
          }}
          className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-white/70 hover:text-white flex items-center justify-center transition-all focus:outline-none"
          title="收起胶囊"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </motion.div>

      {/* 2. Disc Showcase Section with NowPlayingHalo & Vinyl Record */}
      <motion.div
        variants={itemVariants}
        className="relative flex items-center gap-3.5 px-1 py-1"
      >
        <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
          {/* NowPlayingHalo Visual Aura */}
          <NowPlayingHalo
            currentTime={currentTime}
            isPlaying={isPlaying}
            level={isMuted ? 0 : volume}
            size={116}
            className="opacity-95"
          />

          {/* Vinyl Record Visual */}
          <VinylRecord
            coverUrl={currentSong.cover}
            title={currentSong.title}
            isPlaying={isPlaying}
            size={76}
          />

          {/* Hi-Res Badge */}
          {isFeatureEnabled("hi-res-indicator") && (
            <div className="absolute -top-1 -right-1 z-20">
              <div className="px-1.5 py-0.5 rounded bg-amber-500/30 border border-amber-500/50 text-amber-300 text-[8px] font-bold flex items-center gap-0.5 backdrop-blur-sm">
                <Award className="w-2.5 h-2.5" />
                <span>Hi-Res</span>
              </div>
            </div>
          )}
        </div>

        {/* Metadata & Favorite Button */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-1">
            <h3
              className="text-white font-bold text-[15px] leading-tight truncate tracking-tight"
              title={currentSong.title}
            >
              {currentSong.title}
            </h3>
            <HeartFavoriteButton size={16} />
          </div>

          <p className="text-white/60 text-xs truncate mt-1">{currentSong.artist}</p>
          {currentSong.album && (
            <p className="text-white/40 text-[10px] truncate mt-0.5">{currentSong.album}</p>
          )}
        </div>
      </motion.div>

      {/* 3. Visualizer Tabs & Glowing Visualization Module */}
      <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-1">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>VISUALIZER ENGINE</span>
          </span>

          <div className="flex items-center gap-1 bg-white/[0.06] p-0.5 rounded-lg border border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setActiveVisTab("waveform");
                setVisualizerMode("waveform");
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                activeVisTab === "waveform"
                  ? "bg-cyan-500/30 text-cyan-200 shadow-sm border border-cyan-400/30"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <Waves className="w-2.5 h-2.5" />
              <span>波形</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveVisTab("spectrum");
                setVisualizerMode("spectrum");
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                activeVisTab === "spectrum"
                  ? "bg-fuchsia-500/30 text-fuchsia-200 shadow-sm border border-fuchsia-400/30"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <Activity className="w-2.5 h-2.5" />
              <span>频谱</span>
            </button>
          </div>
        </div>

        {/* Visualizer Canvas Container */}
        <div className="rounded-2xl bg-black/40 border border-white/[0.08] p-1 shadow-inner overflow-hidden">
          {activeVisTab === "waveform" ? (
            <FloatingWaveformGlow height={52} interactive={true} />
          ) : (
            <FloatingSpectrumGlow height={52} barCount={32} />
          )}
        </div>
      </motion.div>

      {/* 4. Live Synced Breathing Lyric Preview */}
      <motion.div
        variants={itemVariants}
        className="relative px-3 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-center items-center text-center overflow-hidden min-h-[50px] cursor-pointer hover:bg-white/[0.06] transition-colors"
        onClick={handleExpandFullPlayer}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/[0.03] via-fuchsia-500/[0.04] to-purple-500/[0.03] pointer-events-none" />

        {activeLyric ? (
          <div className="relative z-10 w-full flex flex-col gap-0.5">
            {prevLyric && (
              <p className="text-[10px] text-white/30 truncate max-w-full">
                {prevLyric.original}
              </p>
            )}
            <p className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-white to-pink-200 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)] truncate max-w-full animate-pulse">
              {activeLyric.original}
            </p>
            {activeLyric.translation ? (
              <p className="text-[10px] text-white/50 truncate max-w-full">
                {activeLyric.translation}
              </p>
            ) : nextLyric ? (
              <p className="text-[10px] text-white/30 truncate max-w-full">
                {nextLyric.original}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-white/40 font-medium tracking-wide flex items-center gap-1.5 animate-pulse">
            <span>♪</span>
            <span>沉浸旋律，聆听心声</span>
            <span>♪</span>
          </p>
        )}
      </motion.div>

      {/* 5. Fluid Progress & Volume Scrubber */}
      <motion.div variants={itemVariants} className="px-1">
        <FloatingProgressScrubber showVolume={true} />
      </motion.div>

      {/* 6. Playback Controls Bar with FloatingControls */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-center px-2 pt-0.5"
      >
        <FloatingControls
          showShuffleAndLoop={true}
          showFavorite={false}
          compact={false}
        />
      </motion.div>

      {/* 7. Quick "Expand Immersive Player" Shimmer Button */}
      <motion.button
        variants={itemVariants}
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleExpandFullPlayer}
        className="relative group w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 hover:from-cyan-500/30 hover:via-purple-500/30 hover:to-pink-500/30 border border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(0,0,0,0.3)] overflow-hidden transition-all"
      >
        {/* Shimmer Light Stream Reflection */}
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        <Maximize2 className="w-3.5 h-3.5 text-cyan-300 group-hover:rotate-45 transition-transform" />
        <span className="tracking-wide">展开沉浸播放器</span>
      </motion.button>
    </motion.div>
  );
};
