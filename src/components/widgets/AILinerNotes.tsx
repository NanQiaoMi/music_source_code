"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { useLinerNotesStore } from "@/store/linerNotesStore";
import { useAIStore } from "@/store/aiStore";
import { useEmotionStore } from "@/store/emotionStore";

export const AILinerNotes: React.FC = () => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const { notes, getNotes, isGenerating, clearCache } = useLinerNotesStore();
  const { points } = useEmotionStore();
  const { isEnabled, activeConfigId } = useAIStore();
  const [displayNote, setDisplayNote] = useState<string | null>(null);

  useEffect(() => {
    if (currentSong && activeConfigId && isEnabled) {
      const emotionPoint = points.find((p) => p.id === currentSong.id);
      const fetchNotes = async () => {
        const result = await getNotes(
          currentSong.artist,
          currentSong.title,
          currentSong.lyrics,
          emotionPoint ? { x: emotionPoint.x, y: emotionPoint.y } : undefined
        );
        setDisplayNote(result);
      };
      fetchNotes();
    } else {
      setDisplayNote(null);
    }
  }, [currentSong?.id, activeConfigId, isEnabled, getNotes, points]);

  if (!isEnabled || !activeConfigId || (!displayNote && !isGenerating)) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-32 left-8 z-40 max-w-[280px] pointer-events-none"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
          {isGenerating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          <span>AI Emotional Insight</span>
          <button
            onClick={() => {
              if (currentSong && activeConfigId) {
                const emotionPoint = points.find((p) => p.id === currentSong.id);
                getNotes(
                  currentSong.artist,
                  currentSong.title,
                  currentSong.lyrics,
                  emotionPoint ? { x: emotionPoint.x, y: emotionPoint.y } : undefined,
                  true
                ).then((result) => setDisplayNote(result));
              }
            }}
            className="ml-auto p-1 hover:bg-white/10 rounded-md transition-colors pointer-events-auto"
            title="重新生成感悟"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSong?.id + (displayNote || "")}
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative"
          >
            {isGenerating ? (
              <div className="flex flex-col gap-2">
                <div className="h-3 w-48 bg-white/5 animate-pulse rounded" />
                <div className="h-3 w-32 bg-white/5 animate-pulse rounded" />
              </div>
            ) : (
              <p className="text-sm md:text-base font-light leading-relaxed text-white/80 italic font-serif">
                “{displayNote}”
              </p>
            )}

            {/* Subtle left border decoration */}
            <div className="absolute -left-4 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent" />
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
