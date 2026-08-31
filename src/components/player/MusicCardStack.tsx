/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { Play, Pause, Disc, Plus } from "lucide-react";
import { usePlaylistStore } from "@/store/playlistStore";
import { useQueueStore } from "@/store/queueStore";
import { useUIStore } from "@/store/uiStore";
import { useAudioStore } from "@/store/audioStore";
import { useOfflineDownloadStore } from "@/store/useOfflineDownloadStore";
import { useGestureStore } from "@/store/gestureStore";
import { getCoverFromCache, saveCoverToCache } from "@/services/coverCache";
import { multiSourceResolver } from "@/services/MultiSourceResolver";
import { getStoredMusic } from "@/services/localMusicStorage";
import { Song } from "@/types/song";
import Link from "next/link";

// Apple 顶级 Cover Flow 物理弹簧 (更轻更敏捷：stiffness 420, damping 36, mass 0.55)
const COVER_FLOW_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 36,
  mass: 0.55,
};

const DEFAULT_COVER_SRC = "/default-cover.svg";
const SLEEVE_SIZE = 360;
const DISC_SIZE = 305;
const MAX_VISIBLE_HALF = 3; // 左右各显示 3 张，共 7 张黄金视野，大幅降低 3D 渲染开销

export const MusicCardStack: React.FC = () => {
  const songs = usePlaylistStore((state) => state.songs);
  const recentPlayed = usePlaylistStore((state) => state.recentPlayed);
  const setSelectedSong = usePlaylistStore((state) => state.setSelectedSong);
  const queue = useQueueStore((state) => state.queue);
  const offlineRecords = useOfflineDownloadStore((state) => state.offlineRecords);
  const currentSong = useAudioStore((state) => state.currentSong);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const { lastGesture, gestureTriggered } = useGestureStore();
  const setCurrentView = useUIStore((state) => state.setCurrentView);

  const displaySongs: Song[] = useMemo(() => {
    const rawList =
      queue && queue.length > 0 ? queue : songs && songs.length > 0 ? songs : recentPlayed;
    const playlistCoverMap = new Map(songs.map((s) => [s.id, s.cover]));
    const offlineCoverMap = new Map(offlineRecords.map((r) => [String(r.songId), r.cover]));

    return rawList.map((song) => {
      let cover = song.cover;
      if (!cover || cover === DEFAULT_COVER_SRC || cover.includes("default-cover")) {
        if (
          playlistCoverMap.get(song.id) &&
          !playlistCoverMap.get(song.id)!.includes("default-cover")
        ) {
          cover = playlistCoverMap.get(song.id);
        } else if (
          offlineCoverMap.get(String(song.id)) &&
          !offlineCoverMap.get(String(song.id))!.includes("default-cover")
        ) {
          cover = offlineCoverMap.get(String(song.id));
        }
      }
      return cover && cover !== song.cover ? { ...song, cover } : song;
    });
  }, [queue, songs, recentPlayed, offlineRecords]);

  const [centerIndex, setCenterIndex] = useState(0);
  const [isCenterHovered, setIsCenterHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isWheelingRef = useRef(false);
  const prevSongIdRef = useRef<string | null>(null);
  const checkedCoverIdsRef = useRef<Set<string>>(new Set());
  const selectedSongTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 纯硬件层 Framer Motion 物理弹簧（零 React 重渲染）
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const tiltSpringConfig = { stiffness: 350, damping: 32 };
  const smoothTiltX = useSpring(mouseY, tiltSpringConfig);
  const smoothTiltY = useSpring(mouseX, tiltSpringConfig);

  // 仅在真实切歌 (currentSong.id 变化) 或初次加载时将卡片自动聚焦到当前曲目
  useEffect(() => {
    if (!currentSong || displaySongs.length === 0) return;
    if (prevSongIdRef.current === currentSong.id) return;
    prevSongIdRef.current = currentSong.id;

    const foundIdx = displaySongs.findIndex((s) => s.id === currentSong.id);
    if (foundIdx >= 0) {
      setCenterIndex(foundIdx);
    }
  }, [currentSong?.id, displaySongs]);

  // 切换焦点专辑时防抖同步当前选中的歌曲（延迟 450ms，等切歌弹簧运动完全就绪后再触发背景色彩提取）
  useEffect(() => {
    if (selectedSongTimerRef.current) {
      clearTimeout(selectedSongTimerRef.current);
    }
    if (displaySongs.length > 0 && displaySongs[centerIndex]) {
      selectedSongTimerRef.current = setTimeout(() => {
        setSelectedSong(displaySongs[centerIndex]);
      }, 450);
    }
    return () => {
      if (selectedSongTimerRef.current) {
        clearTimeout(selectedSongTimerRef.current);
      }
    };
  }, [centerIndex, displaySongs, setSelectedSong]);

  // 计算当前可视的卡片列表
  const visibleCards = useMemo(() => {
    const total = displaySongs.length;
    if (total === 0) return [];

    const half = Math.min(MAX_VISIBLE_HALF, Math.floor((total - 1) / 2));
    const cards = [];

    for (let i = -half; i <= half; i++) {
      const targetIndex = centerIndex + i;
      const displayIndex = ((targetIndex % total) + total) % total;
      const song = displaySongs[displayIndex];

      if (song) {
        cards.push({
          ...song,
          displayIndex,
          offset: i,
        });
      }
    }

    return cards;
  }, [centerIndex, displaySongs]);

  // 针对当前可视区域内的未补全封面，在静止空闲时（800ms 防抖）异步后台提取，绝不在切歌动画过程中阻塞 UI
  useEffect(() => {
    const missingCoverCards = visibleCards.filter(
      (card) =>
        (!card.cover || card.cover === DEFAULT_COVER_SRC || card.cover.includes("default-cover")) &&
        !checkedCoverIdsRef.current.has(card.id)
    );

    if (missingCoverCards.length === 0) return;

    const timer = setTimeout(() => {
      missingCoverCards.forEach(async (card) => {
        checkedCoverIdsRef.current.add(card.id);

        // 1. 尝试从本地缓存 / IndexedDB 读取
        const cached = await getCoverFromCache(card.id);
        if (cached) {
          usePlaylistStore.getState().updateSong(card.id, { cover: cached });
          useQueueStore.getState().updateSong(card.id, { cover: cached });
          return;
        }

        // 2. 尝试从本地存储音频读取
        if (card.source === "local" || card.id) {
          try {
            const stored = await getStoredMusic(card.id);
            if (stored?.coverData) {
              usePlaylistStore.getState().updateSong(card.id, { cover: stored.coverData });
              useQueueStore.getState().updateSong(card.id, { cover: stored.coverData });
              saveCoverToCache(card.id, stored.coverData, stored.coverData).catch(() => {});
              return;
            }
          } catch {}
        }

        // 3. 尝试全网多源嗅探高清封面
        if (card.title) {
          try {
            const onlineCover = await multiSourceResolver.fetchOnlineCover({
              id: String(card.id || ""),
              title: card.title,
              artist: card.artist,
              source: card.source,
            });
            if (onlineCover) {
              usePlaylistStore.getState().updateSong(card.id, { cover: onlineCover });
              useQueueStore.getState().updateSong(card.id, { cover: onlineCover });
              saveCoverToCache(card.id, onlineCover, onlineCover).catch(() => {});
            }
          } catch {}
        }
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [visibleCards]);

  const handlePrev = useCallback(() => {
    if (displaySongs.length <= 1) return;
    setCenterIndex((prev) => (prev - 1 + displaySongs.length) % displaySongs.length);
  }, [displaySongs.length]);

  const handleNext = useCallback(() => {
    if (displaySongs.length <= 1) return;
    setCenterIndex((prev) => (prev + 1) % displaySongs.length);
  }, [displaySongs.length]);

  const handlePlayCard = useCallback(
    (song: Song, _index: number) => {
      if (!song.audioUrl && song.id.startsWith("demo")) {
        useUIStore
          .getState()
          .showToast("这首示例歌曲没有音频文件，请先到数据管理页导入本地音乐。", "warning");
        return;
      }
      setSelectedSong(song);
      if (currentSong?.id === song.id && isPlaying) {
        setIsPlaying(false);
      } else {
        const targetQueue = displaySongs.length > 0 ? displaySongs : [song];
        const targetIdx = targetQueue.findIndex((s) => s.id === song.id);
        useAudioStore.getState().playQueue(targetQueue, targetIdx >= 0 ? targetIdx : _index);
      }
    },
    [currentSong?.id, isPlaying, setIsPlaying, setSelectedSong, displaySongs]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      mouseX.set(((x - centerX) / centerX) * 7.5);
      mouseY.set(-((y - centerY) / centerY) * 7.5);
    },
    [mouseX, mouseY]
  );

  const handleMouseEnterCard = useCallback(() => {
    setIsCenterHovered(true);
  }, []);

  const handleMouseLeaveCard = useCallback(() => {
    setIsCenterHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  // 滚轮横向轻拨连续切歌 (80ms 高敏平滑防抖)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isWheelingRef.current) return;
      if (Math.abs(e.deltaX) > 12 || Math.abs(e.deltaY) > 12) {
        isWheelingRef.current = true;
        if (e.deltaX > 0 || e.deltaY > 0) {
          handleNext();
        } else {
          handlePrev();
        }
        setTimeout(() => {
          isWheelingRef.current = false;
        }, 80);
      }
    },
    [handleNext, handlePrev]
  );

  // 键盘快捷键 ← / → / Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === " ") {
        e.preventDefault();
        const centerSong = displaySongs[centerIndex];
        if (centerSong) {
          handlePlayCard(centerSong, centerIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [centerIndex, displaySongs, handleNext, handlePrev, handlePlayCard]);

  // 手势切歌联动
  useEffect(() => {
    if (gestureTriggered && lastGesture) {
      if ((lastGesture as any) === "swipe_left" || (lastGesture as any)?.type === "swipe_left") {
        handleNext();
      } else if (
        (lastGesture as any) === "swipe_right" ||
        (lastGesture as any)?.type === "swipe_right"
      ) {
        handlePrev();
      }
    }
  }, [gestureTriggered, lastGesture, handleNext, handlePrev]);

  // 空曲库占位展示
  if (displaySongs.length === 0) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col items-center text-center p-8 max-w-md"
        >
          <div className="w-24 h-24 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mb-6 shadow-2xl backdrop-blur-xl">
            <Disc className="w-12 h-12 text-white/40 animate-[spin_12s_linear_infinite]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">曲库暂无音乐</h2>
          <p className="text-sm text-[#86868b] mb-8 leading-relaxed">
            导入本地音频文件或文件夹，开启 3D 实体黑胶唱片体验
          </p>
          <Link href="/data-manager">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-6 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white text-[13px] font-medium tracking-tight shadow-md transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>导入音乐或文件夹</span>
            </motion.button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="relative w-full h-full flex items-center justify-center select-none overflow-visible"
      style={{ perspective: 1200 }}
    >
      {/* ─── 舞台漫反射水波与极光地底 ─── */}
      <div className="absolute -bottom-[80px] w-[900px] h-[200px] rounded-full pointer-events-none overflow-hidden opacity-30 blur-[40px] transform-gpu">
        <div className="w-full h-full bg-radial-gradient from-white/20 via-white/5 to-transparent animate-caustic-shimmer" />
      </div>

      <div
        className="relative flex items-center justify-center w-full"
        style={{
          height: SLEEVE_SIZE + 160,
          transformStyle: "preserve-3d",
        }}
      >
        <AnimatePresence initial={false}>
          {visibleCards.map((card) => {
            const isCenter = card.offset === 0;
            const absOffset = Math.abs(card.offset);
            const isPlayingThis = isCenter && isPlaying && currentSong?.id === card.id;

            // 黄金两翼展布参数：间距 195px, 侧转倾角 38°
            const x = card.offset * 195;
            const z = isCenter ? 50 : -absOffset * 110;
            const rotateY = isCenter ? 0 : card.offset < 0 ? 38 : -38;
            const scale = isCenter
              ? isCenterHovered
                ? 1.2
                : 1.18
              : Math.max(0.64, 0.82 - absOffset * 0.08);
            const opacity = isCenter ? 1 : Math.max(0.28, 0.72 - absOffset * 0.16);
            const zIndex = 30 - absOffset;

            return (
              <motion.div
                key={`${card.id}_${card.displayIndex}_${card.offset}`}
                onClick={() => {
                  if (isCenter) {
                    handlePlayCard(card, card.displayIndex);
                  } else {
                    setCenterIndex(card.displayIndex);
                  }
                }}
                onDoubleClick={() => {
                  if (isCenter) {
                    setCurrentView("player");
                  }
                }}
                style={{
                  position: "absolute",
                  width: SLEEVE_SIZE,
                  height: SLEEVE_SIZE,
                  zIndex,
                  transformStyle: "preserve-3d",
                  cursor: "pointer",
                  willChange: "transform, opacity",
                  backfaceVisibility: "hidden",
                }}
                initial={{
                  x: card.offset > 0 ? x + 80 : x - 80,
                  opacity: 0,
                  scale: scale * 0.92,
                  rotateY,
                  z,
                }}
                animate={{
                  x,
                  z,
                  rotateY,
                  scale,
                  opacity,
                }}
                exit={{
                  x: card.offset > 0 ? x + 80 : x - 80,
                  opacity: 0,
                  scale: scale * 0.92,
                  transition: { duration: 0.15 },
                }}
                transition={COVER_FLOW_SPRING}
                className="group flex items-center justify-center transform-gpu"
              >
                {/* 内层视差与黑胶互动层 */}
                <motion.div
                  className="relative w-full h-full flex items-center justify-center"
                  style={{
                    transformStyle: "preserve-3d",
                    rotateX: isCenter ? smoothTiltX : 0,
                    rotateY: isCenter ? smoothTiltY : 0,
                  }}
                  onMouseMove={isCenter ? handleMouseMove : undefined}
                  onMouseEnter={isCenter ? handleMouseEnterCard : undefined}
                  onMouseLeave={isCenter ? handleMouseLeaveCard : undefined}
                >
                  {/* ─── 1. 实体拟真黑胶唱片 (仅中心焦点卡片渲染完整唱片结构，极大削减侧翼 GPU 负担) ─── */}
                  {isCenter && (
                    <motion.div
                      initial={false}
                      animate={{
                        x: isCenterHovered ? 165 : 150,
                        opacity: 1,
                        scale: 1,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 280,
                        damping: 28,
                      }}
                      style={{
                        position: "absolute",
                        top: (SLEEVE_SIZE - DISC_SIZE) / 2,
                        left: (SLEEVE_SIZE - DISC_SIZE) / 2,
                        width: DISC_SIZE,
                        height: DISC_SIZE,
                        zIndex: 0,
                        boxShadow:
                          "0 20px 52px rgba(0,0,0,0.94), inset 0 0 0 2px rgba(255,255,255,0.08)",
                        background:
                          "radial-gradient(circle, #1a1a1a 0%, #111111 25%, #222222 26%, #0d0d0d 45%, #1f1f1f 46%, #080808 65%, #1a1a1a 66%, #050505 100%)",
                      }}
                      className="rounded-full pointer-events-none"
                    >
                      {/* 唱片持续转动 */}
                      <div
                        className={`relative w-full h-full rounded-full flex items-center justify-center ${
                          isPlayingThis ? "vinyl-rotating-active" : "vinyl-rotating-idle"
                        }`}
                        style={{ willChange: "transform" }}
                      >
                        {/* 超精细物理同心折射凹槽 (采用轻量高效的 CSS repeating radial 纹理) */}
                        <div
                          className="absolute inset-1 rounded-full pointer-events-none opacity-40"
                          style={{
                            background:
                              "repeating-radial-gradient(circle, transparent 0, transparent 4px, rgba(255,255,255,0.04) 4.5px, transparent 5px)",
                          }}
                        />

                        {/* 顺时针物理真实多角度彩虹高光扫光 */}
                        <div
                          className={`absolute inset-0 rounded-full pointer-events-none ${
                            isPlayingThis
                              ? "animate-conic-sweep-active"
                              : "animate-conic-sweep-idle"
                          }`}
                          style={{
                            background:
                              "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.38) 60deg, transparent 120deg, transparent 180deg, rgba(255,255,255,0.38) 240deg, transparent 300deg)",
                          }}
                        />

                        {/* 黑胶中心圆形专辑贴图 + 烫银盘芯微圆环 */}
                        <div className="relative w-28 h-28 rounded-full overflow-hidden border-[3px] border-[#222226] shadow-[0_0_12px_rgba(0,0,0,0.8),inset_0_0_0_1.5px_rgba(255,255,255,0.22)]">
                          <Image
                            src={card.cover || DEFAULT_COVER_SRC}
                            alt="label"
                            fill
                            sizes="112px"
                            className="object-cover"
                            unoptimized
                          />
                          <div className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-[#111] border border-white/30 shadow-md" />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ─── 2. 1:1 正方形黑胶封套 (LP Sleeve Jacket) ─── */}
                  <div
                    className="relative rounded-[22px] overflow-hidden bg-[#1c1c1e] shadow-[0_32px_80px_rgba(0,0,0,0.85)] border border-white/[0.14] z-10 transition-shadow duration-300 group-hover:shadow-[0_40px_96px_rgba(0,0,0,0.95)]"
                    style={{
                      width: SLEEVE_SIZE,
                      height: SLEEVE_SIZE,
                      transform: "translateZ(0)",
                    }}
                  >
                    {/* 左侧书脊折光微线 */}
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-r from-white/25 via-white/10 to-transparent z-20 pointer-events-none" />

                    {/* 右侧开口暗黑内衬阴影 */}
                    <div className="absolute right-0 top-0 bottom-0 w-[4px] bg-gradient-to-l from-black/80 to-transparent z-20 pointer-events-none" />

                    {/* 专辑封面 */}
                    <Image
                      src={card.cover || DEFAULT_COVER_SRC}
                      alt={card.title}
                      fill
                      sizes="360px"
                      priority={isCenter}
                      className="object-cover"
                      unoptimized
                    />

                    {/* 焦点封套：底部无感双层渐变 + 高奢方正小标宋排版 */}
                    {isCenter ? (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent flex flex-col justify-between p-6 z-20">
                        {/* 顶部播放波形 与 ↗ 沉浸详情 徽标 */}
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentView("player");
                            }}
                            className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-[11px] font-medium text-white/90 hover:text-white backdrop-blur-md transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                            title="双击卡片或点击此按钮进入全屏沉浸播放器详情页"
                          >
                            <span>↗ 详情舞台</span>
                          </button>

                          {isPlayingThis && (
                            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                              <span className="w-1 h-3 bg-[#2997ff] rounded-full animate-[pulse_0.8s_ease-in-out_infinite]" />
                              <span className="w-1 h-4.5 bg-[#2997ff] rounded-full animate-[pulse_1.2s_ease-in-out_infinite]" />
                              <span className="w-1 h-2.5 bg-[#2997ff] rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                            </div>
                          )}
                        </div>

                        {/* 中间播放/暂停触感按钮 (64px 高透磨砂) */}
                        <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-95 group-hover:scale-100">
                          <div className="w-16 h-16 rounded-full bg-white/25 hover:bg-white/35 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl">
                            {isPlayingThis ? (
                              <Pause className="w-7 h-7 fill-white" />
                            ) : (
                              <Play className="w-7 h-7 fill-white ml-1" />
                            )}
                          </div>
                        </div>

                        {/* 底部歌名与歌手 (方正小标宋高奢排版) */}
                        <div className="min-w-0 text-left">
                          <h3 className="text-[20px] font-bold text-white tracking-tight truncate leading-snug drop-shadow-sm">
                            {card.title}
                          </h3>
                          <p className="text-[13px] text-[#86868b] font-medium truncate mt-0.5">
                            {card.artist}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* 两翼卡片暗化遮罩 (去除昂贵的 backdrop-blur，采用纯色渐变硬件图层) */
                      <div className="absolute inset-0 bg-black/50 flex items-end p-4 z-20">
                        <p className="text-[11px] text-white/50 truncate font-medium">
                          {card.title}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ─── 3. 焦点镜面地板倒影 ─── */}
                  {isCenter && (
                    <div
                      className="absolute -bottom-[58px] left-2 right-2 h-[52px] rounded-[22px] overflow-hidden opacity-35 pointer-events-none scale-y-[-1]"
                      style={{
                        maskImage: "linear-gradient(to top, rgba(0,0,0,0.9), transparent 75%)",
                        WebkitMaskImage:
                          "linear-gradient(to top, rgba(0,0,0,0.9), transparent 75%)",
                      }}
                    >
                      <Image
                        src={card.cover || DEFAULT_COVER_SRC}
                        alt="reflection"
                        fill
                        sizes="360px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
