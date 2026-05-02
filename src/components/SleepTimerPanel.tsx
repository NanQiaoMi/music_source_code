"use client";

import { motion } from "framer-motion";
import { Clock, Play, Pause, Timer, Moon } from "lucide-react";
import { useSleepTimerStore, formatSleepTime } from "@/store/sleepTimerStore";
import { GlassModal } from "@/components/shared/Glass";

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
    minutes, remainingSeconds, isActive,
    setTimer, startTimer, pauseTimer, resumeTimer, cancelTimer,
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

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="睡眠定时" width="md">
      <div className="space-y-5">
        {/* Timer icon and subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/[0.10] flex items-center justify-center">
            <Moon className="w-4 h-4 text-white/70" />
          </div>
          <p className="text-[13px] text-white/50">设置播放停止时间</p>
        </div>

        {/* Countdown display */}
        {remainingSeconds > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4"
          >
            <div className="text-[42px] font-bold text-white font-mono tabular-nums tracking-tight">
              {formatSleepTime(remainingSeconds)}
            </div>
            <p className="text-white/40 text-[12px] mt-1">
              {isActive ? "运行中" : "已暂停"}
            </p>
          </motion.div>
        )}

        {/* Timer options grid */}
        <div className="grid grid-cols-3 gap-2">
          {TIMER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelectTimer(option.value)}
              className={`p-3 rounded-xl border transition-colors duration-150 ${
                minutes === option.value
                  ? "bg-white/[0.15] border-white/[0.15] text-white"
                  : "bg-white/[0.04] border-white/[0.06] text-white/60 hover:bg-white/[0.08]"
              }`}
            >
              <Timer className="w-3.5 h-3.5 mx-auto mb-1.5 opacity-60" />
              <span className="text-[12px]">{option.label}</span>
            </button>
          ))}
        </div>

        {/* Action buttons */}
        {minutes && (
          <div className="flex gap-2">
            <button
              onClick={handleStart}
              className="flex-1 py-3 rounded-xl bg-white text-black text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {isActive ? (
                <><Pause className="w-4 h-4" /> 暂停</>
              ) : (
                <><Play className="w-4 h-4" /> {remainingSeconds > 0 ? "继续" : "开始"}</>
              )}
            </button>
            <button
              onClick={cancelTimer}
              className="px-5 py-3 rounded-xl bg-white/[0.08] text-white/60 text-[13px] hover:bg-white/[0.12] transition-colors"
            >
              取消
            </button>
          </div>
        )}

        {/* Info note */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04]">
          <Clock className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-white/35 leading-relaxed">
            音乐将在设定时间后自动暂停播放
          </p>
        </div>
      </div>
    </GlassModal>
  );
}
