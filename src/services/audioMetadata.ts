// Audio Metadata Extraction and Cache Service
// Extracts and caches metadata from audio files (MP3, FLAC, WAV, etc.)

// @ts-ignore - jsmediatags doesn't have proper types
import jsmediatags from "jsmediatags";

export interface AudioMetadata {
  id: string;
  title: string;
  artist: string;
  album: string;
  year?: string;
  genre?: string;
  track?: number;
  duration: number;
  lyrics?: string;
  coverData?: string; // base64 encoded image
  coverFormat?: string; // image mime type
  fileName: string;
  fileType: string;
  fileSize: number;
  extractedAt: number;
}

export interface MetadataExtractionResult {
  success: boolean;
  metadata?: AudioMetadata;
  error?: string;
}

// Supported audio formats
const SUPPORTED_FORMATS = [
  "audio/mpeg",
  "audio/mp3",
  "audio/flac",
  "audio/wav",
  "audio/wave",
  "audio/aac",
  "audio/ogg",
  "audio/x-m4a",
  "audio/x-ms-wma",
  "audio/opus",
];

/**
 * Check if file is a supported audio format
 */
export function isSupportedAudioFile(file: File): boolean {
  return (
    SUPPORTED_FORMATS.includes(file.type) ||
    file.name.match(/\.(mp3|flac|wav|aac|ogg|m4a|wma|opus)$/i) !== null
  );
}

/**
 * Extract lyrics from metadata tags
 * Supports: ID3v2 USLT (Unsynchronized Lyrics), SYLT (Synchronized Lyrics)
 */
function extractLyrics(tags: any): string | undefined {
  if (!tags) return undefined;

  // Try different lyric tag formats
  const lyricSources = [
    tags.USLT?.data, // ID3v2.4 Unsynchronized Lyrics
    tags.USLT, // Direct access
    tags.SYLT?.data, // ID3v2.4 Synchronized Lyrics
    tags.SYLT,
    tags.lyrics, // Some formats use 'lyrics'
    tags.LYRICS,
  ];

  for (const source of lyricSources) {
    if (source && typeof source === "string" && source.trim().length > 0) {
      return source.trim();
    }
  }

  return undefined;
}

/**
 * Extract cover image from metadata tags
 */
function extractCoverImage(tags: any): { data: string; format: string } | undefined {
  if (!tags || !tags.picture) return undefined;

  try {
    const { data, format } = tags.picture;
    if (!data || !format) return undefined;

    const byteArray = new Uint8Array(data);
    const blob = new Blob([byteArray], { type: format });

    // Convert to base64 for storage
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve({
          data: base64,
          format: format,
        });
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    }) as any;
  } catch (error) {
    console.error("Error extracting cover image:", error);
    return undefined;
  }
}

/**
 * Get audio duration from file
 */
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    audio.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration || 0);
    });

    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      resolve(0);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(0);
    }, 10000);

    audio.src = url;
  });
}

/**
 * Parse filename for metadata fallback
 */
function parseFilename(fileName: string): { title: string; artist: string } {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");

  // Try to split by common separators: " - ", " – ", " — ", "-"
  const separators = [/\s+-\s+/, /\s+–\s+/, /\s+—\s+/];

  for (const separator of separators) {
    const parts = nameWithoutExt.split(separator);
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        title: parts[1].trim(),
      };
    }
  }

  // No separator found, use entire filename as title
  return {
    artist: "未知艺术家",
    title: nameWithoutExt.trim(),
  };
}

/**
 * Extract all metadata from an audio file
 */
export async function extractAudioMetadata(
  file: File,
  id?: string
): Promise<MetadataExtractionResult> {
  if (!isSupportedAudioFile(file)) {
    return {
      success: false,
      error: `不支持的音频格式: ${file.type || file.name}`,
    };
  }

  try {
    // Get duration first (can be done in parallel)
    const durationPromise = getAudioDuration(file);

    // Extract metadata using jsmediatags
    const metadataResult = await new Promise<AudioMetadata>((resolve, reject) => {
      jsmediatags.read(file, {
        onSuccess: async (tag: any) => {
          const tags = tag.tags || {};

          // Parse filename as fallback
          const parsedFilename = parseFilename(file.name);

          // Extract cover image
          const coverResult = await extractCoverImage(tags);

          // Build metadata object
          const metadata: AudioMetadata = {
            id: id || generateMetadataId(file),
            title: tags.title || parsedFilename.title,
            artist: tags.artist || parsedFilename.artist,
            album: tags.album || "未知专辑",
            year: tags.year?.toString(),
            genre: tags.genre,
            track: tags.track ? parseInt(tags.track, 10) : undefined,
            duration: await durationPromise,
            lyrics: extractLyrics(tags),
            coverData: coverResult?.data,
            coverFormat: coverResult?.format,
            fileName: file.name,
            fileType: file.type || getMimeTypeFromExtension(file.name),
            fileSize: file.size,
            extractedAt: Date.now(),
          };

          resolve(metadata);
        },
        onError: async (error: any) => {
          // Fallback to filename parsing if metadata extraction fails
          const parsedFilename = parseFilename(file.name);
          const duration = await durationPromise;

          resolve({
            id: id || generateMetadataId(file),
            title: parsedFilename.title,
            artist: parsedFilename.artist,
            album: "未知专辑",
            duration: duration,
            fileName: file.name,
            fileType: file.type || getMimeTypeFromExtension(file.name),
            fileSize: file.size,
            extractedAt: Date.now(),
          });
        },
      });
    });

    return {
      success: true,
      metadata: metadataResult,
    };
  } catch (error) {
    return {
      success: false,
      error: `元数据提取失败: ${error instanceof Error ? error.message : "未知错误"}`,
    };
  }
}

/**
 * Generate unique ID for metadata
 */
function generateMetadataId(file: File): string {
  // Use file name + size + last modified as unique identifier
  const hash = `${file.name}_${file.size}_${file.lastModified}`;
  return `meta_${btoa(unescape(encodeURIComponent(hash)))
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 32)}`;
}

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    flac: "audio/flac",
    wav: "audio/wav",
    aac: "audio/aac",
    ogg: "audio/ogg",
    m4a: "audio/x-m4a",
    wma: "audio/x-ms-wma",
    opus: "audio/opus",
  };
  return mimeTypes[ext || ""] || "audio/mpeg";
}

/**
 * Batch extract metadata from multiple files
 */
export async function batchExtractMetadata(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<MetadataExtractionResult[]> {
  const results: MetadataExtractionResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (!isSupportedAudioFile(file)) {
      results.push({
        success: false,
        error: `跳过不支持的文件: ${file.name}`,
      });
      continue;
    }

    const result = await extractAudioMetadata(file);
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }

  return results;
}

/**
 * Parse LRC format lyrics
 */
export function parseLRCLyrics(lrcContent: string): Array<{ time: number; text: string }> {
  const lines = lrcContent.split("\n");
  const lyrics: Array<{ time: number; text: string }> = [];

  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, "0"), 10);
      const time = minutes * 60 + seconds + milliseconds / 1000;

      const text = line.replace(timeRegex, "").trim();
      if (text) {
        lyrics.push({ time, text });
      }
    }
  }

  return lyrics.sort((a, b) => a.time - b.time);
}

/**
 * Convert metadata to Song format for playlist store
 */
export function metadataToSong(
  metadata: AudioMetadata,
  audioUrl: string,
  coverUrl?: string
): {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  lyrics?: string;
  duration: number;
  source: "local";
} {
  return {
    id: metadata.id,
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    cover: coverUrl || metadata.coverData || "/default-cover.svg",
    audioUrl: audioUrl,
    lyrics: metadata.lyrics,
    duration: Math.round(metadata.duration) || 180,
    source: "local" as const,
  };
}
