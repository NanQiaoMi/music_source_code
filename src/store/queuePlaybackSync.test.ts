import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioStore } from "./audioStore";
import { usePlayerStore } from "./playerStore";
import { usePlaybackRuntimeStore } from "./playbackRuntimeStore";
import { useQueueStore } from "./queueStore";
import { useUIStore } from "./uiStore";
import type { Song } from "@/types/song";

function song(id: string): Song {
  return {
    id,
    title: `Song ${id}`,
    artist: "Artist",
    duration: 180,
    source: "local",
    audioUrl: `stored://${id}`,
  };
}

function expectMirrorMatchesQueueStore(): void {
  const queueState = useQueueStore.getState();
  const audioState = useAudioStore.getState();
  expect(audioState.queue).toBe(queueState.queue);
  expect(audioState.currentIndex).toBe(queueState.currentIndex);
}

describe("queuePlaybackSync (S1-5)", () => {
  beforeEach(() => {
    localStorage.clear();
    usePlaybackRuntimeStore.getState().reset();
    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isLoading: false,
      volume: 0.7,
      isMuted: false,
      playbackRate: 1,
      loopMode: "none",
    });
    useQueueStore.setState({
      queue: [],
      currentIndex: 0,
      history: [],
      playThroughMode: "normal",
    });
    useAudioStore.setState({
      currentSong: null,
      queue: [],
      currentIndex: 0,
      currentTime: 0,
      isPlaying: false,
      isLoading: false,
      error: null,
      isEmotionCurveMode: false,
      loopMode: "none",
    });
  });

  it("audioStore mirror equals queueStore after setQueue/add/remove/reorder/clear", () => {
    const queueStore = useQueueStore.getState();
    const [a, b, c] = [song("a"), song("b"), song("c")];

    queueStore.setQueue([a, b]);
    expectMirrorMatchesQueueStore();

    queueStore.setCurrentIndex(1);
    expectMirrorMatchesQueueStore();

    queueStore.addToQueue(c);
    expectMirrorMatchesQueueStore();

    queueStore.removeFromQueue(0);
    expectMirrorMatchesQueueStore();

    queueStore.reorderQueue(1, 0);
    expectMirrorMatchesQueueStore();

    queueStore.clearQueue();
    expectMirrorMatchesQueueStore();
    expect(useAudioStore.getState().queue).toEqual([]);
    expect(useAudioStore.getState().currentIndex).toBe(0);
  });

  it("next advances queueStore, mirror, playerStore and the playback request together", () => {
    const songs = [song("a"), song("b"), song("c")];
    useAudioStore.getState().playQueue(songs, 0);

    useAudioStore.getState().nextSong();

    expect(useQueueStore.getState().currentIndex).toBe(1);
    expectMirrorMatchesQueueStore();
    expect(useAudioStore.getState().currentSong?.id).toBe("b");
    expect(usePlayerStore.getState().currentSong?.id).toBe("b");
    expect(usePlaybackRuntimeStore.getState().targetSongId).toBe("b");
    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(true);
  });

  it("next uses the queueStore snapshot after the current song is removed", () => {
    const [a, b, c] = [song("a"), song("b"), song("c")];
    useAudioStore.getState().playQueue([a, b, c], 1);
    expect(useAudioStore.getState().currentSong?.id).toBe("b");

    useQueueStore.getState().removeFromQueue(1);
    expectMirrorMatchesQueueStore();
    expect(useQueueStore.getState().currentIndex).toBe(1);

    // Simulates the ended/next path: the removed song is still the media owner,
    // so the item now at currentIndex (C) is the next candidate, not a skip to A.
    useAudioStore.getState().nextSong();

    expect(useAudioStore.getState().currentSong?.id).toBe("c");
    expect(useQueueStore.getState().currentIndex).toBe(1);
    expectMirrorMatchesQueueStore();
    expect(usePlaybackRuntimeStore.getState().targetSongId).toBe("c");
  });

  it("next follows the reordered queue", () => {
    const [a, b, c] = [song("a"), song("b"), song("c")];
    useAudioStore.getState().playQueue([a, b, c], 0);

    useQueueStore.getState().reorderQueue(2, 0);
    expect(useQueueStore.getState().queue.map((item) => item.id)).toEqual(["c", "a", "b"]);
    expect(useQueueStore.getState().currentIndex).toBe(1);

    useAudioStore.getState().nextSong();

    expect(useAudioStore.getState().currentSong?.id).toBe("b");
    expect(useQueueStore.getState().currentIndex).toBe(2);
    expectMirrorMatchesQueueStore();
  });

  it("clearing the queue stops playback without toast or error", () => {
    const [a, b] = [song("a"), song("b")];
    useAudioStore.getState().playQueue([a, b], 0);
    const showToast = vi.spyOn(useUIStore.getState(), "showToast");

    useQueueStore.getState().clearQueue();
    useAudioStore.getState().nextSong();

    expect(useQueueStore.getState().queue).toEqual([]);
    expect(useAudioStore.getState().queue).toEqual([]);
    expect(useAudioStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(false);
    expect(useAudioStore.getState().error).toBeNull();
    expect(showToast).not.toHaveBeenCalled();

    showToast.mockRestore();
  });

  it("stopping at the end leaves the queue index on the last item", () => {
    useAudioStore.getState().playQueue([song("a"), song("b")], 1);
    usePlayerStore.setState({ loopMode: "none" });

    useAudioStore.getState().nextSong();

    expect(useQueueStore.getState().currentIndex).toBe(1);
    expectMirrorMatchesQueueStore();
    expect(useAudioStore.getState().isPlaying).toBe(false);
    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(false);
    expect(usePlaybackRuntimeStore.getState().targetSongId).toBeNull();
  });

  it("play-through mode stops at the end even with list-loop enabled", () => {
    useAudioStore.getState().playQueue([song("a"), song("b")], 1);
    useQueueStore.getState().setPlayThroughMode("play-through");
    usePlayerStore.setState({ loopMode: "all" });

    useAudioStore.getState().nextSong();

    expect(useAudioStore.getState().isPlaying).toBe(false);
    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(false);
    expect(useQueueStore.getState().currentIndex).toBe(1);
  });

  it("manual skip in single-loop mode advances to the next queue item", () => {
    useAudioStore.getState().playQueue([song("a"), song("b")], 0);
    usePlayerStore.setState({ loopMode: "single" });

    useAudioStore.getState().nextSong();

    expect(useAudioStore.getState().currentSong?.id).toBe("b");
    expect(useQueueStore.getState().currentIndex).toBe(1);
  });

  it("mirror writes never propagate back to queueStore", () => {
    const [a, b] = [song("a"), song("b")];
    useQueueStore.getState().setQueue([a]);
    useQueueStore.getState().setCurrentIndex(0);
    const queueBefore = useQueueStore.getState().queue;
    const indexBefore = useQueueStore.getState().currentIndex;

    useAudioStore.setState({ queue: [a, b], currentIndex: 1 });

    expect(useQueueStore.getState().queue).toBe(queueBefore);
    expect(useQueueStore.getState().currentIndex).toBe(indexBefore);
  });

  it("compatibility setters delegate to queueStore", () => {
    const [a, b] = [song("a"), song("b")];

    useAudioStore.getState().setQueue([a, b]);
    useAudioStore.getState().setCurrentIndex(1);

    expect(useQueueStore.getState().queue.map((item) => item.id)).toEqual(["a", "b"]);
    expect(useQueueStore.getState().currentIndex).toBe(1);
    expectMirrorMatchesQueueStore();
  });
});
