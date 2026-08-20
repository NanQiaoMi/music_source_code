import { create } from "zustand";
import { Song } from "@/types/song";
import { multiSourceResolver, SegmentedSearchResults } from "@/services/MultiSourceResolver";

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
  segmentedResults: SegmentedSearchResults;
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

const initialSegmented: SegmentedSearchResults = {
  netease: [],
  qq: [],
  kugou: [],
  qishui: [],
  all: [],
};

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  searchType: "all",
  results: [],
  segmentedResults: initialSegmented,
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
    const { query, search, lastSearchSongs } = get();
    if (query) {
      search(lastSearchSongs);
    }
  },

  search: (songs) => {
    const { query, searchType, filters, page, pageSize, lastSearchSongs } = get();
    const localCorpus = songs && songs.length > 0 ? songs : lastSearchSongs;

    if (!query.trim()) {
      set({
        results: [],
        segmentedResults: initialSegmented,
        isSearching: false,
        totalResults: 0,
        lastSearchSongs: localCorpus,
      });
      return;
    }

    get().addToHistory(query);

    const lowerQuery = query.toLowerCase().trim();

    // 1. 本地即时同步匹配与排序 (0ms 极速响应)
    let localFiltered = localCorpus
      .map((song) => ({ song, score: scoreSong(song, lowerQuery, searchType) }))
      .filter((item) => item.score > 0);

    if (filters.type !== "all") {
      localFiltered = localFiltered.filter(({ song }) => {
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
      localFiltered = localFiltered.filter(({ song }) => song.source === filters.source);
    }

    if (filters.durationRange) {
      localFiltered = localFiltered.filter(({ song }) => {
        const dur = song.duration;
        return dur >= filters.durationRange!.min && dur <= filters.durationRange!.max;
      });
    }

    const totalResults = localFiltered.length;
    const start = (page - 1) * pageSize;
    const pagedResults = localFiltered
      .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title))
      .slice(start, start + pageSize)
      .map((item) => item.song);

    set({
      results: pagedResults,
      totalResults,
      isSearching: false,
      lastSearchSongs: localCorpus,
    });

    if (localFiltered.length > 0) {
      get().addRecentSearch(query);
    }

    // 2. 浏览器环境下异步拉取全网多源结果并融合
    if (typeof window !== "undefined") {
      set({ isSearching: true });
      multiSourceResolver
        .searchOnlineMusicSegmented(query)
        .then((seg) => {
          if (get().query !== query) return;

          const onlineFiltered = seg.all.map((song) => ({
            song,
            score: scoreSong(song, lowerQuery, searchType) || 50,
          }));

          const combinedMap = new Map<string, { song: Song; score: number }>();
          localFiltered.forEach((item) => {
            const key = `${item.song.title}-${item.song.artist}`.toLowerCase();
            combinedMap.set(key, item);
          });
          onlineFiltered.forEach((item) => {
            const key = `${item.song.title}-${item.song.artist}`.toLowerCase();
            if (!combinedMap.has(key)) {
              combinedMap.set(key, item);
            }
          });

          let merged = Array.from(combinedMap.values());
          if (filters.type !== "all") {
            merged = merged.filter(({ song }) => {
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
            merged = merged.filter(({ song }) => song.source === filters.source);
          }
          if (filters.durationRange) {
            merged = merged.filter(({ song }) => {
              const dur = song.duration;
              return dur >= filters.durationRange!.min && dur <= filters.durationRange!.max;
            });
          }

          const newTotal = merged.length;
          const newStart = (get().page - 1) * get().pageSize;
          const newPaged = merged
            .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title))
            .slice(newStart, newStart + get().pageSize)
            .map((item) => item.song);

          set({
            results: newPaged,
            segmentedResults: seg,
            totalResults: newTotal,
            isSearching: false,
          });
        })
        .catch(() => {
          set({ isSearching: false });
        });
    }
  },

  clearSearch: () => {
    set({
      query: "",
      results: [],
      segmentedResults: initialSegmented,
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
      recentSearches: state.recentSearches.filter(
        (item) => item.toLowerCase() !== query.toLowerCase()
      ),
    }));
  },

  setPage: (page) => {
    set({ page });
    const { search, lastSearchSongs } = get();
    search(lastSearchSongs);
  },

  setPageSize: (size) => {
    set({ pageSize: size, page: 1 });
    const { search, lastSearchSongs } = get();
    search(lastSearchSongs);
  },

  setFilterType: (type) => {
    set((state) => ({
      filters: { ...state.filters, type },
      page: 1,
    }));
    const { search, lastSearchSongs } = get();
    search(lastSearchSongs);
  },

  setDurationRange: (range) => {
    set((state) => ({
      filters: { ...state.filters, durationRange: range },
      page: 1,
    }));
    const { search, lastSearchSongs } = get();
    search(lastSearchSongs);
  },

  setSourceFilter: (source) => {
    set((state) => ({
      filters: { ...state.filters, source },
      page: 1,
    }));
    const { search, lastSearchSongs } = get();
    search(lastSearchSongs);
  },

  clearFilters: () => {
    set({ filters: { ...defaultFilters }, page: 1 });
    const { search, lastSearchSongs } = get();
    search(lastSearchSongs);
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
    const trimmed = command.trim();
    if (!trimmed) return;

    set((state) => {
      const nextCommands = [trimmed, ...state.recentCommands.filter((item) => item !== trimmed)].slice(
        0,
        5
      );
      return { recentCommands: nextCommands };
    });
  },

  setCommandFeedback: (commandFeedback) => set({ commandFeedback }),
}));
