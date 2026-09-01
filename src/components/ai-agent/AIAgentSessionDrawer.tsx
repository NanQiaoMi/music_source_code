"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  X,
  Search,
  MessageSquare,
  Clock,
  Edit2,
  Check,
  AlertCircle,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useAIAgentStore } from "@/store/useAIAgentStore";
import { AgentSessionMeta } from "@/types/aiAgent";

export interface AIAgentSessionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return "刚刚";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const d = new Date(timestamp);
  return `${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
    .getDate()
    .toString()
    .padStart(2, "0")}`;
}

export const AIAgentSessionDrawer: React.FC<AIAgentSessionDrawerProps> = React.memo(
  ({ isOpen, onClose }) => {
    const sessions = useAIAgentStore((state) => state.sessions);
    const currentSessionId = useAIAgentStore((state) => state.currentSessionId);
    const createNewSession = useAIAgentStore((state) => state.createNewSession);
    const switchSession = useAIAgentStore((state) => state.switchSession);
    const deleteSession = useAIAgentStore((state) => state.deleteSession);
    const clearAllSessions = useAIAgentStore((state) => state.clearAllSessions);
    const renameSession = useAIAgentStore((state) => state.renameSession);

    const [searchQuery, setSearchQuery] = useState("");
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // 过滤会话列表
    const filteredSessions = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return sessions;
      return sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.lastSnippet && s.lastSnippet.toLowerCase().includes(q))
      );
    }, [sessions, searchQuery]);

    const handleCreate = () => {
      createNewSession();
      onClose();
    };

    const handleSwitch = (id: string) => {
      if (editingSessionId) return;
      switchSession(id);
      onClose();
    };

    const handleStartRename = (e: React.MouseEvent, session: AgentSessionMeta) => {
      e.stopPropagation();
      setEditingSessionId(session.id);
      setEditingTitle(session.title);
    };

    const handleSaveRename = (e: React.MouseEvent | React.FormEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (editingTitle.trim()) {
        renameSession(id, editingTitle.trim());
      }
      setEditingSessionId(null);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await deleteSession(id);
    };

    const handleConfirmClearAll = async () => {
      await clearAllSessions();
      setShowClearConfirm(false);
      onClose();
    };

    return (
      <AnimatePresence>
        {isOpen && (
          <div className="absolute inset-0 z-30 flex overflow-hidden">
            {/* 蒙层 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* 侧滑抽屉面板 */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 35 }}
              className="relative z-10 w-full sm:w-[380px] h-full bg-[#0d0e15]/95 border-r border-white/[0.1] shadow-2xl backdrop-blur-3xl flex flex-col overflow-hidden text-white font-sans transform-gpu will-change-transform"
            >
              {/* 顶部 Header */}
              <div className="p-4 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-white/80" />
                  </div>
                  <div>
                    <h4 className="text-[13.5px] font-semibold text-white tracking-tight flex items-center gap-1.5">
                      <span>历史对话记录</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/[0.08] text-white/60">
                        {sessions.length}
                      </span>
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="px-2.5 py-1.5 rounded-xl bg-white text-black hover:bg-white/90 text-[11.5px] font-medium flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                    title="新建对话"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新建</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.1] transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 搜索过滤栏 */}
              <div className="px-3.5 pt-3 pb-2 shrink-0">
                <div className="relative flex items-center bg-white/[0.04] border border-white/[0.08] focus-within:border-white/[0.22] rounded-xl px-2.5 py-1.5 transition-all">
                  <Search className="w-3.5 h-3.5 text-white/40 shrink-0 mr-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索历史对话或歌词..."
                    className="w-full bg-transparent text-[12.5px] text-white placeholder-white/35 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-white/40 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 会话列表主滚动区 */}
              <div className="flex-1 overflow-y-auto px-3.5 py-1.5 space-y-1.5 custom-scrollbar min-h-0">
                {filteredSessions.length === 0 ? (
                  <div className="py-12 text-center text-white/40 space-y-2">
                    <MessageSquare className="w-8 h-8 mx-auto opacity-30 stroke-1" />
                    <div className="text-[12.5px]">未找到匹配的对话记录</div>
                  </div>
                ) : (
                  filteredSessions.map((session) => {
                    const isActive = session.id === currentSessionId;
                    const isEditing = editingSessionId === session.id;

                    return (
                      <div
                        key={session.id}
                        onClick={() => handleSwitch(session.id)}
                        className={`group relative rounded-2xl p-3 border transition-all cursor-pointer select-none ${
                          isActive
                            ? "bg-white/[0.10] border-white/[0.22] shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]"
                            : "bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.06] hover:border-white/[0.14]"
                        }`}
                      >
                        {/* 会话标题与操作栏 */}
                        <div className="flex items-center justify-between gap-2">
                          {isEditing ? (
                            <form
                              onSubmit={(e) => handleSaveRename(e, session.id)}
                              className="flex items-center gap-1.5 flex-1 min-w-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                autoFocus
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                className="flex-1 bg-black/40 border border-white/30 rounded-lg px-2 py-0.5 text-[12.5px] text-white focus:outline-none"
                              />
                              <button
                                type="submit"
                                className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/30"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSessionId(null);
                                }}
                                className="w-6 h-6 rounded-lg bg-white/10 text-white/60 flex items-center justify-center hover:bg-white/20"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          ) : (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                              )}
                              <span
                                className={`text-[13px] font-medium truncate ${
                                  isActive ? "text-white" : "text-white/85"
                                }`}
                              >
                                {session.title}
                              </span>
                            </div>
                          )}

                          {/* 悬浮操作图标 */}
                          {!isEditing && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={(e) => handleStartRename(e, session)}
                                className="w-6 h-6 rounded-lg hover:bg-white/[0.12] text-white/50 hover:text-white flex items-center justify-center transition-colors"
                                title="重命名"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDelete(e, session.id)}
                                className="w-6 h-6 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-300 flex items-center justify-center transition-colors"
                                title="删除会话"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 摘要与时间微标 */}
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/45 gap-2">
                          <span className="truncate flex-1">
                            {session.lastSnippet || "暂无最新消息"}
                          </span>
                          <span className="shrink-0 flex items-center gap-1 text-[10.5px]">
                            <Clock className="w-3 h-3 text-white/30" />
                            <span>{formatRelativeTime(session.updatedAt)}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 底部一键清空与重置栏 */}
              <div className="p-3 border-t border-white/[0.08] bg-black/20 shrink-0">
                {showClearConfirm ? (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11.5px] text-red-300 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>确定要清空全部历史对话吗？此操作不可逆。</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowClearConfirm(false)}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-[11px]"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmClearAll}
                        className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[11px] font-medium shadow-sm"
                      >
                        确认清空
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="w-full py-2 rounded-xl bg-white/[0.03] hover:bg-red-500/15 text-white/50 hover:text-red-300 border border-white/[0.06] hover:border-red-500/30 text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>清空所有历史对话</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }
);

AIAgentSessionDrawer.displayName = "AIAgentSessionDrawer";
