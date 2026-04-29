import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface BPMInfo {
  songId: string;
  bpm: number;
  key?: string;
  confidence: number;
  timestamp: number;
}

export interface CrossfadePreset {
  id: string;
  name: string;
  duration: number;
  curveType: "linear" | "exponential" | "s-curve";
  autoBPM: boolean;
  minBPMDiff: number;
}

export interface CrossfadeSettings {
  enabled: boolean;
  duration: number;
  curveType: "linear" | "exponential" | "s-curve";
  autoBPM: boolean;
  minBPMDiff: number;
  volumeCompensation: boolean;
  preserveSpatial: boolean;
}

export interface CrossfadeQueueItem {
  id: string;
  fromSongId: string;
  toSongId: string;
  fromBPM: number;
  toBPM: number;
  bpmMatchScore: number;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  outputBlob?: Blob;
  error?: string;
}

export interface CrossfadeState {
  settings: CrossfadeSettings;
  bpmDatabase: BPMInfo[];
  queue: CrossfadeQueueItem[];
  currentTaskId: string | null;
  totalProcessed: number;
  presets: CrossfadePreset[];

  setSettings: (settings: Partial<CrossfadeSettings>) => void;
  addBPMInfo: (info: BPMInfo) => void;
  getBPMInfo: (songId: string) => BPMInfo | undefined;
  analyzeSongBPM: (songId: string, audioBlob: Blob) => Promise<BPMInfo>;
  addToQueue: (fromSongId: string, toSongId: string, fromBPM: number, toBPM: number) => void;
  removeFromQueue: (itemId: string) => void;
  clearQueue: () => void;
  setCurrentTask: (taskId: string | null) => void;
  updateQueueItemStatus: (
    itemId: string,
    status: CrossfadeQueueItem["status"],
    progress?: number,
    outputBlob?: Blob,
    error?: string
  ) => void;
  incrementProcessed: () => void;
  resetStats: () => void;

  getPresets: () => CrossfadePreset[];
  applyPreset: (presetId: string) => void;
  saveAsPreset: (name: string) => void;
  deletePreset: (presetId: string) => void;

  calculateBPMMatchScore: (bpm1: number, bpm2: number) => number;
  findCompatiblePairs: (
    songs: Array<{ id: string; bpm?: number }>
  ) => Array<{ from: string; to: string; score: number }>;
}

const defaultSettings: CrossfadeSettings = {
  enabled: true,
  duration: 5,
  curveType: "s-curve",
  autoBPM: true,
  minBPMDiff: 10,
  volumeCompensation: true,
  preserveSpatial: false,
};

const defaultPresets: CrossfadePreset[] = [
  {
    id: "smooth",
    name: "平滑过渡",
    duration: 8,
    curveType: "s-curve",
    autoBPM: true,
    minBPMDiff: 5,
  },
  {
    id: "quick",
    name: "快速切换",
    duration: 3,
    curveType: "linear",
    autoBPM: false,
    minBPMDiff: 20,
  },
  {
    id: "club",
    name: "Club 风格",
    duration: 16,
    curveType: "exponential",
    autoBPM: true,
    minBPMDiff: 2,
  },
  {
    id: "dj",
    name: "DJ 混音",
    duration: 12,
    curveType: "s-curve",
    autoBPM: true,
    minBPMDiff: 3,
  },
];

export const useCrossfadeStore = create<CrossfadeState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      bpmDatabase: [],
      queue: [],
      currentTaskId: null,
      totalProcessed: 0,
      presets: defaultPresets,

      setSettings: (newSettings: Partial<CrossfadeSettings>) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      addBPMInfo: (info: BPMInfo) =>
        set((state) => {
          const existing = state.bpmDatabase.findIndex((b) => b.songId === info.songId);
          if (existing >= 0) {
            const updated = [...state.bpmDatabase];
            updated[existing] = info;
            return { bpmDatabase: updated };
          }
          return { bpmDatabase: [...state.bpmDatabase, info] };
        }),

      getBPMInfo: (songId: string) => {
        const state = get();
        return state.bpmDatabase.find((b) => b.songId === songId);
      },

      analyzeSongBPM: async (songId: string, audioBlob: Blob): Promise<BPMInfo> => {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        const downsampleFactor = 4;
        const downsampledLength = Math.floor(channelData.length / downsampleFactor);
        const downsampled = new Float32Array(downsampledLength);

        for (let i = 0; i < downsampledLength; i++) {
          downsampled[i] = Math.abs(channelData[i * downsampleFactor]);
        }

        const windowSize = Math.floor(sampleRate / downsampleFactor);
        const hopSize = Math.floor(windowSize / 4);
        const numWindows = Math.floor((downsampled.length - windowSize) / hopSize);

        const onsetStrengths: number[] = [];

        for (let i = 0; i < numWindows; i++) {
          const start = i * hopSize;
          let energy = 0;
          let prevEnergy = i > 0 ? onsetStrengths[i - 1] : 0;

          for (let j = 0; j < windowSize; j++) {
            energy += downsampled[start + j] * downsampled[start + j];
          }
          energy /= windowSize;

          const onset = Math.max(0, energy - prevEnergy);
          onsetStrengths.push(onset);
        }

        const minBPM = 60;
        const maxBPM = 200;
        const minLag = Math.floor(((60 / maxBPM) * sampleRate) / downsampleFactor / hopSize);
        const maxLag = Math.floor(((60 / minBPM) * sampleRate) / downsampleFactor / hopSize);

        const correlations: number[] = new Array(maxLag - minLag).fill(0);

        for (let lag = minLag; lag < maxLag; lag++) {
          let correlation = 0;
          let norm1 = 0;
          let norm2 = 0;

          for (let i = 0; i < numWindows - lag; i++) {
            correlation += onsetStrengths[i] * onsetStrengths[i + lag];
            norm1 += onsetStrengths[i] * onsetStrengths[i];
            norm2 += onsetStrengths[i + lag] * onsetStrengths[i + lag];
          }

          correlations[lag - minLag] = correlation / (Math.sqrt(norm1 * norm2) + 1e-10);
        }

        let bestLag = minLag;
        let bestCorrelation = correlations[0];

        for (let i = 1; i < correlations.length; i++) {
          if (correlations[i] > bestCorrelation) {
            bestCorrelation = correlations[i];
            bestLag = i + minLag;
          }
        }

        const bestBPM = (60 * sampleRate) / downsampleFactor / hopSize / bestLag;
        const clampedBPM = Math.max(60, Math.min(200, bestBPM));
        const confidence = Math.min(1, bestCorrelation);

        audioContext.close();

        const bpmInfo: BPMInfo = {
          songId,
          bpm: clampedBPM,
          confidence,
          timestamp: Date.now(),
        };

        get().addBPMInfo(bpmInfo);

        return bpmInfo;
      },

      addToQueue: (fromSongId: string, toSongId: string, fromBPM: number, toBPM: number) =>
        set((state) => {
          const score = get().calculateBPMMatchScore(fromBPM, toBPM);
          const newItem: CrossfadeQueueItem = {
            id: `cf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fromSongId,
            toSongId,
            fromBPM,
            toBPM,
            bpmMatchScore: score,
            status: "pending",
            progress: 0,
          };
          return { queue: [...state.queue, newItem] };
        }),

      removeFromQueue: (itemId: string) =>
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== itemId),
        })),

      clearQueue: () => set({ queue: [] }),

      setCurrentTask: (taskId: string | null) => set({ currentTaskId: taskId }),

      updateQueueItemStatus: (
        itemId: string,
        status: CrossfadeQueueItem["status"],
        progress?: number,
        outputBlob?: Blob,
        error?: string
      ) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === itemId
              ? { ...item, status, progress: progress ?? item.progress, outputBlob, error }
              : item
          ),
        })),

      incrementProcessed: () => set((state) => ({ totalProcessed: state.totalProcessed + 1 })),

      resetStats: () => set({ totalProcessed: 0 }),

      getPresets: () => get().presets,

      applyPreset: (presetId: string) => {
        const preset = get().presets.find((p) => p.id === presetId);
        if (preset) {
          set({
            settings: {
              ...get().settings,
              duration: preset.duration,
              curveType: preset.curveType,
              autoBPM: preset.autoBPM,
              minBPMDiff: preset.minBPMDiff,
            },
          });
        }
      },

      saveAsPreset: (name: string) => {
        const settings = get().settings;
        const newPreset: CrossfadePreset = {
          id: `custom-${Date.now()}`,
          name,
          duration: settings.duration,
          curveType: settings.curveType,
          autoBPM: settings.autoBPM,
          minBPMDiff: settings.minBPMDiff,
        };
        set((state) => ({ presets: [...state.presets, newPreset] }));
      },

      deletePreset: (presetId: string) =>
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== presetId),
        })),

      calculateBPMMatchScore: (bpm1: number, bpm2: number): number => {
        const diff = Math.abs(bpm1 - bpm2);
        const ratio = Math.min(bpm1, bpm2) / Math.max(bpm1, bpm2);
        const beatRatio = Math.abs(1 - ratio);

        if (diff < 2) return 100;
        if (diff < 5) return 90;
        if (diff < 10) return 70;
        if (diff < 20) return 50;

        return Math.max(0, 30 - (diff - 20));
      },

      findCompatiblePairs: (songs: Array<{ id: string; bpm?: number }>) => {
        const state = get();
        const pairs: Array<{ from: string; to: string; score: number }> = [];

        for (let i = 0; i < songs.length; i++) {
          const song1 = songs[i];
          const bpm1 = state.getBPMInfo(song1.id)?.bpm || song1.bpm;
          if (!bpm1) continue;

          for (let j = i + 1; j < songs.length; j++) {
            const song2 = songs[j];
            const bpm2 = state.getBPMInfo(song2.id)?.bpm || song2.bpm;
            if (!bpm2) continue;

            const score = state.calculateBPMMatchScore(bpm1, bpm2);
            if (score >= 100 - state.settings.minBPMDiff) {
              pairs.push({ from: song1.id, to: song2.id, score });
            }
          }
        }

        return pairs.sort((a, b) => b.score - a.score);
      },
    }),
    {
      name: "crossfade-store-v5",
      partialize: (state) => ({
        settings: state.settings,
        bpmDatabase: state.bpmDatabase.slice(-100),
        presets: state.presets,
        totalProcessed: state.totalProcessed,
      }),
    }
  )
);
