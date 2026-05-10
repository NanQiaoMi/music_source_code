import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song } from "./playlistStore";

export interface HistorySong {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  cover?: string;
  playedAt: number;
}

interface QueueState {
  queue: Song[];
  currentIndex: number;
  history: HistorySong[];
  playThroughMode: 'normal' | 'play-through';

  setQueue: (songs: Song[]) => void;
  setCurrentIndex: (index: number) => void;
  addToQueue: (song: Song) => void;
  insertNext: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  addToHistory: (song: Song) => void;
  clearHistory: () => void;

  nextSong: () => Song | null;
  prevSong: () => Song | null;
  getCurrentSong: () => Song | null;
  shuffleQueue: () => void;
  setPlayThroughMode: (mode: 'normal' | 'play-through') => void;
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: 0,
      history: [],
      playThroughMode: 'normal',

      setQueue: (songs) => set({ queue: songs }),

      setCurrentIndex: (index) => set({ currentIndex: index }),

      addToQueue: (song) =>
        set((state) => ({
          queue: [...state.queue, song],
        })),

      insertNext: (song) =>
        set((state) => {
          if (state.queue.length === 0) {
            return { queue: [song] };
          }
          const newQueue = [...state.queue];
          newQueue.splice(state.currentIndex + 1, 0, song);
          return { queue: newQueue };
        }),

      removeFromQueue: (index) =>
        set((state) => {
          const newQueue = [...state.queue];
          newQueue.splice(index, 1);

          // Adjust current index if needed
          let newIndex = state.currentIndex;
          if (index < state.currentIndex) {
            newIndex = Math.max(0, state.currentIndex - 1);
          } else if (index === state.currentIndex && newQueue.length > 0) {
            newIndex = Math.min(state.currentIndex, newQueue.length - 1);
          }

          return { queue: newQueue, currentIndex: newIndex };
        }),

      reorderQueue: (fromIndex, toIndex) =>
        set((state) => {
          const newQueue = [...state.queue];
          const [moved] = newQueue.splice(fromIndex, 1);
          newQueue.splice(toIndex, 0, moved);

          // Adjust current index
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
        queue: state.queue,
        currentIndex: state.currentIndex,
        history: state.history,
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
            localStorage.setItem(name, JSON.stringify(value));
          } catch (error) {
            if (error instanceof Error && error.name === "QuotaExceededError") {
              console.warn("Queue store quota exceeded, aggressively clearing history...");
              try {
                const state = JSON.parse(JSON.stringify(value));
                if (state.state && state.state.history) {
                  // Try reducing to 5 items first
                  state.state.history = state.state.history.slice(0, 5);
                }
                localStorage.setItem(name, JSON.stringify(state));
              } catch (e) {
                console.warn("Failed to save even with 5 history items, clearing all history.");
                try {
                  const state = JSON.parse(JSON.stringify(value));
                  if (state.state) {
                    state.state.history = [];
                  }
                  localStorage.setItem(name, JSON.stringify(state));
                } catch (finalError) {
                  console.error("Critical storage failure in queue store:", finalError);
                }
              }
            } else {
              console.warn("Failed to save queue store:", error);
            }
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
