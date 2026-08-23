import type { Song } from "@/types/song";
import { getStoredMusic, getOfflineAudio } from "@/services/localMusicStorage";
import { getFileFromStorage } from "@/services/localMusicService";

export interface AudioSourceBlob {
  blob: Blob;
  sourceLabel: string;
  inferredFormat: string;
}

const MIME_FORMATS: Record<string, string> = {
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-flac": "flac",
  "audio/x-m4a": "m4a",
  "audio/x-wav": "wav",
};

function stripProtocol(value: string, protocol: string): string {
  return value.slice(protocol.length).split(/[?#]/, 1)[0];
}

function extensionFrom(value?: string): string | null {
  const clean = value?.split(/[?#]/, 1)[0].trim().toLowerCase();
  const match = clean?.match(/\.([a-z0-9]+)$/);
  return match?.[1] || null;
}

function inferFormat(format?: string, fileName?: string, mimeType?: string, url?: string): string {
  const normalized = format?.trim().toLowerCase().replace(/^\./, "");
  if (normalized && /^[a-z0-9]+$/.test(normalized)) return normalized;

  const extension = extensionFrom(fileName) || extensionFrom(url);
  if (extension) return extension;

  const mimeFormat = mimeType ? MIME_FORMATS[mimeType.toLowerCase()] : undefined;
  return mimeFormat || "mp3";
}

function assertReadableBlob(blob: Blob, songTitle: string): Blob {
  if (blob.size <= 0) {
    throw new Error(`Audio source file is empty for ${songTitle}`);
  }
  return blob;
}

export async function resolveAudioSourceBlob(
  song: Pick<Song, "id" | "title" | "audioUrl" | "format">
): Promise<AudioSourceBlob> {
  // 0. 优先检查离线下载缓存 (Instant offline blob playback)
  try {
    const offline = await getOfflineAudio(String(song.id));
    if (offline && offline.fileData && offline.fileData.byteLength > 1000) {
      return {
        blob: assertReadableBlob(new Blob([offline.fileData], { type: offline.mimeType || "audio/mpeg" }), song.title),
        sourceLabel: `offline://${song.id}`,
        inferredFormat: inferFormat(song.format, undefined, offline.mimeType, "offline"),
      };
    }
  } catch {
    // Fallback to standard flow
  }

  const audioUrl = song.audioUrl?.trim();

  if (!audioUrl) {
    throw new Error(`No audio source available for ${song.title}`);
  }

  if (audioUrl.startsWith("stored://")) {
    const id = stripProtocol(audioUrl, "stored://") || song.id;
    const stored = await getStoredMusic(id);
    if (!stored) {
      throw new Error(`Stored audio file not found for ${song.title}`);
    }

    return {
      blob: assertReadableBlob(new Blob([stored.fileData], { type: stored.fileType }), song.title),
      sourceLabel: stored.fileName || `stored://${id}`,
      inferredFormat: inferFormat(song.format, stored.fileName, stored.fileType, audioUrl),
    };
  }

  if (audioUrl.startsWith("local://")) {
    const id = stripProtocol(audioUrl, "local://") || song.id;
    const file = await getFileFromStorage(id);
    if (!file) {
      throw new Error(`Local audio file not found for ${song.title}`);
    }

    return {
      blob: assertReadableBlob(new Blob([file.data], { type: file.type }), song.title),
      sourceLabel: `local://${id}`,
      inferredFormat: inferFormat(song.format, undefined, file.type, audioUrl),
    };
  }

  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Unable to load audio source for ${song.title} (${response.status})`);
  }

  const blob = await response.blob();
  return {
    blob: assertReadableBlob(blob, song.title),
    sourceLabel: audioUrl,
    inferredFormat: inferFormat(song.format, undefined, blob.type, audioUrl),
  };
}
