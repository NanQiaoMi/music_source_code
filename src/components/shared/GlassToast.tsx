/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore, ToastMessage } from "@/store/uiStore";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Sparkles,
  Music,
} from "lucide-react";

interface ParsedMessage {
  isPlayback: boolean;
  tag?: string;
  title: string;
  subtitle?: string;
  cover?: string;
}

function parseToastMessage(rawMessage: string): ParsedMessage {
  if (!rawMessage) return { isPlayback: false, title: "" };

  const trimmed = rawMessage.trim();

  // 1. 识别“正在播放 / 播放”类通知
  if (
    trimmed.startsWith("▶ 正在播放") ||
    trimmed.startsWith("▶ 播放") ||
    trimmed.startsWith("正在播放:") ||
    trimmed.startsWith("正在播放：")
  ) {
    const clean = trimmed
      .replace(/^[▶\s]*(正在播放|播放)[：:\s]*/, "")
      .trim();

    // 匹配 《歌名》 · 歌手 / 专辑 结构
    const bookMatch = clean.match(/^《([^》]+)》(.*)$/);
    if (bookMatch) {
      const songTitle = bookMatch[1].trim();
      const rest = bookMatch[2].replace(/^[\s·•-]+/, "").trim();
      return {
        isPlayback: true,
        tag: "正在播放",
        title: songTitle,
        subtitle: rest || undefined,
      };
    }

    // 匹配 歌名 - 歌手 或 歌名 · 歌手
    const splitMatch = clean.split(/[·•]/);
    if (splitMatch.length >= 2) {
      return {
        isPlayback: true,
        tag: "正在播放",
        title: splitMatch[0].trim(),
        subtitle: splitMatch.slice(1).join(" · ").trim(),
      };
    }

    return {
      isPlayback: true,
      tag: "正在播放",
      title: clean,
    };
  }

  // 2. 识别其它功能标签
  if (trimmed.startsWith("📥") || trimmed.includes("下载") || trimmed.includes("离线")) {
    return {
      isPlayback: false,
      tag: "离线中枢",
      title: trimmed.replace(/^📥\s*/, ""),
    };
  }

  if (trimmed.startsWith("⭐") || trimmed.includes("本地歌单") || trimmed.includes("歌单编排")) {
    return {
      isPlayback: false,
      tag: "歌单资产",
      title: trimmed.replace(/^⭐\s*/, ""),
    };
  }

  if (trimmed.startsWith("❤️") || trimmed.includes("收藏") || trimmed.includes("喜欢")) {
    return {
      isPlayback: false,
      tag: "曲目收藏",
      title: trimmed.replace(/^❤️\s*/, ""),
    };
  }

  return {
    isPlayback: false,
    title: trimmed,
  };
}

const ToastLeadingElement: React.FC<{
  type: ToastMessage["type"];
  isPlayback: boolean;
  coverUrl?: string;
}> = ({ type, isPlayback, coverUrl }) => {
  if (isPlayback) {
    return (
      <div className="relative w-6 h-6 rounded-full overflow-hidden bg-black/60 border border-white/20 shrink-0 shadow-sm flex items-center justify-center">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <Music className="w-3 h-3 text-emerald-400" />
        )}
      </div>
    );
  }

  switch (type) {
    case "success":
      return (
        <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
      );
    case "error":
      return (
        <div className="w-6 h-6 rounded-full bg-rose-500/15 border border-rose-500/25 text-rose-400 flex items-center justify-center shrink-0">
          <XCircle className="w-3.5 h-3.5" />
        </div>
      );
    case "warning":
      return (
        <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
      );
    case "info":
    default:
      return (
        <div className="w-6 h-6 rounded-full bg-white/10 border border-white/15 text-cyan-300 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      );
  }
};

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const removeToast = useUIStore((state) => state.removeToast);
  const currentSong =
    useAudioStore((state) => state.currentSong) || usePlayerStore((state) => state.currentSong);

  const parsed = useMemo(() => parseToastMessage(toast.message), [toast.message]);
  const durationSec = (toast.duration || 3000) / 1000;

  // 优先匹配当前歌曲封面
  const coverUrl =
    parsed.isPlayback && currentSong?.cover && currentSong.cover !== "/default-cover.svg"
      ? currentSong.cover
      : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{ willChange: "transform, opacity" }}
      className="relative group flex items-center gap-2.5 px-3 py-1.5 bg-[#080a12]/92 hover:bg-[#0c0e18]/95 backdrop-blur-2xl rounded-full border border-white/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.15)] pointer-events-auto select-none font-sans text-white max-w-sm sm:max-w-md transition-colors"
    >
      {/* 头部微缩封面 / 图标 */}
      <ToastLeadingElement
        type={toast.type}
        isPlayback={parsed.isPlayback}
        coverUrl={coverUrl}
      />

      {/* 消息主体结构化排版 */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
        {parsed.tag && !parsed.isPlayback && (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-white/70 border border-white/10 tracking-wide uppercase shrink-0 font-mono">
            {parsed.tag}
          </span>
        )}

        <span className="text-xs font-semibold text-white/95 truncate leading-none">
          {parsed.title}
        </span>

        {parsed.subtitle && (
          <>
            <span className="text-white/20 text-xs shrink-0">·</span>
            <span className="text-[11px] text-white/45 truncate leading-none font-normal">
              {parsed.subtitle}
            </span>
          </>
        )}
      </div>

      {/* 律动微缩音频柱 */}
      {parsed.isPlayback && (
        <div className="flex items-end gap-0.5 h-2.5 px-1 shrink-0 opacity-70">
          <span className="w-0.5 bg-emerald-400 rounded-full h-2 animate-pulse" />
          <span className="w-0.5 bg-emerald-400 rounded-full h-3 animate-ping" />
          <span className="w-0.5 bg-emerald-400 rounded-full h-1.5 animate-pulse" />
        </div>
      )}

      {/* 极简关闭按钮 */}
      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        className="w-4 h-4 rounded-full hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/80 transition-colors cursor-pointer shrink-0"
        title="关闭通知"
      >
        <X className="w-2.5 h-2.5" />
      </button>

      {/* 底部自动倒计时极细微光光条 */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-4 right-4 h-[1px] overflow-hidden rounded-full opacity-25 group-hover:opacity-50 transition-opacity">
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: durationSec, ease: "linear" }}
            style={{ originX: 0, willChange: "transform" }}
            className="h-full bg-gradient-to-r from-emerald-400/80 via-white/80 to-teal-400/80 rounded-full"
          />
        </div>
      )}
    </motion.div>
  );
};

export const GlassToastContainer: React.FC = () => {
  const toasts = useUIStore((state) => state.toasts);

  return (
    <div className="fixed top-3.5 left-1/2 -translate-x-1/2 z-[999999] space-y-2 pointer-events-none flex flex-col items-center">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// 单独调用的 Toast 函数
export const toast = {
  success: (message: string, duration?: number) => {
    useUIStore.getState().showToast(message, "success", duration);
  },
  error: (message: string, duration?: number) => {
    useUIStore.getState().showToast(message, "error", duration);
  },
  info: (message: string, duration?: number) => {
    useUIStore.getState().showToast(message, "info", duration);
  },
  warning: (message: string, duration?: number) => {
    useUIStore.getState().showToast(message, "warning", duration);
  },
};

// Hook 版本的 Toast
export const useGlassToast = () => {
  const showToast = useUIStore((state) => state.showToast);
  return {
    showToast: (
      message: string,
      type: "success" | "error" | "warning" | "info" = "info",
      duration?: number
    ) => {
      showToast(message, type, duration);
    },
  };
};
