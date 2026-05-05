"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { useBilingualLyricParser } from "@/hooks/useBilingualLyricParser";
import { useLyricSettingsStore } from "@/store/lyricSettingsStore";

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
  const currentTime = useAudioStore(state => state.currentTime);
  const currentSong = useAudioStore(state => state.currentSong);
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
    if (currentIndex >= 0 && lyricRefs.current[currentIndex] && containerHeight > 0) {
      const element = lyricRefs.current[currentIndex];
      const elementTop = element!.offsetTop;
      const elementHeight = element!.offsetHeight;
      
      const targetY = containerHeight / 2 - elementTop - elementHeight / 2;
      setOffsetY(targetY);
    } else if (currentIndex === -1 || containerHeight === 0) {
      setOffsetY(0);
    }
  }, [currentIndex, lyrics.merged, containerHeight]);

  const scrollTransition = React.useMemo(() => ({
    type: "spring" as const,
    stiffness: 80,
    damping: 25,
    mass: 1,
    restDelta: 0.01
  }), []);

  return (
    <div
      ref={lyricsContainerRef}
      className="relative w-full h-full overflow-hidden px-8"
      style={{
        maskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)",
        opacity,
      }}
    >
      {!hasLyrics ? (
        <div className={`w-full h-full flex flex-col justify-center items-center ${alignmentClass} px-12 text-center opacity-40`}>
          <p className="text-xl font-medium text-white mb-2">暂无歌词同步</p>
          <p className="text-sm text-white/50">该歌曲暂未找到匹配的歌词数据</p>
        </div>
      ) : (
        <motion.div
          animate={{ y: offsetY }}
          transition={scrollTransition}
          className={`absolute top-0 left-0 right-0 flex flex-col ${alignmentClass} space-y-10 max-w-full mx-auto w-full`}
          style={{ 
            paddingTop: containerHeight / 2, 
            paddingBottom: containerHeight / 2,
            willChange: "transform"
          }}
        >
          {lyrics.merged.map((lyric, idx) => {
            const isCurrent = idx === currentIndex;
            const distance = Math.abs(idx - currentIndex);
            const isNear = distance <= 3;

            return (
              <motion.div
                key={`${lyric.time}-${idx}`}
                ref={(el) => { lyricRefs.current[idx] = el; }}
                initial={false}
                animate={{
                  opacity: isCurrent ? 1 : isNear ? 0.4 - (distance * 0.08) : 0.1,
                  scale: isCurrent ? 1.05 : 1,
                  filter: isCurrent ? "blur(0px)" : `blur(${Math.min(distance * 0.5, 4)}px)`,
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`flex flex-col ${alignmentClass} transition-colors duration-500`}
              >
                <p
                  className={`${fontFamilyClass} leading-snug tracking-tight`}
                  style={{
                    fontSize: isCurrent ? `${fontSize + 12}px` : `${fontSize}px`,
                    lineHeight: 1.2,
                    fontWeight: isCurrent ? fontWeight : Math.max(300, fontWeight - 200),
                    color: isCurrent ? currentLineColor : inactiveLineColor,
                    textShadow: isCurrent && textShadow ? `0 4px ${textShadowBlur}px ${textShadowColor}` : "none",
                    WebkitTextStroke: isCurrent && textStroke ? `${textStrokeWidth}px ${textStrokeColor}` : "none",
                  }}
                >
                  {lyric.original}
                </p>

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
  );
};