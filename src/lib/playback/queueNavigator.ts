import type { Song } from "@/types/song";
import type { LoopMode } from "@/store/slices/types";
import { usePlayerStore } from "@/store/playerStore";
import { useQueueStore } from "@/store/queueStore";

export type PlayThroughMode = "normal" | "play-through";

export type QueueNavReason = "advanced" | "wrapped" | "stopped-at-end" | "empty" | "single-loop";

export interface QueueNavResult {
  index: number;
  song: Song | null;
  reason: QueueNavReason;
}

export interface AdvanceQueueOptions {
  /** The song the media element is actually playing. Used to re-anchor navigation
   * after the current item was removed from the queue (position is authoritative). */
  currentSong?: Song | null;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  const safe = Number.isFinite(index) ? Math.trunc(index) : 0;
  return Math.max(0, Math.min(safe, length - 1));
}

function emptyResult(): QueueNavResult {
  return { index: 0, song: null, reason: "empty" };
}

function stopAtBoundary(loopMode: LoopMode, playThroughMode: PlayThroughMode): boolean {
  return loopMode === "none" || playThroughMode === "play-through";
}

/**
 * Pure next-song derivation for the owning queue snapshot.
 * Position (currentIndex) is authoritative: duplicate Song.id entries are distinct.
 */
export function computeNext(
  queue: Song[],
  currentIndex: number,
  loopMode: LoopMode,
  playThroughMode: PlayThroughMode
): QueueNavResult {
  if (queue.length === 0) return emptyResult();

  const index = clampIndex(currentIndex, queue.length);

  if (loopMode === "single") {
    return { index, song: queue[index], reason: "single-loop" };
  }

  if (loopMode === "shuffle") {
    const randomIndex = Math.floor(Math.random() * queue.length);
    return { index: randomIndex, song: queue[randomIndex], reason: "advanced" };
  }

  if (index >= queue.length - 1) {
    if (stopAtBoundary(loopMode, playThroughMode)) {
      return { index, song: null, reason: "stopped-at-end" };
    }
    return { index: 0, song: queue[0], reason: "wrapped" };
  }

  return { index: index + 1, song: queue[index + 1], reason: "advanced" };
}

/** Pure previous-song derivation, mirroring {@link computeNext}. */
export function computePrev(
  queue: Song[],
  currentIndex: number,
  loopMode: LoopMode,
  playThroughMode: PlayThroughMode
): QueueNavResult {
  if (queue.length === 0) return emptyResult();

  const index = clampIndex(currentIndex, queue.length);

  if (loopMode === "single") {
    return { index, song: queue[index], reason: "single-loop" };
  }

  if (loopMode === "shuffle") {
    const randomIndex = Math.floor(Math.random() * queue.length);
    return { index: randomIndex, song: queue[randomIndex], reason: "advanced" };
  }

  if (index <= 0) {
    if (stopAtBoundary(loopMode, playThroughMode)) {
      return { index, song: null, reason: "stopped-at-end" };
    }
    const lastIndex = queue.length - 1;
    return { index: lastIndex, song: queue[lastIndex], reason: "wrapped" };
  }

  return { index: index - 1, song: queue[index - 1], reason: "advanced" };
}

/**
 * QueueNavigator entry point: the only writer of queueStore.currentIndex during playback.
 * Manual skip keeps its historical semantics (single-loop mode still skips), while
 * ended-at-boundary is handled by the caller (computeNext "single-loop").
 */
export function advanceQueue(
  direction: "next" | "prev",
  options: AdvanceQueueOptions = {}
): QueueNavResult {
  const state = useQueueStore.getState();
  const queue = state.queue;
  if (queue.length === 0) return emptyResult();

  let anchor = clampIndex(state.currentIndex, queue.length);
  const currentSong = options.currentSong ?? null;
  const anchoredSong = queue[anchor];

  if (currentSong && anchoredSong && anchoredSong.id !== currentSong.id) {
    const foundIndex = queue.findIndex((song) => song.id === currentSong.id);

    if (foundIndex >= 0) {
      // The playing song still exists elsewhere in the queue: navigate from its real position.
      anchor = foundIndex;
    } else if (direction === "next") {
      // The playing song was removed: currentIndex already points at its successor.
      // Select that successor instead of skipping over it.
      return { index: anchor, song: anchoredSong, reason: "advanced" };
    }
  }

  const playerLoopMode = usePlayerStore.getState().loopMode;
  // Single-loop is an "ended" policy; manual skip must still move through the queue.
  const loopMode: LoopMode = playerLoopMode === "single" ? "all" : playerLoopMode;
  const result =
    direction === "next"
      ? computeNext(queue, anchor, loopMode, state.playThroughMode)
      : computePrev(queue, anchor, loopMode, state.playThroughMode);

  if (result.song) {
    useQueueStore.getState().setCurrentIndex(result.index);
  }

  return result;
}
