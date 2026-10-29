import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getFileFromStorage } from "./localMusicService";
import {
  openVibeMusicDb,
  resetVibeMusicDbForTests,
  VIBE_MUSIC_DB_NAME,
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

async function seedV1Record(): Promise<void> {
  const legacy = await openRawDatabase(1, (db) =>
    db.createObjectStore(VIBE_MUSIC_STORES.musicFiles.name, { keyPath: "id" })
  );
  await new Promise<void>((resolve, reject) => {
    const transaction = legacy.transaction([VIBE_MUSIC_STORES.musicFiles.name], "readwrite");
    transaction.objectStore(VIBE_MUSIC_STORES.musicFiles.name).put({
      id: "a",
      data: new Uint8Array([7, 8]).buffer,
      type: "audio/flac",
      name: "demo.flac",
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  legacy.close();
}

describe("getFileFromStorage", () => {
  beforeEach(async () => {
    resetVibeMusicDbForTests();
    await deleteDatabase();
  });

  afterEach(() => resetVibeMusicDbForTests());

  it("returns null when the record is absent", async () => {
    await openVibeMusicDb();

    await expect(getFileFromStorage("missing")).resolves.toBeNull();
  });

  it("reads a v1 musicFiles record after the automatic v3 upgrade", async () => {
    await seedV1Record();

    const file = await getFileFromStorage("a");

    expect(file?.type).toBe("audio/flac");
    expect(file?.name).toBe("demo.flac");
    expect(Array.from(new Uint8Array(file?.data as ArrayBuffer))).toEqual([7, 8]);
  });

  it("throws a classified error instead of silently returning null on a version conflict", async () => {
    (await openRawDatabase(4)).close();

    await expect(getFileFromStorage("a")).rejects.toMatchObject({ code: "version-conflict" });
  });
});
