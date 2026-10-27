import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BACKUP_SCHEMA_VERSION_STRING,
  RESTORE_ROLLBACK_KEY,
  createBackupV5,
  isLegacyV4Backup,
  keysForBackupType,
  migrateBackupV4,
  parseBackupV5,
  restoreBackupV5,
  snapshotRestoreRollback,
  type BackupPayloadV5,
  type BackupTypeV5,
  type RestoreReport,
} from "@/lib/storage/backupSchema";
import { rehydrateRegisteredStores } from "@/lib/storage/rehydrateRegisteredStores";

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
  pruneOrphanBackupBodies: () => void;

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

/** UTF-16 length of the serialized payload; matches what localStorage stores. */
function estimateBackupSize(data: AnyBackupData): number {
  return JSON.stringify(data).length;
}

function getMajorVersion(version: unknown): number {
  if (typeof version !== "string") return 0;
  const major = Number.parseInt(version.split(".")[0] || "0", 10);
  return Number.isFinite(major) ? major : 0;
}

function isV5Payload(value: unknown): value is BackupPayloadV5 {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as BackupPayloadV5).schemaVersion === 5 &&
    Array.isArray((value as BackupPayloadV5).entries)
  );
}

/** Legacy v4 slot names -> real keys, used only for preview copy (restore uses migration map). */
const LEGACY_PREVIEW_KEYS: Readonly<Record<string, readonly string[]>> = {
  settings: ["audio-store-v4", "visual-settings-v4", "gesture-store", "sleep-timer-store"],
  playlists: ["playlist-store", "playlist-group-store-v1", "queue-store", "recommendation-store"],
  library: ["library-manager-store-v4"],
  lyrics: ["lyrics-cover-store-v4"],
};

function getLegacyIncludedStores(data: BackupData): string[] {
  const stores: string[] = [];
  for (const [slot, keys] of Object.entries(LEGACY_PREVIEW_KEYS)) {
    if (data[slot as keyof BackupData]) stores.push(...keys);
  }
  if (data.covers) stores.push("covers");
  if (data.eqPresets) stores.push("eq-presets");
  if (data.themes) stores.push("themes");
  return Array.from(new Set(stores));
}

function hasSlot(value: unknown, slot: string): boolean {
  if (typeof value !== "object" || value === null) return false;
  return Boolean((value as Record<string, unknown>)[slot]);
}

function getLegacyUnsupportedStores(data: BackupData): string[] {
  const unsupported: string[] = [];
  if (hasSlot(data.settings, "sleep")) unsupported.push("sleep-timer-store");
  if (hasSlot(data.playlists, "playlist")) unsupported.push("playlist-store");
  return unsupported;
}

function createBackupPreview(data: AnyBackupData): BackupPreview {
  if (isV5Payload(data)) {
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION_STRING,
      majorVersion: 5,
      canRestore: true,
      includedStores: data.entries.map((entry) => entry.key),
      unsupportedStores: [],
      type: data.type,
      createdAt: data.createdAt,
      size: estimateBackupSize(data),
    };
  }
  const legacy = data as BackupData;
  const majorVersion = getMajorVersion(legacy.version);
  const canRestore = majorVersion === 4;
  return {
    schemaVersion: legacy.version,
    majorVersion,
    canRestore,
    includedStores: getLegacyIncludedStores(legacy),
    unsupportedStores: getLegacyUnsupportedStores(legacy),
    type: legacy.type,
    createdAt: legacy.createdAt,
    size: estimateBackupSize(legacy),
    error: canRestore ? undefined : `Unsupported backup schema version: ${legacy.version}`,
  };
}

/**
 * Parse a stored backup body into v5 or legacy v4. Throws for unknown/corrupt versions so
 * callers can surface a concrete restore error.
 */
function parseAnyBackup(raw: string): AnyBackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("备份数据不是有效的 JSON");
  }
  const v5 = parseBackupV5(raw);
  if (v5.ok) return v5.value;
  if (v5.reason === "unsupported-version") {
    throw new Error("不支持的备份版本（高于当前 schema）");
  }
  if (isLegacyV4Backup(parsed)) return parsed as BackupData;
  if (typeof parsed === "object" && parsed !== null && "schemaVersion" in parsed) {
    throw new Error("不支持的备份 schemaVersion");
  }
  const major = getMajorVersion((parsed as { version?: unknown } | null)?.version);
  if (major > 0 && major !== 4) {
    throw new Error("不支持的备份版本: " + String((parsed as { version?: unknown }).version));
  }
  throw new Error("无法识别的备份格式");
}

function backupBodyKey(backupId: string): string {
  return `backup-data-${backupId}`;
}

function removeBackupBodies(ids: readonly string[]): void {
  for (const id of ids) localStorage.removeItem(backupBodyKey(id));
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
      restoreReport: null,
      schedules: [],

      createBackup: async (type, name, description) => {
        set({ isBackingUp: true, backupProgress: 0, restoreError: null, restoreReport: null });
        const backupId = generateBackupId();
        const createdAt = Date.now();
        const backupName = name || `备份_${formatDate(createdAt)}`;
        const type5 = type as BackupTypeV5;
        const payload = createBackupV5(localStorage, keysForBackupType(type5), type5, createdAt);
        set({ backupProgress: 50 });
        const serialized = JSON.stringify(payload);
        localStorage.setItem(backupBodyKey(backupId), serialized);
        const backupItem: BackupItem = {
          id: backupId,
          name: backupName,
          type,
          createdAt,
          size: serialized.length,
          version: BACKUP_SCHEMA_VERSION_STRING,
          description,
        };
        set((state) => ({
          backups: [...state.backups, backupItem],
          isBackingUp: false,
          backupProgress: 100,
        }));
        get().pruneOrphanBackupBodies();
        return backupItem;
      },

      restoreBackup: async (backupId) => {
        set({ isRestoring: true, restoreProgress: 0, restoreError: null, restoreReport: null });
        const backup = get().backups.find((item) => item.id === backupId);
        if (!backup) {
          set({ isRestoring: false, restoreProgress: 0, restoreError: "找不到备份记录" });
          return;
        }
        const stored = localStorage.getItem(backupBodyKey(backupId));
        if (!stored) {
          set({ isRestoring: false, restoreProgress: 0, restoreError: "备份数据已丢失" });
          return;
        }

        let payload: BackupPayloadV5;
        let migratedUnsupported: string[] = [];
        try {
          const rawParsed: unknown = JSON.parse(stored);
          const parsedV5 = parseBackupV5(stored);
          if (parsedV5.ok) {
            payload = parsedV5.value;
          } else if (isLegacyV4Backup(rawParsed)) {
            const migration = migrateBackupV4(rawParsed);
            payload = migration.payload;
            migratedUnsupported = migration.unsupported;
          } else {
            throw new Error("不支持的备份版本");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "备份解析失败";
          set({ isRestoring: false, restoreProgress: 0, restoreError: message });
          return;
        }

        const keys = payload.entries.map((entry) => entry.key);
        const rollback = snapshotRestoreRollback(localStorage, keys);
        try {
          sessionStorage.setItem(RESTORE_ROLLBACK_KEY, JSON.stringify(rollback));
        } catch {
          // sessionStorage 不可用时放弃一键回滚，不阻塞恢复
        }

        set({ restoreProgress: 40 });
        const report = restoreBackupV5(payload, localStorage);
        for (const key of migratedUnsupported) {
          report.skipped.push({ key, reason: "unsupported" });
        }

        set({ restoreProgress: 80 });
        if (report.restored.length > 0) {
          const rehydrate = await rehydrateRegisteredStores(report.restored);
          for (const key of rehydrate.failed) {
            report.failed.push({ key, reason: "rehydrate-failed" });
          }
        }

        const failureMessage =
          report.failed.length > 0
            ? `恢复未完全成功：${report.failed.map((item) => item.key).join(", ")}`
            : null;
        set({
          isRestoring: false,
          restoreProgress: 0,
          restoreError: failureMessage,
          restoreReport: report,
        });
      },

      deleteBackup: (backupId) => {
        removeBackupBodies([backupId]);
        set((state) => ({ backups: state.backups.filter((b) => b.id !== backupId) }));
      },

      downloadBackup: (backupId) => {
        const backup = get().backups.find((item) => item.id === backupId);
        if (!backup) return;
        const stored = localStorage.getItem(backupBodyKey(backupId));
        let data: AnyBackupData;
        if (stored) {
          try {
            data = parseAnyBackup(stored);
          } catch {
            data = createBackupV5(localStorage, keysForBackupType(backup.type), backup.type);
          }
        } else {
          data = createBackupV5(localStorage, keysForBackupType(backup.type), backup.type);
        }
        const jsonString = JSON.stringify(data, null, 2);
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
          reader.onload = (event) => {
            try {
              const jsonString = event.target?.result as string;
              const data = parseAnyBackup(jsonString);
              const backupId = generateBackupId();
              const createdAt = isV5Payload(data) ? data.createdAt : data.createdAt;
              const version = isV5Payload(data) ? BACKUP_SCHEMA_VERSION_STRING : data.version;
              const backupItem: BackupItem = {
                id: backupId,
                name: file.name.replace(".json", ""),
                type: data.type,
                createdAt,
                size: file.size,
                version,
              };
              localStorage.setItem(backupBodyKey(backupId), JSON.stringify(data));
              set((state) => ({ backups: [...state.backups, backupItem] }));
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
        const backup = get().backups.find((item) => item.id === backupId);
        if (!backup) return null;
        const stored = localStorage.getItem(backupBodyKey(backupId));
        if (!stored)
          return { version: backup.version, createdAt: backup.createdAt, type: backup.type };
        try {
          return parseAnyBackup(stored);
        } catch {
          return { version: backup.version, createdAt: backup.createdAt, type: backup.type };
        }
      },

      getBackupPreview: (backupId) => {
        const backupData = get().getBackupData(backupId);
        return backupData ? createBackupPreview(backupData) : null;
      },

      previewBackupData: (backupData) => createBackupPreview(backupData),

      exportBackup: (backupData) => JSON.stringify(backupData, null, 2),

      importBackup: (jsonString) => parseAnyBackup(jsonString),

      addSchedule: (schedule) => {
        const id = `schedule-${Date.now()}`;
        set((state) => ({ schedules: [...state.schedules, { ...schedule, id }] }));
      },

      updateSchedule: (id, updates) => {
        set((state) => ({
          schedules: state.schedules.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }));
      },

      deleteSchedule: (id) => {
        set((state) => ({ schedules: state.schedules.filter((s) => s.id !== id) }));
      },

      toggleSchedule: (id) => {
        set((state) => ({
          schedules: state.schedules.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
        }));
      },

      clearOldBackups: () => {
        const { backups } = get();
        const kept = backups.slice(-10);
        const removed = backups.slice(0, Math.max(0, backups.length - 10));
        removeBackupBodies(removed.map((item) => item.id));
        set({ backups: kept });
        get().pruneOrphanBackupBodies();
      },

      clearAllBackups: () => {
        removeBackupBodies(get().backups.map((item) => item.id));
        set({ backups: [] });
        get().pruneOrphanBackupBodies();
      },

      pruneOrphanBackupBodies: () => {
        const liveKeys = new Set(get().backups.map((item) => backupBodyKey(item.id)));
        const orphans: string[] = [];
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (key && key.startsWith("backup-data-") && !liveKeys.has(key)) orphans.push(key);
        }
        for (const key of orphans) localStorage.removeItem(key);
      },

      setIsBackingUp: (backingUp) => set({ isBackingUp: backingUp }),
      setIsRestoring: (restoring) => set({ isRestoring: restoring }),
      setBackupProgress: (progress) => set({ backupProgress: progress }),
      setRestoreProgress: (progress) => set({ restoreProgress: progress }),
      setCurrentBackup: (backup) => set({ currentBackup: backup }),
    }),
    {
      name: "backup-restore-store-v4",
      partialize: (state) => ({ backups: state.backups, schedules: state.schedules }),
    }
  )
);
