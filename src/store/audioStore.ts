import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSafeStorage, sanitizeSongForStorage } from "@/lib/storage/safeStorage";
import { usePlayerStore, registerAudioStoreSync } from "./playerStore";
import { useQueueStore } from "./queueStore";
import {
  AudioStoreState,
  LoopMode,
  AudioError,
  AudioDevice,
  EQPreset,
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

export type { LoopMode, AudioError, AudioDevice, EQPreset, HeadphonePreset, Song };
export { registerAudioSeekHandler, getAudioSeekHandler };

export const useAudioStore = create<AudioStoreState>()(
  persist(
    (set, get, api) => ({
      ...createPlaybackSlice(set, get, api),
      ...createDeviceSlice(set, get, api),
      ...createSourceSlice(set, get, api),

      // 队列兼容字段（S1-5）：owner=queueStore，这里只是单向只读投影。
      // 写入一律委托 queueStore，由模块底部订阅回填镜像，禁止反写。
      queue: useQueueStore.getState().queue ?? [],
      currentIndex: useQueueStore.getState().currentIndex ?? 0,
      setQueue: (songs: Song[]) => {
        useQueueStore.getState().setQueue(songs);
      },
      setCurrentIndex: (index: number) => {
        useQueueStore.getState().setCurrentIndex(index);
      },
    }),
    {
      name: "audio-store-v4",
      storage: createJSONStorage(() => createSafeStorage("audio-store-v4")),
      partialize: (state) => ({
        currentSong: state.currentSong ? sanitizeSongForStorage(state.currentSong) : null,
        // 使用节流同步的 persistedCurrentTime，阻断每秒多次的磁盘 I/O 序列化
        currentTime:
          typeof state.persistedCurrentTime === "number" ? state.persistedCurrentTime : 0,
        duration: typeof state.duration === "number" ? state.duration : 0,
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

// 注册与 playerStore 之间的实时同步（排除死循环）
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

// 监听 audioStore 状态变化并同步至 playerStore
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

// 单向投影（S1-5）：queueStore 是唯一 owner，audioStore 镜像不参与任何写路径。
// 删除时机：S6-5；在此之前导航只读 queueStore，本投影仅服务遗留读点。
useQueueStore.subscribe((state) => {
  const currentAudio = useAudioStore.getState();
  if (state.queue === currentAudio.queue && state.currentIndex === currentAudio.currentIndex) {
    return;
  }
  useAudioStore.setState({ queue: state.queue, currentIndex: state.currentIndex });
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
