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

/** S6-5: audioStore no longer mirrors queue/currentIndex (queueStore is the only owner). */
function expectNoQueueMirror(): void {
  const audioState = useAudioStore.getState() as unknown as Record<string, unknown>;
  expect(Object.prototype.hasOwnProperty.call(audioState, "queue")).toBe(false);
  expect(Object.prototype.hasOwnProperty.call(audioState, "currentIndex")).toBe(false);
  expect(audioState.setQueue).toBeUndefined();
  expect(audioState.setCurrentIndex).toBeUndefined();
}

describe("queuePlaybackSync (S1-5 + S6-5 ownership)", () => {
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
      currentTime: 0,
      isPlaying: false,
      isLoading: false,
      error: null,
      isEmotionCurveMode: false,
      loopMode: "none",
    });
  });

  it("queue edits go to queueStore only and never create an audioStore mirror", () => {
    const queueStore = useQueueStore.getState();
    const [a, b, c] = [song("a"), song("b"), song("c")];

    queueStore.setQueue([a, b]);
    queueStore.setCurrentIndex(1);
    queueStore.addToQueue(c);
    queueStore.removeFromQueue(0);
    queueStore.reorderQueue(1, 0);
    queueStore.clearQueue();

    expect(useQueueStore.getState().queue).toEqual([]);
    expect(useQueueStore.getState().currentIndex).toBe(0);
    expectNoQueueMirror();
  });

  it("next advances queueStore, playerStore and the playback request together", () => {
    const songs = [song("a"), song("b"), song("c")];
    useAudioStore.getState().playQueue(songs, 0);

    useAudioStore.getState().nextSong();

    expect(useQueueStore.getState().currentIndex).toBe(1);
    expect(useAudioStore.getState().currentSong?.id).toBe("b");
    expect(usePlayerStore.getState().currentSong?.id).toBe("b");
    expect(usePlaybackRuntimeStore.getState().targetSongId).toBe("b");
    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(true);
    expectNoQueueMirror();
  });

  it("next uses the queueStore snapshot after the current song is removed", () => {
    const [a, b, c] = [song("a"), song("b"), song("c")];
    useAudioStore.getState().playQueue([a, b, c], 1);
    expect(useAudioStore.getState().currentSong?.id).toBe("b");

    useQueueStore.getState().removeFromQueue(1);
    expect(useQueueStore.getState().currentIndex).toBe(1);

    // Simulates the ended/next path: the removed song is still the media owner,
    // so the item now at currentIndex (C) is the next candidate, not a skip to A.
    useAudioStore.getState().nextSong();

    expect(useAudioStore.getState().currentSong?.id).toBe("c");
    expect(useQueueStore.getState().currentIndex).toBe(1);
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
  });

  it("clearing the queue stops playback without toast or error", () => {
    const [a, b] = [song("a"), song("b")];
    useAudioStore.getState().playQueue([a, b], 0);
    const showToast = vi.spyOn(useUIStore.getState(), "showToast");

    useQueueStore.getState().clearQueue();
    useAudioStore.getState().nextSong();

    expect(useQueueStore.getState().queue).toEqual([]);
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
});
