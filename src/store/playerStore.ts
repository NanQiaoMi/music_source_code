import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Song } from "@/types/song";
import { sanitizeSongForStorage } from "@/lib/storage/safeStorage";
import { createThrottledStorage } from "@/lib/storage/throttledPersist";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";

export type LoopMode = "none" | "single" | "all" | "shuffle";
interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  loopMode: LoopMode;

  setCurrentSong: (song: Song | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsLoading: (loading: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  resetPlaybackRate: () => void;
  setLoopMode: (mode: LoopMode) => void;
  updateCurrentSongCover: (cover: string) => void;
  updateCurrentSongLyrics: (lyrics: string, translationLyrics?: string) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  nextSong: () => void;
  prevSong: () => void;
}

// 非进度字段订阅同步；进度写入由 setter 委托 audioStore（唯一持久化权威）
type StoreSyncListener = (state: Partial<PlayerState>) => void;
let audioStoreSyncListener: StoreSyncListener | null = null;

export const registerAudioStoreSync = (listener: StoreSyncListener | null) => {
  audioStoreSyncListener = listener;
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, _get) => ({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isLoading: false,
      volume: 0.7,
      isMuted: false,
      playbackRate: 1.0,
      loopMode: "none",

      setCurrentSong: (song) => {
        set({ currentSong: song });
        audioStoreSyncListener?.({ currentSong: song });
      },
      updateCurrentSongCover: (cover) =>
        set((state) => {
          if (!state.currentSong) return {};
          const nextSong = { ...state.currentSong, cover };
          audioStoreSyncListener?.({ currentSong: nextSong });
          return { currentSong: nextSong };
        }),
      updateCurrentSongLyrics: (lyrics, translationLyrics) =>
        set((state) => {
          if (!state.currentSong) return {};
          const nextSong = {
            ...state.currentSong,
            lyrics,
            translationLyrics: translationLyrics || state.currentSong.translationLyrics,
          };
          audioStoreSyncListener?.({ currentSong: nextSong });
          return { currentSong: nextSong };
        }),
      setIsPlaying: (playing) => {
        const currentSong = _get().currentSong;
        usePlaybackRuntimeStore
          .getState()
          .requestPlayback(
            currentSong ? String(currentSong.id || currentSong.title || "") : null,
            currentSong?.audioUrl || null,
            playing
          );
        if (currentSong) set({ isLoading: playing });
      },
      setCurrentTime: (time) => {
        const t = Math.max(0, time);
        set({ currentTime: t });
        audioStoreSyncListener?.({ currentTime: t });
      },
      setDuration: (duration) => {
        set({ duration });
        audioStoreSyncListener?.({ duration });
      },
      setIsLoading: (loading) => {
        set({ isLoading: loading });
        audioStoreSyncListener?.({ isLoading: loading });
      },
      setVolume: (volume) => {
        const v = Math.max(0, Math.min(1, volume));
        set({ volume: v });
        audioStoreSyncListener?.({ volume: v });
      },
      setIsMuted: (muted) => {
        set({ isMuted: muted });
        audioStoreSyncListener?.({ isMuted: muted });
      },
      setPlaybackRate: (rate) => {
        const clampedRate = Math.max(0.5, Math.min(2.0, rate));
        const r = Math.round(clampedRate * 100) / 100;
        set({ playbackRate: r });
        audioStoreSyncListener?.({ playbackRate: r });
      },
      resetPlaybackRate: () => {
        set({ playbackRate: 1.0 });
        audioStoreSyncListener?.({ playbackRate: 1.0 });
      },
      setLoopMode: (mode) => {
        set({ loopMode: mode });
        audioStoreSyncListener?.({ loopMode: mode });
      },
      togglePlay: () => {
        const nextPlaying = !usePlaybackRuntimeStore.getState().shouldPlay;
        const currentSong = _get().currentSong;
        usePlaybackRuntimeStore
          .getState()
          .requestPlayback(
            currentSong ? String(currentSong.id || currentSong.title || "") : null,
            currentSong?.audioUrl || null,
            nextPlaying
          );
        if (currentSong) set({ isLoading: nextPlaying });
      },
      toggleMute: () => {
        const nextMuted = !_get().isMuted;
        set({ isMuted: nextMuted });
        audioStoreSyncListener?.({ isMuted: nextMuted });
      },
      nextSong: () => {},
      prevSong: () => {},
    }),
    {
      skipHydration: true,
      name: "player-store",
      storage: createJSONStorage(() => createThrottledStorage("player-store")),
      partialize: (state) => ({
        // 播放进度只由 audioStore 持久化；currentTime/duration 在此仅为运行时镜像
        currentSong: state.currentSong ? sanitizeSongForStorage(state.currentSong) : null,
        volume: state.volume,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        loopMode: state.loopMode,
      }),
      // 兼容旧 envelope：即使旧数据仍带进度字段，也不允许其覆盖 audioStore 的权威值
      merge: (persisted, current) => {
        const restored = { ...((persisted ?? {}) as Partial<PlayerState>) };
        delete restored.currentTime;
        delete restored.duration;
        return { ...current, ...restored };
      },
    }
  )
);

// 监听直接 setState 的变化并同步非进度字段；进度订阅不再从 playerStore 写入 audioStore
usePlayerStore.subscribe((state, prev) => {
  const updates: Partial<PlayerState> = {};
  if (state.isPlaying !== prev.isPlaying) updates.isPlaying = state.isPlaying;
  if (state.currentSong !== prev.currentSong) updates.currentSong = state.currentSong;
  if (state.isLoading !== prev.isLoading) updates.isLoading = state.isLoading;
  if (state.volume !== prev.volume) updates.volume = state.volume;
  if (state.isMuted !== prev.isMuted) updates.isMuted = state.isMuted;
  if (state.playbackRate !== prev.playbackRate) updates.playbackRate = state.playbackRate;
  if (state.loopMode !== prev.loopMode) updates.loopMode = state.loopMode;
  if (Object.keys(updates).length > 0) {
    audioStoreSyncListener?.(updates);
  }
});
