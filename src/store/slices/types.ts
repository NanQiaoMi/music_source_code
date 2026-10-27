import { StateCreator } from "zustand";
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

export interface PlaybackSliceState {
  isPlaying: boolean;
  currentTime: number;
  persistedCurrentTime: number; // 磁盘持久化快照（写盘节流由 storage 层统一处理）
  duration: number;
  loopMode: LoopMode;
  currentSong: Song | null;
  isLoading: boolean;
  error: AudioError | null;
  bufferedRanges: { start: number; end: number }[];
  isEmotionCurveMode: boolean;
  dynamicCrossfadeDuration: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  isFadeInEnabled: boolean;
  isFadeOutEnabled: boolean;
  gaplessPlayback: boolean;
  preloadCount: number;

  setIsPlaying: (playing: boolean) => void;
  togglePlaybackIntent: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setLoopMode: (mode: LoopMode) => void;
  cycleLoopMode: () => void;
  setCurrentSong: (song: Song | null) => void;
  nextSong: () => void;
  prevSong: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: AudioError | null) => void;
  clearError: () => void;
  setBufferedRanges: (ranges: { start: number; end: number }[]) => void;
  updateCurrentSongLyrics: (lyrics: string, translationLyrics?: string) => void;
  updateCurrentSongCover: (cover: string) => void;
  playSong: (song: Song) => void;
  playQueue: (songs: Song[], startIndex?: number) => void;
  appendSongsAndPlay: (songs: Song[]) => void;
  seekTo: (time: number) => void;
  flushProgressToStorage: () => void;

  setFadeInDuration: (duration: number) => void;
  setFadeOutDuration: (duration: number) => void;
  setIsFadeInEnabled: (enabled: boolean) => void;
  setIsFadeOutEnabled: (enabled: boolean) => void;
  setGaplessPlayback: (enabled: boolean) => void;
  setPreloadCount: (count: number) => void;
  setIsEmotionCurveMode: (enabled: boolean) => void;
  setDynamicCrossfadeDuration: (duration: number) => void;
}

export interface DeviceSliceState {
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  audioDevices: AudioDevice[];
  currentAudioDevice: string | null;
  isDeviceEnumerationSupported: boolean;

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

  headphonePreset: HeadphonePreset;
  customHeadphoneParams: {
    bass: number;
    mid: number;
    treble: number;
  };

  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  resetPlaybackRate: () => void;
  setAudioDevices: (devices: AudioDevice[]) => void;
  setCurrentAudioDevice: (deviceId: string | null) => void;
  setIsDeviceEnumerationSupported: (supported: boolean) => void;

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

  setHeadphonePreset: (preset: HeadphonePreset) => void;
  setCustomHeadphoneParams: (params: { bass: number; mid: number; treble: number }) => void;
}

export interface SourceSliceState {
  verifyAndResolveSource: (song: Song, timeoutMs?: number) => Promise<boolean>;
  handleSourceError: (song: Song, error: unknown) => void;
}

export interface LegacyQueueCompatibilityState {
  queue: Song[];
  currentIndex: number;
  setQueue: (songs: Song[]) => void;
  setCurrentIndex: (index: number) => void;
}

export type AudioStoreState = PlaybackSliceState &
  DeviceSliceState &
  SourceSliceState &
  LegacyQueueCompatibilityState;

export type AudioSliceCreator<T> = StateCreator<
  AudioStoreState,
  [["zustand/persist", unknown]],
  [],
  T
>;
