/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/audioStore";
import { ChevronRight, Disc3 } from "lucide-react";
import { AudioSourceManagerModal } from "./AudioSourceManagerModal";

interface AppleAudioSourceIndicatorProps {
  className?: string;
}

export const AppleAudioSourceIndicator: React.FC<AppleAudioSourceIndicatorProps> = ({ className = "" }) => {
  const currentSong = useAudioStore((state) => state.currentSong);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  const format = (currentSong as any)?.format?.toUpperCase() || "FLAC";
  const quality = (currentSong as any)?.quality || "Hi-Res Lossless";
  const sourceName = (currentSong as any)?.sourceLabel || (currentSong as any)?.source || "多源聚合";

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsManagerOpen(true)}
        className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f5f5f7]/80 dark:bg-[#1d1d1f]/80 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_20px_rgba(0,113,227,0.18)] cursor-pointer transition-all duration-300 whitespace-nowrap shrink-0 select-none ${className}`}
      >
        {/* Apple 经典蓝光点 / 状态指示 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0071e3] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0071e3]" />
          </span>
        </div>

        {/* 音质与平台标签 */}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap">
          <span className="text-[#0071e3] font-bold whitespace-nowrap">{quality}</span>
          <span className="text-black/30 dark:text-white/30">·</span>
          <span className="opacity-80 whitespace-nowrap">{format} 24-bit/96kHz</span>
          <span className="text-black/30 dark:text-white/30">·</span>
          <span className="opacity-70 flex items-center gap-1 whitespace-nowrap">
            <Disc3 className="w-3 h-3 text-[#2997ff] shrink-0" />
            {sourceName}
          </span>
        </div>

        {/* 交互小箭头 */}
        <ChevronRight className="w-3.5 h-3.5 text-black/40 dark:text-white/40 group-hover:text-[#0071e3] group-hover:translate-x-0.5 transition-all shrink-0" />
      </motion.div>

      {/* Apple 风格多源与 DSP 节拍管理模态框 */}
      <AnimatePresence>
        {isManagerOpen && (
          <AudioSourceManagerModal isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
};
