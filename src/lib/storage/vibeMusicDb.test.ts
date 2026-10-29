import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  classifyVibeMusicDbError,
  openVibeMusicDb,
  resetVibeMusicDbForTests,
  VIBE_MUSIC_DB_NAME,
  VIBE_MUSIC_DB_VERSION,
  VIBE_MUSIC_STORES,
  VibeMusicDbError,
} from "./vibeMusicDb";

const STORE_NAMES = Object.values(VIBE_MUSIC_STORES)
  .map((store) => store.name)
  .sort();

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(VIBE_MUSIC_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

/** Opens the raw database at a given version, mimicking a pre-S1-4 client. */
function openLegacyDatabase(
  version: number,
  upgrade?: (db: IDBDatabase) => void
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(VIBE_MUSIC_DB_NAME, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putRecord(db: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function getRecord<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction([storeName], "readonly").objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

describe("openVibeMusicDb", () => {
  beforeEach(async () => {
    resetVibeMusicDbForTests();
    await deleteDatabase();
  });

  afterEach(() => resetVibeMusicDbForTests());

  it("creates the v3 schema from an empty database", async () => {
    const db = await openVibeMusicDb();

    expect(db.version).toBe(VIBE_MUSIC_DB_VERSION);
    expect(Array.from(db.objectStoreNames).sort()).toEqual(STORE_NAMES);
    for (const store of Object.values(VIBE_MUSIC_STORES)) {
      expect(db.transaction(store.name).objectStore(store.name).keyPath).toBe(store.keyPath);
    }
  });

  it("upgrades a v1 database to v3 without losing musicFiles records", async () => {
    const legacy = await openLegacyDatabase(1, (db) =>
      db.createObjectStore(VIBE_MUSIC_STORES.musicFiles.name, { keyPath: "id" })
    );
    await putRecord(legacy, VIBE_MUSIC_STORES.musicFiles.name, {
      id: "a",
      data: new Uint8Array([1, 2, 3]).buffer,
      type: "audio/mpeg",
    });
    legacy.close();

    const db = await openVibeMusicDb();

    expect(db.version).toBe(3);
    expect(Array.from(db.objectStoreNames).sort()).toEqual(STORE_NAMES);
    const record = await getRecord<{ data: ArrayBuffer; type: string }>(
      db,
      VIBE_MUSIC_STORES.musicFiles.name,
      "a"
    );
    expect(record?.type).toBe("audio/mpeg");
    expect(Array.from(new Uint8Array(record?.data as ArrayBuffer))).toEqual([1, 2, 3]);
  });

  it("upgrades a v2 database to v3 without losing localMusic records", async () => {
    const legacy = await openLegacyDatabase(2, (db) => {
      db.createObjectStore("localMusic", { keyPath: "id" });
      db.createObjectStore("musicMetadata", { keyPath: "id" });
      const offline = db.createObjectStore("offline_audios", { keyPath: "songId" });
      offline.createIndex("downloadedAt", "downloadedAt", { unique: false });
    });
    await putRecord(legacy, "localMusic", { id: "l1", fileName: "song.mp3" });
    await putRecord(legacy, "offline_audios", { songId: "s1", fileSize: 42 });
    legacy.close();

    const db = await openVibeMusicDb();

    expect(Array.from(db.objectStoreNames).sort()).toEqual(STORE_NAMES);
    expect(await getRecord(db, "localMusic", "l1")).toMatchObject({ fileName: "song.mp3" });
    expect(await getRecord(db, "offline_audios", "s1")).toMatchObject({ fileSize: 42 });
  });

  it("keeps existing store names and key paths unchanged", async () => {
    const db = await openVibeMusicDb();
    const keyPaths = Object.fromEntries(
      Array.from(db.objectStoreNames).map((name) => [
        name,
        db.transaction(name).objectStore(name).keyPath,
      ])
    );

    expect(keyPaths).toEqual({
      musicFiles: "id",
      localMusic: "id",
      musicMetadata: "id",
      offline_audios: "songId",
    });
    const offline = db.transaction("offline_audios").objectStore("offline_audios");
    expect(Array.from(offline.indexNames).sort()).toEqual([
      "downloadedAt",
      "isPinned",
      "lastPlayedAt",
    ]);
  });

  it("classifies a version conflict instead of throwing an unclassified error", async () => {
    (await openLegacyDatabase(4)).close();

    await expect(openVibeMusicDb()).rejects.toBeInstanceOf(VibeMusicDbError);
    await expect(openVibeMusicDb()).rejects.toMatchObject({ code: "version-conflict" });
    expect(classifyVibeMusicDbError(new DOMException("x", "NotFoundError"))).toBe("missing-store");
    expect(classifyVibeMusicDbError(new DOMException("x", "QuotaExceededError"))).toBe("quota");
    expect(classifyVibeMusicDbError(new VibeMusicDbError("blocked", "x"))).toBe("blocked");
    expect(classifyVibeMusicDbError(new Error("boom"))).toBe("unknown");
  });

  it("reuses one connection for concurrent callers", async () => {
    const [first, second] = await Promise.all([openVibeMusicDb(), openVibeMusicDb()]);

    expect(first).toBe(second);
    expect(await openVibeMusicDb()).toBe(first);
  });
});
