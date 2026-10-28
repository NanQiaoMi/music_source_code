import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "./playerStore";
import { usePlaybackRuntimeStore } from "./playbackRuntimeStore";
import { sanitizeSongForStorage } from "@/lib/storage/safeStorage";

const mockSong = {
  id: "song-1",
  title: "Test Song",
  artist: "Test Artist",
  album: "Test Album",
  cover: "/cover.jpg",
  audioUrl: "https://example.com/audio.mp3",
  duration: 240,
  source: "local" as const,
};

describe("playerStore", () => {
  beforeEach(() => {
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
    localStorage.clear();
  });

  it("clamps volume to the 0-1 range", () => {
    const store = usePlayerStore.getState();

    store.setVolume(-0.5);
    expect(usePlayerStore.getState().volume).toBe(0);

    store.setVolume(1.5);
    expect(usePlayerStore.getState().volume).toBe(1);
  });

  it("clamps playbackRate and rounds to two decimal places", () => {
    const store = usePlayerStore.getState();

    store.setPlaybackRate(1.25);
    expect(usePlayerStore.getState().playbackRate).toBe(1.25);

    store.setPlaybackRate(0.75);
    expect(usePlayerStore.getState().playbackRate).toBe(0.75);

    store.setPlaybackRate(1.256);
    expect(usePlayerStore.getState().playbackRate).toBe(1.26);

    store.setPlaybackRate(0.44);
    expect(usePlayerStore.getState().playbackRate).toBe(0.5);

    store.setPlaybackRate(2.04);
    expect(usePlayerStore.getState().playbackRate).toBe(2);

    store.resetPlaybackRate();
    expect(usePlayerStore.getState().playbackRate).toBe(1.0);
  });

  it("togglePlay requests playback and can cancel a pending play without faking confirmed state", () => {
    const store = usePlayerStore.getState();
    store.setCurrentSong(mockSong);

    store.togglePlay();
    const requestId = usePlaybackRuntimeStore.getState().requestId;
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(true);
    expect(usePlaybackRuntimeStore.getState().phase).toBe("loading");

    store.togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    expect(usePlaybackRuntimeStore.getState().shouldPlay).toBe(false);
    expect(usePlaybackRuntimeStore.getState().requestId).toBe(requestId + 1);
  });

  it("toggleMute flips mute state", () => {
    const store = usePlayerStore.getState();

    store.toggleMute();
    expect(usePlayerStore.getState().isMuted).toBe(true);

    store.toggleMute();
    expect(usePlayerStore.getState().isMuted).toBe(false);
  });

  it("prevents currentTime from going below zero", () => {
    const store = usePlayerStore.getState();

    store.setCurrentTime(-12);
    expect(usePlayerStore.getState().currentTime).toBe(0);

    store.setCurrentTime(42);
    expect(usePlayerStore.getState().currentTime).toBe(42);
  });

  it("persists player settings without owning playback progress", () => {
    const store = usePlayerStore.getState();

    store.setCurrentSong(mockSong);
    store.setIsPlaying(true);
    store.setCurrentTime(99);
    store.setDuration(240);
    store.setIsLoading(true);
    store.setVolume(0.2);
    store.setIsMuted(true);
    store.setPlaybackRate(1.4);
    store.setLoopMode("single");

    const saved = localStorage.getItem("player-store");
    expect(saved).not.toBeNull();

    const parsed = JSON.parse(saved!);
    expect(parsed.state).toEqual({
      currentSong: sanitizeSongForStorage(mockSong),
      volume: 0.2,
      isMuted: true,
      playbackRate: 1.4,
      loopMode: "single",
    });
    // 进度运行时镜像仍在，但不进入 player-store envelope（audioStore 单一权威）
    expect(usePlayerStore.getState().currentTime).toBe(99);
    expect(usePlayerStore.getState().duration).toBe(240);
    expect(parsed.state.currentTime).toBeUndefined();
    expect(parsed.state.duration).toBeUndefined();
    expect(parsed.state.isPlaying).toBeUndefined();
    expect(parsed.state.isLoading).toBeUndefined();
  });
});
