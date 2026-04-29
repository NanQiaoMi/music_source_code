// Cover Cache Service using IndexedDB
// Caches album covers locally for faster loading

const DB_NAME = "VibeMusicCoverDB";
const DB_VERSION = 1;
const COVER_STORE = "coverCache";

export interface CachedCover {
  id: string;
  coverData: string; // base64 encoded image data
  originalUrl: string;
  cachedAt: number;
}

// Open IndexedDB connection
const openCoverDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(COVER_STORE)) {
        const store = db.createObjectStore(COVER_STORE, { keyPath: "id" });
        store.createIndex("originalUrl", "originalUrl", { unique: false });
        store.createIndex("cachedAt", "cachedAt", { unique: false });
      }
    };
  });
};

// Save cover to cache
export const saveCoverToCache = async (
  id: string,
  originalUrl: string,
  coverData: string
): Promise<void> => {
  if (!coverData || coverData.startsWith("data:")) {
    // Don't cache base64 data URIs or empty covers
    return;
  }

  try {
    // Fetch and convert to base64
    const response = await fetch(coverData);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const db = await openCoverDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COVER_STORE], "readwrite");
      const store = transaction.objectStore(COVER_STORE);
      const cachedCover: CachedCover = {
        id,
        coverData: base64,
        originalUrl,
        cachedAt: Date.now(),
      };
      const request = store.put(cachedCover);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error caching cover:", error);
  }
};

// Get cover from cache
export const getCoverFromCache = async (id: string): Promise<string | null> => {
  try {
    const db = await openCoverDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COVER_STORE], "readonly");
      const store = transaction.objectStore(COVER_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as CachedCover | undefined;
        resolve(result?.coverData || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error getting cached cover:", error);
    return null;
  }
};

// Delete cover from cache
export const deleteCoverFromCache = async (id: string): Promise<void> => {
  try {
    const db = await openCoverDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COVER_STORE], "readwrite");
      const store = transaction.objectStore(COVER_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error deleting cached cover:", error);
  }
};

// Clear old cached covers (older than 30 days)
export const clearOldCovers = async (): Promise<void> => {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  try {
    const db = await openCoverDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COVER_STORE], "readwrite");
      const store = transaction.objectStore(COVER_STORE);
      const index = store.index("cachedAt");
      const range = IDBKeyRange.upperBound(thirtyDaysAgo);
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error clearing old covers:", error);
  }
};

// Helper function to convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Preload and cache covers for a list of songs
export const preloadCovers = async (songs: { id: string; cover: string }[]): Promise<void> => {
  const promises = songs.map(async (song) => {
    // Check if already cached
    const cached = await getCoverFromCache(song.id);
    if (cached) return;

    // Check if it's a URL that can be cached
    if (song.cover && !song.cover.startsWith("data:") && !song.cover.startsWith("blob:")) {
      await saveCoverToCache(song.id, song.cover, song.cover);
    }
  });

  await Promise.all(promises);
};
