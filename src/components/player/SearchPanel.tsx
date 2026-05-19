"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { GlassModal } from "@/components/shared/Glass";
import { parseSearchCommand, SEARCH_COMMAND_HINTS } from "@/lib/search/commandRouter";

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
  { value: "all", label: "All", icon: Search },
  { value: "song", label: "Songs", icon: Music },
  { value: "artist", label: "Artists", icon: User },
  { value: "album", label: "Albums", icon: Disc },
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
  }, [query, searchType, filters, songs, search]);

  const handleVoiceSearch = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Your browser does not support voice search");
      return;
    }

    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

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

  const handlePlaySong = useCallback(
    (song: Song) => {
      setCurrentSong(song);
      setIsPlaying(true);
      onClose();
    },
    [onClose, setCurrentSong, setIsPlaying]
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

  const findCommandMatches = useCallback(
    (searchQuery: string) => {
      const needle = searchQuery.toLowerCase().trim();
      if (!needle) return [];
      return songs.filter((song) => {
        const title = song.title.toLowerCase();
        const artist = song.artist.toLowerCase();
        const album = song.album?.toLowerCase() || "";
        return title.includes(needle) || artist.includes(needle) || album.includes(needle);
      });
    },
    [songs]
  );

  const runCommand = useCallback(
    (value: string) => {
      const command = parseSearchCommand(value);

      if (command.kind === "text-search") {
        setQuery(command.query);
        search(songs);
        return;
      }

      addRecentCommand(command.raw.trim());

      if (command.kind === "clear") {
        clearQueue();
        setCommandFeedback("Queue cleared");
        return;
      }

      if (command.kind === "shuffle") {
        shuffleQueue();
        setCommandFeedback("Queue shuffled");
        return;
      }

      if (command.kind === "sleep") {
        if (!command.minutes) {
          setCommandFeedback("Use /sleep 30m");
          return;
        }

        useSleepTimerStore.getState().setTimer(command.minutes);
        setCommandFeedback(`Sleep timer set for ${command.minutes} minutes`);
        return;
      }

      const matches = findCommandMatches(command.query);
      if (matches.length === 0) {
        setCommandFeedback(`No matches for "${command.query}"`);
        return;
      }

      if (command.kind === "play") {
        handlePlaySong(matches[0]);
        setCommandFeedback(`Playing ${matches[0].title}`);
        return;
      }

      if (command.kind === "queue") {
        matches.slice(0, 10).forEach(addToQueue);
        setCommandFeedback(`Queued ${Math.min(matches.length, 10)} songs`);
      }
    },
    [
      addRecentCommand,
      addToQueue,
      clearQueue,
      findCommandMatches,
      handlePlaySong,
      search,
      setCommandFeedback,
      setQuery,
      shuffleQueue,
      songs,
    ]
  );

  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));

  const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "title", label: "Title" },
    { value: "artist", label: "Artist" },
    { value: "album", label: "Albums" },
  ];

  const durationOptions = [
    { label: "Any length", value: "all", range: null },
    { label: "Short", value: "short", range: { min: 0, max: 180 } },
    { label: "Medium", value: "medium", range: { min: 181, max: 360 } },
    { label: "Long", value: "long", range: { min: 361, max: Number.MAX_SAFE_INTEGER } },
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
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runCommand(query);
                }
              }}
              placeholder="Search songs, artists, albums..."
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

        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="listbox"
          aria-label="Search commands"
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

        <div aria-live="polite" className="mt-2 min-h-4 text-xs text-emerald-300/80">
          {commandFeedback}
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
                {source === "all" ? "All sources" : source}
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
                <span className="text-sm">Recent searches</span>
              </div>
              <button
                onClick={clearRecentSearches}
                className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
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
              <span className="text-xs text-white/40">Search history</span>
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
            <div className="mb-2 text-xs text-white/40">Recent commands</div>
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
            <p className="text-white/50">No matching results</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="p-4">
            <div className="flex items-center gap-2 text-white/60 mb-3">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Search results ({totalResults})</span>
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
                      title="Search this album"
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
                      title="Play now"
                    >
                      <Play className="w-3.5 h-3.5" fill="currentColor" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToQueue(song);
                      }}
                      className="w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center hover:bg-white/20 hover:text-white transition-colors"
                      title="Add to queue"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayNext(song);
                      }}
                      className="w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center hover:bg-white/20 hover:text-white transition-colors"
                      title="Play next"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNarrowSearch(song.artist, "artist");
                      }}
                      className="w-8 h-8 rounded-full bg-white/10 text-white/70 flex items-center justify-center hover:bg-white/20 hover:text-white transition-colors"
                      title="Search this artist"
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
                  Previous
                </motion.button>
                <span className="text-xs text-white/50">
                  Page {page} / {totalPages}
                </span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded-lg text-xs bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
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
