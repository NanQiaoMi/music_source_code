/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  EyeOff,
  Heart,
  HelpCircle,
  ListPlus,
  Music,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  X,
  Volume2,
} from "lucide-react";
import { buildRecommendationReasonDisplay } from "@/lib/recommendation/reasonDisplay";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { useRecommendationStore } from "@/store/recommendationStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useUIStore } from "@/store/uiStore";
import type { Song } from "@/types/song";
import { scoreSongForRecommendation } from "@/utils/recommendationLogic";
import { useDailyRecommendation } from "@/hooks/useDailyRecommendation";

interface DailyRecommendationProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
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
  const currentSong = useAudioStore((state) => state.currentSong);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const togglePlay = useAudioStore((state) => state.togglePlay);
  const listeningStats = useStatsAchievementsStore((state) => state.listeningStats);
  const addNegativeFeedback = useRecommendationStore((state) => state.addNegativeFeedback);
  const clearNegativeFeedback = useRecommendationStore((state) => state.clearNegativeFeedback);
  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

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

  const totalDuration = useMemo(() => {
    return visibleRecommendation.reduce((acc, s) => acc + (s.duration || 0), 0);
  }, [visibleRecommendation]);

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
    useUIStore.getState().showToast("✨ 已为您刷新每日推荐曲目", "success", 2000);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handlePlayAll = () => {
    if (visibleRecommendation.length > 0) {
      playQueue(visibleRecommendation, 0);
      useUIStore.getState().showToast(`▶ 开始播放推荐列表（共 ${visibleRecommendation.length} 首）`, "success", 2500);
    }
  };

  const handlePlaySong = (index: number) => {
    const targetSong = visibleRecommendation[index];
    if (!targetSong) return;

    if (currentSong?.id === targetSong.id) {
      togglePlay();
    } else {
      playQueue(visibleRecommendation, index);
    }
  };

  const handleDismiss = (songId: string) => {
    setDismissedSongIds((current) => new Set([...current, songId]));
    setPinnedExplanationId((current) => (current === songId ? null : current));
    useUIStore.getState().showToast("已忽略该曲目", "info", 1800);
  };

  const handleNegativeFeedback = (song: Song) => {
    addNegativeFeedback(song);
    handleDismiss(song.id);
    useUIStore.getState().showToast("已记录，将减少此类推荐", "info", 2000);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={{ type: "spring", damping: 30, stiffness: 340 }}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-white/[0.12] bg-[#0c0d16]/90 shadow-[0_32px_100px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-3xl"
      >
        {/* ─── Ambient Glow Header ─── */}
        <div className="relative overflow-hidden border-b border-white/[0.08] px-6 py-5">
          {/* Subtle multi-layer aurora halos */}
          <div className="absolute -top-14 -left-12 h-44 w-44 rounded-full bg-gradient-to-br from-amber-500/25 via-orange-500/15 to-rose-500/0 blur-3xl pointer-events-none" />
          <div className="absolute -top-14 right-10 h-36 w-36 rounded-full bg-gradient-to-bl from-purple-500/15 via-blue-500/10 to-transparent blur-3xl pointer-events-none" />

          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Apple Squircle Gradient Icon with Luminous Shadow */}
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-[0_8px_24px_rgba(245,158,11,0.38)] ring-1 ring-white/20">
                <Sparkles className="h-6 w-6 text-white drop-shadow-md" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-bold tracking-tight text-white drop-shadow-sm truncate">
                    Daily Recommendations
                  </h2>
                  {recommendationMode && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-[inset_0_1px_2px_rgba(245,158,11,0.2)]">
                      {recommendationMode.description || recommendationMode.name}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-white/50 tracking-wide truncate">
                  Playable picks with transparent ranking reasons.
                </p>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePlayAll}
                disabled={visibleRecommendation.length === 0}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black shadow-[0_4px_16px_rgba(255,255,255,0.22)] transition-all hover:bg-white/95 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] border border-white/10 text-white/80 transition-all hover:bg-white/[0.16] hover:text-white active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  clearNegativeFeedback();
                  useUIStore.getState().showToast("已重置不感兴趣偏好记录", "success", 2000);
                }}
                aria-label="清除反馈记录"
                title="重置不感兴趣偏好"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] border border-white/10 text-white/60 transition-all hover:bg-white/[0.16] hover:text-white active:scale-95 cursor-pointer"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭每日推荐"
                title="关闭 (Esc)"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] border border-white/10 text-white/70 transition-all hover:bg-white/[0.16] hover:text-white active:scale-95 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── Category Filter Sliding Pills ─── */}
        {recommendationGroups.length > 0 && (
          <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-black/20 px-6 py-2.5 overflow-x-auto custom-scrollbar">
            <div className="inline-flex p-1 bg-white/[0.05] border border-white/[0.08] rounded-full gap-1">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`relative rounded-full px-3.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  activeCategory === "all" ? "text-black" : "text-white/60 hover:text-white"
                }`}
              >
                {activeCategory === "all" && (
                  <motion.div
                    layoutId="activeRecTab"
                    className="absolute inset-0 rounded-full bg-white shadow-sm"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  All
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeCategory === "all" ? "bg-black/10 text-black font-semibold" : "bg-white/10 text-white/50"}`}>
                    {recommendation.filter((song) => !dismissedSongIds.has(song.id)).length}
                  </span>
                </span>
              </button>
              {recommendationGroups.map((group) => {
                const count = group.songs.filter((song) => !dismissedSongIds.has(song.id)).length;
                const isSelected = activeCategory === group.category;
                return (
                  <button
                    type="button"
                    key={group.category}
                    onClick={() => setActiveCategory(group.category)}
                    className={`relative rounded-full px-3.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      isSelected ? "text-black" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeRecTab"
                        className="absolute inset-0 rounded-full bg-white shadow-sm"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {group.title}
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-black/10 text-black font-semibold" : "bg-white/10 text-white/50"}`}>
                        {count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Streamlined Song Cards List ─── */}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="h-10 w-10 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
                <p className="mt-4 text-xs font-medium text-white/60">正在为您生成今日个性化推荐...</p>
              </motion.div>
            ) : !hasRecommendation || visibleRecommendation.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.04] border border-white/10 shadow-inner">
                  <Music className="h-7 w-7 text-white/30" />
                </div>
                <p className="text-sm font-semibold text-white/80">今日推荐已全部探索完毕</p>
                <p className="mt-1.5 text-xs text-white/40 max-w-xs leading-relaxed">
                  点击上方刷新按钮换一批，或在曲库中继续收听，AI 会为您持续发掘宝藏歌曲。
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="mt-5 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新生成推荐
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {visibleRecommendation.map((song, index) => {
                  const reasons = recommendationReasons.get(song.id) || [];
                  const topReason = reasons[0];
                  const isPinned = pinnedExplanationId === song.id;
                  const explanationId = `recommendation-reasons-${song.id}`;
                  const isThisPlaying = currentSong?.id === song.id && isPlaying;
                  const isThisCurrent = currentSong?.id === song.id;
                  const isFav = isFavorite(song.id);

                  // Podium styling for top 3
                  const isTop1 = index === 0;
                  const isTop2 = index === 1;
                  const isTop3 = index === 2;

                  return (
                    <motion.div
                      key={song.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.025 }}
                      onClick={() => handlePlaySong(index)}
                      onKeyDown={(event) => {
                        if (event.key === "?") {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleExplanation(song.id);
                        }
                      }}
                      className={`group relative flex flex-col rounded-2xl border transition-all duration-200 cursor-pointer ${
                        isThisPlaying
                          ? "border-amber-400/40 bg-gradient-to-r from-amber-500/[0.12] via-white/[0.06] to-transparent shadow-[0_4px_24px_rgba(245,158,11,0.18)]"
                          : isThisCurrent
                            ? "border-white/20 bg-white/[0.08]"
                            : "border-white/[0.06] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.06]"
                      } p-2.5`}
                    >
                      {/* Main Song Row */}
                      <div className="flex items-center gap-3">
                        {/* Rank Badge / Equalizer Wave */}
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                          {isThisPlaying ? (
                            <div className="flex items-end justify-center gap-[2.5px] h-3.5 w-3.5">
                              <span className="w-1 bg-amber-400 rounded-full animate-[bounce_0.8s_infinite_100ms] h-full" />
                              <span className="w-1 bg-amber-400 rounded-full animate-[bounce_0.8s_infinite_300ms] h-2.5" />
                              <span className="w-1 bg-amber-400 rounded-full animate-[bounce_0.8s_infinite_200ms] h-3.5" />
                            </div>
                          ) : (
                            <span
                              className={`text-xs font-bold tabular-nums ${
                                isTop1
                                  ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                                  : isTop2
                                    ? "text-slate-300"
                                    : isTop3
                                      ? "text-amber-600"
                                      : "text-white/35 group-hover:text-white/70"
                              }`}
                            >
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          )}
                        </div>

                        {/* Cover Squircle */}
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.05] border border-white/10 shadow-sm">
                          {song.cover ? (
                            <img
                              src={song.cover}
                              alt={`${song.title} cover`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Music className="h-4 w-4 text-white/40" />
                          )}
                          <div className={`absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity ${isThisPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                            {isThisPlaying ? (
                              <Pause className="h-4 w-4 fill-amber-400 text-amber-400" />
                            ) : (
                              <Play className="h-4 w-4 fill-white text-white translate-x-0.5" />
                            )}
                          </div>
                        </div>

                        {/* Title, Artist & Quick Reason Pill */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className={`truncate text-xs sm:text-[13px] font-semibold transition-colors ${isThisPlaying ? "text-amber-300" : "text-white group-hover:text-white/95"}`}>
                              {song.title}
                            </h4>
                            {isThisPlaying && (
                              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-amber-400/20 text-amber-300">
                                <Volume2 className="h-2.5 w-2.5" />
                                播放中
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 truncate">
                            <p className="truncate text-[11px] text-white/50">
                              {song.artist}
                              {song.album ? ` · ${song.album}` : ""}
                            </p>
                            {topReason && (
                              <span className="hidden md:inline-flex shrink-0 items-center gap-1 text-[10px] text-amber-300/80 bg-amber-400/10 px-1.5 py-0.2 rounded-md">
                                {topReason.label} {topReason.weightLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Track Duration */}
                        {song.duration > 0 && (
                          <div className="hidden sm:flex items-center gap-1 text-[11px] text-white/35 font-mono tabular-nums shrink-0">
                            <Clock className="h-3 w-3" />
                            {formatDuration(song.duration)}
                          </div>
                        )}

                        {/* Why this button */}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExplanation(song.id);
                          }}
                          aria-expanded={isPinned}
                          aria-controls={explanationId}
                          aria-keyshortcuts="?"
                          className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-all cursor-pointer ${
                            isPinned
                              ? "bg-amber-400/25 text-amber-300 border border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                              : "bg-white/[0.06] text-white/60 hover:bg-white/[0.14] hover:text-white border border-white/[0.06]"
                          }`}
                          title="查看 AI 推荐理由 (?)"
                        >
                          <HelpCircle className="h-3 w-3" />
                          <span>Why this</span>
                        </button>

                        {/* Action Buttons Bar */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {/* Toggle Favorite Heart */}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFavorite(song);
                              useUIStore.getState().showToast(
                                isFav ? "已从我喜欢的音乐中移除" : "已添加到我喜欢的音乐 ❤️",
                                "success",
                                1800
                              );
                            }}
                            title={isFav ? "取消喜欢" : "喜欢这首歌"}
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                              isFav
                                ? "bg-rose-500/20 text-rose-400"
                                : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                            }`}
                          >
                            <Heart className={`h-3.5 w-3.5 ${isFav ? "fill-rose-400" : ""}`} />
                          </button>

                          {/* Play Next */}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              insertNext(song);
                              useUIStore.getState().showToast(`已添加《${song.title}》为下一首播放`, "info", 1800);
                            }}
                            title="下一首播放"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                          >
                            <ListPlus className="h-3.5 w-3.5" />
                          </button>

                          {/* Add to Queue */}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              addToQueue(song);
                              useUIStore.getState().showToast(`已将《${song.title}》加入播放列表`, "info", 1800);
                            }}
                            title="加入播放队列"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>

                          {/* Dismiss */}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDismiss(song.id);
                            }}
                            aria-label={`Dismiss ${song.title}`}
                            title="忽略此歌曲"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                          </button>

                          {/* Negative Feedback */}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleNegativeFeedback(song);
                            }}
                            aria-label={`Reduce recommendations like ${song.title}`}
                            title="不感兴趣（减少此类推荐）"
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-red-500/25 hover:text-red-300 transition-colors cursor-pointer"
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
                            ? "max-h-64 mt-2.5 p-3 rounded-xl border border-white/10 bg-black/40 opacity-100"
                            : "max-h-0 p-0 opacity-0 group-hover:max-h-64 group-hover:mt-2.5 group-hover:p-3 group-hover:rounded-xl group-hover:border group-hover:border-white/10 group-hover:bg-black/40 group-hover:opacity-100 group-focus-within:max-h-64 group-focus-within:mt-2.5 group-focus-within:p-3 group-focus-within:rounded-xl group-focus-within:border group-focus-within:border-white/10 group-focus-within:bg-black/40 group-focus-within:opacity-100"
                        }`}
                      >
                        <div className="mb-2.5 flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                            <Sparkles className="h-3 w-3 text-amber-400" />
                            AI 深度推荐偏好匹配
                          </span>
                          {isPinned && (
                            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-300 font-medium border border-amber-400/30">
                              已锁定展示
                            </span>
                          )}
                        </div>
                        <div className="grid gap-2">
                          {reasons.map((reason) => (
                            <div
                              key={reason.code}
                              className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] border border-white/[0.04] px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-white/90 truncate">
                                  {reason.label}
                                </div>
                                <div className="text-[11px] text-white/50 truncate mt-0.5">
                                  {reason.detail}
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-emerald-400/15 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 shadow-sm">
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

        {/* ─── Bottom Footer Meta ─── */}
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-black/25 px-6 py-3 text-[11px] text-white/40">
          <div className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
            <span className="truncate">
              共 {visibleRecommendation.length} 首推荐 · 约 {formatDuration(totalDuration)}
            </span>
          </div>
          <span className="hidden sm:inline-block text-white/30 text-[10px]">
            每日凌晨根据听歌习惯与场景自动迭代
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
};
