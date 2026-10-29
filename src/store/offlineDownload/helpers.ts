// S6-12q: useOfflineDownloadStore 的零 Zustand / 服务 / IDB 依赖层：
// 速度格式化、API URL 解析、全局中止句柄表与初始默认值；store 仅保留状态与 action 编排。
import type { StateCreator } from "zustand";
import type { OfflineDownloadState } from "./types";

export const formatSpeed = (bytesPerSec: number): string => {
  if (bytesPerSec <= 0) return "0 KB/s";
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
};

export const resolveApiUrl = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return `http://localhost:3025${path}`;
};

// Global active download abort controllers
export const abortControllers: Record<string, AbortController> = {};

export type OfflineDownloadSliceCreator<T> = StateCreator<OfflineDownloadState, [], [], T>;

export type OfflineDownloadDefaults = Pick<
  OfflineDownloadState,
  | "tasks"
  | "activeCount"
  | "concurrencyLimit"
  | "totalSpeed"
  | "totalSpeedFormatted"
  | "offlineRecords"
  | "offlineSongIds"
  | "isLoadingRecords"
>;

export function createInitialOfflineDownloadState(): OfflineDownloadDefaults {
  return {
    tasks: {},
    activeCount: 0,
    concurrencyLimit: 3,
    totalSpeed: 0,
    totalSpeedFormatted: "0 KB/s",
    offlineRecords: [],
    offlineSongIds: new Set<string>(),
    isLoadingRecords: false,
  };
}
