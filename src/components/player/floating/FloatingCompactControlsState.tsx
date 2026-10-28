"use client";

import React, { useRef, useState, memo } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useBilingualLyricParser } from "@/hooks/useBilingualLyricParser";
import { usePlaybackClock } from "@/hooks/usePlaybackClock";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";
import {
  SkipBack,
  SkipForward,
  Mic2,
  ChevronUp,
  Play,
  Pause,
  Heart,
  LoaderCircle,
} from "lucide-react";
import type { DragHandlers } from "./useFloatingDragPhysics";
import { Song } from "@/types/song";
import { FloatingSpeedControl } from "./FloatingSpeedControl";
import { FloatingSpectrumGlow } from "./FloatingSpectrumGlow";

const DEFAULT_COVER_SRC = "/default-cover.svg";

export interface FloatingCompactControlsStateProps {
  onExpandFull?: () => void;
  onCollapseToMini?: () => void;
  dragHandlers?: DragHandlers;
  className?: string;
  showGlow?: boolean;
  /** 浮动层门控：false 时频谱循环停表，默认 true 保持旧行为。 */
  active?: boolean;
}

// ---------------------------------------------------------------------------
// 1. 细粒度独立动态歌词微组件 (零全局重绘风暴)
// ---------------------------------------------------------------------------
const SyncedMiniLyric = memo(function SyncedMiniLyric({ song }: { song: Song | null }) {
  const currentTime = usePlaybackClock((state) => state.currentTime);
  const { lyrics, getCurrentLyricIndex } = useBilingualLyricParser(
    song?.lyrics,
    song?.translationLyrics,
    song?.transliterationLyrics
  );

  const lyricList = lyrics.merged;
  const currentLyricIndex = getCurrentLyricIndex(currentTime);
  const activeLyric = currentLyricIndex >= 0 ? lyricList[currentLyricIndex] : lyricList[0] || null;
  const prefersReducedMotion = useReducedMotion() === true;

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.p
        key={`${song?.id || song?.title || "unknown"}-${activeLyric?.time ?? "artist"}`}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, y: -2 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : { type: "spring", stiffness: 360, damping: 30, mass: 0.7 }
        }
        className="text-white/60 text-[11.5px] font-normal tracking-[-0.01em] truncate leading-tight mt-0.5"
      >
        {activeLyric?.original || (song?.artist || "未知歌手").replace(/;/g, ", ")}
      </motion.p>
    </AnimatePresence>
  );
});

// ---------------------------------------------------------------------------
// 2. 0ms 零延迟极速高光播放按钮
// ---------------------------------------------------------------------------
const FastPlayPauseButton = memo(function FastPlayPauseButton({
  isPlaying,
  isLoading,
  prefersReducedMotion,
  onToggle,
}: {
  isPlaying: boolean;
  isLoading: boolean;
  prefersReducedMotion: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.88 }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
      transition={
        prefersReducedMotion ? { duration: 0.01 } : { type: "spring", stiffness: 500, damping: 22 }
      }
      className="control-interactive relative w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-[0_4px_16px_rgba(255,255,255,0.4),inset_0_1px_1.5px_rgba(255,255,255,0.9)] cursor-pointer select-none group"
      title={isLoading ? "正在缓冲" : isPlaying ? "暂停" : "播放"}
      aria-label={isLoading ? "正在缓冲" : isPlaying ? "暂停" : "播放"}
      aria-busy={isLoading}
    >
      <AnimatePresence mode="sync" initial={false}>
        {isLoading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.72, y: 2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.82, y: -1 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 380, damping: 30, mass: 0.7 }
            }
            className="flex items-center justify-center"
          >
            <LoaderCircle className="w-4 h-4 opacity-70" aria-hidden="true" />
          </motion.span>
        ) : isPlaying ? (
          <motion.span
            key="pause"
            initial={{ opacity: 0, scale: 0.76, y: 2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.86, y: -1 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 380, damping: 30, mass: 0.7 }
            }
            className="flex items-center justify-center"
          >
            <Pause className="w-4 h-4 fill-black text-black" />
          </motion.span>
        ) : (
          <motion.span
            key="play"
            initial={{ opacity: 0, scale: 0.76, y: -2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.86, y: 1 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 380, damping: 30, mass: 0.7 }
            }
            className="flex items-center justify-center"
          >
            <Play className="w-4 h-4 fill-black text-black ml-0.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

// ---------------------------------------------------------------------------
// 3. 0ms 极速响应红心收藏按钮
// ---------------------------------------------------------------------------
const FastHeartButton = memo(function FastHeartButton({ songId }: { songId?: string }) {
  const isFavorite = useFavoritesStore((state) => (songId ? state.isFavorite(songId) : false));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const prefersReducedMotion = useReducedMotion() === true;

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (currentSong) toggleFavorite(currentSong);
      }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.8 }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.1 }}
      className="control-interactive w-7 h-7 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
      title={isFavorite ? "取消收藏" : "添加收藏"}
    >
      <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
    </motion.button>
  );
});

// ---------------------------------------------------------------------------
// 4. 满帧高性能胶囊控制器主组件 (FloatingCompactControlsState)
// ---------------------------------------------------------------------------
export const FloatingCompactControlsState: React.FC<FloatingCompactControlsStateProps> = ({
  onExpandFull,
  onCollapseToMini,
  dragHandlers,
  className = "",
  showGlow = false,
  active = true,
}) => {
  const playbackPhase = usePlaybackRuntimeStore((state) => state.phase);
  const shouldPlay = usePlaybackRuntimeStore((state) => state.shouldPlay);
  const isPlaying = playbackPhase === "playing";
  const isLoading = playbackPhase === "loading" || playbackPhase === "buffering";
  const prefersReducedMotion = useReducedMotion() === true;
  const tapScaleClass = prefersReducedMotion ? "" : "active:scale-90";

  // S6-4: 身份字段 currentSong 读 playerStore（audioStore 仅剩兼容投影）
  const currentSong = usePlayerStore((state) => state.currentSong);

  const [showMiniLyricTooltip, setShowMiniLyricTooltip] = useState(false);
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
    if ((e.target as HTMLElement).closest(".control-interactive, button, a, input")) {
      return;
    }
    const distance = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y
    );
    if (distance > 5) return;
    onCollapseToMini?.();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".control-interactive, button, a, input")) {
      return;
    }
    onExpandFull?.();
  };

  const handleNextTrack = React.useCallback(() => {
    useAudioStore.getState().nextSong();
  }, []);

  const handlePrevTrack = React.useCallback(() => {
    useAudioStore.getState().prevSong();
  }, []);

  const handleTogglePlay = React.useCallback(() => {
    const nextPlaying = !usePlaybackRuntimeStore.getState().shouldPlay;
    useAudioStore.getState().setIsPlaying(nextPlaying);
    usePlayerStore.getState().setIsPlaying(nextPlaying);
  }, []);

  if (!currentSong) return null;

  return (
    <motion.div
      className={`relative select-none group cursor-pointer ${className}`}
      data-floating-state="compact"
      onClick={handleCardClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ touchAction: "none", willChange: "transform" }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.015 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
      transition={
        prefersReducedMotion ? { duration: 0.01 } : { type: "spring", stiffness: 450, damping: 28 }
      }
      aria-busy={isLoading}
    >
      {/* 纯 CSS 硬件加速暗黑毛玻璃胶囊 (360px x 56px) */}
      <div
        className="drag-handle relative flex items-center justify-between gap-3 px-3.5 py-2 rounded-full shadow-[0_16px_48px_rgba(0,0,0,0.65),inset_0_1px_1.5px_rgba(255,255,255,0.25)] border border-white/[0.18] transition-all"
        style={{
          width: 404,
          height: 56,
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(20, 20, 26, 0.88) 100%)",
          backdropFilter: "blur(32px) saturate(190%)",
          WebkitBackdropFilter: "blur(32px) saturate(190%)",
        }}
      >
        {showGlow && (
          <FloatingSpectrumGlow
            overlay
            active={active}
            className="pointer-events-none absolute inset-0 z-0 opacity-[0.2]"
            height={56}
            barCount={48}
          />
        )}

        {/* 顶部极细反光线 */}
        <div className="absolute top-0 left-8 right-8 z-[1] h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

        {/* 1. 左侧专辑封面 */}
        <div className="relative z-[1] w-9 h-9 rounded-xl overflow-hidden bg-white/10 shadow-sm border border-white/25 flex-shrink-0">
          <motion.div
            key={currentSong.cover || currentSong.id || currentSong.title}
            initial={{ opacity: 0, scale: 0.94, y: 1 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { type: "spring", stiffness: 360, damping: 30, mass: 0.72 }
            }
            className="absolute inset-0"
          >
            <Image
              src={currentSong.cover || DEFAULT_COVER_SRC}
              alt={currentSong.title}
              fill
              sizes="36px"
              className="object-cover"
              unoptimized
            />
          </motion.div>
        </div>

        {/* 2. 中间歌名与独立细粒度歌词 */}
        <div
          className="relative z-[1] flex-1 min-w-0 flex flex-col justify-center pr-1 text-left"
          aria-busy={isLoading}
        >
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={`${currentSong.id || currentSong.title}:${currentSong.title}`}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 4, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -3, filter: "blur(1px)" }}
              transition={
                prefersReducedMotion
                  ? { duration: 0.01 }
                  : { type: "spring", stiffness: 340, damping: 30, mass: 0.75 }
              }
              className="min-w-0"
            >
              <h4
                className="text-white font-semibold text-[13px] tracking-tight leading-tight truncate"
                title={currentSong.title}
              >
                {currentSong.title}
              </h4>
              <SyncedMiniLyric song={currentSong} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 3. 右侧控制按钮组 (0ms 零延迟极速响应) */}
        <div
          className="relative z-[1] flex items-center gap-1.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 歌词按钮 */}
          <button
            type="button"
            onClick={() => setShowMiniLyricTooltip((prev) => !prev)}
            className={`control-interactive w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              showMiniLyricTooltip
                ? "text-white bg-white/20 border border-white/25 shadow-sm"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
            title="查看完整歌词"
          >
            <Mic2 className="w-3.5 h-3.5" />
          </button>

          {/* 上一首 */}
          <button
            type="button"
            onClick={handlePrevTrack}
            className={`control-interactive w-7 h-7 rounded-full text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all ${tapScaleClass}`}
            title="上一首"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* 播放/暂停 */}
          <FastPlayPauseButton
            isPlaying={isPlaying}
            isLoading={isLoading && shouldPlay}
            prefersReducedMotion={prefersReducedMotion}
            onToggle={handleTogglePlay}
          />

          {/* 下一首 */}
          <button
            type="button"
            onClick={handleNextTrack}
            className={`control-interactive w-7 h-7 rounded-full text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all ${tapScaleClass}`}
            title="下一首"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* 播放速度图标 (平时为图标，点击展开气泡菜单) */}
          <FloatingSpeedControl menuPosition="top" buttonSize="sm" />

          {/* 收藏红心 */}
          <FastHeartButton songId={currentSong.id} />

          {/* 展开全屏播放器按钮 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpandFull?.();
            }}
            className={`control-interactive w-6 h-6 rounded-full text-white/50 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all ml-0.5 ${tapScaleClass}`}
            title="展开为完整播放器"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default FloatingCompactControlsState;
