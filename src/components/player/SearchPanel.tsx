"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  ListPlus,
  Play,
  Plus,
} from "lucide-react";
import { useSearchStore, SearchType, FilterType } from "@/store/searchStore";
import { usePlaylistStore } from "@/store/playlistStore";
import { Song } from "@/types/song";
import { useAudioStore } from "@/store/audioStore";
import { useQueueStore } from "@/store/queueStore";
import { useSleepTimerStore } from "@/store/sleepTimerStore";
import Image from "next/image";
import { parseSearchCommand, SEARCH_COMMAND_HINTS } from "@/lib/search/commandRouter";
import { executeSearchCommand } from "@/lib/search/commandExecutor";

const DEFAULT_COVER_SRC = "/default-cover.svg";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SEARCH_TYPES: { value: SearchType; label: string; icon: typeof Music }[] = [
  { value: "all", label: "全部", icon: Search },
  { value: "song", label: "歌曲", icon: Music },
  { value: "artist", label: "歌手", icon: User },
  { value: "album", label: "专辑", icon: Disc },
];

export function SearchPanel({ isOpen, onClose }: SearchPanelProps) {
  const {
    query,
    searchType,
    results,
    recentSearches,
    isSearching,
    page,
    pageSize,
    totalResults,
    filters,
    searchHistory,
    recentCommands,
    commandFeedback,
    setQuery,
    setSearchType,
    search,
    clearSearch,
    removeRecentSearch,
    clearRecentSearches,
    setIsVoiceSearch,
    setPage,
    setFilterType,
    setDurationRange,
    setSourceFilter,
    clearFilters,
    clearHistory,
    addRecentCommand,
    setCommandFeedback,
  } = useSearchStore();

  const { songs } = usePlaylistStore();
  const addToQueue = useQueueStore((state) => state.addToQueue);
  const insertNext = useQueueStore((state) => state.insertNext);
  const clearQueue = useQueueStore((state) => state.clearQueue);
  const shuffleQueue = useQueueStore((state) => state.shuffleQueue);
  const playSong = useAudioStore((state) => state.playSong);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const nextSong = useAudioStore((state) => state.nextSong);
  const prevSong = useAudioStore((state) => state.prevSong);
  const setVolume = useAudioStore((state) => state.setVolume);
  const setSleepTimer = useSleepTimerStore((state) => state.setTimer);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    const activeEl = typeof document !== "undefined" ? document.activeElement : null;
    const isActuallyFocused = isInputFocused || (activeEl !== null && activeEl === inputRef.current);
    if (isActuallyFocused || query.trim().length > 0) return;

    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
    }
    leaveTimeoutRef.current = setTimeout(() => {
      onClose();
    }, 300);
  }, [isInputFocused, query, onClose]);

  useEffect(() => {
    return () => {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
  }, [query, searchType, filters, songs, search]);

  const handleVoiceSearch = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setVoiceFeedback("当前浏览器不支持语音搜索。");
      setIsListening(false);
      setIsVoiceSearch(false);
      return;
    }

    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    setVoiceFeedback(null);

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);
    setIsVoiceSearch(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      search(songs);
      setVoiceFeedback(null);
      setIsListening(false);
      setIsVoiceSearch(false);
    };

    recognition.onerror = () => {
      setVoiceFeedback("语音搜索无法启动，请检查麦克风权限。");
      setIsListening(false);
      setIsVoiceSearch(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsVoiceSearch(false);
    };

    recognition.start();
  }, [setQuery, setIsVoiceSearch, songs, search]);

  const handlePlaySong = useCallback(
    (song: Song) => {
      playSong(song);
      onClose();
    },
    [onClose, playSong]
  );

  const handleAddToQueue = (song: Song) => {
    addToQueue(song);
  };

  const handlePlayNext = (song: Song) => {
    insertNext(song);
  };

  const handleNarrowSearch = (value: string, type: SearchType) => {
    setQuery(value);
    setSearchType(type);
  };

  const handleRecentSearchClick = (searchQuery: string) => {
    setQuery(searchQuery);
    search(songs);
  };

  const handleHistoryClick = (searchQuery: string) => {
    setQuery(searchQuery);
    search(songs);
  };

  const runCommand = useCallback(
    (value: string) => {
      const command = parseSearchCommand(value);
      executeSearchCommand(command, {
        songs,
        setQuery,
        search,
        addRecentCommand,
        setCommandFeedback,
        clearQueue,
        shuffleQueue,
        addToQueue,
        playSong,
        setIsPlaying,
        nextSong,
        prevSong,
        setVolume,
        setSleepTimer,
        onClose,
      });
    },
    [
      addRecentCommand,
      addToQueue,
      clearQueue,
      nextSong,
      onClose,
      prevSong,
      search,
      setCommandFeedback,
      playSong,
      setIsPlaying,
      setSleepTimer,
      setQuery,
      setVolume,
      shuffleQueue,
      songs,
    ]
  );

  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));

  const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "title", label: "标题" },
    { value: "artist", label: "歌手" },
    { value: "album", label: "专辑" },
  ];

  const durationOptions = [
    { label: "任意时长", value: "all", range: null },
    { label: "短", value: "short", range: { min: 0, max: 180 } },
    { label: "中", value: "medium", range: { min: 181, max: 360 } },
    { label: "长", value: "long", range: { min: 361, max: Number.MAX_SAFE_INTEGER } },
  ];

  const sourceOptions = useMemo(() => {
    const sources = Array.from(new Set(songs.map((song) => song.source).filter(Boolean))).sort();
    return ["all", ...sources];
  }, [songs]);

  const selectedDuration =
    durationOptions.find((option) => {
      if (!option.range && !filters.durationRange) return true;
      return (
        option.range?.min === filters.durationRange?.min &&
        option.range?.max === filters.durationRange?.max
      );
    })?.value || "all";

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
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runCommand(query);
                }
              }}
              placeholder="搜索歌曲、歌手、专辑..."
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
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
              isListening
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
            title={isListening ? "正在聆听..." : "语音搜索"}
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
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
            title="关闭搜索面板 (Esc)"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="listbox"
          aria-label="搜索命令"
        >
          {SEARCH_COMMAND_HINTS.map((hint) => (
            <button
              key={hint}
              onClick={() => {
                setQuery(hint.endsWith("m") ? hint : `${hint} `);
                inputRef.current?.focus();
              }}
              className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/55 transition-colors hover:bg-white/[0.12] hover:text-white"
            >
              {hint}
            </button>
          ))}
        </div>

        <div aria-live="polite" className="mt-2 min-h-4 text-xs">
          {voiceFeedback ? (
            <span className="text-yellow-300/90">{voiceFeedback}</span>
          ) : (
            <span className="text-emerald-300/80">{commandFeedback}</span>
          )}
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
          <span className="text-xs text-white/50">Filter:</span>
          <select
            value={filters.type}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-white/30"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {filters.type !== "all" && (
            <button onClick={clearFilters} className="text-xs text-white/40 hover:text-white/70">
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <select
            value={selectedDuration}
            onChange={(e) => {
              const option = durationOptions.find((item) => item.value === e.target.value);
              setDurationRange(option?.range ?? null);
            }}
            className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-white/30"
          >
            {durationOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filters.source}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-white/30"
          >
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {source === "all" ? "所有来源" : source}
              </option>
            ))}
          </select>
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
                清除
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
                Clear
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

        {!query && recentCommands.length > 0 && (
          <div className="px-4 pb-3">
            <div className="mb-2 text-xs text-white/40">最近命令</div>
            <div className="flex flex-wrap gap-1.5">
              {recentCommands.map((command) => (
                <button
                  key={command}
                  onClick={() => runCommand(command)}
                  className="rounded bg-white/5 px-2 py-0.5 text-xs text-white/50 transition-colors hover:bg-white/10"
                >
                  {command}
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
            <p className="text-white/50">未找到匹配结果</p>
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
                    <Image
                      src={song.cover || DEFAULT_COVER_SRC}
                      alt={song.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Music className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{song.title}</p>
                    <p className="text-white/50 text-sm truncate">{song.artist}</p>
                  </div>
                  {song.album && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNarrowSearch(song.album || "", "album");
                      }}
                      className="text-white/40 hover:text-white text-xs px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                      title="搜索此专辑"
                    >
                      {song.album}
                    </button>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySong(song);
                      }}
                      className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                      title="立即播放"
                    >
                      <Play className="w-3.5 h-3.5" fill="currentColor" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToQueue(song);
                      }}
                      className="w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center hover:bg-white/20 hover:text-white transition-colors"
                      title="添加到队列"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayNext(song);
                      }}
                      className="w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center hover:bg-white/20 hover:text-white transition-colors"
                      title="下一首播放"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNarrowSearch(song.artist, "artist");
                      }}
                      className="w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center hover:bg-white/20 hover:text-white transition-colors"
                      title="搜索此歌手"
                    >
                      <User className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
                  第 {page} 页 / 共 {totalPages} 页
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
    <AnimatePresence>
      {isOpen && (
        <div
          data-testid="top-search-drawer-container"
          className="fixed inset-0 z-[100] flex justify-center pointer-events-none"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md pointer-events-auto"
          />

          {/* Top-Edge Slide-Down Glass Drawer */}
          <motion.div
            data-testid="top-search-drawer"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onPointerEnter={handleMouseEnter}
            onPointerLeave={handleMouseLeave}
            className="relative w-[92vw] max-w-3xl max-h-[85vh] flex flex-col rounded-b-[28px] border-b border-x border-white/15 bg-[#0a0c16]/92 backdrop-blur-3xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] pointer-events-auto overflow-hidden z-10"
          >
            {/* Top Micro Accent Glow Line */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-white/40 to-transparent shrink-0" />

            {content}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
