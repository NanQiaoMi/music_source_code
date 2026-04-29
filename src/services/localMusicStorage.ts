// Local Music Storage Service using IndexedDB
// This provides persistent storage for local music files

const DB_NAME = "VibeMusicDB";
const DB_VERSION = 1;
const STORE_NAME = "localMusic";
const METADATA_STORE = "musicMetadata";

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

// Open IndexedDB connection
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
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
    };
  });
};

// Save music file to IndexedDB
export const saveMusicFile = async (music: StoredMusic): Promise<void> => {
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
export const getStoredMusic = async (id: string): Promise<StoredMusic | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

// Delete a music file
export const deleteStoredMusic = async (id: string): Promise<void> => {
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
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Create blob URL from stored music
export const createBlobUrlFromStoredMusic = (music: StoredMusic): string => {
  const blob = new Blob([music.fileData], { type: music.fileType });
  return URL.createObjectURL(blob);
};
