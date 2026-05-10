import { describe, it, expect, beforeEach } from "vitest";
import { useQueueStore } from "./queueStore";

function createMockSong(id: string) {
  return { id, title: `Song ${id}`, artist: "Artist", duration: 200 };
}

describe("queueStore", () => {
  beforeEach(() => {
    useQueueStore.setState({
      queue: [],
      currentIndex: 0,
      history: [],
      playThroughMode: "normal",
    });
    localStorage.clear();
  });

  describe("persistence", () => {
    it("should persist queue, history, and currentIndex to localStorage", () => {
      const store = useQueueStore.getState();
      store.setQueue([createMockSong("1"), createMockSong("2")]);
      store.setCurrentIndex(1);
      store.addToHistory(createMockSong("1"));

      const persisted = localStorage.getItem("queue-store-v5");
      expect(persisted).not.toBeNull();

      const parsed = JSON.parse(persisted!);
      expect(parsed.state.queue).toHaveLength(2);
      expect(parsed.state.currentIndex).toBe(1);
      expect(parsed.state.history).toHaveLength(1);
    });
  });

  describe("insertNext", () => {
    it("should insert song at currentIndex + 1 position", () => {
      const store = useQueueStore.getState();
      store.setQueue([createMockSong("1"), createMockSong("2"), createMockSong("3")]);
      store.setCurrentIndex(0);

      store.insertNext(createMockSong("inserted"));

      const queue = useQueueStore.getState().queue;
      expect(queue).toHaveLength(4);
      expect(queue[0].id).toBe("1");
      expect(queue[1].id).toBe("inserted");
      expect(queue[2].id).toBe("2");
    });

    it("should append to end if queue is empty", () => {
      const store = useQueueStore.getState();
      store.insertNext(createMockSong("1"));

      const queue = useQueueStore.getState().queue;
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe("1");
    });
  });

  describe("playThroughMode", () => {
    it("should default to normal mode", () => {
      expect(useQueueStore.getState().playThroughMode).toBe("normal");
    });

    it("should switch between normal and play-through", () => {
      const store = useQueueStore.getState();
      store.setPlayThroughMode("play-through");
      expect(useQueueStore.getState().playThroughMode).toBe("play-through");

      store.setPlayThroughMode("normal");
      expect(useQueueStore.getState().playThroughMode).toBe("normal");
    });
  });

  describe("shuffleQueue (Fisher-Yates)", () => {
    it("should keep queue length unchanged after shuffle", () => {
      const store = useQueueStore.getState();
      const songs = [
        createMockSong("1"),
        createMockSong("2"),
        createMockSong("3"),
        createMockSong("4"),
        createMockSong("5"),
      ];
      store.setQueue(songs);

      store.shuffleQueue();

      const queue = useQueueStore.getState().queue;
      expect(queue).toHaveLength(5);
    });

    it("should contain all original elements after shuffle", () => {
      const store = useQueueStore.getState();
      const songs = [
        createMockSong("1"),
        createMockSong("2"),
        createMockSong("3"),
        createMockSong("4"),
        createMockSong("5"),
      ];
      store.setQueue(songs);

      store.shuffleQueue();

      const queue = useQueueStore.getState().queue;
      const ids = queue.map((s) => s.id).sort();
      expect(ids).toEqual(["1", "2", "3", "4", "5"]);
    });
  });
});
