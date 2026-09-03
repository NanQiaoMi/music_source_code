import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Song } from "@/types/song";
import { createSafeStorage, sanitizeSongForStorage } from "@/lib/storage/safeStorage";

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

// 注册与 audioStore 的实时双向强同步
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
        set({ isPlaying: playing });
        audioStoreSyncListener?.({ isPlaying: playing });
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
        const nextPlaying = !_get().isPlaying;
        set({ isPlaying: nextPlaying });
        audioStoreSyncListener?.({ isPlaying: nextPlaying });
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
      name: "player-store",
      storage: createJSONStorage(() => createSafeStorage("player-store")),
      partialize: (state) => ({
        currentSong: state.currentSong ? sanitizeSongForStorage(state.currentSong) : null,
        currentTime: typeof state.currentTime === "number" ? state.currentTime : 0,
        duration: typeof state.duration === "number" ? state.duration : 0,
        volume: state.volume,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        loopMode: state.loopMode,
      }),
    }
  )
);

// 监听直接 setState 的变化，并实时双向同步至 audioStore
usePlayerStore.subscribe((state, prev) => {
  const updates: Partial<PlayerState> = {};
  if (state.isPlaying !== prev.isPlaying) updates.isPlaying = state.isPlaying;
  if (state.currentSong?.id !== prev.currentSong?.id) updates.currentSong = state.currentSong;
  if (state.currentTime !== prev.currentTime) updates.currentTime = state.currentTime;
  if (state.duration !== prev.duration) updates.duration = state.duration;
  if (state.isLoading !== prev.isLoading) updates.isLoading = state.isLoading;
  if (state.volume !== prev.volume) updates.volume = state.volume;
  if (state.isMuted !== prev.isMuted) updates.isMuted = state.isMuted;
  if (state.playbackRate !== prev.playbackRate) updates.playbackRate = state.playbackRate;
  if (state.loopMode !== prev.loopMode) updates.loopMode = state.loopMode;
  if (Object.keys(updates).length > 0) {
    audioStoreSyncListener?.(updates);
  }
});

