// S6-12e: the persisted-queue model types and song sanitizers live here so
// queueStore.ts stays inside the 400-line store budget (scripts/check-store-budgets.mjs).
// The store re-exports HistorySong, so its public surface is unchanged.

import type { Song } from "@/types/song";

export interface HistorySong {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  cover?: string;
  playedAt: number;
}

export type PersistedQueueSong = Pick<
  Song,
  "id" | "title" | "artist" | "album" | "duration" | "cover" | "source" | "audioUrl"
>;

export type MinimalPersistedQueueSong = Pick<
  PersistedQueueSong,
  "id" | "title" | "artist" | "duration"
>;

function sanitizePersistedAudioUrl(audioUrl?: string): string | undefined {
  const trimmed = audioUrl?.trim();
  if (!trimmed || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return undefined;
  }
  return trimmed;
}

export function sanitizePersistedSong(song: Song): PersistedQueueSong {
  const sanitizedCover = song.cover?.startsWith("data:image/") ? "" : song.cover;

  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
    cover: sanitizedCover,
    source: song.source,
    audioUrl: sanitizePersistedAudioUrl(song.audioUrl),
  };
}

export type PersistedQueueSongLike = PersistedQueueSong | MinimalPersistedQueueSong;

export function toMinimalPersistedSong(song: PersistedQueueSongLike): MinimalPersistedQueueSong {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    duration: song.duration,
  };
}
