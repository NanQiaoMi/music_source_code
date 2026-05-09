"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronDown,
  Activity,
  Trash2,
  Brain,
  Dice1,
  Settings,
  Pause,
  Play,
} from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useLinerNotesStore } from "@/store/linerNotesStore";
import { useGlassToast } from "@/components/shared/GlassToast";
import { useAIStore } from "@/store/aiStore";

const HUB_TRANSITION = {
  duration: 0.3,
  ease: [0.23, 1, 0.32, 1],
};

const CONTAINER_VARIANTS = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      ...HUB_TRANSITION,
      staggerChildren: 0.04,
      delayChildren: 0.01,
    },
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: {
      duration: 0.15,
      ease: "easeOut",
    },
  },
};

const ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 5 },
  visible: {
    opacity: 1,
    y: 0,
    transition: HUB_TRANSITION,
  },
};

export const AIToolbox: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { openPanel, togglePanel, panels } = useUIStore();
  const { clearCache } = useLinerNotesStore();
  const { isEnabled, toggleEnabled } = useAIStore();
  const { showToast } = useGlassToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  const handleClearCache = () => {
    clearCache();
    showToast("AI 乐评缓存已清理", "success");
  };

  const menuItems = [
    {
      id: "aiSettings",
      label: "AI 接口配置",
      icon: <Settings className="w-4 h-4 text-purple-400" />,
      action: () => openPanel("aiSettings"),
      desc: "设置 API Key 与模型",
    },
    {
      id: "emotionMatrix",
      label: "情感矩阵视图",
      icon: <Dice1 className="w-4 h-4 text-pink-400" />,
      action: () => togglePanel("emotionMatrix"),
      desc: "可视化音乐情绪分布",
    },
    {
      id: "diagnostics",
      label: "AI 深度诊断",
      icon: <Activity className="w-4 h-4 text-green-400" />,
      action: () => window.open("/api_checker.html", "_blank"),
      desc: "API 连通性深度分析",
    },
  ];

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-500 group relative"
        style={{
          background: isOpen || panels.aiSettings ? "rgba(168, 85, 247, 0.15)" : "transparent",
          color: isOpen || panels.aiSettings ? "#d8b4fe" : "var(--theme-text-secondary)",
        }}
      >
        <motion.div
          animate={{
            scale: isOpen ? 1.15 : 1,
            rotate: isOpen ? [0, -5, 5, 0] : 0,
          }}
          transition={isOpen ? { repeat: Infinity, duration: 3 } : {}}
          className="relative z-10"
        >
          <Brain className="w-[20px] h-[20px]" />
          {(isOpen || panels.aiSettings) && (
            <motion.div
              layoutId="ai-glow"
              className="absolute inset-0 bg-purple-500/50 blur-xl rounded-full -z-10"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.6, scale: 1.8 }}
            />
          )}
        </motion.div>

        {isOpen && (
          <motion.div
            layoutId="ai-hub-underline"
            className="absolute bottom-1 left-2 right-2 h-[2px] bg-purple-500/60 rounded-full"
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={CONTAINER_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-black/70 backdrop-blur-3xl rounded-2xl border border-purple-500/20 shadow-[0_30px_60px_rgba(0,0,0,0.8),0_0_20px_rgba(168,85,247,0.1)] overflow-hidden z-[9999]"
            style={{
              transformOrigin: "top",
              willChange: "transform, opacity",
              backfaceVisibility: "hidden",
            }}
          >
            <div className="p-4 space-y-4">
              <motion.div
                variants={ITEM_VARIANTS}
                className="flex items-center justify-between px-1"
              >
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.25em]">
                  AI 实验室
                </span>
                <div className="flex items-center gap-1.5">
                  <motion.div
                    animate={isEnabled ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
                    transition={isEnabled ? { repeat: Infinity, duration: 2 } : {}}
                    className={`w-1.5 h-1.5 rounded-full ${isEnabled ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" : "bg-white/20"}`}
                  />
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider ${isEnabled ? "text-purple-400" : "text-white/20"}`}
                  >
                    {isEnabled ? "Neural Online" : "Neural Paused"}
                  </span>
                </div>
              </motion.div>

              <motion.div variants={ITEM_VARIANTS} className="px-1">
                <button
                  onClick={() => {
                    toggleEnabled();
                    showToast(isEnabled ? "AI 功能已暂停" : "AI 功能已启动", "info");
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-500 border ${
                    isEnabled
                      ? "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.1)]"
                      : "bg-white/5 hover:bg-white/10 border-white/5 shadow-none"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg transition-colors ${isEnabled ? "bg-purple-500/20 text-purple-400" : "bg-white/5 text-white/30"}`}
                    >
                      {isEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </div>
                    <div className="text-left">
                      <div
                        className={`text-sm font-medium transition-colors ${isEnabled ? "text-white" : "text-white/40"}`}
                      >
                        {isEnabled ? "暂停 AI 功能" : "启动 AI 功能"}
                      </div>
                      <div className="text-[10px] text-white/30 leading-tight">
                        {isEnabled ? "当前正在实时分析" : "点击恢复智能引擎"}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-8 h-4 rounded-full relative transition-colors duration-500 ${isEnabled ? "bg-purple-500" : "bg-white/10"}`}
                  >
                    <motion.div
                      initial={false}
                      animate={{ x: isEnabled ? 18 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="absolute top-1 w-2 h-2 rounded-full bg-white shadow-sm"
                    />
                  </div>
                </button>
              </motion.div>

              <div className="space-y-1">
                {menuItems.map((item) => (
                  <motion.button
                    key={item.id}
                    variants={ITEM_VARIANTS}
                    whileHover={{ x: 6, backgroundColor: "rgba(168, 85, 247, 0.08)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      item.action();
                      setIsOpen(false);
                    }}
                    className="w-full group flex items-start gap-4 p-3 rounded-xl transition-all text-left"
                  >
                    <div className="mt-0.5 p-2 rounded-lg bg-white/5 group-hover:bg-purple-500/20 group-hover:scale-110 transition-all">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white/90 group-hover:text-purple-300 transition-colors">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-white/30 leading-relaxed mt-1">
                        {item.desc}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              <motion.div variants={ITEM_VARIANTS} className="pt-2 border-t border-white/5">
                <button
                  onClick={handleClearCache}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-red-500/10 group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-4 h-4 text-white/20 group-hover:text-red-400 transition-colors" />
                    <span className="text-[11px] text-white/50 group-hover:text-red-300">
                      清理 AI 缓存
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-white/10 -rotate-90" />
                </button>
              </motion.div>
            </div>

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="h-[1px] w-full bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
