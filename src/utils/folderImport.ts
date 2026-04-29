import { Song } from "@/store/playlistStore";
import { generateSongId, formatDuration } from "./songValidation";

export interface FolderImportResult {
  success: boolean;
  songs: Song[];
  errors: string[];
  totalCount: number;
  successCount: number;
}

// Supported audio formats
const SUPPORTED_AUDIO_FORMATS = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"];

// Supported image formats for cover art
const SUPPORTED_IMAGE_FORMATS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];

/**
 * Parse metadata from audio file
 * In a real implementation, this would use a library like jsmediatags
 * For now, we'll extract what we can from the filename
 */
function parseAudioMetadata(file: File): Partial<Song> {
  const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

  // Try to parse "Artist - Title" format
  const parts = fileName.split(/\s*[-–—]\s*/);

  if (parts.length >= 2) {
    return {
      title: parts[1].trim(),
      artist: parts[0].trim(),
      album: "未知专辑",
    };
  }

  // Fallback: use filename as title
  return {
    title: fileName.trim(),
    artist: "未知艺术家",
    album: "未知专辑",
  };
}

/**
 * Create a local URL for the audio file
 */
function createLocalAudioUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Process a single audio file
 */
async function processAudioFile(file: File, coverFile?: File): Promise<Song | null> {
  // Check if file is a supported audio format
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  if (!SUPPORTED_AUDIO_FORMATS.includes(extension)) {
    return null;
  }

  const metadata = parseAudioMetadata(file);

  // Get audio duration
  let duration = 0;
  try {
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    await new Promise<void>((resolve) => {
      audio.addEventListener("loadedmetadata", () => {
        duration = audio.duration;
        URL.revokeObjectURL(audio.src);
        resolve();
      });
      audio.addEventListener("error", () => {
        URL.revokeObjectURL(audio.src);
        resolve();
      });
      // Timeout after 5 seconds
      setTimeout(() => {
        URL.revokeObjectURL(audio.src);
        resolve();
      }, 5000);
    });
  } catch {
    // Use default duration
  }

  // Create cover URL if image file provided
  let coverUrl =
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop";
  if (coverFile) {
    coverUrl = URL.createObjectURL(coverFile);
  }

  return {
    id: generateSongId(),
    title: metadata.title || file.name,
    artist: metadata.artist || "未知艺术家",
    album: metadata.album || "未知专辑",
    cover: coverUrl,
    audioUrl: createLocalAudioUrl(file),
    duration: Math.round(duration) || 180, // Default 3 minutes if can't get duration
    source: "local" as const,
  };
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
export async function importSongsFromFolder(files: FileList): Promise<FolderImportResult> {
  const result: FolderImportResult = {
    success: false,
    songs: [],
    errors: [],
    totalCount: 0,
    successCount: 0,
  };

  // Separate audio and image files
  const audioFiles: File[] = [];
  const imageFiles: File[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const extension = "." + file.name.split(".").pop()?.toLowerCase();

    if (SUPPORTED_AUDIO_FORMATS.includes(extension)) {
      audioFiles.push(file);
    } else if (SUPPORTED_IMAGE_FORMATS.includes(extension)) {
      imageFiles.push(file);
    }
  }

  result.totalCount = audioFiles.length;

  if (audioFiles.length === 0) {
    result.errors.push("未找到支持的音频文件（支持格式：mp3, wav, flac, aac, ogg, m4a, wma）");
    return result;
  }

  // Process each audio file
  for (const audioFile of audioFiles) {
    try {
      const coverFile = findCoverImage(audioFile, imageFiles);
      const song = await processAudioFile(audioFile, coverFile);

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
 * Import a single song with metadata
 */
export async function importSingleSong(
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

  let coverUrl =
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop";
  if (metadata.cover) {
    coverUrl = URL.createObjectURL(metadata.cover);
  }

  // Get duration
  let duration = 0;
  try {
    const audio = new Audio();
    audio.src = URL.createObjectURL(audioFile);
    await new Promise<void>((resolve) => {
      audio.addEventListener("loadedmetadata", () => {
        duration = audio.duration;
        URL.revokeObjectURL(audio.src);
        resolve();
      });
      setTimeout(() => resolve(), 5000);
    });
  } catch {
    // Use default
  }

  const parsedMetadata = parseAudioMetadata(audioFile);

  return {
    id: generateSongId(),
    title: metadata.title || parsedMetadata.title || audioFile.name,
    artist: metadata.artist || parsedMetadata.artist || "未知艺术家",
    album: metadata.album || parsedMetadata.album || "未知专辑",
    cover: coverUrl,
    audioUrl: createLocalAudioUrl(audioFile),
    duration: Math.round(duration) || 180,
    source: "local" as const,
  };
}
