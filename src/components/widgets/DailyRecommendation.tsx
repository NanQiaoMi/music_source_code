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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#121420]/95 shadow-[0_24px_70px_rgba(0,0,0,0.85)] backdrop-blur-3xl"
      >
        {/* Header with Subtle Ambient Glow */}
        <div className="relative overflow-hidden border-b border-white/10 px-6 py-5">
          <div className="absolute -top-12 -left-12 h-36 w-36 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/10 blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 shadow-[0_4px_16px_rgba(245,158,11,0.35)]">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-white truncate">Daily Recommendations</h2>
                  {recommendationMode && (
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-400/15 text-amber-300 border border-amber-400/25">
                      {recommendationMode.description || recommendationMode.name}
                    </span>
                  )}

                </div>
                <p className="mt-0.5 text-xs text-white/50 truncate">
                  Playable picks with transparent ranking reasons.
                </p>
              </div>
            </div>

            {/* Header Right Action Group */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePlayAll}
                disabled={visibleRecommendation.length === 0}
                className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black shadow-md transition-all hover:bg-white/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-black" />
                全部播放
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-label="刷新推荐"
                title="换一批推荐"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all hover:bg-white/20 hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={clearNegativeFeedback}
                aria-label="清除反馈记录"
                title="重置不感兴趣偏好"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all hover:bg-white/20 hover:text-white"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭每日推荐"
                title="关闭 (Esc)"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Tabs Header */}
        {recommendationGroups.length > 0 && (
          <div className="flex items-center gap-2 border-b border-white/[0.08] bg-white/[0.02] px-5 py-2.5 overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                activeCategory === "all"
                  ? "bg-white text-black shadow-sm"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
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
                    ? "bg-white text-black shadow-sm"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {group.title} ({group.songs.filter((song) => !dismissedSongIds.has(song.id)).length})
              </button>
            ))}
          </div>
        )}

        {/* Streamlined Songs List */}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3.5">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <div className="h-10 w-10 rounded-full border-3 border-amber-500/30 border-t-amber-400 animate-spin" />
                <p className="mt-4 text-xs text-white/60">正在为您生成每日个性化推荐...</p>
              </motion.div>
            ) : !hasRecommendation || visibleRecommendation.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                  <Music className="h-6 w-6 text-white/30" />
                </div>
                <p className="text-sm font-medium text-white/70">暂无更多推荐</p>
                <p className="mt-1 text-xs text-white/40 max-w-xs">
                  多听本地歌曲或在曲库中探索，AI 将更快掌握您的音乐品味。
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-1.5"
              >
                {visibleRecommendation.map((song, index) => {
                  const reasons = recommendationReasons.get(song.id) || [];
                  const isPinned = pinnedExplanationId === song.id;
                  const explanationId = `recommendation-reasons-${song.id}`;

                  return (
                    <motion.div
                      key={song.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => handlePlaySong(index)}
                      onKeyDown={(event) => {
                        if (event.key === "?") {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleExplanation(song.id);
                        }
                      }}
                      className="group relative flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2 transition-all hover:border-white/20 hover:bg-white/[0.08] cursor-pointer"
                    >
                      {/* Main Single-Line Song Row */}
                      <div className="flex items-center gap-3">
                        {/* Rank index */}
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-semibold text-white/40 group-hover:text-amber-300 tabular-nums">
                          {index + 1}
                        </div>

                        {/* Cover Image */}
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/30 to-amber-500/30 shadow-sm">
                          {song.cover ? (
                            <img
                              src={song.cover}
                              alt={`${song.title} cover`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Music className="h-4 w-4 text-white/50" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play className="h-4 w-4 fill-white text-white" />
                          </div>
                        </div>

                        {/* Title & Artist */}
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-xs font-medium text-white group-hover:text-amber-200 transition-colors">
                            {song.title}
                          </h4>
                          <p className="truncate text-[11px] text-white/50">
                            {song.artist}
                            {song.album ? ` • ${song.album}` : ""}
                          </p>
                        </div>

                        {/* Duration */}
                        {song.duration > 0 && (
                          <div className="hidden sm:flex items-center gap-1 text-[11px] text-white/35 font-mono tabular-nums shrink-0">
                            <Clock className="h-3 w-3" />
                            {formatDuration(song.duration)}
                          </div>
                        )}

                        {/* Why this badge */}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExplanation(song.id);
                          }}
                          aria-expanded={isPinned}
                          aria-controls={explanationId}
                          aria-keyshortcuts="?"
                          className={`flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-all ${
                            isPinned
                              ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                              : "bg-white/5 text-white/60 hover:bg-white/15 hover:text-white"
                          }`}
                          title="查看推荐理由 (?)"
                        >
                          <HelpCircle className="h-3 w-3" />
                          Why this
                        </button>

                        {/* Hover Quick Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              insertNext(song);
                            }}
                            title="下一首播放"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                          >
                            <ListPlus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              addToQueue(song);
                            }}
                            title="加入播放队列"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDismiss(song.id);
                            }}
                            aria-label={`Dismiss ${song.title}`}
                            title="忽略这首"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
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
                            title="不感兴趣（减少此类推荐）"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-red-500/25 hover:text-red-300 transition-colors"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Reasons Accordion */}
                      <div
                        id={explanationId}
                        aria-hidden={!isPinned}
                        className={`overflow-hidden transition-all duration-200 ${
                          isPinned
                            ? "max-h-64 mt-2.5 p-3 rounded-xl border border-white/10 bg-black/30 opacity-100"
                            : "max-h-0 p-0 opacity-0 group-hover:max-h-64 group-hover:mt-2.5 group-hover:p-3 group-hover:rounded-xl group-hover:border group-hover:border-white/10 group-hover:bg-black/30 group-hover:opacity-100 group-focus-within:max-h-64 group-focus-within:mt-2.5 group-focus-within:p-3 group-focus-within:rounded-xl group-focus-within:border group-focus-within:border-white/10 group-focus-within:bg-black/30 group-focus-within:opacity-100"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
                            AI 推荐偏好匹配
                          </span>
                          {isPinned && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/55">
                              已固定
                            </span>
                          )}
                        </div>
                        <div className="grid gap-1.5">
                          {reasons.map((reason) => (
                            <div
                              key={reason.code}
                              className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-2.5 py-1.5"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-white/90 truncate">
                                  {reason.label}
                                </div>
                                <div className="text-[10px] text-white/45 truncate">{reason.detail}</div>
                              </div>
                              <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                                {reason.weightLabel}
                              </span>
                            </div>
                          ))}
                        </div>
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
