/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  EyeOff,
  FolderPlus,
  Heart,
  HelpCircle,
  ListPlus,
  Music,
  Play,
  Pause,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsDown,
  X,
  ChevronDown,
  Disc3,
} from "lucide-react";
import { buildRecommendationReasonDisplay } from "@/lib/recommendation/reasonDisplay";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { useRecommendationStore } from "@/store/recommendationStore";
import { useStatsAchievementsStore } from "@/store/statsAchievementsStore";
import { useFavoritesStore } from "@/store/favoritesStore";
import { useUIStore } from "@/store/uiStore";
import type { Song } from "@/types/song";
import {
  scoreSongForRecommendation,
  AVAILABLE_RECOMMENDATION_MODES,
  type DailyRecommendationMode,
} from "@/utils/recommendationLogic";
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
    switchMode,
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
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const togglePlay = () => setIsPlaying(!isPlaying);
  const listeningStats = useStatsAchievementsStore((state) => state.listeningStats);
  const addNegativeFeedback = useRecommendationStore((state) => state.addNegativeFeedback);
  const clearNegativeFeedback = useRecommendationStore((state) => state.clearNegativeFeedback);
  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedSongIds, setDismissedSongIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [pinnedExplanationId, setPinnedExplanationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showModeSelector, setShowModeSelector] = useState<boolean>(false);

  const visibleRecommendation = useMemo(() => {
    const filtered = recommendation.filter((song) => !dismissedSongIds.has(song.id));
    if (activeCategory === "all") return filtered;

    const group = recommendationGroups.find((item) => item.category === activeCategory);
    if (!group) return filtered;

    const groupIds = new Set(group.songs.map((song) => song.id));
    return filtered.filter((song) => groupIds.has(song.id));
  }, [activeCategory, dismissedSongIds, recommendation, recommendationGroups]);

  // 行内实时检索过滤
  const displayedSongs = useMemo(() => {
    if (!searchQuery.trim()) return visibleRecommendation;
    const q = searchQuery.toLowerCase().trim();
    return visibleRecommendation.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.artist && s.artist.toLowerCase().includes(q)) ||
        (s.album && s.album.toLowerCase().includes(q))
    );
  }, [visibleRecommendation, searchQuery]);

  const totalDuration = useMemo(() => {
    return displayedSongs.reduce((acc, s) => acc + (s.duration || 0), 0);
  }, [displayedSongs]);

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
            mode: recommendationMode || undefined,
          }
        );

        return [song.id, buildRecommendationReasonDisplay(scored.reasons.slice(0, 3))];
      })
    );
  }, [history, listeningStats, visibleRecommendation, recommendationMode]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setDismissedSongIds(new Set());
    setPinnedExplanationId(null);
    refreshRecommendation();
    useUIStore.getState().showToast("✨ 已为您刷新每日推荐曲目", "success", 2000);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleModeChange = (mode: DailyRecommendationMode) => {
    if (switchMode) {
      switchMode(mode);
    }
    setShowModeSelector(false);
    useUIStore.getState().showToast(`🎯 已切换为「${mode.name}」推荐模式`, "success", 2000);
  };

  const handlePlayAll = () => {
    if (displayedSongs.length > 0) {
      playQueue(displayedSongs, 0);
      useUIStore.getState().showToast(`▶ 开始播放每日推荐（共 ${displayedSongs.length} 首）`, "success", 2500);
    }
  };

  const handlePlaySong = (index: number) => {
    const targetSong = displayedSongs[index];
    if (!targetSong) return;

    if (currentSong?.id === targetSong.id) {
      togglePlay();
    } else {
      playQueue(displayedSongs, index);
    }
  };

  const handleDismiss = (songId: string) => {
    setDismissedSongIds((current) => new Set([...current, songId]));
    setPinnedExplanationId((current) => (current === songId ? null : current));
    useUIStore.getState().showToast("已从推荐中忽略", "info", 1800);
  };

  const handleNegativeFeedback = (song: Song) => {
    addNegativeFeedback(song);
    handleDismiss(song.id);
    useUIStore.getState().showToast("已记录，将减少类似风格推荐", "info", 2000);
  };

  const toggleExplanation = (songId: string) => {
    setPinnedExplanationId((current) => (current === songId ? null : songId));
  };

  const handleSaveAsPlaylist = () => {
    if (displayedSongs.length === 0) return;
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}月${now.getDate()}日`;
    const modeStr = recommendationMode?.name || "精选";
    const playlistTitle = `${dateStr} · 每日专属推荐 (${modeStr})`;

    try {
      const STORAGE_KEY = "vibe_custom_playlists_v1";
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const newPlaylist = {
        id: `pl-daily-${Date.now()}`,
        title: playlistTitle,
        cover: displayedSongs[0]?.cover || "/default-cover.svg",
        songs: displayedSongs,
        createdAt: Date.now(),
      };
      list.unshift(newPlaylist);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      useUIStore.getState().showToast(`✨ 已成功转存为歌单《${playlistTitle}》`, "success", 2500);
    } catch {
      useUIStore.getState().showToast("转存歌单失败，请重试", "error", 2000);
    }
  };

  // Rank 1 Featured spotlight song (if available and no search query active)
  const heroSong = !searchQuery.trim() && displayedSongs.length > 0 ? displayedSongs[0] : null;
  const isHeroPlaying = currentSong?.id === heroSong?.id && isPlaying;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 sm:p-6 backdrop-blur-2xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={{ type: "spring", damping: 32, stiffness: 360, mass: 0.8 }}
        onClick={(event) => event.stopPropagation()}
        className="daily-rec-modal relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-white/[0.12] bg-[#0b0c13]/85 shadow-[0_32px_100px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.18)] backdrop-blur-3xl"
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .daily-rec-modal,
          .daily-rec-modal * {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif !important;
          }
          @keyframes vinyl-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .rec-vinyl-spin {
            animation: vinyl-spin 12s linear infinite;
          }
        `}} />

        {/* ─── Ambient Stage Glows (Unified with Main Page Mesh) ─── */}
        <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute -top-20 right-4 h-56 w-56 rounded-full bg-gradient-to-bl from-purple-500/18 via-amber-500/12 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-gradient-to-tr from-cyan-500/10 via-purple-500/10 to-transparent blur-3xl pointer-events-none" />

        {/* ─── Top Nav Island Style Header ─── */}
        <div className="relative z-10 border-b border-white/[0.08] px-6 py-4.5 bg-white/[0.015]">
          <div className="flex items-center justify-between gap-4">
            {/* Header Left: Unified App Brand Badge & Subtitle */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]">
                <Sparkles className="h-5 w-5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2 truncate">
                    <span>每日专属推荐</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40 font-mono">
                      Daily Recommendations
                    </span>
                  </h2>
                  {recommendationMode && (
                    <button
                      type="button"
                      onClick={() => setShowModeSelector(!showModeSelector)}
                      title="点击切换推荐场景与时段心境"
                      className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-amber-300 border border-white/10 shadow-sm transition-all cursor-pointer"
                    >
                      <span>{recommendationMode.description || recommendationMode.name}</span>
                      <ChevronDown className={`h-3 w-3 text-amber-300/70 transition-transform ${showModeSelector ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-white/45 tracking-wide truncate">
                  根据你的高频听歌习惯、流派偏好与当下心境智能策展
                </p>
              </div>
            </div>

            {/* Header Right: Apple Island Capsule Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePlayAll}
                disabled={displayedSongs.length === 0}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500/85 to-blue-600/85 hover:from-cyan-400 hover:to-blue-500 text-white px-4 py-2 text-xs font-semibold shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-white text-white" />
                全部播放
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-label="刷新推荐"
                title="换一批推荐"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-white/70 hover:text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => {
                  clearNegativeFeedback();
                  useUIStore.getState().showToast("已重置不感兴趣偏好记录", "success", 2000);
                }}
                aria-label="清除反馈记录"
                title="重置不感兴趣偏好"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-white/50 hover:text-white transition-all active:scale-95 cursor-pointer"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="关闭每日推荐"
                title="关闭 (Esc)"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-white/60 hover:text-white transition-all active:scale-95 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ─── Mode Selector Drawer (Drop-down Capsule Pills) ─── */}
          <AnimatePresence>
            {showModeSelector && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-3 pt-3 border-t border-white/[0.06]"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-white/40 font-medium">心境模式：</span>
                  {AVAILABLE_RECOMMENDATION_MODES.map((mode) => {
                    const isCurrent = recommendationMode?.name === mode.name;
                    return (
                      <button
                        key={mode.name}
                        type="button"
                        onClick={() => handleModeChange(mode)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-cyan-500 text-black font-semibold shadow-[0_0_16px_rgba(6,182,212,0.45)]"
                            : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white border border-white/[0.06]"
                        }`}
                      >
                        {mode.name}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Category Filter Tabs & Inline Search Strip ─── */}
        <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-black/20 px-6 py-2.5 flex-wrap">
          {/* Category Tabs with Apple Fluid Pill Slider */}
          {recommendationGroups.length > 0 && (
            <div className="inline-flex p-1 bg-white/[0.04] border border-white/[0.08] rounded-full gap-1">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`relative rounded-full px-3.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  activeCategory === "all" ? "text-white font-semibold" : "text-white/60 hover:text-white"
                }`}
              >
                {activeCategory === "all" && (
                  <motion.div
                    layoutId="activeRecTab"
                    className="absolute inset-0 rounded-full bg-white/[0.14] border border-white/[0.12] shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  All
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeCategory === "all" ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "bg-white/10 text-white/50"}`}>
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
                      isSelected ? "text-white font-semibold" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeRecTab"
                        className="absolute inset-0 rounded-full bg-white/[0.14] border border-white/[0.12] shadow-sm"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {group.title}
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "bg-white/10 text-white/50"}`}>
                        {count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Inline Instant Search Box */}
          <div className="relative flex items-center ml-auto">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-white/40 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索曲目或歌手..."
              className="h-7 w-36 sm:w-48 rounded-full bg-white/[0.06] border border-white/10 pl-7 pr-3 text-[11px] text-white placeholder-white/40 focus:outline-none focus:border-cyan-400/50 focus:w-52 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-white/40 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* ─── Scrollable Content Area ─── */}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="h-10 w-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                <p className="mt-4 text-xs font-medium text-white/60">正在进行智能推荐去噪与时段偏好校准...</p>
              </motion.div>
            ) : !hasRecommendation || displayedSongs.length === 0 ? (
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
                <p className="text-sm font-semibold text-white/80">
                  {searchQuery ? "未找到匹配的推荐曲目" : "今日推荐已全部探索完毕"}
                </p>
                <p className="mt-1.5 text-xs text-white/40 max-w-xs leading-relaxed">
                  {searchQuery
                    ? "尝试搜索其他关键词，或清空搜索查看全部推荐。"
                    : "点击上方刷新按钮换一批，或在曲库中继续收听，AI 会为您持续发掘宝藏歌曲。"}
                </p>
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="mt-4 rounded-full bg-white/10 px-4 py-1.5 text-xs text-white hover:bg-white/20"
                  >
                    清空搜索条件
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="mt-5 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 transition-all cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    重新生成推荐
                  </button>
                )}
              </motion.div>
            ) : (
              <div className="space-y-4">
                {/* ─── 1. Rank 01 Hero Spotlight Card (Echoing Main Page 3D Vinyl Player) ─── */}
                {heroSong && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-[26px] border border-white/[0.12] bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-white/[0.01] p-4.5 shadow-[0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-xl group"
                  >
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      {/* Left: Mini Vinyl + Sleeve Cover Duo */}
                      <div className="relative flex items-center justify-center shrink-0 cursor-pointer" onClick={() => handlePlaySong(0)}>
                        {/* Peeking Vinyl Disc */}
                        <div
                          className={`absolute -right-4 w-20 h-20 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.9)] transition-transform duration-500 ease-out group-hover:translate-x-3.5 ${
                            isHeroPlaying ? "rec-vinyl-spin" : ""
                          }`}
                          style={{
                            background: "radial-gradient(circle, #1a1a1a 0%, #111111 25%, #222222 26%, #0d0d0d 45%, #1f1f1f 46%, #080808 65%, #1a1a1a 66%, #050505 100%)",
                            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.8)",
                          }}
                        >
                          <div className="absolute inset-1 rounded-full pointer-events-none opacity-30 border border-white/10" />
                          <div className="absolute inset-0 m-auto w-7 h-7 rounded-full bg-[#161616] border border-white/30 flex items-center justify-center">
                            <Disc3 className="w-3.5 h-3.5 text-white/50" />
                          </div>
                        </div>

                        {/* Sleeve Cover with Spine Highlight */}
                        <div className="relative z-10 w-24 h-24 rounded-2xl overflow-hidden bg-[#161618] border border-white/15 shadow-[0_12px_28px_rgba(0,0,0,0.7)] group-hover:shadow-[0_16px_36px_rgba(0,0,0,0.85)] transition-all">
                          {heroSong.cover ? (
                            <img src={heroSong.cover} alt={heroSong.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                              <Music className="w-8 h-8 text-white/30" />
                            </div>
                          )}
                          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-r from-white/35 via-white/15 to-transparent pointer-events-none" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            {isHeroPlaying ? (
                              <Pause className="w-6 h-6 fill-cyan-400 text-cyan-400" />
                            ) : (
                              <Play className="w-6 h-6 fill-white text-white translate-x-0.5" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Featured Meta & Play CTA */}
                      <div className="flex-1 min-w-0 text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/35 shadow-sm">
                            <Sparkles className="w-2.5 h-2.5" />
                            今日首推 · No. 01 Pick
                          </span>
                          {recommendationReasons.get(heroSong.id)?.[0] && (
                            <span className="text-[10px] text-cyan-300/85 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full font-medium">
                              {recommendationReasons.get(heroSong.id)![0].label} {recommendationReasons.get(heroSong.id)![0].weightLabel}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-1.5 text-base sm:text-lg font-bold text-white tracking-tight truncate">
                          {heroSong.title}
                        </h3>
                        <p className="text-xs text-white/50 mt-0.5 truncate">
                          {heroSong.artist} {heroSong.album ? `· 《${heroSong.album}》` : ""}
                        </p>

                        {/* Action row */}
                        <div className="mt-3 flex items-center justify-center sm:justify-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => handlePlaySong(0)}
                            className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black shadow-md hover:bg-white/90 active:scale-95 transition-all cursor-pointer"
                          >
                            {isHeroPlaying ? (
                              <>
                                <Pause className="w-3.5 h-3.5 fill-black" />
                                暂停播放
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-black" />
                                立即聆听
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(heroSong);
                            }}
                            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all cursor-pointer ${
                              isFavorite(heroSong.id)
                                ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                                : "bg-white/[0.06] border-white/10 text-white/60 hover:text-white"
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isFavorite(heroSong.id) ? "fill-rose-400" : ""}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ─── 2. Streamlined Track Rows ─── */}
                <div className="space-y-2">
                  {displayedSongs.map((song, index) => {
                    const reasons = recommendationReasons.get(song.id) || [];
                    const topReason = reasons[0];
                    const isPinned = pinnedExplanationId === song.id;
                    const explanationId = `recommendation-reasons-${song.id}`;
                    const isThisPlaying = currentSong?.id === song.id && isPlaying;
                    const isThisCurrent = currentSong?.id === song.id;
                    const isFav = isFavorite(song.id);

                    // Podium styling
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
                            ? "border-cyan-400/40 bg-gradient-to-r from-cyan-500/[0.12] via-white/[0.04] to-transparent shadow-[0_4px_24px_rgba(6,182,212,0.18)]"
                            : isThisCurrent
                              ? "border-white/20 bg-white/[0.08]"
                              : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
                        } p-3`}
                      >
                        {/* Main Song Row */}
                        <div className="flex items-center gap-3">
                          {/* Rank Badge / Equalizer Wave */}
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                            {isThisPlaying ? (
                              <div className="flex items-end justify-center gap-[2px] h-3.5 w-3.5">
                                <span className="w-0.5 bg-cyan-400 rounded-full animate-[bounce_0.8s_infinite_100ms] h-full" />
                                <span className="w-0.5 bg-cyan-400 rounded-full animate-[bounce_0.8s_infinite_300ms] h-2.5" />
                                <span className="w-0.5 bg-cyan-400 rounded-full animate-[bounce_0.8s_infinite_200ms] h-3.5" />
                                <span className="w-0.5 bg-cyan-400 rounded-full animate-[bounce_0.8s_infinite_400ms] h-2" />
                              </div>
                            ) : (
                              <span
                                className={`text-xs font-bold tabular-nums ${
                                  isTop1
                                    ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]"
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

                          {/* Cover Squircle with Subtle Vinyl Backing */}
                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.05] border border-white/10 shadow-sm group-hover:border-white/20 transition-all">
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
                                <Pause className="h-4 w-4 fill-cyan-400 text-cyan-400" />
                              ) : (
                                <Play className="h-4 w-4 fill-white text-white translate-x-0.5" />
                              )}
                            </div>
                          </div>

                          {/* Title, Artist & Quick Reason Pill */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className={`truncate text-xs sm:text-[13px] font-semibold transition-colors ${isThisPlaying ? "text-cyan-300" : "text-white group-hover:text-white/95"}`}>
                                {song.title}
                              </h4>
                              {isThisPlaying && (
                                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-cyan-400/20 text-cyan-300">
                                  播放中
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 truncate">
                              <p className="truncate text-[11px] text-white/50">
                                {song.artist}
                                {song.album ? ` · ${song.album}` : ""}
                              </p>
                              {topReason && (
                                <span className="hidden md:inline-flex shrink-0 items-center gap-1 text-[10px] text-cyan-300/80 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.2 rounded-md font-medium">
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
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
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
                                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
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
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300">
                              <Sparkles className="h-3 w-3 text-cyan-400" />
                              AI 深度个性化偏好匹配
                            </span>
                            {isPinned && (
                              <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] text-cyan-300 font-medium border border-cyan-400/30">
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
                                <span className="shrink-0 rounded-full bg-cyan-400/15 border border-cyan-400/30 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300 shadow-sm">
                                  {reason.weightLabel}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Bottom Footer Meta Bar (Unified with Main Page 3D Shelf Pill) ─── */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/[0.06] bg-black/35 px-6 py-3 text-[11px] text-white/40">
          <div className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            <span className="truncate">
              共 {displayedSongs.length} 首推荐 · 约 {formatDuration(totalDuration)}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleSaveAsPlaylist}
              disabled={displayedSongs.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3.5 py-1 text-xs text-white/80 hover:text-white transition-all cursor-pointer disabled:opacity-40 shadow-sm"
              title="将当前推荐保存为永久歌单"
            >
              <FolderPlus className="h-3.5 w-3.5 text-cyan-400" />
              转存为歌单
            </button>
            <span className="hidden sm:inline-block text-white/30 text-[10px]">
              智能防堆砌与时段校准生效中
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
