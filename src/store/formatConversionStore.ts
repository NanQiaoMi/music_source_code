import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ConversionTask {
  id: string;
  songId: string;
  songTitle: string;
  songArtist: string;
  sourcePath: string;
  sourceFormat: string;
  targetFormat: string;
  status: "pending" | "converting" | "completed" | "error";
  progress: number;
  error?: string;
  outputPath?: string;
  outputBlob?: Blob;
  createdAt: number;
  completedAt?: number;
}

export interface ConversionSettings {
  targetFormat: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
  preserveMetadata: boolean;
}

export interface FormatConversionState {
  tasks: ConversionTask[];
  isConverting: boolean;
  currentTaskId: string | null;
  settings: ConversionSettings;
  totalConverted: number;
  totalFailed: number;

  setSettings: (settings: Partial<ConversionSettings>) => void;
  addConversionTask: (
    songId: string,
    songTitle: string,
    songArtist: string,
    sourcePath: string,
    sourceFormat: string,
    targetFormat?: string
  ) => void;
  addConversionTasks: (
    songs: Array<{ id: string; title: string; artist: string; path: string; format: string }>,
    targetFormat?: string
  ) => void;
  updateTaskProgress: (taskId: string, progress: number) => void;
  updateTaskStatus: (
    taskId: string,
    status: ConversionTask["status"],
    error?: string,
    outputBlob?: Blob
  ) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
  clearAllTasks: () => void;
  setCurrentTask: (taskId: string | null) => void;
  setIsConverting: (isConverting: boolean) => void;
  incrementConverted: () => void;
  incrementFailed: () => void;
  resetStats: () => void;
  getPendingTasks: () => ConversionTask[];
  getCompletedTasks: () => ConversionTask[];
  getFailedTasks: () => ConversionTask[];
}

const defaultSettings: ConversionSettings = {
  targetFormat: "mp3",
  bitrate: 320,
  sampleRate: 44100,
  channels: 2,
  preserveMetadata: true,
};

export const useFormatConversionStore = create<FormatConversionState>()(
  persist(
    (set, get) => ({
      tasks: [],
      isConverting: false,
      currentTaskId: null,
      settings: defaultSettings,
      totalConverted: 0,
      totalFailed: 0,

      setSettings: (settings: Partial<ConversionSettings>) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),

      addConversionTask: (
        songId: string,
        songTitle: string,
        songArtist: string,
        sourcePath: string,
        sourceFormat: string,
        targetFormat?: string
      ) =>
        set((state) => {
          const newTask: ConversionTask = {
            id: `conversion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            songId,
            songTitle,
            songArtist,
            sourcePath,
            sourceFormat,
            targetFormat: targetFormat || state.settings.targetFormat,
            status: "pending",
            progress: 0,
            createdAt: Date.now(),
          };
          return { tasks: [...state.tasks, newTask] };
        }),

      addConversionTasks: (
        songs: Array<{
          id: string;
          title: string;
          artist: string;
          path: string;
          format: string;
        }>,
        targetFormat?: string
      ) =>
        set((state) => {
          const newTasks: ConversionTask[] = songs.map((song) => ({
            id: `conversion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            songId: song.id,
            songTitle: song.title,
            songArtist: song.artist,
            sourcePath: song.path,
            sourceFormat: song.format,
            targetFormat: targetFormat || state.settings.targetFormat,
            status: "pending",
            progress: 0,
            createdAt: Date.now(),
          }));
          return { tasks: [...state.tasks, ...newTasks] };
        }),

      updateTaskProgress: (taskId: string, progress: number) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, progress: Math.min(100, progress) } : task
          ),
        })),

      updateTaskStatus: (
        taskId: string,
        status: ConversionTask["status"],
        error?: string,
        outputBlob?: Blob
      ) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status,
                  error,
                  outputBlob,
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

      clearAllTasks: () =>
        set({
          tasks: [],
          currentTaskId: null,
          isConverting: false,
        }),

      setCurrentTask: (taskId: string | null) => set({ currentTaskId: taskId }),

      setIsConverting: (isConverting: boolean) => set({ isConverting }),

      incrementConverted: () => set((state) => ({ totalConverted: state.totalConverted + 1 })),

      incrementFailed: () => set((state) => ({ totalFailed: state.totalFailed + 1 })),

      resetStats: () => set({ totalConverted: 0, totalFailed: 0 }),

      getPendingTasks: () => {
        const state = get();
        return state.tasks.filter((task) => task.status === "pending");
      },

      getCompletedTasks: () => {
        const state = get();
        return state.tasks.filter((task) => task.status === "completed");
      },

      getFailedTasks: () => {
        const state = get();
        return state.tasks.filter((task) => task.status === "error");
      },
    }),
    {
      name: "format-conversion-store-v5",
      partialize: (state) => ({
        settings: state.settings,
        totalConverted: state.totalConverted,
        totalFailed: state.totalFailed,
      }),
    }
  )
);
