"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Download, Check, Loader2, Music2 } from "lucide-react";
import Image from "next/image";
import { Song } from "@/types/song";
import { SongResult } from "@/types/aiAgent";
import { useAudioStore } from "@/store/audioStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";

export interface SongResultCardProps {
  result: SongResult;
  onPlay?: (song: Song) => void;
  onDownload?: (song: Song) => void;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  netease: { label: "网易云", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  qq: { label: "QQ音乐", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  kugou: { label: "酷狗", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  kuwo: { label: "酷我", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  bilibili: { label: "B站", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  local: { label: "本地", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
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

  const currentSong = useAudioStore((state) => state.currentSong);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const playSong = useAudioStore((state) => state.playSong);

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

  const formattedTime = formatDuration(song.duration);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={`group relative flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl border transition-all duration-300 ${
        isThisSong
          ? "bg-purple-500/[0.12] border-purple-500/30 shadow-[0_4px_20px_rgba(168,85,247,0.15)]"
          : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] hover:border-white/[0.15]"
      }`}
    >
      {/* 左侧：封面与歌曲信息 */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* 封面 */}
        <div
          onClick={handlePlayClick}
          className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 cursor-pointer group/cover"
        >
          {song.cover && !imageError ? (
            <Image
              src={song.cover}
              alt={song.title}
              fill
              sizes="48px"
              className="object-cover transition-transform duration-300 group-hover/cover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/[0.06] text-white/40">
              <Music2 className="w-5 h-5" />
            </div>
          )}

          {/* 播放悬浮高亮 / 正在播放波浪遮罩 */}
          <div
            className={`absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
              isCurrentlyPlaying ? "opacity-100" : "opacity-0 group-hover/cover:opacity-100"
            }`}
          >
            {isCurrentlyPlaying ? (
              <div className="flex items-end gap-0.5 h-3.5">
                <span className="w-0.5 h-full bg-cyan-400 animate-pulse" />
                <span className="w-0.5 h-2/3 bg-purple-400 animate-bounce" />
                <span className="w-0.5 h-4/5 bg-cyan-300 animate-pulse delay-75" />
              </div>
            ) : (
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            )}
          </div>
        </div>

        {/* 标题 & 歌手 & 专辑 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h4
              className={`text-[13px] sm:text-[14px] font-semibold truncate tracking-tight ${
                isThisSong ? "text-purple-300" : "text-white group-hover:text-white"
              }`}
              title={song.title}
            >
              {song.title}
            </h4>
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-medium border shrink-0 ${sourceInfo.color}`}
            >
              {sourceInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] sm:text-[12px] text-white/50 truncate mt-0.5">
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
                <span className="text-white/40 shrink-0">{formattedTime}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 右侧：操作按钮组 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* 播放 / 暂停按钮 */}
        <button
          type="button"
          onClick={handlePlayClick}
          className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[11.5px] font-medium border transition-all active:scale-95 ${
            isCurrentlyPlaying
              ? "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30"
              : "bg-white/[0.08] hover:bg-white/[0.15] text-white/90 hover:text-white border-white/10"
          }`}
          title={isCurrentlyPlaying ? "正在播放" : "立即播放"}
        >
          {isCurrentlyPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">播放中</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span className="hidden sm:inline">播放</span>
            </>
          )}
        </button>

        {/* 离线下载按钮 */}
        <button
          type="button"
          onClick={handleDownloadClick}
          disabled={isDownloading || isDownloaded}
          className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all active:scale-95 ${
            isDownloaded
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 cursor-default"
              : isDownloading
                ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 cursor-wait"
                : "bg-white/[0.08] hover:bg-white/[0.15] text-white/80 hover:text-white border-white/10"
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
