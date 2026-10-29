// S6-12g: store-free search types and pure helpers live here so
// searchStore.ts stays inside the 400-line store budget (scripts/check-store-budgets.mjs).
// The store re-exports the public search types, so its public surface is unchanged.

import type { SegmentedSearchResults } from "@/services/MultiSourceResolver";
import type { Song } from "@/types/song";
import type { MusicSourceId } from "@/types/sourceConfig";

export type SearchType = "all" | "song" | "artist" | "album";

export type FilterType = "all" | "title" | "artist" | "album";

export type SourceTabType = "all" | MusicSourceId;

export interface Filters {
  type: FilterType;
  durationRange: { min: number; max: number } | null;
  source: string;
}

export const MAX_RECENT_SEARCHES = 10;
export const MAX_SEARCH_HISTORY = 20;

export const defaultFilters: Filters = {
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
    const words = f.split(/[\s\-_/.,()[\]{}（）【】]+/).filter(Boolean);
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
      if (
        isTokenMatched(title, token) ||
        isTokenMatched(artist, token) ||
        isTokenMatched(album, token)
      ) {
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
      const hasAnyToken = tokens.some(
        (t) => isTokenMatched(title, t) || isTokenMatched(artist, t) || isTokenMatched(album, t)
      );
      score = hasAnyToken ? 50 : 30;
    } else {
      score += 10;
    }
  }

  return score;
}

export const initialSegmented: SegmentedSearchResults = {
  netease: [],
  qq: [],
  kugou: [],
  kuwo: [],
  qishui: [],
  local: [],
  lx_custom: [],
  all: [],
};

export function filterAndPageSongs(
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

export function getSongsForSourceTab(
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
