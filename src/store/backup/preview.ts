// S1-2: schema-version-agnostic backup preview + payload dispatch.
//
// Kept out of backupRestoreStore.ts so the store stays inside its 400-line budget
// (scripts/check-store-budgets.mjs, ratchet baseline in perf/store-line-baseline.json).
// v5 bodies carry real registry keys; legacy v4 bodies still expose their slot names so the
// panel can show which old slots will be skipped instead of silently rewriting them.
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_SCHEMA_VERSION_STRING,
  isLegacyV4Backup,
  parseBackupV5,
  type BackupPayloadV5,
} from "@/lib/storage/backupSchema";
import {
  estimateBackupSize,
  type AnyBackupData,
  type BackupData,
  type BackupPreview,
} from "./helpers";

export function isV5Payload(value: unknown): value is BackupPayloadV5 {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as BackupPayloadV5).schemaVersion === 5 &&
    Array.isArray((value as BackupPayloadV5).entries)
  );
}

function getMajorVersion(version: unknown): number {
  if (typeof version !== "string") return 0;
  const major = Number.parseInt(version.split(".")[0] || "0", 10);
  return Number.isFinite(major) ? major : 0;
}

/** Legacy v4 slot names -> real keys, used only for preview copy (restore uses the migration map). */
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

function createV5Preview(data: BackupPayloadV5): BackupPreview {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION_STRING,
    majorVersion: BACKUP_SCHEMA_VERSION,
    canRestore: true,
    includedStores: data.entries.map((entry) => entry.key),
    unsupportedStores: [],
    type: data.type,
    createdAt: data.createdAt,
    size: estimateBackupSize(data),
  };
}

function createLegacyPreview(legacy: BackupData): BackupPreview {
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
    error: canRestore ? undefined : "Unsupported backup schema version: " + legacy.version,
  };
}

export function createBackupPreview(data: AnyBackupData): BackupPreview {
  if (isV5Payload(data)) return createV5Preview(data);
  return createLegacyPreview(data as BackupData);
}

/**
 * Parse a stored backup body into v5 or legacy v4. Throws for unknown/corrupt versions so
 * callers can surface a concrete restore error.
 */
export function parseAnyBackupData(raw: string): AnyBackupData {
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
  // A slot-shaped body can only be v4. Anything else keeps the S6-11 contract error string
  // ("Unsupported backup schema version: <v>"), including a v4 body mis-stamped as 5.0.0.
  const major = getMajorVersion((parsed as { version?: unknown } | null)?.version);
  if (major > 0 && major !== 4) {
    throw new Error(
      "Unsupported backup schema version: " + String((parsed as { version?: unknown }).version)
    );
  }
  throw new Error("无法识别的备份格式");
}
