"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Trash2, X, Key, ArrowRight, Zap, History, Plus, Loader2 } from "lucide-react";
import { useAIAgentStore } from "@/store/useAIAgentStore";
import { useAIStore } from "@/store/aiStore";
import { useUIStore } from "@/store/uiStore";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { SongResult } from "@/types/aiAgent";
import { ToolCallIndicator } from "./ToolCallIndicator";
import { AIAgentInputBox } from "./AIAgentInputBox";
import { AgentMessageItem } from "./AgentMessageItem";
import { AIAgentSessionDrawer } from "./AIAgentSessionDrawer";

export interface AIAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DRAWER_SPRING = {
  type: "spring" as const,
  stiffness: 380,
  damping: 34,
  mass: 0.8,
};

export const AIAgentPanel: React.FC<AIAgentPanelProps> = ({ isOpen, onClose }) => {
  const sessions = useAIAgentStore((state) => state.sessions);
  const currentSessionId = useAIAgentStore((state) => state.currentSessionId);
  const isSessionDrawerOpen = useAIAgentStore((state) => state.isSessionDrawerOpen);
  const isSessionLoading = useAIAgentStore((state) => state.isSessionLoading);
  const openSessionDrawer = useAIAgentStore((state) => state.openSessionDrawer);
  const closeSessionDrawer = useAIAgentStore((state) => state.closeSessionDrawer);
  const createNewSession = useAIAgentStore((state) => state.createNewSession);

  const messages = useAIAgentStore((state) => state.messages);
  const isProcessing = useAIAgentStore((state) => state.isProcessing);
  const currentToolName = useAIAgentStore((state) => state.currentToolName);
  const sendMessage = useAIAgentStore((state) => state.sendMessage);
  const clearMessages = useAIAgentStore((state) => state.clearMessages);
  const abortCurrentRequest = useAIAgentStore((state) => state.abortCurrentRequest);
  const playSongFromAgent = useAIAgentStore((state) => state.playSongFromAgent);
  const downloadSongFromAgent = useAIAgentStore((state) => state.downloadSongFromAgent);

  const configs = useAIStore((state) => state.configs);
  const activeConfigId = useAIStore((state) => state.activeConfigId);
  const isEnabled = useAIStore((state) => state.isEnabled);
  const openPanel = useUIStore((state) => state.openPanel);
  const showToast = useUIStore((state) => state.showToast);
  const playQueue = useAudioStore((state) => state.playQueue);
  const addToQueue = useQueueStore((state) => state.addToQueue);

  const activeConfig =
    configs.find((c) => c.id === activeConfigId) || (configs.length > 0 ? configs[0] : null);
  const isConfigured = !!activeConfig?.apiKey?.trim() && isEnabled;
  const currentSession = sessions.find((s) => s.id === currentSessionId);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrolledUpRef = useRef(false);

  // 检测用户是否处于底部附近 (阈值 80px)
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    isUserScrolledUpRef.current = distanceToBottom > 80;
  }, []);

  // 智能无抖动贴底滚动
  const scrollToBottom = useCallback((force = false) => {
    if (!scrollContainerRef.current) return;
    if (!force && isUserScrolledUpRef.current) return;

    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      });
    } else {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      isUserScrolledUpRef.current = false;
      scrollToBottom(true);
    }
  }, [isOpen, scrollToBottom]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages, isProcessing, currentToolName, scrollToBottom]);

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        if (isSessionDrawerOpen) {
          closeSessionDrawer();
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, isSessionDrawerOpen, closeSessionDrawer, onClose]);

  const handleOpenAISettings = useCallback(() => {
    onClose();
    openPanel("aiSettings");
  }, [onClose, openPanel]);

  const handleCopyMessage = useCallback(
    (id: string, text: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      showToast("已复制对话内容", "success");
      setTimeout(() => setCopiedId(null), 2000);
    },
    [showToast]
  );

  const handlePlayAllResults = useCallback(
    (songResults: SongResult[]) => {
      const songs = songResults.map((sr) => sr.song).filter(Boolean);
      if (songs.length === 0) return;
      playQueue(songs, 0);
      showToast(`已开始连播检索到的 ${songs.length} 首歌曲`, "success");
    },
    [playQueue, showToast]
  );

  const handleAddAllToQueue = useCallback(
    (songResults: SongResult[]) => {
      const songs = songResults.map((sr) => sr.song).filter(Boolean);
      if (songs.length === 0) return;
      songs.forEach((s) => addToQueue(s));
      showToast(`已将 ${songs.length} 首歌曲全部添加至待播清单`, "success");
    },
    [addToQueue, showToast]
  );

  const handleSend = useCallback(
    (text: string) => {
      isUserScrolledUpRef.current = false;
      sendMessage(text);
      scrollToBottom(true);
    },
    [sendMessage, scrollToBottom]
  );

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div
          data-testid="ai-agent-panel"
          className="fixed inset-0 z-[200] flex justify-end pointer-events-auto select-none p-3 sm:p-4 overflow-hidden"
        >
          {/* 背景景深微透遮罩 (220ms 同步淡出) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={onClose}
            className="absolute inset-0 bg-black/35 backdrop-blur-[6px]"
          />

          {/* 悬浮液态玻璃浮岛卡片容器 (GPU 硬件加速与图层隔离) */}
          <motion.div
            initial={{ x: "100%", opacity: 0, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: "100%", opacity: 0, scale: 0.98 }}
            transition={DRAWER_SPRING}
            style={{
              transformOrigin: "right center",
              contain: "content",
            }}
            className="relative z-10 w-full sm:w-[500px] max-w-full h-full rounded-[28px] bg-[#0c0d14]/75 border border-white/[0.1] shadow-[-20px_20px_60px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-[40px] flex flex-col overflow-hidden text-white font-sans transform-gpu will-change-transform"
          >
            {/* 顶栏 Apple 极简冰白漫反射氛围光 */}
            <div className="absolute top-0 right-0 left-0 h-48 overflow-hidden pointer-events-none z-0">
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-white/[0.06] via-white/[0.02] to-transparent blur-3xl rounded-full" />
            </div>

            {/* 顶部 Header：极简钛银光球 Logo + 会话切换 + 操作栏 */}
            <div className="relative z-10 px-4 pt-4 pb-3.5 border-b border-white/[0.08] bg-black/20 backdrop-blur-2xl flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                <div className="relative w-9 h-9 rounded-full bg-white/[0.08] border border-white/[0.15] p-[1px] shadow-[0_0_12px_rgba(255,255,255,0.06)] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-white/90" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className="text-[14px] font-semibold text-white tracking-tight shrink-0">
                      AI 找歌助手
                    </h3>
                    <button
                      type="button"
                      onClick={openSessionDrawer}
                      className="group/sess flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] text-[11.5px] font-medium text-white/90 truncate transition-all active:scale-95 max-w-[150px]"
                      title="点击切换历史对话"
                    >
                      <History className="w-3 h-3 text-white/60 group-hover/sess:text-white shrink-0" />
                      <span className="truncate">{currentSession?.title || "探索新音乐"}</span>
                    </button>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-white/[0.06] text-white/70 border border-white/[0.1] shrink-0">
                      v2
                    </span>
                  </div>

                  {/* 模型在线与自动切换状态 */}
                  <div className="flex items-center gap-1.5 text-[11px] text-white/60 mt-0.5">
                    {isConfigured ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                        <span className="truncate max-w-[150px] text-white/80 font-medium">
                          {activeConfig?.model || activeConfig?.name || "在线就绪"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                        <span className="text-white/60 font-medium">尚未连接 AI 接口</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 右侧操作胶囊 */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => createNewSession()}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.1] transition-all active:scale-95"
                  title="新建对话"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={clearMessages}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.1] transition-all active:scale-95"
                  title="清空当前对话记录"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.1] transition-all active:scale-95"
                  title="关闭面板 (ESC)"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* 未配置 AI 时的高奢 Apple 冷钛磨砂引导卡片 */}
            {!isConfigured && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="relative z-10 p-3.5 mx-4 my-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.10] flex items-center justify-between gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)] shrink-0 backdrop-blur-2xl"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-white/90" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-white truncate">
                      {!isEnabled ? "AI 功能目前已暂停" : "尚未配置 API Key"}
                    </div>
                    <div className="text-[10.5px] text-white/50 truncate">
                      支持 SenseNova / DeepSeek / 硅基流动 等多模型池
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAISettings}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.12] hover:bg-white/[0.22] text-white border border-white/[0.15] text-[11.5px] font-medium flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>配置端点</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </motion.div>
            )}

            {/* 消息对话主滚动区 */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-3.5 min-h-0 custom-scrollbar transform-gpu"
            >
              {isSessionLoading ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-white/40 space-y-3">
                  <Loader2 className="w-7 h-7 animate-spin text-white/60" />
                  <span className="text-[12.5px]">正在加载会话消息...</span>
                </div>
              ) : (
                messages.map((msg) => (
                  <AgentMessageItem
                    key={msg.id}
                    message={msg}
                    onPlaySong={playSongFromAgent}
                    onDownloadSong={downloadSongFromAgent}
                    onPlayAll={handlePlayAllResults}
                    onAddAllToQueue={handleAddAllToQueue}
                    onOpenAISettings={handleOpenAISettings}
                    onCopyText={handleCopyMessage}
                    onSendPrompt={handleSend}
                    isCopied={copiedId === msg.id}
                  />
                ))
              )}

              {/* 正在执行 Tool 时的指示器 */}
              {isProcessing && <ToolCallIndicator toolName={currentToolName} />}
            </div>

            {/* 独立底栏输入组件 */}
            <AIAgentInputBox
              isProcessing={isProcessing}
              onSend={handleSend}
              onAbort={abortCurrentRequest}
              disabled={!isConfigured}
            />

            {/* 历史会话管理侧滑抽屉 */}
            <AIAgentSessionDrawer isOpen={isSessionDrawerOpen} onClose={closeSessionDrawer} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

AIAgentPanel.displayName = "AIAgentPanel";
