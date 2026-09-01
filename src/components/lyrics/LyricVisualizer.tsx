"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, Search, Music2 } from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { useBilingualLyricParser } from "@/hooks/useBilingualLyricParser";
import { useLyricSettingsStore } from "@/store/lyricSettingsStore";
import { useUIStore } from "@/store/uiStore";

interface LyricVisualizerProps {
  lyrics?: string;
  translationLyrics?: string;
  transliterationLyrics?: string;
}

export const LyricVisualizer: React.FC<LyricVisualizerProps> = ({
  lyrics: originalLyrics,
  translationLyrics,
  transliterationLyrics,
}) => {
  const currentTime = useAudioStore((state) => state.currentTime);
  const currentSong = useAudioStore((state) => state.currentSong);
  const openPanel = useUIStore((state) => state.openPanel);
  const shouldReduceMotion = useReducedMotion();
  const {
    showTranslation,
    showTransliteration,
    fontSize,
    fontFamily,
    fontWeight,
    opacity,
    alignment,
    currentLineColor,
    inactiveLineColor,
    translationColor,
    textShadow,
    textShadowColor,
    textShadowBlur,
    textStroke,
    textStrokeColor,
    textStrokeWidth,
  } = useLyricSettingsStore();

  const originalContent = originalLyrics || currentSong?.lyrics || "";
  const translationContent = translationLyrics || currentSong?.translationLyrics || "";
  const transliterationContent = transliterationLyrics || currentSong?.transliterationLyrics || "";

  const { lyrics, getCurrentLyricIndex, hasLyrics } = useBilingualLyricParser(
    originalContent,
    translationContent,
    transliterationContent
  );

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [offsetY, setOffsetY] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const currentIndex = getCurrentLyricIndex(currentTime);

  const alignmentClass = useMemo(() => {
    switch (alignment) {
      case "left":
        return "items-start text-left";
      case "right":
        return "items-end text-right";
      default:
        return "items-center text-center";
    }
  }, [alignment]);

  const fontFamilyClass = useMemo(() => {
    switch (fontFamily) {
      case "serif":
        return "font-serif";
      case "cursive":
        return "font-mono";
      default:
        return "font-sans";
    }
  }, [fontFamily]);

  // 判断是否为纯音乐/超短曲目（<= 3 行）
  const isInstrumentalOrShort = useMemo(() => {
    return hasLyrics && lyrics.merged.length <= 3;
  }, [hasLyrics, lyrics.merged.length]);

  useEffect(() => {
    lyricRefs.current = lyricRefs.current.slice(0, lyrics.merged.length);
  }, [lyrics.merged]);

  useEffect(() => {
    if (!lyricsContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(lyricsContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isInstrumentalOrShort) {
      setOffsetY(0);
      return;
    }

    if (currentIndex >= 0 && lyricRefs.current[currentIndex] && containerHeight > 0) {
      const element = lyricRefs.current[currentIndex];
      const elementTop = element!.offsetTop;
      const elementHeight = element!.offsetHeight;

      setOffsetY(containerHeight / 2 - elementTop - elementHeight / 2);
    } else if (currentIndex === -1 || containerHeight === 0) {
      setOffsetY(0);
    }
  }, [currentIndex, lyrics.merged, containerHeight, isInstrumentalOrShort]);

  const scrollTransition = useMemo(
    () => ({
      type: "spring" as const,
      stiffness: 80,
      damping: 25,
      mass: 1,
      restDelta: 0.01,
    }),
    []
  );

  return (
    <div
      ref={lyricsContainerRef}
      className="relative w-full h-full overflow-hidden px-8"
      style={{
        maskImage: isInstrumentalOrShort
          ? "none"
          : "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
        WebkitMaskImage: isInstrumentalOrShort
          ? "none"
          : "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
      }}
    >
      {!hasLyrics ? (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35 }}
          className={`w-full h-full flex flex-col justify-center ${alignmentClass} px-4 sm:px-12 text-center`}
        >
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center mb-4 text-white/80 shadow-[0_0_25px_rgba(255,255,255,0.1)]">
            <Music2 className="w-6 h-6" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-2 font-semibold">
            No Synced Lyrics
          </p>
          <p className="text-2xl font-bold text-white mb-2 tracking-tight">
            {currentSong?.title || "暂无歌词同步"}
          </p>
          <p className="text-sm text-white/70 mb-6 font-medium">
            {currentSong?.artist
              ? `${currentSong.artist} 还没有可用歌词`
              : "当前歌曲还没有可用歌词"}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => openPanel("lyricsSearch")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 shadow-lg transition-all active:scale-95"
            >
              <Search className="w-4 h-4" />
              搜索歌词
            </button>
            <button
              type="button"
              onClick={() => openPanel("lyricsImport")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/15 text-white text-sm font-medium hover:bg-white/25 border border-white/10 backdrop-blur-md transition-all active:scale-95"
            >
              <FileText className="w-4 h-4" />
              手动导入
            </button>
          </div>
        </motion.div>
      ) : isInstrumentalOrShort ? (
        /* 纯音乐 / 短歌词（<= 3 行）高亮度居中卡片展示 */
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full h-full flex flex-col justify-center items-center text-center px-4"
        >
          {/* 纯音乐光环微标 */}
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
            className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/20 flex items-center justify-center mb-6 text-white shadow-[0_0_35px_rgba(255,255,255,0.18)]"
          >
            <Music2 className="w-7 h-7 text-white" />
          </motion.div>

          <div className="space-y-4 max-w-lg">
            {lyrics.merged.map((lyric, idx) => {
              const isCurrent = idx === currentIndex || (currentIndex === -1 && idx === 0);
              return (
                <div key={`${lyric.time}-${idx}`} className="flex flex-col items-center">
                  <p
                    className={`${fontFamilyClass} tracking-tight transition-all duration-300`}
                    style={{
                      fontSize: isCurrent
                        ? `${Math.max(26, fontSize + 10)}px`
                        : `${Math.max(16, fontSize)}px`,
                      lineHeight: 1.3,
                      fontWeight: isCurrent ? Math.max(700, fontWeight) : 500,
                      color: isCurrent ? currentLineColor || "#ffffff" : "rgba(255,255,255,0.75)",
                      textShadow: isCurrent
                        ? "0 2px 14px rgba(0,0,0,0.7), 0 0 30px rgba(255,255,255,0.25)"
                        : "0 1px 8px rgba(0,0,0,0.5)",
                    }}
                  >
                    {lyric.original}
                  </p>

                  {isCurrent && (
                    <motion.div
                      layoutId="instrumentalUnderline"
                      className="mt-3.5 h-1 rounded-full bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_12px_rgba(255,255,255,0.8)]"
                      style={{ width: "48%" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        /* 标准长歌词滚动区（高对比度、清晰透亮） */
        <motion.div
          animate={{ y: offsetY }}
          transition={shouldReduceMotion ? { duration: 0 } : scrollTransition}
          className={`absolute top-0 left-0 right-0 flex flex-col ${alignmentClass} space-y-10 max-w-full mx-auto w-full`}
          style={{
            paddingTop: containerHeight / 2,
            paddingBottom: containerHeight / 2,
            willChange: "transform",
          }}
        >
          {lyrics.merged.map((lyric, idx) => {
            const isCurrent = idx === currentIndex;
            const distance = Math.abs(idx - currentIndex);
            const isNear = distance <= 3;

            // 优化非高亮行亮度：临近行保持 0.65~0.45 高清晰度，杜绝发暗看不清
            const targetOpacity = isCurrent
              ? 1.0
              : isNear
                ? Math.max(0.35, 0.65 - distance * 0.12)
                : 0.18;

            return (
              <motion.div
                key={`${lyric.time}-${idx}`}
                ref={(el) => {
                  lyricRefs.current[idx] = el;
                }}
                initial={false}
                animate={{
                  opacity: targetOpacity,
                  scale: isCurrent ? 1.04 : 1,
                  filter: isCurrent
                    ? "none"
                    : isNear
                      ? `blur(${Math.min(distance * 0.3, 1.5)}px)`
                      : "blur(2.5px)",
                }}
                transition={
                  shouldReduceMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }
                }
                onClick={() => useAudioStore.getState().seekTo(lyric.time)}
                title="点击跳转至此句播放"
                className={`flex flex-col ${alignmentClass} transition-colors duration-300 cursor-pointer hover:opacity-95 active:scale-98`}
              >
                <p
                  className={`${fontFamilyClass} leading-snug tracking-tight`}
                  style={{
                    fontSize: isCurrent
                      ? `${Math.max(26, fontSize + 10)}px`
                      : `${Math.max(17, fontSize)}px`,
                    lineHeight: 1.3,
                    fontWeight: isCurrent
                      ? Math.max(700, fontWeight)
                      : Math.max(500, fontWeight - 100),
                    color: isCurrent
                      ? currentLineColor || "#ffffff"
                      : inactiveLineColor || "rgba(255,255,255,0.65)",
                    textShadow: isCurrent
                      ? textShadow
                        ? `0 2px 14px rgba(0,0,0,0.7), 0 0 ${textShadowBlur}px ${textShadowColor || "rgba(255,255,255,0.25)"}`
                        : "0 2px 10px rgba(0,0,0,0.6)"
                      : "0 1px 6px rgba(0,0,0,0.4)",
                    WebkitTextStroke:
                      isCurrent && textStroke ? `${textStrokeWidth}px ${textStrokeColor}` : "none",
                  }}
                >
                  {lyric.original}
                  {isCurrent && (
                    <motion.span
                      aria-hidden="true"
                      className="mx-auto mt-2.5 block h-0.5 rounded-full"
                      initial={shouldReduceMotion ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4 }}
                      style={{
                        width: "52%",
                        transformOrigin:
                          alignment === "right"
                            ? "right"
                            : alignment === "left"
                              ? "left"
                              : "center",
                        background: currentLineColor || "#ffffff",
                        boxShadow: `0 0 10px ${currentLineColor || "#ffffff"}`,
                      }}
                    />
                  )}
                </p>

                {showTranslation && lyric.translation && (
                  <p
                    className={`${fontFamilyClass} mt-3.5 font-medium`}
                    style={{
                      fontSize: isCurrent
                        ? `${Math.max(16, fontSize)}px`
                        : `${Math.max(14, fontSize - 3)}px`,
                      lineHeight: 1.4,
                      color: isCurrent
                        ? translationColor || "rgba(255,255,255,0.9)"
                        : "rgba(255,255,255,0.55)",
                    }}
                  >
                    {lyric.translation}
                  </p>
                )}

                {showTransliteration && lyric.transliteration && (
                  <p
                    className={`${fontFamilyClass} mt-1.5 italic font-light`}
                    style={{
                      fontSize: isCurrent
                        ? `${Math.max(14, fontSize - 3)}px`
                        : `${Math.max(12, fontSize - 6)}px`,
                      lineHeight: 1.4,
                      color: isCurrent ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.45)",
                    }}
                  >
                    {lyric.transliteration}
                  </p>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};
