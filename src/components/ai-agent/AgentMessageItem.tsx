"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Bot,
  User,
  Copy,
  Check,
  Music4,
  Play,
  ListPlus,
  Key,
  ArrowRight,
  Sparkles,
  Search,
  Moon,
  Radio,
} from "lucide-react";
import { AgentMessage, SongResult } from "@/types/aiAgent";
import { Song } from "@/types/song";
import { SongResultCard } from "./SongResultCard";
import { AIMarkdownRenderer } from "./AIMarkdownRenderer";
import { CuratorWelcomeHeroCard } from "./CuratorWelcomeHeroCard";

export const INSPIRATION_CATEGORIES = [
  {
    category: "歌词寻歌",
    icon: Search,
    prompts: ["有句歌词是'如果天黑之前来得及'", "搜歌词包含'爱是一道光'的歌"],
  },
  {
    category: "深夜心情",
    icon: Moon,
    prompts: ["来几首适合深夜独自沉思的吉他民谣", "心情低落时听的治愈系钢琴曲"],
  },
  {
    category: "场景电台",
    icon: Radio,
    prompts: ["适合专注工作编程的极简 Lo-Fi 节奏", "开车兜风时的动感放克音乐"],
  },
  {
    category: "歌手精选",
    icon: Music4,
    prompts: ["搜周杰伦的经典抒情慢歌", "推荐几首陈奕迅小众但好听的粤语歌"],
  },
];

export interface AgentMessageItemProps {
  message: AgentMessage;
  onPlaySong: (song: Song) => void;
  onDownloadSong: (song: Song) => Promise<void>;
  onPlayAll: (results: SongResult[]) => void;
  onAddAllToQueue: (results: SongResult[]) => void;
  onOpenAISettings: () => void;
  onCopyText: (id: string, text: string) => void;
  onSendPrompt?: (text: string) => void;
  isCopied?: boolean;
}

const MESSAGE_ENTER = {
  initial: { opacity: 0, y: 6, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

export const AgentMessageItem: React.FC<AgentMessageItemProps> = React.memo(
  ({
    message,
    onPlaySong,
    onDownloadSong,
    onPlayAll,
    onAddAllToQueue,
    onOpenAISettings,
    onCopyText,
    onSendPrompt,
    isCopied = false,
  }) => {
    // 1. Tool 消息展示 (曲目结果列表)
    if (message.role === "tool") {
      if (!message.songResults || message.songResults.length === 0) {
        return null;
      }

      return (
        <motion.div
          {...MESSAGE_ENTER}
          className="rounded-[20px] bg-white/[0.03] border border-white/[0.08] p-3 space-y-2.5 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] my-2 transform-gpu"
        >
          {/* 检索结果顶栏与批量操作按钮 */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] font-medium text-white/70 flex items-center gap-1.5">
              <Music4 className="w-3.5 h-3.5 text-white/60" />
              <span>已全网检索到 {message.songResults.length} 首曲目</span>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onPlayAll(message.songResults || [])}
                className="px-2.5 py-1 rounded-full bg-white/[0.12] hover:bg-white/[0.22] text-white border border-white/[0.15] text-[11px] font-medium flex items-center gap-1 transition-all active:scale-95 shadow-sm"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>一键连播</span>
              </button>
              <button
                type="button"
                onClick={() => onAddAllToQueue(message.songResults || [])}
                className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-white/80 border border-white/[0.1] text-[11px] font-medium flex items-center gap-1 transition-all active:scale-95"
              >
                <ListPlus className="w-3 h-3" />
                <span>全部加歌</span>
              </button>
            </div>
          </div>

          {/* 内部纵向紧凑滚动区 */}
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {message.songResults.map((sr) => (
              <SongResultCard
                key={sr.song.id}
                result={sr}
                onPlay={onPlaySong}
                onDownload={onDownloadSong}
              />
            ))}
          </div>
        </motion.div>
      );
    }

    // 2. User 消息展示
    if (message.role === "user") {
      return (
        <motion.div
          {...MESSAGE_ENTER}
          className="flex justify-end gap-2.5 items-end pl-12 group transform-gpu"
        >
          {/* 用户消息悬浮复制按钮 */}
          <button
            type="button"
            onClick={() => onCopyText(message.id, message.content)}
            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-all mb-1"
            title="复制"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* 深空冷钛磨砂玻璃气泡 */}
          <div className="max-w-[86%] rounded-[20px] rounded-tr-[4px] bg-white/[0.12] hover:bg-white/[0.16] border border-white/[0.18] px-4 py-2.5 text-[13.5px] text-white leading-relaxed shadow-md backdrop-blur-xl break-words whitespace-pre-wrap transition-colors">
            {message.content}
          </div>

          <div className="w-7 h-7 rounded-full bg-white/[0.15] border border-white/[0.2] flex items-center justify-center shrink-0 mb-0.5 text-white shadow-sm">
            <User className="w-3.5 h-3.5" />
          </div>
        </motion.div>
      );
    }

    // 3. Assistant 消息展示 (若为欢迎消息，使用 Apple 灵动流光微晶看板)
    const isGreeting = message.id === "greeting";
    if (isGreeting) {
      return (
        <motion.div {...MESSAGE_ENTER} className="w-full transform-gpu">
          <CuratorWelcomeHeroCard onSendPrompt={onSendPrompt || (() => {})} />
        </motion.div>
      );
    }

    const isError = message.status === "error";
    const hasContent = Boolean(message.content && message.content.trim().length > 0);
    const hasSongResults = Boolean(message.songResults && message.songResults.length > 0);

    if (!hasContent && !hasSongResults && !isError) {
      return null;
    }

    return (
      <motion.div
        {...MESSAGE_ENTER}
        className="flex justify-start gap-2.5 items-start pr-8 group transform-gpu"
      >
        <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center shrink-0 mt-0.5 text-white/80 shadow-sm backdrop-blur-xl">
          <Bot className="w-4 h-4" />
        </div>

        <div className="space-y-2.5 flex-1 min-w-0">
          {hasContent && (
            <div
              className={`relative rounded-[22px] rounded-tl-[4px] px-4 py-3 text-[13.5px] leading-relaxed break-words border backdrop-blur-2xl transition-all shadow-[0_8px_32px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.1)] ${
                isError
                  ? "bg-red-500/10 border-red-500/30 text-red-200 shadow-[0_4px_20px_rgba(239,68,68,0.15)]"
                  : "bg-white/[0.05] hover:bg-white/[0.07] border-white/[0.1] text-white/90"
              }`}
            >
              <AIMarkdownRenderer content={message.content} />

              {/* 错误时的快捷切换模型按钮 */}
              {isError && (
                <div className="pt-2.5 mt-2 border-t border-red-500/20 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onOpenAISettings}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.15] hover:bg-white/[0.25] text-white border border-white/[0.2] text-[12px] font-semibold transition-all active:scale-95 shadow-sm"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>打开 AI 设置切换模型 / 检查密钥</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* 复制按钮 */}
              {!isError && (
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/[0.04] mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => onCopyText(message.id, message.content)}
                    className="text-[11px] text-white/50 hover:text-white flex items-center gap-1 transition-colors"
                    title="复制回答"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">已复制</span>
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

          {/* 附带的曲目检索列表 */}
          {hasSongResults && message.songResults && (
            <div className="rounded-[20px] bg-white/[0.03] border border-white/[0.08] p-3 space-y-2.5 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
              <div className="flex items-center justify-between px-1">
                <span className="text-[12px] font-medium text-white/70 flex items-center gap-1.5">
                  <Music4 className="w-3.5 h-3.5 text-white/60" />
                  <span>精选推荐曲目 ({message.songResults.length})</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPlayAll(message.songResults || [])}
                    className="px-2.5 py-1 rounded-full bg-white/[0.12] hover:bg-white/[0.22] text-white border border-white/[0.15] text-[11px] font-medium flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>一键连播</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddAllToQueue(message.songResults || [])}
                    className="px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-white/80 border border-white/[0.1] text-[11px] font-medium flex items-center gap-1 transition-all active:scale-95"
                  >
                    <ListPlus className="w-3 h-3" />
                    <span>全部加歌</span>
                  </button>
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {message.songResults.map((sr) => (
                  <SongResultCard
                    key={sr.song.id}
                    result={sr}
                    onPlay={onPlaySong}
                    onDownload={onDownloadSong}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  },
  (prev, next) => {
    return (
      prev.message.id === next.message.id &&
      prev.message.content === next.message.content &&
      prev.message.status === next.message.status &&
      prev.message.songResults?.length === next.message.songResults?.length &&
      prev.isCopied === next.isCopied
    );
  }
);

AgentMessageItem.displayName = "AgentMessageItem";
