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
  Play,
  ListPlus,
  Copy,
  Check,
  RotateCcw,
  Zap,
  Music4,
  Radio,
  Moon,
  Search,
} from "lucide-react";
import { useAIAgentStore } from "@/store/useAIAgentStore";
import { useAIStore } from "@/store/aiStore";
import { useUIStore } from "@/store/uiStore";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { SongResultCard } from "./SongResultCard";
import { ToolCallIndicator } from "./ToolCallIndicator";

export interface AIAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DRAWER_SPRING = {
  type: "spring" as const,
  stiffness: 340,
  damping: 32,
  mass: 0.85,
};

// 分类快捷灵感矩阵
const INSPIRATION_CATEGORIES = [
  {
    category: "歌词寻歌",
    icon: Search,
    color: "from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30",
    prompts: ["有句歌词是'如果天黑之前来得及'", "搜歌词包含'爱是一道光'的歌"],
  },
  {
    category: "深夜心情",
    icon: Moon,
    color: "from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/30",
    prompts: ["来几首适合深夜独自沉思的吉他民谣", "心情低落时听的治愈系钢琴曲"],
  },
  {
    category: "场景电台",
    icon: Radio,
    color: "from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30",
    prompts: ["适合专注工作编程的极简 Lo-Fi 节奏", "开车兜风时的动感放克音乐"],
  },
  {
    category: "歌手精选",
    icon: Music4,
    color: "from-pink-500/20 to-rose-500/20 text-pink-300 border-pink-500/30",
    prompts: ["搜周杰伦的经典抒情慢歌", "推荐几首陈奕迅小众但好听的粤语歌"],
  },
];

export const AIAgentPanel: React.FC<AIAgentPanelProps> = ({ isOpen, onClose }) => {
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
  const isConfigured = !!activeConfig && isEnabled;

  const [inputVal, setInputVal] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, scrollToBottom]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isProcessing, currentToolName, scrollToBottom]);

  // ESC 键关闭 & ⌘I / Ctrl+I 切换
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

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("已复制对话内容", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePlayAllResults = (songResults: { song: any }[]) => {
    const songs = songResults.map((sr) => sr.song).filter(Boolean);
    if (songs.length === 0) return;
    playQueue(songs, 0);
    showToast(`已开始连播检索到的 ${songs.length} 首歌曲`, "success");
  };

  const handleAddAllToQueue = (songResults: { song: any }[]) => {
    const songs = songResults.map((sr) => sr.song).filter(Boolean);
    if (songs.length === 0) return;
    songs.forEach((s) => addToQueue(s));
    showToast(`已将 ${songs.length} 首歌曲全部添加至待播清单`, "success");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        data-testid="ai-agent-panel"
        className="fixed inset-0 z-[200] flex justify-end pointer-events-auto select-none p-3 sm:p-4"
      >
        {/* 背景景深微透遮罩 (透出底层 3D 黑胶与弥散流体光，消除纯黑死板感) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/35 backdrop-blur-[6px]"
        />

        {/* 悬浮液态玻璃浮岛卡片容器 (Floating Liquid Glass Island) */}
        <motion.div
          initial={{ x: "105%", opacity: 0, scale: 0.96 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: "105%", opacity: 0, scale: 0.96 }}
          transition={DRAWER_SPRING}
          className="relative z-10 w-full sm:w-[500px] max-w-full h-full rounded-[28px] bg-[#0c0d14]/80 border border-white/[0.12] shadow-[-20px_20px_70px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-3xl flex flex-col overflow-hidden text-white font-sans"
        >
          {/* 顶栏 Apple 极光流体呼吸氛围光 */}
          <div className="absolute top-0 right-0 left-0 h-52 overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-52 bg-gradient-to-b from-purple-600/30 via-cyan-500/20 to-transparent blur-3xl rounded-full animate-pulse" />
          </div>

          {/* 顶部 Header：极光光球 Logo + 模型状态微标 + 极简操作栏 */}
          <div className="relative z-10 px-5 pt-4 pb-3.5 border-b border-white/[0.08] bg-black/25 backdrop-blur-2xl flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {/* 呼吸极光光球 */}
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-cyan-400 p-[1.5px] shadow-[0_0_16px_rgba(168,85,247,0.35)]">
                <div className="w-full h-full bg-[#0d0e15] rounded-full flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-cyan-300 animate-[spin_8s_linear_infinite]" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[14.5px] font-semibold text-white tracking-tight">
                    AI 找歌助手
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-semibold bg-gradient-to-r from-purple-500/25 to-cyan-500/25 text-purple-200 border border-purple-400/30 shadow-sm">
                    Agent v2
                  </span>
                </div>

                {/* 模型在线与自动切换状态 */}
                <div className="flex items-center gap-1.5 text-[11px] text-white/60 mt-0.5">
                  {isConfigured ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                      <span className="truncate max-w-[170px] text-white/80 font-medium">
                        {activeConfig?.model || activeConfig?.name || "在线就绪"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                      <span className="text-amber-300/90 font-medium">尚未连接 AI 接口</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 右侧微光操作胶囊 */}
            <div className="flex items-center gap-1.5">
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

          {/* 未配置 AI 时的高奢 Apple 极光晶体引导卡片 (取代生硬刺眼的黄色报警条) */}
          {!isConfigured && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="relative z-10 p-3.5 mx-4 my-2.5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-pink-500/10 to-amber-500/15 border border-purple-500/30 flex items-center justify-between gap-3 shadow-[0_4px_20px_rgba(168,85,247,0.15)] shrink-0 backdrop-blur-2xl"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-purple-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-white truncate">
                    {!isEnabled ? "AI 功能目前已暂停" : "尚未配置 API Key"}
                  </div>
                  <div className="text-[10.5px] text-white/60 truncate">
                    支持 SenseNova / DeepSeek / 硅基流动 等多模型池
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenAISettings}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-white/20 text-[11.5px] font-medium flex items-center gap-1.5 transition-all shadow-md shadow-purple-950/40 active:scale-95 shrink-0"
              >
                <Key className="w-3.5 h-3.5" />
                <span>配置端点</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </motion.div>
          )}

          {/* 消息对话主滚动区 */}
          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth min-h-0">
            {messages.map((msg) => {
              if (msg.role === "tool") {
                if (msg.songResults && msg.songResults.length > 0) {
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2.5 my-3"
                    >
                      {/* 检索结果顶栏与批量操作按钮 */}
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[12px] font-medium text-purple-300/90 flex items-center gap-1.5">
                          <Music4 className="w-3.5 h-3.5 text-cyan-300" />
                          <span>已全网检索到 {msg.songResults.length} 首曲目</span>
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePlayAllResults(msg.songResults || [])}
                            className="px-2.5 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-[11px] font-medium flex items-center gap-1 transition-all active:scale-95"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>一键连播</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddAllToQueue(msg.songResults || [])}
                            className="px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white/80 border border-white/[0.1] text-[11px] font-medium flex items-center gap-1 transition-all active:scale-95"
                          >
                            <ListPlus className="w-3 h-3" />
                            <span>全部加歌</span>
                          </button>
                        </div>
                      </div>

                      {/* 歌曲卡片列表 */}
                      <div className="grid grid-cols-1 gap-2.5">
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
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="flex justify-end gap-2.5 items-end pl-12 group"
                  >
                    {/* 用户消息悬浮复制按钮 */}
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-all mb-1"
                      title="复制"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* 紫罗兰晶体磨砂玻璃气泡 */}
                    <div className="max-w-[86%] rounded-[20px] rounded-tr-[4px] bg-gradient-to-tr from-purple-600/75 via-indigo-600/75 to-purple-500/75 border border-white/25 px-4 py-2.5 text-[13.5px] text-white leading-relaxed shadow-lg shadow-purple-950/40 backdrop-blur-xl break-words whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 border border-white/25 flex items-center justify-center shrink-0 mb-0.5 text-white shadow-md">
                      <User className="w-4 h-4" />
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
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="flex justify-start gap-2.5 items-start pr-8 group"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border border-white/15 flex items-center justify-center shrink-0 mt-0.5 text-cyan-300 shadow-md backdrop-blur-xl">
                    <Bot className="w-4.5 h-4.5" />
                  </div>

                  <div className="space-y-2.5 flex-1 min-w-0">
                    {/* 高透超薄极光玻璃消息气泡 */}
                    {msg.content && (
                      <div
                        className={`relative rounded-[20px] rounded-tl-[4px] px-4 py-3 text-[13.5px] leading-relaxed break-words whitespace-pre-wrap border backdrop-blur-2xl transition-all ${
                          isError
                            ? "bg-red-500/10 border-red-500/30 text-red-200 shadow-[0_4px_20px_rgba(239,68,68,0.15)]"
                            : "bg-white/[0.05] hover:bg-white/[0.07] border-white/[0.10] text-white/95 shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]"
                        }`}
                      >
                        <div>{msg.content}</div>

                        {/* 错误时的快捷切换模型按钮 */}
                        {isError && (
                          <div className="pt-2.5 mt-2 border-t border-red-500/20 flex items-center justify-between gap-2">
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

                        {/* 气泡底部微工具栏 */}
                        {!isError && (
                          <div className="pt-2 mt-1 border-t border-white/[0.06] flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="text-[11px] text-white/40 hover:text-white/80 flex items-center gap-1 transition-colors"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>已复制</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>复制</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 关联的歌曲卡片列表 */}
                    {msg.songResults && msg.songResults.length > 0 && (
                      <div className="space-y-2.5 pt-1">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[12px] font-medium text-purple-300/90 flex items-center gap-1.5">
                            <Music4 className="w-3.5 h-3.5 text-cyan-300" />
                            <span>推荐曲目 ({msg.songResults.length})</span>
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePlayAllResults(msg.songResults || [])}
                              className="px-2.5 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-[11px] font-medium flex items-center gap-1 transition-all active:scale-95"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>一键连播</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddAllToQueue(msg.songResults || [])}
                              className="px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white/80 border border-white/[0.1] text-[11px] font-medium flex items-center gap-1 transition-all active:scale-95"
                            >
                              <ListPlus className="w-3 h-3" />
                              <span>全部加歌</span>
                            </button>
                          </div>
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
                      </div>
                    )}

                    {/* 初次欢迎语后的 Apple Intelligence 灵动分类矩阵 */}
                    {isGreeting && (
                      <div className="pt-3 space-y-3">
                        <div className="text-[12px] font-medium text-white/60 flex items-center gap-1.5 px-1">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                          <span>灵感探索矩阵：</span>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          {INSPIRATION_CATEGORIES.map((cat) => {
                            const CatIcon = cat.icon;
                            return (
                              <div
                                key={cat.category}
                                className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl space-y-1.5"
                              >
                                <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white/80 px-1">
                                  <CatIcon className="w-3.5 h-3.5 text-purple-300" />
                                  <span>{cat.category}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {cat.prompts.map((prompt) => (
                                    <button
                                      key={prompt}
                                      type="button"
                                      onClick={() => handlePromptClick(prompt)}
                                      className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] hover:border-purple-400/40 text-[12px] text-white/85 hover:text-white transition-all text-left flex items-center gap-1.5 active:scale-95 shadow-sm"
                                    >
                                      <span>{prompt}</span>
                                      <ArrowRight className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* 正在执行 Tool / 极光脉冲律动指示器 */}
            {isProcessing && <ToolCallIndicator toolName={currentToolName} />}

            <div ref={messagesEndRef} className="h-1" />
          </div>

          {/* 底部悬浮灵动输入胶囊与控制区 */}
          <div className="relative z-10 p-3 sm:p-4 border-t border-white/[0.08] bg-black/35 backdrop-blur-2xl shrink-0 space-y-2">
            <div className="relative flex items-end gap-2 bg-white/[0.05] border border-white/[0.12] focus-within:border-purple-500/60 focus-within:shadow-[0_0_24px_rgba(168,85,247,0.25)] rounded-2xl p-2 transition-all shadow-inner backdrop-blur-xl">
              <textarea
                ref={textareaRef}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isProcessing ? "AI 正在全网检索中..." : "描述想听的歌曲、模糊歌词、歌手或心情..."
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
                  className="w-8 h-8 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-md shadow-red-950/30"
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
                      ? "bg-gradient-to-tr from-purple-500 to-cyan-500 text-white shadow-md shadow-purple-500/30 hover:opacity-90 hover:scale-105"
                      : "bg-white/5 text-white/20 cursor-not-allowed"
                  }`}
                  title="发送 (Enter)"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-white/40 px-1">
              <div className="flex items-center gap-1.5">
                <CornerDownLeft className="w-3 h-3 text-white/30" />
                <span>Enter 发送 / Shift+Enter 换行</span>
              </div>
              <button
                type="button"
                onClick={handleOpenAISettings}
                className="hover:text-purple-300 transition-colors flex items-center gap-1 font-medium"
              >
                <Key className="w-3 h-3" />
                <span>AI 设置 (⌘I)</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

