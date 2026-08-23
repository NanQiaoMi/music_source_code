"use client";

import React, { useState } from "react";
import { useUserAccountStore } from "@/store/userAccountStore";
import { useSourceConfigStore } from "@/store/sourceConfigStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { useAudioStore } from "@/store/audioStore";
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  Download,
  Play,
  QrCode,
  KeyRound,
  ExternalLink,
  Music2,
  FolderHeart,
  Search,
  Sparkles,
} from "lucide-react";
import { Song } from "@/types/song";
import { PlaylistDetailDrawer, DrawerPlaylistInfo } from "./PlaylistDetailDrawer";

export const CloudAssetsTab: React.FC = () => {
  const {
    neteaseUser,
    qqUser,
    kugouUser,
    qishuiUser,
    userPlaylists,
    fetchUserPlaylists,
    fetchPlaylistTracks,
    fetchAllPlaylistTracks,
  } = useUserAccountStore();
  const { openManagementModal } = useSourceConfigStore();
  const { songs } = usePlaylistStore();
  const { addBatchDownloads, addDownload, isSongOffline } = useOfflineDownloadStore();
  const { playSong, playQueue } = useAudioStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const [selectedDrawerPlaylist, setSelectedDrawerPlaylist] = useState<DrawerPlaylistInfo | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleOpenPlaylistDetail = (pl: any) => {
    setSelectedDrawerPlaylist({
      id: String(pl.id),
      name: pl.name || "云端歌单",
      coverImgUrl: pl.coverImgUrl || "/default-cover.svg",
      creatorName: pl.source === "netease" ? "网易云音乐" : pl.source === "qq" ? "QQ音乐" : "云端资产",
      playCount: pl.playCount || 0,
      trackCount: pl.trackCount || 0,
      source: pl.source || "netease",
      description: pl.description || "多平台已授权同步云歌单",
    });
    setIsDrawerOpen(true);
  };

  const platforms = [
    {
      id: "netease",
      name: "网易云音乐",
      user: neteaseUser,
      color: "from-red-500/20 to-rose-600/10",
      border: "border-red-500/25",
      badgeColor: "bg-red-500/20 text-red-300 border-red-500/30",
      accent: "#ef4444",
    },
    {
      id: "qq",
      name: "QQ音乐",
      user: qqUser,
      color: "from-emerald-500/20 to-green-600/10",
      border: "border-emerald-500/25",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      accent: "#10b981",
    },
    {
      id: "kugou",
      name: "酷狗音乐",
      user: kugouUser,
      color: "from-cyan-500/20 to-blue-600/10",
      border: "border-cyan-500/25",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
      accent: "#06b6d4",
    },
    {
      id: "qishui",
      name: "汽水音乐",
      user: qishuiUser,
      color: "from-sky-500/20 to-indigo-600/10",
      border: "border-sky-500/25",
      badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
      accent: "#38bdf8",
    },
  ];

  const handleSyncAllCloud = async () => {
    setIsSyncing(true);
    setSyncFeedback("正在从已登录云端平台拉取最新歌单与曲库...");
    try {
      if (fetchUserPlaylists) {
        await fetchUserPlaylists();
      }
      setSyncFeedback("✅ 全平台云端曲库资产同步完成！");
      setTimeout(() => setSyncFeedback(null), 3500);
    } catch {
      setSyncFeedback("⚠️ 部分平台同步超时，已保留本地缓存。");
      setTimeout(() => setSyncFeedback(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter songs
  const filteredSongs = songs.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.artist && s.artist.toLowerCase().includes(q)) ||
      (s.album && s.album.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* 顶部标题与多平台同步控制 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            多平台云端曲库与账号资产
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              CLOUD SYNC
            </span>
          </h3>
          <p className="text-xs text-white/50 mt-0.5">
            聚合网易云、QQ音乐、酷狗、汽水等账号的自建歌单、红心收藏与每日推荐
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSyncAllCloud}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-emerald-400" : ""}`} />
            <span>{isSyncing ? "全量同步中..." : "一键同步全部云端歌单"}</span>
          </button>

          <button
            type="button"
            onClick={() => openManagementModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>账号与鉴权管理</span>
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div className="p-3 rounded-2xl bg-white/10 border border-white/20 text-xs text-white text-center font-medium backdrop-blur-xl animate-fade-in">
          {syncFeedback}
        </div>
      )}

      {/* 4 大平台账号卡片 Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {platforms.map((p) => {
          const isAuthed = Boolean(p.user && (p.user.nickname || p.user.userId));
          return (
            <div
              key={p.id}
              className={`p-4 rounded-3xl bg-gradient-to-br ${p.color} border ${p.border} backdrop-blur-3xl shadow-[0_12px_32px_rgba(0,0,0,0.6)] flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: p.accent }}
                  />
                  <span className="text-xs font-bold text-white tracking-tight">
                    {p.name}
                  </span>
                </div>

                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                  isAuthed ? p.badgeColor : "bg-white/5 text-white/40 border-white/10"
                }`}>
                  {isAuthed ? "已连接" : "未登录"}
                </span>
              </div>

              {isAuthed ? (
                <div className="flex items-center gap-3 my-1">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/20 shrink-0">
                    <img
                      src={p.user?.avatarUrl || "/default-cover.svg"}
                      alt={p.user?.nickname || "Avatar"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate leading-tight">
                      {p.user?.nickname || "已登录用户"}
                    </p>
                    <p className="text-[10px] text-white/50 truncate font-mono mt-0.5">
                      {p.user?.vipType ? "VIP 会员" : "普通用户"} · ID: {p.user?.userId || "Active"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-2.5 text-center text-white/40 text-[11px]">
                  未配置 Cookie 或扫码凭证
                </div>
              )}

              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => openManagementModal()}
                  className="text-[11px] text-white/70 hover:text-white flex items-center gap-1 font-medium transition-colors cursor-pointer"
                >
                  <QrCode className="w-3 h-3 text-white/50" />
                  <span>{isAuthed ? "账号设置" : "立即扫码/登录"}</span>
                </button>

                {isAuthed && (
                  <button
                    type="button"
                    onClick={handleSyncAllCloud}
                    className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-all cursor-pointer"
                    title="刷新该平台歌单"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 云端歌单与合辑 Grid */}
      <div className="p-5 rounded-3xl bg-white/[0.04] border border-white/[0.12] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderHeart className="w-4 h-4 text-pink-400" />
            <h4 className="text-xs font-bold text-white tracking-tight">
              云端歌单资产库 ({userPlaylists.length} 个歌单)
            </h4>
          </div>
          <span className="text-[10px] text-white/40">
            支持一键整单下载缓存至本地
          </span>
        </div>

        {userPlaylists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {userPlaylists.map((pl) => {
              const count = pl.trackCount || 0;
              return (
                <div
                  key={pl.id}
                  onClick={() => handleOpenPlaylistDetail(pl)}
                  className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-400/40 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-md hover:shadow-cyan-500/10 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-white/10 border border-white/15 shrink-0 shadow-md">
                      <img
                        src={pl.coverImgUrl || "/default-cover.svg"}
                        alt={pl.name || "Playlist"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate leading-tight group-hover:text-cyan-300 transition-colors">
                        {pl.name || "未命名歌单"}
                      </p>
                      <p className="text-[11px] text-white/40 truncate mt-0.5">
                        {count} 首曲目 · {pl.source.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setSyncFeedback(`⏳ 正在拉取「${pl.name}」全部曲目详情...`);
                        let tracks = await fetchAllPlaylistTracks(pl.id, pl.source);
                        if (!tracks || tracks.length === 0) {
                          const res = await fetch(`/api/playlist/tracks?id=${encodeURIComponent(pl.id)}&limit=500`);
                          if (res.ok) {
                            const d = await res.json();
                            tracks = d.songs || [];
                          }
                        }
                        if (tracks && tracks.length > 0) {
                          addBatchDownloads(tracks);
                          setSyncFeedback(`🚀 已将「${pl.name}」全部 ${tracks.length} 首歌曲加入离线下载队列！`);
                          setTimeout(() => setSyncFeedback(null), 3500);
                        }
                      }}
                      className="p-1.5 rounded-xl bg-white/10 hover:bg-cyan-500 hover:text-black text-white/80 transition-all active:scale-95 cursor-pointer shadow-sm"
                      title="一键将整张歌单全部离线下载"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setSyncFeedback(`⏳ 正在准备播放「${pl.name}」...`);
                        let tracks = await fetchAllPlaylistTracks(pl.id, pl.source);
                        if (!tracks || tracks.length === 0) {
                          const res = await fetch(`/api/playlist/tracks?id=${encodeURIComponent(pl.id)}&limit=500`);
                          if (res.ok) {
                            const d = await res.json();
                            tracks = d.songs || [];
                          }
                        }
                        if (tracks && tracks.length > 0) {
                          playQueue(tracks, 0);
                          setSyncFeedback(`▶ 开始播放歌单《${pl.name}》(${tracks.length}首)`);
                          setTimeout(() => setSyncFeedback(null), 3000);
                        }
                      }}
                      className="p-1.5 rounded-xl bg-white/10 hover:bg-white hover:text-black text-white/80 transition-all active:scale-95 cursor-pointer shadow-sm"
                      title="播放此歌单整单"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center text-white/40 text-xs">
            暂无已同步的云端歌单，点击上方「账号与鉴权管理」登录网易云/QQ音乐即可一键拉取。
          </div>
        )}
      </div>

      {/* 跨平台曲目聚合检索与单曲下载 */}
      <div className="p-5 rounded-3xl bg-white/[0.04] border border-white/[0.12] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Music2 className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white tracking-tight">
              全网曲目检索与单曲离线中枢 ({filteredSongs.length} 首)
            </h4>
          </div>

          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3" />
            <input
              type="text"
              placeholder="快速检索云端歌曲、歌手、专辑..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 bg-white/10 border border-white/15 rounded-2xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-400/50 shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)] transition-all"
            />
          </div>
        </div>

        {/* 歌曲列表 */}
        <div className="max-h-80 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
          {filteredSongs.slice(0, 1000).map((song, idx) => {
            const isOffline = isSongOffline(song.id);
            return (
              <div
                key={song.id || idx}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/15 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-white/30 w-5 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0">
                    <img
                      src={song.cover || "/default-cover.svg"}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate leading-tight flex items-center gap-1.5">
                      {song.title}
                      {isOffline && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                          已离线
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-white/45 truncate mt-0.5">
                      {song.artist} · {song.album || "Cloud Master"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => addDownload(song, "lossless")}
                    disabled={isOffline}
                    className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                      isOffline
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 opacity-60 cursor-default"
                        : "bg-white/10 hover:bg-cyan-500 hover:text-black border-white/15 text-white"
                    }`}
                  >
                    <Download className="w-3 h-3" />
                    <span>{isOffline ? "已缓存" : "离线下载"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => playSong(song)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white hover:text-black text-white/80 transition-all active:scale-95 cursor-pointer shadow-sm"
                    title="立即试听"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 歌单曲目详情与选歌/全量播放抽屉 (Playlist Detail Drawer) ── */}
      <PlaylistDetailDrawer
        isOpen={isDrawerOpen}
        playlist={selectedDrawerPlaylist}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
};
