import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WaveformPoint {
  time: number;
  min: number;
  max: number;
  avg: number;
}

export interface WaveformChannel {
  channelIndex: number;
  points: WaveformPoint[];
  duration: number;
  sampleRate: number;
}

export interface WaveformData {
  songId: string;
  channels: WaveformChannel[];
  totalDuration: number;
  generatedAt: number;
  zoomLevel: number;
}

export interface WaveformMarker {
  id: string;
  songId: string;
  time: number;
  label: string;
  color: string;
  createdAt: number;
}

export interface WaveformState {
  currentWaveform: WaveformData | null;
  waveformCache: Map<string, WaveformData>;
  markers: WaveformMarker[];

  isGenerating: boolean;
  generationProgress: number;
  generatingSongId: string | null;

  zoomLevel: number;
  scrollPosition: number;
  isPlaying: boolean;
  currentTime: number;

  showMarkers: boolean;
  showPeaks: boolean;
  showRMS: boolean;
  waveformColor: string;
  backgroundColor: string;

  setCurrentWaveform: (waveform: WaveformData | null) => void;
  addWaveformToCache: (songId: string, waveform: WaveformData) => void;
  getWaveformFromCache: (songId: string) => WaveformData | undefined;

  addMarker: (marker: WaveformMarker) => void;
  removeMarker: (markerId: string) => void;
  updateMarker: (markerId: string, updates: Partial<WaveformMarker>) => void;
  getMarkersForSong: (songId: string) => WaveformMarker[];

  setGenerating: (isGenerating: boolean, songId?: string) => void;
  setGenerationProgress: (progress: number) => void;

  setZoomLevel: (zoom: number) => void;
  setScrollPosition: (position: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;

  setShowMarkers: (show: boolean) => void;
  setShowPeaks: (show: boolean) => void;
  setShowRMS: (show: boolean) => void;
  setWaveformColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;

  clearCache: () => void;
}

export const useWaveformStore = create<WaveformState>()(
  persist(
    (set, get) => ({
      currentWaveform: null,
      waveformCache: new Map(),
      markers: [],

      isGenerating: false,
      generationProgress: 0,
      generatingSongId: null,

      zoomLevel: 1,
      scrollPosition: 0,
      isPlaying: false,
      currentTime: 0,

      showMarkers: true,
      showPeaks: true,
      showRMS: false,
      waveformColor: "#60A5FA",
      backgroundColor: "rgba(255, 255, 255, 0.05)",

      setCurrentWaveform: (waveform) => {
        set({ currentWaveform: waveform });
      },

      addWaveformToCache: (songId, waveform) => {
        set((state) => {
          const newCache = new Map(state.waveformCache);
          newCache.set(songId, waveform);
          return { waveformCache: newCache };
        });
      },

      getWaveformFromCache: (songId) => {
        return get().waveformCache.get(songId);
      },

      addMarker: (marker) => {
        set((state) => ({
          markers: [...state.markers, marker],
        }));
      },

      removeMarker: (markerId) => {
        set((state) => ({
          markers: state.markers.filter((m) => m.id !== markerId),
        }));
      },

      updateMarker: (markerId, updates) => {
        set((state) => ({
          markers: state.markers.map((m) => (m.id === markerId ? { ...m, ...updates } : m)),
        }));
      },

      getMarkersForSong: (songId) => {
        return get().markers.filter((m) => m.songId === songId);
      },

      setGenerating: (isGenerating, songId) => {
        set({
          isGenerating,
          generatingSongId: songId || null,
          generationProgress: isGenerating ? 0 : 0,
        });
      },

      setGenerationProgress: (progress) => {
        set({ generationProgress: Math.min(100, Math.max(0, progress)) });
      },

      setZoomLevel: (zoom) => {
        set({ zoomLevel: Math.max(1, Math.min(100, zoom)) });
      },

      setScrollPosition: (position) => {
        set({ scrollPosition: Math.max(0, position) });
      },

      setIsPlaying: (playing) => {
        set({ isPlaying: playing });
      },

      setCurrentTime: (time) => {
        set({ currentTime: Math.max(0, time) });
      },

      setShowMarkers: (show) => {
        set({ showMarkers: show });
      },

      setShowPeaks: (show) => {
        set({ showPeaks: show });
      },

      setShowRMS: (show) => {
        set({ showRMS: show });
      },

      setWaveformColor: (color) => {
        set({ waveformColor: color });
      },

      setBackgroundColor: (color) => {
        set({ backgroundColor: color });
      },

      clearCache: () => {
        set({ waveformCache: new Map() });
      },
    }),
    {
      name: "waveform-store-v5",
      partialize: (state) => ({
        markers: state.markers,
        zoomLevel: state.zoomLevel,
        showMarkers: state.showMarkers,
        showPeaks: state.showPeaks,
        showRMS: state.showRMS,
        waveformColor: state.waveformColor,
        backgroundColor: state.backgroundColor,
      }),
    }
  )
);
