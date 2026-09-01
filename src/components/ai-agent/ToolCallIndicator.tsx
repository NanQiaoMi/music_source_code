"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Search,
  PlayCircle,
  Download,
  FileText,
  Sparkles,
  Sliders,
  Volume2,
  Repeat,
  Radio,
  Heart,
  ListPlus,
  Moon,
} from "lucide-react";

export interface ToolCallIndicatorProps {
  toolName?: string | null;
}

const TOOL_CONFIG: Record<
  string,
  { label: string; icon: React.FC<{ className?: string }> }
> = {
  search_songs: {
    label: "正在全网与本地曲库检索相关曲目...",
    icon: Search,
  },
  play_song: {
    label: "正在解析高品质音频流与播放器...",
    icon: PlayCircle,
  },
  control_playback: {
    label: "正在执行播放器控制指令...",
    icon: Sliders,
  },
  set_volume: {
    label: "正在调节播放器音量与声音通道...",
    icon: Volume2,
  },
  set_play_mode: {
    label: "正在配置播放循环模式...",
    icon: Repeat,
  },
  get_current_playing: {
    label: "正在读取当前曲目与播放状态...",
    icon: Radio,
  },
  like_current_song: {
    label: "正在更新红心收藏列表...",
    icon: Heart,
  },
  add_to_queue: {
    label: "正在更新待播清单与播放队列...",
    icon: ListPlus,
  },
  switch_visualizer: {
    label: "正在切换全屏音乐可视化引擎...",
    icon: Sparkles,
  },
  set_sleep_timer: {
    label: "正在配置睡眠倒计时关机...",
    icon: Moon,
  },
  download_song: {
    label: "正在添加歌曲至无损离线下载队列...",
    icon: Download,
  },
  get_lyrics: {
    label: "正在智能解析精准歌词与双语翻译...",
    icon: FileText,
  },
};

export const ToolCallIndicator: React.FC<ToolCallIndicatorProps> = ({ toolName }) => {
  const config = (toolName && TOOL_CONFIG[toolName]) || {
    label: "AI 音乐智能体思考中...",
    icon: Sparkles,
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
      <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/[0.08] border border-white/[0.15] text-white/90 backdrop-blur-2xl shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
          className="shrink-0 text-white/80"
        >
          <Icon className="w-4 h-4" />
        </motion.div>

        <span className="text-[12.5px] font-medium tracking-tight whitespace-nowrap text-white/90">
          {config.label}
        </span>
      </div>
    </motion.div>
  );
};
