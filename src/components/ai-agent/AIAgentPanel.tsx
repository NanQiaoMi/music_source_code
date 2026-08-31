"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Bot,
  Send,
  Square,
  Trash2,
  X,
  Key,
  ArrowRight,
  CornerDownLeft,
  User,
  AlertCircle,
} from "lucide-react";
import { useAIAgentStore } from "@/store/useAIAgentStore";
import { useAIStore } from "@/store/aiStore";
import { useUIStore } from "@/store/uiStore";
import { SongResultCard } from "./SongResultCard";
import { ToolCallIndicator } from "./ToolCallIndicator";

export interface AIAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DRAWER_SPRING = {
  type: "spring" as const,
  stiffness: 380,
  damping: 34,
  mass: 0.85,
};

export const AIAgentPanel: React.FC<AIAgentPanelProps> = ({ isOpen, onClose }) => {
  const messages = useAIAgentStore((state) => state.messages);
  const isProcessing = useAIAgentStore((state) => state.isProcessing);
  const currentToolName = useAIAgentStore((state) => state.currentToolName);
  const suggestedPrompts = useAIAgentStore((state) => state.suggestedPrompts);
  const sendMessage = useAIAgentStore((state) => state.sendMessage);
  const clearMessages = useAIAgentStore((state) => state.clearMessages);
  const abortCurrentRequest = useAIAgentStore((state) => state.abortCurrentRequest);
  const playSongFromAgent = useAIAgentStore((state) => state.playSongFromAgent);
  const downloadSongFromAgent = useAIAgentStore((state) => state.downloadSongFromAgent);

  const configs = useAIStore((state) => state.configs);
  const activeConfigId = useAIStore((state) => state.activeConfigId);
  const isEnabled = useAIStore((state) => state.isEnabled);
  const openPanel = useUIStore((state) => state.openPanel);

  const activeConfig =
    configs.find((c) => c.id === activeConfigId) || (configs.length > 0 ? configs[0] : null);
  const isConfigured = !!activeConfig && isEnabled;

  const [inputVal, setInputVal] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 自动滚动到消息列表底部
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom(false);
      // 聚焦输入框
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, scrollToBottom]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isProcessing, currentToolName, scrollToBottom]);

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleSend = () => {
    const text = inputVal.trim();
    if (!text || isProcessing) return;
    setInputVal("");
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = (prompt: string) => {
    if (isProcessing) return;
    sendMessage(prompt);
  };

  const handleOpenAISettings = () => {
    onClose();
    openPanel("aiSettings");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        data-testid="ai-agent-panel"
        className="fixed inset-0 z-[200] flex justify-end pointer-events-auto select-none"
      >
        {/* 背景遮罩 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* 抽屉容器 */}
        <motion.div
          initial={{ x: "100%", opacity: 0.8 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={DRAWER_SPRING}
          className="relative z-10 w-full sm:w-[480px] max-w-full h-full bg-[#0a0a0f]/95 border-l border-white/[0.08] shadow-[-30px_0_80px_rgba(0,0,0,0.85)] backdrop-blur-3xl flex flex-col overflow-hidden text-white font-sans"
        >
          {/* 顶栏环境光效 */}
          <div className="absolute top-0 right-0 left-0 h-44 overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-44 bg-gradient-to-b from-purple-600/25 via-cyan-500/15 to-transparent blur-3xl rounded-full" />
          </div>

          {/* 顶部 Header */}
          <div className="relative z-10 px-5 pt-4 pb-3.5 border-b border-white/[0.08] bg-black/30 backdrop-blur-xl flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-cyan-400 p-0.5 shadow-lg shadow-purple-500/20">
                <div className="w-full h-full bg-[#0e0e14] rounded-full flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[14px] font-semibold text-white tracking-tight">
                    AI 找歌助手
                  </h3>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Agent
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#86868b] mt-0.5">
                  {isConfigured ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span className="truncate max-w-[160px] text-white/70">
                        {activeConfig?.model || activeConfig?.name || "在线就绪"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-amber-300/80">未连接 AI 接口</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 右侧操作按钮 */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearMessages}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title="清空对话记录"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title="关闭 (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 未配置 AI 提示横幅 */}
          {!isConfigured && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="relative z-10 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-3 shrink-0"
            >
              <div className="flex items-center gap-2 text-[12px] text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{!isEnabled ? "AI 功能目前已暂停" : "尚未配置 API Key"}</span>
              </div>
              <button
                type="button"
                onClick={handleOpenAISettings}
                className="px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors shrink-0"
              >
                <Key className="w-3 h-3" />
                <span>配置端点</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </motion.div>
          )}

          {/* 消息对话区域 */}
          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth min-h-0">
            {messages.map((msg) => {
              if (msg.role === "tool") {
                // 如果 tool 消息自带 songResults，渲染歌曲卡片列表
                if (msg.songResults && msg.songResults.length > 0) {
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2 my-2"
                    >
                      <div className="text-[11px] font-medium text-purple-300/80 px-1">
                        检索到以下曲目：
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {msg.songResults.map((sr) => (
                          <SongResultCard
                            key={sr.song.id}
                            result={sr}
                            onPlay={playSongFromAgent}
                            onDownload={downloadSongFromAgent}
                          />
                        ))}
                      </div>
                    </motion.div>
                  );
                }
                return null;
              }

              if (msg.role === "user") {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-end gap-2.5 items-end pl-10"
                  >
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-tr from-purple-600 to-indigo-600 px-3.5 py-2.5 text-[13.5px] text-white leading-relaxed shadow-md shadow-purple-900/30 break-words whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mb-0.5 text-white/70">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  </motion.div>
                );
              }

              // Assistant message
              const isGreeting = msg.id === "greeting";
              const isError = msg.status === "error";

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start gap-2.5 items-start pr-8"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-cyan-300">
                    <Bot className="w-4 h-4" />
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
                    {/* 消息气泡 */}
                    {msg.content && (
                      <div
                        className={`rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13.5px] leading-relaxed break-words whitespace-pre-wrap border ${
                          isError
                            ? "bg-red-500/10 border-red-500/30 text-red-200"
                            : "bg-white/[0.06] border-white/[0.08] text-white/90"
                        }`}
                      >
                        <div>{msg.content}</div>
                        {isError && (
                          <div className="pt-2.5 mt-1 border-t border-red-500/20">
                            <button
                              type="button"
                              onClick={handleOpenAISettings}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-white text-[12px] font-semibold transition-all active:scale-95 shadow-md shadow-purple-900/30"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>打开 AI 设置切换模型 / 检查密钥</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 关联的歌曲卡片列表 */}
                    {msg.songResults && msg.songResults.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 pt-1">
                        {msg.songResults.map((sr) => (
                          <SongResultCard
                            key={sr.song.id}
                            result={sr}
                            onPlay={playSongFromAgent}
                            onDownload={downloadSongFromAgent}
                          />
                        ))}
                      </div>
                    )}

                    {/* 初次欢迎语后的快捷推荐词 */}
                    {isGreeting && suggestedPrompts.length > 0 && (
                      <div className="pt-2 space-y-1.5">
                        <div className="text-[11px] text-white/40">你可以这样问我：</div>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestedPrompts.map((prompt) => (
                            <button
                              key={prompt}
                              type="button"
                              onClick={() => handlePromptClick(prompt)}
                              className="px-2.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] hover:border-purple-500/40 text-[12px] text-white/80 hover:text-white transition-all text-left flex items-center gap-1.5 active:scale-95"
                            >
                              <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span>{prompt}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* 正在执行 Tool / 思考中提示器 */}
            {isProcessing && <ToolCallIndicator toolName={currentToolName} />}

            <div ref={messagesEndRef} className="h-1" />
          </div>

          {/* 底部输入框与控制区 */}
          <div className="relative z-10 p-3 sm:p-4 border-t border-white/[0.08] bg-black/40 backdrop-blur-xl shrink-0 space-y-2">
            <div className="relative flex items-end gap-2 bg-white/[0.05] border border-white/[0.10] focus-within:border-purple-500/50 rounded-2xl p-2 transition-all shadow-inner">
              <textarea
                ref={textareaRef}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isProcessing ? "AI 正在检索中..." : "描述想听的歌曲、模糊歌词、歌手或心情..."
                }
                rows={1}
                disabled={isProcessing}
                className="w-full bg-transparent text-white text-[13.5px] placeholder-white/30 resize-none outline-none px-2 py-1 max-h-28 min-h-[28px] leading-relaxed"
                style={{
                  height: "auto",
                  minHeight: "28px",
                }}
              />

              {/* 发送 / 停止 按钮 */}
              {isProcessing ? (
                <button
                  type="button"
                  onClick={abortCurrentRequest}
                  className="w-8 h-8 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 flex items-center justify-center shrink-0 transition-colors active:scale-95"
                  title="停止生成"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputVal.trim()}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95 ${
                    inputVal.trim()
                      ? "bg-gradient-to-tr from-purple-500 to-cyan-500 text-white shadow-md shadow-purple-500/30 hover:opacity-90"
                      : "bg-white/5 text-white/20 cursor-not-allowed"
                  }`}
                  title="发送 (Enter)"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[10.5px] text-white/40 px-1">
              <div className="flex items-center gap-1.5">
                <CornerDownLeft className="w-3 h-3 text-white/30" />
                <span>Enter 发送 / Shift+Enter 换行</span>
              </div>
              <button
                type="button"
                onClick={handleOpenAISettings}
                className="hover:text-purple-300 transition-colors flex items-center gap-1"
              >
                <Key className="w-3 h-3" />
                <span>AI 设置</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
