"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useLyricSettingsStore,
  LyricAlignment,
  LyricFontFamily,
  LyricAnimationType,
} from "@/store/lyricSettingsStore";
import {
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  EyeOff,
  Settings2,
  Moon,
  Move,
  Music,
  Palette,
  ArrowUp,
  ArrowDown,
  Maximize2,
} from "lucide-react";

interface LyricSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LyricSettingsPanel: React.FC<LyricSettingsPanelProps> = ({ isOpen, onClose }) => {
  const {
    showTranslation,
    showTransliteration,
    fontSize,
    lineHeight,
    fontFamily,
    opacity,
    alignment,
    animationType,
    animationSpeed,
    animationIntensity,
    visualizerConfig,
    setShowTranslation,
    setShowTransliteration,
    setFontSize,
    setLineHeight,
    setFontFamily,
    setOpacity,
    setAlignment,
    setAnimationType,
    setAnimationSpeed,
    setAnimationIntensity,
    setVisualizerConfig,
    resetSettings,
  } = useLyricSettingsStore();

  const alignmentOptions = [
    { value: "left" as LyricAlignment, icon: AlignLeft, label: "左对齐" },
    { value: "center" as LyricAlignment, icon: AlignCenter, label: "居中" },
    { value: "right" as LyricAlignment, icon: AlignRight, label: "右对齐" },
  ];

  const fontOptions = [
    { value: "sans-serif" as LyricFontFamily, label: "无衬线" },
    { value: "serif" as LyricFontFamily, label: "衬线" },
    { value: "cursive" as LyricFontFamily, label: "手写" },
  ];

  const animationOptions = [
    { value: "fade" as LyricAnimationType, icon: Moon, label: "淡入淡出", desc: "柔和过渡效果" },
    { value: "scroll" as LyricAnimationType, icon: Move, label: "平滑滚动", desc: "流畅滚动切换" },
    {
      value: "rhythm" as LyricAnimationType,
      icon: Settings2,
      label: "节奏动态",
      desc: "跟随音乐节拍",
    },
  ];

  const positionOptions = [
    { value: "top", icon: ArrowUp, label: "顶部" },
    { value: "center", icon: Maximize2, label: "居中" },
    { value: "bottom", icon: ArrowDown, label: "底部" },
  ];

  const colorSchemeOptions = [
    { value: "gradient", label: "渐变" },
    { value: "mono", label: "单色" },
    { value: "spectrum", label: "光谱" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-white/10 backdrop-blur-2xl border-r border-white/20 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-white text-xl font-semibold">歌词设置</h2>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Settings Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar min-h-0">
              {/* 双语显示 */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">双语显示</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div className="flex items-center gap-3">
                      {showTranslation ? (
                        <Eye className="w-5 h-5 text-white/60" />
                      ) : (
                        <EyeOff className="w-5 h-5 text-white/60" />
                      )}
                      <span className="text-white/80">显示翻译</span>
                    </div>
                    <button
                      onClick={() => setShowTranslation(!showTranslation)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        showTranslation ? "bg-white/30" : "bg-white/10"
                      }`}
                    >
                      <motion.div
                        className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                        animate={{ left: showTranslation ? "26px" : "2px" }}
                        transition={{ duration: 0.2 }}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* 字体设置 */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">字体设置</h3>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-white/80">
                    <span>字体大小</span>
                    <span>{fontSize}px</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="12"
                      max="24"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((fontSize - 12) / 12) * 100}%, rgba(255,255,255,0.1) ${((fontSize - 12) / 12) * 100}%)`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-white/80">
                    <span>行高</span>
                    <span>{lineHeight.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1.0"
                      max="2.0"
                      step="0.1"
                      value={lineHeight}
                      onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((lineHeight - 1.0) / 1.0) * 100}%, rgba(255,255,255,0.1) ${((lineHeight - 1.0) / 1.0) * 100}%)`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-white/60 text-sm">字体</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {fontOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setFontFamily(option.value)}
                        className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                          fontFamily === option.value
                            ? "bg-white/20 text-white"
                            : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                        style={{ fontFamily: option.value }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 动画设置 */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">动画设置</h3>

                <div className="space-y-2">
                  {animationOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAnimationType(option.value)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                        animationType === option.value
                          ? "bg-white/20 text-white"
                          : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <option.icon className="w-5 h-5" />
                      <div className="text-left">
                        <div className="text-sm font-medium">{option.label}</div>
                        <div className="text-xs text-white/40">{option.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-white/80">
                    <span>动画速度</span>
                    <span>{animationSpeed.toFixed(1)}x</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={animationSpeed}
                      onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((animationSpeed - 0.5) / 1.5) * 100}%, rgba(255,255,255,0.1) ${((animationSpeed - 0.5) / 1.5) * 100}%)`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-white/80">
                    <span>动画强度</span>
                    <span>{Math.round(animationIntensity * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.1"
                      value={animationIntensity}
                      onChange={(e) => setAnimationIntensity(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((animationIntensity - 0.5) / 1.0) * 100}%, rgba(255,255,255,0.1) ${((animationIntensity - 0.5) / 1.0) * 100}%)`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 显示设置 */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">显示设置</h3>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-white/80">
                    <span>透明度</span>
                    <span>{Math.round(opacity * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0.5"
                      max="1.0"
                      step="0.01"
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((opacity - 0.5) / 0.5) * 100}%, rgba(255,255,255,0.1) ${((opacity - 0.5) / 0.5) * 100}%)`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-white/60 text-sm">对齐方式</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {alignmentOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setAlignment(option.value)}
                        className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                          alignment === option.value
                            ? "bg-white/20 text-white"
                            : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <option.icon className="w-5 h-5 mx-auto" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 可视化设置 */}
              <div className="space-y-4">
                <h3 className="text-white font-medium flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  可视化设置
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <div className="flex items-center gap-3">
                      <Eye className="w-5 h-5 text-white/60" />
                      <span className="text-white/80">启用可视化</span>
                    </div>
                    <button
                      onClick={() => setVisualizerConfig({ enabled: !visualizerConfig.enabled })}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        visualizerConfig.enabled ? "bg-white/30" : "bg-white/10"
                      }`}
                    >
                      <motion.div
                        className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                        animate={{ left: visualizerConfig.enabled ? "26px" : "2px" }}
                        transition={{ duration: 0.2 }}
                      />
                    </button>
                  </div>
                </div>

                {visualizerConfig.enabled && (
                  <>
                    <div className="space-y-2">
                      <h4 className="text-white/60 text-sm">显示位置</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {positionOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setVisualizerConfig({ position: option.value as any })}
                            className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                              visualizerConfig.position === option.value
                                ? "bg-white/20 text-white"
                                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <option.icon className="w-4 h-4 mx-auto mb-1" />
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-white/80">
                        <span>大小</span>
                        <span>{visualizerConfig.size}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="30"
                          max="100"
                          value={visualizerConfig.size}
                          onChange={(e) =>
                            setVisualizerConfig({ size: parseFloat(e.target.value) })
                          }
                          className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((visualizerConfig.size - 30) / 70) * 100}%, rgba(255,255,255,0.1) ${((visualizerConfig.size - 30) / 70) * 100}%)`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-white/80">
                        <span>透明度</span>
                        <span>{Math.round(visualizerConfig.opacity * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.1"
                          value={visualizerConfig.opacity}
                          onChange={(e) =>
                            setVisualizerConfig({ opacity: parseFloat(e.target.value) })
                          }
                          className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((visualizerConfig.opacity - 0.1) / 0.9) * 100}%, rgba(255,255,255,0.1) ${((visualizerConfig.opacity - 0.1) / 0.9) * 100}%)`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-white/60 text-sm flex items-center gap-2">
                        <Palette className="w-4 h-4" />
                        配色方案
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {colorSchemeOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() =>
                              setVisualizerConfig({ colorScheme: option.value as any })
                            }
                            className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                              visualizerConfig.colorScheme === option.value
                                ? "bg-white/20 text-white"
                                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-white/80">
                        <span>柱形数量</span>
                        <span>{visualizerConfig.barCount}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="16"
                          max="128"
                          step="8"
                          value={visualizerConfig.barCount}
                          onChange={(e) =>
                            setVisualizerConfig({ barCount: parseInt(e.target.value) })
                          }
                          className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((visualizerConfig.barCount - 16) / 112) * 100}%, rgba(255,255,255,0.1) ${((visualizerConfig.barCount - 16) / 112) * 100}%)`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-white/80">
                        <span>柱形高度</span>
                        <span>{visualizerConfig.barHeight}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="30"
                          max="150"
                          value={visualizerConfig.barHeight}
                          onChange={(e) =>
                            setVisualizerConfig({ barHeight: parseInt(e.target.value) })
                          }
                          className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((visualizerConfig.barHeight - 30) / 120) * 100}%, rgba(255,255,255,0.1) ${((visualizerConfig.barHeight - 30) / 120) * 100}%)`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-white/80">
                        <span>平滑度</span>
                        <span>{Math.round(visualizerConfig.smoothing * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="0.95"
                          step="0.05"
                          value={visualizerConfig.smoothing}
                          onChange={(e) =>
                            setVisualizerConfig({ smoothing: parseFloat(e.target.value) })
                          }
                          className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, rgba(255,255,255,0.6) ${(visualizerConfig.smoothing / 0.95) * 100}%, rgba(255,255,255,0.1) ${(visualizerConfig.smoothing / 0.95) * 100}%)`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 重置按钮 */}
              <button
                onClick={resetSettings}
                className="w-full py-2 px-4 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium"
              >
                重置所有设置
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
