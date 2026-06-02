import { Song } from "@/types/song";
import { hasPlayableAudioSource } from "./playableAudioSource";

export interface RestoredPlaybackSession {
  queue: Song[];
  currentIndex: number;
  currentSong: Song;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function mergeQueuedSong(queuedSong: Song, librarySong?: Song): Song {
  if (!librarySong) return queuedSong;

  return {
    ...librarySong,
    ...queuedSong,
    album: queuedSong.album || librarySong.album,
    cover: queuedSong.cover || librarySong.cover,
    audioUrl: queuedSong.audioUrl || librarySong.audioUrl,
    lyrics: queuedSong.lyrics || librarySong.lyrics,
    duration: queuedSong.duration || librarySong.duration,
    source: queuedSong.source || librarySong.source,
  };
}

export function resolveRestoredPlaybackSession(
  persistedQueue: Song[],
  persistedIndex: number,
  librarySongs: Song[]
): RestoredPlaybackSession | null {
  if (persistedQueue.length === 0) return null;

  const libraryById = new Map(librarySongs.map((song) => [song.id, song]));
  const restoredQueue = persistedQueue.map((queuedSong) =>
    mergeQueuedSong(queuedSong, libraryById.get(queuedSong.id))
  );

  const preferredIndex = clampIndex(persistedIndex, restoredQueue.length);
  const preferredSong = restoredQueue[preferredIndex];
  const currentIndex = hasPlayableAudioSource(preferredSong)
    ? preferredIndex
    : restoredQueue.findIndex(hasPlayableAudioSource);

  if (currentIndex < 0) return null;

  return {
    queue: restoredQueue,
    currentIndex,
    currentSong: restoredQueue[currentIndex],
  };
}
