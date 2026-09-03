/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gauge, RotateCcw } from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useUIStore } from "@/store/uiStore";

export interface FloatingSpeedControlProps {
  className?: string;
  menuPosition?: "top" | "bottom";
  buttonSize?: "sm" | "md";
}

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export const FloatingSpeedControl: React.FC<FloatingSpeedControlProps> = ({
  className = "",
  menuPosition = "top",
  buttonSize = "sm",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const audioPlaybackRate = useAudioStore((state) => state.playbackRate);
  const playerPlaybackRate = usePlayerStore((state) => state.playbackRate);
  const playbackRate = audioPlaybackRate || playerPlaybackRate || 1.0;

  const setAudioPlaybackRate = useAudioStore((state) => state.setPlaybackRate);
  const resetPlaybackRate = useAudioStore((state) => state.resetPlaybackRate);
  const showToast = useUIStore((state) => state.showToast);

  const isCustomSpeed = Math.abs(playbackRate - 1.0) > 0.01;
  const progressPercent = Math.min(100, Math.max(0, ((playbackRate - 0.5) / 1.5) * 100));

  // 单击展开/收起，双击一键极速恢复原速
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      if (isCustomSpeed) {
        resetPlaybackRate();
        showToast?.("播放速度已恢复: 1.00x (原速)", "info", 2000);
      } else {
        setIsOpen((prev) => !prev);
      }
      return;
    }

    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null;
      setIsOpen((prev) => !prev);
    }, 240);
  };

  const handleSelectSpeed = useCallback(
    (speed: number) => {
      setAudioPlaybackRate(speed);
      showToast?.(`播放速度: ${speed.toFixed(2)}x`, "info", 1800);
    },
    [setAudioPlaybackRate, showToast]
  );

  const handleStepSpeed = useCallback(
    (delta: number) => {
      const current = useAudioStore.getState().playbackRate || 1.0;
      const next = Math.max(0.5, Math.min(2.0, Math.round((current + delta) * 100) / 100));
      setAudioPlaybackRate(next);
      showToast?.(`播放速度: ${next.toFixed(2)}x`, "info", 1500);
    },
    [setAudioPlaybackRate, showToast]
  );

  const handleReset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      resetPlaybackRate();
      showToast?.("播放速度已恢复: 1.00x (原速)", "info", 2000);
    },
    [resetPlaybackRate, showToast]
  );

  // Click outside 与 Escape 键自动平滑收起
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const sizeClasses = buttonSize === "sm" ? "w-7 h-7" : "w-8 h-8";

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 正常状态下为一个精致的 Apple 风格磨砂图标按钮 */}
      <motion.button
        type="button"
        data-testid="floating-speed-trigger"
        onClick={handleButtonClick}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className={`control-interactive relative ${sizeClasses} rounded-full flex items-center justify-center transition-all cursor-pointer ${
          isOpen
            ? "bg-[#0071e3]/30 text-[#2997ff] border border-[#0071e3]/60 shadow-[0_0_14px_rgba(0,113,227,0.4)]"
            : isCustomSpeed
              ? "bg-[#0071e3]/20 text-[#2997ff] border border-[#0071e3]/45 shadow-[0_0_10px_rgba(0,113,227,0.3)]"
              : "text-white/60 hover:text-white hover:bg-white/10"
        }`}
        title={
          isCustomSpeed
            ? `当前倍速: ${playbackRate.toFixed(2)}x (点击调速，双击恢复原速)`
            : "播放速度 (点击调速)"
        }
        aria-label="播放速度调节"
      >
        <Gauge className="w-3.5 h-3.5 pointer-events-none" />

        {/* 当处于自定义倍速时，内嵌微晶指示点（位于圆环内右上角，不溢出破坏轮廓） */}
        {isCustomSpeed && (
          <span className="absolute top-1 right-1 flex h-1.5 w-1.5 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2997ff] opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2997ff] shadow-[0_0_6px_#2997ff]" />
          </span>
        )}
      </motion.button>

      {/* 点击展开：统一设计语言的 Apple 纯净微光液态毛玻璃卡片 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            data-testid="floating-speed-menu"
            initial={{ opacity: 0, scale: 0.95, y: menuPosition === "top" ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: menuPosition === "top" ? 8 : -8 }}
            transition={{ type: "spring", stiffness: 460, damping: 30 }}
            className={`absolute ${
              menuPosition === "top" ? "bottom-full mb-3" : "top-full mt-3"
            } right-0 z-50 w-[316px] p-4 rounded-3xl select-none shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.22)] border border-white/[0.18] flex flex-col gap-3.5`}
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(20, 20, 26, 0.90) 100%)",
              backdropFilter: "blur(32px) saturate(190%)",
              WebkitBackdropFilter: "blur(32px) saturate(190%)",
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* 顶部极细反光线 (与底部播放条完全一致) */}
            <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

            {/* 1. 顶栏：标题 + 状态读数 + 恢复原速按钮 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#2997ff]" />
                <span className="text-[13px] font-semibold text-white tracking-tight">播放速度</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-medium text-[#2997ff] bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/[0.08]">
                  {playbackRate.toFixed(2)}x
                </span>

                {isCustomSpeed ? (
                  <motion.button
                    type="button"
                    data-testid="speed-reset-button"
                    onClick={handleReset}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 font-medium transition-all border border-white/15 cursor-pointer shadow-sm"
                    title="恢复为 1.00x 原速"
                  >
                    <RotateCcw className="w-2.5 h-2.5 text-cyan-300" />
                    <span>恢复原速</span>
                  </motion.button>
                ) : (
                  <span className="text-[11px] text-white/40 font-medium px-1">标准原速</span>
                )}
              </div>
            </div>

            {/* 2. 预设倍速分段胶囊 (与设置面板统一的 6 分段架构) */}
            <div className="grid grid-cols-6 gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              {SPEED_PRESETS.map((speed) => {
                const isSelected = Math.abs(playbackRate - speed) < 0.01;
                return (
                  <button
                    key={speed}
                    type="button"
                    data-testid={`speed-preset-${speed}`}
                    onClick={() => handleSelectSpeed(speed)}
                    className={`py-1.5 rounded-xl text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? "bg-[#0071e3] text-white shadow-sm font-semibold scale-[1.02]"
                        : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    {speed === 1.0 ? "1.0x" : `${speed}x`}
                  </button>
                );
              })}
            </div>

            {/* 3. 无级连续滑动条 + 微调步进按钮 */}
            <div className="space-y-2 pt-1 border-t border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  data-testid="speed-step-minus"
                  onClick={() => handleStepSpeed(-0.05)}
                  className="w-6 h-6 rounded-full bg-white/[0.06] hover:bg-white/[0.15] active:scale-90 text-white/70 hover:text-white flex items-center justify-center text-xs font-bold border border-white/[0.08] transition-all cursor-pointer flex-shrink-0"
                  title="微调减速 -0.05x"
                >
                  -
                </button>

                <div className="relative flex-1 flex items-center h-5">
                  {/* 背景轨道与渐变填充 */}
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/[0.12] pointer-events-none overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#0071e3] to-[#2997ff] rounded-full transition-all duration-75"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* 1.00x 原速中心刻度指示点 (33.33% 位置) */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-white/40 pointer-events-none -ml-0.5"
                    style={{ left: "33.33%" }}
                    title="1.00x 原速锚点"
                  />

                  {/* 交互 range input */}
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={playbackRate}
                    data-testid="speed-slider"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setAudioPlaybackRate(val);
                    }}
                    className="w-full h-5 appearance-none bg-transparent cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.5),0_0_0_2px_rgba(41,151,255,0.8)] [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-95 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.5),0_0_0_2px_rgba(41,151,255,0.8)]"
                  />
                </div>

                <button
                  type="button"
                  data-testid="speed-step-plus"
                  onClick={() => handleStepSpeed(0.05)}
                  className="w-6 h-6 rounded-full bg-white/[0.06] hover:bg-white/[0.15] active:scale-90 text-white/70 hover:text-white flex items-center justify-center text-xs font-bold border border-white/[0.08] transition-all cursor-pointer flex-shrink-0"
                  title="微调加速 +0.05x"
                >
                  +
                </button>
              </div>

              {/* 刻度底标 */}
              <div className="flex justify-between items-center text-[10.5px] text-white/45 font-medium tabular-nums px-0.5">
                <span>0.50x</span>
                <span
                  className={`transition-colors cursor-pointer ${
                    Math.abs(playbackRate - 1.0) < 0.02
                      ? "text-[#2997ff] font-semibold"
                      : "hover:text-white/80"
                  }`}
                  onClick={() => setAudioPlaybackRate(1.0)}
                  title="点击设为 1.00x 原速"
                >
                  1.00x 原速
                </span>
                <span>2.00x</span>
              </div>
            </div>

            {/* 4. 底栏高保真 DSP 音质防护微标 */}
            <div className="flex items-center justify-between text-[10.5px] text-white/40 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_#34d399]" />
                <span>DSP 原声音高实时校正已启用</span>
              </div>
              <span className="text-white/35 tabular-nums">±0.05x 精度</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingSpeedControl;
