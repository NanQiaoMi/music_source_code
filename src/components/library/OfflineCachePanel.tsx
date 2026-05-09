"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { usePlaylistStore } from "@/store/playlistStore";
import {
  X,
  Download,
  Trash2,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  HardDrive,
  Music,
  RefreshCw,
} from "lucide-react";

interface OfflineCachePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineCachePanel: React.FC<OfflineCachePanelProps> = ({ isOpen, onClose }) => {
  const {
    cacheStatus,
    isLoading,
    isCaching,
    cacheSong,
    removeCachedSong,
    isSongCached,
    getCacheStats,
    formatSize,
    clearAllCache,
    cacheAllSongs,
  } = useOfflineCache();

  const { songs } = usePlaylistStore();
  const [activeTab, setActiveTab] = useState<"all" | "cached">("all");

  const stats = useMemo(() => getCacheStats(), [getCacheStats]);

  const filteredSongs = useMemo(() => {
    if (activeTab === "cached") {
      return songs.filter((song) => isSongCached(song.id));
    }
    return songs;
  }, [songs, activeTab, isSongCached]);

  const handleCacheAll = async () => {
    await cacheAllSongs();
  };

  const handleClearAll = async () => {
    if (confirm("确定要清空所有离线缓存吗？")) {
      await clearAllCache();
    }
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
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[80vh] bg-[#1c1c1e]/90 backdrop-blur-[40px] rounded-[24px] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white text-xl font-semibold">离线缓存</h2>
                <p className="text-white/40 text-xs">缓存歌曲以便离线播放</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-white/50" />
                <span className="text-white/70 text-sm">
                  已缓存: <span className="text-white font-medium">{stats.totalCached}</span> 首
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-sm">
                  占用空间:{" "}
                  <span className="text-white font-medium">{formatSize(stats.totalSize)}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCacheAll}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                缓存全部
              </button>
              {stats.totalCached > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  清空
                </button>
              )}
            </div>
          </div>

          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-colors ${
                activeTab === "all"
                  ? "bg-white/10 text-white border-b-2 border-blue-500"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Music className="w-4 h-4" />
              全部歌曲
            </button>
            <button
              onClick={() => setActiveTab("cached")}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-colors ${
                activeTab === "cached"
                  ? "bg-white/10 text-white border-b-2 border-blue-500"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <CloudOff className="w-4 h-4" />
              已缓存
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0">
            <AnimatePresence mode="wait">
              {filteredSongs.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <CloudOff className="w-8 h-8 text-white/30" />
                  </div>
                  <p className="text-white/60 mb-2">
                    {activeTab === "cached" ? "暂无缓存歌曲" : "暂无歌曲"}
                  </p>
                  <p className="text-white/40 text-sm">
                    {activeTab === "cached"
                      ? "从全部歌曲中选择要缓存的歌曲"
                      : "导入音乐后可以缓存歌曲以便离线播放"}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {filteredSongs.map((song) => {
                    const cached = isSongCached(song.id);
                    const isCurrentlyCaching = isCaching === song.id;

                    return (
                      <motion.div
                        key={song.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors group"
                      >
                        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500/40 to-cyan-500/40 flex items-center justify-center overflow-hidden">
                          {song.cover ? (
                            <img src={song.cover} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Music className="w-5 h-5 text-white/50" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium truncate">{song.title}</h4>
                          <p className="text-white/50 text-sm truncate">{song.artist}</p>
                        </div>

                        {cached ? (
                          <div className="flex items-center gap-2">
                            <span className="text-green-400 text-xs flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              已缓存
                            </span>
                            <button
                              onClick={() => removeCachedSong(song.id)}
                              className="p-2 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                              title="移除缓存"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : song.audioUrl?.startsWith("stored://") ? (
                          <span className="text-white/30 text-xs">本地文件</span>
                        ) : (
                          <button
                            onClick={() => cacheSong(song)}
                            disabled={isCurrentlyCaching}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {isCurrentlyCaching ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            缓存
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
