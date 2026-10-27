import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBackupRestoreStore } from "./backupRestoreStore";
import { rehydrateRegisteredStores } from "@/lib/storage/rehydrateRegisteredStores";
import { BACKUP_KEYS } from "@/lib/storage/storageRegistry";
import { RESTORE_ROLLBACK_KEY } from "@/lib/storage/backupSchema";
import backupV4 from "./__fixtures__/backup-v4-legacy.json";
import backupV3 from "./__fixtures__/backup-v3-unknown-major.json";
import backupV5 from "./__fixtures__/backup-v5.json";

vi.mock("@/lib/storage/rehydrateRegisteredStores", () => ({
  rehydrateRegisteredStores: vi.fn(async (keys: readonly string[]) => ({
    ok: [...keys],
    failed: [],
  })),
}));

const rehydrateMock = vi.mocked(rehydrateRegisteredStores);

function envelope(value: unknown): string {
  return JSON.stringify({ state: value, version: 1 });
}

function seedKey(key: string, value: unknown): void {
  localStorage.setItem(key, envelope(value));
}

function bodyKey(id: string): string {
  return `backup-data-${id}`;
}

function readBody(id: string): Record<string, unknown> {
  const raw = localStorage.getItem(bodyKey(id));
  if (!raw) throw new Error("missing backup body " + id);
  return JSON.parse(raw) as Record<string, unknown>;
}

function resetStores(): void {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  rehydrateMock.mockImplementation(async (keys?: readonly string[]) => ({
    ok: [...(keys ?? [])],
    failed: [],
  }));
  useBackupRestoreStore.setState({
    backups: [],
    currentBackup: null,
    isBackingUp: false,
    isRestoring: false,
    backupProgress: 0,
    restoreProgress: 0,
    restoreError: null,
    restoreReport: null,
    schedules: [],
  });
}

function registerLegacyBackup(id: string, version: string): void {
  useBackupRestoreStore.setState((state) => ({
    backups: [
      ...state.backups,
      {
        id,
        name: id,
        type: "full",
        createdAt: 0,
        size: 0,
        version,
      },
    ],
  }));
}

describe("backupRestoreStore (v5)", () => {
  beforeEach(resetStores);

  it("creates a v5 full backup from the registry keys only", async () => {
    for (const key of BACKUP_KEYS) seedKey(key, { marker: key });
    const item = await useBackupRestoreStore.getState().createBackup("full", "full-1");

    expect(item.version).toBe("5.0.0");
    expect(item.size).toBeGreaterThan(0);

    const body = readBody(item.id);
    expect(body.schemaVersion).toBe(5);
    expect(body.createdAt).toBeTypeOf("number");
    expect(Array.isArray(body.entries)).toBe(true);
    const entries = body.entries as Array<{ key: string; payload: string }>;
    expect(entries.map((entry) => entry.key).sort()).toEqual([...BACKUP_KEYS].sort());
    expect(entries.some((entry) => entry.key === "gesture-store")).toBe(false);
    expect(entries.some((entry) => entry.key === "queue-store")).toBe(false);
    expect(entries.some((entry) => entry.key === "recommendation-store")).toBe(false);
    expect(JSON.stringify(body).length).toBe(item.size);
  });

  it("creates a settings backup with the setting backup keys", async () => {
    seedKey("audio-store-v4", { volume: 0.5 });
    seedKey("visual-settings-v4", { themeMode: "dark" });
    seedKey("mimi-gesture-settings-v1", { enabled: false });
    const item = await useBackupRestoreStore.getState().createBackup("settings");
    const entries = (readBody(item.id).entries as Array<{ key: string }>).map((entry) => entry.key);
    expect(entries.sort()).toEqual(
      ["audio-store-v4", "visual-settings-v4", "mimi-gesture-settings-v1"].sort()
    );
  });

  it("previews v5 backups with real registry keys", async () => {
    seedKey("audio-store-v4", { volume: 0.5 });
    const item = await useBackupRestoreStore.getState().createBackup("full");
    const preview = useBackupRestoreStore.getState().getBackupPreview(item.id);
    expect(preview).toMatchObject({
      schemaVersion: "5.0.0",
      majorVersion: 5,
      canRestore: true,
      type: "full",
    });
    expect(preview?.includedStores).toEqual(["audio-store-v4"]);
  });

  it("migrates a v4 backup: real keys are written, dead keys are reported and skipped", async () => {
    localStorage.setItem(bodyKey("legacy"), JSON.stringify(backupV4));
    registerLegacyBackup("legacy", "4.0.0");

    await useBackupRestoreStore.getState().restoreBackup("legacy");

    expect(localStorage.getItem("audio-store-v4")).toBe(
      (backupV4.settings as unknown as Record<string, string>).audio
    );
    expect(localStorage.getItem("visual-settings-v4")).toBe(
      (backupV4.settings as unknown as Record<string, string>).visual
    );
    expect(localStorage.getItem("queue-store-v5")).toBe(
      (backupV4.playlists as unknown as Record<string, string>).queue
    );
    expect(localStorage.getItem("playlist-group-store-v1")).toBe(
      (backupV4.playlists as unknown as Record<string, string>).playlistGroups
    );
    expect(localStorage.getItem("recommendation-storage")).toBe(
      (backupV4.playlists as unknown as Record<string, string>).recommendation
    );
    expect(localStorage.getItem("library-manager-store-v4")).toBe(
      (backupV4.library as unknown as Record<string, string>).library
    );

    expect(localStorage.getItem("gesture-store")).toBeNull();
    expect(localStorage.getItem("sleep-timer-store")).toBeNull();
    expect(localStorage.getItem("playlist-store")).toBeNull();
    expect(localStorage.getItem("recommendation-store")).toBeNull();

    const report = useBackupRestoreStore.getState().restoreReport;
    expect(report).not.toBeNull();
    expect(report?.failed).toEqual([]);
    expect(report?.restored).toEqual(
      expect.arrayContaining([
        "audio-store-v4",
        "queue-store-v5",
        "recommendation-storage",
        "library-manager-store-v4",
      ])
    );
    expect(report?.skipped.map((item) => item.key).sort()).toEqual(
      ["playlist-store", "sleep-timer-store"].sort()
    );
    expect(rehydrateMock).toHaveBeenCalledWith(report?.restored);
    expect(sessionStorage.getItem(RESTORE_ROLLBACK_KEY)).not.toBeNull();
  });

  it("rejects v3/unknown major backups without touching live keys", async () => {
    seedKey("audio-store-v4", { volume: 0.9 });
    const before = localStorage.getItem("audio-store-v4");
    localStorage.setItem(bodyKey("v3"), JSON.stringify(backupV3));
    registerLegacyBackup("v3", "3.0.0");

    await useBackupRestoreStore.getState().restoreBackup("v3");

    expect(localStorage.getItem("audio-store-v4")).toBe(before);
    expect(useBackupRestoreStore.getState().restoreError).toContain("不支持的备份版本");
    expect(useBackupRestoreStore.getState().restoreReport).toBeNull();
    expect(rehydrateMock).not.toHaveBeenCalled();
  });

  it("round-trips a v5 backup through create -> mutate -> restore", async () => {
    seedKey("audio-store-v4", { volume: 0.3 });
    seedKey("queue-store-v5", { queue: [{ id: "a" }] });
    const item = await useBackupRestoreStore.getState().createBackup("full");

    localStorage.setItem("audio-store-v4", envelope({ volume: 0.99 }));
    localStorage.setItem("queue-store-v5", envelope({ queue: [] }));

    await useBackupRestoreStore.getState().restoreBackup(item.id);

    expect(localStorage.getItem("audio-store-v4")).toBe(envelope({ volume: 0.3 }));
    expect(localStorage.getItem("queue-store-v5")).toBe(envelope({ queue: [{ id: "a" }] }));
    expect(useBackupRestoreStore.getState().restoreReport?.restored.sort()).toEqual(
      ["audio-store-v4", "queue-store-v5"].sort()
    );
    expect(rehydrateMock).toHaveBeenCalledWith(
      expect.arrayContaining(["audio-store-v4", "queue-store-v5"])
    );
  });

  it("aborts atomically when any entry payload is corrupt", async () => {
    seedKey("audio-store-v4", { volume: 0.3 });
    const item = await useBackupRestoreStore.getState().createBackup("full");
    const body = readBody(item.id);
    const entries = body.entries as Array<{ key: string; payload: string }>;
    entries[0].payload = "{not-json";
    localStorage.setItem(bodyKey(item.id), JSON.stringify(body));

    const beforeAudio = localStorage.getItem("audio-store-v4");
    await useBackupRestoreStore.getState().restoreBackup(item.id);

    expect(localStorage.getItem("audio-store-v4")).toBe(beforeAudio);
    expect(useBackupRestoreStore.getState().restoreReport?.restored).toEqual([]);
    expect(useBackupRestoreStore.getState().restoreReport?.failed).toHaveLength(1);
    expect(rehydrateMock).not.toHaveBeenCalled();
  });

  it("accepts an existing v5 backup body fixture", async () => {
    localStorage.setItem(bodyKey("v5"), JSON.stringify(backupV5));
    registerLegacyBackup("v5", "5.0.0");
    await useBackupRestoreStore.getState().restoreBackup("v5");
    expect(localStorage.getItem("audio-store-v4")).toBe(
      (backupV5.entries[0] as { payload: string }).payload
    );
    expect(useBackupRestoreStore.getState().restoreReport?.restored).toHaveLength(3);
  });

  it("prunes orphan backup bodies and clears old backups with their bodies", async () => {
    const items = [];
    for (let index = 0; index < 12; index += 1) {
      items.push(await useBackupRestoreStore.getState().createBackup("full", "b" + index));
    }
    localStorage.setItem("backup-data-orphan", "{}");
    useBackupRestoreStore.getState().pruneOrphanBackupBodies();
    expect(localStorage.getItem("backup-data-orphan")).toBeNull();
    expect(localStorage.getItem(bodyKey(items[items.length - 1].id))).not.toBeNull();

    useBackupRestoreStore.getState().clearOldBackups();
    expect(useBackupRestoreStore.getState().backups).toHaveLength(10);
    expect(localStorage.getItem(bodyKey(items[0].id))).toBeNull();
    expect(localStorage.getItem(bodyKey(items[11].id))).not.toBeNull();

    useBackupRestoreStore.getState().clearAllBackups();
    expect(useBackupRestoreStore.getState().backups).toHaveLength(0);
    expect(localStorage.getItem(bodyKey(items[11].id))).toBeNull();
  });

  it("exports and imports v5 payloads, and still reads legacy v4 payloads", async () => {
    seedKey("audio-store-v4", { volume: 0.5 });
    const item = await useBackupRestoreStore.getState().createBackup("full");
    const data = useBackupRestoreStore.getState().getBackupData(item.id);
    expect(data).not.toBeNull();
    if (!data) return;
    const exported = useBackupRestoreStore.getState().exportBackup(data);
    expect(useBackupRestoreStore.getState().importBackup(exported)).toEqual(data);

    const legacy = useBackupRestoreStore.getState().importBackup(JSON.stringify(backupV4));
    expect(legacy).toMatchObject({ version: "4.0.0" });
    expect(() => useBackupRestoreStore.getState().importBackup("{bad")).toThrow();
  });
});
