import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  bulkRemove,
  clearAfterCurrent,
  dedupe,
  playNext,
  shuffleAfter,
} from "@/lib/queue/queueActions";
import { Song } from "@/types/song";

export interface HistorySong {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  cover?: string;
  playedAt: number;
}

type PersistedQueueSong = Pick<
  Song,
  "id" | "title" | "artist" | "album" | "duration" | "cover" | "source" | "audioUrl"
>;

type MinimalPersistedQueueSong = Pick<PersistedQueueSong, "id" | "title" | "artist" | "duration">;

function sanitizePersistedAudioUrl(audioUrl?: string): string | undefined {
  const trimmed = audioUrl?.trim();
  if (!trimmed || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return undefined;
  }
  return trimmed;
}

function sanitizePersistedSong(song: Song): PersistedQueueSong {
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

function toMinimalPersistedSong(song: PersistedQueueSong): MinimalPersistedQueueSong {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    duration: song.duration,
  };
}

function clonePersistedValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function tryPersistQueueState(name: string, value: unknown) {
  const serialized = JSON.stringify(value);
  const currentValue = localStorage.getItem(name);
  if (currentValue && currentValue.length > serialized.length) {
    localStorage.removeItem(name);
  }
  localStorage.setItem(name, serialized);
}

function retryPersistQueueState(name: string, value: unknown) {
  localStorage.removeItem(name);
  tryPersistQueueState(name, value);
}

function isQuotaExceededError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "QuotaExceededError"
  );
}

function clampQueueIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

interface QueueState {
  queue: Song[];
  currentIndex: number;
  history: HistorySong[];
  playThroughMode: "normal" | "play-through";

  setQueue: (songs: Song[]) => void;
  setCurrentIndex: (index: number) => void;
  addToQueue: (song: Song) => void;
  insertNext: (song: Song) => void;
  playNext: (song: Song) => void;
  clearAfterCurrent: () => void;
  bulkRemove: (ids: string[]) => void;
  dedupeQueue: () => void;
  shuffleAfterCurrent: () => void;
  moveToNext: (index: number) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  removeFromQueueById: (id: string) => void;
  removeMultipleFromQueue: (indices: number[]) => void;
  clearQueue: () => void;
  clearPlayed: () => void;
  addToHistory: (song: Song) => void;
  clearHistory: () => void;

  nextSong: () => Song | null;
  prevSong: () => Song | null;
  getCurrentSong: () => Song | null;
  shuffleQueue: () => void;
  setPlayThroughMode: (mode: "normal" | "play-through") => void;
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: 0,
      history: [],
      playThroughMode: "normal",

      setQueue: (songs) =>
        set((state) => ({
          queue: songs,
          currentIndex: clampQueueIndex(state.currentIndex, songs.length),
        })),

      setCurrentIndex: (index) =>
        set((state) => ({
          currentIndex: clampQueueIndex(index, state.queue.length),
        })),

      addToQueue: (song) =>
        set((state) => ({
          queue: [...state.queue, song],
        })),

      insertNext: (song) =>
        set((state) => {
          const next = playNext(state, song);
          return { queue: next.queue, currentIndex: next.currentIndex };
        }),

      playNext: (song) =>
        set((state) => {
          const next = playNext(state, song);
          return { queue: next.queue, currentIndex: next.currentIndex };
        }),

      clearAfterCurrent: () =>
        set((state) => {
          const next = clearAfterCurrent(state);
          return { queue: next.queue, currentIndex: next.currentIndex };
        }),

      bulkRemove: (ids) =>
        set((state) => {
          const next = bulkRemove(state, ids);
          return { queue: next.queue, currentIndex: next.currentIndex };
        }),

      dedupeQueue: () =>
        set((state) => {
          const next = dedupe(state);
          return { queue: next.queue, currentIndex: next.currentIndex };
        }),

      shuffleAfterCurrent: () =>
        set((state) => {
          const next = shuffleAfter(state);
          return { queue: next.queue, currentIndex: next.currentIndex };
        }),

      moveToNext: (index) =>
        set((state) => {
          if (
            index < 0 ||
            index >= state.queue.length ||
            index === state.currentIndex ||
            index === state.currentIndex + 1
          ) {
            return {};
          }

          const currentSong = state.queue[state.currentIndex];
          const songToMove = state.queue[index];
          const newQueue = state.queue.filter((_, itemIndex) => itemIndex !== index);
          const currentIndexAfterRemoval = newQueue.findIndex((song) => song.id === currentSong.id);
          const insertAt = Math.min(currentIndexAfterRemoval + 1, newQueue.length);

          newQueue.splice(insertAt, 0, songToMove);

          return {
            queue: newQueue,
            currentIndex: newQueue.findIndex((song) => song.id === currentSong.id),
          };
        }),

      removeFromQueue: (index) =>
        set((state) => {
          const target = state.queue[index];
          if (!target) return {};

          const next = bulkRemove(state, [target.id]);
          return { queue: next.queue, currentIndex: next.currentIndex };
        }),

      reorderQueue: (fromIndex, toIndex) =>
        set((state) => {
          const newQueue = [...state.queue];
          const [moved] = newQueue.splice(fromIndex, 1);
          newQueue.splice(toIndex, 0, moved);

          let newCurrentIndex = state.currentIndex;
          if (fromIndex === state.currentIndex) {
            newCurrentIndex = toIndex;
          } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
            newCurrentIndex = state.currentIndex - 1;
          } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
            newCurrentIndex = state.currentIndex + 1;
          }

          return { queue: newQueue, currentIndex: newCurrentIndex };
        }),

      clearQueue: () => set({ queue: [], currentIndex: 0 }),

      clearPlayed: () =>
        set((state) => {
          if (state.currentIndex <= 0) return {};

          return {
            queue: state.queue.slice(state.currentIndex),
            currentIndex: 0,
          };
        }),

      removeFromQueueById: (id) =>
        set((state) => {
          const next = bulkRemove(state, [id]);
          return { queue: next.queue, currentIndex: next.currentIndex };
        }),

      removeMultipleFromQueue: (indices) =>
        set((state) => {
          const ids = indices
            .map((index) => state.queue[index]?.id)
            .filter((id): id is string => Boolean(id));
          const next = bulkRemove(state, ids);
          return { queue: next.queue, currentIndex: next.currentIndex };
        }),

      addToHistory: (song) =>
        set((state) => {
          const filtered = state.history.filter((s) => s.id !== song.id);
          const historySong: HistorySong = {
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration: song.duration,
            cover: song.cover?.startsWith("data:image/") ? "" : song.cover,
            playedAt: Date.now(),
          };
          return { history: [historySong, ...filtered].slice(0, 50) };
        }),

      clearHistory: () => set({ history: [] }),

      nextSong: () => {
        const state = get();
        if (state.queue.length === 0) return null;

        const nextIndex = (state.currentIndex + 1) % state.queue.length;
        set({ currentIndex: nextIndex });
        return state.queue[nextIndex];
      },

      prevSong: () => {
        const state = get();
        if (state.queue.length === 0) return null;

        const prevIndex =
          state.currentIndex === 0 ? state.queue.length - 1 : state.currentIndex - 1;
        set({ currentIndex: prevIndex });
        return state.queue[prevIndex];
      },

      getCurrentSong: () => {
        const state = get();
        if (state.queue.length === 0 || state.currentIndex >= state.queue.length) {
          return null;
        }
        return state.queue[state.currentIndex];
      },

      shuffleQueue: () => {
        const queue = [...get().queue];
        for (let i = queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [queue[i], queue[j]] = [queue[j], queue[i]];
        }
        set({ queue });
      },

      setPlayThroughMode: (mode) => set({ playThroughMode: mode }),
    }),
    {
      name: "queue-store-v5",
      partialize: (state) => ({
        queue: state.queue.slice(0, 200).map(sanitizePersistedSong),
        currentIndex: Math.min(state.currentIndex, 199),
        history: state.history.slice(0, 30),
        playThroughMode: state.playThroughMode,
      }),
      storage: {
        getItem: (name) => {
          try {
            const value = localStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            tryPersistQueueState(name, value);
          } catch (_error) {
            if (isQuotaExceededError(_error)) {
              console.warn("Queue store quota exceeded, aggressively clearing history...");
              try {
                const state = clonePersistedValue(value);
                if (state.state && state.state.history) {
                  state.state.history = state.state.history.slice(0, 5);
                }
                retryPersistQueueState(name, state);
              } catch {
                console.warn(
                  "Failed to save even with 5 history items, clearing history and shrinking queue."
                );
                try {
                  const state = clonePersistedValue(value);
                  if (state.state) {
                    state.state.history = [];
                    if (Array.isArray(state.state.queue)) {
                      state.state.queue = state.state.queue.map(toMinimalPersistedSong);
                    }
                  }
                  retryPersistQueueState(name, state);
                } catch {
                  console.warn(
                    "Failed to save minimized queue store, persisting index only as final fallback."
                  );
                  try {
                    const state = clonePersistedValue(value);
                    if (state.state) {
                      state.state.history = [];
                      state.state.queue = [];
                      state.state.currentIndex = 0;
                    }
                    retryPersistQueueState(name, state);
                  } catch (finalError) {
                    console.error("Critical storage failure in queue store:", finalError);
                  }
                }
              }
            } else {
              console.warn("Failed to save queue store:", _error);
            }
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
