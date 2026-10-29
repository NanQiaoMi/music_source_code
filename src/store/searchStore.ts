import { create } from "zustand";
import { Song } from "@/types/song";
import { multiSourceResolver, SegmentedSearchResults } from "@/services/MultiSourceResolver";
import {
  MAX_RECENT_SEARCHES,
  MAX_SEARCH_HISTORY,
  defaultFilters,
  filterAndPageSongs,
  getSongsForSourceTab,
  initialSegmented,
} from "./search/helpers";
import type { Filters, FilterType, SearchType, SourceTabType } from "./search/helpers";

export type { FilterType, SearchType, SourceTabType } from "./search/helpers";

interface SearchState {
  query: string;
  searchType: SearchType;
  activeSourceTab: SourceTabType;
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
  setActiveSourceTab: (tab: SourceTabType) => void;
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

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  searchType: "all",
  activeSourceTab: "all",
  results: [],
  segmentedResults: initialSegmented,
  recentSearches: [],
  isSearching: false,
  isVoiceSearch: false,
  page: 1,
  pageSize: 100,
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

  setActiveSourceTab: (activeSourceTab) => {
    set({ activeSourceTab, page: 1 });
    const { query, searchType, filters, pageSize, segmentedResults, lastSearchSongs } = get();
    const targetSongs = getSongsForSourceTab(activeSourceTab, segmentedResults, lastSearchSongs);
    const { paged, total } = filterAndPageSongs(
      targetSongs,
      query,
      searchType,
      filters,
      1,
      pageSize
    );
    set({ results: paged, totalResults: total });
  },

  search: (songs) => {
    const {
      query,
      searchType,
      filters,
      page,
      pageSize,
      lastSearchSongs,
      activeSourceTab: _activeSourceTab,
    } = get();
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

    const { paged: localPaged, total: localTotal } = filterAndPageSongs(
      localCorpus,
      query,
      searchType,
      filters,
      page,
      pageSize
    );

    set({
      results: localPaged,
      totalResults: localTotal,
      isSearching: false,
      lastSearchSongs: localCorpus,
    });

    if (localTotal > 0) {
      get().addRecentSearch(query);
    }

    // 2. 浏览器环境下异步拉取全网多源独立结果并融合
    if (typeof window !== "undefined") {
      set({ isSearching: true });
      multiSourceResolver
        .searchOnlineMusicSegmented(query)
        .then((seg) => {
          if (get().query !== query) return;

          const currentTab = get().activeSourceTab;
          let targetSongs: Song[] = [];
          if (currentTab === "all") {
            const combinedMap = new Map<string, Song>();
            localCorpus.forEach((s) => {
              const k = `${s.title}-${s.artist}-${s.source || "local"}`.toLowerCase();
              combinedMap.set(k, s);
            });
            seg.all.forEach((s) => {
              const k = `${s.title}-${s.artist}-${s.source || "online"}`.toLowerCase();
              if (!combinedMap.has(k)) {
                combinedMap.set(k, s);
              }
            });
            targetSongs = Array.from(combinedMap.values());
          } else {
            targetSongs = getSongsForSourceTab(currentTab, seg, localCorpus);
          }

          const { paged: newPaged, total: newTotal } = filterAndPageSongs(
            targetSongs,
            query,
            get().searchType,
            get().filters,
            get().page,
            get().pageSize
          );

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
      totalResults: 0,
      page: 1,
      commandFeedback: null,
    });
  },

  addRecentSearch: (searchQuery) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    set((state) => {
      const filtered = state.recentSearches.filter(
        (item) => item.toLowerCase() !== trimmed.toLowerCase()
      );
      return {
        recentSearches: [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES),
      };
    });
  },

  clearRecentSearches: () => {
    set({ recentSearches: [] });
  },

  setIsVoiceSearch: (isVoiceSearch) => set({ isVoiceSearch }),

  removeRecentSearch: (query) => {
    set((state) => ({
      recentSearches: state.recentSearches.filter(
        (item) => item.toLowerCase() !== query.toLowerCase()
      ),
    }));
  },

  setPage: (page) => {
    set({ page });
    const {
      activeSourceTab,
      segmentedResults,
      lastSearchSongs,
      query,
      searchType,
      filters,
      pageSize,
    } = get();
    const targetSongs = getSongsForSourceTab(activeSourceTab, segmentedResults, lastSearchSongs);
    const { paged, total } = filterAndPageSongs(
      targetSongs,
      query,
      searchType,
      filters,
      page,
      pageSize
    );
    set({ results: paged, totalResults: total });
  },

  setPageSize: (pageSize) => {
    set({ pageSize, page: 1 });
    const { search, lastSearchSongs } = get();
    search(lastSearchSongs);
  },

  setFilterType: (type) => {
    set((state) => ({
      filters: { ...state.filters, type },
      page: 1,
    }));
    const { activeSourceTab, setActiveSourceTab } = get();
    setActiveSourceTab(activeSourceTab);
  },

  setDurationRange: (range) => {
    set((state) => ({
      filters: { ...state.filters, durationRange: range },
      page: 1,
    }));
    const { activeSourceTab, setActiveSourceTab } = get();
    setActiveSourceTab(activeSourceTab);
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
    const { activeSourceTab, setActiveSourceTab } = get();
    setActiveSourceTab(activeSourceTab);
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
      const nextCommands = [
        trimmed,
        ...state.recentCommands.filter((item) => item !== trimmed),
      ].slice(0, 5);
      return { recentCommands: nextCommands };
    });
  },

  setCommandFeedback: (commandFeedback) => set({ commandFeedback }),
}));
