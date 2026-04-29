import { create } from "zustand";
import { persist } from "zustand/middleware";
import { lyricsSearchService, LyricSearchResult, LyricLine } from "../services/lyricsSearchService";

interface LyricsSearchState {
  searchQuery: string;
  searchResults: LyricSearchResult[];
  isLoading: boolean;
  error: string | null;
  currentLyrics: LyricSearchResult | null;
  parsedLyrics: LyricLine[];
  searchHistory: string[];
  favoriteLyrics: LyricSearchResult[];

  setSearchQuery: (query: string) => void;
  searchLyrics: (title: string, artist?: string) => Promise<void>;
  selectLyrics: (lyrics: LyricSearchResult) => void;
  clearSearchResults: () => void;
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  toggleFavoriteLyrics: (lyrics: LyricSearchResult) => void;
  editLyrics: (lyricsId: string, newContent: string) => void;
  autoMatchLyrics: (songTitle: string, songArtist: string) => Promise<void>;
}

export const useLyricsSearchStore = create<LyricsSearchState>()(
  persist(
    (set, get) => ({
      searchQuery: "",
      searchResults: [],
      isLoading: false,
      error: null,
      currentLyrics: null,
      parsedLyrics: [],
      searchHistory: [],
      favoriteLyrics: [],

      setSearchQuery: (query) => set({ searchQuery: query }),

      searchLyrics: async (title, artist) => {
        set({ isLoading: true, error: null });
        try {
          const results = await lyricsSearchService.searchLyrics(title, artist);
          set({ searchResults: results, isLoading: false });
          if (title) {
            get().addToSearchHistory(artist ? `${title} - ${artist}` : title);
          }
        } catch (error) {
          set({ error: "搜索歌词失败", isLoading: false });
        }
      },

      selectLyrics: (lyrics) => {
        const parsed = lyricsSearchService.parseLyrics(lyrics.lyrics);
        set({ currentLyrics: lyrics, parsedLyrics: parsed });
      },

      clearSearchResults: () => set({ searchResults: [], searchQuery: "" }),

      addToSearchHistory: (query) => {
        set((state) => {
          const filtered = state.searchHistory.filter((h) => h !== query);
          return { searchHistory: [query, ...filtered].slice(0, 20) };
        });
      },

      clearSearchHistory: () => set({ searchHistory: [] }),

      toggleFavoriteLyrics: (lyrics) => {
        set((state) => {
          const exists = state.favoriteLyrics.some((f) => f.id === lyrics.id);
          if (exists) {
            return {
              favoriteLyrics: state.favoriteLyrics.filter((f) => f.id !== lyrics.id),
            };
          } else {
            return { favoriteLyrics: [...state.favoriteLyrics, lyrics] };
          }
        });
      },

      editLyrics: (lyricsId, newContent) => {
        set((state) => {
          const updateLyrics = (lyrics: LyricSearchResult) => {
            if (lyrics.id === lyricsId) {
              return { ...lyrics, lyrics: newContent };
            }
            return lyrics;
          };

          return {
            currentLyrics: state.currentLyrics ? updateLyrics(state.currentLyrics) : null,
            searchResults: state.searchResults.map(updateLyrics),
            favoriteLyrics: state.favoriteLyrics.map(updateLyrics),
            parsedLyrics: lyricsSearchService.parseLyrics(newContent),
          };
        });
      },

      autoMatchLyrics: async (songTitle, songArtist) => {
        set({ isLoading: true, error: null });
        try {
          const lyrics = await lyricsSearchService.getLyricsBySong(songTitle, songArtist);
          if (lyrics) {
            get().selectLyrics(lyrics);
          }
          set({ isLoading: false });
        } catch (error) {
          set({ error: "自动匹配歌词失败", isLoading: false });
        }
      },
    }),
    {
      name: "lyrics-search-storage",
      partialize: (state) => ({
        searchHistory: state.searchHistory,
        favoriteLyrics: state.favoriteLyrics,
      }),
    }
  )
);
