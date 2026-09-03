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

  // 单击展开/收起，双击一键恢复原速
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

  const handleReset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      resetPlaybackRate();
      showToast?.("播放速度已恢复: 1.00x (原速)", "info", 2000);
    },
    [resetPlaybackRate, showToast]
  );

  // Click outside 与 Escape 键自动收起
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
      {/* 正常状态下为一个精致的磨砂图标按钮 */}
      <motion.button
        type="button"
        data-testid="floating-speed-trigger"
        onClick={handleButtonClick}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className={`control-interactive relative ${sizeClasses} rounded-full flex items-center justify-center transition-all ${
          isOpen
            ? "bg-[#0071e3]/30 text-[#2997ff] border border-[#0071e3]/60 shadow-[0_0_12px_rgba(0,113,227,0.4)]"
            : isCustomSpeed
              ? "bg-[#0071e3]/20 text-[#2997ff] border border-[#0071e3]/40 shadow-[0_0_8px_rgba(0,113,227,0.3)]"
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

        {/* 当处于自定义倍速时，右上角显示高亮微晶圆点 */}
        {isCustomSpeed && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2997ff] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2997ff]" />
          </span>
        )}
      </motion.button>

      {/* 点击再展开：Apple VisionOS 晶莹液态磨砂气泡浮层 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            data-testid="floating-speed-menu"
            initial={{ opacity: 0, scale: 0.92, y: menuPosition === "top" ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: menuPosition === "top" ? 8 : -8 }}
            transition={{ type: "spring", stiffness: 440, damping: 28 }}
            className={`absolute ${
              menuPosition === "top" ? "bottom-full mb-2.5" : "top-full mt-2.5"
            } right-0 z-50 w-64 p-3.5 rounded-3xl bg-[#161622]/90 backdrop-blur-[40px] backdrop-saturate-[190%] border border-white/[0.16] shadow-[0_20px_60px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.22)] select-none`}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* 顶栏：标题 + 当前倍速 + 恢复原速按钮 */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white tracking-tight">
                <Gauge className="w-3.5 h-3.5 text-[#2997ff]" />
                <span>播放速度</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-medium text-[#2997ff] bg-white/[0.06] px-1.5 py-0.5 rounded-md border border-white/[0.08]">
                  {playbackRate.toFixed(2)}x
                </span>

                {isCustomSpeed && (
                  <motion.button
                    type="button"
                    data-testid="speed-reset-button"
                    onClick={handleReset}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors"
                    title="恢复为 1.00x 原速"
                  >
                    <RotateCcw className="w-2.5 h-2.5 text-cyan-300" />
                    <span>恢复原速</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* 预设倍速网格 (6 宫格) */}
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {SPEED_PRESETS.map((speed) => {
                const isSelected = Math.abs(playbackRate - speed) < 0.01;
                return (
                  <button
                    key={speed}
                    type="button"
                    data-testid={`speed-preset-${speed}`}
                    onClick={() => handleSelectSpeed(speed)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-mono font-medium transition-all ${
                      isSelected
                        ? "bg-[#0071e3] text-white shadow-[0_2px_12px_rgba(0,113,227,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] font-semibold border border-[#0071e3]"
                        : "bg-white/[0.05] hover:bg-white/[0.12] text-white/75 hover:text-white border border-white/[0.06]"
                    }`}
                  >
                    {speed === 1.0 ? "1.0x (原速)" : `${speed}x`}
                  </button>
                );
              })}
            </div>

            {/* 无级连续微调滑块 */}
            <div className="space-y-1 pt-1 border-t border-white/[0.08]">
              <div className="flex justify-between items-center text-[10px] text-white/40 font-mono">
                <span>0.50x</span>
                <span>1.00x</span>
                <span>2.00x</span>
              </div>
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
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingSpeedControl;
