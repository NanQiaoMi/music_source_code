import { useAudioStore, registerAudioSeekHandler } from "./audioStore";
import { usePlayerStore } from "./playerStore";
import { useQueueStore } from "./queueStore";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { MISSING_AUDIO_SOURCE_MESSAGE } from "@/lib/audio/playableAudioSource";

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

  it("rejects songs without an audio source without selecting them", () => {
    const demoSong = {
      id: "demo-empty",
      title: "Import Your Music",
      artist: "MIMI Demo",
      duration: 180,
      source: "demo",
      audioUrl: "",
    };

    useAudioStore.getState().playSong(demoSong);

    expect(useAudioStore.getState().currentSong).toBeNull();
    expect(usePlayerStore.getState().currentSong).toBeNull();
    expect(useAudioStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(useAudioStore.getState().isLoading).toBe(false);
    expect(useQueueStore.getState().queue).toEqual([]);
    expect(useAudioStore.getState().error?.message).toBe(MISSING_AUDIO_SOURCE_MESSAGE);
  });

  it("keeps the current playable song when a missing-source song is requested", () => {
    const currentSong = createMockSong("current");
    const demoSong = {
      id: "demo-empty",
      title: "Import Your Music",
      artist: "MIMI Demo",
      duration: 180,
      source: "demo",
      audioUrl: "",
    };

    useAudioStore.setState({ currentSong, queue: [currentSong], currentIndex: 0 });
    usePlayerStore.getState().setCurrentSong(currentSong);
    useQueueStore.getState().setQueue([currentSong]);

    useAudioStore.getState().playSong(demoSong);

    expect(useAudioStore.getState().currentSong?.id).toBe("current");
    expect(usePlayerStore.getState().currentSong?.id).toBe("current");
    expect(useAudioStore.getState().queue.map((song) => song.id)).toEqual(["current"]);
    expect(useQueueStore.getState().queue.map((song) => song.id)).toEqual(["current"]);
    expect(useAudioStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(useAudioStore.getState().error?.message).toBe(MISSING_AUDIO_SOURCE_MESSAGE);
  });

  it("does not replace playback state when a queue starts with a missing-source song", () => {
    const demoSong = {
      id: "demo-queue-empty",
      title: "Import Your Music",
      artist: "MIMI Demo",
      duration: 180,
      source: "demo",
      audioUrl: "",
    };

    useAudioStore.getState().playQueue([demoSong], 0);

    expect(useAudioStore.getState().currentSong).toBeNull();
    expect(usePlayerStore.getState().currentSong).toBeNull();
    expect(useAudioStore.getState().queue).toEqual([]);
    expect(useQueueStore.getState().queue).toEqual([]);
    expect(useAudioStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(useAudioStore.getState().error?.message).toBe(MISSING_AUDIO_SOURCE_MESSAGE);
  });

  it("does not append a missing-source song over an existing playable queue", () => {
    const currentSong = createMockSong("current");
    const demoSong = {
      id: "demo-append-empty",
      title: "Import Your Music",
      artist: "MIMI Demo",
      duration: 180,
      source: "demo",
      audioUrl: "",
    };

    useAudioStore.setState({ currentSong, queue: [currentSong], currentIndex: 0 });
    usePlayerStore.getState().setCurrentSong(currentSong);
    useQueueStore.getState().setQueue([currentSong]);

    useAudioStore.getState().appendSongsAndPlay([demoSong]);

    expect(useAudioStore.getState().currentSong?.id).toBe("current");
    expect(usePlayerStore.getState().currentSong?.id).toBe("current");
    expect(useAudioStore.getState().queue.map((song) => song.id)).toEqual(["current"]);
    expect(useQueueStore.getState().queue.map((song) => song.id)).toEqual(["current"]);
    expect(useAudioStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(useAudioStore.getState().error?.message).toBe(MISSING_AUDIO_SOURCE_MESSAGE);
  });
  it("blocks play toggles when the selected song has no audio source", () => {
    const demoSong = {
      id: "demo-selected",
      title: "Welcome to VIBE Player",
      artist: "MIMI Demo",
      duration: 180,
      source: "demo",
      audioUrl: "",
    };

    useAudioStore.getState().setCurrentSong(demoSong);
    useAudioStore.getState().setIsPlaying(true);

    expect(useAudioStore.getState().isPlaying).toBe(false);
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(useAudioStore.getState().isLoading).toBe(false);
    expect(useAudioStore.getState().error?.message).toBe(MISSING_AUDIO_SOURCE_MESSAGE);
  });

  it("should sync playerStore currentSong when advancing to next song", () => {
    const songs = [createMockSong("1"), createMockSong("2")];

    useAudioStore.getState().playQueue(songs, 0);
    useAudioStore.getState().nextSong();

    expect(useAudioStore.getState().currentSong?.id).toBe("2");
    expect(usePlayerStore.getState().currentSong?.id).toBe("2");
  });

  it("should update both audioStore and playerStore currentTime and call registered audio seek handler", () => {
    const seekHandler = vi.fn();
    registerAudioSeekHandler(seekHandler);

    useAudioStore.getState().seekTo(45.5);

    expect(useAudioStore.getState().currentTime).toBe(45.5);
    expect(usePlayerStore.getState().currentTime).toBe(45.5);
    expect(seekHandler).toHaveBeenCalledWith(45.5);

    registerAudioSeekHandler(null);
  });

  it("should bidirectionally sync currentTime between audioStore and playerStore", () => {
    usePlayerStore.getState().setCurrentTime(88.2);
    expect(useAudioStore.getState().currentTime).toBe(88.2);
    expect(usePlayerStore.getState().currentTime).toBe(88.2);

    useAudioStore.getState().setCurrentTime(12.5);
    expect(useAudioStore.getState().currentTime).toBe(12.5);
    expect(usePlayerStore.getState().currentTime).toBe(12.5);
  });

  it("should bidirectionally sync duration between audioStore and playerStore", () => {
    usePlayerStore.getState().setDuration(320);
    expect(useAudioStore.getState().duration).toBe(320);
    expect(usePlayerStore.getState().duration).toBe(320);

    useAudioStore.getState().setDuration(195);
    expect(useAudioStore.getState().duration).toBe(195);
    expect(usePlayerStore.getState().duration).toBe(195);
  });
});

