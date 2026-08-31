"use client";

import React from "react";
import { motion } from "framer-motion";
import { Search, PlayCircle, Download, FileText, Sparkles } from "lucide-react";

export interface ToolCallIndicatorProps {
  toolName?: string | null;
}

const TOOL_CONFIG: Record<
  string,
  { label: string; icon: React.FC<{ className?: string }>; color: string }
> = {
  search_songs: {
    label: "正在全网与曲库检索相关曲目...",
    icon: Search,
    color: "from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30",
  },
  play_song: {
    label: "正在准备音频流与播放器...",
    icon: PlayCircle,
    color: "from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30",
  },
  download_song: {
    label: "正在添加歌曲至离线下载队列...",
    icon: Download,
    color: "from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30",
  },
  get_lyrics: {
    label: "正在获取歌词与翻译...",
    icon: FileText,
    color: "from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30",
  },
};

export const ToolCallIndicator: React.FC<ToolCallIndicatorProps> = ({ toolName }) => {
  const config = (toolName && TOOL_CONFIG[toolName]) || {
    label: "AI 思考中...",
    icon: Sparkles,
    color: "from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/30",
  };

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="flex items-center gap-2.5 my-2"
    >
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${config.color} border backdrop-blur-xl shadow-[0_4px_16px_rgba(0,0,0,0.3)]`}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="shrink-0"
        >
          <Icon className="w-3.5 h-3.5" />
        </motion.div>

        <span className="text-[12px] font-medium tracking-tight whitespace-nowrap">
          {config.label}
        </span>

        {/* 呼吸脉冲点 */}
        <div className="flex items-center gap-1 ml-0.5">
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0 }}
            className="w-1 h-1 rounded-full bg-current"
          />
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
            className="w-1 h-1 rounded-full bg-current"
          />
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
            className="w-1 h-1 rounded-full bg-current"
          />
        </div>
      </div>
    </motion.div>
  );
};
