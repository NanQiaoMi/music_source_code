import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useQueueStore } from "./queueStore";

function createMockSong(id: string) {
  return { id, title: `Song ${id}`, artist: "Artist", duration: 200, source: "local" };
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

  afterEach(() => {
    vi.restoreAllMocks();
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

    it("should strip heavy queue payloads before persisting", () => {
      const store = useQueueStore.getState();
      const largeSong = {
        ...createMockSong("heavy"),
        cover: `data:image/png;base64,${"a".repeat(10_000)}`,
        lyrics: "l".repeat(10_000),
        audioUrl: "stored://heavy-song",
      };

      store.setQueue([largeSong]);

      const persisted = localStorage.getItem("queue-store-v5");
      expect(persisted).not.toBeNull();

      const parsed = JSON.parse(persisted!);
      expect(parsed.state.queue[0].cover).toBe("");
      expect(parsed.state.queue[0].lyrics).toBeUndefined();
      expect(parsed.state.queue[0].audioUrl).toBe("stored://heavy-song");
    });

    it("should persist only minimal queue fields for large queues", () => {
      const store = useQueueStore.getState();
      const songs = Array.from({ length: 200 }, (_, i) => ({
        ...createMockSong(String(i)),
        cover: `data:image/png;base64,${"a".repeat(2000)}`,
        lyrics: "l".repeat(2000),
        translationLyrics: "t".repeat(2000),
        transliterationLyrics: "r".repeat(2000),
        genre: "genre",
        year: 2026,
        trackNumber: i,
        playCount: i,
        addedAt: i,
        filePath: `C:/music/${i}.mp3`,
        fileSize: 123456,
        sampleRate: 44100,
        bitRate: 320,
        format: "mp3",
        bpm: 120,
        key: "C",
      }));

      store.setQueue(songs);

      const persisted = localStorage.getItem("queue-store-v5");
      expect(persisted).not.toBeNull();

      const parsed = JSON.parse(persisted!);
      expect(parsed.state.queue).toHaveLength(200);
      expect(parsed.state.queue[0]).toMatchObject({
        id: "0",
        title: "Song 0",
        artist: "Artist",
        duration: 200,
        source: "local",
        cover: "",
      });
      expect(parsed.state.queue[0].lyrics).toBeUndefined();
      expect(parsed.state.queue[0].translationLyrics).toBeUndefined();
      expect(parsed.state.queue[0].transliterationLyrics).toBeUndefined();
      expect(parsed.state.queue[0].filePath).toBeUndefined();
      expect(parsed.state.queue[0].bitRate).toBeUndefined();
    });

    it("should drop persisted queue when quota is still exceeded after clearing history", () => {
      const store = useQueueStore.getState();
      const originalSetItem = Storage.prototype.setItem;

      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
        if (key === "queue-store-v5" && value.length > 600) {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }

        return originalSetItem.call(this, key, value);
      });

      const songs = Array.from({ length: 25 }, (_, i) => ({
        ...createMockSong(String(i)),
        audioUrl: `stored://${String(i).padStart(2, "0")}/${"a".repeat(120)}`,
      }));

      expect(() => store.setQueue(songs)).not.toThrow();

      const persisted = localStorage.getItem("queue-store-v5");
      expect(persisted).not.toBeNull();

      const parsed = JSON.parse(persisted!);
      expect(parsed.state.queue).toEqual([]);
      expect(parsed.state.currentIndex).toBe(0);
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
