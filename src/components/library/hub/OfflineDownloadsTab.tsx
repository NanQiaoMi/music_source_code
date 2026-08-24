"use client";

import React, { useState, useEffect } from "react";
import {
  useOfflineDownloadStore,
  DownloadTask,
} from "@/store/useOfflineDownloadStore";
import { useAudioStore } from "@/store/audioStore";
import { formatStorageBytes } from "@/store/useStorageAnalyticsStore";
import {
  Download,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  RotateCw,
  FolderDown,
  Pin,
  Sparkles,
  Sliders,
  XCircle,
  Search,
  FileAudio,
} from "lucide-react";
import { Song } from "@/types/song";

export const OfflineDownloadsTab: React.FC = () => {
  const {
    tasks,
    activeCount,
    concurrencyLimit,
    totalSpeedFormatted,
    offlineRecords,
    isLoadingRecords,
    setConcurrency,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    pauseAll,
    resumeAll,
    clearCompleted,
    clearAllTasks,
    clearFailedOrPausedTasks,
    loadOfflineRecords,
    deleteOfflineSong,
    clearAllOffline,
    togglePinSong,
    exportSongAsFile,
  } = useOfflineDownloadStore();

  const { playSong } = useAudioStore();
  const [offlineSearch, setOfflineSearch] = useState("");
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadOfflineRecords();
  }, [loadOfflineRecords]);

  const taskList = Object.values(tasks).sort((a, b) => b.addedAt - a.addedAt);
  const activeTasks = taskList.filter((t) => t.status === "downloading" || t.status === "pending" || t.status === "paused" || t.status === "error");

  const filteredOffline = offlineRecords.filter((rec) => {
    if (!offlineSearch) return true;
    const q = offlineSearch.toLowerCase();
    return (
      (rec.title && rec.title.toLowerCase().includes(q)) ||
      (rec.artist && rec.artist.toLowerCase().includes(q)) ||
      (rec.album && rec.album.toLowerCase().includes(q))
    );
  });

  const handleExport = async (song: Song) => {
    setExportFeedback(`正在导出「${song.title}」至系统本地文件...`);
    const ok = await exportSongAsFile(song);
    if (ok) {
      setExportFeedback(`✅ 成功导出「${song.title}」！`);
    } else {
      setExportFeedback(`❌ 导出失败，请检查文件权限。`);
    }
    setTimeout(() => setExportFeedback(null), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* 顶部下载控制台与速度仪表 */}
      <div className="p-5 rounded-3xl bg-white/[0.04] border border-white/[0.12] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] shrink-0">
            <Download className={`w-6 h-6 ${activeCount > 0 ? "animate-bounce" : ""}`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                离线下载调度中枢
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
                {activeCount > 0 ? `下载中 ${activeCount}` : "就绪空闲"}
              </span>
            </div>
            <p className="text-xs text-white/50 font-mono mt-0.5 flex items-center gap-2">
              <span>当前瞬时速率: <strong className="text-cyan-300">{totalSpeedFormatted}</strong></span>
              <span>·</span>
              <span>队列中: {taskList.length} 个任务</span>
            </p>
          </div>
        </div>

        {/* 快捷批量控制按钮组与并发调节 */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 并发数调节 */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-black/40 border border-white/10 text-xs text-white">
            <Sliders className="w-3.5 h-3.5 text-white/50" />
            <span className="text-white/60 text-[11px]">并发:</span>
            <select
              value={concurrencyLimit}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="bg-transparent text-cyan-300 font-bold font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="1" className="bg-[#12121a] text-white">1 线程</option>
              <option value="2" className="bg-[#12121a] text-white">2 线程</option>
              <option value="3" className="bg-[#12121a] text-white">3 线程</option>
              <option value="4" className="bg-[#12121a] text-white">4 线程</option>
              <option value="5" className="bg-[#12121a] text-white">5 线程</option>
            </select>
          </div>

          <button
            type="button"
            onClick={resumeAll}
            className="px-3 py-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-white text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer"
          >
            全部开始
          </button>

          <button
            type="button"
            onClick={pauseAll}
            className="px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 transition-all active:scale-95 cursor-pointer"
          >
            全部暂停
          </button>

          <button
            type="button"
            onClick={clearCompleted}
            className="px-3 py-1.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium border border-white/10 transition-all active:scale-95 cursor-pointer"
            title="移除所有已下载完成的任务"
          >
            清空完成项
          </button>

          <button
            type="button"
            onClick={clearFailedOrPausedTasks}
            className="px-3 py-1.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            title="移除所有暂停与失败的任务"
          >
            清空暂停/失败
          </button>

          <button
            type="button"
            onClick={clearAllTasks}
            className="px-3 py-1.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
            title="强制取消并清空整个下载队列"
          >
            清空全部任务
          </button>
        </div>
      </div>

      {exportFeedback && (
        <div className="p-3 rounded-2xl bg-white/10 border border-white/20 text-xs text-white text-center font-medium backdrop-blur-xl animate-fade-in">
          {exportFeedback}
        </div>
      )}

      {/* 模块 1: 正在下载队列 (Active / Pending Tasks) */}
      {taskList.length > 0 && (
        <div className="p-5 rounded-3xl bg-white/[0.04] border border-white/[0.12] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
              <Download className="w-4 h-4 text-cyan-400" />
              下载任务队列 ({taskList.length} 个任务，其中 {activeCount} 个正在传输)
            </h4>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearAllTasks}
                className="px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-semibold border border-rose-500/20 transition-all active:scale-95 cursor-pointer"
              >
                一键清空全部
              </button>
            </div>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
            {activeTasks.map((t) => {
              const isDownloading = t.status === "downloading";
              const isPaused = t.status === "paused";
              const isError = t.status === "error";

              return (
                <div
                  key={t.id}
                  className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/10 border border-white/10 shrink-0">
                        <img
                          src={t.song.cover || "/default-cover.svg"}
                          alt={t.song.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate leading-tight flex items-center gap-1.5">
                          {t.song.title}
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                            {t.quality === "lossless" ? "FLAC 无损" : "320K"}
                          </span>
                        </p>
                        <p className="text-[11px] text-white/45 truncate mt-0.5">
                          {t.song.artist} · {t.speedFormatted}
                        </p>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDownloading ? (
                        <button
                          type="button"
                          onClick={() => pauseDownload(t.id)}
                          className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                          title="暂停"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => resumeDownload(t.id)}
                          className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                          title="开始/重试"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => cancelDownload(t.id)}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/50 hover:text-rose-300 transition-all cursor-pointer"
                        title="取消任务"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isError
                          ? "bg-rose-500"
                          : isPaused
                          ? "bg-amber-400"
                          : "bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(56,189,248,0.6)]"
                      }`}
                      style={{ width: `${t.progress}%` }}
                    />
                  </div>

                  {isError && t.error && (
                    <p className="text-[10px] text-rose-400 font-mono truncate">
                      错误: {t.error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 模块 2: 已离线本地曲库管理器 (Downloaded Songs & Storage Manager) */}
      <div className="p-5 rounded-3xl bg-white/[0.04] border border-white/[0.12] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white tracking-tight">
              已离线缓存曲库 ({offlineRecords.length} 首 · 纯离线秒播)
            </h4>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3" />
              <input
                type="text"
                placeholder="搜索已离线歌曲..."
                value={offlineSearch}
                onChange={(e) => setOfflineSearch(e.target.value)}
                className="w-full sm:w-52 bg-white/10 border border-white/15 rounded-2xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-400/50 shadow-[inset_0_1px_1px_rgba(0,0,0,0.3)] transition-all"
              />
            </div>

            <button
              type="button"
              onClick={clearAllOffline}
              className="px-3 py-1.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-all active:scale-95 cursor-pointer shrink-0"
            >
              清空离线
            </button>
          </div>
        </div>

        {/* 已离线列表 */}
        {filteredOffline.length > 0 ? (
          <div className="max-h-96 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
            {filteredOffline.map((record, idx) => {
              const songItem: Song = {
                id: record.songId,
                title: record.title,
                artist: record.artist,
                album: record.album,
                duration: record.duration,
                cover: record.cover,
                lyrics: record.lyrics,
                translationLyrics: record.translationLyrics,
                audioUrl: `offline://${record.songId}`,
                source: (record.source as any) || "offline",
              };

              return (
                <div
                  key={record.songId || idx}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/15 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-white/30 w-5 text-right shrink-0">
                      {idx + 1}
                    </span>
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0">
                      <img
                        src={record.cover || "/default-cover.svg"}
                        alt={record.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate leading-tight flex items-center gap-1.5">
                        {record.title}
                        {record.isPinned && (
                          <Pin className="w-3 h-3 text-cyan-400 fill-cyan-400 shrink-0" />
                        )}
                      </p>
                      <p className="text-[11px] text-white/45 truncate mt-0.5 font-mono">
                        {record.artist} · {formatStorageBytes(record.fileSize)} · {record.quality.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePinSong(record.songId)}
                      className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                        record.isPinned
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                          : "bg-white/5 hover:bg-white/15 text-white/40 hover:text-white border-white/10"
                      }`}
                      title={record.isPinned ? "已锁定 (防自动清理)" : "锁定此歌曲"}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExport(songItem)}
                      className="p-1.5 rounded-xl bg-white/10 hover:bg-cyan-500 hover:text-black text-white/80 transition-all active:scale-95 cursor-pointer shadow-sm"
                      title="导出为本地文件 (.flac / .mp3)"
                    >
                      <FolderDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => playSong(songItem)}
                      className="p-1.5 rounded-xl bg-white/10 hover:bg-white hover:text-black text-white/80 transition-all active:scale-95 cursor-pointer shadow-sm"
                      title="离线秒播"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteOfflineSong(record.songId)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-300 transition-all cursor-pointer"
                      title="删除离线缓存"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-white/40 text-xs">
            {isLoadingRecords ? "正在加载离线曲库..." : "暂无已下载离线的歌曲，在云端歌单或单曲中点击「离线下载」即可高速存入本地。"}
          </div>
        )}
      </div>
    </div>
  );
};
