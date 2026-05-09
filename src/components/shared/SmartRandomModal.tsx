"use client";

import React, { useState, useCallback, useMemo, useDeferredValue } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { X, Play, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/shared/Glass/GlassCard";
import { GlassButton } from "@/components/shared/GlassButton";
import { Song } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useListeningHistory } from "@/hooks/useListeningHistory";
import {
  generateRecommendations,
  RecommendationParams,
  SongWithPlayCount,
} from "@/utils/recommendationLogic";
import { toast } from "@/components/shared/GlassToast";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";

interface SmartRandomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong?: Song;
}

const GRID_SIZE = 320;
const HANDLE_SIZE = 24;
const GRID_LINES = 10;

export const SmartRandomModal: React.FC<SmartRandomModalProps> = ({
  isOpen,
  onClose,
  currentSong,
}) => {
  const { songs } = usePlaylistStore();
  const playQueue = useAudioStore((state) => state.playQueue);
  const { getPlayCount, getLastPlayedAt } = useListeningHistory();
  const { unlockAchievement } = useStatsAchievementsStore();
  const controls = useAnimationControls();

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const deferredPosition = useDeferredValue(position);

  const songsWithPlayCount = useMemo((): SongWithPlayCount[] => {
    return songs.map((song) => ({
      ...song,
      playCount: getPlayCount(song.id) || 0,
      lastPlayedAt: getLastPlayedAt(song.id) || undefined,
    }));
  }, [songs, getPlayCount, getLastPlayedAt]);

  const recommendations = useMemo(() => {
    const params: RecommendationParams = {
      currentSong,
      x: deferredPosition.x,
      y: deferredPosition.y,
    };
    return generateRecommendations(songsWithPlayCount, params, 5);
  }, [songsWithPlayCount, currentSong, deferredPosition]);

  const handleDragEnd = useCallback((event: any, info: any) => {
    const centerX = GRID_SIZE / 2 - HANDLE_SIZE / 2;
    const centerY = GRID_SIZE / 2 - HANDLE_SIZE / 2;
    const newX = Math.max(-1, Math.min(1, (info.point.x - centerX) / (GRID_SIZE / 2)));
    const newY = Math.max(-1, Math.min(1, (info.point.y - centerY) / (GRID_SIZE / 2)));
    setPosition({ x: newX, y: newY });
  }, []);

  const resetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    controls.start({
      x: GRID_SIZE / 2 - HANDLE_SIZE / 2,
      y: GRID_SIZE / 2 - HANDLE_SIZE / 2,
      transition: { type: "spring", damping: 20, stiffness: 300 },
    });
  }, [controls]);

  const handlePlay = useCallback(() => {
    const params: RecommendationParams = {
      currentSong,
      x: position.x,
      y: position.y,
    };
    const allRecommendations = generateRecommendations(songsWithPlayCount, params, 50);

    if (allRecommendations.length === 0) {
      toast.error("没有可播放的歌曲");
      return;
    }

    if (Math.abs(position.x) > 0.95 && Math.abs(position.y) > 0.95) {
      unlockAchievement("extremist");
    }

    if (position.x < 0 && position.y < 0) {
      unlockAchievement("deep-sea-explorer");
    }

    playQueue(allRecommendations as Song[], 0);
    toast.success("已生成 " + allRecommendations.length + " 首智能推荐");
    onClose();
  }, [position, songsWithPlayCount, currentSong, playQueue, onClose, unlockAchievement]);

  const gridSize = GRID_SIZE / GRID_LINES;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
        className="relative"
      >
        <GlassCard blur={40} rounded="3xl" hover={false} className="p-6 w-[400px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white text-lg font-semibold">智能偏好矩阵</h3>
                <p className="text-white/60 text-sm">Smart Preference Matrix</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center mb-6">
            <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase mb-1">
              风格跳跃
            </div>

            <div className="flex items-center gap-2">
              <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase -rotate-90">
                极少听
              </div>

              <div
                className="relative"
                style={{
                  width: GRID_SIZE,
                  height: GRID_SIZE,
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
                    backgroundSize: gridSize + "px " + gridSize + "px",
                  }}
                />

                <div className="absolute inset-0 border border-white/10 rounded-2xl" />

                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />

                <motion.div
                  drag
                  dragMomentum={false}
                  dragElastic={0}
                  dragConstraints={{
                    left: 0,
                    right: GRID_SIZE - HANDLE_SIZE,
                    top: 0,
                    bottom: GRID_SIZE - HANDLE_SIZE,
                  }}
                  onDragEnd={handleDragEnd}
                  initial={{
                    x: GRID_SIZE / 2 - HANDLE_SIZE / 2,
                    y: GRID_SIZE / 2 - HANDLE_SIZE / 2,
                  }}
                  animate={controls}
                  className="absolute z-10 cursor-grab active:cursor-grabbing"
                  style={{
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                  }}
                >
                  <div
                    className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-indigo-500"
                    style={{
                      boxShadow: "0 0 15px rgba(59, 130, 246, 0.6)",
                    }}
                  >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent" />
                  </div>
                </motion.div>
              </div>

              <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase rotate-90">
                最常听
              </div>
            </div>

            <div className="text-[10px] font-bold tracking-widest text-white/40 uppercase mt-1">
              风格相似
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm font-medium">实时预览</span>
              <button
                onClick={resetPosition}
                className="text-white/40 text-xs hover:text-white/60 transition-colors"
              >
                重置
              </button>
            </div>

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {recommendations.map((song, index) => (
                  <motion.div
                    key={song.id + "-" + index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <img
                      src={song.cover}
                      alt={song.title}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{song.title}</div>
                      <div className="text-white/50 text-xs truncate">{song.artist}</div>
                    </div>
                    <span className="text-white/30 text-xs font-medium">#{index + 1}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <GlassButton variant="primary" size="lg" onClick={handlePlay} className="w-full">
            <Play className="w-4 h-4" />
            <span>播放推荐</span>
          </GlassButton>
        </GlassCard>
      </motion.div>
    </div>
  );
};
