import { Song } from "@/types/song";

export interface QueueSlice {
  queue: Song[];
  currentIndex: number;
}

function clampQueueIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

/**
 * Insert a song directly after the current song.
 * Returns the new queue and adjusted currentIndex.
 */
export function playNext(state: QueueSlice, song: Song): QueueSlice {
  if (state.queue.length === 0) {
    return { queue: [song], currentIndex: 0 };
  }

  const currentIndex = clampQueueIndex(state.currentIndex, state.queue.length);
  const newQueue = [...state.queue];
  newQueue.splice(currentIndex + 1, 0, song);
  return { queue: newQueue, currentIndex };
}

/**
 * Remove all songs after the currently playing song.
 */
export function clearAfterCurrent(state: QueueSlice): QueueSlice {
  if (state.queue.length === 0) return { queue: [], currentIndex: 0 };

  const currentIndex = clampQueueIndex(state.currentIndex, state.queue.length);
  return {
    queue: state.queue.slice(0, currentIndex + 1),
    currentIndex,
  };
}

/**
 * Remove multiple songs by their IDs.
 * Adjusts currentIndex to keep the same song playing.
 */
export function bulkRemove(state: QueueSlice, ids: string[]): QueueSlice {
  if (ids.length === 0) {
    return {
      queue: state.queue,
      currentIndex: clampQueueIndex(state.currentIndex, state.queue.length),
    };
  }

  const currentIndex = clampQueueIndex(state.currentIndex, state.queue.length);
  const idSet = new Set(ids);
  const currentSong = state.queue[currentIndex];
  const newQueue = state.queue.filter((song) => !idSet.has(song.id));

  if (newQueue.length === 0) {
    return { queue: [], currentIndex: 0 };
  }

  if (currentSong && !idSet.has(currentSong.id)) {
    const nextIndex = newQueue.findIndex((song) => song.id === currentSong.id);
    return { queue: newQueue, currentIndex: clampQueueIndex(nextIndex, newQueue.length) };
  }

  return { queue: newQueue, currentIndex: clampQueueIndex(currentIndex, newQueue.length) };
}

/**
 * Shuffle only the songs after the current song (preserving what is playing).
 * Uses Fisher-Yates on the tail portion.
 */
export function shuffleAfter(state: QueueSlice): QueueSlice {
  if (state.queue.length === 0) return { queue: [], currentIndex: 0 };

  const currentIndex = clampQueueIndex(state.currentIndex, state.queue.length);
  if (state.queue.length <= currentIndex + 1) return { queue: state.queue, currentIndex };

  const head = state.queue.slice(0, currentIndex + 1);
  const tail = [...state.queue.slice(currentIndex + 1)];

  for (let i = tail.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tail[i], tail[j]] = [tail[j], tail[i]];
  }

  return { queue: [...head, ...tail], currentIndex };
}

/**
 * Remove duplicate songs from the queue (keeping first occurrence).
 * Adjusts currentIndex to keep the same song playing.
 */
export function dedupe(state: QueueSlice): QueueSlice {
  if (state.queue.length === 0) return { queue: [], currentIndex: 0 };

  const currentIndex = clampQueueIndex(state.currentIndex, state.queue.length);
  const currentSong = state.queue[currentIndex];
  const seen = new Set<string>();
  const newQueue: Song[] = [];

  for (const song of state.queue) {
    if (!seen.has(song.id)) {
      seen.add(song.id);
      newQueue.push(song);
    }
  }

  if (newQueue.length === 0) return { queue: [], currentIndex: 0 };

  const nextIndex = currentSong ? newQueue.findIndex((song) => song.id === currentSong.id) : 0;
  return { queue: newQueue, currentIndex: clampQueueIndex(nextIndex, newQueue.length) };
}
