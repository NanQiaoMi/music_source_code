"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Clock, Play, Pause, X, Timer, Moon } from "lucide-react";
import { useSleepTimerStore, formatSleepTime } from "@/store/sleepTimerStore";

interface SleepTimerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMER_OPTIONS = [
  { value: 15, label: "15分钟" },
  { value: 30, label: "30分钟" },
  { value: 45, label: "45分钟" },
  { value: 60, label: "60分钟" },
  { value: 90, label: "90分钟" },
];

export function SleepTimerPanel({ isOpen, onClose }: SleepTimerPanelProps) {
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

  const handleSelectTimer = (value: number) => {
    setTimer(value as 15 | 30 | 45 | 60 | 90);
  };

  const handleStart = () => {
    if (isActive) {
      pauseTimer();
    } else if (remainingSeconds > 0 && !isActive) {
      resumeTimer();
    } else {
      startTimer();
    }
  };

  const handleCancel = () => {
    cancelTimer();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-2xl mx-4">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Moon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">睡眠定时</h3>
                    <p className="text-xs text-white/60">设置播放停止时间</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {remainingSeconds > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center mb-8"
                >
                  <div className="text-5xl font-bold text-white mb-2 font-mono">
                    {formatSleepTime(remainingSeconds)}
                  </div>
                  <p className="text-white/60 text-sm">
                    {isActive ? "定时器运行中..." : "定时器已暂停"}
                  </p>
                </motion.div>
              )}

              <div className="grid grid-cols-3 gap-3 mb-6">
                {TIMER_OPTIONS.map((option) => (
                  <motion.button
                    key={option.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectTimer(option.value)}
                    className={`p-3 rounded-xl border transition-all ${
                      minutes === option.value
                        ? "bg-gradient-to-r from-indigo-500 to-purple-500 border-transparent text-white"
                        : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <Timer className="w-4 h-4 mx-auto mb-1" />
                    <span className="text-sm">{option.label}</span>
                  </motion.button>
                ))}
              </div>

              {minutes && (
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStart}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium flex items-center justify-center gap-2"
                  >
                    {isActive ? (
                      <>
                        <Pause className="w-4 h-4" />
                        暂停
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        {remainingSeconds > 0 ? "继续" : "开始"}
                      </>
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCancel}
                    className="px-6 py-3 rounded-xl bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                  >
                    取消
                  </motion.button>
                </div>
              )}

              <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-indigo-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-white/80 font-medium">定时结束后</p>
                    <p className="text-xs text-white/50 mt-1">
                      音乐将在设定时间后自动暂停播放，帮助您安心入睡
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
