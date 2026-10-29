import {
  classifyVibeMusicDbError,
  openVibeMusicDb,
  VIBE_MUSIC_STORES,
  VibeMusicDbError,
} from "@/lib/storage/vibeMusicDb";

export interface LegacyStoredAudioFile {
  data: ArrayBuffer;
  type: string;
  name?: string;
}

const STORE_NAME = VIBE_MUSIC_STORES.musicFiles.name;

interface MusicFileRecord {
  data?: ArrayBuffer;
  type?: string;
  name?: string;
}

function readMusicFileRecord(db: IDBDatabase, id: string): Promise<MusicFileRecord | undefined> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction([STORE_NAME], "readonly");
    } catch (error) {
      reject(
        new VibeMusicDbError(
          classifyVibeMusicDbError(error),
          `VibeMusicDB store "${STORE_NAME}" is unavailable`,
          error
        )
      );
      return;
    }

    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as MusicFileRecord | undefined);
    request.onerror = () =>
      reject(
        new VibeMusicDbError(
          classifyVibeMusicDbError(request.error),
          `Failed to read "${id}" from VibeMusicDB`,
          request.error
        )
      );
  });
}

/**
 * Reads a v1 `musicFiles` record.
 *
 * - record absent (or unusable): `null` — callers report "not found";
 * - database failure: throws a classified {@link VibeMusicDbError} (never swallowed).
 */
export async function getFileFromStorage(id: string): Promise<LegacyStoredAudioFile | null> {
  const db = await openVibeMusicDb();
  const record = await readMusicFileRecord(db, id);
  if (!record?.data || !record.type) return null;
  return { data: record.data, type: record.type, name: record.name };
}
