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
  setLoopMode: (mode: LoopMode) => void;
  updateCurrentSongCover: (cover: string) => void;
  updateCurrentSongLyrics: (lyrics: string, translationLyrics?: string) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  nextSong: () => void;
  prevSong: () => void;
}

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

      setCurrentSong: (song) => set({ currentSong: song }),
      updateCurrentSongCover: (cover) =>
        set((state) => (state.currentSong ? { currentSong: { ...state.currentSong, cover } } : {})),
      updateCurrentSongLyrics: (lyrics, translationLyrics) =>
        set((state) =>
          state.currentSong
            ? {
                currentSong: {
                  ...state.currentSong,
                  lyrics,
                  translationLyrics: translationLyrics || state.currentSong.translationLyrics,
                },
              }
            : {}
        ),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
      setDuration: (duration) => set({ duration }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setIsMuted: (muted) => set({ isMuted: muted }),
      setPlaybackRate: (rate) => {
        const clampedRate = Math.max(0.5, Math.min(2.0, rate));
        set({ playbackRate: Math.round(clampedRate * 10) / 10 });
      },
      setLoopMode: (mode) => set({ loopMode: mode }),
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      nextSong: () => {},
      prevSong: () => {},
    }),
    {
      name: "player-store",
      storage: createJSONStorage(() => createSafeStorage("player-store")),
      partialize: (state) => ({
        currentSong: state.currentSong ? sanitizeSongForStorage(state.currentSong) : null,
        currentTime: state.currentTime,
        duration: state.duration,
        volume: state.volume,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        loopMode: state.loopMode,
      }),
    }
  )
);
