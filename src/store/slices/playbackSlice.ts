import { AudioSliceCreator, PlaybackSliceState, Song } from "./types";
import { usePlayerStore } from "../playerStore";
import { useQueueStore } from "../queueStore";
import { usePlaylistStore } from "../playlistStore";
import { usePlaybackRuntimeStore } from "../playbackRuntimeStore";
import { advanceQueue } from "../queueNavigation";
import {
  hasPlayableAudioSource,
  createMissingAudioSourceError,
} from "@/lib/audio/playableAudioSource";
import {
  createMissingSourceState,
  createTrackStartState,
  emitAudioSeek,
  getNextLoopMode,
  getPlaybackSongId,
  withCurrentSongCover,
  withCurrentSongLyrics,
} from "./playback/helpers";

export { registerAudioSeekHandler, getAudioSeekHandler } from "./playback/helpers";

const startPlaybackRequest = (song: Song): void => {
  usePlaybackRuntimeStore
    .getState()
    .requestPlayback(getPlaybackSongId(song), song.audioUrl || null, true, true);
};

const clearPlaybackRequest = (): void => {
  usePlaybackRuntimeStore.getState().requestPlayback(null, null, false, true);
};

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
      const nextMode = getNextLoopMode(get().loopMode);
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
        currentSong: withCurrentSongLyrics(state.currentSong, lyrics, translationLyrics),
      }));
    },

    updateCurrentSongCover: (cover) => {
      usePlayerStore.getState().updateCurrentSongCover(cover);
      const songId = get().currentSong?.id;
      if (songId) {
        useQueueStore.getState().updateSong(songId, { cover });
      }
      set((state) => ({
        currentSong: withCurrentSongCover(state.currentSong, cover),
      }));
    },

    nextSong: () => {
      flushProgressToStorage();
      const result = advanceQueue("next", { currentSong: get().currentSong });

      // S1-5: 队列唯一权威——导航统一走 QueueNavigator（现取 queueStore 快照，
      // 删歌/重排/清空后仍与 queueStore.currentIndex 保持一致）。
      if (!result.song) {
        // S1-5 停止语义：清空队列/播到边界只停止，不回填推荐、不产生错误/toast。
        clearPlaybackRequest();
        usePlayerStore.getState().setCurrentSong(null);
        set({ currentSong: null, isPlaying: false, isLoading: false });
        return;
      }

      // S6: 切歌状态收敛到 createTrackStartState；导航切歌不重置情感曲线模式。
      startPlaybackRequest(result.song);
      usePlayerStore.getState().setCurrentSong(result.song);
      useQueueStore.getState().addToHistory(result.song);
      set(createTrackStartState(result.song));
    },

    prevSong: () => {
      flushProgressToStorage();
      const result = advanceQueue("prev", { currentSong: get().currentSong });

      if (!result.song) {
        // 与 nextSong 共用停止语义：边界只停止，不产生错误/toast。
        clearPlaybackRequest();
        usePlayerStore.getState().setCurrentSong(null);
        set({ currentSong: null, isPlaying: false, isLoading: false });
        return;
      }

      // S6: 与 nextSong 共用 createTrackStartState；导航切歌不重置情感曲线模式。
      startPlaybackRequest(result.song);
      usePlayerStore.getState().setCurrentSong(result.song);
      useQueueStore.getState().addToHistory(result.song);
      set(createTrackStartState(result.song));
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
        set(createMissingSourceState());
        return;
      }

      flushProgressToStorage();
      const queueStore = useQueueStore.getState();
      const currentQueue = queueStore.queue;
      // Position is authoritative (duplicate ids are distinct queue entries):
      // when the navigator already moved currentIndex, keep that occurrence.
      const indexedSong = currentQueue[queueStore.currentIndex];
      const queueIdx =
        indexedSong && indexedSong.id === song.id
          ? queueStore.currentIndex
          : currentQueue.findIndex((s) => s.id === song.id);

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

      set(createTrackStartState(song, { resetEmotionCurve: true }));
    },

    playQueue: (songs, startIndex = 0) => {
      if (songs.length === 0) return;
      const index = Math.max(0, Math.min(startIndex, songs.length - 1));
      const song = songs[index];
      if (!hasPlayableAudioSource(song)) {
        usePlayerStore.getState().setIsPlaying(false);
        usePlayerStore.getState().setIsLoading(false);
        set(createMissingSourceState());
        return;
      }

      flushProgressToStorage();
      const queueStore = useQueueStore.getState();
      queueStore.setQueue(songs);
      queueStore.setCurrentIndex(index);
      queueStore.addToHistory(song);
      startPlaybackRequest(song);
      usePlayerStore.getState().setCurrentSong(song);

      set(createTrackStartState(song, { resetEmotionCurve: true }));
    },

    appendSongsAndPlay: (songs: Song[]) => {
      if (!songs || songs.length === 0) return;
      const firstSong = songs[0];
      if (!hasPlayableAudioSource(firstSong)) {
        usePlayerStore.getState().setIsPlaying(false);
        usePlayerStore.getState().setIsLoading(false);
        set(createMissingSourceState());
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

      set(createTrackStartState(firstSong));
    },

    seekTo: (time) => {
      const clampedTime = Math.max(0, time);
      set({ currentTime: clampedTime, persistedCurrentTime: clampedTime });
      flushProgressToStorage();
      emitAudioSeek(clampedTime);
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
