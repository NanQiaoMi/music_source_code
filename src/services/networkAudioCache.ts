// Network Audio Cache Service
// Caches network music (NetEase, Kuwo, QQ, etc.) to IndexedDB for offline playback
// Uses LRU eviction: max 200 songs or 4 GB, whichever is reached first

import { BlobUrlRegistry } from "./BlobUrlRegistry";

const DB_NAME = "VibeNetworkAudioCacheDB";
const DB_VERSION = 1;
const AUDIO_STORE = "networkAudio";
const MAX_CACHE_COUNT = 200;
const MAX_CACHE_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB

export interface CachedNetworkAudio {
  cacheKey: string;          // `${source}:${songId}`
  songId: string;
  source: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  lyrics?: string;
  translationLyrics?: string;
  duration: number;
  fileData: ArrayBuffer;     // Full audio binary
  fileType: string;          // 'audio/mpeg' | 'audio/flac' etc.
  originalUrl: string;       // Original CDN URL (for reference)
  cachedAt: number;
  lastPlayedAt: number;
  fileSize: number;          // bytes
}

export type CachedNetworkAudioMeta = Omit<CachedNetworkAudio, "fileData">;

// ---------- DB bootstrap ----------

const openNetworkCacheDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        const store = db.createObjectStore(AUDIO_STORE, { keyPath: "cacheKey" });
        store.createIndex("lastPlayedAt", "lastPlayedAt", { unique: false });
        store.createIndex("cachedAt", "cachedAt", { unique: false });
        store.createIndex("songId", "songId", { unique: false });
      }
    };
  });
};

// ---------- Public utilities ----------

export function makeCacheKey(songId: string, source?: string): string {
  return `${source || "netease"}:${songId}`;
}

export function createBlobUrlFromCache(cached: CachedNetworkAudio): string {
  try {
    const blob =
      cached.fileData instanceof Blob
        ? cached.fileData
        : new Blob([cached.fileData], { type: cached.fileType || "audio/mpeg" });
    return BlobUrlRegistry.getInstance().register(blob, `cached_${cached.songId}`);
  } catch (e) {
    console.warn("[NetworkAudioCache] Failed to create blob URL:", e);
    return "";
  }
}

// ---------- CRUD ----------

export const getCachedAudio = async (
  songId: string,
  source: string
): Promise<CachedNetworkAudio | null> => {
  try {
    const db = await openNetworkCacheDB();
    const key = makeCacheKey(songId, source);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readonly");
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as CachedNetworkAudio) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[NetworkAudioCache] getCachedAudio error:", e);
    return null;
  }
};

export const getCachedAudioMeta = async (
  songId: string,
  source: string
): Promise<CachedNetworkAudioMeta | null> => {
  const full = await getCachedAudio(songId, source);
  if (!full) return null;
  const { fileData: _fd, ...meta } = full;
  void _fd;
  return {
    ...meta,
    source: meta.source || source || "netease",
    title: meta.title || "未知歌曲",
    artist: meta.artist || "未知艺术家",
  };
};

export const saveCachedAudio = async (audio: CachedNetworkAudio): Promise<void> => {
  try {
    const db = await openNetworkCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.put(audio);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    // LRU eviction after every save
    await pruneCacheToLimit();
  } catch (e) {
    console.warn("[NetworkAudioCache] saveCachedAudio error:", e);
  }
};

export const deleteCachedAudio = async (cacheKey: string): Promise<void> => {
  try {
    const db = await openNetworkCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.delete(cacheKey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[NetworkAudioCache] deleteCachedAudio error:", e);
  }
};

export const getAllCachedAudioMeta = async (): Promise<CachedNetworkAudioMeta[]> => {
  try {
    const db = await openNetworkCacheDB();
    const all = await new Promise<CachedNetworkAudio[]>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readonly");
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as CachedNetworkAudio[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return all.map(({ fileData: _fd, ...meta }) => {
      void _fd;
      return {
        ...meta,
        source: meta.source || "netease",
        title: meta.title || "未知歌曲",
        artist: meta.artist || "未知艺术家",
      };
    });
  } catch (e) {
    console.warn("[NetworkAudioCache] getAllCachedAudioMeta error:", e);
    return [];
  }
};

export const getCacheStats = async (): Promise<{ count: number; totalSizeBytes: number }> => {
  try {
    const metas = await getAllCachedAudioMeta();
    const totalSizeBytes = metas.reduce((acc, m) => acc + (m.fileSize ?? 0), 0);
    return { count: metas.length, totalSizeBytes };
  } catch {
    return { count: 0, totalSizeBytes: 0 };
  }
};

export const updateLastPlayed = async (cacheKey: string): Promise<void> => {
  try {
    const db = await openNetworkCacheDB();
    const existing = await new Promise<CachedNetworkAudio | null>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readonly");
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.get(cacheKey);
      req.onsuccess = () => resolve((req.result as CachedNetworkAudio) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (!existing) return;
    existing.lastPlayedAt = Date.now();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.put(existing);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[NetworkAudioCache] updateLastPlayed error:", e);
  }
};

export const pruneCacheToLimit = async (): Promise<void> => {
  try {
    const db = await openNetworkCacheDB();
    // Get all records sorted by lastPlayedAt ASC (oldest first)
    const allRecords = await new Promise<CachedNetworkAudio[]>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readonly");
      const store = tx.objectStore(AUDIO_STORE);
      const index = store.index("lastPlayedAt");
      const req = index.getAll();
      req.onsuccess = () => resolve((req.result as CachedNetworkAudio[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    let totalBytes = allRecords.reduce((acc, r) => acc + (r.fileSize ?? 0), 0);
    let count = allRecords.length;
    const toDelete: string[] = [];

    // Oldest first — delete until within limits
    for (const record of allRecords) {
      if (count <= MAX_CACHE_COUNT && totalBytes <= MAX_CACHE_BYTES) break;
      toDelete.push(record.cacheKey);
      totalBytes -= record.fileSize ?? 0;
      count--;
    }

    if (toDelete.length === 0) return;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      const store = tx.objectStore(AUDIO_STORE);
      let pending = toDelete.length;
      const done = () => { if (--pending === 0) resolve(); };
      for (const key of toDelete) {
        const req = store.delete(key);
        req.onsuccess = done;
        req.onerror = () => reject(req.error);
      }
    });

    console.info(`[NetworkAudioCache] Pruned ${toDelete.length} cached items (LRU eviction)`);
  } catch (e) {
    console.warn("[NetworkAudioCache] pruneCacheToLimit error:", e);
  }
};

export const clearAllNetworkCache = async (): Promise<void> => {
  try {
    const db = await openNetworkCacheDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("[NetworkAudioCache] clearAllNetworkCache error:", e);
  }
};
