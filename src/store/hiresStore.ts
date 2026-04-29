import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AudioQuality = "CD" | "Hi-Res" | "DSD" | "MQA" | "DXD";

export interface AudioQualityInfo {
  format: string;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  bitrate: number;
  quality: AudioQuality;
  isLossless: boolean;
  isHighRes: boolean;
}

export interface HiResState {
  currentQuality: AudioQualityInfo | null;
  showQualityBadge: boolean;
  showDetailedInfo: boolean;
  autoDetect: boolean;

  setAudioQuality: (info: AudioQualityInfo | null) => void;
  setShowQualityBadge: (show: boolean) => void;
  setShowDetailedInfo: (show: boolean) => void;
  setAutoDetect: (auto: boolean) => void;

  detectQuality: (sampleRate: number, bitDepth: number, channels: number) => AudioQuality;
  getQualityBadge: (quality: AudioQuality) => string;
  getQualityColor: (quality: AudioQuality) => string;
}

export const useHiResStore = create<HiResState>()(
  persist(
    (set, get) => ({
      currentQuality: null,
      showQualityBadge: true,
      showDetailedInfo: false,
      autoDetect: true,

      setAudioQuality: (info) => {
        set({ currentQuality: info });
      },

      setShowQualityBadge: (show) => {
        set({ showQualityBadge: show });
      },

      setShowDetailedInfo: (show) => {
        set({ showDetailedInfo: show });
      },

      setAutoDetect: (auto) => {
        set({ autoDetect: auto });
      },

      detectQuality: (sampleRate, bitDepth, channels) => {
        if (sampleRate >= 2822400 || sampleRate >= 11289600) {
          return "DSD";
        }

        if (sampleRate >= 352800 || bitDepth >= 32) {
          return "DXD";
        }

        if (sampleRate >= 88200 || bitDepth >= 24) {
          return "Hi-Res";
        }

        if (sampleRate === 44100 || sampleRate === 48000) {
          return "CD";
        }

        return "CD";
      },

      getQualityBadge: (quality) => {
        const badges = {
          CD: "CD Quality",
          "Hi-Res": "Hi-Res",
          DSD: "DSD",
          MQA: "MQA",
          DXD: "DXD",
        };
        return badges[quality];
      },

      getQualityColor: (quality) => {
        const colors = {
          CD: "#60A5FA",
          "Hi-Res": "#F59E0B",
          DSD: "#EF4444",
          MQA: "#8B5CF6",
          DXD: "#10B981",
        };
        return colors[quality];
      },
    }),
    {
      name: "hires-store-v5",
      partialize: (state) => ({
        showQualityBadge: state.showQualityBadge,
        showDetailedInfo: state.showDetailedInfo,
        autoDetect: state.autoDetect,
      }),
    }
  )
);

export function analyzeAudioQuality(
  sampleRate: number,
  bitDepth: number,
  channels: number,
  format: string
): AudioQualityInfo {
  const { detectQuality } = useHiResStore.getState();
  const quality = detectQuality(sampleRate, bitDepth, channels);

  const bitrate = Math.floor((sampleRate * bitDepth * channels) / 1000);

  return {
    format: format.toUpperCase(),
    sampleRate,
    bitDepth,
    channels,
    bitrate,
    quality,
    isLossless: ["FLAC", "ALAC", "WAV", "AIFF", "DSD"].includes(format.toUpperCase()),
    isHighRes: ["Hi-Res", "DSD", "MQA", "DXD"].includes(quality),
  };
}
