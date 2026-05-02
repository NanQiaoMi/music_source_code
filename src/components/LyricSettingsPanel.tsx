"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  useLyricSettingsStore,
  LyricAlignment,
  LyricFontFamily,
  LyricAnimationType,
  lyricPresets,
} from "@/store/lyricSettingsStore";
import {
  AlignLeft, AlignCenter, AlignRight, Eye, EyeOff, Settings2, Moon, Move,
} from "lucide-react";
import { GlassPanel } from "@/components/shared/Glass";

interface LyricSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LyricSettingsPanel: React.FC<LyricSettingsPanelProps> = ({ isOpen, onClose }) => {
  const {
    showTranslation, showTransliteration, fontSize, lineHeight, fontFamily, fontWeight,
    opacity, alignment, animationType, animationSpeed, animationIntensity,
    currentLineColor, inactiveLineColor, translationColor,
    textShadow, textShadowColor, textShadowBlur, textStroke, textStrokeColor, textStrokeWidth,
    setShowTranslation, setShowTransliteration, setFontSize, setLineHeight, setFontFamily,
    setFontWeight, setOpacity, setAlignment, setAnimationType, setAnimationSpeed,
    setAnimationIntensity, setCurrentLineColor, setInactiveLineColor, setTranslationColor,
    setTextShadow, setTextShadowColor, setTextShadowBlur, setTextStroke, setTextStrokeColor,
    setTextStrokeWidth, applyPreset, resetSettings,
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
    { value: "rhythm" as LyricAnimationType, icon: Settings2, label: "节奏动态", desc: "跟随音乐节拍" },
  ];

  return (
    <GlassPanel position="left" size="sm" isOpen={isOpen} onClose={onClose} title="歌词设置">
      <div className="p-5 space-y-7">
        {/* 预设主题 */}
        <div className="space-y-4">
          <h3 className="text-white font-medium">预设主题</h3>
          <div className="grid grid-cols-2 gap-2">
            {lyricPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: preset.settings.currentLineColor || "#fff",
                      boxShadow: preset.settings.textShadow ? `0 0 8px ${preset.settings.textShadowColor}` : "none",
                    }}
                  />
                  <span className="text-white text-sm font-medium">{preset.name}</span>
                </div>
                <p className="text-white/50 text-xs">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 双语显示 */}
        <div className="space-y-4">
          <h3 className="text-white font-medium">双语显示</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                {showTranslation ? <Eye className="w-5 h-5 text-white/60" /> : <EyeOff className="w-5 h-5 text-white/60" />}
                <span className="text-white/80">显示翻译</span>
              </div>
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className={`w-12 h-6 rounded-full transition-colors relative ${showTranslation ? "bg-white/30" : "bg-white/10"}`}
              >
                <motion.div
                  className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                  animate={{ left: showTranslation ? "26px" : "2px" }}
                  transition={{ duration: 0.2 }}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                {showTransliteration ? <Eye className="w-5 h-5 text-white/60" /> : <EyeOff className="w-5 h-5 text-white/60" />}
                <span className="text-white/80">显示音译</span>
              </div>
              <button
                onClick={() => setShowTransliteration(!showTransliteration)}
                className={`w-12 h-6 rounded-full transition-colors relative ${showTransliteration ? "bg-white/30" : "bg-white/10"}`}
              >
                <motion.div
                  className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                  animate={{ left: showTransliteration ? "26px" : "2px" }}
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
            <input
              type="range" min="12" max="24"
              value={fontSize}
              onChange={(e) => setFontSize(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((fontSize - 12) / 12) * 100}%, rgba(255,255,255,0.1) ${((fontSize - 12) / 12) * 100}%)` }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-white/80">
              <span>行高</span>
              <span>{lineHeight.toFixed(1)}</span>
            </div>
            <input
              type="range" min="1.0" max="2.0" step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((lineHeight - 1.0) / 1.0) * 100}%, rgba(255,255,255,0.1) ${((lineHeight - 1.0) / 1.0) * 100}%)` }}
            />
          </div>
          <div className="space-y-2">
            <h4 className="text-white/60 text-sm">字体</h4>
            <div className="grid grid-cols-3 gap-2">
              {fontOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFontFamily(option.value)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    fontFamily === option.value ? "bg-white/20 text-white" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                  style={{ fontFamily: option.value }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-white/80">
              <span>字体粗细</span>
              <span>{fontWeight}</span>
            </div>
            <input
              type="range" min="300" max="900" step="100"
              value={fontWeight}
              onChange={(e) => setFontWeight(parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((fontWeight - 300) / 600) * 100}%, rgba(255,255,255,0.1) ${((fontWeight - 300) / 600) * 100}%)` }}
            />
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
                  animationType === option.value ? "bg-white/20 text-white" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
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
            <input
              type="range" min="0.5" max="2.0" step="0.1"
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((animationSpeed - 0.5) / 1.5) * 100}%, rgba(255,255,255,0.1) ${((animationSpeed - 0.5) / 1.5) * 100}%)` }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-white/80">
              <span>动画强度</span>
              <span>{Math.round(animationIntensity * 100)}%</span>
            </div>
            <input
              type="range" min="0.5" max="1.5" step="0.1"
              value={animationIntensity}
              onChange={(e) => setAnimationIntensity(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((animationIntensity - 0.5) / 1.0) * 100}%, rgba(255,255,255,0.1) ${((animationIntensity - 0.5) / 1.0) * 100}%)` }}
            />
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
            <input
              type="range" min="0.5" max="1.0" step="0.01"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, rgba(255,255,255,0.6) ${((opacity - 0.5) / 0.5) * 100}%, rgba(255,255,255,0.1) ${((opacity - 0.5) / 0.5) * 100}%)` }}
            />
          </div>
          <div className="space-y-2">
            <h4 className="text-white/60 text-sm">对齐方式</h4>
            <div className="grid grid-cols-3 gap-2">
              {alignmentOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setAlignment(option.value)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    alignment === option.value ? "bg-white/20 text-white" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <option.icon className="w-5 h-5 mx-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 颜色设置 */}
        <div className="space-y-4">
          <h3 className="text-white font-medium">颜色设置</h3>
          {[
            { label: "当前行颜色", value: currentLineColor, set: setCurrentLineColor },
            { label: "非当前行颜色", value: inactiveLineColor, set: setInactiveLineColor },
            { label: "翻译颜色", value: translationColor, set: setTranslationColor },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: item.value }} />
                <span className="text-white/80">{item.label}</span>
              </div>
              <input
                type="color"
                value={item.value}
                onChange={(e) => item.set(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
              />
            </div>
          ))}
        </div>

        {/* 文字效果 */}
        <div className="space-y-4">
          <h3 className="text-white font-medium">文字效果</h3>
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <span className="text-white/80">文字阴影</span>
            <button
              onClick={() => setTextShadow(!textShadow)}
              className={`w-12 h-6 rounded-full transition-colors relative ${textShadow ? "bg-white/30" : "bg-white/10"}`}
            >
              <motion.div
                className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                animate={{ left: textShadow ? "26px" : "2px" }}
                transition={{ duration: 0.2 }}
              />
            </button>
          </div>
          {textShadow && (
            <>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: textShadowColor }} />
                  <span className="text-white/80">阴影颜色</span>
                </div>
                <input type="color" value={textShadowColor} onChange={(e) => setTextShadowColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-white/80">
                  <span>阴影模糊</span>
                  <span>{textShadowBlur}px</span>
                </div>
                <input
                  type="range" min="0" max="50"
                  value={textShadowBlur}
                  onChange={(e) => setTextShadowBlur(parseInt(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, rgba(255,255,255,0.6) ${(textShadowBlur / 50) * 100}%, rgba(255,255,255,0.1) ${(textShadowBlur / 50) * 100}%)` }}
                />
              </div>
            </>
          )}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <span className="text-white/80">文字描边</span>
            <button
              onClick={() => setTextStroke(!textStroke)}
              className={`w-12 h-6 rounded-full transition-colors relative ${textStroke ? "bg-white/30" : "bg-white/10"}`}
            >
              <motion.div
                className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                animate={{ left: textStroke ? "26px" : "2px" }}
                transition={{ duration: 0.2 }}
              />
            </button>
          </div>
          {textStroke && (
            <>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: textStrokeColor }} />
                  <span className="text-white/80">描边颜色</span>
                </div>
                <input type="color" value={textStrokeColor} onChange={(e) => setTextStrokeColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-white/80">
                  <span>描边宽度</span>
                  <span>{textStrokeWidth}px</span>
                </div>
                <input
                  type="range" min="0" max="5" step="0.5"
                  value={textStrokeWidth}
                  onChange={(e) => setTextStrokeWidth(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, rgba(255,255,255,0.6) ${(textStrokeWidth / 5) * 100}%, rgba(255,255,255,0.1) ${(textStrokeWidth / 5) * 100}%)` }}
                />
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
    </GlassPanel>
  );
};
