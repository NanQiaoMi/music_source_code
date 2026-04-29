import { create } from "zustand";
import { Song } from "./playlistStore";

export type SearchType = "all" | "song" | "artist" | "album";

interface SearchState {
  query: string;
  searchType: SearchType;
  results: Song[];
  recentSearches: string[];
  isSearching: boolean;
  isVoiceSearch: boolean;

  setQuery: (query: string) => void;
  setSearchType: (type: SearchType) => void;
  search: (songs: Song[]) => void;
  clearSearch: () => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  setIsVoiceSearch: (isVoice: boolean) => void;
  removeRecentSearch: (query: string) => void;
}

const MAX_RECENT_SEARCHES = 10;

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  searchType: "all",
  results: [],
  recentSearches: [],
  isSearching: false,
  isVoiceSearch: false,

  setQuery: (query) => set({ query }),

  setSearchType: (type) => {
    set({ searchType: type });
    const { query, search } = get();
    if (query) {
      const allSongs = useSearchStore.getState().results;
      search([]);
    }
  },

  search: (songs) => {
    const { query, searchType } = get();

    if (!query.trim()) {
      set({ results: [], isSearching: false });
      return;
    }

    set({ isSearching: true });

    const lowerQuery = query.toLowerCase().trim();

    const filtered = songs.filter((song) => {
      switch (searchType) {
        case "song":
          return song.title.toLowerCase().includes(lowerQuery);
        case "artist":
          return song.artist.toLowerCase().includes(lowerQuery);
        case "album":
          return song.album?.toLowerCase().includes(lowerQuery);
        case "all":
        default:
          return (
            song.title.toLowerCase().includes(lowerQuery) ||
            song.artist.toLowerCase().includes(lowerQuery) ||
            song.album?.toLowerCase().includes(lowerQuery)
          );
      }
    });

    set({ results: filtered, isSearching: false });

    if (filtered.length > 0) {
      get().addRecentSearch(query);
    }
  },

  clearSearch: () => {
    set({
      query: "",
      results: [],
      isSearching: false,
      isVoiceSearch: false,
    });
  },

  addRecentSearch: (query) => {
    if (!query.trim()) return;

    set((state) => {
      const filtered = state.recentSearches.filter(
        (item) => item.toLowerCase() !== query.toLowerCase()
      );
      return {
        recentSearches: [query, ...filtered].slice(0, MAX_RECENT_SEARCHES),
      };
    });
  },

  clearRecentSearches: () => {
    set({ recentSearches: [] });
  },

  setIsVoiceSearch: (isVoice) => {
    set({ isVoiceSearch: isVoice });
  },

  removeRecentSearch: (query) => {
    set((state) => ({
      recentSearches: state.recentSearches.filter((item) => item !== query),
    }));
  },
}));
