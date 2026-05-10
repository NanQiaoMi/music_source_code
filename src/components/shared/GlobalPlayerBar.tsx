"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { Volume2, VolumeX, Music2, Maximize2 } from "lucide-react";
import { GlassRadarWidget } from "@/components/widgets/GlassRadarWidget";
import { useABLoopStore } from "@/store/abLoopStore";

export const APPLE_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 350,
  damping: 30,
  mass: 1,
};

export const APPLE_SPRING_GENTLE = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

const DEFAULT_COVER_SRC = "/default-cover.svg";

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const GlobalPlayerBar: React.FC = () => {
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const currentTime = useAudioStore((state) => state.currentTime);
  const duration = useAudioStore((state) => state.duration);
  const volume = useAudioStore((state) => state.volume);
  const isMuted = useAudioStore((state) => state.isMuted);
  const currentSong = useAudioStore((state) => state.currentSong);
  const isLoading = useAudioStore((state) => state.isLoading);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const prevSong = useAudioStore((state) => state.prevSong);
  const nextSong = useAudioStore((state) => state.nextSong);
  const setVolume = useAudioStore((state) => state.setVolume);
  const toggleMute = useAudioStore((state) => state.toggleMute);

  const setCurrentView = useUIStore((state) => state.setCurrentView);

  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  const progress =
    duration > 0 && !isNaN(currentTime) && !isNaN(duration) ? (currentTime / duration) * 100 : 0;

  const abLoopEnabled = useABLoopStore((s) => s.isEnabled);
  const pointA = useABLoopStore((s) => s.pointA);
  const pointB = useABLoopStore((s) => s.pointB);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const newTime = percentage * duration;
      useAudioStore.getState().seekTo(newTime);
    },
    [duration]
  );

  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const time = percentage * duration;
      setHoverTime(time);
      setHoverX(x);
    },
    [duration]
  );

  const handleProgressLeave = useCallback(() => {
    setHoverTime(null);
    setIsHoveringProgress(false);
  }, []);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVolume(parseFloat(e.target.value));
    },
    [setVolume]
  );

  if (!currentSong) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={APPLE_SPRING_CONFIG}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90vw] max-w-5xl h-20 rounded-3xl z-50 pointer-events-auto"
      style={{
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(32px) saturate(180%)",
        WebkitBackdropFilter: "blur(32px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
      }}
    >
      <div className="relative flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <motion.div
            layoutId={currentSong ? `album-cover-${currentSong.id}` : undefined}
            className="relative w-12 h-12 rounded-md overflow-hidden shadow-md flex-shrink-0 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={APPLE_SPRING_CONFIG}
            onClick={() => setCurrentView("player")}
          >
            <Image
              src={currentSong.cover || DEFAULT_COVER_SRC}
              alt={currentSong.title}
              fill
              className="object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/default-cover.svg";
              }}
              unoptimized
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-md" />
          </motion.div>

          <div className="min-w-0 flex-1 max-w-[200px]">
            <p className="text-sm font-semibold tracking-tight text-white line-clamp-1">
              {currentSong.title}
            </p>
            <p className="text-xs font-medium text-white/60 line-clamp-1">{currentSong.artist}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={prevSong}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              disabled={isLoading}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={isLoading}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform active:scale-90 disabled:opacity-50"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                />
              ) : isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={nextSong}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              disabled={isLoading}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </motion.button>
          </div>

          <div
            className="relative w-full group"
            onMouseEnter={() => setIsHoveringProgress(true)}
            onMouseLeave={handleProgressLeave}
          >
            <div
              className={`relative h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer transition-all duration-200 ${
                isHoveringProgress ? "h-2" : ""
              }`}
              onClick={handleProgressClick}
              onMouseMove={handleProgressHover}
            >
              <motion.div
                className="absolute top-0 left-0 h-full bg-white/80 rounded-full"
                style={{ width: `${progress}%` }}
              />
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  left: `calc(${progress}% - 6px)`,
                  opacity: isHoveringProgress ? 1 : 0,
                }}
              />

              {abLoopEnabled && pointA !== null && pointB !== null && (
                <>
                  <div
                    className="absolute top-0 w-0.5 h-full bg-blue-400 z-10"
                    style={{ left: `${(pointA / duration) * 100}%` }}
                  />
                  <div
                    className="absolute top-0 w-0.5 h-full bg-red-400 z-10"
                    style={{ left: `${(pointB / duration) * 100}%` }}
                  />
                  <div
                    className="absolute top-0 h-full bg-blue-400/20 z-10"
                    style={{
                      left: `${(pointA / duration) * 100}%`,
                      width: `${((pointB - pointA) / duration) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>

            <AnimatePresence>
              {isHoveringProgress && hoverTime !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.95 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                  className="absolute -top-10 px-2 py-1 bg-black/80 backdrop-blur-md rounded-lg text-xs text-white/90 pointer-events-none"
                  style={{
                    left: hoverX,
                    transform: "translateX(-50%)",
                    willChange: "transform, opacity",
                  }}
                >
                  {formatTime(hoverTime)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-4 mt-1.5">
            <span className="text-[10px] text-white/50 tabular-nums w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <span className="text-[10px] text-white/50 tabular-nums w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 group">
            <button
              onClick={toggleMute}
              className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <div className="relative w-20 h-1 bg-white/20 rounded-full overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div
                className="absolute top-0 left-0 h-full bg-white/60 rounded-full pointer-events-none"
                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
              />
            </div>
          </div>

          <div className="w-px h-6 bg-white/20" />

          <button
            onClick={() => setCurrentView("visualization")}
            className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            title="可视化效果"
          >
            <Music2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setCurrentView("player")}
            className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            title="展开播放器"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <div className="ml-2">
            <GlassRadarWidget />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
