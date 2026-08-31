/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore, ToastMessage } from "@/store/uiStore";
import {
  CheckCircle2,
  XCircle,
  Info,
  AlertTriangle,
  X,
  Sparkles,
  Music,
  Radio,
  Download,
  FolderHeart,
  Flame,
} from "lucide-react";

interface ParsedMessage {
  isPlayback: boolean;
  tag?: string;
  title: string;
  subtitle?: string;
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

  // 2. 识别“离线下载 / 队列 / 本地歌单 / 收藏”类通知
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

const ToastIconBadge: React.FC<{
  type: ToastMessage["type"];
  isPlayback: boolean;
}> = ({ type, isPlayback }) => {
  if (isPlayback) {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.35)] shrink-0">
        <div className="flex items-end justify-center gap-0.5 w-3.5 h-3.5">
          <span className="w-0.5 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_ease-in-out] h-3" />
          <span className="w-0.5 bg-emerald-400 rounded-full animate-[bounce_0.6s_infinite_ease-in-out_0.2s] h-3.5" />
          <span className="w-0.5 bg-emerald-400 rounded-full animate-[bounce_0.9s_infinite_ease-in-out_0.4s] h-2" />
        </div>
      </div>
    );
  }

  switch (type) {
    case "success":
      return (
        <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.25)] shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      );
    case "error":
      return (
        <div className="w-8 h-8 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.25)] shrink-0">
          <XCircle className="w-4 h-4" />
        </div>
      );
    case "warning":
      return (
        <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.25)] shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    case "info":
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.25)] shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
      );
  }
};

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const removeToast = useUIStore((state) => state.removeToast);
  const parsed = useMemo(() => parseToastMessage(toast.message), [toast.message]);

  const typeStyles: Record<
    ToastMessage["type"],
    { border: string; glow: string; progress: string; tagBg: string }
  > = {
    success: {
      border: "border-emerald-500/35 hover:border-emerald-400/60",
      glow: "shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_30px_rgba(16,185,129,0.18)]",
      progress: "from-emerald-400 to-teal-400",
      tagBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
    error: {
      border: "border-rose-500/35 hover:border-rose-400/60",
      glow: "shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_30px_rgba(244,63,94,0.18)]",
      progress: "from-rose-400 to-pink-500",
      tagBg: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
    warning: {
      border: "border-amber-500/35 hover:border-amber-400/60",
      glow: "shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_30px_rgba(245,158,11,0.18)]",
      progress: "from-amber-400 to-orange-400",
      tagBg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    info: {
      border: "border-cyan-500/35 hover:border-cyan-400/60",
      glow: "shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_30px_rgba(6,182,212,0.18)]",
      progress: "from-cyan-400 to-blue-500",
      tagBg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    },
  };

  const currentStyle = typeStyles[toast.type] || typeStyles.info;
  const durationSec = (toast.duration || 3000) / 1000;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -24, scale: 0.9, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -16, scale: 0.92, filter: "blur(6px)" }}
      transition={{ type: "spring", damping: 26, stiffness: 360 }}
      className={`relative group flex items-center gap-3.5 px-4 py-2.5 bg-[#090b14]/92 backdrop-blur-3xl rounded-2xl md:rounded-full border ${currentStyle.border} ${currentStyle.glow} pointer-events-auto select-none font-sans text-white max-w-md md:max-w-lg shadow-2xl transition-all`}
    >
      {/* 动态图标微标 */}
      <ToastIconBadge type={toast.type} isPlayback={parsed.isPlayback} />

      {/* 消息主体结构化排版 */}
      <div className="flex flex-col min-w-0 flex-1 justify-center py-0.5">
        <div className="flex items-center gap-2 min-w-0">
          {parsed.tag && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-wide uppercase shrink-0 font-mono shadow-sm ${currentStyle.tagBg}`}
            >
              {parsed.tag}
            </span>
          )}

          <span
            className={`text-xs font-semibold text-white/95 truncate leading-tight ${
              parsed.isPlayback ? "font-bold text-white" : ""
            }`}
          >
            {parsed.title}
          </span>
        </div>

        {parsed.subtitle && (
          <span className="text-[11px] text-white/50 truncate mt-0.5 font-medium leading-tight">
            {parsed.subtitle}
          </span>
        )}
      </div>

      {/* 关闭按钮 */}
      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all cursor-pointer shrink-0 hover:rotate-90"
        title="关闭通知"
      >
        <X className="w-3 h-3" />
      </button>

      {/* 底部自动倒计时平滑收敛微光光条 */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-6 right-6 h-[2px] overflow-hidden rounded-full opacity-40 group-hover:opacity-70 transition-opacity">
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: durationSec, ease: "linear" }}
            className={`h-full bg-gradient-to-r ${currentStyle.progress} rounded-full`}
          />
        </div>
      )}
    </motion.div>
  );
};

export const GlassToastContainer: React.FC = () => {
  const toasts = useUIStore((state) => state.toasts);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999999] space-y-2.5 pointer-events-none flex flex-col items-center">
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
