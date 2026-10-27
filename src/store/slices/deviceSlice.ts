import { AudioSliceCreator, DeviceSliceState, EQPreset } from "./types";
import { usePlayerStore } from "../playerStore";
import { useEQStore } from "../eqStore";

export const getDefaultEQPreset = (preset: EQPreset): number[] => {
  const presets: { [key in EQPreset]: number[] } = {
    flat: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    pop: [
      2, 1, 0, -1, -1, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    rock: [
      4, 3, 1, 0, -1, -1, 0, 2, 3, 4, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    classical: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    jazz: [
      1, 1, 1, 0, 0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    vocal: [
      -2, -1, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    light: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    bass: [
      5, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    treble: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    custom1: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    custom2: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    custom3: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
  };
  return presets[preset] || presets.flat;
};

export const createDeviceSlice: AudioSliceCreator<DeviceSliceState> = (set, get) => ({
  volume: usePlayerStore.getState().volume ?? 0.8,
  isMuted: usePlayerStore.getState().isMuted ?? false,
  playbackRate: usePlayerStore.getState().playbackRate ?? 1.0,
  audioDevices: [],
  currentAudioDevice: null,
  isDeviceEnumerationSupported:
    typeof navigator !== "undefined" &&
    "mediaDevices" in navigator &&
    "enumerateDevices" in navigator.mediaDevices,

  eqBands: useEQStore.getState().eqBands,
  currentEQPreset: "flat",
  isEQEnabled: useEQStore.getState().isEQEnabled,
  customEQPresets: {},

  stereoEnhance: 0,
  surroundSound: 0,
  bassBoost: 0,
  trebleBoost: 0,
  vocalEnhance: 0,
  loudnessNormalization: false,
  targetLoudness: -14,
  isLosslessMode: true,

  headphonePreset: "default",
  customHeadphoneParams: {
    bass: 0,
    mid: 0,
    treble: 0,
  },

  setVolume: (volume) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    usePlayerStore.getState().setVolume(clampedVolume);
    set({ volume: clampedVolume });
  },

  toggleMute: () => {
    const nextMuted = !get().isMuted;
    usePlayerStore.getState().setIsMuted(nextMuted);
    set({ isMuted: nextMuted });
  },

  setPlaybackRate: (rate) => {
    usePlayerStore.getState().setPlaybackRate(rate);
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    set({ playbackRate: Math.round(clampedRate * 100) / 100 });
  },

  resetPlaybackRate: () => {
    usePlayerStore.getState().resetPlaybackRate();
    set({ playbackRate: 1.0 });
  },

  setAudioDevices: (devices) => set({ audioDevices: devices }),
  setCurrentAudioDevice: (deviceId) => set({ currentAudioDevice: deviceId }),
  setIsDeviceEnumerationSupported: (supported) => set({ isDeviceEnumerationSupported: supported }),

  setEQBands: (bands) => {
    useEQStore.getState().setEQBands(bands);
    set({
      eqBands: bands,
      currentEQPreset:
        bands === getDefaultEQPreset(get().currentEQPreset) ? get().currentEQPreset : "custom1",
    });
  },

  setCurrentEQPreset: (preset) => {
    const bands = getDefaultEQPreset(preset);
    useEQStore.getState().setEQBands(bands);
    set({
      currentEQPreset: preset,
      eqBands: bands,
    });
  },

  setIsEQEnabled: (enabled) => {
    useEQStore.getState().setEQEnabled(enabled);
    set({ isEQEnabled: enabled });
  },

  saveCustomEQPreset: (name, bands) =>
    set((state) => ({
      customEQPresets: { ...state.customEQPresets, [name]: bands },
    })),

  loadEQPreset: (preset) => {
    const bands = getDefaultEQPreset(preset);
    useEQStore.getState().setEQBands(bands);
    set({
      eqBands: bands,
      currentEQPreset: preset,
    });
  },

  setStereoEnhance: (value) => set({ stereoEnhance: Math.max(0, Math.min(100, value)) }),
  setSurroundSound: (value) => set({ surroundSound: Math.max(0, Math.min(100, value)) }),
  setBassBoost: (value) => set({ bassBoost: Math.max(0, Math.min(100, value)) }),
  setTrebleBoost: (value) => set({ trebleBoost: Math.max(0, Math.min(100, value)) }),
  setVocalEnhance: (value) => set({ vocalEnhance: Math.max(0, Math.min(100, value)) }),
  setLoudnessNormalization: (enabled) => set({ loudnessNormalization: enabled }),
  setTargetLoudness: (loudness) => set({ targetLoudness: Math.max(-24, Math.min(-8, loudness)) }),
  setIsLosslessMode: (enabled) => set({ isLosslessMode: enabled }),

  setHeadphonePreset: (preset) => set({ headphonePreset: preset }),
  setCustomHeadphoneParams: (params) => set({ customHeadphoneParams: params }),
});
