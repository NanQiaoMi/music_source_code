import { create } from "zustand";
import { persist } from "zustand/middleware";
import { VisualizerConfig, defaultVisualizerConfig } from "@/components/AppleMusicVisualizer";

export type LyricAlignment = "left" | "center" | "right";
export type LyricFontFamily = "sans-serif" | "serif" | "cursive";
export type LyricAnimationType = "fade" | "scroll" | "rhythm";

export interface LyricSettings {
  // 双语显示设置
  showTranslation: boolean;
  showTransliteration: boolean;

  // 字体设置
  fontSize: number;
  lineHeight: number;
  fontFamily: LyricFontFamily;

  // 显示设置
  opacity: number;
  alignment: LyricAlignment;

  // 动画设置
  animationType: LyricAnimationType;
  animationSpeed: number;
  animationIntensity: number;

  // 可视化设置
  visualizerConfig: VisualizerConfig;

  // 方法
  setShowTranslation: (show: boolean) => void;
  setShowTransliteration: (show: boolean) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setFontFamily: (family: LyricFontFamily) => void;
  setOpacity: (opacity: number) => void;
  setAlignment: (alignment: LyricAlignment) => void;
  setAnimationType: (type: LyricAnimationType) => void;
  setAnimationSpeed: (speed: number) => void;
  setAnimationIntensity: (intensity: number) => void;
  setVisualizerConfig: (config: Partial<VisualizerConfig>) => void;

  resetSettings: () => void;
}

const defaultSettings = {
  showTranslation: false,
  showTransliteration: false,
  fontSize: 16,
  lineHeight: 1.5,
  fontFamily: "sans-serif" as LyricFontFamily,
  opacity: 1.0,
  alignment: "center" as LyricAlignment,
  animationType: "fade" as LyricAnimationType,
  animationSpeed: 1.0,
  animationIntensity: 1.0,
  visualizerConfig: defaultVisualizerConfig,
};

export const useLyricSettingsStore = create<LyricSettings>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      setShowTranslation: (show) => set({ showTranslation: show }),
      setShowTransliteration: (show) => set({ showTransliteration: show }),
      setFontSize: (size) => set({ fontSize: Math.max(12, Math.min(24, size)) }),
      setLineHeight: (height) => set({ lineHeight: Math.max(1.0, Math.min(2.0, height)) }),
      setFontFamily: (family) => set({ fontFamily: family }),
      setOpacity: (opacity) => set({ opacity: Math.max(0.5, Math.min(1.0, opacity)) }),
      setAlignment: (alignment) => set({ alignment }),
      setAnimationType: (type) => set({ animationType: type }),
      setAnimationSpeed: (speed) => set({ animationSpeed: Math.max(0.5, Math.min(2.0, speed)) }),
      setAnimationIntensity: (intensity) =>
        set({ animationIntensity: Math.max(0.5, Math.min(1.5, intensity)) }),
      setVisualizerConfig: (config) =>
        set((state) => ({
          visualizerConfig: { ...state.visualizerConfig, ...config },
        })),

      resetSettings: () => set(defaultSettings),
    }),
    {
      name: "lyric-settings-storage",
    }
  )
);
