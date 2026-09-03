"use client";

import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { Play, Pause, Disc } from "lucide-react";
import { AppleAudioSourceIndicator } from "./AppleAudioSourceIndicator";

interface DarkCinemaFloatingCardProps {
  className?: string;
  onExpand?: () => void;
}

const DarkCinemaProgressBar: React.FC<{ duration: number }> = React.memo(({ duration }) => {
  const currentTime = useAudioStore((state) => state.currentTime);
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="relative w-full h-1 bg-white/15 rounded-full overflow-hidden">
      <div
        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-purple-500 via-cyan-400 to-white rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)] transition-all duration-150"
        style={{ width: `${progressPercent}%` }}
      />
    </div>
  );
});
DarkCinemaProgressBar.displayName = "DarkCinemaProgressBar";

export const DarkCinemaFloatingCard: React.FC<DarkCinemaFloatingCardProps> = ({
  className = "",
  onExpand,
}) => {
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const audioDuration = useAudioStore((state) => state.duration);
  const currentSong = useAudioStore((state) => state.currentSong);
  const duration = audioDuration || currentSong?.duration || 0;

  const title = currentSong?.title || "后来你好吗";
  const artist = currentSong?.artist || "A-Lin [music]";
  const sourceLabel = currentSong?.album || "本地文件";

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const nextPlaying = !isPlaying;
      useAudioStore.getState().setIsPlaying(nextPlaying);
      usePlayerStore.getState().setIsPlaying(nextPlaying);
    },
    [isPlaying]
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed right-12 top-1/2 -translate-y-1/2 z-40 w-80 md:w-96 rounded-2xl border border-white/25 bg-black/40 p-6 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)] text-white select-none ${className}`}
      onClick={onExpand}
    >
      {/* 正在播放 标题角标与 Apple 音源指示器 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-white/60 uppercase">
            正在播放
          </span>
          <div className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          </div>
        </div>

        <AppleAudioSourceIndicator />
      </div>

      {/* 歌曲主标题与艺术家 */}
      <div className="space-y-1 mb-4">
        <h3 className="text-lg md:text-xl font-bold tracking-tight text-white leading-snug line-clamp-2 drop-shadow-md">
          {title} - {artist}
        </h3>
        <div className="flex items-center gap-2 text-xs font-medium text-white/50">
          <Disc className="w-3.5 h-3.5 text-purple-400" />
          <span>{sourceLabel}</span>
        </div>
      </div>

      {/* 底部交互区：点击播放与细微发光进度条 */}
      <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleToggle}
          className="group flex items-center gap-2 text-xs font-medium text-white/70 hover:text-cyan-300 transition-colors w-fit focus:outline-none"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>播放中 (点击暂停)</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400 group-hover:scale-110 transition-transform" />
              <span>点击播放</span>
            </>
          )}
        </button>

        {/* 细发光进度条 (独立叶子隔离渲染) */}
        <DarkCinemaProgressBar duration={duration} />
      </div>
    </motion.div>
  );
};
