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
    label: "正在全网与本地曲库检索相关曲目...",
    icon: Search,
    color: "from-cyan-500/25 via-blue-500/20 to-purple-500/25 text-cyan-200 border-cyan-400/30",
  },
  play_song: {
    label: "正在解析高品质音频流与播放器...",
    icon: PlayCircle,
    color: "from-purple-500/25 via-pink-500/20 to-indigo-500/25 text-purple-200 border-purple-400/30",
  },
  download_song: {
    label: "正在添加歌曲至无损离线下载队列...",
    icon: Download,
    color: "from-emerald-500/25 via-teal-500/20 to-cyan-500/25 text-emerald-200 border-emerald-400/30",
  },
  get_lyrics: {
    label: "正在智能解析精准歌词与双语翻译...",
    icon: FileText,
    color: "from-amber-500/25 via-orange-500/20 to-yellow-500/25 text-amber-200 border-amber-400/30",
  },
};

export const ToolCallIndicator: React.FC<ToolCallIndicatorProps> = ({ toolName }) => {
  const config = (toolName && TOOL_CONFIG[toolName]) || {
    label: "AI 音乐智能体思考中...",
    icon: Sparkles,
    color: "from-purple-500/25 via-indigo-500/20 to-cyan-500/25 text-purple-200 border-purple-400/30",
  };

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.95 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      className="flex items-center gap-2.5 my-2.5"
    >
      <div
        className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r ${config.color} border backdrop-blur-2xl shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]`}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
          className="shrink-0"
        >
          <Icon className="w-4 h-4" />
        </motion.div>

        <span className="text-[12.5px] font-medium tracking-tight whitespace-nowrap">
          {config.label}
        </span>

        {/* 呼吸极光脉冲点 */}
        <div className="flex items-center gap-1 ml-1">
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0 }}
            className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]"
          />
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
            className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]"
          />
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
            className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]"
          />
        </div>
      </div>
    </motion.div>
  );
};

