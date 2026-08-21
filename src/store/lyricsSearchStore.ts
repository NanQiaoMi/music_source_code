import { create } from "zustand";
import { persist } from "zustand/middleware";
import { lyricsSearchService, LyricLine, LyricSearchResult } from "../services/lyricsSearchService";

export type LyricSourceState = "none" | "searching" | "matched" | "manual" | "failed";

interface LyricsSearchState {
  searchQuery: string;
  searchResults: LyricSearchResult[];
  isLoading: boolean;
  error: string | null;
  currentLyrics: LyricSearchResult | null;
  parsedLyrics: LyricLine[];
  currentSongId: string | null;
  lyricSourceState: LyricSourceState;
  searchHistory: string[];
  favoriteLyrics: LyricSearchResult[];

  setCurrentSongId: (songId: string | null) => void;
  setSearchQuery: (query: string) => void;
  searchLyrics: (title: string, artist?: string) => Promise<void>;
  selectLyrics: (lyrics: LyricSearchResult) => void;
  importManualLyrics: (
    content: string,
    meta?: Partial<Pick<LyricSearchResult, "title" | "artist" | "album">>
  ) => void;
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
      currentSongId: null,
      lyricSourceState: "none",
      searchHistory: [],
      favoriteLyrics: [],

      setCurrentSongId: (songId) => set({ currentSongId: songId }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      searchLyrics: async (title, artist) => {
        set({ isLoading: true, error: null, lyricSourceState: "searching" });
        try {
          const results = await lyricsSearchService.searchLyrics(title, artist);
          set({
            searchResults: results,
            isLoading: false,
            lyricSourceState: results.length > 0 ? "matched" : "failed",
          });
          if (title) {
            get().addToSearchHistory(artist ? `${title} - ${artist}` : title);
          }
        } catch {
          set({ error: "Lyrics search failed", isLoading: false, lyricSourceState: "failed" });
        }
      },

      selectLyrics: (lyrics) => {
        const parsed = lyricsSearchService.parseLyrics(lyrics.lyrics);
        set({ currentLyrics: lyrics, parsedLyrics: parsed, lyricSourceState: "matched" });
      },

      importManualLyrics: (content, meta) => {
        const trimmedContent = content.trim();
        const songId = get().currentSongId;
        const manualLyrics: LyricSearchResult = {
          id: `manual-${songId || Date.now()}`,
          title: meta?.title || "Manual lyrics",
          artist: meta?.artist || "Unknown artist",
          album: meta?.album,
          lyrics: trimmedContent,
          source: "manual",
        };

        set({
          currentLyrics: manualLyrics,
          parsedLyrics: lyricsSearchService.parseLyrics(trimmedContent),
          lyricSourceState: "manual",
          error: null,
        });
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
          }

          return { favoriteLyrics: [...state.favoriteLyrics, lyrics] };
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
            lyricSourceState:
              state.currentLyrics?.id === lyricsId && state.currentLyrics.source === "manual"
                ? "manual"
                : state.lyricSourceState,
          };
        });
      },

      autoMatchLyrics: async (songTitle, songArtist) => {
        set({ isLoading: true, error: null, lyricSourceState: "searching" });
        try {
          const lyrics = await lyricsSearchService.getLyricsBySong(songTitle, songArtist);
          if (lyrics) {
            get().selectLyrics(lyrics);
          }
          set({ isLoading: false, lyricSourceState: lyrics ? "matched" : "failed" });
        } catch {
          set({ error: "Auto match lyrics failed", isLoading: false, lyricSourceState: "failed" });
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
