/**
 * S1-5：QueueNavigator 的状态入口（queueStore 是队列/顺序/currentIndex 的唯一权威）。
 *
 * 纯计算留在 src/lib/playback/queueNavigator.ts（无 store 依赖，可独立单测）；
 * 这里按「此刻」的 queueStore / playerStore 快照推进索引，因此归 store 层：
 * S6-10 的分层棘轮要求 lib 层 getState 不再增长（lib 冻结 5 处白名单）。
 *
 * 约定：每次调用现取 getState、不缓存快照（水合/删歌/重排后不会读到过期队列）。
 */
import type { LoopMode } from "./slices/types";
import {
  computeNext,
  computePrev,
  type AdvanceQueueOptions,
  type QueueNavResult,
} from "@/lib/playback/queueNavigator";
import { usePlayerStore } from "./playerStore";
import { useQueueStore } from "./queueStore";

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  const safe = Number.isFinite(index) ? Math.trunc(index) : 0;
  return Math.max(0, Math.min(safe, length - 1));
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
  if (queue.length === 0) return { index: 0, song: null, reason: "empty" };

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
