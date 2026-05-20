import type { Song } from "@/types/song";
import { getStoredMusic } from "@/services/localMusicStorage";
import { getFileFromStorage } from "@/services/localMusicService";

export interface DSDSourceBlob {
  blob: Blob;
  sourceLabel: string;
}

function stripProtocol(value: string, protocol: string): string {
  return value.slice(protocol.length).split(/[?#]/, 1)[0];
}

function assertReadableBlob(blob: Blob, songTitle: string): Blob {
  if (blob.size <= 0) {
    throw new Error(`DSD source file is empty for ${songTitle}`);
  }
  return blob;
}

export async function resolveDSDSourceBlob(
  song: Pick<Song, "id" | "title" | "audioUrl">
): Promise<DSDSourceBlob> {
  const audioUrl = song.audioUrl?.trim();

  if (!audioUrl) {
    throw new Error(`No audio source available for ${song.title}`);
  }

  if (audioUrl.startsWith("stored://")) {
    const id = stripProtocol(audioUrl, "stored://") || song.id;
    const stored = await getStoredMusic(id);
    if (!stored) {
      throw new Error(`Stored DSD file not found for ${song.title}`);
    }

    return {
      blob: assertReadableBlob(new Blob([stored.fileData], { type: stored.fileType }), song.title),
      sourceLabel: stored.fileName || `stored://${id}`,
    };
  }

  if (audioUrl.startsWith("local://")) {
    const id = stripProtocol(audioUrl, "local://") || song.id;
    const file = await getFileFromStorage(id);
    if (!file) {
      throw new Error(`Local DSD file not found for ${song.title}`);
    }

    return {
      blob: assertReadableBlob(new Blob([file.data], { type: file.type }), song.title),
      sourceLabel: `local://${id}`,
    };
  }

  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Unable to load DSD source for ${song.title} (${response.status})`);
  }

  return {
    blob: assertReadableBlob(await response.blob(), song.title),
    sourceLabel: audioUrl,
  };
}
