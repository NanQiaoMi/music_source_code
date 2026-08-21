import { create } from "zustand";
import { Song } from "@/types/song";
import { multiSourceResolver, SegmentedSearchResults } from "@/services/MultiSourceResolver";
import { MusicSourceId } from "@/types/sourceConfig";

export type SearchType = "all" | "song" | "artist" | "album";

export type FilterType = "all" | "title" | "artist" | "album";

export type SourceTabType = "all" | MusicSourceId;

interface Filters {
  type: FilterType;
  durationRange: { min: number; max: number } | null;
  source: string;
}

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

const MAX_RECENT_SEARCHES = 10;
const MAX_SEARCH_HISTORY = 20;

const defaultFilters: Filters = {
  type: "all",
  durationRange: null,
  source: "all",
};

function isTokenMatched(field: string, token: string): boolean {
  if (!field || !token) return false;
  const f = field.toLowerCase();
  const t = token.toLowerCase();
  if (!f.includes(t)) return false;

  // 对 <=2 字符的 ASCII 短词（如 "A", "JJ", "DJ"），要求匹配独立单词而非单词内部子串
  if (t.length <= 2 && /^[a-z0-9]+$/i.test(t)) {
    const words = f.split(/[\s\-_/.,()\[\]{}（）【】]+/).filter(Boolean);
    return words.some((w) => w === t);
  }
  return true;
}

function includesValue(value: string | undefined, query: string): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  if (v.includes(query)) return true;
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => isTokenMatched(v, t))) return true;
  return false;
}

function scoreSong(song: Song, query: string, searchType: SearchType): number {
  const title = song.title.toLowerCase();
  const artist = song.artist.toLowerCase();
  const album = song.album?.toLowerCase() || "";
  const genre = song.genre?.toLowerCase() || "";
  let score = 0;

  // 1. 完整字符串直接命中
  if (searchType === "all" || searchType === "song") {
    if (title === query) score = Math.max(score, 100);
    else if (title.startsWith(query)) score = Math.max(score, 85);
    else if (title.includes(query)) score = Math.max(score, 65);
  }

  if (searchType === "all" || searchType === "artist") {
    if (artist === query || artist.startsWith(query)) score = Math.max(score, 55);
    else if (artist.includes(query)) score = Math.max(score, 45);
  }

  if (searchType === "all" || searchType === "album") {
    if (album.includes(query)) score = Math.max(score, 35);
  }

  if (searchType === "all" && genre.includes(query)) {
    score = Math.max(score, 25);
  }

  // 2. 多关键词分词跨字段联合匹配 (如 "周杰伦 晴天" 或 "陈奕迅 富士山下")
  const tokens = query.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length > 1) {
    let matchedCount = 0;
    for (const token of tokens) {
      if (isTokenMatched(title, token) || isTokenMatched(artist, token) || isTokenMatched(album, token)) {
        matchedCount++;
      }
    }
    if (matchedCount === tokens.length) {
      score = Math.max(score, 80 + matchedCount * 5);
    }
  }

  // 3. 在线多源搜索结果（由各平台接口检索返回，天然具备相关性）保底加权
  if (song.source && song.source !== "local" && song.source !== "upload") {
    if (score === 0) {
      const hasAnyToken = tokens.some((t) => isTokenMatched(title, t) || isTokenMatched(artist, t) || isTokenMatched(album, t));
      score = hasAnyToken ? 50 : 30;
    } else {
      score += 10;
    }
  }

  return score;
}

const initialSegmented: SegmentedSearchResults = {
  netease: [],
  qq: [],
  kugou: [],
  kuwo: [],
  qishui: [],
  local: [],
  lx_custom: [],
  all: [],
};

function filterAndPageSongs(
  songs: Song[],
  query: string,
  searchType: SearchType,
  filters: Filters,
  page: number,
  pageSize: number
): { paged: Song[]; total: number } {
  const lowerQuery = query.toLowerCase().trim();
  let list = songs
    .map((song) => ({
      song,
      score: scoreSong(song, lowerQuery, searchType),
    }))
    .filter((item) => item.score > 0);

  if (filters.type !== "all") {
    list = list.filter(({ song }) => {
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
    list = list.filter(({ song }) => song.source === filters.source);
  }

  if (filters.durationRange) {
    list = list.filter(({ song }) => {
      const dur = song.duration;
      return dur >= filters.durationRange!.min && dur <= filters.durationRange!.max;
    });
  }

  const total = list.length;
  const start = (page - 1) * pageSize;
  const paged = list
    .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title))
    .slice(start, start + pageSize)
    .map((item) => item.song);

  return { paged, total };
}

function getSongsForSourceTab(
  tab: SourceTabType,
  segmented: SegmentedSearchResults,
  localCorpus: Song[]
): Song[] {
  if (tab === "all") {
    return segmented.all.length > 0 ? segmented.all : localCorpus;
  }
  if (tab === "netease") return segmented.netease;
  if (tab === "qq") return segmented.qq;
  if (tab === "kugou") return segmented.kugou;
  if (tab === "kuwo") return segmented.kuwo;
  if (tab === "qishui") return segmented.qishui;
  if (tab === "local") return localCorpus.filter((s) => s.source === "local" || !s.source);
  if (tab === "lx_custom") return segmented.lx_custom;
  return segmented.all;
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
  pageSize: 50,
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
    const { paged, total } = filterAndPageSongs(targetSongs, query, searchType, filters, 1, pageSize);
    set({ results: paged, totalResults: total });
  },

  search: (songs) => {
    const { query, searchType, filters, page, pageSize, lastSearchSongs, activeSourceTab } = get();
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
    const { activeSourceTab, segmentedResults, lastSearchSongs, query, searchType, filters, pageSize } = get();
    const targetSongs = getSongsForSourceTab(activeSourceTab, segmentedResults, lastSearchSongs);
    const { paged, total } = filterAndPageSongs(targetSongs, query, searchType, filters, page, pageSize);
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
      const nextCommands = [trimmed, ...state.recentCommands.filter((item) => item !== trimmed)].slice(
        0,
        5
      );
      return { recentCommands: nextCommands };
    });
  },

  setCommandFeedback: (commandFeedback) => set({ commandFeedback }),
}));
