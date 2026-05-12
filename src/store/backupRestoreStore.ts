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

  settings?: unknown;
  playlists?: unknown;
  library?: unknown;
  lyrics?: unknown;
  covers?: unknown;
  eqPresets?: unknown;
  themes?: unknown;
}

export interface BackupPreview {
  schemaVersion: string;
  majorVersion: number;
  canRestore: boolean;
  includedStores: string[];
  type: BackupType;
  createdAt: number;
  size: number;
  error?: string;
}

interface StoredSettingsBackup {
  audio?: string | null;
  visual?: string | null;
  gesture?: string | null;
  sleep?: string | null;
}

interface StoredPlaylistsBackup {
  playlist?: string | null;
  queue?: string | null;
  recommendation?: string | null;
}

interface StoredLibraryBackup {
  library?: string | null;
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
  restoreError: string | null;

  schedules: BackupSchedule[];

  createBackup: (type: BackupType, name?: string, description?: string) => Promise<BackupItem>;
  restoreBackup: (backupId: string) => Promise<void>;
  deleteBackup: (backupId: string) => void;
  downloadBackup: (backupId: string) => void;
  uploadBackup: (file: File) => Promise<BackupItem>;

  getBackupData: (backupId: string) => BackupData | null;
  getBackupPreview: (backupId: string) => BackupPreview | null;
  previewBackupData: (backupData: BackupData) => BackupPreview;
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

const CURRENT_BACKUP_MAJOR_VERSION = 4;

function getMajorVersion(version: string): number {
  return Number.parseInt(version.split(".")[0] || "0", 10);
}

function assertSupportedBackupVersion(version: string): void {
  const majorVersion = getMajorVersion(version);
  if (!Number.isFinite(majorVersion) || majorVersion > CURRENT_BACKUP_MAJOR_VERSION) {
    throw new Error(`Unsupported backup schema version: ${version}`);
  }
}

function getIncludedStores(data: BackupData): string[] {
  const stores: string[] = [];

  if (data.settings) {
    stores.push("audio-store-v4", "visual-settings-v4", "gesture-store", "sleep-timer-store");
  }

  if (data.playlists) {
    stores.push("playlist-store", "queue-store", "recommendation-store");
  }

  if (data.library) {
    stores.push("library-manager-store-v4");
  }

  if (data.lyrics) {
    stores.push("lyrics-cover-store-v4");
  }

  if (data.covers) {
    stores.push("covers");
  }

  if (data.eqPresets) {
    stores.push("eq-presets");
  }

  if (data.themes) {
    stores.push("themes");
  }

  return Array.from(new Set(stores));
}

function createBackupPreview(data: BackupData): BackupPreview {
  const majorVersion = getMajorVersion(data.version);
  const canRestore = Number.isFinite(majorVersion) && majorVersion <= CURRENT_BACKUP_MAJOR_VERSION;

  return {
    schemaVersion: data.version,
    majorVersion,
    canRestore,
    includedStores: getIncludedStores(data),
    type: data.type,
    createdAt: data.createdAt,
    size: estimateBackupSize(data),
    error: canRestore ? undefined : `Unsupported backup schema version: ${data.version}`,
  };
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
      restoreError: null,
      schedules: [],

      createBackup: async (type, name, description) => {
        set({ isBackingUp: true, backupProgress: 0, restoreError: null });

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
        set({ isRestoring: true, restoreProgress: 0, restoreError: null });

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
        try {
          assertSupportedBackupVersion(backupData.version);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unsupported backup schema";
          set({ isRestoring: false, restoreProgress: 0, restoreError: message });
          throw error;
        }

        // 真实恢复各 store 的数据
        set({ restoreProgress: 25 });
        await new Promise((resolve) => setTimeout(resolve, 200));

        if (backupData.settings) {
          const settings = backupData.settings as StoredSettingsBackup;
          if (settings.audio) localStorage.setItem("audio-store-v4", settings.audio);
          if (settings.visual) localStorage.setItem("visual-settings-v4", settings.visual);
          if (settings.gesture) localStorage.setItem("gesture-store", settings.gesture);
          if (settings.sleep) localStorage.setItem("sleep-timer-store", settings.sleep);
        }

        set({ restoreProgress: 50 });
        await new Promise((resolve) => setTimeout(resolve, 200));

        if (backupData.playlists) {
          const playlists = backupData.playlists as StoredPlaylistsBackup;
          if (playlists.playlist) localStorage.setItem("playlist-store", playlists.playlist);
          if (playlists.queue) localStorage.setItem("queue-store", playlists.queue);
          if (playlists.recommendation)
            localStorage.setItem("recommendation-store", playlists.recommendation);
        }

        set({ restoreProgress: 75 });
        await new Promise((resolve) => setTimeout(resolve, 200));

        if (backupData.library) {
          const library = backupData.library as StoredLibraryBackup;
          if (library.library) localStorage.setItem("library-manager-store-v4", library.library);
        }

        if (typeof backupData.lyrics === "string") {
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

        const storedData = localStorage.getItem(`backup-data-${backupId}`);
        if (storedData) {
          return JSON.parse(storedData) as BackupData;
        }

        return {
          version: backup.version,
          createdAt: backup.createdAt,
          type: backup.type,
        };
      },

      getBackupPreview: (backupId) => {
        const backupData = get().getBackupData(backupId);
        return backupData ? createBackupPreview(backupData) : null;
      },

      previewBackupData: (backupData) => createBackupPreview(backupData),

      exportBackup: (backupData) => {
        return JSON.stringify(backupData, null, 2);
      },

      importBackup: (jsonString) => {
        const backupData = JSON.parse(jsonString) as BackupData;
        assertSupportedBackupVersion(backupData.version);
        return backupData;
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
