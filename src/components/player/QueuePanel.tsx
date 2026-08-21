/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListMusic,
  Box,
  X,
  Play,
  Trash2,
  Volume2,
  Sparkles,
  Search,
  Disc3,
  CornerDownRight,
  Music2,
  Clock,
} from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { useUIStore } from "@/store/uiStore";
import { formatTime } from "@/utils/formatTime";
import Image from "next/image";

const DEFAULT_COVER_SRC = "/default-cover.svg";

// Apple Vision Pro spring physics
const DRAWER_SPRING = {
  type: "spring" as const,
  stiffness: 380,
  damping: 34,
  mass: 0.85,
};

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ isOpen, onClose }) => {
  const { queue, currentIndex, removeFromQueue, clearQueue, moveToNext } = useQueueStore();
  const { currentSong, isPlaying } = useAudioStore();
  const openPanel = useUIStore((state) => state.openPanel);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  // Global ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Auto-scroll current song into view when opening
  useEffect(() => {
    if (isOpen && activeItemRef.current && typeof activeItemRef.current.scrollIntoView === "function") {
      activeItemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isOpen, currentIndex]);

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    if (!searchQuery.trim()) {
      return queue.map((song, index) => ({ song, originalIndex: index }));
    }
    const q = searchQuery.toLowerCase();
    return queue
      .map((song, index) => ({ song, originalIndex: index }))
      .filter(
        ({ song }) =>
          song.title.toLowerCase().includes(q) ||
          song.artist.toLowerCase().includes(q) ||
          (song.album && song.album.toLowerCase().includes(q))
      );
  }, [queue, searchQuery]);

  // Total duration calculation
  const totalDurationText = useMemo(() => {
    const totalSecs = queue.reduce((acc, song) => acc + (song.duration || 0), 0);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    if (hours > 0) {
      return `${hours} 小时 ${minutes} 分`;
    }
    return `${minutes} 分钟`;
  }, [queue]);

  const handleTrackClick = useCallback((index: number) => {
    const targetSong = queue[index];
    if (targetSong) {
      const audioStore = useAudioStore.getState();
      const queueStore = useQueueStore.getState();
      queueStore.setCurrentIndex(index);
      audioStore.setCurrentSong(targetSong);
      audioStore.setCurrentIndex(index);
      audioStore.setIsPlaying(true);
    }
  }, [queue]);

  const handleOpen3DShelf = useCallback(() => {
    onClose();
    openPanel("shelf3D");
  }, [onClose, openPanel]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex justify-end pointer-events-auto select-none">
        {/* Dark Fluid Backdrop (Click to dismiss) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* VisionOS High-End Luxury Glass Drawer */}
        <motion.div
          initial={{ x: "100%", opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={DRAWER_SPRING}
          className="relative z-10 w-full md:w-[440px] max-w-full h-full bg-[#08080c]/92 border-l border-white/[0.08] shadow-[-30px_0_80px_rgba(0,0,0,0.85)] backdrop-blur-3xl flex flex-col overflow-hidden text-white"
        >
          {/* Ambient Radial Color Mesh Glow */}
          <div className="absolute top-0 right-0 left-0 h-64 overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-16 right-10 w-72 h-72 rounded-full bg-gradient-to-br from-[#0071e3]/20 via-[#2997ff]/10 to-purple-600/10 blur-[70px] opacity-70" />
            <div className="absolute top-20 -left-10 w-48 h-48 rounded-full bg-cyan-500/10 blur-[60px] opacity-40" />
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>

          {/* Master Glass Header */}
          <div className="relative z-10 px-5 pt-5 pb-4 border-b border-white/[0.06] bg-white/[0.01]">
            <div className="flex items-center justify-between gap-3">
              {/* Left: Animated Icon + Title + Count Badge */}
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/10 flex items-center justify-center shadow-inner shadow-white/10">
                  <Disc3 className="w-5 h-5 text-[#2997ff] animate-[spin_8s_linear_infinite]" />
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold tracking-tight text-white/95">
                      播放队列
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-gradient-to-r from-white/10 to-white/[0.04] border border-white/10 text-white/80">
                      {queue.length} 首
                    </span>
                  </div>
                  <p className="text-[11px] text-white/40 font-mono mt-0.5">
                    总时长 {totalDurationText}
                  </p>
                </div>
              </div>

              {/* Right: 3D Spatial Shelf Button + Action Icons */}
              <div className="flex items-center gap-2">
                {/* Fullscreen 3D Spatial Shelf Trigger Button */}
                <button
                  type="button"
                  onClick={handleOpen3DShelf}
                  className="relative group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#0071e3]/20 via-cyan-500/15 to-indigo-500/20 border border-cyan-400/35 hover:border-cyan-400/70 text-cyan-300 hover:text-white shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all duration-300 text-xs font-medium overflow-hidden"
                  title="进入全屏 Mineradio 3D 空间唱片架"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                  <Box className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-12 group-hover:scale-110 transition-transform" />
                  <span className="tracking-wide">3D 唱片架</span>
                </button>

                {/* Search Toggle */}
                <button
                  type="button"
                  onClick={() => setIsSearchOpen((prev) => !prev)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    isSearchOpen
                      ? "bg-[#0071e3] text-white"
                      : "bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white border border-white/[0.06]"
                  }`}
                  title="过滤队列曲目"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>

                {/* Clear Queue Button */}
                {queue.length > 0 && (
                  <button
                    type="button"
                    onClick={clearQueue}
                    className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-red-500/20 text-white/50 hover:text-red-300 border border-white/[0.06] hover:border-red-500/30 flex items-center justify-center transition-all"
                    title="清空当前队列"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border border-white/10 flex items-center justify-center transition-all"
                  title="收起播放列表 (Esc / Q)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* In-Drawer Expandable Search Bar */}
            <AnimatePresence>
              {isSearchOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative flex items-center">
                    <Search className="absolute left-3 w-3.5 h-3.5 text-white/40 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="在队列中搜索歌曲、歌手..."
                      className="w-full h-9 pl-9 pr-8 bg-white/[0.06] border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#2997ff]/60 focus:bg-white/[0.08] transition-all"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 text-white/60 flex items-center justify-center text-[10px]"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Master Track List Content */}
          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
            {filteredQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-white/40">
                <div className="w-16 h-16 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4 text-white/20 shadow-inner">
                  <ListMusic className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium text-white/60">
                  {searchQuery ? "未找到匹配的歌曲" : "播放队列为空"}
                </p>
                <p className="text-xs text-white/30 mt-1 max-w-[220px]">
                  {searchQuery ? "请尝试其他关键词过滤" : "在曲库或搜索中点击歌曲开始播放"}
                </p>
              </div>
            ) : (
              filteredQueue.map(({ song, originalIndex }) => {
                const isCurrent =
                  (currentSong && currentSong.id === song.id) || currentIndex === originalIndex;
                const coverSrc = song.cover && song.cover.trim() ? song.cover : DEFAULT_COVER_SRC;

                return (
                  <div
                    key={`${song.id}-${originalIndex}`}
                    ref={isCurrent ? activeItemRef : null}
                    onClick={() => handleTrackClick(originalIndex)}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all duration-200 border ${
                      isCurrent
                        ? "bg-gradient-to-r from-[#0071e3]/20 via-white/[0.08] to-purple-900/15 border-[#2997ff]/40 shadow-[0_4px_24px_rgba(0,0,0,0.5)] ring-1 ring-[#2997ff]/30 text-white"
                        : "bg-white/[0.02] hover:bg-white/[0.07] border-white/[0.03] hover:border-white/[0.1] text-white/75 hover:text-white"
                    }`}
                  >
                    {/* Active Left Pill Accent Indicator */}
                    {isCurrent && (
                      <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#2997ff] shadow-[0_0_12px_rgba(41,151,255,0.8)]" />
                    )}

                    {/* Playing State / Equalizer Bars / Index */}
                    <div className="w-6 shrink-0 flex items-center justify-center">
                      {isCurrent ? (
                        isPlaying ? (
                          <div className="flex items-end gap-0.5 h-3.5">
                            <span className="w-0.5 bg-[#2997ff] rounded-full animate-[bounce_0.8s_infinite_100ms] h-full shadow-[0_0_6px_rgba(41,151,255,0.8)]" />
                            <span className="w-0.5 bg-[#2997ff] rounded-full animate-[bounce_0.8s_infinite_300ms] h-2/3 shadow-[0_0_6px_rgba(41,151,255,0.8)]" />
                            <span className="w-0.5 bg-[#2997ff] rounded-full animate-[bounce_0.8s_infinite_200ms] h-4/5 shadow-[0_0_6px_rgba(41,151,255,0.8)]" />
                            <span className="w-0.5 bg-[#2997ff] rounded-full animate-[bounce_0.8s_infinite_400ms] h-1/2 shadow-[0_0_6px_rgba(41,151,255,0.8)]" />
                          </div>
                        ) : (
                          <Volume2 className="w-4 h-4 text-[#2997ff]" />
                        )
                      ) : (
                        <span className="text-xs font-mono text-white/35 group-hover:hidden">
                          {originalIndex + 1}
                        </span>
                      )}
                      {!isCurrent && (
                        <Play className="w-3.5 h-3.5 text-white/80 hidden group-hover:block" />
                      )}
                    </div>

                    {/* Album Art Cover with Glass Relief Shadow */}
                    <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10 shadow-md shadow-black/60 group-hover:scale-105 transition-transform duration-200">
                      <Image
                        src={coverSrc}
                        alt={song.title}
                        fill
                        sizes="44px"
                        className="object-cover"
                        unoptimized={coverSrc.startsWith("data:") || coverSrc.startsWith("blob:")}
                      />
                      {/* Luminous gloss sheen overlay */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/20 pointer-events-none" />
                    </div>

                    {/* Track Title & Artist Metadata */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-sm font-medium tracking-tight truncate ${
                            isCurrent
                              ? "text-white font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                              : "text-white/90"
                          }`}
                        >
                          {song.title}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#2997ff]/20 border border-[#2997ff]/40 text-[#2997ff] shrink-0">
                            PLAYING
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-white/45 truncate mt-0.5">
                        <span className="truncate">{song.artist}</span>
                        {song.album && (
                          <>
                            <span className="text-white/20">·</span>
                            <span className="truncate text-white/30">{song.album}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Duration & Hover Quick Actions */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-white/40 group-hover:text-white/60 transition-colors">
                        {formatTime(song.duration || 0)}
                      </span>

                      {/* Play Next (Insert Next) Button */}
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveToNext(originalIndex);
                          }}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-white/50 hover:text-white flex items-center justify-center transition-all"
                          title="下一首播放"
                        >
                          <CornerDownRight className="w-3 h-3" />
                        </button>
                      )}

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(originalIndex);
                        }}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-300 flex items-center justify-center transition-all"
                        title="移出队列"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Dock Bar */}
          <div className="relative z-10 px-5 py-3 border-t border-white/[0.06] bg-black/50 backdrop-blur-xl flex items-center justify-between text-[11px] text-white/40 font-mono">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 text-[10px]">Q</span>
              <span>唤出 / 收起</span>
              <span className="text-white/20">·</span>
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 text-[10px]">ESC</span>
              <span>退出</span>
            </div>
            <button
              type="button"
              onClick={handleOpen3DShelf}
              className="flex items-center gap-1 text-cyan-400/90 hover:text-cyan-300 transition-colors"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>全屏 3D 唱片架</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
