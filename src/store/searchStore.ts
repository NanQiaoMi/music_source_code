import { create } from "zustand";
import { Song } from "@/types/song";

export type SearchType = "all" | "song" | "artist" | "album";

export type FilterType = "all" | "title" | "artist" | "album";

interface Filters {
  type: FilterType;
  durationRange: { min: number; max: number } | null;
  source: string;
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
  lastSearchSongs: Song[];
  recentCommands: string[];
  commandFeedback: string | null;

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
  setSourceFilter: (source: string) => void;
  clearFilters: () => void;
  addToHistory: (query: string) => void;
  clearHistory: () => void;
  addRecentCommand: (command: string) => void;
  setCommandFeedback: (message: string | null) => void;
}

const MAX_RECENT_SEARCHES = 10;
const MAX_SEARCH_HISTORY = 20;

const defaultFilters: Filters = {
  type: "all",
  durationRange: null,
  source: "all",
};

function includesValue(value: string | undefined, query: string): boolean {
  return Boolean(value?.toLowerCase().includes(query));
}

function scoreSong(song: Song, query: string, searchType: SearchType): number {
  const title = song.title.toLowerCase();
  const artist = song.artist.toLowerCase();
  const album = song.album?.toLowerCase() || "";
  const genre = song.genre?.toLowerCase() || "";
  let score = 0;

  if (searchType === "all" || searchType === "song") {
    if (title === query) score = Math.max(score, 100);
    else if (title.startsWith(query)) score = Math.max(score, 80);
    else if (title.includes(query)) score = Math.max(score, 60);
  }

  if (searchType === "all" || searchType === "artist") {
    if (artist === query || artist.startsWith(query)) score = Math.max(score, 50);
    else if (artist.includes(query)) score = Math.max(score, 40);
  }

  if (searchType === "all" || searchType === "album") {
    if (album.includes(query)) score = Math.max(score, 30);
  }

  if (searchType === "all" && genre.includes(query)) {
    score = Math.max(score, 20);
  }

  return score;
}

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
  lastSearchSongs: [],
  recentCommands: [],
  commandFeedback: null,

  setQuery: (query) => set({ query, page: 1 }),

  setSearchType: (type) => {
    set({ searchType: type, page: 1 });
    const { query, search } = get();
    if (query) {
      search(get().lastSearchSongs);
    }
  },

  search: (songs) => {
    const { query, searchType, filters, page, pageSize, lastSearchSongs } = get();
    const corpus = songs.length > 0 ? songs : lastSearchSongs;

    if (!query.trim()) {
      set({ results: [], isSearching: false, totalResults: 0 });
      return;
    }

    set({ isSearching: true });
    get().addToHistory(query);

    const lowerQuery = query.toLowerCase().trim();

    let filtered = corpus
      .map((song) => ({ song, score: scoreSong(song, lowerQuery, searchType) }))
      .filter((item) => item.score > 0);

    if (filters.type !== "all") {
      filtered = filtered.filter(({ song }) => {
        switch (filters.type) {
          case "title":
            return includesValue(song.title, lowerQuery);
          case "artist":
            return includesValue(song.artist, lowerQuery);
          case "album":
            return includesValue(song.album, lowerQuery);
          default:
            return true;
        }
      });
    }

    if (filters.source !== "all") {
      filtered = filtered.filter(({ song }) => song.source === filters.source);
    }

    if (filters.durationRange) {
      filtered = filtered.filter(({ song }) => {
        const dur = song.duration;
        return dur >= filters.durationRange!.min && dur <= filters.durationRange!.max;
      });
    }

    const totalResults = filtered.length;
    const start = (page - 1) * pageSize;
    const pagedResults = filtered
      .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title))
      .slice(start, start + pageSize)
      .map((item) => item.song);

    set({ results: pagedResults, totalResults, isSearching: false, lastSearchSongs: corpus });

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
    set({ page: Math.max(1, page) });
    const { query, search } = get();
    if (query) {
      search(get().lastSearchSongs);
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

  setSourceFilter: (source) => {
    set((state) => ({
      filters: { ...state.filters, source },
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

  addRecentCommand: (command) => {
    if (!command.trim()) return;
    set((state) => ({
      recentCommands: [command, ...state.recentCommands.filter((item) => item !== command)].slice(
        0,
        5
      ),
    }));
  },

  setCommandFeedback: (message) => set({ commandFeedback: message }),
}));
