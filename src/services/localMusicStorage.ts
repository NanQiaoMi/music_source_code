// Local Music & Offline Audio Storage Service using IndexedDB
// This provides persistent storage for local music and offline downloaded network songs

import { BlobUrlRegistry } from "./BlobUrlRegistry";

const DB_NAME = "VibeMusicDB";
const DB_VERSION = 2;
const STORE_NAME = "localMusic";
const METADATA_STORE = "musicMetadata";
const OFFLINE_STORE = "offline_audios";

export interface StoredMusic {
  id: string;
  fileData: ArrayBuffer;
  fileType: string;
  fileName: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverData?: string;
  lyrics?: string; // LRC format lyrics content
  addedAt: number;
}

export interface OfflineAudioRecord {
  id: string;
  songId: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover?: string;
  lyrics?: string;
  translationLyrics?: string;
  format?: string;
  source: string;
  quality: string; // "lossless" | "hires" | "320k" | "128k"
  bitrate?: number;
  mimeType: string;
  fileData: ArrayBuffer;
  fileSize: number;
  downloadedAt: number;
  lastPlayedAt: number;
  isPinned: boolean;
}

// Open IndexedDB connection with version migration
const isIDBAvailable = typeof indexedDB !== "undefined";
const inMemoryLocalMusic = new Map<string, StoredMusic>();
const inMemoryOfflineAudios = new Map<string, OfflineAudioRecord>();

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!isIDBAvailable) {
      return reject(new Error("IndexedDB not available"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        const offlineStore = db.createObjectStore(OFFLINE_STORE, { keyPath: "songId" });
        offlineStore.createIndex("downloadedAt", "downloadedAt", { unique: false });
        offlineStore.createIndex("lastPlayedAt", "lastPlayedAt", { unique: false });
        offlineStore.createIndex("isPinned", "isPinned", { unique: false });
      }
    };
  });
};

// Save music file to IndexedDB
export const saveMusicFile = async (music: StoredMusic): Promise<void> => {
  if (!isIDBAvailable) {
    inMemoryLocalMusic.set(String(music.id), music);
    return;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(music);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Get all stored music
export const getAllStoredMusic = async (): Promise<StoredMusic[]> => {
  if (!isIDBAvailable) {
    return Array.from(inMemoryLocalMusic.values());
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

// Get a single music file
export const getStoredMusic = async (id: string | number): Promise<StoredMusic | null> => {
  const strId = String(id);
  if (!isIDBAvailable) {
    return inMemoryLocalMusic.get(strId) || null;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(strId);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
      } else {
        const numId = Number(id);
        if (!isNaN(numId) && String(numId) !== strId) {
          const fallbackReq = store.get(numId);
          fallbackReq.onsuccess = () => resolve(fallbackReq.result || null);
          fallbackReq.onerror = () => resolve(null);
        } else {
          resolve(null);
        }
      }
    };
    request.onerror = () => reject(request.error);
  });
};

// Delete a music file
export const deleteStoredMusic = async (id: string): Promise<void> => {
  if (!isIDBAvailable) {
    inMemoryLocalMusic.delete(String(id));
    return;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Clear all stored music
export const clearAllStoredMusic = async (): Promise<void> => {
  if (!isIDBAvailable) {
    inMemoryLocalMusic.clear();
    return;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// === Offline Network Audio Operations ===

export const saveOfflineAudio = async (record: OfflineAudioRecord): Promise<void> => {
  if (!isIDBAvailable) {
    inMemoryOfflineAudios.set(String(record.songId), record);
    return;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_STORE], "readwrite");
    const store = transaction.objectStore(OFFLINE_STORE);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getOfflineAudio = async (songId: string): Promise<OfflineAudioRecord | null> => {
  const key = String(songId);
  if (!isIDBAvailable) {
    return inMemoryOfflineAudios.get(key) || null;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_STORE], "readonly");
    const store = transaction.objectStore(OFFLINE_STORE);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const getAllOfflineAudios = async (): Promise<OfflineAudioRecord[]> => {
  if (!isIDBAvailable) {
    return Array.from(inMemoryOfflineAudios.values());
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_STORE], "readonly");
    const store = transaction.objectStore(OFFLINE_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const deleteOfflineAudio = async (songId: string): Promise<void> => {
  const key = String(songId);
  if (!isIDBAvailable) {
    inMemoryOfflineAudios.delete(key);
    return;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_STORE], "readwrite");
    const store = transaction.objectStore(OFFLINE_STORE);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearAllOfflineAudios = async (): Promise<void> => {
  if (!isIDBAvailable) {
    inMemoryOfflineAudios.clear();
    return;
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_STORE], "readwrite");
    const store = transaction.objectStore(OFFLINE_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Create blob URL from stored music
export const createBlobUrlFromStoredMusic = (music: StoredMusic): string => {
  if (!music || !music.fileData) return "";
  try {
    const mimeType = music.fileType || "audio/mpeg";
    const blob = music.fileData instanceof Blob ? music.fileData : new Blob([music.fileData], { type: mimeType });
    return BlobUrlRegistry.getInstance().register(blob, `stored_${music.id}`);
  } catch (e) {
    console.error("Failed to create blob URL from stored music:", e);
    return "";
  }
};

export const createBlobUrlFromOfflineAudio = (record: OfflineAudioRecord): string => {
  if (!record || !record.fileData) return "";
  try {
    const mimeType = record.mimeType || "audio/mpeg";
    const blob = record.fileData instanceof Blob ? record.fileData : new Blob([record.fileData], { type: mimeType });
    return BlobUrlRegistry.getInstance().register(blob, `offline_${record.songId}`);
  } catch (e) {
    console.error("Failed to create blob URL from offline audio:", e);
    return "";
  }
};

// Detailed Storage Calculation Helper
export interface StorageDetailResult {
  localMusicBytes: number;
  localMusicCount: number;
  offlineAudioBytes: number;
  offlineAudioCount: number;
  coversBytes: number;
  lyricsBytes: number;
  indexedDbEstimateBytes: number;
  totalUsageBytes: number;
  quotaBytes: number;
}

export const getStorageDetails = async (): Promise<StorageDetailResult> => {
  let localMusicBytes = 0;
  let localMusicCount = 0;
  let offlineAudioBytes = 0;
  let offlineAudioCount = 0;
  let coversBytes = 0;
  let lyricsBytes = 0;

  try {
    const localMusics = await getAllStoredMusic();
    localMusicCount = localMusics.length;
    for (const m of localMusics) {
      if (m.fileData) {
        localMusicBytes += m.fileData.byteLength || 0;
      }
      if (m.coverData) {
        coversBytes += m.coverData.length * 2; // UTF-16 approximate size
      }
      if (m.lyrics) {
        lyricsBytes += m.lyrics.length * 2;
      }
    }
  } catch {
    // Ignore error
  }

  try {
    const offlineAudios = await getAllOfflineAudios();
    offlineAudioCount = offlineAudios.length;
    for (const o of offlineAudios) {
      if (o.fileData) {
        offlineAudioBytes += o.fileData.byteLength || o.fileSize || 0;
      }
      if (o.cover) {
        coversBytes += o.cover.length * 2;
      }
      if (o.lyrics) {
        lyricsBytes += o.lyrics.length * 2;
      }
    }
  } catch {
    // Ignore error
  }

  let totalUsageBytes = localMusicBytes + offlineAudioBytes + coversBytes + lyricsBytes;
  let quotaBytes = 50 * 1024 * 1024 * 1024; // Default 50GB
  let indexedDbEstimateBytes = totalUsageBytes;

  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage) {
        indexedDbEstimateBytes = estimate.usage;
        totalUsageBytes = Math.max(totalUsageBytes, estimate.usage);
      }
      if (estimate.quota) {
        quotaBytes = estimate.quota;
      }
    } catch {
      // Ignore
    }
  }

  return {
    localMusicBytes,
    localMusicCount,
    offlineAudioBytes,
    offlineAudioCount,
    coversBytes,
    lyricsBytes,
    indexedDbEstimateBytes,
    totalUsageBytes,
    quotaBytes,
  };
};
