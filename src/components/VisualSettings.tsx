"use client";

import React from "react";
import { motion } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import {
  useVisualSettingsStore,
  defaultVisualSettings,
  VisualSettings,
} from "@/store/visualSettingsStore";

interface VisualSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
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
    setVisualSettings,
    resetSettings,
  } = useVisualSettingsStore();

  const visualModes = [
    {
      id: "light" as const,
      name: "轻盈模式",
      icon: "🪶",
      description: "轻度毛玻璃效果，快速动画",
      blur: 10,
      shadow: 10,
      speed: 1.2,
      perspective: 1000,
    },
    {
      id: "heavy" as const,
      name: "厚重玻璃模式",
      icon: "🪟",
      description: "重度毛玻璃效果，深度阴影",
      blur: 30,
      shadow: 25,
      speed: 0.8,
      perspective: 600,
    },
    {
      id: "minimal" as const,
      name: "极简模式",
      icon: "⬜",
      description: "最小化装饰，纯色背景",
      blur: 0,
      shadow: 0,
      speed: 1.5,
      perspective: 1200,
    },
  ];

  const handleModeSelect = (mode: (typeof visualModes)[0]) => {
    setVisualMode(mode.id);
    setBlurIntensity(mode.blur);
    setShadowDepth(mode.shadow);
    setAnimationSpeed(mode.speed);
    setPerspectiveIntensity(mode.perspective);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-white text-2xl font-semibold">视觉效果设置</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b border-white/10">
          <h3 className="text-white font-medium mb-4">预设风格</h3>
          <div className="grid grid-cols-3 gap-3">
            {visualModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleModeSelect(mode)}
                className={`p-4 rounded-2xl transition-all flex flex-col items-center gap-2 ${
                  visualMode === mode.id
                    ? "bg-white/20 text-white ring-2 ring-white/30"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="text-3xl">{mode.icon}</span>
                <span className="text-sm font-medium">{mode.name}</span>
                <span className="text-xs text-white/50 text-center">{mode.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-6">
          <h3 className="text-white font-medium mb-4">自定义调节</h3>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/80">毛玻璃模糊强度</span>
              <span className="text-white/60">{blurIntensity}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={blurIntensity}
              onChange={(e) => setBlurIntensity(parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgba(139, 92, 246, ${
                  blurIntensity / 50
                }) ${(blurIntensity / 50) * 100}%, rgba(255, 255, 255, 0.1) ${
                  (blurIntensity / 50) * 100
                }%)`,
              }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/80">卡片阴影深度</span>
              <span className="text-white/60">{shadowDepth}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={shadowDepth}
              onChange={(e) => setShadowDepth(parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgba(139, 92, 246, ${
                  shadowDepth / 40
                }) ${(shadowDepth / 40) * 100}%, rgba(255, 255, 255, 0.1) ${
                  (shadowDepth / 40) * 100
                }%)`,
              }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/80">背景动效速度</span>
              <span className="text-white/60">{animationSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgba(139, 92, 246, ${
                  (animationSpeed - 0.5) / 1.5
                }) ${((animationSpeed - 0.5) / 1.5) * 100}%, rgba(255, 255, 255, 0.1) ${
                  ((animationSpeed - 0.5) / 1.5) * 100
                }%)`,
              }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/80">3D 透视强度</span>
              <span className="text-white/60">{perspectiveIntensity}px</span>
            </div>
            <input
              type="range"
              min="400"
              max="1500"
              value={perspectiveIntensity}
              onChange={(e) => setPerspectiveIntensity(parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgba(139, 92, 246, ${
                  (perspectiveIntensity - 400) / 1100
                }) ${((perspectiveIntensity - 400) / 1100) * 100}%, rgba(255, 255, 255, 0.1) ${
                  ((perspectiveIntensity - 400) / 1100) * 100
                }%)`,
              }}
            />
          </div>
        </div>

        <div className="p-6 flex gap-3 border-t border-white/10">
          <button
            onClick={resetSettings}
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors font-medium"
          >
            恢复默认
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 transition-opacity font-medium"
          >
            完成
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
