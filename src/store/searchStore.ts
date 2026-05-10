import { create } from "zustand";
import { Song } from "@/types/song";

export type SearchType = "all" | "song" | "artist" | "album";

export type FilterType = "all" | "title" | "artist" | "album";

interface Filters {
  type: FilterType;
  durationRange: { min: number; max: number } | null;
}

interface SearchState {
  query: string;
  searchType: SearchType;
  results: Song[];
  recentSearches: string[];
  isSearching: boolean;
  isVoiceSearch: boolean;
  page: number;
  pageSize: number;
  totalResults: number;
  filters: Filters;
  searchHistory: string[];

  setQuery: (query: string) => void;
  setSearchType: (type: SearchType) => void;
  search: (songs: Song[]) => void;
  clearSearch: () => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  setIsVoiceSearch: (isVoice: boolean) => void;
  removeRecentSearch: (query: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setFilterType: (type: FilterType) => void;
  setDurationRange: (range: { min: number; max: number } | null) => void;
  clearFilters: () => void;
  addToHistory: (query: string) => void;
  clearHistory: () => void;
}

const MAX_RECENT_SEARCHES = 10;
const MAX_SEARCH_HISTORY = 20;

const defaultFilters: Filters = {
  type: "all",
  durationRange: null,
};

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  searchType: "all",
  results: [],
  recentSearches: [],
  isSearching: false,
  isVoiceSearch: false,
  page: 1,
  pageSize: 20,
  totalResults: 0,
  filters: { ...defaultFilters },
  searchHistory: [],

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
    const { query, searchType, filters, page, pageSize } = get();

    if (!query.trim()) {
      set({ results: [], isSearching: false, totalResults: 0 });
      return;
    }

    set({ isSearching: true });
    get().addToHistory(query);

    const lowerQuery = query.toLowerCase().trim();

    let filtered = songs.filter((song) => {
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

    if (filters.type !== "all") {
      filtered = filtered.filter((song) => {
        switch (filters.type) {
          case "title":
            return song.title.toLowerCase().includes(lowerQuery);
          case "artist":
            return song.artist.toLowerCase().includes(lowerQuery);
          case "album":
            return song.album?.toLowerCase().includes(lowerQuery);
          default:
            return true;
        }
      });
    }

    if (filters.durationRange) {
      filtered = filtered.filter((song) => {
        const dur = song.duration;
        return dur >= filters.durationRange!.min && dur <= filters.durationRange!.max;
      });
    }

    const totalResults = filtered.length;
    const start = (page - 1) * pageSize;
    const pagedResults = filtered.slice(start, start + pageSize);

    set({ results: pagedResults, totalResults, isSearching: false });

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
      page: 1,
      totalResults: 0,
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

  setPage: (page) => {
    set({ page });
    const { query, search } = get();
    if (query) {
      const store = useSearchStore.getState();
      search([]);
    }
  },

  setPageSize: (size) => {
    set({ pageSize: size, page: 1 });
  },

  setFilterType: (type) => {
    set((state) => ({
      filters: { ...state.filters, type },
      page: 1,
    }));
  },

  setDurationRange: (range) => {
    set((state) => ({
      filters: { ...state.filters, durationRange: range },
      page: 1,
    }));
  },

  clearFilters: () => {
    set({ filters: { ...defaultFilters }, page: 1 });
  },

  addToHistory: (query) => {
    if (!query.trim()) return;
    set((state) => {
      const filtered = state.searchHistory.filter(
        (item) => item.toLowerCase() !== query.toLowerCase()
      );
      return {
        searchHistory: [query, ...filtered].slice(0, MAX_SEARCH_HISTORY),
      };
    });
  },

  clearHistory: () => {
    set({ searchHistory: [] });
  },
}));
