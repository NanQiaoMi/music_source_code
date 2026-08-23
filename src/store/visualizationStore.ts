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
  | "prismPulse"
  | "superstringSingularity"
  | "cinematicSilkAurora"
  | "phonkDriftEclipse";

export type NumericEffectSettings = Record<string, number>;
export type EffectSettings = Record<VisualizationEffect, NumericEffectSettings>;

export interface VisualizationPreset {
  id: string;
  name: string;
  effect: VisualizationEffect;
  settings: NumericEffectSettings;
}

interface VisualizationState {
  currentEffect: VisualizationEffect;
  isFullscreen: boolean;
  presets: VisualizationPreset[];
  currentPresetId: string | null;
  showSongInfo: boolean;
  reactToMusic: boolean;

  effectSettings: EffectSettings;

  setCurrentEffect: (effect: VisualizationEffect) => void;
  setIsFullscreen: (isFullscreen: boolean) => void;
  toggleFullscreen: () => void;
  toggleSongInfo: () => void;
  toggleReactToMusic: () => void;
  savePreset: (name: string) => void;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  updateEffectSettings: (
    effect: VisualizationEffect,
    settings: Partial<NumericEffectSettings>
  ) => void;
}

const defaultEffectSettings: EffectSettings = {
  spatialMesh: { blurIntensity: 120, speed: 1.0, colorIntensity: 0.8 },
  cyberpunkParticles: {
    particleCount: 240,
    particleSize: 1.2,
    speed: 1.0,
    glowIntensity: 1.0,
    gravityLens: 1.0,
    pulseSpeed: 1.0,
    accretionSpin: 1.0,
    bokehAmount: 0.6,
  },
  organicFluid: { complexity: 1.0, speed: 1.0, colorShift: 0.5 },
  auroraWave: {
    speed: 1.0,
    colorIntensity: 1.0,
    coreComplexity: 1.0,
    flareAmount: 1.0,
    hudDetail: 1.0,
  },
  spectrumRing: {
    ringCount: 3,
    rotationSpeed: 0.5,
    barWidth: 3.0,
    colorMode: 0,
    glowIntensity: 1.0,
    haloStyle: 0,
    flareAmount: 1.0,
    chromaticIntensity: 1.0,
    hudDetail: 1.0,
  },
  nebulaField: {
    starCount: 800,
    nebulaIntensity: 1.0,
    speed: 0.5,
    depth: 1.0,
    flareAmount: 1.0,
    hudDetail: 1.0,
  },
  vinylGroove: {
    spinSpeed: 1.0,
    grooveIntensity: 1.0,
    glowAmount: 1.0,
    opticalComplexity: 1.0,
    chromaticIntensity: 1.0,
  },
  cyberMatrix: { speed: 1.0, density: 1.0 },
  gravitationalField: { speed: 1.0, sensitivity: 1.0, coreIntensity: 1.0 },
  prismPulse: { complexity: 6, refraction: 1.0, drift: 0.5, speed: 1.0 },
  superstringSingularity: { speed: 1.0, singularityMass: 1.0, superstringTension: 1.2, coreGlow: 1.5 },
  cinematicSilkAurora: { silkCount: 6, flowSpeed: 1.0, glowIntensity: 1.15, bokehDensity: 1.0, firefliesCount: 25, godRaysIntensity: 1.0, spatialDepth: 1.2, anamorphicFlare: 1.0 },
  phonkDriftEclipse: { bassIntensity: 1.2, cruiseSpeed: 1.3, glitchAberration: 1.0, colorMode: 0 },
};

const defaultPresets: VisualizationPreset[] = [
  {
    id: "preset-phonk-tokyo-drift",
    name: "赛博漂移 · 日蚀特异点 (Phonk Drift)",
    effect: "phonkDriftEclipse",
    settings: {
      bassIntensity: 1.3,
      cruiseSpeed: 1.4,
      glitchAberration: 1.0,
      colorMode: 0,
    },
  },
  {
    id: "preset-astro-blackhole",
    name: "深空黑洞 (Sagittarius A*)",
    effect: "cyberpunkParticles",
    settings: {
        particleCount: 1200,
        particleSize: 2.2,
        speed: 1.8,
        glowIntensity: 1.2,
        gravityLens: 1.8,
        pulseSpeed: 1.5,
        accretionSpin: 1.6,
        bokehAmount: 1.2,
      },
    },
    {
      id: "preset-astro-supernova",
      name: "超新星遗迹 (Supernova Remnant)",
      effect: "cyberpunkParticles",
      settings: {
        particleCount: 1500,
        particleSize: 2.6,
        speed: 2.0,
        glowIntensity: 2.2,
        gravityLens: 1.2,
        pulseSpeed: 2.0,
        accretionSpin: 1.2,
        bokehAmount: 1.8,
      },
    },
    {
      id: "preset-astro-synapse",
      name: "量子突触中枢 (Quantum Synapse)",
      effect: "cyberpunkParticles",
      settings: {
        particleCount: 800,
        particleSize: 1.8,
        speed: 1.4,
        glowIntensity: 1.0,
        gravityLens: 0.8,
        pulseSpeed: 2.4,
        accretionSpin: 0.8,
        bokehAmount: 0.6,
      },
    },
    {
      id: "preset-astro-aurora",
      name: "电离极光纤维 (Ionized Lattice)",
      effect: "cyberpunkParticles",
      settings: {
        particleCount: 1000,
        particleSize: 2.0,
        speed: 1.0,
        glowIntensity: 1.6,
        gravityLens: 0.6,
        pulseSpeed: 1.0,
        accretionSpin: 0.9,
        bokehAmount: 0.9,
      },
    },
  ];

export const useVisualizationStore = create<VisualizationState>((set, get) => ({
  currentEffect: "phonkDriftEclipse",
  isFullscreen: false,
  presets: defaultPresets,
  currentPresetId: "preset-phonk-tokyo-drift",
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
