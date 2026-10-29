import { AudioSliceCreator, DeviceSliceState } from "./types";
import { usePlayerStore } from "../playerStore";

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
