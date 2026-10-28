/**
 * S6-10b：组件层非 hook 场景（模块级工具、键盘监听、原生事件）的播放命令。
 *
 * 这些调用点无法安全地改用 selector：改为渲染期订阅会把「点击瞬间的最新值」
 * 换成上一次渲染的快照（连续点击/异步循环会读到旧队列）。这里每次现取，
 * 与原先组件内 getState 的时序完全一致。
 */
import type { Song } from "@/types/song";
import { useAudioStore } from "@/store/audioStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQueueStore } from "@/store/queueStore";

export const playQueue = (songs: Song[], startIndex = 0): void =>
  useAudioStore.getState().playQueue(songs, startIndex);

export const playSong = (song: Song): void => useAudioStore.getState().playSong(song);

export const seekTo = (time: number): void => useAudioStore.getState().seekTo(time);

export const setPlaybackQueue = (songs: Song[]): void => useQueueStore.getState().setQueue(songs);

export const setQueueIndex = (index: number): void =>
  useQueueStore.getState().setCurrentIndex(index);

/** 批量追加到队列并返回新队列，供调用方同步音频投影。 */
export function appendSongsToQueue(songs: Song[]): Song[] {
  const queue = [...useQueueStore.getState().queue, ...songs];
  useQueueStore.getState().setQueue(queue);
  return queue;
}

/** 连续步进时要读「此刻」倍速，不能用上一次渲染的快照。 */
export const getPlayerPlaybackRate = (): number => usePlayerStore.getState().playbackRate || 1;

/** 画布/歌词渲染循环需要的播放快照（非 React 上下文）。 */
export const getPlayerSnapshot = () => usePlayerStore.getState();
