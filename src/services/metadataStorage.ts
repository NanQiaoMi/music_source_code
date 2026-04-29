// Metadata Storage Service using IndexedDB
// Caches extracted metadata to avoid re-parsing audio files

import { AudioMetadata } from "./audioMetadata";

const DB_NAME = "VibeMusicMetadataDB";
const DB_VERSION = 1;
const METADATA_STORE = "audioMetadata";
const FILE_HASH_STORE = "fileHashes";

export interface StoredMetadata extends AudioMetadata {
  fileHash: string; // Unique hash to identify the file
}

export interface FileHashEntry {
  id: string;
  fileHash: string;
  metadataId: string;
  lastAccessed: number;
}

// Open IndexedDB connection
const openMetadataDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for metadata
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: "id" });
        metadataStore.createIndex("fileHash", "fileHash", { unique: true });
        metadataStore.createIndex("extractedAt", "extractedAt", { unique: false });
      }

      // Store for file hash mappings
      if (!db.objectStoreNames.contains(FILE_HASH_STORE)) {
        const hashStore = db.createObjectStore(FILE_HASH_STORE, { keyPath: "id" });
        hashStore.createIndex("fileHash", "fileHash", { unique: true });
      }
    };
  });
};

/**
 * Generate a hash for the file to identify it uniquely
 */
export function generateFileHash(file: File): string {
  // Use file name, size, and last modified as unique identifier
  const hashString = `${file.name}_${file.size}_${file.lastModified}`;
  return btoa(unescape(encodeURIComponent(hashString)))
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 32);
}

/**
 * Save metadata to cache
 */
export async function saveMetadataToCache(metadata: AudioMetadata, file: File): Promise<void> {
  try {
    const fileHash = generateFileHash(file);
    const storedMetadata: StoredMetadata = {
      ...metadata,
      fileHash,
    };

    const db = await openMetadataDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE, FILE_HASH_STORE], "readwrite");

      // Save metadata
      const metadataStore = transaction.objectStore(METADATA_STORE);
      metadataStore.put(storedMetadata);

      // Save hash mapping
      const hashStore = transaction.objectStore(FILE_HASH_STORE);
      const hashEntry: FileHashEntry = {
        id: metadata.id,
        fileHash,
        metadataId: metadata.id,
        lastAccessed: Date.now(),
      };
      hashStore.put(hashEntry);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error("Error saving metadata to cache:", error);
  }
}

/**
 * Get metadata from cache by file
 */
export async function getMetadataFromCache(file: File): Promise<AudioMetadata | null> {
  try {
    const fileHash = generateFileHash(file);

    const db = await openMetadataDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], "readonly");
      const store = transaction.objectStore(METADATA_STORE);
      const index = store.index("fileHash");
      const request = index.get(fileHash);

      request.onsuccess = () => {
        const result = request.result as StoredMetadata | undefined;
        if (result) {
          // Update last accessed time
          updateLastAccessed(result.id).catch(console.error);
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error getting metadata from cache:", error);
    return null;
  }
}

/**
 * Get metadata by ID
 */
export async function getMetadataById(id: string): Promise<AudioMetadata | null> {
  try {
    const db = await openMetadataDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], "readonly");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as StoredMetadata | undefined;
        if (result) {
          updateLastAccessed(id).catch(console.error);
          resolve(result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error getting metadata by ID:", error);
    return null;
  }
}

/**
 * Update last accessed time
 */
async function updateLastAccessed(id: string): Promise<void> {
  try {
    const db = await openMetadataDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([FILE_HASH_STORE], "readwrite");
      const store = transaction.objectStore(FILE_HASH_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const entry = request.result as FileHashEntry | undefined;
        if (entry) {
          entry.lastAccessed = Date.now();
          store.put(entry);
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error updating last accessed:", error);
  }
}

/**
 * Delete metadata from cache
 */
export async function deleteMetadataFromCache(id: string): Promise<void> {
  try {
    const db = await openMetadataDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE, FILE_HASH_STORE], "readwrite");

      // Delete metadata
      const metadataStore = transaction.objectStore(METADATA_STORE);
      metadataStore.delete(id);

      // Delete hash mapping
      const hashStore = transaction.objectStore(FILE_HASH_STORE);
      hashStore.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error("Error deleting metadata from cache:", error);
  }
}

/**
 * Clear old metadata cache (older than 30 days)
 */
export async function clearOldMetadataCache(days: number = 30): Promise<number> {
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  try {
    const db = await openMetadataDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([FILE_HASH_STORE], "readonly");
      const store = transaction.objectStore(FILE_HASH_STORE);
      const request = store.openCursor();

      const idsToDelete: string[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as FileHashEntry;
          if (entry.lastAccessed < cutoffTime) {
            idsToDelete.push(entry.id);
          }
          cursor.continue();
        } else {
          // Delete old entries
          Promise.all(idsToDelete.map((id) => deleteMetadataFromCache(id)))
            .then(() => {
              deletedCount = idsToDelete.length;
              resolve(deletedCount);
            })
            .catch(reject);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error clearing old metadata cache:", error);
    return deletedCount;
  }
}

/**
 * Get all cached metadata
 */
export async function getAllCachedMetadata(): Promise<AudioMetadata[]> {
  try {
    const db = await openMetadataDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], "readonly");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as StoredMetadata[];
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error getting all cached metadata:", error);
    return [];
  }
}

/**
 * Check if metadata exists in cache for a file
 */
export async function hasMetadataInCache(file: File): Promise<boolean> {
  const metadata = await getMetadataFromCache(file);
  return metadata !== null;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalSize: number;
  oldestEntry: number;
  newestEntry: number;
}> {
  try {
    const allMetadata = await getAllCachedMetadata();

    let totalSize = 0;
    let oldestEntry = Date.now();
    let newestEntry = 0;

    for (const metadata of allMetadata) {
      totalSize += metadata.fileSize;
      if (metadata.extractedAt < oldestEntry) {
        oldestEntry = metadata.extractedAt;
      }
      if (metadata.extractedAt > newestEntry) {
        newestEntry = metadata.extractedAt;
      }
    }

    return {
      totalEntries: allMetadata.length,
      totalSize,
      oldestEntry: allMetadata.length > 0 ? oldestEntry : 0,
      newestEntry: allMetadata.length > 0 ? newestEntry : 0,
    };
  } catch (error) {
    console.error("Error getting cache stats:", error);
    return {
      totalEntries: 0,
      totalSize: 0,
      oldestEntry: 0,
      newestEntry: 0,
    };
  }
}

/**
 * Clear all metadata cache
 */
export async function clearAllMetadataCache(): Promise<void> {
  try {
    const db = await openMetadataDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE, FILE_HASH_STORE], "readwrite");

      const metadataStore = transaction.objectStore(METADATA_STORE);
      metadataStore.clear();

      const hashStore = transaction.objectStore(FILE_HASH_STORE);
      hashStore.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error("Error clearing all metadata cache:", error);
  }
}
