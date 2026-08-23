"use client";

import React, { useState, useEffect } from "react";
import { usePlaylistStore } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { Playlist, Song } from "@/types/song";
import {
  FolderHeart,
  Plus,
  Play,
  Download,
  Trash2,
  Search,
  CheckSquare,
  Square,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";

const STORAGE_KEY = "vibe_custom_playlists_v1";

export const PlaylistHubTab: React.FC = () => {
  const { songs: librarySongs } = usePlaylistStore();
  const { playSong } = useAudioStore();
  const { addBatchDownloads, isSongOffline } = useOfflineDownloadStore();

  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return [
      {
        id: "default-favorites",
        title: "全部曲库 (默认)",
        cover: "/default-cover.svg",
        songs: librarySongs,
        createdAt: Date.now(),
      },
    ];
  });

  const [activePlaylistId, setActivePlaylistId] = useState<string>(
    playlists[0]?.id || "default-favorites"
  );
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // 挂载时重新同步 localStorage 最新的歌单列表
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPlaylists(parsed);
          setActivePlaylistId((prev) => (parsed.some((p: Playlist) => p.id === prev) ? prev : parsed[0].id));
        }
      }
    } catch {}
  }, []);

  // Sync library songs into default playlist if empty
  useEffect(() => {
    if (playlists.length === 1 && playlists[0].id === "default-favorites" && playlists[0].songs.length === 0 && librarySongs.length > 0) {
      setPlaylists([
        {
          id: "default-favorites",
          title: "全部曲库 (默认)",
          cover: librarySongs[0]?.cover || "/default-cover.svg",
          songs: librarySongs,
          createdAt: Date.now(),
        },
      ]);
    }
  }, [librarySongs, playlists]);

  // Persist playlists to localStorage
  const savePlaylists = (newLists: Playlist[]) => {
    setPlaylists(newLists);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLists));
    } catch {
      // Ignore
    }
  };

  const createPlaylist = (name: string) => {
    const newPl: Playlist = {
      id: `pl-${Date.now()}`,
      title: name,
      cover: "/default-cover.svg",
      songs: [],
      createdAt: Date.now(),
    };
    const next = [...playlists, newPl];
    savePlaylists(next);
    setActivePlaylistId(newPl.id);
  };

  const deletePlaylist = (id: string) => {
    const next = playlists.filter((p: Playlist) => p.id !== id);
    savePlaylists(next);
    if (activePlaylistId === id && next.length > 0) {
      setActivePlaylistId(next[0].id);
    }
  };

  const removeSongFromPlaylist = (playlistId: string, songId: string) => {
    const next = playlists.map((p: Playlist) => {
      if (p.id !== playlistId) return p;
      return {
        ...p,
        songs: p.songs.filter((s: Song) => s.id !== songId),
      };
    });
    savePlaylists(next);
  };

  const activePlaylist = playlists.find((p: Playlist) => p.id === activePlaylistId) || playlists[0];
  const playlistSongs: Song[] = activePlaylist?.songs || [];

  const filteredSongs = playlistSongs.filter((s: Song) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.artist && s.artist.toLowerCase().includes(q)) ||
      (s.album && s.album.toLowerCase().includes(q))
    );
  });

  const handleCreate = () => {
    if (!newPlaylistName.trim()) return;
    createPlaylist(newPlaylistName.trim());
    setNewPlaylistName("");
    setShowCreateModal(false);
    setActionFeedback("✅ 成功创建新歌单！");
    setTimeout(() => setActionFeedback(null), 2500);
  };

  const handleToggleSelectAll = () => {
    if (selectedSongIds.size === filteredSongs.length) {
      setSelectedSongIds(new Set());
    } else {
      setSelectedSongIds(new Set(filteredSongs.map((s: Song) => String(s.id))));
    }
  };

  const handleToggleSelectSong = (id: string) => {
    const next = new Set(selectedSongIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSongIds(next);
  };

  const handleBatchDownload = () => {
    const targetSongs = filteredSongs.filter((s: Song) => selectedSongIds.has(String(s.id)));
    if (targetSongs.length === 0) return;
    addBatchDownloads(targetSongs);
    setActionFeedback(`🚀 已将选中的 ${targetSongs.length} 首歌曲加入离线下载队列！`);
    setSelectedSongIds(new Set());
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // Export Playlist formats
  const handleExportM3U = () => {
    if (!activePlaylist) return;
    let content = "#EXTM3U\n";
    activePlaylist.songs.forEach((s: Song) => {
      content += `#EXTINF:${Math.round(s.duration || 0)},${s.artist} - ${s.title}\n`;
      content += `${s.audioUrl || ""}\n`;
    });

    const blob = new Blob([content], { type: "audio/x-mpegurl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activePlaylist.title || "playlist"}.m3u8`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setActionFeedback("✅ 成功导出 M3U8 播放列表文件！");
    setTimeout(() => setActionFeedback(null), 2500);
  };

  const handleExportCSV = () => {
    if (!activePlaylist) return;
    let csv = "序号,歌曲名,歌手,专辑,时长(秒),音源平台\n";
    activePlaylist.songs.forEach((s: Song, i: number) => {
      csv += `${i + 1},"${(s.title || "").replace(/"/g, '""')}","${(s.artist || "").replace(/"/g, '""')}","${(s.album || "").replace(/"/g, '""')}",${Math.round(s.duration || 0)},"${s.source || "online"}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activePlaylist.title || "playlist"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setActionFeedback("✅ 成功导出 CSV 歌单清单！");
    setTimeout(() => setActionFeedback(null), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* 顶部标题与新建歌单 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            歌单编排与管理中枢
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
              PLAYLIST HUB
            </span>
          </h3>
          <p className="text-xs text-white/50 mt-0.5">
            统一编排自建歌单、云端同步歌单与智能规则过滤，支持批量去重与多格式导出
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold border border-purple-500/30 transition-all active:scale-95 cursor-pointer shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>新建自建歌单</span>
        </button>
      </div>

      {actionFeedback && (
        <div className="p-3 rounded-2xl bg-white/10 border border-white/20 text-xs text-white text-center font-medium backdrop-blur-xl animate-fade-in">
          {actionFeedback}
        </div>
      )}

      {/* 歌单管理主区域 (左侧歌单选择器 + 右侧歌单曲目明细) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧歌单列表 (4 栅格) */}
        <div className="lg:col-span-4 p-4 rounded-3xl bg-white/[0.04] border border-white/[0.12] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] space-y-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-bold text-white/70">所有歌单 ({playlists.length})</span>
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {playlists.map((pl: Playlist) => {
              const isActive = pl.id === activePlaylistId;
              const count = pl.songs ? pl.songs.length : 0;

              return (
                <div
                  key={pl.id}
                  onClick={() => {
                    setActivePlaylistId(pl.id);
                    setSelectedSongIds(new Set());
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer group ${
                    isActive
                      ? "bg-white/15 border-white/30 text-white shadow-sm ring-1 ring-white/20"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.06] text-white/70 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 border border-white/15 shrink-0">
                      <img
                        src={pl.cover || "/default-cover.svg"}
                        alt={pl.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate leading-tight">
                        {pl.title || "未命名歌单"}
                      </p>
                      <p className="text-[10px] text-white/40 truncate mt-0.5">
                        {count} 首曲目
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {pl.id !== "default-favorites" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePlaylist(pl.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-white/40 hover:text-rose-300 transition-colors"
                        title="删除歌单"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧歌单曲目明细 (8 栅格) */}
        <div className="lg:col-span-8 p-5 rounded-3xl bg-white/[0.04] border border-white/[0.12] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] space-y-4">
          {activePlaylist ? (
            <>
              {/* 歌单头部信息与快捷工具条 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/10 border border-white/20 shrink-0 shadow-lg">
                    <img
                      src={activePlaylist.cover || "/default-cover.svg"}
                      alt={activePlaylist.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-base font-bold text-white leading-tight truncate">
                      {activePlaylist.title}
                    </h4>
                    <p className="text-xs text-white/45 truncate mt-1">
                      共 {playlistSongs.length} 首歌曲 · 支持多选与全量离线缓存
                    </p>
                  </div>
                </div>

                {/* 歌单全局操作按钮 */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (playlistSongs.length > 0) playSong(playlistSongs[0]);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-white/90 transition-all active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>播放全部</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (playlistSongs.length > 0) {
                        addBatchDownloads(playlistSongs);
                        setActionFeedback(`🚀 正在批量下载整张歌单 (${playlistSongs.length} 首)...`);
                        setTimeout(() => setActionFeedback(null), 3000);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                    title="整单批量离线下载"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>整单离线</span>
                  </button>

                  {/* 导出菜单 */}
                  <button
                    type="button"
                    onClick={handleExportM3U}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 transition-all cursor-pointer"
                    title="导出 M3U8 播放列表"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 transition-all cursor-pointer"
                    title="导出 CSV 歌曲清单"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 搜索与多选工具条 */}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white font-medium transition-colors cursor-pointer"
                >
                  {selectedSongIds.size === filteredSongs.length && filteredSongs.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-purple-400" />
                  ) : (
                    <Square className="w-4 h-4 text-white/40" />
                  )}
                  <span>全选 ({selectedSongIds.size}/{filteredSongs.length})</span>
                </button>

                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-white/40 absolute left-3" />
                  <input
                    type="text"
                    placeholder="在歌单内快速过滤..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 sm:w-56 bg-white/10 border border-white/15 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400/50 shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)] transition-all"
                  />
                </div>
              </div>

              {/* 曲目列表 */}
              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                {filteredSongs.length > 0 ? (
                  filteredSongs.map((song: Song, idx: number) => {
                    const isSelected = selectedSongIds.has(String(song.id));
                    const isOffline = isSongOffline(song.id);

                    return (
                      <div
                        key={song.id || idx}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                          isSelected
                            ? "bg-purple-500/15 border-purple-500/30"
                            : "bg-white/[0.03] hover:bg-white/[0.06] border-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectSong(String(song.id))}
                            className="cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-purple-400" />
                            ) : (
                              <Square className="w-4 h-4 text-white/30" />
                            )}
                          </button>

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
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                                  已离线
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-white/45 truncate mt-0.5">
                              {song.artist} · {song.album || "Unknown Album"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => playSong(song)}
                            className="p-1.5 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                            title="试听"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>

                          <button
                            type="button"
                            onClick={() => removeSongFromPlaylist(activePlaylist.id, song.id)}
                            className="p-1.5 rounded-xl hover:bg-rose-500/20 text-white/30 hover:text-rose-300 transition-colors cursor-pointer"
                            title="从歌单移除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-white/40 text-xs">
                    歌单内暂无曲目，可从「云端曲库」或「本地音乐」添加歌曲。
                  </div>
                )}
              </div>

              {/* 浮动批量操作 Dock (当选中曲目时出现) */}
              {selectedSongIds.size > 0 && (
                <div className="p-3 rounded-2xl bg-purple-950/80 border border-purple-500/30 backdrop-blur-2xl flex items-center justify-between gap-3 shadow-xl animate-fade-in">
                  <span className="text-xs text-white font-medium">
                    已选中 <strong className="text-purple-300">{selectedSongIds.size}</strong> 首歌曲
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBatchDownload}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 transition-all active:scale-95 cursor-pointer shadow-md"
                    >
                      批量离线下载
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedSongIds(new Set())}
                      className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-xs transition-all cursor-pointer"
                    >
                      取消选择
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-white/40 text-xs">
              请在左侧选择或新建一个歌单开始管理。
            </div>
          )}
        </div>
      </div>

      {/* 新建歌单 Modal 弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-[#12121a] border border-white/20 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-400" />
              创建新自建歌单
            </h4>

            <input
              type="text"
              placeholder="请输入歌单标题（如：夜间散步精选）..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs transition-all active:scale-95"
              >
                立即创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
