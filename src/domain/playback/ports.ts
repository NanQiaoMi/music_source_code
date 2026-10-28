/**
 * S6-9b：播放传输端口（PlaybackPorts）。
 *
 * 约定：
 * - 接口只描述"播放器能做什么"，用例层（playbackCommands）与 service 只依赖它，
 *   测试可注入 fake ports，不再 mock 整棵 zustand store。
 * - 默认适配器只做 store 映射：每次调用现取 getState，不缓存快照（水合/持久化后
 *   不会读到过期状态）。
 * - 适配器是当前唯一允许把播放命令落到 audioStore/playerStore 的模块；组件/服务
 *   请走 playbackCommands 或注入自己的 ports。
 */
import type { Song } from "@/types/song";
import { getPlaybackClockSnapshot } from "@/lib/playback/playbackClock";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";

export interface PlaySongOptions {
  /** 整队替换后再播放（等价 audioStore.playQueue），用于「播放列表」场景。 */
  queue?: Song[];
  /** queue 模式的起点，默认 0。 */
  startIndex?: number;
}

export interface PlaybackSnapshot {
  currentSong: Song | null;
  /** 播放意图（playbackRuntimeStore.shouldPlay）；命令层用它做幂等判断。 */
  shouldPlay: boolean;
  /** 实际播放态镜像（mediaBridge/audioStore），service 查询状态用。 */
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  duration: number;
}

export interface PlaybackPorts {
  playSong(song: Song, opts?: PlaySongOptions): void;
  /**
   * 按当前意图取反。无当前曲目且队列非空时先选中队列首曲——沿用旧
   * useKeyboardShortcuts 的兜底，保证"恢复播放"不落空。
   */
  toggleIntent(): void;
  seek(seconds: number): void;
  next(): void;
  prev(): void;
  setVolume(volume: number): void;
  toggleMute(): void;
  /** 停止播放并清空当前曲目（曲目被删除/清理时），等价旧 setIsPlaying(false)+setCurrentSong(null)。 */
  clearCurrentSong(): void;
  getSnapshot(): PlaybackSnapshot;
}

/** 默认适配器：仅映射既有 store API，不新增播放编排。 */
export const defaultPlaybackPorts: PlaybackPorts = {
  playSong(song, opts) {
    const audio = useAudioStore.getState();
    if (opts?.queue && opts.queue.length > 0) {
      audio.playQueue(opts.queue, opts.startIndex ?? 0);
    } else {
      audio.playSong(song);
    }
  },

  toggleIntent() {
    const willPlay = !usePlaybackRuntimeStore.getState().shouldPlay;
    if (willPlay && !usePlayerStore.getState().currentSong) {
      const queue = useQueueStore.getState().queue;
      if (queue.length > 0) {
        usePlayerStore.getState().setCurrentSong(queue[0]);
        useAudioStore.getState().setCurrentIndex(0);
      }
    }
    useAudioStore.getState().togglePlaybackIntent();
  },

  seek(seconds) {
    useAudioStore.getState().seekTo(seconds);
  },

  next() {
    useAudioStore.getState().nextSong();
  },

  prev() {
    useAudioStore.getState().prevSong();
  },

  setVolume(volume) {
    usePlayerStore.getState().setVolume(volume);
  },

  toggleMute() {
    usePlayerStore.getState().toggleMute();
  },

  clearCurrentSong() {
    const audio = useAudioStore.getState();
    audio.setIsPlaying(false);
    audio.setCurrentSong(null);
  },

  getSnapshot() {
    const player = usePlayerStore.getState();
    const clock = getPlaybackClockSnapshot();
    return {
      currentSong: player.currentSong,
      shouldPlay: usePlaybackRuntimeStore.getState().shouldPlay,
      isPlaying: player.isPlaying,
      volume: player.volume,
      isMuted: player.isMuted,
      currentTime: clock.currentTime,
      duration: clock.duration,
    };
  },
};
