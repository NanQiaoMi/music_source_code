/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gauge, RotateCcw, Minus, Plus } from "lucide-react";
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

  // 智能防遮挡位置判定：实时感知胶囊在视口中的垂直与水平距离
  const [placement, setPlacement] = useState<"top" | "bottom">(menuPosition);

  const audioPlaybackRate = useAudioStore((state) => state.playbackRate);
  const playerPlaybackRate = usePlayerStore((state) => state.playbackRate);
  const playbackRate = audioPlaybackRate || playerPlaybackRate || 1.0;

  const setAudioPlaybackRate = useAudioStore((state) => state.setPlaybackRate);
  const resetPlaybackRate = useAudioStore((state) => state.resetPlaybackRate);
  const showToast = useUIStore((state) => state.showToast);

  const isCustomSpeed = Math.abs(playbackRate - 1.0) > 0.01;
  const progressPercent = Math.min(100, Math.max(0, ((playbackRate - 0.5) / 1.5) * 100));

  // 动态视口防遮挡计算：若上方空间不足 270px，自动向下弹出，彻底解决遮挡问题
  const updatePlacement = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const shouldPopBottom = rect.top < 270;
    setPlacement(shouldPopBottom ? "bottom" : "top");
  }, []);

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
        setIsOpen((prev) => {
          if (!prev) updatePlacement();
          return !prev;
        });
      }
      return;
    }

    clickTimeoutRef.current = setTimeout(() => {
      clickTimeoutRef.current = null;
      setIsOpen((prev) => {
        if (!prev) updatePlacement();
        return !prev;
      });
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

    updatePlacement();
    const handleResize = () => updatePlacement();
    window.addEventListener("resize", handleResize);

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
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePlacement]);

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

        {/* 当处于自定义倍速时，内嵌微晶指示点 */}
        {isCustomSpeed && (
          <span className="absolute top-1 right-1 flex h-1.5 w-1.5 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2997ff] opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2997ff] shadow-[0_0_6px_#2997ff]" />
          </span>
        )}
      </motion.button>

      {/* 点击展开：Apple VisionOS 双层液态磨砂气泡浮层 (动态判定上下位置，物理绝不遮盖胶囊) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            data-testid="floating-speed-menu"
            initial={{
              opacity: 0,
              scale: 0.94,
              y: placement === "top" ? 10 : -10,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.94,
              y: placement === "top" ? 8 : -8,
            }}
            transition={{ type: "spring", stiffness: 480, damping: 30 }}
            style={{
              [placement === "top" ? "bottom" : "top"]: "calc(100% + 14px)",
              right: 0,
            }}
            className="absolute z-[999999] w-[318px] p-1.5 rounded-[28px] bg-white/[0.08] backdrop-blur-[48px] backdrop-saturate-[210%] border border-white/[0.18] shadow-[0_24px_64px_rgba(0,0,0,0.7),0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)] select-none text-white pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* 核心内胆容器 (Concentric Inner Core) */}
            <div className="p-3.5 rounded-[calc(28px-6px)] bg-[#141522]/90 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col gap-3.5">
              {/* 1. 顶栏：标题 + 状态/恢复原速操作 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#0071e3]/20 flex items-center justify-center border border-[#0071e3]/30">
                    <Gauge className="w-3.5 h-3.5 text-[#2997ff]" />
                  </div>
                  <span className="text-xs font-semibold text-white tracking-tight">播放速度</span>
                  <span className="text-[11px] font-mono font-bold text-[#2997ff] bg-[#0071e3]/15 px-2 py-0.5 rounded-full border border-[#2997ff]/30 shadow-[0_0_8px_rgba(41,151,255,0.25)]">
                    {playbackRate.toFixed(2)}x
                  </span>
                </div>

                {/* 恢复原速按钮 */}
                {isCustomSpeed ? (
                  <motion.button
                    type="button"
                    data-testid="speed-reset-button"
                    onClick={handleReset}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="group flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-[#0071e3]/20 hover:bg-[#0071e3]/35 text-[#409cff] hover:text-white border border-[#0071e3]/40 shadow-[0_0_12px_rgba(0,113,227,0.25)] transition-all cursor-pointer"
                    title="点击一键恢复 1.00x 原速"
                  >
                    <RotateCcw className="w-2.5 h-2.5 transition-transform group-hover:-rotate-90 duration-300" />
                    <span>恢复原速</span>
                  </motion.button>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/[0.08] font-medium tracking-tight">
                    标准原速
                  </span>
                )}
              </div>

              {/* 2. 苹果一体化分段胶囊轨道 (Segmented Capsule Track) */}
              <div className="relative bg-white/[0.06] p-1 rounded-2xl border border-white/[0.08] flex items-center justify-between shadow-inner">
                {SPEED_PRESETS.map((speed) => {
                  const isSelected = Math.abs(playbackRate - speed) < 0.01;
                  return (
                    <button
                      key={speed}
                      type="button"
                      data-testid={`speed-preset-${speed}`}
                      onClick={() => handleSelectSpeed(speed)}
                      className={`relative z-10 flex-1 py-1.5 text-center text-[11px] font-mono font-medium transition-colors ${
                        isSelected ? "text-white font-bold" : "text-white/60 hover:text-white"
                      }`}
                    >
                      {speed === 1.0 ? "1.0x" : `${speed}x`}
                      {isSelected && (
                        <motion.div
                          layoutId="activeSpeedSegment"
                          className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#0071e3] to-[#0055b3] shadow-[0_2px_10px_rgba(0,113,227,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-[#2997ff]/40 -z-10"
                          transition={{ type: "spring", stiffness: 450, damping: 30 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 3. 连续无级滑块与 ±0.05x 微调步进器 */}
              <div className="space-y-1.5 pt-1 border-t border-white/[0.08]">
                <div className="flex items-center gap-2">
                  {/* -0.05x 步进 */}
                  <button
                    type="button"
                    data-testid="speed-step-minus"
                    onClick={() => handleStepSpeed(-0.05)}
                    disabled={playbackRate <= 0.5}
                    className="w-7 h-7 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 border border-white/[0.08] flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-90 flex-shrink-0 cursor-pointer"
                    title="微调 -0.05x"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  {/* 滑轨容器 */}
                  <div className="relative flex-1 flex items-center h-6 px-1">
                    {/* 背景轨道与已选激活条 */}
                    <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden relative border border-white/[0.05]">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-[#0071e3] rounded-full shadow-[0_0_8px_rgba(41,151,255,0.6)]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {/* 1.00x 原速中心刻度指示点 (33.33% 位置) */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-white/35 pointer-events-none -ml-0.5 z-10"
                      style={{ left: "33.33%" }}
                      title="1.00x 原速锚点"
                    />

                    {/* 原生 range input */}
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
                      className="absolute inset-0 w-full opacity-0 cursor-pointer z-20"
                    />

                    {/* 高光白水晶滑块手柄 */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.5),0_0_8px_rgba(41,151,255,0.9)] border border-white/80 pointer-events-none z-10"
                      style={{
                        left: `calc(${progressPercent}% - 8px)`,
                      }}
                    />
                  </div>

                  {/* +0.05x 步进 */}
                  <button
                    type="button"
                    data-testid="speed-step-plus"
                    onClick={() => handleStepSpeed(0.05)}
                    disabled={playbackRate >= 2.0}
                    className="w-7 h-7 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 border border-white/[0.08] flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-90 flex-shrink-0 cursor-pointer"
                    title="微调 +0.05x"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 刻度文字 */}
                <div className="flex justify-between items-center text-[10px] text-white/40 font-mono px-1">
                  <span>0.50x</span>
                  <span
                    className={`cursor-pointer transition-colors ${
                      Math.abs(playbackRate - 1.0) < 0.02
                        ? "text-[#2997ff] font-semibold"
                        : "hover:text-white/70"
                    }`}
                    onClick={() => setAudioPlaybackRate(1.0)}
                    title="设为 1.00x 原速"
                  >
                    1.00x 原速
                  </span>
                  <span>2.00x</span>
                </div>
              </div>

              {/* 4. 底栏微标：DSP 原声音高实时校正保证 */}
              <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-white/45">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  <span>DSP 原声音高实时校正已启用</span>
                </div>
                <span className="font-mono text-white/30">±0.05x 精度</span>
              </div>
            </div>

            {/* 指向气泡三角形锚点 (指向触发按钮) */}
            {placement === "top" ? (
              <div className="absolute -bottom-1.5 right-4 w-3 h-3 rotate-45 bg-[#141522] border-r border-b border-white/[0.18] shadow-sm pointer-events-none" />
            ) : (
              <div className="absolute -top-1.5 right-4 w-3 h-3 rotate-45 bg-[#141522] border-l border-t border-white/[0.18] shadow-sm pointer-events-none" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingSpeedControl;
