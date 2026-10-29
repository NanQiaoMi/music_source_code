import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSafeStorage, sanitizeSongForStorage } from "@/lib/storage/safeStorage";
import { usePlayerStore, registerAudioStoreSync } from "./playerStore";
import {
  AudioStoreState,
  LoopMode,
  AudioError,
  AudioDevice,
  HeadphonePreset,
  Song,
} from "./slices/types";
import {
  createPlaybackSlice,
  registerAudioSeekHandler,
  getAudioSeekHandler,
} from "./slices/playbackSlice";
import { createDeviceSlice } from "./slices/deviceSlice";
import { createSourceSlice } from "./slices/sourceSlice";

export type { LoopMode, AudioError, AudioDevice, HeadphonePreset, Song };
export { registerAudioSeekHandler, getAudioSeekHandler };

let audioPersistenceSuspended = false;

// 有序水合期间禁止写入：player/queue 的投影会触发本 store 的 persist，
// 若此时序列化默认进度，会覆盖尚未读取的 audio-store-v4 持久化快照。
export const setAudioPersistenceSuspended = (suspended: boolean) => {
  audioPersistenceSuspended = suspended;
};

const createGuardedAudioStorage = () => {
  const storage = createSafeStorage("audio-store-v4");
  return {
    ...storage,
    setItem: (name: string, value: string) => {
      if (!audioPersistenceSuspended) storage.setItem(name, value);
    },
  };
};

export const useAudioStore = create<AudioStoreState>()(
  persist(
    (set, get, api) => ({
      ...createPlaybackSlice(set, get, api),
      ...createDeviceSlice(set, get, api),
      ...createSourceSlice(set, get, api),
    }),
    {
      skipHydration: true,
      name: "audio-store-v4",
      storage: createJSONStorage(createGuardedAudioStorage),
      partialize: (state) => ({
        currentSong: state.currentSong ? sanitizeSongForStorage(state.currentSong) : null,
        // 播放进度的唯一持久化权威：使用 5s 节流快照，避免每次 setState 都推进持久化进度
        currentTime:
          typeof state.persistedCurrentTime === "number" ? state.persistedCurrentTime : 0,
        duration: typeof state.duration === "number" ? state.duration : 0,
        volume: state.volume,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        loopMode: state.loopMode,
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

// 接收 playerStore 的写入委托（进度以 audioStore 为准）并同步非进度字段，排除死循环
registerAudioStoreSync((playerState) => {
  const currentAudio = useAudioStore.getState();
  const updates: Partial<AudioStoreState> = {};
  if (playerState.isPlaying !== undefined && playerState.isPlaying !== currentAudio.isPlaying) {
    updates.isPlaying = playerState.isPlaying;
  }
  if (
    playerState.currentSong !== undefined &&
    playerState.currentSong !== currentAudio.currentSong
  ) {
    updates.currentSong = playerState.currentSong;
  }
  if (
    playerState.currentTime !== undefined &&
    playerState.currentTime !== currentAudio.currentTime
  ) {
    updates.currentTime = playerState.currentTime;
  }
  if (playerState.duration !== undefined && playerState.duration !== currentAudio.duration) {
    updates.duration = playerState.duration;
  }
  if (playerState.isLoading !== undefined && playerState.isLoading !== currentAudio.isLoading) {
    updates.isLoading = playerState.isLoading;
  }
  if (playerState.volume !== undefined && playerState.volume !== currentAudio.volume) {
    updates.volume = playerState.volume;
  }
  if (playerState.isMuted !== undefined && playerState.isMuted !== currentAudio.isMuted) {
    updates.isMuted = playerState.isMuted;
  }
  if (
    playerState.playbackRate !== undefined &&
    playerState.playbackRate !== currentAudio.playbackRate
  ) {
    updates.playbackRate = playerState.playbackRate;
  }
  if (playerState.loopMode !== undefined && playerState.loopMode !== currentAudio.loopMode) {
    updates.loopMode = playerState.loopMode;
  }
  if (Object.keys(updates).length > 0) {
    useAudioStore.setState(updates);
  }
});

// 单向投影：audioStore 的进度权威值同步至 playerStore 运行时镜像
useAudioStore.subscribe((state, prev) => {
  const playerState = usePlayerStore.getState();
  const updates: Partial<typeof playerState> = {};
  if (state.isPlaying !== prev.isPlaying && state.isPlaying !== playerState.isPlaying) {
    updates.isPlaying = state.isPlaying;
  }
  if (state.currentSong !== prev.currentSong && state.currentSong !== playerState.currentSong) {
    updates.currentSong = state.currentSong;
  }
  if (state.currentTime !== prev.currentTime && state.currentTime !== playerState.currentTime) {
    updates.currentTime = state.currentTime;
  }
  if (state.duration !== prev.duration && state.duration !== playerState.duration) {
    updates.duration = state.duration;
  }
  if (state.isLoading !== prev.isLoading && state.isLoading !== playerState.isLoading) {
    updates.isLoading = state.isLoading;
  }
  if (state.volume !== prev.volume && state.volume !== playerState.volume) {
    updates.volume = state.volume;
  }
  if (state.isMuted !== prev.isMuted && state.isMuted !== playerState.isMuted) {
    updates.isMuted = state.isMuted;
  }
  if (state.playbackRate !== prev.playbackRate && state.playbackRate !== playerState.playbackRate) {
    updates.playbackRate = state.playbackRate;
  }
  if (state.loopMode !== prev.loopMode && state.loopMode !== playerState.loopMode) {
    updates.loopMode = state.loopMode;
  }
  if (Object.keys(updates).length > 0) {
    usePlayerStore.setState(updates);
  }
});

// ============================================================================
// 细粒度原子 Hook 导出：阻断跳秒导致的全页面外壳无谓重绘
// ============================================================================
export const useAudioCurrentTime = () => useAudioStore((s) => s.currentTime);
export const useAudioDuration = () => useAudioStore((s) => s.duration);
export const useAudioIsPlaying = () => useAudioStore((s) => s.isPlaying);
export const useAudioVolume = () => useAudioStore((s) => s.volume);
export const useAudioIsMuted = () => useAudioStore((s) => s.isMuted);
export const useAudioCurrentSong = () => useAudioStore((s) => s.currentSong);
export const useAudioLoopMode = () => useAudioStore((s) => s.loopMode);
export const useAudioError = () => useAudioStore((s) => s.error);
export const useAudioLoading = () => useAudioStore((s) => s.isLoading);
