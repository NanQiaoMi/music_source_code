import { AudioSliceCreator, PlaybackSliceState, LoopMode, Song } from "./types";
import { usePlayerStore } from "../playerStore";
import { useQueueStore } from "../queueStore";
import { useRecommendationStore } from "../recommendationStore";
import { usePlaylistStore } from "../playlistStore";
import { usePlaybackRuntimeStore } from "../playbackRuntimeStore";
import {
  hasPlayableAudioSource,
  createMissingAudioSourceError,
} from "@/lib/audio/playableAudioSource";

const getPlaybackSongId = (song: Song | null): string | null =>
  song ? String(song.id || song.title || "") || null : null;

const startPlaybackRequest = (song: Song): void => {
  usePlaybackRuntimeStore
    .getState()
    .requestPlayback(getPlaybackSongId(song), song.audioUrl || null, true, true);
};

const clearPlaybackRequest = (): void => {
  usePlaybackRuntimeStore.getState().requestPlayback(null, null, false, true);
};

type AudioSeekHandler = (time: number) => void;
let globalSeekHandler: AudioSeekHandler | null = null;

export const registerAudioSeekHandler = (handler: AudioSeekHandler | null) => {
  globalSeekHandler = handler;
};

export const getAudioSeekHandler = () => globalSeekHandler;

// 节流与生命周期状态
let lastProgressSyncTime = 0;
let progressThrottleTimeout: NodeJS.Timeout | null = null;
const PROGRESS_THROTTLE_MS = 5000;

export const createPlaybackSlice: AudioSliceCreator<PlaybackSliceState> = (set, get) => {
  const flushProgressToStorage = () => {
    if (progressThrottleTimeout) {
      clearTimeout(progressThrottleTimeout);
      progressThrottleTimeout = null;
    }
    const current = get().currentTime;
    lastProgressSyncTime = Date.now();
    set({ persistedCurrentTime: current });
  };

  // 绑定浏览器生命周期事件（仅在客户端环境执行一次）
  if (typeof window !== "undefined") {
    const handleUnloadOrHide = () => {
      flushProgressToStorage();
    };

    window.addEventListener("beforeunload", handleUnloadOrHide);
    window.addEventListener("pagehide", handleUnloadOrHide);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        flushProgressToStorage();
      }
    });
  }

  return {
    isPlaying: usePlayerStore.getState().isPlaying ?? false,
    currentTime: usePlayerStore.getState().currentTime ?? 0,
    persistedCurrentTime: usePlayerStore.getState().currentTime ?? 0,
    duration: usePlayerStore.getState().duration ?? 0,
    loopMode: usePlayerStore.getState().loopMode ?? "none",
    currentSong: usePlayerStore.getState().currentSong ?? null,
    isLoading: usePlayerStore.getState().isLoading ?? false,
    error: null,
    bufferedRanges: [],

    fadeInDuration: 0.5,
    fadeOutDuration: 0.5,
    isFadeInEnabled: true,
    isFadeOutEnabled: true,
    gaplessPlayback: true,
    preloadCount: 2,
    isEmotionCurveMode: false,
    dynamicCrossfadeDuration: 3,

    flushProgressToStorage,

    setIsPlaying: (playing) => {
      const currentSong = usePlayerStore.getState().currentSong ?? get().currentSong;
      if (playing && currentSong && !hasPlayableAudioSource(currentSong)) {
        usePlaybackRuntimeStore
          .getState()
          .requestPlayback(getPlaybackSongId(currentSong), currentSong.audioUrl || null, false);
        usePlayerStore.getState().setIsLoading(false);
        set({ isPlaying: false, isLoading: false, error: createMissingAudioSourceError() });
        return;
      }

      usePlayerStore.getState().setIsPlaying(playing);
      if (playing) {
        set({ isLoading: true, error: null });
      } else {
        flushProgressToStorage();
        usePlayerStore.getState().setIsLoading(false);
        set({ isLoading: false });
      }
    },

    togglePlaybackIntent: () => {
      get().setIsPlaying(!usePlaybackRuntimeStore.getState().shouldPlay);
    },

    setCurrentTime: (time) => {
      const clamped = Math.max(0, time);
      // audioStore 即进度权威；playerStore 镜像由 audioStore 订阅单向投影
      const now = Date.now();
      if (now - lastProgressSyncTime >= PROGRESS_THROTTLE_MS) {
        lastProgressSyncTime = now;
        if (progressThrottleTimeout) {
          clearTimeout(progressThrottleTimeout);
          progressThrottleTimeout = null;
        }
        set({ currentTime: clamped, persistedCurrentTime: clamped });
      } else {
        // 仅在内存更新高频数值，不触发 persistedCurrentTime 变更
        set({ currentTime: clamped });

        if (!progressThrottleTimeout) {
          progressThrottleTimeout = setTimeout(() => {
            progressThrottleTimeout = null;
            lastProgressSyncTime = Date.now();
            set({ persistedCurrentTime: get().currentTime });
          }, PROGRESS_THROTTLE_MS);
        }
      }
    },

    setDuration: (duration) => {
      set({ duration });
    },

    setLoopMode: (mode) => {
      usePlayerStore.getState().setLoopMode(mode);
      set({ loopMode: mode });
    },

    cycleLoopMode: () => {
      const modes: LoopMode[] = ["none", "all", "single", "shuffle"];
      const { loopMode } = get();
      const currentIndex = modes.indexOf(loopMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      const nextMode = modes[nextIndex];
      usePlayerStore.getState().setLoopMode(nextMode);
      set({ loopMode: nextMode });
    },

    setCurrentSong: (song) => {
      usePlayerStore.getState().setCurrentSong(song);
      set({ currentSong: song });
    },

    updateCurrentSongLyrics: (lyrics, translationLyrics) => {
      usePlayerStore.getState().updateCurrentSongLyrics(lyrics, translationLyrics);
      const songId = get().currentSong?.id;
      if (songId) {
        useQueueStore.getState().updateSong(songId, { lyrics, translationLyrics });
      }
      set((state) => ({
        currentSong: state.currentSong
          ? {
              ...state.currentSong,
              lyrics,
              translationLyrics: translationLyrics || state.currentSong.translationLyrics,
            }
          : null,
      }));
    },

    updateCurrentSongCover: (cover) => {
      usePlayerStore.getState().updateCurrentSongCover(cover);
      const songId = get().currentSong?.id;
      if (songId) {
        useQueueStore.getState().updateSong(songId, { cover });
      }
      set((state) => ({
        currentSong: state.currentSong
          ? {
              ...state.currentSong,
              cover,
            }
          : null,
      }));
    },

    nextSong: () => {
      flushProgressToStorage();
      const queueStore = useQueueStore.getState();
      const queue = queueStore.queue;
      const { loopMode, currentSong } = get();

      // 优先对齐当前队列与当前索引，防止跨组件直接调用 setState 时索引脱节
      let currentIndex = queueStore.currentIndex;
      if (get().currentIndex >= 0 && get().currentIndex < queue.length) {
        currentIndex = get().currentIndex;
      } else if (currentSong) {
        const foundIndex = queue.findIndex((s) => s.id === currentSong.id);
        if (foundIndex >= 0) {
          currentIndex = foundIndex;
        }
      }

      if (queue.length === 0) {
        if (queueStore.playThroughMode === "play-through") {
          clearPlaybackRequest();
          usePlayerStore.getState().setCurrentSong(null);
          set({ currentSong: null, isPlaying: false });
          return;
        }
        if (loopMode !== "single" && loopMode !== "all") {
          const recs = useRecommendationStore.getState().getRecommendations();
          if (recs.length > 0) {
            queueStore.setQueue(recs);
            queueStore.setCurrentIndex(0);
            queueStore.addToHistory(recs[0]);
            startPlaybackRequest(recs[0]);
            usePlayerStore.getState().setCurrentSong(recs[0]);
            set({
              currentSong: recs[0],
              currentTime: 0,
              persistedCurrentTime: 0,
              isPlaying: false,
              isLoading: true,
              error: null,
            });
          } else {
            clearPlaybackRequest();
            usePlayerStore.getState().setCurrentSong(null);
            set({ currentSong: null, isPlaying: false });
          }
        } else {
          clearPlaybackRequest();
          usePlayerStore.getState().setCurrentSong(null);
          set({ currentSong: null, isPlaying: false });
        }
        return;
      }

      let nextIndex: number;
      if (loopMode === "shuffle") {
        nextIndex = Math.floor(Math.random() * queue.length);
      } else if (loopMode === "none" && currentIndex >= queue.length - 1) {
        clearPlaybackRequest();
        usePlayerStore.getState().setCurrentSong(null);
        queueStore.setCurrentIndex(0);
        set({ currentSong: null, isPlaying: false, currentTime: 0, persistedCurrentTime: 0 });
        return;
      } else {
        nextIndex = (currentIndex + 1) % queue.length;
      }

      const nextSongItem = queue[nextIndex];
      startPlaybackRequest(nextSongItem);
      usePlayerStore.getState().setCurrentSong(nextSongItem);
      queueStore.setCurrentIndex(nextIndex);
      queueStore.addToHistory(nextSongItem);

      set({
        currentSong: nextSongItem,
        currentTime: 0,
        persistedCurrentTime: 0,
        isPlaying: false,
        isLoading: true,
        error: null,
      });
    },

    prevSong: () => {
      flushProgressToStorage();
      const queueStore = useQueueStore.getState();
      const queue = queueStore.queue;
      if (queue.length === 0) return;

      const { loopMode, currentSong } = get();
      let currentIndex = queueStore.currentIndex;
      if (get().currentIndex >= 0 && get().currentIndex < queue.length) {
        currentIndex = get().currentIndex;
      } else if (currentSong) {
        const foundIndex = queue.findIndex((s) => s.id === currentSong.id);
        if (foundIndex >= 0) {
          currentIndex = foundIndex;
        }
      }

      let prevIndex: number;
      if (loopMode === "shuffle") {
        prevIndex = Math.floor(Math.random() * queue.length);
      } else {
        prevIndex = (currentIndex - 1 + queue.length) % queue.length;
      }

      const prevSongItem = queue[prevIndex];
      queueStore.setCurrentIndex(prevIndex);
      queueStore.addToHistory(prevSongItem);
      startPlaybackRequest(prevSongItem);
      usePlayerStore.getState().setCurrentSong(prevSongItem);

      set({
        currentSong: prevSongItem,
        currentTime: 0,
        persistedCurrentTime: 0,
        isPlaying: false,
        isLoading: true,
        error: null,
      });
    },

    setIsLoading: (loading) => {
      usePlayerStore.getState().setIsLoading(loading);
      set({ isLoading: loading });
    },

    setError: (error) => set({ error, isPlaying: false }),
    clearError: () => set({ error: null }),
    setBufferedRanges: (ranges) => set({ bufferedRanges: ranges }),

    playSong: (song) => {
      if (!hasPlayableAudioSource(song)) {
        usePlayerStore.getState().setIsPlaying(false);
        usePlayerStore.getState().setIsLoading(false);
        set({
          isPlaying: false,
          isLoading: false,
          error: createMissingAudioSourceError(),
        });
        return;
      }

      flushProgressToStorage();
      const queueStore = useQueueStore.getState();
      const currentQueue = queueStore.queue;
      const queueIdx = currentQueue.findIndex((s) => s.id === song.id);

      let fullQueue: Song[];
      let startIdx: number;

      if (queueIdx >= 0) {
        fullQueue = currentQueue;
        startIdx = queueIdx;
      } else {
        const playlistSongs = usePlaylistStore.getState().songs;
        const idx = playlistSongs.findIndex((s) => s.id === song.id);
        if (idx >= 0) {
          fullQueue = playlistSongs;
          startIdx = idx;
        } else {
          fullQueue = currentQueue.length > 0 ? [...currentQueue, song] : [song];
          startIdx = fullQueue.length - 1;
        }
      }

      queueStore.setQueue(fullQueue);
      queueStore.setCurrentIndex(startIdx);
      queueStore.addToHistory(song);
      startPlaybackRequest(song);
      usePlayerStore.getState().setCurrentSong(song);

      set({
        currentSong: song,
        currentTime: 0,
        persistedCurrentTime: 0,
        isPlaying: false,
        isLoading: true,
        error: null,
        isEmotionCurveMode: false,
      });
    },

    playQueue: (songs, startIndex = 0) => {
      if (songs.length === 0) return;
      const index = Math.max(0, Math.min(startIndex, songs.length - 1));
      const song = songs[index];
      if (!hasPlayableAudioSource(song)) {
        usePlayerStore.getState().setIsPlaying(false);
        usePlayerStore.getState().setIsLoading(false);
        set({
          isPlaying: false,
          isLoading: false,
          error: createMissingAudioSourceError(),
        });
        return;
      }

      flushProgressToStorage();
      const queueStore = useQueueStore.getState();
      queueStore.setQueue(songs);
      queueStore.setCurrentIndex(index);
      queueStore.addToHistory(song);
      startPlaybackRequest(song);
      usePlayerStore.getState().setCurrentSong(song);

      set({
        currentSong: song,
        currentTime: 0,
        persistedCurrentTime: 0,
        isPlaying: false,
        isLoading: true,
        error: null,
        isEmotionCurveMode: false,
      });
    },

    appendSongsAndPlay: (songs: Song[]) => {
      if (!songs || songs.length === 0) return;
      const firstSong = songs[0];
      if (!hasPlayableAudioSource(firstSong)) {
        usePlayerStore.getState().setIsPlaying(false);
        usePlayerStore.getState().setIsLoading(false);
        set({
          isPlaying: false,
          isLoading: false,
          error: createMissingAudioSourceError(),
        });
        return;
      }

      flushProgressToStorage();
      const queueStore = useQueueStore.getState();
      const currentQueue = queueStore.queue;
      const startIndex = currentQueue.length;
      const newQueue = [...currentQueue, ...songs];

      queueStore.setQueue(newQueue);
      queueStore.setCurrentIndex(startIndex);
      queueStore.addToHistory(firstSong);
      startPlaybackRequest(firstSong);
      usePlayerStore.getState().setCurrentSong(firstSong);

      set({
        currentSong: firstSong,
        currentTime: 0,
        persistedCurrentTime: 0,
        isPlaying: false,
        isLoading: true,
        error: null,
      });
    },

    seekTo: (time) => {
      const clampedTime = Math.max(0, time);
      set({ currentTime: clampedTime, persistedCurrentTime: clampedTime });
      flushProgressToStorage();
      if (globalSeekHandler) {
        globalSeekHandler(clampedTime);
      }
    },

    setFadeInDuration: (duration) => set({ fadeInDuration: Math.max(0.1, Math.min(3, duration)) }),
    setFadeOutDuration: (duration) =>
      set({ fadeOutDuration: Math.max(0.1, Math.min(3, duration)) }),
    setIsFadeInEnabled: (enabled) => set({ isFadeInEnabled: enabled }),
    setIsFadeOutEnabled: (enabled) => set({ isFadeOutEnabled: enabled }),
    setGaplessPlayback: (enabled) => set({ gaplessPlayback: enabled }),
    setPreloadCount: (count) => set({ preloadCount: Math.max(0, Math.min(5, count)) }),
    setIsEmotionCurveMode: (enabled) => set({ isEmotionCurveMode: enabled }),
    setDynamicCrossfadeDuration: (duration) =>
      set({ dynamicCrossfadeDuration: Math.max(0, Math.min(20, duration)) }),
  };
};
