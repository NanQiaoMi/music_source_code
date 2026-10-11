"use client";

import React, { memo } from "react";
import { motion, Variants } from "framer-motion";
import { useBilingualLyricParser } from "@/hooks/useBilingualLyricParser";
import { usePlaybackClock } from "@/hooks/usePlaybackClock";
import { Song } from "@/types/song";

interface FloatingOneLineLyricPreviewProps {
  currentSong: Song | null;
  onExpand: (e: React.MouseEvent) => void;
  variants?: Variants;
}

/**
 * 独立隔离的高频歌词叶子组件：
 * 内部自闭环订阅 currentTime，避免整个 FloatingExpandedState 大容器高频重渲染
 */
export const FloatingOneLineLyricPreview: React.FC<FloatingOneLineLyricPreviewProps> = memo(
  ({ currentSong, onExpand, variants }) => {
    const { currentTime } = usePlaybackClock();

    const { lyrics, getCurrentLyricIndex } = useBilingualLyricParser(
      currentSong?.lyrics,
      currentSong?.translationLyrics,
      currentSong?.transliterationLyrics
    );

    const lyricList = lyrics.merged;
    const currentLyricIndex = getCurrentLyricIndex(currentTime);
    const activeLyric =
      currentLyricIndex >= 0 ? lyricList[currentLyricIndex] : lyricList[0] || null;

    if (!activeLyric) return null;

    return (
      <motion.div
        variants={variants}
        className="px-1 text-center -mt-0.5 cursor-pointer"
        onClick={onExpand}
      >
        <p className="text-xs text-white/50 italic truncate tracking-tight">
          {activeLyric.original}
        </p>
      </motion.div>
    );
  }
);

FloatingOneLineLyricPreview.displayName = "FloatingOneLineLyricPreview";
