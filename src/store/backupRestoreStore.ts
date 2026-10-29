// S1-2: backup/restore store on the v5 schema (real registry keys) with legacy v4 reading.
// Types + pure helpers live in ./backup/helpers.ts and ./backup/preview.ts so this file stays
// inside its store-line ratchet (perf/store-line-baseline.json via scripts/check-store-budgets.mjs).
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  formatDate,
  generateBackupId,
  type AnyBackupData,
  type BackupItem,
  type BackupRestoreState,
} from "./backup/helpers";
import { createBackupPreview, isV5Payload, parseAnyBackupData } from "./backup/preview";
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
} from "@/lib/storage/backupSchema";
import { rehydrateRegisteredStores } from "@/lib/storage/rehydrateRegisteredStores";

export type {
  AnyBackupData,
  BackupData,
  BackupItem,
  BackupPreview,
  BackupSchedule,
  BackupType,
} from "./backup/helpers";

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
            data = parseAnyBackupData(stored);
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
              const data = parseAnyBackupData(jsonString);
              const backupId = generateBackupId();
              const createdAt = data.createdAt;
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
          return parseAnyBackupData(stored);
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

      importBackup: (jsonString) => parseAnyBackupData(jsonString),

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
      skipHydration: true,
      name: "backup-restore-store-v4",
      partialize: (state) => ({ backups: state.backups, schedules: state.schedules }),
    }
  )
);
