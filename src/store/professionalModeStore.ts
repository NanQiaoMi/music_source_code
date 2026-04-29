import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProfessionalFeature =
  | "waveform"
  | "spectrum"
  | "format-converter"
  | "fingerprint"
  | "metadata-editor"
  | "health-check"
  | "dsd-processor"
  | "cue-cutter"
  | "crossfade-advanced"
  | "incremental-backup"
  | "multi-channel"
  | "hi-res-indicator";

interface ProfessionalModeState {
  isProfessionalMode: boolean;
  enabledFeatures: Set<ProfessionalFeature>;
  hiddenFeatures: Set<ProfessionalFeature>;
  lastModeSwitch: number;
  showModeSwitchAnimation: boolean;

  toggleMode: () => void;
  setProfessionalMode: (enabled: boolean) => void;
  enableFeature: (feature: ProfessionalFeature) => void;
  disableFeature: (feature: ProfessionalFeature) => void;
  toggleFeature: (feature: ProfessionalFeature) => void;
  isFeatureEnabled: (feature: ProfessionalFeature) => boolean;
  setShowModeSwitchAnimation: (show: boolean) => void;
  resetToDefaults: () => void;
}

const DEFAULT_PROFESSIONAL_FEATURES: ProfessionalFeature[] = [
  "waveform",
  "spectrum",
  "hi-res-indicator",
];

const ALL_PROFESSIONAL_FEATURES: ProfessionalFeature[] = [
  "waveform",
  "spectrum",
  "format-converter",
  "fingerprint",
  "metadata-editor",
  "health-check",
  "dsd-processor",
  "cue-cutter",
  "crossfade-advanced",
  "incremental-backup",
  "multi-channel",
  "hi-res-indicator",
];

export const useProfessionalModeStore = create<ProfessionalModeState>()(
  persist(
    (set, get) => ({
      isProfessionalMode: true,
      enabledFeatures: new Set(ALL_PROFESSIONAL_FEATURES),
      hiddenFeatures: new Set(),
      lastModeSwitch: Date.now(),
      showModeSwitchAnimation: false,

      toggleMode: () => {
        set((state) => {
          const newMode = !state.isProfessionalMode;
          return {
            isProfessionalMode: newMode,
            lastModeSwitch: Date.now(),
            showModeSwitchAnimation: true,
            enabledFeatures: newMode
              ? new Set(ALL_PROFESSIONAL_FEATURES)
              : new Set(DEFAULT_PROFESSIONAL_FEATURES),
          };
        });

        setTimeout(() => {
          set({ showModeSwitchAnimation: false });
        }, 500);
      },

      setProfessionalMode: (enabled) => {
        set({
          isProfessionalMode: enabled,
          lastModeSwitch: Date.now(),
          showModeSwitchAnimation: true,
          enabledFeatures: enabled
            ? new Set(ALL_PROFESSIONAL_FEATURES)
            : new Set(DEFAULT_PROFESSIONAL_FEATURES),
        });

        setTimeout(() => {
          set({ showModeSwitchAnimation: false });
        }, 500);
      },

      enableFeature: (feature) => {
        set((state) => {
          const newFeatures = new Set(state.enabledFeatures);
          newFeatures.add(feature);
          return { enabledFeatures: newFeatures };
        });
      },

      disableFeature: (feature) => {
        set((state) => {
          const newFeatures = new Set(state.enabledFeatures);
          newFeatures.delete(feature);
          return { enabledFeatures: newFeatures };
        });
      },

      toggleFeature: (feature) => {
        set((state) => {
          const newFeatures = new Set(state.enabledFeatures);
          if (newFeatures.has(feature)) {
            newFeatures.delete(feature);
          } else {
            newFeatures.add(feature);
          }
          return { enabledFeatures: newFeatures };
        });
      },

      isFeatureEnabled: (feature) => {
        const state = get();
        return state.isProfessionalMode && state.enabledFeatures.has(feature);
      },

      setShowModeSwitchAnimation: (show) => {
        set({ showModeSwitchAnimation: show });
      },

      resetToDefaults: () => {
        set({
          isProfessionalMode: true,
          enabledFeatures: new Set(ALL_PROFESSIONAL_FEATURES),
          hiddenFeatures: new Set(),
          lastModeSwitch: Date.now(),
        });
      },
    }),
    {
      name: "professional-mode-store-v5",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          return {
            ...data,
            state: {
              ...data.state,
              enabledFeatures: new Set(data.state.enabledFeatures || []),
              hiddenFeatures: new Set(data.state.hiddenFeatures || []),
            },
          };
        },
        setItem: (name, value) => {
          const data = {
            ...value,
            state: {
              ...value.state,
              enabledFeatures: Array.from(value.state.enabledFeatures || []),
              hiddenFeatures: Array.from(value.state.hiddenFeatures || []),
            },
          };
          try {
            localStorage.setItem(name, JSON.stringify(data));
          } catch (error) {
            console.error("Failed to save professional mode store:", error);
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

export const PROFESSIONAL_FEATURE_INFO: Record<
  ProfessionalFeature,
  { name: string; nameEn: string; description: string; icon: string }
> = {
  waveform: {
    name: "波形图可视化",
    nameEn: "Waveform Visualizer",
    description: "高精度音频波形图，支持缩放和精准跳转",
    icon: "📊",
  },
  spectrum: {
    name: "频谱分析仪",
    nameEn: "Spectrum Analyzer",
    description: "实时音频频谱，支持多种显示模式",
    icon: "📈",
  },
  "format-converter": {
    name: "格式转换",
    nameEn: "Format Converter",
    description: "无损音频格式转换，支持FLAC/MP3/AAC等",
    icon: "🔄",
  },
  fingerprint: {
    name: "音频指纹",
    nameEn: "Audio Fingerprint",
    description: "本地音频指纹识别，精准去重",
    icon: "🔍",
  },
  "metadata-editor": {
    name: "元数据编辑",
    nameEn: "Metadata Editor",
    description: "批量编辑歌曲元数据信息",
    icon: "✏️",
  },
  "health-check": {
    name: "健康检查",
    nameEn: "Health Check",
    description: "扫描音乐库问题文件并自动修复",
    icon: "🏥",
  },
  "dsd-processor": {
    name: "DSD处理",
    nameEn: "DSD Processor",
    description: "DSD音频解码和处理",
    icon: "🎵",
  },
  "cue-cutter": {
    name: "CUE切割",
    nameEn: "CUE Cutter",
    description: "整轨音频CUE自动拆分",
    icon: "✂️",
  },
  "crossfade-advanced": {
    name: "高级淡入淡出",
    nameEn: "Advanced Crossfade",
    description: "智能BPM匹配的交叉淡入淡出",
    icon: "🎚️",
  },
  "incremental-backup": {
    name: "增量备份",
    nameEn: "Incremental Backup",
    description: "增量备份音乐库数据",
    icon: "💾",
  },
  "multi-channel": {
    name: "多声道支持",
    nameEn: "Multi-Channel",
    description: "5.1/7.1声道音频支持",
    icon: "🔊",
  },
  "hi-res-indicator": {
    name: "Hi-Res标识",
    nameEn: "Hi-Res Indicator",
    description: "自动识别高解析音频并显示标识",
    icon: "⭐",
  },
};
