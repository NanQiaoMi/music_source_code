import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Song } from "@/types/song";
import { createSafeStorage, sanitizeSongForStorage } from "@/lib/storage/safeStorage";

interface FavoritesState {
  favorites: Song[];

  // Actions
  addToFavorites: (song: Song) => void;
  removeFromFavorites: (songId: string) => void;
  isFavorite: (songId: string) => boolean;
  toggleFavorite: (song: Song) => void;
  getFavorites: () => Song[];
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],

      addToFavorites: (song) =>
        set((state) => {
          if (state.favorites.some((s) => s.id === song.id)) {
            return state;
          }
          return { favorites: [...state.favorites, sanitizeSongForStorage(song)] };
        }),

      removeFromFavorites: (songId) =>
        set((state) => ({
          favorites: state.favorites.filter((s) => s.id !== songId),
        })),

      isFavorite: (songId) => {
        return get().favorites.some((s) => s.id === songId);
      },

      toggleFavorite: (song) => {
        const isFav = get().isFavorite(song.id);
        if (isFav) {
          get().removeFromFavorites(song.id);
        } else {
          get().addToFavorites(song);
        }
      },

      getFavorites: () => get().favorites,
    }),
    {
      name: "favorites-store",
      storage: createJSONStorage(() => createSafeStorage("favorites-store")),
      partialize: (state) => ({
        favorites: (state.favorites || []).map(sanitizeSongForStorage),
      }),
    }
  )
);
