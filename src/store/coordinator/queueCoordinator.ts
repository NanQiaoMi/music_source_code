import { useQueueStore } from "@/store/queueStore";
import { useRecommendationStore } from "@/store/recommendationStore";
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
