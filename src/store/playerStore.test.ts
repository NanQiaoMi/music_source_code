import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "./playerStore";

const mockSong = {
  id: "song-1",
  title: "Test Song",
  artist: "Test Artist",
  duration: 240,
  source: "local" as const,
};

describe("playerStore", () => {
  beforeEach(() => {
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

  it("clamps playbackRate and rounds to one decimal place", () => {
    const store = usePlayerStore.getState();

    store.setPlaybackRate(1.26);
    expect(usePlayerStore.getState().playbackRate).toBe(1.3);

    store.setPlaybackRate(0.44);
    expect(usePlayerStore.getState().playbackRate).toBe(0.5);

    store.setPlaybackRate(2.04);
    expect(usePlayerStore.getState().playbackRate).toBe(2);
  });

  it("togglePlay flips playback state", () => {
    const store = usePlayerStore.getState();

    store.togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    store.togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
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

  it("persists only the persist-relevant player settings", () => {
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
      volume: 0.2,
      isMuted: true,
      playbackRate: 1.4,
      loopMode: "single",
    });
    expect(parsed.state.currentSong).toBeUndefined();
    expect(parsed.state.isPlaying).toBeUndefined();
    expect(parsed.state.currentTime).toBeUndefined();
  });
});
