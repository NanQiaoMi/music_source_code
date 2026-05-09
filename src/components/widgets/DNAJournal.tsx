"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  Zap,
  Calendar,
  ShieldCheck,
  RefreshCcw,
  Loader2,
  BrainCircuit,
  Activity,
  Share2,
  Download,
  X,
} from "lucide-react";
import { useKnowledgeStore } from "@/store/knowledgeStore";
import { useEmotionStore } from "@/store/emotionStore";
import { useGlassToast } from "@/components/shared/GlassToast";
import { useAIStore } from "@/store/aiStore";

export const DNAJournal: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { dnaJournal, isLoading, generateDNAJournal } = useKnowledgeStore();
  const { points } = useEmotionStore();
  const { showToast } = useGlassToast();
  const { isEnabled } = useAIStore();
  const [isHovered, setIsHovered] = useState(false);

  const handleGenerate = () => {
    if (!isEnabled) {
      showToast("AI 功能已暂停", "warning");
      return;
    }
    const taggedPoints = points.filter((p) => p.isTagged);
    if (taggedPoints.length === 0) {
      showToast("请先在星图中标记一些歌曲以开启基因测序", "warning");
      return;
    }

    const totalSongs = taggedPoints.length;
    const avgV = taggedPoints.reduce((acc, p) => acc + (p.x || 0), 0) / totalSongs;
    const avgE = taggedPoints.reduce((acc, p) => acc + (p.y || 0), 0) / totalSongs;

    const genres = Array.from(new Set(taggedPoints.flatMap((p) => p.tags || [])));
    let dominantQuadrant = "Q1";
    if (avgV < 0 && avgE >= 0) dominantQuadrant = "Q2";
    else if (avgV < 0 && avgE < 0) dominantQuadrant = "Q3";
    else if (avgV >= 0 && avgE < 0) dominantQuadrant = "Q4";

    generateDNAJournal({
      totalSongs,
      averageValence: avgV,
      averageEnergy: avgE,
      dominantQuadrant,
      genres,
    });
  };

  const handleShare = () => {
    showToast("正在加密导出审美档案...", "info");
    setTimeout(() => {
      showToast("档案已保存至剪贴板，可前往社交平台分享", "success");
    }, 1500);
  };

  const formattedDate = dnaJournal
    ? new Date(dnaJournal.timestamp).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      })
    : new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "numeric", day: "numeric" });

  return (
    <div
      className="relative w-full group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

      <div className="relative p-10 rounded-[40px] bg-black/60 backdrop-blur-3xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] pointer-events-none mix-blend-overlay" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />

        {/* Header Section */}
        <div className="flex items-start justify-between mb-12 relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3 h-3 text-indigo-400 animate-pulse" />
              <span className="text-[10px] font-black tracking-[0.5em] text-white/80 uppercase">
                听觉基因解构报告
              </span>
            </div>
            <span className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase italic">
              NEURAL IDENTITY JOURNAL
            </span>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ rotate: 180, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleGenerate}
              disabled={isLoading}
              className={`p-2.5 rounded-2xl bg-white/5 text-white/30 hover:text-indigo-400 transition-all border border-white/5 hover:border-indigo-500/20 ${isLoading ? "animate-spin" : ""}`}
              title="重新测序"
            >
              <RefreshCcw className="w-4 h-4" />
            </motion.button>
            {dnaJournal && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleShare}
                className="p-2.5 rounded-2xl bg-white/5 text-white/30 hover:text-emerald-400 transition-all border border-white/5 hover:border-emerald-500/20"
                title="分享档案"
              >
                <Share2 className="w-4 h-4" />
              </motion.button>
            )}
            {onClose && (
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2.5 rounded-2xl bg-white/5 text-white/30 hover:text-red-400 transition-all border border-white/5 hover:border-red-500/20"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Main Identity Area */}
        <div className="space-y-12 relative z-10 min-h-[260px] flex flex-col justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-6 py-12">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <div className="text-[10px] font-black tracking-[0.6em] text-white/40 uppercase">
                  Decoding Neural Signals...
                </div>
                <div className="text-[8px] font-mono text-white/20 uppercase tracking-widest italic">
                  Aesthetic DNA Matrix Initialization
                </div>
              </div>
            </div>
          ) : !dnaJournal ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-8">
              <div className="w-20 h-20 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center group-hover:border-indigo-500/30 transition-all">
                <Fingerprint className="w-10 h-10 text-white/10 group-hover:text-indigo-500/40 transition-all" />
              </div>
              <div className="space-y-4">
                <div className="text-sm font-black text-white/40 uppercase tracking-[0.3em] italic">
                  暂未建立神经连接
                </div>
                <button
                  onClick={handleGenerate}
                  className="px-8 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                >
                  开启初始化协议 (RE-SYNC)
                </button>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12"
            >
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_15px_#6366f1]" />
                  <span className="text-[11px] font-black tracking-[0.5em] text-indigo-400 uppercase">
                    身份：{dnaJournal.archetype}
                  </span>
                </div>
                <div className="pl-6 border-l-2 border-indigo-500/20">
                  <h3 className="text-2xl md:text-3xl font-serif italic text-white leading-snug tracking-tight">
                    “{dnaJournal.motto}”
                  </h3>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-3 opacity-40">
                  <BrainCircuit className="w-4 h-4 text-indigo-400" />
                  <span className="text-[9px] font-black tracking-[0.4em] uppercase text-white/60">
                    深度解构 / NEURAL ANALYSIS
                  </span>
                </div>
                <p className="text-[13px] text-white/50 leading-relaxed font-medium italic selection:bg-indigo-500/30 pl-1">
                  {dnaJournal.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-12 pt-10 border-t border-white/5">
                <div className="space-y-2.5">
                  <div className="text-[8px] font-black tracking-widest uppercase text-white/20 flex items-center gap-2">
                    <Zap className="w-2.5 h-2.5" /> 主导流派 / DOMINANCE
                  </div>
                  <div className="text-[12px] font-bold tracking-[0.1em] text-white/80 uppercase truncate">
                    {dnaJournal.genre}
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="text-[8px] font-black tracking-widest uppercase text-white/20 flex items-center gap-2">
                    <Calendar className="w-2.5 h-2.5" /> 解析时间 / TIMESTAMP
                  </div>
                  <div className="text-[12px] font-bold tracking-[0.1em] text-white/80">
                    {formattedDate}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer Section */}
        <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[9px] font-black tracking-[0.4em] uppercase text-white/20 italic">
                Neural Identity Protocol v1.0
              </span>
            </div>
            {dnaJournal && (
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="text-[9px] font-black text-indigo-400/60 hover:text-indigo-400 uppercase tracking-[0.2em] transition-all flex items-center gap-2 group/ref"
              >
                <RefreshCcw
                  className={`w-3 h-3 ${isLoading ? "animate-spin" : "group-hover/ref:rotate-180 transition-transform duration-500"}`}
                />
                重新解算数据
              </button>
            )}
          </div>
          <div className="flex gap-1.5 h-3 items-end">
            {[0.4, 0.7, 0.2, 0.9, 0.5, 0.3].map((h, i) => (
              <motion.div
                key={i}
                animate={{ height: [`${h * 100}%`, "100%", `${h * 100}%`] }}
                transition={{ duration: 1.5 + i * 0.2, repeat: Infinity, ease: "easeInOut" }}
                className="w-1 bg-indigo-500/30 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.2)]"
              />
            ))}
          </div>
        </div>

        {/* Scanning Line Effect */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ top: "-10%" }}
              animate={{ top: "110%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_20px_#6366f1] z-20 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* L-Shape Tactical Corners */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/10 rounded-tl-[40px]" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/10 rounded-tr-[40px]" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/10 rounded-bl-[40px]" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/10 rounded-br-[40px]" />
      </div>
    </div>
  );
};
