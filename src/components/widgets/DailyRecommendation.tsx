"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDailyRecommendation } from "@/hooks/useDailyRecommendation";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { scoreSongForRecommendation } from "@/utils/recommendationLogic";
import { X, Sparkles, Play, RefreshCw, Clock, Music, Plus, ListPlus, EyeOff, ThumbsDown } from "lucide-react";
import { useRecommendationStore } from "@/store/recommendationStore";

interface DailyRecommendationProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyRecommendation: React.FC<DailyRecommendationProps> = ({ isOpen, onClose }) => {
  const { recommendation, isLoading, refreshRecommendation, hasRecommendation, recommendationGroups, recommendationMode } =
    useDailyRecommendation();
  const addToQueue = useQueueStore((state) => state.addToQueue);
  const insertNext = useQueueStore((state) => state.insertNext);
  const history = useQueueStore((state) => state.history);
  const playQueue = useAudioStore((state) => state.playQueue);
  const listeningStats = useStatsAchievementsStore((state) => state.listeningStats);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedSongIds, setDismissedSongIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const addNegativeFeedback = useRecommendationStore((s) => s.addNegativeFeedback);

  const visibleRecommendation = useMemo(() => {
    const filtered = recommendation.filter((song) => !dismissedSongIds.has(song.id));
    if (activeCategory === "all") return filtered;
    const group = recommendationGroups.find((g) => g.category === activeCategory);
    if (!group) return filtered;
    const groupIds = new Set(group.songs.map((s) => s.id));
    return filtered.filter((s) => groupIds.has(s.id));
  }, [dismissedSongIds, recommendation, activeCategory, recommendationGroups]);

  const recommendationReasons = useMemo(() => {
    const topArtists = (listeningStats.topArtists || []).slice(0, 5).map((item) => item.artist);
    const topGenres = (listeningStats.genreDistribution || []).slice(0, 5).map((item) => item.genre);
    const recentSongs = history.slice(0, 20).map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      cover: song.cover,
      source: "local",
    }));
    const playCounts = new Map(
      (listeningStats.topSongs || []).map((item) => [item.song.id, item.playCount])
    );

    return new Map(
      visibleRecommendation.map((song) => [
        song.id,
        scoreSongForRecommendation(
          { ...song, playCount: playCounts.get(song.id) || song.playCount || 0 },
          {
            recentSongs,
            topArtists,
            topGenres,
            skippedSongIds: new Set(),
          }
        ).reasons.slice(0, 3),
      ])
    );
  }, [history, listeningStats, visibleRecommendation]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setDismissedSongIds(new Set());
    refreshRecommendation();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handlePlayAll = () => {
    if (visibleRecommendation.length > 0) {
      playQueue(visibleRecommendation, 0);
    }
  };

  const handlePlaySong = (index: number) => {
    if (visibleRecommendation.length > 0) {
      playQueue(visibleRecommendation, index);
    }
  };

  const handleDismiss = (songId: string) => {
    setDismissedSongIds((current) => new Set([...current, songId]));
  };

  const handleNegativeFeedback = (song: typeof recommendation[0]) => {
    addNegativeFeedback(song);
    handleDismiss(song.id);
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "下午" : "上午";
    const hour12 = hours % 12 || 12;
    return `${ampm} ${hour12}:${minutes.toString().padStart(2, "0")} 更新`;
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[80vh] bg-[#1c1c1e]/90 backdrop-blur-[40px] rounded-[24px] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white text-xl font-semibold">每日推荐</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => useRecommendationStore.getState().clearNegativeFeedback()}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
                title="清除反馈记忆"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {recommendationMode && (
            <div className="px-6 py-2 text-white/40 text-sm">
              {recommendationMode.description}
            </div>
          )}
          {recommendationGroups.length > 0 && (
            <div className="px-4 pb-2 flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategory("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  activeCategory === "all" ? "bg-white/20 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >
                全部 ({recommendation.filter((s) => !dismissedSongIds.has(s.id)).length})
              </button>
              {recommendationGroups.map((group) => (
                <button
                  key={group.category}
                  onClick={() => setActiveCategory(group.category)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    activeCategory === group.category ? "bg-white/20 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {group.title} ({group.songs.filter((s) => !dismissedSongIds.has(s.id)).length})
                </button>
              ))}
            </div>
          )}
          <div className="p-4 border-b border-white/10">
            <button
              onClick={handlePlayAll}
              disabled={visibleRecommendation.length === 0}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5" />
              播放全部
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <div className="w-12 h-12 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
                  <p className="text-white/60 mt-4">正在生成推荐...</p>
                </motion.div>
              ) : !hasRecommendation || visibleRecommendation.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Music className="w-8 h-8 text-white/30" />
                  </div>
                  <p className="text-white/60 mb-2">暂无推荐歌曲</p>
                  <p className="text-white/40 text-sm">开始播放音乐让我们了解你的喜好</p>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {visibleRecommendation.map((song, index) => (
                    <motion.div
                      key={song.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handlePlaySong(index)}
                      className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-all group"
                    >
                      <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-medium text-white/40 group-hover:text-white">
                        {index + 1}
                      </div>

                      <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-purple-500/40 to-pink-500/40 flex items-center justify-center overflow-hidden">
                        {song.cover ? (
                          <img src={song.cover} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-5 h-5 text-white/50" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate">{song.title}</h4>
                        <p className="text-white/50 text-sm truncate">{song.artist}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(recommendationReasons.get(song.id) || []).map((reason) => (
                            <span
                              key={reason.code}
                              className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-white/45"
                            >
                              {reason.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      {song.duration > 0 && (
                        <div className="flex items-center gap-1 text-white/30 text-xs">
                          <Clock className="w-3 h-3" />
                          {Math.floor(song.duration / 60)}:
                          {String(Math.floor(song.duration % 60)).padStart(2, "0")}
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySong(index);
                        }}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="立即播放"
                      >
                        <Play className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(song);
                        }}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="加入队列"
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          insertNext(song);
                        }}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="播放下一首"
                      >
                        <ListPlus className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(song.id);
                        }}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="忽略本次推荐"
                      >
                        <EyeOff className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNegativeFeedback(song);
                        }}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="不再推荐此类"
                      >
                        <ThumbsDown className="w-4 h-4 text-white" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
