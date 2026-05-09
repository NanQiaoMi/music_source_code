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
} from "lucide-react";
import { useKnowledgeStore } from "@/store/knowledgeStore";
import { useEmotionStore } from "@/store/emotionStore";

export const AuditoryGene: React.FC = () => {
  const { dnaJournal, isLoading, generateDNAJournal } = useKnowledgeStore();
  const { points } = useEmotionStore();
  const [isHovered, setIsHovered] = useState(false);

  const handleGenerate = () => {
    const taggedPoints = points.filter((p) => p.isTagged);
    if (taggedPoints.length === 0) return;

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
      {/* Dynamic Glow Background */}
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

      <div className="relative p-10 rounded-[40px] bg-black/60 backdrop-blur-3xl border border-white/10 overflow-hidden shadow-2xl">
        {/* Grainy Texture & Grid */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] pointer-events-none mix-blend-overlay" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />

        {/* Header Section */}
        <div className="flex items-start justify-between mb-12 relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3 h-3 text-indigo-400 animate-pulse" />
              <span className="text-[10px] font-black tracking-[0.5em] text-white/80 uppercase">
                听觉基因解构
              </span>
            </div>
            <span className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase italic">
              NEURAL IDENTITY JOURNAL
            </span>
          </div>
          <motion.button
            whileHover={{ rotate: 180, scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleGenerate}
            disabled={isLoading}
            className={`p-2.5 rounded-2xl bg-white/5 text-white/30 hover:text-white/80 transition-all border border-white/5 hover:border-white/20 ${isLoading ? "animate-spin cursor-not-allowed opacity-50" : ""}`}
          >
            <RefreshCcw className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Main Identity Area */}
        <div className="space-y-12 relative z-10 min-h-[240px] flex flex-col justify-center">
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
                <div className="text-[8px] font-mono text-white/20 uppercase tracking-widest">
                  Accessing Aesthetic DNA Matrix
                </div>
              </div>
            </div>
          ) : !dnaJournal ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center">
                <Fingerprint className="w-8 h-8 text-white/10" />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-black text-white/40 uppercase tracking-widest italic">
                  暂未建立神经连接
                </div>
                <button
                  onClick={handleGenerate}
                  className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 underline underline-offset-8 uppercase tracking-widest"
                >
                  点击开启初始化协议
                </button>
              </div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              {/* Persona Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_12px_#6366f1]" />
                  <span className="text-[11px] font-black tracking-[0.4em] text-indigo-400 uppercase">
                    你是 “{dnaJournal.archetype}”
                  </span>
                </div>
                <div className="pl-5 border-l-2 border-indigo-500/10">
                  <h3 className="text-2xl md:text-3xl font-serif italic text-white/95 selection:bg-indigo-500/30 leading-snug tracking-tight">
                    “{dnaJournal.motto}”
                  </h3>
                </div>
              </div>

              {/* Analysis Section */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-3 opacity-30">
                  <BrainCircuit className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-black tracking-[0.3em] uppercase">
                    深度解构 / NEURAL ANALYSIS
                  </span>
                </div>
                <p className="text-[13px] text-white/50 leading-relaxed font-medium italic selection:bg-white/10 pl-1">
                  {dnaJournal.description || "正在通过情感星图分析你的审美偏好..."}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-10 pt-8 border-t border-white/5">
                <div className="space-y-2">
                  <div className="text-[8px] font-black tracking-widest uppercase text-white/20">
                    主导流派 / DOMINANCE
                  </div>
                  <div className="text-[12px] font-bold tracking-[0.1em] text-white/70 uppercase truncate">
                    {dnaJournal.genre}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[8px] font-black tracking-widest uppercase text-white/20">
                    解析时间 / TIMESTAMP
                  </div>
                  <div className="text-[12px] font-bold tracking-[0.1em] text-white/70">
                    {formattedDate}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer Protocol */}
        <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[9px] font-black tracking-[0.4em] uppercase text-white/20 italic">
                Neural Identity Protocol v1.0
              </span>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="text-[9px] font-black text-indigo-400/60 hover:text-indigo-400 uppercase tracking-widest transition-colors flex items-center gap-2 group/ref"
            >
              <RefreshCcw
                className={`w-3 h-3 ${isLoading ? "animate-spin" : "group-hover/ref:rotate-180 transition-transform duration-500"}`}
              />
              RE-SYNC NEURAL DATA
            </button>
          </div>
          <div className="flex gap-1.5 h-3 items-end">
            {[0.4, 0.7, 0.2, 0.9, 0.5].map((h, i) => (
              <motion.div
                key={i}
                animate={{ height: [`${h * 100}%`, "100%", `${h * 100}%`] }}
                transition={{ duration: 1.5 + i * 0.2, repeat: Infinity, ease: "easeInOut" }}
                className="w-1 bg-indigo-500/20 rounded-full"
              />
            ))}
          </div>
        </div>

        {/* Scanning Line Effect during Loading */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ top: "-10%" }}
              animate={{ top: "110%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-[2px] bg-indigo-500/40 shadow-[0_0_15px_#6366f1] z-20 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Tactical Corner Borders */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/10 rounded-tl-[32px]" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/10 rounded-tr-[32px]" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/10 rounded-bl-[32px]" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/10 rounded-br-[32px]" />
      </div>
    </div>
  );
};
