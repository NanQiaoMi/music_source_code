/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Moon, Play, Pause, X } from "lucide-react";
import { useSleepTimerStore, formatSleepTime } from "@/store/sleepTimerStore";

interface SleepTimerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMER_OPTIONS = [
  { value: 15, label: "15 分钟" },
  { value: 30, label: "30 分钟" },
  { value: 45, label: "45 分钟" },
  { value: 60, label: "60 分钟" },
  { value: 90, label: "90 分钟" },
];

export const SleepTimerPanel: React.FC<SleepTimerPanelProps> = ({ isOpen, onClose }) => {
  const {
    minutes,
    remainingSeconds,
    isActive,
    setTimer,
    startTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
  } = useSleepTimerStore();

  const totalSeconds = useMemo(() => (minutes || 30) * 60, [minutes]);
  const progressRatio = useMemo(() => {
    if (!remainingSeconds || totalSeconds === 0) return 1;
    return remainingSeconds / totalSeconds;
  }, [remainingSeconds, totalSeconds]);

  const handleSelectTimer = (value: number) => {
    setTimer(value as 15 | 30 | 45 | 60 | 90);
  };

  const handleToggle = () => {
    if (isActive) {
      pauseTimer();
    } else if (remainingSeconds > 0 && !isActive) {
      resumeTimer();
    } else {
      startTimer();
    }
  };

  if (!isOpen) return null;

  // SVG Circular Ring parameters
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md select-none font-sans antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
        className="relative w-full max-w-[420px] bg-[#1c1c1e]/95 rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.7)] border border-white/[0.08] overflow-hidden flex flex-col text-[#f5f5f7]"
      >
        {/* 顶部标题栏 (Apple Standard Header) */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Moon className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-white tracking-[-0.016em] leading-tight">
                睡眠定时 (Sleep Timer)
              </h3>
              <p className="text-[12px] text-[#86868b] mt-0.5 tracking-tight">
                自动停止音乐播放与节能
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 主体区 */}
        <div className="p-7 space-y-6 text-center">
          {/* iOS 18 风格环形倒计时视窗 (Circular Countdown Ring) */}
          <div className="relative flex flex-col items-center justify-center py-2">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                {/* 背景底圈 */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="6"
                  fill="transparent"
                />
                {/* 动态进度圈 */}
                <motion.circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="#0071e3"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              </svg>

              {/* 居中倒计时文字 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  {isActive ? "运行中" : remainingSeconds > 0 ? "已暂停" : "待启动"}
                </span>
                <div className="text-[32px] font-bold text-white font-mono tracking-tight leading-none mt-1">
                  {remainingSeconds > 0 ? formatSleepTime(remainingSeconds) : `${minutes || 30}:00`}
                </div>
              </div>
            </div>
          </div>

          {/* 选项网格 (iOS Segmented Buttons) */}
          <div className="grid grid-cols-5 gap-2">
            {TIMER_OPTIONS.map((option) => {
              const isSelected = minutes === option.value;
              return (
                <motion.button
                  key={option.value}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleSelectTimer(option.value)}
                  className={`py-2 rounded-xl text-center transition-all border text-[12px] font-medium tracking-tight ${
                    isSelected
                      ? "bg-[#0071e3] border-[#0071e3] text-white shadow-md font-semibold"
                      : "bg-white/[0.04] border-white/[0.06] text-[#86868b] hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {option.value}分
                </motion.button>
              );
            })}
          </div>

          {/* 控制按钮组 (Apple Pill Action Buttons) */}
          <div className="flex gap-3 pt-2">
            {remainingSeconds > 0 && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={cancelTimer}
                className="flex-1 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white/80 text-[14px] font-medium transition-colors"
              >
                取消定时
              </motion.button>
            )}
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleToggle}
              className={`flex-1 py-3 rounded-full text-white text-[14px] font-semibold tracking-tight shadow-md transition-all flex items-center justify-center gap-2 ${
                isActive
                  ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                  : remainingSeconds > 0
                    ? "bg-[#34c759] hover:bg-[#2fb350] shadow-[#34c759]/20"
                    : "bg-[#0071e3] hover:bg-[#0077ed] shadow-[#0071e3]/20"
              }`}
            >
              {isActive ? (
                <>
                  <Pause className="w-4 h-4 fill-current" /> 暂停定时
                </>
              ) : remainingSeconds > 0 ? (
                <>
                  <Play className="w-4 h-4 fill-current" /> 继续定时
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" /> 开启定时
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
