// Network Audio Cache Service
// Caches network music (NetEase, Kuwo, QQ, etc.) to IndexedDB for offline playback
// Uses LRU eviction: max 200 songs or 4 GB, whichever is reached first
//
// 存储分两个 object store：
//   - networkAudio     : 完整记录（含 fileData，几十 MB 量级）
//   - networkAudioMeta : 除 fileData 外的全部元数据（KB 量级）
// 存在性检查、统计、LRU 淘汰只读 meta store —— 否则 IndexedDB 会把缓存里
// 所有音频二进制反序列化回主线程（上限 200 首 / 4 GB），在起播瞬间造成冻结。

import { BlobUrlRegistry } from "./BlobUrlRegistry";

const DB_NAME = "VibeNetworkAudioCacheDB";
const DB_VERSION = 2;
const AUDIO_STORE = "networkAudio";
const META_STORE = "networkAudioMeta";
const MAX_CACHE_COUNT = 200;
const MAX_CACHE_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB

export interface CachedNetworkAudio {
  cacheKey: string; // `${source}:${songId}`
  songId: string;
  source: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  lyrics?: string;
  translationLyrics?: string;
  duration: number;
  fileData: ArrayBuffer; // Full audio binary
  fileType: string; // 'audio/mpeg' | 'audio/flac' etc.
  originalUrl: string; // Original CDN URL (for reference)
  cachedAt: number;
  lastPlayedAt: number;
  fileSize: number; // bytes
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
      // v2：新增仅含元数据的 store，供存在性/统计/淘汰使用
      if (!db.objectStoreNames.contains(META_STORE)) {
        const meta = db.createObjectStore(META_STORE, { keyPath: "cacheKey" });
        meta.createIndex("lastPlayedAt", "lastPlayedAt", { unique: false });
        meta.createIndex("songId", "songId", { unique: false });
      }
    };
  });
};

// ---------- Public utilities ----------

export function makeCacheKey(songId: string, source?: string): string {
  return `${source || "netease"}:${songId}`;
}

/** 剥离 fileData 并补齐历史数据缺失的展示字段。幂等，可在写入与读取两侧复用。 */
function toMeta(record: CachedNetworkAudio): CachedNetworkAudioMeta {
  const { fileData: _fileData, ...meta } = record;
  void _fileData;
  return {
    ...meta,
    source: meta.source || "netease",
    title: meta.title || "未知歌曲",
    artist: meta.artist || "未知艺术家",
  };
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

// ---------- 老数据回填 ----------
// v1 库里已有的记录只有 networkAudio，没有 networkAudioMeta。
// 首次访问时用 cursor 流式补齐（O(1) 内存），之后每次调用都是一次 count() 比较的空操作。

let metaBackfillPromise: Promise<void> | null = null;

const runMetaBackfill = async (): Promise<void> => {
  const db = await openNetworkCacheDB();
  const audioCount = await new Promise<number>((resolve, reject) => {
    try {
      const tx = db.transaction(AUDIO_STORE, "readonly");
      const req = tx.objectStore(AUDIO_STORE).count();
      req.onsuccess = () => resolve(req.result ?? 0);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  const metaCount = await new Promise<number>((resolve, reject) => {
    try {
      const tx = db.transaction(META_STORE, "readonly");
      const req = tx.objectStore(META_STORE).count();
      req.onsuccess = () => resolve(req.result ?? 0);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  // 无缺口则不动（正常路径，一次 count 即返回）
  if (metaCount >= audioCount) return;

  console.info(`[NetworkAudioCache] Backfilling ${audioCount - metaCount} metadata record(s)...`);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([AUDIO_STORE, META_STORE], "readwrite");
    const audioStore = tx.objectStore(AUDIO_STORE);
    const metaStore = tx.objectStore(META_STORE);
    const req = audioStore.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return; // 游标走完，等 transaction complete
      const record = cursor.value as CachedNetworkAudio;
      if (record && record.cacheKey) {
        metaStore.put(toMeta(record));
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

const ensureMetaBackfilled = (): Promise<void> => {
  if (!metaBackfillPromise) {
    metaBackfillPromise = runMetaBackfill().catch((e) => {
      console.warn("[NetworkAudioCache] meta backfill skipped:", e);
      // 失败时重置，下次访问重试；单 key 读取仍有 AUDIO_STORE 兜底
      metaBackfillPromise = null;
    });
  }
  return metaBackfillPromise;
};

/** 仅在确实存在缺口时才需要等回填；有缺口的读取走单条兜底，不阻塞起播。 */
const kickMetaBackfill = (): void => {
  void ensureMetaBackfilled();
};

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

/**
 * 只读元数据，不加载 fileData。
 * 优先走 networkAudioMeta；若该 key 尚未回填则单条兜底读 networkAudio。
 */
export const getCachedAudioMeta = async (
  songId: string,
  source: string
): Promise<CachedNetworkAudioMeta | null> => {
  kickMetaBackfill();
  const key = makeCacheKey(songId, source);

  // meta 读取单独兜底：万一升级没跑成、META_STORE 不存在，
  // 也必须落到下面的单条读 —— 否则会被判成"从未缓存"，每次播放都重新下载整首歌
  try {
    const db = await openNetworkCacheDB();
    const meta = await new Promise<CachedNetworkAudioMeta | null>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readonly");
      const req = tx.objectStore(META_STORE).get(key);
      req.onsuccess = () => resolve((req.result as CachedNetworkAudioMeta) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (meta) return normalizeMeta(meta);
  } catch (e) {
    console.warn("[NetworkAudioCache] meta read unavailable, falling back:", e);
  }

  try {
    // 回填未完成或 meta store 不可用时的单条兜底：只读这一个 key，不会全量扫描
    const legacy = await getCachedAudio(songId, source);
    return legacy ? toMeta(legacy) : null;
  } catch (e) {
    console.warn("[NetworkAudioCache] getCachedAudioMeta error:", e);
    return null;
  }
};

function normalizeMeta(meta: CachedNetworkAudioMeta): CachedNetworkAudioMeta {
  return {
    ...meta,
    source: meta.source || "netease",
    title: meta.title || "未知歌曲",
    artist: meta.artist || "未知艺术家",
  };
}

export const saveCachedAudio = async (audio: CachedNetworkAudio): Promise<void> => {
  try {
    const db = await openNetworkCacheDB();
    const meta = toMeta(audio);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([AUDIO_STORE, META_STORE], "readwrite");
      tx.objectStore(AUDIO_STORE).put(audio);
      tx.objectStore(META_STORE).put(meta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
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
      const tx = db.transaction([AUDIO_STORE, META_STORE], "readwrite");
      tx.objectStore(AUDIO_STORE).delete(cacheKey);
      tx.objectStore(META_STORE).delete(cacheKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[NetworkAudioCache] deleteCachedAudio error:", e);
  }
};

export const getAllCachedAudioMeta = async (): Promise<CachedNetworkAudioMeta[]> => {
  try {
    // 列表类读取必须等回填完成，否则会漏掉升级前缓存的曲目
    await ensureMetaBackfilled();
    const db = await openNetworkCacheDB();
    const all = await new Promise<CachedNetworkAudioMeta[]>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readonly");
      const req = tx.objectStore(META_STORE).getAll();
      req.onsuccess = () => resolve((req.result as CachedNetworkAudioMeta[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return all.map(normalizeMeta);
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

/**
 * 只刷新 LRU 时间戳。
 * 有意只写 networkAudioMeta —— networkAudio 里同名字段已废弃（读取方改为 meta store），
 * 否则每次命中缓存播放都要把整段音频读出来再写回去。
 */
export const updateLastPlayed = async (cacheKey: string): Promise<void> => {
  try {
    const db = await openNetworkCacheDB();
    const existing = await new Promise<CachedNetworkAudioMeta | null>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readonly");
      const req = tx.objectStore(META_STORE).get(cacheKey);
      req.onsuccess = () => resolve((req.result as CachedNetworkAudioMeta) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (!existing) return;
    existing.lastPlayedAt = Date.now();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readwrite");
      tx.objectStore(META_STORE).put(existing);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[NetworkAudioCache] updateLastPlayed error:", e);
  }
};

export const pruneCacheToLimit = async (): Promise<void> => {
  try {
    // 淘汰依据必须完整，所以要先确保老数据已回填
    await ensureMetaBackfilled();
    const db = await openNetworkCacheDB();
    // 只读 meta store（KB 级），按 lastPlayedAt ASC 取，最旧的在前
    const allRecords = await new Promise<CachedNetworkAudioMeta[]>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readonly");
      const index = tx.objectStore(META_STORE).index("lastPlayedAt");
      const req = index.getAll();
      req.onsuccess = () => resolve((req.result as CachedNetworkAudioMeta[]) ?? []);
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
      const tx = db.transaction([AUDIO_STORE, META_STORE], "readwrite");
      const audioStore = tx.objectStore(AUDIO_STORE);
      const metaStore = tx.objectStore(META_STORE);
      for (const key of toDelete) {
        audioStore.delete(key);
        metaStore.delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
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
      const tx = db.transaction([AUDIO_STORE, META_STORE], "readwrite");
      tx.objectStore(AUDIO_STORE).clear();
      tx.objectStore(META_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[NetworkAudioCache] clearAllNetworkCache error:", e);
  }
};
