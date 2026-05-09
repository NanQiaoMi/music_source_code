import { describe, it, expect, beforeEach, vi } from "vitest";
import { useBackupRestoreStore } from "./backupRestoreStore";

function setupLocalStorageMock() {
  const store = new Map<string, string>();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(
    (key: string) => store.get(key) ?? null
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, value: string) => {
    store.set(key, value);
  });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key: string) => {
    store.delete(key);
  });
  vi.spyOn(Storage.prototype, "clear").mockImplementation(() => {
    store.clear();
  });
  return store;
}

// 模拟 URL.createObjectURL / revokeObjectURL
beforeEach(() => {
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
  });
  // 模拟 document.createElement 和 click
  vi.stubGlobal("document", {
    ...document,
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
    createElement: vi.fn(() => ({
      href: "",
      download: "",
      click: vi.fn(),
    })),
  });
});

describe("backupRestoreStore", () => {
  let localStorageStore: Map<string, string>;

  beforeEach(() => {
    useBackupRestoreStore.setState({
      backups: [],
      isBackingUp: false,
      isRestoring: false,
      restoreProgress: 0,
      backupProgress: 0,
    });
    localStorageStore = setupLocalStorageMock();
  });

  describe("createBackup", () => {
    it("should create a full backup and store data in localStorage", async () => {
      localStorageStore.set("audio-store-v4", '{"volume":0.8}');
      localStorageStore.set("visual-settings-v4", '{"theme":"dark"}');

      const backupItem = await useBackupRestoreStore.getState().createBackup("full");

      expect(backupItem).toBeDefined();
      expect(backupItem.id).toContain("backup-");
      expect(backupItem.type).toBe("full");
      expect(backupItem.version).toBe("4.0.0");
      expect(backupItem.size).toBeGreaterThan(0);

      // 验证备份数据已保存到 localStorage
      const stored = localStorageStore.get(`backup-data-${backupItem.id}`);
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!);
      expect(parsed.settings.audio).toBe('{"volume":0.8}');
    });

    it("should add backup item to store backups list", async () => {
      await useBackupRestoreStore.getState().createBackup("settings", "test-backup");
      const { backups } = useBackupRestoreStore.getState();
      expect(backups).toHaveLength(1);
      expect(backups[0].name).toBe("test-backup");
    });

    it("should create a settings-only backup", async () => {
      localStorageStore.set("audio-store-v4", '{"volume":0.5}');
      const item = await useBackupRestoreStore.getState().createBackup("settings");
      const stored = localStorageStore.get(`backup-data-${item.id}`);
      const data = JSON.parse(stored!);
      expect(data.settings).toBeDefined();
      expect(data.playlists).toBeUndefined();
      expect(data.library).toBeUndefined();
    });
  });

  describe("restoreBackup", () => {
    it("should restore settings data to localStorage", async () => {
      localStorageStore.set("audio-store-v4", '{"volume":0.8}');
      localStorageStore.set("visual-settings-v4", '{"theme":"dark"}');
      const backupItem = await useBackupRestoreStore.getState().createBackup("settings");

      // 修改 localStorage 数据，模拟需要恢复的场景
      localStorageStore.set("audio-store-v4", '{"volume":0}');

      await useBackupRestoreStore.getState().restoreBackup(backupItem.id);

      expect(localStorageStore.get("audio-store-v4")).toBe('{"volume":0.8}');
    });

    it("should restore playlist data to localStorage", async () => {
      localStorageStore.set("playlist-store", '{"items":["song1"]}');
      const backupItem = await useBackupRestoreStore.getState().createBackup("playlists");

      localStorageStore.set("playlist-store", '{"items":[]}');

      await useBackupRestoreStore.getState().restoreBackup(backupItem.id);

      expect(localStorageStore.get("playlist-store")).toBe('{"items":["song1"]}');
    });

    it("should restore library data to localStorage", async () => {
      localStorageStore.set("library-manager-store-v4", '{"songs":["track1"]}');
      const backupItem = await useBackupRestoreStore.getState().createBackup("library");

      localStorageStore.set("library-manager-store-v4", '{"songs":[]}');

      await useBackupRestoreStore.getState().restoreBackup(backupItem.id);

      expect(localStorageStore.get("library-manager-store-v4")).toBe('{"songs":["track1"]}');
    });

    it("should do nothing if backup does not exist", async () => {
      await useBackupRestoreStore.getState().restoreBackup("nonexistent");
      expect(useBackupRestoreStore.getState().isRestoring).toBe(false);
      expect(useBackupRestoreStore.getState().restoreProgress).toBe(0);
    });

    it("should set restoring state correctly", async () => {
      const backupItem = await useBackupRestoreStore.getState().createBackup("full");

      const promise = useBackupRestoreStore.getState().restoreBackup(backupItem.id);

      expect(useBackupRestoreStore.getState().isRestoring).toBe(true);

      await promise;

      expect(useBackupRestoreStore.getState().isRestoring).toBe(false);
      expect(useBackupRestoreStore.getState().restoreProgress).toBe(0);
    });
  });

  describe("deleteBackup", () => {
    it("should remove backup from list and clear localStorage data", async () => {
      const backupItem = await useBackupRestoreStore.getState().createBackup("full");

      expect(useBackupRestoreStore.getState().backups).toHaveLength(1);
      expect(localStorageStore.has(`backup-data-${backupItem.id}`)).toBe(true);

      useBackupRestoreStore.getState().deleteBackup(backupItem.id);

      expect(useBackupRestoreStore.getState().backups).toHaveLength(0);
      expect(localStorageStore.has(`backup-data-${backupItem.id}`)).toBe(false);
    });

    it("should not affect other backups when deleting one", async () => {
      const item1 = await useBackupRestoreStore.getState().createBackup("settings", "backup1");
      const item2 = await useBackupRestoreStore.getState().createBackup("playlists", "backup2");

      useBackupRestoreStore.getState().deleteBackup(item1.id);

      expect(useBackupRestoreStore.getState().backups).toHaveLength(1);
      expect(useBackupRestoreStore.getState().backups[0].id).toBe(item2.id);
      expect(localStorageStore.has(`backup-data-${item2.id}`)).toBe(true);
    });
  });
});
