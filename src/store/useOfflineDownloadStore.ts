// S6-12q: store 本体只保留状态与 action 编排；类型在 ./offlineDownload/types.ts，
// 纯函数/默认值/中止句柄表在 ./offlineDownload/helpers.ts，
// 下载队列执行器在 ./offlineDownload/downloadPipeline.ts。
// 公共类型仍从此处 re-export；本 store 原本未使用 persist 中间件，迁移后保持不变。
import { create } from "zustand";
import {
  saveOfflineAudio,
  getOfflineAudio,
  getAllOfflineAudios,
  deleteOfflineAudio,
  clearAllOfflineAudios,
} from "@/services/localMusicStorage";
import { multiSourceResolver } from "@/services/MultiSourceResolver";
import { abortControllers, createInitialOfflineDownloadState } from "./offlineDownload/helpers";
import { createDownloadPipeline } from "./offlineDownload/downloadPipeline";
import type { DownloadTask, OfflineDownloadState } from "./offlineDownload/types";

export type { DownloadStatus, DownloadTask } from "./offlineDownload/types";

export const useOfflineDownloadStore = create<OfflineDownloadState>((set, get, api) => {
  const { processQueue } = createDownloadPipeline(set, get, api);

  return {
    ...createInitialOfflineDownloadState(),

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

    clearAllTasks: () => {
      Object.keys(abortControllers).forEach((id) => {
        try {
          abortControllers[id]?.abort();
        } catch {
          // 已完成/不存在的下载任务 abort 失败可忽略
        }
        delete abortControllers[id];
      });
      set({ tasks: {}, activeCount: 0 });
    },

    clearFailedOrPausedTasks: () => {
      set((state) => {
        const next: Record<string, DownloadTask> = {};
        Object.entries(state.tasks).forEach(([id, t]) => {
          if (t.status === "downloading" || t.status === "pending") {
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

        // 静默后台分批并发为缺失歌词的历史离线歌曲补全 LRC 歌词与翻译歌词
        const missingLyricsRecords = records.filter((r) => !r.lyrics);
        if (missingLyricsRecords.length > 0) {
          setTimeout(async () => {
            let updatedCount = 0;
            const CHUNK_SIZE = 5;
            for (let i = 0; i < missingLyricsRecords.length; i += CHUNK_SIZE) {
              const chunk = missingLyricsRecords.slice(i, i + CHUNK_SIZE);
              await Promise.all(
                chunk.map(async (rec) => {
                  try {
                    const lrcRes = await multiSourceResolver.fetchOnlineLyrics(
                      rec.songId,
                      rec.source || "netease",
                      {
                        id: rec.songId,
                        title: rec.title,
                        artist: rec.artist,
                        album: rec.album,
                      }
                    );
                    if (lrcRes && lrcRes.lyrics) {
                      rec.lyrics = lrcRes.lyrics;
                      rec.translationLyrics = lrcRes.translationLyrics;
                      await saveOfflineAudio(rec);
                      updatedCount++;
                    }
                  } catch {
                    // 离线歌词回写失败不影响本次播放
                  }
                })
              );
            }
            if (updatedCount > 0) {
              const refreshed = await getAllOfflineAudios();
              set({ offlineRecords: refreshed });
              console.info(
                `[useOfflineDownloadStore] ✨ 已自动为 ${updatedCount} 首历史离线歌曲静默补全并固化 LRC 歌词！`
              );
            }
          }, 300);
        }
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
