import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useQueueStore } from "./queueStore";
import { useRecommendationStore } from "./recommendationStore";
import { usePlayerStore } from "./playerStore";
import { useEQStore } from "./eqStore";

import { Song } from "@/types/song";

export type { Song };

export type LoopMode = "none" | "single" | "all" | "shuffle";

export interface AudioError {
  type: "load" | "play" | "network" | "decode" | "unknown";
  message: string;
  timestamp: number;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: "audiooutput" | "audioinput";
}

export type EQPreset =
  | "flat"
  | "pop"
  | "rock"
  | "classical"
  | "jazz"
  | "vocal"
  | "light"
  | "bass"
  | "treble"
  | "custom1"
  | "custom2"
  | "custom3";

export type HeadphonePreset =
  | "default"
  | "headphone-open"
  | "headphone-closed"
  | "headphone-in-ear"
  | "headphone-studio"
  | "custom";

interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  loopMode: LoopMode;
  currentSong: Song | null;
  queue: Song[];
  currentIndex: number;
  isLoading: boolean;
  error: AudioError | null;
  bufferedRanges: { start: number; end: number }[];

  eqBands: number[];
  currentEQPreset: EQPreset;
  isEQEnabled: boolean;
  customEQPresets: { [key: string]: number[] };

  stereoEnhance: number;
  surroundSound: number;
  bassBoost: number;
  trebleBoost: number;
  vocalEnhance: number;
  loudnessNormalization: boolean;
  targetLoudness: number;
  isLosslessMode: boolean;

  audioDevices: AudioDevice[];
  currentAudioDevice: string | null;
  isDeviceEnumerationSupported: boolean;

  headphonePreset: HeadphonePreset;
  customHeadphoneParams: {
    bass: number;
    mid: number;
    treble: number;
  };

  fadeInDuration: number;
  fadeOutDuration: number;
  isFadeInEnabled: boolean;
  isFadeOutEnabled: boolean;

  gaplessPlayback: boolean;
  preloadCount: number;

  isEmotionCurveMode: boolean;
  dynamicCrossfadeDuration: number;

  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  setLoopMode: (mode: LoopMode) => void;
  cycleLoopMode: () => void;
  setCurrentSong: (song: Song | null) => void;
  setQueue: (songs: Song[]) => void;
  setCurrentIndex: (index: number) => void;
  nextSong: () => void;
  prevSong: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: AudioError | null) => void;
  clearError: () => void;
  setBufferedRanges: (ranges: { start: number; end: number }[]) => void;
  playSong: (song: Song) => void;
  playQueue: (songs: Song[], startIndex?: number) => void;

  setEQBands: (bands: number[]) => void;
  setCurrentEQPreset: (preset: EQPreset) => void;
  setIsEQEnabled: (enabled: boolean) => void;
  saveCustomEQPreset: (name: string, bands: number[]) => void;
  loadEQPreset: (preset: EQPreset) => void;

  setStereoEnhance: (value: number) => void;
  setSurroundSound: (value: number) => void;
  setBassBoost: (value: number) => void;
  setTrebleBoost: (value: number) => void;
  setVocalEnhance: (value: number) => void;
  setLoudnessNormalization: (enabled: boolean) => void;
  setTargetLoudness: (loudness: number) => void;
  setIsLosslessMode: (enabled: boolean) => void;

  setAudioDevices: (devices: AudioDevice[]) => void;
  setCurrentAudioDevice: (deviceId: string | null) => void;
  setIsDeviceEnumerationSupported: (supported: boolean) => void;

  setHeadphonePreset: (preset: HeadphonePreset) => void;
  setCustomHeadphoneParams: (params: { bass: number; mid: number; treble: number }) => void;

  setFadeInDuration: (duration: number) => void;
  setFadeOutDuration: (duration: number) => void;
  setIsFadeInEnabled: (enabled: boolean) => void;
  setIsFadeOutEnabled: (enabled: boolean) => void;

  setGaplessPlayback: (enabled: boolean) => void;
  setPreloadCount: (count: number) => void;
  setIsEmotionCurveMode: (enabled: boolean) => void;
  setDynamicCrossfadeDuration: (duration: number) => void;
  appendSongsAndPlay: (songs: Song[]) => void;
  seekTo: (time: number) => void;
}

const getDefaultEQPreset = (preset: EQPreset): number[] => {
  const presets: { [key in EQPreset]: number[] } = {
    flat: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    pop: [
      2, 1, 0, -1, -1, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    rock: [
      4, 3, 1, 0, -1, -1, 0, 2, 3, 4, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    classical: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    jazz: [
      1, 1, 1, 0, 0, 0, 0, 1, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    vocal: [
      -2, -1, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    light: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    bass: [
      5, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    treble: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    custom1: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    custom2: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    custom3: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
  };
  return presets[preset] || presets.flat;
};

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      isPlaying: usePlayerStore.getState().isPlaying,
      currentTime: usePlayerStore.getState().currentTime,
      duration: usePlayerStore.getState().duration,
      volume: usePlayerStore.getState().volume,
      isMuted: usePlayerStore.getState().isMuted,
      playbackRate: usePlayerStore.getState().playbackRate,
      loopMode: usePlayerStore.getState().loopMode,
      currentSong: usePlayerStore.getState().currentSong,
      queue: [],
      currentIndex: 0,
      isLoading: usePlayerStore.getState().isLoading,
      error: null,
      bufferedRanges: [],

      eqBands: useEQStore.getState().eqBands,
      currentEQPreset: "flat",
      isEQEnabled: useEQStore.getState().isEQEnabled,
      customEQPresets: {},

      stereoEnhance: 0,
      surroundSound: 0,
      bassBoost: 0,
      trebleBoost: 0,
      vocalEnhance: 0,
      loudnessNormalization: false,
      targetLoudness: -14,
      isLosslessMode: true,

      audioDevices: [],
      currentAudioDevice: null,
      isDeviceEnumerationSupported:
        typeof navigator !== "undefined" &&
        "mediaDevices" in navigator &&
        "enumerateDevices" in navigator.mediaDevices,

      headphonePreset: "default",
      customHeadphoneParams: {
        bass: 0,
        mid: 0,
        treble: 0,
      },

      fadeInDuration: 0.5,
      fadeOutDuration: 0.5,
      isFadeInEnabled: true,
      isFadeOutEnabled: true,

      gaplessPlayback: true,
      preloadCount: 2,

      isEmotionCurveMode: false,
      dynamicCrossfadeDuration: 3,

      setIsPlaying: (playing) => {
        usePlayerStore.getState().setIsPlaying(playing);
        set({ isPlaying: playing });
      },
      setCurrentTime: (time) => {
        usePlayerStore.getState().setCurrentTime(time);
        set({ currentTime: Math.max(0, time) });
      },
      setDuration: (duration) => {
        usePlayerStore.getState().setDuration(duration);
        set({ duration });
      },
      setVolume: (volume) => {
        usePlayerStore.getState().setVolume(volume);
        set({ volume: Math.max(0, Math.min(1, volume)) });
      },
      toggleMute: () => {
        usePlayerStore.getState().toggleMute();
        set((state) => ({ isMuted: !state.isMuted }));
      },
      setPlaybackRate: (rate) => {
        usePlayerStore.getState().setPlaybackRate(rate);
        const clampedRate = Math.max(0.5, Math.min(2.0, rate));
        set({ playbackRate: Math.round(clampedRate * 10) / 10 });
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
      setQueue: (songs) => set({ queue: songs }),
      setCurrentIndex: (index) => set({ currentIndex: index }),

      nextSong: () => {
        const { queue, currentIndex, loopMode } = get();

        if (queue.length === 0) {
          const queueStore = useQueueStore.getState();
          if (queueStore.playThroughMode === "play-through") {
            set({ currentSong: null, isPlaying: false });
            return;
          }
          if (loopMode !== "single" && loopMode !== "all") {
            const recs = useRecommendationStore.getState().getRecommendations();
            if (recs.length > 0) {
              queueStore.setQueue(recs);
              queueStore.setCurrentIndex(0);
              queueStore.addToHistory(recs[0]);
              set({
                queue: recs,
                currentIndex: 0,
                currentSong: recs[0],
                currentTime: 0,
                isPlaying: true,
                isLoading: true,
                error: null,
              });
            } else {
              set({ currentSong: null, isPlaying: false });
            }
          } else {
            set({ currentSong: null, isPlaying: false });
          }
          return;
        }

        let nextIndex: number;

        if (loopMode === "shuffle") {
          nextIndex = Math.floor(Math.random() * queue.length);
        } else {
          nextIndex = (currentIndex + 1) % queue.length;
        }

        const nextSongItem = queue[nextIndex];

        const queueStore = useQueueStore.getState();
        queueStore.setCurrentIndex(nextIndex);
        queueStore.addToHistory(nextSongItem);

        set({
          currentIndex: nextIndex,
          currentSong: nextSongItem,
          currentTime: 0,
          isPlaying: true,
          isLoading: true,
          error: null,
        });
      },

      prevSong: () => {
        const { queue, currentIndex, loopMode } = get();
        if (queue.length === 0) return;

        let prevIndex: number;

        if (loopMode === "shuffle") {
          prevIndex = Math.floor(Math.random() * queue.length);
        } else {
          prevIndex = (currentIndex - 1 + queue.length) % queue.length;
        }

        const prevSongItem = queue[prevIndex];

        const queueStore = useQueueStore.getState();
        queueStore.setCurrentIndex(prevIndex);
        queueStore.addToHistory(prevSongItem);

        set({
          currentIndex: prevIndex,
          currentSong: prevSongItem,
          currentTime: 0,
          isPlaying: true,
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
        const queueStore = useQueueStore.getState();
        queueStore.setQueue([song]);
        queueStore.setCurrentIndex(0);
        queueStore.addToHistory(song);

        set({
          currentSong: song,
          currentTime: 0,
          isPlaying: true,
          isLoading: true,
          error: null,
          queue: [song],
          currentIndex: 0,
          isEmotionCurveMode: false,
        });
      },

      playQueue: (songs, startIndex = 0) => {
        if (songs.length === 0) return;
        const index = Math.max(0, Math.min(startIndex, songs.length - 1));

        const queueStore = useQueueStore.getState();
        queueStore.setQueue(songs);
        queueStore.setCurrentIndex(index);
        queueStore.addToHistory(songs[index]);

        set({
          queue: songs,
          currentIndex: index,
          currentSong: songs[index],
          currentTime: 0,
          isPlaying: true,
          isLoading: true,
          error: null,
          isEmotionCurveMode: false,
        });
      },

      setEQBands: (bands) => {
        useEQStore.getState().setEQBands(bands);
        set({
          eqBands: bands,
          currentEQPreset:
            bands === getDefaultEQPreset(get().currentEQPreset) ? get().currentEQPreset : "custom1",
        });
      },
      setCurrentEQPreset: (preset) => {
        const bands = getDefaultEQPreset(preset);
        useEQStore.getState().setEQBands(bands);
        set({
          currentEQPreset: preset,
          eqBands: bands,
        });
      },
      setIsEQEnabled: (enabled) => {
        useEQStore.getState().setEQEnabled(enabled);
        set({ isEQEnabled: enabled });
      },
      saveCustomEQPreset: (name, bands) =>
        set((state) => ({
          customEQPresets: { ...state.customEQPresets, [name]: bands },
        })),
      loadEQPreset: (preset) => {
        const bands = getDefaultEQPreset(preset);
        useEQStore.getState().setEQBands(bands);
        set({
          eqBands: bands,
          currentEQPreset: preset,
        });
      },

      setStereoEnhance: (value) => set({ stereoEnhance: Math.max(0, Math.min(100, value)) }),
      setSurroundSound: (value) => set({ surroundSound: Math.max(0, Math.min(100, value)) }),
      setBassBoost: (value) => set({ bassBoost: Math.max(0, Math.min(100, value)) }),
      setTrebleBoost: (value) => set({ trebleBoost: Math.max(0, Math.min(100, value)) }),
      setVocalEnhance: (value) => set({ vocalEnhance: Math.max(0, Math.min(100, value)) }),
      setLoudnessNormalization: (enabled) => set({ loudnessNormalization: enabled }),
      setTargetLoudness: (loudness) =>
        set({ targetLoudness: Math.max(-24, Math.min(-8, loudness)) }),
      setIsLosslessMode: (enabled) => set({ isLosslessMode: enabled }),

      setAudioDevices: (devices) => set({ audioDevices: devices }),
      setCurrentAudioDevice: (deviceId) => set({ currentAudioDevice: deviceId }),
      setIsDeviceEnumerationSupported: (supported) =>
        set({ isDeviceEnumerationSupported: supported }),

      setHeadphonePreset: (preset) => set({ headphonePreset: preset }),
      setCustomHeadphoneParams: (params) => set({ customHeadphoneParams: params }),

      setFadeInDuration: (duration) =>
        set({ fadeInDuration: Math.max(0.1, Math.min(3, duration)) }),
      setFadeOutDuration: (duration) =>
        set({ fadeOutDuration: Math.max(0.1, Math.min(3, duration)) }),
      setIsFadeInEnabled: (enabled) => set({ isFadeInEnabled: enabled }),
      setIsFadeOutEnabled: (enabled) => set({ isFadeOutEnabled: enabled }),

      setGaplessPlayback: (enabled) => set({ gaplessPlayback: enabled }),
      setPreloadCount: (count) => set({ preloadCount: Math.max(0, Math.min(5, count)) }),
      setIsEmotionCurveMode: (enabled) => set({ isEmotionCurveMode: enabled }),
      setDynamicCrossfadeDuration: (duration) =>
        set({ dynamicCrossfadeDuration: Math.max(0, Math.min(20, duration)) }),

      appendSongsAndPlay: (songs: Song[]) => {
        if (!songs || songs.length === 0) return;

        const { queue } = get();
        const startIndex = queue.length;
        const newQueue = [...queue, ...songs];

        const queueStore = useQueueStore.getState();
        queueStore.setQueue(newQueue);
        queueStore.setCurrentIndex(startIndex);
        queueStore.addToHistory(songs[0]);

        set({
          queue: newQueue,
          currentIndex: startIndex,
          currentSong: songs[0],
          currentTime: 0,
          isPlaying: true,
          isLoading: true,
          error: null,
        });
      },
      seekTo: (time) => set({ currentTime: Math.max(0, time) }),
    }),
    {
      name: "audio-store-v4",
      partialize: (state) => ({
        volume: state.volume,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        loopMode: state.loopMode,
        eqBands: state.eqBands,
        currentEQPreset: state.currentEQPreset,
        isEQEnabled: state.isEQEnabled,
        customEQPresets: state.customEQPresets,
        stereoEnhance: state.stereoEnhance,
        surroundSound: state.surroundSound,
        bassBoost: state.bassBoost,
        trebleBoost: state.trebleBoost,
        vocalEnhance: state.vocalEnhance,
        loudnessNormalization: state.loudnessNormalization,
        targetLoudness: state.targetLoudness,
        isLosslessMode: state.isLosslessMode,
        headphonePreset: state.headphonePreset,
        customHeadphoneParams: state.customHeadphoneParams,
        fadeInDuration: state.fadeInDuration,
        fadeOutDuration: state.fadeOutDuration,
        isFadeInEnabled: state.isFadeInEnabled,
        isFadeOutEnabled: state.isFadeOutEnabled,
        gaplessPlayback: state.gaplessPlayback,
        preloadCount: state.preloadCount,
      }),
    }
  )
);
