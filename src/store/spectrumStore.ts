import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SpectrumMode = "bars" | "line" | "logarithmic";
export type MeterType = "vu" | "ppm";

export interface SpectrumData {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  peaks: { value: number; timestamp: number }[];
  rms: number;
  peak: number;
  timestamp: number;
}

export interface SpectrumState {
  isSpectrumEnabled: boolean;
  spectrumMode: SpectrumMode;
  meterType: MeterType;

  currentSpectrum: SpectrumData | null;
  spectrumHistory: SpectrumData[];

  fftSize: number;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;

  showPeaks: boolean;
  showRMS: boolean;
  showFrequencyLabels: boolean;

  barColor: string;
  backgroundColor: string;
  gridColor: string;

  vuMeterLevel: number;
  ppmMeterLevel: number;
  vuMeterPeak: number;
  ppmMeterPeak: number;

  setSpectrumEnabled: (enabled: boolean) => void;
  setSpectrumMode: (mode: SpectrumMode) => void;
  setMeterType: (type: MeterType) => void;

  setCurrentSpectrum: (data: SpectrumData | null) => void;
  addSpectrumToHistory: (data: SpectrumData) => void;
  clearSpectrumHistory: () => void;

  setFFTSize: (size: number) => void;
  setSmoothingTimeConstant: (value: number) => void;
  setMinDecibels: (value: number) => void;
  setMaxDecibels: (value: number) => void;

  setShowPeaks: (show: boolean) => void;
  setShowRMS: (show: boolean) => void;
  setShowFrequencyLabels: (show: boolean) => void;

  setBarColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  setGridColor: (color: string) => void;

  setVUMeterLevel: (level: number) => void;
  setPPMMeterLevel: (level: number) => void;
  resetMeters: () => void;
}

export const useSpectrumStore = create<SpectrumState>()(
  persist(
    (set, get) => ({
      isSpectrumEnabled: true,
      spectrumMode: "bars",
      meterType: "vu",

      currentSpectrum: null,
      spectrumHistory: [],

      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      minDecibels: -100,
      maxDecibels: -30,

      showPeaks: true,
      showRMS: false,
      showFrequencyLabels: true,

      barColor: "#60A5FA",
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      gridColor: "rgba(255, 255, 255, 0.1)",

      vuMeterLevel: 0,
      ppmMeterLevel: 0,
      vuMeterPeak: 0,
      ppmMeterPeak: 0,

      setSpectrumEnabled: (enabled) => {
        set({ isSpectrumEnabled: enabled });
      },

      setSpectrumMode: (mode) => {
        set({ spectrumMode: mode });
      },

      setMeterType: (type) => {
        set({ meterType: type });
      },

      setCurrentSpectrum: (data) => {
        set({ currentSpectrum: data });
      },

      addSpectrumToHistory: (data) => {
        set((state) => ({
          spectrumHistory: [data, ...state.spectrumHistory].slice(0, 100),
        }));
      },

      clearSpectrumHistory: () => {
        set({ spectrumHistory: [] });
      },

      setFFTSize: (size) => {
        set({ fftSize: Math.min(32768, Math.max(512, size)) });
      },

      setSmoothingTimeConstant: (value) => {
        set({ smoothingTimeConstant: Math.min(0.99, Math.max(0, value)) });
      },

      setMinDecibels: (value) => {
        set({ minDecibels: Math.min(-30, Math.max(-150, value)) });
      },

      setMaxDecibels: (value) => {
        set({ maxDecibels: Math.min(-10, Math.max(-100, value)) });
      },

      setShowPeaks: (show) => {
        set({ showPeaks: show });
      },

      setShowRMS: (show) => {
        set({ showRMS: show });
      },

      setShowFrequencyLabels: (show) => {
        set({ showFrequencyLabels: show });
      },

      setBarColor: (color) => {
        set({ barColor: color });
      },

      setBackgroundColor: (color) => {
        set({ backgroundColor: color });
      },

      setGridColor: (color) => {
        set({ gridColor: color });
      },

      setVUMeterLevel: (level) => {
        const state = get();
        if (level > state.vuMeterPeak) {
          set({ vuMeterPeak: level });
        }
        set({ vuMeterLevel: Math.min(1, Math.max(0, level)) });
      },

      setPPMMeterLevel: (level) => {
        const state = get();
        if (level > state.ppmMeterPeak) {
          set({ ppmMeterPeak: level });
        }
        set({ ppmMeterLevel: Math.min(1, Math.max(0, level)) });
      },

      resetMeters: () => {
        set({
          vuMeterLevel: 0,
          ppmMeterLevel: 0,
          vuMeterPeak: 0,
          ppmMeterPeak: 0,
        });
      },
    }),
    {
      name: "spectrum-store-v5",
      partialize: (state) => ({
        spectrumMode: state.spectrumMode,
        meterType: state.meterType,
        fftSize: state.fftSize,
        smoothingTimeConstant: state.smoothingTimeConstant,
        minDecibels: state.minDecibels,
        maxDecibels: state.maxDecibels,
        showPeaks: state.showPeaks,
        showRMS: state.showRMS,
        showFrequencyLabels: state.showFrequencyLabels,
        barColor: state.barColor,
        backgroundColor: state.backgroundColor,
        gridColor: state.gridColor,
      }),
    }
  )
);
