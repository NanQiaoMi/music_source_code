import { Song } from "@/types/song";
import { generateSongId } from "@/utils/songValidation";

// @ts-ignore - jsmediatags doesn't have proper types
import jsmediatags from "jsmediatags";

// Storage keys
const LOCAL_MUSIC_KEY = "vibe_music_local_library";
const LOCAL_MUSIC_METADATA_KEY = "vibe_music_local_metadata";

// Supported audio formats
const SUPPORTED_AUDIO_FORMATS = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".opus"];

export interface LocalMusicMetadata {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  fileName: string;
  fileSize: number;
  uploadTime: number;
  coverData?: string; // Base64 encoded cover image
}

export interface UploadResult {
  success: boolean;
  song?: Song;
  error?: string;
}

export interface BatchUploadResult {
  success: boolean;
  songs: Song[];
  errors: string[];
  totalCount: number;
  successCount: number;
}

/**
 * Extract metadata from audio file using jsmediatags
 */
function extractMetadata(file: File): Promise<{
  title: string;
  artist: string;
  album: string;
  coverData?: string;
}> {
  return new Promise((resolve) => {
    const defaultResult = {
      title: "",
      artist: "",
      album: "",
    };

    // Try to parse from filename first as fallback
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    const parts = fileName.split(/\s*[-–—]\s*/);

    if (parts.length >= 2) {
      defaultResult.artist = parts[0].trim();
      defaultResult.title = parts[1].trim();
    } else {
      defaultResult.title = fileName.trim();
      defaultResult.artist = "未知艺术家";
    }
    defaultResult.album = "未知专辑";

    // Use jsmediatags to extract metadata
    jsmediatags.read(file, {
      onSuccess: (tag: any) => {
        const tags = tag.tags;

        // Extract cover image if available
        let coverData: string | undefined;
        if (tags.picture) {
          const { data, format } = tags.picture;
          const byteArray = new Uint8Array(data);
          const blob = new Blob([byteArray], { type: format });
          coverData = URL.createObjectURL(blob);
        }

        resolve({
          title: tags.title || defaultResult.title,
          artist: tags.artist || defaultResult.artist,
          album: tags.album || defaultResult.album,
          coverData,
        });
      },
      onError: () => {
        // Fallback to filename parsing
        resolve(defaultResult);
      },
    });
  });
}

/**
 * Get audio duration
 */
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    audio.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });

    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      resolve(0);
    });

    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(0);
    }, 5000);

    audio.src = url;
  });
}

/**
 * Save file to IndexedDB
 */
async function saveFileToStorage(id: string, file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const request = indexedDB.open("VibeMusicDB", 1);

    request.onerror = () => resolve(false);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("musicFiles")) {
        db.createObjectStore("musicFiles", { keyPath: "id" });
      }
    };

    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const transaction = db.transaction(["musicFiles"], "readwrite");
      const store = transaction.objectStore("musicFiles");

      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const storeRequest = store.put({
          id,
          data: arrayBuffer,
          type: file.type,
          name: file.name,
        });

        storeRequest.onsuccess = () => resolve(true);
        storeRequest.onerror = () => resolve(false);
      };

      reader.onerror = () => resolve(false);
      reader.readAsArrayBuffer(file);
    };
  });
}

/**
 * Get file from IndexedDB
 */
export async function getFileFromStorage(
  id: string
): Promise<{ data: ArrayBuffer; type: string } | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open("VibeMusicDB", 1);

    request.onerror = () => resolve(null);

    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const transaction = db.transaction(["musicFiles"], "readonly");
      const store = transaction.objectStore("musicFiles");
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        if (getRequest.result) {
          resolve({
            data: getRequest.result.data,
            type: getRequest.result.type,
          });
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = () => resolve(null);
    };
  });
}

/**
 * Save metadata to localStorage
 */
function saveMetadata(metadata: LocalMusicMetadata): void {
  const existing = getAllMetadata();
  const index = existing.findIndex((m) => m.id === metadata.id);

  if (index >= 0) {
    existing[index] = metadata;
  } else {
    existing.push(metadata);
  }

  try {
    localStorage.setItem(LOCAL_MUSIC_METADATA_KEY, JSON.stringify(existing));
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.error("Local music metadata exceeds storage quota. Try deleting some local files.");
    } else {
      console.error("Failed to save local music metadata:", error);
    }
  }
}

/**
 * Get all metadata from localStorage
 */
export function getAllMetadata(): LocalMusicMetadata[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(LOCAL_MUSIC_METADATA_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Delete metadata from localStorage
 */
function deleteMetadata(id: string): void {
  const existing = getAllMetadata();
  const filtered = existing.filter((m) => m.id !== id);
  localStorage.setItem(LOCAL_MUSIC_METADATA_KEY, JSON.stringify(filtered));
}

/**
 * Delete file from IndexedDB
 */
async function deleteFileFromStorage(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = indexedDB.open("VibeMusicDB", 1);

    request.onerror = () => resolve(false);

    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const transaction = db.transaction(["musicFiles"], "readwrite");
      const store = transaction.objectStore("musicFiles");
      const deleteRequest = store.delete(id);

      deleteRequest.onsuccess = () => resolve(true);
      deleteRequest.onerror = () => resolve(false);
    };
  });
}

/**
 * Upload a single music file
 */
export async function uploadMusicFile(file: File): Promise<UploadResult> {
  // Validate file type
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!SUPPORTED_AUDIO_FORMATS.includes(extension)) {
    return {
      success: false,
      error: `不支持的文件格式: ${extension}。支持的格式: ${SUPPORTED_AUDIO_FORMATS.join(", ")}`,
    };
  }

  try {
    // Extract metadata
    const metadata = await extractMetadata(file);
    const duration = await getAudioDuration(file);

    // Generate unique ID
    const id = generateSongId();

    // Save file to IndexedDB
    const saved = await saveFileToStorage(id, file);
    if (!saved) {
      return {
        success: false,
        error: "文件存储失败",
      };
    }

    // Save metadata
    const musicMetadata: LocalMusicMetadata = {
      id,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      duration: Math.round(duration) || 180,
      fileName: file.name,
      fileSize: file.size,
      uploadTime: Date.now(),
      coverData: metadata.coverData,
    };
    saveMetadata(musicMetadata);

    // Create song object
    const song: Song = {
      id,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      cover:
        metadata.coverData ||
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
      audioUrl: `local://${id}`, // Special protocol to indicate local file
      duration: Math.round(duration) || 180,
      source: "local",
    };

    return {
      success: true,
      song,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传失败",
    };
  }
}

/**
 * Batch upload music files
 */
export async function batchUploadMusicFiles(files: FileList): Promise<BatchUploadResult> {
  const result: BatchUploadResult = {
    success: false,
    songs: [],
    errors: [],
    totalCount: files.length,
    successCount: 0,
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const uploadResult = await uploadMusicFile(file);

    if (uploadResult.success && uploadResult.song) {
      result.songs.push(uploadResult.song);
      result.successCount++;
    } else {
      result.errors.push(`${file.name}: ${uploadResult.error}`);
    }
  }

  result.success = result.successCount > 0;
  return result;
}

/**
 * Get all local songs
 */
export async function getAllLocalSongs(): Promise<Song[]> {
  const metadata = getAllMetadata();
  const songs: Song[] = [];

  for (const meta of metadata) {
    // Check if file still exists
    const file = await getFileFromStorage(meta.id);
    if (file) {
      songs.push({
        id: meta.id,
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        cover:
          meta.coverData ||
          "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
        audioUrl: `local://${meta.id}`,
        duration: meta.duration,
        source: "local",
      });
    } else {
      // Clean up orphaned metadata
      deleteMetadata(meta.id);
    }
  }

  return songs;
}

/**
 * Delete a local song
 */
export async function deleteLocalSong(id: string): Promise<boolean> {
  await deleteFileFromStorage(id);
  deleteMetadata(id);
  return true;
}

/**
 * Get audio URL for local file
 */
export async function getLocalAudioUrl(id: string): Promise<string | null> {
  const file = await getFileFromStorage(id);
  if (!file) return null;

  const blob = new Blob([file.data], { type: file.type });
  return URL.createObjectURL(blob);
}

/**
 * Update song metadata
 */
export function updateLocalSongMetadata(id: string, updates: Partial<LocalMusicMetadata>): boolean {
  const metadata = getAllMetadata();
  const index = metadata.findIndex((m) => m.id === id);

  if (index >= 0) {
    metadata[index] = { ...metadata[index], ...updates };
    localStorage.setItem(LOCAL_MUSIC_METADATA_KEY, JSON.stringify(metadata));
    return true;
  }

  return false;
}

/**
 * Check if a file is a supported audio file
 */
export function isSupportedAudioFile(file: File): boolean {
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  return SUPPORTED_AUDIO_FORMATS.includes(extension);
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
