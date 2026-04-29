import { create } from "zustand";

export type VisualizationEffect = 
  | "spatialMesh" 
  | "cyberpunkParticles" 
  | "organicFluid"
  | "auroraWave"
  | "spectrumRing"
  | "nebulaField"
  | "vinylGroove"
  | "cyberMatrix"
  | "gravitationalField"
  | "prismPulse";

export interface VisualizationPreset {
  id: string;
  name: string;
  effect: VisualizationEffect;
  settings: Record<string, any>;
}

interface VisualizationState {
  currentEffect: VisualizationEffect;
  isFullscreen: boolean;
  presets: VisualizationPreset[];
  currentPresetId: string | null;
  showSongInfo: boolean;
  reactToMusic: boolean;
  
  effectSettings: {
    spatialMesh: { blurIntensity: number; speed: number; colorIntensity: number; };
    cyberpunkParticles: { particleCount: number; particleSize: number; speed: number; glowIntensity: number; };
    organicFluid: { complexity: number; speed: number; colorShift: number; };
    auroraWave: { waveCount: number; speed: number; colorIntensity: number; amplitude: number; };
    spectrumRing: { ringCount: number; rotationSpeed: number; barWidth: number; colorMode: number; glowIntensity: number; haloStyle: number; };
    nebulaField: { starCount: number; nebulaIntensity: number; speed: number; depth: number; };
    vinylGroove: { spinSpeed: number; grooveIntensity: number; glowAmount: number; opticalComplexity: number; chromaticIntensity: number; };
    cyberMatrix: { speed: number; density: number; };
    gravitationalField: { speed: number; sensitivity: number; coreIntensity: number; };
    prismPulse: { complexity: number; refraction: number; drift: number; speed: number; };
  };

  setCurrentEffect: (effect: VisualizationEffect) => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
  toggleFullscreen: () => void;
  toggleSongInfo: () => void;
  toggleReactToMusic: () => void;
  savePreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  updateEffectSettings: (effect: VisualizationEffect, settings: Record<string, any>) => void;
}

const defaultEffectSettings = {
  spatialMesh: { blurIntensity: 120, speed: 1.0, colorIntensity: 0.8 },
  cyberpunkParticles: { particleCount: 500, particleSize: 2.0, speed: 1.5, glowIntensity: 1.0 },
  organicFluid: { complexity: 1.0, speed: 1.0, colorShift: 0.5 },
  auroraWave: { waveCount: 5, speed: 0.8, colorIntensity: 1.0, amplitude: 1.0 },
  spectrumRing: { ringCount: 3, rotationSpeed: 0.5, barWidth: 3.0, colorMode: 0, glowIntensity: 1.0, haloStyle: 0 },
  nebulaField: { starCount: 800, nebulaIntensity: 1.0, speed: 0.5, depth: 1.0 },
  vinylGroove: { spinSpeed: 1.0, grooveIntensity: 1.0, glowAmount: 1.0, opticalComplexity: 1.0, chromaticIntensity: 1.0 },
  cyberMatrix: { speed: 1.0, density: 1.0 },
  gravitationalField: { speed: 1.0, sensitivity: 1.0, coreIntensity: 1.0 },
  prismPulse: { complexity: 6, refraction: 1.0, drift: 0.5, speed: 1.0 },
};

export const useVisualizationStore = create<VisualizationState>((set, get) => ({
  currentEffect: "spatialMesh",
  isFullscreen: false,
  presets: [],
  currentPresetId: null,
  showSongInfo: true,
  reactToMusic: true,
  effectSettings: defaultEffectSettings,

  setCurrentEffect: (effect) => set({ currentEffect: effect }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
  toggleSongInfo: () => set((state) => ({ showSongInfo: !state.showSongInfo })),
  toggleReactToMusic: () => set((state) => ({ reactToMusic: !state.reactToMusic })),

  savePreset: (name) => {
    const state = get();
    const newPreset: VisualizationPreset = {
      id: `preset-${Date.now()}`,
      name,
      effect: state.currentEffect,
      settings: { ...state.effectSettings[state.currentEffect] },
    };
    set({
      presets: [...state.presets, newPreset],
      currentPresetId: newPreset.id,
    });
  },

  loadPreset: (presetId) => {
    const state = get();
    const preset = state.presets.find((p) => p.id === presetId);
    if (preset) {
      set({
        currentEffect: preset.effect,
        currentPresetId: presetId,
        effectSettings: {
          ...state.effectSettings,
          [preset.effect]: { ...preset.settings },
        },
      });
    }
  },

  deletePreset: (presetId) => {
    const state = get();
    set({
      presets: state.presets.filter((p) => p.id !== presetId),
      currentPresetId: state.currentPresetId === presetId ? null : state.currentPresetId,
    });
  },

  updateEffectSettings: (effect, settings) => {
    set((state) => ({
      effectSettings: {
        ...state.effectSettings,
        [effect]: { ...state.effectSettings[effect], ...settings },
      },
    }));
  },
}));
