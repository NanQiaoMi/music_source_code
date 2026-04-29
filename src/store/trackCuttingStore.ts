import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ParsedCUE } from "@/lib/audio/cueParser";

export interface CutTrack {
  trackNumber: number;
  title: string;
  performer: string;
  startTime: number;
  duration: number;
  selected: boolean;
  outputBlob?: Blob;
  status: "pending" | "cutting" | "completed" | "error";
  progress: number;
  error?: string;
}

export interface CuttingTask {
  id: string;
  sourceFileName: string;
  cueContent: string;
  parsedCUE: ParsedCUE | null;
  tracks: CutTrack[];
  status: "loading" | "ready" | "cutting" | "completed" | "error";
  totalProgress: number;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

export interface TrackCuttingSettings {
  outputFormat: "mp3" | "wav" | "flac" | "aac";
  bitrate: number;
  sampleRate: number;
  preserveMetadata: boolean;
  outputNaming: "title" | "number_title" | "number";
}

export interface TrackCuttingState {
  tasks: CuttingTask[];
  currentTaskId: string | null;
  settings: TrackCuttingSettings;
  totalCut: number;
  totalFailed: number;

  createTask: (sourceFileName: string, cueContent: string) => string;
  setCurrentTask: (taskId: string | null) => void;
  updateTaskStatus: (taskId: string, status: CuttingTask["status"], error?: string) => void;
  setParsedCUE: (taskId: string, parsedCUE: ParsedCUE) => void;
  toggleTrackSelection: (taskId: string, trackNumber: number) => void;
  selectAllTracks: (taskId: string) => void;
  deselectAllTracks: (taskId: string) => void;
  updateTrackProgress: (taskId: string, trackNumber: number, progress: number) => void;
  updateTrackStatus: (
    taskId: string,
    trackNumber: number,
    status: CutTrack["status"],
    outputBlob?: Blob,
    error?: string
  ) => void;
  setTaskProgress: (taskId: string, progress: number) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
  setSettings: (settings: Partial<TrackCuttingSettings>) => void;
  incrementCut: () => void;
  incrementFailed: () => void;
  resetStats: () => void;
  getCurrentTask: () => CuttingTask | null;
  getSelectedTracks: (taskId: string) => CutTrack[];
}

const defaultSettings: TrackCuttingSettings = {
  outputFormat: "mp3",
  bitrate: 320,
  sampleRate: 44100,
  preserveMetadata: true,
  outputNaming: "number_title",
};

export const useTrackCuttingStore = create<TrackCuttingState>()(
  persist(
    (set, get) => ({
      tasks: [],
      currentTaskId: null,
      settings: defaultSettings,
      totalCut: 0,
      totalFailed: 0,

      createTask: (sourceFileName: string, cueContent: string): string => {
        const id = `cut-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newTask: CuttingTask = {
          id,
          sourceFileName,
          cueContent,
          parsedCUE: null,
          tracks: [],
          status: "loading",
          totalProgress: 0,
          createdAt: Date.now(),
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
        return id;
      },

      setCurrentTask: (taskId: string | null) => set({ currentTaskId: taskId }),

      updateTaskStatus: (taskId: string, status: CuttingTask["status"], error?: string) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status,
                  error,
                  completedAt:
                    status === "completed" || status === "error" ? Date.now() : undefined,
                }
              : task
          ),
        })),

      setParsedCUE: (taskId: string, parsedCUE: ParsedCUE) =>
        set((state) => {
          const tracks: CutTrack[] = parsedCUE.tracks.map((track, index) => {
            const nextTrack = parsedCUE.tracks[index + 1];
            const startTime =
              track.indices.length > 0
                ? track.indices[0].minutes * 60 +
                  track.indices[0].seconds +
                  track.indices[0].frames / 75
                : 0;
            const endTime =
              nextTrack && nextTrack.indices.length > 0
                ? nextTrack.indices[0].minutes * 60 +
                  nextTrack.indices[0].seconds +
                  nextTrack.indices[0].frames / 75
                : startTime + 180;

            return {
              trackNumber: track.number,
              title: track.title || `Track ${track.number}`,
              performer: track.performer || parsedCUE.performer || "Unknown Artist",
              startTime,
              duration: endTime - startTime,
              selected: true,
              status: "pending",
              progress: 0,
            };
          });

          return {
            tasks: state.tasks.map((task) =>
              task.id === taskId ? { ...task, parsedCUE, tracks, status: "ready" as const } : task
            ),
          };
        }),

      toggleTrackSelection: (taskId: string, trackNumber: number) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  tracks: task.tracks.map((track) =>
                    track.trackNumber === trackNumber
                      ? { ...track, selected: !track.selected }
                      : track
                  ),
                }
              : task
          ),
        })),

      selectAllTracks: (taskId: string) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  tracks: task.tracks.map((track) => ({ ...track, selected: true })),
                }
              : task
          ),
        })),

      deselectAllTracks: (taskId: string) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  tracks: task.tracks.map((track) => ({ ...track, selected: false })),
                }
              : task
          ),
        })),

      updateTrackProgress: (taskId: string, trackNumber: number, progress: number) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  tracks: task.tracks.map((track) =>
                    track.trackNumber === trackNumber
                      ? { ...track, progress: Math.min(100, progress) }
                      : track
                  ),
                }
              : task
          ),
        })),

      updateTrackStatus: (
        taskId: string,
        trackNumber: number,
        status: CutTrack["status"],
        outputBlob?: Blob,
        error?: string
      ) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  tracks: task.tracks.map((track) =>
                    track.trackNumber === trackNumber
                      ? {
                          ...track,
                          status,
                          outputBlob,
                          error,
                          progress: status === "completed" ? 100 : track.progress,
                        }
                      : track
                  ),
                }
              : task
          ),
        })),

      setTaskProgress: (taskId: string, progress: number) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, totalProgress: Math.min(100, progress) } : task
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

      setSettings: (settings: Partial<TrackCuttingSettings>) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),

      incrementCut: () => set((state) => ({ totalCut: state.totalCut + 1 })),

      incrementFailed: () => set((state) => ({ totalFailed: state.totalFailed + 1 })),

      resetStats: () => set({ totalCut: 0, totalFailed: 0 }),

      getCurrentTask: () => {
        const state = get();
        return state.currentTaskId
          ? state.tasks.find((t) => t.id === state.currentTaskId) || null
          : null;
      },

      getSelectedTracks: (taskId: string) => {
        const state = get();
        const task = state.tasks.find((t) => t.id === taskId);
        return task ? task.tracks.filter((t) => t.selected) : [];
      },
    }),
    {
      name: "track-cutting-store-v5",
      partialize: (state) => ({
        settings: state.settings,
        totalCut: state.totalCut,
        totalFailed: state.totalFailed,
      }),
    }
  )
);
