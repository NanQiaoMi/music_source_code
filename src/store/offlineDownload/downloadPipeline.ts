// S6-12q: 下载队列执行器（原 useOfflineDownloadStore 内联实现）整体迁出，逻辑逐字保留；
// 仅通过注入的 set / get 读写 store，互相递归与 setTimeout 调度顺序均与迁移前一致。
import { multiSourceResolver } from "@/services/MultiSourceResolver";
import {
  saveOfflineAudio,
  getOfflineAudio,
  type OfflineAudioRecord,
} from "@/services/localMusicStorage";
import type { Song } from "@/types/song";
import {
  abortControllers,
  formatSpeed,
  resolveApiUrl,
  type OfflineDownloadSliceCreator,
} from "./helpers";

export interface DownloadPipeline {
  processQueue: () => Promise<void>;
  startSingleDownload: (songId: string) => Promise<void>;
}

export const createDownloadPipeline: OfflineDownloadSliceCreator<DownloadPipeline> = (set, get) => {
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
      let targetUrl = "";

      // 1. 优先使用 MultiSourceResolver 解析全网可用母带/高品质 CDN 直链
      try {
        const resolved = await multiSourceResolver.resolvePlayableAudio({
          id: String(song.id),
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          source: song.source || "netease",
        });
        if (resolved && resolved.url) {
          targetUrl = resolved.url;
        }
      } catch (e) {
        console.warn("[OfflineDownload] multiSourceResolver resolve failed:", e);
      }

      // 2. 次选：如果歌曲对象带有合法非占位直链
      if (
        !targetUrl &&
        song.audioUrl &&
        !song.audioUrl.includes("/placeholder") &&
        !song.audioUrl.includes("outer/url?id=")
      ) {
        targetUrl = song.audioUrl;
      }

      // 3. 第三层保底：调用 /api/song/url
      if (!targetUrl || targetUrl.includes("/placeholder") || targetUrl.includes("outer/url?id=")) {
        const qualityParam = task.quality || "lossless";
        const queryParams = new URLSearchParams({
          id: String(song.id),
          name: song.title,
          artist: song.artist,
          album: song.album || "",
          quality: qualityParam,
        });

        try {
          const res = await fetch(resolveApiUrl(`/api/song/url?${queryParams.toString()}`), {
            signal: controller.signal,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              targetUrl = data.url;
            }
          }
        } catch (e) {
          console.warn("[OfflineDownload] /api/song/url resolve failed:", e);
        }
      }

      // 4. 最终回退
      if (!targetUrl && song.audioUrl) {
        targetUrl = song.audioUrl;
      }

      if (!targetUrl) {
        throw new Error("未能获取到有效音源直链，请检查平台登录或开启扩展源");
      }

      // 尝试直连拉取音频流，失败时降级走音频代理
      let audioResponse: Response;
      try {
        audioResponse = await fetch(targetUrl, {
          signal: controller.signal,
        });
        if (!audioResponse.ok) {
          throw new Error(`Direct fetch HTTP ${audioResponse.status}`);
        }
      } catch {
        const fetchUrl = targetUrl.startsWith("http")
          ? resolveApiUrl(`/api/audio/proxy?url=${encodeURIComponent(targetUrl)}`)
          : resolveApiUrl(targetUrl);

        audioResponse = await fetch(fetchUrl, {
          signal: controller.signal,
        });
      }

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

      for (;;) {
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
    } catch (err) {
      const abortLike = err as { name?: string };
      if (abortLike.name === "AbortError") {
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
              error: err instanceof Error && err.message ? err.message : "下载失败",
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

    // 优先拉取并固化高品质 LRC 歌词与翻译歌词
    let lrc = song.lyrics;
    let transLrc = song.translationLyrics;
    if (!lrc && (song.id || song.title)) {
      try {
        const lrcRes = await multiSourceResolver.fetchOnlineLyrics(
          String(song.id),
          song.source || "netease",
          {
            id: String(song.id),
            title: song.title,
            artist: song.artist,
            album: song.album,
          }
        );
        if (lrcRes && lrcRes.lyrics) {
          lrc = lrcRes.lyrics;
          transLrc = lrcRes.translationLyrics;
        }
      } catch (e) {
        console.warn("[OfflineDownload] Failed to fetch lyrics during download:", e);
      }
    }

    const record: OfflineAudioRecord = {
      id: songId,
      songId: songId,
      title: song.title || "未知曲目",
      artist: song.artist || "未知艺术家",
      album: song.album || "云端下载",
      duration: song.duration || 0,
      cover: song.cover,
      lyrics: lrc,
      translationLyrics: transLrc,
      format: song.format,
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

  return { processQueue, startSingleDownload };
};
