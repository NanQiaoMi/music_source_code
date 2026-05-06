"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scroll, Sparkles, X, Loader2, Quote, Brain, RotateCcw, bug } from "lucide-react";
import { useKnowledgeStore } from "@/store/knowledgeStore";
import { useAudioStore } from "@/store/audioStore";
import { useLyricsCoverStore } from "@/store/lyricsCoverStore";

export const MusicBackstory: React.FC = () => {
  const { currentSong } = useAudioStore();
  const { backstories, metaphors, isLoading, fetchBackstory, fetchMetaphors, lastRawResponse } = useKnowledgeStore();
  const { loadLyric } = useLyricsCoverStore();
  
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeTab, setActiveTab] = useState<"backstory" | "metaphors">("backstory");
  const [showDebug, setShowDebug] = useState(false);

  const currentKey = currentSong ? `${currentSong.artist}-${currentSong.title}`.toLowerCase() : "";
  const backstoryData = backstories[currentKey];
  const metaphorData = metaphors[currentKey] || [];
  const hasData = !!(backstoryData || (metaphorData && metaphorData.length > 0));

  // --- DERIVE LYRICS ---
  const lyricsText = useMemo(() => {
    if (!currentSong) return "";
    if (currentSong.lyrics && typeof currentSong.lyrics === 'string' && currentSong.lyrics.length > 5) {
      return currentSong.lyrics.slice(0, 1200);
    }
    const lyricData = loadLyric(currentSong.id);
    if (lyricData && lyricData.lines && lyricData.lines.length > 0) {
      return lyricData.lines.map(l => l.text).join("\n").slice(0, 1200);
    }
    return "";
  }, [currentSong?.id, currentSong?.lyrics, loadLyric]);

  const lyricCount = lyricsText.length;

  const handleFetch = (force = false) => {
    if (currentSong) {
      if (activeTab === "backstory") {
        fetchBackstory(currentSong.title, currentSong.artist, force);
      } else {
        fetchMetaphors(currentSong.title, currentSong.artist, lyricsText, force);
      }
    }
  };

  const handleReveal = () => {
    handleFetch();
    setIsVisible(true);
  };

  useEffect(() => {
    if (isVisible && currentSong) {
      handleFetch();
    }
  }, [activeTab, isVisible, currentSong?.id]);

  if (!currentSong) return null;

  return (
    <>
      <div className="fixed bottom-36 right-8 z-[100]">
        <motion.div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative flex items-center"
        >
          <motion.button
            layout
            onClick={handleReveal}
            whileTap={{ scale: 0.95 }}
            className={`
              relative h-12 flex items-center gap-3 px-4 rounded-full 
              backdrop-blur-3xl border transition-all duration-500
              ${isVisible ? "opacity-0 pointer-events-none" : "opacity-100"}
              ${isHovered 
                ? "bg-white/10 border-white/20 shadow-[0_0_30px_rgba(168,85,247,0.3)]" 
                : "bg-black/20 border-white/10 shadow-2xl"
              }
            `}
          >
            <div className="relative">
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              ) : (
                <motion.div animate={isHovered ? { rotate: [0, -10, 10, 0] } : {}}>
                  <Brain className={`w-5 h-5 ${hasData ? "text-purple-400" : "text-white/40"}`} />
                </motion.div>
              )}
            </div>

            <AnimatePresence>
              {isHovered && (
                <motion.span
                  initial={{ opacity: 0, x: -10, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: "auto" }}
                  exit={{ opacity: 0, x: -10, width: 0 }}
                  className="text-[11px] font-black tracking-[0.2em] text-white/80 uppercase whitespace-nowrap overflow-hidden"
                >
                  {activeTab === "backstory" ? "考古 / ARCHIVE" : "意象 / POETRY"}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-48 right-8 w-85 z-[1001]"
          >
            <div className="bg-black/85 backdrop-blur-[64px] p-8 rounded-[32px] border border-white/10 shadow-[0_60px_120px_rgba(0,0,0,0.8)] relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="flex bg-white/5 p-1 rounded-2xl">
                      <button onClick={() => setActiveTab("backstory")} className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${activeTab === "backstory" ? "bg-white/10 text-white" : "text-white/20"}`}>Archive</button>
                      <button onClick={() => setActiveTab("metaphors")} className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${activeTab === "metaphors" ? "bg-white/10 text-white" : "text-white/20"}`}>Poetry</button>
                    </div>
                    <motion.button onClick={() => handleFetch(true)} className={`p-2 rounded-xl bg-white/5 text-white/30 hover:text-white/60 transition-all ${isLoading ? "animate-spin" : ""}`}><RotateCcw className="w-3.5 h-3.5" /></motion.button>
                  </div>
                  <button onClick={() => setIsVisible(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
                </div>

                <div className="min-h-[160px] flex flex-col justify-center">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center gap-4 opacity-40">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                      <span className="text-[10px] tracking-[0.4em] text-white font-black uppercase">Cognitive Extraction...</span>
                    </div>
                  ) : activeTab === "backstory" ? (
                    <motion.div key="backstory" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="flex items-center gap-2 mb-2"><Scroll className="w-3 h-3 text-purple-400" /><span className="text-[9px] font-black text-purple-400/60 uppercase tracking-widest">Historical context</span></div>
                      <p className="text-[15px] text-white/90 leading-relaxed font-serif italic">“{backstoryData?.content || "这段往事，暂且消失在数字的尘埃中。"}”</p>
                    </motion.div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2"><Quote className="w-3 h-3 text-blue-400" /><span className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest">Poetic analysis</span></div>
                        {lyricCount > 0 && <span className="text-[8px] text-white/20 font-medium uppercase tracking-tighter">Linked: {lyricCount} chars</span>}
                      </div>
                      
                      {metaphorData && metaphorData.length > 0 ? metaphorData.map((m, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="group/item">
                          <div className="text-[11px] font-black text-white/40 group-hover/item:text-purple-400 transition-colors uppercase tracking-[0.2em] mb-1">{m.term}</div>
                          <div className="text-[13px] text-white/60 leading-relaxed italic border-l border-white/5 pl-3">{m.meaning}</div>
                        </motion.div>
                      )) : (
                        <div className="flex flex-col items-center justify-center py-10 opacity-30 gap-4">
                          <div className="text-center italic text-xs tracking-widest uppercase px-4">{lyricCount === 0 ? "未检测到有效歌词源" : "未捕捉到共鸣意象"}</div>
                          
                          {lastRawResponse && (
                            <button 
                              onClick={() => setShowDebug(!showDebug)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black text-white/60 uppercase tracking-widest transition-all"
                            >
                              {showDebug ? "关闭调试信息" : "查看 AI 原始响应"}
                            </button>
                          )}
                        </div>
                      )}

                      {showDebug && lastRawResponse && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 max-h-40 overflow-y-auto">
                          <div className="text-[8px] font-mono text-white/40 break-all whitespace-pre-wrap">{lastRawResponse}</div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between opacity-40">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    <span className="text-[8px] font-black tracking-widest uppercase text-white">Mimi Intelligence Protocol</span>
                  </div>
                  <span className="text-[8px] font-medium tracking-widest uppercase text-white">ID: {currentKey.slice(0, 8)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
