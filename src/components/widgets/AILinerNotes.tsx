"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { useLinerNotesStore } from "@/store/linerNotesStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useAIAgentStore } from "@/store/useAIAgentStore";

export const AILinerNotes: React.FC = () => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const { getNotes, isGenerating } = useLinerNotesStore();
  const { points } = useEmotionStore();

  const [displayNote, setDisplayNote] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchNotesForCurrentSong = useCallback(
    async (force = false) => {
      if (!currentSong) return;

      const emotionPoint = points.find((p) => p.id === currentSong.id);
      try {
        const result = await getNotes(
          currentSong.artist,
          currentSong.title,
          currentSong.lyrics,
          emotionPoint ? { x: emotionPoint.x, y: emotionPoint.y } : undefined,
          force
        );
        if (result) {
          setDisplayNote(result);
        }
      } catch (err) {
        console.warn("[AILinerNotes] fetch failed:", err);
      }
    },
    [currentSong, points, getNotes]
  );

  useEffect(() => {
    if (!mounted) return;

    if (currentSong?.id) {
      fetchNotesForCurrentSong(false);
    } else {
      setDisplayNote(null);
    }
  }, [mounted, currentSong?.id, currentSong?.artist, currentSong?.title, fetchNotesForCurrentSong]);

  const handleOpenAIChat = () => {
    if (!currentSong) return;
    const prompt = displayNote
      ? `请深度解析《${currentSong.title}》（${currentSong.artist}）这首歌曲的情感内涵与这句通感评语：“${displayNote}”`
      : `请帮我深度解析《${currentSong.title}》（${currentSong.artist}）这首歌的创作背景与情感表达。`;
    const agentStore = useAIAgentStore.getState();
    agentStore.openPanel();
    agentStore.sendMessage(prompt);
  };

  if (!mounted || !currentSong) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="fixed bottom-28 left-8 z-40 max-w-[300px] pointer-events-auto select-none"
    >
      <div className="flex flex-col gap-2.5">
        {/* 顶部极简微标 */}
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
          {isGenerating ? (
            <Loader2 className="w-3 h-3 text-cyan-300 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3 text-cyan-300/80" />
          )}
          <span>AI 情感洞察</span>
        </div>

        {/* 内容展示区：无边框底色纯净通感切片 */}
        <AnimatePresence mode="wait">
          {isGenerating && !displayNote ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-1.5 py-1 pl-1"
            >
              <div className="h-3 w-48 bg-white/[0.06] animate-pulse rounded" />
              <div className="h-3 w-32 bg-white/[0.06] animate-pulse rounded" />
            </motion.div>
          ) : (
            <motion.div
              key={currentSong.id + (displayNote || "")}
              initial={{ opacity: 0, filter: "blur(10px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              onClick={displayNote ? handleOpenAIChat : undefined}
              className="relative pl-1 cursor-pointer group"
              title={displayNote ? "点击唤起 AI 智能体深入探讨这首歌" : undefined}
            >
              <p className="text-sm md:text-[15px] font-light leading-relaxed text-white/80 italic font-serif group-hover:text-white transition-colors select-text">
                “{displayNote || "聆听旋律流转，感悟音符间的情感共鸣..."}”
              </p>

              {/* 左侧垂直渐变光带微引线 (Subtle left gradient glow trace) */}
              <div className="absolute -left-3 top-0 bottom-0 w-[1.5px] bg-gradient-to-b from-transparent via-white/30 to-transparent pointer-events-none" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
