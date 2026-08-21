// Audio Metadata Extraction and Cache Service
// Extracts and caches metadata from audio files (MP3, FLAC, WAV, etc.)

import jsmediatags, { type MediaTags, type MediaTagResult } from "jsmediatags";

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

const UNKNOWN_ARTIST = "\u672a\u77e5\u827a\u672f\u5bb6";
const UNKNOWN_ALBUM = "\u672a\u77e5\u4e13\u8f91";
const UNKNOWN_ERROR = "\u672a\u77e5\u9519\u8bef";

function getLyricText(source: MediaTags["USLT"]): string | undefined {
  if (typeof source === "string") return source;
  return source?.data;
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
function extractLyrics(tags: MediaTags): string | undefined {
  if (!tags) return undefined;

  // Try different lyric tag formats
  const lyricSources = [
    getLyricText(tags.USLT), // ID3v2.4 Unsynchronized Lyrics
    getLyricText(tags.SYLT), // ID3v2.4 Synchronized Lyrics
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
async function extractCoverImage(
  tags: MediaTags
): Promise<{ data: string; format: string } | undefined> {
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
    });
  } catch (error: unknown) {
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
    let settled = false;
    function finish(duration: number) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      resolve(duration);
    }

    audio.addEventListener("loadedmetadata", () => {
      finish(audio.duration || 0);
    });

    audio.addEventListener("error", () => {
      finish(0);
    });

    // Timeout after 10 seconds
    const timeoutId = setTimeout(() => {
      finish(0);
    }, 10000);

    audio.src = url;
  });
}

/**
 * Parse filename for metadata fallback
 */
function parseFilename(fileName: string): { title: string; artist: string } {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");

  // Common local music names use artist/title separators such as -, en dash, or em dash.
  const parts = nameWithoutExt.split(/\s+[-\u2013\u2014]\s+/);
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim() || UNKNOWN_ARTIST,
      title: parts.slice(1).join(" - ").trim() || nameWithoutExt.trim(),
    };
  }

  // No separator found, use entire filename as title
  return {
    artist: UNKNOWN_ARTIST,
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
      error: `\u4e0d\u652f\u6301\u7684\u97f3\u9891\u683c\u5f0f: ${file.type || file.name}`,
    };
  }

  try {
    // Get duration first (can be done in parallel)
    const durationPromise = getAudioDuration(file);

    // Extract metadata using jsmediatags
    const metadataResult = await new Promise<AudioMetadata>((resolve) => {
      jsmediatags.read(file, {
        onSuccess: async (tag: MediaTagResult) => {
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
            album: tags.album || UNKNOWN_ALBUM,
            year: tags.year?.toString(),
            genre: tags.genre,
            track: tags.track ? parseInt(String(tags.track), 10) : undefined,
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
        onError: async () => {
          // Fallback to filename parsing if metadata extraction fails
          const parsedFilename = parseFilename(file.name);
          const duration = await durationPromise;

          resolve({
            id: id || generateMetadataId(file),
            title: parsedFilename.title,
            artist: parsedFilename.artist,
            album: UNKNOWN_ALBUM,
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
  } catch (error: unknown) {
    return {
      success: false,
      error: `\u5143\u6570\u636e\u8bfb\u53d6\u5931\u8d25: ${error instanceof Error ? error.message : UNKNOWN_ERROR}`,
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
        error: `\u6587\u4ef6\u4e0d\u53d7\u652f\u6301: ${file.name}`,
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
