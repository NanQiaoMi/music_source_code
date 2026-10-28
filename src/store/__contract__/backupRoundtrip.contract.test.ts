// S6-11 backup-roundtrip contract: the registry's 8 backup keys stay explicit, a full backup
// survives export -> JSON -> import unchanged, and newer schema majors are rejected. The five
// legacy key names still used by backupRestoreStore are frozen as known gaps: fixing one must
// update this ratchet, not silently drift.
import { describe, expect, it } from "vitest";
import { BACKUP_KEYS, STORAGE_KEYS, STORAGE_REGISTRY } from "@/lib/storage/storageRegistry";
import { useBackupRestoreStore, type BackupData } from "@/store/backupRestoreStore";

const REGISTERED_BACKUP_KEYS = STORAGE_REGISTRY.filter((entry) => entry.backup)
  .map((entry) => entry.key)
  .sort();
/** backupRestoreStore reads these names instead of their registry equivalents. */
const LEGACY_BACKUP_KEYS = [
  "gesture-store",
  "playlist-store",
  "queue-store",
  "recommendation-store",
  "sleep-timer-store",
];
/** Registered backup keys the export path cannot cover today. */
const UNCOVERED_BACKUP_KEYS = ["player-store", "queue-store-v5", "recommendation-storage"];

function fullBackup(): BackupData {
  return {
    version: "4.0.0",
    createdAt: 1710000000000,
    type: "full",
    settings: { audio: "{}", visual: "{}", gesture: "{}", sleep: "{}" },
    playlists: { playlist: "[]", playlistGroups: "{}", queue: "{}", recommendation: "{}" },
    library: { library: "[]" },
    lyrics: "[]",
    covers: "{}",
    eqPresets: "[]",
    themes: "[]",
  };
}

describe("backup roundtrip contract (S6-11)", () => {
  it("exports exactly the registry's 8 backup keys and freezes the legacy name gap", () => {
    expect(REGISTERED_BACKUP_KEYS).toEqual([...BACKUP_KEYS].sort());
    expect(BACKUP_KEYS).toHaveLength(8);
    expect(BACKUP_KEYS.every((key) => STORAGE_KEYS.has(key))).toBe(true);

    const preview = useBackupRestoreStore.getState().previewBackupData(fullBackup());
    expect(preview.canRestore).toBe(true);
    expect(preview.majorVersion).toBe(4);
    // 13 unique stores: 5 registered backup keys + 5 legacy names + 3 aux payload slots.
    expect(preview.includedStores).toHaveLength(13);
    expect(new Set(preview.includedStores).size).toBe(13);
    const included = new Set(preview.includedStores);
    expect(BACKUP_KEYS.filter((key) => !included.has(key)).sort()).toEqual(
      [...UNCOVERED_BACKUP_KEYS].sort()
    );
    expect(preview.includedStores.filter((key) => !STORAGE_KEYS.has(key)).sort()).toEqual(
      [...LEGACY_BACKUP_KEYS, "covers", "eq-presets", "themes"].sort()
    );
  });

  it("roundtrips a full payload through exportBackup -> JSON -> importBackup", () => {
    const data = fullBackup();
    const json = useBackupRestoreStore.getState().exportBackup(data);

    expect(json).toBe(JSON.stringify(data, null, 2));
    expect(useBackupRestoreStore.getState().importBackup(json)).toEqual(data);
    expect(JSON.parse(json)).toEqual(data);
  });

  it("rejects a newer backup major instead of importing it", () => {
    const future = { ...fullBackup(), version: "5.0.0" };

    expect(() => useBackupRestoreStore.getState().importBackup(JSON.stringify(future))).toThrow(
      /Unsupported backup schema version/
    );
    expect(useBackupRestoreStore.getState().previewBackupData(future)).toMatchObject({
      schemaVersion: "5.0.0",
      majorVersion: 5,
      canRestore: false,
    });
  });
});
