"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Download, Check, Loader2, Music2, Plus } from "lucide-react";
import Image from "next/image";
import { Song } from "@/types/song";
import { SongResult } from "@/types/aiAgent";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { useUIStore } from "@/store/uiStore";

export interface SongResultCardProps {
  result: SongResult;
  onPlay?: (song: Song) => void;
  onDownload?: (song: Song) => void;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  netease: {
    label: "网易云",
    color: "bg-red-500/15 text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.15)]",
  },
  qq: {
    label: "QQ音乐",
    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]",
  },
  kugou: {
    label: "酷狗",
    color: "bg-blue-500/15 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.15)]",
  },
  kuwo: {
    label: "酷我",
    color: "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
  },
  bilibili: {
    label: "B站",
    color: "bg-pink-500/15 text-pink-300 border-pink-500/30 shadow-[0_0_10px_rgba(236,72,153,0.15)]",
  },
  local: {
    label: "本地",
    color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]",
  },
};

function formatDuration(sec?: number): string {
  if (!sec || isNaN(sec) || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const SongResultCard: React.FC<SongResultCardProps> = ({ result, onPlay, onDownload }) => {
  const { song } = result;
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const currentSong = useAudioStore((state) => state.currentSong);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const playSong = useAudioStore((state) => state.playSong);
  const addToQueue = useQueueStore((state) => state.addToQueue);
  const showToast = useUIStore((state) => state.showToast);

  const isOffline = useOfflineDownloadStore((state) =>
    typeof state.isSongOffline === "function" ? state.isSongOffline(song.id) : false
  );
  const downloadTask = useOfflineDownloadStore((state) => state.tasks[song.id]);
  const addDownload = useOfflineDownloadStore((state) => state.addDownload);

  const isThisSong = currentSong?.id === song.id;
  const isCurrentlyPlaying = isThisSong && isPlaying;

  const isDownloading =
    downloadTask?.status === "downloading" ||
    downloadTask?.status === "pending" ||
    downloadTask?.status === "transcoding";
  const isDownloaded = isOffline || downloadTask?.status === "completed";

  const sourceInfo = SOURCE_LABELS[song.source] || {
    label: song.source || "网络",
    color: "bg-white/10 text-white/70 border-white/15",
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(song);
    } else {
      playSong(song);
    }
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading || isDownloaded) return;
    if (onDownload) {
      onDownload(song);
    } else {
      addDownload(song, "lossless");
    }
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(song);
    showToast(`已将《${song.title}》加入待播清单`, "success");
  };

  const formattedTime = formatDuration(song.duration);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.012 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handlePlayClick}
      className={`group relative flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-2xl ${
        isThisSong
          ? "bg-purple-500/[0.14] border-purple-500/40 shadow-[0_8px_32px_rgba(168,85,247,0.22),inset_0_1px_0_rgba(255,255,255,0.2)]"
          : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] hover:border-white/[0.18] shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
      }`}
    >
      {/* 顶部微光反射条 */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {/* 左侧：实体微缩黑胶封套与唱片出鞘动效 */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="relative w-12 h-12 shrink-0 flex items-center">
          {/* 微缩黑胶唱片（悬停或播放时丝滑探出） */}
          <motion.div
            animate={{
              x: isHovered || isCurrentlyPlaying ? 16 : 0,
              opacity: isHovered || isCurrentlyPlaying ? 1 : 0.4,
              scale: isHovered || isCurrentlyPlaying ? 1 : 0.9,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            style={{
              position: "absolute",
              left: 2,
              width: 44,
              height: 44,
              zIndex: 0,
              boxShadow: "0 4px 14px rgba(0,0,0,0.9)",
              background:
                "radial-gradient(circle, #1a1a1a 0%, #111111 30%, #222222 31%, #0a0a0a 60%, #181818 61%, #050505 100%)",
            }}
            className="rounded-full pointer-events-none overflow-hidden flex items-center justify-center"
          >
            {/* 唱片同心折射沟槽 */}
            <div
              className={`w-full h-full rounded-full flex items-center justify-center ${
                isCurrentlyPlaying ? "animate-[spin_4s_linear_infinite]" : ""
              }`}
            >
              <div
                className="absolute inset-0.5 rounded-full opacity-35"
                style={{
                  background:
                    "repeating-radial-gradient(circle, transparent 0, transparent 2px, rgba(255,255,255,0.06) 2.5px, transparent 3px)",
                }}
              />
              <div className="w-4 h-4 rounded-full bg-[#111] border border-white/20 shadow-inner" />
            </div>
          </motion.div>

          {/* 1:1 正方形封套 (Sleeve) */}
          <div className="relative z-10 w-12 h-12 rounded-xl overflow-hidden bg-[#16161a] border border-white/15 shadow-md shrink-0 group-hover:shadow-lg transition-shadow">
            {/* 左侧书脊折光微线 */}
            <div className="absolute left-0 top-0 bottom-0 w-[1.5px] bg-gradient-to-r from-white/30 to-transparent z-20 pointer-events-none" />

            {song.cover && !imageError ? (
              <Image
                src={song.cover}
                alt={song.title}
                fill
                sizes="48px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/[0.06] text-white/40">
                <Music2 className="w-5 h-5" />
              </div>
            )}

            {/* 悬停播放 / 正在播放波浪指示器 */}
            <div
              className={`absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 z-20 ${
                isCurrentlyPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              {isCurrentlyPlaying ? (
                <div className="flex items-end gap-0.5 h-4">
                  <span className="w-1 bg-[#2997ff] rounded-full animate-[pulse_0.7s_ease-in-out_infinite]" />
                  <span className="w-1 bg-[#2997ff] rounded-full animate-[pulse_1.1s_ease-in-out_infinite]" />
                  <span className="w-1 bg-[#2997ff] rounded-full animate-[pulse_0.5s_ease-in-out_infinite]" />
                </div>
              ) : (
                <Play className="w-4 h-4 text-white fill-white ml-0.5 drop-shadow-md" />
              )}
            </div>
          </div>
        </div>

        {/* 标题 & 歌手 & 专辑 & 时长 */}
        <div className="flex-1 min-w-0 pl-1">
          <div className="flex items-center gap-2 min-w-0">
            <h4
              className={`text-[13.5px] font-semibold truncate tracking-tight ${
                isThisSong ? "text-purple-300" : "text-white group-hover:text-white"
              }`}
              title={song.title}
            >
              {song.title}
            </h4>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[9.5px] font-medium border shrink-0 backdrop-blur-md ${sourceInfo.color}`}
            >
              {sourceInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11.5px] text-white/50 truncate mt-0.5">
            <span className="truncate hover:text-white/80 transition-colors" title={song.artist}>
              {song.artist}
            </span>
            {song.album && (
              <>
                <span className="text-white/20 shrink-0">•</span>
                <span
                  className="truncate text-white/40 hover:text-white/70 transition-colors"
                  title={song.album}
                >
                  {song.album}
                </span>
              </>
            )}
            {formattedTime && (
              <>
                <span className="text-white/20 shrink-0">•</span>
                <span className="text-white/40 shrink-0 font-mono text-[10.5px]">
                  {formattedTime}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 右侧：高奢 Apple 磨砂微操作按钮组 */}
      <div className="flex items-center gap-1.5 shrink-0 z-20">
        {/* 播放 / 暂停按钮 */}
        <button
          type="button"
          onClick={handlePlayClick}
          className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-[11.5px] font-medium border backdrop-blur-md transition-all active:scale-95 shadow-sm ${
            isCurrentlyPlaying
              ? "bg-purple-500/25 text-purple-200 border-purple-500/50 hover:bg-purple-500/35 shadow-[0_0_12px_rgba(168,85,247,0.3)]"
              : "bg-white/[0.08] hover:bg-white/[0.18] text-white hover:text-white border-white/[0.12]"
          }`}
          title={isCurrentlyPlaying ? "正在播放" : "立即播放"}
        >
          {isCurrentlyPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>播放中</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span>播放</span>
            </>
          )}
        </button>

        {/* 加入待播列表按钮 */}
        <button
          type="button"
          onClick={handleAddToQueue}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.16] text-white/70 hover:text-white border border-white/[0.08] backdrop-blur-md transition-all active:scale-95"
          title="加入待播清单"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* 离线下载按钮 */}
        <button
          type="button"
          onClick={handleDownloadClick}
          disabled={isDownloading || isDownloaded}
          className={`w-8 h-8 rounded-full flex items-center justify-center border backdrop-blur-md transition-all active:scale-95 ${
            isDownloaded
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 cursor-default"
              : isDownloading
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 cursor-wait"
                : "bg-white/[0.06] hover:bg-white/[0.16] text-white/70 hover:text-white border-white/[0.08]"
          }`}
          title={
            isDownloaded
              ? "已下载至离线曲库"
              : isDownloading
                ? `下载中 (${downloadTask?.progress || 0}%)`
                : "加入离线下载"
          }
        >
          {isDownloaded ? (
            <Check className="w-3.5 h-3.5" />
          ) : isDownloading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </motion.div>
  );
};

