/**
 * @deprecated 2026-10-21: unwired coordinator shell (0 imports outside this directory).
 * Kept for one release per AGENTS.md "不要删除不确定的代码"; do not import.
 * Replaced by the S6 domain use-cases + typed events (src/domain, src/lib/events).
 * Reference: docs/nbl/plans/2026-10-21-arch-perf-execution/S6-state-architecture.md
 */
import { useQueueStore } from "@/store/queueStore";
import type { Song } from "@/types/song";
import type { QueueCoordinator } from "./types";
import { audioCoordinator } from "./audioCoordinator";

export const queueCoordinator: QueueCoordinator = {
  insertNext: (song: Song) => {
    const { insertNext } = useQueueStore.getState();
    insertNext(song);
  },

  clearQueue: () => {
    const { queue, clearQueue } = useQueueStore.getState();
    clearQueue();
    return queue;
  },

  handleQueueEnd: () => {
    const { playThroughMode, queue } = useQueueStore.getState();
    if (playThroughMode === "normal") return;
    if (playThroughMode === "play-through" && queue.length > 0) {
      audioCoordinator.playSong(queue[0]);
    }
  },
};
