// S6-12h: store-free backup types and pure helpers live here so
// backupRestoreStore.ts stays inside the 400-line store budget (scripts/check-store-budgets.mjs).
// The store re-exports the public backup types, so its public surface is unchanged.
//
// S1-2: the types below are schema-version agnostic. v4 bodies ({ version: "4.0.0", slots })
// and v5 bodies ({ schemaVersion: 5, entries }) share the same BackupItem/BackupPreview shape,
// which is what lets the panel render both. Payload parsing/preview live in ./preview.ts.

import type { BackupPayloadV5, RestoreReport } from "@/lib/storage/backupSchema";

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

/** Legacy v4 backup body shape. Kept so old downloaded backups stay readable. */
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

/** Anything the store can preview/import/export: a v5 payload or a legacy v4 body. */
export type AnyBackupData = BackupData | BackupPayloadV5;

export interface BackupPreview {
  schemaVersion: string;
  majorVersion: number;
  canRestore: boolean;
  includedStores: string[];
  /** Legacy-only slots that will be reported as unsupported instead of being written. */
  unsupportedStores?: string[];
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
  /** Per-key outcome of the last restore (S1-2: restored / skipped / failed). */
  restoreReport: RestoreReport | null;

  schedules: BackupSchedule[];

  createBackup: (type: BackupType, name?: string, description?: string) => Promise<BackupItem>;
  restoreBackup: (backupId: string) => Promise<void>;
  deleteBackup: (backupId: string) => void;
  downloadBackup: (backupId: string) => void;
  uploadBackup: (file: File) => Promise<BackupItem>;

  getBackupData: (backupId: string) => AnyBackupData | null;
  getBackupPreview: (backupId: string) => BackupPreview | null;
  previewBackupData: (backupData: AnyBackupData) => BackupPreview;
  exportBackup: (backupData: AnyBackupData) => string;
  importBackup: (jsonString: string) => AnyBackupData;

  addSchedule: (schedule: Omit<BackupSchedule, "id">) => void;
  updateSchedule: (id: string, updates: Partial<BackupSchedule>) => void;
  deleteSchedule: (id: string) => void;
  toggleSchedule: (id: string) => void;

  clearOldBackups: () => void;
  clearAllBackups: () => void;
  /** Drop `backup-data-*` bodies that no metadata item points at (S1-2 leak fix). */
  pruneOrphanBackupBodies: () => void;

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

/**
 * UTF-16 length of the serialized payload; matches what localStorage stores and what
 * createBackup reports as BackupItem.size (v5 payloads included).
 */
export function estimateBackupSize(data: unknown): number {
  return JSON.stringify(data).length;
}
