// S6-12q: useOfflineDownloadStore 的公共类型层（零运行时依赖，仅 import type）。
// store 本体仍从此模块 re-export DownloadStatus / DownloadTask，导入方无需改动。
import type { Song } from "@/types/song";
import type { OfflineAudioRecord } from "@/services/localMusicStorage";

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

export interface OfflineDownloadState {
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
  clearAllTasks: () => void;
  clearFailedOrPausedTasks: () => void;

  // Offline Data Actions
  loadOfflineRecords: () => Promise<void>;
  deleteOfflineSong: (songId: string) => Promise<void>;
  clearAllOffline: () => Promise<void>;
  togglePinSong: (songId: string) => Promise<void>;
  isSongOffline: (songId: string) => boolean;

  // File Export Actions
  exportSongAsFile: (song: Song) => Promise<boolean>;
}
