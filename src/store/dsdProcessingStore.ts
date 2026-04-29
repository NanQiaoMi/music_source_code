import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DSDRate = "dsd64" | "dsd128" | "dsd256" | "dsd512";
export type DSDOutputMode = "pcm" | "dop" | "native";
export type DSDQuality = "low" | "standard" | "high" | "ultra";

export interface DSDProcessingSettings {
  outputMode: DSDOutputMode;
  targetSampleRate: number;
  dsdQuality: DSDQuality;
  filterType: "sharp" | "slow" | "medium";
  volumeNormalization: boolean;
  dithering: boolean;
}

export interface DSDTask {
  id: string;
  songId: string;
  songTitle: string;
  sourceRate: DSDRate;
  targetRate: DSDRate;
  status: "pending" | "converting" | "completed" | "error";
  progress: number;
  outputBlob?: Blob;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface DSDInfo {
  isDSD: boolean;
  rate: DSDRate | null;
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

export interface DSDProcessingState {
  isEnabled: boolean;
  settings: DSDProcessingSettings;
  tasks: DSDTask[];
  currentTaskId: string | null;
  totalProcessed: number;
  totalFailed: number;

  setEnabled: (enabled: boolean) => void;
  setSettings: (settings: Partial<DSDProcessingSettings>) => void;
  addTask: (songId: string, songTitle: string, sourceRate: DSDRate, targetRate?: DSDRate) => void;
  updateTaskProgress: (taskId: string, progress: number) => void;
  updateTaskStatus: (
    taskId: string,
    status: DSDTask["status"],
    outputBlob?: Blob,
    error?: string
  ) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
  setCurrentTask: (taskId: string | null) => void;
  incrementProcessed: () => void;
  incrementFailed: () => void;
  resetStats: () => void;

  detectDSDRate: (fileSize: number, duration: number) => DSDRate;
  getDSDInfo: (song: { audioUrl?: string; format?: string }) => DSDInfo;
  getDefaultTargetRate: (sourceRate: DSDRate) => DSDRate;
}

const dsdRateToMHz: Record<DSDRate, number> = {
  dsd64: 2.8224,
  dsd128: 5.6448,
  dsd256: 11.2896,
  dsd512: 22.5792,
};

const dsdRateToSampleRate: Record<DSDRate, number> = {
  dsd64: 2822400,
  dsd128: 5644800,
  dsd256: 11289600,
  dsd512: 22579200,
};

const defaultSettings: DSDProcessingSettings = {
  outputMode: "pcm",
  targetSampleRate: 352800,
  dsdQuality: "high",
  filterType: "sharp",
  volumeNormalization: false,
  dithering: true,
};

export const useDSDProcessingStore = create<DSDProcessingState>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      settings: defaultSettings,
      tasks: [],
      currentTaskId: null,
      totalProcessed: 0,
      totalFailed: 0,

      setEnabled: (enabled: boolean) => set({ isEnabled: enabled }),

      setSettings: (settings: Partial<DSDProcessingSettings>) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),

      addTask: (songId: string, songTitle: string, sourceRate: DSDRate, targetRate?: DSDRate) =>
        set((state) => {
          const newTask: DSDTask = {
            id: `dsd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            songId,
            songTitle,
            sourceRate,
            targetRate: targetRate || get().getDefaultTargetRate(sourceRate),
            status: "pending",
            progress: 0,
            createdAt: Date.now(),
          };
          return { tasks: [...state.tasks, newTask] };
        }),

      updateTaskProgress: (taskId: string, progress: number) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, progress: Math.min(100, progress) } : task
          ),
        })),

      updateTaskStatus: (
        taskId: string,
        status: DSDTask["status"],
        outputBlob?: Blob,
        error?: string
      ) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status,
                  outputBlob,
                  error,
                  completedAt:
                    status === "completed" || status === "error" ? Date.now() : undefined,
                }
              : task
          ),
        })),

      removeTask: (taskId: string) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== taskId),
        })),

      clearCompletedTasks: () =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.status !== "completed"),
        })),

      setCurrentTask: (taskId: string | null) => set({ currentTaskId: taskId }),

      incrementProcessed: () => set((state) => ({ totalProcessed: state.totalProcessed + 1 })),

      incrementFailed: () => set((state) => ({ totalFailed: state.totalFailed + 1 })),

      resetStats: () => set({ totalProcessed: 0, totalFailed: 0 }),

      detectDSDRate: (fileSize: number, duration: number): DSDRate => {
        const bitsPerSecond = (fileSize * 8) / duration;
        let closestRate: DSDRate = "dsd64";
        let minDiff = Infinity;

        for (const [rate, mhz] of Object.entries(dsdRateToMHz)) {
          const diff = Math.abs(bitsPerSecond - mhz * 1000000);
          if (diff < minDiff) {
            minDiff = diff;
            closestRate = rate as DSDRate;
          }
        }

        return closestRate;
      },

      getDSDInfo: (song: { audioUrl?: string; format?: string }): DSDInfo => {
        const format = song.format?.toLowerCase() || "";
        const isDSD = format.includes("dsd") || format.includes("dsf") || format.includes("dff");

        if (!isDSD) {
          return {
            isDSD: false,
            rate: null,
            sampleRate: 0,
            channels: 2,
            bitDepth: 16,
          };
        }

        return {
          isDSD: true,
          rate: "dsd64",
          sampleRate: 2822400,
          channels: 2,
          bitDepth: 1,
        };
      },

      getDefaultTargetRate: (sourceRate: DSDRate): DSDRate => {
        const rateOrder: DSDRate[] = ["dsd64", "dsd128", "dsd256", "dsd512"];
        const currentIndex = rateOrder.indexOf(sourceRate);
        if (currentIndex >= rateOrder.length - 1) {
          return sourceRate;
        }
        return rateOrder[currentIndex + 1];
      },
    }),
    {
      name: "dsd-processing-store-v5",
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        settings: state.settings,
        totalProcessed: state.totalProcessed,
        totalFailed: state.totalFailed,
      }),
    }
  )
);

export const getDSDRateFromFormat = (format: string): DSDRate | null => {
  const lowerFormat = format.toLowerCase();
  if (lowerFormat.includes("dsd64") || lowerFormat.includes("dsf64")) return "dsd64";
  if (lowerFormat.includes("dsd128") || lowerFormat.includes("dsf128")) return "dsd128";
  if (lowerFormat.includes("dsd256") || lowerFormat.includes("dsf256")) return "dsd256";
  if (lowerFormat.includes("dsd512") || lowerFormat.includes("dsf512")) return "dsd512";
  return null;
};

export const getSampleRateFromDSDRate = (rate: DSDRate): number => {
  return dsdRateToSampleRate[rate];
};

export const formatDSDRate = (rate: DSDRate): string => {
  const mhz = dsdRateToMHz[rate];
  if (mhz >= 22) return `${mhz} MHz (DSD512)`;
  if (mhz >= 11) return `${mhz} MHz (DSD256)`;
  if (mhz >= 5) return `${mhz} MHz (DSD128)`;
  return `${mhz} MHz (DSD64)`;
};
