export interface LegacyStoredAudioFile {
  data: ArrayBuffer;
  type: string;
  name?: string;
}

const DB_NAME = "VibeMusicDB";
const DB_VERSION = 1;
const STORE_NAME = "musicFiles";

function openLegacyMusicDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export async function getFileFromStorage(id: string): Promise<LegacyStoredAudioFile | null> {
  try {
    const db = await openLegacyMusicDB();
    return await new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result as
          | { data?: ArrayBuffer; type?: string; name?: string }
          | undefined;
        if (!result?.data || !result.type) {
          resolve(null);
          return;
        }
        resolve({ data: result.data, type: result.type, name: result.name });
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
