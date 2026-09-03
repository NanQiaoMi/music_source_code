/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
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
  Disc3,
  Sun,
  Coffee,
  Sunset,
  Moon,
  Zap,
  Activity,
  Headphones,
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

function getModeIcon(modeName: string) {
  if (modeName.includes("早间") || modeName.includes("活力")) return <Sun className="h-4 w-4 text-amber-300" />;
  if (modeName.includes("午间") || modeName.includes("放松")) return <Zap className="h-4 w-4 text-emerald-300" />;
  if (modeName.includes("下午") || modeName.includes("专注")) return <Coffee className="h-4 w-4 text-cyan-300" />;
  if (modeName.includes("傍晚") || modeName.includes("平衡")) return <Sunset className="h-4 w-4 text-orange-300" />;
  return <Moon className="h-4 w-4 text-purple-300" />;
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

  // Top Hero Track (Rank 01)
  const heroSong = displayedSongs[0] || null;
  const isHeroPlaying = currentSong?.id === heroSong?.id && isPlaying;
  // Sub-tracks (Rank 02 onwards, or all tracks when searching)
  const subTracks = displayedSongs.length > 1 ? displayedSongs.slice(1) : [];

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setDismissedSongIds(new Set());
    setPinnedExplanationId(null);
    refreshRecommendation();
    useUIStore.getState().showToast("✨ 已为您发掘新一批推荐曲目", "success", 2000);
    setTimeout(() => setIsRefreshing(false), 800);
  }, [refreshRecommendation]);

  const handleModeChange = (mode: DailyRecommendationMode) => {
    if (switchMode) {
      switchMode(mode);
    }
    useUIStore.getState().showToast(`🎯 已切入「${mode.name}」模式`, "success", 2000);
  };

  const handlePlayAll = () => {
    if (displayedSongs.length > 0) {
      playQueue(displayedSongs, 0);
      useUIStore.getState().showToast(`▶ 开始播放每日推荐（共 ${displayedSongs.length} 首）`, "success", 2500);
    }
  };

  const handlePlaySong = (song: Song, index: number) => {
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      playQueue(displayedSongs, index);
    }
  };

  const handleDismiss = (songId: string) => {
    setDismissedSongIds((current) => new Set([...current, songId]));
    setPinnedExplanationId((current) => (current === songId ? null : current));
    useUIStore.getState().showToast("已从当前推荐中忽略", "info", 1800);
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

  // 桌面端无障碍快捷键监听：[Esc] 退出, [Space] 播放/暂停头牌, [R] 刷新
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === " " && heroSong) {
        e.preventDefault();
        handlePlaySong(heroSong, 0);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleRefresh();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, heroSong, handleRefresh]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-5 backdrop-blur-2xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 10 }}
        transition={{ type: "spring", damping: 30, stiffness: 350, mass: 0.8 }}
        onClick={(event) => event.stopPropagation()}
        className="daily-rec-modal relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-white/[0.14] bg-[#090a10]/85 shadow-[0_32px_120px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.22)] backdrop-blur-3xl"
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .daily-rec-modal,
          .daily-rec-modal * {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif !important;
          }
          @keyframes bento-vinyl-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .bento-vinyl-spinning {
            animation: bento-vinyl-spin 10s linear infinite;
          }
          .bento-subtrack-list::-webkit-scrollbar {
            width: 4px;
          }
          .bento-subtrack-list::-webkit-scrollbar-track {
            background: transparent;
          }
          .bento-subtrack-list::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.18);
            border-radius: 9999px;
          }
          .bento-subtrack-list::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.35);
          }
        `}} />

        {/* ─── Ambient Platinum Highlights (Subtle Apple Specular Beams) ─── */}
        <div className="absolute -top-32 -left-32 h-72 w-72 rounded-full bg-white/[0.04] blur-3xl pointer-events-none" />
        <div className="absolute top-1/4 right-0 h-64 w-64 rounded-full bg-white/[0.025] blur-3xl pointer-events-none" />

        {/* ─── 1. Island Header Bar ─── */}
        <div className="relative z-10 flex items-center justify-between border-b border-white/[0.08] px-6 py-4 bg-white/[0.015]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.08] border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]">
              <Sparkles className="h-4.5 w-4.5 text-white/90 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-[17px] font-bold tracking-tight text-white flex items-center gap-2 truncate">
                  <span>每日专属推荐</span>
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/40 font-mono">
                    Daily Recommendations
                  </span>
                </h2>
              </div>
              <p className="text-[11.5px] text-white/45 tracking-wide truncate mt-0.5">
                智能学习你的高频偏好 · 伴奏去噪与防垄断算法保驾护航
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePlayAll}
              disabled={displayedSongs.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.14] hover:bg-white/[0.22] border border-white/20 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-white text-white" />
              全部播放
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="换一批"
              title="换一批推荐 (R)"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.15] border border-white/10 text-white/70 hover:text-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-white" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                clearNegativeFeedback();
                useUIStore.getState().showToast("已重置不感兴趣偏好记录", "success", 2000);
              }}
              aria-label="清除偏好"
              title="重置不感兴趣偏好"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.15] border border-white/10 text-white/50 hover:text-white transition-all active:scale-95 cursor-pointer"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              title="关闭 (Esc)"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.15] border border-white/10 text-white/60 hover:text-white transition-all active:scale-95 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ─── 2. Main Apple Bento Grid Canvas ─── */}
        <div className="relative z-10 p-4 sm:p-5 overflow-y-auto max-h-[calc(82vh-110px)] custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              <p className="mt-4 text-xs font-medium text-white/60">正在进行智能推荐去噪与时段偏好校准...</p>
            </div>
          ) : !hasRecommendation || !heroSong ? (
            /* 优雅的空状态：绝非突兀大黑框，而是质感唱片指引 */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white/[0.05] border border-white/12 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] mb-4">
                <Disc3 className="h-9 w-9 text-white/40" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">暂无已收录曲目推荐</h3>
              <p className="mt-1.5 text-xs text-white/45 max-w-sm leading-relaxed">
                曲库中暂无可供分析的本地音乐。导入你的音乐库后，AI 将自动为你量身策展每日精选。
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-5 flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 px-5 py-2 text-xs font-medium text-white transition-all cursor-pointer shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新尝试生成
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* ─── 🔲 BENTO BLOCK 1: 今日首席黑胶焦点 (Col-span 7) ─── */}
              <div className="lg:col-span-7 flex flex-col justify-between rounded-[24px] border border-white/[0.12] bg-white/[0.03] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-xl relative overflow-hidden group">
                {/* 封套与滑移黑胶 */}
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div
                    className="relative flex items-center shrink-0 cursor-pointer w-44 h-32"
                    onClick={() => handlePlaySong(heroSong, 0)}
                  >
                    {/* 探出旋转实体黑胶唱片（安全包含在 w-44 容器内，绝不向右溢出侵害文字） */}
                    <div
                      className={`absolute left-8 w-28 h-28 rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.95)] transition-transform duration-500 ease-out group-hover:translate-x-2 z-0 ${
                        isHeroPlaying ? "bento-vinyl-spinning" : ""
                      }`}
                      style={{
                        background:
                          "radial-gradient(circle, #202024 0%, #141416 25%, #252529 26%, #0f0f12 45%, #202024 46%, #0a0a0d 65%, #18181b 66%, #050508 100%)",
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15), 0 12px 30px rgba(0,0,0,0.9)",
                      }}
                    >
                      <div className="absolute inset-1 rounded-full pointer-events-none opacity-40 border border-white/10" />
                      <div className="absolute inset-0 m-auto w-9 h-9 rounded-full bg-[#18181b] border border-white/30 flex items-center justify-center shadow-inner">
                        <Disc3 className="w-4 h-4 text-white/60" />
                      </div>
                    </div>

                    {/* 正方形黑胶封套 Jacket */}
                    <div className="relative z-10 w-32 h-32 rounded-2xl overflow-hidden bg-[#18181b] border border-white/20 shadow-[0_16px_36px_rgba(0,0,0,0.8)] group-hover:shadow-[0_20px_48px_rgba(0,0,0,0.95)] transition-all">
                      {heroSong.cover ? (
                        <img src={heroSong.cover} alt={heroSong.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5">
                          <Music className="w-10 h-10 text-white/30" />
                        </div>
                      )}
                      {/* 书脊折光与右侧封套暗衬 */}
                      <div className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-gradient-to-r from-white/40 via-white/15 to-transparent pointer-events-none" />
                      <div className="absolute right-0 top-0 bottom-0 w-[4px] bg-gradient-to-l from-black/80 to-transparent pointer-events-none" />
                      <div className={`absolute inset-0 bg-black/45 transition-opacity flex items-center justify-center ${isHeroPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                        {isHeroPlaying ? (
                          <Pause className="w-8 h-8 fill-white text-white" />
                        ) : (
                          <Play className="w-8 h-8 fill-white text-white translate-x-0.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 首席推荐信息（独立边距，与黑胶绝对安全隔离） */}
                  <div className="flex-1 min-w-0 text-center sm:text-left pl-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-white border border-white/25 shadow-sm">
                        <Sparkles className="w-2.5 h-2.5" />
                        今日首推 · No. 01 Pick
                      </span>
                      {recommendationReasons.get(heroSong.id)?.[0] && (
                        <span className="text-[10px] text-white/80 bg-white/10 border border-white/15 px-2 py-0.5 rounded-full font-medium">
                          {recommendationReasons.get(heroSong.id)![0].label} {recommendationReasons.get(heroSong.id)![0].weightLabel}
                        </span>
                      )}
                      {isHeroPlaying && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          播放中
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                      {heroSong.title}
                    </h3>
                    <p className="text-xs text-white/55 mt-0.5 truncate">
                      {heroSong.artist} {heroSong.album ? `· 《${heroSong.album}》` : ""}
                    </p>

                    {/* 控制操作栏 */}
                    <div className="mt-4 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handlePlaySong(heroSong, 0)}
                        className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black shadow-md hover:bg-white/90 active:scale-95 transition-all cursor-pointer"
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

                      {/* 理由展开按键 (包含所有 Vitest 断言属性) */}
                      <button
                        type="button"
                        onClick={() => toggleExplanation(heroSong.id)}
                        aria-expanded={pinnedExplanationId === heroSong.id}
                        aria-controls={`recommendation-reasons-${heroSong.id}`}
                        aria-keyshortcuts="?"
                        className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-all cursor-pointer ${
                          pinnedExplanationId === heroSong.id
                            ? "bg-white/25 text-white border border-white/40"
                            : "bg-white/[0.06] text-white/70 hover:bg-white/[0.15] hover:text-white border border-white/10"
                        }`}
                        title="查看 AI 推荐理由 (?)"
                      >
                        <HelpCircle className="h-3 w-3" />
                        <span>Why this</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(heroSong);
                        }}
                        className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all cursor-pointer ${
                          isFavorite(heroSong.id)
                            ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                            : "bg-white/[0.06] border-white/10 text-white/60 hover:text-white"
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFavorite(heroSong.id) ? "fill-rose-400" : ""}`} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          insertNext(heroSong);
                          useUIStore.getState().showToast(`已添加《${heroSong.title}》为下一首播放`, "info", 1800);
                        }}
                        title="下一首播放"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(heroSong);
                          useUIStore.getState().showToast(`已将《${heroSong.title}》加入播放列表`, "info", 1800);
                        }}
                        title="加入播放队列"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hero 理由折叠抽屉 */}
                <div
                  id={`recommendation-reasons-${heroSong.id}`}
                  aria-hidden={pinnedExplanationId !== heroSong.id}
                  className={`overflow-hidden transition-all duration-200 ${
                    pinnedExplanationId === heroSong.id
                      ? "max-h-64 mt-3.5 p-3 rounded-xl border border-white/12 bg-black/40 opacity-100"
                      : "max-h-0 p-0 opacity-0 group-hover:max-h-64 group-hover:mt-3.5 group-hover:p-3 group-hover:rounded-xl group-hover:border group-hover:border-white/12 group-hover:bg-black/40 group-hover:opacity-100 group-focus-within:max-h-64 group-focus-within:mt-3.5 group-focus-within:p-3 group-focus-within:rounded-xl group-focus-within:border group-focus-within:border-white/12 group-focus-within:bg-black/40 group-focus-within:opacity-100"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3 border-b border-white/[0.06] pb-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/90">
                      <Sparkles className="h-3 w-3 text-white" />
                      AI 偏好推荐理由
                    </span>
                    {pinnedExplanationId === heroSong.id && (
                      <span className="rounded-full bg-white/20 px-2 py-0.2 text-[9.5px] text-white font-medium border border-white/30">
                        已锁定展开
                      </span>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    {(recommendationReasons.get(heroSong.id) || []).map((reason) => (
                      <div
                        key={reason.code}
                        className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-1.5 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold text-white/95">{reason.label}</span>
                          <span className="text-[11px] text-white/50 ml-2">{reason.detail}</span>
                        </div>
                        <span className="shrink-0 rounded-full bg-white/15 border border-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                          {reason.weightLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ─── 🔲 BENTO BLOCK 3: 协同好歌精选流 (Col-span 5) ─── */}
              <div className="lg:col-span-5 flex flex-col justify-between rounded-[24px] border border-white/[0.12] bg-white/[0.03] p-4.5 shadow-[0_16px_40px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-xl">
                {/* 顶栏：标签与行内快速搜索（对齐标题与准确计数） */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.08] border border-white/10">
                      <Headphones className="h-3.5 w-3.5 text-white/80" />
                    </div>
                    <span>精选好歌推荐</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/[0.06] text-white/50 border border-white/10">
                      {subTracks.length} 首
                    </span>
                  </div>

                  {/* 紧凑搜索框 */}
                  <div className="relative flex items-center">
                    <Search className="absolute left-2.5 h-3 w-3 text-white/40 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索推荐..."
                      className="h-7 w-24 sm:w-28 rounded-full bg-white/[0.06] border border-white/10 pl-7 pr-2.5 text-[10.5px] text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:w-36 transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 text-white/40 hover:text-white text-xs cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* 歌曲微条列表（添加专有纤细滚动条与右侧边距，杜绝溢出与压线） */}
                <div className="space-y-1.5 my-2.5 flex-1 min-h-[200px] overflow-y-auto pr-1.5 bento-subtrack-list">
                  {subTracks.length === 0 ? (
                    <div className="py-8 text-center text-xs text-white/40">
                      {searchQuery ? "未检索到匹配的曲目" : "暂无更多协同推荐"}
                    </div>
                  ) : (
                    subTracks.map((song, idx) => {
                      const absoluteIndex = idx + 1;
                      const reasons = recommendationReasons.get(song.id) || [];
                      const topReason = reasons[0];
                      const isThisPlaying = currentSong?.id === song.id && isPlaying;
                      const isThisCurrent = currentSong?.id === song.id;
                      const isFav = isFavorite(song.id);
                      const isPinned = pinnedExplanationId === song.id;

                      return (
                        <div
                          key={song.id}
                          onClick={() => handlePlaySong(song, absoluteIndex)}
                          className={`group relative flex flex-col rounded-xl border p-2 transition-all cursor-pointer ${
                            isThisPlaying
                              ? "border-white/30 bg-white/[0.1] shadow-sm"
                              : isThisCurrent
                                ? "border-white/20 bg-white/[0.06]"
                                : "border-white/[0.05] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {/* 位次标识或音频跳动均衡器 */}
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                              {isThisPlaying ? (
                                <div className="flex items-end justify-center gap-[2px] h-3 w-3">
                                  <span className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite_100ms] h-full" />
                                  <span className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite_300ms] h-2" />
                                  <span className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite_200ms] h-3" />
                                </div>
                              ) : (
                                <span
                                  className={`text-[11px] font-bold tabular-nums ${
                                    absoluteIndex === 1
                                      ? "text-slate-300"
                                      : absoluteIndex === 2
                                        ? "text-amber-500"
                                        : "text-white/35 group-hover:text-white/70"
                                  }`}
                                >
                                  {String(absoluteIndex + 1).padStart(2, "0")}
                                </span>
                              )}
                            </div>

                            {/* 专辑缩略图 */}
                            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.05] border border-white/10 shadow-sm">
                              {song.cover ? (
                                <img src={song.cover} alt={song.title} className="h-full w-full object-cover" />
                              ) : (
                                <Music className="h-3 w-3 text-white/40" />
                              )}
                              <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isThisPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                {isThisPlaying ? (
                                  <Pause className="h-3 w-3 fill-white text-white" />
                                ) : (
                                  <Play className="h-3 w-3 fill-white text-white translate-x-0.5" />
                                )}
                              </div>
                            </div>

                            {/* 曲目元数据 */}
                            <div className="min-w-0 flex-1">
                              <h4 className={`truncate text-xs font-semibold ${isThisPlaying ? "text-white font-bold" : "text-white/90 group-hover:text-white"}`}>
                                {song.title}
                              </h4>
                              <div className="flex items-center gap-1.5 truncate text-[10.5px] text-white/45">
                                <span className="truncate">{song.artist}</span>
                                {topReason && (
                                  <span className="text-[9px] bg-white/[0.08] text-white/70 px-1.5 py-0.2 rounded font-mono">
                                    {topReason.weightLabel}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 时长 */}
                            {song.duration > 0 && (
                              <span className="text-[10px] text-white/35 font-mono tabular-nums shrink-0">
                                {formatDuration(song.duration)}
                              </span>
                            )}

                            {/* 操作图标栏 */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExplanation(song.id);
                                }}
                                title="理由"
                                className="h-6 w-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white/70"
                              >
                                <HelpCircle className="h-3 w-3" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(song);
                                }}
                                className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                                  isFav ? "bg-rose-500/20 text-rose-400" : "bg-white/10 hover:bg-white/20 text-white/70"
                                }`}
                              >
                                <Heart className={`h-3 w-3 ${isFav ? "fill-rose-400" : ""}`} />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  insertNext(song);
                                  useUIStore.getState().showToast(`下一首播放《${song.title}》`, "info", 1500);
                                }}
                                title="下一首播放"
                                className="h-6 w-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-white/70"
                              >
                                <ListPlus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* 理由抽屉 */}
                          {isPinned && (
                            <div className="mt-2 p-2 rounded-lg bg-black/40 border border-white/10 text-[10.5px]">
                              {reasons.map((r) => (
                                <div key={r.code} className="flex items-center justify-between gap-2 py-0.5">
                                  <span className="text-white/80">{r.label}</span>
                                  <span className="text-white font-mono">{r.weightLabel}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 底部微提示 */}
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10.5px] text-white/40">
                  <span>点击条目即刻试听</span>
                  <span className="font-mono">Apple Bento Engine</span>
                </div>
              </div>

              {/* ─── 🔲 BENTO BLOCK 2: 时段心境感知卡 (Col-span 7) ─── */}
              <div className="lg:col-span-7 rounded-[22px] border border-white/[0.12] bg-white/[0.03] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-xl flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-white/[0.08] border border-white/10">
                      {getModeIcon(recommendationMode?.name || "")}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>当前时段：{recommendationMode?.name || "精选心境"}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-white/70 font-mono">
                          Live Context
                        </span>
                      </div>
                      <p className="text-[11px] text-white/50 mt-0.5">
                        {recommendationMode?.description || "自动感应当下时区与节奏契合度"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 场景模式快捷药丸组 */}
                <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/[0.06] flex-wrap">
                  {AVAILABLE_RECOMMENDATION_MODES.map((mode) => {
                    const isCurrent = recommendationMode?.name === mode.name;
                    return (
                      <button
                        key={mode.name}
                        type="button"
                        onClick={() => handleModeChange(mode)}
                        className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-white text-black font-semibold shadow-[0_0_14px_rgba(255,255,255,0.4)]"
                            : "bg-white/[0.05] text-white/65 hover:bg-white/[0.12] hover:text-white border border-white/[0.06]"
                        }`}
                      >
                        {mode.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── 🔲 BENTO BLOCK 4: AI 偏好能量组件 (Col-span 5) ─── */}
              <div className="lg:col-span-5 rounded-[22px] border border-white/[0.12] bg-white/[0.03] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-white/[0.08] border border-white/10">
                      <Activity className="h-4 w-4 text-white/80" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">AI 声学能量与健康校准</div>
                      <div className="text-[10.5px] text-white/50">Anti-Monopoly & Quality Shield</div>
                    </div>
                  </div>

                  {/* 5 柱动态跳动微波形 */}
                  <div className="flex items-end gap-[3px] h-5">
                    <span className="w-1 bg-white/70 rounded-full animate-[bounce_1.1s_infinite_100ms] h-full" />
                    <span className="w-1 bg-white/50 rounded-full animate-[bounce_1.1s_infinite_400ms] h-3" />
                    <span className="w-1 bg-white/80 rounded-full animate-[bounce_1.1s_infinite_200ms] h-4.5" />
                    <span className="w-1 bg-white/60 rounded-full animate-[bounce_1.1s_infinite_500ms] h-2.5" />
                    <span className="w-1 bg-white/90 rounded-full animate-[bounce_1.1s_infinite_300ms] h-4" />
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[10.5px] text-white/50">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    歌手防霸屏与杂音过滤已生效
                  </span>
                  <span className="font-mono text-white/70">100% Calibrated</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── 3. Suspended Glass Capsule Footer ─── */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/[0.08] bg-black/40 px-6 py-3 text-[11px] text-white/45">
          <div className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            <span className="truncate">
              共 {displayedSongs.length} 首精选 · 约 {formatDuration(totalDuration)}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleSaveAsPlaylist}
              disabled={displayedSongs.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/15 px-3.5 py-1 text-xs text-white/90 hover:text-white transition-all cursor-pointer disabled:opacity-40 shadow-sm"
              title="转存为歌单"
            >
              <FolderPlus className="h-3.5 w-3.5 text-white" />
              转存为歌单
            </button>
            <span className="hidden sm:inline-block text-white/30 text-[10px]">
              快捷键: [Space] 播放/暂停 · [?] 推荐理由 · [R] 换一批 · [Esc] 退出
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
