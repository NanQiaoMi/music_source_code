"use client";

import React, { useEffect, useRef, useCallback, useState, memo } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { useBilingualLyricParser } from "@/hooks/useBilingualLyricParser";
import { useLyricSettingsStore } from "@/store/lyricSettingsStore";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useAlbumTheme } from "@/hooks/useAlbumTheme";

import { Settings, ChevronDown } from "lucide-react";
import { LyricSettingsPanel } from "./LyricSettingsPanel";

interface FullscreenLyricsProps {
  isOpen: boolean;
  onClose: () => void;
  lyrics?: string;
  translationLyrics?: string;
  transliterationLyrics?: string;
}

// 动画变体配置 - 优化版
const getAnimationVariants = (
  type: string,
  speed: number,
  intensity: number
): { container: Variants; item: Variants } => {
  const duration = 0.6 / speed;
  const scaleIntensity = 1 + 0.08 * intensity;

  switch (type) {
    case "scroll":
      return {
        container: {
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: duration * 0.25 },
          },
          exit: { opacity: 0 },
        },
        item: {
          hidden: { opacity: 0, y: 40 * intensity, scale: 0.95 },
          visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              duration,
              ease: [0.215, 0.61, 0.355, 1],
            },
          },
          exit: {
            opacity: 0,
            y: -40 * intensity,
            scale: 0.95,
            transition: { duration: duration * 0.4, ease: [0.55, 0.055, 0.675, 0.19] },
          },
        },
      };

    case "rhythm":
      return {
        container: {
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: duration * 0.15 },
          },
          exit: { opacity: 0 },
        },
        item: {
          hidden: {
            opacity: 0,
            scale: 0.7,
            y: 25 * intensity,
            rotate: -3 * intensity,
          },
          visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            rotate: 0,
            transition: {
              duration: duration * 0.7,
              ease: [0.34, 1.56, 0.64, 1],
            },
          },
          exit: {
            opacity: 0,
            scale: 0.8,
            rotate: 2 * intensity,
            transition: { duration: duration * 0.25, ease: [0.55, 0.055, 0.675, 0.19] },
          },
        },
      };

    case "fade":
    default:
      return {
        container: {
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: duration * 0.35 },
          },
          exit: { opacity: 0 },
        },
        item: {
          hidden: { opacity: 0, y: 15 * intensity, filter: "blur(4px)" },
          visible: {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transition: {
              duration,
              ease: [0.25, 0.46, 0.45, 0.94],
            },
          },
          exit: {
            opacity: 0,
            y: -15 * intensity,
            filter: "blur(2px)",
            transition: { duration: duration * 0.45, ease: [0.55, 0.055, 0.675, 0.19] },
          },
        },
      };
  }
};

export const FullscreenLyrics: React.FC<FullscreenLyricsProps> = ({
  isOpen,
  onClose,
  lyrics: originalLyrics,
  translationLyrics,
  transliterationLyrics,
}) => {
  const currentTime = useAudioStore((state) => state.currentTime);
  const currentSong = useAudioStore((state) => state.currentSong);
  const isPlaying = useAudioStore((state) => state.isPlaying);
  const duration = useAudioStore((state) => state.duration);

  const { themeColors } = useAlbumTheme(currentSong?.cover);

  const { audioElement } = useAudioPlayer();

  const {
    showTranslation,
    showTransliteration,
    fontSize,
    lineHeight,
    fontFamily,
    fontWeight,
    opacity,
    alignment,
    animationType,
    animationSpeed,
    animationIntensity,
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

  const containerRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const currentIndex = getCurrentLyricIndex(currentTime);
  const [showSettings, setShowSettings] = useState(false);
  const [showHint, setShowHint] = useState(true);

  // 点击退出相关
  const lastClickTimeRef = useRef<number>(0);
  const clickCountRef = useRef<number>(0);
  const CLICK_DELAY = 300;

  // 隐藏提示
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setShowHint(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ESC 键退出全屏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  // 处理歌词区域点击 - 退出全屏
  const handleLyricsClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-settings-button]")) {
        return;
      }

      const now = Date.now();
      const timeSinceLastClick = now - lastClickTimeRef.current;

      if (timeSinceLastClick < CLICK_DELAY) {
        clickCountRef.current += 1;
        return;
      }

      clickCountRef.current = 1;
      lastClickTimeRef.current = now;

      onClose();
    },
    [onClose]
  );

  // 字体映射
  const fontFamilyClass = React.useMemo(() => {
    switch (fontFamily) {
      case "serif":
        return "font-serif";
      case "cursive":
        return "font-mono";
      default:
        return "font-sans";
    }
  }, [fontFamily]);

  // 对齐映射
  const alignmentClass = React.useMemo(() => {
    switch (alignment) {
      case "left":
        return "items-start text-left";
      case "right":
        return "items-end text-right";
      default:
        return "items-center text-center";
    }
  }, [alignment]);

  const lyricRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [offsetY, setOffsetY] = useState(0);

  // 初始化 refs 数组
  useEffect(() => {
    lyricRefs.current = lyricRefs.current.slice(0, lyrics.merged.length);
  }, [lyrics.merged]);

  const [containerHeight, setContainerHeight] = useState(0);

  // 监听容器大小变化
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

  // 计算偏移量以居中当前歌词
  useEffect(() => {
    if (currentIndex >= 0 && lyricRefs.current[currentIndex] && containerHeight > 0) {
      const element = lyricRefs.current[currentIndex];
      const elementTop = element!.offsetTop;
      const elementHeight = element!.offsetHeight;

      // 计算目标偏移量：容器中心 - 元素顶部 - 元素高度的一半
      const targetY = containerHeight / 2 - elementTop - elementHeight / 2;
      setOffsetY(targetY);
    } else if (currentIndex === -1 || containerHeight === 0) {
      setOffsetY(0);
    }
  }, [currentIndex, lyrics.merged, containerHeight]);

  // 动画配置
  const scrollTransition = React.useMemo(
    () => ({
      type: "spring" as const,
      stiffness: 80,
      damping: 25,
      mass: 1,
      restDelta: 0.01,
    }),
    []
  );

  if (!isOpen) return null;

  return (
    <div className="fullscreen-lyrics-root">
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-50 overflow-hidden"
      >
        {/* 背景层 - 动态主题色 */}
        <div className="absolute inset-0">
          {/* 专辑封面背景 */}
          {currentSong?.cover && (
            <div
              style={{
                backgroundImage: `url(${currentSong.cover})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(100px) brightness(0.25) saturate(1.2)",
                position: "absolute",
                inset: "-10%", // 稍微扩大范围防止边缘模糊缺失
              }}
            />
          )}

          {/* 动态主题色渐变 */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background: `linear-gradient(
                135deg, 
                ${themeColors.primary} 0%, 
                ${themeColors.secondary} 50%, 
                ${themeColors.accent} 100%
              )`,
            }}
          />

          {/* 渐变遮罩 - 增加层次感 */}
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* 设置按钮 */}
        <button
          data-settings-button
          onClick={() => setShowSettings(true)}
          className="absolute top-8 left-8 z-30 p-3 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 hover:bg-white/10 transition-all active:scale-95"
        >
          <Settings className="w-5 h-5 text-white/80" />
        </button>

        {/* 歌词显示区域 */}
        <div
          ref={lyricsContainerRef}
          onClick={handleLyricsClick}
          className="relative h-full w-full overflow-hidden px-8 cursor-pointer z-10"
          style={{
            opacity,
            maskImage: "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
          }}
        >
          {!hasLyrics ? (
            <div
              className={`h-full flex flex-col justify-center items-center ${alignmentClass} space-y-4`}
            >
              <p className={`${fontFamilyClass} text-white/60 text-2xl`}>暂无歌词</p>
              <p className={`${fontFamilyClass} text-white/40 text-sm`}>点击任意位置退出</p>
            </div>
          ) : (
            <motion.div
              animate={{ y: offsetY }}
              transition={scrollTransition}
              className={`absolute top-0 left-0 right-0 flex flex-col ${alignmentClass} space-y-10 max-w-5xl mx-auto w-full`}
              style={{
                paddingTop: containerHeight / 2,
                paddingBottom: containerHeight / 2,
                willChange: "transform",
              }}
            >
              {lyrics.merged.map((lyric, idx) => {
                const isCurrent = idx === currentIndex;
                const distance = Math.abs(idx - currentIndex);
                const isPast = idx < currentIndex;
                const isNear = distance <= 3;

                return (
                  <motion.div
                    key={`${lyric.time}-${idx}`}
                    ref={(el) => {
                      lyricRefs.current[idx] = el;
                    }}
                    initial={false}
                    animate={{
                      scale: isCurrent ? 1.05 : 1,
                      opacity: isCurrent ? 1 : isNear ? 0.4 - distance * 0.08 : 0.1,
                      filter: isCurrent ? "blur(0px)" : `blur(${Math.min(distance * 0.5, 4)}px)`,
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`flex flex-col ${alignmentClass} transition-colors duration-500`}
                  >
                    {/* 原文 */}
                    <p
                      className={`${fontFamilyClass} leading-snug tracking-tight`}
                      style={{
                        fontSize: isCurrent ? `${fontSize + 12}px` : `${fontSize}px`,
                        lineHeight: 1.2,
                        fontWeight: isCurrent ? fontWeight : Math.max(300, fontWeight - 200),
                        color: isCurrent ? currentLineColor : inactiveLineColor,
                        textShadow:
                          isCurrent && textShadow
                            ? `0 4px ${textShadowBlur}px ${textShadowColor}`
                            : "none",
                        WebkitTextStroke:
                          isCurrent && textStroke
                            ? `${textStrokeWidth}px ${textStrokeColor}`
                            : "none",
                      }}
                    >
                      {lyric.original}
                    </p>

                    {/* 翻译 */}
                    {showTranslation && lyric.translation && (
                      <p
                        className={`${fontFamilyClass} mt-4 font-medium opacity-80`}
                        style={{
                          fontSize: isCurrent ? `${fontSize}px` : `${fontSize - 4}px`,
                          lineHeight: 1.4,
                          color: isCurrent ? translationColor : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {lyric.translation}
                      </p>
                    )}

                    {/* 音译 */}
                    {showTransliteration && lyric.transliteration && (
                      <p
                        className={`${fontFamilyClass} mt-2 italic font-light opacity-60`}
                        style={{
                          fontSize: isCurrent ? `${fontSize - 4}px` : `${fontSize - 8}px`,
                          lineHeight: 1.4,
                          color: isCurrent ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
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

        {/* 底部歌曲信息 */}
        <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
          <h3 className="text-white/90 text-lg font-medium mb-1">
            {currentSong?.title || "未选择歌曲"}
          </h3>
          <p className="text-white/50 text-sm">{currentSong?.artist || ""}</p>
        </div>

        {/* 点击提示 */}
        <AnimatePresence>
          {showHint && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
              <ChevronDown className="w-5 h-5 text-white/30 animate-bounce" />
              <p className="text-white/30 text-xs">点击歌词区域退出全屏</p>
            </div>
          )}
        </AnimatePresence>

        {/* 进度指示器 */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div
            className="h-full bg-white/60"
            style={{
              width: `${(currentTime / (duration || 1)) * 100}%`,
            }}
          />
        </div>
      </motion.div>

      {/* 设置面板 */}
      <LyricSettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};
