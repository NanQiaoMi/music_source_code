"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  EyeOff,
  HelpCircle,
  ListPlus,
  Music,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  X,
} from "lucide-react";
import { buildRecommendationReasonDisplay } from "@/lib/recommendation/reasonDisplay";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { useRecommendationStore } from "@/store/recommendationStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import type { Song } from "@/types/song";
import { scoreSongForRecommendation } from "@/utils/recommendationLogic";
import { useDailyRecommendation } from "@/hooks/useDailyRecommendation";

interface DailyRecommendationProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export const DailyRecommendation: React.FC<DailyRecommendationProps> = ({ isOpen, onClose }) => {
  const {
    recommendation,
    isLoading,
    refreshRecommendation,
    hasRecommendation,
    recommendationGroups,
    recommendationMode,
  } = useDailyRecommendation();
  const addToQueue = useQueueStore((state) => state.addToQueue);
  const insertNext = useQueueStore((state) => state.insertNext);
  const history = useQueueStore((state) => state.history);
  const playQueue = useAudioStore((state) => state.playQueue);
  const listeningStats = useStatsAchievementsStore((state) => state.listeningStats);
  const addNegativeFeedback = useRecommendationStore((state) => state.addNegativeFeedback);
  const clearNegativeFeedback = useRecommendationStore((state) => state.clearNegativeFeedback);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedSongIds, setDismissedSongIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [pinnedExplanationId, setPinnedExplanationId] = useState<string | null>(null);

  const visibleRecommendation = useMemo(() => {
    const filtered = recommendation.filter((song) => !dismissedSongIds.has(song.id));
    if (activeCategory === "all") return filtered;

    const group = recommendationGroups.find((item) => item.category === activeCategory);
    if (!group) return filtered;

    const groupIds = new Set(group.songs.map((song) => song.id));
    return filtered.filter((song) => groupIds.has(song.id));
  }, [activeCategory, dismissedSongIds, recommendation, recommendationGroups]);

  const recommendationReasons = useMemo(() => {
    const topArtists = (listeningStats.topArtists || []).slice(0, 5).map((item) => item.artist);
    const topGenres = (listeningStats.genreDistribution || [])
      .slice(0, 5)
      .map((item) => item.genre);
    const recentSongs = history.slice(0, 20).map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      cover: song.cover,
      source: "local" as const,
    }));
    const playCounts = new Map(
      (listeningStats.topSongs || []).map((item) => [item.song.id, item.playCount])
    );

    return new Map(
      visibleRecommendation.map((song) => {
        const scored = scoreSongForRecommendation(
          { ...song, playCount: playCounts.get(song.id) || song.playCount || 0 },
          {
            recentSongs,
            topArtists,
            topGenres,
            skippedSongIds: new Set(),
          }
        );

        return [song.id, buildRecommendationReasonDisplay(scored.reasons.slice(0, 3))];
      })
    );
  }, [history, listeningStats, visibleRecommendation]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setDismissedSongIds(new Set());
    setPinnedExplanationId(null);
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
    setPinnedExplanationId((current) => (current === songId ? null : current));
  };

  const handleNegativeFeedback = (song: Song) => {
    addNegativeFeedback(song);
    handleDismiss(song.id);
  };

  const toggleExplanation = (songId: string) => {
    setPinnedExplanationId((current) => (current === songId ? null : songId));
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#1c1c1e]/90 shadow-2xl backdrop-blur-[40px]"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Daily Recommendations</h2>
              <p className="mt-1 text-sm text-white/50">
                Playable picks with transparent ranking reasons.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="刷新推荐"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={clearNegativeFeedback}
              aria-label="清除反馈记录"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all hover:bg-white/20 hover:text-white"
            >
              <ThumbsDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭每日推荐"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {recommendationMode && (
          <div className="border-b border-white/10 px-6 py-3 text-sm text-white/50">
            {recommendationMode.description}
          </div>
        )}

        {recommendationGroups.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                activeCategory === "all"
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              All ({recommendation.filter((song) => !dismissedSongIds.has(song.id)).length})
            </button>
            {recommendationGroups.map((group) => (
              <button
                type="button"
                key={group.category}
                onClick={() => setActiveCategory(group.category)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  activeCategory === group.category
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >
                {group.title} ({group.songs.filter((song) => !dismissedSongIds.has(song.id)).length}
                )
              </button>
            ))}
          </div>
        )}

        <div className="border-b border-white/10 p-4">
          <button
            type="button"
            onClick={handlePlayAll}
            disabled={visibleRecommendation.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-3 font-semibold text-white transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-5 w-5" />
            全部播放
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <div className="h-12 w-12 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
                <p className="mt-4 text-white/60">Generating recommendations...</p>
              </motion.div>
            ) : !hasRecommendation || visibleRecommendation.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                  <Music className="h-8 w-8 text-white/30" />
                </div>
                <p className="mb-2 text-white/60">暂无推荐</p>
                <p className="text-sm text-white/40">
                  Play more local music so the recommendation model can learn your taste.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {visibleRecommendation.map((song, index) => {
                  const reasons = recommendationReasons.get(song.id) || [];
                  const isPinned = pinnedExplanationId === song.id;
                  const explanationId = `recommendation-reasons-${song.id}`;

                  return (
                    <motion.div
                      key={song.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handlePlaySong(index)}
                      onKeyDown={(event) => {
                        if (event.key === "?") {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleExplanation(song.id);
                        }
                      }}
                      className="group rounded-2xl border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded text-xs font-medium text-white/40 group-hover:text-white">
                          {index + 1}
                        </div>

                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-purple-500/40 to-pink-500/40">
                          {song.cover ? (
                            <img
                              src={song.cover}
                              alt={`${song.title} cover`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Music className="h-5 w-5 text-white/50" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-medium text-white">{song.title}</h4>
                          <p className="truncate text-sm text-white/50">{song.artist}</p>
                        </div>

                        {song.duration > 0 && (
                          <div className="hidden items-center gap-1 text-xs text-white/35 sm:flex">
                            <Clock className="h-3 w-3" />
                            {formatDuration(song.duration)}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExplanation(song.id);
                          }}
                          aria-expanded={isPinned}
                          aria-controls={explanationId}
                          aria-keyshortcuts="?"
                          className="flex h-8 items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-medium text-white/70 transition hover:bg-white/20 hover:text-white"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                          Why this
                        </button>
                      </div>

                      <div
                        id={explanationId}
                        aria-hidden={!isPinned}
                        className={`mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/15 transition-all duration-200 ${
                          isPinned
                            ? "max-h-64 p-3 opacity-100"
                            : "max-h-0 p-0 opacity-0 group-hover:max-h-64 group-hover:p-3 group-hover:opacity-100 group-focus-within:max-h-64 group-focus-within:p-3 group-focus-within:opacity-100"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
                            排名信号
                          </span>
                          {isPinned && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/55">
                              已置顶
                            </span>
                          )}
                        </div>
                        <div className="grid gap-2">
                          {reasons.map((reason) => (
                            <div
                              key={reason.code}
                              className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2"
                            >
                              <div>
                                <div className="text-sm font-medium text-white/85">
                                  {reason.label}
                                </div>
                                <div className="mt-0.5 text-xs text-white/45">{reason.detail}</div>
                              </div>
                              <span className="shrink-0 rounded-full bg-emerald-300/15 px-2 py-0.5 text-xs font-semibold text-emerald-100">
                                {reason.weightLabel}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handlePlaySong(index);
                          }}
                          className="flex h-8 items-center gap-1 rounded-full bg-white/10 px-3 text-xs text-white transition hover:bg-white/20"
                        >
                          <Play className="h-3.5 w-3.5" />
                          播放
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            addToQueue(song);
                          }}
                          className="flex h-8 items-center gap-1 rounded-full bg-white/10 px-3 text-xs text-white transition hover:bg-white/20"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          队列
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            insertNext(song);
                          }}
                          className="flex h-8 items-center gap-1 rounded-full bg-white/10 px-3 text-xs text-white transition hover:bg-white/20"
                        >
                          <ListPlus className="h-3.5 w-3.5" />
                          下一首
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDismiss(song.id);
                          }}
                          aria-label={`Dismiss ${song.title}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleNegativeFeedback(song);
                          }}
                          aria-label={`Reduce recommendations like ${song.title}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-red-500/30"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};
