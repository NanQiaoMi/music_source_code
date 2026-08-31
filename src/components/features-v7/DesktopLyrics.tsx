/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";

interface TimedLyricLine {
  time: number;
  text: string;
}

function isTimedLyricLine(value: unknown): value is TimedLyricLine {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TimedLyricLine).time === "number" &&
    typeof (value as TimedLyricLine).text === "string"
  );
}

function DesktopLyricsContent() {
  const currentSong = useAudioStore((state) => state.currentSong);
  const currentTime = useAudioStore((state) => state.currentTime);

  const currentLyric = useMemo(() => {
    const lyrics = currentSong?.lyrics;
    if (!lyrics) {
      return currentSong?.title || "";
    }

    try {
      const parsedLyrics: unknown = typeof lyrics === "string" ? JSON.parse(lyrics) : lyrics;
      const lyricArray = Array.isArray(parsedLyrics) ? parsedLyrics.filter(isTimedLyricLine) : [];
      if (lyricArray.length === 0) {
        return currentSong?.title || "";
      }

      const activeLyric = lyricArray.find((l, i) => {
        const next = lyricArray[i + 1];
        return currentTime >= l.time && (!next || currentTime < next.time);
      });

      if (activeLyric) {
        return activeLyric.text;
      }
    } catch {
      return currentSong?.title || "";
    }

    return currentSong?.title || "";
  }, [currentTime, currentSong]);

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentLyric}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="text-center px-8"
        >
          <div
            className="text-4xl md:text-5xl font-bold text-white drop-shadow-2xl"
            style={{
              textShadow: "0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.3)",
            }}
          >
            {currentLyric}
          </div>
          {currentSong && (
            <div className="mt-4 text-xl text-white/70 font-medium">
              {currentSong.artist} - {currentSong.title}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function DesktopLyrics() {
  if (typeof window === "undefined" || !window.isDesktopLyricsMode) {
    return null;
  }

  return <DesktopLyricsContent />;
}
