"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Search,
  X,
  Mic,
  Clock,
  TrendingUp,
  Music,
  User,
  Disc,
  Loader2,
  Trash2,
} from "lucide-react";
import { useSearchStore, SearchType, FilterType } from "@/store/searchStore";
import { usePlaylistStore, Song } from "@/store/playlistStore";
import { useAudioStore } from "@/store/audioStore";
import Image from "next/image";
import { GlassModal } from "@/components/shared/Glass";

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SEARCH_TYPES: { value: SearchType; label: string; icon: typeof Music }[] = [
  { value: "all", label: "全部", icon: Search },
  { value: "song", label: "歌曲", icon: Music },
  { value: "artist", label: "艺人", icon: User },
  { value: "album", label: "专辑", icon: Disc },
];

export function SearchPanel({ isOpen, onClose }: SearchPanelProps) {
  const {
    query,
    searchType,
    results,
    recentSearches,
    isSearching,
    isVoiceSearch,
    page,
    pageSize,
    totalResults,
    filters,
    searchHistory,
    setQuery,
    setSearchType,
    search,
    clearSearch,
    removeRecentSearch,
    clearRecentSearches,
    setIsVoiceSearch,
    setPage,
    setFilterType,
    clearFilters,
    clearHistory,
  } = useSearchStore();

  const { songs } = usePlaylistStore();
  const setCurrentSong = useAudioStore((state) => state.setCurrentSong);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query) {
        search(songs);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query, searchType, songs, search]);

  const handleVoiceSearch = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("您的浏览器不支持语音识别功能");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);
    setIsVoiceSearch(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      search(songs);
      setIsListening(false);
      setIsVoiceSearch(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setIsVoiceSearch(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsVoiceSearch(false);
    };

    recognition.start();
  }, [setQuery, setIsVoiceSearch, songs, search]);

  const handlePlaySong = (song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
    onClose();
  };

  const handleRecentSearchClick = (searchQuery: string) => {
    setQuery(searchQuery);
    search(songs);
  };

  const handleHistoryClick = (searchQuery: string) => {
    setQuery(searchQuery);
    search(songs);
  };

  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));

  const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "title", label: "标题" },
    { value: "artist", label: "歌手" },
    { value: "album", label: "专辑" },
  ];

  const content = (
    <div className="overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索歌曲、艺人、专辑..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-10 text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  clearSearch();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleVoiceSearch}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
              isListening
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {isListening ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
              >
                <Mic className="w-5 h-5" />
              </motion.div>
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </motion.button>
        </div>

        <div className="flex gap-2 mt-4">
          {SEARCH_TYPES.map((type) => (
            <motion.button
              key={type.value}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSearchType(type.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                searchType === type.value
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              <type.icon className="w-3.5 h-3.5" />
              {type.label}
            </motion.button>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-white/50">过滤:</span>
          <select
            value={filters.type}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-white/30"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {filters.type !== "all" && (
            <button
              onClick={clearFilters}
              className="text-xs text-white/40 hover:text-white/70"
            >
              清除
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto custom-scrollbar min-h-0">
        {!query && recentSearches.length > 0 && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-white/60">
                <Clock className="w-4 h-4" />
                <span className="text-sm">最近搜索</span>
              </div>
              <button
                onClick={clearRecentSearches}
                className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                清空
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((searchQuery, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleRecentSearchClick(searchQuery)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-white/70 text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  {searchQuery}
                  <X
                    className="w-3 h-3 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecentSearch(searchQuery);
                    }}
                  />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {!query && searchHistory.length > 0 && (
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">搜索历史</span>
              <button
                onClick={clearHistory}
                className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                清空
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {searchHistory.slice(0, 10).map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleHistoryClick(item)}
                  className="px-2 py-0.5 rounded bg-white/5 text-white/50 text-xs hover:bg-white/10 transition-colors"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {isSearching && (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
          </div>
        )}

        {query && !isSearching && results.length === 0 && (
          <div className="p-8 text-center">
            <Search className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/50">未找到相关结果</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="p-4">
            <div className="flex items-center gap-2 text-white/60 mb-3">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">搜索结果 ({totalResults})</span>
            </div>
            <div className="space-y-2">
              {results.map((song, index) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handlePlaySong(song)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group"
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={song.cover} alt={song.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Music className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{song.title}</p>
                    <p className="text-white/50 text-sm truncate">{song.artist}</p>
                  </div>
                  {song.album && (
                    <span className="text-white/40 text-xs px-2 py-1 rounded-full bg-white/5">
                      {song.album}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-white/10">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 rounded-lg text-xs bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  上一页
                </motion.button>
                <span className="text-xs text-white/50">
                  第{page}页 / 共{totalPages}页
                </span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded-lg text-xs bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                </motion.button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} width="lg">
      {content}
    </GlassModal>
  );
}
