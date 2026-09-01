"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, RotateCcw, Copy, Check, MessageSquare } from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { useLinerNotesStore } from "@/store/linerNotesStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useAIAgentStore } from "@/store/useAIAgentStore";

export const AILinerNotes: React.FC = () => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const { getNotes, isGenerating } = useLinerNotesStore();
  const { points } = useEmotionStore();

  const [displayNote, setDisplayNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  const handleCopy = () => {
    if (!displayNote) return;
    navigator.clipboard?.writeText(displayNote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenAIChat = () => {
    if (!currentSong) return;
    const prompt = displayNote
      ? `请深度解析《${currentSong.title}》（${currentSong.artist}）这首歌曲的情感内涵与这句通感评语：“${displayNote}”`
      : `请帮我深度解析《${currentSong.title}》（${currentSong.artist}）这首歌的创作背景与情感表达。`;
    const agentStore = useAIAgentStore.getState();
    agentStore.setIsPanelOpen(true);
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
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="fixed bottom-28 left-8 z-40 max-w-[320px] pointer-events-auto"
    >
      <div className="rounded-2xl bg-black/40 backdrop-blur-2xl border border-white/[0.14] p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:bg-black/55 group">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-white/80">
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 text-cyan-300 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            )}
            <span>AI 情感洞察</span>
          </div>

          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            {displayNote && (
              <button
                type="button"
                onClick={handleOpenAIChat}
                className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                title="向 AI 提问并深度探讨此感悟"
              >
                <MessageSquare className="w-3 h-3 text-cyan-300" />
              </button>
            )}
            {displayNote && (
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                title={copied ? "已复制" : "复制感悟"}
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => fetchNotesForCurrentSong(true)}
              disabled={isGenerating}
              className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors disabled:opacity-40"
              title="重新生成感悟"
            >
              <RotateCcw className={`w-3 h-3 ${isGenerating ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* 内容展示区 */}
        <AnimatePresence mode="wait">
          {isGenerating && !displayNote ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-1.5 py-1"
            >
              <div className="h-3.5 w-full bg-white/[0.08] animate-pulse rounded-md" />
              <div className="h-3.5 w-3/4 bg-white/[0.08] animate-pulse rounded-md" />
            </motion.div>
          ) : (
            <motion.div
              key={currentSong.id + (displayNote || "")}
              initial={{ opacity: 0, filter: "blur(6px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(6px)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              onClick={displayNote ? handleOpenAIChat : undefined}
              className={displayNote ? "cursor-pointer group/text" : ""}
              title={displayNote ? "点击唤起 AI 智能体深入探讨这首歌" : undefined}
            >
              <p className="text-[12.5px] leading-relaxed text-white/90 font-light tracking-wide italic select-text group-hover/text:text-cyan-200 transition-colors">
                “{displayNote || "聆听旋律流转，感悟音符间的情感共鸣..."}”
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
