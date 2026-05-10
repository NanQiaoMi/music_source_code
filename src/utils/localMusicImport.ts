import { Song } from "@/types/song";
import { generateSongId, formatDuration } from "./songValidation";
import { associateLyricsWithAudioFiles, isLyricsFile } from "@/services/lyricsService";

// @ts-ignore - jsmediatags doesn't have proper types
import jsmediatags from "jsmediatags";

export interface LocalImportResult {
  success: boolean;
  songs: Song[];
  errors: string[];
  totalCount: number;
  successCount: number;
}

// Supported audio formats
const SUPPORTED_AUDIO_FORMATS = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".opus"];

// Supported image formats for cover art
const SUPPORTED_IMAGE_FORMATS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];

// Supported lyrics formats
const SUPPORTED_LYRICS_FORMATS = [".lrc"];

/**
 * Extract metadata from audio file using jsmediatags
 */
function extractMetadata(file: File): Promise<{
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover?: string;
}> {
  return new Promise((resolve) => {
    const defaultResult = {
      title: "",
      artist: "",
      album: "",
      duration: 0,
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

        // Extract cover image if available and convert to base64
        let coverData: string | undefined;
        if (tags.picture) {
          const { data, format } = tags.picture;
          const byteArray = new Uint8Array(data);
          // Convert to base64 for persistent storage
          const base64 = btoa(String.fromCharCode.apply(null, byteArray as unknown as number[]));
          coverData = `data:${format};base64,${base64}`;
        }

        resolve({
          title: tags.title || defaultResult.title,
          artist: tags.artist || defaultResult.artist,
          album: tags.album || defaultResult.album,
          duration: 0, // Will be extracted separately
          cover: coverData,
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

    // Timeout after 5 seconds
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(0);
    }, 5000);

    audio.src = url;
  });
}

/**
 * Create a local URL for the audio file
 * Note: This creates a temporary blob URL. For persistent storage,
 * the file should be saved to IndexedDB and referenced by ID.
 */
function createLocalAudioUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Generate a unique local file ID
 */
function generateLocalFileId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Process a single audio file with full metadata extraction
 */
async function processAudioFile(
  file: File,
  coverFile?: File,
  lyricsContent?: string
): Promise<Song | null> {
  // Check if file is a supported audio format
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!SUPPORTED_AUDIO_FORMATS.includes(extension)) {
    return null;
  }

  try {
    // Extract metadata from file
    const metadata = await extractMetadata(file);

    // Get audio duration
    const duration = await getAudioDuration(file);

    // Handle cover image priority: embedded > external file > default
    let coverUrl = metadata.cover;
    if (!coverUrl && coverFile) {
      coverUrl = URL.createObjectURL(coverFile);
    }
    if (!coverUrl) {
      coverUrl =
        "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop";
    }

    return {
      id: generateSongId(),
      title: metadata.title || file.name,
      artist: metadata.artist || "未知艺术家",
      album: metadata.album || "未知专辑",
      cover: coverUrl,
      audioUrl: createLocalAudioUrl(file),
      lyrics: lyricsContent, // Add lyrics if available
      duration: Math.round(duration) || 180,
      source: "local" as const,
    };
  } catch (error) {
    console.error("Error processing file:", file.name, error);
    return null;
  }
}

/**
 * Find matching cover image for an audio file
 */
function findCoverImage(audioFile: File, imageFiles: File[]): File | undefined {
  const audioName = audioFile.name.replace(/\.[^/.]+$/, "").toLowerCase();

  // Look for exact match
  const exactMatch = imageFiles.find((img) => {
    const imgName = img.name.replace(/\.[^/.]+$/, "").toLowerCase();
    return (
      imgName === audioName ||
      imgName === audioName + "_cover" ||
      imgName === audioName + "_art" ||
      imgName === "cover" ||
      imgName === "folder"
    );
  });

  if (exactMatch) return exactMatch;

  // Look for any image in the same "folder" (files with similar names)
  return imageFiles.find((img) => {
    const imgName = img.name.replace(/\.[^/.]+$/, "").toLowerCase();
    return imgName.includes(audioName) || audioName.includes(imgName);
  });
}

/**
 * Import songs from a folder (FileList from input)
 */
export async function importLocalSongs(files: FileList): Promise<LocalImportResult> {
  const result: LocalImportResult = {
    success: false,
    songs: [],
    errors: [],
    totalCount: 0,
    successCount: 0,
  };

  // Separate audio, image, and lyrics files
  const audioFiles: File[] = [];
  const imageFiles: File[] = [];
  const allFiles: File[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const extension = "." + file.name.split(".").pop()?.toLowerCase();

    allFiles.push(file);

    if (SUPPORTED_AUDIO_FORMATS.includes(extension)) {
      audioFiles.push(file);
    } else if (SUPPORTED_IMAGE_FORMATS.includes(extension)) {
      imageFiles.push(file);
    }
  }

  result.totalCount = audioFiles.length;

  if (audioFiles.length === 0) {
    result.errors.push(
      "未找到支持的音频文件（支持格式：mp3, wav, flac, aac, ogg, m4a, wma, opus）"
    );
    return result;
  }

  // Associate lyrics files with audio files
  let lyricsAssociations: Map<string, string> = new Map();
  try {
    lyricsAssociations = await associateLyricsWithAudioFiles(audioFiles, allFiles);
  } catch (error) {
    console.warn("Failed to associate lyrics files:", error);
  }

  // Process each audio file with progress tracking
  for (let i = 0; i < audioFiles.length; i++) {
    const audioFile = audioFiles[i];
    try {
      const coverFile = findCoverImage(audioFile, imageFiles);
      // Get associated lyrics content if available
      const lyricsContent = lyricsAssociations.get(audioFile.name);
      const song = await processAudioFile(audioFile, coverFile, lyricsContent);

      if (song) {
        result.songs.push(song);
        result.successCount++;
      } else {
        result.errors.push(`处理失败: ${audioFile.name}`);
      }
    } catch (error) {
      result.errors.push(
        `错误 - ${audioFile.name}: ${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  result.success = result.successCount > 0;
  return result;
}

/**
 * Import a single song with manual metadata
 */
export async function importSingleLocalSong(
  audioFile: File,
  metadata: {
    title?: string;
    artist?: string;
    album?: string;
    cover?: File;
  }
): Promise<Song | null> {
  const extension = "." + audioFile.name.split(".").pop()?.toLowerCase();
  if (!SUPPORTED_AUDIO_FORMATS.includes(extension)) {
    return null;
  }

  // Get embedded metadata
  const embeddedMetadata = await extractMetadata(audioFile);

  // Get duration
  const duration = await getAudioDuration(audioFile);

  // Handle cover image
  let coverUrl = embeddedMetadata.cover;
  if (!coverUrl && metadata.cover) {
    coverUrl = URL.createObjectURL(metadata.cover);
  }
  if (!coverUrl) {
    coverUrl = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop";
  }

  return {
    id: generateSongId(),
    title: metadata.title || embeddedMetadata.title || audioFile.name,
    artist: metadata.artist || embeddedMetadata.artist || "未知艺术家",
    album: metadata.album || embeddedMetadata.album || "未知专辑",
    cover: coverUrl,
    audioUrl: createLocalAudioUrl(audioFile),
    duration: Math.round(duration) || 180,
    source: "local" as const,
  };
}

/**
 * Validate audio file
 */
export function isValidAudioFile(file: File): boolean {
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  return SUPPORTED_AUDIO_FORMATS.includes(extension);
}

/**
 * Get file extension
 */
export function getFileExtension(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() || "";
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
