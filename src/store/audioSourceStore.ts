import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { BeatMapData } from "@/services/BeatMapAnalyzer";
import { createSafeStorage } from "@/lib/storage/safeStorage";

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
  enableV8BeatPulse: boolean;
  beatSensitivity: number; // 0.5 ~ 2.0
  currentBeatMap: BeatMapData | null;

  // Actions
  setSourcePriority: (priority: AudioSourceType[]) => void;
  setAutoTrialFallback: (enabled: boolean) => void;
  setPreferredQuality: (quality: PreferredQuality) => void;
  setEnableSpadeDecryption: (enabled: boolean) => void;
  setDecryptionThroughput: (throughput: number) => void;
  setEnableBeatAnalysis: (enabled: boolean) => void;
  setEnableV8BeatPulse: (enabled: boolean) => void;
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
      enableV8BeatPulse: true,
      beatSensitivity: 1.0,
      currentBeatMap: null,

      setSourcePriority: (sourcePriority) => set({ sourcePriority }),
      setAutoTrialFallback: (autoTrialFallback) => set({ autoTrialFallback }),
      setPreferredQuality: (preferredQuality) => set({ preferredQuality }),
      setEnableSpadeDecryption: (enableSpadeDecryption) => set({ enableSpadeDecryption }),
      setDecryptionThroughput: (decryptionThroughputMBs) => set({ decryptionThroughputMBs }),
      setEnableBeatAnalysis: (enableBeatAnalysis) => set({ enableBeatAnalysis }),
      setEnableV8BeatPulse: (enableV8BeatPulse) => set({ enableV8BeatPulse }),
      setBeatSensitivity: (beatSensitivity) => set({ beatSensitivity }),
      setCurrentBeatMap: (currentBeatMap) => set({ currentBeatMap }),

      resetSourceSettings: () =>
        set({
          sourcePriority: ["netease", "qq", "kugou", "qishui", "local"],
          autoTrialFallback: true,
          preferredQuality: "lossless",
          enableSpadeDecryption: true,
          enableBeatAnalysis: true,
          enableV8BeatPulse: true,
          beatSensitivity: 1.0,
        }),
    }),
    {
      name: "mimi_audio_source_settings",
      storage: createJSONStorage(() => createSafeStorage("mimi_audio_source_settings")),
      partialize: (state) => ({
        sourcePriority: state.sourcePriority,
        autoTrialFallback: state.autoTrialFallback,
        preferredQuality: state.preferredQuality,
        enableSpadeDecryption: state.enableSpadeDecryption,
        enableBeatAnalysis: state.enableBeatAnalysis,
        enableV8BeatPulse: state.enableV8BeatPulse,
        beatSensitivity: state.beatSensitivity,
      }),
    }
  )
);
