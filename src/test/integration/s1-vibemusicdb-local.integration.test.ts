/** S1-10 matrix — v1 VibeMusicDB records stay readable through the v3 opener used by local://. */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getFileFromStorage } from "@/services/localMusicService";
import {
  openVibeMusicDb,
  resetVibeMusicDbForTests,
  VIBE_MUSIC_DB_NAME,
  VIBE_MUSIC_DB_VERSION,
  VIBE_MUSIC_STORES,
} from "@/lib/storage/vibeMusicDb";

function openRawDatabase(
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

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(VIBE_MUSIC_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

async function seedV1Record(id: string, data: ArrayBuffer): Promise<void> {
  const legacy = await openRawDatabase(1, (db) =>
    db.createObjectStore(VIBE_MUSIC_STORES.musicFiles.name, { keyPath: "id" })
  );
  await new Promise<void>((resolve, reject) => {
    const transaction = legacy.transaction([VIBE_MUSIC_STORES.musicFiles.name], "readwrite");
    transaction.objectStore(VIBE_MUSIC_STORES.musicFiles.name).put({
      id,
      data,
      type: "audio/mpeg",
      name: "local-track.mp3",
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  legacy.close();
}

describe("S1-10b v1 -> v3 local:// source", () => {
  beforeEach(async () => {
    resetVibeMusicDbForTests();
    await deleteDatabase();
  });

  afterEach(() => resetVibeMusicDbForTests());

  it("reads v1 musicFiles bytes after opening the database at v3", async () => {
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff]);
    await seedV1Record("local-1", bytes.buffer);

    const db = await openVibeMusicDb();
    expect(db.version).toBe(VIBE_MUSIC_DB_VERSION);
    expect(db.version).toBe(3);
    for (const store of Object.values(VIBE_MUSIC_STORES)) {
      expect(db.objectStoreNames.contains(store.name)).toBe(true);
    }
    const musicFiles = db
      .transaction([VIBE_MUSIC_STORES.musicFiles.name])
      .objectStore(VIBE_MUSIC_STORES.musicFiles.name);
    expect(musicFiles.keyPath).toBe("id");

    const file = await getFileFromStorage("local-1");
    if (!file) throw new Error("v1 musicFiles record disappeared after the v3 upgrade");
    expect(file.type).toBe("audio/mpeg");
    expect(file.name).toBe("local-track.mp3");
    // Structure-level assertion: the exact bytes survive IndexedDB v1 -> v3 (no browser audio).
    expect(Array.from(new Uint8Array(file.data))).toEqual(Array.from(bytes));
  });
});
