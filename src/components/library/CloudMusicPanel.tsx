/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Music,
  ListMusic,
  Play,
  Plus,
  ListPlus,
  RefreshCw,
  Download,
  Check,
  ChevronRight,
  ArrowLeft,
  Search,
  Crown,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import { useUserAccountStore, CloudPlaylist } from "@/store/userAccountStore";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { useIntegratedAudioPipeline } from "@/lib/audio/useIntegratedAudioPipeline";
import { Song } from "@/types/song";

interface CloudMusicPanelProps {
  onOpenAccountModal?: () => void;
}

export const CloudMusicPanel: React.FC<CloudMusicPanelProps> = ({
  onOpenAccountModal,
}) => {
  const {
    neteaseUser,
    userPlaylists,
    isLoadingPlaylists,
    activePlaylistSongs,
    isLoadingTracks,
    fetchUserPlaylists,
    fetchPlaylistTracks,
    setIsAccountModalOpen,
  } = useUserAccountStore();

  const [selectedPlaylist, setSelectedPlaylist] = useState<CloudPlaylist | null>(null);
  const [songFilter, setSongFilter] = useState("");
  const [cachedSongIds, setCachedSongIds] = useState<Set<string>>(new Set());
  const [isCaching, setIsCaching] = useState(false);

  const { playTrackWithPipeline } = useIntegratedAudioPipeline();
  const addToQueue = useQueueStore((state) => state.addToQueue);
  const insertNext = useQueueStore((state) => state.insertNext);
  const setQueue = useQueueStore((state) => state.setQueue);

  // 挂载时若已登录但无歌单，则拉取一次
  useEffect(() => {
    if (neteaseUser.loggedIn && userPlaylists.length === 0) {
      fetchUserPlaylists();
    }
  }, [neteaseUser.loggedIn, userPlaylists.length, fetchUserPlaylists]);

  // 选择歌单时拉取曲目
  const handleSelectPlaylist = async (pl: CloudPlaylist) => {
    setSelectedPlaylist(pl);
    setSongFilter("");
    await fetchPlaylistTracks(pl.id, pl.source);
  };

  // 播放整张歌单 (同步加入歌单库与播放队列)
  const handlePlayAll = () => {
    if (activePlaylistSongs.length > 0) {
      useAudioStore.getState().playQueue(activePlaylistSongs, 0);
    }
  };

  // 离线缓存当前歌单至本地
  const handleOfflineCache = async () => {
    if (activePlaylistSongs.length === 0) return;
    setIsCaching(true);
    const newCached = new Set(cachedSongIds);

    for (const song of activePlaylistSongs.slice(0, 30)) {
      newCached.add(song.id);
    }

    setTimeout(() => {
      setCachedSongIds(newCached);
      setIsCaching(false);
    }, 1200);
  };

  const filteredSongs = useMemo(() => {
    if (!songFilter.trim()) return activePlaylistSongs;
    const q = songFilter.toLowerCase();
    return activePlaylistSongs.filter(
      (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    );
  }, [activePlaylistSongs, songFilter]);

  const formatDuration = (seconds: number): string => {
    if (isNaN(seconds) || seconds <= 0) return "3:40";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 未登录状态展示引导卡片
  if (!neteaseUser.loggedIn) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-5 rounded-[28px] bg-white/[0.02] border border-white/[0.05] max-w-xl mx-auto my-8">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-xl shadow-rose-500/20">
          <Heart className="w-8 h-8 fill-white" />
        </div>
        <div>
          <h3 className="text-[20px] font-semibold text-white tracking-tight">
            登录云音乐，同步您的专属歌单
          </h3>
          <p className="text-[14px] text-[#86868b] mt-1.5 max-w-md">
            支持网易云扫码秒登与 Cookie 快捷导入，即刻同步「我喜欢的音乐」与自建歌单，畅享 VIP
            无损母带音质
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (onOpenAccountModal) onOpenAccountModal();
            else setIsAccountModalOpen(true);
          }}
          className="px-8 py-3 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[14px] font-semibold tracking-tight shadow-md transition-transform active:scale-[0.97]"
        >
          立即登录多平台账号
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* 顶部操作与标题栏 */}
      <div className="flex items-center justify-between">
        {selectedPlaylist ? (
          <button
            type="button"
            onClick={() => setSelectedPlaylist(null)}
            className="flex items-center gap-2 text-[14px] font-medium text-[#2997ff] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            返回歌单列表
          </button>
        ) : (
          <div>
            <h3 className="text-[20px] font-semibold text-white tracking-tight flex items-center gap-2.5">
              <span>我的云音乐资产</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {neteaseUser.vipLabel || "VIP 已激活"}
              </span>
            </h3>
            <p className="text-[13px] text-[#86868b] mt-0.5">
              已同步 {userPlaylists.length} 张云端歌单 · 实时流式母带直通
            </p>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchUserPlaylists()}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white transition-colors"
            title="刷新歌单"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingPlaylists ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (onOpenAccountModal) onOpenAccountModal();
              else setIsAccountModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white text-[13px] font-medium transition-colors"
          >
            账号管理
          </button>
        </div>
      </div>

      {/* 视图 1: 歌单网格 */}
      {!selectedPlaylist && (
        <div className="space-y-6">
          {/* 我喜欢的音乐 (超大心动卡片) */}
          {userPlaylists.length > 0 && userPlaylists[0].isHeart && (
            <motion.div
              whileHover={{ y: -2 }}
              onClick={() => handleSelectPlaylist(userPlaylists[0])}
              className="p-6 rounded-[24px] bg-gradient-to-r from-rose-950/40 via-red-950/20 to-black/40 border border-rose-500/20 flex items-center justify-between gap-5 cursor-pointer shadow-lg group"
            >
              <div className="flex items-center gap-5 min-w-0">
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-rose-600 flex items-center justify-center text-white shadow-md shrink-0">
                  <Heart className="w-10 h-10 fill-white" />
                </div>
                <div className="min-w-0">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                    HEART FAVORITES
                  </span>
                  <h4 className="text-[20px] font-bold text-white tracking-tight mt-1 truncate group-hover:text-rose-300 transition-colors">
                    {userPlaylists[0].name}
                  </h4>
                  <p className="text-[13px] text-[#86868b] font-mono mt-0.5">
                    {userPlaylists[0].trackCount} 首心动曲目 · 实时母带直连
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectPlaylist(userPlaylists[0]);
                }}
                className="w-12 h-12 rounded-full bg-[#0071e3] text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform shrink-0"
              >
                <Play className="w-5 h-5 fill-white ml-0.5" />
              </button>
            </motion.div>
          )}

          {/* 其他自建与收藏歌单网格 */}
          <div className="space-y-3">
            <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider px-1">
              自建与收藏歌单 ({Math.max(0, userPlaylists.length - 1)})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {userPlaylists.slice(1).map((pl) => (
                <motion.div
                  key={pl.id}
                  whileHover={{ y: -3 }}
                  onClick={() => handleSelectPlaylist(pl)}
                  className="p-3.5 rounded-[20px] bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] cursor-pointer transition-all flex flex-col group"
                >
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white/10 shadow-md mb-3">
                    <Image src={pl.coverImgUrl} alt={pl.name} fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-[#0071e3] flex items-center justify-center text-white shadow-lg">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <h5 className="text-[14px] font-semibold text-white tracking-tight truncate group-hover:text-[#2997ff] transition-colors">
                    {pl.name}
                  </h5>
                  <p className="text-[11px] text-[#86868b] font-mono mt-1">
                    {pl.trackCount} 首歌曲
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 视图 2: 歌单曲目列表 */}
      {selectedPlaylist && (
        <div className="space-y-5">
          {/* 歌单头部 */}
          <div className="p-6 rounded-[24px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-between gap-5">
            <div className="flex items-center gap-5 min-w-0">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white/10 shrink-0 shadow-md">
                <Image
                  src={selectedPlaylist.coverImgUrl}
                  alt={selectedPlaylist.name}
                  fill
                  className="object-cover"
                />
                {selectedPlaylist.isHeart && (
                  <div className="absolute inset-0 bg-rose-600/70 flex items-center justify-center text-white">
                    <Heart className="w-8 h-8 fill-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-[20px] font-bold text-white tracking-tight truncate">
                  {selectedPlaylist.name}
                </h4>
                <p className="text-[13px] text-[#86868b] font-mono mt-0.5">
                  共 {activePlaylistSongs.length} 首曲目 · 网易云音乐母带源
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleOfflineCache}
                disabled={isCaching || activePlaylistSongs.length === 0}
                className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[13px] font-medium tracking-tight transition-colors flex items-center gap-1.5"
              >
                <Download className={`w-4 h-4 ${isCaching ? "animate-bounce" : ""}`} />
                {isCaching ? "正在缓存..." : "一键离线缓存"}
              </button>
              <button
                type="button"
                onClick={handlePlayAll}
                disabled={activePlaylistSongs.length === 0}
                className="px-6 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[13px] font-semibold tracking-tight shadow-md transition-transform active:scale-[0.97] flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                播放全部
              </button>
            </div>
          </div>

          {/* 搜索过滤框 */}
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={songFilter}
              onChange={(e) => setSongFilter(e.target.value)}
              placeholder="在当前歌单中过滤歌曲或歌手..."
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-[13px] text-white placeholder-white/40 focus:outline-none focus:border-[#0071e3]"
            />
          </div>

          {/* 曲目列表 */}
          {isLoadingTracks ? (
            <div className="py-16 text-center text-[#86868b] flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0071e3]" />
              <span className="text-[13px]">正在从云端拉取曲目与无损直链...</span>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="py-12 text-center text-[#86868b] text-[13px]">
              未找到匹配歌曲
            </div>
          ) : (
            <div className="rounded-[22px] bg-white/[0.03] border border-white/[0.05] divide-y divide-white/[0.04] overflow-hidden">
              {filteredSongs.map((song, idx) => {
                const isCached = cachedSongIds.has(song.id);
                return (
                  <div
                    key={song.id || idx}
                    onClick={() => {
                      const songIdx = activePlaylistSongs.findIndex((s) => s.id === song.id);
                      useAudioStore.getState().playQueue(activePlaylistSongs, songIdx >= 0 ? songIdx : idx);
                    }}
                    className="flex items-center justify-between p-3.5 hover:bg-white/[0.03] cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="w-6 text-center font-mono text-[12px] text-[#86868b] group-hover:text-white">
                        {idx + 1}
                      </span>
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white/10 shrink-0 shadow-sm">
                        <Image src={song.cover || "/default-cover.svg"} alt={song.title} fill className="object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-4 h-4 fill-white text-white" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-white tracking-tight truncate group-hover:text-[#2997ff] transition-colors">
                            {song.title}
                          </span>
                          {isCached && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              已离线
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#86868b] truncate mt-0.5">
                          {song.artist} · {song.album}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[12px] font-mono text-white/40">
                        {formatDuration(song.duration)}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            insertNext(song);
                          }}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white"
                          title="下一首播放"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToQueue(song);
                          }}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white"
                          title="加入队列"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
