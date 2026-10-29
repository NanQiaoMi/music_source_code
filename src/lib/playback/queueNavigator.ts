import type { Song } from "@/types/song";
import type { LoopMode } from "@/store/slices/types";

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

// S6-10：有状态的 advanceQueue 已下沉到 src/store/queueNavigation.ts（lib 层不得新增
// getState）；本文件只保留纯计算，供 store 层与测试复用。
