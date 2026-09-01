"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square, CornerDownLeft, Search, Moon, Radio, Music4 } from "lucide-react";

export interface AIAgentInputBoxProps {
  isProcessing: boolean;
  onSend: (text: string) => void;
  onAbort: () => void;
  disabled?: boolean;
}

const INSPIRATION_CATEGORIES = [
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

export const AIAgentInputBox: React.FC<AIAgentInputBoxProps> = React.memo(
  ({ isProcessing, onSend, onAbort, disabled = false }) => {
    const [inputVal, setInputVal] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const handleSend = useCallback(() => {
      const text = inputVal.trim();
      if (!text || isProcessing || disabled) return;
      setInputVal("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      onSend(text);
    }, [inputVal, isProcessing, disabled, onSend]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const handlePromptClick = (prompt: string) => {
      if (isProcessing || disabled) return;
      onSend(prompt);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputVal(e.target.value);
      const target = e.target;
      target.style.height = "auto";
      const nextHeight = Math.min(target.scrollHeight, 120);
      target.style.height = `${nextHeight}px`;
    };

    useEffect(() => {
      textareaRef.current?.focus();
    }, []);

    return (
      <div className="relative z-10 px-4 pt-2 pb-4 bg-black/25 backdrop-blur-2xl border-t border-white/[0.08] shrink-0 space-y-2.5 transform-gpu">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar no-scrollbar select-none">
          {INSPIRATION_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const randomPrompt = cat.prompts[0];
            return (
              <button
                key={cat.category}
                type="button"
                disabled={isProcessing || disabled}
                onClick={() => handlePromptClick(randomPrompt)}
                className="group px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.18] text-[11px] text-white/65 hover:text-white flex items-center gap-1.5 whitespace-nowrap transition-all active:scale-95 shadow-sm disabled:opacity-40 shrink-0"
              >
                <Icon className="w-3 h-3 text-white/60 group-hover:text-white transition-colors" />
                <span>{cat.category}</span>
              </button>
            );
          })}
        </div>

        <div className="relative rounded-[22px] bg-white/[0.05] hover:bg-white/[0.07] focus-within:bg-white/[0.08] border border-white/[0.12] focus-within:border-white/[0.28] transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] p-2 backdrop-blur-3xl">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputVal}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              disabled
                ? "请先在右上角配置并启动 AI 端点..."
                : isProcessing
                  ? "AI 正在全力思考与检索音乐中..."
                  : "问歌名、模糊歌词、场景电台、指令控制播放..."
            }
            className="w-full bg-transparent text-white placeholder-white/40 text-[13.5px] px-3 py-1.5 resize-none focus:outline-none max-h-[120px] custom-scrollbar leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 px-1.5 border-t border-white/[0.04] mt-1 text-[11px] text-white/40 select-none">
            <div className="flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" />
              <span>Enter 发送 / Shift+Enter 换行</span>
            </div>

            <div className="flex items-center gap-1.5">
              {isProcessing ? (
                <button
                  type="button"
                  onClick={onAbort}
                  className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[11.5px] font-medium flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                  title="停止生成"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>停止生成</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputVal.trim() || disabled}
                  className="w-8 h-8 rounded-xl bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40 flex items-center justify-center transition-all active:scale-95 shadow-md"
                  title="发送"
                >
                  <Send className="w-3.5 h-3.5 ml-0.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

AIAgentInputBox.displayName = "AIAgentInputBox";
