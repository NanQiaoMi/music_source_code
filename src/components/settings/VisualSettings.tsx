/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Gauge, Sliders, RotateCcw, X, Check, Activity } from "lucide-react";
import {
  usePerformanceV8Store,
  VISUAL_PERFORMANCE_PRESETS,
  type VisualPerformancePreset,
} from "@/store/performanceV8Store";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";

interface VisualSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const visualModes = [
  {
    id: "heavy" as const,
    name: "液态玻璃 (Glass)",
    subtitle: "Apple Vision 质感",
    description: "深度磨砂景深与高动态微光透射，营造通透悬浮层级",
    blur: 30,
    shadow: 25,
    speed: 0.8,
    perspective: 600,
  },
  {
    id: "light" as const,
    name: "轻盈通透 (Light)",
    subtitle: "均衡高频响应",
    description: "适度模糊与低运算开销，保障轻快灵动的界面交互",
    blur: 10,
    shadow: 10,
    speed: 1.2,
    perspective: 1000,
  },
  {
    id: "minimal" as const,
    name: "极简纯享 (Minimal)",
    subtitle: "纯净低耗电",
    description: "移除多余装饰光效，极速响应并最大化续航时间",
    blur: 0,
    shadow: 0,
    speed: 1.5,
    perspective: 1200,
  },
];

const performancePresetMeta: Record<string, { title: string; subtitle: string; desc: string }> = {
  cinematic: {
    title: "电影画质",
    subtitle: "60 FPS · 极致细节",
    desc: "全粒子流场地貌、光晕泛光与高动态空间运镜后处理",
  },
  balanced: {
    title: "均衡体验",
    subtitle: "30 FPS · 平滑流畅",
    desc: "稳定渲染帧率与适度粒子预算，兼顾流畅度与设备发热",
  },
  battery: {
    title: "省电模式",
    subtitle: "15 FPS · 极低功耗",
    desc: "轻量化粒子计算与极简后处理，适合移动及电池供电场景",
  },
};

function AppleRangeControl({
  label,
  valueLabel,
  description,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  valueLabel: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <div>
          <span className="text-[14px] font-medium text-white tracking-tight">{label}</span>
          {description && (
            <span className="text-[12px] text-[#86868b] ml-2 font-normal hidden sm:inline">
              {description}
            </span>
          )}
        </div>
        <span className="font-mono text-[#2997ff] font-semibold text-[13px]">{valueLabel}</span>
      </div>
      <div className="relative flex items-center py-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
        />
      </div>
    </div>
  );
}

export const VisualSettingsPanel: React.FC<VisualSettingsPanelProps> = ({ isOpen, onClose }) => {
  const {
    blurIntensity,
    shadowDepth,
    animationSpeed,
    perspectiveIntensity,
    visualMode,
    setBlurIntensity,
    setShadowDepth,
    setAnimationSpeed,
    setPerspectiveIntensity,
    setVisualMode,
    resetSettings,
  } = useVisualSettingsStore();

  const { activePreset, config, setPerformancePreset } = usePerformanceV8Store();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    media.addEventListener?.("change", handleChange);
    return () => media.removeEventListener?.("change", handleChange);
  }, []);

  const handleModeSelect = (mode: (typeof visualModes)[number]) => {
    setVisualMode(mode.id);
    setBlurIntensity(mode.blur);
    setShadowDepth(mode.shadow);
    setAnimationSpeed(mode.speed);
    setPerspectiveIntensity(mode.perspective);
  };

  const handlePerformancePreset = (preset: VisualPerformancePreset) => {
    setPerformancePreset(preset);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/70 backdrop-blur-md select-none font-sans antialiased">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
        className="relative w-full max-w-[720px] bg-[#1c1c1e]/95 rounded-[28px] shadow-[0_32px_96px_rgba(0,0,0,0.7)] border border-white/[0.08] overflow-hidden flex flex-col max-h-[88vh] text-[#f5f5f7]"
      >
        {/* 顶部标题栏 (Apple Spacious Header) */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[18px] font-semibold text-white tracking-[-0.02em] leading-tight">
                视觉效果与渲染性能
              </h3>
              <p className="text-[13px] text-[#86868b] mt-1 tracking-tight">
                调节界面玻璃深度、渲染引擎负载与动画物理效果
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 主体滚动区 (Spacious Inset Sections) */}
        <div className="px-8 py-7 overflow-y-auto space-y-8 flex-1 text-left">
          {/* 1. 界面视觉风格 (Visual Appearance) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                界面视觉风格
              </span>
              <span className="text-[12px] text-[#86868b]">即时生效</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {visualModes.map((mode) => {
                const isSelected = visualMode === mode.id;
                return (
                  <motion.button
                    type="button"
                    key={mode.id}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleModeSelect(mode)}
                    className={`p-5 rounded-[20px] text-left transition-all relative border flex flex-col justify-between min-h-[116px] ${
                      isSelected
                        ? "bg-[#0071e3]/15 border-[#0071e3] text-white shadow-[0_4px_20px_rgba(0,113,227,0.2)]"
                        : "bg-white/[0.04] border-white/[0.06] text-[#86868b] hover:bg-white/[0.06] hover:text-white hover:border-white/15"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-semibold tracking-tight text-white">
                          {mode.name}
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#0071e3] flex items-center justify-center">
                            <Check className="w-3 h-3 text-white stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-[#2997ff] mt-0.5 block">
                        {mode.subtitle}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#86868b] leading-relaxed mt-3">
                      {mode.description}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* 2. 渲染引擎性能档位 (Performance Presets) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider">
                渲染引擎性能档位
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-white/10 text-white/80 border border-white/10">
                WebGL 2.0 高精度加速
              </span>
            </div>

            {prefersReducedMotion && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-[13px] text-amber-200">
                已启用系统「减弱动态效果」，部分高负载 3D 效果将自动平滑降级
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {VISUAL_PERFORMANCE_PRESETS.map((preset) => {
                const isActive = activePreset === preset.id;
                const meta = performancePresetMeta[preset.id] || {
                  title: preset.name,
                  subtitle: "预设档位",
                  desc: preset.description,
                };
                return (
                  <motion.button
                    type="button"
                    key={preset.id}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePerformancePreset(preset.id)}
                    className={`p-5 rounded-[20px] text-left transition-all border flex flex-col justify-between min-h-[116px] ${
                      isActive
                        ? "bg-[#34c759]/15 border-[#34c759] text-white shadow-[0_4px_20px_rgba(52,199,89,0.2)]"
                        : "bg-white/[0.04] border-white/[0.06] text-[#86868b] hover:bg-white/[0.06] hover:text-white hover:border-white/15"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-white tracking-tight">
                          {meta.title}
                        </span>
                        {isActive && (
                          <div className="w-5 h-5 rounded-full bg-[#34c759] flex items-center justify-center">
                            <Check className="w-3 h-3 text-white stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-[#34c759] mt-0.5 block">
                        {meta.subtitle}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#86868b] leading-relaxed mt-3">{meta.desc}</p>
                  </motion.button>
                );
              })}
            </div>

            {/* 实时硬件指标看板 */}
            <div className="grid grid-cols-2 gap-3.5 pt-1">
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between">
                <div>
                  <div className="text-[12px] text-[#86868b]">目标渲染帧率</div>
                  <div className="text-[18px] font-mono font-bold text-[#2997ff] mt-0.5">
                    {config.targetFPS} FPS
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#0071e3]/10 flex items-center justify-center text-[#2997ff]">
                  <Gauge className="w-4 h-4" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between">
                <div>
                  <div className="text-[12px] text-[#86868b]">粒子计算预算</div>
                  <div className="text-[18px] font-mono font-bold text-[#34c759] mt-0.5">
                    {config.maxParticles.toLocaleString()}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#34c759]/10 flex items-center justify-center text-[#34c759]">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* 3. 参数微调 (Custom Tuning) */}
          <div className="space-y-3">
            <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-wider px-1">
              参数自定义微调
            </span>

            <div className="p-6 rounded-[22px] bg-white/[0.04] border border-white/[0.06] space-y-6">
              <AppleRangeControl
                label="界面磨砂景深"
                description="毛玻璃深度滤镜模糊半径"
                valueLabel={`${blurIntensity} px`}
                value={blurIntensity}
                min={0}
                max={50}
                onChange={(val) => setBlurIntensity(val)}
              />
              <AppleRangeControl
                label="环境阴影层次"
                description="界面浮层柔光阴影扩散度"
                valueLabel={`${shadowDepth} px`}
                value={shadowDepth}
                min={0}
                max={40}
                onChange={(val) => setShadowDepth(val)}
              />
              <AppleRangeControl
                label="动画阻尼速率"
                description="弹簧物理效果与过渡倍率"
                valueLabel={`${animationSpeed.toFixed(1)}x`}
                value={animationSpeed}
                min={0.5}
                max={2.0}
                step={0.1}
                onChange={(val) => setAnimationSpeed(val)}
              />
              <AppleRangeControl
                label="3D 空间视差焦距"
                description="唱片架与粒子流场透视距离"
                valueLabel={`${perspectiveIntensity} px`}
                value={perspectiveIntensity}
                min={400}
                max={1500}
                step={50}
                onChange={(val) => setPerspectiveIntensity(val)}
              />
            </div>
          </div>
        </div>

        {/* 底部操作栏 (Apple Standard Footer) */}
        <div className="px-8 py-5 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
          <button
            type="button"
            onClick={resetSettings}
            className="flex items-center gap-2 text-[14px] text-[#86868b] hover:text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            还原默认设置
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-7 py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[14px] font-semibold tracking-tight shadow-md transition-transform active:scale-[0.97]"
          >
            完成
          </button>
        </div>
      </motion.div>
    </div>
  );
};
