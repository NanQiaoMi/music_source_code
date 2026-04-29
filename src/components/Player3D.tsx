"use client";

import React, { useState, useRef, useEffect, useCallback, memo } from "react";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { LyricVisualizer } from "./LyricVisualizer";
import { FullscreenLyrics } from "./FullscreenLyrics";
import { useAudioStore, LoopMode } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { Sparkles, Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Volume2, VolumeX } from "lucide-react";

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const HeartIcon = memo(({ filled }: { filled: boolean }) => (
  <svg
    className={`w-5 h-5 transition-colors ${filled ? "text-pink-500 fill-pink-500" : "text-white/70"}`}
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
    />
  </svg>
));
HeartIcon.displayName = "HeartIcon";

const BreathingBorder = memo(
  ({
    isPlaying,
    isEnabled,
    intensity = 1,
  }: {
    isPlaying: boolean;
    isEnabled: boolean;
    intensity?: number;
  }) => {
    const baseIntensity = intensity;

    if (!isEnabled) return null;

    return (
      <>
        <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-8"
            style={{
              background: `linear-gradient(to top, 
                rgba(255, 255, 255, ${0.15 * baseIntensity}) 0%, 
                rgba(255, 255, 255, ${0.05 * baseIntensity}) 40%,
                transparent 100%)`,
              filter: "blur(8px)",
            }}
            animate={
              isPlaying
                ? { opacity: [0.4, 0.9, 0.4] }
                : { opacity: 0.25 }
            }
            transition={
              isPlaying
                ? { repeat: Infinity, duration: 3.2, ease: [0.4, 0, 0.2, 1], delay: 1.6 }
                : { duration: 0.8 }
            }
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{
              background: `linear-gradient(90deg, 
                transparent 0%, 
                rgba(255, 255, 255, ${0.4 * baseIntensity}) 20%,
                rgba(255, 255, 255, ${0.6 * baseIntensity}) 50%,
                rgba(255, 255, 255, ${0.4 * baseIntensity}) 80%,
                transparent 100%)`,
              filter: "blur(0.5px)",
            }}
            animate={
              isPlaying
                ? { opacity: [0.3, 0.8, 0.3] }
                : { opacity: 0.2 }
            }
            transition={
              isPlaying
                ? { repeat: Infinity, duration: 3.2, ease: [0.4, 0, 0.2, 1], delay: 1.75 }
                : { duration: 0.8 }
            }
          />
        </div>
      </>
    );
  }
);
BreathingBorder.displayName = "BreathingBorder";

interface CoverWith3DEffectProps {
  cover: string;
  title: string;
  isPlaying: boolean;
  albumId?: string;
}

const APPLE_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 1,
  bounce: 0,
};

const CoverWith3DEffect: React.FC<CoverWith3DEffectProps> = memo(({ cover, title, isPlaying, albumId }) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const rotateX = ((mouseY - centerY) / centerY) * -8;
    const rotateY = ((mouseX - centerX) / centerX) * 8;

    setTilt({ x: rotateX, y: rotateY });
    setMousePosition({ x: (mouseX - centerX) / centerX, y: (mouseY - centerY) / centerY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setMousePosition({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      layoutId={albumId ? `album-cover-${albumId}` : undefined}
      className="relative w-full max-w-[500px] mx-auto"
      animate={{
        rotateX: tilt.x,
        rotateY: tilt.y,
        scale: isPlaying ? 1 : 0.95,
      }}
      transition={APPLE_SPRING_CONFIG}
      style={{
        perspective: 1200,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="relative w-full aspect-square"
        animate={{
          scale: isPlaying ? [1, 1.02, 1] : 1,
        }}
        transition={
          isPlaying
            ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.5 }
        }
      >
        <div
          className="relative w-full h-full rounded-[2rem] overflow-hidden"
          style={{
            transformStyle: "preserve-3d",
            boxShadow: `
              0 60px 100px rgba(0, 0, 0, 0.6),
              0 30px 60px rgba(0, 0, 0, 0.4),
              0 0 0 1px rgba(255, 255, 255, 0.1)
            `,
            transform: `translateZ(0)`,
          }}
        >
          <Image
            src={cover}
            alt={title}
            fill
            className="object-cover"
            priority
            unoptimized
          />

          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/[0.08] via-transparent to-black/[0.15] pointer-events-none" />
          <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/10" />

          <motion.div
            className="absolute inset-0 rounded-[2rem] bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0"
            animate={{ opacity: isPlaying ? [0, 0.4, 0] : 0 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        <motion.div
          className="absolute -inset-1 rounded-[2.5rem] pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${50 + mousePosition.x * 20}% ${50 + mousePosition.y * 20}%, rgba(255,255,255,0.15) 0%, transparent 50%)`,
            opacity: 0.6,
          }}
        />
      </motion.div>
    </motion.div>
  );
});
CoverWith3DEffect.displayName = "CoverWith3DEffect";

export const Player3D: React.FC = () => {
  const isPlaying = useAudioStore(state => state.isPlaying);
  const currentTime = useAudioStore(state => state.currentTime);
  const duration = useAudioStore(state => state.duration);
  const currentSong = useAudioStore(state => state.currentSong);
  const isLoading = useAudioStore(state => state.isLoading);
  const error = useAudioStore(state => state.error);
  const clearError = useAudioStore(state => state.clearError);
  const { setCurrentView, setIsTransitioning } = useUIStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const { setIsPlaying, nextSong, prevSong, seekTo, volume, isMuted, toggleMute, setVolume, loopMode, cycleLoopMode } = useAudioStore();

  const [breathingEffectEnabled] = useState(true);
  const [showFullscreenLyrics, setShowFullscreenLyrics] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  const handleBack = useCallback(() => {
    setIsTransitioning(true);
    requestAnimationFrame(() => {
      setCurrentView("home");
      setTimeout(() => setIsTransitioning(false), 600);
    });
  }, [setCurrentView, setIsTransitioning]);

  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (currentSong) {
        toggleFavorite(currentSong);
      }
    },
    [currentSong, toggleFavorite]
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <BreathingBorder isPlaying={isPlaying} isEnabled={breathingEffectEnabled} intensity={1} />

      <div className="w-full max-w-7xl mx-auto h-[90vh] px-8 lg:px-16 flex flex-col">
        {/* 主要内容区域 */}
        <div className="flex-1 flex items-center">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
            {/* 左侧卡片区域 - 左移 */}
            <motion.div
              className="flex flex-col items-center lg:items-start lg:pl-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {currentSong ? (
                <CoverWith3DEffect
                  cover={currentSong.cover}
                  title={currentSong.title}
                  isPlaying={isPlaying}
                  albumId={currentSong.id}
                />
              ) : (
                <div
                  className="relative w-full max-w-[500px] aspect-square rounded-[2rem] flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    boxShadow: "0 60px 100px rgba(0, 0, 0, 0.6)",
                  }}
                >
                  <svg className="w-24 h-24 text-white/20" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 6v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
              )}

              <motion.div
                className="mt-10 text-center lg:text-left max-w-md"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <h2 className="text-3xl font-bold text-white tracking-tight mb-3 truncate px-4">
                  {currentSong?.title || "未选择歌曲"}
                </h2>
                <p className="text-white/50 text-lg truncate px-4">
                  {currentSong?.artist || "请选择歌曲播放"}
                </p>
                {currentSong?.album && (
                  <p className="text-white/30 text-sm mt-2 truncate px-4">
                    {currentSong.album}
                  </p>
                )}
              </motion.div>

              <motion.div
                className="flex items-center gap-4 mt-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleToggleFavorite}
                  disabled={!currentSong}
                  className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-[20px] saturate-[180%] border transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed ${
                    currentSong && isFavorite(currentSong.id)
                      ? "bg-pink-500/20 border-pink-500/30 text-pink-500"
                      : "bg-white/[0.08] border-white/[0.08] text-white/70 hover:bg-white/[0.15] hover:text-white hover:border-white/[0.15]"
                  }`}
                  title={currentSong && isFavorite(currentSong.id) ? "取消收藏" : "收藏"}
                >
                  <HeartIcon filled={currentSong ? isFavorite(currentSong.id) : false} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setIsTransitioning(true);
                    requestAnimationFrame(() => {
                      setCurrentView("visualization");
                      setTimeout(() => setIsTransitioning(false), 600);
                    });
                  }}
                  className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-[20px] saturate-[180%] border transition-all duration-300 bg-white/[0.08] border-white/[0.08] text-white/70 hover:bg-white/[0.15] hover:text-white hover:border-white/[0.15]"
                  title="进入全屏沉浸可视化"
                >
                  <Sparkles className="w-5 h-5" />
                </motion.button>
              </motion.div>
            </motion.div>

            {/* 右侧歌词区域 */}
            <motion.div
              className="w-full h-[500px] lg:h-[600px] cursor-pointer relative overflow-hidden"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              onClick={() => setShowFullscreenLyrics(true)}
              title="点击进入全屏歌词"
            >
              <LyricVisualizer key={currentSong?.id} />
            </motion.div>
          </div>
        </div>

        {/* 下方播放控制 */}
        <motion.div
          className="mt-8 pb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="max-w-4xl mx-auto bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 px-8 py-6">
            {/* 进度条 */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-white/60 mb-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div 
                className="h-1.5 bg-white/10 rounded-full cursor-pointer group"
                onClick={(e) => {
                  if (!currentSong) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  seekTo(duration * percent);
                }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentTime / duration) * 100}%` }}
                  transition={{ duration: 0.1 }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex items-center justify-between">
              {/* 左侧控制 */}
              <div className="flex items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`p-2 rounded-full transition-all ${
                    isShuffle ? "text-pink-500 bg-pink-500/20" : "text-white/50 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Shuffle className="w-5 h-5" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => cycleLoopMode()}
                  className={`p-2 rounded-full transition-all ${
                    loopMode !== "none" ? "text-pink-500 bg-pink-500/20" : "text-white/50 hover:text-white hover:bg-white/10"
                  }`}
                  title={`循环模式: ${loopMode === "none" ? "不循环" : loopMode === "single" ? "单曲循环" : loopMode === "all" ? "列表循环" : "随机播放"}`}
                >
                  <Repeat className="w-5 h-5" />
                </motion.button>
              </div>

              {/* 中间播放控制 */}
              <div className="flex items-center gap-6">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={prevSong}
                  disabled={!currentSong}
                  className="p-3 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                >
                  <SkipBack className="w-8 h-8" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={!currentSong}
                  className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-30"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8" fill="currentColor" />
                  ) : (
                    <Play className="w-8 h-8 ml-1" fill="currentColor" />
                  )}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={nextSong}
                  disabled={!currentSong}
                  className="p-3 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
                >
                  <SkipForward className="w-8 h-8" />
                </motion.button>
              </div>

              {/* 右侧音量控制 */}
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleMute}
                  className="p-2 text-white/60 hover:text-white transition-all"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </motion.button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-24 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showFullscreenLyrics && (
          <FullscreenLyrics
            isOpen={showFullscreenLyrics}
            onClose={() => setShowFullscreenLyrics(false)}
          />
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleBack}
        className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/[0.08] backdrop-blur-[24px] saturate-[180%] border border-white/[0.08] text-white/70 flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-white/[0.15] hover:text-white hover:border-white/[0.15] active:scale-95 z-50"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </motion.button>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-500/95 backdrop-blur-xl text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[300px] max-w-[500px] z-50"
          >
            <svg
              className="w-6 h-6 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0a9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="font-medium">{error.message}</p>
              {error.type === "network" && (
                <p className="text-sm text-white/70 mt-1">请检查网络连接后重试</p>
              )}
              {error.type === "load" && (
                <p className="text-sm text-white/70 mt-1">该歌曲暂无音频文件</p>
              )}
            </div>
            <div className="flex gap-2">
              {error.type === "network" && (
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm transition-colors"
                >
                  重试
                </button>
              )}
              <button
                onClick={clearError}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
