"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  X,
  Play,
  Download,
  CheckSquare,
  Square,
  Music,
  Loader2,
  Sparkles,
  User,
  Headphones,
  Plus,
  Radio,
} from "lucide-react";
import type { Song } from "@/types/song";
import { useAudioStore } from "@/store/audioStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { useQueueStore } from "@/store/queueStore";
import { useUserAccountStore } from "@/store/userAccountStore";
import { usePlaylistStore } from "@/store/playlistStore";

export interface DrawerPlaylistInfo {
  id: string;
  name: string;
  coverImgUrl: string;
  creatorName: string;
  playCount: number;
  trackCount: number;
  source: string;
  description?: string;
}

interface PlaylistDetailDrawerProps {
  isOpen: boolean;
  playlist: DrawerPlaylistInfo | null;
  onClose: () => void;
}

export const PlaylistDetailDrawer: React.FC<PlaylistDetailDrawerProps> = ({
  isOpen,
  playlist,
  onClose,
}) => {
  const [tracks, setTracks] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const { playQueue, playSong } = useAudioStore();
  const { addToQueue } = useQueueStore();
  const { addBatchDownloads, isSongOffline } = useOfflineDownloadStore();
  const { fetchAllPlaylistTracks } = useUserAccountStore();
  const { importSongs } = usePlaylistStore();

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  useEffect(() => {
    if (!isOpen || !playlist) {
      setTracks([]);
      setSelectedIds(new Set());
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const loadTracks = async () => {
      try {
        // 1. 优先使用全网通用高可用接口拉取歌单完整曲目 (免登录即可解析网易云公开歌单)
        const res = await fetch(`/api/playlist/tracks?id=${encodeURIComponent(playlist.id)}&limit=500`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.songs) && data.songs.length > 0) {
            setTracks(data.songs);
            return;
          }
        }

        // 2. 兜底尝试用户登录账户接口
        if (playlist.source === "netease") {
          const songs = await fetchAllPlaylistTracks(playlist.id);
          if (isMounted && Array.isArray(songs) && songs.length > 0) {
            setTracks(songs);
          }
        }
      } catch (err) {
        console.warn("[PlaylistDetailDrawer] Failed to fetch playlist tracks:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadTracks();

    return () => {
      isMounted = false;
    };
  }, [isOpen, playlist, fetchAllPlaylistTracks]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === tracks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tracks.map((t) => t.id)));
    }
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playQueue(tracks, 0);
      showNotice(`▶ 开始播放歌单《${playlist?.name}》(${tracks.length}首)`);
    }
  };

  // 1. 导入为本地歌单 (并在“歌单编排”中立即可见)
  const handleSaveAsLocalPlaylist = () => {
    if (!playlist || tracks.length === 0) return;
    try {
      const STORAGE_KEY = "vibe_custom_playlists_v1";
      const saved = localStorage.getItem(STORAGE_KEY);
      const list = saved ? JSON.parse(saved) : [];
      const newPl = {
        id: `pl-${Date.now()}`,
        title: playlist.name,
        cover: playlist.coverImgUrl || "/default-cover.svg",
        songs: tracks,
        createdAt: Date.now(),
      };
      const next = [newPl, ...list];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      importSongs(tracks);
      showNotice(`⭐ 已将《${playlist.name}》创建为本地歌单，可在【歌单编排】中随时管理！`);
    } catch {
      showNotice("导入歌单异常，请重试");
    }
  };

  // 2. 一键下载并自动创建离线歌单
  const handleDownloadAndCreateOfflinePlaylist = () => {
    if (!playlist) return;
    const toDownload = selectedIds.size > 0 ? tracks.filter((t) => selectedIds.has(t.id)) : tracks;
    if (toDownload.length === 0) return;

    addBatchDownloads(toDownload, "lossless");

    try {
      const STORAGE_KEY = "vibe_custom_playlists_v1";
      const saved = localStorage.getItem(STORAGE_KEY);
      const list = saved ? JSON.parse(saved) : [];
      const newPl = {
        id: `offline-${Date.now()}`,
        title: `[离线] ${playlist.name}`,
        cover: playlist.coverImgUrl || "/default-cover.svg",
        songs: toDownload,
        createdAt: Date.now(),
      };
      const next = [newPl, ...list];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      importSongs(toDownload);
      showNotice(`📥 已开始下载 ${toDownload.length} 首歌曲，并创建了离线歌单《${playlist.name}》！可在【歌单编排】与【离线下载】中直接畅听！`);
    } catch {
      showNotice(`已提交 ${toDownload.length} 首歌曲下载任务`);
    }
  };

  const handleDownloadSelected = () => {
    handleDownloadAndCreateOfflinePlaylist();
  };

  const formatDuration = (seconds: number): string => {
    if (isNaN(seconds) || seconds <= 0) return "03:45";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatPlayCount = (count: number): string => {
    if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
    return count.toString();
  };

  return (
    <AnimatePresence>
      {isOpen && playlist && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* 黑色半透明背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* 右侧滑出玻璃拟态抽屉 */}
          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: "0%", opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative z-10 w-full max-w-2xl h-full bg-[#0d0f17]/95 border-l border-white/10 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden text-white"
          >
            {/* 顶部标题栏 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-sm font-semibold text-white/90">网络歌单全量解析</span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {playlist.source === "netease" ? "网易云" : playlist.source === "qq" ? "QQ音乐" : "全网源"}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 歌单概览头部 */}
            <div className="p-6 border-b border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent flex gap-5 items-start shrink-0">
              <div className="relative w-28 h-28 rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0 bg-black/40">
                <Image
                  src={playlist.coverImgUrl || "/default-cover.svg"}
                  alt={playlist.name}
                  fill
                  className="object-cover"
                  sizes="112px"
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white leading-snug line-clamp-2">
                  {playlist.name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/50 mt-2">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-white/40" />
                    {playlist.creatorName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Music className="w-3.5 h-3.5 text-white/40" />
                    {tracks.length > 0 ? `${tracks.length} 首` : `${playlist.trackCount} 首`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Headphones className="w-3.5 h-3.5 text-white/40" />
                    {formatPlayCount(playlist.playCount)} 次播放
                  </span>
                </div>
                {playlist.description && (
                  <p className="text-xs text-white/40 mt-2 line-clamp-2">
                    {playlist.description}
                  </p>
                )}

                {/* 快捷操作组 */}
                <div className="flex items-center gap-2.5 mt-3.5">
                  <button
                    onClick={handlePlayAll}
                    disabled={tracks.length === 0}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    播放全部
                  </button>
                  <button
                    onClick={handleDownloadSelected}
                    disabled={tracks.length === 0}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="下载选中的母带曲目并自动在本地生成离线歌单"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {selectedIds.size > 0 ? `下载并存歌单 (${selectedIds.size})` : "📥 一键下载整单"}
                  </button>
                  <button
                    onClick={handleSaveAsLocalPlaylist}
                    disabled={tracks.length === 0}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-medium active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="将该网络歌单收录至本地【歌单编排】"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    ⭐ 存为本地歌单
                  </button>
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors flex items-center gap-1"
                  >
                    {selectedIds.size === tracks.length && tracks.length > 0 ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                        取消全选
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-white/40" />
                        全选
                      </>
                    )}
                  </button>
                </div>

                {/* 操作通知反馈横幅 */}
                <AnimatePresence>
                  {actionNotice && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{actionNotice}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* 曲目列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
              {isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center text-white/40 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <p className="text-xs">正在全量解析歌单母带曲目...</p>
                </div>
              ) : tracks.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-white/40 gap-2">
                  <Music className="w-8 h-8 opacity-30" />
                  <p className="text-xs">歌单内暂无可解析曲目</p>
                </div>
              ) : (
                tracks.map((song, idx) => {
                  const isSelected = selectedIds.has(song.id);
                  const isDownloaded = isSongOffline(song.id);

                  return (
                    <div
                      key={`${song.id}-${idx}`}
                      onDoubleClick={() => playSong(song)}
                      className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                        isSelected
                          ? "bg-emerald-500/15 border border-emerald-500/30"
                          : "hover:bg-white/[0.06] border border-transparent"
                      }`}
                    >
                      <button
                        onClick={() => handleToggleSelect(song.id)}
                        className="text-white/40 hover:text-white shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-white/30" />
                        )}
                      </button>

                      <span className="w-5 text-center text-xs font-mono text-white/30 shrink-0">
                        {idx + 1}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white/90 truncate">
                            {song.title}
                          </span>
                          <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                            SQ
                          </span>
                          {isDownloaded && (
                            <span className="px-1.5 py-0.2 text-[9px] rounded bg-cyan-500/20 text-cyan-300">
                              已离线
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/40 truncate mt-0.5">
                          {song.artist} {song.album ? `• ${song.album}` : ""}
                        </div>
                      </div>

                      <div className="text-[11px] font-mono text-white/30 shrink-0 tabular-nums">
                        {formatDuration(song.duration)}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => playSong(song)}
                          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-emerald-500 hover:text-white flex items-center justify-center text-white/70 transition-colors"
                          title="即刻试听"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <button
                          onClick={() => addToQueue(song)}
                          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                          title="加入队列"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => addBatchDownloads([song], "lossless")}
                          disabled={isDownloaded}
                          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors disabled:opacity-40"
                          title={isDownloaded ? "已离线" : "离线缓存"}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
