/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BeatMapData } from "@/services/BeatMapAnalyzer";

export type AudioSourceType = "netease" | "qq" | "kugou" | "kuwo" | "qishui" | "local" | "lx_custom" | "cross_matched";
export type PreferredQuality = "hires" | "lossless" | "high" | "standard";

export interface AudioSourceSettingsState {
  // 全局音源优先级队列
  sourcePriority: AudioSourceType[];
  // 0ms VIP 试听静默降级开关
  autoTrialFallback: boolean;
  // 偏好音质等级
  preferredQuality: PreferredQuality;

  // 汽水音乐 SpadeKey 实时解密设置
  enableSpadeDecryption: boolean;
  decryptionThroughputMBs: number;

  // Biquad DSP 节拍分析设置
  enableBeatAnalysis: boolean;
  beatSensitivity: number; // 0.5 ~ 2.0
  currentBeatMap: BeatMapData | null;

  // Actions
  setSourcePriority: (priority: AudioSourceType[]) => void;
  setAutoTrialFallback: (enabled: boolean) => void;
  setPreferredQuality: (quality: PreferredQuality) => void;
  setEnableSpadeDecryption: (enabled: boolean) => void;
  setDecryptionThroughput: (throughput: number) => void;
  setEnableBeatAnalysis: (enabled: boolean) => void;
  setBeatSensitivity: (sensitivity: number) => void;
  setCurrentBeatMap: (beatMap: BeatMapData | null) => void;
  resetSourceSettings: () => void;
}

export const useAudioSourceStore = create<AudioSourceSettingsState>()(
  persist(
    (set) => ({
      sourcePriority: ["netease", "qq", "kugou", "qishui", "local"],
      autoTrialFallback: true,
      preferredQuality: "lossless",

      enableSpadeDecryption: true,
      decryptionThroughputMBs: 48.2,

      enableBeatAnalysis: true,
      beatSensitivity: 1.0,
      currentBeatMap: null,

      setSourcePriority: (sourcePriority) => set({ sourcePriority }),
      setAutoTrialFallback: (autoTrialFallback) => set({ autoTrialFallback }),
      setPreferredQuality: (preferredQuality) => set({ preferredQuality }),
      setEnableSpadeDecryption: (enableSpadeDecryption) => set({ enableSpadeDecryption }),
      setDecryptionThroughput: (decryptionThroughputMBs) => set({ decryptionThroughputMBs }),
      setEnableBeatAnalysis: (enableBeatAnalysis) => set({ enableBeatAnalysis }),
      setBeatSensitivity: (beatSensitivity) => set({ beatSensitivity }),
      setCurrentBeatMap: (currentBeatMap) => set({ currentBeatMap }),

      resetSourceSettings: () =>
        set({
          sourcePriority: ["netease", "qq", "kugou", "qishui", "local"],
          autoTrialFallback: true,
          preferredQuality: "lossless",
          enableSpadeDecryption: true,
          enableBeatAnalysis: true,
          beatSensitivity: 1.0,
        }),
    }),
    {
      name: "mimi_audio_source_settings",
      partialize: (state) => ({
        sourcePriority: state.sourcePriority,
        autoTrialFallback: state.autoTrialFallback,
        preferredQuality: state.preferredQuality,
        enableSpadeDecryption: state.enableSpadeDecryption,
        enableBeatAnalysis: state.enableBeatAnalysis,
        beatSensitivity: state.beatSensitivity,
      }),
    }
  )
);
