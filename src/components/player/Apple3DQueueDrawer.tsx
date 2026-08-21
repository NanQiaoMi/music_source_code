/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListMusic, Box, X, Play, Trash2, Volume2, Sparkles, Layers } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useQueueStore } from "@/store/queueStore";
import { useAudioStore } from "@/store/audioStore";
import { Shelf3DView } from "@/components/library/Shelf3DView";
import { formatTime } from "@/utils/formatTime";
import Image from "next/image";

const DEFAULT_COVER_SRC = "/default-cover.svg";

// Apple Pro Spring Physics for drawer slide
const DRAWER_TRANSITION = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
  mass: 0.85,
};

export function Apple3DQueueDrawer() {
  const { panels, openPanel, closePanel, togglePanel } = useUIStore();
  const isOpen = Boolean(panels.queue || panels.shelf3D);

  const { queue, currentIndex, removeFromQueue, clearQueue } = useQueueStore();
  const { currentSong, isPlaying } = useAudioStore();

  const [drawerMode, setDrawerMode] = useState<"2d" | "3d">("2d");
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Velocity and Dwell State Tracking
  const lastMousePosRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Responsive screen check
  useEffect(() => {
    const checkScreen = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // Synchronize drawer mode with store panels if opened externally
  useEffect(() => {
    if (panels.shelf3D && !panels.queue) {
      setDrawerMode("3d");
    } else if (panels.queue && !panels.shelf3D) {
      setDrawerMode("2d");
    }
  }, [panels.queue, panels.shelf3D]);

  const handleClose = useCallback(() => {
    closePanel("queue");
    closePanel("shelf3D");
  }, [closePanel]);

  const handleOpen = useCallback(() => {
    if (drawerMode === "3d") {
      openPanel("shelf3D");
    } else {
      openPanel("queue");
    }
  }, [drawerMode, openPanel]);

  // Global Keyboard Shortcuts (Esc to close, Q / Cmd+L to toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in form inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        handleClose();
      } else if (e.key === "q" || e.key === "Q") {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          if (isOpen) {
            handleClose();
          } else {
            handleOpen();
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        if (isOpen) {
          handleClose();
        } else {
          handleOpen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose, handleOpen]);

  // High-precision anti-accidental edge sensor
  const handleHandleMouseEnter = () => {
    setIsHandleHovered(true);
  };

  const handleHandleMouseLeave = () => {
    setIsHandleHovered(false);
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  };

  const handleHandleMouseMove = (e: React.MouseEvent) => {
    const now = performance.now();
    const prev = lastMousePosRef.current;
    const dt = Math.max(1, now - prev.time);
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    const velocity = Math.hypot(dx, dy) / dt;

    lastMousePosRef.current = { x: e.clientX, y: e.clientY, time: now };

    // Strict physical exclude zones: top 0-90px (window buttons), bottom 0-80px (player bar)
    if (e.clientY < 90 || e.clientY > window.innerHeight - 80) {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
      return;
    }

    // Velocity Gate: If moving fast (> 0.35px/ms), cancel dwell trigger
    if (velocity > 0.35) {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
      return;
    }

    // Start 400ms deliberate dwell timer
    if (!dwellTimerRef.current && !isOpen) {
      dwellTimerRef.current = setTimeout(() => {
        handleOpen();
        dwellTimerRef.current = null;
      }, 400);
    }
  };

  const handleTrackClick = (index: number) => {
    const targetSong = queue[index];
    if (targetSong) {
      const audioStore = useAudioStore.getState();
      const queueStore = useQueueStore.getState();
      queueStore.setCurrentIndex(index);
      audioStore.setCurrentSong(targetSong);
      audioStore.setCurrentIndex(index);
      audioStore.setIsPlaying(true);
    }
  };

  return (
    <>
      {/* ─── 1. Apple-Style Right Edge Smart Handle (Desktop only) ─── */}
      {isDesktop && !isOpen && (
        <div
          onMouseEnter={handleHandleMouseEnter}
          onMouseLeave={handleHandleMouseLeave}
          onMouseMove={handleHandleMouseMove}
          onClick={handleOpen}
          className="fixed top-1/2 -translate-y-1/2 right-0 z-40 h-36 flex items-center justify-end pointer-events-auto cursor-pointer select-none group"
          title="点击或停驻呼出播放列表 (快捷键 Q / ⌘L)"
        >
          {/* Subtle micro-glow translucent pill */}
          <motion.div
            animate={{
              width: isHandleHovered ? 40 : 5,
              height: isHandleHovered ? 120 : 64,
              opacity: isHandleHovered ? 1 : 0.45,
              x: 0,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className={`rounded-l-2xl border-y border-l flex items-center justify-center overflow-hidden transition-colors ${
              isHandleHovered
                ? "bg-black/80 backdrop-blur-2xl border-white/20 shadow-[0_0_24px_rgba(41,151,255,0.4)]"
                : "bg-white/20 border-white/10 hover:bg-white/30"
            }`}
          >
            {isHandleHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-1.5 text-white/90"
              >
                <ListMusic className="w-4 h-4 text-[#2997ff]" />
                <span className="text-[10px] font-mono font-bold leading-none text-white/80">
                  {queue.length}
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}

      {/* ─── 2. Unified High-Performance Sliding Queue Drawer ─── */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex justify-end pointer-events-auto">
            {/* Dark Frosted Backdrop (Click to dismiss) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleClose}
              className="absolute inset-0 bg-black/55 backdrop-blur-md"
            />

            {/* Sliding Drawer Container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={DRAWER_TRANSITION}
              className="relative z-10 w-full md:w-[420px] max-w-full h-full bg-[#121216]/95 border-l border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] backdrop-blur-3xl flex flex-col overflow-hidden text-white select-none"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/90">
                    <ListMusic className="w-4 h-4 text-[#2997ff]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold tracking-tight text-white">播放队列</h2>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-white/10 text-white/70">
                        {queue.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Header Controls: 2D/3D Mode Switch + Close */}
                <div className="flex items-center gap-2">
                  {/* Mode Toggle Button */}
                  <div className="flex items-center p-0.5 rounded-xl bg-white/10 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setDrawerMode("2d")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        drawerMode === "2d"
                          ? "bg-[#0071e3] text-white shadow-sm"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      列表
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerMode("3d")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                        drawerMode === "3d"
                          ? "bg-[#0071e3] text-white shadow-sm"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      <Box className="w-3 h-3" />
                      3D
                    </button>
                  </div>

                  {/* Clear Queue Button */}
                  {queue.length > 0 && drawerMode === "2d" && (
                    <button
                      type="button"
                      onClick={clearQueue}
                      className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-300 flex items-center justify-center transition-colors"
                      title="清空队列"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Close Drawer Button */}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                    title="收起播放列表 (Esc / Q)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Drawer Main Content */}
              <div className="flex-1 min-h-0 relative">
                {drawerMode === "2d" ? (
                  /* ─── 2D Minimalist Pure Queue List ─── */
                  queue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-white/40">
                      <div className="w-16 h-16 rounded-3xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4 text-white/20">
                        <ListMusic className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-medium text-white/60">播放队列为空</p>
                      <p className="text-xs text-white/30 mt-1 max-w-[200px]">
                        在曲库或搜索中点击歌曲开始播放
                      </p>
                    </div>
                  ) : (
                    <div className="h-full overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                      {queue.map((song, index) => {
                        const isCurrent =
                          (currentSong && currentSong.id === song.id) || currentIndex === index;
                        const coverSrc = song.cover && song.cover.trim() ? song.cover : DEFAULT_COVER_SRC;

                        return (
                          <div
                            key={`${song.id}-${index}`}
                            onClick={() => handleTrackClick(index)}
                            className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all border ${
                              isCurrent
                                ? "bg-white/[0.12] border-white/20 shadow-md shadow-black/40 text-white"
                                : "bg-white/[0.03] hover:bg-white/[0.08] border-transparent text-white/70 hover:text-white"
                            }`}
                          >
                            {/* Playing Status Indicator / Index */}
                            <div className="w-5 shrink-0 flex items-center justify-center">
                              {isCurrent ? (
                                isPlaying ? (
                                  <div className="flex items-end gap-0.5 h-3.5">
                                    <span className="w-0.5 bg-[#2997ff] animate-[bounce_1s_infinite_100ms] h-full" />
                                    <span className="w-0.5 bg-[#2997ff] animate-[bounce_1s_infinite_300ms] h-2/3" />
                                    <span className="w-0.5 bg-[#2997ff] animate-[bounce_1s_infinite_200ms] h-4/5" />
                                  </div>
                                ) : (
                                  <Volume2 className="w-3.5 h-3.5 text-[#2997ff]" />
                                )
                              ) : (
                                <span className="text-xs font-mono text-white/35 group-hover:hidden">
                                  {index + 1}
                                </span>
                              )}
                              {!isCurrent && (
                                <Play className="w-3.5 h-3.5 text-white/70 hidden group-hover:block" />
                              )}
                            </div>

                            {/* Cover Thumbnail */}
                            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white/5 shrink-0 border border-white/10">
                              <Image
                                src={coverSrc}
                                alt={song.title}
                                fill
                                sizes="40px"
                                className="object-cover"
                                unoptimized={coverSrc.startsWith("data:") || coverSrc.startsWith("blob:")}
                              />
                            </div>

                            {/* Track Metadata */}
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-sm font-medium truncate ${
                                    isCurrent ? "text-[#2997ff] font-semibold" : "text-white/90"
                                  }`}
                                >
                                  {song.title}
                                </span>
                              </div>
                              <p className="text-xs text-white/45 truncate mt-0.5">{song.artist}</p>
                            </div>

                            {/* Duration / Actions */}
                            <div className="shrink-0 flex items-center gap-2">
                              <span className="text-[11px] font-mono text-white/40">
                                {formatTime(song.duration || 0)}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromQueue(index);
                                }}
                                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-300 flex items-center justify-center transition-all"
                                title="移出队列"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  /* ─── 3D Space Shelf WebGL Mode (Zero GC lifecycle) ─── */
                  <div className="w-full h-full relative">
                    <Shelf3DView
                      isOpen={true}
                      defaultMode="side"
                      transparentBg={true}
                      isDrawerMode={true}
                      onClose={handleClose}
                    />
                  </div>
                )}
              </div>

              {/* Drawer Footer Status */}
              <div className="px-6 py-3 border-t border-white/[0.06] bg-black/40 flex items-center justify-between text-[11px] text-white/40 font-mono">
                <span>快捷键: Q 唤出 / 收起 · ESC 退出</span>
                <span>{drawerMode === "2d" ? "极简 2D 队列" : "3D 空间唱片架"}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
