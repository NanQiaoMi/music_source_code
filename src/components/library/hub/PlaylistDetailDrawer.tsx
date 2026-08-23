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

  const { playQueue, playSong } = useAudioStore();
  const { addToQueue } = useQueueStore();
  const { addBatchDownloads, isSongOffline } = useOfflineDownloadStore();
  const { fetchAllPlaylistTracks } = useUserAccountStore();

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
        if (playlist.source === "netease") {
          const songs = await fetchAllPlaylistTracks(playlist.id);
          if (isMounted) {
            setTracks(songs);
          }
        } else {
          // QQ 或其他音源歌单通过通用接口获取
          const res = await fetch(`/api/playlist/tracks?id=${playlist.id}&limit=500`);
          if (res.ok) {
            const data = await res.json();
            if (isMounted && Array.isArray(data.songs)) {
              setTracks(data.songs);
            }
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
    }
  };

  const handleDownloadSelected = () => {
    const toDownload =
      selectedIds.size > 0 ? tracks.filter((t) => selectedIds.has(t.id)) : tracks;
    if (toDownload.length > 0) {
      addBatchDownloads(toDownload, "lossless");
    }
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
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {selectedIds.size > 0 ? `下载已选 (${selectedIds.size})` : "一键下载整单"}
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
