// S6-12h: store-free backup types and pure helpers live here so
// backupRestoreStore.ts stays inside the 400-line store budget (scripts/check-store-budgets.mjs).
// The store re-exports the public backup types, so its public surface is unchanged.

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

export interface StoredSettingsBackup {
  audio?: string | null;
  visual?: string | null;
  gesture?: string | null;
  sleep?: string | null;
}

export interface StoredPlaylistsBackup {
  playlist?: string | null;
  playlistGroups?: string | null;
  queue?: string | null;
  recommendation?: string | null;
}

export interface StoredLibraryBackup {
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

export interface BackupRestoreState {
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

export function generateBackupId(): string {
  return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

export function estimateBackupSize(data: BackupData): number {
  const jsonString = JSON.stringify(data);
  return new Blob([jsonString]).size;
}

const CURRENT_BACKUP_MAJOR_VERSION = 4;

function getMajorVersion(version: string): number {
  return Number.parseInt(version.split(".")[0] || "0", 10);
}

export function assertSupportedBackupVersion(version: string): void {
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
    stores.push("playlist-store", "playlist-group-store-v1", "queue-store", "recommendation-store");
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

export function createBackupPreview(data: BackupData): BackupPreview {
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
