/**
 * MimiMusic IndexedDB Storage Adapter
 *
 * High-performance, quota-free asynchronous storage adapter for Zustand persist
 * middleware and application-wide heavy caching (playlists, history, audio blobs).
 */

import { StateStorage } from "zustand/middleware";

const DEFAULT_DB_NAME = "MimiMusicStorageDB";
const DEFAULT_STORE_NAME = "keyval";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDBDatabase(dbName = DEFAULT_DB_NAME, storeName = DEFAULT_STORE_NAME): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not available in current environment"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(dbName, DB_VERSION);

        request.onerror = () => {
          console.warn("[IndexedDB] Failed to open database:", request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  return dbPromise;
}

export const indexedDbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return null;
    }
    try {
      const db = await getIDBDatabase();
      return new Promise((resolve) => {
        try {
          const transaction = db.transaction([DEFAULT_STORE_NAME], "readonly");
          const store = transaction.objectStore(DEFAULT_STORE_NAME);
          const request = store.get(name);

          request.onsuccess = () => {
            const result = request.result;
            resolve(typeof result === "string" ? result : null);
          };

          request.onerror = () => {
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      });
    } catch {
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return;
    }
    try {
      const db = await getIDBDatabase();
      return new Promise((resolve, reject) => {
        try {
          const transaction = db.transaction([DEFAULT_STORE_NAME], "readwrite");
          const store = transaction.objectStore(DEFAULT_STORE_NAME);
          const request = store.put(value, name);

          request.onsuccess = () => resolve();
          request.onerror = () => {
            console.warn(`[IndexedDB] Failed to setItem '${name}':`, request.error);
            resolve(); // Do not throw to avoid unhandled rejections
          };
        } catch (err) {
          console.warn(`[IndexedDB] Transaction error for '${name}':`, err);
          resolve();
        }
      });
    } catch (err) {
      console.warn(`[IndexedDB] Database access error for '${name}':`, err);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return;
    }
    try {
      const db = await getIDBDatabase();
      return new Promise((resolve) => {
        try {
          const transaction = db.transaction([DEFAULT_STORE_NAME], "readwrite");
          const store = transaction.objectStore(DEFAULT_STORE_NAME);
          const request = store.delete(name);

          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } catch {
      // Ignored
    }
  },
};

/**
 * Safe LocalStorage StateStorage with quota handling and silent fallback
 */
export const safeLocalStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },

  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
    } catch (e: unknown) {
      const err = e as { name?: string; code?: number } | null;
      if (
        err &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          err.code === 22 ||
          err.code === 1014)
      ) {
        // Offload to IndexedDB silently if LocalStorage is full
        (indexedDbStorage.setItem(name, value) as Promise<void>).catch?.(() => {});
      }
    }
  },

  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Ignored
    }
  },
};
