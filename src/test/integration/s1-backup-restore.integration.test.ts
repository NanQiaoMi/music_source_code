/** S1-10 matrix — backup/restore (S1-2) over the real storage registry. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hydrateStores } from "@/lib/bootstrapStores";
import {
  BACKUP_SCHEMA_VERSION_STRING,
  RESTORE_ROLLBACK_KEY,
  createBackupV5,
  keysForBackupType,
  parseBackupV5,
} from "@/lib/storage/backupSchema";
import { BACKUP_KEYS, getStorageEntry } from "@/lib/storage/storageRegistry";
import { useAudioStore } from "@/store/audioStore";
import { useBackupRestoreStore } from "@/store/backupRestoreStore";
import { useQueueStore } from "@/store/queueStore";
import { useVisualSettingsStore } from "@/store/visualSettingsStore";
import type { Song } from "@/types/song";

const song = (id: string): Song => ({
  id,
  title: `Song ${id}`,
  artist: "S1-10b",
  duration: 180,
  source: "local",
  audioUrl: `stored://${id}`,
});

const envelope = (state: unknown, version: number | string = 1): string =>
  JSON.stringify({ state, version });
const bodyKey = (id: string): string => `backup-data-${id}`;

function read(key: string): string {
  const value = localStorage.getItem(key);
  if (value === null) throw new Error("missing localStorage key: " + key);
  return value;
}

interface BodyEntry {
  key: string;
  version: number;
  group: string;
  payload: string;
}

interface Body {
  schemaVersion: number;
  createdAt: number;
  type: string;
  entries: BodyEntry[];
}

function readBody(id: string): Body {
  return JSON.parse(read(bodyKey(id))) as Body;
}

function registerBackup(id: string, version = BACKUP_SCHEMA_VERSION_STRING): void {
  useBackupRestoreStore.setState((state) => ({
    backups: [
      ...state.backups,
      { id, name: id, type: "full" as const, createdAt: 1, size: 1, version },
    ],
  }));
}

function resetState(): void {
  vi.restoreAllMocks();
  useBackupRestoreStore.setState(useBackupRestoreStore.getInitialState(), true);
  useQueueStore.setState(useQueueStore.getInitialState(), true);
  useVisualSettingsStore.setState(useVisualSettingsStore.getInitialState(), true);
  useAudioStore.setState(useAudioStore.getInitialState(), true);
  localStorage.clear();
  sessionStorage.clear();
}

function legacyV4Body(): Record<string, unknown> {
  return {
    version: "4.0.0",
    createdAt: 1_700_000_000_000,
    type: "settings",
    settings: {
      // Inner envelope versions follow the owning store's persist config; 1 would be skipped
      // by zustand because audio has no version (0) and visual declares "1.0".
      audio: envelope({ volume: 0.66 }, 0),
      visual: envelope({ blurIntensity: 5 }, "1.0"),
      sleep: envelope({ minutes: 30 }, 0),
    },
    playlists: { playlist: envelope({ id: "dead-playlist" }) },
  };
}

describe("S1-10b v5 backup restore", () => {
  beforeEach(resetState);
  afterEach(resetState);

  it("round-trips a v5 full backup through validation, real rehydrate and bootstrap hydration", async () => {
    const queueHydrate = vi.spyOn(useQueueStore.persist, "rehydrate");
    const visualHydrate = vi.spyOn(useVisualSettingsStore.persist, "rehydrate");
    useQueueStore.getState().setQueue([song("a"), song("b")]);
    useQueueStore.getState().setCurrentIndex(1);
    useVisualSettingsStore.getState().setBlurIntensity(7.5);

    const item = await useBackupRestoreStore.getState().createBackup("full", "roundtrip");
    expect(item.version).toBe(BACKUP_SCHEMA_VERSION_STRING);
    const parsed = parseBackupV5(read(bodyKey(item.id)));
    if (!parsed.ok) throw new Error("created backup is not a valid v5 payload");
    expect(parsed.value.schemaVersion).toBe(5);
    expect(parsed.value.entries.map((entry) => entry.key)).toEqual([
      "queue-store-v5",
      "visual-settings-v4",
    ]);

    localStorage.setItem("queue-store-v5", envelope({ queue: [], currentIndex: 0 }));
    localStorage.setItem("visual-settings-v4", envelope({ blurIntensity: 1 }));
    useQueueStore.setState(useQueueStore.getInitialState(), true);
    useVisualSettingsStore.setState(useVisualSettingsStore.getInitialState(), true);

    await useBackupRestoreStore.getState().restoreBackup(item.id);
    expect(useBackupRestoreStore.getState().restoreError).toBeNull();
    expect(useBackupRestoreStore.getState().restoreReport?.restored).toEqual([
      "queue-store-v5",
      "visual-settings-v4",
    ]);
    expect(queueHydrate).toHaveBeenCalled();
    expect(visualHydrate).toHaveBeenCalled();
    expect(useQueueStore.getState().queue.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(useQueueStore.getState().currentIndex).toBe(1);
    expect(useVisualSettingsStore.getState().blurIntensity).toBe(7.5);

    // The client boot path reads the restored envelopes again through bootstrapStores.
    const restoredQueue = read("queue-store-v5");
    const restoredVisual = read("visual-settings-v4");
    useQueueStore.setState(useQueueStore.getInitialState(), true);
    useVisualSettingsStore.setState(useVisualSettingsStore.getInitialState(), true);
    localStorage.setItem("queue-store-v5", restoredQueue);
    localStorage.setItem("visual-settings-v4", restoredVisual);
    const boot = await hydrateStores({ owners: ["queueStore", "visualSettingsStore"] });
    expect(boot.hydrated).toEqual(["queueStore", "visualSettingsStore"]);
    expect(useQueueStore.getState().queue.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(useVisualSettingsStore.getState().blurIntensity).toBe(7.5);
  });

  it("upgrades a legacy v4-shaped body and reports its dead slots as skipped", async () => {
    const audioHydrate = vi.spyOn(useAudioStore.persist, "rehydrate");
    const visualHydrate = vi.spyOn(useVisualSettingsStore.persist, "rehydrate");
    const legacy = legacyV4Body();
    localStorage.setItem(bodyKey("legacy"), JSON.stringify(legacy));
    registerBackup("legacy", "4.0.0");

    await useBackupRestoreStore.getState().restoreBackup("legacy");

    expect(useBackupRestoreStore.getState().restoreError).toBeNull();
    expect(read("audio-store-v4")).toBe((legacy.settings as Record<string, string>).audio);
    expect(read("visual-settings-v4")).toBe((legacy.settings as Record<string, string>).visual);
    expect(localStorage.getItem("sleep-timer-store")).toBeNull();
    expect(localStorage.getItem("playlist-store")).toBeNull();
    const report = useBackupRestoreStore.getState().restoreReport;
    expect(report?.failed).toEqual([]);
    expect(report?.restored).toEqual(["audio-store-v4", "visual-settings-v4"]);
    expect(report?.skipped.map((entry) => entry.key).sort()).toEqual([
      "playlist-store",
      "sleep-timer-store",
    ]);
    expect(audioHydrate).toHaveBeenCalled();
    expect(visualHydrate).toHaveBeenCalled();
    expect(useAudioStore.getState().volume).toBe(0.66);
    expect(useVisualSettingsStore.getState().blurIntensity).toBe(5);
    expect(sessionStorage.getItem(RESTORE_ROLLBACK_KEY)).not.toBeNull();
  });

  it("rejects a v4-shaped body mis-stamped as 5.0.0 without touching live keys", async () => {
    const liveAudio = envelope({ volume: 0.9 });
    localStorage.setItem("audio-store-v4", liveAudio);
    const misStamped = { ...legacyV4Body(), version: "5.0.0" };
    localStorage.setItem(bodyKey("mis-stamped"), JSON.stringify(misStamped));
    registerBackup("mis-stamped", "5.0.0");
    const hydrate = vi.spyOn(useAudioStore.persist, "rehydrate");

    await useBackupRestoreStore.getState().restoreBackup("mis-stamped");

    expect(read("audio-store-v4")).toBe(liveAudio);
    expect(useBackupRestoreStore.getState().restoreError).toContain("不支持的备份版本");
    expect(useBackupRestoreStore.getState().restoreReport).toBeNull();
    expect(hydrate).not.toHaveBeenCalled();
    expect(() => useBackupRestoreStore.getState().importBackup(JSON.stringify(misStamped))).toThrow(
      /Unsupported backup schema version: 5\.0\.0/
    );
  });

  it("rejects a schemaVersion above the current maximum before any write", async () => {
    const liveAudio = envelope({ volume: 0.9 });
    localStorage.setItem("audio-store-v4", liveAudio);
    const future = {
      schemaVersion: 6,
      createdAt: 1,
      type: "full",
      entries: [
        {
          key: "audio-store-v4",
          version: 1,
          group: "playback",
          payload: envelope({ volume: 0.2 }),
        },
      ],
    };
    localStorage.setItem(bodyKey("future"), JSON.stringify(future));
    registerBackup("future");
    const hydrate = vi.spyOn(useAudioStore.persist, "rehydrate");

    await useBackupRestoreStore.getState().restoreBackup("future");

    expect(parseBackupV5(JSON.stringify(future))).toEqual({
      ok: false,
      reason: "unsupported-version",
    });
    expect(read("audio-store-v4")).toBe(liveAudio);
    expect(useBackupRestoreStore.getState().restoreError).toContain("不支持的备份版本");
    expect(useBackupRestoreStore.getState().restoreReport).toBeNull();
    expect(hydrate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RESTORE_ROLLBACK_KEY)).toBeNull();
  });

  it("prunes orphan bodies on demand and on create, then drops live bodies on clear", async () => {
    const first = await useBackupRestoreStore.getState().createBackup("settings", "first");
    const second = await useBackupRestoreStore.getState().createBackup("full", "second");
    localStorage.setItem("backup-data-orphan", "{}");
    localStorage.setItem("unrelated-key", "keep");

    useBackupRestoreStore.getState().pruneOrphanBackupBodies();

    expect(localStorage.getItem("backup-data-orphan")).toBeNull();
    expect(localStorage.getItem("unrelated-key")).toBe("keep");
    expect(read(bodyKey(first.id))).toBeTypeOf("string");
    expect(read(bodyKey(second.id))).toBeTypeOf("string");

    localStorage.setItem("backup-data-orphan-2", "{}");
    await useBackupRestoreStore.getState().createBackup("library", "third");
    expect(localStorage.getItem("backup-data-orphan-2")).toBeNull();

    useBackupRestoreStore.getState().clearAllBackups();
    expect(useBackupRestoreStore.getState().backups).toEqual([]);
    expect(localStorage.getItem(bodyKey(first.id))).toBeNull();
    expect(localStorage.getItem(bodyKey(second.id))).toBeNull();
  });

  it("keeps settings and full scopes distinct and documents createBackupV5 ignoring backup:false", () => {
    for (const key of [
      ...BACKUP_KEYS,
      "mimi-gesture-settings-v1",
      "eq-store",
      "backup-restore-store-v4",
    ]) {
      localStorage.setItem(key, envelope({ marker: key }));
    }
    expect(getStorageEntry("mimi-gesture-settings-v1")?.backup).toBe(false);

    const settingsKeys = keysForBackupType("settings");
    const settings = createBackupV5(localStorage, settingsKeys, "settings", 1);
    expect(settings.entries.map((entry) => entry.key)).toEqual([...settingsKeys]);
    // Known behavior: createBackupV5 filters by registry existence, not by entry.backup,
    // so the explicit settings scope includes mimi-gesture-settings-v1 although it is backup:false.
    expect(settings.entries.map((entry) => entry.key)).toContain("mimi-gesture-settings-v1");

    const full = createBackupV5(localStorage, keysForBackupType("full"), "full", 2);
    expect(full.entries.map((entry) => entry.key).sort()).toEqual([...BACKUP_KEYS].sort());
    expect(full.entries.every((entry) => getStorageEntry(entry.key)?.backup === true)).toBe(true);
    expect(full.entries.map((entry) => entry.key)).not.toContain("mimi-gesture-settings-v1");
    expect(full.entries.map((entry) => entry.key)).not.toContain("eq-store");
  });

  it("snapshots live keys before an atomic failure so the rollback path can recover", async () => {
    const liveAudio = envelope({ volume: 0.9 });
    const liveQueue = envelope({ queue: [{ id: "live" }], currentIndex: 0 });
    localStorage.setItem("audio-store-v4", liveAudio);
    localStorage.setItem("queue-store-v5", liveQueue);
    const item = await useBackupRestoreStore.getState().createBackup("full", "rollback");
    const body = readBody(item.id);
    const audioEntry = body.entries.find((entry) => entry.key === "audio-store-v4");
    if (!audioEntry) throw new Error("backup is missing audio-store-v4");
    audioEntry.payload = "{corrupt";
    localStorage.setItem(bodyKey(item.id), JSON.stringify(body));

    await useBackupRestoreStore.getState().restoreBackup(item.id);

    const report = useBackupRestoreStore.getState().restoreReport;
    expect(report?.restored).toEqual([]);
    expect(report?.failed).toEqual([{ key: "audio-store-v4", reason: "corrupt-payload" }]);
    expect(useBackupRestoreStore.getState().restoreError).toContain("恢复未完全成功");
    expect(read("audio-store-v4")).toBe(liveAudio);
    expect(read("queue-store-v5")).toBe(liveQueue);

    const rawSnapshot = sessionStorage.getItem(RESTORE_ROLLBACK_KEY);
    if (rawSnapshot === null) throw new Error("missing rollback snapshot");
    const snapshot = JSON.parse(rawSnapshot) as Record<string, string | null>;
    expect(snapshot).toEqual({ "audio-store-v4": liveAudio, "queue-store-v5": liveQueue });
    // Applying the snapshot is the manual rollback path used by the panel.
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    expect(read("audio-store-v4")).toBe(liveAudio);
    expect(read("queue-store-v5")).toBe(liveQueue);
  });
});
