// S6-12f: store-free playback model types and pure helpers live here so
// playbackSlice.ts stays inside the 400-line store budget (scripts/check-store-budgets.mjs).
// The slice re-exports the seek-handler API, so its public surface is unchanged.

import { createMissingAudioSourceError } from "@/lib/audio/playableAudioSource";
import type { LoopMode, PlaybackSliceState, Song } from "../types";

export const getPlaybackSongId = (song: Song | null): string | null =>
  song ? String(song.id || song.title || "") || null : null;

export type AudioSeekHandler = (time: number) => void;

let globalSeekHandler: AudioSeekHandler | null = null;

export const registerAudioSeekHandler = (handler: AudioSeekHandler | null): void => {
  globalSeekHandler = handler;
};

export const getAudioSeekHandler = (): AudioSeekHandler | null => globalSeekHandler;

export const emitAudioSeek = (time: number): void => {
  if (globalSeekHandler) globalSeekHandler(time);
};

// 优先对齐当前队列与当前索引，防止跨组件直接调用 setState 时索引脱节
export const alignQueueIndex = (
  queue: Song[],
  queueIndex: number,
  stateIndex: number,
  currentSong: Song | null
): number => {
  let index = queueIndex;
  if (stateIndex >= 0 && stateIndex < queue.length) {
    index = stateIndex;
  } else if (currentSong) {
    const foundIndex = queue.findIndex((s) => s.id === currentSong.id);
    if (foundIndex >= 0) {
      index = foundIndex;
    }
  }
  return index;
};

const LOOP_MODE_ORDER: LoopMode[] = ["none", "all", "single", "shuffle"];

export const getNextLoopMode = (loopMode: LoopMode): LoopMode => {
  const currentIndex = LOOP_MODE_ORDER.indexOf(loopMode);
  return LOOP_MODE_ORDER[(currentIndex + 1) % LOOP_MODE_ORDER.length];
};

// 切歌统一状态：进度归零、进入加载态；仅队列整体切换才重置情感曲线模式
export const createTrackStartState = (
  song: Song,
  options: { resetEmotionCurve?: boolean } = {}
): Partial<PlaybackSliceState> => ({
  currentSong: song,
  currentTime: 0,
  persistedCurrentTime: 0,
  isPlaying: false,
  isLoading: true,
  error: null,
  ...(options.resetEmotionCurve ? { isEmotionCurveMode: false } : {}),
});

export const createMissingSourceState = (): Partial<PlaybackSliceState> => ({
  isPlaying: false,
  isLoading: false,
  error: createMissingAudioSourceError(),
});

export const withCurrentSongLyrics = (
  currentSong: Song | null,
  lyrics: string,
  translationLyrics?: string
): Song | null =>
  currentSong
    ? {
        ...currentSong,
        lyrics,
        translationLyrics: translationLyrics || currentSong.translationLyrics,
      }
    : null;

export const withCurrentSongCover = (currentSong: Song | null, cover: string): Song | null =>
  currentSong ? { ...currentSong, cover } : null;
