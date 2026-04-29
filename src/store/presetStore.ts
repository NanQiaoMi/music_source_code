import { create } from "zustand";
import { EffectPreset } from "@/lib/visualization/types";

interface PresetStore {
  presets: EffectPreset[];
  currentPresetId: string | null;
  isLoading: boolean;
  error: string | null;
  
  addPreset: (preset: EffectPreset) => void;
  updatePreset: (id: string, updates: Partial<EffectPreset>) => void;
  deletePreset: (id: string) => void;
  setCurrentPreset: (id: string | null) => void;
  toggleFavorite: (id: string) => void;
  exportPreset: (id: string) => string;
  importPreset: (jsonString: string) => EffectPreset | null;
  loadSystemPresets: () => void;
}

export const usePresetStore = create<PresetStore>((set, get) => ({
  presets: [],
  currentPresetId: null,
  isLoading: false,
  error: null,

  addPreset: (preset) => {
    set((state) => ({
      presets: [...state.presets, preset]
    }));
  },

  updatePreset: (id, updates) => {
    set((state) => ({
      presets: state.presets.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      )
    }));
  },

  deletePreset: (id) => {
    set((state) => ({
      presets: state.presets.filter((p) => p.id !== id),
      currentPresetId: state.currentPresetId === id ? null : state.currentPresetId
    }));
  },

  setCurrentPreset: (id) => {
    set({ currentPresetId: id });
  },

  toggleFavorite: (id) => {
    set((state) => ({
      presets: state.presets.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite, updatedAt: Date.now() } : p
      )
    }));
  },

  exportPreset: (id) => {
    const preset = get().presets.find((p) => p.id === id);
    if (!preset) return "";
    
    return JSON.stringify({
      version: "1.0",
      type: "single",
      presets: [preset],
      metadata: {
        name: preset.name,
        description: preset.description,
        author: preset.author
      }
    }, null, 2);
  },

  importPreset: (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.presets && data.presets.length > 0) {
        const preset = { ...data.presets[0], id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now(), isSystem: false };
        get().addPreset(preset);
        return preset;
      }
    } catch (e) {
      console.error("Failed to import preset:", e);
    }
    return null;
  },

  loadSystemPresets: () => {
    const systemPresets: EffectPreset[] = [
      {
        id: "spectrum-default",
        name: "频谱 - 默认",
        description: "经典频谱可视化效果",
        effectId: "spectrum-v8",
        tags: ["频谱", "经典"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSystem: true,
        isFavorite: false,
        parameters: {
          barCount: 64,
          barWidth: 4,
          barSpacing: 2,
          colorScheme: "rainbow",
          glowIntensity: 1,
          symmetric: true,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0
        }
      },
      {
        id: "spectrum-bold",
        name: "频谱 - 粗壮",
        description: "粗壮的频谱柱效果",
        effectId: "spectrum-v8",
        tags: ["频谱", "粗壮"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSystem: true,
        isFavorite: false,
        parameters: {
          barCount: 32,
          barWidth: 8,
          barSpacing: 4,
          colorScheme: "fire",
          glowIntensity: 2,
          symmetric: true,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0
        }
      },
      {
        id: "particle-burst-intense",
        name: "粒子爆发 - 激烈",
        description: "更多粒子的激烈爆发效果",
        effectId: "particle-burst",
        tags: ["粒子", "激烈"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSystem: true,
        isFavorite: false,
        parameters: {
          particleCount: 3000,
          burstIntensity: 5,
          speed: 2,
          colorScheme: "neon",
          glowIntensity: 1.5,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0
        }
      }
    ];
    
    set({ presets: systemPresets, isLoading: false });
  }
}));
