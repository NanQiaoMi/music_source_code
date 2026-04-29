"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";

export function DesktopLyrics() {
  const currentSong = useAudioStore(state => state.currentSong);
  const currentTime = useAudioStore(state => state.currentTime);
  const [currentLyric, setCurrentLyric] = useState<string>("");

  useEffect(() => {
    if (!window.isDesktopLyricsMode) return;
  }, []);

  useEffect(() => {
    const lyrics = currentSong?.lyrics;
    if (!lyrics) {
      setCurrentLyric(currentSong?.title || "");
      return;
    }

    try {
      const lyricArray = typeof lyrics === 'string' ? JSON.parse(lyrics) : lyrics;
      if (!Array.isArray(lyricArray) || lyricArray.length === 0) {
        setCurrentLyric(currentSong?.title || "");
        return;
      }

      const activeLyric = lyricArray.find((l: any, i: number) => {
        const next = lyricArray[i + 1];
        return currentTime >= l.time && (!next || currentTime < next.time);
      });

      if (activeLyric) {
        setCurrentLyric(activeLyric.text);
      }
    } catch {
      setCurrentLyric(currentSong?.title || "");
    }
  }, [currentTime, currentSong]);

  if (!window.isDesktopLyricsMode) return null;

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
          <div className="text-4xl md:text-5xl font-bold text-white drop-shadow-2xl"
               style={{
                 textShadow: "0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.3)"
               }}>
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
