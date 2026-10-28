/**
 * S6-9a/S6-9b：播放域用例层（commands）。
 *
 * 约定：
 * - 纯函数、无 React / hooks；组件、hook、service 只调这里，不再各自拼 store 编排。
 * - 播放传输统一走 PlaybackPorts；默认使用 defaultPlaybackPorts（store 适配器），
 *   测试/上层可注入 fake ports。命令本身不 import 任何 store。
 * - 每次调用现取 ports 快照，不做模块级缓存（水合/持久化后不会读到过期状态）。
 * - 先改状态、后发 `playback:*` 事件，订阅方读到的是更新后的快照。
 * - 显式目标（暂停时再暂停、同音量再设置）是幂等的：不写 store、不发事件。
 */
import type { Song } from "@/types/song";
import { hasPlayableAudioSource } from "@/lib/audio/playableAudioSource";
import { emit } from "@/domain/events";
import {
  defaultPlaybackPorts,
  type PlaybackPorts,
  type PlaySongOptions,
} from "@/domain/playback/ports";

export type { PlaySongOptions } from "@/domain/playback/ports";

const toSongId = (song: Song | null | undefined): string | null =>
  song ? String(song.id || song.title || "") || null : null;

const clampVolume = (volume: number): number => Math.max(0, Math.min(1, volume));

export type PlaySongResult =
  | { ok: true; songId: string }
  | { ok: false; songId: string; reason: "missing-audio-source" };

export function playSong(
  song: Song,
  opts: PlaySongOptions = {},
  ports: PlaybackPorts = defaultPlaybackPorts
): PlaySongResult {
  const previousSongId = toSongId(ports.getSnapshot().currentSong);

  if (!hasPlayableAudioSource(song)) {
    // 仍调用播放动作：缺音源错误投影（error/isPlaying/isLoading）与 UI 提示保持不变。
    ports.playSong(song);
    emit("playback:rejected", { songId: song.id, reason: "missing-audio-source" });
    return { ok: false, songId: song.id, reason: "missing-audio-source" };
  }

  ports.playSong(song, opts);

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

export function togglePlayback(
  opts: TogglePlaybackOptions = {},
  ports: PlaybackPorts = defaultPlaybackPorts
): TogglePlaybackResult {
  const snapshot = ports.getSnapshot();
  const next = opts.target ?? !snapshot.shouldPlay;
  // 幂等：已经处于目标态时不写 store、不发事件（暂停时再次暂停 / 播放时再次播放）。
  if (next === snapshot.shouldPlay) return { changed: false, isPlaying: next };

  ports.toggleIntent();

  const songId = toSongId(ports.getSnapshot().currentSong ?? snapshot.currentSong);
  if (next) emit("playback:resumed", { songId });
  else emit("playback:paused", { songId });

  return { changed: true, isPlaying: next };
}

export interface SeekResult {
  seconds: number;
}

export function seekTo(seconds: number, ports: PlaybackPorts = defaultPlaybackPorts): SeekResult {
  const { duration } = ports.getSnapshot();
  const requested = Number.isFinite(seconds) ? seconds : 0;
  // 时长未知（0，元数据未到）时按 0 钳制，与旧快捷键 Math.min(duration, ...) 的行为一致。
  const clamped = Math.max(0, Math.min(duration, requested));
  ports.seek(clamped);
  emit("playback:seeked", { seconds: clamped, duration });
  return { seconds: clamped };
}

export interface TrackChangeResult {
  from: string | null;
  to: string | null;
  direction: "next" | "prev";
}

function changeTrack(
  direction: TrackChangeResult["direction"],
  ports: PlaybackPorts
): TrackChangeResult {
  const from = toSongId(ports.getSnapshot().currentSong);
  if (direction === "next") ports.next();
  else ports.prev();
  const to = toSongId(ports.getSnapshot().currentSong);
  emit("playback:track-changed", { from, to, direction });
  return { from, to, direction };
}

export const nextTrack = (ports: PlaybackPorts = defaultPlaybackPorts): TrackChangeResult =>
  changeTrack("next", ports);
export const prevTrack = (ports: PlaybackPorts = defaultPlaybackPorts): TrackChangeResult =>
  changeTrack("prev", ports);

export interface VolumeResult {
  volume: number;
  changed: boolean;
}

export function setVolume(
  volume: number,
  ports: PlaybackPorts = defaultPlaybackPorts
): VolumeResult {
  const previous = ports.getSnapshot().volume;
  const next = clampVolume(Number.isFinite(volume) ? volume : previous);
  if (next === previous) return { volume: previous, changed: false };
  ports.setVolume(next);
  emit("playback:volume-changed", { volume: next, previous });
  return { volume: next, changed: true };
}

export function toggleMute(ports: PlaybackPorts = defaultPlaybackPorts): { isMuted: boolean } {
  ports.toggleMute();
  const { isMuted } = ports.getSnapshot();
  emit("playback:mute-changed", { isMuted });
  return { isMuted };
}

/** 命令签名（不含 ports 注入参数），供 UI/service 以统一类型持有。 */
export interface PlaybackCommands {
  playSong(song: Song, opts?: PlaySongOptions): PlaySongResult;
  togglePlayback(opts?: TogglePlaybackOptions): TogglePlaybackResult;
  seekTo(seconds: number): SeekResult;
  nextTrack(): TrackChangeResult;
  prevTrack(): TrackChangeResult;
  setVolume(volume: number): VolumeResult;
  toggleMute(): { isMuted: boolean };
}

/** 把命令绑定到一组 ports；service 测试用 fake ports 注入。 */
export function createPlaybackCommands(
  ports: PlaybackPorts = defaultPlaybackPorts
): PlaybackCommands {
  return {
    playSong: (song, opts) => playSong(song, opts, ports),
    togglePlayback: (opts) => togglePlayback(opts, ports),
    seekTo: (seconds) => seekTo(seconds, ports),
    nextTrack: () => nextTrack(ports),
    prevTrack: () => prevTrack(ports),
    setVolume: (volume) => setVolume(volume, ports),
    toggleMute: () => toggleMute(ports),
  };
}

/** 唯一命令入口：调用方依赖这个对象，不依赖具体 store。 */
export const playbackCommands: PlaybackCommands = createPlaybackCommands();
