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
  const playQueue = useAudioStore((state) => state.playQueue);
  const setIsPlaying = useAudioStore((state) => state.setIsPlaying);
  const nextSong = useAudioStore((state) => state.nextSong);
  const prevSong = useAudioStore((state) => state.prevSong);
  const setVolume = useAudioStore((state) => state.setVolume);
  const setSleepTimer = useSleepTimerStore((state) => state.setTimer);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const handleMouseEnter = useCallback(() => {
    // Keep panel open
  }, []);

  // Mouse leave auto-retract: If query is empty, immediately close when mouse leaves the floating pill
  const handleMouseLeave = useCallback(() => {
    if (!query || !query.trim()) {
      inputRef.current?.blur();
      setIsInputFocused(false);
      onClose();
    }
  }, [query, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        inputRef.current?.blur();
        setIsInputFocused(false);
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        inputRef.current?.blur();
        setIsInputFocused(false);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Debounced search
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

    try {
      recognition.start();
    } catch {
      setVoiceFeedback("语音搜索启动失败。");
      setIsListening(false);
      setIsVoiceSearch(false);
    }
  }, [search, setIsVoiceSearch, setQuery, songs]);

  const handlePlayAllResults = useCallback(() => {
    if (results.length > 0) {
      playQueue(results, 0);
      onClose();
    }
  }, [results, playQueue, onClose]);

  const handlePlaySong = useCallback(
    (song: Song) => {
      const currentList = results.length > 0 ? results : [song];
      const idx = currentList.findIndex((s) => s.id === song.id);
      playQueue(currentList, idx >= 0 ? idx : 0);
      onClose();
    },
    [results, playQueue, onClose]
  );

  const handleAddNext = useCallback(
    (e: React.MouseEvent, song: Song) => {
      e.stopPropagation();
      insertNext(song);
    },
    [insertNext]
  );

  const handleAddToQueue = useCallback(
    (e: React.MouseEvent, song: Song) => {
      e.stopPropagation();
      addToQueue(song);
    },
    [addToQueue]
  );

  const handleRecentSearchClick = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);
      search(songs);
    },
    [search, setQuery, songs]
  );

  const handleHistoryClick = useCallback(
    (historyQuery: string) => {
      setQuery(historyQuery);
      search(songs);
    },
    [search, setQuery, songs]
  );

  const formatDuration = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const runCommand = useCallback(
    (commandText: string) => {
      const parsed = parseSearchCommand(commandText);
      if (!parsed) {
        search(songs);
        return;
      }

      executeSearchCommand(parsed, {
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
      playSong,
      prevSong,
      search,
      setIsPlaying,
      setQuery,
      setSleepTimer,
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
    { label: "短 (<3m)", value: "short", range: { min: 0, max: 180 } },
    { label: "中 (3-6m)", value: "medium", range: { min: 181, max: 360 } },
    { label: "长 (>6m)", value: "long", range: { min: 361, max: Number.MAX_SAFE_INTEGER } },
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

  const hasDropdownContent =
    Boolean(query) ||
    Boolean(voiceFeedback) ||
    Boolean(commandFeedback) ||
    isSearching ||
    results.length > 0 ||
    recentSearches.length > 0 ||
    searchHistory.length > 0 ||
    recentCommands.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          data-testid="top-search-drawer-container"
          className="fixed top-3 left-1/2 -translate-x-1/2 w-[92vw] max-w-[540px] z-[100] pointer-events-none select-none"
        >
          {/* Floating Compact Dynamic Island Pill */}
          <motion.div
            ref={containerRef}
            data-testid="top-search-drawer"
            initial={{ y: -50, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -50, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onPointerEnter={handleMouseEnter}
            onPointerLeave={handleMouseLeave}
            className="w-full flex flex-col rounded-2xl border border-white/15 bg-[#0a0c16]/95 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08)] pointer-events-auto overflow-hidden"
          >
            {/* Top Micro Accent Glow */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-white/35 to-transparent shrink-0" />

            {/* Input Bar */}
            <div className="flex items-center px-3 py-2 gap-2">
              <Search className="w-4 h-4 text-white/50 shrink-0 ml-1" />
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
                className="flex-1 bg-transparent px-2 py-1 text-xs text-white placeholder-white/40 focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    clearSearch();
                  }}
                  className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                  title="清空"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleVoiceSearch}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  isListening
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
                title={isListening ? "正在聆听..." : "语音搜索"}
              >
                {isListening ? (
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.5 }}>
                    <Mic className="w-3.5 h-3.5" />
                  </motion.div>
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                title="关闭 (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            </div>

            {/* Dropdown Body: Only renders when searching or has content */}
            {hasDropdownContent && (
              <div className="flex flex-col border-t border-white/10 overflow-hidden">
                {/* Search Type Filters & Dropdowns Header (Fixed, not clipped) */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/[0.08] shrink-0">
                  <div className="flex items-center gap-1 shrink-0">
                    {SEARCH_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setSearchType(type.value)}
                        className={`px-2.5 py-1 rounded-full text-xs transition-colors flex items-center gap-1 ${
                          searchType === type.value
                            ? "bg-white text-black font-medium shadow-sm"
                            : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <type.icon className="w-3 h-3" />
                        {type.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={filters.type}
                      onChange={(e) => setFilterType(e.target.value as FilterType)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white/80 focus:outline-none cursor-pointer"
                    >
                      {FILTER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0f111a] text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedDuration}
                      onChange={(e) => {
                        const option = durationOptions.find((item) => item.value === e.target.value);
                        setDurationRange(option?.range ?? null);
                      }}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white/80 focus:outline-none cursor-pointer"
                    >
                      {durationOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0f111a] text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Scrollable Results & History Container */}
                <div className="max-h-[48vh] overflow-y-auto custom-scrollbar flex flex-col p-2.5 gap-2">

                {/* Feedback */}
                {(voiceFeedback || commandFeedback) && (
                  <div className="text-[11px] px-1">
                    {voiceFeedback ? (
                      <span className="text-yellow-300/90">{voiceFeedback}</span>
                    ) : (
                      <span className="text-emerald-300/80">{commandFeedback}</span>
                    )}
                  </div>
                )}

                {/* History and Commands when no query */}
                {!query && recentSearches.length > 0 && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-white/40 px-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        最近搜索
                      </span>
                      <button
                        onClick={clearRecentSearches}
                        className="hover:text-white/70 transition-colors"
                      >
                        清空
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recentSearches.map((s, idx) => (
                        <span
                          key={idx}
                          onClick={() => handleRecentSearchClick(s)}
                          className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-white/70 text-xs cursor-pointer flex items-center gap-1 transition-colors"
                        >
                          {s}
                          <X
                            className="w-3 h-3 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRecentSearch(s);
                            }}
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading state */}
                {isSearching && (
                  <div className="py-6 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
                  </div>
                )}

                {/* Empty State */}
                {query && !isSearching && results.length === 0 && (
                  <div className="py-5 text-center text-xs text-white/40">
                    未找到与 “{query}” 相关的音乐
                  </div>
                )}

                {/* Results List */}
                {results.length > 0 && (
                  <div className="flex flex-col gap-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-white/40 px-1 py-0.5">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        搜索结果 ({totalResults})
                      </span>
                      <button
                        type="button"
                        onClick={handlePlayAllResults}
                        className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                        title="播放全部搜索结果并加入播放列表"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        播放全部
                      </button>
                    </div>
                    <div className="space-y-1">
                      {results.map((song) => (
                        <div
                          key={song.id}
                          onClick={() => handlePlaySong(song)}
                          className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/10 cursor-pointer transition-colors group"
                        >
                          <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-white/5">
                            <Image
                              src={song.cover || DEFAULT_COVER_SRC}
                              alt={song.title}
                              fill
                              className="object-cover"
                              sizes="36px"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Play className="w-4 h-4 text-white fill-white" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-white truncate">{song.title}</div>
                            <div className="text-[11px] text-white/50 truncate">
                              {song.artist} {song.album ? `• ${song.album}` : ""}
                            </div>
                          </div>

                          <div className="text-[11px] text-white/40 font-mono tabular-nums shrink-0 mr-1">
                            {formatDuration(song.duration)}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={(e) => handleAddNext(e, song)}
                              className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                              title="下一首播放"
                            >
                              <ListPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => handleAddToQueue(e, song)}
                              className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                              title="添加到队列"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination if multiple pages */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-3 pt-2 mt-1 border-t border-white/10">
                        <button
                          disabled={page <= 1}
                          onClick={() => setPage(page - 1)}
                          className="px-2.5 py-0.5 rounded text-xs bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          上一页
                        </button>
                        <span className="text-[11px] text-white/40">
                          {page} / {totalPages}
                        </span>
                        <button
                          disabled={page >= totalPages}
                          onClick={() => setPage(page + 1)}
                          className="px-2.5 py-0.5 rounded text-xs bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          下一页
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
  );
}

