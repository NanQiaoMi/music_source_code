import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LyricAlignment = "left" | "center" | "right";
export type LyricFontFamily = "sans-serif" | "serif" | "cursive";
export type LyricAnimationType = "fade" | "scroll" | "rhythm";

export interface LyricPreset {
  name: string;
  description: string;
  settings: Partial<LyricSettings>;
}

export interface LyricSettings {
  // 双语显示设置
  showTranslation: boolean;
  showTransliteration: boolean;

  // 字体设置
  fontSize: number;
  lineHeight: number;
  fontFamily: LyricFontFamily;
  fontWeight: number;

  // 显示设置
  opacity: number;
  alignment: LyricAlignment;

  // 动画设置
  animationType: LyricAnimationType;
  animationSpeed: number;
  animationIntensity: number;

  // 颜色设置
  currentLineColor: string;
  inactiveLineColor: string;
  translationColor: string;

  // 文字效果
  textShadow: boolean;
  textShadowColor: string;
  textShadowBlur: number;
  textStroke: boolean;
  textStrokeColor: string;
  textStrokeWidth: number;

  // 方法
  setShowTranslation: (show: boolean) => void;
  setShowTransliteration: (show: boolean) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setFontFamily: (family: LyricFontFamily) => void;
  setFontWeight: (weight: number) => void;
  setOpacity: (opacity: number) => void;
  setAlignment: (alignment: LyricAlignment) => void;
  setAnimationType: (type: LyricAnimationType) => void;
  setAnimationSpeed: (speed: number) => void;
  setAnimationIntensity: (intensity: number) => void;
  setCurrentLineColor: (color: string) => void;
  setInactiveLineColor: (color: string) => void;
  setTranslationColor: (color: string) => void;
  setTextShadow: (enabled: boolean) => void;
  setTextShadowColor: (color: string) => void;
  setTextShadowBlur: (blur: number) => void;
  setTextStroke: (enabled: boolean) => void;
  setTextStrokeColor: (color: string) => void;
  setTextStrokeWidth: (width: number) => void;
  applyPreset: (preset: LyricPreset) => void;

  resetSettings: () => void;
}

const defaultSettings = {
  showTranslation: false,
  showTransliteration: false,
  fontSize: 16,
  lineHeight: 1.5,
  fontFamily: "sans-serif" as LyricFontFamily,
  fontWeight: 700,
  opacity: 1.0,
  alignment: "center" as LyricAlignment,
  animationType: "fade" as LyricAnimationType,
  animationSpeed: 1.0,
  animationIntensity: 1.0,
  currentLineColor: "#ffffff",
  inactiveLineColor: "rgba(255,255,255,0.7)",
  translationColor: "rgba(255,255,255,0.9)",
  textShadow: true,
  textShadowColor: "rgba(0,0,0,0.3)",
  textShadowBlur: 20,
  textStroke: false,
  textStrokeColor: "rgba(0,0,0,0.5)",
  textStrokeWidth: 1,
};

export const lyricPresets: LyricPreset[] = [
  {
    name: "默认",
    description: "经典白色歌词样式",
    settings: {
      currentLineColor: "#ffffff",
      inactiveLineColor: "rgba(255,255,255,0.7)",
      translationColor: "rgba(255,255,255,0.9)",
      textShadow: true,
      textShadowColor: "rgba(0,0,0,0.3)",
      textShadowBlur: 20,
      textStroke: false,
      fontWeight: 700,
    },
  },
  {
    name: "霓虹",
    description: "炫彩霓虹灯光效果",
    settings: {
      currentLineColor: "#00ff88",
      inactiveLineColor: "rgba(0,255,136,0.4)",
      translationColor: "rgba(0,200,255,0.9)",
      textShadow: true,
      textShadowColor: "rgba(0,255,136,0.6)",
      textShadowBlur: 30,
      textStroke: false,
      fontWeight: 800,
    },
  },
  {
    name: "复古",
    description: "怀旧胶片风格",
    settings: {
      currentLineColor: "#ffd700",
      inactiveLineColor: "rgba(255,215,0,0.5)",
      translationColor: "rgba(255,165,0,0.9)",
      textShadow: true,
      textShadowColor: "rgba(255,165,0,0.4)",
      textShadowBlur: 15,
      textStroke: true,
      textStrokeColor: "rgba(139,69,19,0.6)",
      textStrokeWidth: 1.5,
      fontWeight: 900,
    },
  },
  {
    name: "极简",
    description: "简洁无装饰风格",
    settings: {
      currentLineColor: "#ffffff",
      inactiveLineColor: "rgba(255,255,255,0.5)",
      translationColor: "rgba(255,255,255,0.8)",
      textShadow: false,
      textStroke: false,
      fontWeight: 400,
    },
  },
  {
    name: "梦幻",
    description: "柔和梦幻效果",
    settings: {
      currentLineColor: "#e0b0ff",
      inactiveLineColor: "rgba(224,176,255,0.4)",
      translationColor: "rgba(173,216,230,0.9)",
      textShadow: true,
      textShadowColor: "rgba(147,112,219,0.5)",
      textShadowBlur: 25,
      textStroke: false,
      fontWeight: 600,
    },
  },
];

export const useLyricSettingsStore = create<LyricSettings>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      setShowTranslation: (show) => set({ showTranslation: show }),
      setShowTransliteration: (show) => set({ showTransliteration: show }),
      setFontSize: (size) => set({ fontSize: Math.max(12, Math.min(24, size)) }),
      setLineHeight: (height) => set({ lineHeight: Math.max(1.0, Math.min(2.0, height)) }),
      setFontFamily: (family) => set({ fontFamily: family }),
      setFontWeight: (weight) => set({ fontWeight: Math.max(300, Math.min(900, weight)) }),
      setOpacity: (opacity) => set({ opacity: Math.max(0.5, Math.min(1.0, opacity)) }),
      setAlignment: (alignment) => set({ alignment }),
      setAnimationType: (type) => set({ animationType: type }),
      setAnimationSpeed: (speed) => set({ animationSpeed: Math.max(0.5, Math.min(2.0, speed)) }),
      setAnimationIntensity: (intensity) =>
        set({ animationIntensity: Math.max(0.5, Math.min(1.5, intensity)) }),
      setCurrentLineColor: (color) => set({ currentLineColor: color }),
      setInactiveLineColor: (color) => set({ inactiveLineColor: color }),
      setTranslationColor: (color) => set({ translationColor: color }),
      setTextShadow: (enabled) => set({ textShadow: enabled }),
      setTextShadowColor: (color) => set({ textShadowColor: color }),
      setTextShadowBlur: (blur) => set({ textShadowBlur: Math.max(0, Math.min(50, blur)) }),
      setTextStroke: (enabled) => set({ textStroke: enabled }),
      setTextStrokeColor: (color) => set({ textStrokeColor: color }),
      setTextStrokeWidth: (width) => set({ textStrokeWidth: Math.max(0, Math.min(5, width)) }),
      applyPreset: (preset) => set({ ...defaultSettings, ...preset.settings }),

      resetSettings: () => set(defaultSettings),
    }),
    {
      name: "lyric-settings-storage",
    }
  )
);
