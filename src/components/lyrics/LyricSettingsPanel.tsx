/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useLyricSettingsStore,
  LyricAlignment,
  LyricFontFamily,
  LyricAnimationType,
  lyricPresets,
} from "@/store/lyricSettingsStore";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  EyeOff,
  Sparkles,
  Type,
  Sliders,
  RotateCcw,
  Palette,
  Film,
  BookOpen,
  Mic2,
  Check,
} from "lucide-react";
import { GlassPanel } from "@/components/shared/Glass/GlassPanel";
import { LYRIC_READABILITY_PRESETS, LyricReadabilityPreset } from "@/lib/lyrics/readabilityPresets";

interface LyricSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "presets" | "typography" | "motion" | "effects";

export const LyricSettingsPanel: React.FC<LyricSettingsPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("presets");
  const [activeReadablePreset, setActiveReadablePreset] = useState<string | null>(null);

  const {
    showTranslation,
    showTransliteration,
    fontSize,
    lineHeight,
    fontFamily,
    fontWeight,
    opacity,
    alignment,
    animationType,
    animationSpeed,
    animationIntensity,
    currentLineColor,
    inactiveLineColor,
    translationColor,
    textShadow,
    textShadowColor,
    textShadowBlur,
    textStroke,
    textStrokeColor,
    textStrokeWidth,
    setShowTranslation,
    setShowTransliteration,
    setFontSize,
    setLineHeight,
    setFontFamily,
    setFontWeight,
    setOpacity,
    setAlignment,
    setAnimationType,
    setAnimationSpeed,
    setAnimationIntensity,
    setCurrentLineColor,
    setInactiveLineColor,
    setTranslationColor,
    setTextShadow,
    setTextShadowColor,
    setTextShadowBlur,
    setTextStroke,
    setTextStrokeColor,
    setTextStrokeWidth,
    applyPreset,
    resetSettings,
  } = useLyricSettingsStore();

  const alignmentOptions = [
    { value: "left" as LyricAlignment, icon: AlignLeft, label: "左对齐" },
    { value: "center" as LyricAlignment, icon: AlignCenter, label: "居中" },
    { value: "right" as LyricAlignment, icon: AlignRight, label: "右对齐" },
  ];

  const fontOptions = [
    { value: "sans-serif" as LyricFontFamily, label: "无衬线", sub: "SF Pro" },
    { value: "serif" as LyricFontFamily, label: "衬线", sub: "New York" },
    { value: "cursive" as LyricFontFamily, label: "手写体", sub: "Script" },
  ];

  const readablePresetIcons: Record<string, any> = {
    cinema: Film,
    reading: BookOpen,
    karaoke: Mic2,
  };

  const readablePresetTitles: Record<string, { title: string; desc: string }> = {
    cinema: { title: "影院沉浸", desc: "大字焦点、暗场微光、沉浸式视效" },
    reading: { title: "纯享阅读", desc: "适宜行距与呼吸感排版、长久舒适" },
    karaoke: { title: "卡拉OK", desc: "焦点高亮发光、清晰双语对照" },
  };

  const applyReadablePreset = (preset: LyricReadabilityPreset) => {
    setActiveReadablePreset(preset.id);
    setFontSize(preset.fontSize);
    setLineHeight(preset.lineHeight);
    setFontWeight(preset.weight);
    setOpacity(1);
    setShowTranslation(preset.showTranslation);
    setShowTransliteration(false);
    setCurrentLineColor(preset.id === "karaoke" ? "#fff7ad" : "#ffffff");
    setInactiveLineColor(`rgba(255,255,255,${preset.contrast})`);
    setTranslationColor("rgba(255,255,255,0.82)");
    setTextShadow(preset.glow > 0);
    setTextShadowColor(
      preset.id === "karaoke" ? "rgba(255,210,90,0.35)" : "rgba(255,255,255,0.22)"
    );
    setTextShadowBlur(preset.glow);
  };

  const markCustom = () => setActiveReadablePreset("custom");

  // 快速推荐调色盘
  const quickColors = ["#FFFFFF", "#00F5FF", "#A855F7", "#FFD700", "#FF6B81", "#34C759"];

  return (
    <GlassPanel
      position="right"
      size="md"
      isOpen={isOpen}
      onClose={onClose}
      title="歌词设置"
      headerRight={
        <button
          type="button"
          onClick={resetSettings}
          title="重置为默认设置"
          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="p-5 space-y-5 text-white select-none">
        {/* 🌟 1. 顶部 Apple 风格实时动态歌词预览卡片 */}
        <div className="relative rounded-2xl bg-black/40 border border-white/15 p-4 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-white/40 tracking-wider uppercase">
              实时效果预览 (Live Preview)
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] text-cyan-400 font-mono">LIVE</span>
            </div>
          </div>

          <div
            className="space-y-1.5 py-2 transition-all duration-300"
            style={{ textAlign: alignment }}
          >
            {/* 前一行 (非焦点行) */}
            <p
              className="transition-all duration-200"
              style={{
                fontFamily,
                color: inactiveLineColor,
                fontSize: `${Math.max(12, Math.round(fontSize * 0.85))}px`,
                lineHeight,
              }}
            >
              前方的路 依然漫长而温柔
            </p>

            {/* 当前焦点行 */}
            <p
              className="font-bold transition-all duration-200"
              style={{
                fontFamily,
                fontWeight,
                color: currentLineColor,
                fontSize: `${fontSize}px`,
                lineHeight,
                textShadow: textShadow ? `0 0 ${textShadowBlur}px ${textShadowColor}` : "none",
                WebkitTextStroke: textStroke ? `${textStrokeWidth}px ${textStrokeColor}` : "none",
              }}
            >
              这一刻 时间仿佛静止了
            </p>

            {/* 翻译行 */}
            {showTranslation && (
              <p
                className="text-xs transition-all duration-200"
                style={{
                  color: translationColor,
                  fontFamily,
                }}
              >
                In this very moment, time stands still
              </p>
            )}

            {/* 后一行 (非焦点行) */}
            <p
              className="transition-all duration-200"
              style={{
                fontFamily,
                color: inactiveLineColor,
                fontSize: `${Math.max(12, Math.round(fontSize * 0.85))}px`,
                lineHeight,
              }}
            >
              星河璀璨 陪伴着每一个梦境
            </p>
          </div>
        </div>

        {/* 🎛️ 2. Apple 经典 Segmented Control 分段标签栏 */}
        <div className="grid grid-cols-4 p-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          {[
            { id: "presets", label: "预设", icon: Sparkles },
            { id: "typography", label: "排版", icon: Type },
            { id: "motion", label: "动效", icon: Sliders },
            { id: "effects", label: "特效", icon: Palette },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`relative flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold tracking-tight transition-all duration-200 ${
                  isActive ? "text-white shadow-sm" : "text-white/50 hover:text-white/80"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeLyricTabBadge"
                    className="absolute inset-0 bg-[#0071e3] rounded-xl"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 📋 3. 标签页内容区域 */}
        <div className="space-y-5">
          {/* TAB 1: 预设方案 */}
          {activeTab === "presets" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* 阅读情景预设 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    阅读情景方案
                  </h4>
                  {activeReadablePreset === "custom" && (
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-white/50">
                      自定义调整中
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {LYRIC_READABILITY_PRESETS.map((preset) => {
                    const Icon = readablePresetIcons[preset.id] || Sparkles;
                    const info = readablePresetTitles[preset.id] || {
                      title: preset.name,
                      desc: preset.description,
                    };
                    const isSelected = activeReadablePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyReadablePreset(preset)}
                        className={`flex items-start gap-3 p-3.5 rounded-2xl text-left border transition-all duration-200 ${
                          isSelected
                            ? "bg-[#0071e3]/20 border-[#0071e3] shadow-[0_0_20px_rgba(0,113,227,0.25)]"
                            : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        <div
                          className={`p-2 rounded-xl mt-0.5 ${
                            isSelected ? "bg-[#0071e3] text-white" : "bg-white/10 text-white/70"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">{info.title}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#0071e3]" />}
                          </div>
                          <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{info.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 视觉主题预设 */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  经典视觉风格
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {lyricPresets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-white/20 transition-transform group-hover:scale-110"
                          style={{
                            backgroundColor: preset.settings.currentLineColor || "#fff",
                            boxShadow: preset.settings.textShadow
                              ? `0 0 10px ${preset.settings.textShadowColor}`
                              : "none",
                          }}
                        />
                        <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {preset.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40 leading-snug line-clamp-2">
                        {preset.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: 字体排版 */}
          {activeTab === "typography" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* 字体大小 */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-white/80">字体大小</span>
                  <span className="font-mono text-[#0071e3] font-bold bg-[#0071e3]/10 px-2 py-0.5 rounded-md">
                    {fontSize} px
                  </span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="32"
                  value={fontSize}
                  onChange={(e) => {
                    markCustom();
                    setFontSize(parseFloat(e.target.value));
                  }}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
                />
              </div>

              {/* 行高 */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-white/80">行距比例</span>
                  <span className="font-mono text-[#0071e3] font-bold bg-[#0071e3]/10 px-2 py-0.5 rounded-md">
                    {lineHeight.toFixed(1)} x
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="2.4"
                  step="0.1"
                  value={lineHeight}
                  onChange={(e) => {
                    markCustom();
                    setLineHeight(parseFloat(e.target.value));
                  }}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
                />
              </div>

              {/* 字体粗细 */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-white/80">字体粗细 (Weight)</span>
                  <span className="font-mono text-[#0071e3] font-bold bg-[#0071e3]/10 px-2 py-0.5 rounded-md">
                    {fontWeight}
                  </span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="900"
                  step="100"
                  value={fontWeight}
                  onChange={(e) => {
                    markCustom();
                    setFontWeight(parseInt(e.target.value));
                  }}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
                />
              </div>

              {/* 字体家族 */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-white/60">字体家族</span>
                <div className="grid grid-cols-3 gap-2">
                  {fontOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFontFamily(option.value)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        fontFamily === option.value
                          ? "bg-[#0071e3]/20 border-[#0071e3] text-white"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className="text-xs font-bold">{option.label}</div>
                      <div className="text-[10px] opacity-40 mt-0.5">{option.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 对齐方式 */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-white/60">对齐方式</span>
                <div className="grid grid-cols-3 gap-2">
                  {alignmentOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = alignment === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setAlignment(option.value)}
                        className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-[#0071e3]/20 border-[#0071e3] text-white"
                            : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-medium">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: 双语与动效 */}
          {activeTab === "motion" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* 双语开关 */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  双语显示
                </h4>

                {/* 翻译开关 */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/10 text-white">
                      {showTranslation ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-white/40" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">显示歌词翻译</div>
                      <div className="text-[11px] text-white/40">呈现多语言译文对照</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTranslation(!showTranslation)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      showTranslation ? "bg-[#34c759]" : "bg-white/15"
                    }`}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white absolute top-0.5 shadow-md"
                      animate={{ left: showTranslation ? "26px" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* 音译开关 */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/10 text-white">
                      {showTransliteration ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-white/40" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">显示拼音 / 罗马音</div>
                      <div className="text-[11px] text-white/40">辅助发音与跟唱</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTransliteration(!showTransliteration)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      showTransliteration ? "bg-[#34c759]" : "bg-white/15"
                    }`}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white absolute top-0.5 shadow-md"
                      animate={{ left: showTransliteration ? "26px" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>

              {/* 动画模式 */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  过渡动画模式
                </h4>
                <div className="space-y-1.5">
                  {[
                    { value: "fade" as LyricAnimationType, label: "柔和淡入淡出", desc: "平缓自然的透明度渐变" },
                    { value: "scroll" as LyricAnimationType, label: "丝滑平滑滚动", desc: "弹性阻尼流畅滚动居中" },
                    { value: "rhythm" as LyricAnimationType, label: "节拍律动同步", desc: "跟随底鼓与瞬态击打呼吸" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAnimationType(option.value)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        animationType === option.value
                          ? "bg-[#0071e3]/20 border-[#0071e3] text-white"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{option.label}</div>
                        <div className="text-[10px] opacity-40">{option.desc}</div>
                      </div>
                      {animationType === option.value && (
                        <Check className="w-4 h-4 text-[#0071e3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 动画速度与强度 */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70">动画速率</span>
                    <span className="text-[#0071e3] font-mono font-bold">{animationSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={animationSpeed}
                    onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
                  />
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70">律动强度</span>
                    <span className="text-[#0071e3] font-mono font-bold">{Math.round(animationIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={animationIntensity}
                    onChange={(e) => setAnimationIntensity(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: 发光特效与配色 */}
          {activeTab === "effects" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* 配色设置 */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  歌词配色自定义
                </h4>
                {[
                  { label: "当前高亮行", value: currentLineColor, set: setCurrentLineColor },
                  { label: "非焦点背景行", value: inactiveLineColor, set: setInactiveLineColor },
                  { label: "双语译文行", value: translationColor, set: setTranslationColor },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full border border-white/30 shadow-md"
                        style={{ backgroundColor: item.value }}
                      />
                      <span className="text-xs font-bold text-white">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 快速调色盘 */}
                      <div className="flex items-center gap-1">
                        {quickColors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => item.set(color)}
                            className="w-4 h-4 rounded-full border border-white/20 hover:scale-125 transition-transform"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <input
                        type="color"
                        value={item.value.startsWith("#") ? item.value : "#FFFFFF"}
                        onChange={(e) => item.set(e.target.value)}
                        className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 文字发光 (Bloom) */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">文字霓虹发光 (Bloom Glow)</div>
                    <div className="text-[11px] text-white/40">为高亮焦点行注入荧光微晕</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTextShadow(!textShadow)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      textShadow ? "bg-[#0071e3]" : "bg-white/15"
                    }`}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white absolute top-0.5 shadow-md"
                      animate={{ left: textShadow ? "26px" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {textShadow && (
                  <div className="pt-2 border-t border-white/10 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/70">光晕扩散半径</span>
                      <span className="font-mono text-[#0071e3] font-bold">{textShadowBlur} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={textShadowBlur}
                      onChange={(e) => setTextShadowBlur(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
                    />
                  </div>
                )}
              </div>

              {/* 文字描边 */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">立体描边 (Text Stroke)</div>
                    <div className="text-[11px] text-white/40">增强复杂背景下的辨识度</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTextStroke(!textStroke)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      textStroke ? "bg-[#0071e3]" : "bg-white/15"
                    }`}
                  >
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white absolute top-0.5 shadow-md"
                      animate={{ left: textStroke ? "26px" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {textStroke && (
                  <div className="pt-2 border-t border-white/10 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/70">描边粗细</span>
                      <span className="font-mono text-[#0071e3] font-bold">{textStrokeWidth} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.5"
                      value={textStrokeWidth}
                      onChange={(e) => setTextStrokeWidth(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#0071e3]"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* 底部 Apple 胶囊完成按钮 */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white font-bold text-xs shadow-[0_4px_20px_rgba(0,113,227,0.4)] transition-transform active:scale-98"
          >
            完成并保存设置
          </button>
        </div>
      </div>
    </GlassPanel>
  );
};
