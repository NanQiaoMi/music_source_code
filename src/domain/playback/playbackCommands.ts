/**
 * S6-9a：播放域用例层（commands）起步。
 *
 * 约定：
 * - 纯函数、无 React / hooks；组件、hook、service 只调这里，不再各自拼 store 编排。
 * - 每次调用现取 store 快照，不做模块级缓存（水合/持久化后不会读到过期状态）。
 * - 先改状态、后发 `playback:*` 事件，订阅方读到的是更新后的快照。
 * - 显式目标（暂停时再暂停、同音量再设置）是幂等的：不写 store、不发事件。
 *
 * 后续 S6-9b 用 PlaybackPorts 注入替换下面的 store 调用，本文件签名保持不变。
 */
import type { Song } from "@/types/song";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQueueStore } from "@/store/queueStore";
import { usePlaybackRuntimeStore } from "@/store/playbackRuntimeStore";
import { getPlaybackClockSnapshot } from "@/lib/playback/playbackClock";
import { hasPlayableAudioSource } from "@/lib/audio/playableAudioSource";
import { emit } from "@/domain/events";

const toSongId = (song: Song | null | undefined): string | null =>
  song ? String(song.id || song.title || "") || null : null;

const clampVolume = (volume: number): number => Math.max(0, Math.min(1, volume));

export interface PlaySongOptions {
  /** 整队替换后再播放（等价 audioStore.playQueue），用于「播放列表」场景。 */
  queue?: Song[];
  /** queue 模式的起点，默认 0。 */
  startIndex?: number;
}

export type PlaySongResult =
  | { ok: true; songId: string }
  | { ok: false; songId: string; reason: "missing-audio-source" };

export function playSong(song: Song, opts: PlaySongOptions = {}): PlaySongResult {
  const previousSongId = toSongId(useAudioStore.getState().currentSong);

  if (!hasPlayableAudioSource(song)) {
    // 仍调用 store 播放动作：缺音源错误投影（error/isPlaying/isLoading）与 UI 提示保持不变。
    useAudioStore.getState().playSong(song);
    emit("playback:rejected", { songId: song.id, reason: "missing-audio-source" });
    return { ok: false, songId: song.id, reason: "missing-audio-source" };
  }

  if (opts.queue && opts.queue.length > 0) {
    useAudioStore.getState().playQueue(opts.queue, opts.startIndex ?? 0);
  } else {
    useAudioStore.getState().playSong(song);
  }

  const queued = Boolean(opts.queue && opts.queue.length > 0);
  emit("playback:started", { songId: song.id, previousSongId, queued });
  return { ok: true, songId: song.id };
}

export interface TogglePlaybackOptions {
  /** 显式目标：true=播放，false=暂停；省略则按 playbackRuntime 的意图取反。 */
  target?: boolean;
}

export interface TogglePlaybackResult {
  changed: boolean;
  isPlaying: boolean;
}

export function togglePlayback(opts: TogglePlaybackOptions = {}): TogglePlaybackResult {
  const shouldPlay = usePlaybackRuntimeStore.getState().shouldPlay;
  const next = opts.target ?? !shouldPlay;
  // 幂等：已经处于目标态时不写 store、不发事件（暂停时再次暂停 / 播放时再次播放）。
  if (next === shouldPlay) return { changed: false, isPlaying: next };

  if (next && !usePlayerStore.getState().currentSong) {
    const queue = useQueueStore.getState().queue;
    if (queue.length > 0) {
      // 原 useKeyboardShortcuts 的兜底：没有当前曲目时先播队列第一首。
      usePlayerStore.getState().setCurrentSong(queue[0]);
      useAudioStore.getState().setCurrentIndex(0);
    }
  }

  useAudioStore.getState().togglePlaybackIntent();

  const songId = toSongId(
    usePlayerStore.getState().currentSong ?? useAudioStore.getState().currentSong
  );
  if (next) emit("playback:resumed", { songId });
  else emit("playback:paused", { songId });

  return { changed: true, isPlaying: next };
}

export interface SeekResult {
  seconds: number;
}

export function seekTo(seconds: number): SeekResult {
  const { duration } = getPlaybackClockSnapshot();
  const requested = Number.isFinite(seconds) ? seconds : 0;
  // 时长未知（0，元数据未到）时按 0 钳制，与旧快捷键 Math.min(duration, ...) 的行为一致。
  const clamped = Math.max(0, Math.min(duration, requested));
  useAudioStore.getState().seekTo(clamped);
  emit("playback:seeked", { seconds: clamped, duration });
  return { seconds: clamped };
}

export interface TrackChangeResult {
  from: string | null;
  to: string | null;
  direction: "next" | "prev";
}

function changeTrack(direction: TrackChangeResult["direction"]): TrackChangeResult {
  const from = toSongId(useAudioStore.getState().currentSong);
  if (direction === "next") useAudioStore.getState().nextSong();
  else useAudioStore.getState().prevSong();
  const to = toSongId(useAudioStore.getState().currentSong);
  emit("playback:track-changed", { from, to, direction });
  return { from, to, direction };
}

export const nextTrack = (): TrackChangeResult => changeTrack("next");
export const prevTrack = (): TrackChangeResult => changeTrack("prev");

export interface VolumeResult {
  volume: number;
  changed: boolean;
}

export function setVolume(volume: number): VolumeResult {
  const previous = usePlayerStore.getState().volume;
  const next = clampVolume(Number.isFinite(volume) ? volume : previous);
  if (next === previous) return { volume: previous, changed: false };
  usePlayerStore.getState().setVolume(next);
  emit("playback:volume-changed", { volume: next, previous });
  return { volume: next, changed: true };
}

export function toggleMute(): { isMuted: boolean } {
  usePlayerStore.getState().toggleMute();
  const isMuted = usePlayerStore.getState().isMuted;
  emit("playback:mute-changed", { isMuted });
  return { isMuted };
}

/** 唯一命令入口：调用方依赖这个对象，不依赖具体 store。 */
export const playbackCommands = {
  playSong,
  togglePlayback,
  seekTo,
  nextTrack,
  prevTrack,
  setVolume,
  toggleMute,
} as const;

export type PlaybackCommands = typeof playbackCommands;
