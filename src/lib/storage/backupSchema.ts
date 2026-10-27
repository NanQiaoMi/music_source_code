import { BACKUP_KEYS, getStorageEntry, type StorageGroup } from "./storageRegistry";

export const BACKUP_SCHEMA_VERSION = 5;
export const BACKUP_SCHEMA_VERSION_STRING = "5.0.0";
export const RESTORE_ROLLBACK_KEY = "mimi:restore-rollback";

export type BackupTypeV5 = "full" | "settings" | "playlists" | "library" | "lyrics";

export interface BackupEntryV5 {
  key: string;
  version: number;
  group: StorageGroup;
  payload: string;
}

export interface BackupPayloadV5 {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  createdAt: number;
  type: BackupTypeV5;
  entries: BackupEntryV5[];
}

export type RestoreSkipReason = "missing" | "corrupt" | "unsupported";

export interface RestoreSkip {
  key: string;
  reason: RestoreSkipReason;
}

export interface RestoreFailure {
  key: string;
  reason: string;
}

export interface RestoreReport {
  restored: string[];
  skipped: RestoreSkip[];
  failed: RestoreFailure[];
}

export interface MigrationResult {
  payload: BackupPayloadV5;
  unsupported: string[];
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const BACKUP_TYPE_KEYS: Record<BackupTypeV5, readonly string[]> = {
  full: BACKUP_KEYS,
  settings: ["audio-store-v4", "visual-settings-v4", "mimi-gesture-settings-v1"],
  playlists: ["playlist-group-store-v1", "queue-store-v5", "recommendation-storage"],
  library: ["library-manager-store-v4"],
  lyrics: ["lyrics-cover-store-v4"],
};

const LEGACY_V4_ENTRIES: ReadonlyArray<{ slot: readonly string[]; key: string }> = [
  { slot: ["settings", "audio"], key: "audio-store-v4" },
  { slot: ["settings", "visual"], key: "visual-settings-v4" },
  { slot: ["settings", "gesture"], key: "mimi-gesture-settings-v1" },
  { slot: ["playlists", "playlistGroups"], key: "playlist-group-store-v1" },
  { slot: ["playlists", "queue"], key: "queue-store-v5" },
  { slot: ["playlists", "recommendation"], key: "recommendation-storage" },
  { slot: ["library", "library"], key: "library-manager-store-v4" },
  { slot: ["lyrics"], key: "lyrics-cover-store-v4" },
];

const LEGACY_V4_DEAD_SLOTS: ReadonlyArray<{ slot: readonly string[]; legacyKey: string }> = [
  { slot: ["settings", "sleep"], legacyKey: "sleep-timer-store" },
  { slot: ["playlists", "playlist"], legacyKey: "playlist-store" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(source: unknown, path: readonly string[]): unknown {
  let current: unknown = source;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function getMajorVersion(version: unknown): number {
  if (typeof version !== "string") return 0;
  const major = Number.parseInt(version.split(".")[0] || "0", 10);
  return Number.isFinite(major) ? major : 0;
}

export function keysForBackupType(type: BackupTypeV5): readonly string[] {
  return BACKUP_TYPE_KEYS[type] ?? BACKUP_KEYS;
}

/** Collect a v5 backup from a Storage-like target. Missing keys are skipped. */
export function createBackupV5(
  source: StorageLike,
  keys: readonly string[],
  type: BackupTypeV5,
  createdAt: number = Date.now()
): BackupPayloadV5 {
  const entries: BackupEntryV5[] = [];
  for (const key of keys) {
    const registryEntry = getStorageEntry(key);
    if (!registryEntry) continue;
    const payload = source.getItem(key);
    if (payload === null || payload === undefined) continue;
    entries.push({
      key,
      version: registryEntry.version,
      group: registryEntry.group,
      payload,
    });
  }
  return { schemaVersion: BACKUP_SCHEMA_VERSION, createdAt, type, entries };
}

export type ParseBackupV5Result =
  | { ok: true; value: BackupPayloadV5 }
  | { ok: false; reason: "invalid-json" | "not-v5" | "invalid-shape" | "unsupported-version" };

export function parseBackupV5(raw: string): ParseBackupV5Result {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  if (!isRecord(parsed)) return { ok: false, reason: "invalid-shape" };
  if ("schemaVersion" in parsed) {
    const version = parsed.schemaVersion;
    if (typeof version === "number" && version > BACKUP_SCHEMA_VERSION) {
      return { ok: false, reason: "unsupported-version" };
    }
    if (version !== BACKUP_SCHEMA_VERSION) return { ok: false, reason: "not-v5" };
  } else {
    return { ok: false, reason: "not-v5" };
  }
  if (
    typeof parsed.createdAt !== "number" ||
    typeof parsed.type !== "string" ||
    !Array.isArray(parsed.entries)
  ) {
    return { ok: false, reason: "invalid-shape" };
  }
  const entries: BackupEntryV5[] = [];
  for (const candidate of parsed.entries) {
    if (
      !isRecord(candidate) ||
      typeof candidate.key !== "string" ||
      typeof candidate.payload !== "string" ||
      typeof candidate.version !== "number" ||
      typeof candidate.group !== "string"
    ) {
      return { ok: false, reason: "invalid-shape" };
    }
    entries.push({
      key: candidate.key,
      version: candidate.version,
      group: candidate.group as StorageGroup,
      payload: candidate.payload,
    });
  }
  return {
    ok: true,
    value: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: parsed.createdAt,
      type: parsed.type as BackupTypeV5,
      entries,
    },
  };
}

/** True when a legacy v4 payload (no schemaVersion, version major <= 4) is present. */
export function isLegacyV4Backup(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if ("schemaVersion" in value) return false;
  const major = getMajorVersion(value.version);
  return major === 4;
}

/**
 * Map a legacy v4 backup into v5 entries.
 * Only key renames are performed; field-level migrations belong to the owning store.
 */
export function migrateBackupV4(legacy: unknown): MigrationResult {
  if (!isRecord(legacy)) throw new Error("Invalid legacy backup payload");
  const major = getMajorVersion(legacy.version);
  if (major !== 4) throw new Error("Unsupported legacy backup version: " + String(legacy.version));

  const entries: BackupEntryV5[] = [];
  for (const mapping of LEGACY_V4_ENTRIES) {
    const raw = readPath(legacy, mapping.slot);
    if (typeof raw !== "string" || raw.length === 0) continue;
    const registryEntry = getStorageEntry(mapping.key);
    if (!registryEntry) continue;
    entries.push({
      key: mapping.key,
      version: registryEntry.version,
      group: registryEntry.group,
      payload: raw,
    });
  }

  const type: BackupTypeV5 =
    typeof legacy.type === "string" && legacy.type in BACKUP_TYPE_KEYS
      ? (legacy.type as BackupTypeV5)
      : "full";
  const createdAt = typeof legacy.createdAt === "number" ? legacy.createdAt : Date.now();
  return {
    payload: {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt,
      type,
      entries,
    },
    unsupported: LEGACY_V4_DEAD_SLOTS.map((dead) => dead.legacyKey),
  };
}

function validateEntryPayload(payload: string): "ok" | "corrupt" {
  try {
    const parsed = JSON.parse(payload);
    if (!isRecord(parsed)) return "corrupt";
    if (!("state" in parsed)) return "corrupt";
    return "ok";
  } catch {
    return "corrupt";
  }
}

/**
 * Restore a v5 payload atomically: every entry is validated before the first write.
 * Unknown registry keys are reported as unsupported and skipped; corrupt payloads abort
 * the whole restore (no partial writes).
 */
export function restoreBackupV5(payload: BackupPayloadV5, target: StorageLike): RestoreReport {
  const report: RestoreReport = { restored: [], skipped: [], failed: [] };
  const writes: Array<{ key: string; payload: string }> = [];

  for (const entry of payload.entries) {
    const registryEntry = getStorageEntry(entry.key);
    if (!registryEntry) {
      report.skipped.push({ key: entry.key, reason: "unsupported" });
      continue;
    }
    if (validateEntryPayload(entry.payload) !== "ok") {
      report.failed.push({ key: entry.key, reason: "corrupt-payload" });
      continue;
    }
    writes.push({ key: entry.key, payload: entry.payload });
  }

  if (report.failed.length > 0) {
    return report;
  }

  for (const write of writes) {
    try {
      target.setItem(write.key, write.payload);
      report.restored.push(write.key);
    } catch (error) {
      report.failed.push({
        key: write.key,
        reason: error instanceof Error ? error.message : "write-failed",
      });
      break;
    }
  }

  return report;
}

export function snapshotRestoreRollback(
  target: StorageLike,
  keys: readonly string[]
): Record<string, string | null> {
  const snapshot: Record<string, string | null> = {};
  for (const key of keys) {
    snapshot[key] = target.getItem(key);
  }
  return snapshot;
}
