import type { Song } from "@/types/song";
import type { LoopMode } from "@/store/slices/types";
import type { HistorySong } from "@/store/queueStore";
import { computeNext, type PlayThroughMode } from "@/lib/playback/queueNavigator";

/**
 * S1-5: queueStore is the single owner of queue/currentIndex/history.
 * These selectors are read-only derivations; they never write state.
 */
export interface QueueSelectorState {
  queue: Song[];
  currentIndex: number;
  history: HistorySong[];
}

export const selectQueue = (state: QueueSelectorState): Song[] => state.queue;

export const selectCurrentIndex = (state: QueueSelectorState): number => state.currentIndex;

export const selectCurrentSong = (state: QueueSelectorState): Song | null =>
  state.queue[state.currentIndex] ?? null;

export const selectHistory = (state: QueueSelectorState): HistorySong[] => state.history;

/** Derive the next song without writing state (loop mode supplied by the caller). */
export const createSelectNextSong =
  (loopMode: LoopMode, playThroughMode: PlayThroughMode = "normal") =>
  (state: QueueSelectorState): Song | null =>
    computeNext(state.queue, state.currentIndex, loopMode, playThroughMode).song;

export const selectNextSong = (
  state: QueueSelectorState,
  loopMode: LoopMode = "none",
  playThroughMode: PlayThroughMode = "normal"
): Song | null => computeNext(state.queue, state.currentIndex, loopMode, playThroughMode).song;
