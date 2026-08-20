/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Disc, Plus } from "lucide-react";
import { usePlaylistStore } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import { useUIStore } from "@/store/uiStore";
import { useGestureStore } from "@/store/gestureStore";
import { useIntegratedAudioPipeline } from "@/lib/audio/useIntegratedAudioPipeline";
import { Song } from "@/types/song";
import Link from "next/link";

const APPLE_SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 320,
  damping: 28,
  mass: 0.85,
};

const DEFAULT_COVER_SRC = "/default-cover.svg";

export const MusicCardStack: React.FC = () => {
  const { songs, recentPlayed, setSelectedSong } = usePlaylistStore();
  const { currentSong, isPlaying, setIsPlaying } = useAudioStore();
  const { lastGesture, gestureTriggered } = useGestureStore();
  const { playTrackWithPipeline } = useIntegratedAudioPipeline();

  const displaySongs: Song[] = useMemo(() => {
    return songs.length > 0 ? songs : recentPlayed;
  }, [songs, recentPlayed]);

  const [centerIndex, setCenterIndex] = useState(0);
  const [mouseTilt, setMouseTilt] = useState({ rotateX: 0, rotateY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isWheelingRef = useRef(false);

  // 初始化时居中正在播放的歌曲或第一首
  useEffect(() => {
    if (displaySongs.length > 0) {
      if (currentSong) {
        const foundIdx = displaySongs.findIndex((s) => s.id === currentSong.id);
        if (foundIdx >= 0) {
          setCenterIndex(foundIdx);
          return;
        }
      }
      setCenterIndex(0);
    }
  }, [displaySongs.length, currentSong?.id]);

  // 1:1 实体黑胶唱片封套规范 (标准 360px，居中卡片放大至 1.18x 突出展示)
  const SLEEVE_SIZE = 360;
  const VISIBLE_HALF = 4; // 左右各显示 4 张

  const visibleCards = useMemo(() => {
    if (displaySongs.length === 0) return [];
    const cards = [];

    for (let i = -VISIBLE_HALF; i <= VISIBLE_HALF; i++) {
      const targetIndex = centerIndex + i;
      const displayIndex =
        ((targetIndex % displaySongs.length) + displaySongs.length) % displaySongs.length;
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
        playTrackWithPipeline(song);
      }
    },
    [currentSong?.id, isPlaying, playTrackWithPipeline, setIsPlaying, setSelectedSong]
  );

  // 鼠标在焦点封套上的 3D 视差倾角
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateY = ((x - centerX) / centerX) * 7;
    const rotateX = -((y - centerY) / centerY) * 7;
    setMouseTilt({ rotateX, rotateY });
  }, []);

  const handleMouseLeaveCard = useCallback(() => {
    setMouseTilt({ rotateX: 0, rotateY: 0 });
  }, []);

  // 滚轮横向拨动切换
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isWheelingRef.current) return;
      if (Math.abs(e.deltaX) > 20 || Math.abs(e.deltaY) > 20) {
        isWheelingRef.current = true;
        if (e.deltaX > 0 || e.deltaY > 0) {
          handleNext();
        } else {
          handlePrev();
        }
        setTimeout(() => {
          isWheelingRef.current = false;
        }, 180);
      }
    },
    [handleNext, handlePrev]
  );

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Enter" || e.key === " ") {
        const centerSong = displaySongs[centerIndex];
        if (centerSong) {
          e.preventDefault();
          handlePlayCard(centerSong, centerIndex);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext, handlePlayCard, displaySongs, centerIndex]);

  // 手势控制
  useEffect(() => {
    if (!lastGesture) return;
    if (lastGesture === "swipe_left") handleNext();
    else if (lastGesture === "swipe_right") handlePrev();
    else if (lastGesture === "fist") {
      const centerSong = displaySongs[centerIndex];
      if (centerSong) handlePlayCard(centerSong, centerIndex);
    }
  }, [lastGesture, gestureTriggered, handleNext, handlePrev, handlePlayCard, displaySongs, centerIndex]);

  // 空状态：极简艺术黑胶
  if (displaySongs.length === 0) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center select-none font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center text-center space-y-6"
        >
          <div className="relative w-44 h-44 rounded-full bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 flex items-center justify-center shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <Disc className="w-20 h-20 text-white/30 animate-[spin_12s_linear_infinite]" />
            <div className="absolute w-12 h-12 rounded-full bg-[#1c1c1e] border-2 border-white/20" />
          </div>

          <div>
            <h3 className="text-[20px] font-semibold text-white tracking-tight">
              曲库暂无音乐
            </h3>
            <p className="text-[13px] text-[#86868b] mt-1.5">
              点击下方按钮导入本地歌曲，或在顶部搜索全网海量音乐
            </p>
          </div>

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
      <div
        className="relative flex items-center justify-center w-full"
        style={{
          height: SLEEVE_SIZE + 180,
          transformStyle: "preserve-3d",
        }}
      >
        <AnimatePresence initial={false}>
          {visibleCards.map((card) => {
            const isCenter = card.offset === 0;
            const absOffset = Math.abs(card.offset);
            const isPlayingThis = isCenter && isPlaying && currentSong?.id === card.id;

            // 展布参数：中心卡片突出放大 1.18x，两翼倾斜 38°
            const x = card.offset * 215;
            const z = isCenter ? 60 : -absOffset * 130;
            const rotateY = isCenter
              ? mouseTilt.rotateY
              : card.offset < 0
              ? 38
              : -38;
            const rotateX = isCenter ? mouseTilt.rotateX : 0;
            const scale = isCenter ? 1.18 : Math.max(0.64, 0.82 - absOffset * 0.08);
            const opacity = isCenter ? 1 : Math.max(0.28, 0.72 - absOffset * 0.16);
            const zIndex = 30 - absOffset;

            return (
              <motion.div
                key={`${card.id}-${card.offset}-${card.displayIndex}`}
                layout
                onClick={() => {
                  if (isCenter) {
                    handlePlayCard(card, card.displayIndex);
                  } else {
                    setCenterIndex(card.displayIndex);
                  }
                }}
                onMouseMove={isCenter ? handleMouseMove : undefined}
                onMouseLeave={isCenter ? handleMouseLeaveCard : undefined}
                style={{
                  position: "absolute",
                  width: SLEEVE_SIZE,
                  height: SLEEVE_SIZE,
                  zIndex,
                  transformStyle: "preserve-3d",
                  cursor: "pointer",
                }}
                animate={{
                  x,
                  z,
                  rotateY,
                  rotateX,
                  scale,
                  opacity,
                  y: isCenter ? [0, -5, 0] : 0,
                }}
                transition={{
                  ...APPLE_SPRING_CONFIG,
                  y: isCenter
                    ? { repeat: Infinity, duration: 4.5, ease: "easeInOut" }
                    : { duration: 0.3 },
                }}
                className="group flex flex-col items-center"
              >
                {/* ─── 1. 实体拟真黑胶唱片 (比例精调 305px，垂直居中向右水平抽出 150px) ─── */}
                {isCenter && (
                  <motion.div
                    initial={{ x: 0, opacity: 0 }}
                    animate={{ x: 150, opacity: 1 }}
                    exit={{ x: 0, opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 280,
                      damping: 24,
                      delay: 0.08,
                    }}
                    className="absolute top-0 bottom-0 right-0 w-[305px] h-[305px] my-auto rounded-full z-0 pointer-events-none"
                    style={{
                      boxShadow: "0 20px 48px rgba(0,0,0,0.9), inset 0 0 0 1.5px rgba(255,255,255,0.08)",
                      background:
                        "radial-gradient(circle, #1a1a1a 0%, #111111 25%, #222222 26%, #0d0d0d 45%, #1f1f1f 46%, #080808 65%, #1a1a1a 66%, #050505 100%)",
                    }}
                  >
                    {/* 匀速旋转黑胶本体 */}
                    <div
                      className={`relative w-full h-full rounded-full flex items-center justify-center ${
                        isPlayingThis ? "animate-[spin_9s_linear_infinite]" : ""
                      }`}
                    >
                      {/* 同心圆反光凹槽 (Grooves) */}
                      <div className="absolute inset-3 rounded-full border border-white/[0.04]" />
                      <div className="absolute inset-7 rounded-full border border-white/[0.03]" />
                      <div className="absolute inset-13 rounded-full border border-white/[0.04]" />
                      <div className="absolute inset-19 rounded-full border border-white/[0.03]" />
                      <div className="absolute inset-26 rounded-full border border-white/[0.05]" />

                      {/* 彩虹反光遮罩 (Specular Shine) */}
                      <div
                        className="absolute inset-0 rounded-full opacity-25 pointer-events-none"
                        style={{
                          background:
                            "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.3) 55deg, transparent 110deg, transparent 180deg, rgba(255,255,255,0.3) 235deg, transparent 290deg)",
                        }}
                      />

                      {/* 黑胶中心圆形专辑贴图 */}
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-white/20 shadow-inner">
                        <Image
                          src={card.cover || DEFAULT_COVER_SRC}
                          alt="label"
                          fill
                          sizes="96px"
                          className="object-cover"
                          unoptimized
                        />
                        <div className="absolute inset-0 m-auto w-3.5 h-3.5 rounded-full bg-[#0d0d0d] border border-zinc-400 shadow-md" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ─── 2. 1:1 实体拟真黑胶封套 (LP Sleeve Jacket - 360x360px，极简方正圆角) ─── */}
                <div
                  className="relative w-[360px] h-[360px] rounded-[14px] overflow-hidden bg-[#1c1c1e] shadow-[0_32px_80px_rgba(0,0,0,0.85)] border border-white/[0.12] z-10 transition-transform duration-300 group-hover:shadow-[0_40px_96px_rgba(0,0,0,0.95)]"
                  style={{ willChange: "transform" }}
                >
                  {/* 左侧书脊折光微线 */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-r from-white/30 via-white/10 to-transparent z-20 pointer-events-none" />

                  {/* 右侧开口暗黑内衬阴影 */}
                  <div className="absolute right-0 top-0 bottom-0 w-[5px] bg-gradient-to-l from-black/85 to-transparent z-20 pointer-events-none" />

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

                  {/* 焦点封套：底部渐变 + 歌名/歌手 */}
                  {isCenter ? (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent flex flex-col justify-between p-6 z-20">
                      {/* 顶部播放波形 */}
                      <div className="flex items-center justify-end">
                        {isPlayingThis && (
                          <div className="flex items-center gap-1 bg-black/45 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15">
                            <span className="w-1 h-3 bg-[#2997ff] rounded-full animate-[pulse_0.8s_ease-in-out_infinite]" />
                            <span className="w-1 h-4.5 bg-[#2997ff] rounded-full animate-[pulse_1.2s_ease-in-out_infinite]" />
                            <span className="w-1 h-2.5 bg-[#2997ff] rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                          </div>
                        )}
                      </div>

                      {/* 中间播放/暂停触感按钮 (64px 高透磨砂) */}
                      <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-95 group-hover:scale-100">
                        <div className="w-16 h-16 rounded-full bg-white/25 hover:bg-white/35 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-2xl">
                          {isPlayingThis ? (
                            <Pause className="w-7 h-7 fill-white" />
                          ) : (
                            <Play className="w-7 h-7 fill-white ml-1" />
                          )}
                        </div>
                      </div>

                      {/* 底部歌名与歌手 */}
                      <div className="min-w-0 text-left">
                        <h3 className="text-[20px] font-bold text-white tracking-tight truncate leading-snug drop-shadow-md">
                          {card.title}
                        </h3>
                        <p className="text-[13.5px] text-[#86868b] font-medium truncate mt-0.5">
                          {card.artist}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* 两翼卡片暗化遮罩 */
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-end p-4 z-20">
                      <p className="text-[11.5px] text-white/60 truncate font-medium">
                        {card.title}
                      </p>
                    </div>
                  )}
                </div>

                {/* ─── 3. 钢琴烤漆级高斯镜面倒影 (35% 高度) ─── */}
                <div
                  className="relative w-[360px] overflow-hidden pointer-events-none mt-2 select-none z-0"
                  style={{
                    height: SLEEVE_SIZE * 0.35,
                    transform: "scaleY(-1)",
                    opacity: isCenter ? 0.35 : 0.12,
                    maskImage:
                      "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 75%)",
                    WebkitMaskImage:
                      "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 75%)",
                    filter: "blur(2px)",
                  }}
                >
                  <Image
                    src={card.cover || DEFAULT_COVER_SRC}
                    alt="reflection"
                    fill
                    sizes="360px"
                    className="object-cover rounded-[14px]"
                    unoptimized
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
