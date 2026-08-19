import { create } from "zustand";

export interface FloatingDebugState {
  stiffness: number;
  damping: number;
  mass: number;
  glowIntensity: number;
  magnifyPower: number;
  isHUDOpen: boolean;
  visualizerMode: "waveform" | "spectrum" | "both";

  setStiffness: (stiffness: number) => void;
  setDamping: (damping: number) => void;
  setMass: (mass: number) => void;
  setGlowIntensity: (intensity: number) => void;
  setMagnifyPower: (power: number) => void;
  setIsHUDOpen: (isOpen: boolean) => void;
  toggleHUD: () => void;
  setVisualizerMode: (mode: "waveform" | "spectrum" | "both") => void;
  resetDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  stiffness: 380,
  damping: 32,
  mass: 0.8,
  glowIntensity: 1.0,
  magnifyPower: 2.4,
  isHUDOpen: false,
  visualizerMode: "waveform" as const,
};

export const useFloatingDebugStore = create<FloatingDebugState>((set) => ({
  ...DEFAULT_SETTINGS,

  setStiffness: (stiffness) => set({ stiffness }),
  setDamping: (damping) => set({ damping }),
  setMass: (mass) => set({ mass }),
  setGlowIntensity: (glowIntensity) => set({ glowIntensity }),
  setMagnifyPower: (magnifyPower) => set({ magnifyPower }),
  setIsHUDOpen: (isHUDOpen) => set({ isHUDOpen }),
  toggleHUD: () => set((state) => ({ isHUDOpen: !state.isHUDOpen })),
  setVisualizerMode: (visualizerMode) => set({ visualizerMode }),
  resetDefaults: () => set({ ...DEFAULT_SETTINGS, isHUDOpen: true }),
}));
