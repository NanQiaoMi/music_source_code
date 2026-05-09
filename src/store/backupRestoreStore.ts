import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BackupType = "full" | "settings" | "playlists" | "library" | "lyrics";

export interface BackupItem {
  id: string;
  name: string;
  type: BackupType;
  createdAt: number;
  size: number;
  version: string;
  description?: string;
}

export interface BackupData {
  version: string;
  createdAt: number;
  type: BackupType;

  settings?: any;
  playlists?: any;
  library?: any;
  lyrics?: any;
  covers?: any;
  eqPresets?: any;
  themes?: any;
}

export interface BackupSchedule {
  id: string;
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  lastBackup?: number;
  nextBackup?: number;
  maxBackups: number;
  backupType: BackupType;
}

interface BackupRestoreState {
  backups: BackupItem[];
  currentBackup: BackupData | null;
  isBackingUp: boolean;
  isRestoring: boolean;
  backupProgress: number;
  restoreProgress: number;

  schedules: BackupSchedule[];

  createBackup: (type: BackupType, name?: string, description?: string) => Promise<BackupItem>;
  restoreBackup: (backupId: string) => Promise<void>;
  deleteBackup: (backupId: string) => void;
  downloadBackup: (backupId: string) => void;
  uploadBackup: (file: File) => Promise<BackupItem>;

  getBackupData: (backupId: string) => BackupData | null;
  exportBackup: (backupData: BackupData) => string;
  importBackup: (jsonString: string) => BackupData;

  addSchedule: (schedule: Omit<BackupSchedule, "id">) => void;
  updateSchedule: (id: string, updates: Partial<BackupSchedule>) => void;
  deleteSchedule: (id: string) => void;
  toggleSchedule: (id: string) => void;

  clearOldBackups: () => void;
  clearAllBackups: () => void;

  setIsBackingUp: (backingUp: boolean) => void;
  setIsRestoring: (restoring: boolean) => void;
  setBackupProgress: (progress: number) => void;
  setRestoreProgress: (progress: number) => void;
  setCurrentBackup: (backup: BackupData | null) => void;
}

function generateBackupId(): string {
  return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

function estimateBackupSize(data: BackupData): number {
  const jsonString = JSON.stringify(data);
  return new Blob([jsonString]).size;
}

export const useBackupRestoreStore = create<BackupRestoreState>()(
  persist(
    (set, get) => ({
      backups: [],
      currentBackup: null,
      isBackingUp: false,
      isRestoring: false,
      backupProgress: 0,
      restoreProgress: 0,
      schedules: [],

      createBackup: async (type, name, description) => {
        set({ isBackingUp: true, backupProgress: 0 });

        const backupId = generateBackupId();
        const createdAt = Date.now();
        const backupName = name || `备份_${formatDate(createdAt)}`;

        const backupData: BackupData = {
          version: "4.0.0",
          createdAt,
          type,
        };

        if (type === "full" || type === "settings") {
          backupData.settings = {
            audio: localStorage.getItem("audio-store-v4"),
            visual: localStorage.getItem("visual-settings-v4"),
            gesture: localStorage.getItem("gesture-store"),
            sleep: localStorage.getItem("sleep-timer-store"),
          };
        }

        set({ backupProgress: 25 });
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (type === "full" || type === "playlists") {
          backupData.playlists = {
            playlist: localStorage.getItem("playlist-store"),
            queue: localStorage.getItem("queue-store"),
            recommendation: localStorage.getItem("recommendation-store"),
          };
        }

        set({ backupProgress: 50 });
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (type === "full" || type === "library") {
          backupData.library = {
            library: localStorage.getItem("library-manager-store-v4"),
          };
        }

        set({ backupProgress: 75 });
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (type === "full" || type === "lyrics") {
          backupData.lyrics = localStorage.getItem("lyrics-cover-store-v4");
        }

        set({ backupProgress: 100 });
        await new Promise((resolve) => setTimeout(resolve, 100));

        const size = estimateBackupSize(backupData);

        const backupItem: BackupItem = {
          id: backupId,
          name: backupName,
          type,
          createdAt,
          size,
          version: "4.0.0",
          description,
        };

        // 保存备份数据到 localStorage 以便恢复时使用
        localStorage.setItem(`backup-data-${backupId}`, JSON.stringify(backupData));

        set((state) => ({
          backups: [...state.backups, backupItem],
          isBackingUp: false,
          backupProgress: 0,
        }));

        return backupItem;
      },

      restoreBackup: async (backupId) => {
        set({ isRestoring: true, restoreProgress: 0 });

        const { backups } = get();
        const backup = backups.find((b) => b.id === backupId);

        if (!backup) {
          set({ isRestoring: false, restoreProgress: 0 });
          return;
        }

        // 从 localStorage 获取备份数据
        const storedKey = `backup-data-${backupId}`;
        const storedData = localStorage.getItem(storedKey);
        if (!storedData) {
          set({ isRestoring: false, restoreProgress: 0 });
          return;
        }

        const backupData = JSON.parse(storedData) as BackupData;

        // 真实恢复各 store 的数据
        set({ restoreProgress: 25 });
        await new Promise((resolve) => setTimeout(resolve, 200));

        if (backupData.settings) {
          if (backupData.settings.audio) localStorage.setItem("audio-store-v4", backupData.settings.audio);
          if (backupData.settings.visual) localStorage.setItem("visual-settings-v4", backupData.settings.visual);
          if (backupData.settings.gesture) localStorage.setItem("gesture-store", backupData.settings.gesture);
          if (backupData.settings.sleep) localStorage.setItem("sleep-timer-store", backupData.settings.sleep);
        }

        set({ restoreProgress: 50 });
        await new Promise((resolve) => setTimeout(resolve, 200));

        if (backupData.playlists) {
          if (backupData.playlists.playlist) localStorage.setItem("playlist-store", backupData.playlists.playlist);
          if (backupData.playlists.queue) localStorage.setItem("queue-store", backupData.playlists.queue);
          if (backupData.playlists.recommendation) localStorage.setItem("recommendation-store", backupData.playlists.recommendation);
        }

        set({ restoreProgress: 75 });
        await new Promise((resolve) => setTimeout(resolve, 200));

        if (backupData.library) {
          if (backupData.library.library) localStorage.setItem("library-manager-store-v4", backupData.library.library);
        }

        if (backupData.lyrics) {
          localStorage.setItem("lyrics-cover-store-v4", backupData.lyrics);
        }

        set({ restoreProgress: 100 });
        await new Promise((resolve) => setTimeout(resolve, 200));

        set({ isRestoring: false, restoreProgress: 0 });
      },

      deleteBackup: (backupId) => {
        // 同时清除 localStorage 中保存的备份数据
        localStorage.removeItem(`backup-data-${backupId}`);
        set((state) => ({
          backups: state.backups.filter((b) => b.id !== backupId),
        }));
      },

      downloadBackup: (backupId) => {
        const { backups } = get();
        const backup = backups.find((b) => b.id === backupId);

        if (!backup) return;

        // 先从localStorage获取真实备份数据
        const storedKey = `backup-data-${backupId}`;
        const storedData = localStorage.getItem(storedKey);
        let backupData: BackupData;

        if (storedData) {
          backupData = JSON.parse(storedData) as BackupData;
        } else {
          // 降级：从各store读取真实数据
          backupData = {
            version: backup.version,
            createdAt: backup.createdAt,
            type: backup.type,
            settings: {
              audio: localStorage.getItem("audio-store-v4"),
              visual: localStorage.getItem("visual-settings-v4"),
              gesture: localStorage.getItem("gesture-store"),
              sleep: localStorage.getItem("sleep-timer-store"),
            },
            playlists: {
              playlist: localStorage.getItem("playlist-store"),
              queue: localStorage.getItem("queue-store"),
              recommendation: localStorage.getItem("recommendation-store"),
            },
            library: {
              library: localStorage.getItem("library-manager-store-v4"),
            },
            lyrics: localStorage.getItem("lyrics-cover-store-v4"),
          };
        }

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${backup.name}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },

      uploadBackup: async (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = (e) => {
            try {
              const jsonString = e.target?.result as string;
              const backupData = JSON.parse(jsonString) as BackupData;

              const backupId = generateBackupId();
              const backupItem: BackupItem = {
                id: backupId,
                name: file.name.replace(".json", ""),
                type: backupData.type,
                createdAt: backupData.createdAt,
                size: file.size,
                version: backupData.version,
              };

              // 保存上传的备份数据到 localStorage 以便恢复时使用
              localStorage.setItem(`backup-data-${backupId}`, JSON.stringify(backupData));

              set((state) => ({
                backups: [...state.backups, backupItem],
              }));

              resolve(backupItem);
            } catch (error) {
              reject(error);
            }
          };

          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });
      },

      getBackupData: (backupId) => {
        const { backups } = get();
        const backup = backups.find((b) => b.id === backupId);
        if (!backup) return null;

        return {
          version: backup.version,
          createdAt: backup.createdAt,
          type: backup.type,
        };
      },

      exportBackup: (backupData) => {
        return JSON.stringify(backupData, null, 2);
      },

      importBackup: (jsonString) => {
        return JSON.parse(jsonString) as BackupData;
      },

      addSchedule: (schedule) => {
        const id = `schedule-${Date.now()}`;
        set((state) => ({
          schedules: [...state.schedules, { ...schedule, id }],
        }));
      },

      updateSchedule: (id, updates) => {
        set((state) => ({
          schedules: state.schedules.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }));
      },

      deleteSchedule: (id) => {
        set((state) => ({
          schedules: state.schedules.filter((s) => s.id !== id),
        }));
      },

      toggleSchedule: (id) => {
        set((state) => ({
          schedules: state.schedules.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
        }));
      },

      clearOldBackups: () => {
        set((state) => ({
          backups: state.backups.slice(-10),
        }));
      },

      clearAllBackups: () => {
        set({ backups: [] });
      },

      setIsBackingUp: (backingUp) => set({ isBackingUp: backingUp }),
      setIsRestoring: (restoring) => set({ isRestoring: restoring }),
      setBackupProgress: (progress) => set({ backupProgress: progress }),
      setRestoreProgress: (progress) => set({ restoreProgress: progress }),
      setCurrentBackup: (backup) => set({ currentBackup: backup }),
    }),
    {
      name: "backup-restore-store-v4",
      partialize: (state) => ({
        backups: state.backups,
        schedules: state.schedules,
      }),
    }
  )
);
