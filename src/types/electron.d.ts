/* eslint-disable @typescript-eslint/no-explicit-any */
export interface BackendStatus {
  status: "disabled" | "external" | "starting" | "ready" | "stopping" | "error";
  baseUrl: string | null;
  error: string | null;
}

export interface ElectronAPI {
  toggleDesktopLyrics: () => Promise<boolean>;
  isDesktopLyricsOpen: () => Promise<boolean>;
  updateLyrics: (lyrics: any) => Promise<void>;
  updateSongInfo: (songInfo: { title: string; artist: string }) => Promise<void>;
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>;
  saveEmotions: (
    data: Record<string, { x: number; y: number }>
  ) => Promise<{ success: boolean; error?: string }>;
  loadEmotions: () => Promise<Record<string, { x: number; y: number }>>;
  toggleFullscreen: () => Promise<boolean>;
  getBackendStatus: () => Promise<BackendStatus>;
  // Plugin System
  searchPlugins: (query: string, page?: number, type?: string) => Promise<any[]>;
  getMediaSource: (musicItem: any, quality?: string) => Promise<any>;
  getLyric: (musicItem: any) => Promise<any>;
  listPlugins: () => Promise<any[]>;
  loadPlugins: () => Promise<any[]>;
  onTogglePlay: (callback: () => void) => void;
  onPrevSong: (callback: () => void) => void;
  onNextSong: (callback: () => void) => void;
  onUpdateLyrics: (callback: (lyrics: any) => void) => void;
  onUpdateSongInfo: (callback: (songInfo: { title: string; artist: string }) => void) => void;
  removeAllListeners: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    isDesktopLyricsMode?: boolean;
  }
}

export {};
