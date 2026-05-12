import { beforeEach, describe, expect, it } from "vitest";
import { useAudioStore } from "./audioStore";
import { usePlayerStore } from "./playerStore";
import { useQueueStore } from "./queueStore";

function createMockSong(id: string) {
  return {
    id,
    title: `Song ${id}`,
    artist: "Artist",
    duration: 200,
    source: "local",
    audioUrl: `stored://${id}`,
  };
}

describe("audioStore playback sync", () => {
  beforeEach(() => {
    localStorage.clear();

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
    });
  });

  it("should sync playerStore currentSong when advancing to next song", () => {
    const songs = [createMockSong("1"), createMockSong("2")];

    useAudioStore.getState().playQueue(songs, 0);
    useAudioStore.getState().nextSong();

    expect(useAudioStore.getState().currentSong?.id).toBe("2");
    expect(usePlayerStore.getState().currentSong?.id).toBe("2");
  });
});
