import { create } from "zustand";
import { Song } from "@/types/song";
import {
  saveOfflineAudio,
  getOfflineAudio,
  getAllOfflineAudios,
  deleteOfflineAudio,
  clearAllOfflineAudios,
  OfflineAudioRecord,
} from "@/services/localMusicStorage";

export type DownloadStatus =
  | "pending"
  | "downloading"
  | "transcoding"
  | "completed"
  | "error"
  | "paused";

export interface DownloadTask {
  id: string; // songId
  song: Song;
  status: DownloadStatus;
  progress: number; // 0..100
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes/sec
  speedFormatted: string;
  error?: string;
  quality: string;
  addedAt: number;
  completedAt?: number;
}

interface OfflineDownloadState {
  tasks: Record<string, DownloadTask>;
  activeCount: number;
  concurrencyLimit: number;
  totalSpeed: number;
  totalSpeedFormatted: string;
  offlineRecords: OfflineAudioRecord[];
  offlineSongIds: Set<string>;
  isLoadingRecords: boolean;

  // Configuration
  setConcurrency: (limit: number) => void;

  // Task Actions
  addDownload: (song: Song, quality?: string) => Promise<void>;
  addBatchDownloads: (songs: Song[], quality?: string) => Promise<void>;
  pauseDownload: (songId: string) => void;
  resumeDownload: (songId: string) => void;
  cancelDownload: (songId: string) => void;
  pauseAll: () => void;
  resumeAll: () => void;
  clearCompleted: () => void;

  // Offline Data Actions
  loadOfflineRecords: () => Promise<void>;
  deleteOfflineSong: (songId: string) => Promise<void>;
  clearAllOffline: () => Promise<void>;
  togglePinSong: (songId: string) => Promise<void>;
  isSongOffline: (songId: string) => boolean;

  // File Export Actions
  exportSongAsFile: (song: Song) => Promise<boolean>;
}

const formatSpeed = (bytesPerSec: number): string => {
  if (bytesPerSec <= 0) return "0 KB/s";
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
};

const resolveApiUrl = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return `http://localhost:3025${path}`;
};

// Global active download abort controllers
const abortControllers: Record<string, AbortController> = {};

export const useOfflineDownloadStore = create<OfflineDownloadState>((set, get) => {
  // Internal queue runner
  const processQueue = async () => {
    const { tasks, activeCount, concurrencyLimit } = get();
    if (activeCount >= concurrencyLimit) return;

    const pendingTasks = Object.values(tasks).filter((t) => t.status === "pending");
    if (pendingTasks.length === 0) return;

    const availableSlots = concurrencyLimit - activeCount;
    const toStart = pendingTasks.slice(0, availableSlots);

    for (const task of toStart) {
      startSingleDownload(task.id);
    }
  };

  const startSingleDownload = async (songId: string) => {
    const task = get().tasks[songId];
    if (!task) return;

    // Check if already downloaded
    const existing = await getOfflineAudio(songId);
    if (existing && existing.fileData && existing.fileData.byteLength > 1000) {
      set((state) => ({
        tasks: {
          ...state.tasks,
          [songId]: {
            ...task,
            status: "completed",
            progress: 100,
            completedAt: Date.now(),
          },
        },
        offlineSongIds: new Set([...state.offlineSongIds, String(songId)]),
      }));
      await get().loadOfflineRecords();
      return;
    }

    const controller = new AbortController();
    abortControllers[songId] = controller;

    set((state) => ({
      tasks: {
        ...state.tasks,
        [songId]: {
          ...task,
          status: "downloading",
          progress: 0,
          error: undefined,
        },
      },
      activeCount: state.activeCount + 1,
    }));

    try {
      const song = task.song;
      let targetUrl = song.audioUrl || "";

      // 1. If no direct audio url, resolve through backend api
      if (!targetUrl || targetUrl.startsWith("http://localhost:3000/placeholder")) {
        const qualityParam = task.quality || "lossless";
        const queryParams = new URLSearchParams({
          id: String(song.id),
          name: song.title,
          artist: song.artist,
          album: song.album || "",
          quality: qualityParam,
        });

        const res = await fetch(resolveApiUrl(`/api/song/url?${queryParams.toString()}`), {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`解析音频直链失败: ${res.status}`);
        }

        const data = await res.json();
        if (!data.url) {
          throw new Error("未能获取到有效高品质音源直链");
        }
        targetUrl = data.url;
      }

      // Proxy external audio url to bypass CORS
      const fetchUrl = targetUrl.startsWith("http")
        ? resolveApiUrl(`/api/audio/proxy?url=${encodeURIComponent(targetUrl)}`)
        : resolveApiUrl(targetUrl);

      const audioResponse = await fetch(fetchUrl, {
        signal: controller.signal,
      });

      if (!audioResponse.ok) {
        throw new Error(`音频流下载失败 HTTP ${audioResponse.status}`);
      }

      const contentLengthHeader = audioResponse.headers.get("content-length");
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
      const contentType = audioResponse.headers.get("content-type") || "audio/mpeg";

      if (!audioResponse.body) {
        const arrayBuf = await audioResponse.arrayBuffer();
        await finalizeDownload(song, arrayBuf, contentType, task.quality);
        return;
      }

      const reader = audioResponse.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      let lastSpeedCalcTime = Date.now();
      let bytesSinceLastCalc = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          bytesSinceLastCalc += value.length;

          const now = Date.now();
          const timeDiff = (now - lastSpeedCalcTime) / 1000;

          if (timeDiff >= 0.3) {
            const currentSpeed = bytesSinceLastCalc / timeDiff;
            const progress = totalBytes > 0 ? Math.min(99, (receivedBytes / totalBytes) * 100) : 50;

            set((state) => {
              const currentTask = state.tasks[songId];
              if (!currentTask) return state;
              return {
                tasks: {
                  ...state.tasks,
                  [songId]: {
                    ...currentTask,
                    progress,
                    downloadedBytes: receivedBytes,
                    totalBytes: totalBytes || receivedBytes,
                    speed: currentSpeed,
                    speedFormatted: formatSpeed(currentSpeed),
                  },
                },
              };
            });

            lastSpeedCalcTime = now;
            bytesSinceLastCalc = 0;
          }
        }
      }

      // Merge chunks into single ArrayBuffer
      const combined = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      await finalizeDownload(song, combined.buffer, contentType, task.quality);
    } catch (err: any) {
      if (err.name === "AbortError") {
        set((state) => ({
          tasks: {
            ...state.tasks,
            [songId]: {
              ...state.tasks[songId],
              status: "paused",
              speed: 0,
              speedFormatted: "已暂停",
            },
          },
          activeCount: Math.max(0, state.activeCount - 1),
        }));
      } else {
        console.error(`Download failed for ${songId}:`, err);
        set((state) => ({
          tasks: {
            ...state.tasks,
            [songId]: {
              ...state.tasks[songId],
              status: "error",
              error: err.message || "下载失败",
              speed: 0,
              speedFormatted: "错误",
            },
          },
          activeCount: Math.max(0, state.activeCount - 1),
        }));
      }
    } finally {
      delete abortControllers[songId];
      // Process next in queue
      setTimeout(processQueue, 50);
    }
  };

  const finalizeDownload = async (
    song: Song,
    fileData: ArrayBuffer,
    mimeType: string,
    quality: string
  ) => {
    const songId = String(song.id);
    const record: OfflineAudioRecord = {
      id: songId,
      songId: songId,
      title: song.title || "未知曲目",
      artist: song.artist || "未知艺术家",
      album: song.album || "云端下载",
      duration: song.duration || 0,
      cover: song.cover,
      lyrics: song.lyrics,
      source: song.source || "online",
      quality: quality || "lossless",
      mimeType: mimeType || "audio/mpeg",
      fileData,
      fileSize: fileData.byteLength,
      downloadedAt: Date.now(),
      lastPlayedAt: Date.now(),
      isPinned: false,
    };

    await saveOfflineAudio(record);

    set((state) => ({
      tasks: {
        ...state.tasks,
        [songId]: {
          ...state.tasks[songId],
          status: "completed",
          progress: 100,
          downloadedBytes: fileData.byteLength,
          totalBytes: fileData.byteLength,
          speed: 0,
          speedFormatted: "已完成",
          completedAt: Date.now(),
        },
      },
      activeCount: Math.max(0, state.activeCount - 1),
      offlineSongIds: new Set([...state.offlineSongIds, songId]),
    }));

    await get().loadOfflineRecords();
  };

  return {
    tasks: {},
    activeCount: 0,
    concurrencyLimit: 3,
    totalSpeed: 0,
    totalSpeedFormatted: "0 KB/s",
    offlineRecords: [],
    offlineSongIds: new Set<string>(),
    isLoadingRecords: false,

    setConcurrency: (limit) => {
      set({ concurrencyLimit: Math.max(1, Math.min(5, limit)) });
      processQueue();
    },

    addDownload: async (song, quality = "lossless") => {
      const songId = String(song.id);
      const existing = get().tasks[songId];
      if (existing && existing.status === "completed") return;

      const newTask: DownloadTask = {
        id: songId,
        song,
        status: "pending",
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        speedFormatted: "等待排队",
        quality,
        addedAt: Date.now(),
      };

      set((state) => ({
        tasks: {
          ...state.tasks,
          [songId]: newTask,
        },
      }));

      processQueue();
    },

    addBatchDownloads: async (songs, quality = "lossless") => {
      const { tasks, offlineSongIds } = get();
      const nextTasks = { ...tasks };

      for (const song of songs) {
        const songId = String(song.id);
        if (offlineSongIds.has(songId)) continue;
        if (nextTasks[songId]?.status === "completed") continue;

        nextTasks[songId] = {
          id: songId,
          song,
          status: "pending",
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          speedFormatted: "等待排队",
          quality,
          addedAt: Date.now(),
        };
      }

      set({ tasks: nextTasks });
      processQueue();
    },

    pauseDownload: (songId) => {
      if (abortControllers[songId]) {
        abortControllers[songId].abort();
      }
      set((state) => {
        const t = state.tasks[songId];
        if (!t) return state;
        return {
          tasks: {
            ...state.tasks,
            [songId]: { ...t, status: "paused", speed: 0, speedFormatted: "已暂停" },
          },
          activeCount: Math.max(0, state.activeCount - 1),
        };
      });
      processQueue();
    },

    resumeDownload: (songId) => {
      set((state) => {
        const t = state.tasks[songId];
        if (!t) return state;
        return {
          tasks: {
            ...state.tasks,
            [songId]: { ...t, status: "pending", speed: 0, speedFormatted: "排队中" },
          },
        };
      });
      processQueue();
    },

    cancelDownload: (songId) => {
      if (abortControllers[songId]) {
        abortControllers[songId].abort();
      }
      set((state) => {
        const next = { ...state.tasks };
        delete next[songId];
        return {
          tasks: next,
          activeCount: Math.max(0, state.activeCount - 1),
        };
      });
      processQueue();
    },

    pauseAll: () => {
      Object.keys(abortControllers).forEach((id) => {
        abortControllers[id]?.abort();
      });
      set((state) => {
        const updated: Record<string, DownloadTask> = {};
        Object.entries(state.tasks).forEach(([id, t]) => {
          if (t.status === "downloading" || t.status === "pending") {
            updated[id] = { ...t, status: "paused", speed: 0, speedFormatted: "已暂停" };
          } else {
            updated[id] = t;
          }
        });
        return { tasks: updated, activeCount: 0 };
      });
    },

    resumeAll: () => {
      set((state) => {
        const updated: Record<string, DownloadTask> = {};
        Object.entries(state.tasks).forEach(([id, t]) => {
          if (t.status === "paused" || t.status === "error") {
            updated[id] = { ...t, status: "pending", speed: 0, speedFormatted: "排队中" };
          } else {
            updated[id] = t;
          }
        });
        return { tasks: updated };
      });
      processQueue();
    },

    clearCompleted: () => {
      set((state) => {
        const next: Record<string, DownloadTask> = {};
        Object.entries(state.tasks).forEach(([id, t]) => {
          if (t.status !== "completed") {
            next[id] = t;
          }
        });
        return { tasks: next };
      });
    },

    loadOfflineRecords: async () => {
      set({ isLoadingRecords: true });
      try {
        const records = await getAllOfflineAudios();
        const ids = new Set(records.map((r) => String(r.songId)));
        set({ offlineRecords: records, offlineSongIds: ids, isLoadingRecords: false });
      } catch (err) {
        console.error("Failed to load offline records:", err);
        set({ isLoadingRecords: false });
      }
    },

    deleteOfflineSong: async (songId) => {
      try {
        await deleteOfflineAudio(songId);
        set((state) => {
          const nextIds = new Set(state.offlineSongIds);
          nextIds.delete(String(songId));
          return {
            offlineRecords: state.offlineRecords.filter((r) => String(r.songId) !== String(songId)),
            offlineSongIds: nextIds,
          };
        });
      } catch (e) {
        console.error("Failed to delete offline song:", e);
      }
    },

    clearAllOffline: async () => {
      try {
        await clearAllOfflineAudios();
        set({ offlineRecords: [], offlineSongIds: new Set() });
      } catch (e) {
        console.error("Failed to clear all offline songs:", e);
      }
    },

    togglePinSong: async (songId) => {
      const record = await getOfflineAudio(songId);
      if (!record) return;
      record.isPinned = !record.isPinned;
      await saveOfflineAudio(record);
      await get().loadOfflineRecords();
    },

    isSongOffline: (songId) => {
      return get().offlineSongIds.has(String(songId));
    },

    exportSongAsFile: async (song) => {
      const songId = String(song.id);
      const record = await getOfflineAudio(songId);
      if (!record || !record.fileData) return false;

      try {
        const ext = record.quality === "lossless" || record.quality === "hires" ? "flac" : "mp3";
        const filename = `${song.artist || "未知歌手"} - ${song.title || "未知曲目"}.${ext}`;
        const blob = new Blob([record.fileData], { type: record.mimeType || "audio/mpeg" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
      } catch (e) {
        console.error("Export file failed:", e);
        return false;
      }
    },
  };
});
